package com.example.kharch.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.automirrored.rounded.TrendingDown
import androidx.compose.material.icons.automirrored.rounded.TrendingUp
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.model.AppRoute
import com.example.kharch.ui.components.*
import com.example.kharch.ui.theme.*
import com.example.kharch.ui.viewmodel.KharchUiState
import com.example.kharch.util.CategoryEngine
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

private data class DueAlertItem(
    val id: String,
    val title: String,
    val subtitle: String,
    val amount: Double,
    val daysDiff: Long,
    val badgeText: String,
    val badgeColor: Color,
    val badgeBg: Color,
    val route: AppRoute
)

@Composable
fun DashboardScreen(
    state: KharchUiState,
    onNavigate: (AppRoute) -> Unit,
    onOpenAuth: () -> Unit
) {
    val kc = LocalKharchColors.current
    val curYM = remember { DateUtils.currentYearMonthPrefix() }
    val today = remember { LocalDate.now() }

    val stats = remember(state.transactions, state.lentRecords, state.borrowedRecords, state.accountsWithBalances) {
        var income = 0.0
        var expense = 0.0
        var monthlyIncome = 0.0
        var monthlyExpense = 0.0
        state.transactions.forEach { t ->
            val isThisMonth = t.date.startsWith(curYM)
            when (t.type) {
                "income" -> {
                    income += t.amount
                    if (isThisMonth) monthlyIncome += t.amount
                }
                "expense" -> {
                    expense += t.amount
                    if (isThisMonth) monthlyExpense += t.amount
                }
            }
        }
        val totalLentPending = state.lentRecords.sumOf { (it.amount - it.returnedAmount).coerceAtLeast(0.0) }
        val totalBorrowedPending = state.borrowedRecords.sumOf { (it.amount - it.returnedAmount).coerceAtLeast(0.0) }
        val accountsTotal = if (state.accountsWithBalances.isNotEmpty()) state.accountsWithBalances.sumOf { it.balance } else (income - expense)
        val balance = income - expense
        val netWorth = accountsTotal + totalLentPending - totalBorrowedPending
        arrayOf(balance, income, expense, monthlyIncome, monthlyExpense, netWorth, totalLentPending, totalBorrowedPending)
    }

    val totalBalance = stats[0]
    val allIncome = stats[1]
    val allExpense = stats[2]
    val monthlyIncome = stats[3]
    val monthlyExpense = stats[4]
    val netWorth = stats[5]
    val pendingLent = stats[6]
    val pendingDebt = stats[7]

    val spendForecast = remember(monthlyExpense) {
        val day = today.dayOfMonth
        val daysInMonth = today.lengthOfMonth()
        if (day <= 0 || monthlyExpense <= 0.0) 0.0 else (monthlyExpense / day) * daysInMonth
    }

    val budgetLimit = state.settings.monthlyBudget
    val hasBudget = budgetLimit > 0.0
    val budgetRatio = if (hasBudget) monthlyExpense / budgetLimit else 0.0
    val velocityRatio = if (monthlyIncome > 0.0) (monthlyExpense / monthlyIncome).coerceIn(0.0, 1.0) else if (monthlyExpense > 0.0) 1.0 else 0.0

    val monthlyByCategory = remember(state.transactions, state.categories) {
        val grouped = mutableMapOf<String, Double>()
        state.transactions.forEach { t ->
            if (t.type == "expense" && t.date.startsWith(curYM)) {
                val cat = CategoryEngine.resolveCategory(t.categoryId, state.categories, t.note)
                val key = cat?.id ?: "name:${cat?.name ?: "General"}"
                grouped[key] = (grouped[key] ?: 0.0) + t.amount
            }
        }
        grouped
    }

    val dueAlerts = remember(state.lentRecords, state.borrowedRecords, state.subscriptions) {
        val alerts = mutableListOf<DueAlertItem>()
        state.lentRecords.forEach { r ->
            val rem = (r.amount - r.returnedAmount).coerceAtLeast(0.0)
            val diff = DateUtils.daysUntil(r.dueDate)
            if (rem > 0.0 && diff != null && diff <= 7L) {
                alerts.add(
                    DueAlertItem(
                        id = "lent_${r.id}",
                        title = r.borrowerName,
                        subtitle = if (diff < 0) "Overdue by ${-diff}d" else if (diff == 0L) "Due Today" else "Collect in ${diff}d",
                        amount = rem,
                        daysDiff = diff,
                        badgeText = "Collect",
                        badgeColor = KharchAmber,
                        badgeBg = KharchAmberSoft,
                        route = AppRoute.LENT
                    )
                )
            }
        }
        state.borrowedRecords.forEach { r ->
            val rem = (r.amount - r.returnedAmount).coerceAtLeast(0.0)
            val diff = DateUtils.daysUntil(r.dueDate)
            if (rem > 0.0 && diff != null && diff <= 7L) {
                alerts.add(
                    DueAlertItem(
                        id = "bor_${r.id}",
                        title = r.lenderName,
                        subtitle = if (diff < 0) "Overdue by ${-diff}d" else if (diff == 0L) "Due Today" else "Pay in ${diff}d",
                        amount = rem,
                        daysDiff = diff,
                        badgeText = "Pay Debt",
                        badgeColor = KharchCyan,
                        badgeBg = KharchCyanSoft,
                        route = AppRoute.BORROWED
                    )
                )
            }
        }
        state.subscriptions.forEach { s ->
            if (!s.active) return@forEach
            val diff = DateUtils.daysUntil(s.nextDueDate)
            if (diff != null && diff <= 7L) {
                alerts.add(
                    DueAlertItem(
                        id = "sub_${s.id}",
                        title = s.name,
                        subtitle = if (diff < 0) "Bill overdue ${-diff}d" else if (diff == 0L) "Bill due today" else "Renews in ${diff}d",
                        amount = s.amount,
                        daysDiff = diff,
                        badgeText = "Bill",
                        badgeColor = KharchPurple,
                        badgeBg = Color(0x1A8B5CF6),
                        route = AppRoute.SUBSCRIPTIONS
                    )
                )
            }
        }
        alerts.sortedBy { it.daysDiff }
    }

    val trendData = remember(state.transactions) {
        val labels = mutableListOf<String>()
        val inc = DoubleArray(7)
        val exp = DoubleArray(7)
        val keys = mutableListOf<String>()
        for (i in 6 downTo 0) {
            val d = today.minusDays(i.toLong())
            keys.add(DateUtils.getLocalDateString(d))
            labels.add(d.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.ENGLISH))
        }
        state.transactions.forEach { t ->
            val idx = keys.indexOf(t.date.take(10))
            if (idx >= 0) {
                if (t.type == "income") inc[idx] += t.amount
                else if (t.type == "expense") exp[idx] += t.amount
            }
        }
        Triple(labels, inc.toList(), exp.toList())
    }

    val categorySlices = remember(state.transactions, state.categories) {
        val map = mutableMapOf<String, Pair<Double, Color>>()
        state.transactions.filter { it.type == "expense" }.forEach { t ->
            val cat = CategoryEngine.resolveCategory(t.categoryId, state.categories, t.note)
            val name = cat?.name ?: "General"
            val col = CategoryEngine.parseHexColor(cat?.color, Color(0xFF71717A))
            val prev = map[name]?.first ?: 0.0
            map[name] = (prev + t.amount) to col
        }
        map.entries.sortedByDescending { it.value.first }.map { DonutSlice(it.key, it.value.first, it.value.second) }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
            .kharchHighFrameRate(LocalTargetRefreshRate.current),
        contentPadding = PaddingValues(top = 8.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Header & Quick Shortcuts
        item(key = "dash_header") {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Dashboard", style = MaterialTheme.typography.headlineLarge, color = kc.textPrimary)
            Text("Financial position, cash flow & debts", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
            Row(
                modifier = Modifier.horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf(
                    Triple("Ledger", Icons.Rounded.Receipt, AppRoute.TRANSACTIONS),
                    Triple("Lent", Icons.Rounded.Payments, AppRoute.LENT),
                    Triple("Debts", Icons.Rounded.Savings, AppRoute.BORROWED),
                    Triple("Analytics", Icons.Rounded.PieChart, AppRoute.ANALYTICS)
                ).forEach { (label, icon, route) ->
                    AssistChip(
                        onClick = { onNavigate(route) },
                        label = { Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold) },
                        leadingIcon = { Icon(icon, contentDescription = null, modifier = Modifier.size(15.dp)) }
                    )
                }
            }
        }
        }

        // Guest Sign-In Banner
        if (state.session == null) {
            item(key = "dash_guest") {
            val bannerBg = if (kc.isDark) KharchDarkElevated else Color(0xFF18181B)
            val bannerBorder = if (kc.isDark) BorderStroke(1.dp, KharchIndigo.copy(alpha = 0.45f)) else null
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = bannerBg,
                border = bannerBorder,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                        Icon(Icons.Rounded.Shield, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text("Guest Mode (Offline)", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Color.White)
                            Text("Sign in to sync and protect your cloud ledger", fontSize = 10.sp, color = Color.White.copy(alpha = 0.78f))
                        }
                    }
                    Spacer(Modifier.width(8.dp))
                    Surface(
                        onClick = onOpenAuth,
                        shape = RoundedCornerShape(10.dp),
                        color = Color.White
                    ) {
                        Text(
                            "Sign In",
                            color = Color(0xFF09090B),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                }
            }
            }
        }

        // 4 KPI Cards (2x2 Grid)
        item(key = "dash_kpi1") {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KpiCard(
                title = "Total Balance",
                value = totalBalance,
                valueColor = if (totalBalance >= 0) kc.textPrimary else KharchRose,
                subtitle = "Net Month: ${CurrencyUtils.formatInr(monthlyIncome - monthlyExpense, state.isPrivacyMode)}",
                icon = Icons.Rounded.AccountBalanceWallet,
                iconTint = kc.textPrimary,
                iconBg = kc.subtleSurface,
                isPrivacyMode = state.isPrivacyMode,
                modifier = Modifier.weight(1f)
            )
            KpiCard(
                title = "Monthly Income",
                value = monthlyIncome,
                valueColor = KharchEmerald,
                subtitle = "All time: ${CurrencyUtils.formatCompactInr(allIncome, state.isPrivacyMode)}",
                icon = Icons.AutoMirrored.Rounded.TrendingUp,
                iconTint = KharchEmerald,
                iconBg = KharchEmeraldSoft,
                isPrivacyMode = state.isPrivacyMode,
                modifier = Modifier.weight(1f)
            )
        }
        }
        item(key = "dash_kpi2") {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            KpiCard(
                title = "Monthly Expense",
                value = monthlyExpense,
                subtitle = if (spendForecast > 0) "Pace: ${CurrencyUtils.formatCompactInr(spendForecast, state.isPrivacyMode)} /mo" else "All time: ${CurrencyUtils.formatCompactInr(allExpense, state.isPrivacyMode)}",
                icon = Icons.AutoMirrored.Rounded.TrendingDown,
                iconTint = KharchRose,
                iconBg = KharchRoseSoft,
                isPrivacyMode = state.isPrivacyMode,
                modifier = Modifier.weight(1f)
            )
            KpiCard(
                title = "Net Liquid Worth",
                value = netWorth,
                subtitle = if (state.isPrivacyMode) "+₹•••• • -₹••••" else "+${CurrencyUtils.formatCompactInr(pendingLent)} Lent • -${CurrencyUtils.formatCompactInr(pendingDebt)} Debt",
                icon = Icons.Rounded.MonetizationOn,
                iconTint = KharchIndigo,
                iconBg = KharchIndigoSoft,
                isPrivacyMode = state.isPrivacyMode,
                modifier = Modifier.weight(1f)
            )
        }
        }

        // Accounts & Wallets Quick Glance
        if (state.accountsWithBalances.isNotEmpty()) {
            item(key = "dash_accounts") {
            KharchCard {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Accounts & Wallets", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                    Text(
                        "Manage & Transfer →",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = KharchIndigo,
                        modifier = Modifier.clickable { onNavigate(AppRoute.ACCOUNTS) }
                    )
                }
                Spacer(Modifier.height(10.dp))
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    state.accountsWithBalances.forEach { acc ->
                        Surface(
                            onClick = { onNavigate(AppRoute.ACCOUNTS) },
                            shape = RoundedCornerShape(14.dp),
                            color = kc.subtleSurface,
                            modifier = Modifier.width(155.dp)
                        ) {
                            Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                CategoryIconBadge(acc.icon, acc.color, size = 30.dp, cornerRadius = 8.dp)
                                Spacer(Modifier.width(8.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(acc.name, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = kc.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(
                                        CurrencyUtils.formatInr(acc.balance, state.isPrivacyMode),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = if (acc.balance >= 0) KharchEmerald else KharchRose,
                                        maxLines = 1
                                    )
                                }
                            }
                        }
                    }
                }
            }
            }
        }

        // Savings Goals Quick Glance
        if (state.savingsGoals.isNotEmpty()) {
            item(key = "dash_goals") {
            KharchCard {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Savings Goals", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                    Text("View All →", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = KharchIndigo, modifier = Modifier.clickable { onNavigate(AppRoute.GOALS) })
                }
                Spacer(Modifier.height(10.dp))
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    state.savingsGoals.take(3).forEach { goal ->
                        val pct = if (goal.targetAmount > 0) (goal.savedAmount / goal.targetAmount).toFloat().coerceIn(0f, 1f) else 0f
                        val barColor = CategoryEngine.parseHexColor(goal.color, KharchEmerald)
                        Column {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(goal.name, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = kc.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                                Spacer(Modifier.width(8.dp))
                                Text("${(pct * 100).toInt()}%", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = barColor)
                            }
                            Spacer(Modifier.height(4.dp))
                            LinearProgressIndicator(
                                progress = { pct },
                                color = barColor,
                                trackColor = kc.subtleSurface,
                                modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(4.dp))
                            )
                            Spacer(Modifier.height(2.dp))
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(CurrencyUtils.formatInr(goal.savedAmount, state.isPrivacyMode), fontSize = 10.sp, color = kc.textMuted)
                                Text("Target: ${CurrencyUtils.formatInr(goal.targetAmount, state.isPrivacyMode)}", fontSize = 10.sp, color = kc.textMuted)
                            }
                        }
                    }
                }
            }
            }
        }

        // Active Trips & Events Quick Glance
        if (state.eventsWithStats.isNotEmpty()) {
            item(key = "dash_events") {
            KharchCard {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Active Trips & Event Budgets", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                    Text("View All →", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = KharchIndigo, modifier = Modifier.clickable { onNavigate(AppRoute.EVENTS) })
                }
                Spacer(Modifier.height(10.dp))
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    state.eventsWithStats.take(3).forEach { ev ->
                        val pct = (ev.percentage / 100.0).toFloat().coerceIn(0f, 1f)
                        val barCol = if (ev.isOverBudget) KharchRose else CategoryEngine.parseHexColor(ev.color, KharchIndigo)
                        Column {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(ev.name, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = kc.textPrimary)
                                    Text("#${ev.tag}", fontSize = 10.sp, color = kc.textMuted)
                                }
                                if (ev.isOverBudget) StatusPill("OVER", KharchRose, KharchRoseSoft)
                                else Text("${ev.percentage.toInt()}%", fontSize = 11.sp, color = kc.textMuted)
                            }
                            Spacer(Modifier.height(4.dp))
                            LinearProgressIndicator(
                                progress = { pct },
                                color = barCol,
                                trackColor = kc.subtleSurface,
                                modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(4.dp))
                            )
                            Spacer(Modifier.height(2.dp))
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Spent: ${CurrencyUtils.formatInr(ev.spent, state.isPrivacyMode)}", fontSize = 10.sp, color = kc.textMuted)
                                Text(if (ev.budget > 0) "Budget: ${CurrencyUtils.formatInr(ev.budget, state.isPrivacyMode)}" else "No limit", fontSize = 10.sp, color = kc.textMuted)
                            }
                        }
                    }
                }
            }
            }
        }

        // Upcoming Bills & Due Dates Attention Center
        if (dueAlerts.isNotEmpty()) {
            item(key = "dash_alerts") {
            KharchCard(borderColor = KharchAmber.copy(alpha = 0.45f)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(Icons.Rounded.NotificationsActive, contentDescription = null, tint = KharchAmber, modifier = Modifier.size(16.dp))
                        Text("Upcoming Bills & Due Dates", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                    }
                    Text("${dueAlerts.size} item(s)", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = KharchAmber)
                }
                Spacer(Modifier.height(10.dp))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    dueAlerts.forEach { a ->
                        Surface(
                            onClick = { onNavigate(a.route) },
                            shape = RoundedCornerShape(12.dp),
                            color = kc.subtleSurface
                        ) {
                            Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                Column(Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Text(a.title, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = kc.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        StatusPill(a.badgeText, a.badgeColor, a.badgeBg)
                                    }
                                    Text(a.subtitle, fontSize = 10.sp, color = if (a.daysDiff < 0) KharchRose else kc.textMuted)
                                }
                                Text(CurrencyUtils.formatInr(a.amount, state.isPrivacyMode), fontWeight = FontWeight.Bold, fontSize = 12.sp, color = kc.textPrimary)
                            }
                        }
                    }
                }
            }
            }
        }

        // Global Monthly Budget + Category Envelope Bars
        item(key = "dash_budget") {
        KharchCard {
            if (hasBudget && budgetRatio >= 0.9) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = if (budgetRatio >= 1.0) KharchRoseSoft else KharchAmberSoft,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp)
                ) {
                    Text(
                        text = if (budgetRatio >= 1.0) {
                            "Over budget by ${CurrencyUtils.formatInr(monthlyExpense - budgetLimit, state.isPrivacyMode)}!"
                        } else {
                            "Approaching budget limit — ${(budgetRatio * 100).toInt()}% used."
                        },
                        color = if (budgetRatio >= 1.0) KharchRose else KharchAmber,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(10.dp)
                    )
                }
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(if (hasBudget) "Global Monthly Budget" else "Monthly Spending Velocity", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                if (hasBudget) {
                    Text(
                        "${CurrencyUtils.formatInr(monthlyExpense, state.isPrivacyMode)} / ${CurrencyUtils.formatInr(budgetLimit, state.isPrivacyMode)}",
                        fontSize = 11.sp,
                        color = kc.textMuted
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            val pct = if (hasBudget) budgetRatio.toFloat().coerceIn(0f, 1f) else velocityRatio.toFloat()
            val barCol = when {
                pct < 0.75f -> KharchEmerald
                pct < 0.90f -> KharchAmber
                else -> KharchRose
            }
            LinearProgressIndicator(
                progress = { pct },
                color = barCol,
                trackColor = kc.subtleSurface,
                modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(6.dp))
            )
            Spacer(Modifier.height(6.dp))
            Text(
                text = if (hasBudget) "${(budgetRatio * 100).toInt()}% of monthly budget used" else "${(velocityRatio * 100).toInt()}% of monthly income spent",
                style = MaterialTheme.typography.bodySmall,
                color = kc.textMuted
            )

            val budgetCats = state.categories.filter { it.budgetLimit > 0.0 }
            if (budgetCats.isNotEmpty()) {
                Spacer(Modifier.height(14.dp))
                HorizontalDivider(color = kc.cardBorder)
                Spacer(Modifier.height(12.dp))
                Text("CATEGORY BUDGETS", style = MaterialTheme.typography.labelSmall, color = kc.textMuted)
                Spacer(Modifier.height(10.dp))
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    budgetCats.forEach { c ->
                        val spent = monthlyByCategory[c.id] ?: monthlyByCategory["name:${c.name}"] ?: 0.0
                        val cPct = (spent / c.budgetLimit).toFloat().coerceIn(0f, 1f)
                        val cCol = when {
                            cPct < 0.75f -> KharchEmerald
                            cPct < 0.90f -> KharchAmber
                            else -> KharchRose
                        }
                        Column {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(c.name, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = kc.textPrimary)
                                Text("${CurrencyUtils.formatInr(spent, state.isPrivacyMode)} / ${CurrencyUtils.formatInr(c.budgetLimit, state.isPrivacyMode)}", fontSize = 10.sp, color = kc.textMuted)
                            }
                            Spacer(Modifier.height(4.dp))
                            LinearProgressIndicator(
                                progress = { cPct },
                                color = cCol,
                                trackColor = kc.subtleSurface,
                                modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(4.dp))
                            )
                        }
                    }
                }
            }
        }
        }

        // Weekly Cash Flow Line Chart
        item(key = "dash_cashflow") {
        KharchCard {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Weekly Cash Flow Trend", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                Text("Past 7 Days", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
            }
            Spacer(Modifier.height(10.dp))
            WeeklyCashFlowLineChart(
                labels = trendData.first,
                incomeData = trendData.second,
                expenseData = trendData.third,
                isPrivacyMode = state.isPrivacyMode
            )
        }
        }

        // Expenses by Category Donut Chart
        item(key = "dash_donut") {
        KharchCard {
            Text("Expenses by Category", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
            Spacer(Modifier.height(12.dp))
            CategoryDonutChart(
                slices = categorySlices,
                centerLabel = "Total Spent",
                centerValue = CurrencyUtils.formatCompactInr(allExpense, state.isPrivacyMode)
            )
        }
        }

        // Recent Transactions (5 most recent)
        item(key = "dash_recent") {
        KharchCard {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Recent Transactions", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { onNavigate(AppRoute.TRANSACTIONS) }) {
                    Text("View All", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = KharchIndigo)
                    Icon(Icons.AutoMirrored.Rounded.ArrowForward, contentDescription = null, tint = KharchIndigo, modifier = Modifier.size(14.dp))
                }
            }
            Spacer(Modifier.height(10.dp))
            if (state.transactions.isEmpty()) {
                Text("No transactions logged yet. Tap + to add one!", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    state.transactions.take(5).forEach { tx ->
                        val cat = CategoryEngine.resolveCategory(tx.categoryId, state.categories, tx.note)
                        Surface(
                            onClick = { onNavigate(AppRoute.TRANSACTIONS) },
                            shape = RoundedCornerShape(12.dp),
                            color = kc.subtleSurface
                        ) {
                            Row(Modifier.fillMaxWidth().padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                CategoryIconBadge(cat?.icon ?: "fa-receipt", cat?.color, size = 34.dp)
                                Spacer(Modifier.width(10.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        text = tx.note.ifBlank { cat?.name ?: tx.type.replaceFirstChar { it.uppercase() } },
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        color = kc.textPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = "${cat?.name ?: tx.type} • ${DateUtils.formatDisplayDate(tx.date, short = true)}",
                                        fontSize = 10.sp,
                                        color = kc.textMuted
                                    )
                                }
                                val prefix = if (tx.type == "income") "+" else if (tx.type == "expense") "-" else ""
                                val amtColor = when (tx.type) {
                                    "income" -> KharchEmerald
                                    "expense" -> KharchRose
                                    else -> KharchIndigo
                                }
                                Text(
                                    text = "$prefix${CurrencyUtils.formatInr(tx.amount, state.isPrivacyMode)}",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = amtColor
                                )
                            }
                        }
                    }
                }
            }
        }
        }
    }
}
