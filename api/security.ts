import type { IncomingMessage, ServerResponse } from 'http';
import {
  serverRecordLoginLog,
  serverCheckIsBlocked,
  serverBlockDevice,
  serverUnblockDevice,
  serverUnblockAllDevices,
  serverClearAllLoginLogs,
  serverVerifyAdminToken,
} from '../src/lib/serverFirebase';

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control'
  );
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  if ((req as any).body && typeof (req as any).body === 'object') {
    return Promise.resolve((req as any).body);
  }
  if ((req as any).readableEnded || (req as any).complete) {
    return Promise.resolve((req as any).body || {});
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      resolve({});
    });
  });
}

function getRequestClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp) return realIp.trim();

  const socketIp = req.socket.remoteAddress || '127.0.0.1';
  return socketIp.replace(/^::ffff:/, '');
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const clientIp = getRequestClientIp(req);
  const userAgent = String(req.headers['user-agent'] || '');
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const action = url.searchParams.get('action') || '';

  try {
    // 1. Check client access
    if (req.method === 'GET' && (action === 'check-access' || url.pathname.includes('/check-access') || action === 'check-client')) {
      const deviceId = url.searchParams.get('deviceId') || '';
      const deviceHash = url.searchParams.get('deviceHash') || '';

      const checkResult = await serverCheckIsBlocked(deviceId, clientIp, deviceHash);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          isBlocked: checkResult.isBlocked,
          matchedRecord: checkResult.matchedRecord,
          clientIp,
        })
      );
      return;
    }

    // 2. Record login attempt (POST)
    if (req.method === 'POST' && (action === 'record-attempt' || url.pathname.includes('/record-attempt') || action === 'record-login')) {
      const body = await parseJsonBody(req);
      const email = String(body.email || 'Admin').toLowerCase().slice(0, 100).trim();
      const status = (['success', 'failed', 'blocked'].includes(body.status) ? body.status : 'failed') as
        | 'success'
        | 'failed'
        | 'blocked';

      const logId = String(body.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

      // Sanitize errorCode (strictly alphanumeric, slashes, dashes e.g. auth/invalid-credential)
      let sanitizedErrorCode: string | undefined;
      if (body.errorCode && typeof body.errorCode === 'string') {
        const cleaned = body.errorCode.trim().toLowerCase();
        if (/^auth\/[a-z0-9\-_]{3,40}$/.test(cleaned)) {
          sanitizedErrorCode = cleaned;
        } else {
          sanitizedErrorCode = 'auth/invalid-credential';
        }
      }

      // Build readable reason
      let reason = String(body.reason || '').slice(0, 250);
      if (!reason) {
        if (status === 'failed') {
          reason = sanitizedErrorCode
            ? `Authentication failed (${sanitizedErrorCode})`
            : 'Invalid credentials / ভুল পাসওয়ার্ড';
        } else if (status === 'blocked') {
          reason = 'Access restricted - blocked device';
        } else {
          reason = 'Admin session established';
        }
      }

      // Support both body.device and body.deviceInfo
      const incomingDevice = (body.deviceInfo || body.device || {}) as Record<string, unknown>;
      const targetDeviceId = String(body.deviceId || incomingDevice.deviceId || `dev_${Date.now()}`).slice(0, 100);

      const rawPlatform = String(incomingDevice.platform || incomingDevice.os || '').slice(0, 60);
      const rawScreen = String(incomingDevice.screen || incomingDevice.screenResolution || '').slice(0, 30);
      const rawCanvas = String(incomingDevice.canvasHash || incomingDevice.deviceHash || '').slice(0, 64);
      const rawUserAgent = String(userAgent || incomingDevice.userAgent || req.headers['user-agent'] || '').slice(0, 300);

      const rawDevice: Record<string, unknown> = {
        deviceId: targetDeviceId,
        ip: clientIp || incomingDevice.ip || 'Unknown IP',
        browser: String(incomingDevice.browser || 'Browser').slice(0, 60),
        os: String(incomingDevice.os || 'OS').slice(0, 60),
        platform: rawPlatform || undefined,
        screen: rawScreen || undefined,
        canvasHash: rawCanvas || undefined,
        deviceType: ['Desktop', 'Mobile', 'Tablet'].includes(incomingDevice.deviceType as string)
          ? incomingDevice.deviceType
          : 'Desktop',
        userAgent: rawUserAgent,
      };

      if (incomingDevice.deviceHash) rawDevice.deviceHash = String(incomingDevice.deviceHash).slice(0, 64);
      if (incomingDevice.city) rawDevice.city = String(incomingDevice.city).slice(0, 60);
      if (incomingDevice.country) rawDevice.country = String(incomingDevice.country).slice(0, 60);
      if (incomingDevice.screenResolution) rawDevice.screenResolution = String(incomingDevice.screenResolution).slice(0, 30);

      // Construct sanitized log payload without any passwords
      const sanitizedLog: Record<string, unknown> = {
        id: logId,
        email,
        status,
        reason,
        deviceId: targetDeviceId,
        ip: clientIp,
        userAgent: rawUserAgent,
        platform: rawPlatform || undefined,
        screen: rawScreen || undefined,
        canvasHash: rawCanvas || undefined,
        errorCode: sanitizedErrorCode || undefined,
        device: rawDevice,
        timestamp: new Date().toISOString(),
      };

      // Guaranteed security check: ensure no password fields can ever exist
      delete sanitizedLog.password;
      delete sanitizedLog.plainPassword;
      delete sanitizedLog.enteredPassword;
      delete sanitizedLog.wrongPassword;
      delete sanitizedLog.passwordAttempt;

      await serverRecordLoginLog(sanitizedLog);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, log: sanitizedLog }));
      return;
    }

    // 3. Admin Authorization Guard for destructive/admin actions
    const isAdminAction = ['block', 'unblock', 'unblock-all', 'clear-logs'].includes(action);
    if (isAdminAction) {
      const authHeader = req.headers['authorization'] || '';
      const bearerToken = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const isAuthorized = await serverVerifyAdminToken(bearerToken);
      if (!isAuthorized) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Unauthorized. Admin credentials required in /admins.' }));
        return;
      }
    }

    // 4. Admin: Block a device
    if (req.method === 'POST' && (action === 'block' || url.pathname.includes('/block'))) {
      const body = await parseJsonBody(req);
      const deviceId = String(body.deviceId || body.id || '').trim();
      if (!deviceId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing deviceId' }));
        return;
      }

      const blockRecord: Record<string, unknown> = {
        id: deviceId,
        deviceId,
        ip: body.ip || clientIp,
        browser: body.browser || '',
        os: body.os || '',
        deviceType: body.deviceType || 'Mobile',
        reason: String(body.reason || 'Blocked by administrator').slice(0, 250),
        blockedAt: body.blockedAt || new Date().toISOString(),
        blockedBy: String(body.blockedBy || 'admin').slice(0, 100),
      };
      if (body.deviceHash) blockRecord.deviceHash = String(body.deviceHash).slice(0, 64);

      await serverBlockDevice(blockRecord);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, device: blockRecord }));
      return;
    }

    // 4. Admin: Unblock device
    if (req.method === 'POST' && (action === 'unblock' || url.pathname.includes('/unblock'))) {
      const body = await parseJsonBody(req);
      const targetId = String(body.deviceId || body.id || '').trim();
      if (targetId) {
        await serverUnblockDevice(targetId);
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // 5. Admin: Unblock all devices
    if (req.method === 'POST' && (action === 'unblock-all' || url.pathname.includes('/unblock-all'))) {
      await serverUnblockAllDevices();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // 6. Admin: Clear all logs
    if (req.method === 'POST' && (action === 'clear-logs' || url.pathname.includes('/clear-logs'))) {
      await serverClearAllLoginLogs();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true }));
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, status: 'operational', clientIp }));
  } catch (err: unknown) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal Server Error' }));
  }
}
