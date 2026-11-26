package com.example.kharch.ui.components

import androidx.compose.animation.*
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.TrendingDown
import androidx.compose.material.icons.automirrored.rounded.TrendingUp
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.FrameRateCategory
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.preferredFrameRate
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
    val rotationState = animateFloatAsState(
        targetValue = if (isOpen) 45f else 0f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessMedium),
        label = "fab_rot"
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

    Box(modifier = modifier.fillMaxSize().preferredFrameRate(FrameRateCategory.High)) {
        AnimatedVisibility(
            visible = isOpen,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.38f))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null
                    ) { onDismiss() }
            )
        }

        Column(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 18.dp, bottom = 92.dp),
            horizontalAlignment = Alignment.End
        ) {
            AnimatedVisibility(
                visible = isOpen,
                enter = fadeIn() + expandVertically(expandFrom = Alignment.Bottom),
                exit = fadeOut() + shrinkVertically(shrinkTowards = Alignment.Bottom)
            ) {
                Column(
                    horizontalAlignment = Alignment.End,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.padding(bottom = 12.dp)
                ) {
                    actions.forEach { act ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null
                            ) { act.onClick() }
                        ) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = kc.dockBg,
                                shadowElevation = 6.dp
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
                                shadowElevation = 6.dp
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
                containerColor = kc.primaryButtonBg,
                contentColor = kc.primaryButtonFg,
                shape = RoundedCornerShape(18.dp),
                modifier = Modifier.size(56.dp)
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
