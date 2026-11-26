package com.example.kharch.ui.components

import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.UploadFile
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.model.AccountWithBalance
import com.example.kharch.model.Category
import com.example.kharch.model.Transaction
import com.example.kharch.ui.theme.*
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.ShareAndPdfUtils
import kotlinx.coroutines.launch

private data class CsvPreviewRow(
    val idx: Int,
    val status: String, // "ready" | "duplicate" | "invalid"
    val reason: String = "",
    val tx: Transaction? = null
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CsvImportSheet(
    fileUri: Uri?,
    categories: List<Category>,
    accounts: List<AccountWithBalance>,
    existingTransactions: List<Transaction>,
    onDismiss: () -> Unit,
    onImportBatch: suspend (List<Transaction>) -> Int
) {
    if (fileUri == null) return
    val kc = LocalKharchColors.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var headers by remember { mutableStateOf<List<String>>(emptyList()) }
    var rawRows by remember { mutableStateOf<List<Map<String, String>>>(emptyList()) }
    var parseError by remember { mutableStateOf<String?>(null) }
    var mapping by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var isImporting by remember { mutableStateOf(false) }

    LaunchedEffect(fileUri) {
        runCatching {
            val text = context.contentResolver.openInputStream(fileUri)?.bufferedReader()?.use { it.readText() }
                ?: throw Exception("Unable to read selected CSV file")
            val parsed = ShareAndPdfUtils.parseCsv(text)
            if (parsed.headers.isEmpty() || parsed.rows.isEmpty()) {
                throw Exception("CSV file has no readable rows")
            }
            headers = parsed.headers
            rawRows = parsed.rows
            mapping = ShareAndPdfUtils.autoMapCsvColumns(parsed.headers)
            parseError = null
        }.onFailure { err ->
            parseError = err.message ?: "Failed to parse CSV"
        }
    }

    val existingFingerprints = remember(existingTransactions) {
        existingTransactions.map {
            "${it.date.take(10)}__${"%.2f".format(it.amount)}__${it.type}__${it.note.trim().lowercase()}"
        }.toSet()
    }

    val defaultAccId = remember(accounts) {
        accounts.firstOrNull { it.isDefault }?.id ?: accounts.firstOrNull()?.id
    }

    val previewRows = remember(rawRows, mapping, existingFingerprints, categories) {
        val seenInFile = mutableSetOf<String>()
        rawRows.mapIndexed { idx, row ->
            val rawDate = row[mapping["date"]] ?: ""
            val rawAmt = row[mapping["amount"]] ?: ""
            val rawType = row[mapping["type"]] ?: ""
            val rawCat = row[mapping["category"]] ?: ""
            val rawNote = row[mapping["note"]] ?: ""

            val normDate = ShareAndPdfUtils.normalizeImportDate(rawDate)
            val normAmt = ShareAndPdfUtils.parseCsvAmount(rawAmt)
            if (normDate == null || normAmt == null) {
                CsvPreviewRow(idx, "invalid", if (normDate == null) "Bad date" else "Bad amount")
            } else {
                val txType = ShareAndPdfUtils.normalizeCsvType(rawType, rawAmt)
                val matchedCat = categories.firstOrNull {
                    rawCat.isNotBlank() && it.name.equals(rawCat.trim(), ignoreCase = true) && it.type == txType
                } ?: categories.firstOrNull { it.type == txType }

                val fp = "${normDate}__${"%.2f".format(normAmt)}__${txType}__${rawNote.trim().lowercase()}"
                if (fp in existingFingerprints || fp in seenInFile) {
                    CsvPreviewRow(idx, "duplicate", "Already exists")
                } else {
                    seenInFile.add(fp)
                    CsvPreviewRow(
                        idx = idx,
                        status = "ready",
                        tx = Transaction(
                            amount = normAmt,
                            type = txType,
                            categoryId = matchedCat?.id,
                            date = normDate,
                            note = rawNote.trim(),
                            accountId = defaultAccId
                        )
                    )
                }
            }
        }
    }

    val readyCount = previewRows.count { it.status == "ready" }
    val dupCount = previewRows.count { it.status == "duplicate" }
    val invalidCount = previewRows.count { it.status == "invalid" }

    ModalBottomSheet(
        onDismissRequest = { if (!isImporting) onDismiss() },
        containerColor = kc.card,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .navigationBarsPadding()
                .heightIn(max = 620.dp)
                .padding(horizontal = 18.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Text("Import CSV Statement", style = MaterialTheme.typography.headlineSmall, color = kc.textPrimary)
                    Text("${rawRows.size} row(s) detected", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
                }
                if (!isImporting) {
                    IconButton(onClick = onDismiss) { Icon(Icons.Rounded.Close, contentDescription = "Close") }
                }
            }

            if (parseError != null) {
                Surface(shape = RoundedCornerShape(12.dp), color = KharchRoseSoft, modifier = Modifier.fillMaxWidth()) {
                    Text(parseError!!, color = KharchRose, fontSize = 12.sp, modifier = Modifier.padding(12.dp))
                }
            } else {
                // Column Mappers
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Column Mapping", style = MaterialTheme.typography.labelMedium, color = kc.textMuted)
                    val fields = listOf("date" to "Date *", "amount" to "Amount *", "type" to "Type", "category" to "Category", "note" to "Note")
                    fields.chunked(2).forEach { pair ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            pair.forEach { (key, label) ->
                                var expanded by remember { mutableStateOf(false) }
                                Box(modifier = Modifier.weight(1f)) {
                                    Surface(
                                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable { expanded = true },
                                        shape = RoundedCornerShape(10.dp),
                                        color = kc.subtleSurface,
                                        border = BorderStroke(1.dp, kc.cardBorder)
                                    ) {
                                        Row(Modifier.padding(horizontal = 10.dp, vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                            Text("$label: ${mapping[key]?.ifBlank { "Ignore" } ?: "Ignore"}", fontSize = 11.sp, color = kc.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                                            Icon(Icons.Rounded.ArrowDropDown, contentDescription = null, modifier = Modifier.size(16.dp))
                                        }
                                    }
                                    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                                        DropdownMenuItem(text = { Text("— Ignore —") }, onClick = { mapping = mapping + (key to ""); expanded = false })
                                        headers.forEach { h ->
                                            DropdownMenuItem(text = { Text(h) }, onClick = { mapping = mapping + (key to h); expanded = false })
                                        }
                                    }
                                }
                            }
                            if (pair.size == 1) Spacer(Modifier.weight(1f))
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatusPill("$readyCount ready", KharchEmerald, KharchEmeraldSoft)
                    StatusPill("$dupCount duplicates", KharchAmber, KharchAmberSoft)
                    StatusPill("$invalidCount invalid", KharchRose, KharchRoseSoft)
                }

                LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    items(previewRows.take(50), key = { it.idx }) { row ->
                        Surface(shape = RoundedCornerShape(10.dp), color = kc.subtleSurface, modifier = Modifier.fillMaxWidth()) {
                            Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                                Column(Modifier.weight(1f)) {
                                    Text(
                                        text = row.tx?.note?.ifBlank { row.tx.date } ?: "Row ${row.idx + 1}: ${row.reason}",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = kc.textPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    if (row.tx != null) {
                                        Text("${row.tx.date} • ${row.tx.type}", fontSize = 10.sp, color = kc.textMuted)
                                    }
                                }
                                if (row.tx != null) {
                                    Text(CurrencyUtils.formatInr(row.tx.amount), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (row.tx.type == "income") KharchEmerald else KharchRose)
                                } else {
                                    StatusPill(row.status.uppercase(), if (row.status == "duplicate") KharchAmber else KharchRose, if (row.status == "duplicate") KharchAmberSoft else KharchRoseSoft)
                                }
                            }
                        }
                    }
                }

                Button(
                    onClick = {
                        val toImport = previewRows.mapNotNull { if (it.status == "ready") it.tx else null }
                        if (toImport.isEmpty()) return@Button
                        isImporting = true
                        scope.launch {
                            onImportBatch(toImport)
                            isImporting = false
                            onDismiss()
                        }
                    },
                    enabled = readyCount > 0 && !isImporting,
                    colors = ButtonDefaults.buttonColors(containerColor = KharchEmerald, contentColor = Color.White),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    if (isImporting) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = Color.White)
                    } else {
                        Icon(Icons.Rounded.UploadFile, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Import $readyCount Transaction(s)", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
