import React, { useMemo } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement } from 'chart.js';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChartPie, 
  faArrowTrendUp, 
  faArrowTrendDown, 
  faHandHoldingDollar, 
  faHandHolding, 
  faTags 
} from '@fortawesome/free-solid-svg-icons';
import { getCategoryIcon, resolveCategory } from '../utils/categoryIcons';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import { useUI } from '../context/UIContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement);

const Analytics = () => {
  const { transactions, categories, lentRecords = [], borrowedRecords = [] } = useTransactions();
  const { isPrivacyMode } = useUI();

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
        backgroundColor: ['#22c55e', '#ef4444'],
        borderWidth: 0,
      }]
    };
  }, [stats]);

  const debtComparisonData = useMemo(() => {
    return {
      labels: ['Lent (Receivable)', 'Borrowed (Debt)'],
      datasets: [{
        data: [stats.totalLentPending, stats.totalBorrowedPending],
        backgroundColor: ['#f59e0b', '#9333ea'],
        borderWidth: 0,
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
      const catColor = cat?.color || '#888888';
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <span className="p-2 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400">
            <FontAwesomeIcon icon={faChartPie} className="text-2xl" />
          </span>
          Financial Analytics
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Deep dive into spending habits, savings rate & debt position</p>
      </header>

      {/* Analytics Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-5 border-l-4 border-l-green-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Income</p>
          <h2 className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
            <AnimatedCounter value={stats.income} isCurrency={true} />
          </h2>
        </div>

        <div className="glass rounded-2xl p-5 border-l-4 border-l-red-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Expenses</p>
          <h2 className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
            <AnimatedCounter value={stats.expense} isCurrency={true} />
          </h2>
        </div>

        <div className="glass rounded-2xl p-5 border-l-4 border-l-primary-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Savings Rate</p>
          <h2 className="text-2xl font-bold mt-1 text-primary-600 dark:text-primary-400">
            {stats.savingsRate.toFixed(1)}%
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Net Surplus: {formatCurrency(stats.balance)}
          </p>
        </div>

        <div className="glass rounded-2xl p-5 border-l-4 border-l-amber-500">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Receivable vs Debt</p>
          <h2 className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {isPrivacyMode ? '+₹••••' : `+₹${stats.totalLentPending.toLocaleString('en-IN')}`}
          </h2>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
            Debt Owed: {isPrivacyMode ? '-₹••••' : `-₹${stats.totalBorrowedPending.toLocaleString('en-IN')}`}
          </p>
        </div>
      </div>

      {/* Primary Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expense Pie */}
        <div className="glass rounded-2xl p-6 flex flex-col items-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white self-start mb-4">
            Income vs Expense Distribution
          </h3>
          <div className="w-full max-w-xs aspect-square">
            {transactions.length > 0 ? (
              <Pie 
                data={incomeVsExpenseData}
                options={{
                  plugins: {
                    legend: { position: 'bottom', labels: { color: '#888' } }
                  }
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400">No data available</div>
            )}
          </div>
        </div>

        {/* Expenses by Category Bar */}
        <div className="glass rounded-2xl p-6 flex flex-col">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Expenses by Category (₹)
          </h3>
          <div className="flex-1 w-full min-h-[280px]">
            {expenseByCategory.length > 0 ? (
              <Bar 
                data={categoryChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: 'rgba(150, 150, 150, 0.1)' },
                      ticks: { color: '#888' }
                    },
                    x: {
                      grid: { display: false },
                      ticks: { color: '#888' }
                    }
                  },
                  plugins: {
                    legend: { display: false }
                  }
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Category Spending Breakdown Table with Progress Bars */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FontAwesomeIcon icon={faTags} className="text-primary-500" />
          <span>Category Spending Breakdown</span>
        </h3>

        <div className="space-y-3">
          {expenseByCategory.map(cat => (
            <div key={cat.id} className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs shrink-0 shadow-xs"
                    style={{ backgroundColor: cat.color }}
                  >
                    <FontAwesomeIcon icon={getCategoryIcon(cat.icon)} />
                  </div>
                  <span className="font-bold text-sm text-gray-900 dark:text-white">{cat.name}</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-sm text-gray-900 dark:text-white">
                    {formatCurrency(cat.amount)}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">({cat.share.toFixed(1)}%)</span>
                </div>
              </div>

              <div className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-700" 
                  style={{ width: `${Math.min(cat.share, 100)}%`, backgroundColor: cat.color }}
                />
              </div>
            </div>
          ))}

          {expenseByCategory.length === 0 && (
            <p className="text-center py-6 text-sm text-gray-400">No category spending recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
