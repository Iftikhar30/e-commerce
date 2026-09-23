import type { IncomingMessage, ServerResponse } from 'http';
import {
  serverRecordLoginLog,
  serverCheckIsBlocked,
  serverBlockDevice,
  serverUnblockDevice,
  serverUnblockAllDevices,
  serverClearAllLoginLogs,
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
      const email = String(body.email || 'Admin').slice(0, 100).trim();
      const status = (['success', 'failed', 'blocked'].includes(body.status) ? body.status : 'failed') as
        | 'success'
        | 'failed'
        | 'blocked';

      const logId = String(body.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
      const reason = String(body.reason || (status === 'failed' ? 'Wrong password' : 'Login event')).slice(0, 250);

      // Sanitize device object, strictly avoid raw passwords or tokens
      const incomingDevice = body.device || {};
      const rawDevice: Record<string, unknown> = {
        deviceId: String(incomingDevice.deviceId || `dev_${Date.now()}`).slice(0, 100),
        ip: clientIp || incomingDevice.ip || 'Unknown IP',
        browser: String(incomingDevice.browser || 'Browser').slice(0, 60),
        os: String(incomingDevice.os || 'OS').slice(0, 60),
        deviceType: ['Desktop', 'Mobile', 'Tablet'].includes(incomingDevice.deviceType)
          ? incomingDevice.deviceType
          : 'Desktop',
        userAgent: userAgent || incomingDevice.userAgent || '',
      };

      if (incomingDevice.deviceHash) rawDevice.deviceHash = String(incomingDevice.deviceHash).slice(0, 64);
      if (incomingDevice.city) rawDevice.city = String(incomingDevice.city).slice(0, 60);
      if (incomingDevice.country) rawDevice.country = String(incomingDevice.country).slice(0, 60);
      if (incomingDevice.screenResolution) rawDevice.screenResolution = String(incomingDevice.screenResolution).slice(0, 30);

      const sanitizedLog = {
        id: logId,
        email,
        status,
        reason,
        device: rawDevice,
        timestamp: new Date().toISOString(),
      };

      await serverRecordLoginLog(sanitizedLog);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, log: sanitizedLog }));
      return;
    }

    // 3. Admin: Block a device
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
