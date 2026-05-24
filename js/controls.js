/* Controls — user interaction handlers */

var g430TuneUnit = 'com1'; // which unit the GNS 430 dual knob is currently tuning

/* ── Toast ───────────────────────────────────────────────── */
function showToast(msg, duration = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

/* ── Toggle switch helper ────────────────────────────────── */
function setupToggle(id, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', () => {
    const next = el.dataset.state === 'on' ? 'off' : 'on';
    el.dataset.state = next;
    onChange(next === 'on');
  });
}
function syncToggle(id, value) {
  const el = document.getElementById(id);
  if (el) el.dataset.state = value ? 'on' : 'off';
}

/* ── Toggle switches ─────────────────────────────────────── */
function initToggles() {
  setupToggle('sw-battery', on => {
    state.electrical.battery = on;
    if (!on) { state.electrical.alternator = false; syncToggle('sw-alternator', false); }
    showToast('Battery Master: ' + (on ? 'ON' : 'OFF'));
  });
  setupToggle('sw-alternator', on => {
    if (on && !state.electrical.battery) { showToast('Battery must be ON first.'); syncToggle('sw-alternator', false); return; }
    state.electrical.alternator = on;
    showToast('Alternator: ' + (on ? 'ON' : 'OFF'));
  });
  setupToggle('sw-avionics', on => {
    if (on && !state.electrical.battery) { showToast('Battery master required.'); syncToggle('sw-avionics', false); return; }
    state.electrical.avionics = on;
    updateAvionicsState();
    showToast('Avionics Master: ' + (on ? 'ON' : 'OFF'));
  });
  setupToggle('sw-fuel-pump', on => {
    if (on && !state.electrical.battery) { showToast('Battery required for fuel pump.'); syncToggle('sw-fuel-pump', false); return; }
    if (on && state.circuitBreakers['FUEL PUMP']) { showToast('FUEL PUMP CB tripped!'); syncToggle('sw-fuel-pump', false); return; }
    state.electrical.fuelPump = on;
    showToast('Electric Fuel Pump: ' + (on ? 'ON' : 'OFF'));
  });
  setupToggle('sw-nav-light',   on => { state.lights.nav = on;       showToast('Nav Lights: '    + (on?'ON':'OFF')); });
  setupToggle('sw-land-light',  on => { state.lights.landing = on;   showToast('Landing Light: ' + (on?'ON':'OFF')); });
  setupToggle('sw-beacon',      on => { state.lights.beacon = on;    showToast('Beacon: '        + (on?'ON':'OFF')); });
  setupToggle('sw-strobes',     on => { state.lights.strobes = on;   showToast('Strobes: '       + (on?'ON':'OFF')); });
  setupToggle('sw-panel-light', on => { state.lights.panel = on;     showToast('Panel Lights: '  + (on?'ON':'OFF')); });
  setupToggle('sw-pitot-heat',  on => { state.lights.pitotHeat = on; showToast('Pitot Heat: '    + (on?'ON':'OFF')); });
}

/* ── Magneto ─────────────────────────────────────────────── */
const MAG_LABELS = ['OFF', 'R', 'L', 'BOTH', 'START'];
let _magStartTimer = null;

function setMagneto(pos) {
  pos = Math.max(0, Math.min(4, pos));
  if (pos === 4 && !state.electrical.battery) { showToast('Battery required for starter!'); return; }

  // Cancel any pending spring-return
  if (_magStartTimer) { clearTimeout(_magStartTimer); _magStartTimer = null; }

  state.engine.magnetos = pos;
  const lbl = document.getElementById('mag-label');
  if (lbl) lbl.textContent = MAG_LABELS[pos];
  showToast('Magneto: ' + MAG_LABELS[pos]);

  // Spring-loaded: auto-return START → BOTH after 3s (unless engine already started — then systems.js returns it immediately)
  if (pos === 4) {
    _magStartTimer = setTimeout(() => {
      _magStartTimer = null;
      if (state.engine.magnetos === 4) setMagneto(3);
    }, 3000);
  }
}

