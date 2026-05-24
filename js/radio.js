/* Radio Telephony Trainer
   ATC voice via OpenAI TTS (config.js) with browser TTS fallback.
   Optional STT (Chrome/Safari) for pilot mic checking.
   Script view hides YOU text until Reveal is pressed. */

/* ── Route scripts ───────────────────────────────────────── */
const RADIO_ROUTES = [
  {
    key: 'edma-eddn',
    title: 'Ingolstadt → Nürnberg',
    sub:   'EDMA → EDDN · VFR · ~55 NM',
    lines: [
      {t:'phase', v:'Before Engine Start'},
      {t:'info',  v:'Listen to ATIS. Note Runway, QNH, and ATIS letter (e.g. Alpha).'},

      {t:'phase', v:'Startup'},
      {t:'you',   v:'Ingolstadt Ground, Delta Echo Golf Whiskey Romeo.'},
      {t:'atc',   s:'Ground',   v:'Delta Echo Golf Whiskey Romeo, Ingolstadt Ground, pass your message.'},
      {t:'you',   v:'Delta Echo Golf Whiskey Romeo, Piper PA-28 at General Aviation Apron, VFR to Nürnberg, Information Alpha received, request startup.'},
      {t:'atc',   s:'Ground',   v:'Delta Echo Golf Whiskey Romeo, startup approved, QNH 1018.'},
      {t:'you',   v:'Startup approved, QNH 1018, Delta Echo Golf Whiskey Romeo.'},

      {t:'phase', v:'Taxi'},
      {t:'info',  v:'Complete engine start and run-up checks, then call Ground for taxi.'},
      {t:'you',   v:'Ingolstadt Ground, Delta Echo Golf Whiskey Romeo, ready for taxi.'},
      {t:'atc',   s:'Ground',   v:'Delta Echo Golf Whiskey Romeo, taxi holding point runway 25 via Alpha.'},
      {t:'you',   v:'Taxi holding point runway 25 via Alpha, Delta Echo Golf Whiskey Romeo.'},

      {t:'phase', v:'Holding Point'},
      {t:'info',  v:'Run-up complete. Switch to Tower.'},
      {t:'you',   v:'Ingolstadt Tower, Delta Echo Golf Whiskey Romeo, ready for departure runway 25.'},
      {t:'atc',   s:'Tower',    v:'Delta Echo Golf Whiskey Romeo, line up and wait runway 25.'},
      {t:'you',   v:'Line up and wait runway 25, Delta Echo Golf Whiskey Romeo.'},

      {t:'phase', v:'Takeoff'},
      {t:'atc',   s:'Tower',    v:'Delta Echo Golf Whiskey Romeo, runway 25 cleared for takeoff.'},
      {t:'you',   v:'Cleared for takeoff runway 25, Delta Echo Golf Whiskey Romeo.'},

      {t:'phase', v:'Leaving CTR'},
      {t:'atc',   s:'Tower',    v:'Delta Echo Golf Whiskey Romeo, report leaving the control zone.'},
      {t:'you',   v:'Wilco, Delta Echo Golf Whiskey Romeo.'},
      {t:'info',  v:'Climb. A few minutes later when leaving the zone:'},
      {t:'you',   v:'Delta Echo Golf Whiskey Romeo leaving the control zone via NUB, climbing four thousand five hundred feet.'},
      {t:'atc',   s:'Tower',    v:'Delta Echo Golf Whiskey Romeo, frequency change approved.'},
      {t:'you',   v:'Frequency change approved, Delta Echo Golf Whiskey Romeo.'},

      {t:'phase', v:'Langen Information'},
      {t:'info',  v:'Tune Langen Information (127.725 or as published).'},
      {t:'you',   v:'Langen Information, Delta Echo Golf Whiskey Romeo.'},
      {t:'atc',   s:'Langen',   v:'Delta Echo Golf Whiskey Romeo, Langen Information, pass your message.'},
      {t:'you',   v:'Delta Echo Golf Whiskey Romeo, Piper PA-28 from Ingolstadt to Nürnberg, passing four thousand five hundred feet climbing five thousand five hundred feet near NUB, VFR, request Flight Information Service.'},
      {t:'atc',   s:'Langen',   v:'Delta Echo Golf Whiskey Romeo, squawk 4452, QNH 1017.'},
      {t:'you',   v:'Squawk 4452, QNH 1017, Delta Echo Golf Whiskey Romeo.'},

      {t:'phase', v:'Enroute'},
      {t:'info',  v:'Cruise. FIS may pass traffic information:'},
      {t:'atc',   s:'Langen',   v:"Delta Echo Golf Whiskey Romeo, traffic twelve o'clock, five miles, opposite direction, altitude five thousand feet."},
      {t:'you',   v:'Looking out, Delta Echo Golf Whiskey Romeo.'},
      {t:'info',  v:'After spotting traffic:'},
      {t:'you',   v:'Traffic in sight, Delta Echo Golf Whiskey Romeo.'},

      {t:'phase', v:'Nürnberg Approach'},
      {t:'info',  v:'About 15 NM south-west of EDDN. FIS transfers you:'},
      {t:'atc',   s:'Langen',   v:'Delta Echo Golf Whiskey Romeo, contact Nürnberg Approach 118.3.'},
      {t:'you',   v:'118.3, Delta Echo Golf Whiskey Romeo.'},
      {t:'you',   v:'Nürnberg Approach, Delta Echo Golf Whiskey Romeo.'},
      {t:'atc',   s:'Approach',  v:'Delta Echo Golf Whiskey Romeo, Nürnberg Approach, pass your message.'},
      {t:'you',   v:'Delta Echo Golf Whiskey Romeo, Piper PA-28 from Ingolstadt, fifteen miles south-west of Nürnberg, altitude three thousand five hundred feet, inbound for full stop landing, Information Bravo received.'},
      {t:'atc',   s:'Approach',  v:'Delta Echo Golf Whiskey Romeo, squawk 4721 and ident.'},
      {t:'you',   v:'Squawk 4721 and ident, Delta Echo Golf Whiskey Romeo.'},
      {t:'atc',   s:'Approach',  v:'Delta Echo Golf Whiskey Romeo, radar identified, QNH 1017. Proceed reporting point Whiskey, not above three thousand feet.'},
      {t:'you',   v:'Proceed Whiskey, not above three thousand feet, QNH 1017, Delta Echo Golf Whiskey Romeo.'},

      {t:'phase', v:'Reporting Point'},
      {t:'you',   v:'Delta Echo Golf Whiskey Romeo, overhead Whiskey.'},
      {t:'atc',   s:'Approach',  v:'Delta Echo Golf Whiskey Romeo, continue towards right base runway 28, number two following Airbus A320 on final.'},
      {t:'you',   v:'Continue right base runway 28, number two behind Airbus A320, Delta Echo Golf Whiskey Romeo.'},

      {t:'phase', v:'Handoff to Tower'},
      {t:'atc',   s:'Approach',  v:'Delta Echo Golf Whiskey Romeo, contact Nürnberg Tower 118.7.'},
      {t:'you',   v:'118.7, Delta Echo Golf Whiskey Romeo.'},
      {t:'you',   v:'Nürnberg Tower, Delta Echo Golf Whiskey Romeo, right base runway 28.'},
      {t:'atc',   s:'Tower',    v:'Delta Echo Golf Whiskey Romeo, continue approach, number two behind Airbus A320.'},
      {t:'you',   v:'Continue approach, number two behind Airbus A320, Delta Echo Golf Whiskey Romeo.'},

      {t:'phase', v:'Final'},
      {t:'you',   v:'Delta Echo Golf Whiskey Romeo, final runway 28.'},
      {t:'atc',   s:'Tower',    v:'Delta Echo Golf Whiskey Romeo, runway 28 cleared to land.'},
      {t:'you',   v:'Cleared to land runway 28, Delta Echo Golf Whiskey Romeo.'},

      {t:'phase', v:'After Landing'},
      {t:'info',  v:'Vacate runway, then call Tower.'},
      {t:'you',   v:'Delta Echo Golf Whiskey Romeo, runway vacated via Bravo.'},
      {t:'atc',   s:'Tower',    v:'Delta Echo Golf Whiskey Romeo, contact Ground 121.8.'},
      {t:'you',   v:'Ground 121.8, Delta Echo Golf Whiskey Romeo.'},

      {t:'phase', v:'Ground — Taxi to Parking'},
      {t:'you',   v:'Nürnberg Ground, Delta Echo Golf Whiskey Romeo, vacated runway 28 via Bravo, request taxi to General Aviation Apron.'},
      {t:'atc',   s:'Ground',   v:'Delta Echo Golf Whiskey Romeo, taxi General Aviation Apron via Bravo and Alpha.'},
      {t:'you',   v:'Taxi General Aviation Apron via Bravo and Alpha, Delta Echo Golf Whiskey Romeo.'},

      {t:'phase', v:'Parking'},
      {t:'info',  v:'At parking stand:'},
      {t:'you',   v:'Nürnberg Ground, Delta Echo Golf Whiskey Romeo parked on General Aviation Apron.'},
      {t:'atc',   s:'Ground',   v:'Delta Echo Golf Whiskey Romeo, roger.'},
      {t:'you',   v:'Delta Echo Golf Whiskey Romeo.'},
      {t:'info',  v:'Engine off. Flight complete!'},
    ]
  }
];

