import React, { useState, useEffect, useRef } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { useTheme } from '../context/ThemeContext';
import { useUI } from '../context/UIContext';
import { useAuth } from '../context/AuthContext';
import Papa from 'papaparse';
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
  faShieldAlt,
  faSignOutAlt,
  faKey,
  faSync,
  faLock
} from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';

const Settings = () => {
  const { 
    transactions, 
    categories, 
    lentRecords = [], 
    borrowedRecords = [], 
    settings, 
    updateSettings, 
    addTransaction, 
    addLentRecord, 
    addBorrowedRecord,
    isSyncing,
    syncLocalData
  } = useTransactions();
  
  const { theme, setTheme } = useTheme();
  const { isPrivacyMode, togglePrivacyMode } = useUI();
  const { 
    currentUser, 
    logout, 
    openAuthModal, 
    resetPassword, 
    updateUserDisplayName 
  } = useAuth();
  
  const [budgetInput, setBudgetInput] = useState('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (settings) {
      setBudgetInput(settings.monthlyBudget || '');
    }
  }, [settings]);

  useEffect(() => {
    if (currentUser) {
      setDisplayNameInput(currentUser.displayName || '');
    }
  }, [currentUser]);

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

  const handleSaveDisplayName = async () => {
    if (!displayNameInput.trim()) return;
    setIsSavingName(true);
    try {
      await updateUserDisplayName(displayNameInput.trim());
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingName(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!currentUser?.email) return;
    setIsSendingReset(true);
    try {
      await resetPassword(currentUser.email);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSendingReset(false);
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

  // Full System JSON Backup
  const handleExportFullJSON = () => {
    const fullBackup = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      user: currentUser ? { email: currentUser.email, uid: currentUser.uid } : 'Guest',
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
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account, cloud security, budget limits & backups</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Firebase Authentication & Cloud Security */}
        <div className="glass rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faShieldAlt} className="text-emerald-500" />
              <span>Account & Cloud Security</span>
            </h2>
            {currentUser && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Firebase Protected
              </span>
            )}
          </div>

          {currentUser ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-3.5">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName} 
                    className="w-12 h-12 rounded-2xl object-cover ring-2 ring-primary-500/30"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-bold flex items-center justify-center text-lg shadow-inner ring-2 ring-primary-500/30">
                    {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <p className="font-bold text-sm text-gray-900 dark:text-white truncate">
                    {currentUser.displayName || 'No Name Set'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {currentUser.email}
                  </p>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                    UID: {currentUser.uid}
                  </p>
                </div>
              </div>

              {/* Edit Display Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                  Display Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="Your Name"
                    className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveDisplayName}
                    disabled={isSavingName}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSavingName ? 'Saving...' : 'Update'}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={syncLocalData}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
                >
                  <FontAwesomeIcon icon={faSync} className={isSyncing ? 'animate-spin' : ''} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Cloud Backup'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={isSendingReset}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-60"
                >
                  <FontAwesomeIcon icon={faKey} />
                  <span>{isSendingReset ? 'Sending...' : 'Reset Password'}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <FontAwesomeIcon icon={faSignOutAlt} />
                  <span>Sign Out Account</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-primary-50 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xl">
                <FontAwesomeIcon icon={faLock} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">You are in Offline / Guest Mode</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                  Sign in with Firebase to automatically sync and protect all your expenses, lent money, and loans safely in the cloud across all your devices.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="py-2.5 px-6 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs shadow-md shadow-primary-500/25 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faShieldAlt} />
                <span>Sign In / Create Account</span>
              </button>
            </div>
          )}
        </div>

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
                  Masks sensitive currency amounts with <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">₹••••••</code> when in public.
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
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faFileArchive} className="text-indigo-500" />
            <span>Data Management & Offline Backups</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Export Full System JSON */}
            <button 
              onClick={handleExportFullJSON}
              className="flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white font-semibold rounded-xl hover:opacity-95 transition-opacity text-xs cursor-pointer shadow-md shadow-primary-500/20"
            >
              <FontAwesomeIcon icon={faDownload} />
              <span>Export Full JSON Backup</span>
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
              className="flex items-center justify-center gap-2 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-xs cursor-pointer"
            >
              <FontAwesomeIcon icon={faUpload} />
              <span>Restore Data from Backup</span>
            </button>

            {/* Export CSV */}
            <button 
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 py-3 bg-gray-100 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs cursor-pointer"
            >
              <FontAwesomeIcon icon={faDownload} />
              <span>Export Transactions CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
