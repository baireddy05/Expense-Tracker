package com.example.kharch.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.List
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import com.example.kharch.model.*
import com.example.kharch.ui.components.*
import com.example.kharch.ui.screens.*
import com.example.kharch.ui.theme.*
import com.example.kharch.ui.viewmodel.KharchUiState
import com.example.kharch.ui.viewmodel.KharchViewModel
import com.example.kharch.util.DateUtils
import kotlinx.coroutines.launch

private data class NavMeta(
    val route: AppRoute,
    val label: String,
    val icon: ImageVector,
    val badge: Int = 0,
    val subtitle: String = ""
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KharchAppShell(vm: KharchViewModel) {
    val state by vm.state.collectAsState()
    val kc = LocalKharchColors.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val snackbarHostState = remember { SnackbarHostState() }
    var lastToastIsError by remember { mutableStateOf(false) }

    val backStack = rememberSaveable(
        saver = listSaver<SnapshotStateList<AppRoute>, String>(
            save = { list -> list.map { it.name } },
            restore = { saved ->
                mutableStateListOf<AppRoute>().apply {
                    val restored = saved.mapNotNull { name -> AppRoute.entries.firstOrNull { it.name == name } }
                    addAll(restored.ifEmpty { listOf(AppRoute.DASHBOARD) })
                }
            }
        )
    ) { mutableStateOf(null).let { mutableStateListOf(AppRoute.DASHBOARD) } }

    LaunchedEffect(state.currentRoute) {
        val target = state.currentRoute
        if (backStack.lastOrNull() != target) {
            if (target == AppRoute.DASHBOARD) {
                backStack.clear()
                backStack.add(AppRoute.DASHBOARD)
            } else {
                backStack.remove(target)
                backStack.add(target)
            }
        }
    }

    var isSpeedDialOpen by remember { mutableStateOf(false) }
    var isMoreSheetOpen by remember { mutableStateOf(false) }
    var isSpotlightOpen by remember { mutableStateOf(false) }
    var isAuthModalOpen by remember { mutableStateOf(false) }
    var authModalTab by remember { mutableStateOf("login") }
    var isQuickTxOpen by remember { mutableStateOf(false) }
    var quickTxType by remember { mutableStateOf("expense") }
    var isQuickLentOpen by remember { mutableStateOf(false) }
    var isQuickBorrowOpen by remember { mutableStateOf(false) }

    // Collect Toast messages into SnackbarHost
    LaunchedEffect(Unit) {
        vm.toasts.collect { toast ->
            lastToastIsError = toast.isError
            snackbarHostState.currentSnackbarData?.dismiss()
            snackbarHostState.showSnackbar(
                message = toast.text,
                duration = SnackbarDuration.Short
            )
        }
    }

    // Overlays close first; route back navigation & predictive back are handled by NavDisplay
    BackHandler(enabled = isSpeedDialOpen || isMoreSheetOpen || drawerState.isOpen) {
        when {
            isSpeedDialOpen -> isSpeedDialOpen = false
            isMoreSheetOpen -> isMoreSheetOpen = false
            drawerState.isOpen -> scope.launch { drawerState.close() }
        }
    }

    if (state.isLoading) {
        BrandSplashScreen()
        return
    }

    if (state.error != null && state.transactions.isEmpty() && state.categories.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().background(kc.background).padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            KharchCard {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Icon(Icons.Rounded.WarningAmber, contentDescription = null, tint = KharchRose, modifier = Modifier.size(36.dp))
                    Text("Unable to sync data", style = MaterialTheme.typography.titleMedium, color = kc.textPrimary)
                    Text(state.error ?: "Unknown error", style = MaterialTheme.typography.bodySmall, color = kc.textMuted)
                    Button(
                        onClick = { vm.refreshData(isInitial = true) },
                        colors = ButtonDefaults.buttonColors(containerColor = kc.primaryButtonBg, contentColor = kc.primaryButtonFg),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("Retry Connection", fontWeight = FontWeight.Bold) }
                }
            }
        }
        return
    }

    val allRoutes = remember(state) {
        listOf(
            NavMeta(AppRoute.DASHBOARD, "Dashboard", Icons.Rounded.Home),
            NavMeta(AppRoute.TRANSACTIONS, "Transactions", Icons.AutoMirrored.Rounded.List, state.transactions.size, "${state.transactions.size} logged entries"),
            NavMeta(AppRoute.ACCOUNTS, "Accounts", Icons.Rounded.AccountBalance, state.accounts.size, "${state.accounts.size} accounts & wallets"),
            NavMeta(AppRoute.GOALS, "Savings Goals", Icons.Rounded.TrackChanges, state.savingsGoals.size, "${state.savingsGoals.size} savings goals"),
            NavMeta(AppRoute.EVENTS, "Trips & Events", Icons.Rounded.Luggage, state.events.size, "${state.events.size} active events & trips"),
            NavMeta(AppRoute.SUBSCRIPTIONS, "Subscriptions", Icons.Rounded.Autorenew, state.subscriptions.count { it.active }, "${state.subscriptions.count { it.active }} active bills"),
            NavMeta(AppRoute.LENT, "Lent to Friends", Icons.Rounded.Payments, state.lentRecords.size, "${state.lentRecords.size} lending records"),
            NavMeta(AppRoute.BORROWED, "Borrowed Money", Icons.Rounded.Savings, state.borrowedRecords.size, "${state.borrowedRecords.size} debt records"),
            NavMeta(AppRoute.ANALYTICS, "Analytics", Icons.Rounded.PieChart, subtitle = "Insights & period comparisons"),
            NavMeta(AppRoute.SETTINGS, "Settings", Icons.Rounded.Settings, subtitle = "Budgets, cloud sync & backups")
        )
    }

    val primaryTabs = remember(allRoutes) {
        listOf(allRoutes[0], allRoutes[2], allRoutes[1], allRoutes[3]) // Home, Accounts, Txns, Goals
    }
    val moreItems = remember(allRoutes) {
        listOf(allRoutes[4], allRoutes[5], allRoutes[6], allRoutes[7], allRoutes[8], allRoutes[9])
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(drawerContainerColor = kc.card) {
                Column(
                    modifier = Modifier.fillMaxHeight().width(280.dp).padding(16.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.verticalScroll(rememberScrollState()).weight(1f, fill = false)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Box(
                                modifier = Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)).background(kc.primaryButtonBg),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Rounded.AccountBalanceWallet, contentDescription = null, tint = kc.primaryButtonFg, modifier = Modifier.size(20.dp))
                            }
                            Column {
                                Text("Kharch", fontWeight = FontWeight.Bold, fontSize = 17.sp, color = kc.textPrimary)
                                Text("Personal Financial OS", fontSize = 10.sp, color = kc.textMuted)
                            }
                        }
                        Spacer(Modifier.height(16.dp))
                        HorizontalDivider(color = kc.cardBorder)
                        Spacer(Modifier.height(10.dp))

                        allRoutes.forEach { item ->
                            val active = state.currentRoute == item.route
                            NavigationDrawerItem(
                                label = { Text(item.label, fontSize = 13.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.Medium) },
                                icon = { Icon(item.icon, contentDescription = null, modifier = Modifier.size(18.dp)) },
                                selected = active,
                                onClick = {
                                    vm.navigateTo(item.route)
                                    scope.launch { drawerState.close() }
                                },
                                shape = RoundedCornerShape(12.dp)
                            )
                        }
                    }

                    Column {
                        HorizontalDivider(color = kc.cardBorder)
                        Spacer(Modifier.height(10.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = state.session?.email ?: "Guest Offline Mode",
                                fontSize = 11.sp,
                                color = kc.textMuted,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                            IconButton(onClick = { vm.toggleThemeLightDark() }) {
                                Icon(
                                    imageVector = if (kc.isDark) Icons.Rounded.LightMode else Icons.Rounded.DarkMode,
                                    contentDescription = "Toggle theme"
                                )
                            }
                        }
                    }
                }
            }
        }
    ) {
        Box(modifier = Modifier.fillMaxSize().background(kc.background)) {
            Scaffold(
                containerColor = kc.background,
                topBar = {
                    TopAppBar(
                        colors = TopAppBarDefaults.topAppBarColors(containerColor = kc.background),
                        navigationIcon = {
                            IconButton(onClick = { scope.launch { drawerState.open() } }) {
                                Icon(Icons.Rounded.Menu, contentDescription = "Menu", tint = kc.textPrimary)
                            }
                        },
                        title = {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Box(
                                    modifier = Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(kc.primaryButtonBg),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Rounded.AccountBalanceWallet, contentDescription = null, tint = kc.primaryButtonFg, modifier = Modifier.size(15.dp))
                                }
                                AnimatedContent(
                                    targetState = if (state.currentRoute == AppRoute.DASHBOARD) "Kharch" else state.currentRoute.title,
                                    transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(150)) },
                                    label = "topbar_title"
                                ) { titleText ->
                                    Text(
                                        text = titleText,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 17.sp,
                                        color = kc.textPrimary,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        },
                        actions = {
                            IconButton(onClick = { isSpotlightOpen = true }) {
                                Icon(Icons.Rounded.Search, contentDescription = "Spotlight Search", tint = kc.textMuted)
                            }
                            IconButton(onClick = { vm.togglePrivacyMode() }) {
                                Icon(
                                    imageVector = if (state.isPrivacyMode) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                                    contentDescription = "Toggle Privacy",
                                    tint = if (state.isPrivacyMode) KharchRose else kc.textMuted
                                )
                            }
                            IconButton(onClick = { vm.toggleThemeLightDark() }) {
                                Icon(
                                    imageVector = if (kc.isDark) Icons.Rounded.LightMode else Icons.Rounded.DarkMode,
                                    contentDescription = "Toggle Theme",
                                    tint = kc.textMuted
                                )
                            }
                            IconButton(onClick = {
                                if (state.session != null) vm.navigateTo(AppRoute.SETTINGS)
                                else {
                                    authModalTab = "login"
                                    isAuthModalOpen = true
                                }
                            }) {
                                val initial = (state.session?.displayName?.firstOrNull() ?: state.session?.email?.firstOrNull())
                                if (initial != null) {
                                    Box(
                                        modifier = Modifier.size(28.dp).clip(CircleShape).background(KharchIndigo),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(initial.uppercase(), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    }
                                } else {
                                    Icon(Icons.Rounded.AccountCircle, contentDescription = "Sign In", tint = kc.textMuted)
                                }
                            }
                        }
                    )
                }
            ) { innerPadding ->
                Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
                    if (state.error != null) {
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = KharchRoseSoft,
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Rounded.CloudOff, contentDescription = null, tint = KharchRose, modifier = Modifier.size(16.dp))
                                Text(state.error ?: "", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = KharchRose, modifier = Modifier.weight(1f), maxLines = 2)
                                TextButton(onClick = { vm.refreshData(isInitial = false) }, contentPadding = PaddingValues(horizontal = 8.dp)) {
                                    Text("Retry", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                    Box(modifier = Modifier.weight(1f).fillMaxWidth()) {
                    NavDisplay(
                        backStack = backStack,
                        onBack = {
                            if (backStack.size > 1) {
                                backStack.removeLastOrNull()
                                vm.navigateTo(backStack.lastOrNull() ?: AppRoute.DASHBOARD)
                            }
                        },
                        entryDecorators = listOf(rememberSaveableStateHolderNavEntryDecorator()),
                        transitionSpec = {
                            (slideInHorizontally(tween(260, easing = FastOutSlowInEasing)) { it / 6 } + fadeIn(tween(220))) togetherWith
                                (slideOutHorizontally(tween(260, easing = FastOutSlowInEasing)) { -it / 10 } + fadeOut(tween(180)))
                        },
                        popTransitionSpec = {
                            (slideInHorizontally(tween(240, easing = FastOutSlowInEasing)) { -it / 10 } + fadeIn(tween(220))) togetherWith
                                (slideOutHorizontally(tween(240, easing = FastOutSlowInEasing)) { it / 5 } + fadeOut(tween(180)))
                        },
                        predictivePopTransitionSpec = {
                            (slideInHorizontally(tween(240)) { -it / 6 } + fadeIn(tween(200))) togetherWith
                                (slideOutHorizontally(tween(240)) { it / 3 } + scaleOut(targetScale = 0.94f, animationSpec = tween(240)) + fadeOut(tween(200)))
                        }
                    ) { route ->
                        NavEntry(route) {
                            when (route) {
                        AppRoute.DASHBOARD -> DashboardScreen(
                            state = state,
                            onNavigate = { vm.navigateTo(it) },
                            onOpenAuth = { authModalTab = "login"; isAuthModalOpen = true }
                        )
                        AppRoute.TRANSACTIONS -> TransactionsScreen(
                            state = state,
                            onSaveTransaction = vm::saveTransaction,
                            onDeleteTransaction = vm::deleteTransaction,
                            onCreateCategory = { n, t -> vm.createCategory(n, t) },
                            onClearSearchPrefill = vm::clearTxSearchPrefill,
                            onToast = vm::showToast
                        )
                        AppRoute.ACCOUNTS -> AccountsScreen(
                            state = state,
                            onSaveAccount = vm::saveAccount,
                            onDeleteAccount = vm::deleteAccount,
                            onTransferFunds = vm::transferFunds
                        )
                        AppRoute.GOALS -> SavingsGoalsScreen(
                            state = state,
                            onSaveGoal = vm::saveGoal,
                            onDeleteGoal = vm::deleteGoal,
                            onContribute = vm::contributeToGoal
                        )
                        AppRoute.EVENTS -> EventsScreen(
                            state = state,
                            onSaveEvent = vm::saveEvent,
                            onDeleteEvent = vm::deleteEvent
                        )
                        AppRoute.SUBSCRIPTIONS -> SubscriptionsScreen(
                            state = state,
                            onSaveSubscription = vm::saveSubscription,
                            onToggleActive = vm::toggleSubscriptionActive,
                            onDeleteSubscription = vm::deleteSubscription
                        )
                        AppRoute.LENT -> LentMoneyScreen(
                            state = state,
                            onSaveLent = vm::saveLentRecord,
                            onLendMore = vm::lendMoreMoney,
                            onRecordRepayment = vm::recordLentRepayment,
                            onSettleLent = vm::settleLentRecord,
                            onDeleteLent = vm::deleteLentRecord,
                            onToast = vm::showToast
                        )
                        AppRoute.BORROWED -> BorrowedMoneyScreen(
                            state = state,
                            onSaveBorrowed = vm::saveBorrowedRecord,
                            onBorrowMore = vm::borrowMoreMoney,
                            onRecordRepayment = vm::recordBorrowedRepayment,
                            onSettleBorrowed = vm::settleBorrowedRecord,
                            onDeleteBorrowed = vm::deleteBorrowedRecord,
                            onToast = vm::showToast
                        )
                        AppRoute.ANALYTICS -> AnalyticsScreen(state = state)
                        AppRoute.SETTINGS -> SettingsScreen(
                            state = state,
                            onOpenAuth = { authModalTab = "login"; isAuthModalOpen = true },
                            onUpdateDisplayName = vm::updateDisplayName,
                            onSyncCloud = vm::syncCloudData,
                            onLogout = vm::logout,
                            onPurgeCache = vm::purgeLocalCache,
                            onUpdateMonthlyBudget = vm::updateMonthlyBudget,
                            onUpdateCategoryBudget = vm::updateCategoryBudget,
                            onTogglePrivacy = vm::togglePrivacyMode,
                            onToggleHaptics = vm::toggleHaptics,
                            onSetHapticIntensity = vm::setHapticIntensity,
                            onTestHaptic = vm::testHapticBuzz,
                            onSetThemeMode = vm::setThemeMode,
                            onExportJsonBackup = { vm.exportFullBackupJsonFile(context) },
                            onExportCsv = { vm.exportCsvFile(context) },
                            onRestoreBackupUri = { uri -> vm.restoreBackupFromUri(context, uri) },
                            onDismissRestoreProgress = vm::dismissRestoreProgress,
                            onImportCsvBatch = vm::importCsvBatch,
                            onToast = vm::showToast
                        )
                    }
                        }
                    }
                    }
                }
            }

            // Floating Toast Snackbar positioned above the Bottom Navigation Dock
            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 92.dp)
            ) { data ->
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = if (lastToastIsError) KharchRose else kc.primaryButtonBg,
                    shadowElevation = 8.dp
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = if (lastToastIsError) Icons.Rounded.ErrorOutline else Icons.Rounded.CheckCircle,
                            contentDescription = null,
                            tint = if (lastToastIsError) Color.White else kc.primaryButtonFg,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = data.visuals.message,
                            color = if (lastToastIsError) Color.White else kc.primaryButtonFg,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f, fill = false)
                        )
                    }
                }
            }

            // Floating Bottom Navigation Dock (Home, Accounts, Txns, Goals, More)
            Surface(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(horizontal = 12.dp, vertical = 10.dp)
                    .fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                color = kc.dockBg,
                border = BorderStroke(1.dp, kc.cardBorder),
                shadowElevation = 10.dp
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceAround,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val shortLabels = listOf("Home", "Accounts", "Txns", "Goals")
                    primaryTabs.forEachIndexed { idx, tab ->
                        val active = state.currentRoute == tab.route
                        val tabBg by animateColorAsState(if (active) kc.subtleSurface else Color.Transparent, tween(200), label = "dock_bg_$idx")
                        val tabFg by animateColorAsState(if (active) kc.textPrimary else kc.textMuted, tween(200), label = "dock_fg_$idx")
                        val tabScale by animateFloatAsState(if (active) 1.08f else 1f, spring(stiffness = Spring.StiffnessMediumLow), label = "dock_sc_$idx")
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(16.dp))
                                .background(tabBg)
                                .clickable { vm.navigateTo(tab.route) }
                                .padding(vertical = 6.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = tab.icon,
                                contentDescription = tab.label,
                                tint = tabFg,
                                modifier = Modifier.size(19.dp).scale(tabScale)
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                text = shortLabels[idx],
                                fontSize = 10.sp,
                                fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                                color = tabFg,
                                maxLines = 1
                            )
                        }
                    }

                    val moreActive = moreItems.any { it.route == state.currentRoute } || isMoreSheetOpen
                    val moreBg by animateColorAsState(if (moreActive) kc.subtleSurface else Color.Transparent, tween(200), label = "dock_more_bg")
                    val moreFg by animateColorAsState(if (moreActive) kc.textPrimary else kc.textMuted, tween(200), label = "dock_more_fg")
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(16.dp))
                            .background(moreBg)
                            .clickable { isMoreSheetOpen = true }
                            .padding(vertical = 6.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            imageVector = Icons.Rounded.MoreHoriz,
                            contentDescription = "More features",
                            tint = moreFg,
                            modifier = Modifier.size(19.dp)
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = "More",
                            fontSize = 10.sp,
                            fontWeight = if (moreActive) FontWeight.Bold else FontWeight.Medium,
                            color = moreFg,
                            maxLines = 1
                        )
                    }
                }
            }

            // Quick Action Speed Dial FAB
            QuickActionSpeedDial(
                isOpen = isSpeedDialOpen,
                onToggle = { isSpeedDialOpen = !isSpeedDialOpen },
                onDismiss = { isSpeedDialOpen = false },
                onAddExpense = { quickTxType = "expense"; isQuickTxOpen = true },
                onAddIncome = { quickTxType = "income"; isQuickTxOpen = true },
                onAddLent = { isQuickLentOpen = true },
                onAddBorrowed = { isQuickBorrowOpen = true },
                onOpenSearch = { isSpotlightOpen = true },
                modifier = Modifier.navigationBarsPadding()
            )
        }
    }

    // "More" Hub Bottom Sheet
    if (isMoreSheetOpen) {
        ModalBottomSheet(
            onDismissRequest = { isMoreSheetOpen = false },
            containerColor = kc.card,
            sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 18.dp)
                    .padding(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Column {
                        Text("All Features", style = MaterialTheme.typography.titleMedium, color = kc.textPrimary)
                        Text("Quick access to all Kharch modules", fontSize = 11.sp, color = kc.textMuted)
                    }
                    IconButton(onClick = { isMoreSheetOpen = false }) { Icon(Icons.Rounded.Close, contentDescription = "Close") }
                }
                HorizontalDivider(color = kc.cardBorder)
                moreItems.forEach { item ->
                    val active = state.currentRoute == item.route
                    Surface(
                        onClick = {
                            vm.navigateTo(item.route)
                            isMoreSheetOpen = false
                        },
                        shape = RoundedCornerShape(14.dp),
                        color = if (active) kc.primaryButtonBg else kc.subtleSurface
                    ) {
                        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(item.icon, contentDescription = null, tint = if (active) kc.primaryButtonFg else KharchIndigo, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(item.label, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = if (active) kc.primaryButtonFg else kc.textPrimary)
                                if (item.subtitle.isNotBlank()) {
                                    Text(item.subtitle, fontSize = 10.sp, color = if (active) kc.primaryButtonFg.copy(alpha = 0.7f) else kc.textMuted)
                                }
                            }
                            Text(if (active) "Current" else "Open →", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = if (active) kc.primaryButtonFg else kc.textMuted)
                        }
                    }
                }
            }
        }
    }

    // Global Quick Modals
    CommandPaletteSheet(
        isOpen = isSpotlightOpen,
        state = state,
        onDismiss = { isSpotlightOpen = false },
        onNavigate = { route, searchPref -> vm.navigateTo(route, searchPref) },
        onToggleTheme = vm::toggleThemeLightDark,
        onTogglePrivacy = vm::togglePrivacyMode
    )

    AuthModalSheet(
        isOpen = isAuthModalOpen,
        firebaseConfigured = state.firebaseConfigured,
        initialTab = authModalTab,
        onDismiss = { isAuthModalOpen = false },
        onLogin = vm::login,
        onSignup = vm::signup,
        onGoogleLogin = vm::loginWithGoogleIdToken,
        onResetPassword = vm::sendPasswordReset,
        onContinueGuest = vm::continueAsGuest
    )

    TransactionFormSheet(
        isOpen = isQuickTxOpen,
        initialData = null,
        defaultType = quickTxType,
        categories = state.categories,
        accounts = state.accountsWithBalances,
        events = state.eventsWithStats,
        recentTransactions = state.transactions,
        isPrivacyMode = state.isPrivacyMode,
        onDismiss = { isQuickTxOpen = false },
        onSave = vm::saveTransaction,
        onCreateCategory = { n, t -> vm.createCategory(n, t) }
    )

    PersonLoanFormSheet(
        isOpen = isQuickLentOpen,
        isLentMode = true,
        nameSuggestions = state.lentRecords.map { it.borrowerName }.distinct(),
        noteSuggestions = state.lentRecords.mapNotNull { it.note }.distinct(),
        onDismiss = { isQuickLentOpen = false },
        onSubmit = { name, amount, date, dueDate, phone, note ->
            vm.saveLentRecord(LentRecord(borrowerName = name, amount = amount, dateLent = date, dueDate = dueDate, phone = phone, note = note)) {
                isQuickLentOpen = false
            }
        }
    )

    PersonLoanFormSheet(
        isOpen = isQuickBorrowOpen,
        isLentMode = false,
        nameSuggestions = state.borrowedRecords.map { it.lenderName }.distinct(),
        noteSuggestions = state.borrowedRecords.mapNotNull { it.note }.distinct(),
        onDismiss = { isQuickBorrowOpen = false },
        onSubmit = { name, amount, date, dueDate, phone, note ->
            vm.saveBorrowedRecord(BorrowedRecord(lenderName = name, amount = amount, dateBorrowed = date, dueDate = dueDate, phone = phone, note = note)) {
                isQuickBorrowOpen = false
            }
        }
    )
}
