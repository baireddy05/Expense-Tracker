package com.example.kharch.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.model.LentRecord
import com.example.kharch.model.LoanEntry
import com.example.kharch.ui.components.*
import com.example.kharch.ui.theme.*
import com.example.kharch.ui.viewmodel.KharchUiState
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils
import com.example.kharch.util.ShareAndPdfUtils
import java.time.LocalDate

private fun lentStatusOf(r: LentRecord): String {
    val rem = r.amount - r.returnedAmount
    if (rem <= 0.0) return "settled"
    val due = DateUtils.parseLocalDate(r.dueDate)
    if (due != null && due.isBefore(LocalDate.now())) return "overdue"
    return if (r.returnedAmount > 0.0) "partial" else "pending"
}

@Composable
fun LentMoneyScreen(
    state: KharchUiState,
    onSaveLent: (LentRecord, () -> Unit) -> Unit,
    onLendMore: (String, Double, String, String?, String, () -> Unit) -> Unit,
    onRecordRepayment: (String, Double, String, String, () -> Unit) -> Unit,
    onSettleLent: (String) -> Unit,
    onDeleteLent: (String) -> Unit,
    onToast: (String, Boolean) -> Unit
) {
    val kc = LocalKharchColors.current
    val context = LocalContext.current

    var search by remember { mutableStateOf("") }
    var statusFilter by remember { mutableStateOf("all") } // all, active, pending, partial, overdue, settled
    var sortBy by remember { mutableStateOf("date-desc") }
    var expandedHistories by remember { mutableStateOf<Map<String, Boolean>>(emptyMap()) }
    var cardTabs by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var settledExpanded by remember { mutableStateOf(false) }

    var isFormOpen by remember { mutableStateOf(false) }
    var editingRecord by remember { mutableStateOf<LentRecord?>(null) }
    var lendMoreTarget by remember { mutableStateOf<LentRecord?>(null) }
    var repayTarget by remember { mutableStateOf<LentRecord?>(null) }
    var reminderTarget by remember { mutableStateOf<LentRecord?>(null) }
    var settleTarget by remember { mutableStateOf<LentRecord?>(null) }
    var deleteTarget by remember { mutableStateOf<LentRecord?>(null) }
    var pdfConfirmOpen by remember { mutableStateOf(false) }

    val nameSuggestions = remember(state.lentRecords) {
        state.lentRecords.map { it.borrowerName.trim() }.filter { it.isNotBlank() }.distinct()
    }
    val noteSuggestions = remember(state.lentRecords) {
        state.lentRecords.mapNotNull { it.note?.trim() }.filter { it.isNotBlank() }.distinct()
    }

    val stats = remember(state.lentRecords) {
        val totalLent = state.lentRecords.sumOf { it.amount }
        val totalReturned = state.lentRecords.sumOf { it.returnedAmount }
        val pending = (totalLent - totalReturned).coerceAtLeast(0.0)
        val settled = state.lentRecords.count { lentStatusOf(it) == "settled" }
        val overdue = state.lentRecords.count { lentStatusOf(it) == "overdue" }
        arrayOf(pending, totalReturned, totalLent, settled.toDouble(), overdue.toDouble())
    }

    val filtered = remember(state.lentRecords, search, statusFilter, sortBy) {
        val q = search.trim().lowercase()
        state.lentRecords.filter { r ->
            val matchQ = q.isBlank() || r.borrowerName.lowercase().contains(q) || (r.note ?: "").lowercase().contains(q)
            val st = lentStatusOf(r)
            val matchSt = when (statusFilter) {
                "all" -> true
                "active" -> st != "settled"
                else -> st == statusFilter
            }
            matchQ && matchSt
        }.sortedWith { a, b ->
            when (sortBy) {
                "date-asc" -> a.dateLent.compareTo(b.dateLent)
                "amount-desc" -> b.amount.compareTo(a.amount)
                "pending-desc" -> (b.amount - b.returnedAmount).compareTo(a.amount - a.returnedAmount)
                "due-asc" -> (a.dueDate ?: "9999").compareTo(b.dueDate ?: "9999")
                else -> b.dateLent.compareTo(a.dateLent)
            }
        }
    }

    val activeList = remember(filtered) { filtered.filter { lentStatusOf(it) != "settled" } }
    val settledList = remember(filtered) { filtered.filter { lentStatusOf(it) == "settled" } }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp).kharchHighFrameRate(LocalTargetRefreshRate.current),
        contentPadding = PaddingValues(top = 8.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Lent to Friends", style = MaterialTheme.typography.headlineLarge, color = kc.textPrimary)
                        Text("Track receivables, top-ups & repayments", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (state.lentRecords.isNotEmpty()) {
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
                            Text("Lend", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // KPI Row
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiCard(
                    title = "Pending Collect",
                    value = stats[0],
                    valueColor = KharchAmber,
                    subtitle = if (stats[4] > 0) "${stats[4].toInt()} overdue" else "All on schedule",
                    icon = Icons.Rounded.Payments,
                    iconTint = KharchAmber,
                    iconBg = KharchAmberSoft,
                    isPrivacyMode = state.isPrivacyMode,
                    modifier = Modifier.weight(1f)
                )
                KpiCard(
                    title = "Recovered",
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

        // Search & Filter Chips
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it },
                    placeholder = { Text("Search friend or note...", fontSize = 12.sp) },
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
                    listOf("date-desc" to "Newest", "pending-desc" to "Highest Pending", "amount-desc" to "Highest Total", "due-asc" to "Due Soon").forEach { (k, lbl) ->
                        FilterChip(selected = sortBy == k, onClick = { sortBy = k }, label = { Text(lbl, fontSize = 10.sp) })
                    }
                }
            }
        }

        if (activeList.isEmpty() && settledList.isEmpty()) {
            item {
                KharchCard {
                    Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No lent records found", fontWeight = FontWeight.Bold, color = kc.textPrimary)
                        Text("Tap Lend to record money lent to a friend", fontSize = 12.sp, color = kc.textMuted)
                    }
                }
            }
        }

        items(activeList, key = { it.id }) { record ->
            LentRecordCard(
                record = record,
                isPrivacyMode = state.isPrivacyMode,
                isExpanded = expandedHistories[record.id] == true,
                activeTab = cardTabs[record.id] ?: "all",
                onToggleExpand = { expandedHistories = expandedHistories + (record.id to !(expandedHistories[record.id] == true)) },
                onSelectTab = { tab -> cardTabs = cardTabs + (record.id to tab) },
                onLendMore = { lendMoreTarget = record },
                onRepay = { repayTarget = record },
                onSettle = { settleTarget = record },
                onRemind = { reminderTarget = record },
                onEdit = { editingRecord = record; isFormOpen = true },
                onDelete = { deleteTarget = record }
            )
        }

        if (settledList.isNotEmpty()) {
            item {
                val archiveChevState = animateFloatAsState(
                    targetValue = if (settledExpanded) 180f else 0f,
                    animationSpec = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = 500f),
                    label = "lent_arch"
                )
                Surface(
                    onClick = { settledExpanded = !settledExpanded },
                    shape = RoundedCornerShape(14.dp),
                    color = kc.subtleSurface,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Settled Records Archive (${settledList.size})", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = kc.textPrimary)
                        Icon(Icons.Rounded.ExpandMore, contentDescription = null, modifier = Modifier.graphicsLayer { rotationZ = archiveChevState.value })
                    }
                }
            }
            if (settledExpanded) {
                items(settledList, key = { "settled_${it.id}" }) { record ->
                    LentRecordCard(
                        record = record,
                        isPrivacyMode = state.isPrivacyMode,
                        isExpanded = expandedHistories[record.id] == true,
                        activeTab = cardTabs[record.id] ?: "all",
                        onToggleExpand = { expandedHistories = expandedHistories + (record.id to !(expandedHistories[record.id] == true)) },
                        onSelectTab = { tab -> cardTabs = cardTabs + (record.id to tab) },
                        onLendMore = { lendMoreTarget = record },
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
        isLentMode = true,
        initialName = editingRecord?.borrowerName ?: "",
        initialAmount = editingRecord?.amount?.toString()?.removeSuffix(".0") ?: "",
        initialDate = editingRecord?.dateLent?.ifBlank { DateUtils.getLocalDateString() } ?: DateUtils.getLocalDateString(),
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
                base.copy(borrowerName = name, amount = amount, dateLent = date, dueDate = dueDate, phone = phone, note = note)
            } else {
                LentRecord(borrowerName = name, amount = amount, dateLent = date, dueDate = dueDate, phone = phone, note = note)
            }
            onSaveLent(payload) { isFormOpen = false; editingRecord = null }
        }
    )

    lendMoreTarget?.let { target ->
        TopUpAmountSheet(
            isOpen = true,
            title = "Lend More Money",
            personName = target.borrowerName,
            currentDueDate = target.dueDate ?: "",
            onDismiss = { lendMoreTarget = null },
            onSubmit = { amt, date, due, note ->
                onLendMore(target.id, amt, date, due, note) { lendMoreTarget = null }
            }
        )
    }

    repayTarget?.let { target ->
        val rem = (target.amount - target.returnedAmount).coerceAtLeast(0.0)
        RepaymentSheet(
            isOpen = true,
            title = "Record Return",
            personName = target.borrowerName,
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
            isLent = true,
            personName = target.borrowerName,
            phone = target.phone,
            pendingAmount = rem,
            dateStr = target.dateLent,
            dueDateStr = target.dueDate,
            onCopiedToast = { onToast("Message copied to clipboard", false) },
            onDismiss = { reminderTarget = null }
        )
    }

    ConfirmActionDialog(
        isOpen = settleTarget != null,
        title = "Mark Fully Settled",
        message = "Mark ${settleTarget?.borrowerName}'s remaining ${CurrencyUtils.formatInr((settleTarget?.let { it.amount - it.returnedAmount } ?: 0.0).coerceAtLeast(0.0))} as settled?",
        confirmText = "Settle",
        isDanger = false,
        onDismiss = { settleTarget = null },
        onConfirm = { settleTarget?.let { onSettleLent(it.id) } }
    )

    ConfirmActionDialog(
        isOpen = deleteTarget != null,
        title = "Delete Lent Record",
        message = "Delete record for ${deleteTarget?.borrowerName}?",
        confirmText = "Delete",
        isDanger = true,
        onDismiss = { deleteTarget = null },
        onConfirm = { deleteTarget?.let { onDeleteLent(it.id) } }
    )

    ConfirmActionDialog(
        isOpen = pdfConfirmOpen,
        title = "Export Lent Report PDF",
        message = "Generate and share a PDF summary of ${filtered.size} lent record(s)?",
        confirmText = "Export PDF",
        isDanger = false,
        onDismiss = { pdfConfirmOpen = false },
        onConfirm = {
            runCatching {
                val file = ShareAndPdfUtils.exportLentPdf(context, filtered, "Status: ${statusFilter.uppercase()}")
                ShareAndPdfUtils.shareFile(context, file, "application/pdf", "Share Lent Money PDF")
            }.onFailure { onToast("PDF export failed: ${it.message}", true) }
        }
    )
}

