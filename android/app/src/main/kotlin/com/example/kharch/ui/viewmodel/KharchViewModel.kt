package com.example.kharch.ui.viewmodel

import android.app.Application
import android.content.Context
import android.net.Uri
import androidx.compose.runtime.Immutable
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.kharch.data.FirebaseRestClient
import com.example.kharch.data.KharchRepository
import com.example.kharch.data.LocalStore
import com.example.kharch.model.*
import com.example.kharch.util.CategoryEngine
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils
import com.example.kharch.util.HapticEngine
import com.example.kharch.util.HapticType
import com.example.kharch.util.ShareAndPdfUtils
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import java.io.File
import java.time.Instant

@Immutable
data class ToastMessage(
    val id: Long = System.currentTimeMillis(),
    val text: String,
    val isError: Boolean = false
)

@Immutable
data class KharchUiState(
    val isLoading: Boolean = true,
    val isSyncing: Boolean = false,
    val error: String? = null,
    val session: AuthSession? = null,
    val isGuestMode: Boolean = false,
    val firebaseConfigured: Boolean = false,
    val currentRoute: AppRoute = AppRoute.DASHBOARD,
    val themeMode: AppThemeMode = AppThemeMode.SYSTEM,
    val isPrivacyMode: Boolean = false,
    val isHapticsEnabled: Boolean = true,
    val hapticIntensity: HapticIntensity = HapticIntensity.STRONG,
    val transactions: List<Transaction> = emptyList(),
    val categories: List<Category> = emptyList(),
    val accounts: List<Account> = emptyList(),
    val savingsGoals: List<SavingsGoal> = emptyList(),
    val events: List<EventBudget> = emptyList(),
    val subscriptions: List<Subscription> = emptyList(),
    val lentRecords: List<LentRecord> = emptyList(),
    val borrowedRecords: List<BorrowedRecord> = emptyList(),
    val settings: UserSettings = UserSettings(),
    val restoreProgress: RestoreProgress? = null,
    val txSearchPrefill: String = "",
    val accountsWithBalances: List<AccountWithBalance> = emptyList(),
    val eventsWithStats: List<EventWithStats> = emptyList()
)

private fun computeAccountsWithBalances(
    accounts: List<Account>,
    transactions: List<Transaction>
): List<AccountWithBalance> {
    if (accounts.isEmpty()) return emptyList()
    val defaultAcc = accounts.firstOrNull { it.isDefault } ?: accounts.firstOrNull()
    val defaultId = defaultAcc?.id
    val knownIds = HashSet<String>(accounts.size * 2).apply { accounts.forEach { add(it.id) } }
    val deltas = HashMap<String, Double>(accounts.size * 2)

    transactions.forEach { t ->
        when (t.type) {
            "transfer" -> {
                t.fromAccountId?.let { id -> deltas[id] = (deltas[id] ?: 0.0) - t.amount }
                t.toAccountId?.let { id -> deltas[id] = (deltas[id] ?: 0.0) + t.amount }
            }
            "income" -> {
                val accId = (t.accountId ?: defaultId)?.let { if (it in knownIds) it else defaultId }
                if (accId != null) deltas[accId] = (deltas[accId] ?: 0.0) + t.amount
            }
            "expense" -> {
                val accId = (t.accountId ?: defaultId)?.let { if (it in knownIds) it else defaultId }
                if (accId != null) deltas[accId] = (deltas[accId] ?: 0.0) - t.amount
            }
        }
    }

    return accounts.map { acc ->
        AccountWithBalance(acc, acc.initialBalance + (deltas[acc.id] ?: 0.0))
    }
}

private fun computeEventsWithStats(
    events: List<EventBudget>,
    transactions: List<Transaction>
): List<EventWithStats> {
    if (events.isEmpty()) return emptyList()
    val specs = events.map { ev ->
        val tagClean = ev.tag.trim().lowercase()
        val tagRegex = if (tagClean.isNotBlank()) {
            Regex("#" + Regex.escape(tagClean) + "(?![a-z0-9])", RegexOption.IGNORE_CASE)
        } else null
        Triple(ev, tagClean, tagRegex)
    }

    val spentByEvent = DoubleArray(specs.size)
    val countByEvent = IntArray(specs.size)

    transactions.forEach { t ->
        if (t.type != "expense") return@forEach
        val tTag = (t.eventTag ?: "").trim().lowercase().removePrefix("#")
        for (i in specs.indices) {
            val (ev, tagClean, tagRegex) = specs[i]
            val hasTag = tagClean.isNotBlank() && (
                tTag == tagClean ||
                    (tagRegex != null && tagRegex.containsMatchIn(t.note)) ||
                    t.tags.any { it.trim().lowercase().removePrefix("#") == tagClean }
                )
            if (hasTag || t.eventId == ev.id) {
                spentByEvent[i] += t.amount
                countByEvent[i]++
            }
        }
    }

    return specs.mapIndexed { i, (ev, _, _) ->
        val spent = spentByEvent[i]
        val pct = if (ev.budget > 0.0) (spent / ev.budget) * 100.0 else 0.0
        EventWithStats(
            event = ev,
            spent = spent,
            remainingBudget = (ev.budget - spent).coerceAtLeast(0.0),
            percentage = pct,
            isOverBudget = ev.budget > 0.0 && spent > ev.budget,
            txCount = countByEvent[i]
        )
    }
}

class KharchViewModel(app: Application) : AndroidViewModel(app) {
    private val localStore = LocalStore(app)
    private val firebase = FirebaseRestClient()
    private val repo = KharchRepository(localStore, firebase)
    val haptics = HapticEngine(app).apply {
        isEnabled = localStore.isHapticsEnabled
        intensity = localStore.hapticIntensity
    }

    private class DerivedUiStateFlow(initial: KharchUiState) {
        private val flow = MutableStateFlow(initial)
        val value: KharchUiState get() = flow.value
        fun asStateFlow(): StateFlow<KharchUiState> = flow.asStateFlow()
        inline fun update(crossinline transform: (KharchUiState) -> KharchUiState) {
            flow.update { prev ->
                val next = transform(prev)
                val accsChanged = next.transactions !== prev.transactions || next.accounts !== prev.accounts
                val evsChanged = next.transactions !== prev.transactions || next.events !== prev.events
                if (!accsChanged && !evsChanged) next
                else next.copy(
                    accountsWithBalances = if (accsChanged) computeAccountsWithBalances(next.accounts, next.transactions) else prev.accountsWithBalances,
                    eventsWithStats = if (evsChanged) computeEventsWithStats(next.events, next.transactions) else prev.eventsWithStats
                )
            }
        }
    }

