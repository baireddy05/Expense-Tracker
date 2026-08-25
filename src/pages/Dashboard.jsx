import React, { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTransactions } from '../context/TransactionContext';
import { useUI } from '../context/UIContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faWallet, 
  faArrowTrendUp, 
  faArrowTrendDown, 
  faHandHoldingDollar, 
  faHandHolding, 
  faClock, 
  faExclamationTriangle, 
  faArrowRight, 
  faCoins, 
  faReceipt 
} from '@fortawesome/free-solid-svg-icons';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import { getCategoryIcon, resolveCategory } from '../utils/categoryIcons';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler);

const Dashboard = () => {
  const { transactions, categories, lentRecords = [], borrowedRecords = [], loading, settings } = useTransactions();
  const { isPrivacyMode } = useUI();
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
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let monthlyIncome = 0;
    let monthlyExpense = 0;

    transactions.forEach(t => {
      const amount = parseFloat(t.amount) || 0;
      const isIncome = t.type === 'income';
      const tDate = new Date(t.date);
      const isCurrentMonth = tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;

      if (isIncome) {
        income += amount;
        if (isCurrentMonth) monthlyIncome += amount;
      } else {
        expense += amount;
        if (isCurrentMonth) monthlyExpense += amount;
      }
    });

    // Lent stats
    let totalLentPending = 0;
    lentRecords.forEach(r => {
      const total = parseFloat(r.amount) || 0;
      const returned = parseFloat(r.returnedAmount) || 0;
      totalLentPending += Math.max(0, total - returned);
    });

    // Borrowed stats
    let totalBorrowedPending = 0;
    borrowedRecords.forEach(r => {
      const total = parseFloat(r.amount) || 0;
      const returned = parseFloat(r.returnedAmount) || 0;
      totalBorrowedPending += Math.max(0, total - returned);
    });

    const balance = income - expense;
    const netWorth = balance + totalLentPending - totalBorrowedPending;

    return {
      balance,
      income,
      expense,
      monthlyIncome,
      monthlyExpense,
      totalLentPending,
      totalBorrowedPending,
      netWorth
    };
  }, [transactions, lentRecords, borrowedRecords]);

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
    const expenses = transactions.filter(t => t.type === 'expense');
    const grouped = {};
    expenses.forEach(t => {
      const cat = resolveCategory(t.categoryId, categories, t.note);
      const catName = cat?.name || 'General';
      const catColor = cat?.color || '#888888';
      if (!grouped[catName]) {
        grouped[catName] = { name: catName, amount: 0, color: catColor };
      }
      grouped[catName].amount += parseFloat(t.amount) || 0;
    });
    
    return Object.values(grouped).sort((a, b) => b.amount - a.amount);
  }, [transactions, categories]);

  const trendData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const labels = last7Days.map(d => d.toLocaleDateString('en-US', { weekday: 'short' }));
    const incomeData = new Array(7).fill(0);
    const expenseData = new Array(7).fill(0);

    transactions.forEach(t => {
      const tDate = new Date(t.date);
      const index = last7Days.findIndex(d => 
        d.getDate() === tDate.getDate() && 
        d.getMonth() === tDate.getMonth() && 
        d.getFullYear() === tDate.getFullYear()
      );
      
      if (index !== -1) {
        if (t.type === 'income') incomeData[index] += parseFloat(t.amount);
        else expenseData[index] += parseFloat(t.amount);
      }
    });

    return { labels, incomeData, expenseData };
  }, [transactions]);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => {
        const dateDiff = new Date(b.date) - new Date(a.date);
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      })
      .slice(0, 5);
  }, [transactions]);

  const donutChartData = useMemo(() => ({
    labels: expenseByCategory.map(e => e.name),
    datasets: [{
      data: expenseByCategory.map(e => e.amount),
      backgroundColor: expenseByCategory.map(e => e.color),
      borderWidth: 0,
    }]
  }), [expenseByCategory]);

  const lineChartData = useMemo(() => ({
    labels: trendData.labels,
    datasets: [
      {
        label: 'Income',
        data: trendData.incomeData,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Expense',
        data: trendData.expenseData,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
      }
    ]
  }), [trendData]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of your cash flow, lending & debts</p>
        </div>

        {/* Quick Shortcuts */}
        <div className="flex items-center gap-2">
          <Link
            to="/transactions"
            className="px-3.5 py-2 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-semibold rounded-xl text-xs hover:bg-primary-100 transition-colors flex items-center gap-1.5"
          >
            <FontAwesomeIcon icon={faReceipt} />
            <span>Transactions</span>
          </Link>
          <Link
            to="/lent"
            className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold rounded-xl text-xs hover:bg-amber-100 transition-colors flex items-center gap-1.5"
          >
            <FontAwesomeIcon icon={faHandHoldingDollar} />
            <span>Lent</span>
          </Link>
          <Link
            to="/borrowed"
            className="px-3.5 py-2 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold rounded-xl text-xs hover:bg-purple-100 transition-colors flex items-center gap-1.5"
          >
            <FontAwesomeIcon icon={faHandHolding} />
            <span>Borrowed</span>
          </Link>
        </div>
      </header>

      {/* Financial Health & Net Worth Multi-Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cash Balance */}
        <div className="glass rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total Balance</p>
              <h2 className={`text-2xl lg:text-3xl font-bold mt-1.5 ${stats.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                <AnimatedCounter value={stats.balance} isCurrency={true} />
              </h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
              <FontAwesomeIcon icon={faWallet} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Net Monthly: <strong className={stats.monthlyIncome - stats.monthlyExpense >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>{formatCurrency(stats.monthlyIncome - stats.monthlyExpense)}</strong>
          </p>
        </div>

        {/* Monthly Income */}
        <div className="glass rounded-2xl p-5 border-l-4 border-l-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Monthly Income</p>
              <h2 className="text-2xl lg:text-3xl font-bold mt-1.5 text-green-600 dark:text-green-400">
                <AnimatedCounter value={stats.monthlyIncome} isCurrency={true} />
              </h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
              <FontAwesomeIcon icon={faArrowTrendUp} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">All time: {formatCurrency(stats.income)}</p>
        </div>

        {/* Monthly Expense */}
        <div className="glass rounded-2xl p-5 border-l-4 border-l-red-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Monthly Expense</p>
              <h2 className="text-2xl lg:text-3xl font-bold mt-1.5 text-red-600 dark:text-red-400">
                <AnimatedCounter value={stats.monthlyExpense} isCurrency={true} />
              </h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
              <FontAwesomeIcon icon={faArrowTrendDown} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">All time: {formatCurrency(stats.expense)}</p>
        </div>

        {/* Net Liquid Worth */}
        <div className="glass rounded-2xl p-5 border-l-4 border-l-indigo-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Net Liquid Worth</p>
              <h2 className="text-2xl lg:text-3xl font-bold mt-1.5 text-indigo-600 dark:text-indigo-400">
                <AnimatedCounter value={stats.netWorth} isCurrency={true} />
              </h2>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <FontAwesomeIcon icon={faCoins} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {isPrivacyMode ? '+₹•••• Lent • -₹•••• Debt' : `+₹${stats.totalLentPending.toLocaleString('en-IN')} Lent • -₹${stats.totalBorrowedPending.toLocaleString('en-IN')} Debt`}
          </p>
        </div>
      </div>

      {/* Due Date & Action Alerts (If any) */}
      {dueAlerts.length > 0 && (
        <div className="glass rounded-2xl p-5 border border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-500" />
              <span>Upcoming Due Dates & Debt Action Alerts</span>
            </h3>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {dueAlerts.length} pending alert{dueAlerts.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dueAlerts.map(alert => (
              <div 
                key={alert.id}
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                  alert.isOverdue 
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-gray-900 dark:text-white">{alert.person}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      alert.type === 'lent' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                    }`}>
                      {alert.type === 'lent' ? 'Lent (Collect)' : 'Borrowed (Pay)'}
                    </span>
                  </div>
                  <p className="font-bold text-sm mt-0.5 text-gray-900 dark:text-white">
                    {formatCurrency(alert.amount)}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${alert.isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                    {alert.isOverdue ? `Overdue by ${Math.abs(alert.diffDays)} day(s)` : `Due in ${alert.diffDays} day(s)`}
                  </p>
                </div>

                <Link
                  to={alert.link}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold text-xs flex items-center gap-1 shrink-0 transition-colors"
                >
                  <span>Action</span>
                  <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spending Velocity / Budget */}
      <div className="glass rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {hasBudget ? 'Budget Progress (This Month)' : 'Spending Velocity (This Month)'}
          </h3>
          {hasBudget && (
            <span className="text-sm font-medium text-gray-500">
              {formatCurrency(stats.monthlyExpense)} / {formatCurrency(budgetLimit)}
            </span>
          )}
        </div>
        <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ease-out ${
              hasBudget 
                ? (budgetPercentage < 75 ? 'bg-green-500' : budgetPercentage < 90 ? 'bg-yellow-500' : 'bg-red-500')
                : (velocityMeter < 50 ? 'bg-green-500' : velocityMeter < 80 ? 'bg-yellow-500' : 'bg-red-500')
            }`}
            style={{ width: `${hasBudget ? budgetPercentage : velocityMeter}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {hasBudget 
            ? (budgetPercentage >= 100 
                ? "You've exceeded your monthly budget!" 
                : `You've used ${budgetPercentage.toFixed(1)}% of your monthly budget.`)
            : `You've spent ${velocityMeter.toFixed(1)}% of your monthly income.`
          }
        </p>
      </div>

      {/* Trend Line Chart */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Weekly Cash Flow Trend</h3>
        <div className="w-full h-[250px]">
          <Line 
            data={lineChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top', labels: { color: '#888' } }
              },
              scales: {
                y: { grid: { color: 'rgba(200, 200, 200, 0.1)' }, ticks: { color: '#888' } },
                x: { grid: { display: false }, ticks: { color: '#888' } }
              }
            }}
          />
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 flex flex-col items-center">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white self-start">Expenses by Category</h3>
          <div className="w-full max-w-[300px] aspect-square relative">
            {expenseByCategory.length > 0 ? (
              <Doughnut 
                data={donutChartData} 
                options={{
                  cutout: '70%',
                  plugins: { legend: { position: 'bottom', labels: { color: '#888' } } }
                }} 
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                No expense data
              </div>
            )}
          </div>
        </div>
        
        <div className="glass rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h3>
            <Link to="/transactions" className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentTransactions.map(t => {
              const cat = resolveCategory(t.categoryId, categories, t.note);
              const hasNote = Boolean(t.note && t.note.trim());
              const categoryName = cat?.name || 'Uncategorized';
              const categoryColor = cat?.color || '#888888';

              return (
                <div key={t.id} className="flex items-center gap-3.5 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div 
                    className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white text-sm shadow-sm" 
                    style={{ backgroundColor: categoryColor }}
                  >
                    <FontAwesomeIcon icon={getCategoryIcon(cat?.icon)} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white leading-snug break-words">
                      {hasNote ? t.note : categoryName}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs">
                      <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-gray-300 dark:text-gray-600 select-none">&bull;</span>
                      <span 
                        className="inline-flex items-center px-1.5 py-0.2 rounded font-medium text-[11px]"
                        style={{ 
                          backgroundColor: `${categoryColor}18`,
                          color: categoryColor,
                          border: `1px solid ${categoryColor}35`
                        }}
                      >
                        {categoryName}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right shrink-0 ml-2">
                    <span className={`font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-green-500' : 'text-gray-900 dark:text-white'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                  </div>
                </div>
              );
            })}
            {transactions.length === 0 && (
              <p className="text-gray-500 text-center py-6 text-sm">No transactions recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
