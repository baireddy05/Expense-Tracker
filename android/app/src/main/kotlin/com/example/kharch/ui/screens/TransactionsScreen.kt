package com.example.kharch.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.model.Category
import com.example.kharch.model.Transaction
import com.example.kharch.ui.components.*
import com.example.kharch.ui.theme.*
import com.example.kharch.ui.viewmodel.KharchUiState
import com.example.kharch.util.CategoryEngine
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils
import com.example.kharch.util.ShareAndPdfUtils
import java.time.DayOfWeek
import java.time.LocalDate

private data class DateGroup(
    val dateKey: String,
    val items: List<Transaction>,
    val totalIncome: Double,
    val totalExpense: Double
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionsScreen(
    state: KharchUiState,
    onSaveTransaction: (Transaction, () -> Unit) -> Unit,
    onDeleteTransaction: (String) -> Unit,
    onCreateCategory: suspend (String, String) -> Category?,
    onClearSearchPrefill: () -> Unit,
    onToast: (String, Boolean) -> Unit
) {
    val kc = LocalKharchColors.current
    val context = LocalContext.current

    var search by remember { mutableStateOf(state.txSearchPrefill) }
    LaunchedEffect(state.txSearchPrefill) {
        if (state.txSearchPrefill.isNotBlank()) {
            search = state.txSearchPrefill
            onClearSearchPrefill()
        }
    }

    var filterType by remember { mutableStateOf("all") } // all | expense | income | transfer
    var categoryFilter by remember { mutableStateOf("all") }
    var timeFilter by remember { mutableStateOf("all") } // all | today | yesterday | week | month | year | custom
    var customDate by remember { mutableStateOf(DateUtils.getLocalDateString()) }
    var expandedDates by remember { mutableStateOf<Map<String, Boolean>>(emptyMap()) }
    var expandAllState by remember { mutableStateOf(true) }

    var isFormOpen by remember { mutableStateOf(false) }
    var editingTx by remember { mutableStateOf<Transaction?>(null) }
    var formDefaultType by remember { mutableStateOf("expense") }
    var formDefaultDate by remember { mutableStateOf<String?>(null) }
    var deleteTargetId by remember { mutableStateOf<String?>(null) }
    var pdfConfirmOpen by remember { mutableStateOf(false) }

    val filteredTransactions = remember(state.transactions, state.categories, search, filterType, categoryFilter, timeFilter, customDate) {
        val q = search.trim().lowercase()
        val today = LocalDate.now()
        val yesterday = today.minusDays(1)
        val startOfWeek = today.with(DayOfWeek.MONDAY)

        state.transactions.filter { t ->
            val cat = CategoryEngine.resolveCategory(t.categoryId, state.categories, t.note)
            if (q.isNotBlank()) {
                val tagQ = q.removePrefix("#")
                val match = t.note.lowercase().contains(q) ||
                    (cat?.name?.lowercase()?.contains(q) == true) ||
                    t.tags.any { it.lowercase().contains(tagQ) } ||
                    (t.eventTag?.lowercase()?.contains(tagQ) == true)
                if (!match) return@filter false
            }
            if (filterType != "all" && t.type != filterType) return@filter false
            if (categoryFilter != "all" && t.categoryId != categoryFilter && cat?.id != categoryFilter) return@filter false

            if (timeFilter != "all") {
                val txDate = DateUtils.parseLocalDate(t.date) ?: return@filter false
                when (timeFilter) {
                    "today" -> if (txDate != today) return@filter false
                    "yesterday" -> if (txDate != yesterday) return@filter false
                    "week" -> if (txDate.isBefore(startOfWeek) || txDate.isAfter(today)) return@filter false
                    "month" -> if (txDate.month != today.month || txDate.year != today.year) return@filter false
                    "year" -> if (txDate.year != today.year) return@filter false
                    "custom" -> if (t.date.take(10) != customDate) return@filter false
                }
            }
            true
        }.sortedWith(compareByDescending<Transaction> { it.date }.thenByDescending { it.createdAt })
    }

    val summary = remember(filteredTransactions) {
        var inc = 0.0
        var exp = 0.0
        filteredTransactions.forEach { t ->
            if (t.type == "income") inc += t.amount
            else if (t.type == "expense") exp += t.amount
        }
        Triple(inc, exp, inc - exp)
    }

    val dateGroups = remember(filteredTransactions) {
        filteredTransactions.groupBy { it.date.take(10).ifBlank { "Unknown Date" } }
            .entries
            .sortedByDescending { it.key }
            .map { (key, list) ->
                DateGroup(
                    dateKey = key,
                    items = list,
                    totalIncome = list.filter { it.type == "income" }.sumOf { it.amount },
                    totalExpense = list.filter { it.type == "expense" }.sumOf { it.amount }
                )
            }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Transactions", style = MaterialTheme.typography.headlineLarge, color = kc.textPrimary)
                    Text("${filteredTransactions.size} item(s) matching filters", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(
                        onClick = {
                            if (filteredTransactions.isEmpty()) onToast("No transactions to export", true)
                            else pdfConfirmOpen = true
                        }
                    ) {
                        Icon(Icons.Rounded.PictureAsPdf, contentDescription = "Export PDF", tint = KharchRose)
                    }
                    Button(
                        onClick = {
                            editingTx = null
                            formDefaultType = "expense"
                            formDefaultDate = null
                            isFormOpen = true
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Add", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Search
        item {
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                placeholder = { Text("Search note, category, #tag...", fontSize = 12.sp) },
                leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null, modifier = Modifier.size(18.dp)) },
                trailingIcon = {
                    if (search.isNotEmpty()) {
                        IconButton(onClick = { search = "" }) { Icon(Icons.Rounded.Close, contentDescription = "Clear", modifier = Modifier.size(16.dp)) }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )
        }

        // Type + Time Filters
        item {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("all" to "All", "expense" to "Expenses", "income" to "Income", "transfer" to "Transfers").forEach { (k, lbl) ->
                        FilterChip(selected = filterType == k, onClick = { filterType = k }, label = { Text(lbl, fontSize = 11.sp) })
                    }
                }
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("all" to "All Time", "today" to "Today", "yesterday" to "Yesterday", "week" to "Week", "month" to "Month", "year" to "Year", "custom" to "Custom").forEach { (k, lbl) ->
                        FilterChip(selected = timeFilter == k, onClick = { timeFilter = k }, label = { Text(lbl, fontSize = 11.sp) })
                    }
                }
                if (timeFilter == "custom") {
                    DatePickerField("Pick Custom Date", customDate, { customDate = it })
                }

                // Category dropdown filter
                var showCatFilter by remember { mutableStateOf(false) }
                Box {
                    val activeCatName = state.categories.firstOrNull { it.id == categoryFilter }?.name ?: "All Categories"
                    OutlinedButton(onClick = { showCatFilter = true }, shape = RoundedCornerShape(10.dp), contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)) {
                        Icon(Icons.Rounded.FilterList, contentDescription = null, modifier = Modifier.size(15.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(activeCatName, fontSize = 11.sp)
                    }
                    DropdownMenu(expanded = showCatFilter, onDismissRequest = { showCatFilter = false }) {
                        DropdownMenuItem(text = { Text("All Categories") }, onClick = { categoryFilter = "all"; showCatFilter = false })
                        state.categories.forEach { c ->
                            DropdownMenuItem(
                                text = { Text("${c.name} (${c.type})") },
                                onClick = { categoryFilter = c.id; showCatFilter = false }
                            )
                        }
                    }
                }
            }
        }

        // Summary Strip
        item {
            KharchCard(contentPadding = 12.dp) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("INCOME", fontSize = 10.sp, color = kc.textMuted, fontWeight = FontWeight.SemiBold)
                        Text(CurrencyUtils.formatInr(summary.first, state.isPrivacyMode), fontSize = 13.sp, fontWeight = FontWeight.Bold, color = KharchEmerald)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("EXPENSE", fontSize = 10.sp, color = kc.textMuted, fontWeight = FontWeight.SemiBold)
                        Text(CurrencyUtils.formatInr(summary.second, state.isPrivacyMode), fontSize = 13.sp, fontWeight = FontWeight.Bold, color = KharchRose)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("NET FLOW", fontSize = 10.sp, color = kc.textMuted, fontWeight = FontWeight.SemiBold)
                        Text(
                            CurrencyUtils.formatInr(summary.third, state.isPrivacyMode),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (summary.third >= 0) KharchEmerald else KharchRose
                        )
                    }
                }
            }
        }

        if (dateGroups.isNotEmpty()) {
            item {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("${dateGroups.size} day(s) • Swipe right=Edit, left=Delete", fontSize = 11.sp, color = kc.textMuted)
                    TextButton(onClick = {
                        val next = !expandAllState
                        expandAllState = next
                        expandedDates = dateGroups.associate { it.dateKey to next }
                    }) {
                        Text(if (expandAllState) "Collapse All" else "Expand All", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = KharchIndigo)
                    }
                }
            }
        }

        if (dateGroups.isEmpty()) {
            item {
                KharchCard {
                    Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No transactions found", fontWeight = FontWeight.Bold, color = kc.textPrimary)
                        Spacer(Modifier.height(4.dp))
                        Text("Tap Add to log an expense or income", fontSize = 12.sp, color = kc.textMuted)
                    }
                }
            }
        } else {
            items(dateGroups, key = { it.dateKey }) { group ->
                val isExpanded = expandedDates[group.dateKey] ?: expandAllState
                val chevronRot by animateFloatAsState(targetValue = if (isExpanded) 180f else 0f, label = "group_chev")
                KharchCard(contentPadding = 12.dp) {
                    // Date Header Row
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { expandedDates = expandedDates + (group.dateKey to !isExpanded) },
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(DateUtils.formatDateGroupHeader(group.dateKey), fontWeight = FontWeight.Bold, fontSize = 13.sp, color = kc.textPrimary)
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                if (group.totalIncome > 0) Text("+${CurrencyUtils.formatCompactInr(group.totalIncome, state.isPrivacyMode)}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = KharchEmerald)
                                if (group.totalExpense > 0) Text("-${CurrencyUtils.formatCompactInr(group.totalExpense, state.isPrivacyMode)}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = KharchRose)
                                Text("${group.items.size} tx", fontSize = 10.sp, color = kc.textMuted)
                            }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(
                                onClick = {
                                    editingTx = null
                                    formDefaultType = "expense"
                                    formDefaultDate = group.dateKey.takeIf { it != "Unknown Date" }
                                    isFormOpen = true
                                },
                                modifier = Modifier.size(30.dp)
                            ) {
                                Icon(Icons.Rounded.AddCircleOutline, contentDescription = "Add for date", tint = KharchIndigo, modifier = Modifier.size(18.dp))
                            }
                            Icon(
                                Icons.Rounded.ExpandMore,
                                contentDescription = if (isExpanded) "Collapse" else "Expand",
                                tint = kc.textMuted,
                                modifier = Modifier.rotate(chevronRot)
                            )
                        }
                    }

                    AnimatedVisibility(
                        visible = isExpanded,
                        enter = fadeIn() + expandVertically(),
                        exit = fadeOut() + shrinkVertically()
                    ) {
                        Column {
                            Spacer(Modifier.height(8.dp))
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                group.items.forEach { tx ->
                                    val cat = CategoryEngine.resolveCategory(tx.categoryId, state.categories, tx.note)
                                    val dismissState = rememberSwipeToDismissBoxState()
                                    LaunchedEffect(dismissState.currentValue) {
                                        when (dismissState.currentValue) {
                                            SwipeToDismissBoxValue.StartToEnd -> {
                                                editingTx = tx
                                                isFormOpen = true
                                                dismissState.reset()
                                            }
                                            SwipeToDismissBoxValue.EndToStart -> {
                                                deleteTargetId = tx.id
                                                dismissState.reset()
                                            }
                                            SwipeToDismissBoxValue.Settled -> Unit
                                        }
                                    }

                                    SwipeToDismissBox(
                                        state = dismissState,
                                        backgroundContent = {
                                            val isRight = dismissState.dismissDirection == SwipeToDismissBoxValue.StartToEnd
                                            Box(
                                                modifier = Modifier
                                                    .fillMaxSize()
                                                    .clip(RoundedCornerShape(12.dp))
                                                    .background(if (isRight) KharchIndigo else KharchRose)
                                                    .padding(horizontal = 16.dp),
                                                contentAlignment = if (isRight) Alignment.CenterStart else Alignment.CenterEnd
                                            ) {
                                                Icon(
                                                    imageVector = if (isRight) Icons.Rounded.Edit else Icons.Rounded.Delete,
                                                    contentDescription = null,
                                                    tint = Color.White
                                                )
                                            }
                                        }
                                    ) {
                                    Surface(
                                        onClick = {
                                            editingTx = tx
                                            isFormOpen = true
                                        },
                                        shape = RoundedCornerShape(12.dp),
                                        color = kc.subtleSurface,
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(10.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
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
                                                val accName = state.accounts.firstOrNull { it.id == (tx.accountId ?: tx.fromAccountId) }?.name
                                                val sub = buildString {
                                                    append(cat?.name ?: if (tx.type == "transfer") "Transfer" else tx.type)
                                                    if (!accName.isNullOrBlank()) append(" • $accName")
                                                    if (!tx.eventTag.isNullOrBlank()) append(" #${tx.eventTag}")
                                                }
                                                Text(sub, fontSize = 10.sp, color = kc.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                            }
                                            Column(horizontalAlignment = Alignment.End) {
                                                val prefix = if (tx.type == "income") "+" else if (tx.type == "expense") "-" else ""
                                                val amtCol = when (tx.type) {
                                                    "income" -> KharchEmerald
                                                    "expense" -> KharchRose
                                                    else -> KharchIndigo
                                                }
                                                Text(
                                                    text = "$prefix${CurrencyUtils.formatInr(tx.amount, state.isPrivacyMode)}",
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 12.sp,
                                                    color = amtCol
                                                )
                                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                    Icon(
                                                        Icons.Rounded.Edit,
                                                        contentDescription = "Edit",
                                                        tint = kc.textMuted,
                                                        modifier = Modifier.size(15.dp).clickable { editingTx = tx; isFormOpen = true }
                                                    )
                                                    Icon(
                                                        Icons.Rounded.DeleteOutline,
                                                        contentDescription = "Delete",
                                                        tint = KharchRose,
                                                        modifier = Modifier.size(15.dp).clickable { deleteTargetId = tx.id }
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
        }
    }

    TransactionFormSheet(
        isOpen = isFormOpen,
        initialData = editingTx,
        defaultType = formDefaultType,
        defaultDate = formDefaultDate,
        categories = state.categories,
        accounts = state.accountsWithBalances,
        events = state.eventsWithStats,
        recentTransactions = state.transactions,
        isPrivacyMode = state.isPrivacyMode,
        onDismiss = { isFormOpen = false; editingTx = null },
        onSave = onSaveTransaction,
        onCreateCategory = onCreateCategory
    )

    ConfirmActionDialog(
        isOpen = deleteTargetId != null,
        title = "Delete Transaction",
        message = "Are you sure you want to delete this transaction? This cannot be undone.",
        confirmText = "Delete",
        isDanger = true,
        onDismiss = { deleteTargetId = null },
        onConfirm = { deleteTargetId?.let { onDeleteTransaction(it) } }
    )

    ConfirmActionDialog(
        isOpen = pdfConfirmOpen,
        title = "Export Transactions PDF",
        message = "Generate and share a formatted PDF report for ${filteredTransactions.size} transaction(s)?",
        confirmText = "Export PDF",
        isDanger = false,
        onDismiss = { pdfConfirmOpen = false },
        onConfirm = {
            runCatching {
                val file = ShareAndPdfUtils.exportTransactionsPdf(
                    context = context,
                    transactions = filteredTransactions,
                    categories = state.categories,
                    accounts = state.accounts,
                    filterSummary = "Type: ${filterType.uppercase()} | Time: ${timeFilter.uppercase()}"
                )
                ShareAndPdfUtils.shareFile(context, file, "application/pdf", "Share Transactions PDF")
            }.onFailure {
                onToast("Failed to export PDF: ${it.message}", true)
            }
        }
    )
}
