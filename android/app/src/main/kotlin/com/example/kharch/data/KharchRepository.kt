package com.example.kharch.data

import com.example.kharch.model.*
import com.example.kharch.util.CategoryEngine
import com.example.kharch.util.DateUtils
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant
import java.util.UUID

data class FullDataBundle(
    val transactions: List<Transaction>,
    val categories: List<Category>,
    val accounts: List<Account>,
    val savingsGoals: List<SavingsGoal>,
    val events: List<EventBudget>,
    val subscriptions: List<Subscription>,
    val lentRecords: List<LentRecord>,
    val borrowedRecords: List<BorrowedRecord>,
    val settings: UserSettings,
    val autoPostedCount: Int = 0
)

class KharchRepository(
    val localStore: LocalStore,
    val firebase: FirebaseRestClient
) {
    private val fetchMutex = Mutex()

    private fun genId(prefix: String): String {
        return "${prefix}_${System.currentTimeMillis()}_${UUID.randomUUID().toString().take(6)}"
    }

    private fun normalizeTokenSession(session: AuthSession?): AuthSession? {
        if (session == null || !firebase.isConfigured) return null
        return session
    }

    suspend fun loadAll(session: AuthSession?): Pair<AuthSession?, FullDataBundle> = fetchMutex.withLock {
        var activeSession = normalizeTokenSession(session)

        if (activeSession != null) {
            activeSession = firebase.ensureValidSession(activeSession)
            localStore.saveAuthSession(activeSession)
            runCatching { migrateLocalDataToCloud(activeSession) }
        }

        val (txRaw, cats, settings, lent, borrowed, subsRaw, accs, goals, events) = coroutineScope {
            val txDef = async { getTransactions(activeSession) }
            val catDef = async { getCategories(activeSession) }
            val setDef = async { getSettings(activeSession) }
            val lentDef = async { getLentRecords(activeSession) }
            val borDef = async { getBorrowedRecords(activeSession) }
            val subDef = async { getSubscriptions(activeSession) }
            val accDef = async { getAccounts(activeSession) }
            val goalDef = async { getSavingsGoals(activeSession) }
            val evDef = async { getEvents(activeSession) }

            Tuple9(
                txDef.await(),
                catDef.await(),
                setDef.await(),
                lentDef.await(),
                borDef.await(),
                subDef.await(),
                accDef.await(),
                goalDef.await(),
                evDef.await()
            )
        }

        // Auto-process due active subscriptions using local timezone.
        // Idempotency guard: advance nextDueDate BEFORE creating the transaction.
        var currentTx = txRaw
        val currentSubs = subsRaw.toMutableList()
        val todayStr = DateUtils.getLocalDateString()
        val defaultAccId = accs.firstOrNull { it.isDefault }?.id ?: accs.firstOrNull()?.id
        var postedCount = 0

        for (i in currentSubs.indices) {
            val sub = currentSubs[i]
            if (sub.active && sub.nextDueDate.isNotBlank() && sub.nextDueDate <= todayStr) {
                runCatching {
                    val paymentDate = sub.nextDueDate
                    val nextDue = DateUtils.calculateNextDueDate(sub.nextDueDate, sub.frequency)
                    val updatedSub = sub.copy(nextDueDate = nextDue)
                    updateSubscription(updatedSub, activeSession)
                    currentSubs[i] = updatedSub

                    val newTx = addTransaction(
                        Transaction(
                            amount = sub.amount,
                            categoryId = sub.categoryId,
                            date = paymentDate,
                            note = "Auto-posted: ${sub.name}",
                            type = sub.type.ifBlank { "expense" },
                            accountId = sub.accountId ?: defaultAccId
                        ),
                        activeSession
                    )
                    currentTx = listOf(newTx) + currentTx
                    postedCount++
                }
            }
        }

        activeSession to FullDataBundle(
            transactions = currentTx.sortedWith(compareByDescending<Transaction> { it.date }.thenByDescending { it.createdAt }),
            categories = cats,
            accounts = accs,
            savingsGoals = goals,
            events = events,
            subscriptions = currentSubs,
            lentRecords = lent,
            borrowedRecords = borrowed,
            settings = settings,
            autoPostedCount = postedCount
        )
    }

    // -----------------------------------------
    // Transactions
    // -----------------------------------------

    suspend fun getTransactions(session: AuthSession?): List<Transaction> {
        if (session == null) {
            return localStore.getTransactions()
                .sortedWith(compareByDescending<Transaction> { it.date }.thenByDescending { it.createdAt })
        }
        val docs = firebase.listCollection(session, "transactions")
        return docs.map { (id, f) -> mapToTransaction(id, f) }
            .sortedWith(compareByDescending<Transaction> { it.date }.thenByDescending { it.createdAt })
    }

    suspend fun addTransaction(tx: Transaction, session: AuthSession?): Transaction {
        val toSave = tx.copy(
            createdAt = tx.createdAt.ifBlank { Instant.now().toString() }
        )
        if (session == null) {
            val persisted = toSave.copy(id = genId("local_tx"))
            localStore.saveTransactions(listOf(persisted) + localStore.getTransactions())
            return persisted
        }
        val docId = firebase.addDocument(session, "transactions", transactionToMap(toSave))
        return toSave.copy(id = docId)
    }

    suspend fun updateTransaction(tx: Transaction, session: AuthSession?): Transaction {
        if (session == null) {
            val list = localStore.getTransactions().map { if (it.id == tx.id) tx else it }
            localStore.saveTransactions(list)
            return tx
        }
        if (tx.id.startsWith("local_") || tx.id.startsWith("transient_")) return tx
        firebase.patchDocument(session, "transactions/${tx.id}", transactionToMap(tx))
        return tx
    }

    suspend fun deleteTransaction(id: String, session: AuthSession?) {
        if (session == null) {
            localStore.saveTransactions(localStore.getTransactions().filterNot { it.id == id })
            return
        }
        if (id.startsWith("local_") || id.startsWith("transient_")) return
        firebase.deleteDocument(session, "transactions/$id")
    }

    // -----------------------------------------
    // Categories
    // -----------------------------------------

    suspend fun getCategories(session: AuthSession?): List<Category> {
        if (session == null) {
            val local = localStore.getCategories()
            val existingNames = local.map { it.name.trim().lowercase() }.toSet()
            val missing = CategoryEngine.DEFAULT_CATEGORIES.filter { it.name.trim().lowercase() !in existingNames }
            if (local.isEmpty()) {
                val seeded = CategoryEngine.DEFAULT_CATEGORIES.mapIndexed { idx, c -> c.copy(id = "local_cat_$idx") }
                localStore.saveCategories(seeded)
                return seeded
            } else if (missing.isNotEmpty()) {
                val added = missing.mapIndexed { idx, c -> c.copy(id = "local_cat_${System.currentTimeMillis()}_$idx") }
                val merged = local + added
                localStore.saveCategories(merged)
                return merged
            }
            return local
        }

        val docs = firebase.listCollection(session, "categories")
        val existing = docs.map { (id, f) -> mapToCategory(id, f) }.toMutableList()
        if (existing.isEmpty()) {
            val seeded = mutableListOf<Category>()
            for (c in CategoryEngine.DEFAULT_CATEGORIES) {
                val id = firebase.addDocument(session, "categories", categoryToMap(c))
                seeded.add(c.copy(id = id))
            }
            return seeded
        }
        val names = existing.map { it.name.trim().lowercase() }.toSet()
        val missing = CategoryEngine.DEFAULT_CATEGORIES.filter { it.name.trim().lowercase() !in names }
        for (m in missing) {
            runCatching {
                val id = firebase.addDocument(session, "categories", categoryToMap(m))
                existing.add(m.copy(id = id))
            }
        }
        return existing
    }

    suspend fun addCategory(cat: Category, session: AuthSession?): Category {
        if (session == null) {
            val list = localStore.getCategories().toMutableList()
            val dup = list.firstOrNull { it.name.equals(cat.name, ignoreCase = true) && it.type == cat.type }
            if (dup != null) return dup
            val persisted = cat.copy(id = genId("local_cat"))
            list.add(persisted)
            localStore.saveCategories(list)
            return persisted
        }
        val docId = firebase.addDocument(session, "categories", categoryToMap(cat))
        return cat.copy(id = docId)
    }

    suspend fun updateCategory(cat: Category, session: AuthSession?): Category {
        if (session == null) {
            localStore.saveCategories(localStore.getCategories().map { if (it.id == cat.id) cat else it })
            return cat
        }
        firebase.patchDocument(session, "categories/${cat.id}", categoryToMap(cat))
        return cat
    }

    // -----------------------------------------
    // Settings
    // -----------------------------------------

    suspend fun getSettings(session: AuthSession?): UserSettings {
        if (session == null) return localStore.getUserSettings()
        val fields = firebase.getDocument(session, "settings/config") ?: return UserSettings()
        return UserSettings(monthlyBudget = asDouble(fields["monthlyBudget"]))
    }

    suspend fun updateSettings(settings: UserSettings, session: AuthSession?): UserSettings {
        if (session == null) {
            localStore.saveUserSettings(settings)
            return settings
        }
        firebase.patchDocument(session, "settings/config", mapOf("monthlyBudget" to settings.monthlyBudget))
        return settings
    }

    // -----------------------------------------
    // Accounts
    // -----------------------------------------

    suspend fun getAccounts(session: AuthSession?): List<Account> {
        if (session == null) {
            val local = localStore.getAccounts()
            if (local.isNotEmpty()) return local
            val seeded = CategoryEngine.DEFAULT_ACCOUNTS.mapIndexed { idx, a -> a.copy(id = "local_acc_$idx") }
            localStore.saveAccounts(seeded)
            return seeded
        }
        val existing = firebase.listCollection(session, "accounts").map { (id, f) -> mapToAccount(id, f) }
        if (existing.isEmpty()) {
            val seeded = mutableListOf<Account>()
            for (acc in CategoryEngine.DEFAULT_ACCOUNTS) {
                val id = firebase.addDocument(session, "accounts", accountToMap(acc))
                seeded.add(acc.copy(id = id))
            }
            return seeded
        }
        return existing
    }

    suspend fun addAccount(acc: Account, session: AuthSession?): Account {
        if (session == null) {
            val persisted = acc.copy(id = genId("local_acc"))
            localStore.saveAccounts(localStore.getAccounts() + persisted)
            return persisted
        }
        val docId = firebase.addDocument(session, "accounts", accountToMap(acc))
        return acc.copy(id = docId)
    }

    suspend fun updateAccount(acc: Account, session: AuthSession?): Account {
        if (session == null) {
            localStore.saveAccounts(localStore.getAccounts().map { if (it.id == acc.id) acc else it })
            return acc
        }
        firebase.patchDocument(session, "accounts/${acc.id}", accountToMap(acc))
        return acc
    }

    suspend fun deleteAccount(id: String, session: AuthSession?) {
        if (session == null) {
            localStore.saveAccounts(localStore.getAccounts().filterNot { it.id == id })
            return
        }
        firebase.deleteDocument(session, "accounts/$id")
    }

    // -----------------------------------------
    // Savings Goals
    // -----------------------------------------

    suspend fun getSavingsGoals(session: AuthSession?): List<SavingsGoal> {
        if (session == null) return localStore.getSavingsGoals()
        return firebase.listCollection(session, "savings_goals").map { (id, f) -> mapToGoal(id, f) }
    }

    suspend fun addSavingsGoal(goal: SavingsGoal, session: AuthSession?): SavingsGoal {
        if (session == null) {
            val persisted = goal.copy(id = genId("local_goal"))
            localStore.saveSavingsGoals(localStore.getSavingsGoals() + persisted)
            return persisted
        }
        val docId = firebase.addDocument(session, "savings_goals", goalToMap(goal))
        return goal.copy(id = docId)
    }

    suspend fun updateSavingsGoal(goal: SavingsGoal, session: AuthSession?): SavingsGoal {
        if (session == null) {
            localStore.saveSavingsGoals(localStore.getSavingsGoals().map { if (it.id == goal.id) goal else it })
            return goal
        }
        firebase.patchDocument(session, "savings_goals/${goal.id}", goalToMap(goal))
        return goal
    }

    suspend fun deleteSavingsGoal(id: String, session: AuthSession?) {
        if (session == null) {
            localStore.saveSavingsGoals(localStore.getSavingsGoals().filterNot { it.id == id })
            return
        }
        firebase.deleteDocument(session, "savings_goals/$id")
    }

    // -----------------------------------------
    // Events / Trips
    // -----------------------------------------

    suspend fun getEvents(session: AuthSession?): List<EventBudget> {
        if (session == null) return localStore.getEvents()
        return firebase.listCollection(session, "events").map { (id, f) -> mapToEvent(id, f) }
    }

    suspend fun addEvent(event: EventBudget, session: AuthSession?): EventBudget {
        if (session == null) {
            val persisted = event.copy(id = genId("local_event"))
            localStore.saveEvents(localStore.getEvents() + persisted)
            return persisted
        }
        val docId = firebase.addDocument(session, "events", eventToMap(event))
        return event.copy(id = docId)
    }

    suspend fun updateEvent(event: EventBudget, session: AuthSession?): EventBudget {
        if (session == null) {
            localStore.saveEvents(localStore.getEvents().map { if (it.id == event.id) event else it })
            return event
        }
        firebase.patchDocument(session, "events/${event.id}", eventToMap(event))
        return event
    }

    suspend fun deleteEvent(id: String, session: AuthSession?) {
        if (session == null) {
            localStore.saveEvents(localStore.getEvents().filterNot { it.id == id })
            return
        }
        firebase.deleteDocument(session, "events/$id")
    }

    // -----------------------------------------
    // Subscriptions
    // -----------------------------------------

    suspend fun getSubscriptions(session: AuthSession?): List<Subscription> {
        if (session == null) return localStore.getSubscriptions()
        return firebase.listCollection(session, "subscriptions").map { (id, f) -> mapToSubscription(id, f) }
    }

    suspend fun addSubscription(sub: Subscription, session: AuthSession?): Subscription {
        if (session == null) {
            val persisted = sub.copy(id = genId("local_sub"))
            localStore.saveSubscriptions(localStore.getSubscriptions() + persisted)
            return persisted
        }
        val docId = firebase.addDocument(session, "subscriptions", subscriptionToMap(sub))
        return sub.copy(id = docId)
    }

    suspend fun updateSubscription(sub: Subscription, session: AuthSession?): Subscription {
        if (session == null) {
            localStore.saveSubscriptions(localStore.getSubscriptions().map { if (it.id == sub.id) sub else it })
            return sub
        }
        firebase.patchDocument(session, "subscriptions/${sub.id}", subscriptionToMap(sub))
        return sub
    }

    suspend fun deleteSubscription(id: String, session: AuthSession?) {
        if (session == null) {
            localStore.saveSubscriptions(localStore.getSubscriptions().filterNot { it.id == id })
            return
        }
        firebase.deleteDocument(session, "subscriptions/$id")
    }

    // -----------------------------------------
    // Lent Records
    // -----------------------------------------

    suspend fun getLentRecords(session: AuthSession?): List<LentRecord> {
        if (session == null) return localStore.getLentRecords()
        return firebase.listCollection(session, "lent_records").map { (id, f) -> mapToLentRecord(id, f) }
    }

    suspend fun addLentRecord(record: LentRecord, session: AuthSession?): LentRecord {
        val loans = record.loans.ifEmpty {
            listOf(
                LoanEntry(
                    id = genId("loan"),
                    amount = record.amount,
                    date = record.dateLent.ifBlank { DateUtils.getLocalDateString() },
                    note = record.note?.ifBlank { "Initial loan" } ?: "Initial loan"
                )
            )
        }
        val toSave = record.copy(
            loans = loans,
            createdAt = record.createdAt.ifBlank { Instant.now().toString() }
        )
        if (session == null) {
            val persisted = toSave.copy(id = genId("local_lent"))
            localStore.saveLentRecords(listOf(persisted) + localStore.getLentRecords())
            return persisted
        }
        val docId = firebase.addDocument(session, "lent_records", lentRecordToMap(toSave))
        return toSave.copy(id = docId)
    }

    suspend fun updateLentRecord(record: LentRecord, session: AuthSession?): LentRecord {
        if (session == null) {
            localStore.saveLentRecords(localStore.getLentRecords().map { if (it.id == record.id) record else it })
            return record
        }
        firebase.patchDocument(session, "lent_records/${record.id}", lentRecordToMap(record))
        return record
    }

    suspend fun deleteLentRecord(id: String, session: AuthSession?) {
        if (session == null) {
            localStore.saveLentRecords(localStore.getLentRecords().filterNot { it.id == id })
            return
        }
        firebase.deleteDocument(session, "lent_records/$id")
    }

    // -----------------------------------------
    // Borrowed Records
    // -----------------------------------------

    suspend fun getBorrowedRecords(session: AuthSession?): List<BorrowedRecord> {
        if (session == null) return localStore.getBorrowedRecords()
        return firebase.listCollection(session, "borrowed_records").map { (id, f) -> mapToBorrowedRecord(id, f) }
    }

    suspend fun addBorrowedRecord(record: BorrowedRecord, session: AuthSession?): BorrowedRecord {
        val borrows = record.borrows.ifEmpty {
            listOf(
                BorrowEntry(
                    id = genId("borrow"),
                    amount = record.amount,
                    date = record.dateBorrowed.ifBlank { DateUtils.getLocalDateString() },
                    note = record.note?.ifBlank { "Initial borrowed money" } ?: "Initial borrowed money"
                )
            )
        }
        val toSave = record.copy(
            borrows = borrows,
            createdAt = record.createdAt.ifBlank { Instant.now().toString() }
        )
        if (session == null) {
            val persisted = toSave.copy(id = genId("local_borrow"))
            localStore.saveBorrowedRecords(listOf(persisted) + localStore.getBorrowedRecords())
            return persisted
        }
        val docId = firebase.addDocument(session, "borrowed_records", borrowedRecordToMap(toSave))
        return toSave.copy(id = docId)
    }

    suspend fun updateBorrowedRecord(record: BorrowedRecord, session: AuthSession?): BorrowedRecord {
        if (session == null) {
            localStore.saveBorrowedRecords(localStore.getBorrowedRecords().map { if (it.id == record.id) record else it })
            return record
        }
        firebase.patchDocument(session, "borrowed_records/${record.id}", borrowedRecordToMap(record))
        return record
    }

    suspend fun deleteBorrowedRecord(id: String, session: AuthSession?) {
        if (session == null) {
            localStore.saveBorrowedRecords(localStore.getBorrowedRecords().filterNot { it.id == id })
            return
        }
        firebase.deleteDocument(session, "borrowed_records/$id")
    }

    // -----------------------------------------
    // Guest -> Cloud Migration (exact db.js rules)
    // -----------------------------------------

    suspend fun migrateLocalDataToCloud(session: AuthSession): Int {
        val norm = { s: String? -> (s ?: "").trim().lowercase() }
        var count = 0

        // 1. Categories
        val catIdMap = mutableMapOf<String, String>()
        val guestCats = localStore.getCategories()
        if (guestCats.isNotEmpty()) {
            val cloudCats = getCategories(session).toMutableList()
            for (gc in guestCats) {
                val match = cloudCats.firstOrNull { norm(it.name) == norm(gc.name) && it.type == gc.type }
                    ?: addCategory(gc.copy(id = ""), session).also { cloudCats.add(it) }
                if (gc.id.isNotBlank() && match.id.isNotBlank()) catIdMap[gc.id] = match.id
            }
            localStore.saveCategories(emptyList())
        }

        // 2. Accounts
        val accIdMap = mutableMapOf<String, String>()
        val guestAccs = localStore.getAccounts()
        if (guestAccs.isNotEmpty()) {
            val cloudAccs = getAccounts(session).toMutableList()
            for (ga in guestAccs) {
                val match = cloudAccs.firstOrNull { norm(it.name) == norm(ga.name) && it.type == ga.type }
                    ?: addAccount(ga.copy(id = "", isDefault = false), session).also { cloudAccs.add(it) }
                if (ga.id.isNotBlank() && match.id.isNotBlank()) accIdMap[ga.id] = match.id
            }
            localStore.saveAccounts(emptyList())
        }

        // 3. Events
        val eventIdMap = mutableMapOf<String, String>()
        val guestEvents = localStore.getEvents()
        if (guestEvents.isNotEmpty()) {
            val cloudEvents = getEvents(session).toMutableList()
            for (ge in guestEvents) {
                val match = (if (ge.tag.isNotBlank()) cloudEvents.firstOrNull { norm(it.tag) == norm(ge.tag) } else null)
                    ?: addEvent(ge.copy(id = ""), session).also { cloudEvents.add(it) }
                if (ge.id.isNotBlank() && match.id.isNotBlank()) eventIdMap[ge.id] = match.id
            }
            localStore.saveEvents(emptyList())
        }

        // 4. Transactions
        val guestTx = localStore.getTransactions()
        for (tx in guestTx) {
            val mapped = tx.copy(
                id = "",
                categoryId = tx.categoryId?.let { catIdMap[it] ?: it },
                accountId = tx.accountId?.let { accIdMap[it] ?: it },
                fromAccountId = tx.fromAccountId?.let { accIdMap[it] ?: it },
                toAccountId = tx.toAccountId?.let { accIdMap[it] ?: it },
                eventId = tx.eventId?.let { eventIdMap[it] ?: it }
            )
            addTransaction(mapped, session)
            count++
            localStore.saveTransactions(localStore.getTransactions().filterNot { it.id == tx.id })
        }

        // 5. Lent / Borrowed / Subscriptions / Goals
        for (lr in localStore.getLentRecords()) {
            addLentRecord(lr.copy(id = ""), session)
            count++
            localStore.saveLentRecords(localStore.getLentRecords().filterNot { it.id == lr.id })
        }
        for (br in localStore.getBorrowedRecords()) {
            addBorrowedRecord(br.copy(id = ""), session)
            count++
            localStore.saveBorrowedRecords(localStore.getBorrowedRecords().filterNot { it.id == br.id })
        }
        for (sub in localStore.getSubscriptions()) {
            val mapped = sub.copy(
                id = "",
                categoryId = catIdMap[sub.categoryId] ?: sub.categoryId,
                accountId = sub.accountId?.let { accIdMap[it] ?: it }
            )
            addSubscription(mapped, session)
            count++
            localStore.saveSubscriptions(localStore.getSubscriptions().filterNot { it.id == sub.id })
        }
        for (goal in localStore.getSavingsGoals()) {
            addSavingsGoal(goal.copy(id = ""), session)
            count++
            localStore.saveSavingsGoals(localStore.getSavingsGoals().filterNot { it.id == goal.id })
        }

        // 6. Settings
        val guestSettings = localStore.getUserSettings()
        if (guestSettings.monthlyBudget > 0.0) {
            val cloudSettings = getSettings(session)
            if (cloudSettings.monthlyBudget <= 0.0) {
                updateSettings(guestSettings, session)
            }
        }
        localStore.saveUserSettings(UserSettings())
        return count
    }

    // -----------------------------------------
    // Complete JSON Backup Restore (v3.0 compatible)
    // -----------------------------------------

    suspend fun restoreCompleteBackup(
        backup: FullBackupV3,
        session: AuthSession?,
        onProgress: (RestoreProgress) -> Unit
    ): Int {
        var importedCount = 0
        val catIdMap = mutableMapOf<String, String>()
        val accIdMap = mutableMapOf<String, String>()
        val eventIdMap = mutableMapOf<String, String>()

        onProgress(RestoreProgress("categories", 10, "Restoring custom categories..."))
        val existingCats = getCategories(session).toMutableList()
        for (cat in backup.categories) {
            if (cat.name.isBlank()) continue
            val existing = existingCats.firstOrNull { it.name.equals(cat.name, ignoreCase = true) && it.type == cat.type }
            if (existing != null) {
                if (cat.id.isNotBlank()) catIdMap[cat.id] = existing.id
            } else {
                val created = addCategory(cat.copy(id = ""), session)
                existingCats.add(created)
                if (cat.id.isNotBlank()) catIdMap[cat.id] = created.id
                importedCount++
            }
        }

        onProgress(RestoreProgress("accounts", 25, "Restoring accounts & wallets..."))
        val existingAccs = getAccounts(session).toMutableList()
        for (acc in backup.accounts) {
            if (acc.name.isBlank()) continue
            val existing = existingAccs.firstOrNull { it.name.equals(acc.name, ignoreCase = true) }
            if (existing != null) {
                if (acc.id.isNotBlank()) accIdMap[acc.id] = existing.id
            } else {
                val created = addAccount(acc.copy(id = ""), session)
                existingAccs.add(created)
                if (acc.id.isNotBlank()) accIdMap[acc.id] = created.id
                importedCount++
            }
        }

        onProgress(RestoreProgress("events", 40, "Restoring event and trip budgets..."))
        val existingEvents = getEvents(session).toMutableList()
        for (ev in backup.events) {
            if (ev.name.isBlank()) continue
            val existing = existingEvents.firstOrNull {
                it.name.equals(ev.name, ignoreCase = true) || (ev.tag.isNotBlank() && it.tag == ev.tag)
            }
            if (existing != null) {
                if (ev.id.isNotBlank()) eventIdMap[ev.id] = existing.id
            } else {
                val created = addEvent(ev.copy(id = ""), session)
                existingEvents.add(created)
                if (ev.id.isNotBlank()) eventIdMap[ev.id] = created.id
                importedCount++
            }
        }

        onProgress(RestoreProgress("goals", 50, "Restoring savings goals..."))
        val goalSeen = getSavingsGoals(session).map {
            "${it.name.trim().lowercase()}__${it.targetAmount}"
        }.toMutableSet()
        for (goal in backup.savingsGoals) {
            if (goal.name.isBlank()) continue
            val fp = "${goal.name.trim().lowercase()}__${goal.targetAmount}"
            if (fp in goalSeen) continue
            goalSeen.add(fp)
            addSavingsGoal(goal.copy(id = ""), session)
            importedCount++
        }

        onProgress(RestoreProgress("subscriptions", 60, "Restoring recurring subscriptions..."))
        val subSeen = getSubscriptions(session).map {
            "${it.name.trim().lowercase()}__${it.amount}__${it.frequency}"
        }.toMutableSet()
        for (sub in backup.subscriptions) {
            if (sub.name.isBlank()) continue
            val fp = "${sub.name.trim().lowercase()}__${sub.amount}__${sub.frequency}"
            if (fp in subSeen) continue
            subSeen.add(fp)
            val mapped = sub.copy(
                id = "",
                categoryId = catIdMap[sub.categoryId] ?: sub.categoryId,
                accountId = sub.accountId?.let { accIdMap[it] ?: it }
            )
            addSubscription(mapped, session)
            importedCount++
        }

        onProgress(RestoreProgress("lent", 70, "Restoring peer lending records..."))
        val lentSeen = getLentRecords(session).map {
            "${it.borrowerName.trim().lowercase()}__${it.amount}__${it.dateLent.take(10)}"
        }.toMutableSet()
        for (lr in backup.lentRecords) {
            if (lr.borrowerName.isBlank() || lr.amount <= 0.0) continue
            val fp = "${lr.borrowerName.trim().lowercase()}__${lr.amount}__${lr.dateLent.take(10)}"
            if (fp in lentSeen) continue
            lentSeen.add(fp)
            addLentRecord(lr.copy(id = ""), session)
            importedCount++
        }

        onProgress(RestoreProgress("borrowed", 80, "Restoring debt liabilities..."))
        val borrowedSeen = getBorrowedRecords(session).map {
            "${it.lenderName.trim().lowercase()}__${it.amount}__${it.dateBorrowed.take(10)}"
        }.toMutableSet()
        for (br in backup.borrowedRecords) {
            if (br.lenderName.isBlank() || br.amount <= 0.0) continue
            val fp = "${br.lenderName.trim().lowercase()}__${br.amount}__${br.dateBorrowed.take(10)}"
            if (fp in borrowedSeen) continue
            borrowedSeen.add(fp)
            addBorrowedRecord(br.copy(id = ""), session)
            importedCount++
        }

        onProgress(RestoreProgress("transactions", 90, "Restoring transactions & accounts..."))
        val txSeen = getTransactions(session).map {
            "${it.date.take(10)}__${"%.2f".format(it.amount)}__${it.type}__${it.note.trim().lowercase()}"
        }.toMutableSet()
        for (tx in backup.transactions) {
            val mapped = tx.copy(
                id = "",
                createdAt = "",
                categoryId = tx.categoryId?.let { catIdMap[it] ?: it },
                accountId = tx.accountId?.let { accIdMap[it] ?: it },
                fromAccountId = tx.fromAccountId?.let { accIdMap[it] ?: it },
                toAccountId = tx.toAccountId?.let { accIdMap[it] ?: it },
                eventId = tx.eventId?.let { eventIdMap[it] ?: it }
            )
            val fp = "${mapped.date.take(10)}__${"%.2f".format(mapped.amount)}__${mapped.type}__${mapped.note.trim().lowercase()}"
            if (fp in txSeen) continue
            txSeen.add(fp)
            addTransaction(mapped, session)
            importedCount++
        }

        if (backup.settings.monthlyBudget > 0.0) {
            updateSettings(backup.settings, session)
        }

        onProgress(RestoreProgress("complete", 100, "Successfully restored $importedCount records!", isDone = true, count = importedCount))
        return importedCount
    }

    // -----------------------------------------
    // Firestore Field Converters
    // -----------------------------------------

    private fun asDouble(v: Any?): Double = when (v) {
        is Double -> v
        is Float -> v.toDouble()
        is Long -> v.toDouble()
        is Int -> v.toDouble()
        is String -> v.toDoubleOrNull() ?: 0.0
        else -> 0.0
    }

    private fun asString(v: Any?): String = v?.toString() ?: ""

    private fun asBoolean(v: Any?, default: Boolean = false): Boolean = when (v) {
        is Boolean -> v
        is String -> v.equals("true", ignoreCase = true)
        else -> default
    }

    @Suppress("UNCHECKED_CAST")
    private fun asStringList(v: Any?): List<String> {
        val list = v as? List<*> ?: return emptyList()
        return list.mapNotNull { it?.toString() }
    }

    @Suppress("UNCHECKED_CAST")
    private fun mapToTransaction(id: String, f: Map<String, Any?>): Transaction {
        return Transaction(
            id = id,
            amount = asDouble(f["amount"]),
            type = asString(f["type"]).ifBlank { "expense" },
            categoryId = f["categoryId"]?.toString(),
            date = asString(f["date"]),
            note = asString(f["note"]),
            tags = asStringList(f["tags"]),
            accountId = f["accountId"]?.toString(),
            fromAccountId = f["fromAccountId"]?.toString(),
            toAccountId = f["toAccountId"]?.toString(),
            eventId = f["eventId"]?.toString(),
            eventTag = f["eventTag"]?.toString(),
            createdAt = asString(f["createdAt"])
        )
    }

    private fun transactionToMap(tx: Transaction): Map<String, Any?> = buildMap {
        put("amount", tx.amount)
        put("type", tx.type)
        put("date", tx.date)
        put("note", tx.note)
        put("tags", tx.tags)
        tx.categoryId?.let { put("categoryId", it) }
        tx.accountId?.let { put("accountId", it) }
        tx.fromAccountId?.let { put("fromAccountId", it) }
        tx.toAccountId?.let { put("toAccountId", it) }
        tx.eventId?.let { put("eventId", it) }
        tx.eventTag?.let { put("eventTag", it) }
        if (tx.createdAt.isNotBlank()) put("createdAt", tx.createdAt)
    }

    private fun mapToCategory(id: String, f: Map<String, Any?>): Category = Category(
        id = id,
        name = asString(f["name"]),
        color = asString(f["color"]).ifBlank { "#71717a" },
        icon = asString(f["icon"]).ifBlank { "fa-tag" },
        type = asString(f["type"]).ifBlank { "expense" },
        budgetLimit = asDouble(f["budgetLimit"])
    )

    private fun categoryToMap(c: Category): Map<String, Any?> = mapOf(
        "name" to c.name,
        "color" to c.color,
        "icon" to c.icon,
        "type" to c.type,
        "budgetLimit" to c.budgetLimit
    )

    private fun mapToAccount(id: String, f: Map<String, Any?>): Account = Account(
        id = id,
        name = asString(f["name"]),
        type = asString(f["type"]).ifBlank { "bank" },
        initialBalance = asDouble(f["initialBalance"]),
        color = asString(f["color"]).ifBlank { "#3b82f6" },
        icon = asString(f["icon"]).ifBlank { "fa-building-columns" },
        isDefault = asBoolean(f["isDefault"], false)
    )

    private fun accountToMap(a: Account): Map<String, Any?> = mapOf(
        "name" to a.name,
        "type" to a.type,
        "initialBalance" to a.initialBalance,
        "color" to a.color,
        "icon" to a.icon,
        "isDefault" to a.isDefault
    )

    @Suppress("UNCHECKED_CAST")
    private fun mapToGoal(id: String, f: Map<String, Any?>): SavingsGoal {
        val rawContribs = (f["contributions"] as? List<*>)?.mapNotNull { item ->
            val m = item as? Map<String, Any?> ?: return@mapNotNull null
            GoalContribution(
                id = asString(m["id"]),
                amount = asDouble(m["amount"]),
                date = asString(m["date"]),
                note = asString(m["note"])
            )
        } ?: emptyList()
        return SavingsGoal(
            id = id,
            name = asString(f["name"]),
            targetAmount = asDouble(f["targetAmount"]),
            savedAmount = asDouble(f["savedAmount"]),
            targetDate = f["targetDate"]?.toString(),
            color = asString(f["color"]).ifBlank { "#10b981" },
            icon = asString(f["icon"]).ifBlank { "fa-bullseye" },
            status = asString(f["status"]).ifBlank { "active" },
            contributions = rawContribs
        )
    }

    private fun goalToMap(g: SavingsGoal): Map<String, Any?> = buildMap {
        put("name", g.name)
        put("targetAmount", g.targetAmount)
        put("savedAmount", g.savedAmount)
        put("targetDate", g.targetDate)
        put("color", g.color)
        put("icon", g.icon)
        put("status", g.status)
        put("contributions", g.contributions.map { c ->
            mapOf("id" to c.id, "amount" to c.amount, "date" to c.date, "note" to c.note)
        })
    }

    private fun mapToEvent(id: String, f: Map<String, Any?>): EventBudget = EventBudget(
        id = id,
        name = asString(f["name"]),
        tag = asString(f["tag"]),
        budget = asDouble(f["budget"]),
        startDate = f["startDate"]?.toString(),
        endDate = f["endDate"]?.toString(),
        color = asString(f["color"]).ifBlank { "#6366f1" },
        icon = asString(f["icon"]).ifBlank { "fa-suitcase" },
        description = f["description"]?.toString()
    )

    private fun eventToMap(e: EventBudget): Map<String, Any?> = mapOf(
        "name" to e.name,
        "tag" to e.tag,
        "budget" to e.budget,
        "startDate" to e.startDate,
        "endDate" to e.endDate,
        "color" to e.color,
        "icon" to e.icon,
        "description" to e.description
    )

    private fun mapToSubscription(id: String, f: Map<String, Any?>): Subscription = Subscription(
        id = id,
        name = asString(f["name"]),
        amount = asDouble(f["amount"]),
        categoryId = asString(f["categoryId"]),
        frequency = asString(f["frequency"]).ifBlank { "monthly" },
        nextDueDate = asString(f["nextDueDate"]),
        active = asBoolean(f["active"], true),
        type = asString(f["type"]).ifBlank { "expense" },
        accountId = f["accountId"]?.toString()
    )

    private fun subscriptionToMap(s: Subscription): Map<String, Any?> = buildMap {
        put("name", s.name)
        put("amount", s.amount)
        put("categoryId", s.categoryId)
        put("frequency", s.frequency)
        put("nextDueDate", s.nextDueDate)
        put("active", s.active)
        put("type", s.type)
        s.accountId?.let { put("accountId", it) }
    }

    @Suppress("UNCHECKED_CAST")
    private fun mapToLentRecord(id: String, f: Map<String, Any?>): LentRecord {
        val loans = (f["loans"] as? List<*>)?.mapNotNull { item ->
            val m = item as? Map<String, Any?> ?: return@mapNotNull null
            LoanEntry(asString(m["id"]), asDouble(m["amount"]), asString(m["date"]), asString(m["note"]))
        } ?: emptyList()
        val reps = (f["repayments"] as? List<*>)?.mapNotNull { item ->
            val m = item as? Map<String, Any?> ?: return@mapNotNull null
            RepaymentEntry(asString(m["id"]), asDouble(m["amount"]), asString(m["date"]), asString(m["note"]))
        } ?: emptyList()
        return LentRecord(
            id = id,
            borrowerName = asString(f["borrowerName"]),
            amount = asDouble(f["amount"]),
            returnedAmount = asDouble(f["returnedAmount"]),
            dateLent = asString(f["dateLent"]),
            dueDate = f["dueDate"]?.toString(),
            phone = f["phone"]?.toString(),
            note = f["note"]?.toString(),
            status = asString(f["status"]).ifBlank { "pending" },
            loans = loans,
            repayments = reps,
            createdAt = asString(f["createdAt"])
        )
    }

    private fun lentRecordToMap(r: LentRecord): Map<String, Any?> = mapOf(
        "borrowerName" to r.borrowerName,
        "amount" to r.amount,
        "returnedAmount" to r.returnedAmount,
        "dateLent" to r.dateLent,
        "dueDate" to r.dueDate,
        "phone" to r.phone,
        "note" to r.note,
        "status" to r.status,
        "loans" to r.loans.map { mapOf("id" to it.id, "amount" to it.amount, "date" to it.date, "note" to it.note) },
        "repayments" to r.repayments.map { mapOf("id" to it.id, "amount" to it.amount, "date" to it.date, "note" to it.note) },
        "createdAt" to r.createdAt
    )

    @Suppress("UNCHECKED_CAST")
    private fun mapToBorrowedRecord(id: String, f: Map<String, Any?>): BorrowedRecord {
        val borrows = (f["borrows"] as? List<*>)?.mapNotNull { item ->
            val m = item as? Map<String, Any?> ?: return@mapNotNull null
            BorrowEntry(asString(m["id"]), asDouble(m["amount"]), asString(m["date"]), asString(m["note"]))
        } ?: emptyList()
        val reps = (f["repayments"] as? List<*>)?.mapNotNull { item ->
            val m = item as? Map<String, Any?> ?: return@mapNotNull null
            RepaymentEntry(asString(m["id"]), asDouble(m["amount"]), asString(m["date"]), asString(m["note"]))
        } ?: emptyList()
        return BorrowedRecord(
            id = id,
            lenderName = asString(f["lenderName"]),
            amount = asDouble(f["amount"]),
            returnedAmount = asDouble(f["returnedAmount"]),
            dateBorrowed = asString(f["dateBorrowed"]),
            dueDate = f["dueDate"]?.toString(),
            phone = f["phone"]?.toString(),
            note = f["note"]?.toString(),
            status = asString(f["status"]).ifBlank { "pending" },
            borrows = borrows,
            repayments = reps,
            createdAt = asString(f["createdAt"])
        )
    }

    private fun borrowedRecordToMap(r: BorrowedRecord): Map<String, Any?> = mapOf(
        "lenderName" to r.lenderName,
        "amount" to r.amount,
        "returnedAmount" to r.returnedAmount,
        "dateBorrowed" to r.dateBorrowed,
        "dueDate" to r.dueDate,
        "phone" to r.phone,
        "note" to r.note,
        "status" to r.status,
        "borrows" to r.borrows.map { mapOf("id" to it.id, "amount" to it.amount, "date" to it.date, "note" to it.note) },
        "repayments" to r.repayments.map { mapOf("id" to it.id, "amount" to it.amount, "date" to it.date, "note" to it.note) },
        "createdAt" to r.createdAt
    )

    private data class Tuple9<A, B, C, D, E, F, G, H, I>(
        val first: A, val second: B, val third: C,
        val fourth: D, val fifth: E, val sixth: F,
        val seventh: G, val eighth: H, val ninth: I
    )
}
