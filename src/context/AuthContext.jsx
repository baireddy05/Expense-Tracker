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
import { DataService } from '../services/db';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');
  const [isGuestMode, setIsGuestMode] = useState(() => {
    return localStorage.getItem('extrack_guest_mode') === 'true';
  });

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setIsGuestMode(false);
        localStorage.removeItem('extrack_guest_mode');
      }
      setLoading(false);
    });

    return () => unsubscribe();
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
    localStorage.setItem('extrack_guest_mode', 'true');
    setAuthModalOpen(false);
    toast.success('Continuing in Guest Mode (Offline Only)');
  };

  // Sign up with Email & Password
  const signup = async (email, password, displayName) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName && userCredential.user) {
        await updateProfile(userCredential.user, { displayName });
        // Trigger reload to update current user state
        setCurrentUser({ ...userCredential.user, displayName });
      }
      setAuthModalOpen(false);
      toast.success(`Welcome to ExTrack, ${displayName || 'User'}!`);
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
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
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
    try {
      const result = await signInWithPopup(auth, googleProvider);
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

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      DataService.purgeAllLocalData();
      setCurrentUser(null);
      toast.success('Signed out and cleared local cache');
    } catch (error) {
      console.error("Logout error:", error);
      toast.error('Failed to log out');
    }
  };

  // Password Reset
  const resetPassword = async (email) => {
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
    if (!auth.currentUser) return;
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
      {!loading && children}
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
