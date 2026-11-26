package com.example.kharch.data

import com.example.kharch.BuildConfig
import com.example.kharch.model.AuthSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Lightweight Firebase Auth & Cloud Firestore REST client using the exact
 * project configuration from root `.env` (`FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`).
 * Reads and writes identical `users/{uid}/...` documents as the Kharch Web App.
 */
class FirebaseRestClient {

    private val apiKey: String = BuildConfig.FIREBASE_API_KEY
    private val projectId: String = BuildConfig.FIREBASE_PROJECT_ID

    val isConfigured: Boolean
        get() = apiKey.isNotBlank() && projectId.isNotBlank()

    private val json = Json { ignoreUnknownKeys = true }

    private suspend fun requestJson(
        urlStr: String,
        method: String = "GET",
        body: JsonObject? = null,
        bearerToken: String? = null
    ): JsonObject = withContext(Dispatchers.IO) {
        val url = URL(urlStr)
        val conn = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15000
            readTimeout = 20000
            setRequestProperty("Content-Type", "application/json; charset=UTF-8")
            if (!bearerToken.isNullOrBlank()) {
                setRequestProperty("Authorization", "Bearer $bearerToken")
            }
            if (body != null && (method == "POST" || method == "PATCH" || method == "PUT")) {
                doOutput = true
                outputStream.use { os ->
                    os.write(body.toString().toByteArray(Charsets.UTF_8))
                }
            }
        }

        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
        val parsed = runCatching { json.parseToJsonElement(text).jsonObject }.getOrDefault(buildJsonObject {})

