package com.example.kharch.util

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

object DateUtils {
    private val isoFormatter: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE
    private val displayFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.UK)
    private val shortDisplayFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("dd MMM", Locale.UK)
    private val headerFormatter: DateTimeFormatter = DateTimeFormatter.ofPattern("EEE, dd MMM yyyy", Locale.UK)

    fun getLocalDateString(date: LocalDate = LocalDate.now()): String {
        return date.format(isoFormatter)
    }

    fun getOffsetDateString(daysAgo: Long): String {
        return LocalDate.now().minusDays(daysAgo).format(isoFormatter)
    }

    fun parseLocalDate(raw: String?): LocalDate? {
        if (raw.isNullOrBlank()) return null
        val trimmed = raw.trim()
        // Direct YYYY-MM-DD prefix
        if (trimmed.length >= 10 && trimmed[4] == '-' && trimmed[7] == '-') {
            return runCatching { LocalDate.parse(trimmed.substring(0, 10), isoFormatter) }.getOrNull()
        }
        // Fallback ISO instant
        return runCatching {
            Instant.parse(trimmed).atZone(ZoneId.systemDefault()).toLocalDate()
        }.getOrNull()
    }

    fun formatDisplayDate(raw: String?, short: Boolean = false): String {
        if (raw.isNullOrBlank()) return ""
        val parsed = parseLocalDate(raw) ?: return raw
        return parsed.format(if (short) shortDisplayFormatter else displayFormatter)
    }

    fun formatDateGroupHeader(dateKey: String): String {
        if (dateKey.isBlank() || dateKey == "Unknown Date") return "Unknown Date"
        val parsed = parseLocalDate(dateKey) ?: return dateKey
        val today = LocalDate.now()
        val yesterday = today.minusDays(1)
        val formatted = parsed.format(headerFormatter)
        return when (parsed) {
            today -> "Today - $formatted"
            yesterday -> "Yesterday - $formatted"
            else -> formatted
        }
    }

    /**
     * Exact parity with web calculateNextDueDate:
     * Clamps day-of-month to target month's length (Jan 31 -> Feb 28/29 -> Mar 31).
     */
    fun calculateNextDueDate(currentDueDateStr: String, frequency: String): String {
        val d = parseLocalDate(currentDueDateStr) ?: return currentDueDateStr
        val next = when (frequency.lowercase()) {
            "daily" -> d.plusDays(1)
            "weekly" -> d.plusWeeks(1)
            "monthly" -> d.plusMonths(1) // java.time.LocalDate.plusMonths already clamps Jan 31 -> Feb 28/29!
            "yearly" -> d.plusYears(1)   // java.time.LocalDate.plusYears clamps Feb 29 -> Feb 28!
            else -> d.plusMonths(1)
        }
        return next.format(isoFormatter)
    }

    fun daysUntil(targetDateStr: String?): Long? {
        val d = parseLocalDate(targetDateStr) ?: return null
        return ChronoUnit.DAYS.between(LocalDate.now(), d)
    }

    fun isCurrentMonth(dateStr: String?): Boolean {
        val d = parseLocalDate(dateStr) ?: return false
        val now = LocalDate.now()
        return d.year == now.year && d.month == now.month
    }

    fun currentYearMonthPrefix(): String {
        val now = LocalDate.now()
        return "%04d-%02d".format(now.year, now.monthValue)
    }
}
