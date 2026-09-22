# ExTrack — Feature Registry

> **Maintenance rule:** This file is the source of truth for what the app can do.
> Whenever a feature is added, changed, or removed, update the matching section
> below in the same commit. Before building a "new" feature, check this file
> first so nothing gets duplicated.

App: minimalist expense, lending, debt and budget manager.
Stack: React 19 + Vite + Tailwind CSS v4 + Firebase (Auth + Firestore) + localStorage guest mode.
Currency: INR (`en-IN`) throughout. Dates stored as local `YYYY-MM-DD` strings.

---

## 1. Global shell & navigation

- **Routes** (`src/App.jsx`): `/dashboard`, `/transactions`, `/lent`, `/borrowed`,
  `/analytics`, `/accounts`, `/goals`, `/events`, `/subscriptions`, `/settings`.
  `/` redirects to `/dashboard`; unknown paths redirect to `/dashboard`.
  All pages lazy-loaded with a spinner fallback; global `ErrorBoundary`; global `Toaster`.
- **Desktop sidebar** (`Sidebar.jsx`): brand header, 10 nav links with active state,
  user card (avatar, name, "Cloud Synced") or Sign-In button, light/dark toggle.
- **Mobile bottom nav dock** (`BottomNav.jsx`): 4 primary tabs
  (Home, Accounts, Txns, Goals) + "More" button opening a drag-to-dismiss bottom
  sheet with the other 6 modules, each with live count subtitles. Active-tab highlight.
- **Mobile drawer** (`AppShell.jsx`): hamburger slide-out menu with all 10 links + theme switch.
- **Top header** (`AppShell.jsx`): command-palette search trigger (desktop) / search
  icon (mobile), privacy-mode toggle, light/dark toggle, user profile menu.
- **Splash screen** (`SplashScreen.jsx`): branded loading screen shown while auth/data loads.
- **Skeletons** (`Skeleton.jsx`): `DashboardSkeleton`, `TransactionsSkeleton` placeholders.
- **Quick-action speed dial** (`QuickActionSpeedDial.jsx`): floating button expanding to
  Add Expense, Add Income, Record Lent, Record Debt, Spotlight Search (all with labels).
- **Command palette / Spotlight** (`CommandPalette.jsx`, `Cmd/Ctrl+K`): fuzzy search across
  transactions, lent/borrowed people, accounts, goals, subscriptions, events, pages and
  quick actions (theme, privacy). Keyboard navigable (↑↓/Enter/Esc).
- **Quick-add shortcut** (`Cmd/Ctrl+N`, Esc closes): opens the transaction form globally.
- **Confirm modal** (`ConfirmModal.jsx`): danger/neutral variants used for all
  deletes, settlements and PDF exports.
- **Swipeable rows** (`SwipeableItem.jsx`): swipe right = edit, swipe left = delete
  on mobile transaction lists (framer-motion, haptic feedback).
- **Animated counters** (`AnimatedCounter.jsx`): animated INR/count-up KPI numbers,
  masked in privacy mode.

## 2. Cross-cutting features

- **Auth** (`AuthContext.jsx`, `AuthModal.jsx`, `UserProfileMenu.jsx`): Google sign-in,
  email/password sign-up + login, password reset, display-name edit, guest mode,
  profile dropdown (Sync now, Settings, Sign out). Auth state gates cloud vs guest data.
- **Guest / offline mode**: full localStorage persistence per collection
  (`extrack_guest_*` keys). Guest data auto-migrates into Firestore on first sign-in
  (`DataService.migrateLocalDataToCloud`). Explicit "Purge Cache" in Settings only.
- **Privacy mode** (`UIContext.jsx`): masks every currency as `₹••••••` (KPIs, tables,
  charts, tooltips, counters). Persisted in localStorage.
- **Themes** (`ThemeContext.jsx`): light / dark / system (media-query aware), persisted.
- **Haptics** (`utils/haptics.js`, `UIContext.jsx`): vibration engine with on/off toggle
  + subtle/medium/strong intensity, global pointer-down feedback, test-vibration button.
- **Date handling** (`utils/dateUtils.js`): local-timezone helpers — `getLocalDateString`,
  `parseLocalDate`, `formatDisplayDate`, `calculateNextDueDate` (daily/weekly/monthly/yearly).
  No UTC day-shift bugs.
- **Category engine** (`utils/categoryIcons.js`): FontAwesome icon map, O(1) id/name lookup
  cache, `resolveCategory` (direct id → note-keyword inference for lent/borrowed/debt/food/
  travel/entertainment). Used by every list, chart and PDF.
- **Body scroll lock** (`useBodyScrollLock.js`): reference-counted lock so stacked modals
  never leave the page unscrollable.
- **Toast feedback**: `react-hot-toast` success/error toasts on every mutation.

## 3. Dashboard (`pages/Dashboard.jsx`)

- KPI cards: Total Balance, Monthly Income, Monthly Expense, Net Liquid Worth
  (accounts balance + pending lent − pending debt), each with animated counter.
