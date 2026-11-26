package com.example.kharch.util

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.List
import androidx.compose.material.icons.automirrored.rounded.ShowChart
import androidx.compose.material.icons.rounded.*
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import com.example.kharch.model.Account
import com.example.kharch.model.Category

object CategoryEngine {

    val DEFAULT_CATEGORIES: List<Category> = listOf(
        Category(name = "Food", color = "#ef4444", icon = "fa-utensils", type = "expense"),
        Category(name = "Groceries", color = "#f97316", icon = "fa-shopping-cart", type = "expense"),
        Category(name = "Travel", color = "#eab308", icon = "fa-plane", type = "expense"),
        Category(name = "Entertainment", color = "#8b5cf6", icon = "fa-film", type = "expense"),
        Category(name = "Medical", color = "#ec4899", icon = "fa-notes-medical", type = "expense"),
        Category(name = "Lent Money", color = "#f59e0b", icon = "fa-hand-holding-dollar", type = "expense"),
        Category(name = "Debt Repayment", color = "#6366f1", icon = "fa-handshake", type = "expense"),
        Category(name = "From Dad", color = "#22c55e", icon = "fa-money-bill", type = "income"),
        Category(name = "Trading", color = "#10b981", icon = "fa-chart-line", type = "income"),
        Category(name = "Borrowed Money", color = "#06b6d4", icon = "fa-hand-holding", type = "income"),
        Category(name = "Lent Returned", color = "#10b981", icon = "fa-circle-check", type = "income")
    )

    val DEFAULT_ACCOUNTS: List<Account> = listOf(
        Account(name = "Primary Bank", type = "bank", initialBalance = 0.0, color = "#3b82f6", icon = "fa-building-columns", isDefault = true),
        Account(name = "Cash Wallet", type = "cash", initialBalance = 0.0, color = "#10b981", icon = "fa-money-bill-wave", isDefault = false),
        Account(name = "Credit Card", type = "credit", initialBalance = 0.0, color = "#8b5cf6", icon = "fa-credit-card", isDefault = false)
    )

    private val FOOD_KEYWORDS = Regex("\\b(coke|tea|chai|samosa|food|lunch|dinner|snack|coffee|burger|pizza|biryani|hotel|restaurant|bakery)\\b", RegexOption.IGNORE_CASE)
    private val LEND_KEYWORDS = Regex("\\b(lent|lend|borrow|loan|repay|debt)\\b", RegexOption.IGNORE_CASE)
    private val TRAVEL_KEYWORDS = Regex("\\b(uber|ola|auto|petrol|metro|fuel|flight|train|cab|bus|toll)\\b", RegexOption.IGNORE_CASE)
    private val ENTERTAINMENT_KEYWORDS = Regex("\\b(movie|game|netflix|spotify|prime|theatre|cinema|hotstar)\\b", RegexOption.IGNORE_CASE)

    fun parseHexColor(hex: String?, fallback: Color = Color(0xFF71717A)): Color {
        if (hex.isNullOrBlank()) return fallback
        return runCatching {
            val cleaned = hex.trim().removePrefix("#")
            val colorInt = cleaned.toLong(16)
            when (cleaned.length) {
                6 -> Color(colorInt or 0xFF000000L)
                8 -> Color(colorInt)
                else -> fallback
            }
        }.getOrDefault(fallback)
    }

    fun getIcon(iconName: String?): ImageVector {
        return when (iconName?.trim()?.lowercase()) {
            "fa-utensils" -> Icons.Rounded.Restaurant
            "fa-shopping-cart" -> Icons.Rounded.ShoppingCart
            "fa-hand-holding-dollar" -> Icons.Rounded.Payments
            "fa-hand-holding" -> Icons.Rounded.Savings
            "fa-handshake" -> Icons.Rounded.Handshake
            "fa-circle-check" -> Icons.Rounded.CheckCircle
            "fa-plane" -> Icons.Rounded.Flight
            "fa-film" -> Icons.Rounded.Movie
            "fa-notes-medical" -> Icons.Rounded.MedicalServices
            "fa-money-bill", "fa-money-bill-wave" -> Icons.Rounded.AttachMoney
            "fa-chart-line" -> Icons.AutoMirrored.Rounded.ShowChart
            "fa-laptop-code", "fa-laptop" -> Icons.Rounded.Laptop
            "fa-home", "fa-house" -> Icons.Rounded.Home
            "fa-bolt" -> Icons.Rounded.Bolt
            "fa-tag", "fa-tags" -> Icons.Rounded.Sell
            "fa-receipt" -> Icons.Rounded.Receipt
            "fa-car" -> Icons.Rounded.DirectionsCar
            "fa-gift" -> Icons.Rounded.CardGiftcard
            "fa-graduation-cap" -> Icons.Rounded.School
            "fa-coffee" -> Icons.Rounded.Coffee
            "fa-glass-water" -> Icons.Rounded.LocalDrink
            "fa-burger" -> Icons.Rounded.Fastfood
            "fa-building-columns" -> Icons.Rounded.AccountBalance
            "fa-credit-card" -> Icons.Rounded.CreditCard
            "fa-wallet" -> Icons.Rounded.AccountBalanceWallet
            "fa-piggy-bank" -> Icons.Rounded.Savings
            "fa-bullseye" -> Icons.Rounded.TrackChanges
            "fa-heart-pulse" -> Icons.Rounded.Favorite
            "fa-suitcase", "fa-briefcase" -> Icons.Rounded.Luggage
            "fa-umbrella-beach" -> Icons.Rounded.BeachAccess
            "fa-ring" -> Icons.Rounded.Diamond
            "fa-champagne-glasses" -> Icons.Rounded.Celebration
            "fa-sync", "fa-sync-alt" -> Icons.Rounded.Autorenew
            "fa-list" -> Icons.AutoMirrored.Rounded.List
            else -> Icons.Rounded.Sell
        }
    }

