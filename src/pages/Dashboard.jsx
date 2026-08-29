import React, { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTransactions } from '../context/TransactionContext';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faWallet, 
  faArrowTrendUp, 
  faArrowTrendDown, 
  faHandHoldingDollar, 
  faHandHolding, 
  faExclamationTriangle, 
  faArrowRight, 
  faCoins, 
  faReceipt,
  faShieldAlt,
  faBuildingColumns,
  faRightLeft,
  faBullseye,
  faSuitcase
} from '@fortawesome/free-solid-svg-icons';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import { getCategoryIcon, resolveCategory } from '../utils/categoryIcons';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler);

const Dashboard = () => {
  const { transactions, categories, accounts = [], savingsGoals = [], events = [], lentRecords = [], borrowedRecords = [], loading, settings } = useTransactions();
  const { isPrivacyMode } = useUI();
  const { currentUser, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const formatCurrency = (amount) => {
    if (isPrivacyMode) {
      return '₹••••••';
    }
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let monthlyIncome = 0;
    let monthlyExpense = 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    transactions.forEach(t => {
      const amount = parseFloat(t.amount) || 0;
      const tDate = new Date(t.date);
      const isThisMonth = tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;

      if (t.type === 'income') {
        income += amount;
        if (isThisMonth) monthlyIncome += amount;
      } else if (t.type === 'expense') {
        expense += amount;
        if (isThisMonth) monthlyExpense += amount;
      }
    });

    let totalAccountsBalance = 0;
    if (accounts.length > 0) {
      accounts.forEach(acc => {
        totalAccountsBalance += (parseFloat(acc.balance) || 0);
      });
    } else {
      totalAccountsBalance = income - expense;
    }

    let totalLentPending = 0;
    lentRecords.forEach(r => {
      const total = parseFloat(r.amount) || 0;
      const returned = parseFloat(r.returnedAmount) || 0;
      totalLentPending += Math.max(0, total - returned);
    });

    let totalBorrowedPending = 0;
    borrowedRecords.forEach(r => {
      const total = parseFloat(r.amount) || 0;
      const returned = parseFloat(r.returnedAmount) || 0;
      totalBorrowedPending += Math.max(0, total - returned);
    });

    const netWorth = totalAccountsBalance + totalLentPending - totalBorrowedPending;

    return {
      balance: totalAccountsBalance,
      income,
      expense,
      monthlyIncome,
      monthlyExpense,
      totalLentPending,
      totalBorrowedPending,
      netWorth
    };
  }, [transactions, accounts, lentRecords, borrowedRecords]);

  // Upcoming / Overdue Due Date Alerts
  const dueAlerts = useMemo(() => {
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Lent records
    lentRecords.forEach(r => {
      const total = parseFloat(r.amount) || 0;
      const returned = parseFloat(r.returnedAmount) || 0;
      const remaining = Math.max(0, total - returned);

      if (remaining > 0 && r.dueDate) {
        const due = new Date(r.dueDate);
        const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          alerts.push({
            id: `lent_${r.id}`,
            type: 'lent',
            person: r.borrowerName,
            amount: remaining,
            dueDate: r.dueDate,
            isOverdue: diffDays < 0,
            diffDays,
            phone: r.phone,
            link: '/lent'
          });
        }
      }
    });

    // Borrowed records
    borrowedRecords.forEach(r => {
      const total = parseFloat(r.amount) || 0;
      const returned = parseFloat(r.returnedAmount) || 0;
      const remaining = Math.max(0, total - returned);

      if (remaining > 0 && r.dueDate) {
        const due = new Date(r.dueDate);
        const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          alerts.push({
            id: `borrow_${r.id}`,
            type: 'borrowed',
            person: r.lenderName,
            amount: remaining,
            dueDate: r.dueDate,
            isOverdue: diffDays < 0,
            diffDays,
            phone: r.phone,
            link: '/borrowed'
          });
        }
      }
    });

    return alerts.sort((a, b) => a.diffDays - b.diffDays);
  }, [lentRecords, borrowedRecords]);

  const budgetLimit = settings?.monthlyBudget || 0;
  const hasBudget = budgetLimit > 0;
  const budgetPercentage = hasBudget ? Math.min((stats.monthlyExpense / budgetLimit) * 100, 100) : 0;
  const velocityMeter = Math.min((stats.monthlyExpense / (stats.monthlyIncome || 1)) * 100, 100);

  const expenseByCategory = useMemo(() => {
    const grouped = {};
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      if (t.type !== 'expense') continue;
      const cat = resolveCategory(t.categoryId, categories, t.note);
      const catName = cat?.name || 'General';
      const catColor = cat?.color || '#71717a';
      if (!grouped[catName]) {
        grouped[catName] = { name: catName, amount: 0, color: catColor };
      }
      grouped[catName].amount += parseFloat(t.amount) || 0;
    }
    return Object.values(grouped).sort((a, b) => b.amount - a.amount);
  }, [transactions, categories]);

  const trendData = useMemo(() => {
    const labels = [];
    const incomeData = new Float64Array(7);
    const expenseData = new Float64Array(7);
    const dayMap = new Map();

    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${day}`;
      dayMap.set(key, i);
      labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    }

    transactions.forEach(t => {
      if (!t.date) return;
      const dateKey = typeof t.date === 'string' && t.date.length >= 10 ? t.date.slice(0, 10) : '';
      const index = dayMap.get(dateKey);
      if (index !== undefined) {
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') incomeData[index] += amt;
        else if (t.type === 'expense') expenseData[index] += amt;
      }
    });

    return { labels, incomeData: Array.from(incomeData), expenseData: Array.from(expenseData) };
  }, [transactions]);

  const recentTransactions = useMemo(() => {
    if (!transactions.length) return [];
    return [...transactions]
      .sort((a, b) => {
        const bTime = typeof b.date === 'string' ? (new Date(b.date).getTime() || 0) : 0;
        const aTime = typeof a.date === 'string' ? (new Date(a.date).getTime() || 0) : 0;
        return bTime - aTime;
      })
      .slice(0, 5);
  }, [transactions]);

  const donutChartData = useMemo(() => ({
    labels: expenseByCategory.map(e => e.name),
    datasets: [{
      data: expenseByCategory.map(e => e.amount),
      backgroundColor: expenseByCategory.map(e => e.color),
      borderWidth: 0,
      hoverOffset: 4
    }]
  }), [expenseByCategory]);

  const lineChartData = useMemo(() => ({
    labels: trendData.labels,
    datasets: [
      {
        label: 'Income',
        data: trendData.incomeData,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.06)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#10b981'
      },
      {
        label: 'Expense',
        data: trendData.expenseData,
        borderColor: '#f43f5e',
        backgroundColor: 'rgba(244, 63, 94, 0.06)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#f43f5e'
      }
    ]
  }), [trendData]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Pills */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Financial position, cash flow & debts
          </p>
        </div>

        {/* Minimalist Quick Shortcuts */}
        <div className="flex items-center gap-2">
          <Link
            to="/transactions"
            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 touch-feedback border border-zinc-200/60 dark:border-zinc-700/60"
          >
            <FontAwesomeIcon icon={faReceipt} className="text-[11px] text-zinc-400" />
            <span>Ledger</span>
          </Link>
          <Link
            to="/lent"
            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 touch-feedback border border-zinc-200/60 dark:border-zinc-700/60"
          >
            <FontAwesomeIcon icon={faHandHoldingDollar} className="text-[11px] text-zinc-400" />
            <span>Lent</span>
          </Link>
          <Link
            to="/borrowed"
            className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 touch-feedback border border-zinc-200/60 dark:border-zinc-700/60"
          >
            <FontAwesomeIcon icon={faHandHolding} className="text-[11px] text-zinc-400" />
            <span>Debts</span>
          </Link>
        </div>
      </header>

      {/* Guest Mode Cloud Security Banner */}
      {!currentUser && (
        <div className="p-4 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 dark:bg-zinc-900/10 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faShieldAlt} />
            </div>
            <div>
              <p className="text-xs font-bold">You are in Guest Mode</p>
              <p className="text-[11px] opacity-80">Sign in with your Google account to load and protect your cloud finances.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="px-3.5 py-1.5 bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shrink-0 touch-feedback"
          >
            Sign In with Google
          </button>
        </div>
      )}

      {/* Financial Health & KPI Multi-Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cash Balance */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Total Balance
              </p>
              <h2 className={`text-2xl font-bold mt-1 tracking-tight ${stats.balance >= 0 ? 'text-zinc-900 dark:text-white' : 'text-rose-500'}`}>
                <AnimatedCounter value={stats.balance} isCurrency={true} />
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faWallet} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5 flex items-center gap-1">
            <span>Net Monthly:</span>
            <strong className={stats.monthlyIncome - stats.monthlyExpense >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
              {formatCurrency(stats.monthlyIncome - stats.monthlyExpense)}
            </strong>
          </p>
        </div>

        {/* Monthly Income */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Monthly Income
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-emerald-600 dark:text-emerald-400">
                <AnimatedCounter value={stats.monthlyIncome} isCurrency={true} />
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faArrowTrendUp} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            Total all time: {formatCurrency(stats.income)}
          </p>
        </div>

        {/* Monthly Expense */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Monthly Expense
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                <AnimatedCounter value={stats.monthlyExpense} isCurrency={true} />
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faArrowTrendDown} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            Total all time: {formatCurrency(stats.expense)}
          </p>
        </div>

        {/* Net Liquid Worth */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Net Liquid Worth
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                <AnimatedCounter value={stats.netWorth} isCurrency={true} />
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faCoins} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5 truncate">
            {isPrivacyMode ? '+₹•••• Lent • -₹•••• Debt' : `+₹${stats.totalLentPending.toLocaleString('en-IN')} Lent • -₹${stats.totalBorrowedPending.toLocaleString('en-IN')} Debt`}
          </p>
        </div>
      </div>

      {/* Quick Accounts & Wallets Glance */}
      {accounts.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faBuildingColumns} className="text-zinc-400" />
              <span>Accounts & Wallets</span>
            </h3>
            <Link 
              to="/accounts" 
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>Manage & Transfer</span>
              <FontAwesomeIcon icon={faArrowRight} className="text-[9px]" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {accounts.map(acc => (
              <div key={acc.id} className="p-2.5 rounded-xl liquid-glass-subtle flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div 
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs shrink-0"
                    style={{ backgroundColor: acc.color || '#3b82f6' }}
                  >
                    <FontAwesomeIcon icon={faBuildingColumns} className="text-[10px]" />
                  </div>
                  <div className="truncate">
                    <p className="text-[11px] font-bold text-zinc-900 dark:text-white truncate leading-tight">
                      {acc.name}
                    </p>
                    <p className="text-[9px] text-zinc-400 uppercase tracking-wider">
                      {acc.type}
                    </p>
                  </div>
                </div>
                <p className={`text-xs font-bold shrink-0 ${acc.balance < 0 ? 'text-rose-500' : 'text-zinc-900 dark:text-white'}`}>
                  {formatCurrency(acc.balance || 0)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Savings Goals Glance */}
      {savingsGoals.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faBullseye} className="text-emerald-500" />
              <span>Savings Goals & Milestones</span>
            </h3>
            <Link 
              to="/goals" 
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>View All Goals</span>
              <FontAwesomeIcon icon={faArrowRight} className="text-[9px]" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savingsGoals.slice(0, 3).map(goal => {
              const target = parseFloat(goal.targetAmount) || 0;
              const saved = parseFloat(goal.savedAmount) || 0;
              const percent = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
              const isDone = saved >= target && target > 0;

              return (
                <div key={goal.id} className="p-3 rounded-xl liquid-glass-subtle space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {goal.name}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500">
                      {percent.toFixed(0)}%
                    </span>
                  </div>

                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-700" 
                      style={{ 
                        width: `${percent}%`,
                        backgroundColor: goal.color || '#10b981'
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-zinc-400">
                    <span>{formatCurrency(saved)}</span>
                    <span>Target: {formatCurrency(target)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Active Trips & Events Glance */}
      {events.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faSuitcase} className="text-indigo-500" />
              <span>Active Trips & Event Budgets</span>
            </h3>
            <Link 
              to="/events" 
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>View All Events</span>
              <FontAwesomeIcon icon={faArrowRight} className="text-[9px]" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {events.slice(0, 3).map(event => {
              const budget = parseFloat(event.budget) || 0;
              const spent = parseFloat(event.spent) || 0;
              const percent = budget > 0 ? (spent / budget) * 100 : 0;
              const isOver = spent > budget && budget > 0;

              return (
                <div key={event.id} className="p-3 rounded-xl liquid-glass-subtle space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {event.name}
                      </span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono">
                        #{event.tag}
                      </span>
                    </div>
                    {isOver ? (
                      <span className="text-[9px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">
                        Over
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-zinc-400">
                        {percent.toFixed(0)}%
                      </span>
                    )}
                  </div>

                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-700 ${isOver ? 'bg-rose-500' : 'bg-indigo-500'}`}
                      style={{ 
                        width: `${Math.min(percent, 100)}%`,
                        backgroundColor: isOver ? '#ef4444' : (event.color || '#6366f1')
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-zinc-400">
                    <span>Spent: {formatCurrency(spent)}</span>
                    <span>Budget: {budget > 0 ? formatCurrency(budget) : 'No limit'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Due Date & Action Alerts (If any) */}
      {dueAlerts.length > 0 && (
        <div className="glass-card p-4.5 border-amber-200/80 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-500" />
              <span>Pending Due Date Alerts</span>
            </h3>
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              {dueAlerts.length} item{dueAlerts.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {dueAlerts.map(alert => (
              <div 
                key={alert.id}
                className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                  alert.isOverdue 
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                    : 'bg-white dark:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-700/60'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-zinc-900 dark:text-white">{alert.person}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      alert.type === 'lent' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                    }`}>
                      {alert.type === 'lent' ? 'Lent' : 'Debt'}
                    </span>
                  </div>
                  <p className="font-bold text-xs mt-0.5 text-zinc-900 dark:text-white">
                    {formatCurrency(alert.amount)}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${alert.isOverdue ? 'text-rose-600 font-semibold' : 'text-zinc-400'}`}>
                    {alert.isOverdue ? `Overdue by ${Math.abs(alert.diffDays)}d` : `Due in ${alert.diffDays}d`}
                  </p>
                </div>

                <Link
                  to={alert.link}
                  className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700/70 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-[11px] flex items-center gap-1 shrink-0 transition-colors touch-feedback"
                >
                  <span>View</span>
                  <FontAwesomeIcon icon={faArrowRight} className="text-[9px]" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spending Velocity & Category Budgets */}
      <div className="glass-card p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {hasBudget ? 'Global Monthly Budget' : 'Monthly Spending Velocity'}
          </h3>
          {hasBudget && (
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {formatCurrency(stats.monthlyExpense)} / {formatCurrency(budgetLimit)}
            </span>
          )}
        </div>
        <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-700 ease-out rounded-full ${
              hasBudget 
                ? (budgetPercentage < 75 ? 'bg-emerald-500' : budgetPercentage < 90 ? 'bg-amber-500' : 'bg-rose-500')
                : (velocityMeter < 50 ? 'bg-emerald-500' : velocityMeter < 80 ? 'bg-amber-500' : 'bg-rose-500')
            }`}
            style={{ width: `${hasBudget ? budgetPercentage : velocityMeter}%` }}
          />
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 mb-4">
          {hasBudget 
            ? (budgetPercentage >= 100 
                ? "You have reached your global budget limit." 
                : `${budgetPercentage.toFixed(1)}% of your monthly budget used.`)
            : `You have spent ${velocityMeter.toFixed(1)}% of your monthly income so far.`
          }
        </p>

        {/* Category Budget Bars */}
        {categories.filter(c => c.budgetLimit > 0).length > 0 && (
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 space-y-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
              Category Budgets
            </h3>
            {categories.filter(c => c.budgetLimit > 0).map(cat => {
              const spent = expenseByCategory.find(e => e.name === cat.name)?.amount || 0;
              const limit = parseFloat(cat.budgetLimit);
              const percent = Math.min((spent / limit) * 100, 100);
              const isOver = spent > limit;
              
              return (
                <div key={cat.id}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <span className="w-4 flex justify-center">
                        <FontAwesomeIcon icon={getCategoryIcon(cat.icon)} />
                      </span>
                      <span>{cat.name}</span>
                    </span>
                    <span className="text-[10px] font-medium text-zinc-500">
                      {formatCurrency(spent)} / {formatCurrency(limit)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-700 ease-out rounded-full ${
                        percent < 75 ? 'bg-emerald-500' : percent < 90 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  {isOver && (
                    <p className="text-[9px] text-rose-500 mt-1">Over budget by {formatCurrency(spent - limit)}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trend Line Chart */}
      <div className="glass-card p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Weekly Cash Flow Trend</h3>
          <span className="text-xs text-zinc-400">Past 7 Days</span>
        </div>
        <div className="w-full h-[230px]">
          <Line 
            data={lineChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top', labels: { color: '#a1a1aa', font: { family: 'Plus Jakarta Sans', size: 11 } } },
                tooltip: {
                  callbacks: {
                    label: (context) => {
                      if (isPrivacyMode) return `${context.dataset.label || ''}: ₹••••••`;
                      const val = context.parsed.y || context.raw || 0;
                      return `${context.dataset.label || ''}: ₹${Number(val).toLocaleString('en-IN')}`;
                    }
                  }
                }
              },
              scales: {
                y: { 
                  grid: { color: 'rgba(161, 161, 170, 0.08)' }, 
                  ticks: { 
                    color: '#a1a1aa', 
                    font: { size: 10 },
                    callback: (value) => isPrivacyMode ? '••••' : `₹${Number(value).toLocaleString('en-IN')}`
                  } 
                },
                x: { grid: { display: false }, ticks: { color: '#a1a1aa', font: { size: 10 } } }
              }
            }}
          />
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses by Category */}
        <div className="glass-card p-5 flex flex-col items-center">
          <h3 className="text-sm font-semibold mb-4 text-zinc-900 dark:text-white self-start">Expenses by Category</h3>
          <div className="w-full max-w-[260px] aspect-square relative my-auto">
            {expenseByCategory.length > 0 ? (
              <Doughnut 
                data={donutChartData} 
                options={{
                  cutout: '72%',
                  plugins: { 
                    legend: { position: 'bottom', labels: { color: '#a1a1aa', font: { family: 'Plus Jakarta Sans', size: 11 } } },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          if (isPrivacyMode) return `${context.label || ''}: ₹••••••`;
                          const val = context.raw || 0;
                          return `${context.label || ''}: ₹${Number(val).toLocaleString('en-IN')}`;
                        }
                      }
                    }
                  }
                }} 
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
                No expense data
              </div>
            )}
          </div>
        </div>
        
        {/* Recent Transactions */}
        <div className="glass-card p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Recent Transactions</h3>
            <Link to="/transactions" className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
              View All &rarr;
            </Link>
          </div>
          <div className="space-y-2">
            {recentTransactions.map(t => {
              const cat = resolveCategory(t.categoryId, categories, t.note);
              const hasNote = Boolean(t.note && t.note.trim());
              const categoryName = cat?.name || 'Uncategorized';
              const categoryColor = cat?.color || '#71717a';

              return (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors touch-feedback">
                  <div 
                    className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-white text-xs shadow-2xs" 
                    style={{ backgroundColor: categoryColor }}
                  >
                    <FontAwesomeIcon icon={getCategoryIcon(cat?.icon)} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs text-zinc-900 dark:text-white leading-snug truncate">
                      {hasNote ? t.note : categoryName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-zinc-400">
                      <span>{new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                      <span>&bull;</span>
                      <span className="truncate">{categoryName}</span>
                    </div>
                  </div>
                  
                  <div className="text-right shrink-0 ml-2">
                    <span className={`font-semibold text-xs whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-white'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
            {transactions.length === 0 && (
              <p className="text-zinc-400 text-center py-8 text-xs">No transactions recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