- Monthly net line under Total Balance; all-time totals under income/expense cards.
- Guest-mode sign-in banner.
- Accounts & wallets glance grid (icon, name, type, live balance) → links to `/accounts`.
- Savings-goals glance (top 3 with progress bars) → links to `/goals`.
- Trips & events glance (top 3 with budget bars, over-budget badge) → links to `/events`.
- Due-date alerts: lent + borrowed records due within 7 days (overdue highlighted),
  sorted by urgency, deep-linking to `/lent` / `/borrowed`.
- Global monthly budget bar (emerald→amber→rose thresholds) + per-category envelope
  budget bars with over-budget warnings.
- Weekly cash-flow line chart (income vs expense, privacy-aware tooltips).
- Expense-by-category doughnut + 5 most-recent transactions list.

## 4. Transactions (`pages/Transactions.jsx`, `TransactionForm.jsx`)

- Ledger with search (note, category, `#tag`, event tag), type filter
  (all/expense/income — transfers excluded from income/expense totals),
  category filter, time filter (all/today/yesterday/week/month/year/custom date),
  per-date dropdown when "All Time".
- Collapsible date-group accordions with per-day income/expense/net badges,
  expand-all / collapse-all, per-date "+ Expense / + Income" quick-add.
- Desktop table + mobile swipeable card list; summary cards (income/expense/net/count).
- Add/edit form: expense/income toggle (auto-switches category), amount (validated > 0),
  category select + inline "new category" creator, quick date chips (Today/Yesterday/2d/3d)
  + date picker, account/wallet select with live balances, note input with
  frequency-sorted recent-note chips + datalist, trip/event link select, custom tags input.
- Edit auto-resolves stale/wrong-type categories; delete via confirm modal.
- PDF export (`jsPDF` + `autotable`): filtered report with totals row + confirm modal.

## 5. Lent to Friends (`pages/LentMoney.jsx` + `components/lent/*`)

- Records: borrower name, amount, date lent, optional due date, phone, note.
- Loan ledger per record: initial loan + unlimited "Lend More" top-ups (each with
  amount/date/note), repayments ledger, combined chronological timeline with
  All / Loans / Returns tabs.
- KPIs: pending to collect, recovered amount + recovery-rate bar, total lent,
  settled-record count.
- Status engine: pending / partial / overdue (past due date) / settled; filters for
  all/active/pending/partial/overdue/settled + 5 sort orders + text search.
- Active list + collapsible "Settled Records Archive".
- Actions per card: Lend More, Record Return, Settle (confirm), Remind (WhatsApp/SMS
  message composer in `ReminderModal`), edit, delete (confirm).
- Every lend / top-up / repayment / settlement auto-posts a matching transaction
  (expense `Lent Money` / income `Lent Returned`, auto-creating the category if missing).
- PDF report with totals row + confirm modal.

## 6. Borrowed Money (`pages/BorrowedMoney.jsx` + `components/borrow/*`)

- Mirror of Lent: lender name, amount, date borrowed, due date, phone, note;
  borrow ledger + top-ups (`BorrowMoreModal`), repayments (`BorrowRepaymentModal`),
  reminder composer (`BorrowReminderModal`), same statuses/filters/sorts/archive.
- Auto-posts matching transactions (income `Borrowed Money` / expense `Debt Repayment`).
- KPIs: pending debt owed, total repaid + rate bar, total borrowed, settled debts.
- PDF report with totals row + confirm modal.

## 7. Accounts & Wallets (`pages/Accounts.jsx`)

- Account types: bank / cash / credit / digital wallet-UPI / savings / investment,
  each with name, type, initial balance, color theme, icon, default flag.
- Live balances computed from the transaction ledger (income/expense per account +
  transfer in/out); net-worth summary (liquid assets vs liabilities).
- Transfer Funds modal (from/to/different-account validation, amount, date, note)
  recorded as `type: 'transfer'` transactions; recent-transfers ledger.
- Add/edit/delete (delete blocked when only one account left; deleting keeps history).

## 8. Subscriptions (`pages/Subscriptions.jsx`)

- Recurring items: name, amount, expense/income type, category, daily/weekly/monthly/
  yearly frequency, next due date, active flag.
- Auto-post engine: on app load (`fetchData`) and on add/edit, due active items post
  a transaction and roll `nextDueDate` forward; toast announces auto-posts.
- Monthly fixed-cost projection (daily×30, weekly×4.33, monthly×1, yearly÷12),
  active/total counts, pause/resume toggle, edit/delete (confirm).

## 9. Savings Goals (`pages/SavingsGoals.jsx`)

- Goals: name, target amount, saved amount, optional deadline, color, icon.
- KPIs: total saved, total target, overall % bar, completed count.
- Goal cards with progress bar, days-left/overdue label, deposit count.
- Add Funds modal → `contributeToGoal` appends timestamped contributions, flips status
  to completed at 100% with celebration toast.

