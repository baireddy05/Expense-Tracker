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
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.model.SavingsGoal
import com.example.kharch.ui.components.*
import com.example.kharch.ui.theme.*
import com.example.kharch.ui.viewmodel.KharchUiState
import com.example.kharch.util.CategoryEngine
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils

private val GOAL_COLORS = listOf("#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4", "#6366f1")
private val GOAL_ICONS = listOf("fa-bullseye", "fa-piggy-bank", "fa-plane", "fa-car", "fa-house", "fa-laptop", "fa-graduation-cap", "fa-heart-pulse")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SavingsGoalsScreen(
    state: KharchUiState,
    onSaveGoal: (SavingsGoal, () -> Unit) -> Unit,
    onDeleteGoal: (String) -> Unit,
    onContribute: (String, Double, String, () -> Unit) -> Unit
) {
    val kc = LocalKharchColors.current
    val goals = state.savingsGoals

    var editingGoal by remember { mutableStateOf<SavingsGoal?>(null) }
    var isGoalModalOpen by remember { mutableStateOf(false) }
    var depositGoal by remember { mutableStateOf<SavingsGoal?>(null) }
    var deleteGoal by remember { mutableStateOf<SavingsGoal?>(null) }

    val totalTarget = remember(goals) { goals.sumOf { it.targetAmount } }
    val totalSaved = remember(goals) { goals.sumOf { it.savedAmount } }
    val completedCount = remember(goals) { goals.count { it.targetAmount > 0 && it.savedAmount >= it.targetAmount } }
    val overallPct = if (totalTarget > 0) ((totalSaved / totalTarget) * 100.0).coerceIn(0.0, 100.0) else 0.0

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Savings Goals", style = MaterialTheme.typography.headlineLarge, color = kc.textPrimary)
                    Text("Track financial milestones & emergency reserves", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
                }
                Button(
                    onClick = { editingGoal = null; isGoalModalOpen = true },
                    colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("New Goal", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiCard(
                    title = "Total Saved",
                    value = totalSaved,
                    valueColor = KharchEmerald,
                    subtitle = "${overallPct.toInt()}% of ${CurrencyUtils.formatCompactInr(totalTarget, state.isPrivacyMode)}",
                    icon = Icons.Rounded.Savings,
                    iconTint = KharchEmerald,
                    iconBg = KharchEmeraldSoft,
                    isPrivacyMode = state.isPrivacyMode,
                    modifier = Modifier.weight(1f)
                )
                KpiCard(
                    title = "Goals Funded",
                    value = completedCount.toDouble(),
                    isCurrency = false,
                    suffix = " / ${goals.size}",
                    subtitle = "${goals.size - completedCount} in progress",
                    icon = Icons.Rounded.EmojiEvents,
                    iconTint = KharchAmber,
                    iconBg = KharchAmberSoft,
                    isPrivacyMode = false,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        if (goals.isEmpty()) {
            item {
                KharchCard {
                    Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No savings goals yet", fontWeight = FontWeight.Bold, color = kc.textPrimary)
                        Text("Tap New Goal to start saving for a trip, gadget, or safety fund", fontSize = 12.sp, color = kc.textMuted)
                    }
                }
            }
        } else {
            items(goals, key = { it.id }) { goal ->
                val pct = if (goal.targetAmount > 0) (goal.savedAmount / goal.targetAmount).toFloat().coerceIn(0f, 1f) else 0f
                val isCompleted = goal.targetAmount > 0 && goal.savedAmount >= goal.targetAmount
                val daysLeft = DateUtils.daysUntil(goal.targetDate)
                val barCol = CategoryEngine.parseHexColor(goal.color, KharchEmerald)

                KharchCard(contentPadding = 14.dp) {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        CategoryIconBadge(goal.icon, goal.color, size = 40.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(goal.name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = kc.textPrimary)
                                if (isCompleted) StatusPill("COMPLETED", KharchEmerald, KharchEmeraldSoft)
                            }
                            val sub = buildString {
                                if (daysLeft != null) {
                                    if (daysLeft < 0) append("${-daysLeft}d overdue")
                                    else if (daysLeft == 0L) append("Target today")
                                    else append("${daysLeft}d remaining")
                                    append(" • ")
                                }
                                append("${goal.contributions.size} deposit(s)")
                            }
                            Text(sub, fontSize = 11.sp, color = if (daysLeft != null && daysLeft < 0 && !isCompleted) KharchRose else kc.textMuted)
                        }
                        Text("${(pct * 100).toInt()}%", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = barCol)
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
                        Text("Saved: ${CurrencyUtils.formatInr(goal.savedAmount, state.isPrivacyMode)}", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = kc.textPrimary)
                        Text("Target: ${CurrencyUtils.formatInr(goal.targetAmount, state.isPrivacyMode)}", fontSize = 11.sp, color = kc.textMuted)
                    }

                    Spacer(Modifier.height(10.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Button(
                            onClick = { depositGoal = goal },
                            colors = ButtonDefaults.buttonColors(containerColor = KharchEmerald, contentColor = Color.White),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(15.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Add Funds", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                        Row {
                            IconButton(onClick = { editingGoal = goal; isGoalModalOpen = true }) {
                                Icon(Icons.Rounded.Edit, contentDescription = "Edit", tint = kc.textMuted, modifier = Modifier.size(18.dp))
                            }
                            IconButton(onClick = { deleteGoal = goal }) {
                                Icon(Icons.Rounded.DeleteOutline, contentDescription = "Delete", tint = KharchRose, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        }
    }

    if (isGoalModalOpen) {
        var name by remember(editingGoal?.id) { mutableStateOf(editingGoal?.name ?: "") }
        var target by remember(editingGoal?.id) { mutableStateOf(editingGoal?.targetAmount?.toString()?.removeSuffix(".0") ?: "") }
        var saved by remember(editingGoal?.id) { mutableStateOf(editingGoal?.savedAmount?.toString()?.removeSuffix(".0") ?: "0") }
        var deadline by remember(editingGoal?.id) { mutableStateOf(editingGoal?.targetDate ?: "") }
        var color by remember(editingGoal?.id) { mutableStateOf(editingGoal?.color ?: GOAL_COLORS.first()) }
        var icon by remember(editingGoal?.id) { mutableStateOf(editingGoal?.icon ?: GOAL_ICONS.first()) }
        var err by remember { mutableStateOf("") }

        ModalBottomSheet(
            onDismissRequest = { isGoalModalOpen = false },
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
                Text(if (editingGoal != null) "Edit Savings Goal" else "New Savings Goal", style = MaterialTheme.typography.headlineSmall, color = kc.textPrimary)
                if (err.isNotBlank()) Text(err, color = KharchRose, fontSize = 12.sp)

                OutlinedTextField(value = name, onValueChange = { name = it; err = "" }, label = { Text("Goal Name *") }, singleLine = true, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth())
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(value = target, onValueChange = { target = it; err = "" }, label = { Text("Target (₹) *") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, shape = RoundedCornerShape(14.dp), modifier = Modifier.weight(1f))
                    OutlinedTextField(value = saved, onValueChange = { saved = it }, label = { Text("Already Saved") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, shape = RoundedCornerShape(14.dp), modifier = Modifier.weight(1f))
                }
                DatePickerField("Target Deadline (Optional)", deadline, { deadline = it }, allowClear = true)

                Text("Color Theme", style = MaterialTheme.typography.labelMedium, color = kc.textMuted)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    GOAL_COLORS.forEach { cHex ->
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
                    GOAL_ICONS.take(6).forEach { ic ->
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

                Button(
                    onClick = {
                        val tVal = target.trim().toDoubleOrNull()
                        val sVal = saved.trim().toDoubleOrNull() ?: 0.0
                        if (name.isBlank()) { err = "Enter a goal name"; return@Button }
                        if (tVal == null || tVal <= 0.0) { err = "Target amount must be > 0"; return@Button }
                        if (sVal < 0.0) { err = "Saved amount cannot be negative"; return@Button }
                        onSaveGoal(
                            SavingsGoal(
                                id = editingGoal?.id ?: "",
                                name = name.trim(),
                                targetAmount = tVal,
                                savedAmount = sVal,
                                targetDate = deadline.ifBlank { null },
                                color = color,
                                icon = icon,
                                contributions = editingGoal?.contributions ?: emptyList()
                            )
                        ) { isGoalModalOpen = false }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Text(if (editingGoal != null) "Update Goal" else "Create Goal", fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    depositGoal?.let { g ->
        var amt by remember(g.id) { mutableStateOf("") }
        var note by remember(g.id) { mutableStateOf("") }
        var err by remember { mutableStateOf("") }
        ModalBottomSheet(
            onDismissRequest = { depositGoal = null },
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
                Text("Add Funds to \"${g.name}\"", style = MaterialTheme.typography.headlineSmall, color = kc.textPrimary)
                if (err.isNotBlank()) Text(err, color = KharchRose, fontSize = 12.sp)
                OutlinedTextField(value = amt, onValueChange = { amt = it; err = "" }, label = { Text("Deposit Amount (₹) *") }, prefix = { Text("₹ ") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text("Note / Tag") }, singleLine = true, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth())
                Button(
                    onClick = {
                        val v = amt.trim().toDoubleOrNull()
                        if (v == null || v <= 0.0) { err = "Enter a valid deposit > 0"; return@Button }
                        onContribute(g.id, v, note) { depositGoal = null }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = KharchEmerald, contentColor = Color.White),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Text("Confirm Contribution", fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    ConfirmActionDialog(
        isOpen = deleteGoal != null,
        title = "Delete Savings Goal",
        message = "Delete goal \"${deleteGoal?.name}\"? This action cannot be undone.",
        confirmText = "Delete Goal",
        isDanger = true,
        onDismiss = { deleteGoal = null },
        onConfirm = { deleteGoal?.let { onDeleteGoal(it.id) } }
    )
}
