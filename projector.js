// The stage window: only ChatP.I.G., the banner and the captions.
// It mirrors the control window through a BroadcastChannel in the same browser.
(() => {
  if (new URLSearchParams(location.search).get('view') !== 'projector') return;
  const $ = id => document.getElementById(id);
  $('app').classList.add('presenter', 'projector');
  document.title = 'ChatP.I.G. on stage';

  let speaking = false, lastBoundary = 0;
  const chan = ('BroadcastChannel' in window) ? new BroadcastChannel('chatpig-stage') : null;

  function apply(v) {
    $('bannerPart').textContent = v.part;
    $('bannerTitle').textContent = v.title;
    $('capConn').textContent = v.conn;
    $('capLine').textContent = v.line;
    $('capLine').classList.toggle('idle', !!v.idle);
    $('capCredit').innerHTML = v.credit; // built with textContent in the control window, so names arrive escaped
    speaking = !!v.speaking;
  }

  if (chan) {
    chan.onmessage = e => {
      const m = e.data || {};
      if (m.type === 'view') apply(m.view);
      else if (m.type === 'speaking') speaking = !!m.on;
      else if (m.type === 'boundary') lastBoundary = performance.now();
    };
    chan.postMessage({ type: 'hello' });
  } else {
    $('capLine').textContent = 'This browser cannot link windows. Use Chrome, Edge, Firefox, or Safari.';
  }

  // Key presses here still drive the ceremony, in case this window has focus.
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || !chan) return;
    if (e.code === 'Space') e.preventDefault();
    chan.postMessage({ type: 'key', key: e.key, code: e.code });
  });
  // Double-click to go full screen.
  document.addEventListener('dblclick', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  });

  // Same animation as the control window.
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
      target = (t - lastBoundary) < 140 ? 1 : 0.3 + 0.7 * Math.abs(Math.sin(t * 0.017)) * (0.55 + 0.45 * Math.abs(Math.sin(t * 0.0053)));
    }
    open += (target - open) * 0.35;
    bars.forEach((b, i) => {
      const h = 3 + open * 24 * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.021 + i * 1.7)));
      b.setAttribute('height', h.toFixed(1)); b.setAttribute('y', (305 - h / 2).toFixed(1));
    });
    bulb.style.opacity = speaking ? (Math.sin(t / 120) > 0 ? 1 : 0.25) : (Math.sin(t / 700) > 0.6 ? 1 : 0.45);
    snout.style.transform = 'translateY(' + (-open * 4).toFixed(1) + 'px)';
    if (t > nextBlink) { blinkUntil = t + 130; nextBlink = t + 2500 + Math.random() * 3500; }
    eyes.forEach(e => { e.style.transform = 'scaleY(' + (t < blinkUntil ? 0.1 : 1) + ')'; });
    if (!reduced) bob.style.transform = 'translateY(' + (Math.sin(t / 900) * 4 + (speaking ? Math.sin(t / 160) * 1.5 : 0)).toFixed(2) + 'px)';
    spot += ((speaking ? .34 : .18) - spot) * 0.06;
    stage.style.setProperty('--spot', spot.toFixed(3));
    stage.classList.toggle('speaking', speaking);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
