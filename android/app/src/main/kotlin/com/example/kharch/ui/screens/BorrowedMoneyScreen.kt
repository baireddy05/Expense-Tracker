package com.example.kharch.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
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
import com.example.kharch.model.BorrowEntry
import com.example.kharch.model.BorrowedRecord
import com.example.kharch.ui.components.*
import com.example.kharch.ui.theme.*
import com.example.kharch.ui.viewmodel.KharchUiState
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils
import com.example.kharch.util.ShareAndPdfUtils
import java.time.LocalDate

private fun borrowStatusOf(r: BorrowedRecord): String {
    val rem = r.amount - r.returnedAmount
    if (rem <= 0.0) return "settled"
    val due = DateUtils.parseLocalDate(r.dueDate)
    if (due != null && due.isBefore(LocalDate.now())) return "overdue"
    return if (r.returnedAmount > 0.0) "partial" else "pending"
}

@Composable
fun BorrowedMoneyScreen(
    state: KharchUiState,
    onSaveBorrowed: (BorrowedRecord, () -> Unit) -> Unit,
    onBorrowMore: (String, Double, String, String?, String, () -> Unit) -> Unit,
    onRecordRepayment: (String, Double, String, String, () -> Unit) -> Unit,
    onSettleBorrowed: (String) -> Unit,
    onDeleteBorrowed: (String) -> Unit,
    onToast: (String, Boolean) -> Unit
) {
    val kc = LocalKharchColors.current
    val context = LocalContext.current

    var search by remember { mutableStateOf("") }
    var statusFilter by remember { mutableStateOf("all") }
    var sortBy by remember { mutableStateOf("date-desc") }
    var expandedHistories by remember { mutableStateOf<Map<String, Boolean>>(emptyMap()) }
    var cardTabs by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var settledExpanded by remember { mutableStateOf(false) }

    var isFormOpen by remember { mutableStateOf(false) }
    var editingRecord by remember { mutableStateOf<BorrowedRecord?>(null) }
    var borrowMoreTarget by remember { mutableStateOf<BorrowedRecord?>(null) }
    var repayTarget by remember { mutableStateOf<BorrowedRecord?>(null) }
    var reminderTarget by remember { mutableStateOf<BorrowedRecord?>(null) }
    var settleTarget by remember { mutableStateOf<BorrowedRecord?>(null) }
    var deleteTarget by remember { mutableStateOf<BorrowedRecord?>(null) }
    var pdfConfirmOpen by remember { mutableStateOf(false) }

    val nameSuggestions = remember(state.borrowedRecords) {
        state.borrowedRecords.map { it.lenderName.trim() }.filter { it.isNotBlank() }.distinct()
    }
    val noteSuggestions = remember(state.borrowedRecords) {
        state.borrowedRecords.mapNotNull { it.note?.trim() }.filter { it.isNotBlank() }.distinct()
    }

    val stats = remember(state.borrowedRecords) {
        val total = state.borrowedRecords.sumOf { it.amount }
        val repaid = state.borrowedRecords.sumOf { it.returnedAmount }
        val pending = (total - repaid).coerceAtLeast(0.0)
        val settled = state.borrowedRecords.count { borrowStatusOf(it) == "settled" }
        val overdue = state.borrowedRecords.count { borrowStatusOf(it) == "overdue" }
        arrayOf(pending, repaid, total, settled.toDouble(), overdue.toDouble())
    }

    val filtered = remember(state.borrowedRecords, search, statusFilter, sortBy) {
        val q = search.trim().lowercase()
        state.borrowedRecords.filter { r ->
            val matchQ = q.isBlank() || r.lenderName.lowercase().contains(q) || (r.note ?: "").lowercase().contains(q)
            val st = borrowStatusOf(r)
            val matchSt = when (statusFilter) {
                "all" -> true
                "active" -> st != "settled"
                else -> st == statusFilter
            }
            matchQ && matchSt
        }.sortedWith { a, b ->
            when (sortBy) {
                "date-asc" -> a.dateBorrowed.compareTo(b.dateBorrowed)
                "amount-desc" -> b.amount.compareTo(a.amount)
                "pending-desc" -> (b.amount - b.returnedAmount).compareTo(a.amount - a.returnedAmount)
                "due-asc" -> (a.dueDate ?: "9999").compareTo(b.dueDate ?: "9999")
                else -> b.dateBorrowed.compareTo(a.dateBorrowed)
            }
        }
    }

    val activeList = remember(filtered) { filtered.filter { borrowStatusOf(it) != "settled" } }
    val settledList = remember(filtered) { filtered.filter { borrowStatusOf(it) == "settled" } }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Borrowed Money", style = MaterialTheme.typography.headlineLarge, color = kc.textPrimary)
                    Text("Track debts owed to friends & repayments", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (state.borrowedRecords.isNotEmpty()) {
                        IconButton(onClick = {
                            if (filtered.isEmpty()) onToast("No records to export", true)
                            else pdfConfirmOpen = true
                        }) {
                            Icon(Icons.Rounded.PictureAsPdf, contentDescription = "Export PDF", tint = KharchRose)
                        }
                    }
                    Button(
                        onClick = { editingRecord = null; isFormOpen = true },
                        colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Borrow", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiCard(
                    title = "Pending Debt",
                    value = stats[0],
                    valueColor = KharchCyan,
                    subtitle = if (stats[4] > 0) "${stats[4].toInt()} overdue" else "All clear",
                    icon = Icons.Rounded.Savings,
                    iconTint = KharchCyan,
                    iconBg = KharchCyanSoft,
                    isPrivacyMode = state.isPrivacyMode,
                    modifier = Modifier.weight(1f)
                )
                KpiCard(
                    title = "Repaid",
                    value = stats[1],
                    valueColor = KharchEmerald,
                    subtitle = "Of ${CurrencyUtils.formatCompactInr(stats[2], state.isPrivacyMode)} (${stats[3].toInt()} settled)",
                    icon = Icons.Rounded.CheckCircle,
                    iconTint = KharchEmerald,
                    iconBg = KharchEmeraldSoft,
                    isPrivacyMode = state.isPrivacyMode,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it },
                    placeholder = { Text("Search lender or note...", fontSize = 12.sp) },
                    leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null, modifier = Modifier.size(18.dp)) },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                )
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("all" to "All", "active" to "Active", "pending" to "Pending", "partial" to "Partial", "overdue" to "Overdue", "settled" to "Settled").forEach { (k, lbl) ->
                        FilterChip(selected = statusFilter == k, onClick = { statusFilter = k }, label = { Text(lbl, fontSize = 11.sp) })
                    }
                }
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("date-desc" to "Newest", "pending-desc" to "Highest Debt", "amount-desc" to "Highest Total", "due-asc" to "Due Soon").forEach { (k, lbl) ->
                        FilterChip(selected = sortBy == k, onClick = { sortBy = k }, label = { Text(lbl, fontSize = 10.sp) })
                    }
                }
            }
        }

        if (activeList.isEmpty() && settledList.isEmpty()) {
            item {
                KharchCard {
                    Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No borrowed records found", fontWeight = FontWeight.Bold, color = kc.textPrimary)
                        Text("Tap Borrow to log money borrowed from someone", fontSize = 12.sp, color = kc.textMuted)
                    }
                }
            }
        }

        items(activeList, key = { it.id }) { record ->
            BorrowedRecordCard(
                record = record,
                isPrivacyMode = state.isPrivacyMode,
                isExpanded = expandedHistories[record.id] == true,
                activeTab = cardTabs[record.id] ?: "all",
                onToggleExpand = { expandedHistories = expandedHistories + (record.id to !(expandedHistories[record.id] == true)) },
                onSelectTab = { tab -> cardTabs = cardTabs + (record.id to tab) },
                onBorrowMore = { borrowMoreTarget = record },
                onRepay = { repayTarget = record },
                onSettle = { settleTarget = record },
                onRemind = { reminderTarget = record },
                onEdit = { editingRecord = record; isFormOpen = true },
                onDelete = { deleteTarget = record }
            )
        }

        if (settledList.isNotEmpty()) {
            item {
                val archiveChev by animateFloatAsState(targetValue = if (settledExpanded) 180f else 0f, label = "bor_arch")
                Surface(
                    onClick = { settledExpanded = !settledExpanded },
                    shape = RoundedCornerShape(14.dp),
                    color = kc.subtleSurface,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Settled Debts Archive (${settledList.size})", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = kc.textPrimary)
                        Icon(Icons.Rounded.ExpandMore, contentDescription = null, modifier = Modifier.rotate(archiveChev))
                    }
                }
            }
            if (settledExpanded) {
                items(settledList, key = { "settled_${it.id}" }) { record ->
                    BorrowedRecordCard(
                        record = record,
                        isPrivacyMode = state.isPrivacyMode,
                        isExpanded = expandedHistories[record.id] == true,
                        activeTab = cardTabs[record.id] ?: "all",
                        onToggleExpand = { expandedHistories = expandedHistories + (record.id to !(expandedHistories[record.id] == true)) },
                        onSelectTab = { tab -> cardTabs = cardTabs + (record.id to tab) },
                        onBorrowMore = { borrowMoreTarget = record },
                        onRepay = { repayTarget = record },
                        onSettle = { settleTarget = record },
                        onRemind = { reminderTarget = record },
                        onEdit = { editingRecord = record; isFormOpen = true },
                        onDelete = { deleteTarget = record }
                    )
                }
            }
        }
    }

    PersonLoanFormSheet(
        isOpen = isFormOpen,
        isLentMode = false,
        initialName = editingRecord?.lenderName ?: "",
        initialAmount = editingRecord?.amount?.toString()?.removeSuffix(".0") ?: "",
        initialDate = editingRecord?.dateBorrowed?.ifBlank { DateUtils.getLocalDateString() } ?: DateUtils.getLocalDateString(),
        initialDueDate = editingRecord?.dueDate ?: "",
        initialPhone = editingRecord?.phone ?: "",
        initialNote = editingRecord?.note ?: "",
        isEditing = editingRecord != null,
        nameSuggestions = nameSuggestions,
        noteSuggestions = noteSuggestions,
        onDismiss = { isFormOpen = false; editingRecord = null },
        onSubmit = { name, amount, date, dueDate, phone, note ->
            val base = editingRecord
            val payload = if (base != null) {
                base.copy(lenderName = name, amount = amount, dateBorrowed = date, dueDate = dueDate, phone = phone, note = note)
            } else {
                BorrowedRecord(lenderName = name, amount = amount, dateBorrowed = date, dueDate = dueDate, phone = phone, note = note)
            }
            onSaveBorrowed(payload) { isFormOpen = false; editingRecord = null }
        }
    )

    borrowMoreTarget?.let { target ->
        TopUpAmountSheet(
            isOpen = true,
            title = "Borrow More Money",
            personName = target.lenderName,
            currentDueDate = target.dueDate ?: "",
            onDismiss = { borrowMoreTarget = null },
            onSubmit = { amt, date, due, note ->
                onBorrowMore(target.id, amt, date, due, note) { borrowMoreTarget = null }
            }
        )
    }

    repayTarget?.let { target ->
        val rem = (target.amount - target.returnedAmount).coerceAtLeast(0.0)
        RepaymentSheet(
            isOpen = true,
            title = "Record Debt Repayment",
            personName = target.lenderName,
            remainingAmount = rem,
            onDismiss = { repayTarget = null },
            onSubmit = { amt, date, note ->
                onRecordRepayment(target.id, amt, date, note) { repayTarget = null }
            }
        )
    }

    reminderTarget?.let { target ->
        val rem = (target.amount - target.returnedAmount).coerceAtLeast(0.0)
        ReminderSheet(
            isOpen = true,
            isLent = false,
            personName = target.lenderName,
            phone = target.phone,
            pendingAmount = rem,
            dateStr = target.dateBorrowed,
            dueDateStr = target.dueDate,
            onCopiedToast = { onToast("Message copied to clipboard", false) },
            onDismiss = { reminderTarget = null }
        )
    }

    ConfirmActionDialog(
        isOpen = settleTarget != null,
        title = "Mark Debt Paid",
        message = "Mark remaining ${CurrencyUtils.formatInr((settleTarget?.let { it.amount - it.returnedAmount } ?: 0.0).coerceAtLeast(0.0))} owed to ${settleTarget?.lenderName} as paid?",
        confirmText = "Mark Paid",
        isDanger = false,
        onDismiss = { settleTarget = null },
        onConfirm = { settleTarget?.let { onSettleBorrowed(it.id) } }
    )

    ConfirmActionDialog(
        isOpen = deleteTarget != null,
        title = "Delete Borrowed Record",
        message = "Delete debt record for ${deleteTarget?.lenderName}?",
        confirmText = "Delete",
        isDanger = true,
        onDismiss = { deleteTarget = null },
        onConfirm = { deleteTarget?.let { onDeleteBorrowed(it.id) } }
    )

    ConfirmActionDialog(
        isOpen = pdfConfirmOpen,
        title = "Export Borrowed Report PDF",
        message = "Generate and share a PDF summary of ${filtered.size} debt record(s)?",
        confirmText = "Export PDF",
        isDanger = false,
        onDismiss = { pdfConfirmOpen = false },
        onConfirm = {
            runCatching {
                val file = ShareAndPdfUtils.exportBorrowedPdf(context, filtered, "Status: ${statusFilter.uppercase()}")
                ShareAndPdfUtils.shareFile(context, file, "application/pdf", "Share Borrowed Money PDF")
            }.onFailure { onToast("PDF export failed: ${it.message}", true) }
        }
    )
}

