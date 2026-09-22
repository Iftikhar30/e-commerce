import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { getCurrentDeviceInfo } from '../lib/deviceFingerprint';
import { recordLoginAttempt } from '../lib/securityService';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const inputEmail = email.trim();

    // Get device info safely
    let deviceInfo;
    try {
      deviceInfo = await getCurrentDeviceInfo();
    } catch {
      deviceInfo = {
        deviceId: 'dev_fallback',
        ip: '127.0.0.1',
        browser: 'Browser',
        os: 'OS',
        deviceType: 'Desktop' as const,
        userAgent: navigator.userAgent || '',
      };
    }

    try {
      await login(inputEmail, password);

      // Record successful login
      await recordLoginAttempt({
        email: inputEmail,
        status: 'success',
        device: deviceInfo,
      }).catch((err) => console.warn('Record login error:', err));

      setLoading(false);
      onSuccess();
      onClose();
    } catch (authErr: unknown) {
      const failureReason =
        authErr instanceof Error
          ? authErr.message
          : 'Wrong password or authentication failed / ভুল পাসওয়ার্ড';

      // Always record failed attempt immediately
      await recordLoginAttempt({
        email: inputEmail || 'unknown@user.com',
        status: 'failed',
        reason: failureReason,
        device: deviceInfo,
      }).catch((err) => console.warn('Record login failure error:', err));

      setLoading(false);
      setErrorMessage(
        authErr instanceof Error
          ? authErr.message
          : 'Authentication failed. Please check your credentials.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl max-w-sm w-full p-6 border border-neutral-200 shadow-xl relative animate-in fade-in zoom-in-95 duration-150"
      >
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition-colors p-1"
        >
          <X size={18} />
        </button>

        <div className="text-center mb-5">
          <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center mx-auto mb-2 font-bold">
            <Lock size={18} />
          </div>
          <h3 className="text-lg font-bold text-neutral-900">Sign In</h3>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <Mail size={14} />
              </div>
              <input
                type="email"
                required
                value={email ?? ''}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.com"
                className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-hidden focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <Lock size={14} />
              </div>
              <input
                type="password"
                required
                value={password ?? ''}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 focus:outline-hidden focus:border-amber-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs mt-2"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
