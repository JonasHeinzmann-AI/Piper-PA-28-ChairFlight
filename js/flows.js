/* Guided procedure flows + test mode */

let _flow     = null;
let _step     = 0;
let _hlId     = null;
let _testMode = false;
let _testDone = false;

const FLOWS = {
  'engine-start': {
    title: 'Engine Start',
    steps: [
      { text: 'Fuel Selector → BOTH',             hl: 'fuel-sel-wrap',  check: () => state.fuel.selector === 'BOTH' },
      { text: 'Battery Master → ON',              hl: 'sw-battery',     check: () => state.electrical.battery },
      { text: 'Alternator → ON',                  hl: 'sw-alternator',  check: () => state.electrical.alternator },
      { text: 'Avionics Master → OFF',            hl: 'sw-avionics',    check: () => !state.electrical.avionics },
      { text: 'Mixture → RICH (full fwd)',        hl: 'mixture-track',  check: () => state.engine.mixture > 0.9 },
      { text: 'Throttle → ~15% open',            hl: 'throttle-track', check: () => state.engine.throttle > 0.08 && state.engine.throttle < 0.30 },
      { text: 'Electric Fuel Pump → ON',          hl: 'sw-fuel-pump',   check: () => state.electrical.fuelPump },
      { text: 'Carb Heat → COLD',                 hl: 'carbheat-track', check: () => !state.engine.carbHeat },
      { text: 'Magneto → START (hold)',           hl: 'magneto-wrap',   check: () => state.engine.running },
      { text: 'Oil Pressure → rising (< 30 s)',  hl: 'oil-press',      check: () => state.engine.oilPressurePsi > 20 },
      { text: 'Avionics Master → ON',             hl: 'sw-avionics',    check: () => state.electrical.avionics },
      { text: 'Electric Fuel Pump → OFF',         hl: 'sw-fuel-pump',   check: () => !state.electrical.fuelPump },
      { text: 'GTX-330 → STBY',                  hl: null,             check: () => state.radios.xpdr.mode !== 'OFF' },
    ]
  },

  'before-takeoff': {
    title: 'Before Takeoff',
    steps: [
      { text: 'Parking Brake → SET',              hl: 'park-brake',     check: () => state.parkingBrake },
      { text: 'Fuel Selector → BOTH',             hl: 'fuel-sel-wrap',  check: () => state.fuel.selector === 'BOTH' },
      { text: 'Mixture → RICH',                   hl: 'mixture-track',  check: () => state.engine.mixture > 0.9 },
      { text: 'Carb Heat → COLD',                 hl: 'carbheat-track', check: () => !state.engine.carbHeat },
      { text: 'Trim → takeoff (centre mark)',     hl: null,             check: () => state.trimPct > 40 && state.trimPct < 60 },
      { text: 'Throttle → 1800 RPM (runup)',      hl: 'throttle-track', check: () => state.engine.rpm > 1650 },
      { text: 'Magneto check — select L',         hl: 'magneto-wrap',   check: () => state.engine.magnetos === 2 },
      { text: 'Check drop (<125 RPM), then R',   hl: 'magneto-wrap',   check: () => state.engine.magnetos === 1 },
      { text: 'Check drop (<125 RPM) → BOTH',    hl: 'magneto-wrap',   check: () => state.engine.magnetos === 3 },
      { text: 'Carb Heat → ON (note RPM drop)',   hl: 'carbheat-track', check: () => state.engine.carbHeat },
      { text: 'Carb Heat → COLD',                 hl: 'carbheat-track', check: () => !state.engine.carbHeat },
      { text: 'Throttle → idle',                  hl: 'throttle-track', check: () => state.engine.throttle < 0.10 },
      { text: 'Flaps → UP (0°)',                  hl: null,             check: () => state.flaps === 0 },
      { text: 'Nav Lights → ON',                  hl: 'sw-nav-light',   check: () => state.lights.nav },
      { text: 'Beacon → ON',                      hl: 'sw-beacon',      check: () => state.lights.beacon },
      { text: 'Strobes → ON',                     hl: 'sw-strobes',     check: () => state.lights.strobes },
      { text: 'Transponder → ALT',               hl: null,             check: () => state.radios.xpdr.mode === 'ALT' },
      { text: 'Parking Brake → RELEASE',         hl: 'park-brake',     check: () => !state.parkingBrake },
    ]
  },

  'cruise': {
    title: 'Cruise Checks',
    steps: [
      { text: 'Throttle → cruise power (set RPM)',  hl: 'throttle-track', check: () => state.engine.rpm > 2100 && state.engine.rpm < 2600 },
      { text: 'Mixture → lean (above 3000 ft)',    hl: 'mixture-track',  check: () => state.engine.mixture < 0.85 },
      { text: 'Carb Heat → COLD (check)',           hl: 'carbheat-track', check: () => !state.engine.carbHeat },
      { text: 'Fuel Selector → BOTH',              hl: 'fuel-sel-wrap',  check: () => state.fuel.selector === 'BOTH' },
      { text: 'Oil Temp → green arc',              hl: 'oil-press',      check: () => state.engine.oilTempF > 100 && state.engine.oilTempF < 245 },
      { text: 'Transponder → ALT',                 hl: null,             check: () => state.radios.xpdr.mode === 'ALT' },
    ]
  },

  'pre-landing': {
    title: 'Pre-Landing (Downwind)',
    steps: [
      { text: 'Mixture → RICH (full fwd)',         hl: 'mixture-track',  check: () => state.engine.mixture > 0.9 },
      { text: 'Fuel Selector → BOTH',              hl: 'fuel-sel-wrap',  check: () => state.fuel.selector === 'BOTH' },
      { text: 'Electric Fuel Pump → ON',           hl: 'sw-fuel-pump',   check: () => state.electrical.fuelPump },
      { text: 'Carb Heat → ON (below 3000 ft)',    hl: 'carbheat-track', check: () => state.engine.carbHeat },
      { text: 'Landing Light → ON',                hl: 'sw-land-light',  check: () => state.lights.landing },
    ]
  },

  'after-landing': {
    title: 'After Landing',
    steps: [
      { text: 'Carb Heat → COLD',                  hl: 'carbheat-track', check: () => !state.engine.carbHeat },
      { text: 'Flaps → UP (0°)',                   hl: null,             check: () => state.flaps === 0 },
      { text: 'Electric Fuel Pump → OFF',          hl: 'sw-fuel-pump',   check: () => !state.electrical.fuelPump },
      { text: 'Transponder → STBY',               hl: null,             check: () => state.radios.xpdr.mode === 'STBY' },
      { text: 'Strobes → OFF',                     hl: 'sw-strobes',     check: () => !state.lights.strobes },
      { text: 'Landing Light → OFF',              hl: 'sw-land-light',  check: () => !state.lights.landing },
    ]
  },

  'shutdown': {
    title: 'Engine Shutdown',
    steps: [
      { text: 'Throttle → IDLE',                   hl: 'throttle-track', check: () => state.engine.throttle < 0.08 },
      { text: 'Avionics Master → OFF',             hl: 'sw-avionics',    check: () => !state.electrical.avionics },
      { text: 'Landing Light → OFF',               hl: 'sw-land-light',  check: () => !state.lights.landing },
      { text: 'Strobes → OFF',                     hl: 'sw-strobes',     check: () => !state.lights.strobes },
      { text: 'Mixture → CUT OFF (full aft)',      hl: 'mixture-track',  check: () => state.engine.mixture < 0.05 },
      { text: 'Wait for engine to stop',           hl: null,             check: () => !state.engine.running },
      { text: 'Magneto → OFF',                     hl: 'magneto-wrap',   check: () => state.engine.magnetos === 0 },
      { text: 'Nav Lights → OFF',                  hl: 'sw-nav-light',   check: () => !state.lights.nav },
      { text: 'Beacon → OFF',                      hl: 'sw-beacon',      check: () => !state.lights.beacon },
      { text: 'Battery Master → OFF',              hl: 'sw-battery',     check: () => !state.electrical.battery },
      { text: 'Parking Brake → SET',              hl: 'park-brake',     check: () => state.parkingBrake },
    ]
  },

  'engine-failure': {
    title: 'Engine Failure (In Flight)',
    steps: [
      { text: 'Fuel Selector → BOTH',              hl: 'fuel-sel-wrap',  check: () => state.fuel.selector === 'BOTH' },
      { text: 'Mixture → RICH',                    hl: 'mixture-track',  check: () => state.engine.mixture > 0.9 },
      { text: 'Carb Heat → ON',                    hl: 'carbheat-track', check: () => state.engine.carbHeat },
      { text: 'Magneto → BOTH',                    hl: 'magneto-wrap',   check: () => state.engine.magnetos === 3 },
      { text: 'Electric Fuel Pump → ON',           hl: 'sw-fuel-pump',   check: () => state.electrical.fuelPump },
      { text: 'Throttle → try small advance',      hl: 'throttle-track', check: () => state.engine.throttle > 0.05 },
      { text: 'If no restart → Mayday × 3',        hl: null,             check: () => !state.engine.running || state.engine.rpm > 500 },
      { text: 'Avionics Master → OFF',             hl: 'sw-avionics',    check: () => !state.electrical.avionics },
      { text: 'Fuel Selector → OFF',               hl: 'fuel-sel-wrap',  check: () => state.fuel.selector === 'OFF' },
      { text: 'Magneto → OFF',                     hl: 'magneto-wrap',   check: () => state.engine.magnetos === 0 },
      { text: 'Battery Master → OFF (on short final)', hl: 'sw-battery', check: () => !state.electrical.battery },
    ]
  },
};

