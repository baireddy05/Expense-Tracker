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
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Accounts = lazy(() => import('./pages/Accounts'));
const SavingsGoals = lazy(() => import('./pages/SavingsGoals'));
const Events = lazy(() => import('./pages/Events'));

const PageLoader = () => (
  <div className="flex w-full items-center justify-center min-h-[50vh] p-12">
    <div className="relative flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
      <div className="absolute w-6 h-6 rounded-full bg-indigo-500/10 blur-sm animate-pulse" />
    </div>
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
                    <Route path="subscriptions" element={
                      <Suspense fallback={<PageLoader />}>
                        <Subscriptions />
                      </Suspense>
                    } />
                    <Route path="accounts" element={
                      <Suspense fallback={<PageLoader />}>
                        <Accounts />
                      </Suspense>
                    } />
                    <Route path="goals" element={
                      <Suspense fallback={<PageLoader />}>
                        <SavingsGoals />
                      </Suspense>
                    } />
                    <Route path="events" element={
                      <Suspense fallback={<PageLoader />}>
                        <Events />
                      </Suspense>
                    } />
                  </Route>
                </Routes>
                <Toaster 
                  position="top-center"
                  containerStyle={{
                    top: 24,
                  }}
                  toastOptions={{
                    duration: 3000,
                    className: 'liquid-glass-dock !border !border-zinc-200/80 dark:!border-white/10 !text-zinc-900 dark:!text-white !font-medium !text-xs !shadow-2xl !py-2.5 !px-4 !rounded-2xl',
                    style: {
                      backdropFilter: 'blur(20px)',
                    },
                    success: {
                      iconTheme: {
                        primary: '#10b981',
                        secondary: '#ffffff',
                      },
                    },
                    error: {
                      iconTheme: {
                        primary: '#f43f5e',
                        secondary: '#ffffff',
                      },
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
