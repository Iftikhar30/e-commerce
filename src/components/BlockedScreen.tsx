import React from 'react';
import { ShieldAlert, Ban, RefreshCw, AlertTriangle, Globe, Laptop } from 'lucide-react';
import { BlockedDevice, DeviceInfo } from '../types';

interface BlockedScreenProps {
  blockedInfo: BlockedDevice | null;
  deviceInfo: DeviceInfo | null;
  onRefresh: () => void;
  contactEmail?: string;
}

export const BlockedScreen: React.FC<BlockedScreenProps> = ({
  blockedInfo,
  deviceInfo,
  onRefresh,
  contactEmail = 'support@affiliatestore.com',
}) => {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-rose-500 selection:text-white">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(225,29,72,0.12)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative max-w-lg w-full bg-neutral-900/90 border border-rose-900/40 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
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
            Security Restriction • সিকিউরিটি পলিসি
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            অ্যাক্সেস ব্লক করা হয়েছে / Access Restricted
          </h1>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-md mx-auto">
            নিরাপত্তাজনিত কারণে অ্যাডমিনিস্ট্রেটর কর্তৃক আপনার এই ডিভাইসটিকে এই ওয়েবসাইটে প্রবেশ করা থেকে ব্লক করা হয়েছে।
          </p>
          <p className="text-[11px] text-neutral-400 font-mono">
            Target Site: https://e-commerce-six-sage-15.vercel.app
          </p>
        </div>

        {/* Device & Block Detail Box */}
        <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 text-left space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800/80 text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Laptop size={13} className="text-rose-400" /> ডিভাইস বিবরণ (Device Info)
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

          {blockedInfo?.reason && (
            <div className="pt-2 border-t border-neutral-800/80 text-[11px]">
              <span className="text-neutral-500">কারণ (Reason): </span>
              <span className="text-rose-300 font-medium">{blockedInfo.reason}</span>
            </div>
          )}
        </div>

        {/* Warning / Contact Notice */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-amber-300/90 text-left text-xs">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
          <p className="leading-relaxed">
            যদি আপনি মনে করেন এটি একটি ভুল এবং আপনি বৈধ ইউজার, তবে অনুগ্রহ করে সাইট অ্যাডমিনের সাথে যোগাযোগ করুন:{' '}
            <a
              href={`mailto:${contactEmail}`}
              className="text-amber-400 font-semibold underline hover:text-amber-300"
            >
              {contactEmail}
            </a>
          </p>
        </div>

        {/* Action Button */}
        <div>
          <button
            type="button"
            onClick={onRefresh}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-white rounded-xl text-xs font-bold transition-all border border-neutral-700 cursor-pointer shadow-sm"
          >
            <RefreshCw size={14} />
            <span>স্ট্যাটাস রিফ্রেশ করুন (Check Again)</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-neutral-500 text-[11px] flex items-center gap-2">
        <Globe size={12} />
        <span>E-Commerce Security Gateway • All Rights Reserved</span>
      </footer>
    </div>
  );
};