    private val _state = DerivedUiStateFlow(
        KharchUiState(
            session = localStore.getAuthSession(),
            isGuestMode = localStore.isGuestMode,
            firebaseConfigured = firebase.isConfigured,
            themeMode = localStore.themeMode,
            isPrivacyMode = localStore.isPrivacyMode,
            isHapticsEnabled = localStore.isHapticsEnabled,
            hapticIntensity = localStore.hapticIntensity
        )
    )
    val state: StateFlow<KharchUiState> = _state.asStateFlow()

    private val _toasts = MutableSharedFlow<ToastMessage>(extraBufferCapacity = 16)
    val toasts: SharedFlow<ToastMessage> = _toasts.asSharedFlow()

    init {
        refreshData(isInitial = true)
    }

    fun showToast(text: String, isError: Boolean = false) {
        _toasts.tryEmit(ToastMessage(text = text, isError = isError))
    }

    fun navigateTo(route: AppRoute, searchPrefill: String = "") {
        haptics.trigger(HapticType.SELECTION)
        _state.update {
            it.copy(
                currentRoute = route,
                txSearchPrefill = if (route == AppRoute.TRANSACTIONS) searchPrefill else it.txSearchPrefill
            )
        }
    }

    fun clearTxSearchPrefill() {
        _state.update { it.copy(txSearchPrefill = "") }
    }

