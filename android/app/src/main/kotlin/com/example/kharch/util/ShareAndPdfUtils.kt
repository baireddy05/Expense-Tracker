package com.example.kharch.util

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import com.example.kharch.model.Account
import com.example.kharch.model.BorrowedRecord
import com.example.kharch.model.Category
import com.example.kharch.model.LentRecord
import com.example.kharch.model.Transaction
import java.io.File
import java.io.FileOutputStream
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

object ShareAndPdfUtils {

    fun normalizePhoneForWhatsApp(phone: String?): String {
        var clean = (phone ?: "").replace(Regex("\\D"), "").replace(Regex("^0+"), "")
        if (clean.isNotEmpty() && !clean.startsWith("91") && clean.length == 10) {
            clean = "91$clean"
        }
        return clean
    }

    fun openWhatsApp(context: Context, phone: String?, message: String) {
        val clean = normalizePhoneForWhatsApp(phone)
        val encoded = Uri.encode(message)
        val url = if (clean.isNotEmpty()) {
            "https://wa.me/$clean?text=$encoded"
        } else {
            "https://wa.me/?text=$encoded"
        }
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching { context.startActivity(intent) }
    }

    fun shareText(context: Context, title: String, text: String) {
        val sendIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, title)
            putExtra(Intent.EXTRA_TEXT, text)
        }
        val chooser = Intent.createChooser(sendIntent, title).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching { context.startActivity(chooser) }
    }

    fun copyToClipboard(context: Context, text: String, label: String = "Kharch"): Boolean {
        return runCatching {
            val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText(label, text))
            true
        }.getOrDefault(false)
    }

    fun shareFile(context: Context, file: File, mimeType: String, title: String) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, title)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(intent, title).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching { context.startActivity(chooser) }
    }

    private fun exportsDir(context: Context): File {
        return File(context.cacheDir, "exports").apply { mkdirs() }
    }

    private fun formatCurrencyPdf(amount: Double): String {
        val formatter = java.text.NumberFormat.getNumberInstance(Locale.Builder().setLanguage("en").setRegion("IN").build()).apply {
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }
        return "Rs. ${formatter.format(amount)}"
    }

    fun exportTransactionsPdf(
        context: Context,
        transactions: List<Transaction>,
        categories: List<Category>,
        accounts: List<Account>,
        filterSummary: String
    ): File {
        val title = "Kharch - Transactions Report"
        val headers = listOf("Date", "Category", "Note / Account", "Type", "Amount")
        val colWeights = floatArrayOf(0.16f, 0.22f, 0.30f, 0.12f, 0.20f)
        var totalIncome = 0.0
        var totalExpense = 0.0
        val rows = transactions.map { t ->
            val cat = CategoryEngine.resolveCategory(t.categoryId, categories, t.note)
            val accName = accounts.firstOrNull { it.id == (t.accountId ?: t.fromAccountId) }?.name ?: ""
            if (t.type == "income") totalIncome += t.amount
            else if (t.type == "expense") totalExpense += t.amount
            val prefix = if (t.type == "income") "+" else if (t.type == "expense") "-" else ""
            val noteText = buildString {
                append(t.note.ifBlank { "-" })
                if (accName.isNotBlank()) append(" [$accName]")
            }
            listOf(
                DateUtils.formatDisplayDate(t.date, short = true),
                cat?.name ?: if (t.type == "transfer") "Transfer" else "Uncategorized",
                noteText,
                t.type.replaceFirstChar { it.uppercase() },
                "$prefix${formatCurrencyPdf(t.amount)}"
            )
        }
        val footerLines = listOf(
            "Total Income: ${formatCurrencyPdf(totalIncome)}   |   Total Expense: ${formatCurrencyPdf(totalExpense)}   |   Net: ${formatCurrencyPdf(totalIncome - totalExpense)}"
        )
        return renderPdfTable(
            context = context,
            fileName = "kharch_transactions_${DateUtils.getLocalDateString()}.pdf",
            title = title,
            subtitle = "Generated on ${DateUtils.formatDisplayDate(DateUtils.getLocalDateString())}  •  $filterSummary",
            headers = headers,
            colWeights = colWeights,
            rows = rows,
            footerLines = footerLines
        )
    }

    fun exportLentPdf(context: Context, records: List<LentRecord>, filterSummary: String): File {
        val headers = listOf("Borrower", "Date Lent", "Total Lent", "Returned", "Pending", "Status")
        val colWeights = floatArrayOf(0.24f, 0.14f, 0.17f, 0.16f, 0.17f, 0.12f)
        var sumLent = 0.0
        var sumRet = 0.0
        var sumPending = 0.0
        val rows = records.map { r ->
            val rem = (r.amount - r.returnedAmount).coerceAtLeast(0.0)
            sumLent += r.amount
            sumRet += r.returnedAmount
            sumPending += rem
            val status = computeLentStatus(r).uppercase()
            listOf(
                r.borrowerName,
                DateUtils.formatDisplayDate(r.dateLent, short = true),
                formatCurrencyPdf(r.amount),
                formatCurrencyPdf(r.returnedAmount),
                formatCurrencyPdf(rem),
                status
            )
        }
        val footerLines = listOf(
            "TOTAL LENT: ${formatCurrencyPdf(sumLent)}   |   RETURNED: ${formatCurrencyPdf(sumRet)}   |   PENDING: ${formatCurrencyPdf(sumPending)}"
        )
        return renderPdfTable(
            context = context,
            fileName = "kharch_lent_report_${DateUtils.getLocalDateString()}.pdf",
            title = "Kharch - Lent Money Report",
            subtitle = "Generated on ${DateUtils.formatDisplayDate(DateUtils.getLocalDateString())}  •  $filterSummary",
            headers = headers,
            colWeights = colWeights,
            rows = rows,
            footerLines = footerLines
        )
    }

    fun exportBorrowedPdf(context: Context, records: List<BorrowedRecord>, filterSummary: String): File {
        val headers = listOf("Lender", "Borrowed", "Total", "Repaid", "Pending", "Status")
        val colWeights = floatArrayOf(0.24f, 0.14f, 0.17f, 0.16f, 0.17f, 0.12f)
        var sumBor = 0.0
        var sumRep = 0.0
        var sumPending = 0.0
        val rows = records.map { r ->
            val rem = (r.amount - r.returnedAmount).coerceAtLeast(0.0)
            sumBor += r.amount
            sumRep += r.returnedAmount
            sumPending += rem
            val status = computeBorrowStatus(r).uppercase()
            listOf(
                r.lenderName,
                DateUtils.formatDisplayDate(r.dateBorrowed, short = true),
                formatCurrencyPdf(r.amount),
                formatCurrencyPdf(r.returnedAmount),
                formatCurrencyPdf(rem),
                status
            )
        }
        val footerLines = listOf(
            "TOTAL BORROWED: ${formatCurrencyPdf(sumBor)}   |   REPAID: ${formatCurrencyPdf(sumRep)}   |   PENDING DEBT: ${formatCurrencyPdf(sumPending)}"
        )
        return renderPdfTable(
            context = context,
            fileName = "kharch_borrowed_report_${DateUtils.getLocalDateString()}.pdf",
            title = "Kharch - Borrowed Money Report",
            subtitle = "Generated on ${DateUtils.formatDisplayDate(DateUtils.getLocalDateString())}  •  $filterSummary",
            headers = headers,
            colWeights = colWeights,
            rows = rows,
            footerLines = footerLines
        )
    }

    private fun computeLentStatus(r: LentRecord): String {
        val rem = r.amount - r.returnedAmount
        if (rem <= 0.0) return "settled"
        val due = DateUtils.parseLocalDate(r.dueDate)
        if (due != null && due.isBefore(LocalDate.now())) return "overdue"
        return if (r.returnedAmount > 0.0) "partial" else "pending"
    }

    private fun computeBorrowStatus(r: BorrowedRecord): String {
        val rem = r.amount - r.returnedAmount
        if (rem <= 0.0) return "settled"
        val due = DateUtils.parseLocalDate(r.dueDate)
        if (due != null && due.isBefore(LocalDate.now())) return "overdue"
        return if (r.returnedAmount > 0.0) "partial" else "pending"
    }

    private fun renderPdfTable(
        context: Context,
        fileName: String,
        title: String,
        subtitle: String,
        headers: List<String>,
        colWeights: FloatArray,
        rows: List<List<String>>,
        footerLines: List<String>
    ): File {
        val pageWidth = 595 // A4 points
        val pageHeight = 842
        val margin = 28f
        val contentWidth = pageWidth - margin * 2

        val pdf = PdfDocument()
        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(15, 23, 42)
            textSize = 15f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val subtitlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(100, 116, 139)
            textSize = 9f
        }
        val headerBgPaint = Paint().apply { color = Color.rgb(24, 24, 27) }
        val headerTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            textSize = 8.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val altBgPaint = Paint().apply { color = Color.rgb(248, 250, 252) }
        val cellPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(24, 24, 27)
            textSize = 8f
        }
        val borderPaint = Paint().apply {
            color = Color.rgb(226, 232, 240)
            strokeWidth = 0.6f
        }
        val footerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(15, 23, 42)
            textSize = 9f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }

        var pageNumber = 1
        var page = pdf.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
        var canvas: Canvas = page.canvas
        var y = 42f

        fun drawHeaderBlock() {
            canvas.drawText(title, margin, y, titlePaint)
            y += 15f
            canvas.drawText(subtitle, margin, y, subtitlePaint)
            y += 10f
            canvas.drawLine(margin, y, pageWidth - margin, y, borderPaint)
            y += 14f

            // Table header row
            canvas.drawRect(margin, y - 12f, pageWidth - margin, y + 6f, headerBgPaint)
            var x = margin + 4f
            headers.forEachIndexed { idx, h ->
                canvas.drawText(h, x, y, headerTextPaint)
                x += contentWidth * colWeights[idx]
            }
            y += 16f
        }

        drawHeaderBlock()

        val rowHeight = 16f
        rows.forEachIndexed { rIdx, row ->
            if (y > pageHeight - 60f) {
                pdf.finishPage(page)
                pageNumber++
                page = pdf.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
                canvas = page.canvas
                y = 42f
                drawHeaderBlock()
            }
            if (rIdx % 2 == 1) {
                canvas.drawRect(margin, y - 11f, pageWidth - margin, y + 5f, altBgPaint)
            }
            var x = margin + 4f
            row.forEachIndexed { idx, cell ->
                val maxChars = ((contentWidth * colWeights[idx]) / 4.4f).toInt().coerceAtLeast(6)
                val truncated = if (cell.length > maxChars) cell.take(maxChars - 1) + "…" else cell
                canvas.drawText(truncated, x, y, cellPaint)
                x += contentWidth * colWeights[idx]
            }
            canvas.drawLine(margin, y + 5f, pageWidth - margin, y + 5f, borderPaint)
            y += rowHeight
        }

        if (y > pageHeight - 50f) {
            pdf.finishPage(page)
            pageNumber++
            page = pdf.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
            canvas = page.canvas
            y = 42f
        }
        y += 8f
        footerLines.forEach { line ->
            canvas.drawText(line, margin, y, footerPaint)
            y += 14f
        }

        pdf.finishPage(page)

        val outFile = File(exportsDir(context), fileName)
        FileOutputStream(outFile).use { fos -> pdf.writeTo(fos) }
        pdf.close()
        return outFile
    }

    // -----------------------------------------
    // CSV Export & Tolerant Bank/UPI CSV Parser
    // -----------------------------------------

    fun generateTransactionsCsv(
        transactions: List<Transaction>,
        categories: List<Category>,
        accounts: List<Account>
    ): String {
        fun esc(v: String): String {
            val needsQuote = v.contains(',') || v.contains('"') || v.contains('\n') || v.contains('\r')
            return if (needsQuote) "\"${v.replace("\"", "\"\"")}\"" else v
        }
        val sb = StringBuilder()
        sb.appendLine("Date,Type,Category,Amount,Note,Tags,Account,Event")
        transactions.forEach { t ->
            val cat = CategoryEngine.resolveCategory(t.categoryId, categories, t.note)
            val accName = accounts.firstOrNull { it.id == (t.accountId ?: t.fromAccountId) }?.name ?: ""
            val row = listOf(
                t.date.take(10),
                t.type,
                cat?.name ?: "Unknown",
                t.amount.toString(),
                t.note,
                t.tags.joinToString("|"),
                accName,
                t.eventTag?.let { "#$it" } ?: ""
            ).joinToString(",") { esc(it) }
            sb.appendLine(row)
        }
        return sb.toString()
    }

    data class ParsedCsv(val headers: List<String>, val rows: List<Map<String, String>>)

    fun parseCsv(raw: String): ParsedCsv {
        val lines = mutableListOf<List<String>>()
        val currentRow = mutableListOf<String>()
        val currentField = StringBuilder()
        var inQuotes = false
        var i = 0
        val cleanRaw = raw.removePrefix("\uFEFF")

        while (i < cleanRaw.length) {
            val ch = cleanRaw[i]
            when {
                inQuotes -> {
                    if (ch == '"') {
                        if (i + 1 < cleanRaw.length && cleanRaw[i + 1] == '"') {
                            currentField.append('"')
                            i++
                        } else {
                            inQuotes = false
                        }
                    } else {
                        currentField.append(ch)
                    }
                }
                ch == '"' -> inQuotes = true
                ch == ',' -> {
                    currentRow.add(currentField.toString().trim())
                    currentField.clear()
                }
                ch == '\r' -> { /* ignore CR */ }
                ch == '\n' -> {
                    currentRow.add(currentField.toString().trim())
                    currentField.clear()
                    if (currentRow.any { it.isNotEmpty() }) lines.add(currentRow.toList())
                    currentRow.clear()
                }
                else -> currentField.append(ch)
            }
            i++
        }
        if (currentField.isNotEmpty() || currentRow.isNotEmpty()) {
            currentRow.add(currentField.toString().trim())
            if (currentRow.any { it.isNotEmpty() }) lines.add(currentRow.toList())
        }

        if (lines.isEmpty()) return ParsedCsv(emptyList(), emptyList())
        val headers = lines.first().mapIndexed { idx, h -> h.ifBlank { "Column ${idx + 1}" } }
        val rows = lines.drop(1).map { row ->
            headers.mapIndexed { idx, h -> h to row.getOrElse(idx) { "" } }.toMap()
        }
        return ParsedCsv(headers, rows)
    }

    fun normalizeImportDate(raw: String?): String? {
        val s = raw?.trim() ?: return null
        if (s.isBlank()) return null

        // YYYY-MM-DD
        Regex("^(\\d{4})-(\\d{1,2})-(\\d{1,2})").find(s)?.let { m ->
            val y = m.groupValues[1].toIntOrNull() ?: return null
            val mo = m.groupValues[2].toIntOrNull() ?: return null
            val d = m.groupValues[3].toIntOrNull() ?: return null
            return runCatching { LocalDate.of(y, mo, d).format(DateTimeFormatter.ISO_LOCAL_DATE) }.getOrNull()
        }

        // DD/MM/YYYY or DD-MM-YYYY
        Regex("^(\\d{1,2})[/\\-.](\\d{1,2})[/\\-.](\\d{2,4})").find(s)?.let { m ->
            var a = m.groupValues[1].toIntOrNull() ?: return null
            var b = m.groupValues[2].toIntOrNull() ?: return null
            var y = m.groupValues[3].toIntOrNull() ?: return null
            if (y < 100) y += 2000
            if (b > 12 && a <= 12) {
                val tmp = a; a = b; b = tmp
            }
            return runCatching { LocalDate.of(y, b, a).format(DateTimeFormatter.ISO_LOCAL_DATE) }.getOrNull()
        }

        // e.g. "12 Jan 2026"
        val patterns = listOf("dd MMM yyyy", "d MMM yyyy", "dd MMMM yyyy", "MMM d, yyyy", "yyyy/MM/dd")
        for (p in patterns) {
            val parsed = runCatching {
                LocalDate.parse(s, DateTimeFormatter.ofPattern(p, Locale.ENGLISH))
                    .format(DateTimeFormatter.ISO_LOCAL_DATE)
            }.getOrNull()
            if (parsed != null) return parsed
        }
        return null
    }

    fun parseCsvAmount(raw: String?): Double? {
        if (raw.isNullOrBlank()) return null
        val strippedCurrency = raw.trim()
            .replace(Regex("(?i)\\b(rs\\.?|inr)\\b"), "")
            .replace("₹", "")
            .replace("$", "")
            .replace(",", "")
        val match = Regex("[-+]?\\d+(?:\\.\\d+)?").find(strippedCurrency) ?: return null
        val num = match.value.toDoubleOrNull() ?: return null
        return if (num.isFinite() && num != 0.0) kotlin.math.abs(num) else null
    }

    private val EXPENSE_WORDS = setOf("expense", "expenses", "debit", "debits", "dr", "out", "spent", "paid", "payment", "withdrawal", "debit card")
    private val INCOME_WORDS = setOf("income", "incomes", "credit", "credits", "cr", "in", "received", "deposit", "salary", "refund")

    fun normalizeCsvType(rawType: String?, rawAmount: String?): String {
        val t = rawType?.trim()?.lowercase() ?: ""
        if (t in INCOME_WORDS) return "income"
        if (t in EXPENSE_WORDS) return "expense"
        val amtText = rawAmount?.trim()?.lowercase() ?: ""
        if (amtText.startsWith("+") || amtText.contains("cr")) return "income"
        return "expense"
    }

    fun autoMapCsvColumns(headers: List<String>): Map<String, String> {
        val aliases = mapOf(
            "date" to listOf("date", "txn date", "transaction date", "day", "value date", "posting date"),
            "type" to listOf("type", "txn type", "transaction type", "dr/cr", "debit/credit", "debit or credit", "kind"),
            "category" to listOf("category", "cat", "head", "expense head", "class"),
            "amount" to listOf("amount", "amt", "value", "price", "rs", "rs.", "inr", "debit", "credit", "withdrawal", "deposit"),
            "note" to listOf("note", "narration", "description", "remarks", "memo", "details", "particulars", "comment")
        )
        val result = mutableMapOf<String, String>()
        val lowerHeaders = headers.associateWith { it.trim().lowercase() }
        aliases.forEach { (field, candidateNames) ->
            val match = headers.firstOrNull { h ->
                val lh = lowerHeaders[h] ?: ""
                candidateNames.any { alias -> lh == alias || lh.contains(alias) }
            }
            result[field] = match ?: ""
        }
        return result
    }
}
