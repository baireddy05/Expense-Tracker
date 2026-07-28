import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DataService } from '../services/db';

const TransactionContext = createContext();

export const TransactionProvider = ({ children }) => {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState({ monthlyBudget: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [txData, catData, settingsData] = await Promise.all([
        DataService.getTransactions(),
        DataService.getCategories(),
        DataService.getSettings()
      ]);
      setTransactions(txData);
      setCategories(catData);
      setSettings(settingsData);
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
      const updated = await DataService.updateTransaction(id, updates);
      setTransactions(prev => prev.map(t => t.id === id ? updated : t));
      return updated;
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

  return (
    <TransactionContext.Provider value={{
      transactions,
      categories,
      settings,
      loading,
      error,
      updateSettings,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      addCategory,
      refreshData: fetchData
    }}>
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransactions = () => useContext(TransactionContext);
