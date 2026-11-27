# Kharch — Living Project Progress & Account Handoff Log

> **Purpose:** This file persists exact project state across sessions and Gemini Pro accounts.
> **Rule:** Read this file at the start of any resumed session (enforced via `GEMINI.md`) and update it after every completed milestone.

**Last Updated:** 2026-11-28T02:12:00+05:30

---

## 1. Repository Overview

- **Workspace Root:** `c:\Vibe Coding\Expense Tracker`
- **Web App (`src/`):** React 19 + Vite 8 + Tailwind CSS v4 + Chart.js + jsPDF + PapaParse + Firebase Auth/Firestore + `localStorage` guest offline mode.
  - Feature specification & changelog: `FEATURES.md`
  - Web Firebase env source: `.env` (template: `.env.example`)
- **Native Android App (`android/`):** Kotlin 2.3.20 + Jetpack Compose (BOM `2026.03.01`) + Material 3 + `kotlinx-serialization-json` + Firebase Auth/Firestore REST client + atomic local JSON guest store.
  - App ID: `com.kharch.app` (`namespace = "com.example.kharch"`, `minSdk = 26`, `compileSdk = 36`, `targetSdk = 36`)
  - Reads Firebase config dynamically from root `.env` (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`) into `BuildConfig`.

---

## 2. Completed Milestones

### Milestone A — Web App Mobile & Desktop Bug Audit (Completed & Verified)
Fixed mobile/laptop parity bugs and stacking/interaction issues across the React web app:
- **`src/hooks/useBodyScrollLock.js`**: Replaced single-modal overflow restore with module-level reference-counted lock tracking so nested modals (`ConfirmModal` inside other modals) never freeze scrolling.
- **Unportaled Modals Trapped Under `animate-page-enter`**: Portaled modals via `createPortal(..., document.body)` with `z-[60]` and `max-h-[90dvh]` bottom-sheet responsiveness in:
  - `src/pages/Subscriptions.jsx`
  - `src/pages/SavingsGoals.jsx`
  - `src/pages/Events.jsx`
  - `src/pages/Accounts.jsx`
  - `src/pages/Settings.jsx` (restore progress modal)
- **`src/components/transactions/SwipeableItem.jsx` & `src/pages/Transactions.jsx`**: Added tap-to-edit (`isDraggingRef` guard) and explicit mobile Edit/Delete buttons; replaced `alert()` with `react-hot-toast`.
- **`src/pages/Settings.jsx`**: Changed hidden `<input type="file">` from `hidden` (`display: none`, blocked on iOS Safari `.click()`) to `sr-only`; extended `URL.revokeObjectURL` timeout to 10s for mobile downloads.
- **`src/utils/share.js`, `src/components/lent/ReminderModal.jsx`, `src/components/borrow/BorrowReminderModal.jsx`**: Added mobile direct `wa.me` WhatsApp launch (bypassing popup blockers) and native Web Share API (`navigator.share`).
- **`src/components/ui/AnimatedCounter.jsx`**: Synced Framer Motion value to React state with `useCallback` to prevent frozen `0` counters in mobile low-power mode.
- **`src/pages/Analytics.jsx` & `src/pages/Dashboard.jsx`**: Added `relative min-w-0` to Chart.js canvas wrappers and stacked custom range date pickers cleanly on narrow viewports.
- **Bottom Nav / SpeedDial Clearance**: Updated bottom padding to `pb-32 md:pb-8` across pages and adjusted `QuickActionSpeedDial.jsx` z-index (`z-50` / backdrop `z-40`).
- **Verification:** `npm run lint` (`oxlint`: 0 errors, 0 warnings) & `npm run build` (`vite build`: clean pass).

### Milestone B — Exact Native Android App Created in `android/` (Completed & Verified)
Built full Kotlin + Jetpack Compose Android client matching all 10 routes and business rules of `FEATURES.md`:
- **Models & Core Logic (`android/app/src/main/kotlin/com/example/kharch/`):**
  - `model/Models.kt` — All domain models (`Transaction`, `Category`, `Account`, `SavingsGoal`, `EventBudget`, `Subscription`, `LentRecord`, `BorrowedRecord`, `UserSettings`, `FullBackupV3`, `AuthSession`).
  - `util/DateUtils.kt` — Local `YYYY-MM-DD` date handling + month-end clamped `calculateNextDueDate`.
  - `util/CurrencyUtils.kt` — `en-IN` INR formatting + `₹••••••` privacy masking.
  - `util/CategoryEngine.kt` — 11 default categories, 3 default accounts, `Icons.*` mapping, `resolveCategory` (direct ID -> system phrase -> regex keywords).
  - `util/HapticEngine.kt` — Hardware `Vibrator` with `SUBTLE` / `MEDIUM` / `STRONG` profiles and cooldowns.
  - `util/ShareAndPdfUtils.kt` — `wa.me` deep linking (`91` prefix normalization), Android Share Sheet, Clipboard, `PdfDocument` A4 table exports (`FileProvider`), RFC-4180 CSV export/parser.
  - `data/LocalStore.kt`, `data/FirebaseRestClient.kt`, `data/KharchRepository.kt` — Offline guest store, Cloud Firestore/Auth REST sync, Guest->Cloud migration with ID remapping, subscription auto-post, lent/borrow transaction auto-sync, v3.0 JSON backup restore.
- **UI & Screens:**
  - `MainActivity.kt`, `ui/KharchAppShell.kt` (Drawer + Top Bar + Floating Bottom Dock + More Sheet + SpeedDial + SnackbarHost + Splash).
  - `ui/theme/{Color.kt,Theme.kt,Type.kt}` — Light/Dark/System palette.
  - `ui/viewmodel/KharchViewModel.kt` — Reactive state + derived `accountsWithBalances`, `eventsWithStats`, budget crossing alerts.
  - `ui/components/{CommonComponents.kt,ChartComponents.kt,QuickActionSpeedDial.kt,CommandPaletteSheet.kt,AuthModalSheet.kt,TransactionFormSheet.kt,LentBorrowModals.kt,CsvImportSheet.kt}`.
  - `ui/screens/{DashboardScreen.kt,TransactionsScreen.kt,AccountsScreen.kt,SavingsGoalsScreen.kt,EventsScreen.kt,SubscriptionsScreen.kt,LentMoneyScreen.kt,BorrowedMoneyScreen.kt,AnalyticsScreen.kt,SettingsScreen.kt}`.
- **Manifest & Resources:**
  - `android/app/src/main/AndroidManifest.xml` (`INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE`, `FileProvider`) & `res/xml/file_paths.xml`.
- **Verification:**
  - `.\gradlew :app:testDebugUnitTest` — **5/5 unit tests passed** (`KharchCoreUnitTest.kt`).
  - `.\gradlew :app:assembleDebug` — **BUILD SUCCESSFUL**, zero warnings/errors; APK output at `android/app/build/outputs/apk/debug/app-debug.apk`.

### Milestone C — Login Fix, Native Navigation 3, Animations & Live Emulator Polish (Completed & Verified)
Fixed authentication, device navigation, animations, and responsive mobile layouts across all 10 Android screens and modals:
- **Authentication & Cloud Sync (`FirebaseRestClient.kt`, `KharchViewModel.kt`, `AuthModalSheet.kt`, `KharchAppShell.kt`):**
  - Added native **Continue with Google** via Android Credential Manager (`androidx.credentials`, `googleid` `GetSignInWithGoogleOption` + `GetGoogleIdOption` fallback) exchanged via Firebase Identity Toolkit `accounts:signInWithIdp` REST endpoint using `BuildConfig.GOOGLE_WEB_CLIENT_ID`.
  - Updated `AuthModalSheet.kt` to unwrap the real `ComponentActivity` via `findActivity()` for `CredentialManager.getCredential(...)`, surface `GetCredentialCancellationException` with an actionable diagnostic card + dynamic APK `Copy SHA-1` (`SHA-1` & `SHA-256`) + 1-tap `Set Gmail Password` button (instead of silently dismissing after Google Play Services rejects an unregistered Android SHA-1), and rethrow coroutine `CancellationException` cleanly.
  - Hardened `FirebaseRestClient.parseAuthResponse` to handle `needConfirmation == true` and fallback `fullName` -> `displayName` for Google federated logins.
  - **Root cause explained cleanly to user:** Google Play Services aborts `GetSignInWithGoogleOption` with `GetCredentialCancellationException` (`[16]`) after account selection whenever `com.kharch.app` + signing `SHA-1` isn't yet registered in Firebase Console → Project Settings → Your apps (Android). Registering `com.kharch.app` + `C3:08:1A:DC:66:E3:4A:12:D2:84:55:BD:23:07:4A:FB:BB:3B:CC:C8` (debug) enables 1-tap Google Sign-In; alternatively `Set Gmail Password` sends Firebase's password link to link Password auth to the same Gmail UID immediately.
  - Awaited initial cloud sync & local migration synchronously during login before dismissing Auth sheet; added persistent retryable cloud sync error banner in `KharchAppShell` regardless of cached guest categories; cleared Credential Manager state on `logout()`.
- **Native Device Navigation & Transitions (`KharchAppShell.kt`, `MainActivity.kt`, `AndroidManifest.xml`):**
  - Added `android:enableOnBackInvokedCallback="true"` in `AndroidManifest.xml`.
  - Updated `MainActivity.kt` with reactive `enableEdgeToEdge(statusBarStyle, navigationBarStyle)` keyed on `isDark` so status/navigation bar icon colors always match Light/Dark/System theme.
  - Replaced plain `when (state.currentRoute)` swaps with Navigation 3 `NavDisplay` + `rememberSaveableStateHolderNavEntryDecorator()`, slide+fade `transitionSpec` / `popTransitionSpec` / `predictivePopTransitionSpec`, and multi-step `BackHandler` + route history popping.
  - Moved toast `SnackbarHost` into a floating pill cleanly above the Bottom Dock + animated Bottom Dock tab scale/colors and TopAppBar title `AnimatedContent`.
- **UI, Layout & Animation Polish Across All Screens/Modals:**
  - Added `.imePadding()` + `.navigationBarsPadding()` + `skipPartiallyExpanded = true` across `AuthModalSheet`, `TransactionFormSheet`, `LentBorrowModals`, `CommandPaletteSheet`, `CsvImportSheet`, and modal sheets in `AccountsScreen`, `SavingsGoalsScreen`, `EventsScreen`, `SubscriptionsScreen`, and `More` sheet.
  - Added smooth `AnimatedVisibility` + rotating chevrons (`TransactionsScreen`, `LentMoneyScreen`, `BorrowedMoneyScreen`), `AnimatedContent` tabs (`AnalyticsScreen`), `FlowRow` for haptic chips + `Test Buzz` (`SettingsScreen`), dropdown `TextOverflow.Ellipsis` + `weight(1f)` guards, and removed duplicate `navigationBarsPadding` in `QuickActionSpeedDial`.
  - Resolved Material 3 `SwipeToDismissBox` deprecation warning in `TransactionsScreen` (`dismissState.reset()`).
- **Files Modified/Added:** `gradle/libs.versions.toml`, `app/build.gradle.kts`, `AndroidManifest.xml`, `MainActivity.kt`, `FirebaseRestClient.kt`, `KharchViewModel.kt`, `KharchAppShell.kt`, `AuthModalSheet.kt`, `TransactionFormSheet.kt`, `LentBorrowModals.kt`, `CommandPaletteSheet.kt`, `CsvImportSheet.kt`, `QuickActionSpeedDial.kt`, `DashboardScreen.kt`, `TransactionsScreen.kt`, `AccountsScreen.kt`, `SavingsGoalsScreen.kt`, `EventsScreen.kt`, `SubscriptionsScreen.kt`, `LentMoneyScreen.kt`, `BorrowedMoneyScreen.kt`, `AnalyticsScreen.kt`, `SettingsScreen.kt`, `KharchCoreUnitTest.kt`.
- **Verification (`2026-11-26`):**
  - `.\gradlew :app:testDebugUnitTest :app:assembleDebug --console=plain`: **BUILD SUCCESSFUL** (0 warnings, 0 errors); `KharchCoreUnitTest` **6/6 tests passed**, 0 skipped, 0 failures.
  - Live `Virtual_Phone` (`emulator-5554`) verification via `adb`, `android screen capture`, and `android layout`: verified clean launch, Light/Dark system bar icon contrast, inline Firebase invalid-login error banner, Credential Manager Google chooser, Bottom Dock -> More -> Settings navigation & `FlowRow` haptic row, device Back (`keyevent 4`) route stack popping, Quick Action SpeedDial, `TransactionFormSheet`, logged transaction grouping card, floating pill toast above dock, and zero `AndroidRuntime:E` crashes in `adb logcat`.

### Milestone D — Native 120Hz High Refresh Rate & Smooth Animation Pipeline (Completed & Verified)
Eliminated frame drops, transition lag, and per-frame allocations across the entire Android app so transitions, scrolling, charts, and touch feedback run smoothly at native high refresh rates (120Hz on capable hardware):
- **Display & Android 15+ Adaptive Refresh Rate (ARR) (`MainActivity.kt`):**
  - Added `configureHighRefreshRateDisplay()` called in `onCreate()` and `onResume()`, selecting the highest-Hz `Display.Mode` at the active resolution and setting `window.attributes.preferredDisplayModeId` and `preferredRefreshRate`.
  - Enabled `window.setFrameRateBoostOnTouchEnabled(true)` and `window.decorView.requestedFrameRate = View.REQUESTED_FRAME_RATE_CATEGORY_HIGH` on `API 35+` (`VANILLA_ICE_CREAM`+).
- **Zero-Lag 120Hz Transitions & Dock Motion (`KharchAppShell.kt`, `QuickActionSpeedDial.kt`):**
  - Eliminated the 1–2 frame `LaunchedEffect(state.currentRoute)` navigation delay with synchronous `navigateToRoute(target, searchPrefill)` updating the Navigation 3 `backStack` on touch while computing directional lateral motion (`navDirection` across Dock tabs Home/Accounts/Txns/Goals and back pops).
  - Upgraded `NavDisplay` `transitionSpec` and `popTransitionSpec` to interruption-safe spring physics (`spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = 480f)`) paired with fast aligned fades (`180ms` in / `130ms` out), plus Compose ARR `Modifier.preferredFrameRate(FrameRateCategory.High)` on the root shell, `NavDisplay`, Floating Bottom Dock, and `More` sheet.
  - Memoized `allRoutes` on entity/active counts instead of whole `state`, dropped persistent Bottom Dock `shadowElevation` from `10.dp` to `2.dp` to remove continuous multi-pass GPU shadow overdraw, and moved Dock icon scale & `QuickActionSpeedDial` FAB rotation (`rotationState`) into draw-phase `Modifier.graphicsLayer { ... }` lambdas to avoid per-frame recomposition.
- **Screen Virtualization, Render Caching & Derived-State Memoization:**
  - **`KharchViewModel.kt`**: Replaced uncached `accountsWithBalances` and `eventsWithStats` computed getters (which re-ran `Regex` category scans on every state access) with cached `data class` properties recomputed via `DerivedUiStateFlow` only when `transactions`, `accounts`, or `events` references change.
  - **`CurrencyUtils.kt`**: Cached `en-IN` `NumberFormat` instances per thread via `ThreadLocal<NumberFormat>` so scrolling/animating counters make zero formatter allocations per frame.
  - **`CommonComponents.kt` & `ChartComponents.kt`**: Set `shadowElevation = 0.dp` on `KharchCard` (border-defined crisp surface), tightened `AnimatedCurrencyText` duration to `280ms` (`FastOutSlowInEasing`), and rewrote `WeeklyCashFlowLineChart` using `Modifier.drawWithCache { ... }` to cache `Path`, fill `Path`, `Brush.verticalGradient`, and `Stroke` across frames.
  - **`DashboardScreen.kt` & `AnalyticsScreen.kt`**: Converted monolithic `Column(verticalScroll(...))` layouts into virtualized `LazyColumn`s with keyed items (`Modifier.animateItem()` on Analytics sections) and `Modifier.preferredFrameRate(FrameRateCategory.High)`.
  - **`TransactionsScreen.kt`**: Flattened nested per-date `AnimatedVisibility { Column { forEach } }` groups into virtualized flat `LazyColumn` items (`hdr_<dateKey>` headers + conditional `tx_row` items with `Modifier.animateItem()`) and deferred header chevron rotation to `Modifier.graphicsLayer { rotationZ = chevronRotState.value }`.
  - **`LentMoneyScreen.kt`, `BorrowedMoneyScreen.kt`, `AccountsScreen.kt`, `SavingsGoalsScreen.kt`, `EventsScreen.kt`, `SubscriptionsScreen.kt`, `SettingsScreen.kt`**: Added `Modifier.preferredFrameRate(FrameRateCategory.High)` on scroll/list containers and moved archive expand chevrons (`LentMoneyScreen`, `BorrowedMoneyScreen`) to `graphicsLayer { rotationZ = ... }` with spring physics.
- **Files Modified:** `MainActivity.kt`, `CurrencyUtils.kt`, `KharchViewModel.kt`, `CommonComponents.kt`, `ChartComponents.kt`, `QuickActionSpeedDial.kt`, `KharchAppShell.kt`, `DashboardScreen.kt`, `AnalyticsScreen.kt`, `TransactionsScreen.kt`, `LentMoneyScreen.kt`, `BorrowedMoneyScreen.kt`, `AccountsScreen.kt`, `SavingsGoalsScreen.kt`, `EventsScreen.kt`, `SubscriptionsScreen.kt`, `SettingsScreen.kt`.
- **Verification (`2026-11-26`):**
  - Final post-edit build & test: `.\gradlew :app:testDebugUnitTest :app:assembleDebug --console=plain` → **BUILD SUCCESSFUL** (0 errors, 0 Kotlin warnings); `KharchCoreUnitTest` **6/6 tests passed**, 0 skipped, 0 failures.
  - Live `Virtual_Phone` (`android-37.0`) check before final dock elevation tweak: `dumpsys window windows` confirmed `frameRateBoostOnTouch=true` active on `com.kharch.app`; interactive tab switching + Dashboard scrolling `dumpsys gfxinfo` (after `reset`, 142 frames rendered) measured `Janky frames: 7 (4.93%)`, `50th percentile: 17ms` (`GPU: 11ms`), `90th percentile: 34ms`, zero `AndroidRuntime:E` crashes; clean Dashboard visual check confirmed via screenshot (`EMU_display_0` virtual display reports 60.0Hz physical vsync; physical 120Hz hardware exercises full 120Hz display mode selection and ARR high frame-rate category).
  - **Firebase Android OAuth & SHA Fingerprints Registered (`2026-11-26`):** Signed in to Firebase CLI (`firebase-tools` `15.37.0`) and registered both debug **SHA-1** (`c3081adc66e34a12d28455bd23074afbbb3bccc8`) and **SHA-256** (`e337c1ba21637f57e25a35addba6c7560ba57bd7bb41e65443f95f963836922d`) on Android app `1:611669328733:android:5bff24f5b32abfcdff1eb4` (`com.kharch.app`) in project `expense-tracker-321ba`. Confirmed via `apps:sdkconfig ANDROID` that Android OAuth client (`client_type: 1`) and Web OAuth client (`client_type: 3`: `611669328733-a31ut80feabdob2nikrslq4i5ho613rk.apps.googleusercontent.com`) match `BuildConfig.GOOGLE_WEB_CLIENT_ID`.

### Milestone E — Apple iOS Motion Physics, Retained Tab Architecture, Explicit 120Hz Voting & R8 + Baseline Profile Build (Completed & Verified)
Eliminated Compose frame-1 screen teardown/recreation lag, debug-mode JIT/Compose overhead, ARR 90Hz fallback, and layout-thrashing animations across the app:
- **Explicit 120Hz Refresh Voting & Power-Savings Override (`MainActivity.kt`, `Theme.kt`):**
  - Called `configureHighRefreshRateDisplay()` across `onCreate()`, `onResume()`, `onAttachedToWindow()`, and `onWindowFocusChanged(true)`.
  - On `API 35+` (`VANILLA_ICE_CREAM`+), disabled `window.setFrameRatePowerSavingsBalanced(false)`, kept `setFrameRateBoostOnTouchEnabled(true)`, and requested explicit `bestMode.refreshRate` (`120f` when supported `>= 90f`) on `window.decorView.requestedFrameRate`.
  - Added `LocalTargetRefreshRate` and `Modifier.kharchHighFrameRate(targetHz)` in `Theme.kt` (applied across all 10 screens and overlays) so Compose votes the exact detected display Hz (`120f` on 120Hz displays) rather than letting ARR step `FrameRateCategory.High` down to `90f`.
- **Apple iOS Fluid Navigation, Retained Primary Tabs & Sliding Capsule Dock (`KharchAppShell.kt`):**
  - Replaced single-layer `NavDisplay` tab teardown with `PrimaryTabsViewport` (`PRIMARY_ROOT_KEY` + custom `Layout` + `SaveableStateHolder`) so visited primary tabs (`Home`, `Accounts`, `Txns`, `Goals`) stay warm with preserved scroll state and render transitions purely on GPU layers (`placeRelativeWithLayer` + critically damped iOS `spring(1.0f, 430f)` glide, zero idle measure/draw/touch cost when settled).
  - Configured secondary screen transitions (`Analytics`, `Lent`, `Borrowed`, `Events`, `Subscriptions`, `Settings`) with authentic iOS `UINavigationController` full-width parallax push/pop (`100% -> 0` over `-28%` dim parallax with explicit `targetContentZIndex = 1f` on push and `-1f` on pop/predictive back) over opaque `kc.background` layers.
  - Added a GPU `graphicsLayer { translationX = ... }` sliding capsule pill (`spring(0.84f, 460f)`) inside the flat `0.dp`-shadow Bottom Dock (`Home`, `Accounts`, `Txns`, `Goals`, `More`) with spring press-scale (`0.92f`), iOS vertical spring TopAppBar title transitions, and guarded modal composition (`if (isOpen)`) so closed sheets allocate zero suggestion lists during normal browsing.
- **Zero-Relayout `QuickActionSpeedDial`, `@Immutable` Models & Chart Draw Caching (`QuickActionSpeedDial.kt`, `Models.kt`, `KharchViewModel.kt`, `CommonComponents.kt`, `ChartComponents.kt`):**
  - Replaced `AnimatedVisibility(expandVertically())` and heavy `6.dp` multi-pass shadows in `QuickActionSpeedDial` with staggered iOS SpringBoard `graphicsLayer { alpha; scaleX; scaleY; translationY }` animation anchored to the FAB.
  - Annotated all domain models, `ToastMessage`, `KharchColors`, and `KharchUiState` with `@Immutable`; added iOS press-scale (`0.975f`) on interactive `KharchCard`s; cached `CategoryIconBadge` color/icon lookups; converted `AnimatedCurrencyText` to critically-damped `spring(1.0f, 440f)` with `0.5f` visibility threshold; converted `CategoryDonutChart` and `PeriodComparisonBarChart` Canvas blocks to `drawWithCache`.
- **R8 Release Optimization & Embedded Baseline Profile (`build.gradle.kts`, `libs.versions.toml`, `proguard-rules.pro`, `src/main/baseline-prof.txt`):**
  - Added `androidx.profileinstaller:profileinstaller:1.4.1` and HRF rules in `baseline-prof.txt` compiled into `assets/dexopt/baseline.prof`.
  - Enabled `isMinifyEnabled = true`, `isShrinkResources = true`, and `proguard-rules.pro` (`kotlinx.serialization`, `CredentialManager`, `GoogleId`, `BuildConfig`) on `release`, signed with `signingConfigs.getByName("debug")` so local `app-release.apk` builds retain the registered Firebase debug SHA-1.
- **Verification (`2026-11-28`):**
  - `.\gradlew :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease --console=plain`: **BUILD SUCCESSFUL** (0 errors, 0 Kotlin warnings, `:app:lintVitalRelease` & `:app:compileReleaseArtProfile` passed); `KharchCoreUnitTest` **6/6 tests passed** (`0` skipped, `0` failures). APK size dropped from `21.18 MB` (`app-debug.apk`) to `2.65 MB` (`app-release.apk`).
  - Live `Virtual_Phone` (`android-37.0`) verification of `app-release.apk`: `603ms` cold launch (`ActivityTaskManager: Displayed`), `dumpsys window windows` showed `frameRateBoostOnTouch=true` & `dvrrWindowFrameRateHint=true`, warm tab switching + Dashboard scroll + Analytics push/pop (`249` frames) measured `90th percentile: 32ms`, `95th percentile: 34ms`, `GPU 50th: 14ms`, `Missed Vsync: 1`; SpeedDial FAB & More sheet screenshots confirmed crisp layout and `0` `AndroidRuntime:E` / crash-buffer errors.

### Milestone F — Cross-Page Theme Consistency Audit & Fix (Completed & Verified)
Fixed Material 3 baseline color leaks and dark/light theme mismatches across pages, drawers, pickers, and modals:
- **Complete Material 3 `ColorScheme` Tokens (`Theme.kt`):** Added explicit `primaryContainer`, `onPrimaryContainer`, `secondaryContainer`, `onSecondaryContainer`, `tertiary`, `onTertiary`, `tertiaryContainer`, `onTertiaryContainer`, `surfaceContainerLowest`, `surfaceContainerLow`, `surfaceContainer`, `surfaceContainerHigh`, `surfaceContainerHighest`, and `outlineVariant` in both `LightScheme` and `DarkScheme` matching Kharch's Zinc/Slate + Indigo palette — eliminating default Material 3 lavender/purple highlights across `FilterChip`, `AssistChip`, `DropdownMenu`, `Switch`, `AlertDialog`, and `ModalBottomSheet` on all screens.
- **System Window Background & Edge-to-Edge Bars (`res/values/themes.xml`, `res/values-night/themes.xml`, `MainActivity.kt`):** Added `values-night/themes.xml` (`#FF070709` window backing) and `#FFF8FAFC` light backing to stop white startup flash in Dark Mode; updated `navigationBarStyle` in `MainActivity.kt` to `Color.TRANSPARENT`.
- **Screen & Modal Theme Parity:**
  - **`DashboardScreen.kt`:** Replaced the `kc.primaryButtonBg` Guest Sign-In banner (which turned glaring `#F4F4F5` near-white in Dark Mode) with a consistent dark charcoal/obsidian banner (`KharchDarkElevated` + subtle indigo border in dark mode, `#18181B` in light mode) and crisp white Sign In CTA.
  - **`AuthModalSheet.kt`:** Unified `Sign In | Sign Up | Forgot` segmented tabs to `kc.primaryButtonBg` / `kc.primaryButtonFg` (fixing illegible dark-on-dark `#121218`/`#181820` active state in Dark Mode and matching `AnalyticsScreen` & `SettingsScreen`).
  - **`KharchAppShell.kt`:** Styled `NavigationDrawerItem` selected/unselected colors cleanly (`kc.primaryButtonBg` / `kc.primaryButtonFg`) to match `More` sheet and tabs.
  - **`CommonComponents.kt`:** Passed explicit Kharch `DatePickerDefaults.colors(...)` and button text tints into `DatePickerDialog` & `DatePicker`.
  - **`TransactionsScreen.kt`, `AccountsScreen.kt`, `SettingsScreen.kt`, `LentBorrowModals.kt`, `AuthModalSheet.kt`:** Unified `OutlinedButton` borders (`BorderStroke(1.dp, kc.cardBorder)`) and `contentColor`, plus explicit `containerColor = kc.card` on `DropdownMenu`.
