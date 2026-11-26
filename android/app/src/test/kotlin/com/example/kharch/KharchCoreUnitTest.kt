package com.example.kharch

import com.example.kharch.data.FirebaseRestClient
import com.example.kharch.model.AppRoute
import com.example.kharch.model.Category
import com.example.kharch.util.CategoryEngine
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils
import com.example.kharch.util.ShareAndPdfUtils
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class KharchCoreUnitTest {

    @Test
    fun calculateNextDueDate_clampsMonthEndWithoutDrift() {
        assertEquals("2026-02-28", DateUtils.calculateNextDueDate("2026-01-31", "monthly"))
        assertEquals("2024-02-29", DateUtils.calculateNextDueDate("2024-01-31", "monthly"))
        assertEquals("2025-02-28", DateUtils.calculateNextDueDate("2024-02-29", "yearly"))
        assertEquals("2026-03-08", DateUtils.calculateNextDueDate("2026-03-01", "weekly"))
    }

    @Test
    fun normalizePhoneForWhatsApp_addsIndiaPrefixFor10Digits() {
        assertEquals("919876543210", ShareAndPdfUtils.normalizePhoneForWhatsApp("9876543210"))
        assertEquals("919876543210", ShareAndPdfUtils.normalizePhoneForWhatsApp("09876543210"))
        assertEquals("919876543210", ShareAndPdfUtils.normalizePhoneForWhatsApp("+91 98765-43210"))
    }

    @Test
    fun categoryEngine_resolvesExplicitIdFirstThenKeywords() {
        val cats = listOf(
            Category(id = "c1", name = "Travel", type = "expense"),
            Category(id = "c2", name = "Food", type = "expense")
        )
        // Explicit categoryId beats food keyword in note
        val explicit = CategoryEngine.resolveCategory("c1", cats, "Dinner at airport")
        assertEquals("c1", explicit?.id)

        // Keyword fallback when id is missing
        val inferred = CategoryEngine.resolveCategory(null, cats, "Afternoon chai and samosa")
        assertEquals("c2", inferred?.id)
    }

    @Test
    fun csvParser_normalizesIndianDatesAndAmounts() {
        assertEquals("2026-03-14", ShareAndPdfUtils.normalizeImportDate("14/03/2026"))
        assertEquals("2026-01-05", ShareAndPdfUtils.normalizeImportDate("2026-01-05"))
        assertEquals("2026-02-12", ShareAndPdfUtils.normalizeImportDate("12 Feb 2026"))
        assertEquals(1250.5, ShareAndPdfUtils.parseCsvAmount("Rs. 1,250.50") ?: 0.0, 0.01)
        assertEquals("income", ShareAndPdfUtils.normalizeCsvType("Cr", "500"))
        assertEquals("expense", ShareAndPdfUtils.normalizeCsvType("Debit", "500"))
    }

    @Test
    fun privacyMode_masksCurrency() {
        assertEquals("₹••••••", CurrencyUtils.formatInr(5000.0, isPrivacyMode = true))
        val visible = CurrencyUtils.formatInr(5000.0, isPrivacyMode = false)
        assertNotNull(visible)
    }

    @Test
    fun firebaseClient_mapsAuthErrorsAndRestoresAllRoutes() {
        assertEquals(10, AppRoute.entries.size)
        assertEquals(AppRoute.DASHBOARD, AppRoute.valueOf("DASHBOARD"))
        val client = FirebaseRestClient()
        assertTrue(client.friendlyAuthError("INVALID_LOGIN_CREDENTIALS").contains("Google"))
        assertTrue(client.friendlyAuthError("EMAIL_EXISTS").contains("already registered"))
        assertTrue(client.friendlyAuthError("USER_DISABLED").contains("disabled"))
        assertTrue(client.friendlyAuthError("INVALID_IDP_RESPONSE").contains("Google authentication token"))
        assertTrue(client.friendlyAuthError("WEAK_PASSWORD").contains("6 characters"))
        assertTrue(client.friendlyAuthError("").contains("internet connection"))
    }
}
