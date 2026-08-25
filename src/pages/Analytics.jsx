import React, { useMemo } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { useAuth } from '../context/AuthContext';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartPie, 
  faArrowTrendUp, 
  faArrowTrendDown, 
  faHandHoldingDollar, 
  faHandHolding, 
  faTags,
  faShieldAlt
} from '@fortawesome/free-solid-svg-icons';
import { getCategoryIcon, resolveCategory } from '../utils/categoryIcons';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import { useUI } from '../context/UIContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement);

const Analytics = () => {
  const { transactions, categories, lentRecords = [], borrowedRecords = [] } = useTransactions();
  const { isPrivacyMode } = useUI();
  const { currentUser, openAuthModal } = useAuth();

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
      const amount = parseFloat(t.amount) || 0;
      if (t.type === 'income') income += amount;
      else expense += amount;
    });

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

    const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

    return {
      income,
      expense,
      balance: income - expense,
      totalLentPending,
      totalBorrowedPending,
      savingsRate
    };
  }, [transactions, lentRecords, borrowedRecords]);

  const incomeVsExpenseData = useMemo(() => {
    return {
      labels: ['Income', 'Expense'],
      datasets: [{
        data: [stats.income, stats.expense],
        backgroundColor: ['#10b981', '#f43f5e'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    };
  }, [stats]);

  const expenseByCategory = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const grouped = {};

    expenses.forEach(t => {
      const cat = resolveCategory(t.categoryId, categories, t.note);
      const catKey = cat?.id || cat?.name || 'general';
      const catName = cat?.name || 'General';
      const catColor = cat?.color || '#71717a';
      const catIcon = cat?.icon || 'fa-tag';

      if (!grouped[catKey]) {
        grouped[catKey] = {
          id: catKey,
          name: catName,
          amount: 0,
          color: catColor,
          icon: catIcon,
          share: 0
        };
      }
      grouped[catKey].amount += parseFloat(t.amount) || 0;
    });

    const list = Object.values(grouped).map(item => ({
      ...item,
      share: stats.expense > 0 ? (item.amount / stats.expense) * 100 : 0
    }));

    return list.sort((a, b) => b.amount - a.amount);
  }, [transactions, categories, stats.expense]);

  const categoryChartData = useMemo(() => ({
    labels: expenseByCategory.map(e => e.name),
    datasets: [{
      label: 'Amount (₹)',
      data: expenseByCategory.map(e => e.amount),
      backgroundColor: expenseByCategory.map(e => e.color),
      borderRadius: 6,
    }]
  }), [expenseByCategory]);

  const formatCurrency = (amount) => {
    if (isPrivacyMode) {
      return '₹••••••';
    }
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-sm shadow-2xs">
            <FontAwesomeIcon icon={faChartPie} />
          </span>
          Financial Analytics
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Spending distribution, savings rate & debt position
        </p>
      </header>

      {/* Guest Mode Cloud Security Banner */}
      {!currentUser && (
        <div className="p-4 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 dark:bg-zinc-900/10 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faShieldAlt} />
            </div>
            <div>
              <p className="text-xs font-bold">Cloud Analytics & Visual Insights</p>
              <p className="text-[11px] opacity-80">Sign in with your Google account to compute charts and statistics on your real data.</p>
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

      {/* Analytics Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Total Income</p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-emerald-600 dark:text-emerald-400">
                <AnimatedCounter value={stats.income} isCurrency={true} />
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faArrowTrendUp} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">All time logged income</p>
        </div>

        {/* Total Expenses */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Total Expenses</p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                <AnimatedCounter value={stats.expense} isCurrency={true} />
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faArrowTrendDown} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">All time logged expenses</p>
        </div>

        {/* Savings Rate */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Savings Rate</p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                {stats.savingsRate.toFixed(1)}%
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs shrink-0">
              %
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            Net Surplus: <strong className={stats.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>{formatCurrency(stats.balance)}</strong>
          </p>
        </div>

        {/* Receivable vs Debt */}
        <div className="glass-card p-5 transition-all glass-hover">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Receivable vs Debt</p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-amber-600 dark:text-amber-400">
                {isPrivacyMode ? '+₹••••' : `+₹${stats.totalLentPending.toLocaleString('en-IN')}`}
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faHandHoldingDollar} />
            </div>
          </div>
          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-2.5">
            Debt Owed: {isPrivacyMode ? '-₹••••' : `-₹${stats.totalBorrowedPending.toLocaleString('en-IN')}`}
          </p>
        </div>
      </div>

      {/* Primary Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expense Pie */}
        <div className="glass-card p-5 flex flex-col items-center">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white self-start mb-4">
            Income vs Expense Distribution
          </h3>
          <div className="w-full max-w-[260px] aspect-square relative my-auto">
            {transactions.length > 0 ? (
              <Pie 
                data={incomeVsExpenseData}
                options={{
                  plugins: {
                    legend: { position: 'bottom', labels: { color: '#a1a1aa', font: { family: 'Plus Jakarta Sans', size: 11 } } }
                  }
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">No data available</div>
            )}
          </div>
        </div>

        {/* Expenses by Category Bar */}
        <div className="glass-card p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">
            Expenses by Category (₹)
          </h3>
          <div className="flex-1 w-full min-h-[240px]">
            {expenseByCategory.length > 0 ? (
              <Bar 
                data={categoryChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: 'rgba(161, 161, 170, 0.08)' },
                      ticks: { color: '#a1a1aa', font: { size: 10 } }
                    },
                    x: {
                      grid: { display: false },
                      ticks: { color: '#a1a1aa', font: { size: 10 } }
                    }
                  },
                  plugins: {
                    legend: { display: false }
                  }
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-zinc-400">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Category Spending Breakdown Table with Progress Bars */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faTags} className="text-zinc-400 text-xs" />
          <span>Category Spending Breakdown</span>
        </h3>

        <div className="space-y-2.5">
          {expenseByCategory.map(cat => (
            <div key={cat.id} className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/30">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs shrink-0 shadow-2xs"
                    style={{ backgroundColor: cat.color }}
                  >
                    <FontAwesomeIcon icon={getCategoryIcon(cat.icon)} />
                  </div>
                  <span className="font-semibold text-xs text-zinc-900 dark:text-white">{cat.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-xs text-zinc-900 dark:text-white">
                    {formatCurrency(cat.amount)}
                  </span>
                  <span className="text-[11px] text-zinc-400 ml-1.5">({cat.share.toFixed(1)}%)</span>
                </div>
              </div>

              <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-700" 
                  style={{ width: `${Math.min(cat.share, 100)}%`, backgroundColor: cat.color }}
                />
              </div>
            </div>
          ))}

          {expenseByCategory.length === 0 && (
            <p className="text-center py-6 text-xs text-zinc-400">No category spending recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
