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
  faLock,
  faBroom,
  faMobileAlt
} from '@fortawesome/free-solid-svg-icons';
import { getCategoryIcon } from '../utils/categoryIcons';
import toast from 'react-hot-toast';

const Settings = () => {
  const { 
    transactions, 
    categories, 
    lentRecords = [], 
    borrowedRecords = [], 
    accounts = [],
    savingsGoals = [],
    subscriptions = [],
    events = [],
    settings, 
    updateSettings, 
    updateCategory,
    addTransaction, 
    addLentRecord, 
    addBorrowedRecord,
    addAccount,
    addSavingsGoal,
    addSubscription,
    addEvent,
    isSyncing,
    syncLocalData,
    purgeLocalCache
  } = useTransactions();
  
  const { theme, setTheme } = useTheme();
  const { isPrivacyMode, togglePrivacyMode, isHapticsOn, toggleHaptics } = useUI();
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

  // Category Budgets State
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryBudgetInput, setCategoryBudgetInput] = useState('');
  const [isSavingCategoryBudget, setIsSavingCategoryBudget] = useState(false);

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
      toast.success('Budget limit saved');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save budget');
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleSaveCategoryBudget = async (categoryId) => {
    setIsSavingCategoryBudget(true);
    try {
      await updateCategory(categoryId, { budgetLimit: parseFloat(categoryBudgetInput) || 0 });
      toast.success('Category budget updated');
      setEditingCategory(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to update category budget');
    } finally {
      setIsSavingCategoryBudget(false);
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
    if (transactions.length === 0) {
      toast.error('No transactions to export.');
      return;
    }
    const csvData = transactions.map(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      return {
        Date: t.date,
        Type: t.type,
        Category: cat ? cat.name : 'Unknown',
        Amount: t.amount,
        Note: t.note || ''
      };
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `extrack_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Transactions exported to CSV!');
  };

  const handleExportFullJSON = () => {
    const fullBackup = {
      version: '3.0',
      exportDate: new Date().toISOString(),
      transactions,
      categories,
      accounts,
      savingsGoals,
      subscriptions,
      events,
      lentRecords,
      borrowedRecords,
      settings
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `extrack_complete_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Complete system backup downloaded!');
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        let importedCount = 0;

        if (data.transactions && Array.isArray(data.transactions)) {
          for (const tx of data.transactions) {
            const { id, createdAt, ...txData } = tx;
            await addTransaction(txData);
            importedCount++;
          }
        }

        if (data.accounts && Array.isArray(data.accounts)) {
          for (const acc of data.accounts) {
            if (acc.name) {
              const { id, ...accData } = acc;
              await addAccount(accData);
              importedCount++;
            }
          }
        }

        if (data.savingsGoals && Array.isArray(data.savingsGoals)) {
          for (const goal of data.savingsGoals) {
            if (goal.name) {
              const { id, ...goalData } = goal;
              await addSavingsGoal(goalData);
              importedCount++;
            }
          }
        }

        if (data.subscriptions && Array.isArray(data.subscriptions)) {
          for (const sub of data.subscriptions) {
            if (sub.name) {
              const { id, ...subData } = sub;
              await addSubscription(subData);
              importedCount++;
            }
          }
        }

        if (data.events && Array.isArray(data.events)) {
          for (const ev of data.events) {
            if (ev.name) {
              const { id, ...evData } = ev;
              await addEvent(evData);
              importedCount++;
            }
          }
        }

        if (data.lentRecords && Array.isArray(data.lentRecords)) {
          for (const lr of data.lentRecords) {
            if (lr.borrowerName && lr.amount) {
              await addLentRecord(lr);
              importedCount++;
            }
          }
        }

        if (data.borrowedRecords && Array.isArray(data.borrowedRecords)) {
          for (const br of data.borrowedRecords) {
            if (br.lenderName && br.amount) {
              await addBorrowedRecord(br);
              importedCount++;
            }
          }
        }

        toast.success(`Successfully restored ${importedCount} records from backup!`);
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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Settings</h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Account, cloud sync security, budget limits & backups
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Firebase Authentication & Cloud Security */}
        <div className="glass-card p-5 sm:p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faShieldAlt} className="text-emerald-500 text-xs" />
              <span>Account & Cloud Security</span>
            </h2>
            {currentUser && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Firebase Protected
              </span>
            )}
          </div>

          {currentUser ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 flex items-center gap-3">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName} 
                    className="w-10 h-10 rounded-xl object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold flex items-center justify-center text-sm shadow-inner">
                    {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <p className="font-semibold text-xs text-zinc-900 dark:text-white truncate">
                    {currentUser.displayName || 'No Name Set'}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {currentUser.email}
                  </p>
                  <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate">
                    UID: {currentUser.uid}
                  </p>
                </div>
              </div>

              {/* Edit Display Name */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                  Display Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="Your Name"
                    className="flex-1 px-3.5 py-2 liquid-glass-input rounded-xl text-xs focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-zinc-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveDisplayName}
                    disabled={isSavingName}
                    className="px-3.5 py-2 liquid-glass-subtle hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50 touch-feedback"
                  >
                    {isSavingName ? 'Saving...' : 'Update'}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={syncLocalData}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 liquid-glass-subtle hover:bg-zinc-200/80 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-60 touch-feedback"
                >
                  <FontAwesomeIcon icon={faSync} className={isSyncing ? 'animate-spin text-xs' : 'text-xs'} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Cloud Data'}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePasswordReset}
                  disabled={isSendingReset}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 liquid-glass-subtle hover:bg-zinc-200/80 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-60 touch-feedback"
                >
                  <FontAwesomeIcon icon={faKey} className="text-xs" />
                  <span>{isSendingReset ? 'Sending...' : 'Reset Password'}</span>
                </button>
              </div>

              {/* Local Storage & Cache Security Purge */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-zinc-900 dark:text-white">Local Device Storage</p>
                    <p className="text-[11px] text-zinc-400">Purge unencrypted local browser cache.</p>
                  </div>
                  <button
                    type="button"
                    onClick={purgeLocalCache}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300/40 dark:border-amber-900/60 rounded-xl text-xs font-semibold transition-colors cursor-pointer touch-feedback shrink-0"
                  >
                    <FontAwesomeIcon icon={faBroom} className="text-xs" />
                    <span>Purge Cache</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex justify-end">
                <button
                  type="button"
                  onClick={logout}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold transition-colors cursor-pointer touch-feedback"
                >
                  <FontAwesomeIcon icon={faSignOutAlt} className="text-xs" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-5 space-y-3">
              <div className="w-10 h-10 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-sm">
                <FontAwesomeIcon icon={faLock} />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-900 dark:text-white">Offline Guest Mode</p>
                <p className="text-[11px] text-zinc-400 mt-1 max-w-sm mx-auto">
                  Sign in with Firebase to automatically sync and protect all your expenses, lent money, and loans safely across devices.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="py-2.5 px-5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold rounded-xl text-xs shadow-xs transition-all cursor-pointer inline-flex items-center gap-2 touch-feedback"
              >
                <FontAwesomeIcon icon={faShieldAlt} className="text-xs" />
                <span>Sign In / Create Account</span>
              </button>
            </div>
          )}
        </div>

        {/* Budget & Goals */}
        <div className="glass-card p-5 sm:p-6">
          <h2 className="text-sm font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faPiggyBank} className="text-zinc-500 text-xs" />
            <span>Target Budgets</span>
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                Global Monthly Limit
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-xs">₹</span>
                  <input 
                    type="number" 
                    value={budgetInput}
                    onChange={e => setBudgetInput(e.target.value)}
                    className="w-full pl-8 pr-3.5 py-2 liquid-glass-input rounded-xl focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none transition-all dark:text-white text-xs"
                    placeholder="e.g. 50000"
                  />
                </div>
                <button 
                  onClick={handleSaveBudget}
                  disabled={isSavingBudget}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold transition-all disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer shadow-xs touch-feedback"
                >
                  {isSavingBudget ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">
                Category Limits (Envelope Budgets)
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {categories.filter(c => c.type === 'expense').map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-xl liquid-glass-subtle">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-sm shrink-0">
                        <FontAwesomeIcon icon={getCategoryIcon(cat.icon)} />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{cat.name}</p>
                        <p className="text-[10px] text-zinc-500">
                          {cat.budgetLimit ? `Limit: ₹${parseFloat(cat.budgetLimit).toLocaleString('en-IN')}` : 'No limit set'}
                        </p>
                      </div>
                    </div>
                    {editingCategory === cat.id ? (
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          value={categoryBudgetInput}
                          onChange={e => setCategoryBudgetInput(e.target.value)}
                          className="w-20 px-2 py-1 liquid-glass-input rounded text-xs text-right focus:outline-none"
                          placeholder="Amount"
                          autoFocus
                        />
                        <button 
                          onClick={() => handleSaveCategoryBudget(cat.id)}
                          disabled={isSavingCategoryBudget}
                          className="px-2 py-1 bg-emerald-500 text-white rounded text-[10px] font-bold"
                        >
                          ✔
                        </button>
                        <button 
                          onClick={() => setEditingCategory(null)}
                          className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded text-[10px] font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingCategory(cat.id);
                          setCategoryBudgetInput(cat.budgetLimit || '');
                        }}
                        className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white px-2 py-1 rounded bg-black/5 dark:bg-white/5 transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Mode & Shortcuts */}
        <div className="glass-card p-5 sm:p-6">
          <h2 className="text-sm font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faEye} className="text-zinc-500 text-xs" />
            <span>Privacy & Shortcuts</span>
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl liquid-glass-subtle">
              <div>
                <p className="font-semibold text-xs text-zinc-900 dark:text-white">Privacy Mode (Mask Balances)</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Masks currency values with <code className="bg-black/5 dark:bg-white/10 px-1 rounded text-[10px]">₹••••••</code> in public.
                </p>
              </div>
              <button
                type="button"
                onClick={togglePrivacyMode}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 touch-feedback ${
                  isPrivacyMode
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300/40 dark:border-amber-900/60'
                    : 'liquid-glass-subtle text-zinc-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-white/10'
                }`}
              >
                <FontAwesomeIcon icon={isPrivacyMode ? faEyeSlash : faEye} className="text-xs" />
                <span>{isPrivacyMode ? 'Masked' : 'Off'}</span>
              </button>
            </div>

            {/* Haptic Vibration Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl liquid-glass-subtle">
              <div>
                <p className="font-semibold text-xs text-zinc-900 dark:text-white">Touch Haptics (Vibrations)</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Tactile micro-vibrations on taps, transactions, switches & buttons.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleHaptics}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 touch-feedback ${
                  isHapticsOn
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40 dark:border-emerald-900/60'
                    : 'liquid-glass-subtle text-zinc-700 dark:text-zinc-300 hover:bg-white/60 dark:hover:bg-white/10'
                }`}
              >
                <FontAwesomeIcon icon={faMobileAlt} className="text-xs" />
                <span>{isHapticsOn ? 'Enabled' : 'Muted'}</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl liquid-glass-subtle text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white">
                <FontAwesomeIcon icon={faKeyboard} className="text-zinc-400 text-xs" />
                <span>Keyboard Shortcuts</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>Spotlight Search</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/70 dark:bg-zinc-800 text-[10px] font-mono font-semibold border border-zinc-200 dark:border-zinc-700">⌘K / Ctrl+K</kbd>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>Quick Actions Dial</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/70 dark:bg-zinc-800 text-[10px] font-mono font-semibold border border-zinc-200 dark:border-zinc-700">⌘N / Ctrl+N</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance Theme */}
        <div className="glass-card p-5 sm:p-6">
          <h2 className="text-sm font-bold mb-4 text-zinc-900 dark:text-white">Theme & Appearance</h2>
          
          <div className="grid grid-cols-3 gap-2.5">
            <button 
              onClick={() => setTheme('light')}
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl transition-all cursor-pointer touch-feedback ${
                theme === 'light' 
                  ? 'border border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900 font-semibold shadow-2xs' 
                  : 'liquid-glass-subtle hover:bg-white/60 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <FontAwesomeIcon icon={faSun} className="text-base mb-1" />
              <span className="text-xs">Light</span>
            </button>
            
            <button 
              onClick={() => setTheme('dark')}
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl transition-all cursor-pointer touch-feedback ${
                theme === 'dark' 
                  ? 'border border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900 font-semibold shadow-2xs' 
                  : 'liquid-glass-subtle hover:bg-white/60 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <FontAwesomeIcon icon={faMoon} className="text-base mb-1" />
              <span className="text-xs">Dark</span>
            </button>

            <button 
              onClick={() => setTheme('system')}
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl transition-all cursor-pointer touch-feedback ${
                theme === 'system' 
                  ? 'border border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900 font-semibold shadow-2xs' 
                  : 'liquid-glass-subtle hover:bg-white/60 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              <FontAwesomeIcon icon={faDesktop} className="text-base mb-1" />
              <span className="text-xs">System</span>
            </button>
          </div>
        </div>

        {/* Data Management & Full System Backup */}
        <div className="glass-card p-5 sm:p-6 lg:col-span-2">
          <h2 className="text-sm font-bold mb-4 text-zinc-900 dark:text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faFileArchive} className="text-zinc-500 text-xs" />
            <span>Data Management & Offline Backups</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* Export Full System JSON */}
            <button 
              onClick={handleExportFullJSON}
              className="flex items-center justify-center gap-2 py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-semibold rounded-xl transition-all text-xs cursor-pointer shadow-xs touch-feedback"
            >
              <FontAwesomeIcon icon={faDownload} className="text-xs" />
              <span>Export JSON Backup</span>
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
              className="flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-xs cursor-pointer touch-feedback shadow-2xs"
            >
              <FontAwesomeIcon icon={faUpload} className="text-xs" />
              <span>Restore Backup</span>
            </button>

            {/* Export CSV */}
            <button 
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 py-2.5 bg-zinc-100 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-xs cursor-pointer touch-feedback"
            >
              <FontAwesomeIcon icon={faDownload} className="text-xs" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