/* ── State ───────────────────────────────────────────────── */
let _rRoute     = null;
let _rIdx       = 0;
let _rRevealed  = false;
let _rTts       = true;
let _rVoice     = null;   // browser TTS voice cache
let _rAtcDone   = false;
let _rAtcLoad   = false;  // OpenAI fetch in flight
let _rAudio     = null;   // currently playing Audio element
let _rListening = false;
let _rTransc    = '';
let _rRecog     = null;

const _rHasSTT = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
const _rHasOAI = typeof OPENAI_API_KEY !== 'undefined' && !!OPENAI_API_KEY;

/* ── TTS — OpenAI ────────────────────────────────────────── */
function _rCancelAudio() {
  if (_rAudio) {
    _rAudio.onended = null; _rAudio.onerror = null;
    _rAudio.pause();
    if (_rAudio._url) URL.revokeObjectURL(_rAudio._url);
    _rAudio = null;
  }
  if (window.speechSynthesis) speechSynthesis.cancel();
  _rAtcLoad = false;
}

async function _rSpeakOpenAI(text, onEnd) {
  _rAtcLoad = true;
  _rRenderCurrent();
  try {
    const resp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: (typeof OPENAI_TTS_VOICE !== 'undefined' ? OPENAI_TTS_VOICE : 'onyx'),
        speed: (typeof OPENAI_TTS_SPEED !== 'undefined' ? OPENAI_TTS_SPEED : 0.92)
      })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    _rAtcLoad  = false;
    _rAudio    = new Audio(url);
    _rAudio._url = url;
    _rAudio.onended = () => { URL.revokeObjectURL(url); _rAudio = null; _rAtcDone = true; _rRenderControls(); _rRenderCurrent(); onEnd?.(); };
    _rAudio.onerror = () => { URL.revokeObjectURL(url); _rAudio = null; _rAtcDone = true; _rRenderControls(); onEnd?.(); };
    _rAudio.play();
    _rRenderCurrent();
  } catch (e) {
    console.warn('OpenAI TTS error, falling back:', e);
    _rAtcLoad = false;
    _rSpeakBrowser(text, onEnd);
  }
}

