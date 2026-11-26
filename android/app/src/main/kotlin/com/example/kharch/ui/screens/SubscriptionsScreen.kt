package com.example.kharch.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.model.Subscription
import com.example.kharch.ui.components.*
import com.example.kharch.ui.theme.*
import com.example.kharch.ui.viewmodel.KharchUiState
import com.example.kharch.util.CategoryEngine
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscriptionsScreen(
    state: KharchUiState,
    onSaveSubscription: (Subscription, () -> Unit) -> Unit,
    onToggleActive: (Subscription) -> Unit,
    onDeleteSubscription: (String) -> Unit
) {
    val kc = LocalKharchColors.current
    val subs = state.subscriptions

    var editingSub by remember { mutableStateOf<Subscription?>(null) }
    var isModalOpen by remember { mutableStateOf(false) }
    var deleteTarget by remember { mutableStateOf<Subscription?>(null) }

    val stats = remember(subs) {
        var monthlyFixed = 0.0
        subs.forEach { s ->
            if (s.active && s.type == "expense") {
                monthlyFixed += when (s.frequency) {
                    "daily" -> s.amount * 30.0
                    "weekly" -> s.amount * 4.33
                    "monthly" -> s.amount
                    "yearly" -> s.amount / 12.0
                    else -> s.amount
                }
            }
        }
        val activeExpenseCount = subs.count { it.active && it.type != "income" }
        monthlyFixed to activeExpenseCount
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp).preferredFrameRate(FrameRateCategory.High),
        contentPadding = PaddingValues(top = 8.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Subscriptions", style = MaterialTheme.typography.headlineLarge, color = kc.textPrimary)
                    Text("Manage recurring fixed costs & auto-payments", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
                }
                Button(
                    onClick = { editingSub = null; isModalOpen = true },
                    colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Add", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiCard(
                    title = "Monthly Fixed Costs",
                    value = stats.first,
                    valueColor = KharchRose,
                    subtitle = "Based on ${stats.second} active sub(s)",
                    icon = Icons.Rounded.Autorenew,
                    iconTint = KharchIndigo,
                    iconBg = KharchIndigoSoft,
                    isPrivacyMode = state.isPrivacyMode,
                    modifier = Modifier.weight(1f)
                )
                KpiCard(
                    title = "Total Tracked",
                    value = subs.size.toDouble(),
                    isCurrency = false,
                    subtitle = "${subs.count { it.active }} active • ${subs.count { !it.active }} paused",
                    icon = Icons.Rounded.AccountBalanceWallet,
                    iconTint = KharchEmerald,
                    iconBg = KharchEmeraldSoft,
                    isPrivacyMode = false,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        if (subs.isEmpty()) {
            item {
                KharchCard {
                    Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No subscriptions yet", fontWeight = FontWeight.Bold, color = kc.textPrimary)
                        Text("Tap Add to automate Netflix, rent, salary, or bills", fontSize = 12.sp, color = kc.textMuted)
                    }
                }
            }
        } else {
            items(subs, key = { it.id }) { sub ->
                val cat = CategoryEngine.resolveCategory(sub.categoryId, state.categories, sub.name)
                KharchCard(contentPadding = 14.dp) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        CategoryIconBadge(cat?.icon ?: "fa-sync", cat?.color, size = 40.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(sub.name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = kc.textPrimary)
                                StatusPill(
                                    if (sub.active) "ACTIVE" else "PAUSED",
                                    if (sub.active) KharchEmerald else kc.textMuted,
                                    if (sub.active) KharchEmeraldSoft else kc.subtleSurface
                                )
                            }
                            Text(
                                "${sub.frequency.replaceFirstChar { it.uppercase() }} • Next: ${DateUtils.formatDisplayDate(sub.nextDueDate)}",
                                fontSize = 11.sp,
                                color = kc.textMuted
                            )
                        }
                        Text(
                            text = "${if (sub.type == "income") "+" else "-"}${CurrencyUtils.formatInr(sub.amount, state.isPrivacyMode)}",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = if (sub.type == "income") KharchEmerald else KharchRose
                        )
                    }

                    Spacer(Modifier.height(8.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Switch(checked = sub.active, onCheckedChange = { onToggleActive(sub) })
                            Spacer(Modifier.width(6.dp))
                            Text(if (sub.active) "Auto-post on" else "Paused", fontSize = 11.sp, color = kc.textMuted)
                        }
                        Row {
                            IconButton(onClick = { editingSub = sub; isModalOpen = true }) {
                                Icon(Icons.Rounded.Edit, contentDescription = "Edit", tint = kc.textMuted, modifier = Modifier.size(18.dp))
                            }
                            IconButton(onClick = { deleteTarget = sub }) {
                                Icon(Icons.Rounded.DeleteOutline, contentDescription = "Delete", tint = KharchRose, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        }
    }

    if (isModalOpen) {
        var name by remember(editingSub?.id) { mutableStateOf(editingSub?.name ?: "") }
        var amount by remember(editingSub?.id) { mutableStateOf(editingSub?.amount?.toString()?.removeSuffix(".0") ?: "") }
        var type by remember(editingSub?.id) { mutableStateOf(editingSub?.type ?: "expense") }
        var freq by remember(editingSub?.id) { mutableStateOf(editingSub?.frequency ?: "monthly") }
        var nextDue by remember(editingSub?.id) { mutableStateOf(editingSub?.nextDueDate?.take(10)?.ifBlank { DateUtils.getLocalDateString() } ?: DateUtils.getLocalDateString()) }
        var active by remember(editingSub?.id) { mutableStateOf(editingSub?.active ?: true) }
        val filteredCats = remember(state.categories, type) { state.categories.filter { it.type == type } }
        var catId by remember(editingSub?.id, type) {
            mutableStateOf(editingSub?.categoryId?.takeIf { id -> filteredCats.any { it.id == id } } ?: filteredCats.firstOrNull()?.id ?: "")
        }
        var showCatMenu by remember { mutableStateOf(false) }
        var err by remember { mutableStateOf("") }

        ModalBottomSheet(
            onDismissRequest = { isModalOpen = false },
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
                Text(if (editingSub != null) "Edit Subscription" else "New Subscription", style = MaterialTheme.typography.headlineSmall, color = kc.textPrimary)
                if (err.isNotBlank()) Text(err, color = KharchRose, fontSize = 12.sp)

                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(kc.subtleSurface).padding(4.dp)) {
                    listOf("expense" to "Expense", "income" to "Income").forEach { (k, lbl) ->
                        val sel = type == k
                        Surface(
                            onClick = { type = k },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            color = if (sel) (if (k == "expense") KharchRose else KharchEmerald) else Color.Transparent
                        ) {
                            Box(Modifier.padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
                                Text(lbl, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (sel) Color.White else kc.textMuted)
                            }
                        }
                    }
                }

                OutlinedTextField(value = name, onValueChange = { name = it; err = "" }, label = { Text("Name *") }, placeholder = { Text("e.g. Netflix, Rent, SIP") }, singleLine = true, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = amount, onValueChange = { amount = it; err = "" }, label = { Text("Amount (₹) *") }, prefix = { Text("₹ ") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth())

                // Category
                val selCat = filteredCats.firstOrNull { it.id == catId }
                Box {
                    Surface(onClick = { showCatMenu = true }, shape = RoundedCornerShape(12.dp), color = kc.subtleSurface, border = BorderStroke(1.dp, kc.cardBorder)) {
                        Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Category: ${selCat?.name ?: "Select"}", fontSize = 12.sp, color = kc.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                            Icon(Icons.Rounded.ArrowDropDown, contentDescription = null)
                        }
                    }
                    DropdownMenu(expanded = showCatMenu, onDismissRequest = { showCatMenu = false }) {
                        filteredCats.forEach { c ->
                            DropdownMenuItem(text = { Text(c.name) }, onClick = { catId = c.id; showCatMenu = false })
                        }
                    }
                }

                Text("Frequency", style = MaterialTheme.typography.labelMedium, color = kc.textMuted)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("daily" to "Daily", "weekly" to "Weekly", "monthly" to "Monthly", "yearly" to "Yearly").forEach { (k, lbl) ->
                        FilterChip(selected = freq == k, onClick = { freq = k }, label = { Text(lbl, fontSize = 11.sp) })
                    }
                }

                DatePickerField("Next Due Date *", nextDue, { nextDue = it })

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(checked = active, onCheckedChange = { active = it })
                    Spacer(Modifier.width(8.dp))
                    Text("Active (auto-post when due)", fontSize = 12.sp, color = kc.textPrimary)
                }

                Button(
                    onClick = {
                        val amt = amount.trim().toDoubleOrNull()
                        if (name.isBlank()) { err = "Name is required"; return@Button }
                        if (amt == null || amt <= 0.0) { err = "Amount must be > 0"; return@Button }
                        onSaveSubscription(
                            Subscription(
                                id = editingSub?.id ?: "",
                                name = name.trim(),
                                amount = amt,
                                categoryId = catId,
                                frequency = freq,
                                nextDueDate = nextDue,
                                active = active,
                                type = type
                            )
                        ) { isModalOpen = false }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Text("Save Subscription", fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    ConfirmActionDialog(
        isOpen = deleteTarget != null,
        title = "Delete Subscription",
        message = "Delete \"${deleteTarget?.name}\"? Previously posted transactions remain in your ledger.",
        confirmText = "Delete",
        isDanger = true,
        onDismiss = { deleteTarget = null },
        onConfirm = { deleteTarget?.let { onDeleteSubscription(it.id) } }
    )
}