/* ── Flow engine ─────────────────────────────────────────── */

function startFlow(key) {
  _flow = FLOWS[key] || null;
  _step = 0;
  _testDone = false;
  _testMode = (document.getElementById('flow-mode')?.value === 'test');
  _clearHighlight();
  if (_flow) {
    _renderFlowPanel();
    const modeLabel = _testMode ? 'TEST' : 'GUIDED';
    showToast(`[${modeLabel}] ${_flow.title} — ${_testMode ? 'complete from memory' : 'follow the highlights'}`, 3500);
  }
}

function stopFlow() {
  _clearHighlight();
  _flow = null;
  _testDone = false;
  _renderFlowPanel();
}

function tickFlow() {
  if (!_flow || _testMode) return;   // test mode: no auto-advance, no highlights
  const steps = _flow.steps;
  if (_step >= steps.length) return;

  const s = steps[_step];
  if (_hlId !== s.hl) {
    _clearHighlight();
    _hlId = s.hl;
    if (s.hl) document.getElementById(s.hl)?.classList.add('flow-target');
  }

  try {
    if (s.check()) {
      _clearHighlight();
      _step++;
      if (_step >= steps.length) {
        showToast(_flow.title + ' — complete! ✓', 4000);
        stopFlow();
      } else {
        _renderFlowPanel();
      }
    }
  } catch (_) {}
}

