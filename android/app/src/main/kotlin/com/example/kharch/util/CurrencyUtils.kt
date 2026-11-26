package com.example.kharch.util

import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs

object CurrencyUtils {
    private val inrLocale = Locale.Builder().setLanguage("en").setRegion("IN").build()

    fun formatInr(amount: Double, isPrivacyMode: Boolean = false, includeDecimals: Boolean = true): String {
        if (isPrivacyMode) return "₹••••••"
        val formatter = NumberFormat.getCurrencyInstance(inrLocale).apply {
            maximumFractionDigits = if (includeDecimals) 2 else 0
            minimumFractionDigits = if (includeDecimals && amount % 1.0 != 0.0) 2 else 0
        }
        return formatter.format(amount)
    }

    fun formatInrNumber(amount: Double, isPrivacyMode: Boolean = false): String {
        if (isPrivacyMode) return "₹••••••"
        val formatter = NumberFormat.getNumberInstance(inrLocale).apply {
            maximumFractionDigits = if (abs(amount % 1.0) > 0.001) 2 else 0
        }
        return "₹${formatter.format(amount)}"
    }

    fun formatCompactInr(amount: Double, isPrivacyMode: Boolean = false): String {
        if (isPrivacyMode) return "••••"
        val absVal = abs(amount)
        val sign = if (amount < 0) "-" else ""
        return when {
            absVal >= 10000000 -> "${sign}₹${"%.1f".format(absVal / 10000000)}Cr"
            absVal >= 100000 -> "${sign}₹${"%.1f".format(absVal / 100000)}L"
            absVal >= 1000 -> "${sign}₹${"%.1f".format(absVal / 1000)}k"
            else -> "${sign}₹${absVal.toInt()}"
        }
    }
}