function initMagneto() {
  const cv = document.getElementById('magneto-switch');
  if (!cv) return;

  // Drag up/right = advance · drag down/left = retard · click (no drag) = left/right half
  let startY = null, startX = null, cumDrag = 0, dragMoved = false;
  const STEP_PX = 28; // pixels of drag per one position step

  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    startY = e.clientY; startX = e.clientX;
    cumDrag = 0; dragMoved = false;
  });

  cv.addEventListener('pointermove', e => {
    if (startY === null) return;
    const dy = startY - e.clientY; // up = +
    const dx = e.clientX - startX; // right = +
    startY = e.clientY; startX = e.clientX;
    cumDrag += (Math.abs(dy) > Math.abs(dx)) ? dy : dx;
    if (Math.abs(cumDrag) >= STEP_PX) {
      setMagneto(state.engine.magnetos + (cumDrag > 0 ? 1 : -1));
      cumDrag = 0; dragMoved = true;
    }
  });

  cv.addEventListener('pointerup', e => {
    if (!dragMoved && startY !== null) {
      // No drag — treat as click: left half retard, right half advance
      const rect = cv.getBoundingClientRect();
      setMagneto(state.engine.magnetos + (e.clientX - rect.left < rect.width / 2 ? -1 : 1));
    }
    startY = null;
  });

  cv.addEventListener('contextmenu', e => { e.preventDefault(); setMagneto(state.engine.magnetos - 1); });
  cv.addEventListener('wheel', e => { e.preventDefault(); setMagneto(state.engine.magnetos + (e.deltaY < 0 ? 1 : -1)); }, { passive: false });
}

/* ── Primer ──────────────────────────────────────────────── */
function initPrimer() {
  const pullBtn = document.getElementById('primer-pull');
  const pushBtn = document.getElementById('primer-push');
  const countEl = document.getElementById('primer-count');

  pullBtn?.addEventListener('click', () => {
    if (state.engine.running) { showToast('Cannot prime a running engine.'); return; }
    if (!state.electrical.battery) { showToast('Battery required.'); return; }
    if (!state.engine.primerOut) {
      state.engine.primerOut = true;
      pullBtn.textContent = 'PUMP →';
      pushBtn?.removeAttribute('disabled');
      pushBtn && (pushBtn.style.opacity = '1');
      showToast('Primer out. Click PUMP to inject fuel.');
    } else {
      state.engine.primerPumps = Math.min(6, state.engine.primerPumps + 1);
      if (countEl) countEl.textContent = state.engine.primerPumps + ' pump' + (state.engine.primerPumps !== 1 ? 's' : '');
      showToast('Primer: ' + state.engine.primerPumps + ' pump(s)');
    }
  });

  pushBtn?.addEventListener('click', () => {
    if (!state.engine.primerOut) return;
    state.engine.primerOut = false;
    if (pullBtn) pullBtn.textContent = 'PULL / PUMP';
    if (pushBtn) { pushBtn.setAttribute('disabled', true); pushBtn.style.opacity = '0.3'; }
    showToast('Primer locked in.');
  });
}

/* ── Fuel Selector ───────────────────────────────────────── */
const FSEL_ORDER = ['OFF', 'LEFT', 'BOTH', 'RIGHT'];
function initFuelSelector() {
  const cv = document.getElementById('fuel-selector');
  if (!cv) return;
  const step = dir => {
    const i = FSEL_ORDER.indexOf(state.fuel.selector);
    state.fuel.selector = FSEL_ORDER[((i + dir) + FSEL_ORDER.length) % FSEL_ORDER.length];
    const lbl = document.getElementById('fuel-sel-label');
    if (lbl) lbl.textContent = state.fuel.selector;
    showToast('Fuel Selector: ' + state.fuel.selector);
  };
  cv.addEventListener('click', () => step(1));
  cv.addEventListener('contextmenu', e => { e.preventDefault(); step(-1); });
  cv.addEventListener('wheel', e => { e.preventDefault(); step(e.deltaY < 0 ? 1 : -1); }, { passive: false });
}

