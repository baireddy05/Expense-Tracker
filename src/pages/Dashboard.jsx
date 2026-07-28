import React, { useMemo } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWallet, faArrowTrendUp, faArrowTrendDown } from '@fortawesome/free-solid-svg-icons';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { DashboardSkeleton } from '../components/ui/Skeleton';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const Dashboard = () => {
  const { transactions, categories, loading } = useTransactions();

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

  const chartData = {
    labels: expenseByCategory.map(e => e.name),
    datasets: [{
      data: expenseByCategory.map(e => e.amount),
      backgroundColor: expenseByCategory.map(e => e.color),
      borderWidth: 0,
    }]
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
            {formatCurrency(stats.balance)}
          </h2>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
              <FontAwesomeIcon icon={faArrowTrendUp} />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Income</p>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.monthlyIncome)}</h2>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
              <FontAwesomeIcon icon={faArrowTrendDown} />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Monthly Expense</p>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(stats.monthlyExpense)}</h2>
        </div>
      </div>

      {/* Spending Velocity */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Spending Velocity (This Month)</h3>
        <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ease-out ${
              velocityMeter < 50 ? 'bg-green-500' : velocityMeter < 80 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${velocityMeter}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          You've spent {velocityMeter.toFixed(1)}% of your monthly income.
        </p>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6 flex flex-col items-center">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white self-start">Expenses by Category</h3>
          <div className="w-full max-w-[300px] aspect-square relative">
            {expenseByCategory.length > 0 ? (
              <Doughnut 
                data={chartData} 
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
             {transactions.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map(t => {
               const cat = categories.find(c => c.id === t.categoryId);
               return (
                 <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                   <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: cat?.color || '#ccc' }}>
                     <FontAwesomeIcon icon={cat?.icon || 'fa-circle'} />
                   </div>
                   
                   <div className="flex-1 min-w-0">
                     <p className="font-medium text-gray-900 dark:text-white leading-snug line-clamp-2">
                       {t.note || cat?.name}
                     </p>
                     <p className="text-xs text-gray-500 mt-0.5 truncate">
                       {new Date(t.date).toLocaleDateString()}
                     </p>
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