    fun resolveCategory(categoryId: String?, categories: List<Category>, note: String? = null): Category? {
        if (categories.isEmpty()) return null

        // 1. Direct ID or Name match first
        if (!categoryId.isNullOrBlank()) {
            val trimmed = categoryId.trim()
            categories.firstOrNull { it.id == trimmed }?.let { return it }
            categories.firstOrNull { it.id.trim().equals(trimmed, ignoreCase = true) }?.let { return it }
            categories.firstOrNull { it.name.trim().equals(trimmed, ignoreCase = true) }?.let { return it }
        }

        // 2. System-generated lent/borrow note inference
        if (!note.isNullOrBlank()) {
            val lowerNote = note.trim().lowercase()

            if (lowerNote.contains("repaid debt") ||
                lowerNote.contains("repaid to") ||
                lowerNote.contains("settled & repaid") ||
                lowerNote.contains("debt repayment") ||
                lowerNote.contains("paid back") ||
                (lowerNote.contains("repay") && (lowerNote.contains("friend") || lowerNote.contains("debt") || lowerNote.contains("borrow")))
            ) {
                return categories.firstOrNull { it.name.equals("debt repayment", ignoreCase = true) }
                    ?: categories.firstOrNull { it.name.contains("debt repayment", ignoreCase = true) }
                    ?: categories.firstOrNull { it.name.contains("debt", ignoreCase = true) }
                    ?: categories.firstOrNull { it.name.contains("repay", ignoreCase = true) }
                    ?: Category(id = "cat_debt_repayment", name = "Debt Repayment", color = "#6366f1", icon = "fa-handshake", type = "expense")
            }

            if (lowerNote.contains("returned by") ||
                lowerNote.contains("settled & returned") ||
                lowerNote.contains("lent returned") ||
                lowerNote.contains("return from") ||
                (lowerNote.contains("returned") && (lowerNote.contains("friend") || lowerNote.contains("lent")))
            ) {
                return categories.firstOrNull { it.name.equals("lent returned", ignoreCase = true) }
                    ?: categories.firstOrNull { it.name.contains("lent returned", ignoreCase = true) }
                    ?: categories.firstOrNull { it.name.contains("returned", ignoreCase = true) }
                    ?: categories.firstOrNull { it.name.contains("lent", ignoreCase = true) }
                    ?: Category(id = "cat_lent_returned", name = "Lent Returned", color = "#10b981", icon = "fa-circle-check", type = "income")
            }

            if (lowerNote.contains("lent to") || lowerNote.contains("lent top-up to") || lowerNote.contains("lend to")) {
                return categories.firstOrNull { it.name.equals("lent money", ignoreCase = true) }
                    ?: categories.firstOrNull { it.name.contains("lent money", ignoreCase = true) }
                    ?: categories.firstOrNull { it.name.contains("lent", ignoreCase = true) && it.type == "expense" }
                    ?: categories.firstOrNull { it.name.contains("lend", ignoreCase = true) }
                    ?: Category(id = "cat_lent_money", name = "Lent Money", color = "#f59e0b", icon = "fa-hand-holding-dollar", type = "expense")
            }

            if (lowerNote.contains("borrowed from") || lowerNote.contains("borrowed top-up from") || lowerNote.contains("borrow from")) {
                return categories.firstOrNull { it.name.equals("borrowed money", ignoreCase = true) }
                    ?: categories.firstOrNull { it.name.contains("borrowed money", ignoreCase = true) }
                    ?: categories.firstOrNull { it.name.contains("borrow", ignoreCase = true) && it.type == "income" }
                    ?: Category(id = "cat_borrowed_money", name = "Borrowed Money", color = "#06b6d4", icon = "fa-hand-holding", type = "income")
            }

            // 3. Keyword heuristic inference
            if (LEND_KEYWORDS.containsMatchIn(note)) {
                categories.firstOrNull {
                    val n = it.name.lowercase()
                    n.contains("lend") || n.contains("lent") || n.contains("borrow") || n.contains("debt")
                }?.let { return it }
            }
            if (FOOD_KEYWORDS.containsMatchIn(note)) {
                categories.firstOrNull { it.name.equals("food", ignoreCase = true) || it.name.equals("groceries", ignoreCase = true) }?.let { return it }
            }
            if (TRAVEL_KEYWORDS.containsMatchIn(note)) {
                categories.firstOrNull { it.name.equals("travel", ignoreCase = true) }?.let { return it }
            }
            if (ENTERTAINMENT_KEYWORDS.containsMatchIn(note)) {
                categories.firstOrNull { it.name.equals("entertainment", ignoreCase = true) }?.let { return it }
            }
        }

        return null
    }
}
