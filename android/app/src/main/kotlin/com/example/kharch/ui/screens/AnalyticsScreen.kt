package com.example.kharch.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
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
import com.example.kharch.ui.components.*
import com.example.kharch.ui.theme.*
import com.example.kharch.ui.viewmodel.KharchUiState
import com.example.kharch.util.CategoryEngine
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.abs

@Composable
fun AnalyticsScreen(state: KharchUiState) {
    val kc = LocalKharchColors.current
    var activeTab by remember { mutableStateOf("overview") } // overview | comparison
    var comparisonPreset by remember { mutableStateOf("month") } // month | quarter | year | custom

    val today = remember { LocalDate.now() }
    var startA by remember { mutableStateOf(DateUtils.getLocalDateString(today.withDayOfMonth(1))) }
    var endA by remember { mutableStateOf(DateUtils.getLocalDateString(today)) }
    var startB by remember { mutableStateOf(DateUtils.getLocalDateString(today.minusMonths(1).withDayOfMonth(1))) }
    var endB by remember { mutableStateOf(DateUtils.getLocalDateString(today.minusMonths(1).withDayOfMonth(today.minusMonths(1).lengthOfMonth()))) }

    // Overview stats
    val overviewStats = remember(state.transactions, state.lentRecords, state.borrowedRecords) {
        val inc = state.transactions.filter { it.type == "income" }.sumOf { it.amount }
        val exp = state.transactions.filter { it.type == "expense" }.sumOf { it.amount }
        val lentPending = state.lentRecords.sumOf { (it.amount - it.returnedAmount).coerceAtLeast(0.0) }
        val debtPending = state.borrowedRecords.sumOf { (it.amount - it.returnedAmount).coerceAtLeast(0.0) }
        val rate = if (inc > 0.0) ((inc - exp) / inc) * 100.0 else 0.0
        arrayOf(inc, exp, inc - exp, rate, lentPending, debtPending)
    }

    val categoryBreakdown = remember(state.transactions, state.categories, overviewStats) {
        val totalExp = overviewStats[1]
        val map = mutableMapOf<String, Triple<String, Color, Double>>()
        state.transactions.filter { it.type == "expense" }.forEach { t ->
            val cat = CategoryEngine.resolveCategory(t.categoryId, state.categories, t.note)
            val key = cat?.id ?: cat?.name ?: "general"
            val name = cat?.name ?: "General"
            val col = CategoryEngine.parseHexColor(cat?.color, Color(0xFF71717A))
            val prev = map[key]?.third ?: 0.0
            map[key] = Triple(name, col, prev + t.amount)
        }
        map.values.sortedByDescending { it.third }.map { (name, col, amt) ->
            val share = if (totalExp > 0.0) (amt / totalExp) * 100.0 else 0.0
            Triple(DonutSlice(name, amt, col), share, amt)
        }
    }

    // Period Comparison calculations
    val comparison = remember(comparisonPreset, startA, endA, startB, endB, state.transactions, state.categories) {
        val bounds = when (comparisonPreset) {
            "quarter" -> {
                val q = (today.monthValue - 1) / 3
                val aS = LocalDate.of(today.year, q * 3 + 1, 1)
                val aE = aS.plusMonths(3).minusDays(1)
                val bS = aS.minusMonths(3)
                val bE = aS.minusDays(1)
                PeriodBounds(aS, aE, "Q${q + 1} ${today.year}", bS, bE, "Prev Quarter")
            }
            "year" -> {
                val aS = LocalDate.of(today.year, 1, 1)
                val aE = LocalDate.of(today.year, 12, 31)
                val bS = LocalDate.of(today.year - 1, 1, 1)
                val bE = LocalDate.of(today.year - 1, 12, 31)
                PeriodBounds(aS, aE, "${today.year}", bS, bE, "${today.year - 1}")
            }
            "custom" -> {
                val aS = DateUtils.parseLocalDate(startA) ?: today.withDayOfMonth(1)
                val aE = DateUtils.parseLocalDate(endA) ?: today
                val bS = DateUtils.parseLocalDate(startB) ?: today.minusMonths(1).withDayOfMonth(1)
                val bE = DateUtils.parseLocalDate(endB) ?: today.minusMonths(1)
                PeriodBounds(aS, aE, "Period A", bS, bE, "Period B")
            }
            else -> {
                val aS = today.withDayOfMonth(1)
                val aE = aS.plusMonths(1).minusDays(1)
                val bS = aS.minusMonths(1)
                val bE = aS.minusDays(1)
                PeriodBounds(aS, aE, "This Month", bS, bE, "Last Month")
            }
        }
        val aStart = bounds.aStart
        val aEnd = bounds.aEnd
        val pALabel = bounds.aLabel
        val bStart = bounds.bStart
        val bEnd = bounds.bEnd
        val pBLabel = bounds.bLabel

        val rangeError = if (comparisonPreset == "custom" && (aStart.isAfter(aEnd) || bStart.isAfter(bEnd))) {
            "Start date must be on or before end date for each period."
        } else null

        val aStartStr = DateUtils.getLocalDateString(aStart)
        val aEndStr = DateUtils.getLocalDateString(aEnd)
        val bStartStr = DateUtils.getLocalDateString(bStart)
        val bEndStr = DateUtils.getLocalDateString(bEnd)

        var incA = 0.0; var expA = 0.0
        var incB = 0.0; var expB = 0.0
        val catA = mutableMapOf<String, Double>()
        val catB = mutableMapOf<String, Double>()

        state.transactions.forEach { t ->
            val d = t.date.take(10)
            if (d in aStartStr..aEndStr) {
                if (t.type == "income") incA += t.amount
                else if (t.type == "expense") {
                    expA += t.amount
                    val c = CategoryEngine.resolveCategory(t.categoryId, state.categories, t.note)?.name ?: "General"
                    catA[c] = (catA[c] ?: 0.0) + t.amount
                }
            }
            if (d in bStartStr..bEndStr) {
                if (t.type == "income") incB += t.amount
                else if (t.type == "expense") {
                    expB += t.amount
                    val c = CategoryEngine.resolveCategory(t.categoryId, state.categories, t.note)?.name ?: "General"
                    catB[c] = (catB[c] ?: 0.0) + t.amount
                }
            }
        }

        val daysA = ChronoUnit.DAYS.between(aStart, aEnd).coerceAtLeast(0) + 1
        val daysB = ChronoUnit.DAYS.between(bStart, bEnd).coerceAtLeast(0) + 1
        val allCats = (catA.keys + catB.keys).distinct().map { name ->
            val a = catA[name] ?: 0.0
            val b = catB[name] ?: 0.0
            val diff = a - b
            val pct = if (b > 0.0) (diff / b) * 100.0 else if (a > 0.0) 100.0 else 0.0
            Triple(name, a to b, diff to pct)
        }.sortedByDescending { abs(it.third.first) }

        ComparisonSummary(
            labelA = pALabel,
            labelB = pBLabel,
            rangeError = rangeError,
            incA = incA, expA = expA, savA = incA - expA, dailyA = expA / daysA,
            incB = incB, expB = expB, savB = incB - expB, dailyB = expB / daysB,
            categoryShifts = allCats
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
            .kharchHighFrameRate(LocalTargetRefreshRate.current),
        contentPadding = PaddingValues(top = 8.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item(key = "ana_header") {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    if (activeTab == "overview") "Financial Analytics" else "Period Comparison",
                    style = MaterialTheme.typography.headlineLarge,
                    color = kc.textPrimary
                )

                // Tab Switcher
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(kc.subtleSurface)
                        .padding(4.dp)
                ) {
                    listOf("overview" to "Overview", "comparison" to "Period Comparison").forEach { (k, lbl) ->
                        val sel = activeTab == k
                        Surface(
                            onClick = { activeTab = k },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            color = if (sel) kc.primaryButtonBg else Color.Transparent
                        ) {
                            Box(Modifier.padding(vertical = 9.dp), contentAlignment = Alignment.Center) {
                                Text(lbl, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (sel) kc.primaryButtonFg else kc.textMuted)
                            }
                        }
                    }
                }
            }
        }

        if (activeTab == "overview") {
            item(key = "ov_kpi1") {
            Row(Modifier.fillMaxWidth().animateItem(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiCard("Total Income", overviewStats[0], "All time logged", Icons.AutoMirrored.Rounded.TrendingUp, KharchEmerald, KharchEmeraldSoft, state.isPrivacyMode, Modifier.weight(1f), KharchEmerald)
                KpiCard("Total Expense", overviewStats[1], "All time spent", Icons.AutoMirrored.Rounded.TrendingDown, KharchRose, KharchRoseSoft, state.isPrivacyMode, Modifier.weight(1f))
            }
            }
            item(key = "ov_kpi2") {
            Row(Modifier.fillMaxWidth().animateItem(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiCard(
                    title = "Savings Rate",
                    value = overviewStats[3],
                    isCurrency = false,
                    suffix = "%",
                    subtitle = "Surplus: ${CurrencyUtils.formatCompactInr(overviewStats[2], state.isPrivacyMode)}",
                    icon = Icons.Rounded.PieChart,
                    iconTint = KharchIndigo,
                    iconBg = KharchIndigoSoft,
                    isPrivacyMode = state.isPrivacyMode,
                    modifier = Modifier.weight(1f)
                )
                KpiCard(
                    title = "Receivable vs Debt",
                    value = overviewStats[4],
                    valueColor = KharchAmber,
                    subtitle = "Debt owed: ${CurrencyUtils.formatCompactInr(overviewStats[5], state.isPrivacyMode)}",
                    icon = Icons.Rounded.Balance,
                    iconTint = KharchAmber,
                    iconBg = KharchAmberSoft,
                    isPrivacyMode = state.isPrivacyMode,
                    modifier = Modifier.weight(1f)
                )
            }
            }

            item(key = "ov_ratio") {
            Box(Modifier.animateItem()) {
            KharchCard {
                Text("Income vs Expense Ratio", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                Spacer(Modifier.height(10.dp))
                CategoryDonutChart(
                    slices = listOf(
                        DonutSlice("Income", overviewStats[0], KharchEmerald),
                        DonutSlice("Expense", overviewStats[1], KharchRose)
                    ),
                    centerLabel = "",
                    centerValue = "",
                    isPie = true
                )
            }
            }
            }

            item(key = "ov_bar") {
            Box(Modifier.animateItem()) {
            KharchCard {
                Text("Expenses by Category", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                Spacer(Modifier.height(10.dp))
                CategoryBarChart(
                    items = categoryBreakdown.map { it.first },
                    isPrivacyMode = state.isPrivacyMode
                )
            }
            }
            }

            if (categoryBreakdown.isNotEmpty()) {
                item(key = "ov_share") {
                Box(Modifier.animateItem()) {
                KharchCard {
                    Text("Category Breakdown Share", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                    Spacer(Modifier.height(10.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        categoryBreakdown.forEach { (slice, share, amt) ->
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                                    Box(Modifier.size(10.dp).clip(RoundedCornerShape(3.dp)).background(slice.color))
                                    Spacer(Modifier.width(8.dp))
                                    Text(slice.label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = kc.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                Text("${"%.1f".format(share)}% • ${CurrencyUtils.formatInr(amt, state.isPrivacyMode)}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = kc.textMuted)
                            }
                        }
                    }
                }
                }
                }
            }
        } else {
            // Comparison Tab
            item(key = "cmp_presets") {
            Row(Modifier.horizontalScroll(rememberScrollState()).animateItem(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("month" to "Month vs Last", "quarter" to "Quarter vs Last", "year" to "Year vs Last", "custom" to "Custom Range").forEach { (k, lbl) ->
                    FilterChip(selected = comparisonPreset == k, onClick = { comparisonPreset = k }, label = { Text(lbl, fontSize = 11.sp) })
                }
            }
            }

            if (comparisonPreset == "custom") {
                item(key = "cmp_custom") {
                Box(Modifier.animateItem()) {
                KharchCard(contentPadding = 12.dp) {
                    Text("Period A (Primary)", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = kc.textPrimary)
                    Spacer(Modifier.height(6.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        DatePickerField("Start A", startA, { startA = it }, modifier = Modifier.weight(1f))
                        DatePickerField("End A", endA, { endA = it }, modifier = Modifier.weight(1f))
                    }
                    Spacer(Modifier.height(10.dp))
                    Text("Period B (Comparison)", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = kc.textPrimary)
                    Spacer(Modifier.height(6.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        DatePickerField("Start B", startB, { startB = it }, modifier = Modifier.weight(1f))
                        DatePickerField("End B", endB, { endB = it }, modifier = Modifier.weight(1f))
                    }
                }
                }
                }
            }

            comparison.rangeError?.let { err ->
                item(key = "cmp_err") {
                Surface(shape = RoundedCornerShape(12.dp), color = KharchAmberSoft, modifier = Modifier.fillMaxWidth().animateItem()) {
                    Text(err, color = KharchAmber, fontSize = 12.sp, modifier = Modifier.padding(10.dp))
                }
                }
            }

            item(key = "cmp_kpis") {
            Column(Modifier.animateItem(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            val expDiff = comparison.expA - comparison.expB
            val expPct = if (comparison.expB > 0) (expDiff / comparison.expB) * 100.0 else if (comparison.expA > 0) 100.0 else 0.0
            val incDiff = comparison.incA - comparison.incB
            val incPct = if (comparison.incB > 0) (incDiff / comparison.incB) * 100.0 else if (comparison.incA > 0) 100.0 else 0.0

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiCard(
                    title = "Spending Change",
                    value = comparison.expA,
                    subtitle = "vs ${CurrencyUtils.formatCompactInr(comparison.expB, state.isPrivacyMode)} (${if (expPct > 0) "+" else ""}${"%.1f".format(expPct)}%)",
                    icon = Icons.AutoMirrored.Rounded.TrendingDown,
                    iconTint = if (expDiff <= 0) KharchEmerald else KharchRose,
                    iconBg = if (expDiff <= 0) KharchEmeraldSoft else KharchRoseSoft,
                    isPrivacyMode = state.isPrivacyMode,
                    modifier = Modifier.weight(1f)
                )
                KpiCard(
                    title = "Income Change",
                    value = comparison.incA,
                    valueColor = KharchEmerald,
                    subtitle = "vs ${CurrencyUtils.formatCompactInr(comparison.incB, state.isPrivacyMode)} (${if (incPct > 0) "+" else ""}${"%.1f".format(incPct)}%)",
                    icon = Icons.AutoMirrored.Rounded.TrendingUp,
                    iconTint = KharchEmerald,
                    iconBg = KharchEmeraldSoft,
                    isPrivacyMode = state.isPrivacyMode,
                    modifier = Modifier.weight(1f)
                )
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiCard("Net Savings", comparison.savA, "vs ${CurrencyUtils.formatCompactInr(comparison.savB, state.isPrivacyMode)}", Icons.Rounded.Savings, KharchIndigo, KharchIndigoSoft, state.isPrivacyMode, Modifier.weight(1f))
                KpiCard("Daily Burn Rate", comparison.dailyA, "vs ${CurrencyUtils.formatCompactInr(comparison.dailyB, state.isPrivacyMode)}/d", Icons.Rounded.Speed, KharchAmber, KharchAmberSoft, state.isPrivacyMode, Modifier.weight(1f), suffix = "/d")
            }
            }
            }

            item(key = "cmp_chart") {
            Box(Modifier.animateItem()) {
            KharchCard {
                Text("Side-by-Side Category Comparison", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                Spacer(Modifier.height(10.dp))
                val top6 = comparison.categoryShifts.take(6)
                PeriodComparisonBarChart(
                    labels = top6.map { it.first },
                    periodAValues = top6.map { it.second.first },
                    periodBValues = top6.map { it.second.second },
                    periodALabel = comparison.labelA,
                    periodBLabel = comparison.labelB,
                    isPrivacyMode = state.isPrivacyMode
                )
            }
            }
            }

            if (comparison.categoryShifts.isNotEmpty()) {
                item(key = "cmp_shifts") {
                Box(Modifier.animateItem()) {
                KharchCard {
                    Text("Per-Category Variance", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                    Spacer(Modifier.height(10.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        comparison.categoryShifts.forEach { (catName, vals, delta) ->
                            val (diff, pct) = delta
                            val saved = diff <= 0.0
                            Surface(shape = RoundedCornerShape(10.dp), color = kc.subtleSurface, modifier = Modifier.fillMaxWidth()) {
                                Row(Modifier.padding(10.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text(catName, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = kc.textPrimary)
                                        Text("${CurrencyUtils.formatInr(vals.first, state.isPrivacyMode)} vs ${CurrencyUtils.formatInr(vals.second, state.isPrivacyMode)}", fontSize = 10.sp, color = kc.textMuted)
                                    }
                                    StatusPill(
                                        text = "${if (saved) "SAVED" else "INCREASED"} ${if (pct > 0) "+" else ""}${"%.0f".format(pct)}%",
                                        textColor = if (saved) KharchEmerald else KharchRose,
                                        bgColor = if (saved) KharchEmeraldSoft else KharchRoseSoft
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
    }
}

private data class PeriodBounds(
    val aStart: LocalDate,
    val aEnd: LocalDate,
    val aLabel: String,
    val bStart: LocalDate,
    val bEnd: LocalDate,
    val bLabel: String
)

private data class ComparisonSummary(
    val labelA: String,
    val labelB: String,
    val rangeError: String?,
    val incA: Double, val expA: Double, val savA: Double, val dailyA: Double,
    val incB: Double, val expB: Double, val savB: Double, val dailyB: Double,
    val categoryShifts: List<Triple<String, Pair<Double, Double>, Pair<Double, Double>>>
)
