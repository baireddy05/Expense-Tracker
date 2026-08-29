import React, { useState, useMemo } from 'react';
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
  faShieldAlt,
  faScaleBalanced,
  faCalendarAlt,
  faArrowRight,
  faExchangeAlt,
  faClock
} from '@fortawesome/free-solid-svg-icons';
import { getCategoryIcon, resolveCategory } from '../utils/categoryIcons';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import { useUI } from '../context/UIContext';
import { getLocalDateString, formatDisplayDate } from '../utils/dateUtils';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement);

const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

const Analytics = () => {
  const { transactions = [], categories = [], lentRecords = [], borrowedRecords = [] } = useTransactions();
  const { isPrivacyMode } = useUI();
  const { currentUser, openAuthModal } = useAuth();

  // Active View Tab: 'overview' | 'comparison'
  const [activeTab, setActiveTab] = useState('overview');

  // Comparison Settings
  const [comparisonPreset, setComparisonPreset] = useState('month'); // 'month' | 'quarter' | 'year' | 'custom'
  const [customRange, setCustomRange] = useState({
    startA: '',
    endA: '',
    startB: '',
    endB: ''
  });

  const formatCurrency = (amount) => {
    if (isPrivacyMode) {
      return '₹••••••';
    }
    return currencyFormatter.format(amount);
  };

  // ==========================================
  // Overview Tab Calculations
  // ==========================================
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
      const amount = parseFloat(t.amount) || 0;
      if (t.type === 'income') income += amount;
      else if (t.type === 'expense') expense += amount;
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

  // ==========================================
  // Period Comparison Tab Calculations
  // ==========================================
  const comparisonData = useMemo(() => {
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = today.getMonth(); // 0-indexed

    let pA_Start, pA_End, pA_Label;
    let pB_Start, pB_End, pB_Label;

    if (comparisonPreset === 'month') {
      // Period A: Current Month
      pA_Start = new Date(curYear, curMonth, 1);
      pA_End = new Date(curYear, curMonth + 1, 0);
      pA_Label = today.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) + ' (Current)';

      // Period B: Previous Month
      pB_Start = new Date(curYear, curMonth - 1, 1);
      pB_End = new Date(curYear, curMonth, 0);
      pB_Label = pB_Start.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) + ' (Previous)';
    } else if (comparisonPreset === 'quarter') {
      // Current Quarter
      const curQuarter = Math.floor(curMonth / 3);
      pA_Start = new Date(curYear, curQuarter * 3, 1);
      pA_End = new Date(curYear, (curQuarter + 1) * 3, 0);
      pA_Label = `Q${curQuarter + 1} ${curYear} (Current)`;

      // Previous Quarter
      const prevQuarter = curQuarter === 0 ? 3 : curQuarter - 1;
      const prevQuarterYear = curQuarter === 0 ? curYear - 1 : curYear;
      pB_Start = new Date(prevQuarterYear, prevQuarter * 3, 1);
      pB_End = new Date(prevQuarterYear, (prevQuarter + 1) * 3, 0);
      pB_Label = `Q${prevQuarter + 1} ${prevQuarterYear} (Previous)`;
    } else if (comparisonPreset === 'year') {
      pA_Start = new Date(curYear, 0, 1);
      pA_End = new Date(curYear, 11, 31);
      pA_Label = `${curYear} (This Year)`;

      pB_Start = new Date(curYear - 1, 0, 1);
      pB_End = new Date(curYear - 1, 11, 31);
      pB_Label = `${curYear - 1} (Last Year)`;
    } else {
      pA_Start = customRange.startA ? new Date(customRange.startA) : new Date(curYear, curMonth, 1);
      pA_End = customRange.endA ? new Date(customRange.endA) : new Date(curYear, curMonth + 1, 0);
      pA_Label = 'Period A';

      pB_Start = customRange.startB ? new Date(customRange.startB) : new Date(curYear, curMonth - 1, 1);
      pB_End = customRange.endB ? new Date(customRange.endB) : new Date(curYear, curMonth, 0);
      pB_Label = 'Period B';
    }

    // Helper to filter txns by date range
    const filterTx = (start, end) => {
      const s = start.toISOString().split('T')[0];
      const e = end.toISOString().split('T')[0];
      return transactions.filter(t => {
        const d = (t.date || '').split('T')[0];
        return d >= s && d <= e;
      });
    };

    const txA = filterTx(pA_Start, pA_End);
    const txB = filterTx(pB_Start, pB_End);

    // Compute sums for Period A
    let incomeA = 0, expenseA = 0;
    const catMapA = {};
    txA.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') incomeA += amt;
      else if (t.type === 'expense') {
        expenseA += amt;
        const cat = resolveCategory(t.categoryId, categories, t.note);
        const name = cat?.name || 'General';
        catMapA[name] = (catMapA[name] || 0) + amt;
      }
    });

    // Compute sums for Period B
    let incomeB = 0, expenseB = 0;
    const catMapB = {};
    txB.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') incomeB += amt;
      else if (t.type === 'expense') {
        expenseB += amt;
        const cat = resolveCategory(t.categoryId, categories, t.note);
        const name = cat?.name || 'General';
        catMapB[name] = (catMapB[name] || 0) + amt;
      }
    });

    const savingsA = incomeA - expenseA;
    const savingsB = incomeB - expenseB;

    const daysA = Math.max(1, Math.ceil((pA_End - pA_Start) / (1000 * 60 * 60 * 24)) + 1);
    const daysB = Math.max(1, Math.ceil((pB_End - pB_Start) / (1000 * 60 * 60 * 24)) + 1);

    const dailyA = expenseA / daysA;
    const dailyB = expenseB / daysB;

    // Deltas
    const expenseDiff = expenseA - expenseB;
    const expensePercent = expenseB > 0 ? (expenseDiff / expenseB) * 100 : (expenseA > 0 ? 100 : 0);

    const incomeDiff = incomeA - incomeB;
    const incomePercent = incomeB > 0 ? (incomeDiff / incomeB) * 100 : (incomeA > 0 ? 100 : 0);

    const savingsDiff = savingsA - savingsB;
    const savingsPercent = savingsB !== 0 ? (savingsDiff / Math.abs(savingsB)) * 100 : (savingsA > 0 ? 100 : 0);

    // All categories combined list
    const allCatNames = Array.from(new Set([...Object.keys(catMapA), ...Object.keys(catMapB)]));
    const categoryShifts = allCatNames.map(name => {
      const a = catMapA[name] || 0;
      const b = catMapB[name] || 0;
      const diff = a - b;
      const pct = b > 0 ? (diff / b) * 100 : (a > 0 ? 100 : 0);
      const catObj = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
      return {
        name,
        amountA: a,
        amountB: b,
        diff,
        pct,
        color: catObj?.color || '#6366f1',
        icon: catObj?.icon || 'fa-tag'
      };
    }).sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));

    return {
      pA_Label,
      pB_Label,
      incomeA,
      incomeB,
      expenseA,
      expenseB,
      savingsA,
      savingsB,
      dailyA,
      dailyB,
      expenseDiff,
      expensePercent,
      incomeDiff,
      incomePercent,
      savingsDiff,
      savingsPercent,
      categoryShifts,
      topCategories: categoryShifts.slice(0, 6)
    };
  }, [comparisonPreset, customRange, transactions, categories]);

  // Comparative Side-by-Side Chart Data
  const comparativeChartData = useMemo(() => {
    return {
      labels: comparisonData.topCategories.map(c => c.name),
      datasets: [
        {
          label: comparisonData.pA_Label,
          data: comparisonData.topCategories.map(c => c.amountA),
          backgroundColor: '#3b82f6',
          borderRadius: 6
        },
        {
          label: comparisonData.pB_Label,
          data: comparisonData.topCategories.map(c => c.amountB),
          backgroundColor: '#94a3b8',
          borderRadius: 6
        }
      ]
    };
  }, [comparisonData]);

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header & View Switcher */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center text-sm shadow-2xs">
              <FontAwesomeIcon icon={activeTab === 'overview' ? faChartPie : faScaleBalanced} />
            </span>
            <span>{activeTab === 'overview' ? 'Financial Analytics' : 'Period Comparisons'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {activeTab === 'overview' 
              ? 'Spending distribution, savings rate & debt position' 
              : 'Compare spending velocity and trends across time periods'}
          </p>
        </div>

        {/* Tab Toggle Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer touch-feedback flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <FontAwesomeIcon icon={faChartPie} className="text-xs" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('comparison')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer touch-feedback flex items-center gap-2 ${
              activeTab === 'comparison'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <FontAwesomeIcon icon={faScaleBalanced} className="text-xs" />
            <span>Period Comparison</span>
          </button>
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

      {/* ========================================================================= */}
      {/* OVERVIEW TAB */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
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
                          ticks: { 
                            color: '#a1a1aa', 
                            font: { size: 10 },
                            callback: (value) => isPrivacyMode ? '••••' : `₹${Number(value).toLocaleString('en-IN')}`
                          }
                        },
                        x: {
                          grid: { display: false },
                          ticks: { color: '#a1a1aa', font: { size: 10 } }
                        }
                      },
                      plugins: {
                        legend: { display: false },
                        tooltip: {
                          callbacks: {
                            label: (context) => {
                              if (isPrivacyMode) return `${context.dataset.label || ''}: ₹••••••`;
                              const val = context.parsed.y || context.raw || 0;
                              return `${context.dataset.label || ''}: ₹${Number(val).toLocaleString('en-IN')}`;
                            }
                          }
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-400">No data available</div>
                )}
              </div>
            </div>
          </div>

          {/* Category Spending Breakdown Table */}
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
      )}

      {/* ========================================================================= */}
      {/* PERIOD COMPARISON TAB */}
      {/* ========================================================================= */}
      {activeTab === 'comparison' && (
        <div className="space-y-6 animate-fade-in">
          {/* Comparison Controls */}
          <div className="glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {[
                { id: 'month', label: 'Month vs. Last Month' },
                { id: 'quarter', label: 'Quarter vs. Last Quarter' },
                { id: 'year', label: 'Year vs. Last Year' },
                { id: 'custom', label: 'Custom Range' }
              ].map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setComparisonPreset(preset.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer touch-feedback ${
                    comparisonPreset === preset.id
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span className="font-bold text-zinc-900 dark:text-white">{comparisonData.pA_Label}</span>
              <FontAwesomeIcon icon={faExchangeAlt} className="text-zinc-400 text-[10px]" />
              <span className="font-bold text-zinc-900 dark:text-white">{comparisonData.pB_Label}</span>
            </div>
          </div>

          {/* Custom Date Pickers (if custom selected) */}
          {comparisonPreset === 'custom' && (
            <div className="glass-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-bold text-zinc-900 dark:text-white">Period A (Primary)</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={customRange.startA}
                    onChange={e => setCustomRange({ ...customRange, startA: e.target.value })}
                    className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white"
                  />
                  <input
                    type="date"
                    value={customRange.endA}
                    onChange={e => setCustomRange({ ...customRange, endA: e.target.value })}
                    className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-zinc-900 dark:text-white">Period B (Comparison)</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={customRange.startB}
                    onChange={e => setCustomRange({ ...customRange, startB: e.target.value })}
                    className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white"
                  />
                  <input
                    type="date"
                    value={customRange.endB}
                    onChange={e => setCustomRange({ ...customRange, endB: e.target.value })}
                    className="px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Comparative Metrics KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Spend Velocity */}
            <div className="glass-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Spending Change
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  {formatCurrency(comparisonData.expenseA)}
                </h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  comparisonData.expenseDiff <= 0 
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                }`}>
                  {comparisonData.expensePercent > 0 ? `+${comparisonData.expensePercent.toFixed(1)}%` : `${comparisonData.expensePercent.toFixed(1)}%`}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">
                vs {formatCurrency(comparisonData.expenseB)} ({comparisonData.pB_Label})
              </p>
            </div>

            {/* Total Income Delta */}
            <div className="glass-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Income Change
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <h2 className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(comparisonData.incomeA)}
                </h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  comparisonData.incomeDiff >= 0 
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                }`}>
                  {comparisonData.incomePercent > 0 ? `+${comparisonData.incomePercent.toFixed(1)}%` : `${comparisonData.incomePercent.toFixed(1)}%`}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">
                vs {formatCurrency(comparisonData.incomeB)} ({comparisonData.pB_Label})
              </p>
            </div>

            {/* Net Savings Delta */}
            <div className="glass-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Net Savings Delta
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  {formatCurrency(comparisonData.savingsA)}
                </h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  comparisonData.savingsDiff >= 0 
                    ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                }`}>
                  {comparisonData.savingsPercent > 0 ? `+${comparisonData.savingsPercent.toFixed(1)}%` : `${comparisonData.savingsPercent.toFixed(1)}%`}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">
                vs {formatCurrency(comparisonData.savingsB)}
              </p>
            </div>

            {/* Daily Spend Burn Rate */}
            <div className="glass-card p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Daily Burn Rate
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  {formatCurrency(comparisonData.dailyA)}/d
                </h2>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">
                vs {formatCurrency(comparisonData.dailyB)}/d in previous period
              </p>
            </div>
          </div>

          {/* Comparative Side-by-Side Chart */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">
              Side-by-Side Category Spending Comparison
            </h3>
            <div className="w-full min-h-[260px]">
              {comparisonData.topCategories.length > 0 ? (
                <Bar 
                  data={comparativeChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(161, 161, 170, 0.08)' },
                        ticks: { 
                          color: '#a1a1aa', 
                          font: { size: 10 },
                          callback: (value) => isPrivacyMode ? '••••' : `₹${Number(value).toLocaleString('en-IN')}`
                        }
                      },
                      x: {
                        grid: { display: false },
                        ticks: { color: '#a1a1aa', font: { size: 10 } }
                      }
                    },
                    plugins: {
                      legend: { position: 'top', labels: { color: '#a1a1aa', font: { size: 11 } } },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            if (isPrivacyMode) return `${context.dataset.label || ''}: ₹••••••`;
                            const val = context.parsed.y || context.raw || 0;
                            return `${context.dataset.label || ''}: ₹${Number(val).toLocaleString('en-IN')}`;
                          }
                        }
                      }
                    }
                  }}
                />
              ) : (
                <div className="flex h-40 items-center justify-center text-xs text-zinc-400">
                  No overlapping expenses recorded in these periods.
                </div>
              )}
            </div>
          </div>

          {/* Category Shifts Detailed Table */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">
              Category Shift & Variance Analysis
            </h3>

            <div className="space-y-2.5">
              {comparisonData.categoryShifts.map(cat => {
                const isDecreased = cat.diff < 0;
                return (
                  <div 
                    key={cat.name}
                    className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs shrink-0 shadow-2xs"
                        style={{ backgroundColor: cat.color }}
                      >
                        <FontAwesomeIcon icon={getCategoryIcon(cat.icon)} />
                      </div>
                      <div>
                        <p className="font-bold text-xs text-zinc-900 dark:text-white">{cat.name}</p>
                        <p className="text-[10px] text-zinc-400">
                          {formatCurrency(cat.amountA)} vs {formatCurrency(cat.amountB)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-left sm:text-right">
                        <p className={`text-xs font-bold ${isDecreased ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                          {cat.diff > 0 ? `+${formatCurrency(cat.diff)}` : `-${formatCurrency(Math.abs(cat.diff))}`}
                        </p>
                        <p className="text-[10px] text-zinc-400">
                          {cat.pct > 0 ? `+${cat.pct.toFixed(1)}%` : `${cat.pct.toFixed(1)}%`}
                        </p>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isDecreased
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                      }`}>
                        {isDecreased ? 'SAVED' : 'INCREASED'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {comparisonData.categoryShifts.length === 0 && (
                <p className="text-center py-6 text-xs text-zinc-400">No category variances to display.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