/* ── Throttle Quadrant Levers ────────────────────────────── */
function initLever(trackId, leverId, pctId, getter, setter, formatter) {
  const track = document.getElementById(trackId);
  const lever = document.getElementById(leverId);
  if (!track || !lever) return;

  function valToBottom(v) { return (Math.max(0, Math.min(1, v)) * 90 + 5); }

  function applyPos(v) {
    setter(v);
    lever.style.bottom = valToBottom(v) + '%';
    const el = document.getElementById(pctId);
    if (el) el.textContent = formatter(v);
  }

  applyPos(getter());

  // Pointer-capture drag — delta-based so CSS zoom doesn't matter:
  // both dragStartY and e.clientY are always in the same viewport coordinate space.
  let dragStartY = null, dragStartVal = 0, trackH = 0;

  lever.addEventListener('pointerdown', e => {
    e.preventDefault();
    lever.setPointerCapture(e.pointerId);
    dragStartY   = e.clientY;
    dragStartVal = getter();
    trackH       = track.getBoundingClientRect().height || 126;
  });

  lever.addEventListener('pointermove', e => {
    if (dragStartY === null) return;
    const delta    = dragStartY - e.clientY;          // upward motion = positive
    const deltaVal = delta / (trackH * 0.9);          // 90% of track height = full 0→1 range
    applyPos(Math.max(0, Math.min(1, dragStartVal + deltaVal)));
  });

  ['pointerup', 'pointercancel'].forEach(ev =>
    lever.addEventListener(ev, () => dragStartY = null)
  );

  // Scroll on the track for fine adjustment
  track.addEventListener('wheel', e => {
    e.preventDefault();
    applyPos(Math.max(0, Math.min(1, getter() + (e.deltaY < 0 ? 0.02 : -0.02))));
  }, { passive: false });
}

const mixtureLabel  = v => v > 0.92 ? 'RICH' : (v < 0.08 ? 'CUT OFF' : Math.round(v*100)+'%');
const throttleLabel = v => Math.round(v * 100) + '%';
const carbLabel     = v => v > 0.5 ? 'HOT' : 'COLD';

function initLevers() {
  initLever('throttle-track', 'throttle-lever', 'throttle-pct',
    () => state.engine.throttle,  v => { state.engine.throttle = v; }, throttleLabel);
  initLever('mixture-track',  'mixture-lever',  'mixture-pct',
    () => state.engine.mixture,   v => { state.engine.mixture = v;  }, mixtureLabel);
  initLever('carbheat-track', 'carbheat-lever', 'carbheat-pct',
    () => state.engine.carbHeat ? 1 : 0, v => { state.engine.carbHeat = v > 0.5; }, carbLabel);
}

/* ── Parking Brake ───────────────────────────────────────── */
function initParkingBrake() {
  const h = document.getElementById('park-brake');
  if (!h) return;
  h.addEventListener('click', () => {
    state.parkingBrake = !state.parkingBrake;
    h.dataset.state = state.parkingBrake ? 'on' : 'off';
    const lbl = document.getElementById('park-brake-label');
    if (lbl) lbl.textContent = state.parkingBrake ? 'APPLIED' : 'OFF';
    showToast('Parking Brake: ' + (state.parkingBrake ? 'APPLIED' : 'RELEASED'));
  });
}

