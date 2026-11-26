package com.example.kharch.util

import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs

object CurrencyUtils {
    private val inrLocale = Locale.Builder().setLanguage("en").setRegion("IN").build()

    // Cached per-thread formatters prevent heavy DecimalFormat/Locale allocations on every 120Hz frame
    private val intCurrencyFmt: ThreadLocal<NumberFormat> = ThreadLocal.withInitial {
        NumberFormat.getCurrencyInstance(inrLocale).apply {
            maximumFractionDigits = 0
            minimumFractionDigits = 0
        }
    }

    private val decCurrencyFmt: ThreadLocal<NumberFormat> = ThreadLocal.withInitial {
        NumberFormat.getCurrencyInstance(inrLocale).apply {
            maximumFractionDigits = 2
            minimumFractionDigits = 2
        }
    }

    private val intNumFmt: ThreadLocal<NumberFormat> = ThreadLocal.withInitial {
        NumberFormat.getNumberInstance(inrLocale).apply {
            maximumFractionDigits = 0
            minimumFractionDigits = 0
        }
    }

    private val decNumFmt: ThreadLocal<NumberFormat> = ThreadLocal.withInitial {
        NumberFormat.getNumberInstance(inrLocale).apply {
            maximumFractionDigits = 2
            minimumFractionDigits = 0
        }
    }

    fun formatInr(amount: Double, isPrivacyMode: Boolean = false, includeDecimals: Boolean = true): String {
        if (isPrivacyMode) return "₹••••••"
        val hasFraction = includeDecimals && abs(amount % 1.0) > 0.001
        val formatter = (if (hasFraction) decCurrencyFmt.get() else intCurrencyFmt.get())
            ?: return "₹${amount.toLong()}"
        return formatter.format(amount)
    }

    fun formatInrNumber(amount: Double, isPrivacyMode: Boolean = false): String {
        if (isPrivacyMode) return "₹••••••"
        val hasFraction = abs(amount % 1.0) > 0.001
        val formatter = (if (hasFraction) decNumFmt.get() else intNumFmt.get())
            ?: return "₹${amount.toLong()}"
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