        if (code !in 200..299) {
            val errMsg = parsed["error"]?.let { errEl ->
                if (errEl is JsonObject) errEl["message"]?.jsonPrimitive?.contentOrNull else errEl.toString()
            } ?: "HTTP $code"
            throw Exception(friendlyAuthError(errMsg))
        }
        parsed
    }

    internal fun friendlyAuthError(raw: String): String {
        return when {
            raw.contains("EMAIL_EXISTS") -> "This email is already registered. Try signing in instead."
            raw.contains("INVALID_LOGIN_CREDENTIALS") || raw.contains("INVALID_PASSWORD") || raw.contains("EMAIL_NOT_FOUND") ->
                "Incorrect email or password. If you usually use Google Sign-In on Web, tap \"Continue with Google\" above or use \"Forgot\" to set a password."
            raw.contains("USER_DISABLED") -> "This account has been disabled in Firebase Authentication."
            raw.contains("WEAK_PASSWORD") -> "Password must be at least 6 characters."
            raw.contains("INVALID_EMAIL") -> "Please enter a valid email address."
            raw.contains("TOO_MANY_ATTEMPTS") -> "Too many failed attempts. Please wait a minute and try again."
            raw.contains("INVALID_IDP_RESPONSE") -> "Google authentication token could not be verified by Firebase. Please try again."
            raw.contains("FEDERATED_USER_ID_ALREADY_LINKED") -> "This Google account is already linked to another user."
            raw.contains("OPERATION_NOT_ALLOWED") -> "This sign-in provider is not enabled in Firebase Authentication."
            else -> raw.ifBlank { "Authentication request failed. Check your internet connection." }
        }
    }

    // -----------------------------------------
    // Firebase Auth REST API
    // -----------------------------------------

    suspend fun signIn(email: String, password: String): AuthSession {
        check(isConfigured) { "Firebase is not configured." }
        val payload = buildJsonObject {
            put("email", email)
            put("password", password)
            put("returnSecureToken", true)
        }
        val res = requestJson(
            urlStr = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apiKey",
            method = "POST",
            body = payload
        )
        return parseAuthResponse(res, fallbackEmail = email)
    }

    suspend fun signInWithGoogleIdToken(idToken: String): AuthSession {
        check(isConfigured) { "Firebase is not configured." }
        val encodedToken = URLEncoder.encode(idToken, "UTF-8")
        val payload = buildJsonObject {
            put("postBody", "id_token=$encodedToken&providerId=google.com")
            put("requestUri", "http://localhost")
            put("returnIdpCredential", true)
            put("returnSecureToken", true)
        }
        val res = requestJson(
            urlStr = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=$apiKey",
            method = "POST",
            body = payload
        )
        return parseAuthResponse(res, fallbackEmail = "")
    }

    suspend fun signUp(email: String, password: String, displayName: String): AuthSession {
        check(isConfigured) { "Firebase is not configured." }
        val payload = buildJsonObject {
            put("email", email)
            put("password", password)
            put("returnSecureToken", true)
        }
        val res = requestJson(
            urlStr = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$apiKey",
            method = "POST",
            body = payload
        )
        val session = parseAuthResponse(res, fallbackEmail = email)
        if (displayName.isNotBlank()) {
            return runCatching { updateDisplayName(session, displayName) }.getOrDefault(session.copy(displayName = displayName))
        }
        return session
    }

    suspend fun updateDisplayName(session: AuthSession, displayName: String): AuthSession {
        val valid = ensureValidSession(session)
        val payload = buildJsonObject {
            put("idToken", valid.idToken)
            put("displayName", displayName)
            put("returnSecureToken", true)
        }
        val res = requestJson(
            urlStr = "https://identitytoolkit.googleapis.com/v1/accounts:update?key=$apiKey",
            method = "POST",
            body = payload
        )
        val newToken = res["idToken"]?.jsonPrimitive?.contentOrNull ?: valid.idToken
        val newRefresh = res["refreshToken"]?.jsonPrimitive?.contentOrNull ?: valid.refreshToken
        val expiresSec = res["expiresIn"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 3600L
        return valid.copy(
            displayName = displayName,
            idToken = newToken,
            refreshToken = newRefresh,
            expiresAtMs = System.currentTimeMillis() + (expiresSec * 1000L)
        )
    }

    suspend fun sendPasswordResetEmail(email: String) {
        check(isConfigured) { "Firebase is not configured." }
        val payload = buildJsonObject {
            put("requestType", "PASSWORD_RESET")
            put("email", email)
        }
        requestJson(
            urlStr = "https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=$apiKey",
            method = "POST",
            body = payload
        )
    }

    suspend fun ensureValidSession(session: AuthSession): AuthSession {
        if (System.currentTimeMillis() < session.expiresAtMs - 120_000L) {
            return session
        }
        val payload = buildJsonObject {
            put("grant_type", "refresh_token")
            put("refresh_token", session.refreshToken)
        }
        val res = requestJson(
            urlStr = "https://securetoken.googleapis.com/v1/token?key=$apiKey",
            method = "POST",
            body = payload
        )
        val idToken = res["id_token"]?.jsonPrimitive?.contentOrNull ?: session.idToken
        val refreshToken = res["refresh_token"]?.jsonPrimitive?.contentOrNull ?: session.refreshToken
        val expiresSec = res["expires_in"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 3600L
        return session.copy(
            idToken = idToken,
            refreshToken = refreshToken,
            expiresAtMs = System.currentTimeMillis() + (expiresSec * 1000L)
        )
    }

    private fun parseAuthResponse(res: JsonObject, fallbackEmail: String): AuthSession {
        val uid = res["localId"]?.jsonPrimitive?.content ?: throw Exception("Missing user id")
        val email = res["email"]?.jsonPrimitive?.contentOrNull ?: fallbackEmail
        val displayName = res["displayName"]?.jsonPrimitive?.contentOrNull ?: email.substringBefore('@')
        val idToken = res["idToken"]?.jsonPrimitive?.content ?: throw Exception("Missing idToken")
        val refreshToken = res["refreshToken"]?.jsonPrimitive?.content ?: ""
        val expiresSec = res["expiresIn"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 3600L
        return AuthSession(
            uid = uid,
            email = email,
            displayName = displayName,
            idToken = idToken,
            refreshToken = refreshToken,
            expiresAtMs = System.currentTimeMillis() + (expiresSec * 1000L)
        )
    }

    // -----------------------------------------
    // Cloud Firestore REST API (users/{uid}/...)
    // -----------------------------------------

    private fun firestoreBaseUrl(uid: String, subPath: String): String {
        return "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/users/$uid/$subPath"
    }

    suspend fun listCollection(session: AuthSession, collectionName: String): List<Pair<String, Map<String, Any?>>> {
        val valid = ensureValidSession(session)
        val allDocs = mutableListOf<Pair<String, Map<String, Any?>>>()
        var pageToken: String? = null

        do {
            val url = buildString {
                append(firestoreBaseUrl(valid.uid, collectionName))
                append("?pageSize=300")
                if (!pageToken.isNullOrBlank()) {
                    append("&pageToken=").append(URLEncoder.encode(pageToken, "UTF-8"))
                }
            }
            val res = requestJson(urlStr = url, method = "GET", bearerToken = valid.idToken)
            val docs = res["documents"]?.jsonArray ?: JsonArray(emptyList())
            docs.forEach { el ->
                val obj = el.jsonObject
                val fullName = obj["name"]?.jsonPrimitive?.contentOrNull ?: ""
                val docId = fullName.substringAfterLast('/')
                val fields = obj["fields"]?.jsonObject?.let { decodeFields(it) } ?: emptyMap()
                if (docId.isNotBlank()) allDocs.add(docId to fields)
            }
            pageToken = res["nextPageToken"]?.jsonPrimitive?.contentOrNull
        } while (!pageToken.isNullOrBlank())

        return allDocs
    }

    suspend fun getDocument(session: AuthSession, docPath: String): Map<String, Any?>? {
        val valid = ensureValidSession(session)
        return runCatching {
            val res = requestJson(
                urlStr = firestoreBaseUrl(valid.uid, docPath),
                method = "GET",
                bearerToken = valid.idToken
            )
            res["fields"]?.jsonObject?.let { decodeFields(it) } ?: emptyMap()
        }.getOrNull()
    }

    suspend fun addDocument(session: AuthSession, collectionName: String, fields: Map<String, Any?>): String {
        val valid = ensureValidSession(session)
        val body = buildJsonObject { put("fields", encodeFields(fields)) }
        val res = requestJson(
            urlStr = firestoreBaseUrl(valid.uid, collectionName),
            method = "POST",
            body = body,
            bearerToken = valid.idToken
        )
        val fullName = res["name"]?.jsonPrimitive?.contentOrNull ?: ""
        return fullName.substringAfterLast('/')
    }

    suspend fun patchDocument(session: AuthSession, docPath: String, fields: Map<String, Any?>) {
        val valid = ensureValidSession(session)
        val masks = fields.keys.joinToString("&") { "updateMask.fieldPaths=${URLEncoder.encode(it, "UTF-8")}" }
        val url = "${firestoreBaseUrl(valid.uid, docPath)}?$masks"
        val body = buildJsonObject { put("fields", encodeFields(fields)) }
        requestJson(urlStr = url, method = "PATCH", body = body, bearerToken = valid.idToken)
    }

    suspend fun deleteDocument(session: AuthSession, docPath: String) {
        val valid = ensureValidSession(session)
        requestJson(
            urlStr = firestoreBaseUrl(valid.uid, docPath),
            method = "DELETE",
            bearerToken = valid.idToken
        )
    }

    // Firestore Value Encoding/Decoding helpers
    private fun encodeFields(map: Map<String, Any?>): JsonObject = buildJsonObject {
        map.forEach { (k, v) -> put(k, encodeValue(v)) }
    }

    @Suppress("UNCHECKED_CAST")
    private fun encodeValue(value: Any?): JsonObject = buildJsonObject {
        when (value) {
            null -> put("nullValue", JsonNull)
            is Boolean -> put("booleanValue", value)
            is Int -> put("integerValue", value.toString())
            is Long -> put("integerValue", value.toString())
            is Double -> put("doubleValue", value)
            is Float -> put("doubleValue", value.toDouble())
            is String -> put("stringValue", value)
            is List<*> -> put("arrayValue", buildJsonObject {
                put("values", buildJsonArray {
                    value.forEach { item -> add(encodeValue(item)) }
                })
            })
            is Map<*, *> -> put("mapValue", buildJsonObject {
                put("fields", encodeFields(value as Map<String, Any?>))
            })
            else -> put("stringValue", value.toString())
        }
    }

    private fun decodeFields(fields: JsonObject): Map<String, Any?> {
        val result = mutableMapOf<String, Any?>()
        fields.forEach { (k, v) -> result[k] = decodeValue(v.jsonObject) }
        return result
    }

    private fun decodeValue(v: JsonObject): Any? {
        return when {
            "stringValue" in v -> v["stringValue"]?.jsonPrimitive?.contentOrNull
            "integerValue" in v -> v["integerValue"]?.jsonPrimitive?.contentOrNull?.toLongOrNull()
            "doubleValue" in v -> v["doubleValue"]?.jsonPrimitive?.doubleOrNull
            "booleanValue" in v -> v["booleanValue"]?.jsonPrimitive?.booleanOrNull
            "timestampValue" in v -> v["timestampValue"]?.jsonPrimitive?.contentOrNull
            "nullValue" in v -> null
            "arrayValue" in v -> {
                val vals = v["arrayValue"]?.jsonObject?.get("values")?.jsonArray ?: return emptyList<Any?>()
                vals.map { decodeValue(it.jsonObject) }
            }
            "mapValue" in v -> {
                val f = v["mapValue"]?.jsonObject?.get("fields")?.jsonObject ?: return emptyMap<String, Any?>()
                decodeFields(f)
            }
            else -> null
        }
    }
}
