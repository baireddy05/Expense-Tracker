package com.example.kharch.ui.components

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.model.BorrowedRecord
import com.example.kharch.model.LentRecord
import com.example.kharch.ui.theme.*
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils
import com.example.kharch.util.ShareAndPdfUtils

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PersonLoanFormSheet(
    isOpen: Boolean,
    isLentMode: Boolean,
    initialName: String = "",
    initialAmount: String = "",
    initialDate: String = DateUtils.getLocalDateString(),
    initialDueDate: String = "",
    initialPhone: String = "",
    initialNote: String = "",
    isEditing: Boolean = false,
    nameSuggestions: List<String>,
    noteSuggestions: List<String>,
    onDismiss: () -> Unit,
    onSubmit: (name: String, amount: Double, date: String, dueDate: String?, phone: String?, note: String?) -> Unit
) {
    if (!isOpen) return
    val kc = LocalKharchColors.current
    var name by remember(isOpen, initialName) { mutableStateOf(initialName) }
    var amount by remember(isOpen, initialAmount) { mutableStateOf(initialAmount) }
    var date by remember(isOpen, initialDate) { mutableStateOf(initialDate) }
    var dueDate by remember(isOpen, initialDueDate) { mutableStateOf(initialDueDate) }
    var phone by remember(isOpen, initialPhone) { mutableStateOf(initialPhone) }
    var note by remember(isOpen, initialNote) { mutableStateOf(initialNote) }
    var errorMsg by remember { mutableStateOf("") }

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
                    text = if (isLentMode) {
                        if (isEditing) "Edit Lent Record" else "Lend Money to Friend"
                    } else {
                        if (isEditing) "Edit Borrowed Record" else "Record Borrowed Money"
                    },
                    style = MaterialTheme.typography.headlineSmall,
                    color = kc.textPrimary
                )
                IconButton(onClick = onDismiss) { Icon(Icons.Rounded.Close, contentDescription = "Close") }
            }

            if (errorMsg.isNotBlank()) Text(errorMsg, color = KharchRose, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)

            OutlinedTextField(
                value = name,
                onValueChange = { name = it; errorMsg = "" },
                label = { Text(if (isLentMode) "Borrower Name *" else "Lender Name *") },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )
            if (nameSuggestions.isNotEmpty()) {
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    nameSuggestions.take(10).forEach { s ->
                        SuggestionChip(onClick = { name = s }, label = { Text(s, fontSize = 11.sp) })
                    }
                }
            }

            OutlinedTextField(
                value = amount,
                onValueChange = { amount = it; errorMsg = "" },
                label = { Text("Amount (₹) *") },
                prefix = { Text("₹ ", fontWeight = FontWeight.Bold) },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DatePickerField(
                    label = if (isLentMode) "Date Lent *" else "Date Borrowed *",
                    value = date,
                    onDateSelected = { date = it },
                    modifier = Modifier.weight(1f)
                )
                DatePickerField(
                    label = "Due Date (Optional)",
                    value = dueDate,
                    onDateSelected = { dueDate = it },
                    allowClear = true,
                    modifier = Modifier.weight(1f)
                )
            }

            OutlinedTextField(
                value = phone,
                onValueChange = { phone = it },
                label = { Text("Phone / WhatsApp (Optional)") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("Note (Optional)") },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )
            if (noteSuggestions.isNotEmpty()) {
                Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    noteSuggestions.take(8).forEach { s ->
                        SuggestionChip(onClick = { note = s }, label = { Text(s, fontSize = 11.sp) })
                    }
                }
            }

            Button(
                onClick = {
                    val trimmedName = name.trim()
                    val parsedAmt = amount.trim().toDoubleOrNull()
                    if (trimmedName.isBlank()) { errorMsg = "Enter a valid person name"; return@Button }
                    if (parsedAmt == null || parsedAmt <= 0.0) { errorMsg = "Enter an amount greater than 0"; return@Button }
                    if (dueDate.isNotBlank() && date.isNotBlank() && dueDate < date) {
                        errorMsg = "Due date cannot be earlier than transaction date"
                        return@Button
                    }
                    onSubmit(
                        trimmedName,
                        parsedAmt,
                        date.ifBlank { DateUtils.getLocalDateString() },
                        dueDate.ifBlank { null },
                        phone.trim().ifBlank { null },
                        note.trim().ifBlank { null }
                    )
                },
                colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Text(if (isEditing) "Update Record" else "Save Record", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopUpAmountSheet(
    isOpen: Boolean,
    title: String,
    personName: String,
    currentDueDate: String,
    onDismiss: () -> Unit,
    onSubmit: (amount: Double, date: String, dueDate: String?, note: String) -> Unit
) {
    if (!isOpen) return
    val kc = LocalKharchColors.current
    var amount by remember(isOpen) { mutableStateOf("") }
    var date by remember(isOpen) { mutableStateOf(DateUtils.getLocalDateString()) }
    var dueDate by remember(isOpen, currentDueDate) { mutableStateOf(currentDueDate) }
    var note by remember(isOpen) { mutableStateOf("") }
    var err by remember { mutableStateOf("") }

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
            Text("$title — $personName", style = MaterialTheme.typography.headlineSmall, color = kc.textPrimary)
            if (err.isNotBlank()) Text(err, color = KharchRose, fontSize = 12.sp)
            OutlinedTextField(
                value = amount,
                onValueChange = { amount = it; err = "" },
                label = { Text("Additional Amount (₹) *") },
                prefix = { Text("₹ ") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DatePickerField("Date *", date, { date = it }, modifier = Modifier.weight(1f))
                DatePickerField("Due Date", dueDate, { dueDate = it }, allowClear = true, modifier = Modifier.weight(1f))
            }
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("Note (Optional)") },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = {
                    val amt = amount.trim().toDoubleOrNull()
                    if (amt == null || amt <= 0.0) { err = "Enter a valid amount > 0"; return@Button }
                    onSubmit(amt, date, dueDate.ifBlank { null }, note)
                },
                colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Text("Confirm Top-Up", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RepaymentSheet(
    isOpen: Boolean,
    title: String,
    personName: String,
    remainingAmount: Double,
    onDismiss: () -> Unit,
    onSubmit: (amount: Double, date: String, note: String) -> Unit
) {
    if (!isOpen) return
    val kc = LocalKharchColors.current
    var amount by remember(isOpen, remainingAmount) { mutableStateOf(if (remainingAmount > 0) remainingAmount.toString().removeSuffix(".0") else "") }
    var date by remember(isOpen) { mutableStateOf(DateUtils.getLocalDateString()) }
    var note by remember(isOpen) { mutableStateOf("") }
    var err by remember { mutableStateOf("") }

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
            Text("$title — $personName", style = MaterialTheme.typography.headlineSmall, color = kc.textPrimary)
            if (err.isNotBlank()) Text(err, color = KharchRose, fontSize = 12.sp)
            OutlinedTextField(
                value = amount,
                onValueChange = { amount = it; err = "" },
                label = { Text("Repayment Amount (₹) *") },
                prefix = { Text("₹ ") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )
            DatePickerField("Repayment Date *", date, { date = it })
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("Note (Optional)") },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )
            Button(
                onClick = {
                    val amt = amount.trim().toDoubleOrNull()
                    if (amt == null || amt <= 0.0) { err = "Enter a valid repayment amount > 0"; return@Button }
                    onSubmit(amt, date, note)
                },
                colors = ButtonDefaults.buttonColors(containerColor = KharchEmerald, contentColor = Color.White),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Text("Record Repayment", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReminderSheet(
    isOpen: Boolean,
    isLent: Boolean,
    personName: String,
    phone: String?,
    pendingAmount: Double,
    dateStr: String,
    dueDateStr: String?,
    onCopiedToast: () -> Unit,
    onDismiss: () -> Unit
) {
    if (!isOpen) return
    val kc = LocalKharchColors.current
    val context = LocalContext.current
    val formattedPending = CurrencyUtils.formatInr(pendingAmount)
    val defaultMsg = remember(isLent, personName, pendingAmount, dateStr, dueDateStr) {
        if (isLent) {
            buildString {
                append("Hi $personName, hope you are doing well! Gentle reminder regarding the $formattedPending")
                if (dateStr.isNotBlank()) append(" lent on ${DateUtils.formatDisplayDate(dateStr)}")
                append(".")
                if (!dueDateStr.isNullOrBlank()) append(" Due date: ${DateUtils.formatDisplayDate(dueDateStr)}.")
                append(" Please let me know when you can settle it. Thank you!")
            }
        } else {
            buildString {
                append("Hi $personName, quick update regarding the $formattedPending I borrowed")
                if (dateStr.isNotBlank()) append(" on ${DateUtils.formatDisplayDate(dateStr)}")
                append(". Keeping track to pay you back soon!")
                if (!dueDateStr.isNullOrBlank()) append(" Planned date: ${DateUtils.formatDisplayDate(dueDateStr)}.")
            }
        }
    }
    var messageText by remember(defaultMsg) { mutableStateOf(defaultMsg) }

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
                Text(if (isLent) "Send Payment Reminder" else "Message $personName", style = MaterialTheme.typography.headlineSmall, color = kc.textPrimary)
                IconButton(onClick = onDismiss) { Icon(Icons.Rounded.Close, contentDescription = "Close") }
            }

            if (isLent) {
                Surface(shape = RoundedCornerShape(14.dp), color = kc.subtleSurface, modifier = Modifier.fillMaxWidth()) {
                    Text(messageText, style = MaterialTheme.typography.bodyMedium, color = kc.textPrimary, modifier = Modifier.padding(14.dp))
                }
            } else {
                OutlinedTextField(
                    value = messageText,
                    onValueChange = { messageText = it },
                    label = { Text("Editable Message") },
                    minLines = 3,
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = {
                        if (ShareAndPdfUtils.copyToClipboard(context, messageText)) onCopiedToast()
                    },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(46.dp)
                ) {
                    Icon(Icons.Rounded.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Copy", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }

                OutlinedButton(
                    onClick = { ShareAndPdfUtils.shareText(context, "Kharch Reminder", messageText) },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f).height(46.dp)
                ) {
                    Icon(Icons.Rounded.Share, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Share", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }

            Button(
                onClick = { ShareAndPdfUtils.openWhatsApp(context, phone, messageText) },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF16A34A), contentColor = Color.White),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Icon(Icons.AutoMirrored.Rounded.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Send via WhatsApp", fontWeight = FontWeight.Bold)
            }
        }
    }
}