- **Verification (`2026-11-28`):**
  - `.\gradlew :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease --console=plain`: **BUILD SUCCESSFUL** (0 errors, 0 warnings); `KharchCoreUnitTest` **6/6 tests passed**.
  - Live `Virtual_Phone` verification of updated `app-release.apk`: visually inspected Light & Dark `Dashboard`, `Transactions` (`FilterChip` + `OutlinedButton`), `AuthModalSheet` (`Sign In / Sign Up / Forgot` tabs), and `NavigationDrawer`, confirming zero Material purple leaks, high contrast in both modes, and `0` `AndroidRuntime:E` crashes.

---

## 3. Environment & Quick Commands

- **Web App:**
  - `npm run lint` (`oxlint`)
  - `npm run build` (`vite build`)
  - `npm run dev`
- **Android App (run from `android/`):**
  - `.\gradlew :app:testDebugUnitTest :app:assembleDebug :app:assembleRelease`
  - **Recommended smooth APK for physical 120Hz phones:** `android/app/build/outputs/apk/release/app-release.apk` (R8 + AOT Baseline Profile, 2.65 MB, signed with debug SHA-1 so Google Sign-In works directly)
  - Emulators available on machine: `Medium_Phone_API_36.1`, `Virtual_Phone` (`android emulator start Medium_Phone_API_36.1` then `android run`)

---

## 4. Known Limitations & Optional Next Steps

1. **Google Sign-In Release Keystore Note:** Debug `SHA-1`/`SHA-256` fingerprints are now registered on Firebase project `expense-tracker-321ba` (`1:611669328733:android:5bff24f5b32abfcdff1eb4`). Before publishing a signed Play Store release build, remember to also register the Play App Signing / release keystore SHA-1 & SHA-256 in Firebase Console.
2. **CSV / Backup File Picking:** Tested at unit-test/parser level; end-to-end SAF (`OpenDocument`) testing with real `.json`/`.csv` files on device recommended.
3. **`Medium_Phone_API_36.1` AVD Image:** Snapshot/ADB stayed offline on this machine; `Virtual_Phone` (`emulator-5554`) works reliably via `emulator.exe -avd Virtual_Phone -no-audio`.

---

## 5. Prompt to Resume on Another Gemini Account

When switching to another Gemini Pro account, open this workspace (`c:\Vibe Coding\Expense Tracker`) and start with:
> `Read PROGRESS.md and continue from the next steps.`
