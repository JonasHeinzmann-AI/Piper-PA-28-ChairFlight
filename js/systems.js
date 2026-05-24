/* Aircraft Systems Simulation
   Runs a simple physics/avionics model step every frame.
   All time is in seconds. */

let lastTime = null;
let engineStartTimer = 0;

const ENG = {
  IDLE_RPM: 650,
  MAX_RPM: 2750,
  FUEL_FLOW_CRUISE_GPH: 8.5,  // at full throttle, rich mixture
  OIL_WARM_RATE: 3,           // °F per second when running
  OIL_COOL_RATE: 0.5,
  OIL_NORMAL_TEMP: 190,
  OIL_MIN_RUNNING_PRESS: 25,
  OIL_MAX_PRESS: 60,
  RPM_SPOOL_RATE: 200,        // RPM/sec max change
};

function systemsTick(nowMs) {
  if (lastTime === null) { lastTime = nowMs; return; }
  const dt = Math.min((nowMs - lastTime) / 1000, 0.1); // seconds, capped
  lastTime = nowMs;

  tickElectrical(dt);
  tickEngine(dt);
  tickFuel(dt);
  tickAnnunciators();
  updateStatusBar();
}

/* ── Electrical ──────────────────────────────────────────── */
function tickElectrical(dt) {
  const bat = state.electrical.battery;
  const alt = state.electrical.alternator;
  const eng = state.engine.running;

  if (!bat) {
    state.electrical.voltage = 0;
    state.electrical.amperage = 0;
    return;
  }

  // Voltage: alternator provides 14V when engine running, battery alone = 12V
  if (alt && eng) {
    state.electrical.voltage = 13.8 + (state.engine.rpm > 1000 ? 0.4 : 0);
  } else {
    state.electrical.voltage = 11.8 + (state.fuel.leftGal + state.fuel.rightGal > 2 ? 0.2 : 0);
  }

  // Amperage (positive = charging, negative = discharging)
  // CBs gate whether lights actually draw current
  const lightsCb  = !state.circuitBreakers['LIGHTS'];
  const pitotCb   = !state.circuitBreakers['PITOT HEAT'];
  if (alt && eng) {
    state.electrical.amperage = 10
      + (state.lights.landing && lightsCb ? 5 : 0)
      + (state.lights.pitotHeat && pitotCb ? 3 : 0);
  } else {
    state.electrical.amperage = -(3
      + (state.lights.nav && lightsCb ? 1 : 0)
      + (state.lights.landing && lightsCb ? 5 : 0));
  }

  document.getElementById('ann-volt').classList.toggle('active', state.electrical.voltage < 12.5);
}

/* ── Engine ──────────────────────────────────────────────── */
function tickEngine(dt) {
  const bat = state.electrical.battery;
  const mag = state.engine.magnetos;  // 0=OFF 1=R 2=L 3=BOTH 4=START
  const throttle = state.engine.throttle;
  const mixture = state.engine.mixture;

  // Fuel available?
  const fuelAvail = fuelIsAvailable();

  // Compute target RPM
  let targetRpm = 0;
  if (state.engine.running && fuelAvail) {
    const carbPenalty    = state.engine.carbHeat ? 0.95 : 1.0;
    const mixturePenalty = mixture < 0.15 ? 0 : (mixture < 0.5 ? 0.85 : 1.0);
    const richPenalty    = (mixture > 0.9 && state.flight.altitudeFt > 8000) ? 0.97 : 1.0;
    // Single-magneto operation (L or R only): ~6% drop — ~100 RPM at runup, visible at idle too
    const magPenalty     = (mag === 1 || mag === 2) ? 0.94 : 1.0;
    targetRpm = (ENG.IDLE_RPM + (ENG.MAX_RPM - ENG.IDLE_RPM) * Math.pow(throttle, 0.8))
      * carbPenalty * mixturePenalty * richPenalty * magPenalty;
  }

  // Engine start sequence
  if (mag === 4 && bat && !state.engine.running) {
    // Cranking
    if (!state.engine.starting) {
      state.engine.starting = true;
      engineStartTimer = 0;
      showToast('Engaging starter...');
    }
    engineStartTimer += dt;
    state.engine.rpm = Math.min(200, state.engine.rpm + 50 * dt);

    const hasFuel = fuelAvail;
    const warmEnough = state.engine.oilTempF >= 60;

    if (engineStartTimer > 1.5 && hasFuel && warmEnough) {
      // Engine catches — auto-return magneto from START to BOTH
      state.engine.running = true;
      state.engine.starting = false;
      engineStartTimer = 0;
      setMagneto(3);
      showToast('Engine started!');
    } else if (engineStartTimer > 4) {
      // Failed to start
      state.engine.starting = false;
      engineStartTimer = 0;
      state.engine.rpm = 0;
      showToast('Engine failed to start. Check primer / mixture / fuel.');
    }
  }

  if (mag !== 4) {
    state.engine.starting = false;
  }

  // Engine stops if mags off, fuel gone, mixture cut, or battery off during start
  if (state.engine.running) {
    if (mag === 0 || !fuelAvail || mixture < 0.1) {
      state.engine.running = false;
      if (mag === 0) showToast('Magnetos OFF — engine stopped.');
      if (!fuelAvail) showToast('Fuel exhausted — engine stopped!');
      if (mixture < 0.1) showToast('Mixture cut — engine stopped.');
    }
  }

  // Smooth RPM
  const rpmDiff = targetRpm - state.engine.rpm;
  state.engine.rpm += Math.sign(rpmDiff) * Math.min(Math.abs(rpmDiff), ENG.RPM_SPOOL_RATE * dt);
  state.engine.rpm = Math.max(0, state.engine.rpm);

  // Oil temperature
  if (state.engine.running) {
    const rpmFactor = state.engine.rpm / ENG.MAX_RPM;
    const targetTemp = 100 + rpmFactor * (ENG.OIL_NORMAL_TEMP - 100);
    const diff = targetTemp - state.engine.oilTempF;
    state.engine.oilTempF += diff * ENG.OIL_WARM_RATE * dt * 0.05;
  } else {
    // Cool toward ambient (60°F)
    state.engine.oilTempF += (60 - state.engine.oilTempF) * ENG.OIL_COOL_RATE * dt * 0.02;
  }

  // Oil pressure
  if (state.engine.running) {
    const rpmFactor = Math.min(1, state.engine.rpm / 1000);
    state.engine.oilPressurePsi = 25 + rpmFactor * 25 + (state.engine.oilTempF > 180 ? -5 : 0);
  } else {
    state.engine.oilPressurePsi = Math.max(0, state.engine.oilPressurePsi - 10 * dt);
  }

  // Fuel flow
  if (state.engine.running && fuelAvail) {
    const throttleFactor = 0.3 + throttle * 0.7;
    state.engine.fuelFlowGph = ENG.FUEL_FLOW_CRUISE_GPH * throttleFactor * mixture;
  } else {
    state.engine.fuelFlowGph = 0;
  }

  // Annunciator
  document.getElementById('ann-oil').classList.toggle('active',
    state.engine.running && state.engine.oilPressurePsi < 25);
}

