import React, { useState } from 'react';
import {
  ShieldAlert,
  Ban,
  RefreshCw,
  AlertTriangle,
  Globe,
  Laptop,
  KeyRound,
  X,
  CheckCircle2,
} from 'lucide-react';
import { BlockedDevice, DeviceInfo } from '../types';
import { signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { unblockDevice, recordLoginAttempt } from '../lib/securityService';

interface BlockedScreenProps {
  blockedInfo: BlockedDevice | null;
  deviceInfo: DeviceInfo | null;
  onRefresh: () => void;
  contactEmail?: string;
  onAdminUnlocked?: () => void;
}

export const BlockedScreen: React.FC<BlockedScreenProps> = ({
  blockedInfo,
  deviceInfo,
  onRefresh,
  contactEmail = 'Iftikharcpa30@gmail.com',
  onAdminUnlocked,
}) => {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState(false);

  const handleAdminEmergencyUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);

    try {
      if (!auth) {
        throw new Error('Firebase Auth not available.');
      }
      const cred = await signInWithEmailAndPassword(auth, adminEmail.trim(), adminPassword);
      if (!db) {
        throw new Error('Database connection unavailable.');
      }

      // Strict UID-based verification: check if document exists in /admins/{uid}
      const adminDocRef = doc(db, 'admins', cred.user.uid);
      const adminDocSnap = await getDoc(adminDocRef);

      if (adminDocSnap.exists()) {
        const targetDevId = deviceInfo?.deviceId || blockedInfo?.deviceId;
        if (targetDevId) {
          await unblockDevice(targetDevId);
        }
        setAdminSuccess(true);
        setTimeout(() => {
          if (onAdminUnlocked) onAdminUnlocked();
          onRefresh();
        }, 1200);
      } else {
        await firebaseSignOut(auth);
        throw new Error('Access denied. This account UID is not registered in the /admins whitelist.');
      }
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : undefined;
      const targetDevId = deviceInfo?.deviceId || blockedInfo?.deviceId || 'blocked_device';
      recordLoginAttempt({
        email: adminEmail.trim() || 'unknown@user.com',
        status: 'failed',
        reason: 'Emergency unlock failed - invalid credentials',
        errorCode: code || 'auth/invalid-credential',
        deviceId: targetDevId,
        device: deviceInfo || undefined,
      }).catch(() => {});

      setAdminError(err instanceof Error ? err.message : 'Invalid Admin Credentials');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-rose-500 selection:text-white relative">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(225,29,72,0.14)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative max-w-lg w-full bg-neutral-900/90 border border-rose-900/50 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
        {/* Shield Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shadow-inner">
            <ShieldAlert size={44} className="stroke-[1.75]" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-rose-600 text-white p-1.5 rounded-full border-2 border-neutral-900 shadow-md">
            <Ban size={14} strokeWidth={2.5} />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-rose-400 bg-rose-950/60 border border-rose-800/40 px-3 py-1 rounded-full">
            Security Restriction
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Access Denied
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-md mx-auto">
            You have been blocked from accessing this website.
          </p>
        </div>

        {/* Device & Block Detail Box */}
        <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 text-left space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80 text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Laptop size={13} className="text-rose-400" /> Device Info
            </span>
            <span className="font-semibold text-rose-400">Status: BLOCKED</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px]">
            <div>
              <span className="text-neutral-500 block text-[10.5px]">Device ID:</span>
              <span className="font-mono text-neutral-200 truncate block">
                {deviceInfo?.deviceId || blockedInfo?.deviceId || 'Unknown'}
              </span>
            </div>

            <div>
              <span className="text-neutral-500 block text-[10.5px]">IP Address:</span>
              <span className="font-mono text-neutral-200">
                {deviceInfo?.ip || blockedInfo?.ip || 'Detected Device'}
              </span>
            </div>

            <div>
              <span className="text-neutral-500 block text-[10.5px]">Browser / OS:</span>
              <span className="text-neutral-300">
                {deviceInfo ? `${deviceInfo.browser} • ${deviceInfo.os}` : 'Browser Client'}
              </span>
            </div>

            <div>
              <span className="text-neutral-500 block text-[10.5px]">Blocked Time:</span>
              <span className="text-neutral-300">
                {blockedInfo?.blockedAt
                  ? new Date(blockedInfo.blockedAt).toLocaleString('en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Active'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-800/80 text-[11px]">
            <span className="text-neutral-500">Reason: </span>
            <span className="text-rose-300 font-medium">
              {blockedInfo?.reason && !/[\u0980-\u09FF]/.test(blockedInfo.reason)
                ? blockedInfo.reason
                : 'An unexpected login attempt was detected, so access to this website has been blocked.'}
            </span>
          </div>
        </div>

        {/* Warning / Contact Notice */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-amber-300/90 text-left text-xs">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
          <p className="leading-relaxed">
            For more information, please contact:{' '}
            <a
              href="mailto:Iftikharcpa30@gmail.com"
              className="text-amber-400 font-semibold underline hover:text-amber-300"
            >
              Iftikharcpa30@gmail.com
            </a>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onRefresh}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-white rounded-xl text-xs font-bold transition-all border border-neutral-700 cursor-pointer shadow-sm"
          >
            <RefreshCw size={14} />
            <span>Reload</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-neutral-400 hover:text-neutral-200 text-[11px] font-medium transition-colors cursor-pointer"
          >
            <KeyRound size={12} />
            <span>Admin Emergency Recovery</span>
          </button>
        </div>
      </div>

      {/* Emergency Admin Recovery Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowAdminModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="space-y-1">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound size={16} className="text-amber-400" />
                Admin Emergency Recovery
              </h2>
              <p className="text-xs text-neutral-400">
                Enter admin credentials to immediately unblock this device.
              </p>
            </div>

            {adminSuccess ? (
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>Device unblocked successfully! Loading site...</span>
              </div>
            ) : (
              <form onSubmit={handleAdminEmergencyUnlock} className="space-y-3">
                {adminError && (
                  <div className="p-2.5 bg-rose-950/40 border border-rose-800/40 rounded-lg text-rose-400 text-xs">
                    {adminError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">Admin Email</label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="ifti30ahmed@gmail.com"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-neutral-400 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={adminLoading}
                  className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {adminLoading ? 'Verifying...' : 'Unlock Device'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 text-neutral-500 text-[11px] flex items-center gap-2">
        <Globe size={12} />
        <span>E-Commerce Security Gateway • PickFinds Protection</span>
      </footer>
    </div>
  );
};
