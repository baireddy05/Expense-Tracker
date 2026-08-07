import React, { useState, useEffect, useRef } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { useTheme } from '../context/ThemeContext';
import { useUI } from '../context/UIContext';
import Papa from 'papaparse';
import ConfirmModal from '../components/ui/ConfirmModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faDownload, 
  faUpload, 
  faMoon, 
  faSun, 
  faDesktop, 
  faPiggyBank, 
  faEye, 
  faEyeSlash,
  faKeyboard,
  faFileArchive,
  faTrashAlt,
  faCoins,
  faTags
} from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

const Settings = () => {
  const { transactions, categories, lentRecords = [], borrowedRecords = [], settings, updateSettings, addTransaction, addLentRecord, addBorrowedRecord } = useTransactions();
  const { theme, setTheme } = useTheme();
  const { isPrivacyMode, togglePrivacyMode } = useUI();
  
  const [budgetInput, setBudgetInput] = useState('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (settings) {
      setBudgetInput(settings.monthlyBudget || '');
    }
  }, [settings]);

  const handleSaveBudget = async () => {
    setIsSavingBudget(true);
    try {
      await updateSettings({ monthlyBudget: parseFloat(budgetInput) || 0 });
      toast.success('Budget limit saved successfully');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save budget');
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleExportCSV = () => {
    const exportData = transactions.map(t => {
      const category = categories.find(c => c.id === t.categoryId);
      return {
        Date: new Date(t.date).toLocaleDateString('en-IN'),
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
    toast.success('Transactions CSV exported');
  };

  // Full System JSON Backup (Transactions + Lent + Borrowed + Categories + Settings)
  const handleExportFullJSON = () => {
    const fullBackup = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      transactions,
      categories,
      lentRecords,
      borrowedRecords,
      settings
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `extrack_full_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Complete backup JSON downloaded!');
  };

  // Import / Restore Full System Backup
  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data || (!data.transactions && !data.lentRecords && !data.borrowedRecords)) {
          toast.error('Invalid backup JSON file format.');
          return;
        }

        let importedCount = 0;
        // Import transactions
        if (Array.isArray(data.transactions)) {
          for (const tx of data.transactions) {
            const exists = transactions.some(t => t.id === tx.id);
            if (!exists) {
              await addTransaction(tx);
              importedCount++;
            }
          }
        }

        // Import Lent Records
        if (Array.isArray(data.lentRecords)) {
          for (const lr of data.lentRecords) {
            const exists = lentRecords.some(l => l.id === lr.id);
            if (!exists) {
              await addLentRecord(lr);
              importedCount++;
            }
          }
        }

        // Import Borrowed Records
        if (Array.isArray(data.borrowedRecords)) {
          for (const br of data.borrowedRecords) {
            const exists = borrowedRecords.some(b => b.id === br.id);
            if (!exists) {
              await addBorrowedRecord(br);
              importedCount++;
            }
          }
        }

        toast.success(`Successfully imported ${importedCount} records from backup!`);
      } catch (err) {
        console.error('Import error:', err);
        toast.error('Error parsing JSON backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage budget, privacy, data backups & system preferences</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget & Goals */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faPiggyBank} className="text-primary-500" />
            <span>Monthly Budget & Spending Limit</span>
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Monthly Target Budget
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₹</span>
                  <input 
                    type="number" 
                    value={budgetInput}
                    onChange={e => setBudgetInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white text-sm"
                    placeholder="e.g. 50000"
                  />
                </div>
                <button 
                  onClick={handleSaveBudget}
                  disabled={isSavingBudget}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-semibold hover:bg-primary-500 transition-colors disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-primary-500/20"
                >
                  {isSavingBudget ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Budget'}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                ExTrack uses your monthly budget to render spending velocity indicators and progress alerts on your dashboard.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Mode & Shortcuts */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faEye} className="text-amber-500" />
            <span>Privacy & Shortcuts</span>
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-white">Privacy Mode (Mask Balances)</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Masks all sensitive currency amounts with <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">₹••••••</code> when in public.
                </p>
              </div>
              <button
                type="button"
                onClick={togglePrivacyMode}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isPrivacyMode
                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
                }`}
              >
                <FontAwesomeIcon icon={isPrivacyMode ? faEyeSlash : faEye} />
                <span>{isPrivacyMode ? 'Enabled' : 'Disabled'}</span>
              </button>
            </div>

            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                <FontAwesomeIcon icon={faKeyboard} className="text-primary-500" />
                <span>Power Keyboard Shortcuts</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Open Command Search</span>
                <kbd className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-[11px] font-mono font-bold">⌘K / Ctrl+K</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Quick Add Speed Dial</span>
                <kbd className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-[11px] font-mono font-bold">⌘N / Ctrl+N</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Theme */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Theme & Appearance</h2>
          
          <div className="grid grid-cols-3 gap-3">
            <button 
              onClick={() => setTheme('light')}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer ${
                theme === 'light' 
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-semibold' 
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <FontAwesomeIcon icon={faSun} className="text-xl mb-1.5" />
              <span className="text-xs">Light</span>
            </button>
            
            <button 
              onClick={() => setTheme('dark')}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer ${
                theme === 'dark' 
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-semibold' 
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <FontAwesomeIcon icon={faMoon} className="text-xl mb-1.5" />
              <span className="text-xs">Dark</span>
            </button>

            <button 
              onClick={() => setTheme('system')}
              className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all cursor-pointer ${
                theme === 'system' 
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-semibold' 
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <FontAwesomeIcon icon={faDesktop} className="text-xl mb-1.5" />
              <span className="text-xs">System</span>
            </button>
          </div>
        </div>

        {/* Data Management & Full System Backup */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faFileArchive} className="text-indigo-500" />
            <span>Data Management & Backup</span>
          </h2>
          
          <div className="space-y-3">
            {/* Export Full System JSON */}
            <button 
              onClick={handleExportFullJSON}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-95 transition-opacity text-xs cursor-pointer shadow-md shadow-primary-500/20"
            >
              <FontAwesomeIcon icon={faDownload} />
              <span>Export Complete Backup (JSON)</span>
            </button>

            {/* Import / Restore JSON */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportJSON} 
              accept=".json" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs cursor-pointer"
            >
              <FontAwesomeIcon icon={faUpload} />
              <span>Restore Data from Backup (JSON)</span>
            </button>

            {/* Export CSV */}
            <button 
              onClick={handleExportCSV}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs cursor-pointer"
            >
              <FontAwesomeIcon icon={faDownload} />
              <span>Export Transactions to CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
