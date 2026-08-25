import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { TransactionProvider } from './context/TransactionContext';
import { UIProvider } from './context/UIContext';
import AppShell from './components/layout/AppShell';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Toaster } from 'react-hot-toast';

// Optimized Lazy Route Splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const LentMoney = lazy(() => import('./pages/LentMoney'));
const BorrowedMoney = lazy(() => import('./pages/BorrowedMoney'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));

const PageLoader = () => (
  <div className="flex w-full items-center justify-center p-12 animate-pulse">
    <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <TransactionProvider>
            <UIProvider>
              <Router>
                <Routes>
                  <Route path="/" element={<AppShell />}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={
                      <Suspense fallback={<PageLoader />}>
                        <Dashboard />
                      </Suspense>
                    } />
                    <Route path="transactions" element={
                      <Suspense fallback={<PageLoader />}>
                        <Transactions />
                      </Suspense>
                    } />
                    <Route path="lent" element={
                      <Suspense fallback={<PageLoader />}>
                        <LentMoney />
                      </Suspense>
                    } />
                    <Route path="borrowed" element={
                      <Suspense fallback={<PageLoader />}>
                        <BorrowedMoney />
                      </Suspense>
                    } />
                    <Route path="analytics" element={
                      <Suspense fallback={<PageLoader />}>
                        <Analytics />
                      </Suspense>
                    } />
                    <Route path="settings" element={
                      <Suspense fallback={<PageLoader />}>
                        <Settings />
                      </Suspense>
                    } />
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
            </UIProvider>
          </TransactionProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
