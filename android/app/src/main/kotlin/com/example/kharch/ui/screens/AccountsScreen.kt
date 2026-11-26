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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.model.Account
import com.example.kharch.ui.components.*
import com.example.kharch.ui.theme.*
import com.example.kharch.ui.viewmodel.KharchUiState
import com.example.kharch.util.CategoryEngine
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils

private val ACCOUNT_COLORS = listOf("#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#64748b")
private val ACCOUNT_ICONS = listOf("fa-building-columns", "fa-money-bill-wave", "fa-credit-card", "fa-wallet", "fa-piggy-bank", "fa-chart-line")
private val ACCOUNT_TYPES = listOf(
    "bank" to "Bank Account",
    "cash" to "Cash Wallet",
    "credit" to "Credit Card",
    "wallet" to "Digital Wallet / UPI",
    "savings" to "Savings / Vault",
    "investment" to "Investment"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountsScreen(
    state: KharchUiState,
    onSaveAccount: (Account, () -> Unit) -> Unit,
    onDeleteAccount: (String) -> Unit,
    onTransferFunds: (String, String, Double, String, String, () -> Unit) -> Unit
) {
    val kc = LocalKharchColors.current
    val accounts = state.accountsWithBalances

    var editingAccount by remember { mutableStateOf<Account?>(null) }
    var isAccountModalOpen by remember { mutableStateOf(false) }
    var isTransferModalOpen by remember { mutableStateOf(false) }
    var transferDefaultFrom by remember { mutableStateOf("") }
    var deleteTarget by remember { mutableStateOf<Account?>(null) }

    val totalBalance = remember(accounts) { accounts.sumOf { it.balance } }
    val liquidAssets = remember(accounts) { accounts.filter { it.type != "credit" }.sumOf { it.balance } }
    val creditLiabilities = remember(accounts) { accounts.filter { it.type == "credit" && it.balance < 0 }.sumOf { -it.balance } }
    val recentTransfers = remember(state.transactions) { state.transactions.filter { it.type == "transfer" }.take(10) }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp).preferredFrameRate(FrameRateCategory.High),
        contentPadding = PaddingValues(top = 8.dp, bottom = 120.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Accounts & Wallets", style = MaterialTheme.typography.headlineLarge, color = kc.textPrimary)
                Text("Manage bank accounts, cash, credit cards & transfer funds", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = {
                            transferDefaultFrom = accounts.firstOrNull()?.id ?: ""
                            isTransferModalOpen = true
                        },
                        enabled = accounts.size >= 2,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Rounded.SwapHoriz, contentDescription = null, tint = KharchIndigo, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Transfer Funds", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = { editingAccount = null; isAccountModalOpen = true },
                        colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Icon(Icons.Rounded.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Add Account", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                KpiCard(
                    title = "Total Balance",
                    value = totalBalance,
                    subtitle = "${accounts.size} account(s)",
                    icon = Icons.Rounded.AccountBalance,
                    iconTint = KharchBlue,
                    iconBg = Color(0x1A3B82F6),
                    isPrivacyMode = state.isPrivacyMode,
                    modifier = Modifier.weight(1f)
                )
                KpiCard(
                    title = "Liquid vs Credit",
                    value = liquidAssets,
                    valueColor = KharchEmerald,
                    subtitle = "Debt: ${CurrencyUtils.formatCompactInr(creditLiabilities, state.isPrivacyMode)}",
                    icon = Icons.Rounded.Balance,
                    iconTint = KharchEmerald,
                    iconBg = KharchEmeraldSoft,
                    isPrivacyMode = state.isPrivacyMode,
                    modifier = Modifier.weight(1f)
                )
            }
        }

        items(accounts, key = { it.id }) { acc ->
            KharchCard(contentPadding = 14.dp) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    CategoryIconBadge(acc.icon, acc.color, size = 40.dp)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Text(acc.name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = kc.textPrimary)
                            if (acc.isDefault) StatusPill("DEFAULT", KharchIndigo, KharchIndigoSoft)
                        }
                        Text(ACCOUNT_TYPES.firstOrNull { it.first == acc.type }?.second ?: acc.type, fontSize = 11.sp, color = kc.textMuted)
                    }
                    Text(
                        text = CurrencyUtils.formatInr(acc.balance, state.isPrivacyMode),
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = if (acc.balance >= 0) kc.textPrimary else KharchRose
                    )
                }
                Spacer(Modifier.height(10.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                    if (accounts.size >= 2) {
                        TextButton(onClick = { transferDefaultFrom = acc.id; isTransferModalOpen = true }) {
                            Icon(Icons.Rounded.SwapHoriz, contentDescription = null, modifier = Modifier.size(15.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Transfer", fontSize = 11.sp)
                        }
                    }
                    TextButton(onClick = { editingAccount = acc.account; isAccountModalOpen = true }) {
                        Icon(Icons.Rounded.Edit, contentDescription = null, modifier = Modifier.size(15.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Edit", fontSize = 11.sp)
                    }
                    if (accounts.size > 1) {
                        TextButton(onClick = { deleteTarget = acc.account }) {
                            Icon(Icons.Rounded.DeleteOutline, contentDescription = null, tint = KharchRose, modifier = Modifier.size(15.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Delete", fontSize = 11.sp, color = KharchRose)
                        }
                    }
                }
            }
        }

        // Recent Transfers
        item {
            KharchCard {
                Text("Recent Internal Transfers", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                Spacer(Modifier.height(10.dp))
                if (recentTransfers.isEmpty()) {
                    Text("No transfers recorded yet.", fontSize = 12.sp, color = kc.textMuted)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        recentTransfers.forEach { t ->
                            val fromAcc = accounts.firstOrNull { it.id == t.fromAccountId }?.name ?: "Account"
                            val toAcc = accounts.firstOrNull { it.id == t.toAccountId }?.name ?: "Account"
                            Surface(shape = RoundedCornerShape(12.dp), color = kc.subtleSurface, modifier = Modifier.fillMaxWidth()) {
                                Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                    Column(Modifier.weight(1f)) {
                                        Text("$fromAcc → $toAcc", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = kc.textPrimary)
                                        Text("${t.note.ifBlank { "Internal Transfer" }} • ${DateUtils.formatDisplayDate(t.date, short = true)}", fontSize = 10.sp, color = kc.textMuted)
                                    }
                                    Text(CurrencyUtils.formatInr(t.amount, state.isPrivacyMode), fontWeight = FontWeight.Bold, fontSize = 12.sp, color = KharchIndigo)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Add/Edit Account Sheet
    if (isAccountModalOpen) {
        var name by remember(editingAccount?.id) { mutableStateOf(editingAccount?.name ?: "") }
        var accType by remember(editingAccount?.id) { mutableStateOf(editingAccount?.type ?: "bank") }
        var initBal by remember(editingAccount?.id) { mutableStateOf(editingAccount?.initialBalance?.toString()?.removeSuffix(".0") ?: "0") }
        var color by remember(editingAccount?.id) { mutableStateOf(editingAccount?.color ?: ACCOUNT_COLORS.first()) }
        var icon by remember(editingAccount?.id) { mutableStateOf(editingAccount?.icon ?: ACCOUNT_ICONS.first()) }
        var isDef by remember(editingAccount?.id) { mutableStateOf(editingAccount?.isDefault ?: false) }
        var err by remember { mutableStateOf("") }

        ModalBottomSheet(
            onDismissRequest = { isAccountModalOpen = false },
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
                Text(if (editingAccount != null) "Edit Account" else "New Account", style = MaterialTheme.typography.headlineSmall, color = kc.textPrimary)
                if (err.isNotBlank()) Text(err, color = KharchRose, fontSize = 12.sp)

                OutlinedTextField(value = name, onValueChange = { name = it; err = "" }, label = { Text("Account Name *") }, singleLine = true, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth())

                Text("Account Type", style = MaterialTheme.typography.labelMedium, color = kc.textMuted)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    ACCOUNT_TYPES.forEach { (k, lbl) ->
                        FilterChip(selected = accType == k, onClick = { accType = k }, label = { Text(lbl, fontSize = 11.sp) })
                    }
                }

                OutlinedTextField(
                    value = initBal,
                    onValueChange = { initBal = it },
                    label = { Text("Initial Balance (₹)") },
                    prefix = { Text("₹ ") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                )

                Text("Theme Color", style = MaterialTheme.typography.labelMedium, color = kc.textMuted)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    ACCOUNT_COLORS.forEach { cHex ->
                        val c = CategoryEngine.parseHexColor(cHex)
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .clip(CircleShape)
                                .background(c)
                                .clickable { color = cHex },
                            contentAlignment = Alignment.Center
                        ) {
                            if (color == cHex) Icon(Icons.Rounded.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                        }
                    }
                }

                Text("Icon", style = MaterialTheme.typography.labelMedium, color = kc.textMuted)
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ACCOUNT_ICONS.forEach { ic ->
                        Surface(
                            onClick = { icon = ic },
                            shape = RoundedCornerShape(10.dp),
                            color = if (icon == ic) KharchIndigoSoft else kc.subtleSurface,
                            border = BorderStroke(1.dp, if (icon == ic) KharchIndigo else kc.cardBorder)
                        ) {
                            Icon(CategoryEngine.getIcon(ic), contentDescription = null, tint = kc.textPrimary, modifier = Modifier.padding(10.dp).size(18.dp))
                        }
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = isDef, onCheckedChange = { isDef = it })
                    Text("Set as Default Payment Account", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = kc.textPrimary)
                }

                Button(
                    onClick = {
                        if (name.isBlank()) { err = "Account name is required"; return@Button }
                        onSaveAccount(
                            Account(
                                id = editingAccount?.id ?: "",
                                name = name.trim(),
                                type = accType,
                                initialBalance = initBal.trim().toDoubleOrNull() ?: 0.0,
                                color = color,
                                icon = icon,
                                isDefault = isDef
                            )
                        ) { isAccountModalOpen = false }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Text(if (editingAccount != null) "Update Account" else "Create Account", fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    // Transfer Funds Sheet
    if (isTransferModalOpen && accounts.size >= 2) {
        var fromId by remember(transferDefaultFrom) { mutableStateOf(transferDefaultFrom.ifBlank { accounts.first().id }) }
        var toId by remember(fromId) { mutableStateOf(accounts.firstOrNull { it.id != fromId }?.id ?: accounts.last().id) }
        var amt by remember { mutableStateOf("") }
        var date by remember { mutableStateOf(DateUtils.getLocalDateString()) }
        var note by remember { mutableStateOf("") }
        var err by remember { mutableStateOf("") }
        var showFromMenu by remember { mutableStateOf(false) }
        var showToMenu by remember { mutableStateOf(false) }

        ModalBottomSheet(
            onDismissRequest = { isTransferModalOpen = false },
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
                Text("Transfer Funds", style = MaterialTheme.typography.headlineSmall, color = kc.textPrimary)
                if (err.isNotBlank()) Text(err, color = KharchRose, fontSize = 12.sp)

                Box {
                    val fromAcc = accounts.firstOrNull { it.id == fromId } ?: accounts.first()
                    Surface(onClick = { showFromMenu = true }, shape = RoundedCornerShape(12.dp), color = kc.subtleSurface, border = BorderStroke(1.dp, kc.cardBorder)) {
                        Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("From: ${fromAcc.name} (${CurrencyUtils.formatInr(fromAcc.balance, state.isPrivacyMode)})", fontSize = 12.sp, color = kc.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                            Icon(Icons.Rounded.ArrowDropDown, contentDescription = null)
                        }
                    }
                    DropdownMenu(expanded = showFromMenu, onDismissRequest = { showFromMenu = false }) {
                        accounts.forEach { a ->
                            DropdownMenuItem(text = { Text("${a.name} (${CurrencyUtils.formatInr(a.balance, state.isPrivacyMode)})") }, onClick = {
                                fromId = a.id
                                if (toId == a.id) toId = accounts.firstOrNull { it.id != a.id }?.id ?: ""
                                showFromMenu = false
                            })
                        }
                    }
                }

                Box {
                    val toAcc = accounts.firstOrNull { it.id == toId }
                    Surface(onClick = { showToMenu = true }, shape = RoundedCornerShape(12.dp), color = kc.subtleSurface, border = BorderStroke(1.dp, kc.cardBorder)) {
                        Row(Modifier.fillMaxWidth().padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("To: ${toAcc?.let { "${it.name} (${CurrencyUtils.formatInr(it.balance, state.isPrivacyMode)})" } ?: "Select destination"}", fontSize = 12.sp, color = kc.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                            Icon(Icons.Rounded.ArrowDropDown, contentDescription = null)
                        }
                    }
                    DropdownMenu(expanded = showToMenu, onDismissRequest = { showToMenu = false }) {
                        accounts.filter { it.id != fromId }.forEach { a ->
                            DropdownMenuItem(text = { Text("${a.name} (${CurrencyUtils.formatInr(a.balance, state.isPrivacyMode)})") }, onClick = { toId = a.id; showToMenu = false })
                        }
                    }
                }

                OutlinedTextField(value = amt, onValueChange = { amt = it; err = "" }, label = { Text("Transfer Amount (₹) *") }, prefix = { Text("₹ ") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), singleLine = true, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth())
                DatePickerField("Date *", date, { date = it })
                OutlinedTextField(value = note, onValueChange = { note = it }, label = { Text("Note / Reason") }, singleLine = true, shape = RoundedCornerShape(14.dp), modifier = Modifier.fillMaxWidth())

                Button(
                    onClick = {
                        val parsed = amt.trim().toDoubleOrNull()
                        if (parsed == null || parsed <= 0.0) { err = "Enter valid amount > 0"; return@Button }
                        if (fromId == toId) { err = "Source and destination must differ"; return@Button }
                        onTransferFunds(fromId, toId, parsed, date, note) { isTransferModalOpen = false }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Text("Confirm Transfer", fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    ConfirmActionDialog(
        isOpen = deleteTarget != null,
        title = "Delete Account",
        message = "Delete \"${deleteTarget?.name}\"? Past transactions referencing this account will be safely reassigned to your default account.",
        confirmText = "Delete Account",
        isDanger = true,
        onDismiss = { deleteTarget = null },
        onConfirm = { deleteTarget?.let { onDeleteAccount(it.id) } }
    )
}
