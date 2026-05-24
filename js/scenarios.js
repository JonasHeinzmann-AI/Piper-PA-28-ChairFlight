/* Scenario presets — one-click cockpit states for chairflying drills */

const SCENARIOS = [
  {
    key: 'ready-start',
    label: 'Ready to Start',
    setup() {
      resetState();
      state.electrical.battery    = true;
      state.electrical.alternator = true;
      state.engine.mixture        = 1.0;
      state.engine.throttle       = 0.12;
      state.fuel.selector         = 'BOTH';
      state.parkingBrake          = true;
      state.flight.altitudeFt     = 1493; // EDMA field elevation
    }
  },
  {
    key: 'engine-idle',
    label: 'Engine Running — Idle',
    setup() {
      resetState();
      state.electrical.battery    = true;
      state.electrical.alternator = true;
      state.electrical.avionics   = true;
      state.engine.magnetos       = 3;
      state.engine.mixture        = 1.0;
      state.engine.throttle       = 0.05;
      state.engine.running        = true;
      state.engine.rpm            = 700;
      state.engine.oilTempF       = 155;
      state.engine.oilPressurePsi = 42;
      state.fuel.selector         = 'BOTH';
      state.parkingBrake          = true;
      state.lights.beacon         = true;
      state.radios.xpdr.mode      = 'STBY';
      state.flight.altitudeFt     = 1493;
      state.flight.baroInHg       = 29.92;
    }
  },
  {
    key: 'before-takeoff',
    label: 'Before Takeoff Checks',
    setup() {
      resetState();
      state.electrical.battery    = true;
      state.electrical.alternator = true;
      state.electrical.avionics   = true;
      state.engine.magnetos       = 3;
      state.engine.mixture        = 1.0;
      state.engine.throttle       = 0.05;
      state.engine.running        = true;
      state.engine.rpm            = 750;
      state.engine.oilTempF       = 185;
      state.engine.oilPressurePsi = 45;
      state.fuel.selector         = 'BOTH';
      state.flaps                 = 0;
      state.trimPct               = 50;
      state.parkingBrake          = true;
      state.lights.nav            = true;
      state.lights.beacon         = true;
      state.lights.strobes        = true;
      state.radios.xpdr.mode      = 'ALT';
      state.radios.xpdr.code      = 7000;
      state.flight.altitudeFt     = 1493;
      state.flight.headingDeg     = 260;
      state.flight.baroInHg       = 29.92;
    }
  },
  {
    key: 'cruise',
    label: 'Cruise — FL085',
    setup() {
      resetState();
      state.electrical.battery    = true;
      state.electrical.alternator = true;
      state.electrical.avionics   = true;
      state.engine.magnetos       = 3;
      state.engine.mixture        = 0.65;
      state.engine.throttle       = 0.78;
      state.engine.running        = true;
      state.engine.rpm            = 2350;
      state.engine.oilTempF       = 190;
      state.engine.oilPressurePsi = 50;
      state.fuel.leftGal          = 18;
      state.fuel.rightGal         = 18;
      state.fuel.selector         = 'BOTH';
      state.flaps                 = 0;
      state.trimPct               = 48;
      state.parkingBrake          = false;
      state.lights.nav            = true;
      state.lights.beacon         = true;
      state.lights.strobes        = true;
      state.lights.pitotHeat      = true;
      state.radios.xpdr.mode      = 'ALT';
      state.radios.xpdr.code      = 7000;
      state.flight.altitudeFt     = 8500;
      state.flight.iasKts         = 105;
      state.flight.headingDeg     = 360;
      state.flight.baroInHg       = 29.92;
    }
  },
  {
    key: 'downwind',
    label: 'Downwind Leg (RWY 26)',
    setup() {
      resetState();
      state.electrical.battery    = true;
      state.electrical.alternator = true;
      state.electrical.avionics   = true;
      state.engine.magnetos       = 3;
      state.engine.mixture        = 1.0;
      state.engine.throttle       = 0.45;
      state.engine.running        = true;
      state.engine.rpm            = 2000;
      state.engine.oilTempF       = 185;
      state.engine.oilPressurePsi = 48;
      state.fuel.selector         = 'BOTH';
      state.flaps                 = 10;
      state.trimPct               = 52;
      state.parkingBrake          = false;
      state.lights.nav            = true;
      state.lights.beacon         = true;
      state.lights.strobes        = true;
      state.lights.landing        = true;
      state.radios.xpdr.mode      = 'ALT';
      state.flight.altitudeFt     = 2000;
      state.flight.iasKts         = 90;
      state.flight.headingDeg     = 80;
      state.flight.baroInHg       = 29.92;
    }
  },
  {
    key: 'short-final',
    label: 'Short Final (RWY 26)',
    setup() {
      resetState();
      state.electrical.battery    = true;
      state.electrical.alternator = true;
      state.electrical.avionics   = true;
      state.engine.magnetos       = 3;
      state.engine.mixture        = 1.0;
      state.engine.throttle       = 0.22;
      state.engine.running        = true;
      state.engine.rpm            = 1600;
      state.engine.oilTempF       = 185;
      state.engine.oilPressurePsi = 45;
      state.fuel.selector         = 'BOTH';
      state.flaps                 = 40;
      state.trimPct               = 35;
      state.parkingBrake          = false;
      state.lights.nav            = true;
      state.lights.beacon         = true;
      state.lights.strobes        = true;
      state.lights.landing        = true;
      state.radios.xpdr.mode      = 'ALT';
      state.flight.altitudeFt     = 350;
      state.flight.iasKts         = 70;
      state.flight.headingDeg     = 260;
      state.flight.vsiFpm         = -600;
      state.flight.baroInHg       = 29.92;
    }
  },
];

function initScenarios() {
  const sel = document.getElementById('scenario-select');
  if (!sel) return;
  SCENARIOS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.key;
    opt.textContent = s.label;
    sel.appendChild(opt);
  });
  document.getElementById('btn-scenario')?.addEventListener('click', () => {
    const s = SCENARIOS.find(x => x.key === sel.value);
    if (!s) return;
    s.setup();
    syncAllFromState();
    showToast('Scenario loaded: ' + s.label, 3500);
  });
}
