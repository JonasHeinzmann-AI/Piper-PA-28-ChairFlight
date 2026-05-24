/* Engine audio — Web Audio API synthesis
   Boots on first user gesture (browser policy).
   Lycoming O-320: 4-cyl 4-stroke → 2 power strokes/rev → firing freq = RPM/30 Hz */

let _audioCtx = null, _osc1 = null, _osc2 = null, _engGain = null, _engFilter = null, _audioReady = false;

function initAudio() {
  const boot = () => {
    if (_audioReady) return;
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Two sawtooth oscillators, slightly detuned — beating gives organic engine texture
    _osc1 = _audioCtx.createOscillator(); _osc1.type = 'sawtooth'; _osc1.frequency.value = 22;
    _osc2 = _audioCtx.createOscillator(); _osc2.type = 'sawtooth'; _osc2.frequency.value = 23;

    // Low-pass filter keeps the sound bassy and suppresses harsh high harmonics
    _engFilter = _audioCtx.createBiquadFilter();
    _engFilter.type = 'lowpass'; _engFilter.frequency.value = 150; _engFilter.Q.value = 0.9;

    _engGain = _audioCtx.createGain(); _engGain.gain.value = 0;

    _osc1.connect(_engFilter); _osc2.connect(_engFilter);
    _engFilter.connect(_engGain); _engGain.connect(_audioCtx.destination);
    _osc1.start(); _osc2.start();
    _audioReady = true;
  };
  document.addEventListener('pointerdown', boot);
  document.addEventListener('keydown', boot);
}

function tickAudio() {
  if (!_audioReady) return;
  const rpm = state.engine.rpm;
  const t = _audioCtx.currentTime;

  const freq = Math.max(8, rpm / 30);
  _osc1.frequency.setTargetAtTime(freq,         t, 0.05);
  _osc2.frequency.setTargetAtTime(freq * 1.015, t, 0.05); // 1.5% detune for beating effect

  // Volume: ramp with RPM, gated by KMA-20 volume slider
  const vol = (document.getElementById('kma-vol')?.value ?? 75) / 100;
  const g = rpm > 60 ? Math.min(0.4, (rpm / 2750) * 0.4) * vol : 0;
  _engGain.gain.setTargetAtTime(g, t, 0.1);

  // Brighter filter cutoff at higher power settings
  _engFilter.frequency.setTargetAtTime(110 + (rpm / 2750) * 300, t, 0.1);
}
