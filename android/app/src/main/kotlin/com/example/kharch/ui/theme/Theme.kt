package com.example.kharch.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.FrameRateCategory
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.preferredFrameRate
import com.example.kharch.model.AppThemeMode

@Immutable
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

val LocalTargetRefreshRate = staticCompositionLocalOf { 0f }

fun Modifier.kharchHighFrameRate(targetHz: Float): Modifier =
    if (targetHz >= 90f) preferredFrameRate(targetHz) else preferredFrameRate(FrameRateCategory.High)

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
    primaryContainer = Color(0xFF18181B),
    onPrimaryContainer = Color.White,
    secondary = KharchIndigo,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFF18181B),
    onSecondaryContainer = Color.White,
    tertiary = KharchEmerald,
    onTertiary = Color.White,
    tertiaryContainer = KharchEmeraldSoft,
    onTertiaryContainer = KharchEmerald,
    background = KharchLightBg,
    onBackground = KharchLightText,
    surface = KharchLightCard,
    onSurface = KharchLightText,
    surfaceVariant = KharchLightSubtle,
    onSurfaceVariant = KharchLightMuted,
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = KharchLightBg,
    surfaceContainer = KharchLightCard,
    surfaceContainerHigh = KharchLightSubtle,
    surfaceContainerHighest = Color(0xFFE2E8F0),
    outline = KharchLightBorder,
    outlineVariant = KharchLightBorder,
    error = KharchRose,
    onError = Color.White
)

private val DarkScheme = darkColorScheme(
    primary = Color(0xFFF4F4F5),
    onPrimary = Color(0xFF09090B),
    primaryContainer = KharchDarkElevated,
    onPrimaryContainer = KharchDarkText,
    secondary = KharchIndigo,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFF4F4F5),
    onSecondaryContainer = Color(0xFF09090B),
    tertiary = KharchEmerald,
    onTertiary = Color.White,
    tertiaryContainer = KharchEmeraldSoft,
    onTertiaryContainer = KharchEmerald,
    background = KharchDarkBg,
    onBackground = KharchDarkText,
    surface = KharchDarkCard,
    onSurface = KharchDarkText,
    surfaceVariant = KharchDarkSubtle,
    onSurfaceVariant = KharchDarkMuted,
    surfaceContainerLowest = KharchDarkBg,
    surfaceContainerLow = KharchDarkCard,
    surfaceContainer = KharchDarkCard,
    surfaceContainerHigh = KharchDarkElevated,
    surfaceContainerHighest = Color(0xFF272733),
    outline = KharchDarkBorder,
    outlineVariant = Color(0x2EFFFFFF),
    error = KharchRose,
    onError = Color.White
)

@Composable
fun KharchTheme(
    themeMode: AppThemeMode = AppThemeMode.SYSTEM,
    targetRefreshRate: Float = 0f,
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

    CompositionLocalProvider(
        LocalKharchColors provides customColors,
        LocalTargetRefreshRate provides targetRefreshRate
    ) {
        MaterialTheme(
            colorScheme = if (isDark) DarkScheme else LightScheme,
            typography = Typography,
            content = content
        )
    }
}
