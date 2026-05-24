/* Failure injection — instructor-side panel for drilling emergency procedures */

const FAILURES = {
  'engine': {
    label: 'Engine Failure',
    detail: 'Fuel → OFF, engine winds down',
    active: false,
    inject() {
      state.fuel.selector = 'OFF';
      const lbl = document.getElementById('fuel-sel-label');
      if (lbl) lbl.textContent = 'OFF';
      showToast('FAILURE: Engine — fuel cut', 5000);
    },
    clear() {
      state.fuel.selector = 'BOTH';
      const lbl = document.getElementById('fuel-sel-label');
      if (lbl) lbl.textContent = 'BOTH';
    }
  },
  'alternator': {
    label: 'Alternator',
    detail: 'Alternator offline — battery drain',
    active: false,
    inject() {
      state.electrical.alternator = false;
      syncToggle('sw-alternator', false);
      showToast('FAILURE: Alternator', 5000);
    },
    clear() {
      state.electrical.alternator = true;
      syncToggle('sw-alternator', true);
    }
  },
  'gyro': {
    label: 'Vacuum / Gyro',
    detail: 'GYRO CB trips — G5 HSI goes dark',
    active: false,
    inject() {
      state.circuitBreakers['GYRO'] = true;
      buildCBPanel();
      showToast('FAILURE: Vacuum / Gyro', 5000);
    },
    clear() {
      state.circuitBreakers['GYRO'] = false;
      buildCBPanel();
    }
  },
  'turn-coord': {
    label: 'Turn Coordinator',
    detail: 'TURN COORD CB trips',
    active: false,
    inject() {
      state.circuitBreakers['TURN COORD'] = true;
      buildCBPanel();
      showToast('FAILURE: Turn Coordinator', 5000);
    },
    clear() {
      state.circuitBreakers['TURN COORD'] = false;
      buildCBPanel();
    }
  },
  'mag-l': {
    label: 'Left Magneto',
    detail: 'L mag dead — RPM drop on BOTH, stops on L alone',
    active: false,
    inject() {
      state.engine.magFailL = true;
      showToast('FAILURE: Left Magneto', 5000);
    },
    clear() { state.engine.magFailL = false; }
  },
  'mag-r': {
    label: 'Right Magneto',
    detail: 'R mag dead — RPM drop on BOTH, stops on R alone',
    active: false,
    inject() {
      state.engine.magFailR = true;
      showToast('FAILURE: Right Magneto', 5000);
    },
    clear() { state.engine.magFailR = false; }
  },
  'comm1': {
    label: 'COM1 Radio',
    detail: 'COMM 1 CB trips — COM1 dead',
    active: false,
    inject() {
      state.circuitBreakers['COMM 1'] = true;
      buildCBPanel();
      showToast('FAILURE: COM1 Radio', 5000);
    },
    clear() {
      state.circuitBreakers['COMM 1'] = false;
      buildCBPanel();
    }
  },
  'fuel-low': {
    label: 'Low Fuel',
    detail: 'Both tanks → 3.5 gal (low fuel warning)',
    active: false,
    inject() {
      state.fuel.leftGal  = 3.5;
      state.fuel.rightGal = 3.5;
      showToast('FAILURE: Low Fuel', 5000);
    },
    clear() {
      state.fuel.leftGal  = 24;
      state.fuel.rightGal = 24;
    }
  },
};

function buildFailuresPanel() {
  const panel = document.getElementById('failures-panel');
  if (!panel) return;

  const grid = panel.querySelector('.fail-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.entries(FAILURES).forEach(([key, f]) => {
    const btn = document.createElement('div');
    btn.className = 'fail-btn' + (f.active ? ' fail-active' : '');
    btn.id = 'fail-' + key;
    btn.title = f.detail;
    btn.innerHTML = `<span class="fail-name">${f.label}</span><span class="fail-detail">${f.detail}</span>`;
    btn.addEventListener('click', () => {
      f.active = !f.active;
      if (f.active) f.inject(); else f.clear();
      btn.classList.toggle('fail-active', f.active);
    });
    grid.appendChild(btn);
  });
}

function clearAllFailures() {
  Object.entries(FAILURES).forEach(([key, f]) => {
    if (!f.active) return;
    f.active = false;
    f.clear();
    document.getElementById('fail-' + key)?.classList.remove('fail-active');
  });
  showToast('All failures cleared');
}

function initFailures() {
  buildFailuresPanel();

  document.getElementById('btn-failures')?.addEventListener('click', () => {
    const p = document.getElementById('failures-panel');
    if (p) p.style.display = p.style.display === 'none' ? 'flex' : 'none';
  });
  document.getElementById('fail-close')?.addEventListener('click', () => {
    const p = document.getElementById('failures-panel');
    if (p) p.style.display = 'none';
  });
  document.getElementById('fail-clear-all')?.addEventListener('click', clearAllFailures);
}
