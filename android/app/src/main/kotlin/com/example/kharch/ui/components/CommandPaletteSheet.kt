package com.example.kharch.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.model.AppRoute
import com.example.kharch.ui.theme.*
import com.example.kharch.ui.viewmodel.KharchUiState
import com.example.kharch.util.CategoryEngine
import com.example.kharch.util.CurrencyUtils
import com.example.kharch.util.DateUtils

private data class PaletteResult(
    val id: String,
    val title: String,
    val subtitle: String,
    val rightText: String = "",
    val iconName: String = "fa-list",
    val colorHex: String? = null,
    val onSelect: () -> Unit
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommandPaletteSheet(
    isOpen: Boolean,
    state: KharchUiState,
    onDismiss: () -> Unit,
    onNavigate: (AppRoute, String) -> Unit,
    onToggleTheme: () -> Unit,
    onTogglePrivacy: () -> Unit
) {
    if (!isOpen) return
    val kc = LocalKharchColors.current
    var query by remember { mutableStateOf("") }

    val results = remember(query, state) {
        val q = query.trim().lowercase()
        val list = mutableListOf<PaletteResult>()

        // Quick actions & routes
        if (q.isBlank() || "theme".contains(q) || "dark".contains(q) || "light".contains(q)) {
            list.add(
                PaletteResult(
                    id = "act_theme",
                    title = "Switch Appearance Theme",
                    subtitle = "Toggle Light / Dark mode",
                    iconName = "fa-bolt",
                    colorHex = "#6366f1",
                    onSelect = { onToggleTheme(); onDismiss() }
                )
            )
        }
        if (q.isBlank() || "privacy".contains(q) || "hide".contains(q) || "mask".contains(q)) {
            list.add(
                PaletteResult(
                    id = "act_privacy",
                    title = if (state.isPrivacyMode) "Disable Privacy Masking" else "Enable Privacy Masking",
                    subtitle = "Hide or show ₹ amounts",
                    iconName = "fa-bullseye",
                    colorHex = "#10b981",
                    onSelect = { onTogglePrivacy(); onDismiss() }
                )
            )
        }

        AppRoute.entries.forEach { r ->
            if (q.isBlank() || r.title.lowercase().contains(q)) {
                list.add(
                    PaletteResult(
                        id = "route_${r.name}",
                        title = r.title,
                        subtitle = "Go to ${r.title}",
                        iconName = "fa-list",
                        colorHex = "#3b82f6",
                        onSelect = { onNavigate(r, ""); onDismiss() }
                    )
                )
            }
        }

        if (q.isNotBlank()) {
            // Transactions
            state.transactions.filter { t ->
                val cat = CategoryEngine.resolveCategory(t.categoryId, state.categories, t.note)
                t.note.lowercase().contains(q) ||
                    (cat?.name?.lowercase()?.contains(q) == true) ||
                    t.tags.any { it.lowercase().contains(q.removePrefix("#")) } ||
                    (t.eventTag?.lowercase()?.contains(q.removePrefix("#")) == true)
            }.take(10).forEach { t ->
                val cat = CategoryEngine.resolveCategory(t.categoryId, state.categories, t.note)
                list.add(
                    PaletteResult(
                        id = "tx_${t.id}",
                        title = t.note.ifBlank { cat?.name ?: "Transaction" },
                        subtitle = "${cat?.name ?: t.type} • ${DateUtils.formatDisplayDate(t.date, short = true)}",
                        rightText = CurrencyUtils.formatInr(t.amount, state.isPrivacyMode),
                        iconName = cat?.icon ?: "fa-receipt",
                        colorHex = cat?.color,
                        onSelect = { onNavigate(AppRoute.TRANSACTIONS, t.note.ifBlank { cat?.name ?: "" }); onDismiss() }
                    )
                )
            }

            // Lent & Borrowed
            state.lentRecords.filter { it.borrowerName.lowercase().contains(q) || (it.note ?: "").lowercase().contains(q) }
                .take(5).forEach { lr ->
                    list.add(
                        PaletteResult(
                            id = "lent_${lr.id}",
                            title = "Lent to ${lr.borrowerName}",
                            subtitle = lr.note ?: "Receivable",
                            rightText = CurrencyUtils.formatInr((lr.amount - lr.returnedAmount).coerceAtLeast(0.0), state.isPrivacyMode),
                            iconName = "fa-hand-holding-dollar",
                            colorHex = "#f59e0b",
                            onSelect = { onNavigate(AppRoute.LENT, ""); onDismiss() }
                        )
                    )
                }

            state.borrowedRecords.filter { it.lenderName.lowercase().contains(q) || (it.note ?: "").lowercase().contains(q) }
                .take(5).forEach { br ->
                    list.add(
                        PaletteResult(
                            id = "bor_${br.id}",
                            title = "Borrowed from ${br.lenderName}",
                            subtitle = br.note ?: "Debt",
                            rightText = CurrencyUtils.formatInr((br.amount - br.returnedAmount).coerceAtLeast(0.0), state.isPrivacyMode),
                            iconName = "fa-hand-holding",
                            colorHex = "#06b6d4",
                            onSelect = { onNavigate(AppRoute.BORROWED, ""); onDismiss() }
                        )
                    )
                }

            state.accountsWithBalances.filter { it.name.lowercase().contains(q) }.forEach { acc ->
                list.add(
                    PaletteResult(
                        id = "acc_${acc.id}",
                        title = acc.name,
                        subtitle = "Account (${acc.type})",
                        rightText = CurrencyUtils.formatInr(acc.balance, state.isPrivacyMode),
                        iconName = acc.icon,
                        colorHex = acc.color,
                        onSelect = { onNavigate(AppRoute.ACCOUNTS, ""); onDismiss() }
                    )
                )
            }

            state.savingsGoals.filter { it.name.lowercase().contains(q) }.forEach { g ->
                list.add(
                    PaletteResult(
                        id = "goal_${g.id}",
                        title = g.name,
                        subtitle = "Savings Goal",
                        rightText = "${CurrencyUtils.formatCompactInr(g.savedAmount, state.isPrivacyMode)} / ${CurrencyUtils.formatCompactInr(g.targetAmount, state.isPrivacyMode)}",
                        iconName = g.icon,
                        colorHex = g.color,
                        onSelect = { onNavigate(AppRoute.GOALS, ""); onDismiss() }
                    )
                )
            }

            state.eventsWithStats.filter { it.name.lowercase().contains(q) || it.tag.lowercase().contains(q) }.forEach { ev ->
                list.add(
                    PaletteResult(
                        id = "ev_${ev.id}",
                        title = ev.name,
                        subtitle = "#${ev.tag} • Trip/Event",
                        rightText = CurrencyUtils.formatInr(ev.spent, state.isPrivacyMode),
                        iconName = ev.icon,
                        colorHex = ev.color,
                        onSelect = { onNavigate(AppRoute.EVENTS, ""); onDismiss() }
                    )
                )
            }
        }
        list
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = kc.card,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .navigationBarsPadding()
                .heightIn(min = 220.dp, max = 520.dp)
                .padding(horizontal = 16.dp)
                .padding(bottom = 24.dp)
        ) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                placeholder = { Text("Search transactions, people, pages, #tags...", fontSize = 13.sp) },
                leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                trailingIcon = {
                    if (query.isNotEmpty()) {
                        IconButton(onClick = { query = "" }) {
                            Icon(Icons.Rounded.Close, contentDescription = "Clear")
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))

            if (results.isEmpty()) {
                Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                    Text("No matching results for \"$query\"", color = kc.textMuted, fontSize = 12.sp)
                }
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(results, key = { it.id }) { res ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { res.onSelect() },
                            shape = RoundedCornerShape(14.dp),
                            color = kc.subtleSurface
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                CategoryIconBadge(iconName = res.iconName, colorHex = res.colorHex, size = 34.dp)
                                Spacer(Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(res.title, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = kc.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(res.subtitle, fontSize = 11.sp, color = kc.textMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                                if (res.rightText.isNotBlank()) {
                                    Text(res.rightText, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = kc.textPrimary)
                                    Spacer(Modifier.width(6.dp))
                                }
                                Icon(Icons.AutoMirrored.Rounded.ArrowForward, contentDescription = null, tint = kc.textMuted, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}