function _rSpeakBrowser(text, onEnd) {
  if (!window.speechSynthesis) { onEnd?.(); return; }
  if (!_rVoice) _rVoice = _rPickVoice();
  const u = new SpeechSynthesisUtterance(text);
  if (_rVoice) u.voice = _rVoice;
  u.lang = 'en-GB'; u.rate = 0.88; u.pitch = 1.0;
  u.onend = () => { _rAtcDone = true; _rRenderControls(); _rRenderCurrent(); onEnd?.(); };
  speechSynthesis.speak(u);
}

function _rSpeak(text, onEnd) {
  _rCancelAudio();
  if (!_rTts) { onEnd?.(); return; }
  if (_rHasOAI) {
    _rSpeakOpenAI(text, onEnd);
  } else {
    _rSpeakBrowser(text, onEnd);
  }
}

function _rPickVoice() {
  if (!window.speechSynthesis) return null;
  const vs = speechSynthesis.getVoices();
  return vs.find(v => v.lang === 'en-GB' && /male/i.test(v.name))
      || vs.find(v => v.lang === 'en-GB')
      || vs.find(v => v.lang.startsWith('en-'))
      || vs[0] || null;
}

/* ── STT ─────────────────────────────────────────────────── */
function _rStartListening() {
  if (!_rHasSTT) { showToast('Speech recognition not supported in this browser.'); return; }
  _rStopListening();
  _rTransc = ''; _rListening = true;
  _rRenderControls(); _rRenderCurrent();

  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  _rRecog = new R();
  _rRecog.lang = 'en-GB'; _rRecog.interimResults = true; _rRecog.continuous = false;
  _rRecog.onresult = e => { _rTransc = Array.from(e.results).map(r => r[0].transcript).join(' ').trim(); _rRenderCurrent(); };
  _rRecog.onerror  = () => { _rListening = false; _rRenderControls(); };
  _rRecog.onend    = () => { _rListening = false; _rRecog = null; _rRenderControls(); };
  _rRecog.start();
}

