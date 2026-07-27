import React, { useMemo } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement);

const Analytics = () => {
  const { transactions, categories } = useTransactions();

  const incomeVsExpenseData = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      if (t.type === 'income') income += parseFloat(t.amount);
      else expense += parseFloat(t.amount);
    });

    return {
      labels: ['Income', 'Expense'],
      datasets: [{
        data: [income, expense],
        backgroundColor: ['#22c55e', '#ef4444'],
        borderWidth: 0,
      }]
    };
  }, [transactions]);

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

  const categoryChartData = {
    labels: expenseByCategory.map(e => e.name),
    datasets: [{
      label: 'Amount (₹)',
      data: expenseByCategory.map(e => e.amount),
      backgroundColor: expenseByCategory.map(e => e.color),
      borderRadius: 4,
    }]
  };

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Deep dive into your spending habits</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6">
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Income vs Expense</h3>
          <div className="w-full max-w-sm mx-auto aspect-square">
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

        <div className="glass rounded-2xl p-6 flex flex-col">
          <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Expenses by Category</h3>
          <div className="flex-1 w-full min-h-[300px]">
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
    </div>
  );
};

export default Analytics;