/* ── Flaps ───────────────────────────────────────────────── */
function initFlaps() {
  document.querySelectorAll('.flap-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.circuitBreakers['FLAPS']) { showToast('FLAPS CB tripped!'); return; }
      if (!state.electrical.battery) { showToast('Electrical power required for flaps.'); return; }
      state.flaps = parseInt(btn.dataset.flaps);
      document.querySelectorAll('.flap-btn').forEach(b => b.classList.remove('active-flap'));
      btn.classList.add('active-flap');
      updateFlapIndicator();
      showToast('Flaps: ' + state.flaps + '°');
    });
  });
}
function updateFlapIndicator() {
  const n = document.getElementById('flap-needle');
  if (n) n.style.left = (state.flaps / 40 * 100) + '%';
}

/* ── Trim ────────────────────────────────────────────────── */
let trim_dir = 0;
function initTrim() {
  const nu = document.getElementById('trim-nose-up');
  const nd = document.getElementById('trim-nose-dn');
  if (!nu || !nd) return;
  nu.addEventListener('mousedown', () => trim_dir = -1);
  nd.addEventListener('mousedown', () => trim_dir = 1);
  ['mouseup','mouseleave'].forEach(ev => {
    nu.addEventListener(ev, () => { if (trim_dir === -1) trim_dir = 0; });
    nd.addEventListener(ev, () => { if (trim_dir ===  1) trim_dir = 0; });
  });
  nu.addEventListener('touchstart', e => { e.preventDefault(); trim_dir=-1; }, { passive:false });
  nd.addEventListener('touchstart', e => { e.preventDefault(); trim_dir= 1; }, { passive:false });
  nu.addEventListener('touchend',  () => trim_dir = 0);
  nd.addEventListener('touchend',  () => trim_dir = 0);
}
function tickTrim() {
  if (state.circuitBreakers['TRIM']) return;
  if (trim_dir !== 0) {
    state.trimPct = Math.max(0, Math.min(100, state.trimPct + trim_dir * 15 / 60));
    const n = document.getElementById('trim-needle');
    if (n) n.style.top = state.trimPct + '%';
  }
}

/* ── Baro + HI knobs ─────────────────────────────────────── */
function initKnobs() {
  const baro = document.getElementById('baro-knob');
  if (baro) {
    baro.addEventListener('wheel', e => {
      e.preventDefault();
      state.flight.baroInHg = Math.max(28.00, Math.min(31.00, state.flight.baroInHg + (e.deltaY < 0 ? 0.01 : -0.01)));
      showToast('Baro: ' + state.flight.baroInHg.toFixed(2) + ' inHg');
    }, { passive: false });
    baro.addEventListener('click', () => { state.flight.baroInHg = 29.92; showToast('Baro: 29.92 (STD)'); });
  }
  const hiKnob = document.getElementById('hi-knob');
  if (hiKnob) {
    hiKnob.addEventListener('wheel', e => {
      e.preventDefault();
      state.flight.headingDeg = ((state.flight.headingDeg + (e.deltaY < 0 ? 1 : -1)) + 360) % 360;
    }, { passive: false });
  }

  // OBS course selector (NAV1 VOR)
  const obsKnob = document.getElementById('obs-knob');
  if (obsKnob) {
    obsKnob.addEventListener('wheel', e => {
      e.preventDefault();
      state.nav.obs1 = ((Math.round(state.nav.obs1) + (e.deltaY < 0 ? 1 : -1)) + 360) % 360;
      const el = document.getElementById('obs-val');
      if (el) el.textContent = state.nav.obs1.toString().padStart(3, '0') + '°';
    }, { passive: false });
    obsKnob.addEventListener('click', () => {
      state.nav.obs1 = Math.round(state.flight.headingDeg % 360);
      const el = document.getElementById('obs-val');
      if (el) el.textContent = state.nav.obs1.toString().padStart(3, '0') + '°';
      showToast('OBS → ' + state.nav.obs1 + '° (synced to HDG)');
    });
  }

  // Simulated VOR radial (aircraft position relative to station)
  const vorRadKnob = document.getElementById('vor1-radial-knob');
  if (vorRadKnob) {
    vorRadKnob.addEventListener('wheel', e => {
      e.preventDefault();
      state.nav.vor1Radial = ((Math.round(state.nav.vor1Radial) + (e.deltaY < 0 ? 1 : -1)) + 360) % 360;
      const el = document.getElementById('vor1-radial-val');
      if (el) el.textContent = state.nav.vor1Radial.toString().padStart(3, '0') + '°';
    }, { passive: false });
  }
}