@Composable
private fun LentRecordCard(
    record: LentRecord,
    isPrivacyMode: Boolean,
    isExpanded: Boolean,
    activeTab: String,
    onToggleExpand: () -> Unit,
    onSelectTab: (String) -> Unit,
    onLendMore: () -> Unit,
    onRepay: () -> Unit,
    onSettle: () -> Unit,
    onRemind: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit
) {
    val kc = LocalKharchColors.current
    val remaining = (record.amount - record.returnedAmount).coerceAtLeast(0.0)
    val pct = if (record.amount > 0) (record.returnedAmount / record.amount).toFloat().coerceIn(0f, 1f) else 0f
    val status = lentStatusOf(record)
    val loans = record.loans.ifEmpty {
        listOf(LoanEntry(id = "init_${record.id}", amount = record.amount, date = record.dateLent, note = record.note ?: "Initial loan"))
    }

    val (stColor, stBg) = when (status) {
        "settled" -> KharchEmerald to KharchEmeraldSoft
        "overdue" -> KharchRose to KharchRoseSoft
        "partial" -> KharchAmber to KharchAmberSoft
        else -> KharchIndigo to KharchIndigoSoft
    }

    KharchCard(borderColor = if (status == "overdue") KharchRose.copy(alpha = 0.5f) else null, contentPadding = 14.dp) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(KharchIndigo),
                contentAlignment = Alignment.Center
            ) {
                Text((record.borrowerName.firstOrNull() ?: 'F').uppercase(), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        record.borrowerName,
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
                    append(DateUtils.formatDisplayDate(record.dateLent, short = true))
                    if (!record.dueDate.isNullOrBlank()) append(" • Due ${DateUtils.formatDisplayDate(record.dueDate, short = true)}")
                }
                Text(meta, fontSize = 10.sp, color = if (status == "overdue") KharchRose else kc.textMuted)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    if (remaining > 0) CurrencyUtils.formatInr(remaining, isPrivacyMode) else "Settled",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = if (remaining > 0) KharchAmber else KharchEmerald
                )
                Text("of ${CurrencyUtils.formatInr(record.amount, isPrivacyMode)}", fontSize = 10.sp, color = kc.textMuted)
            }
        }

        Spacer(Modifier.height(10.dp))
        LinearProgressIndicator(
            progress = { pct },
            color = if (status == "settled") KharchEmerald else KharchAmber,
            trackColor = kc.subtleSurface,
            modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(4.dp))
        )

        Spacer(Modifier.height(8.dp))
        TextButton(onClick = onToggleExpand, contentPadding = PaddingValues(0.dp)) {
            Icon(Icons.Rounded.History, contentDescription = null, modifier = Modifier.size(15.dp))
            Spacer(Modifier.width(4.dp))
            Text(if (isExpanded) "Hide Timeline (${loans.size} loans / ${record.repayments.size} returns)" else "Timeline (${loans.size} loans / ${record.repayments.size} returns)", fontSize = 11.sp)
        }

        AnimatedVisibility(
            visible = isExpanded,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically()
        ) {
            Column {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("all" to "All", "loans" to "Loans (${loans.size})", "repayments" to "Returns (${record.repayments.size})").forEach { (k, lbl) ->
                    FilterChip(selected = activeTab == k, onClick = { onSelectTab(k) }, label = { Text(lbl, fontSize = 10.sp) })
                }
            }
            Spacer(Modifier.height(6.dp))
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (activeTab == "all" || activeTab == "loans") {
                    loans.forEach { l ->
                        Surface(shape = RoundedCornerShape(10.dp), color = KharchAmberSoft, modifier = Modifier.fillMaxWidth()) {
                            Row(Modifier.padding(8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                                Column(Modifier.weight(1f)) {
                                    Text(l.note.ifBlank { "Loan" }, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = kc.textPrimary)
                                    Text(DateUtils.formatDisplayDate(l.date, short = true), fontSize = 10.sp, color = kc.textMuted)
                                }
                                Text("Lent ${CurrencyUtils.formatInr(l.amount, isPrivacyMode)}", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = KharchAmber)
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
                                Text("+${CurrencyUtils.formatInr(rep.amount, isPrivacyMode)}", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = KharchEmerald)
                            }
                        }
                    }
                }
            }
            }
        }

        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            AssistChip(onClick = onLendMore, label = { Text("+ Lend More", fontSize = 11.sp) })
            if (remaining > 0) {
                AssistChip(onClick = onRepay, label = { Text("Return", fontSize = 11.sp, color = KharchEmerald) })
                AssistChip(onClick = onSettle, label = { Text("Settle", fontSize = 11.sp) })
                AssistChip(onClick = onRemind, label = { Text("Remind", fontSize = 11.sp) })
            }
            IconButton(onClick = onEdit, modifier = Modifier.size(32.dp)) { Icon(Icons.Rounded.Edit, contentDescription = "Edit", tint = kc.textMuted, modifier = Modifier.size(16.dp)) }
            IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) { Icon(Icons.Rounded.DeleteOutline, contentDescription = "Delete", tint = KharchRose, modifier = Modifier.size(16.dp)) }
        }
    }
}