/* ── Fuel ────────────────────────────────────────────────── */
function tickFuel(dt) {
  const gph = state.engine.fuelFlowGph;
  if (gph <= 0) return;

  const gpsec = gph / 3600;
  const sel = state.fuel.selector;

  if (sel === 'BOTH') {
    // Draw equally from both
    const half = gpsec / 2;
    state.fuel.leftGal = Math.max(0, state.fuel.leftGal - half * dt);
    state.fuel.rightGal = Math.max(0, state.fuel.rightGal - half * dt);
  } else if (sel === 'LEFT') {
    state.fuel.leftGal = Math.max(0, state.fuel.leftGal - gpsec * dt);
  } else if (sel === 'RIGHT') {
    state.fuel.rightGal = Math.max(0, state.fuel.rightGal - gpsec * dt);
  }

  // Low fuel annunciator
  const lowFuel = state.fuel.leftGal < 4 || state.fuel.rightGal < 4;
  document.getElementById('ann-lowfuel').classList.toggle('active', lowFuel);
}

function fuelIsAvailable() {
  const sel = state.fuel.selector;
  if (sel === 'OFF') return false;
  if (sel === 'LEFT') return state.fuel.leftGal > 0.1;
  if (sel === 'RIGHT') return state.fuel.rightGal > 0.1;
  if (sel === 'BOTH') return (state.fuel.leftGal + state.fuel.rightGal) > 0.1;
  return false;
}

/* ── Annunciators ────────────────────────────────────────── */
function tickAnnunciators() {
  // GEAR DOWN always green (fixed gear)
  document.getElementById('ann-gear').classList.add('active');
  // PITOT HEAT off warning — also fires if CB is tripped even when switch is ON
  const pitotEffective = state.lights.pitotHeat && !state.circuitBreakers['PITOT HEAT'];
  document.getElementById('ann-pitot').classList.toggle('active',
    !pitotEffective && state.flight.altitudeFt > 3000);
}

/* ── Status Bar ──────────────────────────────────────────── */
function updateStatusBar() {
  const el = id => document.getElementById(id);
  const set = (id, txt, cls) => { const e = el(id); if (!e) return; e.textContent = txt; if (cls) e.className = cls; };

  if (state.engine.running)        set('st-engine', 'RUNNING',  'st-val running');
  else if (state.engine.starting)  set('st-engine', 'STARTING', 'st-val');
  else                             set('st-engine', 'OFF',      'st-val off');

  set('st-rpm',    Math.round(state.engine.rpm).toLocaleString());
  set('st-ias',    Math.round(state.flight.iasKts) + ' kt');
  set('st-alt',    Math.round(state.flight.altitudeFt).toLocaleString() + ' ft');
  set('st-hdg',    Math.round(state.flight.headingDeg % 360).toString().padStart(3,'0') + '°');
  set('st-fuel-l', state.fuel.leftGal.toFixed(1) + ' gal');
  set('st-fuel-r', state.fuel.rightGal.toFixed(1) + ' gal');
  set('st-oil',    Math.round(state.engine.oilTempF) + '°F');
  set('st-baro',   state.flight.baroInHg.toFixed(2));

  const now = new Date();
  set('st-time',
    now.getUTCHours().toString().padStart(2,'0') + ':' +
    now.getUTCMinutes().toString().padStart(2,'0') + ':' +
    now.getUTCSeconds().toString().padStart(2,'0') + 'Z');
}
