package com.example.kharch.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.FrameRateCategory
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.preferredFrameRate
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.model.EventBudget
import com.example.kharch.model.EventWithStats
import com.example.kharch.ui.components.*
import com.example.kharch.ui.theme.*
import com.example.kharch.ui.viewmodel.KharchUiState
import com.example.kharch.util.CategoryEngine
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils

private val EVENT_COLORS = listOf("#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444")
private val EVENT_ICONS = listOf("fa-suitcase", "fa-umbrella-beach", "fa-plane", "fa-car", "fa-ring", "fa-gift", "fa-champagne-glasses", "fa-house")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventsScreen(
    state: KharchUiState,
    onSaveEvent: (EventBudget, () -> Unit) -> Unit,
    onDeleteEvent: (String) -> Unit
) {
    val kc = LocalKharchColors.current
    val events = state.eventsWithStats

    var editingEvent by remember { mutableStateOf<EventBudget?>(null) }
    var isEventModalOpen by remember { mutableStateOf(false) }
    var viewingEvent by remember { mutableStateOf<EventWithStats?>(null) }
    var deleteEventTarget by remember { mutableStateOf<EventBudget?>(null) }

    val totalBudget = remember(events) { events.sumOf { it.budget } }
    val totalSpent = remember(events) { events.sumOf { it.spent } }
    val overCount = remember(events) { events.count { it.isOverBudget } }
    val overallPct = if (totalBudget > 0) ((totalSpent / totalBudget) * 100.0).coerceIn(0.0, 100.0) else 0.0

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp).preferredFrameRate(FrameRateCategory.High),
        contentPadding = PaddingValues(top = 8.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Trips & Events", style = MaterialTheme.typography.headlineLarge, color = kc.textPrimary)
                    Text("Track vacations, weddings, festivals & projects", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
                }
                Button(
                    onClick = { editingEvent = null; isEventModalOpen = true },
                    colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("New Event", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiCard(
                    title = "Total Event Spend",
                    value = totalSpent,
                    valueColor = KharchRose,
                    subtitle = "${overallPct.toInt()}% of ${CurrencyUtils.formatCompactInr(totalBudget, state.isPrivacyMode)}",
                    icon = Icons.Rounded.Luggage,
                    iconTint = KharchIndigo,
                    iconBg = KharchIndigoSoft,
                    isPrivacyMode = state.isPrivacyMode,
                    modifier = Modifier.weight(1f)
                )
                KpiCard(
                    title = "Active Events",
                    value = events.size.toDouble(),
                    isCurrency = false,
                    subtitle = if (overCount > 0) "$overCount over budget!" else "All within budget",
                    icon = Icons.Rounded.WarningAmber,
                    iconTint = if (overCount > 0) KharchRose else KharchEmerald,
                    iconBg = if (overCount > 0) KharchRoseSoft else KharchEmeraldSoft,
                    isPrivacyMode = false,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        if (events.isEmpty()) {
            item {
                KharchCard {
                    Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No trips or events yet", fontWeight = FontWeight.Bold, color = kc.textPrimary)
                        Text("Create one and tag expenses with #eventtag", fontSize = 12.sp, color = kc.textMuted)
                    }
                }
            }
        } else {
            items(events, key = { it.id }) { ev ->
                val pct = (ev.percentage / 100.0).toFloat().coerceIn(0f, 1f)
                val barCol = if (ev.isOverBudget) KharchRose else CategoryEngine.parseHexColor(ev.color, KharchIndigo)

                KharchCard(onClick = { viewingEvent = ev }, contentPadding = 14.dp) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        CategoryIconBadge(ev.icon, ev.color, size = 40.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(ev.name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = kc.textPrimary)
                                if (ev.isOverBudget) StatusPill("OVER BUDGET", KharchRose, KharchRoseSoft)
                            }
                            Text("#${ev.tag} • ${ev.txCount} expense(s)", fontSize = 11.sp, color = kc.textMuted)
                        }
                        Text("${ev.percentage.toInt()}%", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = barCol)
                    }

                    Spacer(Modifier.height(10.dp))
                    LinearProgressIndicator(
                        progress = { pct },
                        color = barCol,
                        trackColor = kc.subtleSurface,
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(6.dp))
                    )
                    Spacer(Modifier.height(6.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Spent: ${CurrencyUtils.formatInr(ev.spent, state.isPrivacyMode)}", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = KharchRose)
                        Text(if (ev.budget > 0) "Budget: ${CurrencyUtils.formatInr(ev.budget, state.isPrivacyMode)}" else "No limit", fontSize = 11.sp, color = kc.textMuted)
                    }

                    Spacer(Modifier.height(8.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = { viewingEvent = ev }) { Text("View Expenses", fontSize = 11.sp) }
                        IconButton(onClick = { editingEvent = ev.event; isEventModalOpen = true }) {
                            Icon(Icons.Rounded.Edit, contentDescription = "Edit", tint = kc.textMuted, modifier = Modifier.size(18.dp))
                        }
                        IconButton(onClick = { deleteEventTarget = ev.event }) {
                            Icon(Icons.Rounded.DeleteOutline, contentDescription = "Delete", tint = KharchRose, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }

    // Add/Edit Event Sheet
    if (isEventModalOpen) {
        var name by remember(editingEvent?.id) { mutableStateOf(editingEvent?.name ?: "") }
        var tag by remember(editingEvent?.id) { mutableStateOf(editingEvent?.tag ?: "") }
        var budget by remember(editingEvent?.id) { mutableStateOf(editingEvent?.budget?.takeIf { it > 0 }?.toString()?.removeSuffix(".0") ?: "") }
        var startDate by remember(editingEvent?.id) { mutableStateOf(editingEvent?.startDate ?: "") }
        var endDate by remember(editingEvent?.id) { mutableStateOf(editingEvent?.endDate ?: "") }
        var color by remember(editingEvent?.id) { mutableStateOf(editingEvent?.color ?: EVENT_COLORS.first()) }
        var icon by remember(editingEvent?.id) { mutableStateOf(editingEvent?.icon ?: EVENT_ICONS.first()) }
        var desc by remember(editingEvent?.id) { mutableStateOf(editingEvent?.description ?: "") }
        var err by remember { mutableStateOf("") }

        ModalBottomSheet(
            onDismissRequest = { isEventModalOpen = false },
            containerColor = kc.card,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .imePadding()
                    .navigationBarsPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 18.dp)
                    .padding(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(if (editingEvent != null) "Edit Trip / Event" else "New Trip / Event", style = MaterialTheme.typography.headlineSmall, color = kc.textPrimary)
                if (err.isNotBlank()) Text(err, color = KharchRose, fontSize = 12.sp)

                OutlinedTextField(
                    value = name,
                    onValueChange = {
                        name = it
                        err = ""
                        if (editingEvent == null) {
                            tag = it.lowercase().replace(Regex("[^a-z0-9]"), "")
                        }
                    },
                    label = { Text("Trip / Event Name *") },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                )
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = tag,
                        onValueChange = { tag = it.lowercase().replace(Regex("[^a-z0-9]"), "") },
                        label = { Text("Tag *") },
                        prefix = { Text("#") },
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = budget,
                        onValueChange = { budget = it },
                        label = { Text("Budget (₹)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    DatePickerField("Start Date", startDate, { startDate = it }, allowClear = true, modifier = Modifier.weight(1f))
                    DatePickerField("End Date", endDate, { endDate = it }, allowClear = true, modifier = Modifier.weight(1f))
                }

                Text("Color Theme", style = MaterialTheme.typography.labelMedium, color = kc.textMuted)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    EVENT_COLORS.forEach { cHex ->
                        Box(
                            modifier = Modifier.size(30.dp).clip(CircleShape).background(CategoryEngine.parseHexColor(cHex)).clickable { color = cHex },
                            contentAlignment = Alignment.Center
                        ) {
                            if (color == cHex) Icon(Icons.Rounded.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                        }
                    }
                }

                Text("Icon", style = MaterialTheme.typography.labelMedium, color = kc.textMuted)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    EVENT_ICONS.take(6).forEach { ic ->
                        Surface(
                            onClick = { icon = ic },
                            shape = RoundedCornerShape(10.dp),
                            color = if (icon == ic) KharchIndigoSoft else kc.subtleSurface,
                            border = BorderStroke(1.dp, if (icon == ic) KharchIndigo else kc.cardBorder)
                        ) {
                            Icon(CategoryEngine.getIcon(ic), contentDescription = null, tint = kc.textPrimary, modifier = Modifier.padding(9.dp).size(18.dp))
                        }
                    }
                }

                OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("Notes / Description") }, singleLine = true, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth())

                Button(
                    onClick = {
                        if (name.isBlank()) { err = "Enter a name"; return@Button }
                        onSaveEvent(
                            EventBudget(
                                id = editingEvent?.id ?: "",
                                name = name.trim(),
                                tag = tag,
                                budget = budget.trim().toDoubleOrNull() ?: 0.0,
                                startDate = startDate.ifBlank { null },
                                endDate = endDate.ifBlank { null },
                                color = color,
                                icon = icon,
                                description = desc.trim().ifBlank { null }
                            )
                        ) { isEventModalOpen = false }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Text(if (editingEvent != null) "Update Event" else "Create Event", fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    // View Linked Expenses Sheet
    viewingEvent?.let { ev ->
        val linkedTx = remember(ev, state.transactions) {
            val tagClean = ev.tag.trim().lowercase()
            val regex = if (tagClean.isNotBlank()) Regex("#" + Regex.escape(tagClean) + "(?![a-z0-9])", RegexOption.IGNORE_CASE) else null
            state.transactions.filter { t ->
                t.type == "expense" && (
                    t.eventId == ev.id ||
                        (tagClean.isNotBlank() && (
                            (t.eventTag ?: "").lowercase().removePrefix("#") == tagClean ||
                                (regex != null && regex.containsMatchIn(t.note)) ||
                                t.tags.any { it.lowercase().removePrefix("#") == tagClean }
                            ))
                    )
            }
        }
        ModalBottomSheet(
            onDismissRequest = { viewingEvent = null },
            containerColor = kc.card,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .heightIn(max = 520.dp)
                    .padding(horizontal = 18.dp)
                    .padding(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CategoryIconBadge(ev.icon, ev.color, size = 38.dp)
                    Column(Modifier.weight(1f)) {
                        Text(ev.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = kc.textPrimary)
                        Text("#${ev.tag}", fontSize = 11.sp, color = kc.textMuted)
                    }
                    IconButton(onClick = { viewingEvent = null }) { Icon(Icons.Rounded.Close, contentDescription = "Close") }
                }

                Surface(shape = RoundedCornerShape(12.dp), color = kc.subtleSurface, modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column {
                            Text("TOTAL SPENT", fontSize = 10.sp, color = kc.textMuted)
                            Text(CurrencyUtils.formatInr(ev.spent, state.isPrivacyMode), fontWeight = FontWeight.Bold, fontSize = 15.sp, color = KharchRose)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("BUDGET LIMIT", fontSize = 10.sp, color = kc.textMuted)
                            Text(if (ev.budget > 0) CurrencyUtils.formatInr(ev.budget, state.isPrivacyMode) else "No limit", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = kc.textPrimary)
                        }
                    }
                }

                Text("Logged Expenses (${linkedTx.size})", style = MaterialTheme.typography.labelMedium, color = kc.textMuted)
                if (linkedTx.isEmpty()) {
                    Text("No expenses linked yet. Link via Transaction form or add #${ev.tag} in note.", fontSize = 12.sp, color = kc.textMuted)
                } else {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(linkedTx, key = { it.id }) { t ->
                            val cat = CategoryEngine.resolveCategory(t.categoryId, state.categories, t.note)
                            Surface(shape = RoundedCornerShape(10.dp), color = kc.subtleSurface, modifier = Modifier.fillMaxWidth()) {
                                Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                    CategoryIconBadge(cat?.icon, cat?.color, size = 30.dp)
                                    Spacer(Modifier.width(10.dp))
                                    Column(Modifier.weight(1f)) {
                                        Text(t.note.ifBlank { cat?.name ?: "Expense" }, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = kc.textPrimary)
                                        Text(DateUtils.formatDisplayDate(t.date), fontSize = 10.sp, color = kc.textMuted)
                                    }
                                    Text("-${CurrencyUtils.formatInr(t.amount, state.isPrivacyMode)}", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = KharchRose)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    ConfirmActionDialog(
        isOpen = deleteEventTarget != null,
        title = "Delete Trip / Event",
        message = "Delete \"${deleteEventTarget?.name}\"? Tagged transactions will still be preserved.",
        confirmText = "Delete Event",
        isDanger = true,
        onDismiss = { deleteEventTarget = null },
        onConfirm = { deleteEventTarget?.let { onDeleteEvent(it.id) } }
    )
}