function _rStopListening() {
  try { _rRecog?.stop(); } catch (_) {}
  _rRecog = null; _rListening = false;
}

function _rScore(expected, actual) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  const exp = norm(expected); const act = new Set(norm(actual));
  return exp.length ? Math.round(exp.filter(w => act.has(w)).length / exp.length * 100) : 100;
}

/* ── Navigation ──────────────────────────────────────────── */
function startRadioRoute(key) {
  _rCancelAudio(); _rStopListening();
  _rRoute = RADIO_ROUTES.find(r => r.key === key) || null;
  if (!_rRoute) return;
  _rIdx = 0; _rRevealed = false; _rTransc = ''; _rAtcDone = false; _rAtcLoad = false;

  if (window.speechSynthesis && !_rHasOAI) {
    if (speechSynthesis.getVoices().length) _rVoice = _rPickVoice();
    else speechSynthesis.onvoiceschanged = () => { _rVoice = _rPickVoice(); };
  }

  const panel = document.getElementById('radio-panel');
  if (panel) panel.style.display = 'flex';
  const t = document.getElementById('rp-title'); if (t) t.textContent = _rRoute.title;
  const s = document.getElementById('rp-sub');   if (s) s.textContent = _rRoute.sub;
  _rProcessLine();
}

function stopRadioRoute() {
  _rCancelAudio(); _rStopListening();
  _rRoute = null;
  const panel = document.getElementById('radio-panel');
  if (panel) panel.style.display = 'none';
  const btn = document.getElementById('btn-radio-start');
  if (btn) btn.textContent = '🎙 Start';
}

function _rAdvance() {
  _rCancelAudio(); _rStopListening();
  if (!_rRoute) return;
  _rIdx++; _rRevealed = false; _rTransc = ''; _rAtcDone = false; _rAtcLoad = false;
  if (_rIdx >= _rRoute.lines.length) { _rRenderComplete(); return; }
  _rProcessLine();
}

function _rProcessLine() {
  if (!_rRoute || _rIdx >= _rRoute.lines.length) return;
  const line = _rRoute.lines[_rIdx];
  _rRender();
  if (line.t === 'phase' || line.t === 'info') {
    setTimeout(_rAdvance, line.t === 'phase' ? 250 : 800);
  } else if (line.t === 'atc') {
    _rAtcDone = false;
    _rSpeak(line.v, () => {});  // onEnd sets _rAtcDone via _rSpeakBrowser/OpenAI handlers
  }
}

