import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DataService } from '../services/db';
import { useAuth } from './AuthContext';
import { getLocalDateString, calculateNextDueDate, formatDisplayDate } from '../utils/dateUtils';
import toast from 'react-hot-toast';

const TransactionContext = createContext();

export const TransactionProvider = ({ children }) => {
  const { userId, loading: authLoading } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [events, setEvents] = useState([]);
  const [lentRecords, setLentRecords] = useState([]);
  const [borrowedRecords, setBorrowedRecords] = useState([]);
  const [settings, setSettings] = useState({ monthlyBudget: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // In-module guard against concurrent fetchData runs (StrictMode double-invoke,
  // rapid auth flips). Subscription auto-posting reads nextDueDate from a fetch
  // snapshot; two overlapping runs would both see the same stale due date and
  // post the transaction twice. Second+ callers piggyback on the first run.
  const fetchInFlightRef = useRef(null);
  // Background refetches (sync, post-mutation refresh) must not flip the
  // global `loading` flag — AppShell renders a full splash screen while
  // loading is true, so only the very first load uses it.
  const initialLoadDoneRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (authLoading) return;
    // Coalesce concurrent invocations: a fetch already running for this user
    // (StrictMode double-effect, quick auth flips) makes later calls await its
    // result rather than racing it on the auto-post logic.
    if (fetchInFlightRef.current) {
      try { await fetchInFlightRef.current; } catch { /* surface below */ }
      return;
    }

    const run = (async () => {
    try {
      if (!initialLoadDoneRef.current) setLoading(true);
      // Migrate any guest offline records BEFORE reading cloud, so a login
      // that follows guest usage sees everything in a single pass.
      // Migration lives ONLY here (never in the auth observer) so two
      // triggers can't overlap and double-upload the same records.
      if (userId) {
        try {
          await DataService.migrateLocalDataToCloud(userId);
        } catch (migErr) {
          console.warn("Guest migration note:", migErr);
        }
      }
      const [txData, catData, settingsData, lentData, borrowData, subData, accData, goalData, eventData] = await Promise.all([
        DataService.getTransactions(userId),
        DataService.getCategories(userId),
        DataService.getSettings(userId),
        DataService.getLentRecords(userId),
        DataService.getBorrowedRecords(userId),
        DataService.getSubscriptions(userId),
        DataService.getAccounts(userId),
        DataService.getSavingsGoals(userId),
        DataService.getEvents(userId)
      ]);
      
      let currentTx = txData || [];
      let currentSubs = subData || [];
      let currentAccs = accData || [];
      const currentGoals = goalData || [];
      const currentEvents = eventData || [];

      // Auto-process due subscriptions using local timezone. Idempotency guard:
      // advance nextDueDate BEFORE creating the transaction, so a crash between
      // the two writes skips a cycle instead of double-posting; a re-run after
      // success sees the advanced date and does nothing.
      const todayStr = getLocalDateString();
      const dueSubs = currentSubs.filter(s => s.active && s.nextDueDate && s.nextDueDate <= todayStr);
      
      if (dueSubs.length > 0) {
        let postedCount = 0;
        for (const sub of dueSubs) {
          try {
            // Advance the schedule (single source of truth), but stamp the transaction
            // with the actual due date being paid.
            const paymentDate = sub.nextDueDate;
            const nextDueStr = calculateNextDueDate(sub.nextDueDate, sub.frequency);
            await DataService.updateSubscription(sub.id, { nextDueDate: nextDueStr }, userId);
            sub.nextDueDate = nextDueStr;

            const newTx = await DataService.addTransaction({
              amount: parseFloat(sub.amount),
              categoryId: sub.categoryId,
              date: paymentDate,
              note: `Auto-posted: ${sub.name}`,
              type: sub.type || 'expense',
              accountId: sub.accountId || (currentAccs.find(a => a.isDefault)?.id || currentAccs[0]?.id || null)
            }, userId);
            currentTx = [newTx, ...currentTx];
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
      setEvents(currentEvents);
      setSettings(settingsData || { monthlyBudget: 0 });
      setLentRecords(lentData || []);
      setBorrowedRecords(borrowData || []);
      setError(null);
    } catch (err) {
      console.error("Data load error:", err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      initialLoadDoneRef.current = true;
      fetchInFlightRef.current = null;
    }
    })();
    fetchInFlightRef.current = run;
    try {
      await run;
    } finally {
      if (fetchInFlightRef.current === run) fetchInFlightRef.current = null;
    }
  }, [userId, authLoading]);

  // Refetch data when auth finishes loading or user auth state changes (login / switch user / logout)
  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [fetchData, authLoading]);

  const syncLocalData = async () => {
    if (!userId) {
      toast.error('Please sign in to sync data to the cloud.');
      return;
    }
    setIsSyncing(true);
    try {
      // First migrate any guest offline records, then refresh from cloud
      try {
        const result = await DataService.migrateLocalDataToCloud(userId);
        if (result && result.count > 0) {
          toast.success(`Migrated ${result.count} offline record(s) to cloud!`, { icon: '☁️' });
        }
      } catch (migErr) {
        console.warn("Guest migration note:", migErr);
      }
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

      // Edge-triggered budget breach alert: warn only when this expense pushes
      // the current month's total across the 90% / 100% thresholds.
      try {
        const budget = parseFloat(settings?.monthlyBudget) || 0;
        const amt = parseFloat(newTx.amount) || 0;
        if (budget > 0 && newTx.type === 'expense' && amt > 0) {
          const now = new Date();
          const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const txKey = typeof newTx.date === 'string' ? newTx.date.slice(0, 7) : '';
          if (txKey === curKey) {
            let prior = 0;
            transactions.forEach(t => {
              if (t.id !== newTx.id && t.type === 'expense' && typeof t.date === 'string' && t.date.slice(0, 7) === curKey) {
                prior += parseFloat(t.amount) || 0;
              }
            });
            const after = prior + amt;
            if (prior < budget && after >= budget) {
              setTimeout(() => toast.error(
                `Over budget! Monthly spending crossed ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(budget)}.`,
                { icon: '🚨' }
              ), 400);
            } else if (prior < budget * 0.9 && after >= budget * 0.9) {
              setTimeout(() => toast(
                `Approaching budget limit — ${Math.round((after / budget) * 100)}% of monthly budget used.`,
                { icon: '⚠️' }
              ), 400);
            }
          }
        }
      } catch {
        // Alert is best-effort; never break the save flow
      }

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

  // Events / Trips Actions
  const addEvent = async (event) => {
    try {
      const cleanTag = (event.tag || event.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const payload = {
        ...event,
        tag: cleanTag || 'trip_' + Date.now(),
        budget: parseFloat(event.budget) || 0
      };
      const newEvent = await DataService.addEvent(payload, userId);
      setEvents(prev => [...prev, newEvent]);
      return newEvent;
    } catch (err) {
      setError('Failed to add trip/event');
      throw err;
    }
  };

  const updateEvent = async (id, updates) => {
    try {
      await DataService.updateEvent(id, updates, userId);
      setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
      return { id, ...updates };
    } catch (err) {
      setError('Failed to update trip/event');
      throw err;
    }
  };

  const deleteEvent = async (id) => {
    try {
      await DataService.deleteEvent(id, userId);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      setError('Failed to delete trip/event');
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
      // Reassign this account's transactions to the remaining default account
      // before removing it. Without this, deleted-account transactions match no
      // account and silently vanish from every balance.
      const remaining = accounts.filter(a => a.id !== id);
      if (remaining.length === 0) {
        throw new Error('Cannot delete the only account');
      }
      const fallbackAcc = remaining.find(a => a.isDefault) || remaining[0];

      const orphaned = transactions.filter(t => {
        if (t.type === 'transfer') return t.fromAccountId === id || t.toAccountId === id;
        return (t.accountId || fallbackAcc.id) === id;
      });

      await DataService.deleteAccount(id, userId);
      for (const t of orphaned) {
        const updates = {};
        if (t.type === 'transfer') {
          if (t.fromAccountId === id) updates.fromAccountId = fallbackAcc.id;
          if (t.toAccountId === id) updates.toAccountId = fallbackAcc.id;
          // A transfer whose source and destination collapsed onto the same
          // account is a no-op in the ledger — drop it entirely. Compare the
          // FINAL sides (updates fall back to stored values), not just the
          // changed ones, or a B→B self-transfer persists in Firestore.
          const finalFrom = updates.fromAccountId ?? t.fromAccountId;
          const finalTo = updates.toAccountId ?? t.toAccountId;
          if (finalFrom === finalTo) {
            await DataService.deleteTransaction(t.id, userId);
            setTransactions(prev => prev.filter(x => x.id !== t.id));
            continue;
          }
        } else {
          updates.accountId = fallbackAcc.id;
        }
        await DataService.updateTransaction(t.id, updates, userId);
      }

      // If the deleted account was the default, promote the fallback.
      const deletedWasDefault = !!accounts.find(a => a.id === id && a.isDefault);
      if (deletedWasDefault) {
        await DataService.updateAccount(fallbackAcc.id, { isDefault: true }, userId);
      }

      setAccounts(prev => prev
        .filter(a => a.id !== id)
        .map(a => (deletedWasDefault && a.id === fallbackAcc.id) ? { ...a, isDefault: true } : a)
      );
      if (orphaned.length > 0) {
        setTransactions(prev => prev.map(t => {
          if (!orphaned.some(o => o.id === t.id)) return t;
          if (t.type === 'transfer') {
            return {
              ...t,
              fromAccountId: t.fromAccountId === id ? fallbackAcc.id : t.fromAccountId,
              toAccountId: t.toAccountId === id ? fallbackAcc.id : t.toAccountId
            };
          }
          return { ...t, accountId: fallbackAcc.id };
        }).filter(t => !(t.type === 'transfer' && t.fromAccountId === t.toAccountId)));
      }
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
    const knownIds = new Set(accounts.map(a => a.id));

    return accounts.map(acc => {
      let balance = parseFloat(acc.initialBalance) || 0;

      transactions.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        let txAccId = t.accountId || defaultId;

        // Orphan guard: if the transaction's account was deleted, fold its
        // amount into the default account instead of letting it vanish from
        // every balance (previously deleting a wallet corrupted all totals).
        if (txAccId && !knownIds.has(txAccId)) {
          txAccId = defaultId;
        }

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

  // Dynamically compute live spending and stats for each trip/event
  const eventsWithStats = React.useMemo(() => {
    return events.map(event => {
      const budget = parseFloat(event.budget) || 0;
      const tagClean = (event.tag || '').toLowerCase();
      let totalSpent = 0;
      let matchingTxCount = 0;

      transactions.forEach(t => {
        if (t.type !== 'expense') return;
        const tagRegex = tagClean ? new RegExp('#' + tagClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9])', 'i') : null;
        const tTag = String(t.eventTag || t.tag || '').toLowerCase().replace(/^#/, '');
        const hasTag = (tagClean && (tTag === tagClean || (tagRegex && tagRegex.test(t.note || '')) || (Array.isArray(t.tags) && t.tags.some(tag => String(tag).toLowerCase().replace(/^#/, '') === tagClean))));
        const matchesEventId = t.eventId === event.id;

        if (hasTag || matchesEventId) {
          totalSpent += parseFloat(t.amount) || 0;
          matchingTxCount++;
        }
      });

      const remainingBudget = Math.max(0, budget - totalSpent);
      const percentage = budget > 0 ? (totalSpent / budget) * 100 : 0;
      const isOverBudget = totalSpent > budget && budget > 0;

      return {
        ...event,
        spent: totalSpent,
        remainingBudget,
        percentage,
        isOverBudget,
        txCount: matchingTxCount
      };
    });
  }, [events, transactions]);

  // Helper to ensure critical lending/debt system categories exist before auto-syncing
  const getOrCreateCategory = async (type, preferredName, fallbackNameMatch, defaultDef) => {
    let cat = categories.find(c => c.name?.toLowerCase() === preferredName.toLowerCase() && c.type === type) ||
              categories.find(c => c.name?.toLowerCase().includes(fallbackNameMatch.toLowerCase()) && c.type === type);
    if (!cat) {
      try {
        cat = await DataService.addCategory(defaultDef, userId);
        if (cat?.id) {
          setCategories(prev => [...prev, cat]);
        }
      } catch (e) {
        console.warn(`Could not auto-create ${preferredName} category:`, e);
      }
    }
    return cat;
  };

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
        const cat = await getOrCreateCategory(
          'expense',
          'Lent Money',
          'lent',
          { name: 'Lent Money', color: '#f59e0b', icon: 'fa-hand-holding-dollar', type: 'expense' }
        );
        await addTransaction({
          amount: initialAmount,
          type: 'expense',
          date: record.dateLent || getLocalDateString(),
          categoryId: cat?.id || 'default_lent_money',
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
        const cat = await getOrCreateCategory(
          'income',
          'Lent Returned',
          'returned',
          { name: 'Lent Returned', color: '#10b981', icon: 'fa-circle-check', type: 'income' }
        );
        await addTransaction({
          amount: repayAmount,
          type: 'income',
          date: repayment.date || getLocalDateString(),
          categoryId: cat?.id || 'default_lent_returned',
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
        const cat = await getOrCreateCategory(
          'expense',
          'Lent Money',
          'lent',
          { name: 'Lent Money', color: '#f59e0b', icon: 'fa-hand-holding-dollar', type: 'expense' }
        );
        await addTransaction({
          amount: addAmount,
          type: 'expense',
          date: loanDetails.date || getLocalDateString(),
          categoryId: cat?.id || 'default_lent_money',
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
          const cat = await getOrCreateCategory(
            'income',
            'Lent Returned',
            'returned',
            { name: 'Lent Returned', color: '#10b981', icon: 'fa-circle-check', type: 'income' }
          );
          await addTransaction({
            amount: remaining,
            type: 'income',
            date: getLocalDateString(),
            categoryId: cat?.id || 'default_lent_returned',
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
        const cat = await getOrCreateCategory(
          'income',
          'Borrowed Money',
          'borrow',
          { name: 'Borrowed Money', color: '#06b6d4', icon: 'fa-hand-holding', type: 'income' }
        );
        await addTransaction({
          amount: initialAmount,
          type: 'income',
          date: record.dateBorrowed || getLocalDateString(),
          categoryId: cat?.id || 'default_borrowed_money',
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
        const cat = await getOrCreateCategory(
          'income',
          'Borrowed Money',
          'borrow',
          { name: 'Borrowed Money', color: '#06b6d4', icon: 'fa-hand-holding', type: 'income' }
        );
        await addTransaction({
          amount: addAmount,
          type: 'income',
          date: borrowDetails.date || getLocalDateString(),
          categoryId: cat?.id || 'default_borrowed_money',
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
        const cat = await getOrCreateCategory(
          'expense',
          'Debt Repayment',
          'debt',
          { name: 'Debt Repayment', color: '#6366f1', icon: 'fa-handshake', type: 'expense' }
        );
        await addTransaction({
          amount: repayAmount,
          type: 'expense',
          date: repayment.date || getLocalDateString(),
          categoryId: cat?.id || 'default_debt_repayment',
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
          const cat = await getOrCreateCategory(
            'expense',
            'Debt Repayment',
            'debt',
            { name: 'Debt Repayment', color: '#6366f1', icon: 'fa-handshake', type: 'expense' }
          );
          await addTransaction({
            amount: remaining,
            type: 'expense',
            date: getLocalDateString(),
            categoryId: cat?.id || 'default_debt_repayment',
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

  const restoreCompleteBackup = async (data, onProgress) => {
    try {
      let importedCount = 0;
      const accountIdMap = {};
      const categoryIdMap = {};
      const eventIdMap = {};

      const report = (step, percent, message) => {
        if (typeof onProgress === 'function') {
          onProgress({ step, percent, message });
        }
      };

      report('categories', 10, 'Restoring custom categories...');
      // 1. Restore/Map Categories
      const existingCats = await DataService.getCategories(userId);
      if (data.categories && Array.isArray(data.categories)) {
        for (const cat of data.categories) {
          if (cat.name) {
            const existing = existingCats.find(c => c.name.toLowerCase() === cat.name.toLowerCase() && c.type === cat.type);
            if (existing) {
              if (cat.id) categoryIdMap[cat.id] = existing.id;
            } else {
              const { id: oldId, ...catData } = cat;
              const newCat = await DataService.addCategory(catData, userId);
              if (oldId) categoryIdMap[oldId] = newCat.id;
              importedCount++;
            }
          }
        }
      }

      report('accounts', 25, 'Restoring accounts & wallets...');
      // 2. Restore/Map Accounts
      const existingAccs = await DataService.getAccounts(userId);
      if (data.accounts && Array.isArray(data.accounts)) {
        for (const acc of data.accounts) {
          if (acc.name) {
            const existing = existingAccs.find(a => a.name.toLowerCase() === acc.name.toLowerCase());
            if (existing) {
              if (acc.id) accountIdMap[acc.id] = existing.id;
            } else {
              const { id: oldId, ...accData } = acc;
              const newAcc = await DataService.addAccount(accData, userId);
              if (oldId) accountIdMap[oldId] = newAcc.id;
              importedCount++;
            }
          }
        }
      }

      report('events', 40, 'Restoring event and trip budgets...');
      // 3. Restore/Map Events
      const existingEvents = await DataService.getEvents(userId);
      if (data.events && Array.isArray(data.events)) {
        for (const ev of data.events) {
          if (ev.name) {
            const existing = existingEvents.find(e => e.name.toLowerCase() === ev.name.toLowerCase() || (ev.tag && e.tag === ev.tag));
            if (existing) {
              if (ev.id) eventIdMap[ev.id] = existing.id;
            } else {
              const { id: oldId, ...evData } = ev;
              const newEv = await DataService.addEvent(evData, userId);
              if (oldId) eventIdMap[oldId] = newEv.id;
              importedCount++;
            }
          }
        }
      }

      report('goals', 50, 'Restoring savings goals & milestone funds...');
      // 4. Restore Savings Goals (skip ones already present — re-restoring the
      // same backup must not duplicate them).
      const existingGoals = await DataService.getSavingsGoals(userId);
      const goalSeen = new Set(existingGoals.map(g =>
        `${String(g.name || '').trim().toLowerCase()}__${parseFloat(g.targetAmount) || 0}`
      ));
      if (data.savingsGoals && Array.isArray(data.savingsGoals)) {
        for (const goal of data.savingsGoals) {
          if (goal.name) {
            const fp = `${String(goal.name).trim().toLowerCase()}__${parseFloat(goal.targetAmount) || 0}`;
            if (goalSeen.has(fp)) continue;
            goalSeen.add(fp);
            const { id: _goalId, ...goalData } = goal;
            await DataService.addSavingsGoal(goalData, userId);
            importedCount++;
          }
        }
      }

      report('subscriptions', 60, 'Restoring recurring subscriptions...');
      // 5. Restore Subscriptions (same skip-if-present dedup).
      const existingSubs = await DataService.getSubscriptions(userId);
      const subSeen = new Set(existingSubs.map(s =>
        `${String(s.name || '').trim().toLowerCase()}__${parseFloat(s.amount) || 0}__${s.frequency || ''}`
      ));
      if (data.subscriptions && Array.isArray(data.subscriptions)) {
        for (const sub of data.subscriptions) {
          if (sub.name) {
            const fp = `${String(sub.name).trim().toLowerCase()}__${parseFloat(sub.amount) || 0}__${sub.frequency || ''}`;
            if (subSeen.has(fp)) continue;
            subSeen.add(fp);
            const { id: _subId, ...subData } = sub;
            if (subData.categoryId && categoryIdMap[subData.categoryId]) {
              subData.categoryId = categoryIdMap[subData.categoryId];
            }
            if (subData.accountId && accountIdMap[subData.accountId]) {
              subData.accountId = accountIdMap[subData.accountId];
            }
            await DataService.addSubscription(subData, userId);
            importedCount++;
          }
        }
      }

      report('lent', 70, 'Restoring peer lending records...');
      // 6. Restore Lent Records (Directly to DataService so NO duplicate transaction is auto-created!)
      const existingLent = await DataService.getLentRecords(userId);
      const lentSeen = new Set(existingLent.map(r =>
        `${String(r.borrowerName || '').trim().toLowerCase()}__${parseFloat(r.amount) || 0}__${(r.dateLent || '').split('T')[0]}`
      ));
      if (data.lentRecords && Array.isArray(data.lentRecords)) {
        for (const lr of data.lentRecords) {
          if (lr.borrowerName && lr.amount) {
            const fp = `${String(lr.borrowerName).trim().toLowerCase()}__${parseFloat(lr.amount) || 0}__${(lr.dateLent || '').split('T')[0]}`;
            if (lentSeen.has(fp)) continue;
            lentSeen.add(fp);
            const { id: _lrId, ...lrData } = lr;
            await DataService.addLentRecord(lrData, userId);
            importedCount++;
          }
        }
      }

      report('borrowed', 80, 'Restoring debt liabilities & loans...');
      // 7. Restore Borrowed Records (Directly to DataService so NO duplicate transaction is auto-created!)
      const existingBorrowed = await DataService.getBorrowedRecords(userId);
      const borrowedSeen = new Set(existingBorrowed.map(r =>
        `${String(r.lenderName || '').trim().toLowerCase()}__${parseFloat(r.amount) || 0}__${(r.dateBorrowed || '').split('T')[0]}`
      ));
      if (data.borrowedRecords && Array.isArray(data.borrowedRecords)) {
        for (const br of data.borrowedRecords) {
          if (br.lenderName && br.amount) {
            const fp = `${String(br.lenderName).trim().toLowerCase()}__${parseFloat(br.amount) || 0}__${(br.dateBorrowed || '').split('T')[0]}`;
            if (borrowedSeen.has(fp)) continue;
            borrowedSeen.add(fp);
            const { id: _brId, ...brData } = br;
            await DataService.addBorrowedRecord(brData, userId);
            importedCount++;
          }
        }
      }

      report('transactions', 90, 'Restoring transactions & remapping accounts...');
      // 8. Restore Transactions with mapped accountId, categoryId, eventId.
      // Fingerprint dedup: restoring the same backup twice must not double the
      // ledger (same date + amount + type + note = already present, skip).
      if (data.transactions && Array.isArray(data.transactions)) {
        const existingTx = await DataService.getTransactions(userId);
        const seen = new Set(existingTx.map(t => {
          const dateStr = (t.date || '').split('T')[0];
          const amtStr = parseFloat(t.amount || 0).toFixed(2);
          const noteStr = (t.note || '').trim().toLowerCase();
          return `${dateStr}__${amtStr}__${t.type || 'expense'}__${noteStr}`;
        }));

        for (const tx of data.transactions) {
          const { id: _oldTxId, createdAt: _oldCreated, ...txData } = tx;
          if (txData.categoryId && categoryIdMap[txData.categoryId]) {
            txData.categoryId = categoryIdMap[txData.categoryId];
          }
          if (txData.accountId && accountIdMap[txData.accountId]) {
            txData.accountId = accountIdMap[txData.accountId];
          }
          if (txData.fromAccountId && accountIdMap[txData.fromAccountId]) {
            txData.fromAccountId = accountIdMap[txData.fromAccountId];
          }
          if (txData.toAccountId && accountIdMap[txData.toAccountId]) {
            txData.toAccountId = accountIdMap[txData.toAccountId];
          }
          if (txData.eventId && eventIdMap[txData.eventId]) {
            txData.eventId = eventIdMap[txData.eventId];
          }

          const fp = `${(txData.date || '').split('T')[0]}__${parseFloat(txData.amount || 0).toFixed(2)}__${txData.type || 'expense'}__${(txData.note || '').trim().toLowerCase()}`;
          if (seen.has(fp)) continue;
          seen.add(fp);

          await DataService.addTransaction(txData, userId);
          importedCount++;
        }
      }

      // 9. Restore Settings
      if (data.settings && typeof data.settings === 'object') {
        await DataService.updateSettings(data.settings, userId);
      }

      report('finalizing', 100, 'Synchronizing live balances & refreshing...');
      // 10. Refresh all state
      await fetchData();
      return importedCount;
    } catch (err) {
      console.error('restoreCompleteBackup error:', err);
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
    events: eventsWithStats,
    rawEvents: events,
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
    addEvent,
    updateEvent,
    deleteEvent,
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
    restoreCompleteBackup,
    refreshData: fetchData
  // Action functions are intentionally omitted from the deps below: they are
  // recreated every render, so listing them would invalidate the memo every
  // render and broadcast a new context object to all consumers. Every STATE
  // dependency is listed, so the value stays correct — the functions close
  // over state covered here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    transactions,
    categories,
    subscriptions,
    accountsWithBalances,
    accounts,
    savingsGoals,
    eventsWithStats,
    events,
    lentRecords,
    borrowedRecords,
    settings,
    loading,
    authLoading,
    error,
    isSyncing,
    userId,
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
