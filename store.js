// Shared data layer for the stage and the participant page.
// Uses Firebase Realtime Database when config.js has Firebase settings,
// otherwise a rehearsal store that syncs tabs in one browser.
(function () {
  const CFG = window.GRAD_CONFIG || {};
  const ROOM = String(CFG.room || 'gradaition').replace(/[^a-zA-Z0-9_-]/g, '') || 'gradaition';
  const FB_VERSION = '10.12.2';

  function hasFirebase() {
    const f = CFG.firebase;
    return !!(f && f.apiKey && f.databaseURL);
  }

  async function firebaseStore() {
    const base = 'https://www.gstatic.com/firebasejs/' + FB_VERSION + '/';
    const appM = await import(base + 'firebase-app.js');
    const db = await import(base + 'firebase-database.js');
    const app = appM.initializeApp(CFG.firebase);
    const d = db.getDatabase(app);
    const r = p => db.ref(d, ROOM + (p ? '/' + p : ''));
    return {
      mode: 'live',
      room: ROOM,
      onLines(cb) { db.onValue(r('lines'), s => cb(s.val() || {})); },
      onTranscript(cb) {
        db.onValue(r('transcript'), s => { const v = s.val() || {}; cb(Object.keys(v).sort().map(k => v[k])); });
      },
      onState(cb) { db.onValue(r('state'), s => cb(s.val() || {})); },
      onConnection(cb) { db.onValue(db.ref(d, '.info/connected'), s => cb(!!s.val())); },
      async addLine(o) { const k = db.push(r('lines')); await db.set(k, { ...o, ts: db.serverTimestamp() }); return k.key; },
      updateLine(id, patch) { return db.update(r('lines/' + id), patch); },
      removeLine(id) { return db.remove(r('lines/' + id)); },
      pushTranscript(e) { return db.push(r('transcript'), { ...e, ts: Date.now() }); },
      setState(patch) { return db.update(r('state'), patch); },
      resetAll() { return db.remove(r()); }
    };
  }

  function localStore(reason) {
    const KEY = 'ua-gradaition-rehearsal-' + ROOM;
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    let data = read();
    const subs = { lines: [], transcript: [], state: [] };
    const emit = () => {
      subs.lines.forEach(f => f(JSON.parse(JSON.stringify(data.lines || {}))));
      subs.transcript.forEach(f => f(Object.keys(data.transcript || {}).sort().map(k => data.transcript[k])));
      subs.state.forEach(f => f({ ...(data.state || {}) }));
    };
    const write = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} emit(); };
    window.addEventListener('storage', e => { if (e.key === KEY) { data = read(); emit(); } });
    let n = 0;
    const id = () => Date.now().toString(36).padStart(10, '0') + (n++).toString(36).padStart(3, '0') + Math.random().toString(36).slice(2, 6);
    const sub = (k, cb) => { subs[k].push(cb); setTimeout(emit, 0); };
    return {
      mode: 'rehearsal',
      room: ROOM,
      error: reason || '',
      onLines(cb) { sub('lines', cb); },
      onTranscript(cb) { sub('transcript', cb); },
      onState(cb) { sub('state', cb); },
      onConnection(cb) { cb(true); },
      async addLine(o) { data = read(); const k = id(); data.lines = data.lines || {}; data.lines[k] = { ...o, ts: Date.now() }; write(); return k; },
      async updateLine(k, patch) { data = read(); if (data.lines && data.lines[k]) { Object.assign(data.lines[k], patch); write(); } },
      async removeLine(k) { data = read(); if (data.lines) { delete data.lines[k]; write(); } },
      async pushTranscript(e) { data = read(); data.transcript = data.transcript || {}; data.transcript[id()] = { ...e, ts: Date.now() }; write(); },
      async setState(patch) { data = read(); data.state = { ...(data.state || {}), ...patch }; write(); },
      async resetAll() { data = {}; write(); }
    };
  }

  window.GradStore = {
    async get() {
      if (hasFirebase()) {
        try { return await firebaseStore(); }
        catch (e) { console.error(e); return localStore('Could not reach Firebase: ' + e.message); }
      }
      return localStore();
    }
  };
})();
