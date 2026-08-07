import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DataService } from '../services/db';

const TransactionContext = createContext();

export const TransactionProvider = ({ children }) => {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lentRecords, setLentRecords] = useState([]);
  const [settings, setSettings] = useState({ monthlyBudget: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [txData, catData, settingsData, lentData] = await Promise.all([
        DataService.getTransactions(),
        DataService.getCategories(),
        DataService.getSettings(),
        DataService.getLentRecords()
      ]);
      setTransactions(txData);
      setCategories(catData);
      setSettings(settingsData);
      setLentRecords(lentData || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateSettings = async (updates) => {
    try {
      const updated = await DataService.updateSettings(settings.id || 'global', updates);
      setSettings(prev => ({ ...prev, ...updated }));
      return updated;
    } catch (err) {
      setError('Failed to update settings');
      throw err;
    }
  };

  const addTransaction = async (tx) => {
    try {
      const newTx = await DataService.addTransaction(tx);
      setTransactions(prev => [...prev, newTx]);
      return newTx;
    } catch (err) {
      setError('Failed to add transaction');
      throw err;
    }
  };

  const updateTransaction = async (id, updates) => {
    try {
      await DataService.updateTransaction(id, updates);
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      return { id, ...updates };
    } catch (err) {
      setError('Failed to update transaction');
      throw err;
    }
  };

  const deleteTransaction = async (id) => {
    try {
      await DataService.deleteTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError('Failed to delete transaction');
      throw err;
    }
  };

  const addCategory = async (category) => {
    try {
      const newCategory = await DataService.addCategory(category);
      setCategories(prev => [...prev, newCategory]);
      return newCategory;
    } catch (err) {
      setError('Failed to add category');
      throw err;
    }
  };

  // Lent Money Actions
  const addLentRecord = async (record) => {
    try {
      const saved = await DataService.addLentRecord(record);
      setLentRecords(prev => [saved, ...prev]);
      return saved;
    } catch (err) {
      setError('Failed to add lent record');
      throw err;
    }
  };

  const updateLentRecord = async (id, updates) => {
    try {
      await DataService.updateLentRecord(id, updates);
      setLentRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      return { id, ...updates };
    } catch (err) {
      setError('Failed to update lent record');
      throw err;
    }
  };

  const deleteLentRecord = async (id) => {
    try {
      await DataService.deleteLentRecord(id);
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
          date: repayment.date || new Date().toISOString().split('T')[0],
          note: repayment.note || ''
        }
      ];

      const updates = {
        returnedAmount: newReturned,
        repayments: newRepayments,
        status: newReturned >= parseFloat(current.amount) ? 'settled' : 'partial'
      };

      await DataService.updateLentRecord(id, updates);
      setLentRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
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
        date: current.dateLent || (current.createdAt ? current.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]),
        note: current.note || 'Initial loan'
      };

      const existingLoans = (current.loans && Array.isArray(current.loans) && current.loans.length > 0)
        ? current.loans
        : [initialLoan];

      const newLoanEntry = {
        id: 'loan_' + Date.now(),
        amount: addAmount,
        date: loanDetails.date || new Date().toISOString().split('T')[0],
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

      await DataService.updateLentRecord(id, updates);
      setLentRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
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
          date: new Date().toISOString().split('T')[0],
          note: 'Marked fully settled'
        }
      ] : (current.repayments || []);

      const updates = {
        returnedAmount: totalAmount,
        repayments: newRepayments,
        status: 'settled'
      };

      await DataService.updateLentRecord(id, updates);
      setLentRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      return updates;
    } catch (err) {
      setError('Failed to settle loan');
      throw err;
    }
  };

  return (
    <TransactionContext.Provider value={{
      transactions,
      categories,
      lentRecords,
      settings,
      loading,
      error,
      updateSettings,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addCategory,
      addLentRecord,
      updateLentRecord,
      deleteLentRecord,
      lendMoreMoney,
      recordRepayment,
      settleLentRecord,
      refreshData: fetchData
    }}>
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransactions = () => useContext(TransactionContext);
