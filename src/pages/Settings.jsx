import React, { useRef } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { useTheme } from '../context/ThemeContext';
import Papa from 'papaparse';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faMoon, faSun, faDesktop } from '@fortawesome/free-solid-svg-icons';

const Settings = () => {
  const { transactions, categories } = useTransactions();
  const { theme, setTheme } = useTheme();

  const handleExportCSV = () => {
    // Format data for better readability
    const exportData = transactions.map(t => {
      const category = categories.find(c => c.id === t.categoryId);
      return {
        Date: new Date(t.date).toLocaleDateString(),
        Type: t.type === 'income' ? 'Income' : 'Expense',
        Category: category ? category.name : 'Unknown',
        Amount: t.amount,
        Note: t.note || ''
      };
    });
    
    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `expense_tracker_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage preferences and data</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Appearance</h2>
          
          <div className="space-y-3">
            <button 
              onClick={() => setTheme('light')}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${theme === 'light' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faSun} />
                <span className="font-medium">Light</span>
              </div>
              {theme === 'light' && <div className="w-3 h-3 rounded-full bg-primary-500" />}
            </button>
            
            <button 
              onClick={() => setTheme('dark')}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${theme === 'dark' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faMoon} />
                <span className="font-medium">Dark</span>
              </div>
              {theme === 'dark' && <div className="w-3 h-3 rounded-full bg-primary-500" />}
            </button>

            <button 
              onClick={() => setTheme('system')}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${theme === 'system' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
            >
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faDesktop} />
                <span className="font-medium">System Default</span>
              </div>
              {theme === 'system' && <div className="w-3 h-3 rounded-full bg-primary-500" />}
            </button>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Data Management</h2>
          
          <div className="space-y-4">
            <button 
              onClick={handleExportCSV}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium rounded-xl hover:opacity-90 transition-opacity"
            >
              <FontAwesomeIcon icon={faDownload} />
              Export to CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
