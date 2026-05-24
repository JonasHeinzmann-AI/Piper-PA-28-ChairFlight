/* Guided procedure flows — highlights next control, auto-advances on completion */

let _flow = null;    // active flow object
let _step = 0;       // current step index
let _hlId = null;    // currently highlighted element id

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
      { text: 'Oil Pressure → rising (30 sec)',   hl: 'oil-press',      check: () => state.engine.oilPressurePsi > 20 },
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

  'shutdown': {
    title: 'Engine Shutdown',
    steps: [
      { text: 'Throttle → IDLE',                  hl: 'throttle-track', check: () => state.engine.throttle < 0.08 },
      { text: 'Avionics Master → OFF',            hl: 'sw-avionics',    check: () => !state.electrical.avionics },
      { text: 'Landing Light → OFF',              hl: 'sw-land-light',  check: () => !state.lights.landing },
      { text: 'Strobes → OFF',                    hl: 'sw-strobes',     check: () => !state.lights.strobes },
      { text: 'Mixture → CUT OFF (full aft)',     hl: 'mixture-track',  check: () => state.engine.mixture < 0.05 },
      { text: 'Wait for engine to stop',          hl: null,             check: () => !state.engine.running },
      { text: 'Magneto → OFF',                    hl: 'magneto-wrap',   check: () => state.engine.magnetos === 0 },
      { text: 'Nav Lights → OFF',                 hl: 'sw-nav-light',   check: () => !state.lights.nav },
      { text: 'Beacon → OFF',                     hl: 'sw-beacon',      check: () => !state.lights.beacon },
      { text: 'Battery Master → OFF',             hl: 'sw-battery',     check: () => !state.electrical.battery },
      { text: 'Parking Brake → SET',              hl: 'park-brake',     check: () => state.parkingBrake },
    ]
  },
};

/* ── Flow engine ─────────────────────────────────────────── */

function startFlow(key) {
  _flow = FLOWS[key] || null;
  _step = 0;
  _clearHighlight();
  if (_flow) {
    _renderFlowPanel();
    showToast('Flow: ' + _flow.title + ' — follow the highlights', 3500);
  }
}

function stopFlow() {
  _clearHighlight();
  _flow = null;
  _renderFlowPanel();
}

function tickFlow() {
  if (!_flow) return;
  const steps = _flow.steps;
  if (_step >= steps.length) return;

  const s = steps[_step];

  // Apply / maintain highlight
  if (_hlId !== s.hl) {
    _clearHighlight();
    _hlId = s.hl;
    if (s.hl) document.getElementById(s.hl)?.classList.add('flow-target');
  }

  // Check completion
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

/* ── Panel rendering ─────────────────────────────────────── */

function _renderFlowPanel() {
  const panel = document.getElementById('flow-panel');
  if (!panel) return;

  if (!_flow) { panel.style.display = 'none'; return; }
  panel.style.display = 'flex';

  // Title
  const titleEl = document.getElementById('flow-title');
  if (titleEl) titleEl.textContent = _flow.title;

  // Steps list (show a window: 2 done + current + next 4)
  const list = document.getElementById('flow-steps');
  if (!list) return;
  list.innerHTML = '';

  const steps = _flow.steps;
  const from  = Math.max(0, _step - 2);
  const to    = Math.min(steps.length, _step + 5);

  steps.slice(from, to).forEach((s, rel) => {
    const i   = from + rel;
    const div = document.createElement('div');
    const done = i < _step, cur = i === _step;
    div.className = 'flow-step' + (done ? ' fs-done' : cur ? ' fs-cur' : ' fs-pend');
    div.textContent = (done ? '✓ ' : cur ? '▶ ' : '  ') + s.text;
    list.appendChild(div);
  });

  // Progress bar
  const bar = document.getElementById('flow-bar');
  if (bar) bar.style.width = ((_step / steps.length) * 100) + '%';
  const lbl = document.getElementById('flow-prog-lbl');
  if (lbl) lbl.textContent = _step + ' / ' + steps.length;
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
