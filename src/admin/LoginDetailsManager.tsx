import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Laptop,
  Tablet,
  Globe,
  Clock,
  Ban,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Trash2,
  AlertTriangle,
  RefreshCw,
  User,
  KeyRound,
  Lock,
  Unlock,
  Info,
} from 'lucide-react';
import { LoginLog, BlockedDevice, DeviceInfo } from '../types';
import {
  subscribeToLoginLogs,
  subscribeToBlockedDevices,
  blockDevice,
  unblockDevice,
  getLocalLoginLogs,
  saveLocalLoginLogs,
  clearAllLoginLogs,
} from '../lib/securityService';
import { getCurrentDeviceInfo } from '../lib/deviceFingerprint';
import { buildApiUrl } from '../lib/apiConfig';
import { fetchCloudSecurityState } from '../lib/cloudSyncRelay';

export const LoginDetailsManager: React.FC = () => {
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [blockedDevices, setBlockedDevices] = useState<BlockedDevice[]>([]);
  const [currentDevice, setCurrentDevice] = useState<DeviceInfo | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'failed' | 'success' | 'blocked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal for blocking a device with custom reason
  const [blockingTarget, setBlockingTarget] = useState<LoginLog | null>(null);
  const [blockReason, setBlockReason] = useState('Suspicious login attempts / ভুল পাসওয়ার্ড বারবার প্রবেশ');
  const [isBlockingModalOpen, setIsBlockingModalOpen] = useState(false);

  // Manual IP/Device ID block modal
  const [isManualBlockModalOpen, setIsManualBlockModalOpen] = useState(false);
  const [manualIdentifier, setManualIdentifier] = useState('');
  const [manualReason, setManualReason] = useState('Admin manual blocklist');

  // Load current device info
  useEffect(() => {
    getCurrentDeviceInfo().then((dev) => setCurrentDevice(dev));
  }, []);

  // Subscribe to real-time logs & blocked devices
  useEffect(() => {
    setLoading(true);
    const unsubLogs = subscribeToLoginLogs((newLogs) => {
      setLogs(newLogs);
      setLoading(false);
    });

    const unsubBlocked = subscribeToBlockedDevices((newBlocked) => {
      setBlockedDevices(newBlocked);
    });

    return () => {
      unsubLogs();
      unsubBlocked();
    };
  }, []);

  // Check if a specific device ID or IP is currently blocked
  const isDeviceBlocked = (deviceId?: string, ip?: string): boolean => {
    if (!deviceId && !ip) return false;
    return blockedDevices.some(
      (b) =>
        (deviceId && b.deviceId === deviceId) ||
        (ip && ip !== 'Unknown IP' && b.ip === ip) ||
        (b.id === deviceId || b.id === ip)
    );
  };

  // Metrics
  const totalAttempts = logs.length;
  const failedAttempts = logs.filter((l) => l.status === 'failed').length;
  const successfulLogins = logs.filter((l) => l.status === 'success').length;
  const blockedCount = blockedDevices.length;

  // Filter & Search
  const filteredLogs = useMemo(() => {
    let result = [...logs];

    if (selectedFilter === 'failed') {
      result = result.filter((l) => l.status === 'failed');
    } else if (selectedFilter === 'success') {
      result = result.filter((l) => l.status === 'success');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (l) =>
          l.email.toLowerCase().includes(q) ||
          l.device.browser.toLowerCase().includes(q) ||
          l.device.os.toLowerCase().includes(q) ||
          (l.device.ip && l.device.ip.toLowerCase().includes(q)) ||
          l.device.deviceId.toLowerCase().includes(q) ||
          (l.reason && l.reason.toLowerCase().includes(q))
      );
    }

    return result;
  }, [logs, selectedFilter, searchQuery]);

  // Handle manual refresh across cloud relay & server
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const [cloudData, serverLogs] = await Promise.allSettled([
        fetchCloudSecurityState(),
        (async () => {
          const apiUrl = buildApiUrl('/api/security/logs');
          const res = await fetch(apiUrl);
          if (res.ok) {
            const data = await res.json();
            return Array.isArray(data.logs) ? data.logs : [];
          }
          return [];
        })(),
      ]);

      const cloudList = cloudData.status === 'fulfilled' && Array.isArray(cloudData.value.logs) ? cloudData.value.logs : [];
      const srvList = serverLogs.status === 'fulfilled' && Array.isArray(serverLogs.value) ? serverLogs.value : [];

      const combinedMap = new Map<string, LoginLog>();
      cloudList.forEach((l) => l && l.id && !l.id.includes('sample') && combinedMap.set(l.id, l));
      srvList.forEach((l) => l && l.id && !l.id.includes('sample') && combinedMap.set(l.id, l));
      const local = getLocalLoginLogs();
      local.forEach((l) => {
        if (!combinedMap.has(l.id)) {
          combinedMap.set(l.id, l);
        }
      });

      const sorted = Array.from(combinedMap.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setLogs(sorted);
      saveLocalLoginLogs(sorted);
    } catch {
      // ignore
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Handle blocking confirmation
  const handleConfirmBlock = async () => {
    if (!blockingTarget) return;

    const deviceToBlock: BlockedDevice = {
      id: blockingTarget.device.deviceId,
      deviceId: blockingTarget.device.deviceId,
      ip: blockingTarget.device.ip,
      browser: blockingTarget.device.browser,
      os: blockingTarget.device.os,
      deviceType: blockingTarget.device.deviceType,
      reason: blockReason.trim() || 'Blocked by Admin',
      blockedAt: new Date().toISOString(),
      blockedBy: 'Administrator',
    };

    await blockDevice(deviceToBlock);
    setIsBlockingModalOpen(false);
    setBlockingTarget(null);
  };

  // Handle manual block
  const handleConfirmManualBlock = async () => {
    if (!manualIdentifier.trim()) return;

    const cleanId = manualIdentifier.trim();
    const isIp = cleanId.includes('.') || cleanId.includes(':');

    const deviceToBlock: BlockedDevice = {
      id: cleanId,
      deviceId: isIp ? `ip_${cleanId}` : cleanId,
      ip: isIp ? cleanId : undefined,
      browser: 'Manual entry',
      os: 'Manual entry',
      deviceType: 'Unknown',
      reason: manualReason.trim() || 'Manual Admin block',
      blockedAt: new Date().toISOString(),
      blockedBy: 'Administrator',
    };

    await blockDevice(deviceToBlock);
    setManualIdentifier('');
    setIsManualBlockModalOpen(false);
  };

  // Handle unblock
  const handleUnblock = async (deviceIdOrIp: string) => {
    if (confirm('আপনি কি এই ডিভাইসটি আনব্লক করতে চান? আনব্লক করলে ওয়েবসাইটটিতে পুনরায় প্রবেশ করতে পারবে।')) {
      await unblockDevice(deviceIdOrIp);
    }
  };

  // Clear all logs
  const handleClearLogs = async () => {
    if (confirm('আপনি কি সকল লগইন হিস্টোরি ক্লিয়ার করতে চান?')) {
      await clearAllLoginLogs();
      setLogs([]);
    }
  };

  // Device icon helper
  const renderDeviceIcon = (deviceType?: string) => {
    if (deviceType === 'Mobile') return <Smartphone size={15} className="text-amber-600" />;
    if (deviceType === 'Tablet') return <Tablet size={15} className="text-purple-600" />;
    return <Laptop size={15} className="text-blue-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <ShieldCheck size={18} />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight">
              Login Details & Device Security (লগইন ও ডিভাইস নিরাপত্তা)
            </h2>
          </div>
          <p className="text-xs text-neutral-500">
            কে কোন ডিভাইস ও ব্রাউজার থেকে লগইন করেছে তা পর্যবেক্ষণ করুন, ভুল পাসওয়ার্ডের চেষ্টা ট্র্যাক করুন এবং সন্দেহজনক ডিভাইস সরাসরি ওয়েবসাইট থেকে ব্লক করুন।
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title="লগইন তথ্য রিফ্রেশ করুন"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-amber-600' : ''} />
            <span>{isRefreshing ? 'রিফ্রেশ হচ্ছে...' : 'রিফ্রেশ'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsManualBlockModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Ban size={14} />
            <span>ম্যানুয়াল ডিভাইস ব্লক</span>
          </button>

          {logs.length > 0 && (
            <button
              type="button"
              onClick={handleClearLogs}
              title="সকল লগ হিস্টোরি মুছে ফেলুন"
              className="p-2 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Attempts */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-500">মোট লগইন প্রচেষ্টা</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <KeyRound size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-neutral-900">{totalAttempts}</div>
          <div className="text-[11px] text-neutral-400 mt-1">সর্বমোট রেকর্ডকৃত সেশন</div>
        </div>

        {/* Successful Logins */}
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-700">সফল লগইন</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600">{successfulLogins}</div>
          <div className="text-[11px] text-neutral-400 mt-1">বৈধ অ্যাডমিন সেশন</div>
        </div>

        {/* Failed / Wrong Password */}
        <div className="bg-white p-4 rounded-2xl border border-rose-100 bg-rose-50/20 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-rose-700">ভুল পাসওয়ার্ড / ব্যর্থ চেষ্টা</span>
            <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <XCircle size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600">{failedAttempts}</div>
          <div className="text-[11px] text-rose-500/80 mt-1">অবৈধ বা ভুল তথ্য দিয়ে চেষ্টা</div>
        </div>

        {/* Blocked Devices */}
        <div className="bg-white p-4 rounded-2xl border border-purple-100 bg-purple-50/20 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-purple-700">ব্লক করা ডিভাইস</span>
            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
              <Ban size={14} />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-700">{blockedCount}</div>
          <div className="text-[11px] text-purple-600/80 mt-1">ওয়েবসাইটে প্রবেশ নিষিদ্ধ</div>
        </div>
      </div>

      {/* Target Site Enforcement Banner */}
      <div className="p-3.5 bg-neutral-900 text-neutral-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Globe size={16} className="text-amber-400 shrink-0" />
          <span>
            <strong>সুরক্ষা ডোমেইন:</strong>{' '}
            <code className="text-amber-300 font-mono">https://e-commerce-six-sage-15.vercel.app</code>
            {' '}— কোনো ডিভাইস ব্লক করা হলে ঐ ডিভাইস থেকে আপনার এই ওয়েবসাইটের কোনো পেজই চলবে না।
          </span>
        </div>
        {currentDevice && (
          <span className="hidden md:inline-block text-[11px] text-neutral-400 font-mono bg-neutral-800 px-2 py-0.5 rounded">
            বর্তমান ডিভাইস: {currentDevice.browser} ({currentDevice.os})
          </span>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-neutral-200/90 shadow-2xs">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            সকল হিস্টোরি ({totalAttempts})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('failed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer ${
              selectedFilter === 'failed'
                ? 'bg-rose-600 text-white'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <XCircle size={13} />
            <span>ভুল পাসওয়ার্ড / ব্যর্থ ({failedAttempts})</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('success')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer ${
              selectedFilter === 'success'
                ? 'bg-emerald-600 text-white'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 size={13} />
            <span>সফল লগইন ({successfulLogins})</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('blocked')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer ${
              selectedFilter === 'blocked'
                ? 'bg-purple-700 text-white'
                : 'text-purple-700 hover:bg-purple-50'
            }`}
          >
            <Ban size={13} />
            <span>ব্লকলিস্ট ডিভাইস ({blockedCount})</span>
          </button>
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-400">
            <Search size={14} />
          </div>
          <input
            type="text"
            value={searchQuery ?? ''}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ইমেইল, IP, ব্রাউজার খুঁজুন..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-amber-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Main Content: Either Blocked Devices List or Logs Table */}
      {selectedFilter === 'blocked' ? (
        // Blocked Devices Management View
        <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ban size={16} className="text-rose-600" />
              <h3 className="text-xs font-bold text-neutral-900">
                বর্তমানে ব্লক থাকা ডিভাইস তালিকা (Blocked Devices)
              </h3>
            </div>
            <span className="text-[11px] text-neutral-500 font-medium">
              মোট ব্লক: {blockedDevices.length} টি
            </span>
          </div>

          {blockedDevices.length === 0 ? (
            <div className="text-center py-12 px-4 text-xs text-neutral-500 space-y-2">
              <ShieldCheck size={32} className="mx-auto text-emerald-500 mb-2 opacity-80" />
              <p className="font-semibold text-neutral-700">বর্তমানে কোনো ডিভাইস ব্লক করা নেই।</p>
              <p className="text-[11px] text-neutral-400">
                লগইন হিস্টোরি টেবিল থেকে যেকোনো সন্দেহজনক ডিভাইসকে এক ক্লিকে ব্লক করতে পারবেন।
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {blockedDevices.map((b) => (
                <div
                  key={b.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/80 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Ban size={12} /> BLOCKED
                      </span>
                      <span className="text-xs font-mono font-bold text-neutral-900">
                        {b.ip || b.deviceId}
                      </span>
                      {b.browser && (
                        <span className="text-[11px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                          {b.browser} • {b.os}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-neutral-500 flex items-center gap-3 flex-wrap">
                      <span>ব্লকের কারণ: <strong className="text-neutral-700">{b.reason || 'Not specified'}</strong></span>
                      <span>•</span>
                      <span>
                        তারিখ:{' '}
                        {new Date(b.blockedAt).toLocaleString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnblock(b.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <Unlock size={13} />
                    <span>আনব্লক করুন (Unblock)</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Login Logs Table View
        <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200/80 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                  <th className="py-3 px-4">স্ট্যাটাস (Status)</th>
                  <th className="py-3 px-4">ইমেইল (Email)</th>
                  <th className="py-3 px-4">ডিভাইস ও ব্রাউজার</th>
                  <th className="py-3 px-4">IP অ্যাড্রেস ও লোকেশন</th>
                  <th className="py-3 px-4">সময় (Time)</th>
                  <th className="py-3 px-4 text-right">ডিভাইস অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                      কোনো লগইন রেকর্ড পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const isSuccess = log.status === 'success';
                    const blocked = isDeviceBlocked(log.device.deviceId, log.device.ip);
                    const isThisCurrentDevice =
                      currentDevice &&
                      (currentDevice.deviceId === log.device.deviceId ||
                        (currentDevice.ip && log.device.ip && currentDevice.ip === log.device.ip));

                    return (
                      <tr
                        key={log.id}
                        className={`hover:bg-neutral-50/80 transition-colors ${
                          !isSuccess ? 'bg-rose-50/20' : ''
                        }`}
                      >
                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isSuccess ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 size={13} className="text-emerald-600" />
                              <span>সফল লগইন</span>
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <XCircle size={13} className="text-rose-600" />
                                <span>ভুল পাসওয়ার্ড / ব্যর্থ</span>
                              </span>
                              {log.reason && (
                                <div className="text-[10px] text-rose-600 font-medium max-w-xs truncate" title={log.reason}>
                                  {log.reason}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
                            <User size={13} className="text-neutral-400" />
                            <span>{log.email || 'Unknown'}</span>
                          </div>
                        </td>

                        {/* Device & Browser */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-bold text-neutral-800">
                              {renderDeviceIcon(log.device.deviceType)}
                              <span>{log.device.browser}</span>
                              <span className="text-[10px] font-normal text-neutral-500">
                                ({log.device.os})
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-neutral-400 truncate max-w-xs">
                              ID: {log.device.deviceId.substring(0, 16)}...
                              {isThisCurrentDevice && (
                                <span className="ml-1 text-amber-700 font-sans font-bold bg-amber-100 px-1.5 py-0.2 rounded text-[9.5px]">
                                  আপনার বর্তমান ডিভাইস
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* IP & Location */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div className="font-mono text-neutral-700 text-xs font-semibold">
                              {log.device.ip || 'Unknown'}
                            </div>
                            {(log.device.city || log.device.country) && (
                              <div className="text-[10.5px] text-neutral-500 flex items-center gap-1">
                                <Globe size={11} className="text-neutral-400" />
                                <span>
                                  {[log.device.city, log.device.country].filter(Boolean).join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Timestamp */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-neutral-500 text-[11px]">
                          <div className="flex items-center gap-1 text-neutral-700 font-medium">
                            <Clock size={12} className="text-neutral-400" />
                            <span>
                              {new Date(log.timestamp).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="text-[10.5px] text-neutral-400">
                            {new Date(log.timestamp).toLocaleDateString('en-US', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </td>

                        {/* Action: Block/Unblock */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-right">
                          {blocked ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="text-[10.5px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                                ব্লকড
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUnblock(log.device.deviceId)}
                                className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                              >
                                আনব্লক
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setBlockingTarget(log);
                                setIsBlockingModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <Ban size={12} />
                              <span>ডিভাইস ব্লক করুন</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Confirm Block Device */}
      {isBlockingModalOpen && blockingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-neutral-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0">
                <Ban size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  ডিভাইস ব্লক নিশ্চিতকরণ
                </h3>
                <p className="text-xs text-neutral-500">
                  এই ডিভাইসটিকে সম্পূর্ণ ওয়েবসাইটে প্রবেশ করা থেকে ব্লক করা হবে।
                </p>
              </div>
            </div>

            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs space-y-1.5 font-mono">
              <div>
                <span className="text-neutral-500 font-sans">ডিভাইস ID: </span>
                <span className="text-neutral-900 font-bold">{blockingTarget.device.deviceId}</span>
              </div>
              <div>
                <span className="text-neutral-500 font-sans">IP অ্যাড্রেস: </span>
                <span className="text-neutral-900 font-bold">{blockingTarget.device.ip || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-neutral-500 font-sans">ব্রাউজার/OS: </span>
                <span className="text-neutral-800 font-sans">
                  {blockingTarget.device.browser} ({blockingTarget.device.os})
                </span>
              </div>
            </div>

            {currentDevice?.deviceId === blockingTarget.device.deviceId && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                <span>
                  <strong>সতর্কতা:</strong> এটি আপনার নিজের বর্তমান ডিভাইস! ব্লক করলে আপনার নিজের ব্রাউজার থেকেও ওয়েবসাইটটি অবিলম্বে লক হয়ে যাবে।
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                ব্লক করার কারণ (Reason):
              </label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="যেমন: ভুল পাসওয়ার্ড দিয়ে বারবার অনুপ্রবেশ চেষ্টা"
                className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => {
                  setIsBlockingModalOpen(false);
                  setBlockingTarget(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                হ্যাঁ, ডিভাইস ব্লক করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Manual IP or Device ID Block */}
      {isManualBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-neutral-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  ম্যানুয়ালি IP বা ডিভাইস ID ব্লক করুন
                </h3>
                <p className="text-xs text-neutral-500">
                  যেকোনো নির্দিষ্ট IP অ্যাড্রেস বা ডিভাইস আইডেন্টিফায়ার ব্লকলিস্টে যোগ করুন।
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  IP অ্যাড্রেস অথবা Device ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualIdentifier ?? ''}
                  onChange={(e) => setManualIdentifier(e.target.value)}
                  placeholder="যেমন: 103.145.22.10 অথবা dev_abc123"
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-purple-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  কারণ (Reason):
                </label>
                <input
                  type="text"
                  value={manualReason ?? ''}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="যেমন: স্প্যাম বা ক্ষতিকর ট্রাফিক"
                  className="w-full px-3 py-2 text-xs bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 focus:bg-white focus:border-purple-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setIsManualBlockModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={!manualIdentifier.trim()}
                onClick={handleConfirmManualBlock}
                className="px-4 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                ব্লকলিস্টে যুক্ত করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
