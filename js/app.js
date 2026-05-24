/* Main app — init and animation loop */

let _cockpitNatW = 0, _cockpitNatH = 0;

function fitCockpit() {
  const cockpit = document.getElementById('cockpit');
  if (!cockpit) return;
  // Measure natural (un-zoomed) size once, then cache it
  if (!_cockpitNatW) {
    cockpit.style.zoom = '1';
    _cockpitNatW = cockpit.offsetWidth  || 1;
    _cockpitNatH = cockpit.offsetHeight || 1;
  }
  const sb   = document.getElementById('save-bar');
  const avW  = window.innerWidth  - 8;
  const avH  = window.innerHeight - (sb ? sb.offsetHeight : 36) - 8;
  const z    = Math.min(avW / _cockpitNatW, avH / _cockpitNatH, 2.6);
  cockpit.style.zoom = Math.max(0.4, z).toFixed(4);
}

window.addEventListener('DOMContentLoaded', () => {
  initControls();
  drawAllInstruments();
  fitCockpit();
  window.addEventListener('resize', fitCockpit);
  requestAnimationFrame(loop);
});

function loop(nowMs) {
  systemsTick(nowMs);
  tickTrim();
  drawAllInstruments();
  updateAvionicsState();
  updateGTX();
  requestAnimationFrame(loop);
}