## 10. Trips & Events (`pages/Events.jsx`)

- Events: name, URL-safe `#tag` (auto-slugged from name), budget, start/end dates,
  color, icon, description.
- Live spend computed by matching expense transactions via `eventId`, `eventTag`,
  `#tag` in notes, or `tags[]`; per-event spent/remaining/%/over-budget/tx-count.
- Summary: total spent, total budget, utilization bar, over-budget count.
- View-expenses modal per event; create/edit/delete (delete preserves history).

## 11. Analytics (`pages/Analytics.jsx`)

- Overview tab: total income/expense, savings rate + net surplus, receivable-vs-debt
  card; income-vs-expense pie; expenses-by-category bar; category breakdown list
  with share %.
- Period-comparison tab: Month-vs-last / Quarter-vs-last / Year-vs-last / custom
  dual ranges; spending/income/savings deltas with % badges, daily burn rate,
  side-by-side category bar chart, per-category variance list (SAVED/INCREASED).
- All charts privacy-aware (masked ticks/tooltips).

## 12. Settings (`pages/Settings.jsx`)

- Account & Cloud Security card: profile display, display-name edit, Sync Cloud Data
  (migrates guest data + refreshes), password reset, Purge Cache (explicit local wipe),
  sign out.
- Target Budgets: global monthly limit + per-expense-category envelope limits
  (inline edit), consumed by Dashboard budget bars.
- Privacy & Shortcuts card: privacy toggle, haptics toggle + intensity + test buzz,
  keyboard-shortcut reference.
- Theme card: light / dark / system switcher.
- Data Management: full-system JSON backup export (v3.0: transactions, categories,
  accounts, goals, subscriptions, events, lent, borrowed, settings), JSON restore
  with animated progress modal + id remapping (no duplicate auto-posted transactions),
  CSV export of transactions (`Papa.unparse`).

## 13. Data layer (`services/db.js`, `services/firebase.js`, `context/TransactionContext.jsx`)

- Firestore paths (all under `users/{uid}`): `transactions`, `categories`,
  `settings/config`, `subscriptions`, `accounts`, `savings_goals`, `events`,
  `lent_records`, `borrowed_records`. Rules (`firestore.rules`): users can only
  read/write their own subtree; root collections denied.
- `DataService` (35 methods): full CRUD per collection + `migrateLocalDataToCloud`,
  `purgeAllLocalData` (explicit only), `cleanRootCollections` (no-op).
- Default seed data: 11 categories (Food, Groceries, Travel, Entertainment, Medical,
  Lent Money, Debt Repayment, From Dad, Trading, Borrowed Money, Lent Returned) with
  auto-backfill of missing defaults; 3 accounts (Primary Bank default, Cash Wallet,
  Credit Card). Guest store mirrors the same seeds.
- `TransactionContext`: central store exposing all collections + every action
  (incl. `transferFunds`, `contributeToGoal`, `recordRepayment`, `lendMoreMoney`,
  `settleLentRecord`, borrow twins, `restoreCompleteBackup`, `refreshData`),
  memoized derived `accountsWithBalances` and `eventsWithStats`.
- Legacy Express + SQLite backend (`server/`) is unused dead code (frontend talks
  only to Firestore); kept for reference, not wired to any npm script.

## 14. Suggested next features (NOT built yet)

Pick from here when asked to "add more features" — check this list first and delete
the item from this section when it gets built:

1. Receipt attachments (photo upload per transaction, thumbnail in ledger).
2. CSV import with duplicate detection + column mapping preview.
3. Budget overspend push/in-app alerts + monthly rollover of unused budget.
4. Recurring-transaction rule engine beyond subscriptions (e.g. "every payday").
5. Bill reminders with due notifications (build on existing due-date engine).
6. Monthly auto-generated PDF/email report.
7. Spending forecast ("at this pace you'll spend ₹X by month-end").
8. Multi-currency support (currently INR-only).
9. Search Volta: global search ranking tuning + recent-search history.
10. Shared lent/borrowed ledgers (two-user settle-up view).
11. Dark-mode chart palette audit (some tooltip greys are low contrast).
12. Remove dead Express/SQLite `server/` or wire it as an optional self-hosted backend.
13. Onboarding tour for first-run users (guest → sign-in funnel).
14. PWA installability (manifest + service worker + offline queue).
15. Unit/integration tests (currently zero; `db.js` guest store is the best first target).

## 15. Recent change log (latest first)

- 2026-09-22: Verified all 10 routes (0 errors/overflow/unnamed buttons); added
  speed-dial + bottom-nav aria-labels, meta description/theme-color, `robots.txt`.
- 2026-09-22: Guest offline persistence for all collections; removed startup +
  per-fetch storage wipes; display-only dedup (no auto-delete); guest→cloud
  migration on sign-in/sync; transfer excluded from income/expense + PDF;
  local-date settlement fix; FA icon map completion; `isDanger` modal props;
  amount validation; catch-all route; Dockerfile header fix.
