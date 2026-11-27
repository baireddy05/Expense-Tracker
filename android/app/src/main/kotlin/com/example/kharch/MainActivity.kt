package com.example.kharch

import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.kharch.model.AppThemeMode
import com.example.kharch.ui.KharchAppShell
import com.example.kharch.ui.theme.KharchTheme
import com.example.kharch.ui.viewmodel.KharchViewModel

class MainActivity : ComponentActivity() {
    private var targetRefreshRate by mutableFloatStateOf(0f)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        configureHighRefreshRateDisplay()
        setContent {
            val vm: KharchViewModel = viewModel()
            val state by vm.state.collectAsState()
            val systemDark = isSystemInDarkTheme()
            val isDark = when (state.themeMode) {
                AppThemeMode.LIGHT -> false
                AppThemeMode.DARK -> true
                AppThemeMode.SYSTEM -> systemDark
            }
            DisposableEffect(isDark) {
                enableEdgeToEdge(
                    statusBarStyle = SystemBarStyle.auto(
                        Color.TRANSPARENT,
                        Color.TRANSPARENT,
                        detectDarkMode = { isDark }
                    ),
                    navigationBarStyle = SystemBarStyle.auto(
                        Color.TRANSPARENT,
                        Color.TRANSPARENT,
                        detectDarkMode = { isDark }
                    )
                )
                onDispose {}
            }
            KharchTheme(
                themeMode = state.themeMode,
                targetRefreshRate = targetRefreshRate
            ) {
                KharchAppShell(vm = vm)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        configureHighRefreshRateDisplay()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        configureHighRefreshRateDisplay()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) configureHighRefreshRateDisplay()
    }

    private fun configureHighRefreshRateDisplay() {
        runCatching {
            val activeDisplay = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) display else @Suppress("DEPRECATION") windowManager.defaultDisplay
            val currentMode = activeDisplay?.mode
            val bestMode = activeDisplay?.supportedModes
                ?.filter { m ->
                    currentMode == null ||
                        (m.physicalWidth == currentMode.physicalWidth && m.physicalHeight == currentMode.physicalHeight)
                }
                ?.maxByOrNull { it.refreshRate }
            if (bestMode != null) {
                targetRefreshRate = bestMode.refreshRate
                window.attributes = window.attributes.apply {
                    preferredDisplayModeId = bestMode.modeId
                    preferredRefreshRate = bestMode.refreshRate
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                window.setFrameRateBoostOnTouchEnabled(true)
                window.setFrameRatePowerSavingsBalanced(false)
                val maxHz = bestMode?.refreshRate ?: 0f
                window.decorView.requestedFrameRate = if (maxHz >= 90f) maxHz else View.REQUESTED_FRAME_RATE_CATEGORY_HIGH
            }
        }
    }
}