function _clearHighlight() {
  if (_hlId) { document.getElementById(_hlId)?.classList.remove('flow-target'); _hlId = null; }
}

/* ── Test mode ───────────────────────────────────────────── */

function finishTest() {
  if (!_flow) return;
  _testDone = true;
  _clearHighlight();
  _renderFlowPanel();
}

function _evalTest() {
  const steps = _flow.steps;
  return steps.map(s => {
    let passed = false;
    try { passed = !!s.check(); } catch (_) {}
    return { text: s.text, passed };
  });
}

/* ── Panel rendering ─────────────────────────────────────── */

function _renderFlowPanel() {
  const panel = document.getElementById('flow-panel');
  if (!panel) return;

  if (!_flow) { panel.style.display = 'none'; return; }
  panel.style.display = 'flex';

  const titleEl = document.getElementById('flow-title');
  if (titleEl) titleEl.textContent = (_testMode ? '🧪 TEST: ' : '') + _flow.title;

  // Test mode — results view
  if (_testMode && _testDone) {
    _renderTestResults();
    return;
  }

  // Test mode — in-progress view
  if (_testMode) {
    const list = document.getElementById('flow-steps');
    if (list) list.innerHTML = '<div class="flow-step fs-test-msg">Complete the checklist from memory.<br>No hints shown in test mode.</div>';
    const bar = document.getElementById('flow-bar');
    if (bar) bar.style.width = '0%';
    const lbl = document.getElementById('flow-prog-lbl');
    if (lbl) lbl.textContent = _flow.steps.length + ' steps';

    const stopEl = document.getElementById('flow-stop');
    if (stopEl) stopEl.style.display = 'none';

    // Show finish button
    let fin = document.getElementById('flow-finish-test');
    if (!fin) {
      fin = document.createElement('button');
      fin.id = 'flow-finish-test';
      fin.className = 'flow-finish-btn';
      fin.textContent = '✓ Finish & Score';
      fin.addEventListener('click', finishTest);
      panel.appendChild(fin);
    }
    fin.style.display = '';
    return;
  }

  // Guided mode — normal windowed view
  const stopEl = document.getElementById('flow-stop');
  if (stopEl) stopEl.style.display = '';
  const fin = document.getElementById('flow-finish-test');
  if (fin) fin.style.display = 'none';

  const list = document.getElementById('flow-steps');
  if (!list) return;
  list.innerHTML = '';

  const steps = _flow.steps;
  const from  = Math.max(0, _step - 2);
  const to    = Math.min(steps.length, _step + 5);

  steps.slice(from, to).forEach((s, rel) => {
    const i   = from + rel;
    const done = i < _step, cur = i === _step;
    const div = document.createElement('div');
    div.className = 'flow-step' + (done ? ' fs-done' : cur ? ' fs-cur' : ' fs-pend');
    div.textContent = (done ? '✓ ' : cur ? '▶ ' : '  ') + s.text;
    list.appendChild(div);
  });

  const bar = document.getElementById('flow-bar');
  if (bar) bar.style.width = ((_step / steps.length) * 100) + '%';
  const lbl = document.getElementById('flow-prog-lbl');
  if (lbl) lbl.textContent = _step + ' / ' + steps.length;
}