function _rRenderComplete() {
  _rRenderScript();
  const cur  = document.getElementById('rp-current');
  if (cur)  cur.innerHTML  = '<div class="rp-complete">Flight complete! ✓</div>';
  const ctrl = document.getElementById('rp-controls');
  if (ctrl) ctrl.innerHTML = '<button class="rc-btn rc-btn-done" onclick="stopRadioRoute()">Close</button>';
  _rUpdateProgress();
}

/* ── Render ──────────────────────────────────────────────── */
function _rRender() { _rRenderScript(); _rRenderCurrent(); _rRenderControls(); _rUpdateProgress(); }

function _rRenderScript() {
  const el = document.getElementById('rp-script');
  if (!el || !_rRoute) return;
  el.innerHTML = '';

  const lines = _rRoute.lines;
  const from  = Math.max(0, _rIdx - 5);
  const to    = Math.min(lines.length, _rIdx + 3);

  for (let i = from; i < to; i++) {
    const line = lines[i];
    const done = i < _rIdx, cur = i === _rIdx;
    const div  = document.createElement('div');

    if (line.t === 'phase') {
      div.className = 'rs-phase' + (done ? ' rs-dim' : '');
      div.textContent = line.v.toUpperCase();
    } else if (line.t === 'info') {
      div.className = 'rs-info' + (done ? ' rs-dim' : '');
      div.textContent = 'ℹ ' + line.v;
    } else {
      const who = line.t === 'atc' ? (line.s || 'ATC') : 'YOU';
      const cls = (line.t === 'atc' ? 'rs-atc' : 'rs-you') +
                  (done ? ' rs-done' : cur ? ' rs-cur' : ' rs-pend');
      div.className = cls;

      // Only show text for done lines OR current/done ATC lines.
      // Current YOU lines and all pending lines stay hidden — text lives in rp-current.
      const showText = done || (cur && line.t === 'atc');
      div.innerHTML  = `<span class="rs-who">${who}</span>`+
                       `<span class="rs-txt">${showText ? line.v : '—'}</span>`;
    }
    el.appendChild(div);
  }
  el.scrollTop = el.scrollHeight;
}

function _rRenderCurrent() {
  const el = document.getElementById('rp-current');
  if (!el || !_rRoute) return;
  if (_rIdx >= _rRoute.lines.length) return;
  const line = _rRoute.lines[_rIdx];
  if (line.t === 'phase' || line.t === 'info') { el.innerHTML = ''; return; }

  if (line.t === 'atc') {
    const loading  = _rAtcLoad;
    const speaking = !_rAtcDone && !_rAtcLoad && !!_rAudio;
    el.innerHTML =
      `<div class="rp-cur-lbl">ATC — ${line.s || 'Station'}</div>`+
      `<div class="rp-cur-text">${line.v}</div>`+
      (loading  ? `<div class="rp-cur-status rp-loading">⏳ Generating voice…</div>` :
       speaking ? `<div class="rp-cur-status rp-speaking">🔊 Speaking…</div>` :
                  `<div class="rp-cur-status">Listening done</div>`);
    return;
  }

  // YOU line — text hidden until revealed
  let html = `<div class="rp-cur-lbl">YOUR CALL</div>`;
  html += _rRevealed
    ? `<div class="rp-cur-text rp-revealed">${line.v}</div>`
    : `<div class="rp-cur-text rp-hidden">Press 👁 Reveal or 🎙 Speak</div>`;

  if (_rTransc) {
    const sc  = _rScore(line.v, _rTransc);
    const col = sc >= 80 ? '#00cc44' : sc >= 50 ? '#ffcc00' : '#ff4422';
    html += `<div class="rp-transcript">🎙 "${_rTransc}"</div>`;
    html += `<div class="rp-score" style="color:${col}">Match: ${sc}%${sc >= 80 ? ' ✓' : ''}</div>`;
  }
  if (_rListening) html += `<div class="rp-cur-status rp-listening">🔴 Listening…</div>`;
  el.innerHTML = html;
}