/* ── Radio tuning ────────────────────────────────────────── */
function initRadios() {
  // Flip buttons (both in the Garmin 430 freq rows and any others)
  document.querySelectorAll('.flip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.electrical.avionics) { showToast('Avionics master required.'); return; }
      flipRadio(btn.dataset.unit);
    });
  });

  // Tune buttons
  document.querySelectorAll('.rk-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.electrical.avionics && btn.dataset.unit !== 'xpdr') {
        showToast('Avionics master required.');
        return;
      }
      const unit = btn.dataset.unit;
      const knob = btn.dataset.knob;
      if (unit === 'xpdr') tuneXpdr(knob);
      else tuneRadio(unit, knob);
    });
  });

  // XPDR mode
  document.getElementById('xpdr-mode')?.addEventListener('change', e => {
    state.radios.xpdr.mode = e.target.value;
    const lbl = document.getElementById('xpdr-mode-label');
    if (lbl) lbl.textContent = e.target.value;
    showToast('Transponder: ' + e.target.value);
  });

  // IDENT
  document.getElementById('xpdr-ident')?.addEventListener('click', () => {
    if (['OFF','STBY'].includes(state.radios.xpdr.mode)) { showToast('XPDR must be ON or ALT to IDENT.'); return; }
    const btn = document.getElementById('xpdr-ident');
    btn.classList.add('active');
    showToast('IDENT transmitted!');
    setTimeout(() => btn.classList.remove('active'), 3000);
  });

  // KMA-20 audio toggles
  document.querySelectorAll('.at-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.electrical.avionics) { showToast('Avionics master required.'); return; }
      btn.classList.toggle('active-at');
    });
  });

  // G430 buttons — COM↕ / NAV↕ flip buttons and page buttons
  document.querySelectorAll('.g430-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!state.electrical.avionics) { showToast('Avionics master required.'); return; }
      if (btn.dataset.unit) {
        flipRadio(btn.dataset.unit);
      } else {
        showToast('GNS 430: ' + (btn.dataset.fn ? btn.dataset.fn.toUpperCase() : '—'));
      }
    });
  });

  // DME mode
  document.getElementById('dme-mode')?.addEventListener('change', e => {
    showToast('DME: ' + e.target.value);
  });

  // PowerFLARM power
  document.getElementById('flarm-power')?.addEventListener('click', () => {
    if (!state.electrical.avionics) { showToast('Avionics master required.'); return; }
    const st = document.getElementById('flarm-status');
    const tr = document.getElementById('flarm-traffic');
    if (st && st.textContent.includes('INITIALIZING')) {
      st.textContent = 'OPERATIONAL';
      st.style.color = '#00cc44';
      if (tr) tr.textContent = '0 TRAFFIC';
      showToast('PowerFLARM: OPERATIONAL');
    } else if (st) {
      st.textContent = 'INITIALIZING…';
      st.style.color = '#2a7a2a';
      showToast('PowerFLARM: OFF');
    }
  });
}

function flipRadio(unit) {
  const r = state.radios[unit];
  [r.active, r.standby] = [r.standby, r.active];
  updateRadioDisplay(unit);
  showToast(unit.toUpperCase() + ': ' + r.active.toFixed(3));
}

function tuneRadio(unit, knob) {
  const r = state.radios[unit];
  const isCom = unit.startsWith('com');
  let f = r.standby;
  if (knob === 'mhz-up') f = stepMHz(f, 1, isCom);
  if (knob === 'mhz-dn') f = stepMHz(f,-1, isCom);
  if (knob === 'khz-up') f = stepKHz(f, 1, isCom);
  if (knob === 'khz-dn') f = stepKHz(f,-1, isCom);
  r.standby = f;
  updateRadioDisplay(unit);
}

