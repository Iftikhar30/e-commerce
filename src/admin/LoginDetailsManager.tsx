import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  Trash2,
  Download,
  Search,
  Filter,
  RefreshCw,
  Clock,
  UserX,
  AlertTriangle,
  Radio,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  SlidersHorizontal,
  Unlock,
  Ban,
  Activity,
  ChevronRight,
  Info,
} from 'lucide-react';
import { LoginLog, BlockedDevice } from '../types';
import {
  subscribeToLoginLogs,
  subscribeToBlockedDevices,
  blockDevice,
  unblockDevice,
  unblockAllDevices,
  clearAllLoginLogs,
} from '../lib/securityService';
import { isFirebaseConfigured } from '../lib/firebase';

export const LoginDetailsManager: React.FC = () => {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [blockedDevices, setBlockedDevices] = useState<BlockedDevice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'failed' | 'success'>('all');
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'Mobile' | 'Desktop' | 'Tablet'>('all');
  const [activeTab, setActiveTab] = useState<'logs' | 'blocked' | 'insights'>('logs');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Block Modal State
  const [deviceToBlock, setDeviceToBlock] = useState<LoginLog | null>(null);
  const [blockReason, setBlockReason] = useState('Suspicious login activity');

  // Real-time Firestore Subscriptions
  useEffect(() => {
    const unsubLogs = subscribeToLoginLogs((newLogs) => {
      setLogs(newLogs);
    });

    const unsubBlocked = subscribeToBlockedDevices((newBlocked) => {
      setBlockedDevices(newBlocked);
    });

    return () => {
      unsubLogs();
      unsubBlocked();
    };
  }, []);

  const showToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleCopy = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('লগ ও ব্লকড ডিভাইসের তালিকা রিফ্রেশ করা হয়েছে');
    }, 600);
  };

  // Block a device
  const handleConfirmBlock = async () => {
    if (!deviceToBlock) return;
    const deviceId = deviceToBlock.device.deviceId;
    
    await blockDevice({
      id: deviceId,
      deviceId: deviceId,
      ip: deviceToBlock.device.ip,
      browser: deviceToBlock.device.browser,
      os: deviceToBlock.device.os,
      deviceType: deviceToBlock.device.deviceType,
      reason: blockReason || 'Blocked by Admin',
      blockedAt: new Date().toISOString(),
      blockedBy: 'Store Admin',
    });

    setDeviceToBlock(null);
    setBlockReason('Suspicious login activity');
    showToast(`ডিভাইস ${deviceId.slice(-6)} সফলভাবে ব্লক করা হয়েছে`);
  };

  // Unblock a single device
  const handleUnblock = async (deviceId: string) => {
    if (window.confirm('আপনি কি এই ডিভাইসটি আনব্লক করতে চান? আনব্লক করলে ওয়েবসাইটটিতে পুনরায় প্রবেশ করতে পারবে।')) {
      await unblockDevice(deviceId);
      showToast(`ডিভাইস ${deviceId.slice(-6)} আনব্লক করা হয়েছে`);
    }
  };

  // Unblock all devices
  const handleUnblockAll = async () => {
    if (window.confirm('⚠️ সতর্কতা: আপনি কি সমস্ত ব্লক করা ডিভাইস আনব্লক করতে চান?')) {
      await unblockAllDevices();
      showToast('সবগুলো ডিভাইস সফলভাবে আনব্লক করা হয়েছে');
    }
  };

  // Clear all activity logs
  const handleClearLogs = async () => {
    if (window.confirm('⚠️ আপনি কি সমস্ত লগইন হিস্টোরি মুছে ফেলতে চান?')) {
      await clearAllLoginLogs();
      showToast('সমস্ত লগইন হিস্টোরি মুছে ফেলা হয়েছে');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) {
      alert('এক্সপোর্ট করার মতো কোনো লগ নেই');
      return;
    }

    const headers = ['Timestamp,Status,Email,Reason,Device ID,IP Address,Device Type,OS,Browser,City,Country'];
    const rows = logs.map((log) => {
      return [
        `"${log.timestamp}"`,
        `"${log.status}"`,
        `"${log.email}"`,
        `"${log.reason || ''}"`,
        `"${log.device.deviceId}"`,
        `"${log.device.ip || ''}"`,
        `"${log.device.deviceType}"`,
        `"${log.device.os}"`,
        `"${log.device.browser}"`,
        `"${log.device.city || ''}"`,
        `"${log.device.country || ''}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `security_login_logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to check if a device is blocked
  const isDeviceBlocked = (deviceId: string) => {
    return blockedDevices.some((b) => b.deviceId === deviceId || b.id === deviceId);
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Status filter
      if (statusFilter !== 'all' && log.status !== statusFilter) return false;

      // Device type filter
      if (deviceFilter !== 'all' && log.device.deviceType !== deviceFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const email = (log.email || '').toLowerCase();
        const devId = (log.device.deviceId || '').toLowerCase();
        const ip = (log.device.ip || '').toLowerCase();
        const os = (log.device.os || '').toLowerCase();
        const browser = (log.device.browser || '').toLowerCase();
        const city = (log.device.city || '').toLowerCase();
        const country = (log.device.country || '').toLowerCase();
        const reason = (log.reason || '').toLowerCase();

        return (
          email.includes(q) ||
          devId.includes(q) ||
          ip.includes(q) ||
          os.includes(q) ||
          browser.includes(q) ||
          city.includes(q) ||
          country.includes(q) ||
          reason.includes(q)
        );
      }

      return true;
    });
  }, [logs, statusFilter, deviceFilter, searchQuery]);

  // Key KPI Stats
  const totalAttempts = logs.length;
  const failedAttempts = logs.filter((l) => l.status === 'failed').length;
  const successLogins = logs.filter((l) => l.status === 'success').length;
  const blockedCount = blockedDevices.length;
  const failureRate = totalAttempts > 0 ? Math.round((failedAttempts / totalAttempts) * 100) : 0;

  // Formatted date helper
  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

      let timeAgo = '';
      if (diffSec < 60) timeAgo = 'এইমাত্র';
      else if (diffSec < 3600) timeAgo = `${Math.floor(diffSec / 60)} মি. আগে`;
      else if (diffSec < 86400) timeAgo = `${Math.floor(diffSec / 3600)} ঘণ্টা আগে`;
      else timeAgo = `${Math.floor(diffSec / 86400)} দিন আগে`;

      return {
        timeAgo,
        formatted: d.toLocaleDateString('bn-BD', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
    } catch {
      return { timeAgo: '', formatted: isoStr };
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'Mobile':
        return <Smartphone className="w-4 h-4 text-purple-600" />;
      case 'Tablet':
        return <Tablet className="w-4 h-4 text-blue-600" />;
      default:
        return <Monitor className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {actionNotice && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{actionNotice}</span>
        </div>
      )}

      {/* Top Header & Real-time Connectivity */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">লগইন ডিটেইলস ও সিকিউরিটি মনিটর</h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {isFirebaseConfigured ? 'Firebase Live Realtime' : 'Local Mode'}
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Vercel ও যেকোনো ডিভাইস থেকে রিয়েল-টাইমে কে কখন লগইনের চেষ্টা করল তা লাইভ ট্র্যাক করুন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            রিফ্রেশ
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV এক্সপোর্ট
          </button>

          {blockedCount > 0 && (
            <button
              type="button"
              onClick={handleUnblockAll}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5" />
              সব আনব্লক ({blockedCount})
            </button>
          )}

          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClearLogs}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              লগ ক্লিয়ার
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Attempts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">মোট লগইন চেষ্টা</span>
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalAttempts}</span>
            <span className="text-xs text-slate-400 font-medium">রেকর্ড</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            রিয়েল-টাইম সিঙ্ক হচ্ছে
          </div>
        </div>

        {/* Card 2: Failed Attempts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">ব্যর্থ লগইন চেষ্টা</span>
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600">{failedAttempts}</span>
            {totalAttempts > 0 && (
              <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                {failureRate}%
              </span>
            )}
          </div>
          <div className="mt-2 text-xs text-rose-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            ভুল পাসওয়ার্ড / সন্দেহজনক
          </div>
        </div>

        {/* Card 3: Success Logins */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">সফল লগইন</span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600">{successLogins}</span>
            <span className="text-xs text-slate-400 font-medium">টি</span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            অনুমোদিত অ্যাডমিন সেশন
          </div>
        </div>

        {/* Card 4: Blocked Devices */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">ব্লক করা ডিভাইস</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <UserX className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">{blockedCount}</span>
            <span className="text-xs text-slate-400 font-medium">টি</span>
          </div>
          <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
            <Ban className="w-3 h-3" />
            সাইট অ্যাক্সেস ব্লকড
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Radio className="w-4 h-4" />
          লাইভ লগইন হিস্টোরি ({filteredLogs.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('blocked')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'blocked'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Ban className="w-4 h-4" />
          ব্লকড ডিভাইস তালিকা ({blockedCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('insights')}
          className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'insights'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          সিকিউরিটি ইনসাইটস
        </button>
      </div>

      {/* TAB 1: ACTIVITY LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ডিভাইস আইডি, ইমেইল, আইপি, ব্রাউজার, ওএস বা শহর খুঁজুন..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                সব ({logs.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('failed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'failed'
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-rose-600 hover:bg-rose-50'
                }`}
              >
                ব্যর্থ ({failedAttempts})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('success')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  statusFilter === 'success'
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-emerald-600 hover:bg-emerald-50'
                }`}
              >
                সফল ({successLogins})
              </button>
            </div>

            {/* Device Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
              {(['all', 'Mobile', 'Desktop', 'Tablet'] as const).map((dtype) => (
                <button
                  key={dtype}
                  type="button"
                  onClick={() => setDeviceFilter(dtype)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    deviceFilter === dtype ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {dtype === 'all' ? 'সব ডিভাইস' : dtype}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Logs Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center">
                <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">কোনো লগ পাওয়া যায়নি</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {logs.length === 0
                    ? 'এখনও কোনো লগইন প্রচেষ্টা রেকর্ড হয়নি। যেকোনো ডিভাইস থেকে অ্যাডমিন লগইন করার চেষ্টা করলে সাথে সাথে এখানে লাইভ দেখতে পাবেন।'
                    : 'আপনার সার্চ বা ফিল্টারের সাথে ম্যাচ করে এমন কোনো লগ নেই।'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 text-xs uppercase font-bold tracking-wider">
                      <th className="py-3.5 px-4">সময়</th>
                      <th className="py-3.5 px-4">স্ট্যাটাস</th>
                      <th className="py-3.5 px-4">অ্যাকাউন্ট / ইমেইল</th>
                      <th className="py-3.5 px-4">ডিভাইস ও ব্রাউজার</th>
                      <th className="py-3.5 px-4">লোকেশন ও আইপি</th>
                      <th className="py-3.5 px-4">ডিভাইস আইডি</th>
                      <th className="py-3.5 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredLogs.map((log) => {
                      const { timeAgo, formatted } = formatDate(log.timestamp);
                      const isBlocked = isDeviceBlocked(log.device.deviceId);

                      return (
                        <tr
                          key={log.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            log.status === 'failed' ? 'bg-rose-50/30' : ''
                          }`}
                        >
                          {/* Time */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-900 text-xs">{timeAgo}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{formatted}</div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {log.status === 'success' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                সফল
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-bold">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                ব্যর্থ
                              </span>
                            )}
                          </td>

                          {/* Email & Reason */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-xs">{log.email}</div>
                            {log.reason && (
                              <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {log.reason}
                              </div>
                            )}
                          </td>

                          {/* Device & Browser */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              {getDeviceIcon(log.device.deviceType)}
                              <div>
                                <div className="text-xs font-semibold text-slate-800">
                                  {log.device.os} • {log.device.browser}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {log.device.deviceType}{' '}
                                  {log.device.screenResolution ? `(${log.device.screenResolution})` : ''}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Location & IP */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                              <Globe className="w-3.5 h-3.5 text-slate-400" />
                              {log.device.city || log.device.country ? (
                                <span>
                                  {log.device.city ? `${log.device.city}, ` : ''}
                                  {log.device.country}
                                </span>
                              ) : (
                                <span className="text-slate-400">অজানা লোকেশন</span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              IP: {log.device.ip || 'Unknown'}
                            </div>
                          </td>

                          {/* Device ID */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                {log.device.deviceId.length > 14
                                  ? `${log.device.deviceId.slice(0, 10)}...`
                                  : log.device.deviceId}
                              </span>
                              <button
                                type="button"
                                title="কপি করুন"
                                onClick={() => handleCopy(log.device.deviceId, log.id)}
                                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded transition-colors"
                              >
                                {copiedId === log.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {isBlocked ? (
                              <button
                                type="button"
                                onClick={() => handleUnblock(log.device.deviceId)}
                                className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <Unlock className="w-3.5 h-3.5" />
                                আনব্লক
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeviceToBlock(log)}
                                className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                ব্লক করুন
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BLOCKED DEVICES */}
      {activeTab === 'blocked' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">বর্তমানে ব্লক করা ডিভাইস ({blockedCount})</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                এই ডিভাইসগুলো ওয়েবসাইটে ঢুকলে ব্লকড স্ক্রিন দেখতে পাবে। আনব্লক করলে সাথে সাথে সাইট আবার চালু হবে।
              </p>
            </div>
            {blockedCount > 0 && (
              <button
                type="button"
                onClick={handleUnblockAll}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Unlock className="w-3.5 h-3.5" />
                একসাথে সব আনব্লক করুন
              </button>
            )}
          </div>

          {blockedDevices.length === 0 ? (
            <div className="py-16 text-center">
              <ShieldCheck className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">কোনো ডিভাইস ব্লক করা নেই</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                বর্তমানে কোনো ডিভাইস ব্লক তালিকায় নেই। যেকোনো ক্ষতিকর বা সন্দেহজনক ডিভাইসকে আপনি অ্যাক্টিভিটি লগ থেকে ১-ক্লিকে ব্লক করতে পারেন।
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">ডিভাইস আইডি</th>
                    <th className="py-3 px-4">ডিভাইস ইনফো</th>
                    <th className="py-3 px-4">আইপি অ্যাড্রেস</th>
                    <th className="py-3 px-4">ব্লকের কারণ</th>
                    <th className="py-3 px-4">ব্লক করার সময়</th>
                    <th className="py-3 px-4 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {blockedDevices.map((device) => {
                    const { formatted, timeAgo } = formatDate(device.blockedAt);
                    return (
                      <tr key={device.deviceId || device.id} className="hover:bg-slate-50">
                        {/* Device ID */}
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                            {device.deviceId || device.id}
                          </span>
                        </td>

                        {/* Device Info */}
                        <td className="py-3 px-4">
                          <div className="text-xs font-semibold text-slate-800">
                            {device.os || 'Unknown OS'} • {device.browser || 'Unknown Browser'}
                          </div>
                          <div className="text-[11px] text-slate-400">{device.deviceType || 'Mobile'}</div>
                        </td>

                        {/* IP */}
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-slate-600">{device.ip || 'Unknown'}</span>
                        </td>

                        {/* Reason */}
                        <td className="py-3 px-4">
                          <span className="text-xs font-medium text-slate-700">{device.reason || 'Blocked by admin'}</span>
                        </td>

                        {/* Blocked At */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="text-xs font-semibold text-slate-800">{timeAgo}</div>
                          <div className="text-[11px] text-slate-400">{formatted}</div>
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleUnblock(device.deviceId || device.id)}
                            className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            আনব্লক করুন
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INSIGHTS & ANALYTICS */}
      {activeTab === 'insights' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* OS Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Monitor className="w-4 h-4 text-indigo-600" />
              অপারেটিং সিস্টেম
            </h3>
            <div className="space-y-2">
              {['Android', 'Windows', 'iOS (iPhone)', 'macOS', 'Linux'].map((osName) => {
                const count = logs.filter((l) => l.device.os.includes(osName)).length;
                const pct = totalAttempts > 0 ? Math.round((count / totalAttempts) * 100) : 0;
                return (
                  <div key={osName} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium text-slate-600">
                      <span>{osName}</span>
                      <span>
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Device Type Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-600" />
              ডিভাইসের ধরন
            </h3>
            <div className="space-y-3">
              {(['Mobile', 'Desktop', 'Tablet'] as const).map((dtype) => {
                const count = logs.filter((l) => l.device.deviceType === dtype).length;
                const pct = totalAttempts > 0 ? Math.round((count / totalAttempts) * 100) : 0;
                return (
                  <div key={dtype} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {getDeviceIcon(dtype)}
                      <span className="text-xs font-bold text-slate-800">{dtype}</span>
                    </div>
                    <div className="text-xs font-extrabold text-slate-900">
                      {count} ({pct}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security Recommendations */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-600" />
              সিকিউরিটি গাইডলাইন
            </h3>
            <ul className="text-xs text-slate-600 space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                <span>অপরিচিত কোনো ডিভাইস থেকে বারবার ভুল চেষ্টা হলে সাথে সাথে তাকে ব্লক করুন।</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                <span>লগইন হিস্টোরি ডেটা স্বয়ংক্রিয়ভাবে ক্লাউডে সেভ থাকে এবং Vercel-এ লাইভ কাজ করে।</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                <span>কোনো পাসওয়ার্ড ডেটাবেজে সংরক্ষণ করা হয় না, যা ১০০% নিরাপদ।</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {deviceToBlock && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 mx-auto">
              <Ban className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 text-center">ডিভাইস ব্লক করতে চান?</h3>
            <p className="text-xs text-slate-500 text-center mt-1">
              ব্লক করার পর এই ডিভাইসটি আমাদের ওয়েবসাইটে প্রবেশ করতে পারবে না।
            </p>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-400">ডিভাইস আইডি:</span>
                <span className="font-mono font-bold">{deviceToBlock.device.deviceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">ওএস / ব্রাউজার:</span>
                <span className="font-semibold">
                  {deviceToBlock.device.os} • {deviceToBlock.device.browser}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">আইপি:</span>
                <span className="font-mono">{deviceToBlock.device.ip || 'Unknown'}</span>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">ব্লক করার কারণ</label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="যেমন: বারবার ভুল পাসওয়ার্ড দিয়ে চেষ্টা"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeviceToBlock(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-600/20 cursor-pointer"
              >
                হ্যাঁ, ব্লক করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
