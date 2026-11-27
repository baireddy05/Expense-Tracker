package com.example.kharch.ui.components

import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.example.kharch.BuildConfig
import com.example.kharch.ui.theme.*
import com.example.kharch.util.ShareAndPdfUtils
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.security.MessageDigest

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthModalSheet(
    isOpen: Boolean,
    firebaseConfigured: Boolean,
    initialTab: String = "login",
    onDismiss: () -> Unit,
    onLogin: suspend (String, String) -> String?,
    onSignup: suspend (String, String, String) -> String?,
    onGoogleLogin: suspend (String) -> String?,
    onResetPassword: suspend (String) -> String?,
    onContinueGuest: () -> Unit
) {
    if (!isOpen) return
    val kc = LocalKharchColors.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val activityContext = remember(context) { context.findActivity() ?: context }
    val scrollState = rememberScrollState()
    val focusManager = LocalFocusManager.current

    var activeTab by remember(isOpen, initialTab) { mutableStateOf(initialTab) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var displayName by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var isGoogleSubmitting by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf("") }
    var successMsg by remember { mutableStateOf("") }
    var googleConfigHint by remember { mutableStateOf<String?>(null) }

    val anyBusy = isSubmitting || isGoogleSubmitting

    fun submitEmailForm() {
        val trimmedEmail = email.trim()
        if (trimmedEmail.isBlank() || !trimmedEmail.contains("@")) {
            errorMsg = "Please enter a valid email address."
            return
        }
        if (activeTab != "forgot" && password.length < 6) {
            errorMsg = "Password must be at least 6 characters."
            return
        }
        if (activeTab == "signup" && displayName.trim().isBlank()) {
            errorMsg = "Please enter your display name."
            return
        }
        if (!firebaseConfigured) {
            errorMsg = "Firebase configuration missing in BuildConfig (.env)."
            return
        }
        focusManager.clearFocus()
        errorMsg = ""
        successMsg = ""
        isSubmitting = true
        scope.launch {
            val err = when (activeTab) {
                "signup" -> onSignup(trimmedEmail, password, displayName.trim())
                "forgot" -> onResetPassword(trimmedEmail)
                else -> onLogin(trimmedEmail, password)
            }
            isSubmitting = false
            if (err == null) {
                if (activeTab == "forgot") {
                    successMsg = "Password reset link sent to $trimmedEmail. Check Inbox/Spam to set or reset your password."
                } else {
                    onDismiss()
                }
            } else {
                errorMsg = err
            }
        }
    }

    fun launchGoogleSignIn() {
        if (!firebaseConfigured) {
            errorMsg = "Firebase configuration missing in BuildConfig (.env)."
            return
        }
        val webClientId = BuildConfig.GOOGLE_WEB_CLIENT_ID
        if (webClientId.isBlank()) {
            errorMsg = "Google Web Client ID is not configured."
            return
        }
        focusManager.clearFocus()
        errorMsg = ""
        successMsg = ""
        googleConfigHint = null
        isGoogleSubmitting = true

        scope.launch {
            val credentialManager = CredentialManager.create(activityContext)
            try {
                val result = try {
                    val signInOption = GetSignInWithGoogleOption.Builder(webClientId).build()
                    val req = GetCredentialRequest.Builder()
                        .addCredentialOption(signInOption)
                        .build()
                    credentialManager.getCredential(request = req, context = activityContext)
                } catch (_: NoCredentialException) {
                    val googleIdOption = GetGoogleIdOption.Builder()
                        .setFilterByAuthorizedAccounts(false)
                        .setServerClientId(webClientId)
                        .build()
                    val fallbackReq = GetCredentialRequest.Builder()
                        .addCredentialOption(googleIdOption)
                        .build()
                    credentialManager.getCredential(request = fallbackReq, context = activityContext)
                }

                val credential = result.credential
                if (credential is CustomCredential &&
                    credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                ) {
                    val googleCred = GoogleIdTokenCredential.createFrom(credential.data)
                    val firebaseErr = onGoogleLogin(googleCred.idToken)
                    isGoogleSubmitting = false
                    if (firebaseErr == null) {
                        onDismiss()
                    } else {
                        errorMsg = firebaseErr
                    }
                } else {
                    isGoogleSubmitting = false
                    errorMsg = "Unexpected Google credential type received (${credential.type})."
                }
            } catch (e: GetCredentialCancellationException) {
                isGoogleSubmitting = false
                Log.w("KharchAuth", "Google Sign-In canceled/aborted by Play Services: ${e.message}", e)
                val sha1 = rememberAppFingerprint(activityContext, "SHA-1")
                errorMsg = "Google Sign-In did not complete (${e.message?.takeIf { it.isNotBlank() } ?: "canceled"})."
                googleConfigHint = buildString {
                    append("If you selected your account and returned here, Google Play Services blocked the token because Android package '${activityContext.packageName}'")
                    if (sha1 != null) append(" with SHA-1 '$sha1'")
                    append(" is not registered in Firebase Console → Project Settings yet. Add it once, or tap 'Set Gmail Password' below to set a password for your Gmail right away.")
                }
                scope.launch { scrollState.animateScrollTo(0) }
            } catch (e: GoogleIdTokenParsingException) {
                isGoogleSubmitting = false
                Log.e("KharchAuth", "GoogleIdTokenParsingException", e)
                errorMsg = "Invalid Google ID token response (${e.message})."
            } catch (e: GetCredentialException) {
                isGoogleSubmitting = false
                Log.e("KharchAuth", "GetCredentialException [${e.type}]: ${e.message}", e)
                val detail = e.message.orEmpty()
                val sha1 = rememberAppFingerprint(activityContext, "SHA-1")
                if (e is NoCredentialException || detail.contains("28444") || detail.contains("Developer console", ignoreCase = true) || detail.contains("Cannot find a matching credential", ignoreCase = true) || detail.contains("reauth", ignoreCase = true)) {
                    errorMsg = "Google Sign-In isn't active on this device build yet."
                    googleConfigHint = buildString {
                        append("Ensure a Google account is signed in on this device AND add Android app '${activityContext.packageName}'")
                        if (sha1 != null) append(" with SHA-1 '$sha1'")
                        append(" in Firebase Console → Project Settings. Or tap 'Set Gmail Password' below to set a password for your Gmail right away.")
                    }
                } else {
                    errorMsg = detail.ifBlank { "Google Sign-In failed (${e.type})." }
                }
                scope.launch { scrollState.animateScrollTo(0) }
            } catch (e: CancellationException) {
                isGoogleSubmitting = false
                throw e
            } catch (e: Exception) {
                isGoogleSubmitting = false
                Log.e("KharchAuth", "Unexpected Google Sign-In failure", e)
                errorMsg = e.message ?: "Google Sign-In failed."
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = kc.card,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .navigationBarsPadding()
                .verticalScroll(scrollState)
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(kc.primaryButtonBg),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Rounded.AccountBalanceWallet, contentDescription = null, tint = kc.primaryButtonFg, modifier = Modifier.size(20.dp))
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        text = when (activeTab) {
                            "signup" -> "Create Kharch Account"
                            "forgot" -> "Reset Password"
                            else -> "Sign in to Kharch"
                        },
                        style = MaterialTheme.typography.headlineSmall,
                        color = kc.textPrimary
                    )
                    Text("Sync expenses, lending & goals with Web App", fontSize = 11.sp, color = kc.textMuted)
                }
                IconButton(onClick = onDismiss) { Icon(Icons.Rounded.Close, contentDescription = "Close") }
            }

            if (!firebaseConfigured) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = KharchAmberSoft,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        "Firebase project config not detected in .env. Guest Mode offline storage still works cleanly.",
                        fontSize = 11.sp,
                        color = KharchAmber,
                        modifier = Modifier.padding(12.dp)
                    )
                }
            }

            // Tab Switcher
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(kc.subtleSurface)
                    .padding(4.dp)
            ) {
                listOf("login" to "Sign In", "signup" to "Sign Up", "forgot" to "Forgot").forEach { (key, lbl) ->
                    val sel = activeTab == key
                    Surface(
                        onClick = {
                            activeTab = key
                            errorMsg = ""
                            successMsg = ""
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp),
                        color = if (sel) kc.primaryButtonBg else Color.Transparent,
                        shadowElevation = 0.dp
                    ) {
                        Box(Modifier.padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                            Text(
                                lbl,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (sel) kc.primaryButtonFg else kc.textMuted
                            )
                        }
                    }
                }
            }

            // Continue with Google Button
            if (activeTab != "forgot") {
                OutlinedButton(
                    onClick = { launchGoogleSignIn() },
                    enabled = !anyBusy && firebaseConfigured,
                    shape = RoundedCornerShape(14.dp),
                    border = BorderStroke(1.dp, kc.cardBorder),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = kc.subtleSurface,
                        contentColor = kc.textPrimary
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    if (isGoogleSubmitting) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = KharchIndigo)
                        Spacer(Modifier.width(10.dp))
                        Text("Connecting to Google...", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    } else {
                        Box(
                            modifier = Modifier
                                .size(22.dp)
                                .clip(RoundedCornerShape(6.dp))
                                .background(Color.White),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "G",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 14.sp,
                                color = Color(0xFF4285F4)
                            )
                        }
                        Spacer(Modifier.width(10.dp))
                        Text("Continue with Google", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    HorizontalDivider(Modifier.weight(1f), color = kc.cardBorder)
                    Text("or continue with email", fontSize = 11.sp, color = kc.textMuted)
                    HorizontalDivider(Modifier.weight(1f), color = kc.cardBorder)
                }
            }

            // Error & Success Feedback Banners
            AnimatedVisibility(
                visible = errorMsg.isNotBlank(),
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically()
            ) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = KharchRoseSoft,
                    border = BorderStroke(1.dp, KharchRose.copy(alpha = 0.3f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Rounded.ErrorOutline, contentDescription = null, tint = KharchRose, modifier = Modifier.size(18.dp))
                            Text(errorMsg, color = KharchRose, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                        googleConfigHint?.let { hint ->
                            Text(hint, color = kc.textPrimary, fontSize = 11.sp)
                            val sha1 = rememberAppFingerprint(activityContext, "SHA-1")
                            val sha256 = rememberAppFingerprint(activityContext, "SHA-256")
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                if (sha1 != null) {
                                    OutlinedButton(
                                        onClick = {
                                            val clip = buildString {
                                                appendLine("Package: ${activityContext.packageName}")
                                                appendLine("SHA-1: $sha1")
                                                if (sha256 != null) append("SHA-256: $sha256")
                                            }
                                            ShareAndPdfUtils.copyToClipboard(activityContext, clip)
                                            successMsg = "Copied Package, SHA-1 & SHA-256!"
                                        },
                                        shape = RoundedCornerShape(10.dp),
                                        border = BorderStroke(1.dp, kc.cardBorder),
                                        colors = ButtonDefaults.outlinedButtonColors(contentColor = kc.textPrimary),
                                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Icon(Icons.Rounded.ContentCopy, contentDescription = null, modifier = Modifier.size(13.dp))
                                        Spacer(Modifier.width(5.dp))
                                        Text("Copy SHA-1", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                                Button(
                                    onClick = {
                                        activeTab = "forgot"
                                        errorMsg = ""
                                        googleConfigHint = null
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = KharchIndigo, contentColor = Color.White),
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Set Gmail Password", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }

            AnimatedVisibility(
                visible = successMsg.isNotBlank(),
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically()
            ) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = KharchEmeraldSoft,
                    border = BorderStroke(1.dp, KharchEmerald.copy(alpha = 0.3f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Rounded.CheckCircleOutline, contentDescription = null, tint = KharchEmerald, modifier = Modifier.size(18.dp))
                        Text(successMsg, color = KharchEmerald, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            if (activeTab == "signup") {
                OutlinedTextField(
                    value = displayName,
                    onValueChange = { displayName = it; errorMsg = "" },
                    label = { Text("Your Name *") },
                    leadingIcon = { Icon(Icons.Rounded.Person, contentDescription = null) },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                    keyboardActions = KeyboardActions(onNext = { focusManager.moveFocus(FocusDirection.Down) }),
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                )
            }

            OutlinedTextField(
                value = email,
                onValueChange = { email = it; errorMsg = "" },
                label = { Text("Email Address *") },
                leadingIcon = { Icon(Icons.Rounded.Email, contentDescription = null) },
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = if (activeTab == "forgot") ImeAction.Done else ImeAction.Next
                ),
                keyboardActions = KeyboardActions(
                    onNext = { focusManager.moveFocus(FocusDirection.Down) },
                    onDone = { submitEmailForm() }
                ),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )

            if (activeTab != "forgot") {
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it; errorMsg = "" },
                    label = { Text("Password *") },
                    leadingIcon = { Icon(Icons.Rounded.Lock, contentDescription = null) },
                    trailingIcon = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                imageVector = if (showPassword) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                                contentDescription = if (showPassword) "Hide password" else "Show password"
                            )
                        }
                    },
                    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(onDone = { submitEmailForm() }),
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Button(
                onClick = { submitEmailForm() },
                enabled = !anyBusy,
                colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = kc.primaryButtonFg)
                } else {
                    Text(
                        text = when (activeTab) {
                            "signup" -> "Create Cloud Account"
                            "forgot" -> "Send Reset Link"
                            else -> "Sign In with Email"
                        },
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            TextButton(
                onClick = {
                    onContinueGuest()
                    onDismiss()
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    "Continue in Offline Guest Mode",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = kc.textMuted,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

private tailrec fun Context.findActivity(): ComponentActivity? = when (this) {
    is ComponentActivity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

@Suppress("DEPRECATION")
private fun rememberAppFingerprint(context: Context, algorithm: String): String? {
    return runCatching {
        val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val info = context.packageManager.getPackageInfo(
                context.packageName,
                PackageManager.GET_SIGNING_CERTIFICATES
            )
            info.signingInfo?.apkContentsSigners
        } else {
            val info = context.packageManager.getPackageInfo(
                context.packageName,
                PackageManager.GET_SIGNATURES
            )
            info.signatures
        }
        val cert = signatures?.firstOrNull()?.toByteArray() ?: return null
        val digest = MessageDigest.getInstance(algorithm).digest(cert)
        digest.joinToString(":") { "%02X".format(it) }
    }.getOrNull()
}