function stepMHz(freq, dir, isCom) {
  const min = isCom ? 118 : 108, max = isCom ? 136 : 118;
  let mhz = Math.round(freq); mhz += dir;
  if (mhz > max) mhz = min; if (mhz < min) mhz = max;
  return mhz + (freq - Math.floor(freq));
}
function stepKHz(freq, dir, isCom) {
  const intP = Math.floor(freq);
  let khz = Math.round((freq - intP) * 1000);
  const step = isCom ? 25 : 50;
  khz += dir * step;
  if (khz >= 1000) khz = 0; if (khz < 0) khz = 1000 - step;
  return intP + khz / 1000;
}

function tuneXpdr(knob) {
  let code = state.radios.xpdr.code;
  if (knob === 'up') code = Math.min(7777, code + 1);
  if (knob === 'dn') code = Math.max(0, code - 1);
  state.radios.xpdr.code = code;
  const el = document.getElementById('xpdr-code');
  if (el) el.textContent = code.toString().padStart(4,'0');
}

function updateRadioDisplay(unit) {
  const r = state.radios[unit];
  const fmt = f => f.toFixed(3);
  const actEl  = document.getElementById(unit + '-active');
  const stbyEl = document.getElementById(unit + '-standby');
  if (actEl)  actEl.textContent  = fmt(r.active);
  if (stbyEl) stbyEl.textContent = fmt(r.standby);
}

function updateAvionicsState() {
  const on = state.electrical.avionics && !state.circuitBreakers['AVIONICS'];
  const stack = document.getElementById('avionics-section');
  if (stack) stack.style.opacity = on ? '1' : '0.35';
  if (!on) {
    const st = document.getElementById('flarm-status');
    if (st) { st.textContent = 'INITIALIZING…'; st.style.color = '#2a7a2a'; }
  }
}

/* ── GTX-330 FL readout ──────────────────────────────────── */
function updateGTX() {
  const flEl = document.getElementById('gtx-fl');
  if (!flEl) return;
  const mode = state.radios.xpdr.mode;
  if (mode === 'ALT' && state.electrical.avionics) {
    const fl = Math.round(state.flight.altitudeFt / 100);
    flEl.textContent = 'FL' + fl.toString().padStart(3,'0');
  } else {
    flEl.textContent = 'FL---';
  }
}

/* ── Save / Load ─────────────────────────────────────────── */
function initSaveLoad() {
  document.getElementById('btn-save')?.addEventListener('click', () => {
    const slot = document.getElementById('save-slot-select').value;
    if (saveState(slot)) {
      const s = document.getElementById('save-status');
      if (s) { s.textContent = '✓ Saved slot ' + slot; setTimeout(() => s.textContent='', 3000); }
      showToast('State saved — slot ' + slot);
    }
  });
  document.getElementById('btn-load')?.addEventListener('click', () => {
    const slot = document.getElementById('save-slot-select').value;
    const ts = loadState(slot);
    if (ts) {
      syncAllFromState();
      const s = document.getElementById('save-status');
      if (s) { s.textContent = '✓ Loaded slot ' + slot + ' (' + new Date(ts).toLocaleTimeString() + ')'; setTimeout(() => s.textContent='', 4000); }
      showToast('Loaded slot ' + slot);
    } else {
      showToast('No save data in slot ' + slot);
    }
  });
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    if (confirm('Reset D-EGWR to cold & dark?')) {
      resetState(); syncAllFromState();
      showToast('Cold & dark reset complete.');
    }
  });
}

