package com.example.kharch.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
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
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.Placeable
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
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

private const val PRIMARY_ROOT_KEY = "__PRIMARY_TABS__"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KharchAppShell(vm: KharchViewModel) {
    val state by vm.state.collectAsState()
    val kc = LocalKharchColors.current
    val targetHz = LocalTargetRefreshRate.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val snackbarHostState = remember { SnackbarHostState() }
    var lastToastIsError by remember { mutableStateOf(false) }

    val dockOrder = remember {
        mapOf(
            AppRoute.DASHBOARD to 0,
            AppRoute.ACCOUNTS to 1,
            AppRoute.TRANSACTIONS to 2,
            AppRoute.GOALS to 3
        )
    }

    val backStack = rememberSaveable(
        saver = listSaver<SnapshotStateList<String>, String>(
            save = { it.toList() },
            restore = { saved ->
                mutableStateListOf<String>().apply {
                    addAll(saved.ifEmpty { listOf(PRIMARY_ROOT_KEY) })
                }
            }
        )
    ) { mutableStateListOf(PRIMARY_ROOT_KEY) }

    var activePrimaryTab by rememberSaveable { mutableStateOf(AppRoute.DASHBOARD) }
    val primaryTabHistory = rememberSaveable(
        saver = listSaver<SnapshotStateList<AppRoute>, String>(
            save = { list -> list.map { it.name } },
            restore = { saved ->
                mutableStateListOf<AppRoute>().apply {
                    val restored = saved.mapNotNull { name -> AppRoute.entries.firstOrNull { it.name == name } }
                    addAll(restored.ifEmpty { listOf(AppRoute.DASHBOARD) })
                }
            }
        )
    ) { mutableStateListOf(AppRoute.DASHBOARD) }
    var primaryTabDir by remember { mutableIntStateOf(1) }

    val navigateToRoute: (AppRoute, String) -> Unit = remember(backStack, primaryTabHistory, vm) {
        { target, searchPrefill ->
            val tgtDock = dockOrder[target]
            if (tgtDock != null) {
                val curDock = dockOrder[activePrimaryTab] ?: 0
                if (activePrimaryTab != target) {
                    primaryTabDir = if (tgtDock >= curDock) 1 else -1
                    activePrimaryTab = target
                    if (target == AppRoute.DASHBOARD) {
                        primaryTabHistory.clear()
                        primaryTabHistory.add(AppRoute.DASHBOARD)
                    } else {
                        primaryTabHistory.remove(target)
                        primaryTabHistory.add(target)
                    }
                }
                while (backStack.size > 1) {
                    backStack.removeLastOrNull()
                }
            } else {
                backStack.remove(target.name)
                backStack.add(target.name)
            }
            vm.navigateTo(target, searchPrefill)
        }
    }

    LaunchedEffect(state.currentRoute) {
        val target = state.currentRoute
        if (target in dockOrder) {
            if (activePrimaryTab != target) {
                val curDock = dockOrder[activePrimaryTab] ?: 0
                val tgtDock = dockOrder[target] ?: 0
                primaryTabDir = if (tgtDock >= curDock) 1 else -1
                activePrimaryTab = target
                if (target == AppRoute.DASHBOARD) {
                    primaryTabHistory.clear()
                    primaryTabHistory.add(AppRoute.DASHBOARD)
                } else {
                    primaryTabHistory.remove(target)
                    primaryTabHistory.add(target)
                }
            }
            while (backStack.size > 1) {
                backStack.removeLastOrNull()
            }
        } else if (backStack.lastOrNull() != target.name) {
            backStack.remove(target.name)
            backStack.add(target.name)
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

    // Overlays close first, then primary tab history back to Dashboard; detail pushes pop in NavDisplay
    BackHandler(
        enabled = isSpeedDialOpen || isMoreSheetOpen || drawerState.isOpen ||
            (backStack.size == 1 && activePrimaryTab != AppRoute.DASHBOARD)
    ) {
        when {
            isSpeedDialOpen -> isSpeedDialOpen = false
            isMoreSheetOpen -> isMoreSheetOpen = false
            drawerState.isOpen -> scope.launch { drawerState.close() }
            backStack.size == 1 && activePrimaryTab != AppRoute.DASHBOARD -> {
                primaryTabDir = -1
                if (primaryTabHistory.size > 1) primaryTabHistory.removeLastOrNull()
                val prevTab = primaryTabHistory.lastOrNull() ?: AppRoute.DASHBOARD
                activePrimaryTab = prevTab
                vm.navigateTo(prevTab)
            }
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

    val activeSubCount = remember(state.subscriptions) { state.subscriptions.count { it.active } }
    val allRoutes = remember(
        state.transactions.size,
        state.accounts.size,
        state.savingsGoals.size,
        state.events.size,
        activeSubCount,
        state.lentRecords.size,
        state.borrowedRecords.size
    ) {
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
                                    navigateToRoute(item.route, "")
                                    scope.launch { drawerState.close() }
                                },
                                colors = NavigationDrawerItemDefaults.colors(
                                    selectedContainerColor = kc.primaryButtonBg,
                                    selectedIconColor = kc.primaryButtonFg,
                                    selectedTextColor = kc.primaryButtonFg,
                                    unselectedContainerColor = Color.Transparent,
                                    unselectedIconColor = kc.textMuted,
                                    unselectedTextColor = kc.textPrimary
                                ),
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(kc.background)
                .kharchHighFrameRate(targetHz)
        ) {
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
                                    transitionSpec = {
                                        val sSpec = spring<IntOffset>(dampingRatio = 1.0f, stiffness = 480f)
                                        val fSpec = spring<Float>(dampingRatio = 1.0f, stiffness = 480f)
                                        (slideInVertically(sSpec) { it / 4 } + fadeIn(fSpec)) togetherWith
                                            (slideOutVertically(sSpec) { -it / 4 } + fadeOut(fSpec))
                                    },
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
                                if (state.session != null) navigateToRoute(AppRoute.SETTINGS, "")
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
                        modifier = Modifier.fillMaxSize().kharchHighFrameRate(targetHz),
                        backStack = backStack,
                        onBack = {
                            if (backStack.size > 1) {
                                backStack.removeLastOrNull()
                                val topKey = backStack.lastOrNull()
                                val nextRoute = if (topKey == null || topKey == PRIMARY_ROOT_KEY) {
                                    activePrimaryTab
                                } else {
                                    AppRoute.entries.firstOrNull { it.name == topKey } ?: activePrimaryTab
                                }
                                vm.navigateTo(nextRoute)
                            }
                        },
                        entryDecorators = listOf(rememberSaveableStateHolderNavEntryDecorator()),
                        transitionSpec = {
                            val pushSlideSpec = spring<IntOffset>(
                                dampingRatio = 1.0f,
                                stiffness = 360f
                            )
                            val pushFadeSpec = spring<Float>(
                                dampingRatio = 1.0f,
                                stiffness = 360f
                            )
                            (
                                slideInHorizontally(pushSlideSpec) { it } togetherWith
                                    (slideOutHorizontally(pushSlideSpec) { -(it * 3) / 10 } +
                                        fadeOut(pushFadeSpec, targetAlpha = 0.82f))
                            ).apply { targetContentZIndex = 1f }
                        },
                        popTransitionSpec = {
                            val popSlideSpec = spring<IntOffset>(
                                dampingRatio = 1.0f,
                                stiffness = 360f
                            )
                            val popFadeSpec = spring<Float>(
                                dampingRatio = 1.0f,
                                stiffness = 360f
                            )
                            (
                                (slideInHorizontally(popSlideSpec) { -(it * 3) / 10 } +
                                    fadeIn(popFadeSpec, initialAlpha = 0.82f)) togetherWith
                                    slideOutHorizontally(popSlideSpec) { it }
                            ).apply { targetContentZIndex = -1f }
                        },
                        predictivePopTransitionSpec = {
                            val predSpec = tween<IntOffset>(240, easing = LinearOutSlowInEasing)
                            val predFade = tween<Float>(240, easing = LinearOutSlowInEasing)
                            (
                                (slideInHorizontally(predSpec) { -(it * 3) / 10 } +
                                    fadeIn(predFade, initialAlpha = 0.82f)) togetherWith
                                    slideOutHorizontally(predSpec) { it }
                            ).apply { targetContentZIndex = -1f }
                        }
                    ) { key ->
                        NavEntry(key) {
                            Box(modifier = Modifier.fillMaxSize().background(kc.background)) {
                                if (key == PRIMARY_ROOT_KEY) {
                                    PrimaryTabsViewport(
                                        activeTab = activePrimaryTab,
                                        direction = primaryTabDir,
                                        state = state,
                                        onNavigate = { navigateToRoute(it, "") },
                                        onOpenAuth = { authModalTab = "login"; isAuthModalOpen = true },
                                        vm = vm
                                    )
                                } else {
                                    val route = AppRoute.entries.firstOrNull { it.name == key } ?: AppRoute.ANALYTICS
                                    when (route) {
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
                                        else -> DashboardScreen(
                                            state = state,
                                            onNavigate = { navigateToRoute(it, "") },
                                            onOpenAuth = { authModalTab = "login"; isAuthModalOpen = true }
                                        )
                                    }
                                }
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

            // Floating Bottom Navigation Dock (Home, Accounts, Txns, Goals, More) with iOS Sliding Capsule
            Surface(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(horizontal = 12.dp, vertical = 10.dp)
                    .fillMaxWidth()
                    .kharchHighFrameRate(targetHz),
                shape = RoundedCornerShape(24.dp),
                color = kc.dockBg,
                border = BorderStroke(1.dp, kc.cardBorder),
                shadowElevation = 0.dp
            ) {
                val moreActive = moreItems.any { it.route == state.currentRoute } || isMoreSheetOpen
                val activeDockIdx = remember(state.currentRoute, activePrimaryTab, moreActive) {
                    if (moreActive) 4 else dockOrder[state.currentRoute] ?: dockOrder[activePrimaryTab] ?: 0
                }
                val pillPosState = animateFloatAsState(
                    targetValue = activeDockIdx.toFloat(),
                    animationSpec = spring(dampingRatio = 0.84f, stiffness = 460f),
                    label = "dock_pill"
                )
                val density = LocalDensity.current

                BoxWithConstraints(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 6.dp)
                ) {
                    val slotWidth = maxWidth / 5f
                    val slotWidthPx = with(density) { slotWidth.toPx() }

                    Box(
                        modifier = Modifier
                            .width(slotWidth)
                            .height(48.dp)
                            .graphicsLayer { translationX = pillPosState.value * slotWidthPx }
                            .clip(RoundedCornerShape(16.dp))
                            .background(kc.subtleSurface)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceAround,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val shortLabels = listOf("Home", "Accounts", "Txns", "Goals")
                        primaryTabs.forEachIndexed { idx, tab ->
                            val active = activeDockIdx == idx
                            val interaction = remember { MutableInteractionSource() }
                            val pressed by interaction.collectIsPressedAsState()
                            val tabFg by animateColorAsState(
                                targetValue = if (active) kc.textPrimary else kc.textMuted,
                                animationSpec = spring(dampingRatio = 1.0f, stiffness = 460f),
                                label = "dock_fg_$idx"
                            )
                            val tabScaleState = animateFloatAsState(
                                targetValue = if (pressed) 0.92f else if (active) 1.07f else 1f,
                                animationSpec = spring(dampingRatio = 0.78f, stiffness = 540f),
                                label = "dock_sc_$idx"
                            )
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(48.dp)
                                    .clip(RoundedCornerShape(16.dp))
                                    .clickable(interactionSource = interaction, indication = null) {
                                        navigateToRoute(tab.route, "")
                                    },
                                verticalArrangement = Arrangement.Center,
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    imageVector = tab.icon,
                                    contentDescription = tab.label,
                                    tint = tabFg,
                                    modifier = Modifier
                                        .size(19.dp)
                                        .graphicsLayer {
                                            val s = tabScaleState.value
                                            scaleX = s
                                            scaleY = s
                                        }
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

                        val moreInteraction = remember { MutableInteractionSource() }
                        val morePressed by moreInteraction.collectIsPressedAsState()
                        val moreFg by animateColorAsState(
                            targetValue = if (moreActive) kc.textPrimary else kc.textMuted,
                            animationSpec = spring(dampingRatio = 1.0f, stiffness = 460f),
                            label = "dock_more_fg"
                        )
                        val moreScaleState = animateFloatAsState(
                            targetValue = if (morePressed) 0.92f else if (moreActive) 1.07f else 1f,
                            animationSpec = spring(dampingRatio = 0.78f, stiffness = 540f),
                            label = "dock_more_sc"
                        )
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .clickable(interactionSource = moreInteraction, indication = null) {
                                    isMoreSheetOpen = true
                                },
                            verticalArrangement = Arrangement.Center,
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.MoreHoriz,
                                contentDescription = "More features",
                                tint = moreFg,
                                modifier = Modifier
                                    .size(19.dp)
                                    .graphicsLayer {
                                        val s = moreScaleState.value
                                        scaleX = s
                                        scaleY = s
                                    }
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
                    .padding(bottom = 28.dp)
                    .kharchHighFrameRate(targetHz),
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
                            navigateToRoute(item.route, "")
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

    // Global Quick Modals (composed only when opened so idle shell recompositions allocate zero modal lists)
    if (isSpotlightOpen) {
        CommandPaletteSheet(
            isOpen = true,
            state = state,
            onDismiss = { isSpotlightOpen = false },
            onNavigate = { route, searchPref -> navigateToRoute(route, searchPref) },
            onToggleTheme = vm::toggleThemeLightDark,
            onTogglePrivacy = vm::togglePrivacyMode
        )
    }

    if (isAuthModalOpen) {
        AuthModalSheet(
            isOpen = true,
            firebaseConfigured = state.firebaseConfigured,
            initialTab = authModalTab,
            onDismiss = { isAuthModalOpen = false },
            onLogin = vm::login,
            onSignup = vm::signup,
            onGoogleLogin = vm::loginWithGoogleIdToken,
            onResetPassword = vm::sendPasswordReset,
            onContinueGuest = vm::continueAsGuest
        )
    }

    if (isQuickTxOpen) {
        TransactionFormSheet(
            isOpen = true,
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
    }

    if (isQuickLentOpen) {
        val lentNameSuggestions = remember(state.lentRecords) { state.lentRecords.map { it.borrowerName }.distinct() }
        val lentNoteSuggestions = remember(state.lentRecords) { state.lentRecords.mapNotNull { it.note }.distinct() }
        PersonLoanFormSheet(
            isOpen = true,
            isLentMode = true,
            nameSuggestions = lentNameSuggestions,
            noteSuggestions = lentNoteSuggestions,
            onDismiss = { isQuickLentOpen = false },
            onSubmit = { name, amount, date, dueDate, phone, note ->
                vm.saveLentRecord(LentRecord(borrowerName = name, amount = amount, dateLent = date, dueDate = dueDate, phone = phone, note = note)) {
                    isQuickLentOpen = false
                }
            }
        )
    }

    if (isQuickBorrowOpen) {
        val borrowNameSuggestions = remember(state.borrowedRecords) { state.borrowedRecords.map { it.lenderName }.distinct() }
        val borrowNoteSuggestions = remember(state.borrowedRecords) { state.borrowedRecords.mapNotNull { it.note }.distinct() }
        PersonLoanFormSheet(
            isOpen = true,
            isLentMode = false,
            nameSuggestions = borrowNameSuggestions,
            noteSuggestions = borrowNoteSuggestions,
            onDismiss = { isQuickBorrowOpen = false },
            onSubmit = { name, amount, date, dueDate, phone, note ->
                vm.saveBorrowedRecord(BorrowedRecord(lenderName = name, amount = amount, dateBorrowed = date, dueDate = dueDate, phone = phone, note = note)) {
                    isQuickBorrowOpen = false
                }
            }
        )
    }
}

@Composable
private fun PrimaryTabsViewport(
    activeTab: AppRoute,
    direction: Int,
    state: KharchUiState,
    onNavigate: (AppRoute) -> Unit,
    onOpenAuth: () -> Unit,
    vm: KharchViewModel
) {
    val kc = LocalKharchColors.current
    val targetHz = LocalTargetRefreshRate.current
    val saveableHolder = rememberSaveableStateHolder()
    val visitedTabs = remember { mutableStateListOf(AppRoute.DASHBOARD) }
    var settledTab by remember { mutableStateOf(activeTab) }
    var outgoingTab by remember { mutableStateOf<AppRoute?>(null) }
    val anim = remember { Animatable(1f) }

    LaunchedEffect(activeTab) {
        if (activeTab !in visitedTabs) visitedTabs.add(activeTab)
        if (activeTab != settledTab) {
            outgoingTab = settledTab
            settledTab = activeTab
            anim.snapTo(0f)
            anim.animateTo(
                targetValue = 1f,
                animationSpec = spring(dampingRatio = 1.0f, stiffness = 430f)
            )
            outgoingTab = null
        }
    }
    LaunchedEffect(Unit) {
        if (activeTab !in visitedTabs) visitedTabs.add(activeTab)
    }

    val renderedTabs = listOf(AppRoute.DASHBOARD, AppRoute.ACCOUNTS, AppRoute.TRANSACTIONS, AppRoute.GOALS)
        .filter { it in visitedTabs || it == settledTab }

    Layout(
        modifier = Modifier
            .fillMaxSize()
            .background(kc.background)
            .kharchHighFrameRate(targetHz),
        content = {
            renderedTabs.forEach { tab ->
                saveableHolder.SaveableStateProvider(tab.name) {
                    Box(modifier = Modifier.fillMaxSize()) {
                        when (tab) {
                            AppRoute.DASHBOARD -> DashboardScreen(
                                state = state,
                                onNavigate = onNavigate,
                                onOpenAuth = onOpenAuth
                            )
                            AppRoute.ACCOUNTS -> AccountsScreen(
                                state = state,
                                onSaveAccount = vm::saveAccount,
                                onDeleteAccount = vm::deleteAccount,
                                onTransferFunds = vm::transferFunds
                            )
                            AppRoute.TRANSACTIONS -> TransactionsScreen(
                                state = state,
                                onSaveTransaction = vm::saveTransaction,
                                onDeleteTransaction = vm::deleteTransaction,
                                onCreateCategory = { n, t -> vm.createCategory(n, t) },
                                onClearSearchPrefill = vm::clearTxSearchPrefill,
                                onToast = vm::showToast
                            )
                            AppRoute.GOALS -> SavingsGoalsScreen(
                                state = state,
                                onSaveGoal = vm::saveGoal,
                                onDeleteGoal = vm::deleteGoal,
                                onContribute = vm::contributeToGoal
                            )
                            else -> Unit
                        }
                    }
                }
            }
        }
    ) { measurables, constraints ->
        val progress = anim.value
        val placeables = arrayOfNulls<Placeable>(measurables.size)
        val childConstraints = constraints.copy(minWidth = 0, minHeight = 0)
        measurables.forEachIndexed { idx, measurable ->
            val tab = renderedTabs[idx]
            if (tab == settledTab || (tab == outgoingTab && progress < 1f)) {
                placeables[idx] = measurable.measure(childConstraints)
            }
        }
        layout(constraints.maxWidth, constraints.maxHeight) {
            val w = constraints.maxWidth.toFloat()
            placeables.forEachIndexed { idx, placeable ->
                if (placeable != null) {
                    val tab = renderedTabs[idx]
                    val isIncoming = tab == settledTab
                    if (outgoingTab == null || progress >= 1f) {
                        placeable.placeRelative(0, 0)
                    } else if (isIncoming) {
                        placeable.placeRelativeWithLayer(0, 0, zIndex = 1f) {
                            alpha = progress
                            val sc = 0.985f + 0.015f * progress
                            scaleX = sc
                            scaleY = sc
                            translationX = direction * (1f - progress) * (w * 0.08f)
                        }
                    } else {
                        placeable.placeRelativeWithLayer(0, 0, zIndex = 0f) {
                            alpha = (1f - progress).coerceIn(0f, 1f)
                            translationX = -direction * progress * (w * 0.06f)
                        }
                    }
                }
            }
        }
    }
}