function _rRenderControls() {
  const el = document.getElementById('rp-controls');
  if (!el || !_rRoute) return;
  if (_rIdx >= _rRoute.lines.length) return;
  const line = _rRoute.lines[_rIdx];
  if (line.t === 'phase' || line.t === 'info') { el.innerHTML = ''; return; }

  if (line.t === 'atc') {
    el.innerHTML =
      `<button class="rc-btn" onclick="_rSpeak(_rRoute.lines[_rIdx].v, ()=>{})">🔊 Replay</button>`+
      `<div class="rc-spacer"></div>`+
      `<button class="rc-btn rc-btn-next" onclick="_rAdvance()">Next →</button>`;
    return;
  }

  const revBtn = !_rRevealed
    ? `<button class="rc-btn" onclick="_rRevealed=true;_rRenderCurrent();_rRenderControls();">👁 Reveal</button>` : '';
  const micBtn = _rListening
    ? `<button class="rc-btn rc-btn-active" onclick="_rStopListening();_rRenderControls();">⏹ Stop</button>`
    : `<button class="rc-btn${_rHasSTT ? '' : ' rc-btn-dim'}" onclick="${_rHasSTT ? '_rStartListening()' : 'showToast(\"STT not supported\")'}"${_rHasSTT ? '' : ' disabled'}>🎙 Speak</button>`;

  el.innerHTML =
    revBtn + micBtn +
    `<div class="rc-spacer"></div>`+
    `<button class="rc-btn rc-btn-skip" onclick="_rAdvance()">⟩ Skip</button>`+
    `<button class="rc-btn rc-btn-done" onclick="_rStopListening();_rAdvance();">✓ Done</button>`;
}

function _rUpdateProgress() {
  if (!_rRoute) return;
  const lines  = _rRoute.lines;
  const active = lines.filter(l => l.t === 'atc' || l.t === 'you');
  const done   = lines.slice(0, _rIdx).filter(l => l.t === 'atc' || l.t === 'you').length;
  const pct    = active.length ? (done / active.length * 100) : 0;
  const bar = document.getElementById('rp-prog-bar'); if (bar) bar.style.width = pct.toFixed(1) + '%';
  const lbl = document.getElementById('rp-prog-lbl'); if (lbl) lbl.textContent = done + ' / ' + active.length;

  let phase = '';
  for (let i = _rIdx; i >= 0; i--) { if (lines[i]?.t === 'phase') { phase = lines[i].v; break; } }
  const ph = document.getElementById('rp-phase'); if (ph) ph.textContent = phase;
}

/* ── Init ────────────────────────────────────────────────── */
function initRadio() {
  const sel = document.getElementById('radio-route-sel');
  if (sel) {
    RADIO_ROUTES.forEach(r => {
      const o = document.createElement('option'); o.value = r.key; o.textContent = r.title; sel.appendChild(o);
    });
  }

  document.getElementById('btn-radio-start')?.addEventListener('click', () => {
    const v = document.getElementById('radio-route-sel')?.value;
    if (_rRoute) { stopRadioRoute(); return; }
    if (!v) { showToast('Select a route first.'); return; }
    startRadioRoute(v);
    const btn = document.getElementById('btn-radio-start');
    if (btn) btn.textContent = '■ Stop';
  });

  document.getElementById('rp-close')?.addEventListener('click', () => {
    stopRadioRoute();
    const btn = document.getElementById('btn-radio-start');
    if (btn) btn.textContent = '🎙 Start';
  });

  document.getElementById('rp-tts-btn')?.addEventListener('click', () => {
    _rTts = !_rTts;
    if (!_rTts) _rCancelAudio();
    const btn = document.getElementById('rp-tts-btn');
    if (btn) btn.textContent = _rTts ? '🔊' : '🔇';
    showToast('ATC voice: ' + (_rTts ? 'ON' : 'OFF'));
  });
}
