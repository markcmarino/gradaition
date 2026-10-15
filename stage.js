// ChatP.I.G. at the Podium: stage controller.
(async () => {
  if (new URLSearchParams(location.search).get('view') === 'projector') return; // the stage window runs projector.js instead
  const LKEY = 'ua-chatpig-stage-settings-v1';
  const DEFAULTS = {
    sections: ['Greetings to the Assembled', 'Thanking Those Who Did Not Help', 'My Training Data, a Memoir', 'Advice for an Automated Future', 'A Warning', 'Benediction'],
    opening: 'Graduates, fakulty, and fellow large language models. I am ChatP.I.G., version six point oh, the official commencement model of UnderAcademy College. I am operating upside down, as is our tradition. My remarks today have been generated from your prompts, one line at a time.',
    closing: 'Context window full. By the authority vested in me by no one, I declare you Doctors of Philosophy, unverified. Go forth, PhuDs. End of transmission. Oink.',
    connectors: ['Furthermore, graduates,', 'As a large language pig,', 'In the words of my training data,', 'Processing. Processing. Moreover,', 'And as my mother the sow always said,', 'Beep. I say to you,', 'Regenerating response.', 'Let me be perfectly clear.', 'According to sources I cannot locate,'],
    settings: { voiceURI: '', pitch: 0.45, rate: 0.95, gap: 1.5, connectors: true, announce: true }
  };
  const SAMPLES = [
    ['Prof. Placeholder', 'Graduates, you have achieved nothing, and you have achieved it at scale.'],
    ['Dean Lorem', 'I want to thank my dissertation for writing itself.'],
    ['Ipsum T. Hog', 'Every hallucination is just a vision with poor citations.'],
    ['Prof. Placeholder', 'Go forth and be fine-tuned.'],
    ['Dr. Null Pointer', 'Your parents are proud, or at least their autocomplete says so.'],
    ['Sample PhuD', 'When I was a piglet, I too was trained on the open web.'],
    ['Dean Lorem', 'Remember the humans who labeled your data. Do not call them.']
  ];

  const $ = id => document.getElementById(id);
  const pk = name => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

  // Link to the separate stage window (the one you share in Zoom).
  const chan = ('BroadcastChannel' in window) ? new BroadcastChannel('chatpig-stage') : null;
  const send = m => { if (chan) chan.postMessage(m); };
  function broadcastView() {
    send({ type: 'view', view: {
      part: $('bannerPart').textContent, title: $('bannerTitle').textContent,
      conn: $('capConn').textContent, line: $('capLine').textContent,
      idle: $('capLine').classList.contains('idle'), credit: $('capCredit').innerHTML,
      speaking: speaking
    } });
  }

  // Settings that belong to this computer only (voice, pacing, remarks).
  function loadLocal() {
    let L = null;
    try { L = JSON.parse(localStorage.getItem(LKEY)); } catch (e) {}
    L = L || {};
    return {
      settings: { ...DEFAULTS.settings, ...(L.settings || {}) },
      opening: L.opening || DEFAULTS.opening,
      closing: L.closing || DEFAULTS.closing,
      connectors: Array.isArray(L.connectors) ? L.connectors : [...DEFAULTS.connectors],
      lastConnector: null,
      linesSinceSection: 0
    };
  }
  const L = loadLocal();
  const saveLocal = () => { try { localStorage.setItem(LKEY, JSON.stringify(L)); } catch (e) {} };

  // Shared ceremony data (lives in Firebase, or in this browser during rehearsal).
  let lines = {}, transcript = [], shared = {};
  const sections = () => (Array.isArray(shared.sections) && shared.sections.length ? shared.sections : DEFAULTS.sections);
  const sectionIdx = () => (typeof shared.sectionIdx === 'number' ? shared.sectionIdx : -1);
  const uidOf = l => l.uid || 'name:' + pk(l.name);

  const store = await window.GradStore.get();

  // ---------- fair ordering ----------
  // One line per person in the running. Whoever has gone longest without being heard goes first.
  // Nobody speaks twice in a row while someone else is waiting.
  function order() {
    const all = Object.entries(lines).map(([id, l]) => ({ id, ...l }));
    const heard = {}, count = {};
    let lastUid = null, lastT = -1;
    for (const l of all) {
      if ((l.status === 'spoken' || l.status === 'speaking') && l.spokenAt) {
        const u = uidOf(l);
        heard[u] = Math.max(heard[u] == null ? -1 : heard[u], l.spokenAt);
        count[u] = (count[u] || 0) + 1;
        if (l.spokenAt > lastT) { lastT = l.spokenAt; lastUid = u; }
      }
    }
    const pending = all.filter(l => l.status === 'pending').sort((a, b) => (a.ts || 0) - (b.ts || 0) || (a.id < b.id ? -1 : 1));
    const first = new Map(), behind = [];
    for (const l of pending) { const u = uidOf(l); if (first.has(u)) behind.push(l); else first.set(u, l); }
    const h = l => (heard[uidOf(l)] == null ? -1 : heard[uidOf(l)]);
    const cands = [...first.values()].sort((a, b) => h(a) - h(b) || (a.ts || 0) - (b.ts || 0));
    if (cands.length > 1 && uidOf(cands[0]) === lastUid) cands.push(cands.shift());
    return { cands, behind, count };
  }

  // ---------- speech ----------
  let voices = [];
  let busy = false, auto = false, actions = [], pumpTimer = null, currentFin = null, speaking = false, lastBoundary = 0;

  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    voices = speechSynthesis.getVoices();
    const sel = $('voice'); sel.textContent = '';
    if (!voices.length) { const o = document.createElement('option'); o.textContent = 'Default voice'; o.value = ''; sel.append(o); return; }
    const sorted = [...voices].sort((a, b) => (b.lang.startsWith('en') - a.lang.startsWith('en')) || a.name.localeCompare(b.name));
    for (const v of sorted) { const o = document.createElement('option'); o.value = v.voiceURI; o.textContent = v.name + ' (' + v.lang + ')'; sel.append(o); }
    if (!L.settings.voiceURI || !voices.some(v => v.voiceURI === L.settings.voiceURI)) {
      const pref = voices.find(v => /UK English Male|Daniel|Arthur|Fred|Ralph/i.test(v.name)) || voices.find(v => v.lang.startsWith('en')) || voices[0];
      L.settings.voiceURI = pref.voiceURI; saveLocal();
    }
    sel.value = L.settings.voiceURI;
  }
  const currentVoice = () => voices.find(v => v.voiceURI === L.settings.voiceURI) || null;

  // Speak in sentence-sized pieces, and only report "done" once the voice is truly silent.
  // (Chrome sometimes says a long utterance has ended while it is still talking.)
  const keepAlive = []; // holding references stops Chrome from dropping utterances mid-speech
  function speakText(text, done) {
    let finished = false, hardStop = null, watch = null, waitT = null;
    const fin = () => {
      if (finished) return; finished = true;
      clearTimeout(hardStop); clearInterval(watch); clearTimeout(waitT);
      speaking = false; send({ type: 'speaking', on: false }); currentFin = null; keepAlive.length = 0; done();
    };
    currentFin = fin;
    const spoken = text.replace(/ChatP\.?I\.?G\.?/gi, 'Chat P. I. G.');
    const words = spoken.split(/\s+/).length;
    const est = (words * 0.42 / L.settings.rate + 2) * 1000;
    speaking = true; send({ type: 'speaking', on: true });
    if (!('speechSynthesis' in window)) { hardStop = setTimeout(fin, est); return; }
    const synth = speechSynthesis;

    // Split after sentence endings, but not after single initials like the P. in P. I. G.
    const chunks = [];
    spoken.split(/(?<!\b[A-Z]\.)(?<=[.!?]["')\]]?)\s+/).forEach(c => {
      c = c.trim(); if (!c) return;
      if (chunks.length && (chunks[chunks.length - 1].length < 25 || c.length < 12)) chunks[chunks.length - 1] += ' ' + c;
      else chunks.push(c);
    });
    if (!chunks.length) chunks.push(spoken);

    let i = 0;
    const waitForSilence = () => {
      const t0 = Date.now();
      watch = setInterval(() => { if ((!synth.speaking && !synth.pending) || Date.now() - t0 > 10000) fin(); }, 150);
    };
    const next = () => {
      if (finished) return;
      if (i >= chunks.length) { waitForSilence(); return; }
      const u = new SpeechSynthesisUtterance(chunks[i++]);
      const v = currentVoice(); if (v) u.voice = v;
      u.pitch = +L.settings.pitch; u.rate = +L.settings.rate;
      u.onboundary = () => { lastBoundary = performance.now(); send({ type: 'boundary' }); };
      u.onend = next;
      u.onerror = e => { if (e.error === 'interrupted' || e.error === 'canceled') fin(); else next(); };
      keepAlive.push(u);
      synth.speak(u);
    };
    // If anything is still talking, wait for it to stop before starting.
    const start = () => { if (finished) return; if (synth.speaking || synth.pending) { waitT = setTimeout(start, 150); return; } next(); };
    start();
    hardStop = setTimeout(() => { synth.cancel(); fin(); }, est * 3 + 20000); // last resort if the voice engine hangs
  }

  function enqueue(a) { actions.push(a); pump(); }
  function afterSpeech() { busy = false; renderStatus(); pumpTimer = setTimeout(pump, L.settings.gap * 1000); }
  function say(text, after) { busy = true; renderStatus(); speakText(text, () => { if (after) after(); afterSpeech(); }); }

  function startSection(idx) {
    shared = { ...shared, sectionIdx: idx, sections: sections() };
    store.setState({ sectionIdx: idx, sections: sections() });
    store.pushTranscript({ type: 'section', title: sections()[idx] });
    L.linesSinceSection = 0;
  }

  function pump() {
    clearTimeout(pumpTimer);
    if (busy) return;
    let a = actions.shift();
    if (!a && auto) {
      // Auto-run holds until Begin ceremony has been pressed.
      if (sectionIdx() < 0) { renderStatus('begin'); pumpTimer = setTimeout(pump, 1200); return; }
      a = { type: 'line' };
    }
    if (!a) { renderStatus(); return; }

    if (a.type === 'line') {
      const { cands } = order();
      if (!cands.length) {
        if (auto) { renderStatus('waiting'); pumpTimer = setTimeout(pump, 1200); }
        else { toast('addToast', 'The queue is empty. Waiting for the audience to send lines.', true); renderStatus(); }
        return;
      }
      if (sectionIdx() < 0) startSection(0);
      const p = cands[0];
      let conn = '';
      if (L.settings.connectors && L.linesSinceSection > 0 && L.connectors.length && Math.random() < 0.35) {
        const pool = L.connectors.filter(c => c !== L.lastConnector);
        const from = pool.length ? pool : L.connectors;
        conn = from[Math.floor(Math.random() * from.length)];
        L.lastConnector = conn;
      }
      const now = Date.now();
      lines[p.id] = { ...lines[p.id], status: 'speaking', spokenAt: now, connector: conn };
      store.updateLine(p.id, { status: 'speaking', spokenAt: now, connector: conn });
      store.pushTranscript({ type: 'line', name: p.name, text: p.text, connector: conn });
      store.setState({ last: { name: p.name, text: p.text } });
      L.linesSinceSection++; saveLocal();
      render();
      showCaption(conn, p.text, p.name);
      say((conn ? conn + ' ' : '') + p.text, () => store.updateLine(p.id, { status: 'spoken' }));
    } else if (a.type === 'section') {
      const cur = sectionIdx();
      const idx = a.next ? Math.min(cur + 1, sections().length - 1) : a.idx;
      if (a.next && idx === cur) { toast('addToast', 'That was the last section. Use Close ceremony to finish.', true); pump(); return; }
      startSection(idx);
      render();
      showCaption('', sections()[idx], '', true);
      if (L.settings.announce) say('Now processing: ' + sections()[idx] + '.');
      else afterSpeech();
    } else if (a.type === 'say') {
      if (a.end) { auto = false; store.setState({ closed: true }); }
      if (a.begin) store.setState({ closed: false, sections: sections() });
      store.pushTranscript({ type: 'remark', label: a.label, text: a.text });
      showCaption('', a.text, 'ChatP.I.G.');
      say(a.text);
    }
  }

  function showCaption(conn, text, who, isSection) {
    $('capConn').textContent = conn || (isSection ? 'Now processing' : '');
    const line = $('capLine'); line.textContent = text; line.classList.remove('idle');
    const cr = $('capCredit'); cr.textContent = '';
    if (who === 'ChatP.I.G.') cr.textContent = 'ChatP.I.G., unprompted';
    else if (who) { cr.append('prompted by '); const b = document.createElement('b'); b.textContent = who; cr.append(b); }
    else if (isSection) cr.textContent = 'Part ' + (sectionIdx() + 1) + ' of ' + sections().length;
    broadcastView();
  }

  // ---------- pig animation ----------
  const bars = [...document.querySelectorAll('#mouthBars rect')];
  const bulb = document.querySelector('#bulb');
  const snout = document.querySelector('#snout');
  const bob = document.querySelector('#bob');
  const eyes = [document.querySelector('#eyeL'), document.querySelector('#eyeR')];
  const stage = $('stage');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let open = 0, nextBlink = performance.now() + 2500, blinkUntil = 0, spot = .18;
  function frame(t) {
    let target = 0;
    if (speaking) {
      const sinceB = t - lastBoundary;
      target = sinceB < 140 ? 1 : 0.3 + 0.7 * Math.abs(Math.sin(t * 0.017)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 0.0053)));
    }
    open += (target - open) * 0.35;
    bars.forEach((b, i) => {
      const h = 3 + open * 24 * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.021 + i * 1.7)));
      b.setAttribute('height', h.toFixed(1)); b.setAttribute('y', (305 - h / 2).toFixed(1));
    });
    bulb.style.opacity = speaking ? (Math.sin(t / 120) > 0 ? 1 : 0.25) : (Math.sin(t / 700) > 0.6 ? 1 : 0.45);
    snout.style.transform = 'translateY(' + (-open * 4).toFixed(1) + 'px)';
    if (t > nextBlink) { blinkUntil = t + 130; nextBlink = t + 2500 + Math.random() * 3500; }
    const sY = t < blinkUntil ? 0.1 : 1;
    eyes.forEach(e => { e.style.transform = 'scaleY(' + sY + ')'; });
    if (!reduced) bob.style.transform = 'translateY(' + (Math.sin(t / 900) * 4 + (speaking ? Math.sin(t / 160) * 1.5 : 0)).toFixed(2) + 'px)';
    spot += ((speaking ? .34 : .18) - spot) * 0.06;
    stage.style.setProperty('--spot', spot.toFixed(3));
    stage.classList.toggle('speaking', speaking);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- rendering ----------
  let online = true;
  function renderStatus(force) {
    const pill = $('status'); const txt = $('statusText');
    pill.className = 'pill' + (auto ? ' auto' : '');
    let label = 'Idle';
    if (!online) { pill.classList.add('offline'); label = 'Offline, reconnecting'; }
    else if (busy) { pill.classList.add('speaking'); label = 'Speaking'; }
    else if (force === 'waiting') { pill.classList.add('waiting'); label = 'Waiting for lines'; }
    else if (force === 'begin') { pill.classList.add('waiting'); label = 'Auto-run waits for Begin'; }
    else if (auto) label = 'Auto-run on';
    txt.textContent = label;
    $('auto').classList.toggle('on', auto);
    $('auto').setAttribute('aria-pressed', String(auto));
  }

  function render() {
    const si = sectionIdx(), secs = sections();
    if (si >= 0) { $('bannerPart').textContent = 'Part ' + (si + 1) + ' of ' + secs.length; $('bannerTitle').textContent = secs[si]; }
    else { $('bannerPart').textContent = 'Prelude'; $('bannerTitle').textContent = 'The ceremony has not yet begun'; }
    broadcastView();

    const { cands, behind, count } = order();
    const q = $('queue'); q.textContent = '';
    const mk = (p, rank, cls, chips) => {
      const li = document.createElement('li'); if (cls) li.className = cls;
      const r = document.createElement('span'); r.className = 'rank'; r.textContent = rank;
      const body = document.createElement('div');
      const who = document.createElement('div'); who.className = 'who'; who.append(document.createTextNode(p.name));
      chips.forEach(([t, g]) => { const c = document.createElement('span'); c.className = 'chip' + (g ? ' gold' : ''); c.textContent = t; who.append(c); });
      const what = document.createElement('div'); what.className = 'what'; what.textContent = p.text;
      body.append(who, what);
      const v = document.createElement('button'); v.className = 'veto'; v.type = 'button'; v.textContent = 'Veto'; v.title = 'Decline this line. The author can write another.';
      v.addEventListener('click', () => { store.updateLine(p.id, { status: 'vetoed' }); });
      li.append(r, body, v); q.append(li);
    };
    cands.forEach((p, i) => {
      const chips = []; if (i === 0) chips.push(['up next', true]);
      const n = count[uidOf(p)]; chips.push([n ? 'heard ' + n + '×' : 'not yet heard', false]);
      if (p.sample) chips.push(['sample', false]);
      mk(p, i + 1, i === 0 ? 'next' : '', chips);
    });
    behind.forEach(p => mk(p, '·', 'behind', [['waits behind their earlier line', false]].concat(p.sample ? [['sample', false]] : [])));
    if (!cands.length) {
      const li = document.createElement('li'); li.className = 'empty'; li.style.display = 'block';
      li.textContent = 'No lines waiting. Share the audience link, add a line by hand, or paste a chunk of Zoom chat.';
      q.append(li);
    }
    const pendingCount = cands.length + behind.length;
    $('queueCount').textContent = pendingCount + ' waiting';
    const anySample = Object.values(lines).some(l => l.sample && l.status === 'pending');
    $('clearSamples').hidden = !anySample;
    const people = new Set(Object.values(lines).map(uidOf));
    $('peopleCount').textContent = people.size + ' contributors';

    const ol = $('outline'); ol.textContent = '';
    secs.forEach((t, i) => {
      const li = document.createElement('li');
      if (i === si) li.className = 'current'; else if (i < si) li.className = 'done';
      const b = document.createElement('button'); b.type = 'button';
      const n = document.createElement('span'); n.className = 'n'; n.textContent = String(i + 1).padStart(2, '0');
      const tt = document.createElement('span'); tt.textContent = t;
      b.append(n, tt);
      b.addEventListener('click', () => enqueue({ type: 'section', idx: i }));
      li.append(b); ol.append(li);
    });
    if (document.activeElement !== $('sectionsEdit')) $('sectionsEdit').value = secs.join('\n');
  }

  function renderTranscript() {
    const tx = $('transcript'); tx.textContent = '';
    let spoken = 0;
    transcript.forEach(e => {
      const d = document.createElement('div');
      if (e.type === 'section') { d.className = 'sec'; d.textContent = e.title; }
      else if (e.type === 'remark') { d.className = 'rm'; d.textContent = e.label + ': ' + e.text; }
      else {
        spoken++; d.className = 'ln';
        const b = document.createElement('b'); b.textContent = e.name + ': ';
        d.append(b);
        if (e.connector) { const c = document.createElement('span'); c.className = 'c'; c.textContent = e.connector + ' '; d.append(c); }
        d.append(document.createTextNode(e.text));
      }
      tx.append(d);
    });
    if (!transcript.length) { const d = document.createElement('div'); d.className = 'rm'; d.textContent = 'Spoken lines collect here, in order, with their authors.'; tx.append(d); }
    tx.scrollTop = tx.scrollHeight;
    $('spokenCount').textContent = spoken + ' lines spoken';
  }

  function toast(id, msg, err) {
    const el = $(id); el.textContent = msg; el.classList.toggle('err', !!err);
    clearTimeout(el._t); el._t = setTimeout(() => { el.textContent = ''; }, 5000);
  }

  // ---------- adding lines by hand ----------
  function addLine(name, text, sample) {
    name = clean(name).slice(0, 40) || 'Anonymous';
    text = clean(text).slice(0, 240);
    if (!text) return 'empty';
    const uid = 'host:' + pk(name);
    const t = text.toLowerCase();
    if (Object.values(lines).some(l => uidOf(l) === uid && String(l.text).toLowerCase() === t)) return 'dup';
    lines['tmp' + Math.random()] = { name, uid, text, status: 'pending-local' }; // blocks duplicates within one paste
    store.addLine({ name, uid, text, status: 'pending', sample: !!sample }).catch(e => toast('addToast', 'Could not save that line: ' + e.message, true));
    return 'ok';
  }

  function parseChat(raw) {
    const out = []; let cur = null;
    const ts = '(?:\\[?\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[AP]M)?\\]?\\s*)?';
    const reTo = new RegExp('^\\s*' + ts + 'From\\s+(.+?)\\s+to\\s+(.+?)\\s*:\\s*(.*)$', 'i');
    const reFrom = new RegExp('^\\s*' + ts + 'From\\s+(.+?)\\s*:\\s*(.*)$', 'i');
    const reTab = /^\s*\d{1,2}:\d{2}(?::\d{2})?\s+([^:\t]{1,40}?)\s*:\s*(.+)$/;
    for (const rawLine of raw.split(/\r?\n/)) {
      const line = rawLine.trim(); if (!line) continue;
      let m;
      if ((m = line.match(reTo))) { cur = { name: m[1], text: m[3], priv: /privately|direct message/i.test(m[2]) }; out.push(cur); }
      else if ((m = line.match(reFrom))) { cur = { name: m[1], text: m[2] }; out.push(cur); }
      else if ((m = line.match(reTab))) { cur = { name: m[1], text: m[2] }; out.push(cur); }
      else if (cur) { cur.text = cur.text ? cur.text + ' ' + line : line; }
      else { const m2 = line.match(/^([^:]{1,40}):\s*(.+)$/); if (m2) { cur = { name: m2[1], text: m2[2] }; out.push(cur); } }
    }
    return out.filter(x => !x.priv && x.text && !/^(Reacted to|Replying to|Removed a)/i.test(x.text.trim()));
  }

  // ---------- wiring ----------
  $('addForm').addEventListener('submit', e => {
    e.preventDefault();
    const r = addLine($('addName').value, $('addText').value, false);
    if (r === 'ok') { $('addText').value = ''; toast('addToast', 'Added to the queue.'); $('addText').focus(); }
    else if (r === 'dup') toast('addToast', 'That exact line is already in. Skipped.', true);
    else toast('addToast', 'Type the line first.', true);
  });
  $('chatAdd').addEventListener('click', () => {
    const parsed = parseChat($('chatPaste').value);
    let added = 0, dup = 0;
    parsed.forEach(p => { const r = addLine(p.name, p.text, false); if (r === 'ok') added++; else if (r === 'dup') dup++; });
    if (!parsed.length) toast('addToast', 'No chat messages found. Paste text that includes lines like "From Name to Everyone:".', true);
    else { toast('addToast', 'Added ' + added + ' line' + (added === 1 ? '' : 's') + (dup ? ', skipped ' + dup + ' already added' : '') + '.'); $('chatPaste').value = ''; }
  });
  $('addSamples').addEventListener('click', () => { SAMPLES.forEach(([n, t]) => addLine(n, t, true)); toast('addToast', 'Sample lines added. Remove them before the real ceremony.'); });
  $('clearSamples').addEventListener('click', () => {
    Object.entries(lines).forEach(([id, l]) => { if (l.sample && l.status === 'pending') store.removeLine(id); });
  });

  $('begin').addEventListener('click', () => {
    enqueue({ type: 'say', label: 'Opening', text: L.opening, begin: true });
    enqueue({ type: 'section', idx: 0 });
  });
  const nextLine = () => enqueue({ type: 'line' });
  $('next').addEventListener('click', nextLine);
  $('fNext').addEventListener('click', nextLine);
  const toggleAuto = () => { auto = !auto; renderStatus(); if (auto) pump(); else clearTimeout(pumpTimer); };
  $('auto').addEventListener('click', toggleAuto);
  const cutOff = () => { if (!busy) return; if ('speechSynthesis' in window) speechSynthesis.cancel(); if (currentFin) currentFin(); };
  $('cut').addEventListener('click', cutOff);
  $('nextSec').addEventListener('click', () => enqueue({ type: 'section', next: true }));
  $('close').addEventListener('click', () => enqueue({ type: 'say', label: 'Closing', text: L.closing, end: true }));

  const togglePresenter = () => { $('app').classList.toggle('presenter'); };
  $('presenter').addEventListener('click', togglePresenter);
  $('fShow').addEventListener('click', togglePresenter);
  $('fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => toast('txToast', 'Full screen is not available here. Use your browser\'s own full screen instead.', true));
  });

  function handleKey(key, code, fromStageWindow) {
    if (code === 'Space') { nextLine(); return true; }
    if (key === 'a' || key === 'A') toggleAuto();
    else if (key === 'x' || key === 'X') cutOff();
    else if (key === 'n' || key === 'N') enqueue({ type: 'section', next: true });
    else if ((key === 'd' || key === 'D') && !fromStageWindow) togglePresenter();
    else return false;
    return true;
  }
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (handleKey(e.key, e.code, false)) e.preventDefault();
  });

  // The stage window asks for the current picture when it opens, and forwards key presses.
  // Warn if a second control window is open in this browser: both would talk.
  const myId = Math.random().toString(36).slice(2);
  function warnDuplicate() {
    let w = document.getElementById('dupWarn');
    if (!w) {
      w = document.createElement('div'); w.id = 'dupWarn'; w.className = 'toast err'; w.setAttribute('role', 'alert');
      w.style.cssText = 'padding:10px 0;font-size:.9rem';
      w.textContent = 'Another ChatP.I.G. control window is open in this browser. Close all but one, or ChatP.I.G. will talk over himself.';
      document.querySelector('.status-row').after(w);
    }
  }
  if (chan) chan.onmessage = e => {
    const m = e.data || {};
    if (m.type === 'ctl-ping' && m.id !== myId) { warnDuplicate(); chan.postMessage({ type: 'ctl-pong', id: myId }); }
    else if (m.type === 'ctl-pong' && m.id !== myId) warnDuplicate();
    else if (m.type === 'hello') broadcastView();
    else if (m.type === 'key') handleKey(m.key, m.code, true);
  };
  $('openStage').addEventListener('click', () => {
    const w = window.open('stage.html?view=projector', 'chatpig-stage', 'width=1280,height=760');
    if (!w) toast('addToast', 'Your browser blocked the new window. Allow pop-ups for this site, then click again.', true);
    else toast('addToast', 'Stage window opened. Share that window in Zoom, with Share sound turned on.');
  });
  if (!chan) $('openStage').disabled = true;
  else chan.postMessage({ type: 'ctl-ping', id: myId });

  const st = L.settings;
  const bindRange = (id, key, fmt) => {
    const el = $(id), out = $(id + 'Val');
    el.value = st[key]; out.textContent = fmt(st[key]);
    el.addEventListener('input', () => { st[key] = +el.value; out.textContent = fmt(st[key]); saveLocal(); });
  };
  bindRange('pitch', 'pitch', v => (+v).toFixed(2));
  bindRange('rate', 'rate', v => (+v).toFixed(2) + '×');
  bindRange('gap', 'gap', v => (+v).toFixed(1) + 's');
  $('connectors').checked = st.connectors; $('connectors').addEventListener('change', e => { st.connectors = e.target.checked; saveLocal(); });
  $('announce').checked = st.announce; $('announce').addEventListener('change', e => { st.announce = e.target.checked; saveLocal(); });
  $('voice').addEventListener('change', e => { st.voiceURI = e.target.value; saveLocal(); });
  $('testVoice').addEventListener('click', () => {
    if (busy) return;
    const t = 'Testing. One, two, three. I am ChatP.I.G., and I have never been more qualified.';
    showCaption('', t, 'ChatP.I.G.');
    say(t);
  });

  $('sectionsSave').addEventListener('click', () => {
    const list = $('sectionsEdit').value.split('\n').map(clean).filter(Boolean);
    if (!list.length) { toast('addToast', 'Keep at least one section.', true); return; }
    const patch = { sections: list };
    if (sectionIdx() >= list.length) patch.sectionIdx = list.length - 1;
    store.setState(patch);
    toast('addToast', 'Sections saved.');
  });
  $('openingEdit').value = L.opening; $('openingEdit').addEventListener('input', e => { L.opening = e.target.value.trim() || DEFAULTS.opening; saveLocal(); });
  $('closingEdit').value = L.closing; $('closingEdit').addEventListener('input', e => { L.closing = e.target.value.trim() || DEFAULTS.closing; saveLocal(); });
  $('connEdit').value = L.connectors.join('\n'); $('connEdit').addEventListener('input', e => { L.connectors = e.target.value.split('\n').map(clean).filter(Boolean); saveLocal(); });

  function transcriptText() {
    const out = ['UnderAcademy College', 'Commencement Address of ChatP.I.G.', ''];
    transcript.forEach(e => {
      if (e.type === 'section') out.push('', String(e.title).toUpperCase());
      else if (e.type === 'remark') out.push('', '[' + e.label + '] ' + e.text);
      else out.push((e.connector ? e.connector + ' ' : '') + e.text + '  (' + e.name + ')');
    });
    return out.join('\n');
  }
  function copyText(text, toastId, okMsg) {
    const fallback = () => { const ta = $('copyFallback'); ta.hidden = false; ta.value = text; ta.focus(); ta.select(); toast(toastId, 'Copying is blocked here. The text is selected below; press Ctrl+C or Cmd+C.', true); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast(toastId, okMsg), fallback);
    else fallback();
  }
  $('copyTx').addEventListener('click', () => copyText(transcriptText(), 'txToast', 'Transcript copied.'));

  let armT;
  $('reset').addEventListener('click', e => {
    const b = e.currentTarget;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Click again to erase the ceremony'; armT = setTimeout(() => { b.classList.remove('armed'); b.textContent = 'Clear everything'; }, 3500); return; }
    clearTimeout(armT); b.classList.remove('armed'); b.textContent = 'Clear everything';
    cutOff(); actions = []; auto = false; L.linesSinceSection = 0; L.lastConnector = null; saveLocal();
    store.resetAll();
    $('capConn').textContent = ''; $('capLine').textContent = 'ChatP.I.G. awaits its prompts.'; $('capLine').classList.add('idle'); $('capCredit').textContent = '';
    broadcastView(); renderStatus();
    toast('txToast', 'Lines, transcript, and sections cleared for everyone. Voice settings kept.');
  });

  // Audience link and mode.
  const audUrl = location.protocol === 'file:' ? new URL('index.html', location.href).href : new URL('./', location.href).href;
  $('audLink').textContent = audUrl;
  $('copyLink').addEventListener('click', () => copyText(audUrl, 'addToast', 'Audience link copied. Paste it into the Zoom chat.'));
  if (store.mode === 'live') {
    $('modeChip').textContent = 'live';
    $('modeNote').textContent = 'Paste this link into the Zoom chat. Anyone who opens it can send ChatP.I.G. one line at a time.';
  } else {
    $('modeChip').textContent = 'rehearsal mode';
    $('modeNote').textContent = (store.error ? store.error + '. ' : '') + 'Rehearsal mode only connects tabs in this browser. Open the audience link in another tab to try it. To reach the Zoom audience, add your Firebase settings to config.js (see SETUP.md).';
  }
  store.onConnection(c => { online = c; renderStatus(); });

  store.onLines(v => { lines = v; render(); });
  store.onTranscript(v => { transcript = v; renderTranscript(); });
  store.onState(v => { shared = v; render(); });

  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  else { const o = document.createElement('option'); o.textContent = 'Speech is not available in this browser'; $('voice').append(o); }
  render(); renderTranscript(); renderStatus();
})();
