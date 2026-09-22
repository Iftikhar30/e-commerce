import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { UserAuth } from '../types';

interface AuthContextType {
  user: UserAuth | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  isFirebaseReady: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_ADMIN_KEY = 'affiliate_store_admin_session';

function formatAuthError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code);
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return 'Incorrect email or password. Please verify your credentials.';
    }
    if (code === 'auth/user-not-found') {
      return 'No account found with this email. Admin accounts must be created directly in Firebase Console.';
    }
    if (code === 'auth/invalid-email') {
      return 'Please enter a valid email address.';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is not enabled in Firebase Console. Please enable "Email/Password" provider under Firebase Console -> Authentication -> Sign-in method.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network connection error. Please check your internet connection.';
    }
  }
  return err instanceof Error ? err.message : 'Authentication failed. Please check your credentials.';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAuth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            isAdmin: true,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Local demo auth check
      const localAdmin = localStorage.getItem(LOCAL_ADMIN_KEY);
      if (localAdmin) {
        try {
          setUser(JSON.parse(localAdmin));
        } catch {
          setUser(null);
        }
      }
      setLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string) => {
    setError(null);
    setLoading(true);

    if (isFirebaseConfigured && auth) {
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
        setUser({
          uid: cred.user.uid,
          email: cred.user.email,
          isAdmin: true,
        });
      } catch (err: unknown) {
        const msg = formatAuthError(err);
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Local demo login fallback if Firebase credentials not set yet
    await new Promise((res) => setTimeout(res, 400));
    if (email.trim() && pass.length >= 6) {
      const adminData: UserAuth = {
        uid: 'demo_admin_uid',
        email: email.trim(),
        isAdmin: true,
      };
      localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(adminData));
      setUser(adminData);
      setLoading(false);
    } else {
      setLoading(false);
      const msg = 'Invalid credentials. Password must be at least 6 characters.';
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await firebaseSignOut(auth);
      } catch (err) {
        console.error('Sign out error:', err);
      }
    }
    localStorage.removeItem(LOCAL_ADMIN_KEY);
    setUser(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        error,
        clearError,
        isFirebaseReady: isFirebaseConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
