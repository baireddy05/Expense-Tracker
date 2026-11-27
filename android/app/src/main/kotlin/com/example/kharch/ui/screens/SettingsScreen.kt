package com.example.kharch.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.kharch.model.*
import com.example.kharch.ui.components.*
import com.example.kharch.ui.theme.*
import com.example.kharch.ui.viewmodel.KharchUiState
import com.example.kharch.util.ShareAndPdfUtils
import java.io.File

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(
    state: KharchUiState,
    onOpenAuth: () -> Unit,
    onUpdateDisplayName: (String) -> Unit,
    onSyncCloud: () -> Unit,
    onLogout: () -> Unit,
    onPurgeCache: () -> Unit,
    onUpdateMonthlyBudget: (Double) -> Unit,
    onUpdateCategoryBudget: (Category, Double) -> Unit,
    onTogglePrivacy: () -> Unit,
    onToggleHaptics: () -> Unit,
    onSetHapticIntensity: (HapticIntensity) -> Unit,
    onTestHaptic: () -> Unit,
    onSetThemeMode: (AppThemeMode) -> Unit,
    onExportJsonBackup: () -> File,
    onExportCsv: () -> File?,
    onRestoreBackupUri: (Uri) -> Unit,
    onDismissRestoreProgress: () -> Unit,
    onImportCsvBatch: suspend (List<Transaction>) -> Int,
    onToast: (String, Boolean) -> Unit
) {
    val kc = LocalKharchColors.current
    val context = LocalContext.current

    var displayNameInput by remember(state.session?.displayName) { mutableStateOf(state.session?.displayName ?: "") }
    var budgetInput by remember(state.settings.monthlyBudget) {
        mutableStateOf(if (state.settings.monthlyBudget > 0) state.settings.monthlyBudget.toString().removeSuffix(".0") else "")
    }
    var purgeConfirmOpen by remember { mutableStateOf(false) }
    var csvFileUri by remember { mutableStateOf<Uri?>(null) }

    val jsonPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { onRestoreBackupUri(it) }
    }
    val csvPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { csvFileUri = it }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(top = 8.dp, bottom = 120.dp)
            .kharchHighFrameRate(LocalTargetRefreshRate.current),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("Settings", style = MaterialTheme.typography.headlineLarge, color = kc.textPrimary)
        Text("Account, cloud sync, budget limits, haptics & backups", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)

        // 1. Account & Cloud Security
        KharchCard {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Rounded.Shield, contentDescription = null, tint = KharchEmerald, modifier = Modifier.size(18.dp))
                    Text("Account & Cloud Security", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
                }
                if (state.session != null) StatusPill("CLOUD SYNCED", KharchEmerald, KharchEmeraldSoft)
            }
            Spacer(Modifier.height(10.dp))

            if (state.session != null) {
                Text("Signed in as ${state.session.email}", fontSize = 12.sp, color = kc.textMuted)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = displayNameInput,
                        onValueChange = { displayNameInput = it },
                        label = { Text("Display Name") },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    )
                    Button(
                        onClick = { onUpdateDisplayName(displayNameInput) },
                        shape = RoundedCornerShape(12.dp)
                    ) { Text("Save") }
                }
                Spacer(Modifier.height(10.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = onSyncCloud,
                        enabled = !state.isSyncing,
                        colors = ButtonDefaults.buttonColors(containerColor = KharchIndigo, contentColor = Color.White),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        if (state.isSyncing) CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White)
                        else {
                            Icon(Icons.Rounded.Sync, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Sync Now", fontSize = 12.sp)
                        }
                    }
                    OutlinedButton(
                        onClick = onLogout,
                        border = androidx.compose.foundation.BorderStroke(1.dp, kc.cardBorder),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = KharchRose),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.AutoMirrored.Rounded.Logout, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Sign Out", fontSize = 12.sp, color = KharchRose)
                    }
                }
            } else {
                Text("Currently in Guest Mode (data stored locally on this Android device).", fontSize = 12.sp, color = kc.textMuted)
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = onOpenAuth,
                    colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Sign In / Create Cloud Account", fontWeight = FontWeight.Bold)
                }
            }

            Spacer(Modifier.height(8.dp))
            TextButton(onClick = { purgeConfirmOpen = true }) {
                Icon(Icons.Rounded.CleaningServices, contentDescription = null, tint = KharchRose, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(6.dp))
                Text("Purge Local Guest Cache", fontSize = 11.sp, color = KharchRose)
            }
        }

        // 2. Target Budgets
        KharchCard {
            Text("Target Budgets", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = budgetInput,
                    onValueChange = { budgetInput = it },
                    label = { Text("Global Monthly Limit (₹)") },
                    prefix = { Text("₹ ") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                )
                Button(
                    onClick = { onUpdateMonthlyBudget(budgetInput.trim().toDoubleOrNull() ?: 0.0) },
                    shape = RoundedCornerShape(12.dp)
                ) { Text("Save") }
            }

            val expCats = state.categories.filter { it.type == "expense" }
            if (expCats.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                Text("Category Envelope Limits", style = MaterialTheme.typography.labelMedium, color = kc.textMuted)
                Spacer(Modifier.height(8.dp))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    expCats.forEach { c ->
                        var catInput by remember(c.id, c.budgetLimit) {
                            mutableStateOf(if (c.budgetLimit > 0) c.budgetLimit.toString().removeSuffix(".0") else "")
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            CategoryIconBadge(c.icon, c.color, size = 28.dp, cornerRadius = 8.dp)
                            Text(c.name, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = kc.textPrimary, modifier = Modifier.weight(1f))
                            OutlinedTextField(
                                value = catInput,
                                onValueChange = { catInput = it },
                                placeholder = { Text("0", fontSize = 11.sp) },
                                textStyle = LocalTextStyle.current.copy(fontSize = 13.sp),
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                singleLine = true,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier.width(96.dp)
                            )
                            TextButton(
                                onClick = { onUpdateCategoryBudget(c, catInput.trim().toDoubleOrNull() ?: 0.0) },
                                contentPadding = PaddingValues(horizontal = 6.dp)
                            ) { Text("Set", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                        }
                    }
                }
            }
        }

        // 3. Privacy & Haptics
        KharchCard {
            Text("Privacy & Haptics", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Privacy Masking Mode", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = kc.textPrimary)
                    Text("Mask all ₹ figures as ₹••••••", fontSize = 11.sp, color = kc.textMuted)
                }
                Switch(checked = state.isPrivacyMode, onCheckedChange = { onTogglePrivacy() })
            }
            HorizontalDivider(Modifier.padding(vertical = 8.dp), color = kc.cardBorder)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Hardware Haptics", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = kc.textPrimary)
                    Text("Tactile vibration feedback", fontSize = 11.sp, color = kc.textMuted)
                }
                Switch(checked = state.isHapticsEnabled, onCheckedChange = { onToggleHaptics() })
            }
            if (state.isHapticsEnabled) {
                Spacer(Modifier.height(6.dp))
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    HapticIntensity.entries.forEach { level ->
                        FilterChip(
                            selected = state.hapticIntensity == level,
                            onClick = { onSetHapticIntensity(level) },
                            label = { Text(level.name.lowercase().replaceFirstChar { it.uppercase() }, fontSize = 11.sp) }
                        )
                    }
                    TextButton(onClick = onTestHaptic) { Text("Test Buzz", fontSize = 11.sp, fontWeight = FontWeight.Bold) }
                }
            }
        }

        // 4. Theme Switcher
        KharchCard {
            Text("Appearance Theme", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(
                    Triple(AppThemeMode.LIGHT, "Light", Icons.Rounded.LightMode),
                    Triple(AppThemeMode.DARK, "Dark", Icons.Rounded.DarkMode),
                    Triple(AppThemeMode.SYSTEM, "System", Icons.Rounded.PhoneAndroid)
                ).forEach { (mode, label, ic) ->
                    val sel = state.themeMode == mode
                    Surface(
                        onClick = { onSetThemeMode(mode) },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        color = if (sel) kc.primaryButtonBg else kc.subtleSurface
                    ) {
                        Column(Modifier.padding(vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(ic, contentDescription = label, tint = if (sel) kc.primaryButtonFg else kc.textMuted, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.height(4.dp))
                            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (sel) kc.primaryButtonFg else kc.textPrimary)
                        }
                    }
                }
            }
        }

        // 5. Data Management & Backups
        KharchCard {
            Text("Data Management & Offline Backups", style = MaterialTheme.typography.titleSmall, color = kc.textPrimary)
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        runCatching {
                            val file = onExportJsonBackup()
                            ShareAndPdfUtils.shareFile(context, file, "application/json", "Export Kharch v3.0 JSON Backup")
                            onToast("Complete system backup ready!", false)
                        }.onFailure { onToast("Export failed: ${it.message}", true) }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Rounded.Download, contentDescription = null, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Export JSON", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                OutlinedButton(
                    onClick = { jsonPicker.launch(arrayOf("application/json", "*/*")) },
                    border = androidx.compose.foundation.BorderStroke(1.dp, kc.cardBorder),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = kc.textPrimary),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Rounded.Upload, contentDescription = null, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Restore JSON", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    onClick = {
                        val file = onExportCsv()
                        if (file != null) {
                            ShareAndPdfUtils.shareFile(context, file, "text/csv", "Export Kharch Transactions CSV")
                            onToast("Transactions CSV ready!", false)
                        }
                    },
                    border = androidx.compose.foundation.BorderStroke(1.dp, kc.cardBorder),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = kc.textPrimary),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Rounded.Download, contentDescription = null, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Export CSV", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
                Button(
                    onClick = { csvPicker.launch(arrayOf("text/csv", "text/comma-separated-values", "*/*")) },
                    colors = ButtonDefaults.buttonColors(containerColor = KharchEmerald, contentColor = Color.White),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Rounded.UploadFile, contentDescription = null, modifier = Modifier.size(15.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("Import CSV", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }

    CsvImportSheet(
        fileUri = csvFileUri,
        categories = state.categories,
        accounts = state.accountsWithBalances,
        existingTransactions = state.transactions,
        onDismiss = { csvFileUri = null },
        onImportBatch = onImportCsvBatch
    )

    state.restoreProgress?.let { prog ->
        AlertDialog(
            onDismissRequest = { if (prog.isDone) onDismissRestoreProgress() },
            containerColor = kc.card,
            title = { Text(if (prog.isDone) "Restoration Complete" else "Restoring System Backup", color = kc.textPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(prog.message, style = MaterialTheme.typography.bodyMedium, color = kc.textMuted)
                    LinearProgressIndicator(
                        progress = { (prog.percent / 100f).coerceIn(0f, 1f) },
                        color = KharchEmerald,
                        trackColor = kc.subtleSurface,
                        modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp))
                    )
                    Text("${prog.percent}%", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = kc.textPrimary)
                }
            },
            confirmButton = {
                Button(onClick = onDismissRestoreProgress) {
                    Text(if (prog.isDone) "Done" else "Run in Background")
                }
            }
        )
    }

    ConfirmActionDialog(
        isOpen = purgeConfirmOpen,
        title = "Purge Local Cache",
        message = "Clear all offline guest records from this device? Cloud-synced data in Firestore is unaffected.",
        confirmText = "Purge Cache",
        isDanger = true,
        onDismiss = { purgeConfirmOpen = false },
        onConfirm = onPurgeCache
    )
}
