import React, { useState, useMemo } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { useUI } from '../context/UIContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBuildingColumns, 
  faMoneyBillWave, 
  faCreditCard, 
  faWallet, 
  faPiggyBank, 
  faChartLine,
  faRightLeft,
  faPlus,
  faEdit,
  faTrash,
  faScaleBalanced,
  faCheckCircle,
  faShieldAlt
} from '@fortawesome/free-solid-svg-icons';
import { getLocalDateString, formatDisplayDate } from '../utils/dateUtils';
import ConfirmModal from '../components/ui/ConfirmModal';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import toast from 'react-hot-toast';

const ACCOUNT_ICONS = {
  'fa-building-columns': faBuildingColumns,
  'fa-money-bill-wave': faMoneyBillWave,
  'fa-credit-card': faCreditCard,
  'fa-wallet': faWallet,
  'fa-piggy-bank': faPiggyBank,
  'fa-chart-line': faChartLine
};

const COLOR_PRESETS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ef4444', // Rose
  '#06b6d4', // Cyan
  '#64748b'  // Slate
];

const Accounts = () => {
  const { 
    accounts, 
    transactions,
    addAccount, 
    updateAccount, 
    deleteAccount, 
    transferFunds 
  } = useTransactions();
  
  const { isPrivacyMode } = useUI();

  // Modals state
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useBodyScrollLock(isAccountModalOpen || isTransferModalOpen);

  // Form states
  const [accountForm, setAccountForm] = useState({
    name: '',
    type: 'bank',
    initialBalance: '',
    color: '#3b82f6',
    icon: 'fa-building-columns',
    isDefault: false
  });

  const [transferForm, setTransferForm] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    date: getLocalDateString(),
    note: ''
  });

  const formatCurrency = (amount) => {
    if (isPrivacyMode) return '₹••••••';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  // Metrics summary
  const summary = useMemo(() => {
    let liquidAssets = 0;
    let liabilities = 0;

    accounts.forEach(acc => {
      const bal = acc.balance || 0;
      if (acc.type === 'credit') {
        // In credit cards, positive usage is liability
        if (bal < 0) liabilities += Math.abs(bal);
      } else {
        if (bal >= 0) liquidAssets += bal;
        else liabilities += Math.abs(bal);
      }
    });

    const netWorth = liquidAssets - liabilities;

    return { liquidAssets, liabilities, netWorth };
  }, [accounts]);

  // Recent Transfers
  const recentTransfers = useMemo(() => {
    return transactions
      .filter(t => t.type === 'transfer')
      .slice(0, 10);
  }, [transactions]);

  // Handle Open Account Modal
  const handleOpenAccountModal = (acc = null) => {
    if (acc) {
      setAccountForm({
        name: acc.name,
        type: acc.type || 'bank',
        initialBalance: acc.initialBalance !== undefined ? acc.initialBalance : 0,
        color: acc.color || '#3b82f6',
        icon: acc.icon || 'fa-building-columns',
        isDefault: !!acc.isDefault
      });
      setEditingId(acc.id);
    } else {
      setAccountForm({
        name: '',
        type: 'bank',
        initialBalance: '0',
        color: '#3b82f6',
        icon: 'fa-building-columns',
        isDefault: accounts.length === 0
      });
      setEditingId(null);
    }
    setIsAccountModalOpen(true);
  };

  // Handle Save Account
  const handleSaveAccount = async (e) => {
    e.preventDefault();
    if (!accountForm.name) {
      toast.error('Please enter an account name');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...accountForm,
        initialBalance: parseFloat(accountForm.initialBalance) || 0
      };

      if (editingId) {
        await updateAccount(editingId, payload);
        toast.success('Account updated successfully');
      } else {
        await addAccount(payload);
        toast.success('New account created');
      }
      setIsAccountModalOpen(false);
    } catch (err) {
      toast.error('Failed to save account');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Account
  const handleDeleteAccount = (id, name) => {
    if (accounts.length <= 1) {
      toast.error('You must keep at least one account');
      return;
    }
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteAccount(deleteConfirm.id);
      toast.success('Account deleted');
    } catch (err) {
      toast.error('Failed to delete account');
    }
  };

  // Handle Open Transfer Modal
  const handleOpenTransferModal = (fromId = null) => {
    const defaultFrom = fromId || accounts[0]?.id || '';
    const defaultTo = accounts.find(a => a.id !== defaultFrom)?.id || '';

    setTransferForm({
      fromAccountId: defaultFrom,
      toAccountId: defaultTo,
      amount: '',
      date: getLocalDateString(),
      note: ''
    });
    setIsTransferModalOpen(true);
  };

  // Handle Submit Transfer
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount) {
      toast.error('Please fill all required transfer fields');
      return;
    }

    if (transferForm.fromAccountId === transferForm.toAccountId) {
      toast.error('Source and Destination accounts must be different');
      return;
    }

    setIsSubmitting(true);
    try {
      await transferFunds(transferForm);
      setIsTransferModalOpen(false);
    } catch (err) {
      // Toast handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Accounts & Wallets
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage your bank accounts, cash, credit cards, and transfer funds
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenTransferModal()}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors flex items-center gap-2 cursor-pointer touch-feedback shadow-2xs"
          >
            <FontAwesomeIcon icon={faRightLeft} className="text-indigo-500" />
            <span>Transfer Funds</span>
          </button>
          
          <button
            onClick={() => handleOpenAccountModal()}
            className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer touch-feedback"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Add Account</span>
          </button>
        </div>
      </header>

      {/* Net Worth Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Total Net Worth
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-zinc-900 dark:text-white">
                {formatCurrency(summary.netWorth)}
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-emerald-500 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faScaleBalanced} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            Liquid assets minus liabilities
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Liquid Assets
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-emerald-500">
                {formatCurrency(summary.liquidAssets)}
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faMoneyBillWave} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            Bank accounts, cash & wallets
          </p>
        </div>

        <div className="glass-card p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Total Liabilities
              </p>
              <h2 className="text-2xl font-bold mt-1 tracking-tight text-rose-500">
                {formatCurrency(summary.liabilities)}
              </h2>
            </div>
            <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-rose-500 flex items-center justify-center text-xs shrink-0">
              <FontAwesomeIcon icon={faCreditCard} />
            </div>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5">
            Credit cards & overdrafts
          </p>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3 px-1">
          Your Wallets & Accounts ({accounts.length})
        </h2>

        {accounts.length === 0 ? (
          <div className="glass-card p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400 text-lg">
              <FontAwesomeIcon icon={faBuildingColumns} />
            </div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white">No accounts added yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              Add your Bank accounts, Cash wallets, or Credit Cards to track real balances and execute internal transfers.
            </p>
            <button
              onClick={() => handleOpenAccountModal()}
              className="mt-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-semibold inline-flex items-center gap-2 cursor-pointer touch-feedback shadow-xs"
            >
              <FontAwesomeIcon icon={faPlus} className="text-xs" />
              <span>Add Your First Account</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map(acc => {
              const iconObj = ACCOUNT_ICONS[acc.icon] || faBuildingColumns;
              const balance = acc.balance || 0;

              return (
                <div 
                  key={acc.id} 
                  className="glass-card p-5 relative overflow-hidden transition-all hover:border-zinc-300 dark:hover:border-zinc-700 flex flex-col justify-between"
                >
                {/* Header Row */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm shadow-2xs shrink-0"
                        style={{ backgroundColor: acc.color || '#3b82f6' }}
                      >
                        <FontAwesomeIcon icon={iconObj} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-sm text-zinc-900 dark:text-white leading-tight">
                            {acc.name}
                          </h3>
                          {acc.isDefault && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">
                          {acc.type}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenAccountModal(acc)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                        title="Edit Account"
                      >
                        <FontAwesomeIcon icon={faEdit} className="text-[11px]" />
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(acc.id, acc.name)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-zinc-400 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Delete Account"
                      >
                        <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
                      </button>
                    </div>
                  </div>

                  {/* Balance Display */}
                  <div className="mt-6 mb-2">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
                      Current Balance
                    </p>
                    <h4 className={`text-2xl font-bold mt-0.5 tracking-tight ${balance < 0 ? 'text-rose-500' : 'text-zinc-900 dark:text-white'}`}>
                      {formatCurrency(balance)}
                    </h4>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between mt-4">
                  <span className="text-[10px] text-zinc-400">
                    Initial: {formatCurrency(acc.initialBalance || 0)}
                  </span>
                  <button
                    onClick={() => handleOpenTransferModal(acc.id)}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faRightLeft} className="text-[9px]" />
                    <span>Transfer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Recent Internal Transfers */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faRightLeft} className="text-zinc-400" />
            <span>Recent Transfers</span>
          </h2>
          <span className="text-[10px] text-zinc-400 font-medium">Internal Ledger</span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {recentTransfers.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-xs">
              No transfers recorded yet. Use the "Transfer Funds" button to move money between Cash, Bank, and Cards.
            </div>
          ) : (
            recentTransfers.map(t => {
              const fromAcc = accounts.find(a => a.id === t.fromAccountId);
              const toAcc = accounts.find(a => a.id === t.toAccountId);

              return (
                <div key={t.id} className="p-4 flex items-center justify-between hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs shrink-0">
                      <FontAwesomeIcon icon={faRightLeft} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-900 dark:text-white">
                        {fromAcc?.name || 'Account'} ➔ {toAcc?.name || 'Account'}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {t.note || 'Internal Transfer'} &bull; {formatDisplayDate(t.date)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">
                      {formatCurrency(t.amount)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Account Add/Edit Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden max-h-[90vh] flex flex-col my-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <FontAwesomeIcon icon={editingId ? faEdit : faPlus} className="text-zinc-400" />
                {editingId ? 'Edit Account' : 'New Account'}
              </h3>
              <button 
                onClick={() => setIsAccountModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-500 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAccount} className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Account Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accountForm.name}
                  onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white"
                  placeholder="e.g. HDFC Salary, Cash, Amazon Pay"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Type
                  </label>
                  <select
                    value={accountForm.type}
                    onChange={e => setAccountForm({ ...accountForm, type: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="bank">Bank Account</option>
                    <option value="cash">Cash Wallet</option>
                    <option value="credit">Credit Card</option>
                    <option value="wallet">Digital Wallet / UPI</option>
                    <option value="savings">Savings / Vault</option>
                    <option value="investment">Investment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Initial Balance
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-xs">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      value={accountForm.initialBalance}
                      onChange={e => setAccountForm({ ...accountForm, initialBalance: e.target.value })}
                      className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Color Presets */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Theme Color
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAccountForm({ ...accountForm, color })}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${accountForm.color === color ? 'scale-125 ring-2 ring-zinc-900 dark:ring-white ring-offset-2 dark:ring-offset-zinc-900' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Icon Presets */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Icon
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {Object.entries(ACCOUNT_ICONS).map(([key, iconObj]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAccountForm({ ...accountForm, icon: key })}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-center transition-all cursor-pointer ${accountForm.icon === key ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                    >
                      <FontAwesomeIcon icon={iconObj} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Set as Default Checkbox */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50">
                <input 
                  type="checkbox" 
                  id="isDefaultAcc" 
                  checked={accountForm.isDefault} 
                  onChange={(e) => setAccountForm({ ...accountForm, isDefault: e.target.checked })}
                  className="w-4 h-4 rounded text-zinc-900 focus:ring-zinc-900 cursor-pointer accent-zinc-900 dark:accent-white"
                />
                <label htmlFor="isDefaultAcc" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer flex-1">
                  Default Payment Account
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold transition-all disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black rounded-full animate-spin" />
                  ) : (
                    editingId ? 'Update Account' : 'Create Account'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Funds Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50 overflow-hidden max-h-[90vh] flex flex-col my-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
                <FontAwesomeIcon icon={faRightLeft} className="text-indigo-500" />
                Transfer Funds
              </h3>
              <button 
                onClick={() => setIsTransferModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-500 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    From Account <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={transferForm.fromAccountId}
                    onChange={e => setTransferForm({ ...transferForm, fromAccountId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Select Source</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrency(acc.balance)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    To Account <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={transferForm.toAccountId}
                    onChange={e => setTransferForm({ ...transferForm, toAccountId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Select Destination</option>
                    {accounts.filter(a => a.id !== transferForm.fromAccountId).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatCurrency(acc.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Transfer Amount <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-semibold text-xs">₹</span>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={transferForm.amount}
                      onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })}
                      className="w-full pl-8 pr-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white font-medium"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={transferForm.date}
                    onChange={e => setTransferForm({ ...transferForm, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                  Note / Reason
                </label>
                <input
                  type="text"
                  value={transferForm.note}
                  onChange={e => setTransferForm({ ...transferForm, note: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent outline-none transition-all text-xs text-zinc-900 dark:text-white"
                  placeholder="e.g. ATM cash withdrawal, Credit card bill"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold transition-all disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-black/30 dark:border-t-black rounded-full animate-spin" />
                  ) : (
                    'Confirm Transfer'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deletion */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
        onConfirm={handleConfirmDelete}
        title="Delete Account"
        message={`Are you sure you want to delete "${deleteConfirm.name}"? Past transactions referencing this account will still be preserved.`}
        confirmText="Delete Account"
        isDanger={true}
      />
    </div>
  );
};

export default Accounts;
