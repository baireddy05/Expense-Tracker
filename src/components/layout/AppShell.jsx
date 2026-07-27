import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useTransactions } from '../../context/TransactionContext';

const AppShell = () => {
  const { loading, error } = useTransactions();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-red-500 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <p className="font-bold">Error loading data</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 selection:bg-primary-500/30">
      {/* Desktop Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 relative scroll-smooth">
        <div className="max-w-7xl mx-auto p-4 md:p-8 animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

export default AppShell;
