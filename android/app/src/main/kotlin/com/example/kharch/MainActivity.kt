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
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.kharch.model.AppThemeMode
import com.example.kharch.ui.KharchAppShell
import com.example.kharch.ui.theme.KharchTheme
import com.example.kharch.ui.viewmodel.KharchViewModel

class MainActivity : ComponentActivity() {
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
                        Color.argb(0xE6, 0xFF, 0xFF, 0xFF),
                        Color.argb(0x80, 0x1B, 0x1B, 0x1B),
                        detectDarkMode = { isDark }
                    )
                )
                onDispose {}
            }
            KharchTheme(themeMode = state.themeMode) {
                KharchAppShell(vm = vm)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        configureHighRefreshRateDisplay()
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
                window.attributes = window.attributes.apply {
                    preferredDisplayModeId = bestMode.modeId
                    preferredRefreshRate = bestMode.refreshRate
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                window.setFrameRateBoostOnTouchEnabled(true)
                window.decorView.requestedFrameRate = View.REQUESTED_FRAME_RATE_CATEGORY_HIGH
            }
        }
    }
}
