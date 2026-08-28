import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DataService } from '../services/db';
import { useAuth } from './AuthContext';
import { getLocalDateString, calculateNextDueDate, formatDisplayDate } from '../utils/dateUtils';
import toast from 'react-hot-toast';

const TransactionContext = createContext();

export const TransactionProvider = ({ children }) => {
  const { currentUser, userId, loading: authLoading } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [lentRecords, setLentRecords] = useState([]);
  const [borrowedRecords, setBorrowedRecords] = useState([]);
  const [settings, setSettings] = useState({ monthlyBudget: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    if (authLoading) return;
    try {
      setLoading(true);
      const [txData, catData, settingsData, lentData, borrowData, subData, accData, goalData] = await Promise.all([
        DataService.getTransactions(userId),
        DataService.getCategories(userId),
        DataService.getSettings(userId),
        DataService.getLentRecords(userId),
        DataService.getBorrowedRecords(userId),
        DataService.getSubscriptions(userId),
        DataService.getAccounts(userId),
        DataService.getSavingsGoals(userId)
      ]);
      
      let currentTx = txData || [];
      let currentSubs = subData || [];
      let currentAccs = accData || [];
      const currentGoals = goalData || [];

      // Auto-process due subscriptions using local timezone
      const todayStr = getLocalDateString();
      const dueSubs = currentSubs.filter(s => s.active && s.nextDueDate && s.nextDueDate <= todayStr);
      
      if (dueSubs.length > 0) {
        let postedCount = 0;
        for (const sub of dueSubs) {
          try {
            // Post transaction
            const newTx = await DataService.addTransaction({
              amount: parseFloat(sub.amount),
              categoryId: sub.categoryId,
              date: sub.nextDueDate,
              note: `Auto-posted: ${sub.name}`,
              type: sub.type || 'expense'
            }, userId);
            currentTx = [newTx, ...currentTx];
            
            // Advance nextDueDate cleanly without UTC day-shift
            const nextDueStr = calculateNextDueDate(sub.nextDueDate, sub.frequency);
            
            await DataService.updateSubscription(sub.id, { nextDueDate: nextDueStr }, userId);
            sub.nextDueDate = nextDueStr;
            postedCount++;
          } catch (e) {
            console.error("Failed to process subscription:", sub.name, e);
          }
        }
        if (postedCount > 0) {
          setTimeout(() => toast.success(`Auto-posted ${postedCount} due subscription(s)!`), 1000);
        }
      }

      setTransactions(currentTx);
      setCategories(catData || []);
      setSubscriptions(currentSubs);
      setAccounts(currentAccs);
      setSavingsGoals(currentGoals);
      setSettings(settingsData || { monthlyBudget: 0 });
      setLentRecords(lentData || []);
      setBorrowedRecords(borrowData || []);
      setError(null);
    } catch (err) {
      console.error("Data load error:", err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [userId, authLoading]);

  // Refetch data when auth finishes loading or user auth state changes (login / switch user / logout)
  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [fetchData, authLoading]);

  // Auto-purge any legacy/offline unencrypted data from browser storage unconditionally
  useEffect(() => {
    DataService.purgeAllLocalData();
  }, [userId]);

  const syncLocalData = async () => {
    if (!userId) {
      toast.error('Please sign in to sync data to the cloud.');
      return;
    }
    setIsSyncing(true);
    try {
      await fetchData();
      toast.success('Your cloud data is securely synced with Google Cloud!', { icon: '☁️' });
    } catch (err) {
      console.error("Manual sync error:", err);
      toast.error('Failed to sync to cloud');
    } finally {
      setIsSyncing(false);
    }
  };

  const updateSettings = async (updates) => {
    try {
      const updated = await DataService.updateSettings(updates, userId);
      setSettings(prev => ({ ...prev, ...updated }));
      return updated;
    } catch (err) {
      setError('Failed to update settings');
      throw err;
    }
  };

  const addTransaction = async (tx) => {
    try {
      const newTx = await DataService.addTransaction(tx, userId);
      setTransactions(prev => [newTx, ...prev]);
      return newTx;
    } catch (err) {
      setError('Failed to add transaction');
      throw err;
    }
  };

  const updateTransaction = async (id, updates) => {
    try {
      await DataService.updateTransaction(id, updates, userId);
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      return { id, ...updates };
    } catch (err) {
      setError('Failed to update transaction');
      throw err;
    }
  };

  const deleteTransaction = async (id) => {
    try {
      await DataService.deleteTransaction(id, userId);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError('Failed to delete transaction');
      throw err;
    }
  };

  const addCategory = async (category) => {
    try {
      const newCategory = await DataService.addCategory(category, userId);
      setCategories(prev => [...prev, newCategory]);
      return newCategory;
    } catch (err) {
      setError('Failed to add category');
      throw err;
    }
  };

  const updateCategory = async (id, updates) => {
    try {
      await DataService.updateCategory(id, updates, userId);
      setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      return { id, ...updates };
    } catch (err) {
      setError('Failed to update category');
      throw err;
    }
  };

  // Subscriptions Actions
  const addSubscription = async (subscription) => {
    try {
      const todayStr = getLocalDateString();
      let subToSave = { ...subscription };

      if (subToSave.active && subToSave.nextDueDate && subToSave.nextDueDate <= todayStr) {
        try {
          const newTx = await DataService.addTransaction({
            amount: parseFloat(subToSave.amount),
            categoryId: subToSave.categoryId,
            date: subToSave.nextDueDate,
            note: `Auto-posted: ${subToSave.name}`,
            type: subToSave.type || 'expense'
          }, userId);
          setTransactions(prev => [newTx, ...prev]);

          const nextDueStr = calculateNextDueDate(subToSave.nextDueDate, subToSave.frequency);
          subToSave.nextDueDate = nextDueStr;
          toast.success(`Subscription added! Logged payment for ${formatDisplayDate(subscription.nextDueDate)}. Next due: ${formatDisplayDate(nextDueStr)}`);
        } catch (e) {
          console.error("Failed to auto-post initial transaction:", e);
        }
      }

      const newSub = await DataService.addSubscription(subToSave, userId);
      setSubscriptions(prev => [...prev, newSub]);
      return newSub;
    } catch (err) {
      setError('Failed to add subscription');
      throw err;
    }
  };

  const updateSubscription = async (id, updates) => {
    try {
      const todayStr = getLocalDateString();
      let finalUpdates = { ...updates };
      
      const existingSub = subscriptions.find(s => s.id === id);
      const mergedSub = { ...existingSub, ...updates };

      if (mergedSub.active && mergedSub.nextDueDate && mergedSub.nextDueDate <= todayStr) {
        try {
          const newTx = await DataService.addTransaction({
            amount: parseFloat(mergedSub.amount),
            categoryId: mergedSub.categoryId,
            date: mergedSub.nextDueDate,
            note: `Auto-posted: ${mergedSub.name}`,
            type: mergedSub.type || 'expense'
          }, userId);
          setTransactions(prev => [newTx, ...prev]);

          const nextDueStr = calculateNextDueDate(mergedSub.nextDueDate, mergedSub.frequency);
          finalUpdates.nextDueDate = nextDueStr;
          toast.success(`Due subscription processed! Next due: ${formatDisplayDate(nextDueStr)}`);
        } catch (e) {
          console.error("Failed to auto-post updated subscription:", e);
        }
      }

      await DataService.updateSubscription(id, finalUpdates, userId);
      setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, ...finalUpdates } : s));
      return { id, ...finalUpdates };
    } catch (err) {
      setError('Failed to update subscription');
      throw err;
    }
  };

  const deleteSubscription = async (id) => {
    try {
      await DataService.deleteSubscription(id, userId);
      setSubscriptions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      setError('Failed to delete subscription');
      throw err;
    }
  };

  // Savings Goals Actions
  const addSavingsGoal = async (goal) => {
    try {
      const newGoal = await DataService.addSavingsGoal(goal, userId);
      setSavingsGoals(prev => [...prev, newGoal]);
      return newGoal;
    } catch (err) {
      setError('Failed to add savings goal');
      throw err;
    }
  };

  const updateSavingsGoal = async (id, updates) => {
    try {
      await DataService.updateSavingsGoal(id, updates, userId);
      setSavingsGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
      return { id, ...updates };
    } catch (err) {
      setError('Failed to update savings goal');
      throw err;
    }
  };

  const deleteSavingsGoal = async (id) => {
    try {
      await DataService.deleteSavingsGoal(id, userId);
      setSavingsGoals(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      setError('Failed to delete savings goal');
      throw err;
    }
  };

  const contributeToGoal = async (goalId, amount, note = '') => {
    try {
      const goal = savingsGoals.find(g => g.id === goalId);
      if (!goal) throw new Error('Goal not found');
      const parsedAmount = parseFloat(amount);
      if (!parsedAmount || parsedAmount <= 0) throw new Error('Enter a valid contribution amount');

      const newSaved = (parseFloat(goal.savedAmount) || 0) + parsedAmount;
      const contribution = {
        id: 'contrib_' + Date.now(),
        amount: parsedAmount,
        date: getLocalDateString(),
        note: note.trim() || 'Contribution'
      };
      const updates = {
        savedAmount: newSaved,
        contributions: [...(goal.contributions || []), contribution],
        status: newSaved >= parseFloat(goal.targetAmount) ? 'completed' : 'active'
      };

      await DataService.updateSavingsGoal(goalId, updates, userId);
      setSavingsGoals(prev => prev.map(g => g.id === goalId ? { ...g, ...updates } : g));

      if (updates.status === 'completed') {
        setTimeout(() => toast.success(`🎉 Goal "${goal.name}" is fully funded!`), 300);
      } else {
        toast.success(`Saved ₹${parsedAmount.toLocaleString('en-IN')} towards "${goal.name}"!`);
      }
      return updates;
    } catch (err) {
      toast.error(err.message || 'Contribution failed');
      throw err;
    }
  };

  // Accounts Actions
  const addAccount = async (account) => {
    try {
      const newAcc = await DataService.addAccount(account, userId);
      setAccounts(prev => [...prev, newAcc]);
      return newAcc;
    } catch (err) {
      setError('Failed to add account');
      throw err;
    }
  };

  const updateAccount = async (id, updates) => {
    try {
      await DataService.updateAccount(id, updates, userId);
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
      return { id, ...updates };
    } catch (err) {
      setError('Failed to update account');
      throw err;
    }
  };

  const deleteAccount = async (id) => {
    try {
      await DataService.deleteAccount(id, userId);
      setAccounts(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      setError('Failed to delete account');
      throw err;
    }
  };

  const transferFunds = async ({ fromAccountId, toAccountId, amount, date = getLocalDateString(), note = '' }) => {
    try {
      const parsedAmount = parseFloat(amount);
      if (!parsedAmount || parsedAmount <= 0) throw new Error('Please enter a valid transfer amount');
      if (fromAccountId === toAccountId) throw new Error('Source and destination accounts must be different');

      const fromAcc = accounts.find(a => a.id === fromAccountId);
      const toAcc = accounts.find(a => a.id === toAccountId);
      const fromName = fromAcc?.name || 'Account';
      const toName = toAcc?.name || 'Account';

      const transferTx = await addTransaction({
        amount: parsedAmount,
        type: 'transfer',
        fromAccountId,
        toAccountId,
        accountId: fromAccountId,
        date,
        note: note ? note.trim() : `Transfer from ${fromName} to ${toName}`
      });

      toast.success(`Transferred ₹${parsedAmount.toLocaleString('en-IN')} from ${fromName} to ${toName}!`);
      return transferTx;
    } catch (err) {
      toast.error(err.message || 'Transfer failed');
      throw err;
    }
  };

  // Dynamically compute live balances for each account based on ledger transactions
  const accountsWithBalances = React.useMemo(() => {
    const defaultAcc = accounts.find(a => a.isDefault) || accounts[0];
    const defaultId = defaultAcc?.id;

    return accounts.map(acc => {
      let balance = parseFloat(acc.initialBalance) || 0;

      transactions.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        const txAccId = t.accountId || defaultId;

        if (t.type === 'transfer') {
          if (t.fromAccountId === acc.id) balance -= amt;
          if (t.toAccountId === acc.id) balance += amt;
        } else if (t.type === 'income') {
          if (txAccId === acc.id) balance += amt;
        } else if (t.type === 'expense') {
          if (txAccId === acc.id) balance -= amt;
        }
      });

      return {
        ...acc,
        balance
      };
    });
  }, [accounts, transactions]);

  // Lent Money Actions
  const addLentRecord = async (record) => {
    try {
      const initialAmount = parseFloat(record.amount) || 0;
      const initialLoans = (record.loans && record.loans.length > 0)
        ? record.loans
        : [
            {
              id: 'loan_' + Date.now(),
              amount: initialAmount,
              date: record.dateLent || getLocalDateString(),
              note: record.note ? record.note.trim() : 'Initial loan'
            }
          ];

      const payload = {
        ...record,
        amount: initialAmount,
        loans: initialLoans
      };

      const saved = await DataService.addLentRecord(payload, userId);
      setLentRecords(prev => [saved, ...prev]);

      // Directly reflect in main Transactions list on the record's date
      try {
        const cat = categories.find(c => c.name.toLowerCase() === 'lent money') ||
                    categories.find(c => c.name.toLowerCase().includes('lent')) ||
                    categories.find(c => c.name.toLowerCase().includes('lend')) ||
                    categories.find(c => c.type === 'expense');
        await addTransaction({
          amount: initialAmount,
          type: 'expense',
          date: record.dateLent || getLocalDateString(),
          categoryId: cat?.id || (categories.find(c => c.type === 'expense')?.id || 'cat_expense'),
          note: `Lent to ${record.borrowerName}${record.note ? ' - ' + record.note : ''}`
        });
      } catch (syncErr) {
        console.error("Failed to auto-sync lent transaction:", syncErr);
      }

      return saved;
    } catch (err) {
      setError('Failed to add lent record');
      throw err;
    }
  };

  const updateLentRecord = async (id, updates) => {
    try {
      await DataService.updateLentRecord(id, updates, userId);
      setLentRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      return { id, ...updates };
    } catch (err) {
      setError('Failed to update lent record');
      throw err;
    }
  };

  const deleteLentRecord = async (id) => {
    try {
      await DataService.deleteLentRecord(id, userId);
      setLentRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      setError('Failed to delete lent record');
      throw err;
    }
  };

  const recordRepayment = async (id, repayment) => {
    try {
      const current = lentRecords.find(r => r.id === id);
      if (!current) throw new Error('Record not found');

      const repayAmount = parseFloat(repayment.amount) || 0;
      const newReturned = (parseFloat(current.returnedAmount) || 0) + repayAmount;
      const newRepayments = [
        ...(current.repayments || []),
        {
          id: 'rep_' + Date.now(),
          amount: repayAmount,
          date: repayment.date || getLocalDateString(),
          note: repayment.note || ''
        }
      ];

      const updates = {
        returnedAmount: newReturned,
        repayments: newRepayments,
        status: newReturned >= parseFloat(current.amount) ? 'settled' : 'partial'
      };

      await DataService.updateLentRecord(id, updates, userId);
      setLentRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

      // Directly reflect return in main Transactions list on repayment date (Income inflow)
      try {
        const cat = categories.find(c => c.name.toLowerCase() === 'lent returned') ||
                    categories.find(c => c.name.toLowerCase().includes('returned')) ||
                    categories.find(c => c.name.toLowerCase().includes('lent')) ||
                    categories.find(c => c.type === 'income');
        await addTransaction({
          amount: repayAmount,
          type: 'income',
          date: repayment.date || getLocalDateString(),
          categoryId: cat?.id || (categories.find(c => c.type === 'income')?.id || 'cat_income'),
          note: `Returned by ${current.borrowerName}${repayment.note ? ' - ' + repayment.note : ''}`
        });
      } catch (syncErr) {
        console.error("Failed to auto-sync lent return transaction:", syncErr);
      }

      return updates;
    } catch (err) {
      setError('Failed to record repayment');
      throw err;
    }
  };

  const lendMoreMoney = async (id, loanDetails) => {
    try {
      const current = lentRecords.find(r => r.id === id);
      if (!current) throw new Error('Record not found');

      const addAmount = parseFloat(loanDetails.amount) || 0;
      if (addAmount <= 0) throw new Error('Invalid loan amount');

      const initialLoan = {
        id: 'loan_init_' + (current.createdAt ? new Date(current.createdAt).getTime() : Date.now()),
        amount: parseFloat(current.amount) || 0,
        date: current.dateLent || (current.createdAt ? current.createdAt.split('T')[0] : getLocalDateString()),
        note: current.note || 'Initial loan'
      };

      const existingLoans = (current.loans && Array.isArray(current.loans) && current.loans.length > 0)
        ? current.loans
        : [initialLoan];

      const newLoanEntry = {
        id: 'loan_' + Date.now(),
        amount: addAmount,
        date: loanDetails.date || getLocalDateString(),
        note: loanDetails.note ? loanDetails.note.trim() : 'Additional loan'
      };

      const updatedLoans = [...existingLoans, newLoanEntry];
      const newTotalAmount = updatedLoans.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
      const currentReturned = parseFloat(current.returnedAmount) || 0;

      const updates = {
        amount: newTotalAmount,
        loans: updatedLoans,
        status: currentReturned >= newTotalAmount ? 'settled' : (currentReturned > 0 ? 'partial' : 'pending')
      };

      if (loanDetails.dueDate !== undefined) {
        updates.dueDate = loanDetails.dueDate || null;
      }

      await DataService.updateLentRecord(id, updates, userId);
      setLentRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

      // Directly reflect top-up loan in main Transactions list on top-up date
      try {
        const cat = categories.find(c => c.name.toLowerCase() === 'lent money') ||
                    categories.find(c => c.name.toLowerCase().includes('lent')) ||
                    categories.find(c => c.name.toLowerCase().includes('lend')) ||
                    categories.find(c => c.type === 'expense');
        await addTransaction({
          amount: addAmount,
          type: 'expense',
          date: loanDetails.date || getLocalDateString(),
          categoryId: cat?.id || (categories.find(c => c.type === 'expense')?.id || 'cat_expense'),
          note: `Lent top-up to ${current.borrowerName}${loanDetails.note ? ' - ' + loanDetails.note : ''}`
        });
      } catch (syncErr) {
        console.error("Failed to auto-sync top-up loan transaction:", syncErr);
      }

      return updates;
    } catch (err) {
      setError('Failed to lend more money');
      throw err;
    }
  };

  const settleLentRecord = async (id) => {
    try {
      const current = lentRecords.find(r => r.id === id);
      if (!current) throw new Error('Record not found');

      const totalAmount = parseFloat(current.amount) || 0;
      const currentReturned = parseFloat(current.returnedAmount) || 0;
      const remaining = Math.max(0, totalAmount - currentReturned);

      const newRepayments = remaining > 0 ? [
        ...(current.repayments || []),
        {
          id: 'rep_' + Date.now(),
          amount: remaining,
          date: getLocalDateString(),
          note: 'Marked fully settled'
        }
      ] : (current.repayments || []);

      const updates = {
        returnedAmount: totalAmount,
        repayments: newRepayments,
        status: 'settled'
      };

      await DataService.updateLentRecord(id, updates, userId);
      setLentRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

      if (remaining > 0) {
        try {
          const cat = categories.find(c => c.name.toLowerCase() === 'lent returned') ||
                      categories.find(c => c.name.toLowerCase().includes('returned')) ||
                      categories.find(c => c.name.toLowerCase().includes('lent')) ||
                      categories.find(c => c.type === 'income');
          await addTransaction({
            amount: remaining,
            type: 'income',
            date: getLocalDateString(),
            categoryId: cat?.id || (categories.find(c => c.type === 'income')?.id || 'cat_income'),
            note: `Settled & returned by ${current.borrowerName}`
          });
        } catch (syncErr) {
          console.error("Failed to auto-sync settlement transaction:", syncErr);
        }
      }

      return updates;
    } catch (err) {
      setError('Failed to settle loan');
      throw err;
    }
  };

  // ==========================================
  // Borrowed Money Actions (Debts owed to friends)
  // ==========================================
  const addBorrowedRecord = async (record) => {
    try {
      const initialAmount = parseFloat(record.amount) || 0;
      const initialBorrows = (record.borrows && record.borrows.length > 0)
        ? record.borrows
        : [
            {
              id: 'borrow_' + Date.now(),
              amount: initialAmount,
              date: record.dateBorrowed || getLocalDateString(),
              note: record.note ? record.note.trim() : 'Initial borrowed money'
            }
          ];

      const payload = {
        ...record,
        amount: initialAmount,
        borrows: initialBorrows
      };

      const saved = await DataService.addBorrowedRecord(payload, userId);
      setBorrowedRecords(prev => [saved, ...prev]);

      // Directly reflect in main Transactions list on dateBorrowed (Income Inflow)
      try {
        const cat = categories.find(c => c.name.toLowerCase() === 'borrowed money') ||
                    categories.find(c => c.name.toLowerCase().includes('borrow')) ||
                    categories.find(c => c.type === 'income');
        await addTransaction({
          amount: initialAmount,
          type: 'income',
          date: record.dateBorrowed || getLocalDateString(),
          categoryId: cat?.id || (categories.find(c => c.type === 'income')?.id || 'cat_income'),
          note: `Borrowed from ${record.lenderName}${record.note ? ' - ' + record.note : ''}`
        });
      } catch (syncErr) {
        console.error("Failed to auto-sync borrowed transaction:", syncErr);
      }

      return saved;
    } catch (err) {
      setError('Failed to add borrowed record');
      throw err;
    }
  };

  const updateBorrowedRecord = async (id, updates) => {
    try {
      await DataService.updateBorrowedRecord(id, updates, userId);
      setBorrowedRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      return { id, ...updates };
    } catch (err) {
      setError('Failed to update borrowed record');
      throw err;
    }
  };

  const deleteBorrowedRecord = async (id) => {
    try {
      await DataService.deleteBorrowedRecord(id, userId);
      setBorrowedRecords(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      setError('Failed to delete borrowed record');
      throw err;
    }
  };

  const borrowMoreMoney = async (id, borrowDetails) => {
    try {
      const current = borrowedRecords.find(r => r.id === id);
      if (!current) throw new Error('Record not found');

      const addAmount = parseFloat(borrowDetails.amount) || 0;
      if (addAmount <= 0) throw new Error('Invalid borrow amount');

      const initialBorrow = {
        id: 'borrow_init_' + (current.createdAt ? new Date(current.createdAt).getTime() : Date.now()),
        amount: parseFloat(current.amount) || 0,
        date: current.dateBorrowed || (current.createdAt ? current.createdAt.split('T')[0] : getLocalDateString()),
        note: current.note || 'Initial borrowed money'
      };

      const existingBorrows = (current.borrows && Array.isArray(current.borrows) && current.borrows.length > 0)
        ? current.borrows
        : [initialBorrow];

      const newBorrowEntry = {
        id: 'borrow_' + Date.now(),
        amount: addAmount,
        date: borrowDetails.date || getLocalDateString(),
        note: borrowDetails.note ? borrowDetails.note.trim() : 'Additional borrowed money'
      };

      const updatedBorrows = [...existingBorrows, newBorrowEntry];
      const newTotalAmount = updatedBorrows.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
      const currentReturned = parseFloat(current.returnedAmount) || 0;

      const updates = {
        amount: newTotalAmount,
        borrows: updatedBorrows,
        status: currentReturned >= newTotalAmount ? 'settled' : (currentReturned > 0 ? 'partial' : 'pending')
      };

      if (borrowDetails.dueDate !== undefined) {
        updates.dueDate = borrowDetails.dueDate || null;
      }

      await DataService.updateBorrowedRecord(id, updates, userId);
      setBorrowedRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

      // Directly reflect top-up borrowed entry in main Transactions list on top-up date
      try {
        const cat = categories.find(c => c.name.toLowerCase() === 'borrowed money') ||
                    categories.find(c => c.name.toLowerCase().includes('borrow')) ||
                    categories.find(c => c.type === 'income');
        await addTransaction({
          amount: addAmount,
          type: 'income',
          date: borrowDetails.date || getLocalDateString(),
          categoryId: cat?.id || (categories.find(c => c.type === 'income')?.id || 'cat_income'),
          note: `Borrowed top-up from ${current.lenderName}${borrowDetails.note ? ' - ' + borrowDetails.note : ''}`
        });
      } catch (syncErr) {
        console.error("Failed to auto-sync top-up borrow transaction:", syncErr);
      }

      return updates;
    } catch (err) {
      setError('Failed to borrow more money');
      throw err;
    }
  };

  const recordBorrowedRepayment = async (id, repayment) => {
    try {
      const current = borrowedRecords.find(r => r.id === id);
      if (!current) throw new Error('Record not found');

      const repayAmount = parseFloat(repayment.amount) || 0;
      const newReturned = (parseFloat(current.returnedAmount) || 0) + repayAmount;
      const newRepayments = [
        ...(current.repayments || []),
        {
          id: 'rep_' + Date.now(),
          amount: repayAmount,
          date: repayment.date || getLocalDateString(),
          note: repayment.note || ''
        }
      ];

      const updates = {
        returnedAmount: newReturned,
        repayments: newRepayments,
        status: newReturned >= parseFloat(current.amount) ? 'settled' : 'partial'
      };

      await DataService.updateBorrowedRecord(id, updates, userId);
      setBorrowedRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

      // Directly reflect debt repayment in main Transactions list on repayment date (Expense outflow)
      try {
        const cat = categories.find(c => c.name.toLowerCase() === 'debt repayment') ||
                    categories.find(c => c.name.toLowerCase().includes('debt')) ||
                    categories.find(c => c.type === 'expense');
        await addTransaction({
          amount: repayAmount,
          type: 'expense',
          date: repayment.date || getLocalDateString(),
          categoryId: cat?.id || (categories.find(c => c.type === 'expense')?.id || 'cat_expense'),
          note: `Repaid debt to ${current.lenderName}${repayment.note ? ' - ' + repayment.note : ''}`
        });
      } catch (syncErr) {
        console.error("Failed to auto-sync debt repayment transaction:", syncErr);
      }

      return updates;
    } catch (err) {
      setError('Failed to record repayment');
      throw err;
    }
  };

  const settleBorrowedRecord = async (id) => {
    try {
      const current = borrowedRecords.find(r => r.id === id);
      if (!current) throw new Error('Record not found');

      const totalAmount = parseFloat(current.amount) || 0;
      const currentReturned = parseFloat(current.returnedAmount) || 0;
      const remaining = Math.max(0, totalAmount - currentReturned);

      const newRepayments = remaining > 0 ? [
        ...(current.repayments || []),
        {
          id: 'rep_' + Date.now(),
          amount: remaining,
          date: getLocalDateString(),
          note: 'Marked fully paid back'
        }
      ] : (current.repayments || []);

      const updates = {
        returnedAmount: totalAmount,
        repayments: newRepayments,
        status: 'settled'
      };

      await DataService.updateBorrowedRecord(id, updates, userId);
      setBorrowedRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

      if (remaining > 0) {
        try {
          const cat = categories.find(c => c.name.toLowerCase() === 'debt repayment') ||
                      categories.find(c => c.name.toLowerCase().includes('debt')) ||
                      categories.find(c => c.type === 'expense');
          await addTransaction({
            amount: remaining,
            type: 'expense',
            date: new Date().toISOString().split('T')[0],
            categoryId: cat?.id || (categories.find(c => c.type === 'expense')?.id || 'cat_expense'),
            note: `Settled & repaid debt to ${current.lenderName}`
          });
        } catch (syncErr) {
          console.error("Failed to auto-sync settlement transaction:", syncErr);
        }
      }

      return updates;
    } catch (err) {
      setError('Failed to settle borrowed money');
      throw err;
    }
  };

  const purgeLocalCache = useCallback(() => {
    DataService.purgeAllLocalData();
    toast.success('Local browser cache purged! Your data is protected in Cloud Firestore.', { icon: '🛡️' });
  }, []);

  const contextValue = React.useMemo(() => ({
    transactions,
    categories,
    subscriptions,
    accounts: accountsWithBalances,
    rawAccounts: accounts,
    savingsGoals,
    lentRecords,
    borrowedRecords,
    settings,
    loading: authLoading || loading,
    error,
    isSyncing,
    syncLocalData,
    purgeLocalCache,
    updateSettings,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    contributeToGoal,
    addAccount,
    updateAccount,
    deleteAccount,
    transferFunds,
    addLentRecord,
    updateLentRecord,
    deleteLentRecord,
    lendMoreMoney,
    recordRepayment,
    settleLentRecord,
    addBorrowedRecord,
    updateBorrowedRecord,
    deleteBorrowedRecord,
    borrowMoreMoney,
    recordBorrowedRepayment,
    settleBorrowedRecord,
    refreshData: fetchData
  }), [
    transactions,
    categories,
    subscriptions,
    accountsWithBalances,
    accounts,
    savingsGoals,
    lentRecords,
    borrowedRecords,
    settings,
    loading,
    authLoading,
    error,
    isSyncing,
    fetchData,
    purgeLocalCache
  ]);

  return (
    <TransactionContext.Provider value={contextValue}>
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransactions = () => useContext(TransactionContext);