    fun refreshData(isInitial: Boolean = false) {
        viewModelScope.launch {
            if (isInitial) _state.update { it.copy(isLoading = true, error = null) }
            try {
                val (updatedSession, bundle) = repo.loadAll(_state.value.session)
                _state.update {
                    it.copy(
                        isLoading = false,
                        error = null,
                        session = updatedSession,
                        transactions = bundle.transactions,
                        categories = bundle.categories,
                        accounts = bundle.accounts,
                        savingsGoals = bundle.savingsGoals,
                        events = bundle.events,
                        subscriptions = bundle.subscriptions,
                        lentRecords = bundle.lentRecords,
                        borrowedRecords = bundle.borrowedRecords,
                        settings = bundle.settings
                    )
                }
                if (bundle.autoPostedCount > 0) {
                    showToast("Auto-posted ${bundle.autoPostedCount} due subscription(s)!")
                }
            } catch (e: Exception) {
                _state.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Failed to load data"
                    )
                }
            }
        }
    }

    // -----------------------------------------
    // UI Preferences (Theme, Privacy, Haptics)
    // -----------------------------------------

    fun setThemeMode(mode: AppThemeMode) {
        localStore.themeMode = mode
        haptics.trigger(HapticType.SELECTION)
        _state.update { it.copy(themeMode = mode) }
    }

    fun toggleThemeLightDark() {
        val next = if (_state.value.themeMode == AppThemeMode.DARK) AppThemeMode.LIGHT else AppThemeMode.DARK
        setThemeMode(next)
    }

    fun togglePrivacyMode() {
        val next = !_state.value.isPrivacyMode
        localStore.isPrivacyMode = next
        haptics.trigger(HapticType.SELECTION)
        _state.update { it.copy(isPrivacyMode = next) }
    }

    fun toggleHaptics() {
        val next = !_state.value.isHapticsEnabled
        localStore.isHapticsEnabled = next
        haptics.isEnabled = next
        if (next) haptics.trigger(HapticType.SUCCESS)
        _state.update { it.copy(isHapticsEnabled = next) }
    }

    fun setHapticIntensity(intensity: HapticIntensity) {
        localStore.hapticIntensity = intensity
        haptics.intensity = intensity
        haptics.trigger(HapticType.MEDIUM)
        _state.update { it.copy(hapticIntensity = intensity) }
    }

    fun testHapticBuzz() {
        haptics.trigger(HapticType.HEAVY)
    }

    // -----------------------------------------
    // Authentication & Cloud Sync
    // -----------------------------------------

    fun continueAsGuest() {
        localStore.isGuestMode = true
        _state.update { it.copy(isGuestMode = true) }
        haptics.trigger(HapticType.SUCCESS)
        showToast("Continuing in Guest Mode (Offline Only)")
    }

    private suspend fun completeSignInSession(session: AuthSession, welcomeMsg: String): String? {
        localStore.saveAuthSession(session)
        localStore.isGuestMode = false
        return runCatching {
            val (updatedSession, bundle) = repo.loadAll(session)
            _state.update {
                it.copy(
                    isLoading = false,
                    error = null,
                    session = updatedSession,
                    isGuestMode = false,
                    transactions = bundle.transactions,
                    categories = bundle.categories,
                    accounts = bundle.accounts,
                    savingsGoals = bundle.savingsGoals,
                    events = bundle.events,
                    subscriptions = bundle.subscriptions,
                    lentRecords = bundle.lentRecords,
                    borrowedRecords = bundle.borrowedRecords,
                    settings = bundle.settings
                )
            }
            if (bundle.autoPostedCount > 0) {
                showToast("Auto-posted ${bundle.autoPostedCount} recurring subscription(s)")
            }
        }.fold(
            onSuccess = {
                haptics.trigger(HapticType.SUCCESS)
                showToast(welcomeMsg)
                null
            },
            onFailure = { syncErr ->
                // Auth succeeded, keep session active so user can retry Firestore sync cleanly
                val syncMsg = syncErr.message ?: "Cloud sync interrupted. Tap Retry to load cloud records."
                _state.update {
                    it.copy(
                        isLoading = false,
                        error = syncMsg,
                        session = session,
                        isGuestMode = false
                    )
                }
                haptics.trigger(HapticType.ERROR)
                showToast("Signed in! $syncMsg", isError = true)
                null
            }
        )
    }

    suspend fun login(email: String, password: String): String? {
        return try {
            val session = firebase.signIn(email.trim(), password)
            val label = session.displayName.ifBlank { session.email }
            completeSignInSession(session, "Welcome back, $label!")
        } catch (e: Exception) {
            haptics.trigger(HapticType.ERROR)
            e.message ?: "Sign in failed. Please check your credentials."
        }
    }

    suspend fun loginWithGoogleIdToken(idToken: String): String? {
        return try {
            val session = firebase.signInWithGoogleIdToken(idToken)
            val label = session.displayName.ifBlank { session.email.ifBlank { "Friend" } }
            completeSignInSession(session, "Welcome, $label!")
        } catch (e: Exception) {
            haptics.trigger(HapticType.ERROR)
            e.message ?: "Google sign-in failed."
        }
    }

    suspend fun signup(email: String, password: String, displayName: String): String? {
        return try {
            val session = firebase.signUp(email.trim(), password, displayName.trim())
            val label = session.displayName.ifBlank { session.email }
            completeSignInSession(session, "Welcome to Kharch, $label!")
        } catch (e: Exception) {
            haptics.trigger(HapticType.ERROR)
            e.message ?: "Sign up failed."
        }
    }

    suspend fun sendPasswordReset(email: String): String? {
        return try {
            firebase.sendPasswordResetEmail(email.trim())
            haptics.trigger(HapticType.SUCCESS)
            showToast("Password reset link sent to ${email.trim()}")
            null
        } catch (e: Exception) {
            haptics.trigger(HapticType.ERROR)
            e.message ?: "Failed to send password reset email."
        }
    }

    fun updateDisplayName(name: String) {
        val current = _state.value.session ?: return
        val trimmed = name.trim()
        if (trimmed.isBlank()) return
        viewModelScope.launch {
            try {
                val updated = firebase.updateDisplayName(current, trimmed)
                localStore.saveAuthSession(updated)
                _state.update { it.copy(session = updated) }
                haptics.trigger(HapticType.SUCCESS)
                showToast("Profile updated successfully")
            } catch (e: Exception) {
                haptics.trigger(HapticType.ERROR)
                showToast(e.message ?: "Failed to update name", isError = true)
            }
        }
    }

    fun syncCloudData() {
        val current = _state.value.session
        if (current == null) {
            showToast("Please sign in to sync data to the cloud.", isError = true)
            return
        }
        viewModelScope.launch {
            _state.update { it.copy(isSyncing = true) }
            try {
                val valid = firebase.ensureValidSession(current)
                val migratedCount = repo.migrateLocalDataToCloud(valid)
                if (migratedCount > 0) {
                    showToast("Migrated $migratedCount offline record(s) to cloud!")
                }
                val (_, bundle) = repo.loadAll(valid)
                _state.update {
                    it.copy(
                        isSyncing = false,
                        session = valid,
                        transactions = bundle.transactions,
                        categories = bundle.categories,
                        accounts = bundle.accounts,
                        savingsGoals = bundle.savingsGoals,
                        events = bundle.events,
                        subscriptions = bundle.subscriptions,
                        lentRecords = bundle.lentRecords,
                        borrowedRecords = bundle.borrowedRecords,
                        settings = bundle.settings
                    )
                }
                haptics.trigger(HapticType.SUCCESS)
                showToast("Your cloud data is securely synced!")
            } catch (e: Exception) {
                _state.update { it.copy(isSyncing = false) }
                haptics.trigger(HapticType.ERROR)
                showToast(e.message ?: "Failed to sync to cloud", isError = true)
            }
        }
    }

    fun logout() {
        localStore.saveAuthSession(null)
        _state.update { it.copy(session = null, error = null) }
        haptics.trigger(HapticType.LIGHT)
        showToast("Signed out")
        viewModelScope.launch {
            runCatching {
                CredentialManager.create(getApplication())
                    .clearCredentialState(ClearCredentialStateRequest())
            }
        }
        refreshData()
    }

    fun purgeLocalCache() {
        localStore.purgeAllGuestCollections()
        haptics.trigger(HapticType.HEAVY)
        showToast("Local cache purged!")
        refreshData()
    }

    // -----------------------------------------
    // Transactions & Categories
    // -----------------------------------------

    fun saveTransaction(tx: Transaction, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            try {
                val session = _state.value.session
                if (tx.id.isBlank()) {
                    val saved = repo.addTransaction(tx, session)
                    val curMonth = DateUtils.currentYearMonthPrefix()
                    val budget = _state.value.settings.monthlyBudget
                    val prior = _state.value.transactions
                        .filter { it.type == "expense" && it.date.startsWith(curMonth) }
                        .sumOf { it.amount }
                    _state.update { it.copy(transactions = listOf(saved) + it.transactions) }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast("Transaction logged")

                    // Edge-triggered budget breach alert
                    if (budget > 0.0 && saved.type == "expense" && saved.date.startsWith(curMonth)) {
                        val after = prior + saved.amount
                        if (prior < budget && after >= budget) {
                            haptics.trigger(HapticType.WARNING)
                            showToast("Over budget! Monthly spending crossed ${CurrencyUtils.formatInr(budget)}.", isError = true)
                        } else if (prior < budget * 0.9 && after >= budget * 0.9) {
                            haptics.trigger(HapticType.WARNING)
                            showToast("Approaching budget limit — ${((after / budget) * 100).toInt()}% used.")
                        }
                    }
                } else {
                    val updated = repo.updateTransaction(tx, session)
                    _state.update { st ->
                        st.copy(transactions = st.transactions.map { if (it.id == updated.id) updated else it })
                    }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast("Transaction updated")
                }
                onDone()
            } catch (e: Exception) {
                haptics.trigger(HapticType.ERROR)
                showToast(e.message ?: "Failed to save transaction", isError = true)
            }
        }
    }

    fun deleteTransaction(id: String) {
        viewModelScope.launch {
            try {
                repo.deleteTransaction(id, _state.value.session)
                _state.update { it.copy(transactions = it.transactions.filterNot { tx -> tx.id == id }) }
                haptics.trigger(HapticType.HEAVY)
                showToast("Transaction deleted")
            } catch (e: Exception) {
                haptics.trigger(HapticType.ERROR)
                showToast(e.message ?: "Failed to delete transaction", isError = true)
            }
        }
    }

    suspend fun createCategory(name: String, type: String, color: String = "#6366f1", icon: String = "fa-tag"): Category? {
        return try {
            val created = repo.addCategory(
                Category(name = name.trim(), type = type, color = color, icon = icon),
                _state.value.session
            )
            _state.update { st ->
                if (st.categories.any { it.id == created.id }) st
                else st.copy(categories = st.categories + created)
            }
            haptics.trigger(HapticType.SUCCESS)
            showToast("Category created")
            created
        } catch (e: Exception) {
            haptics.trigger(HapticType.ERROR)
            showToast(e.message ?: "Failed to create category", isError = true)
            null
        }
    }

    fun updateCategoryBudget(category: Category, limit: Double) {
        viewModelScope.launch {
            try {
                val updated = repo.updateCategory(category.copy(budgetLimit = limit.coerceAtLeast(0.0)), _state.value.session)
                _state.update { st ->
                    st.copy(categories = st.categories.map { if (it.id == updated.id) updated else it })
                }
                haptics.trigger(HapticType.SUCCESS)
                showToast("Category budget saved")
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to update category", isError = true)
            }
        }
    }

    fun updateMonthlyBudget(limit: Double) {
        viewModelScope.launch {
            try {
                val updated = repo.updateSettings(UserSettings(monthlyBudget = limit.coerceAtLeast(0.0)), _state.value.session)
                _state.update { it.copy(settings = updated) }
                haptics.trigger(HapticType.SUCCESS)
                showToast("Monthly budget limit saved")
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to update budget", isError = true)
            }
        }
    }

    // -----------------------------------------
    // Accounts & Transfers
    // -----------------------------------------

    fun saveAccount(account: Account, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            try {
                val session = _state.value.session
                if (account.id.isBlank()) {
                    val saved = repo.addAccount(account, session)
                    _state.update { st ->
                        val updatedAccs = if (saved.isDefault) {
                            st.accounts.map { it.copy(isDefault = false) } + saved
                        } else {
                            st.accounts + saved
                        }
                        st.copy(accounts = updatedAccs)
                    }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast("Account added")
                } else {
                    val updated = repo.updateAccount(account, session)
                    _state.update { st ->
                        st.copy(accounts = st.accounts.map {
                            when {
                                it.id == updated.id -> updated
                                updated.isDefault -> it.copy(isDefault = false)
                                else -> it
                            }
                        })
                    }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast("Account updated")
                }
                onDone()
            } catch (e: Exception) {
                haptics.trigger(HapticType.ERROR)
                showToast(e.message ?: "Failed to save account", isError = true)
            }
        }
    }

    fun deleteAccount(id: String) {
        val currentAccs = _state.value.accounts
        val remaining = currentAccs.filterNot { it.id == id }
        if (remaining.isEmpty()) {
            showToast("Cannot delete the only remaining account", isError = true)
            return
        }
        val fallback = remaining.firstOrNull { it.isDefault } ?: remaining.first()
        viewModelScope.launch {
            try {
                val session = _state.value.session
                val orphaned = _state.value.transactions.filter { t ->
                    if (t.type == "transfer") t.fromAccountId == id || t.toAccountId == id
                    else (t.accountId ?: fallback.id) == id
                }
                repo.deleteAccount(id, session)

                val updatedTxList = _state.value.transactions.toMutableList()
                for (t in orphaned) {
                    if (t.type == "transfer") {
                        val finalFrom = if (t.fromAccountId == id) fallback.id else t.fromAccountId
                        val finalTo = if (t.toAccountId == id) fallback.id else t.toAccountId
                        if (finalFrom == finalTo) {
                            repo.deleteTransaction(t.id, session)
                            updatedTxList.removeAll { it.id == t.id }
                        } else {
                            val patched = t.copy(fromAccountId = finalFrom, toAccountId = finalTo)
                            repo.updateTransaction(patched, session)
                            val idx = updatedTxList.indexOfFirst { it.id == t.id }
                            if (idx >= 0) updatedTxList[idx] = patched
                        }
                    } else {
                        val patched = t.copy(accountId = fallback.id)
                        repo.updateTransaction(patched, session)
                        val idx = updatedTxList.indexOfFirst { it.id == t.id }
                        if (idx >= 0) updatedTxList[idx] = patched
                    }
                }

                val deletedWasDefault = currentAccs.firstOrNull { it.id == id }?.isDefault == true
                if (deletedWasDefault) {
                    repo.updateAccount(fallback.copy(isDefault = true), session)
                }

                _state.update { st ->
                    st.copy(
                        accounts = remaining.map { if (deletedWasDefault && it.id == fallback.id) it.copy(isDefault = true) else it },
                        transactions = updatedTxList
                    )
                }
                haptics.trigger(HapticType.HEAVY)
                showToast("Account deleted")
            } catch (e: Exception) {
                haptics.trigger(HapticType.ERROR)
                showToast(e.message ?: "Failed to delete account", isError = true)
            }
        }
    }

    fun transferFunds(fromAccountId: String, toAccountId: String, amount: Double, date: String, note: String, onDone: () -> Unit = {}) {
        if (amount <= 0.0 || fromAccountId == toAccountId) {
            showToast("Select valid distinct accounts and amount > 0", isError = true)
            return
        }
        viewModelScope.launch {
            try {
                val fromName = _state.value.accounts.firstOrNull { it.id == fromAccountId }?.name ?: "Account"
                val toName = _state.value.accounts.firstOrNull { it.id == toAccountId }?.name ?: "Account"
                val saved = repo.addTransaction(
                    Transaction(
                        amount = amount,
                        type = "transfer",
                        fromAccountId = fromAccountId,
                        toAccountId = toAccountId,
                        accountId = fromAccountId,
                        date = date,
                        note = note.trim().ifBlank { "Transfer from $fromName to $toName" }
                    ),
                    _state.value.session
                )
                _state.update { it.copy(transactions = listOf(saved) + it.transactions) }
                haptics.trigger(HapticType.SUCCESS)
                showToast("Transferred ${CurrencyUtils.formatInr(amount)} from $fromName to $toName!")
                onDone()
            } catch (e: Exception) {
                haptics.trigger(HapticType.ERROR)
                showToast(e.message ?: "Transfer failed", isError = true)
            }
        }
    }

    // -----------------------------------------
    // Savings Goals
    // -----------------------------------------

    fun saveGoal(goal: SavingsGoal, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            try {
                val session = _state.value.session
                val status = if (goal.targetAmount > 0 && goal.savedAmount >= goal.targetAmount) "completed" else "active"
                val normalized = goal.copy(status = status)
                if (goal.id.isBlank()) {
                    val saved = repo.addSavingsGoal(normalized, session)
                    _state.update { it.copy(savingsGoals = it.savingsGoals + saved) }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast("New savings goal created!")
                } else {
                    val updated = repo.updateSavingsGoal(normalized, session)
                    _state.update { st -> st.copy(savingsGoals = st.savingsGoals.map { if (it.id == updated.id) updated else it }) }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast("Savings goal updated")
                }
                onDone()
            } catch (e: Exception) {
                haptics.trigger(HapticType.ERROR)
                showToast(e.message ?: "Failed to save goal", isError = true)
            }
        }
    }

    fun deleteGoal(id: String) {
        viewModelScope.launch {
            try {
                repo.deleteSavingsGoal(id, _state.value.session)
                _state.update { it.copy(savingsGoals = it.savingsGoals.filterNot { g -> g.id == id }) }
                haptics.trigger(HapticType.HEAVY)
                showToast("Goal deleted")
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to delete goal", isError = true)
            }
        }
    }

    fun contributeToGoal(goalId: String, amount: Double, note: String, onDone: () -> Unit = {}) {
        val current = _state.value.savingsGoals.firstOrNull { it.id == goalId } ?: return
        if (amount <= 0.0) {
            showToast("Enter a valid contribution amount", isError = true)
            return
        }
        viewModelScope.launch {
            try {
                val newSaved = current.savedAmount + amount
                val contrib = GoalContribution(
                    id = "contrib_${System.currentTimeMillis()}",
                    amount = amount,
                    date = DateUtils.getLocalDateString(),
                    note = note.trim().ifBlank { "Contribution" }
                )
                val isCompleted = current.targetAmount > 0 && newSaved >= current.targetAmount
                val updated = repo.updateSavingsGoal(
                    current.copy(
                        savedAmount = newSaved,
                        contributions = current.contributions + contrib,
                        status = if (isCompleted) "completed" else "active"
                    ),
                    _state.value.session
                )
                _state.update { st -> st.copy(savingsGoals = st.savingsGoals.map { if (it.id == updated.id) updated else it }) }
                haptics.trigger(HapticType.SUCCESS)
                if (isCompleted) {
                    showToast("🎉 Goal \"${current.name}\" is fully funded!")
                } else {
                    showToast("Saved ${CurrencyUtils.formatInr(amount)} towards \"${current.name}\"!")
                }
                onDone()
            } catch (e: Exception) {
                haptics.trigger(HapticType.ERROR)
                showToast(e.message ?: "Contribution failed", isError = true)
            }
        }
    }

    // -----------------------------------------
    // Trips & Events
    // -----------------------------------------

    fun saveEvent(event: EventBudget, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            try {
                val cleanTag = (event.tag.ifBlank { event.name }).lowercase().replace(Regex("[^a-z0-9]"), "")
                    .ifBlank { "trip_${System.currentTimeMillis()}" }
                val payload = event.copy(tag = cleanTag)
                val session = _state.value.session
                if (payload.id.isBlank()) {
                    val saved = repo.addEvent(payload, session)
                    _state.update { it.copy(events = it.events + saved) }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast("Trip / Event created!")
                } else {
                    val updated = repo.updateEvent(payload, session)
                    _state.update { st -> st.copy(events = st.events.map { if (it.id == updated.id) updated else it }) }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast("Trip / Event updated")
                }
                onDone()
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to save event", isError = true)
            }
        }
    }

    fun deleteEvent(id: String) {
        viewModelScope.launch {
            try {
                repo.deleteEvent(id, _state.value.session)
                _state.update { it.copy(events = it.events.filterNot { ev -> ev.id == id }) }
                haptics.trigger(HapticType.HEAVY)
                showToast("Trip / Event deleted")
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to delete event", isError = true)
            }
        }
    }

    // -----------------------------------------
    // Subscriptions
    // -----------------------------------------

    fun saveSubscription(sub: Subscription, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            try {
                val session = _state.value.session
                val todayStr = DateUtils.getLocalDateString()
                var toSave = sub
                var autoPostedTx: Transaction? = null

                if (toSave.active && toSave.nextDueDate.isNotBlank() && toSave.nextDueDate <= todayStr) {
                    val defaultAccId = _state.value.accounts.firstOrNull { it.isDefault }?.id ?: _state.value.accounts.firstOrNull()?.id
                    autoPostedTx = repo.addTransaction(
                        Transaction(
                            amount = toSave.amount,
                            categoryId = toSave.categoryId,
                            date = toSave.nextDueDate,
                            note = "Auto-posted: ${toSave.name}",
                            type = toSave.type.ifBlank { "expense" },
                            accountId = toSave.accountId ?: defaultAccId
                        ),
                        session
                    )
                    toSave = toSave.copy(nextDueDate = DateUtils.calculateNextDueDate(toSave.nextDueDate, toSave.frequency))
                }

                if (toSave.id.isBlank()) {
                    val saved = repo.addSubscription(toSave, session)
                    _state.update { st ->
                        st.copy(
                            subscriptions = st.subscriptions + saved,
                            transactions = if (autoPostedTx != null) listOf(autoPostedTx) + st.transactions else st.transactions
                        )
                    }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast(if (autoPostedTx != null) "Subscription added & due cycle posted!" else "Subscription added!")
                } else {
                    val updated = repo.updateSubscription(toSave, session)
                    _state.update { st ->
                        st.copy(
                            subscriptions = st.subscriptions.map { if (it.id == updated.id) updated else it },
                            transactions = if (autoPostedTx != null) listOf(autoPostedTx) + st.transactions else st.transactions
                        )
                    }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast(if (autoPostedTx != null) "Due subscription processed!" else "Subscription updated!")
                }
                onDone()
            } catch (e: Exception) {
                haptics.trigger(HapticType.ERROR)
                showToast(e.message ?: "Failed to save subscription", isError = true)
            }
        }
    }

    fun toggleSubscriptionActive(sub: Subscription) {
        saveSubscription(sub.copy(active = !sub.active))
    }

    fun deleteSubscription(id: String) {
        viewModelScope.launch {
            try {
                repo.deleteSubscription(id, _state.value.session)
                _state.update { it.copy(subscriptions = it.subscriptions.filterNot { s -> s.id == id }) }
                haptics.trigger(HapticType.HEAVY)
                showToast("Subscription deleted")
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to delete subscription", isError = true)
            }
        }
    }

    // -----------------------------------------
    // Lent Money & Auto-Sync Ledger
    // -----------------------------------------

    private suspend fun getOrCreateSystemCategory(type: String, preferredName: String, fallbackMatch: String, defaultDef: Category): Category {
        val cats = _state.value.categories
        val match = cats.firstOrNull { it.name.equals(preferredName, ignoreCase = true) && it.type == type }
            ?: cats.firstOrNull { it.name.contains(fallbackMatch, ignoreCase = true) && it.type == type }
        if (match != null) return match
        val created = repo.addCategory(defaultDef, _state.value.session)
        _state.update { it.copy(categories = it.categories + created) }
        return created
    }

    fun saveLentRecord(record: LentRecord, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            try {
                val session = _state.value.session
                if (record.id.isBlank()) {
                    val saved = repo.addLentRecord(record, session)
                    _state.update { it.copy(lentRecords = listOf(saved) + it.lentRecords) }

                    val cat = getOrCreateSystemCategory(
                        "expense", "Lent Money", "lent",
                        Category(name = "Lent Money", color = "#f59e0b", icon = "fa-hand-holding-dollar", type = "expense")
                    )
                    val autoTx = repo.addTransaction(
                        Transaction(
                            amount = saved.amount,
                            type = "expense",
                            date = saved.dateLent.ifBlank { DateUtils.getLocalDateString() },
                            categoryId = cat.id,
                            note = "Lent to ${saved.borrowerName}${if (!saved.note.isNullOrBlank()) " - ${saved.note}" else ""}"
                        ),
                        session
                    )
                    _state.update { it.copy(transactions = listOf(autoTx) + it.transactions) }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast("Recorded ${CurrencyUtils.formatInr(saved.amount)} lent to ${saved.borrowerName}")
                } else {
                    val updated = repo.updateLentRecord(record, session)
                    _state.update { st -> st.copy(lentRecords = st.lentRecords.map { if (it.id == updated.id) updated else it }) }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast("Lent record updated")
                }
                onDone()
            } catch (e: Exception) {
                haptics.trigger(HapticType.ERROR)
                showToast(e.message ?: "Failed to save lent record", isError = true)
            }
        }
    }

    fun lendMoreMoney(id: String, addAmount: Double, date: String, dueDate: String?, note: String, onDone: () -> Unit = {}) {
        val current = _state.value.lentRecords.firstOrNull { it.id == id } ?: return
        if (addAmount <= 0.0) return
        viewModelScope.launch {
            try {
                val session = _state.value.session
                val existingLoans = current.loans.ifEmpty {
                    listOf(LoanEntry(id = "loan_init_${current.id}", amount = current.amount, date = current.dateLent, note = current.note ?: "Initial loan"))
                }
                val newEntry = LoanEntry(
                    id = "loan_${System.currentTimeMillis()}",
                    amount = addAmount,
                    date = date,
                    note = note.trim().ifBlank { "Additional loan" }
                )
                val updatedLoans = existingLoans + newEntry
                val newTotal = updatedLoans.sumOf { it.amount }
                val newStatus = when {
                    current.returnedAmount >= newTotal -> "settled"
                    current.returnedAmount > 0.0 -> "partial"
                    else -> "pending"
                }
                val updated = repo.updateLentRecord(
                    current.copy(amount = newTotal, loans = updatedLoans, status = newStatus, dueDate = dueDate),
                    session
                )
                _state.update { st -> st.copy(lentRecords = st.lentRecords.map { if (it.id == updated.id) updated else it }) }

                val cat = getOrCreateSystemCategory(
                    "expense", "Lent Money", "lent",
                    Category(name = "Lent Money", color = "#f59e0b", icon = "fa-hand-holding-dollar", type = "expense")
                )
                val autoTx = repo.addTransaction(
                    Transaction(
                        amount = addAmount,
                        type = "expense",
                        date = date,
                        categoryId = cat.id,
                        note = "Lent top-up to ${current.borrowerName}${if (note.isNotBlank()) " - $note" else ""}"
                    ),
                    session
                )
                _state.update { it.copy(transactions = listOf(autoTx) + it.transactions) }
                haptics.trigger(HapticType.SUCCESS)
                showToast("Added ${CurrencyUtils.formatInr(addAmount)} to ${current.borrowerName}'s loan")
                onDone()
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to add top-up loan", isError = true)
            }
        }
    }

    fun recordLentRepayment(id: String, repayAmount: Double, date: String, note: String, onDone: () -> Unit = {}) {
        val current = _state.value.lentRecords.firstOrNull { it.id == id } ?: return
        if (repayAmount <= 0.0) return
        viewModelScope.launch {
            try {
                val session = _state.value.session
                val newReturned = current.returnedAmount + repayAmount
                val entry = RepaymentEntry(id = "rep_${System.currentTimeMillis()}", amount = repayAmount, date = date, note = note.trim())
                val status = if (newReturned >= current.amount) "settled" else "partial"
                val updated = repo.updateLentRecord(
                    current.copy(returnedAmount = newReturned, repayments = current.repayments + entry, status = status),
                    session
                )
                _state.update { st -> st.copy(lentRecords = st.lentRecords.map { if (it.id == updated.id) updated else it }) }

                val cat = getOrCreateSystemCategory(
                    "income", "Lent Returned", "returned",
                    Category(name = "Lent Returned", color = "#10b981", icon = "fa-circle-check", type = "income")
                )
                val autoTx = repo.addTransaction(
                    Transaction(
                        amount = repayAmount,
                        type = "income",
                        date = date,
                        categoryId = cat.id,
                        note = "Returned by ${current.borrowerName}${if (note.isNotBlank()) " - $note" else ""}"
                    ),
                    session
                )
                _state.update { it.copy(transactions = listOf(autoTx) + it.transactions) }
                haptics.trigger(HapticType.SUCCESS)
                showToast("Recorded repayment from ${current.borrowerName}")
                onDone()
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to record repayment", isError = true)
            }
        }
    }

    fun settleLentRecord(id: String) {
        val current = _state.value.lentRecords.firstOrNull { it.id == id } ?: return
        val rem = (current.amount - current.returnedAmount).coerceAtLeast(0.0)
        viewModelScope.launch {
            try {
                val session = _state.value.session
                val reps = if (rem > 0.0) {
                    current.repayments + RepaymentEntry(id = "rep_${System.currentTimeMillis()}", amount = rem, date = DateUtils.getLocalDateString(), note = "Marked fully settled")
                } else current.repayments
                val updated = repo.updateLentRecord(current.copy(returnedAmount = current.amount, repayments = reps, status = "settled"), session)
                _state.update { st -> st.copy(lentRecords = st.lentRecords.map { if (it.id == updated.id) updated else it }) }

                if (rem > 0.0) {
                    val cat = getOrCreateSystemCategory(
                        "income", "Lent Returned", "returned",
                        Category(name = "Lent Returned", color = "#10b981", icon = "fa-circle-check", type = "income")
                    )
                    val autoTx = repo.addTransaction(
                        Transaction(
                            amount = rem,
                            type = "income",
                            date = DateUtils.getLocalDateString(),
                            categoryId = cat.id,
                            note = "Settled & returned by ${current.borrowerName}"
                        ),
                        session
                    )
                    _state.update { it.copy(transactions = listOf(autoTx) + it.transactions) }
                }
                haptics.trigger(HapticType.SUCCESS)
                showToast("Marked settled!")
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to settle loan", isError = true)
            }
        }
    }

    fun deleteLentRecord(id: String) {
        viewModelScope.launch {
            try {
                repo.deleteLentRecord(id, _state.value.session)
                _state.update { it.copy(lentRecords = it.lentRecords.filterNot { r -> r.id == id }) }
                haptics.trigger(HapticType.HEAVY)
                showToast("Lending record deleted")
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to delete record", isError = true)
            }
        }
    }

    // -----------------------------------------
    // Borrowed Money & Auto-Sync Ledger
    // -----------------------------------------

    fun saveBorrowedRecord(record: BorrowedRecord, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            try {
                val session = _state.value.session
                if (record.id.isBlank()) {
                    val saved = repo.addBorrowedRecord(record, session)
                    _state.update { it.copy(borrowedRecords = listOf(saved) + it.borrowedRecords) }

                    val cat = getOrCreateSystemCategory(
                        "income", "Borrowed Money", "borrow",
                        Category(name = "Borrowed Money", color = "#06b6d4", icon = "fa-hand-holding", type = "income")
                    )
                    val autoTx = repo.addTransaction(
                        Transaction(
                            amount = saved.amount,
                            type = "income",
                            date = saved.dateBorrowed.ifBlank { DateUtils.getLocalDateString() },
                            categoryId = cat.id,
                            note = "Borrowed from ${saved.lenderName}${if (!saved.note.isNullOrBlank()) " - ${saved.note}" else ""}"
                        ),
                        session
                    )
                    _state.update { it.copy(transactions = listOf(autoTx) + it.transactions) }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast("Recorded ${CurrencyUtils.formatInr(saved.amount)} borrowed from ${saved.lenderName}")
                } else {
                    val updated = repo.updateBorrowedRecord(record, session)
                    _state.update { st -> st.copy(borrowedRecords = st.borrowedRecords.map { if (it.id == updated.id) updated else it }) }
                    haptics.trigger(HapticType.SUCCESS)
                    showToast("Borrowed record updated")
                }
                onDone()
            } catch (e: Exception) {
                haptics.trigger(HapticType.ERROR)
                showToast(e.message ?: "Failed to save borrowed record", isError = true)
            }
        }
    }

    fun borrowMoreMoney(id: String, addAmount: Double, date: String, dueDate: String?, note: String, onDone: () -> Unit = {}) {
        val current = _state.value.borrowedRecords.firstOrNull { it.id == id } ?: return
        if (addAmount <= 0.0) return
        viewModelScope.launch {
            try {
                val session = _state.value.session
                val existing = current.borrows.ifEmpty {
                    listOf(BorrowEntry(id = "borrow_init_${current.id}", amount = current.amount, date = current.dateBorrowed, note = current.note ?: "Initial borrowed money"))
                }
                val entry = BorrowEntry(id = "borrow_${System.currentTimeMillis()}", amount = addAmount, date = date, note = note.trim().ifBlank { "Additional borrowed money" })
                val updatedBorrows = existing + entry
                val newTotal = updatedBorrows.sumOf { it.amount }
                val status = when {
                    current.returnedAmount >= newTotal -> "settled"
                    current.returnedAmount > 0.0 -> "partial"
                    else -> "pending"
                }
                val updated = repo.updateBorrowedRecord(current.copy(amount = newTotal, borrows = updatedBorrows, status = status, dueDate = dueDate), session)
                _state.update { st -> st.copy(borrowedRecords = st.borrowedRecords.map { if (it.id == updated.id) updated else it }) }

                val cat = getOrCreateSystemCategory(
                    "income", "Borrowed Money", "borrow",
                    Category(name = "Borrowed Money", color = "#06b6d4", icon = "fa-hand-holding", type = "income")
                )
                val autoTx = repo.addTransaction(
                    Transaction(
                        amount = addAmount,
                        type = "income",
                        date = date,
                        categoryId = cat.id,
                        note = "Borrowed top-up from ${current.lenderName}${if (note.isNotBlank()) " - $note" else ""}"
                    ),
                    session
                )
                _state.update { it.copy(transactions = listOf(autoTx) + it.transactions) }
                haptics.trigger(HapticType.SUCCESS)
                showToast("Added ${CurrencyUtils.formatInr(addAmount)} from ${current.lenderName}")
                onDone()
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to add borrowed amount", isError = true)
            }
        }
    }

    fun recordBorrowedRepayment(id: String, repayAmount: Double, date: String, note: String, onDone: () -> Unit = {}) {
        val current = _state.value.borrowedRecords.firstOrNull { it.id == id } ?: return
        if (repayAmount <= 0.0) return
        viewModelScope.launch {
            try {
                val session = _state.value.session
                val newReturned = current.returnedAmount + repayAmount
                val entry = RepaymentEntry(id = "rep_${System.currentTimeMillis()}", amount = repayAmount, date = date, note = note.trim())
                val status = if (newReturned >= current.amount) "settled" else "partial"
                val updated = repo.updateBorrowedRecord(current.copy(returnedAmount = newReturned, repayments = current.repayments + entry, status = status), session)
                _state.update { st -> st.copy(borrowedRecords = st.borrowedRecords.map { if (it.id == updated.id) updated else it }) }

                val cat = getOrCreateSystemCategory(
                    "expense", "Debt Repayment", "debt",
                    Category(name = "Debt Repayment", color = "#6366f1", icon = "fa-handshake", type = "expense")
                )
                val autoTx = repo.addTransaction(
                    Transaction(
                        amount = repayAmount,
                        type = "expense",
                        date = date,
                        categoryId = cat.id,
                        note = "Repaid debt to ${current.lenderName}${if (note.isNotBlank()) " - $note" else ""}"
                    ),
                    session
                )
                _state.update { it.copy(transactions = listOf(autoTx) + it.transactions) }
                haptics.trigger(HapticType.SUCCESS)
                showToast("Recorded debt repayment to ${current.lenderName}")
                onDone()
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to record repayment", isError = true)
            }
        }
    }

    fun settleBorrowedRecord(id: String) {
        val current = _state.value.borrowedRecords.firstOrNull { it.id == id } ?: return
        val rem = (current.amount - current.returnedAmount).coerceAtLeast(0.0)
        viewModelScope.launch {
            try {
                val session = _state.value.session
                val reps = if (rem > 0.0) {
                    current.repayments + RepaymentEntry(id = "rep_${System.currentTimeMillis()}", amount = rem, date = DateUtils.getLocalDateString(), note = "Marked fully paid back")
                } else current.repayments
                val updated = repo.updateBorrowedRecord(current.copy(returnedAmount = current.amount, repayments = reps, status = "settled"), session)
                _state.update { st -> st.copy(borrowedRecords = st.borrowedRecords.map { if (it.id == updated.id) updated else it }) }

                if (rem > 0.0) {
                    val cat = getOrCreateSystemCategory(
                        "expense", "Debt Repayment", "debt",
                        Category(name = "Debt Repayment", color = "#6366f1", icon = "fa-handshake", type = "expense")
                    )
                    val autoTx = repo.addTransaction(
                        Transaction(
                            amount = rem,
                            type = "expense",
                            date = DateUtils.getLocalDateString(),
                            categoryId = cat.id,
                            note = "Settled & repaid debt to ${current.lenderName}"
                        ),
                        session
                    )
                    _state.update { it.copy(transactions = listOf(autoTx) + it.transactions) }
                }
                haptics.trigger(HapticType.SUCCESS)
                showToast("Debt settled!")
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to settle debt", isError = true)
            }
        }
    }

    fun deleteBorrowedRecord(id: String) {
        viewModelScope.launch {
            try {
                repo.deleteBorrowedRecord(id, _state.value.session)
                _state.update { it.copy(borrowedRecords = it.borrowedRecords.filterNot { r -> r.id == id }) }
                haptics.trigger(HapticType.HEAVY)
                showToast("Borrowed record deleted")
            } catch (e: Exception) {
                showToast(e.message ?: "Failed to delete record", isError = true)
            }
        }
    }

    // -----------------------------------------
    // Export / Backup / Restore / CSV Import
    // -----------------------------------------

    fun exportFullBackupJsonFile(context: Context): File {
        val st = _state.value
        val backup = FullBackupV3(
            version = "3.0",
            exportDate = Instant.now().toString(),
            transactions = st.transactions,
            categories = st.categories,
            accounts = st.accounts,
            savingsGoals = st.savingsGoals,
            subscriptions = st.subscriptions,
            events = st.events,
            lentRecords = st.lentRecords,
            borrowedRecords = st.borrowedRecords,
            settings = st.settings
        )
        val jsonStr = localStore.json.encodeToString(backup)
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, "kharch_complete_backup_${DateUtils.getLocalDateString()}.json")
        file.writeText(jsonStr)
        return file
    }

    fun exportCsvFile(context: Context): File? {
        val st = _state.value
        if (st.transactions.isEmpty()) {
            showToast("No transactions to export.", isError = true)
            return null
        }
        val csvStr = ShareAndPdfUtils.generateTransactionsCsv(st.transactions, st.categories, st.accounts)
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, "kharch_export_${DateUtils.getLocalDateString()}.csv")
        file.writeText(csvStr)
        return file
    }

    fun restoreBackupFromUri(context: Context, uri: Uri) {
        viewModelScope.launch {
            _state.update { it.copy(restoreProgress = RestoreProgress("init", 5, "Reading and parsing backup file...")) }
            try {
                val raw = context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                    ?: throw Exception("Could not read selected file")
                val backup = localStore.json.decodeFromString<FullBackupV3>(raw)
                val count = repo.restoreCompleteBackup(backup, _state.value.session) { prog ->
                    _state.update { it.copy(restoreProgress = prog) }
                }
                refreshData()
                haptics.trigger(HapticType.SUCCESS)
                showToast("Successfully restored $count records from backup!")
            } catch (e: Exception) {
                _state.update { it.copy(restoreProgress = null) }
                haptics.trigger(HapticType.ERROR)
                showToast(e.message ?: "Error parsing or restoring JSON backup file.", isError = true)
            }
        }
    }

    fun dismissRestoreProgress() {
        _state.update { it.copy(restoreProgress = null) }
    }

    suspend fun importCsvBatch(items: List<Transaction>): Int {
        val session = _state.value.session
        val newlyAdded = mutableListOf<Transaction>()
        for (tx in items) {
            val saved = repo.addTransaction(tx, session)
            newlyAdded.add(saved)
        }
        if (newlyAdded.isNotEmpty()) {
            _state.update { it.copy(transactions = newlyAdded.reversed() + it.transactions) }
        }
        haptics.trigger(HapticType.SUCCESS)
        showToast("Imported ${newlyAdded.size} transaction(s) from CSV!")
        return newlyAdded.size
    }
}
