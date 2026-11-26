package com.example.kharch.util

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import com.example.kharch.model.HapticIntensity

enum class HapticType {
    SELECTION, LIGHT, MEDIUM, HEAVY, SUCCESS, WARNING, ERROR
}

class HapticEngine(private val context: Context) {
    @Volatile
    var isEnabled: Boolean = true

    @Volatile
    var intensity: HapticIntensity = HapticIntensity.STRONG

    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vm?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    private val lastTapTimes = mutableMapOf<HapticType, Long>()

    fun trigger(type: HapticType) {
        if (!isEnabled) return
        val vib = vibrator ?: return
        if (!vib.hasVibrator()) return

        // Rate-limit tap ticks so rapid navigation doesn't stack buzzes
        val cooldown = when (type) {
            HapticType.SELECTION, HapticType.LIGHT -> 60L
            HapticType.MEDIUM -> 90L
            else -> 0L
        }
        val now = System.currentTimeMillis()
        if (cooldown > 0L) {
            val prev = lastTapTimes[type] ?: 0L
            if (now - prev < cooldown) return
            lastTapTimes[type] = now
        }

        val scale = when (intensity) {
            HapticIntensity.SUBTLE -> 0.55f
            HapticIntensity.MEDIUM -> 0.8f
            HapticIntensity.STRONG -> 1.0f
        }

        runCatching {
            when (type) {
                HapticType.SELECTION -> vib.vibrate(VibrationEffect.createOneShot((30 * scale).toLong().coerceAtLeast(12), VibrationEffect.DEFAULT_AMPLITUDE))
                HapticType.LIGHT -> vib.vibrate(VibrationEffect.createOneShot((45 * scale).toLong().coerceAtLeast(15), VibrationEffect.DEFAULT_AMPLITUDE))
                HapticType.MEDIUM -> vib.vibrate(VibrationEffect.createOneShot((70 * scale).toLong().coerceAtLeast(25), VibrationEffect.DEFAULT_AMPLITUDE))
                HapticType.HEAVY -> vib.vibrate(VibrationEffect.createWaveform(longArrayOf(0, (120 * scale).toLong(), 55, (120 * scale).toLong()), -1))
                HapticType.SUCCESS -> vib.vibrate(VibrationEffect.createWaveform(longArrayOf(0, (60 * scale).toLong(), 50, (95 * scale).toLong()), -1))
                HapticType.WARNING -> vib.vibrate(VibrationEffect.createWaveform(longArrayOf(0, (80 * scale).toLong(), 45, (80 * scale).toLong()), -1))
                HapticType.ERROR -> vib.vibrate(VibrationEffect.createWaveform(longArrayOf(0, (100 * scale).toLong(), 45, (100 * scale).toLong()), -1))
            }
        }
    }
}