/* ── Checklist + Help ────────────────────────────────────── */
function initChecklist() {
  const modal = document.getElementById('checklist-modal');
  document.getElementById('btn-checklist')?.addEventListener('click', () => modal && (modal.style.display='flex'));
  document.getElementById('cl-close')?.addEventListener('click', () => modal && (modal.style.display='none'));
  modal?.addEventListener('click', e => { if (e.target===modal) modal.style.display='none'; });
  document.getElementById('cl-reset-checks')?.addEventListener('click', () => {
    modal?.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked=false);
  });
}
function initHelp() {
  document.getElementById('btn-help')?.addEventListener('click', () =>
    showToast('Keys: B=Battery A=Alt M=Magneto+ F=Flaps P=ParkBrake  |  Scroll levers/knobs  |  Right-click rotary = retard', 6000)
  );
}

/* ── Keyboard ────────────────────────────────────────────── */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    switch (e.key) {
      case 'b': case 'B': document.getElementById('sw-battery')?.click(); break;
      case 'a': case 'A': document.getElementById('sw-alternator')?.click(); break;
      case 'v': case 'V': document.getElementById('sw-avionics')?.click(); break;
      case 'm': case 'M': setMagneto(state.engine.magnetos + 1); break;
      case 'n': case 'N': setMagneto(state.engine.magnetos - 1); break;
      case 'f': case 'F': {
        const positions = [0,10,25,40];
        const next = positions[(positions.indexOf(state.flaps)+1) % positions.length];
        state.flaps = next;
        updateFlapIndicator();
        document.querySelectorAll('.flap-btn').forEach(b => b.classList.toggle('active-flap', parseInt(b.dataset.flaps)===next));
        showToast('Flaps: ' + next + '°');
        break;
      }
      case 'p': case 'P': document.getElementById('park-brake')?.click(); break;
      case '?': case '/':
        showToast('B=Battery A=Alt V=Avionics M/N=Mag+/- F=Flaps P=Brake | Scroll levers & knobs', 6000);
        break;
      case 'Escape':
        const cl = document.getElementById('checklist-modal');
        if (cl) cl.style.display = 'none';
        break;
    }
  });
}

/* ── Full sync UI → state ────────────────────────────────── */
function syncAllFromState() {
  syncToggle('sw-battery',    state.electrical.battery);
  syncToggle('sw-alternator', state.electrical.alternator);
  syncToggle('sw-avionics',   state.electrical.avionics);
  syncToggle('sw-fuel-pump',  state.electrical.fuelPump);
  syncToggle('sw-nav-light',   state.lights.nav);
  syncToggle('sw-land-light',  state.lights.landing);
  syncToggle('sw-beacon',      state.lights.beacon);
  syncToggle('sw-strobes',     state.lights.strobes);
  syncToggle('sw-panel-light', state.lights.panel);
  syncToggle('sw-pitot-heat',  state.lights.pitotHeat);

  const magLbl = document.getElementById('mag-label');
  if (magLbl) magLbl.textContent = MAG_LABELS[state.engine.magnetos];

  const fuelLbl = document.getElementById('fuel-sel-label');
  if (fuelLbl) fuelLbl.textContent = state.fuel.selector;

  const xpdrMode = document.getElementById('xpdr-mode');
  if (xpdrMode) xpdrMode.value = state.radios.xpdr.mode;
  const xpdrCode = document.getElementById('xpdr-code');
  if (xpdrCode) xpdrCode.textContent = state.radios.xpdr.code.toString().padStart(4,'0');

  ['com1','com2','nav1','nav2'].forEach(updateRadioDisplay);

  const pb = document.getElementById('park-brake');
  if (pb) { pb.dataset.state = state.parkingBrake ? 'on' : 'off'; }
  const pbl = document.getElementById('park-brake-label');
  if (pbl) pbl.textContent = state.parkingBrake ? 'APPLIED' : 'OFF';

  updateFlapIndicator();
  document.querySelectorAll('.flap-btn').forEach(b =>
    b.classList.toggle('active-flap', parseInt(b.dataset.flaps) === state.flaps)
  );

  const trimN = document.getElementById('trim-needle');
  if (trimN) trimN.style.top = state.trimPct + '%';

  const obsEl = document.getElementById('obs-val');
  if (obsEl) obsEl.textContent = Math.round(state.nav.obs1).toString().padStart(3, '0') + '°';
  const radEl = document.getElementById('vor1-radial-val');
  if (radEl) radEl.textContent = Math.round(state.nav.vor1Radial).toString().padStart(3, '0') + '°';

  updateAvionicsState();
  buildCBPanel();
  syncLeverPositions();
}

