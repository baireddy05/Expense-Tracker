package com.example.kharch.ui.components

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.TrendingDown
import androidx.compose.material.icons.automirrored.rounded.TrendingUp
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.ui.theme.*

private data class DialAction(
    val label: String,
    val icon: ImageVector,
    val color: Color,
    val onClick: () -> Unit
)

@Composable
fun QuickActionSpeedDial(
    isOpen: Boolean,
    onToggle: () -> Unit,
    onDismiss: () -> Unit,
    onAddExpense: () -> Unit,
    onAddIncome: () -> Unit,
    onAddLent: () -> Unit,
    onAddBorrowed: () -> Unit,
    onOpenSearch: () -> Unit,
    modifier: Modifier = Modifier
) {
    val kc = LocalKharchColors.current
    val targetHz = LocalTargetRefreshRate.current
    val openProgressState = animateFloatAsState(
        targetValue = if (isOpen) 1f else 0f,
        animationSpec = spring(
            dampingRatio = if (isOpen) 0.78f else 1.0f,
            stiffness = if (isOpen) 480f else 560f,
            visibilityThreshold = 0.001f
        ),
        label = "dial_progress"
    )
    val rotationState = animateFloatAsState(
        targetValue = if (isOpen) 45f else 0f,
        animationSpec = spring(dampingRatio = 0.72f, stiffness = 540f),
        label = "fab_rot"
    )
    val fabInteraction = remember { MutableInteractionSource() }
    val fabPressed by fabInteraction.collectIsPressedAsState()
    val fabScaleState = animateFloatAsState(
        targetValue = if (fabPressed) 0.92f else 1f,
        animationSpec = spring(dampingRatio = 0.72f, stiffness = 600f),
        label = "fab_press"
    )

    val actions = remember(onAddExpense, onAddIncome, onAddLent, onAddBorrowed, onOpenSearch) {
        listOf(
            DialAction("Spotlight Search", Icons.Rounded.Search, Color(0xFF27272A)) {
                onDismiss(); onOpenSearch()
            },
            DialAction("Record Debt", Icons.Rounded.Savings, KharchIndigo) {
                onDismiss(); onAddBorrowed()
            },
            DialAction("Record Lent", Icons.Rounded.Payments, KharchAmber) {
                onDismiss(); onAddLent()
            },
            DialAction("Add Income", Icons.AutoMirrored.Rounded.TrendingUp, KharchEmerald) {
                onDismiss(); onAddIncome()
            },
            DialAction("Add Expense", Icons.AutoMirrored.Rounded.TrendingDown, KharchRose) {
                onDismiss(); onAddExpense()
            }
        )
    }

    val isVisibleOrAnimating = isOpen || openProgressState.value > 0.002f

    Box(modifier = modifier.fillMaxSize().kharchHighFrameRate(targetHz)) {
        if (isVisibleOrAnimating) {
            val scrimModifier = Modifier
                .fillMaxSize()
                .graphicsLayer { alpha = openProgressState.value }
                .background(Color.Black.copy(alpha = 0.38f))
                .let { base ->
                    if (isOpen) {
                        base.clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null
                        ) { onDismiss() }
                    } else base
                }
            Box(modifier = scrimModifier)
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 18.dp, bottom = 92.dp),
            horizontalAlignment = Alignment.End
        ) {
            if (isVisibleOrAnimating) {
                Column(
                    horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(bottom = 12.dp)
                ) {
                    actions.forEachIndexed { idx, act ->
                        val fromBottom = actions.lastIndex - idx
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier
                                .graphicsLayer {
                                    val p = ((openProgressState.value * 1.18f) - (fromBottom * 0.045f)).coerceIn(0f, 1f)
                                    alpha = p
                                    val sc = 0.76f + (0.24f * p)
                                    scaleX = sc
                                    scaleY = sc
                                    translationY = (1f - p) * ((fromBottom + 1) * 16.dp.toPx())
                                    transformOrigin = TransformOrigin(0.92f, 0.5f)
                                }
                                .clickable(
                                    enabled = isOpen,
                                    interactionSource = remember { MutableInteractionSource() },
                                    indication = null
                                ) { act.onClick() }
                        ) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = kc.dockBg,
                                border = BorderStroke(1.dp, kc.cardBorder),
                                shadowElevation = 1.dp
                            ) {
                                Text(
                                    text = act.label,
                                    color = kc.textPrimary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp)
                                )
                            }
                            Surface(
                                modifier = Modifier.size(44.dp),
                                shape = RoundedCornerShape(14.dp),
                                color = act.color,
                                shadowElevation = 1.dp
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(act.icon, contentDescription = act.label, tint = Color.White, modifier = Modifier.size(19.dp))
                                }
                            }
                        }
                    }
                }
            }

            FloatingActionButton(
                onClick = onToggle,
                interactionSource = fabInteraction,
                containerColor = kc.primaryButtonBg,
                contentColor = kc.primaryButtonFg,
                shape = RoundedCornerShape(18.dp),
                elevation = FloatingActionButtonDefaults.elevation(
                    defaultElevation = 2.dp,
                    pressedElevation = 1.dp
                ),
                modifier = Modifier
                    .size(56.dp)
                    .graphicsLayer {
                        val s = fabScaleState.value
                        scaleX = s
                        scaleY = s
                    }
            ) {
                Icon(
                    imageVector = Icons.Rounded.Add,
                    contentDescription = if (isOpen) "Close Quick Actions" else "Quick Actions",
                    modifier = Modifier.size(24.dp).graphicsLayer { rotationZ = rotationState.value }
                )
            }
        }
    }
}