function _renderTestResults() {
  const results = _evalTest();
  const passed  = results.filter(r => r.passed).length;
  const total   = results.length;
  const score   = Math.round(passed / total * 100);
  const stars   = score >= 90 ? '★★★★★' : score >= 75 ? '★★★★☆' : score >= 60 ? '★★★☆☆' : score >= 40 ? '★★☆☆☆' : '★☆☆☆☆';

  const list = document.getElementById('flow-steps');
  if (!list) return;
  list.innerHTML = '';

  // Score header
  const hdr = document.createElement('div');
  hdr.className = 'fs-test-score';
  hdr.innerHTML = `<span style="color:${score>=75?'#00cc44':score>=50?'#ffcc00':'#ff4422'}">${score}%</span> ${stars}`;
  list.appendChild(hdr);

  // Per-step results
  results.forEach(r => {
    const div = document.createElement('div');
    div.className = 'flow-step ' + (r.passed ? 'fs-done' : 'fs-test-fail');
    div.textContent = (r.passed ? '✓ ' : '✗ ') + r.text;
    list.appendChild(div);
  });

  // Improvement hints
  const failed = results.filter(r => !r.passed);
  if (failed.length) {
    const hint = document.createElement('div');
    hint.className = 'fs-test-hint';
    hint.textContent = 'Review: ' + failed.map(r => r.text.split('→')[0].trim()).join(', ');
    list.appendChild(hint);
  }

  const bar = document.getElementById('flow-bar');
  if (bar) bar.style.width = score + '%';
  const lbl = document.getElementById('flow-prog-lbl');
  if (lbl) lbl.textContent = passed + ' / ' + total;

  // Show stop/close, hide finish button
  const stopEl = document.getElementById('flow-stop');
  if (stopEl) stopEl.style.display = '';
  const fin = document.getElementById('flow-finish-test');
  if (fin) fin.style.display = 'none';
}

/* ── Init ────────────────────────────────────────────────── */

function initFlows() {
  document.getElementById('btn-flow-start')?.addEventListener('click', () => {
    if (_flow) { stopFlow(); return; }
    const sel = document.getElementById('flow-select');
    if (sel?.value) startFlow(sel.value);
  });
  document.getElementById('flow-stop')?.addEventListener('click', stopFlow);
  _renderFlowPanel();
}
