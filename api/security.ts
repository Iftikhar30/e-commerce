import type { IncomingMessage, ServerResponse } from 'http';

const CLOUD_SYNC_PRIMARY_ID = 'ff808181a09d98f701a0c9519a746ec7';
const CLOUD_SYNC_URL = `https://api.restful-api.dev/objects/${CLOUD_SYNC_PRIMARY_ID}`;

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control'
  );
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
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
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const action = url.searchParams.get('action') || '';

  try {
    const cloudRes = await fetch(CLOUD_SYNC_URL);
    let cloudData = { logs: [] as any[], blocked: [] as any[] };
    if (cloudRes.ok) {
      const json = await cloudRes.json();
      if (json?.data) {
        cloudData = {
          logs: Array.isArray(json.data.logs) ? json.data.logs : [],
          blocked: Array.isArray(json.data.blocked) ? json.data.blocked : [],
        };
      }
    }

    if (req.method === 'GET') {
      if (action === 'logs' || url.pathname.includes('/logs')) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, logs: cloudData.logs }));
        return;
      }
      if (action === 'blocked' || url.pathname.includes('/blocked')) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, devices: cloudData.blocked }));
        return;
      }
      if (action === 'check-client' || url.pathname.includes('/check-client')) {
        const deviceId = url.searchParams.get('deviceId') || '';
        const matched = cloudData.blocked.find((b) => b && (b.deviceId === deviceId || b.id === deviceId));
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ isBlocked: !!matched, matchedRecord: matched || null }));
        return;
      }
    }

    if (req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (action === 'record-login' || url.pathname.includes('/record-login')) {
        if (body && body.email) {
          cloudData.logs.unshift(body);
          if (cloudData.logs.length > 250) cloudData.logs.pop();
          await fetch(CLOUD_SYNC_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'ecommerce_security_sync',
              data: cloudData,
            }),
          }).catch(() => {});
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, log: body }));
        return;
      }

      if (action === 'block' || url.pathname.includes('/block')) {
        if (body && (body.deviceId || body.ip || body.id)) {
          cloudData.blocked.unshift(body);
          await fetch(CLOUD_SYNC_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'ecommerce_security_sync',
              data: cloudData,
            }),
          }).catch(() => {});
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, device: body }));
        return;
      }

      if (action === 'unblock' || url.pathname.includes('/unblock')) {
        const target = body?.id || body?.deviceId || body?.ip;
        cloudData.blocked = cloudData.blocked.filter(
          (b) => b && b.id !== target && b.deviceId !== target && b.ip !== target
        );
        await fetch(CLOUD_SYNC_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'ecommerce_security_sync',
            data: cloudData,
          }),
        }).catch(() => {});
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
        return;
      }

      if (action === 'clear-logs' || url.pathname.includes('/clear-logs')) {
        cloudData.logs = [];
        await fetch(CLOUD_SYNC_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'ecommerce_security_sync',
            data: cloudData,
          }),
        }).catch(() => {});
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true, logs: [] }));
        return;
      }
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, status: 'ok' }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err?.message || 'Server error' }));
  }
}
