# Kharch — Living Project Progress & Account Handoff Log

> **Purpose:** This file persists exact project state across sessions and Gemini Pro accounts.
> **Rule:** Read this file at the start of any resumed session (enforced via `GEMINI.md`) and update it after every completed milestone.

**Last Updated:** 2026-11-26T18:08:00+05:30

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
  - Returned explicit `String?` errors from `login`, `signup`, `loginWithGoogleIdToken`, and `sendPasswordReset` so errors render inside an inline alert banner in `AuthModalSheet` (previously swallowed behind the modal by `Scaffold` Snackbar), added password show/hide toggle, `ImeAction.Next`/`Done` keyboard flow, and a dynamic APK SHA-1 + package (`com.kharch.app`) copy helper card if Play Services lacks Firebase Console SHA-1 registration.
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

---

## 3. Environment & Quick Commands

- **Web App:**
  - `npm run lint` (`oxlint`)
  - `npm run build` (`vite build`)
  - `npm run dev`
- **Android App (run from `android/`):**
  - `.\gradlew :app:testDebugUnitTest :app:assembleDebug`
  - Emulators available on machine: `Medium_Phone_API_36.1`, `Virtual_Phone` (`android emulator start Medium_Phone_API_36.1` then `android run`)

---

## 4. Known Limitations & Optional Next Steps

1. **Google Sign-In Live Firebase Account Test on Physical Device:** Credential Manager chooser (`Continue with Google`) and `accounts:signInWithIdp` are wired end-to-end; emulator had no Google account signed in. If testing debug builds with Google Sign-In on a device returns a Play Services config error, register `com.kharch.app` and SHA-1 (`C3:08:1A:DC:66:E3:4A:12:D2:84:55:BD:23:07:4A:FB:BB:3B:CC:C8` for debug builds) in Firebase Console → Project Settings → Add Android App (`AuthModalSheet` also surfaces a 1-tap `Copy Package & SHA-1` helper card when needed).
2. **CSV / Backup File Picking:** Tested at unit-test/parser level; end-to-end SAF (`OpenDocument`) testing with real `.json`/`.csv` files on device recommended.
3. **`Medium_Phone_API_36.1` AVD Image:** Snapshot/ADB stayed offline on this machine; `Virtual_Phone` (`emulator-5554`) works reliably via `emulator.exe -avd Virtual_Phone -no-audio`.

---

## 5. Prompt to Resume on Another Gemini Account

When switching to another Gemini Pro account, open this workspace (`c:\Vibe Coding\Expense Tracker`) and start with:
> `Read PROGRESS.md and continue from the next steps.`
