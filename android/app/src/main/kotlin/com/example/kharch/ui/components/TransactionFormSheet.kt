package com.example.kharch.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.model.*
import com.example.kharch.ui.theme.*
import com.example.kharch.util.CategoryEngine
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionFormSheet(
    isOpen: Boolean,
    initialData: Transaction? = null,
    defaultType: String = "expense",
    defaultDate: String? = null,
    categories: List<Category>,
    accounts: List<AccountWithBalance>,
    events: List<EventWithStats>,
    recentTransactions: List<Transaction>,
    isPrivacyMode: Boolean,
    onDismiss: () -> Unit,
    onSave: (Transaction, () -> Unit) -> Unit,
    onCreateCategory: suspend (String, String) -> Category?
) {
    if (!isOpen) return
    val kc = LocalKharchColors.current
    val scope = rememberCoroutineScope()
    val focusManager = LocalFocusManager.current

    var type by remember(isOpen, initialData?.id, defaultType) {
        mutableStateOf(initialData?.type?.takeIf { it == "income" || it == "expense" } ?: defaultType)
    }
    var amountText by remember(isOpen, initialData?.id) {
        mutableStateOf(initialData?.let { if (it.amount > 0) it.amount.toString().removeSuffix(".0") else "" } ?: "")
    }
    var date by remember(isOpen, initialData?.id, defaultDate) {
        mutableStateOf(initialData?.date?.take(10)?.ifBlank { DateUtils.getLocalDateString() } ?: defaultDate ?: DateUtils.getLocalDateString())
    }
    var categoryId by remember(isOpen, initialData?.id) {
        mutableStateOf(
            initialData?.categoryId ?: categories.firstOrNull { it.type == type }?.id ?: ""
        )
    }
    var accountId by remember(isOpen, initialData?.id) {
        mutableStateOf(
            initialData?.accountId ?: accounts.firstOrNull { it.isDefault }?.id ?: accounts.firstOrNull()?.id ?: ""
        )
    }
    var eventId by remember(isOpen, initialData?.id) {
        mutableStateOf(initialData?.eventId ?: "")
    }
    var note by remember(isOpen, initialData?.id) {
        mutableStateOf(initialData?.note ?: "")
    }
    var tagsInput by remember(isOpen, initialData?.id) {
        mutableStateOf(initialData?.tags?.joinToString(", ") { "#$it" } ?: "")
    }

    var isCreatingCat by remember { mutableStateOf(false) }
    var newCatName by remember { mutableStateOf("") }
    var showCatMenu by remember { mutableStateOf(false) }
    var showAccMenu by remember { mutableStateOf(false) }
    var showEventMenu by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf("") }

    val filteredCategories = remember(categories, type) { categories.filter { it.type == type } }

    // Switch default category when toggling expense/income
    LaunchedEffect(type, filteredCategories) {
        if (filteredCategories.isNotEmpty() && filteredCategories.none { it.id == categoryId }) {
            categoryId = filteredCategories.first().id
        }
    }

    // Frequent recent note suggestions matching web TransactionForm.jsx
    val noteSuggestions = remember(recentTransactions) {
        val counts = mutableMapOf<String, Int>()
        recentTransactions.forEach { t ->
            val n = t.note.trim()
            if (n.isNotEmpty()) counts[n] = (counts[n] ?: 0) + 1
        }
        counts.entries.sortedByDescending { it.value }.map { it.key }.take(10)
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
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
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = if (initialData != null) "Edit Transaction" else "New Transaction",
                    style = MaterialTheme.typography.headlineSmall,
                    color = kc.textPrimary
                )
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Rounded.Close, contentDescription = "Close")
                }
            }

            // Expense / Income Toggle
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(kc.subtleSurface)
                    .padding(4.dp)
            ) {
                listOf("expense" to "Expense", "income" to "Income").forEach { (key, label) ->
                    val selected = type == key
                    val activeColor = if (key == "expense") KharchRose else KharchEmerald
                    Surface(
                        onClick = { type = key },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp),
                        color = if (selected) activeColor else Color.Transparent
                    ) {
                        Box(Modifier.padding(vertical = 9.dp), contentAlignment = Alignment.Center) {
                            Text(
                                label,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (selected) Color.White else kc.textMuted
                            )
                        }
                    }
                }
            }

            if (errorMsg.isNotBlank()) {
                Text(errorMsg, color = KharchRose, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }

            // Amount
            OutlinedTextField(
                value = amountText,
                onValueChange = { amountText = it; errorMsg = "" },
                label = { Text("Amount (₹) *") },
                prefix = { Text("₹ ", fontWeight = FontWeight.Bold) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )

            // Quick Date Chips + Picker
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(
                        "Today" to DateUtils.getOffsetDateString(0),
                        "Yesterday" to DateUtils.getOffsetDateString(1),
                        "2d ago" to DateUtils.getOffsetDateString(2),
                        "3d ago" to DateUtils.getOffsetDateString(3)
                    ).forEach { (lbl, dStr) ->
                        val active = date == dStr
                        FilterChip(
                            selected = active,
                            onClick = { date = dStr },
                            label = { Text(lbl, fontSize = 11.sp) }
                        )
                    }
                }
                DatePickerField(label = "Date *", value = date, onDateSelected = { date = it })
            }

            // Category Dropdown + Inline Create
            Column {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("Category *", style = MaterialTheme.typography.labelMedium, color = kc.textMuted)
                    TextButton(onClick = { isCreatingCat = !isCreatingCat }, contentPadding = PaddingValues(0.dp)) {
                        Text(if (isCreatingCat) "Cancel" else "+ New Category", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = KharchIndigo)
                    }
                }
                if (isCreatingCat) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(
                            value = newCatName,
                            onValueChange = { newCatName = it },
                            placeholder = { Text("Category name", fontSize = 12.sp) },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        )
                        Button(
                            onClick = {
                                if (newCatName.isBlank()) return@Button
                                scope.launch {
                                    val created = onCreateCategory(newCatName, type)
                                    if (created != null) {
                                        categoryId = created.id
                                        newCatName = ""
                                        isCreatingCat = false
                                    }
                                }
                            },
                            shape = RoundedCornerShape(12.dp)
                        ) { Text("Add") }
                    }
                } else {
                    val selectedCat = filteredCategories.firstOrNull { it.id == categoryId }
                    Box {
                        Surface(
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { showCatMenu = true },
                            shape = RoundedCornerShape(12.dp),
                            color = kc.subtleSurface,
                            border = BorderStroke(1.dp, kc.cardBorder)
                        ) {
                            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    CategoryIconBadge(selectedCat?.icon, selectedCat?.color, size = 28.dp, cornerRadius = 8.dp)
                                    Text(
                                        selectedCat?.name ?: "Select category",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = kc.textPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                                Icon(Icons.Rounded.ArrowDropDown, contentDescription = null, tint = kc.textMuted)
                            }
                        }
                        DropdownMenu(expanded = showCatMenu, onDismissRequest = { showCatMenu = false }) {
                            filteredCategories.forEach { c ->
                                DropdownMenuItem(
                                    text = { Text(c.name) },
                                    leadingIcon = { CategoryIconBadge(c.icon, c.color, size = 24.dp, cornerRadius = 6.dp) },
                                    onClick = { categoryId = c.id; showCatMenu = false }
                                )
                            }
                        }
                    }
                }
            }

            // Account Selector
            if (accounts.isNotEmpty()) {
                val selAcc = accounts.firstOrNull { it.id == accountId } ?: accounts.first()
                Column {
                    Text("Account / Wallet", style = MaterialTheme.typography.labelMedium, color = kc.textMuted)
                    Spacer(Modifier.height(4.dp))
                    Box {
                        Surface(
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { showAccMenu = true },
                            shape = RoundedCornerShape(12.dp),
                            color = kc.subtleSurface,
                            border = BorderStroke(1.dp, kc.cardBorder)
                        ) {
                            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    CategoryIconBadge(selAcc.icon, selAcc.color, size = 28.dp, cornerRadius = 8.dp)
                                    Text(
                                        "${selAcc.name} (${CurrencyUtils.formatInr(selAcc.balance, isPrivacyMode)})",
                                        fontSize = 13.sp,
                                        color = kc.textPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                                Icon(Icons.Rounded.ArrowDropDown, contentDescription = null, tint = kc.textMuted)
                            }
                        }
                        DropdownMenu(expanded = showAccMenu, onDismissRequest = { showAccMenu = false }) {
                            accounts.forEach { acc ->
                                DropdownMenuItem(
                                    text = { Text("${acc.name} (${CurrencyUtils.formatInr(acc.balance, isPrivacyMode)})") },
                                    onClick = { accountId = acc.id; showAccMenu = false }
                                )
                            }
                        }
                    }
                }
            }

            // Note + Recent Note Chips
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("Note / Description") },
                placeholder = { Text("e.g. Lunch, Uber, Groceries") },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )
            if (noteSuggestions.isNotEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    noteSuggestions.forEach { s ->
                        SuggestionChip(
                            onClick = { note = s },
                            label = { Text(s, fontSize = 11.sp) }
                        )
                    }
                }
            }

            // Event Link
            if (events.isNotEmpty() && type == "expense") {
                val selEv = events.firstOrNull { it.id == eventId }
                Column {
                    Text("Link to Trip / Event (Optional)", style = MaterialTheme.typography.labelMedium, color = kc.textMuted)
                    Spacer(Modifier.height(4.dp))
                    Box {
                        Surface(
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable { showEventMenu = true },
                            shape = RoundedCornerShape(12.dp),
                            color = kc.subtleSurface,
                            border = BorderStroke(1.dp, kc.cardBorder)
                        ) {
                            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(
                                    selEv?.let { "${it.name} (#${it.tag})" } ?: "None",
                                    fontSize = 13.sp,
                                    color = kc.textPrimary,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f)
                                )
                                Icon(Icons.Rounded.ArrowDropDown, contentDescription = null, tint = kc.textMuted)
                            }
                        }
                        DropdownMenu(expanded = showEventMenu, onDismissRequest = { showEventMenu = false }) {
                            DropdownMenuItem(text = { Text("None") }, onClick = { eventId = ""; showEventMenu = false })
                            events.forEach { ev ->
                                DropdownMenuItem(
                                    text = { Text("${ev.name} (#${ev.tag})") },
                                    onClick = { eventId = ev.id; showEventMenu = false }
                                )
                            }
                        }
                    }
                }
            }

            // Custom Tags
            OutlinedTextField(
                value = tagsInput,
                onValueChange = { tagsInput = it },
                label = { Text("Tags (Optional, comma separated)") },
                placeholder = { Text("e.g. #coffee, #office") },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )

            Button(
                onClick = {
                    val amt = amountText.trim().toDoubleOrNull()
                    if (amt == null || amt <= 0.0) {
                        errorMsg = "Please enter an amount greater than 0"
                        return@Button
                    }
                    val parsedTags = tagsInput.split(",")
                        .map { it.trim().removePrefix("#") }
                        .filter { it.isNotBlank() }
                    val evTag = events.firstOrNull { it.id == eventId }?.tag
                    val payload = Transaction(
                        id = initialData?.id ?: "",
                        amount = amt,
                        type = type,
                        categoryId = categoryId.ifBlank { null },
                        date = date.ifBlank { DateUtils.getLocalDateString() },
                        note = note.trim(),
                        tags = parsedTags,
                        accountId = accountId.ifBlank { null },
                        eventId = eventId.ifBlank { null },
                        eventTag = evTag,
                        createdAt = initialData?.createdAt ?: ""
                    )
                    onSave(payload) { onDismiss() }
                },
                colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(50.dp)
            ) {
                Text(if (initialData != null) "Update Transaction" else "Log Transaction", fontWeight = FontWeight.Bold)
            }
        }
    }
}
