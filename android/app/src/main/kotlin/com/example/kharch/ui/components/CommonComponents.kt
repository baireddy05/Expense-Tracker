package com.example.kharch.ui.components

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AccountBalanceWallet
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.WarningAmber
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.ui.theme.*
import com.example.kharch.util.CategoryEngine
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils
import java.time.Instant
import java.time.ZoneId

@Composable
fun KharchCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    borderColor: Color? = null,
    backgroundColor: Color? = null,
    contentPadding: Dp = 16.dp,
    content: @Composable ColumnScope.() -> Unit
) {
    val kc = LocalKharchColors.current
    val interactionModifier = if (onClick != null) {
        val interactionSource = remember { MutableInteractionSource() }
        val isPressed by interactionSource.collectIsPressedAsState()
        val pressScaleState = animateFloatAsState(
            targetValue = if (isPressed) 0.975f else 1f,
            animationSpec = spring(dampingRatio = 0.72f, stiffness = 560f),
            label = "card_press_sc"
        )
        Modifier
            .graphicsLayer {
                val s = pressScaleState.value
                scaleX = s
                scaleY = s
            }
            .clip(RoundedCornerShape(20.dp))
            .clickable(interactionSource = interactionSource, indication = LocalIndication.current, onClick = onClick)
    } else Modifier
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .then(interactionModifier),
        shape = RoundedCornerShape(20.dp),
        color = backgroundColor ?: kc.card,
        border = BorderStroke(1.dp, borderColor ?: kc.cardBorder),
        shadowElevation = 0.dp
    ) {
        Column(modifier = Modifier.padding(contentPadding), content = content)
    }
}

@Composable
fun AnimatedCurrencyText(
    amount: Double,
    isPrivacyMode: Boolean,
    color: Color = LocalKharchColors.current.textPrimary,
    fontSizeSp: Float = 20f,
    fontWeight: FontWeight = FontWeight.Bold,
    isCurrency: Boolean = true,
    suffix: String = ""
) {
    val animValue by animateFloatAsState(
        targetValue = amount.toFloat(),
        animationSpec = spring(dampingRatio = 1.0f, stiffness = 440f, visibilityThreshold = 0.5f),
        visibilityThreshold = 0.5f,
        label = "kpi_counter"
    )
    val formatted = when {
        isPrivacyMode -> if (isCurrency) "₹••••••" else "••••"
        isCurrency -> CurrencyUtils.formatInr(animValue.toDouble()) + suffix
        else -> "${animValue.toInt()}$suffix"
    }
    Text(
        text = formatted,
        color = color,
        fontSize = fontSizeSp.sp,
        fontWeight = fontWeight,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
    )
}

@Composable
fun KpiCard(
    title: String,
    value: Double,
    subtitle: String,
    icon: ImageVector,
    iconTint: Color,
    iconBg: Color,
    isPrivacyMode: Boolean,
    modifier: Modifier = Modifier,
    valueColor: Color = LocalKharchColors.current.textPrimary,
    isCurrency: Boolean = true,
    suffix: String = "",
    extraContent: (@Composable () -> Unit)? = null
) {
    val kc = LocalKharchColors.current
    KharchCard(modifier = modifier, contentPadding = 14.dp) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title.uppercase(),
                    style = MaterialTheme.typography.labelSmall,
                    color = kc.textMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(4.dp))
                AnimatedCurrencyText(
                    amount = value,
                    isPrivacyMode = isPrivacyMode,
                    color = valueColor,
                    fontSizeSp = 19f,
                    isCurrency = isCurrency,
                    suffix = suffix
                )
            }
            Spacer(Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(iconBg),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = title, tint = iconTint, modifier = Modifier.size(17.dp))
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = subtitle,
            style = MaterialTheme.typography.bodySmall,
            color = kc.textMuted,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
        if (extraContent != null) {
            Spacer(Modifier.height(6.dp))
            extraContent()
        }
    }
}

@Composable
fun CategoryIconBadge(
    iconName: String?,
    colorHex: String?,
    size: Dp = 36.dp,
    cornerRadius: Dp = 10.dp
) {
    val bgColor = remember(colorHex) { CategoryEngine.parseHexColor(colorHex, KharchIndigo) }
    val icon = remember(iconName) { CategoryEngine.getIcon(iconName) }
    Box(
        modifier = Modifier
            .size(size)
            .clip(RoundedCornerShape(cornerRadius))
            .background(bgColor),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = Color.White,
            modifier = Modifier.size(size * 0.48f)
        )
    }
}

@Composable
fun StatusPill(
    text: String,
    textColor: Color,
    bgColor: Color,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(CircleShape)
            .background(bgColor)
            .padding(horizontal = 8.dp, vertical = 3.dp)
    ) {
        Text(
            text = text,
            color = textColor,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1
        )
    }
}

