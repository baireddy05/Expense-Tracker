import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  auth, 
  googleProvider,
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged 
} from '../services/firebase';
import toast from 'react-hot-toast';

const AuthContext = createContext();

const GUEST_MODE_KEY = 'kharch_guest_mode';
const LEGACY_GUEST_MODE_KEY = 'extrack_guest_mode';

const readGuestMode = () => {
  try {
    const val = localStorage.getItem(GUEST_MODE_KEY);
    if (val !== null) return val === 'true';
    const legacy = localStorage.getItem(LEGACY_GUEST_MODE_KEY);
    if (legacy !== null) {
      try {
        localStorage.setItem(GUEST_MODE_KEY, legacy);
        localStorage.removeItem(LEGACY_GUEST_MODE_KEY);
      } catch { /* ignore */ }
      return legacy === 'true';
    }
    return false;
  } catch {
    return false;
  }
};

const clearGuestModeFlag = () => {
  try { localStorage.removeItem(GUEST_MODE_KEY); } catch { /* ignore */ }
  try { localStorage.removeItem(LEGACY_GUEST_MODE_KEY); } catch { /* ignore */ }
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');
  const [isGuestMode, setIsGuestMode] = useState(() => readGuestMode());

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    // Safety timeout: ensure loading becomes false after max 2.5s even if network hangs
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        clearTimeout(safetyTimer);
        setCurrentUser(user);
        if (user) {
          setIsGuestMode(false);
          try { clearGuestModeFlag(); } catch { /* ignore */ }
          // Guest→cloud migration runs inside TransactionContext.fetchData
          // (triggered by the userId change below) BEFORE it reads cloud, so
          // it is never raced by a second trigger here.
        }
        setLoading(false);
      }, (error) => {
        console.warn("Auth state observer error:", error);
        clearTimeout(safetyTimer);
        setLoading(false);
      });
    } catch (err) {
      console.warn("Auth initialization exception:", err);
      clearTimeout(safetyTimer);
      setLoading(false);
    }

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const openAuthModal = (tab = 'login') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const continueAsGuest = () => {
    setIsGuestMode(true);
    try { localStorage.setItem(GUEST_MODE_KEY, 'true'); } catch { /* ignore */ }
    setAuthModalOpen(false);
    toast.success('Continuing in Guest Mode (Offline Only)');
  };

  // Sign up with Email & Password
  const signup = async (email, password, displayName) => {
    if (!auth) {
      toast.error('Cloud auth is not configured. Continue as Guest to use the app offline.');
      throw new Error('Firebase auth is not configured');
    }
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
        // Preserve the Firebase User prototype (getIdToken/reload live on it —
        // a plain {...spread} would strip every method).
        setCurrentUser(Object.assign(
          Object.create(Object.getPrototypeOf(userCredential.user)),
          userCredential.user,
          { displayName }
        ));
      }
      setIsGuestMode(false);
      try { clearGuestModeFlag(); } catch { /* ignore */ }
      setAuthModalOpen(false);
      toast.success(`Welcome to Kharch, ${displayName || 'User'}!`);
      return userCredential.user;
    } catch (error) {
      console.error("Signup error:", error);
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') msg = 'This email is already registered.';
      if (error.code === 'auth/weak-password') msg = 'Password must be at least 6 characters.';
      if (error.code === 'auth/invalid-email') msg = 'Invalid email address format.';
      toast.error(msg);
      throw error;
    }
  };

  // Sign in with Email & Password
  const login = async (email, password) => {
    if (!auth) {
      toast.error('Cloud auth is not configured. Continue as Guest to use the app offline.');
      throw new Error('Firebase auth is not configured');
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setIsGuestMode(false);
      try { clearGuestModeFlag(); } catch { /* ignore */ }
      setAuthModalOpen(false);
      toast.success(`Welcome back, ${userCredential.user.displayName || userCredential.user.email}!`);
      return userCredential.user;
    } catch (error) {
      console.error("Login error:", error);
      let msg = error.message;
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Too many failed attempts. Please try again later.';
      }
      toast.error(msg);
      throw error;
    }
  };

  // Sign in with Google
  const loginWithGoogle = async () => {
    if (!auth || !googleProvider) {
      toast.error('Cloud auth is not configured. Continue as Guest to use the app offline.');
      throw new Error('Firebase auth is not configured');
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setIsGuestMode(false);
      try { clearGuestModeFlag(); } catch { /* ignore */ }
      setAuthModalOpen(false);
      toast.success(`Signed in as ${result.user.displayName || result.user.email}`);
      return result.user;
    } catch (error) {
      console.error("Google Auth error:", error);
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error(error.message || 'Google sign-in failed.');
      }
      throw error;
    }
  };

  // Logout (preserve guest offline data; explicit purge via Settings)
  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      toast.success('Signed out');
    } catch (error) {
      console.error("Logout error:", error);
      toast.error('Failed to log out');
    }
  };

  // Password Reset
  const resetPassword = async (email) => {
    if (!auth) {
      toast.error('Cloud auth is not configured. Continue as Guest to use the app offline.');
      throw new Error('Firebase auth is not configured');
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset link sent to your email!');
    } catch (error) {
      console.error("Password reset error:", error);
      let msg = error.message;
      if (error.code === 'auth/user-not-found') msg = 'No account found with this email.';
      toast.error(msg);
      throw error;
    }
  };

  // Update Display Name
  const updateUserDisplayName = async (displayName) => {
    if (!auth?.currentUser) {
      toast.error('You are not signed in.');
      return;
    }
    try {
      await updateProfile(auth.currentUser, { displayName });
      setCurrentUser({ ...auth.currentUser, displayName });
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error("Update profile error:", error);
      toast.error('Failed to update profile');
      throw error;
    }
  };

  const value = {
    currentUser,
    userId: currentUser ? currentUser.uid : null,
    loading,
    isGuestMode,
    authModalOpen,
    authModalTab,
    openAuthModal,
    closeAuthModal,
    continueAsGuest,
    signup,
    login,
    loginWithGoogle,
    logout,
    resetPassword,
    updateUserDisplayName
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
