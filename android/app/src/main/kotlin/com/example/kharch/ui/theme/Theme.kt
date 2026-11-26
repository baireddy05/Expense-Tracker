package com.example.kharch.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import com.example.kharch.model.AppThemeMode

data class KharchColors(
    val isDark: Boolean,
    val background: Color,
    val card: Color,
    val cardBorder: Color,
    val subtleSurface: Color,
    val textPrimary: Color,
    val textMuted: Color,
    val primaryButtonBg: Color,
    val primaryButtonFg: Color,
    val dockBg: Color
)

val LocalKharchColors = staticCompositionLocalOf {
    KharchColors(
        isDark = false,
        background = KharchLightBg,
        card = KharchLightCard,
        cardBorder = KharchLightBorder,
        subtleSurface = KharchLightSubtle,
        textPrimary = KharchLightText,
        textMuted = KharchLightMuted,
        primaryButtonBg = Color(0xFF18181B),
        primaryButtonFg = Color.White,
        dockBg = Color(0xF5FFFFFF)
    )
}

private val LightScheme = lightColorScheme(
    primary = Color(0xFF18181B),
    onPrimary = Color.White,
    secondary = KharchIndigo,
    onSecondary = Color.White,
    background = KharchLightBg,
    onBackground = KharchLightText,
    surface = KharchLightCard,
    onSurface = KharchLightText,
    surfaceVariant = KharchLightSubtle,
    onSurfaceVariant = KharchLightMuted,
    outline = KharchLightBorder,
    error = KharchRose,
    onError = Color.White
)

private val DarkScheme = darkColorScheme(
    primary = Color(0xFFF4F4F5),
    onPrimary = Color(0xFF09090B),
    secondary = KharchIndigo,
    onSecondary = Color.White,
    background = KharchDarkBg,
    onBackground = KharchDarkText,
    surface = KharchDarkCard,
    onSurface = KharchDarkText,
    surfaceVariant = KharchDarkSubtle,
    onSurfaceVariant = KharchDarkMuted,
    outline = KharchDarkBorder,
    error = KharchRose,
    onError = Color.White
)

@Composable
fun KharchTheme(
    themeMode: AppThemeMode = AppThemeMode.SYSTEM,
    content: @Composable () -> Unit
) {
    val isDark = when (themeMode) {
        AppThemeMode.LIGHT -> false
        AppThemeMode.DARK -> true
        AppThemeMode.SYSTEM -> isSystemInDarkTheme()
    }

    val customColors = if (isDark) {
        KharchColors(
            isDark = true,
            background = KharchDarkBg,
            card = KharchDarkCard,
            cardBorder = KharchDarkBorder,
            subtleSurface = KharchDarkSubtle,
            textPrimary = KharchDarkText,
            textMuted = KharchDarkMuted,
            primaryButtonBg = Color(0xFFF4F4F5),
            primaryButtonFg = Color(0xFF09090B),
            dockBg = Color(0xF0121218)
        )
    } else {
        KharchColors(
            isDark = false,
            background = KharchLightBg,
            card = KharchLightCard,
            cardBorder = KharchLightBorder,
            subtleSurface = KharchLightSubtle,
            textPrimary = KharchLightText,
            textMuted = KharchLightMuted,
            primaryButtonBg = Color(0xFF18181B),
            primaryButtonFg = Color.White,
            dockBg = Color(0xF5FFFFFF)
        )
    }

    CompositionLocalProvider(LocalKharchColors provides customColors) {
        MaterialTheme(
            colorScheme = if (isDark) DarkScheme else LightScheme,
            typography = Typography,
            content = content
        )
    }
}