function syncLeverPositions() {
  const syncL = (leverId, pctId, val, fmt) => {
    const lever = document.getElementById(leverId);
    if (lever) lever.style.bottom = (val * 90 + 5) + '%';
    const p = document.getElementById(pctId);
    if (p) p.textContent = fmt(val);
  };
  syncL('throttle-lever', 'throttle-pct', state.engine.throttle, throttleLabel);
  syncL('mixture-lever',  'mixture-pct',  state.engine.mixture,  mixtureLabel);
  syncL('carbheat-lever', 'carbheat-pct', state.engine.carbHeat ? 1 : 0, carbLabel);
}

/* ── GNS 430 Dual Knob ───────────────────────────────────── */
function initG430Knobs() {
  const outer = document.getElementById('g430-outer');
  const inner = document.getElementById('g430-inner');
  if (!outer || !inner) return;

  let outerRot = 0, innerRot = 0;

  function syncModeLabel() {
    const lbl = document.getElementById('g430-mode-label');
    if (lbl) lbl.textContent = g430TuneUnit.toUpperCase();
  }

  // Outer knob — scroll = ±MHz, click = toggle COM1 / NAV1 tuning target
  outer.addEventListener('wheel', e => {
    e.preventDefault();
    if (!state.electrical.avionics) { showToast('Avionics master required.'); return; }
    const dir = e.deltaY < 0 ? 1 : -1;
    outerRot = (outerRot - dir * 24) % 360;
    outer.style.transform = `rotate(${outerRot}deg)`;
    inner.style.transform = `rotate(${-outerRot + innerRot}deg)`;
    tuneRadio(g430TuneUnit, dir > 0 ? 'mhz-up' : 'mhz-dn');
  }, { passive: false });

  outer.addEventListener('click', e => {
    if (inner.contains(e.target)) return;
    if (!state.electrical.avionics) return;
    g430TuneUnit = g430TuneUnit === 'com1' ? 'nav1' : 'com1';
    syncModeLabel();
    showToast('GNS 430: Tuning ' + g430TuneUnit.toUpperCase() + ' standby');
  });

  // Inner knob — scroll = ±kHz, click = flip active ↔ standby
  inner.addEventListener('wheel', e => {
    e.stopPropagation();
    e.preventDefault();
    if (!state.electrical.avionics) { showToast('Avionics master required.'); return; }
    const dir = e.deltaY < 0 ? 1 : -1;
    innerRot = (innerRot + dir * 32) % 360;
    inner.style.transform = `rotate(${-outerRot + innerRot}deg)`;
    tuneRadio(g430TuneUnit, dir > 0 ? 'khz-up' : 'khz-dn');
  }, { passive: false });

  inner.addEventListener('click', e => {
    e.stopPropagation();
    if (!state.electrical.avionics) { showToast('Avionics master required.'); return; }
    flipRadio(g430TuneUnit);
  });

  syncModeLabel();
}

/* ── Init ────────────────────────────────────────────────── */
function initControls() {
  initToggles();
  initMagneto();
  initPrimer();
  initFuelSelector();
  initLevers();
  initParkingBrake();
  initFlaps();
  initTrim();
  initKnobs();
  initRadios();
  initG430Knobs();
  initSaveLoad();
  initChecklist();
  initHelp();
  initKeyboard();
  buildCBPanel();
  syncAllFromState();
}
