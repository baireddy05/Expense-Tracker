import React, { useMemo } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWallet, faArrowTrendUp, faArrowTrendDown } from '@fortawesome/free-solid-svg-icons';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { DashboardSkeleton } from '../components/ui/Skeleton';
import AnimatedCounter from '../components/ui/AnimatedCounter';
import { getCategoryIcon } from '../utils/categoryIcons';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, LineElement, PointElement, Filler);

const Dashboard = () => {
  const { transactions, categories, loading, settings } = useTransactions();

  if (loading) return <DashboardSkeleton />;

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let monthlyIncome = 0;
    let monthlyExpense = 0;

    transactions.forEach(t => {
      const amount = parseFloat(t.amount);
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

    return {
      balance: income - expense,
      income,
      expense,
      monthlyIncome,
      monthlyExpense
    };
  }, [transactions]);

  const budgetLimit = settings?.monthlyBudget || 0;
  const hasBudget = budgetLimit > 0;
  const budgetPercentage = hasBudget ? Math.min((stats.monthlyExpense / budgetLimit) * 100, 100) : 0;
  
  // Alternative Velocity meter if no budget set
  const velocityMeter = Math.min((stats.monthlyExpense / (stats.monthlyIncome || 1)) * 100, 100);

  const expenseByCategory = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const grouped = expenses.reduce((acc, t) => {
      acc[t.categoryId] = (acc[t.categoryId] || 0) + parseFloat(t.amount);
      return acc;
    }, {});
    
    return Object.entries(grouped)
      .map(([catId, amount]) => {
        const cat = categories.find(c => c.id === catId);
        return { name: cat?.name || 'Unknown', amount, color: cat?.color || '#ccc' };
      })
      .sort((a, b) => b.amount - a.amount);
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
      // find index in last7Days
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

  const donutChartData = {
    labels: expenseByCategory.map(e => e.name),
    datasets: [{
      data: expenseByCategory.map(e => e.amount),
      backgroundColor: expenseByCategory.map(e => e.color),
      borderWidth: 0,
    }]
  };

  const lineChartData = {
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
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of your finances</p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FontAwesomeIcon icon={faWallet} className="text-6xl text-primary-500" />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Balance</p>
          <h2 className={`text-4xl font-bold mt-2 ${stats.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
            <AnimatedCounter value={stats.balance} isCurrency={true} />
          </h2>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
              <FontAwesomeIcon icon={faArrowTrendUp} />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Income</p>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            <AnimatedCounter value={stats.monthlyIncome} isCurrency={true} />
          </h2>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
              <FontAwesomeIcon icon={faArrowTrendDown} />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Expense</p>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            <AnimatedCounter value={stats.monthlyExpense} isCurrency={true} />
          </h2>
        </div>
      </div>

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
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Weekly Trend</h3>
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
           <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Recent Transactions</h3>
           <div className="space-y-4 mt-4">
             {[...transactions].sort((a,b) => {
               const dateDiff = new Date(b.date) - new Date(a.date);
               if (dateDiff !== 0) return dateDiff;
               return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
             }).slice(0, 5).map(t => {
               const cat = categories.find(c => c.id === t.categoryId);
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
               <p className="text-gray-500 text-center py-4">No transactions yet.</p>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
