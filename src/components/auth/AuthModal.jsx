import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEnvelope, 
  faLock, 
  faUser, 
  faTimes, 
  faShieldAlt, 
  faEye, 
  faEyeSlash,
  faArrowRight,
  faExclamationCircle
} from '@fortawesome/free-solid-svg-icons';

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

  // Sync tab with context if changed externally
  React.useEffect(() => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Gradient Top Banner */}
        <div className="bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-600 p-6 text-white text-center relative">
          <button 
            type="button"
            onClick={closeAuthModal}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md mx-auto flex items-center justify-center mb-3 shadow-inner">
            <FontAwesomeIcon icon={faShieldAlt} className="text-2xl text-white" />
          </div>
          <h3 className="text-xl font-bold tracking-tight">
            {activeTab === 'login' && 'Welcome Back to ExTrack'}
            {activeTab === 'signup' && 'Create Secure Account'}
            {activeTab === 'forgot' && 'Reset Password'}
          </h3>
          <p className="text-white/80 text-xs mt-1">
            {activeTab === 'login' && 'Sign in to access your cloud synced finances'}
            {activeTab === 'signup' && 'Your financial records stay safe and encrypted'}
            {activeTab === 'forgot' && 'Enter your email to receive recovery instructions'}
          </p>
        </div>

        {/* Tab Selector */}
        {activeTab !== 'forgot' && (
          <div className="flex border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50 p-1.5 m-4 rounded-2xl">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setFormError(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('signup'); setFormError(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'signup'
                  ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        <div className="p-6 pt-2">
          {/* Google Sign-in Button */}
          {activeTab !== 'forgot' && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 border border-gray-300 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 transition-all shadow-xs cursor-pointer disabled:opacity-60"
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
                  <div className="w-full border-t border-gray-200 dark:border-gray-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-gray-900 px-3 text-gray-400 font-medium tracking-wider">
                    Or with email
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Form error alert */}
          {formError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <FontAwesomeIcon icon={faExclamationCircle} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Auth Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {activeTab === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <FontAwesomeIcon icon={faUser} />
                  </span>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex Sharma"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <FontAwesomeIcon icon={faEnvelope} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white transition-all"
                />
              </div>
            </div>

            {activeTab !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                  {activeTab === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setActiveTab('forgot'); setFormError(''); }}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <FontAwesomeIcon icon={faLock} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                  >
                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <FontAwesomeIcon icon={faLock} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none text-gray-900 dark:text-white transition-all"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-primary-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {activeTab === 'login' && 'Sign In to Account'}
                    {activeTab === 'signup' && 'Create Account'}
                    {activeTab === 'forgot' && 'Send Reset Email'}
                  </span>
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </>
              )}
            </button>
          </form>

          {/* Footer Back & Guest Actions */}
          <div className="mt-5 text-center space-y-2">
            {activeTab === 'forgot' ? (
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setFormError(''); }}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
              >
                Back to Sign In
              </button>
            ) : (
              <div className="flex items-center justify-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <span>Want to test offline?</span>
                <button
                  type="button"
                  onClick={continueAsGuest}
                  className="font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer ml-1"
                >
                  Continue in Guest Mode
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
