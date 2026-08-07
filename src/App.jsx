import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { TransactionProvider } from './context/TransactionContext';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import LentMoney from './pages/LentMoney';
import BorrowedMoney from './pages/BorrowedMoney';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <ThemeProvider>
      <TransactionProvider>
        <Router>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="lent" element={<LentMoney />} />
              <Route path="borrowed" element={<BorrowedMoney />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
          <Toaster 
            position="bottom-center"
            toastOptions={{
              className: 'dark:bg-gray-800 dark:text-white',
              style: {
                borderRadius: '12px',
                background: '#333',
                color: '#fff',
              }
            }}
          />
        </Router>
      </TransactionProvider>
    </ThemeProvider>
  );
}

export default App;
