import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
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

function formatAuthError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code);
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return 'Incorrect email or password. Please verify your credentials.';
    }
    if (code === 'auth/user-not-found') {
      return 'No account found with this email. Admin accounts must be created in Firebase Console.';
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

async function verifyAdminPrivilege(firebaseUser: User): Promise<boolean> {
  if (!db || !firebaseUser?.uid) return false;

  try {
    const snap = await getDoc(doc(db, 'admins', firebaseUser.uid));
    if (snap.exists()) {
      return true;
    }
  } catch (err) {
    console.warn('Error checking admin authorization document:', err);
  }

  return false;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserAuth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
        if (firebaseUser) {
          const isAdmin = await verifyAdminPrivilege(firebaseUser);
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            isAdmin,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, pass: string) => {
    setError(null);
    setLoading(true);

    if (isFirebaseConfigured && auth) {
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
        const isAdmin = await verifyAdminPrivilege(cred.user);
        if (!isAdmin) {
          await firebaseSignOut(auth);
          throw new Error('Access denied. This account UID is not authorized in the /admins collection.');
        }
        setUser({
          uid: cred.user.uid,
          email: cred.user.email,
          isAdmin: true,
        });
      } catch (err: unknown) {
        const msg = formatAuthError(err);
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: string }).code)
            : undefined;
        setError(msg);
        const customErr = new Error(msg);
        if (code) {
          (customErr as Error & { code?: string }).code = code;
        }
        throw customErr;
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(false);
    throw new Error('Firebase Authentication is not configured.');
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await firebaseSignOut(auth);
      } catch (err) {
        console.error('Sign out error:', err);
      }
    }
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