@Composable
private fun BorrowedRecordCard(
    record: BorrowedRecord,
    isPrivacyMode: Boolean,
    isExpanded: Boolean,
    activeTab: String,
    onToggleExpand: () -> Unit,
    onSelectTab: (String) -> Unit,
    onBorrowMore: () -> Unit,
    onRepay: () -> Unit,
    onSettle: () -> Unit,
    onRemind: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    val kc = LocalKharchColors.current
    val remaining = (record.amount - record.returnedAmount).coerceAtLeast(0.0)
    val pct = if (record.amount > 0) (record.returnedAmount / record.amount).toFloat().coerceIn(0f, 1f) else 0f
    val status = borrowStatusOf(record)
    val borrows = record.borrows.ifEmpty {
        listOf(BorrowEntry(id = "init_${record.id}", amount = record.amount, date = record.dateBorrowed, note = record.note ?: "Initial borrowed money"))
    }

    val (stColor, stBg) = when (status) {
        "settled" -> KharchEmerald to KharchEmeraldSoft
        "overdue" -> KharchRose to KharchRoseSoft
        "partial" -> KharchAmber to KharchAmberSoft
        else -> KharchCyan to KharchCyanSoft
    }

    KharchCard(borderColor = if (status == "overdue") KharchRose.copy(alpha = 0.5f) else null, contentPadding = 14.dp) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(KharchCyan),
                contentAlignment = Alignment.Center
            ) {
                Text((record.lenderName.firstOrNull() ?: 'L').uppercase(), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        record.lenderName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = kc.textPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    StatusPill(status.uppercase(), stColor, stBg)
                }
                val meta = buildString {
                    append(DateUtils.formatDisplayDate(record.dateBorrowed, short = true))
                    if (!record.dueDate.isNullOrBlank()) append(" • Due ${DateUtils.formatDisplayDate(record.dueDate, short = true)}")
                }
                Text(meta, fontSize = 10.sp, color = if (status == "overdue") KharchRose else kc.textMuted)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    if (remaining > 0) CurrencyUtils.formatInr(remaining, isPrivacyMode) else "Paid",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = if (remaining > 0) KharchCyan else KharchEmerald
                )
                Text("of ${CurrencyUtils.formatInr(record.amount, isPrivacyMode)}", fontSize = 10.sp, color = kc.textMuted)
            }
        }

        Spacer(Modifier.height(10.dp))
        LinearProgressIndicator(
            progress = { pct },
            color = if (status == "settled") KharchEmerald else KharchCyan,
            trackColor = kc.subtleSurface,
            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(4.dp))
        )

        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onToggleExpand, contentPadding = PaddingValues(0.dp)) {
            Icon(Icons.Rounded.History, contentDescription = null, modifier = Modifier.size(15.dp))
            Spacer(Modifier.width(4.dp))
            Text(if (isExpanded) "Hide Timeline (${borrows.size} borrows / ${record.repayments.size} paid)" else "Timeline (${borrows.size} borrows / ${record.repayments.size} paid)", fontSize = 11.sp)
        }

        AnimatedVisibility(
            visible = isExpanded,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically()
        ) {
            Column {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("all" to "All", "borrows" to "Borrows (${borrows.size})", "repayments" to "Paid (${record.repayments.size})").forEach { (k, lbl) ->
                    FilterChip(selected = activeTab == k, onClick = { onSelectTab(k) }, label = { Text(lbl, fontSize = 10.sp) })
                }
            }
            Spacer(Modifier.height(6.dp))
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (activeTab == "all" || activeTab == "borrows") {
                    borrows.forEach { b ->
                        Surface(shape = RoundedCornerShape(10.dp), color = KharchCyanSoft, modifier = Modifier.fillMaxWidth()) {
                            Row(Modifier.padding(8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                                Column(Modifier.weight(1f)) {
                                    Text(b.note.ifBlank { "Borrowed" }, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = kc.textPrimary)
                                    Text(DateUtils.formatDisplayDate(b.date, short = true), fontSize = 10.sp, color = kc.textMuted)
                                }
                                Text("Borrowed ${CurrencyUtils.formatInr(b.amount, isPrivacyMode)}", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = KharchCyan)
                            }
                        }
                    }
                }
                if (activeTab == "all" || activeTab == "repayments") {
                    record.repayments.forEach { rep ->
                        Surface(shape = RoundedCornerShape(10.dp), color = KharchEmeraldSoft, modifier = Modifier.fillMaxWidth()) {
                            Row(Modifier.padding(8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                                Column(Modifier.weight(1f)) {
                                    Text(rep.note.ifBlank { "Repayment" }, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = kc.textPrimary)
                                    Text(DateUtils.formatDisplayDate(rep.date, short = true), fontSize = 10.sp, color = kc.textMuted)
                                }
                                Text("Paid ${CurrencyUtils.formatInr(rep.amount, isPrivacyMode)}", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = KharchEmerald)
                            }
                        }
                    }
                }
            }
            }
        }

        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            AssistChip(onClick = onBorrowMore, label = { Text("+ Borrow More", fontSize = 11.sp) })
            if (remaining > 0) {
                AssistChip(onClick = onRepay, label = { Text("Pay Back", fontSize = 11.sp, color = KharchEmerald) })
                AssistChip(onClick = onSettle, label = { Text("Settle", fontSize = 11.sp) })
                AssistChip(onClick = onRemind, label = { Text("Message", fontSize = 11.sp) })
            }
            IconButton(onClick = onEdit, modifier = Modifier.size(32.dp)) { Icon(Icons.Rounded.Edit, contentDescription = "Edit", tint = kc.textMuted, modifier = Modifier.size(16.dp)) }
            IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) { Icon(Icons.Rounded.DeleteOutline, contentDescription = "Delete", tint = KharchRose, modifier = Modifier.size(16.dp)) }
        }
    }
}
