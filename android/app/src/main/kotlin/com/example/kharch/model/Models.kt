package com.example.kharch.model

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable

@Immutable
@Serializable
data class Transaction(
    val id: String = "",
    val amount: Double = 0.0,
    val type: String = "expense", // "expense" | "income" | "transfer"
    val categoryId: String? = null,
    val date: String = "", // YYYY-MM-DD
    val note: String = "",
    val tags: List<String> = emptyList(),
    val accountId: String? = null,
    val fromAccountId: String? = null,
    val toAccountId: String? = null,
    val eventId: String? = null,
    val eventTag: String? = null,
    val createdAt: String = ""
)

@Immutable
@Serializable
data class Category(
    val id: String = "",
    val name: String = "",
    val color: String = "#71717a",
    val icon: String = "fa-tag",
    val type: String = "expense", // "expense" | "income"
    val budgetLimit: Double = 0.0
)

@Immutable
@Serializable
data class Account(
    val id: String = "",
    val name: String = "",
    val type: String = "bank", // "bank" | "cash" | "credit" | "wallet" | "savings" | "investment"
    val initialBalance: Double = 0.0,
    val color: String = "#3b82f6",
    val icon: String = "fa-building-columns",
    val isDefault: Boolean = false
)

@Immutable
data class AccountWithBalance(
    val account: Account,
    val balance: Double
) {
    val id: String get() = account.id
    val name: String get() = account.name
    val type: String get() = account.type
    val initialBalance: Double get() = account.initialBalance
    val color: String get() = account.color
    val icon: String get() = account.icon
    val isDefault: Boolean get() = account.isDefault
}

@Immutable
@Serializable
data class GoalContribution(
    val id: String = "",
    val amount: Double = 0.0,
    val date: String = "",
    val note: String = ""
)

@Immutable
@Serializable
data class SavingsGoal(
    val id: String = "",
    val name: String = "",
    val targetAmount: Double = 0.0,
    val savedAmount: Double = 0.0,
    val targetDate: String? = null,
    val color: String = "#10b981",
    val icon: String = "fa-bullseye",
    val status: String = "active", // "active" | "completed"
    val contributions: List<GoalContribution> = emptyList()
)

@Immutable
@Serializable
data class EventBudget(
    val id: String = "",
    val name: String = "",
    val tag: String = "",
    val budget: Double = 0.0,
    val startDate: String? = null,
    val endDate: String? = null,
    val color: String = "#6366f1",
    val icon: String = "fa-suitcase",
    val description: String? = null
)

@Immutable
data class EventWithStats(
    val event: EventBudget,
    val spent: Double,
    val remainingBudget: Double,
    val percentage: Double,
    val isOverBudget: Boolean,
    val txCount: Int
) {
    val id: String get() = event.id
    val name: String get() = event.name
    val tag: String get() = event.tag
    val budget: Double get() = event.budget
    val startDate: String? get() = event.startDate
    val endDate: String? get() = event.endDate
    val color: String get() = event.color
    val icon: String get() = event.icon
    val description: String? get() = event.description
}

@Immutable
@Serializable
data class Subscription(
    val id: String = "",
    val name: String = "",
    val amount: Double = 0.0,
    val categoryId: String = "",
    val frequency: String = "monthly", // "daily" | "weekly" | "monthly" | "yearly"
    val nextDueDate: String = "",
    val active: Boolean = true,
    val type: String = "expense", // "expense" | "income"
    val accountId: String? = null
)

@Immutable
@Serializable
data class LoanEntry(
    val id: String = "",
    val amount: Double = 0.0,
    val date: String = "",
    val note: String = ""
)

@Immutable
@Serializable
data class RepaymentEntry(
    val id: String = "",
    val amount: Double = 0.0,
    val date: String = "",
    val note: String = ""
)

@Immutable
@Serializable
data class LentRecord(
    val id: String = "",
    val borrowerName: String = "",
    val amount: Double = 0.0,
    val returnedAmount: Double = 0.0,
    val dateLent: String = "",
    val dueDate: String? = null,
    val phone: String? = null,
    val note: String? = null,
    val status: String = "pending", // "pending" | "partial" | "settled"
    val loans: List<LoanEntry> = emptyList(),
    val repayments: List<RepaymentEntry> = emptyList(),
    val createdAt: String = ""
)

@Immutable
@Serializable
data class BorrowEntry(
    val id: String = "",
    val amount: Double = 0.0,
    val date: String = "",
    val note: String = ""
)

@Immutable
@Serializable
data class BorrowedRecord(
    val id: String = "",
    val lenderName: String = "",
    val amount: Double = 0.0,
    val returnedAmount: Double = 0.0,
    val dateBorrowed: String = "",
    val dueDate: String? = null,
    val phone: String? = null,
    val note: String? = null,
    val status: String = "pending", // "pending" | "partial" | "settled"
    val borrows: List<BorrowEntry> = emptyList(),
    val repayments: List<RepaymentEntry> = emptyList(),
    val createdAt: String = ""
)

@Immutable
@Serializable
data class UserSettings(
    val monthlyBudget: Double = 0.0
)

@Immutable
@Serializable
data class FullBackupV3(
    val version: String = "3.0",
    val exportDate: String = "",
    val transactions: List<Transaction> = emptyList(),
    val categories: List<Category> = emptyList(),
    val accounts: List<Account> = emptyList(),
    val savingsGoals: List<SavingsGoal> = emptyList(),
    val subscriptions: List<Subscription> = emptyList(),
    val events: List<EventBudget> = emptyList(),
    val lentRecords: List<LentRecord> = emptyList(),
    val borrowedRecords: List<BorrowedRecord> = emptyList(),
    val settings: UserSettings = UserSettings()
)

@Immutable
@Serializable
data class AuthSession(
    val uid: String,
    val email: String,
    val displayName: String,
    val idToken: String,
    val refreshToken: String,
    val expiresAtMs: Long
)

@Serializable
enum class AppThemeMode {
    LIGHT, DARK, SYSTEM
}

@Serializable
enum class HapticIntensity {
    SUBTLE, MEDIUM, STRONG
}

@Immutable
data class RestoreProgress(
    val step: String,
    val percent: Int,
    val message: String,
    val isDone: Boolean = false,
    val count: Int = 0
)

enum class AppRoute(val title: String) {
    DASHBOARD("Dashboard"),
    TRANSACTIONS("Transactions"),
    ACCOUNTS("Accounts"),
    GOALS("Savings Goals"),
    EVENTS("Trips & Events"),
    SUBSCRIPTIONS("Subscriptions"),
    LENT("Lent to Friends"),
    BORROWED("Borrowed Money"),
    ANALYTICS("Analytics"),
    SETTINGS("Settings")
}
