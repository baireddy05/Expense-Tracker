package com.example.kharch.data

import android.content.Context
import android.content.SharedPreferences
import com.example.kharch.model.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

class LocalStore(context: Context) {
    private val dir = File(context.filesDir, "kharch_store").apply { mkdirs() }
    private val prefs: SharedPreferences = context.getSharedPreferences("kharch_prefs", Context.MODE_PRIVATE)

    val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        prettyPrint = false
    }

    private fun fileFor(name: String): File = File(dir, "$name.json")

    private inline fun <reified T> readList(name: String): List<T> {
        return runCatching {
            val file = fileFor(name)
            if (!file.exists()) return emptyList()
            val text = file.readText()
            if (text.isBlank()) return emptyList()
            json.decodeFromString<List<T>>(text)
        }.getOrDefault(emptyList())
    }

    private inline fun <reified T> writeList(name: String, list: List<T>) {
        runCatching {
            val tmp = fileFor("$name.tmp")
            val target = fileFor(name)
            tmp.writeText(json.encodeToString(list))
            if (!tmp.renameTo(target)) {
                target.writeText(tmp.readText())
                tmp.delete()
            }
        }
    }

    fun getTransactions(): List<Transaction> = readList("transactions")
    fun saveTransactions(list: List<Transaction>) = writeList("transactions", list)

    fun getCategories(): List<Category> = readList("categories")
    fun saveCategories(list: List<Category>) = writeList("categories", list)

    fun getAccounts(): List<Account> = readList("accounts")
    fun saveAccounts(list: List<Account>) = writeList("accounts", list)

    fun getSavingsGoals(): List<SavingsGoal> = readList("savings_goals")
    fun saveSavingsGoals(list: List<SavingsGoal>) = writeList("savings_goals", list)

    fun getEvents(): List<EventBudget> = readList("events")
    fun saveEvents(list: List<EventBudget>) = writeList("events", list)

    fun getSubscriptions(): List<Subscription> = readList("subscriptions")
    fun saveSubscriptions(list: List<Subscription>) = writeList("subscriptions", list)

    fun getLentRecords(): List<LentRecord> = readList("lent_records")
    fun saveLentRecords(list: List<LentRecord>) = writeList("lent_records", list)

    fun getBorrowedRecords(): List<BorrowedRecord> = readList("borrowed_records")
    fun saveBorrowedRecords(list: List<BorrowedRecord>) = writeList("borrowed_records", list)

    fun getUserSettings(): UserSettings {
        return runCatching {
            val f = fileFor("settings")
            if (!f.exists()) UserSettings() else json.decodeFromString<UserSettings>(f.readText())
        }.getOrDefault(UserSettings())
    }

    fun saveUserSettings(settings: UserSettings) {
        runCatching {
            fileFor("settings").writeText(json.encodeToString(settings))
        }
    }

    fun purgeAllGuestCollections() {
        listOf(
            "transactions", "categories", "accounts", "savings_goals",
            "events", "subscriptions", "lent_records", "borrowed_records", "settings"
        ).forEach { runCatching { fileFor(it).delete() } }
    }

    fun getAuthSession(): AuthSession? {
        return runCatching {
            val raw = prefs.getString("auth_session", null) ?: return null
            json.decodeFromString<AuthSession>(raw)
        }.getOrNull()
    }

    fun saveAuthSession(session: AuthSession?) {
        prefs.edit().apply {
            if (session == null) remove("auth_session")
            else putString("auth_session", json.encodeToString(session))
        }.apply()
    }

    var isGuestMode: Boolean
        get() = prefs.getBoolean("guest_mode", false)
        set(value) = prefs.edit().putBoolean("guest_mode", value).apply()

    var themeMode: AppThemeMode
        get() = runCatching {
            AppThemeMode.valueOf(prefs.getString("theme_mode", AppThemeMode.SYSTEM.name) ?: AppThemeMode.SYSTEM.name)
        }.getOrDefault(AppThemeMode.SYSTEM)
        set(value) = prefs.edit().putString("theme_mode", value.name).apply()

    var isPrivacyMode: Boolean
        get() = prefs.getBoolean("privacy_mode", false)
        set(value) = prefs.edit().putBoolean("privacy_mode", value).apply()

    var isHapticsEnabled: Boolean
        get() = prefs.getBoolean("haptics_enabled", true)
        set(value) = prefs.edit().putBoolean("haptics_enabled", value).apply()

    var hapticIntensity: HapticIntensity
        get() = runCatching {
            HapticIntensity.valueOf(prefs.getString("haptic_intensity", HapticIntensity.STRONG.name) ?: HapticIntensity.STRONG.name)
        }.getOrDefault(HapticIntensity.STRONG)
        set(value) = prefs.edit().putString("haptic_intensity", value.name).apply()
}
