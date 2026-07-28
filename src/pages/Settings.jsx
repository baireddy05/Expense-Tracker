import React, { useState, useEffect } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { useTheme } from '../context/ThemeContext';
import Papa from 'papaparse';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faMoon, faSun, faDesktop, faPiggyBank } from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

const Settings = () => {
  const { transactions, categories, settings, updateSettings } = useTransactions();
  const { theme, setTheme } = useTheme();
  const [budgetInput, setBudgetInput] = useState('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);

  useEffect(() => {
    if (settings) {
      setBudgetInput(settings.monthlyBudget || '');
    }
  }, [settings]);

  const handleSaveBudget = async () => {
    setIsSavingBudget(true);
    try {
      await updateSettings({ monthlyBudget: parseFloat(budgetInput) || 0 });
      toast.success('Budget saved successfully');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save budget');
    } finally {
      setIsSavingBudget(false);
    }
  };

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
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Budget & Goals</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Monthly Budget</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                  <input 
                    type="number" 
                    value={budgetInput}
                    onChange={e => setBudgetInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white"
                    placeholder="Enter budget limit"
                  />
                </div>
                <button 
                  onClick={handleSaveBudget}
                  disabled={isSavingBudget}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-500 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isSavingBudget ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                <FontAwesomeIcon icon={faPiggyBank} />
                Used to show progress bars on your dashboard
              </p>
            </div>
          </div>
        </div>

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