@Composable
fun ConfirmActionDialog(
    isOpen: Boolean,
    title: String,
    message: String,
    confirmText: String = "Confirm",
    isDanger: Boolean = true,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    if (!isOpen) return
    val kc = LocalKharchColors.current
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = kc.card,
        icon = {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (isDanger) KharchRoseSoft else KharchIndigoSoft),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Rounded.WarningAmber,
                    contentDescription = null,
                    tint = if (isDanger) KharchRose else KharchIndigo,
                    modifier = Modifier.size(24.dp)
                )
            }
        },
        title = {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = kc.textPrimary
            )
        },
        text = {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = kc.textMuted
            )
        },
        confirmButton = {
            Button(
                onClick = {
                    onConfirm()
                    onDismiss()
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isDanger) KharchRose else kc.primaryButtonBg,
                    contentColor = if (isDanger) Color.White else kc.primaryButtonFg
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(confirmText, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = kc.textMuted, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DatePickerField(
    label: String,
    value: String,
    onDateSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
    allowClear: Boolean = false
) {
    val kc = LocalKharchColors.current
    var showPicker by remember { mutableStateOf(false) }

    Column(modifier = modifier) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = kc.textMuted
        )
        Spacer(Modifier.height(4.dp))
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .clickable { showPicker = true },
            shape = RoundedCornerShape(12.dp),
            color = kc.subtleSurface,
            border = BorderStroke(1.dp, kc.cardBorder)
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Rounded.CalendarMonth, contentDescription = null, tint = kc.textMuted, modifier = Modifier.size(16.dp))
                    Text(
                        text = if (value.isBlank()) "Select date" else DateUtils.formatDisplayDate(value),
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (value.isBlank()) kc.textMuted else kc.textPrimary
                    )
                }
                if (allowClear && value.isNotBlank()) {
                    Text(
                        text = "Clear",
                        color = KharchRose,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.clickable { onDateSelected("") }
                    )
                }
            }
        }
    }

    if (showPicker) {
        val initialMillis = remember(value) {
            DateUtils.parseLocalDate(value)
                ?.atStartOfDay(ZoneId.of("UTC"))
                ?.toInstant()
                ?.toEpochMilli()
                ?: System.currentTimeMillis()
        }
        val pickerState = rememberDatePickerState(initialSelectedDateMillis = initialMillis)
        val dpColors = DatePickerDefaults.colors(
            containerColor = kc.card,
            titleContentColor = kc.textPrimary,
            headlineContentColor = kc.textPrimary,
            weekdayContentColor = kc.textMuted,
            subheadContentColor = kc.textMuted,
            yearContentColor = kc.textPrimary,
            currentYearContentColor = KharchIndigo,
            selectedYearContentColor = kc.primaryButtonFg,
            selectedYearContainerColor = kc.primaryButtonBg,
            dayContentColor = kc.textPrimary,
            selectedDayContentColor = kc.primaryButtonFg,
            selectedDayContainerColor = kc.primaryButtonBg,
            todayContentColor = KharchIndigo,
            todayDateBorderColor = KharchIndigo
        )
        DatePickerDialog(
            onDismissRequest = { showPicker = false },
            colors = dpColors,
            confirmButton = {
                TextButton(
                    onClick = {
                        pickerState.selectedDateMillis?.let { millis ->
                            val local = Instant.ofEpochMilli(millis).atZone(ZoneId.of("UTC")).toLocalDate()
                            onDateSelected(DateUtils.getLocalDateString(local))
                        }
                        showPicker = false
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = kc.primaryButtonBg)
                ) {
                    Text("OK", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showPicker = false },
                    colors = ButtonDefaults.textButtonColors(contentColor = kc.textMuted)
                ) { Text("Cancel") }
            }
        ) {
            DatePicker(state = pickerState, colors = dpColors)
        }
    }
}

@Composable
fun BrandSplashScreen() {
    val kc = LocalKharchColors.current
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(kc.background),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(kc.primaryButtonBg),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Rounded.AccountBalanceWallet,
                    contentDescription = "Kharch",
                    tint = kc.primaryButtonFg,
                    modifier = Modifier.size(32.dp)
                )
            }
            Spacer(Modifier.height(16.dp))
            Text(
                text = "Kharch",
                style = MaterialTheme.typography.headlineLarge,
                color = kc.textPrimary
            )
            Text(
                text = "Personal Financial OS",
                style = MaterialTheme.typography.bodySmall,
                color = kc.textMuted
            )
            Spacer(Modifier.height(24.dp))
            CircularProgressIndicator(
                modifier = Modifier.size(28.dp),
                strokeWidth = 2.5.dp,
                color = KharchIndigo
            )
        }
    }
}
