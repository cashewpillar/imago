#!/usr/bin/env node
/* imago sync relay — a tiny always-on LAN process that pairs two browsers by a
   shared code and shuttles their WebRTC handshake messages back and forth.
   No actual app data (notes, records, etc.) ever passes through this process —
   once two devices are paired, they talk directly over an encrypted WebRTC
   data channel. This only exists to introduce them to each other.

   Pure Node built-ins, no npm install required. Run with:
     node scripts/sync-relay.js [port]
   Default port: 8791. */

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.argv[2]) || Number(process.env.SYNC_RELAY_PORT) || 8791;
const ROOM_TTL_MS = 10 * 60 * 1000;       // unpaired/idle room expiry
const POLL_TIMEOUT_MS = 25 * 1000;        // long-poll wait before empty reply

/** @type {Map<string, { devices: Map<string, Device>, createdAt: number }>} */
const rooms = new Map();

function makeDevice() {
  return { queue: [], waiter: null, lastSeen: Date.now() };
}

function getRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = { devices: new Map(), createdAt: Date.now() };
    rooms.set(code, room);
  }
  return room;
}

function pushMessage(device, msg) {
  device.queue.push(msg);
  if (device.waiter) {
    const { resolve } = device.waiter;
    device.waiter = null;
    resolve();
  }
}

function broadcastToRoom(room, exceptDeviceId, msg) {
  for (const [id, device] of room.devices) {
    if (id !== exceptDeviceId) pushMessage(device, msg);
  }
}

function sweepRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    for (const [id, device] of room.devices) {
      if (now - device.lastSeen > ROOM_TTL_MS) room.devices.delete(id);
    }
    if (room.devices.size === 0 && now - room.createdAt > ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }
}
setInterval(sweepRooms, 60 * 1000).unref();

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1e6) req.destroy(new Error('Body too large'));
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

function isValidCode(code) {
  return typeof code === 'string' && /^[A-Za-z0-9-]{4,64}$/.test(code);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const url = new URL(req.url, 'http://localhost');

  try {
    if (req.method === 'POST' && url.pathname === '/join') {
      const { code } = await readJsonBody(req);
      if (!isValidCode(code)) return send(res, 400, { error: 'invalid code' });
      const room = getRoom(code);
      if (room.devices.size >= 2) return send(res, 409, { error: 'room full — only two devices can pair on one code' });
      const deviceId = crypto.randomUUID();
      const peers = [...room.devices.keys()];
      room.devices.set(deviceId, makeDevice());
      broadcastToRoom(room, deviceId, { type: 'peer-joined', deviceId });
      return send(res, 200, { deviceId, peers });
    }

    if (req.method === 'POST' && url.pathname === '/send') {
      const { code, deviceId, to, payload } = await readJsonBody(req);
      if (!isValidCode(code)) return send(res, 400, { error: 'invalid code' });
      const room = rooms.get(code);
      const from = room && room.devices.get(deviceId);
      if (!room || !from) return send(res, 404, { error: 'unknown room or device' });
      from.lastSeen = Date.now();
      const msg = { type: 'relay', from: deviceId, payload };
      if (to) {
        const target = room.devices.get(to);
        if (!target) return send(res, 404, { error: 'unknown target device' });
        pushMessage(target, msg);
      } else {
        broadcastToRoom(room, deviceId, msg);
      }
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/poll') {
      const code = url.searchParams.get('code');
      const deviceId = url.searchParams.get('deviceId');
      if (!isValidCode(code)) return send(res, 400, { error: 'invalid code' });
      const room = rooms.get(code);
      const device = room && room.devices.get(deviceId);
      if (!room || !device) return send(res, 404, { error: 'unknown room or device' });
      device.lastSeen = Date.now();

      if (device.queue.length) {
        const msgs = device.queue.splice(0);
        return send(res, 200, { messages: msgs });
      }

      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        device.waiter = null;
        send(res, 200, { messages: [] });
      }, POLL_TIMEOUT_MS);

      device.waiter = {
        resolve: () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          send(res, 200, { messages: device.queue.splice(0) });
        },
      };

      req.on('close', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        device.waiter = null;
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, rooms: rooms.size });
    }

    send(res, 404, { error: 'not found' });
  } catch (err) {
    send(res, 500, { error: err.message || 'internal error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`imago sync relay listening on 0.0.0.0:${PORT}`);
});
