import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEnvelope, 
  faLock, 
  faUser, 
  faTimes, 
  faEye, 
  faEyeSlash,
  faArrowRight,
  faExclamationCircle,
  faWallet
} from '@fortawesome/free-solid-svg-icons';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const AuthModal = () => {
  const { 
    authModalOpen, 
    authModalTab, 
    closeAuthModal, 
    signup, 
    login, 
    loginWithGoogle, 
    resetPassword,
    continueAsGuest
  } = useAuth();

  const [activeTab, setActiveTab] = useState(authModalTab || 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useBodyScrollLock(authModalOpen);

  useEffect(() => {
    if (authModalTab) {
      setActiveTab(authModalTab);
      setFormError('');
    }
  }, [authModalTab]);

  if (!authModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      if (activeTab === 'login') {
        if (!email || !password) {
          setFormError('Please fill in all fields.');
          setIsSubmitting(false);
          return;
        }
        await login(email.trim(), password);
      } else if (activeTab === 'signup') {
        if (!email || !password || !displayName) {
          setFormError('Please fill in all required fields.');
          setIsSubmitting(false);
          return;
        }
        if (password.length < 6) {
          setFormError('Password must be at least 6 characters.');
          setIsSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setFormError('Passwords do not match.');
          setIsSubmitting(false);
          return;
        }
        await signup(email.trim(), password, displayName.trim());
      } else if (activeTab === 'forgot') {
        if (!email) {
          setFormError('Please enter your account email.');
          setIsSubmitting(false);
          return;
        }
        await resetPassword(email.trim());
        setActiveTab('login');
      }
    } catch (err) {
      setFormError(err.message || 'Authentication error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setFormError('');
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setFormError('Google sign in failed.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={closeAuthModal}>
      <div 
        className="liquid-glass-dock w-full max-w-md rounded-3xl overflow-hidden border border-white/60 dark:border-white/10 shadow-2xl animate-pop-in sm:my-auto mt-auto mb-0 sm:mb-auto sm:mt-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="relative p-6 pb-4 text-center border-b border-white/50 dark:border-white/10">
          <button
            type="button"
            onClick={closeAuthModal}
            className="absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/10 transition-colors touch-feedback"
          >
            <FontAwesomeIcon icon={faTimes} className="text-xs" />
          </button>
          <div className="w-11 h-11 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 mx-auto flex items-center justify-center mb-3 shadow-xs">
            <FontAwesomeIcon icon={faWallet} className="text-sm" />
          </div>
          <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
            {activeTab === 'login' && 'Sign In to ExTrack'}
            {activeTab === 'signup' && 'Create Account'}
            {activeTab === 'forgot' && 'Reset Password'}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-0.5">
            {activeTab === 'login' && 'Access your encrypted cloud financial ledger'}
            {activeTab === 'signup' && 'Sync and protect your expenses across all devices'}
            {activeTab === 'forgot' && 'Enter your email to receive recovery instructions'}
          </p>
        </div>

        {/* Tab Selector */}
        {activeTab !== 'forgot' && (
          <div className="flex liquid-glass-subtle p-1 m-5 mb-0 rounded-2xl">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setFormError(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer touch-feedback ${
                activeTab === 'login'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('signup'); setFormError(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer touch-feedback ${
                activeTab === 'signup'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        <div className="p-5 pt-4 pb-safe sm:pb-5 max-h-[85vh] overflow-y-auto sm:overflow-visible">
          {/* Google Sign-in Button */}
          {activeTab !== 'forgot' && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 liquid-glass-subtle hover:bg-white/60 dark:hover:bg-white/10 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-all shadow-2xs cursor-pointer disabled:opacity-60 touch-feedback"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="liquid-glass-dock px-3 text-zinc-400 font-medium tracking-wider rounded-full">
                    Or email
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Form error alert */}
          {formError && (
            <div className="mb-3.5 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
              <FontAwesomeIcon icon={faExclamationCircle} className="shrink-0 text-xs" />
              <span>{formError}</span>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {activeTab === 'signup' && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                    <FontAwesomeIcon icon={faUser} />
                  </span>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex Sharma"
                    className="w-full pl-9 pr-3.5 py-2 liquid-glass-input rounded-xl text-xs focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-zinc-900 dark:text-white transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                  <FontAwesomeIcon icon={faEnvelope} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full pl-9 pr-3.5 py-2 liquid-glass-input rounded-xl text-xs focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-zinc-900 dark:text-white transition-all"
                />
              </div>
            </div>

            {activeTab !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                    Password
                  </label>
                  {activeTab === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('forgot'); setFormError(''); }}
                      className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                    <FontAwesomeIcon icon={faLock} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-2 liquid-glass-input rounded-xl text-xs focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-zinc-900 dark:text-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer text-xs"
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'signup' && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">
                    <FontAwesomeIcon icon={faLock} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2 liquid-glass-input rounded-xl text-xs focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 outline-none text-zinc-900 dark:text-white transition-all"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 touch-feedback"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-zinc-400 border-t-white dark:border-t-zinc-900 rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {activeTab === 'login' && 'Sign In'}
                    {activeTab === 'signup' && 'Create Account'}
                    {activeTab === 'forgot' && 'Send Reset Email'}
                  </span>
                  <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
                </>
              )}
            </button>
          </form>

          {/* Footer Back & Guest Actions */}
          <div className="mt-4 text-center space-y-1.5">
            {activeTab === 'forgot' ? (
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setFormError(''); }}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                Back to Sign In
              </button>
            ) : (
              <div className="flex items-center justify-center gap-1 text-xs text-zinc-400">
                <span>Want to test offline?</span>
                <button
                  type="button"
                  onClick={continueAsGuest}
                  className="font-medium text-zinc-600 dark:text-zinc-300 hover:underline cursor-pointer ml-1"
                >
                  Continue as Guest
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AuthModal;
