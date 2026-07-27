import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import { TransactionProvider } from './context/TransactionContext';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <TransactionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TransactionProvider>
    </ThemeProvider>
  );
}

export default App;
