/* imago sync-client — pair two browsers on the same LAN via a shared code,
   then merge Dexie tables between them over a direct, encrypted WebRTC data
   channel. The relay (scripts/sync-relay.js) only ever sees connection
   handshake messages, never your actual data.

   Usage from any page that has a Dexie `db`:
     ImagoSync.openSyncModal({
       relayUrl: 'http://<laptop-lan-ip>:8791',
       db, tables: ['records', 'tableDefs'],
     });

   Merge rule: per row (matched by primary key), whichever side has the
   greater `updatedAt` (falling back to `createdAt`, then 0) wins. Rows that
   only exist on one side are added to the other. */
(function () {
  const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
  const POLL_IDLE_DELAY_MS = 400;

  function randomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async function joinRoom(relayUrl, code) {
    const res = await fetch(`${relayUrl}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'join failed');
    return res.json();
  }

  async function sendSignal(relayUrl, code, deviceId, to, payload) {
    await fetch(`${relayUrl}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, deviceId, to, payload }),
    });
  }

  function pairSession({ relayUrl, code, onStatus }) {
    let stopped = false;
    let deviceId = null;
    let peerId = null;
    let pc = null;
    let channel = null;

    async function pollLoop() {
      while (!stopped) {
        let res;
        try {
          res = await fetch(`${relayUrl}/poll?code=${encodeURIComponent(code)}&deviceId=${encodeURIComponent(deviceId)}`);
        } catch (e) {
          onStatus('error', 'Lost contact with relay — is it running?');
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        if (!res.ok) { await new Promise(r => setTimeout(r, POLL_IDLE_DELAY_MS)); continue; }
        const { messages } = await res.json();
        for (const msg of messages || []) await handleMessage(msg);
      }
    }

    function ensurePeerConnection() {
      if (pc) return pc;
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onicecandidate = (e) => {
        if (e.candidate) sendSignal(relayUrl, code, deviceId, peerId, { kind: 'ice', candidate: e.candidate });
      };
      pc.ondatachannel = (e) => { attachChannel(e.channel); };
      return pc;
    }

    function attachChannel(ch) {
      channel = ch;
      channel.onopen = () => onStatus('connected', 'Connected — syncing…', channel);
      channel.onclose = () => onStatus('closed', 'Connection closed');
    }

    async function startAsInitiator() {
      ensurePeerConnection();
      channel = pc.createDataChannel('imago-sync');
      attachChannel(channel);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(relayUrl, code, deviceId, peerId, { kind: 'offer', sdp: offer });
    }

    async function maybeStart() {
      if (!peerId) return;
      onStatus('pairing', 'Found other device, connecting…');
      if (deviceId < peerId) await startAsInitiator();
    }

    async function handleMessage(msg) {
      if (msg.type === 'peer-joined') {
        peerId = msg.deviceId;
        await maybeStart();
        return;
      }
      if (msg.type !== 'relay') return;
      const { kind } = msg.payload;
      peerId = peerId || msg.from;
      if (kind === 'offer') {
        ensurePeerConnection();
        await pc.setRemoteDescription(msg.payload.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(relayUrl, code, deviceId, peerId, { kind: 'answer', sdp: answer });
      } else if (kind === 'answer') {
        await pc.setRemoteDescription(msg.payload.sdp);
      } else if (kind === 'ice') {
        try { await pc.addIceCandidate(msg.payload.candidate); } catch { /* ignore stray candidates */ }
      }
    }

    async function start() {
      onStatus('waiting', 'Waiting for other device to enter the same code…');
      const joined = await joinRoom(relayUrl, code);
      deviceId = joined.deviceId;
      if (joined.peers && joined.peers.length) {
        peerId = joined.peers[0];
        await maybeStart();
      }
      pollLoop();
    }

    return {
      start,
      stop() { stopped = true; if (channel) channel.close(); if (pc) pc.close(); },
    };
  }

  function waitForChannelOpen(session) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for connection')), 60000);
      session._onOpen = (ch) => { clearTimeout(timer); resolve(ch); };
    });
  }

  async function dumpTables(db, tables) {
    const out = {};
    for (const t of tables) out[t] = await db.table(t).toArray();
    return out;
  }

  function rowTimestamp(row) {
    // Different apps in this repo use either camelCase or snake_case timestamp
    // fields, and either epoch millis or ISO strings — both compare correctly
    // with `>`, so we just need to find whichever field is actually present.
    return row.updatedAt ?? row.updated_at ?? row.createdAt ?? row.created_at ?? 0;
  }

  // Prefer an app-assigned `uid` for cross-device identity — two devices creating
  // rows offline will independently allocate the same auto-increment primary key
  // for unrelated rows, so the primary key alone can't be trusted to mean "same row".
  function mergeKeyOf(row, primKeyName) {
    return row.uid !== undefined ? `uid:${row.uid}` : `pk:${row[primKeyName]}`;
  }

  async function mergeTables(db, tables, remoteDump) {
    const stats = { added: 0, updated: 0 };
    for (const t of tables) {
      const table = db.table(t);
      const primKeyName = table.schema.primKey.name;
      const remoteRows = remoteDump[t] || [];
      const localRows = await table.toArray();
      const localByKey = new Map(localRows.map(r => [mergeKeyOf(r, primKeyName), r]));
      for (const remote of remoteRows) {
        const mKey = mergeKeyOf(remote, primKeyName);
        const local = localByKey.get(mKey);
        if (!local) {
          // Never trust the remote's own primary key value — let this device
          // allocate its own free key so it can't collide with an unrelated
          // local row that happens to share the same numeric id.
          const { [primKeyName]: _drop, ...withoutKey } = remote;
          await table.add(withoutKey);
          stats.added++;
        } else if (rowTimestamp(remote) > rowTimestamp(local)) {
          await table.put({ ...remote, [primKeyName]: local[primKeyName] });
          stats.updated++;
        }
      }
    }
    return stats;
  }

  async function syncDexie({ relayUrl, code, db, tables, onStatus }) {
    const session = pairSession({
      relayUrl, code,
      onStatus: (state, text, channel) => {
        onStatus && onStatus(state, text);
        if (state === 'connected' && session._onOpen) session._onOpen(channel);
      },
    });
    await session.start();
    const channel = await waitForChannelOpen(session);

    return new Promise((resolve, reject) => {
      let localSent = false, remoteDump = null;
      channel.onmessage = async (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type !== 'dump') return;
          remoteDump = msg.tables;
          onStatus && onStatus('merging', 'Merging records…');
          const stats = await mergeTables(db, tables, remoteDump);
          onStatus && onStatus('done', `Synced — ${stats.added} added, ${stats.updated} updated`);
          session.stop();
          resolve(stats);
        } catch (err) {
          reject(err);
        }
      };
      dumpTables(db, tables).then(local => {
        channel.send(JSON.stringify({ type: 'dump', tables: local }));
        localSent = true;
      }).catch(reject);
    });
  }

  function injectStyles() {
    if (document.getElementById('imago-sync-style')) return;
    const style = document.createElement('style');
    style.id = 'imago-sync-style';
    style.textContent = `
      .imago-sync-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
      .imago-sync-box{background:#1f1f25;color:#efefee;border:1px solid rgba(255,255,255,.13);border-radius:14px;padding:20px;width:280px;box-shadow:0 20px 60px rgba(0,0,0,.4);}
      .imago-sync-box h3{margin:0 0 12px;font-size:15px;font-weight:700;}
      .imago-sync-box input{width:100%;box-sizing:border-box;background:#2a2a31;border:1px solid rgba(255,255,255,.13);border-radius:8px;color:#efefee;font-size:20px;letter-spacing:.15em;text-align:center;padding:10px;margin-bottom:10px;}
      .imago-sync-box .row{display:flex;gap:8px;}
      .imago-sync-box button{flex:1;padding:9px 10px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;}
      .imago-sync-box .go{background:#b8ff57;color:#0e0e10;}
      .imago-sync-box .cancel{background:#2a2a31;color:#efefee;}
      .imago-sync-box .status{margin-top:12px;font-size:12px;color:#a0a09b;min-height:16px;}
    `;
    document.head.appendChild(style);
  }

  function openSyncModal({ relayUrl, db, tables }) {
    injectStyles();
    const backdrop = document.createElement('div');
    backdrop.className = 'imago-sync-backdrop';
    backdrop.innerHTML = `
      <div class="imago-sync-box">
        <h3>Sync devices</h3>
        <input type="text" inputmode="numeric" maxlength="8" value="${randomCode()}" />
        <div class="row">
          <button class="go">Start</button>
          <button class="cancel">Cancel</button>
        </div>
        <div class="status">Enter the same code on both devices, then tap Start on both.</div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const input = backdrop.querySelector('input');
    const status = backdrop.querySelector('.status');
    const goBtn = backdrop.querySelector('.go');
    backdrop.querySelector('.cancel').onclick = () => backdrop.remove();

    goBtn.onclick = async () => {
      const code = input.value.trim();
      if (!code) return;
      input.disabled = true;
      goBtn.disabled = true;
      try {
        await syncDexie({
          relayUrl, code, db, tables,
          onStatus: (_, text) => { status.textContent = text; },
        });
        setTimeout(() => backdrop.remove(), 2500);
      } catch (err) {
        status.textContent = `Error: ${err.message}`;
        input.disabled = false;
        goBtn.disabled = false;
      }
    };
  }

  window.ImagoSync = { syncDexie, openSyncModal };
})();
