/* Aircraft State — single source of truth */

const DEFAULT_STATE = {
  electrical: {
    battery: false,
    alternator: false,
    avionics: false,
    fuelPump: false,  // electric (auxiliary) fuel pump
    voltage: 0,       // volts
    amperage: 0,      // amps
  },
  engine: {
    magnetos: 0,      // 0=OFF 1=R 2=L 3=BOTH 4=START
    throttle: 0,      // 0–1  (idle/closed)
    mixture: 0,       // 0=CUTOFF, 1=RICH  — cold & dark = cut
    carbHeat: false,
    primerPumps: 0,
    primerOut: false,
    running: false,
    starting: false,
    rpm: 0,
    targetRpm: 0,
    oilTempF: 60,
    oilPressurePsi: 0,
    chtF: 60,
    egtF: 0,
    fuelFlowGph: 0,
  },
  fuel: {
    selector: 'BOTH',
    leftGal: 24,
    rightGal: 24,
  },
  flight: {
    iasKts: 0,
    altitudeFt: 1000,
    vsiFpm: 0,
    headingDeg: 360,
    bankDeg: 0,
    pitchDeg: 2,
    baroInHg: 29.92,
  },
  lights: {
    nav: false,
    landing: false,
    beacon: false,
    strobes: false,
    panel: false,
    pitotHeat: false,
  },
  flaps: 0,
  parkingBrake: true,   // always parked on cold & dark
  trimPct: 50,
  radios: {
    com1: { active: 118.000, standby: 121.500 },
    com2: { active: 119.900, standby: 122.800 },
    nav1: { active: 113.600, standby: 108.000 },
    nav2: { active: 110.600, standby: 108.000 },
    xpdr: { code: 1200, mode: 'STBY', identActive: false },
  },
  nav: {
    obs1: 270,         // OBS course selector (degrees)
    vor1Radial: 90,    // simulated radial aircraft is currently on (FROM the VOR station)
  },
  circuitBreakers: {
    // name: tripped?
    'AVIONICS': false,
    'LIGHTS': false,
    'FUEL PUMP': false,
    'PITOT HEAT': false,
    'COMM 1': false,
    'COMM 2': false,
    'NAV 1': false,
    'NAV 2': false,
    'XPDR': false,
    'INSTR LTS': false,
    'FLAPS': false,
    'TRIM': false,
    'TURN COORD': false,
    'GYRO': false,
    'ELT': false,
  },
};

// Deep clone helper
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// The live state
let state = deepClone(DEFAULT_STATE);

// ── Persistence ──────────────────────────────────────────
function saveState(slot) {
  try {
    const key = `pa28_state_slot${slot}`;
    const payload = {
      ts: new Date().toISOString(),
      state: deepClone(state),
    };
    localStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error('Save failed:', e);
    return false;
  }
}

function loadState(slot) {
  try {
    const key = `pa28_state_slot${slot}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    // Merge to handle schema changes gracefully
    state = deepMerge(deepClone(DEFAULT_STATE), payload.state);
    return payload.ts;
  } catch (e) {
    console.error('Load failed:', e);
    return null;
  }
}

function resetState() {
  state = deepClone(DEFAULT_STATE);
}

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(target)) {
    if (key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  return target;
}

function hasSaveState(slot) {
  return !!localStorage.getItem(`pa28_state_slot${slot}`);
}

function getSaveInfo(slot) {
  try {
    const raw = localStorage.getItem(`pa28_state_slot${slot}`);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return { ts: p.ts };
  } catch { return null; }
}
