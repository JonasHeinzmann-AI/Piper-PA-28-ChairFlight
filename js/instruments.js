/* Instrument drawing — all Canvas-based
   Analog instruments ALWAYS draw their face (real instruments are always visible).
   Needles park at zero / minimum when unpowered.
   G5 electronic displays go dark when unpowered. */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// Polyfill roundRect for Safari < 15.4
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r){
    r=Math.min(r,w/2,h/2);
    this.moveTo(x+r,y);this.lineTo(x+w-r,y);this.arcTo(x+w,y,x+w,y+r,r);
    this.lineTo(x+w,y+h-r);this.arcTo(x+w,y+h,x+w-r,y+h,r);
    this.lineTo(x+r,y+h);this.arcTo(x,y+h,x,y+h-r,r);
    this.lineTo(x,y+r);this.arcTo(x,y,x+r,y,r);this.closePath();
  };
}

/* ── Helpers ─────────────────────────────────────────────── */
// Draw a plain instrument base — always visible regardless of power
function drawBase(ctx, size) {
  ctx.clearRect(0, 0, size, size);
  const r = size / 2;
  ctx.save();
  ctx.beginPath(); ctx.arc(r, r, r - 1, 0, TAU);
  ctx.fillStyle = '#0d0d0d';
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

function txt(ctx, x, y, text, style) {
  ctx.save(); Object.assign(ctx, style);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y); ctx.restore();
}

function polar(cx, cy, r, angleDeg) {
  const a = (angleDeg - 90) * DEG;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arc(ctx, cx, cy, r, a1, a2, color, w) {
  ctx.save(); ctx.beginPath();
  ctx.arc(cx, cy, r, (a1 - 90) * DEG, (a2 - 90) * DEG);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
}

function tick(ctx, cx, cy, r1, r2, angleDeg, color, w) {
  const p1 = polar(cx, cy, r1, angleDeg);
  const p2 = polar(cx, cy, r2, angleDeg);
  ctx.save(); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
}

function drawNeedle(ctx, cx, cy, angleDeg, len, baseW, color) {
  const tip  = polar(cx, cy, len, angleDeg);
  const tail = polar(cx, cy, -len * 0.14, angleDeg);
  ctx.save(); ctx.beginPath(); ctx.moveTo(tail.x, tail.y); ctx.lineTo(tip.x, tip.y);
  ctx.strokeStyle = color; ctx.lineWidth = baseW; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
}

function hub(ctx, cx, cy, r, color) {
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = color || '#aaa'; ctx.fill(); ctx.restore();
}

// Draw a "power-off" flag on an instrument — a small red diagonal bar
function noPowerFlag(ctx, cx, cy, R) {
  ctx.save();
  ctx.fillStyle = 'rgba(180,0,0,0.75)';
  ctx.beginPath(); ctx.roundRect(cx - 22, cy - 8, 44, 16, 3); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${R * 0.22}px Courier New`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('NO PWR', cx, cy); ctx.restore();
}

/* ── Airspeed Indicator ─────────────────────────────────── */
function ktsAng(kts) { return -150 + (Math.min(160, Math.max(0, kts)) / 160) * 300; }

function drawASI(hasPower, iasKts) {
  const cv = document.getElementById('asi'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const S = cv.width, cx = S/2, cy = S/2, R = S/2 - 4;
  drawBase(ctx, S);

  // Color arcs — always visible (PA-28-161 V-speeds)
  arc(ctx, cx, cy, R-7, ktsAng(44),  ktsAng(106), '#fff',    5);   // white  Vso-Vfe
  arc(ctx, cx, cy, R-13,ktsAng(51),  ktsAng(110), '#00cc44', 5);   // green  Vs1-Vno
  arc(ctx, cx, cy, R-13,ktsAng(110), ktsAng(127), '#ffcc00', 5);   // yellow Vno-Vne
  // Vne red radial
  const vne=polar(cx,cy,R-8,ktsAng(127)), vneI=polar(cx,cy,R-17,ktsAng(127));
  ctx.save(); ctx.beginPath(); ctx.moveTo(vne.x,vne.y); ctx.lineTo(vneI.x,vneI.y);
  ctx.strokeStyle='#ff2200'; ctx.lineWidth=2.5; ctx.stroke(); ctx.restore();

  // Ticks + numbers
  for (let k = 0; k <= 160; k += 10) {
    const long = k % 20 === 0;
    tick(ctx, cx, cy, R-3, long ? R-15 : R-9, ktsAng(k), '#bbb', long ? 1.5 : 1);
    if (long && k > 0) {
      const lp = polar(cx, cy, R-26, ktsAng(k));
      txt(ctx, lp.x, lp.y, k.toString(), { fillStyle:'#ccc', font:`bold ${S*.075}px Courier New` });
    }
  }
  txt(ctx, cx, cy + R*.54, 'KNOTS', { fillStyle:'#555', font:`${S*.065}px Courier New` });

  // Needle — parks at zero when no power
  const ang = hasPower ? ktsAng(iasKts) : ktsAng(0);
  const col = hasPower ? '#fff' : '#555';
  drawNeedle(ctx, cx, cy, ang, R-21, 2.5, col);
  hub(ctx, cx, cy, 5, '#aaa');
  if (!hasPower) noPowerFlag(ctx, cx, cy, R);
}

/* ── Garmin G5 PFD (AI) ─────────────────────────────────── */
function drawG5PFD(hasPower, pitchDeg, bankDeg) {
  const cv = document.getElementById('ai'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const S = cv.width, cx = S/2, cy = S/2, R = S/2 - 4;
  ctx.clearRect(0, 0, S, S);

  // Always clip to circle
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();

  if (!hasPower) {
    // Dark screen — it's an electronic instrument
    ctx.fillStyle = '#030503'; ctx.fillRect(0, 0, S, S);
    ctx.restore();
    // Dim G5 logo
    txt(ctx, cx, cy - 10, 'G5', { fillStyle:'#1e2a1e', font:`bold ${S*.26}px Arial` });
    txt(ctx, cx, cy + 16, 'GARMIN', { fillStyle:'#161e16', font:`bold ${S*.075}px Arial` });
    // Bezel ring
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU);
    ctx.strokeStyle='#0d1a0d'; ctx.lineWidth=2; ctx.stroke(); ctx.restore();
    return;
  }

  // Bank rotation transform (no save needed — we restore the clip layer later)
  ctx.translate(cx, cy);
  ctx.rotate(bankDeg * DEG);
  ctx.translate(-cx, -cy);

  const pxPerDeg = S * 0.027;
  const pOff = pitchDeg * pxPerDeg;

  // Sky
  const skyGrad = ctx.createLinearGradient(cx, cy + pOff, cx, cy + pOff - R);
  skyGrad.addColorStop(0,'#1a5faa'); skyGrad.addColorStop(1,'#0d3a77');
  ctx.fillStyle = skyGrad; ctx.fillRect(cx-R-5, cy-R-5, 2*R+10, R+5+pOff+5);

  // Earth
  const earthGrad = ctx.createLinearGradient(cx, cy+pOff, cx, cy+pOff+R);
  earthGrad.addColorStop(0,'#5a2d06'); earthGrad.addColorStop(1,'#3a1d04');
  ctx.fillStyle = earthGrad; ctx.fillRect(cx-R-5, cy+pOff, 2*R+10, R+10);

  // Horizon line
  ctx.save(); ctx.strokeStyle='#fff'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(cx-R,cy+pOff); ctx.lineTo(cx+R,cy+pOff); ctx.stroke(); ctx.restore();

  // Pitch ladder
  for (let p=-30; p<=30; p+=5) {
    if (p===0) continue;
    const y = cy + pOff - p*pxPerDeg;
    const w = p%10===0 ? 32 : 20;
    ctx.save(); ctx.strokeStyle='#fff'; ctx.lineWidth=p%10===0?1.5:1;
    ctx.beginPath(); ctx.moveTo(cx-w,y); ctx.lineTo(cx+w,y); ctx.stroke();
    if (p%10===0) {
      txt(ctx, cx+w+10, y, Math.abs(p).toString(), { fillStyle:'#fff', font:`${S*.065}px Arial` });
      txt(ctx, cx-w-10, y, Math.abs(p).toString(), { fillStyle:'#fff', font:`${S*.065}px Arial` });
    }
    ctx.restore();
  }

  ctx.restore(); // restores pre-bank state (removes clip + bank transform)

  // Fixed overlay (bank scale + airplane) — new clip
  ctx.save();
  ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();

  // Bank scale arc
  ctx.save(); ctx.strokeStyle='#888'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(cx,cy,R-4,(-150-90)*DEG,(-30-90)*DEG); ctx.stroke(); ctx.restore();

  // Bank ticks (fixed to instrument)
  [10,20,30,45,60].forEach(d => {
    [-d,d].forEach(dd => {
      const a=(dd-90)*DEG;
      const len = (Math.abs(dd)===30 || Math.abs(dd)===45) ? 13 : 9;
      const p1={x:cx+(R-2)*Math.cos(a), y:cy+(R-2)*Math.sin(a)};
      const p2={x:cx+(R-2-len)*Math.cos(a), y:cy+(R-2-len)*Math.sin(a)};
      ctx.save(); ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y);
      ctx.strokeStyle='#bbb'; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore();
    });
  });

  // Bank pointer (rotates with bank)
  ctx.save();
  ctx.translate(cx,cy); ctx.rotate(bankDeg*DEG); ctx.translate(-cx,-cy);
  ctx.beginPath();
  ctx.moveTo(cx,cy-R+2); ctx.lineTo(cx-5,cy-R+12); ctx.lineTo(cx+5,cy-R+12); ctx.closePath();
  ctx.fillStyle='#fff'; ctx.fill();
  ctx.restore();

  // Fixed airplane (cyan)
  ctx.save(); ctx.strokeStyle='#00e5ff'; ctx.lineWidth=2.5; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(cx-32,cy); ctx.lineTo(cx-10,cy);
  ctx.moveTo(cx-10,cy); ctx.lineTo(cx,cy+5);
  ctx.moveTo(cx,cy+5);  ctx.lineTo(cx+10,cy);
  ctx.moveTo(cx+10,cy); ctx.lineTo(cx+32,cy);
  ctx.moveTo(cx-7,cy+12); ctx.lineTo(cx+7,cy+12);
  ctx.stroke(); ctx.restore();

  ctx.restore(); // remove clip

  // Bezel ring + logo
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU);
  ctx.strokeStyle='#1a2a1a'; ctx.lineWidth=2; ctx.stroke(); ctx.restore();
  txt(ctx, cx+R*.62, cy-R*.65, 'G5', { fillStyle:'#1a4a1a', font:`bold ${S*.09}px Arial` });
}

/* ── Altimeter ───────────────────────────────────────────── */
function drawALT(hasPower, altFt, baroInHg) {
  const cv = document.getElementById('alt'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const S = cv.width, cx = S/2, cy = S/2, R = S/2 - 4;
  drawBase(ctx, S);

  // 50 divisions per revolution (100ft each)
  for (let i = 0; i < 50; i++) {
    const ang = (i/50)*360 - 150;
    const long = i%5===0;
    tick(ctx, cx, cy, R-3, long?R-15:R-9, ang, '#bbb', long?1.5:1);
    if (long) {
      const n=(i/5)%10;
      const lp=polar(cx,cy,R-25,ang);
      txt(ctx,lp.x,lp.y,n.toString(),{fillStyle:'#ccc',font:`bold ${S*.09}px Courier New`});
    }
  }

  // Kollsman window
  const wAng=30*DEG, wCx=cx+R*.52*Math.cos(wAng), wCy=cy+R*.52*Math.sin(wAng);
  ctx.save();
  ctx.fillStyle='#001200'; ctx.beginPath(); ctx.roundRect(wCx-18,wCy-9,36,18,2); ctx.fill();
  ctx.strokeStyle='#444'; ctx.lineWidth=1; ctx.stroke();
  txt(ctx,wCx,wCy,baroInHg.toFixed(2),{fillStyle:'#0f0',font:`bold ${S*.08}px Courier New`});
  ctx.restore();

  txt(ctx,cx,cy-R*.42,'ALTIMETER',{fillStyle:'#444',font:`${S*.065}px Courier New`});

  // Needles — park at their zero position when no power
  const alt = hasPower ? altFt : 0;
  const hundreds = ((alt%1000)/1000)*360-150;
  const thousands = ((alt%10000)/10000)*360-150;
  const tenthous = (alt/100000)*360-150;
  const nc = hasPower ? '#fff' : '#555';
  drawNeedle(ctx,cx,cy,tenthous, R*.42, 1.5, nc);
  drawNeedle(ctx,cx,cy,thousands, R*.62, 2, nc);
  drawNeedle(ctx,cx,cy,hundreds, R-22, 2.5, nc);
  hub(ctx,cx,cy,5,'#aaa');
  if (!hasPower) noPowerFlag(ctx,cx,cy,R);
}

/* ── Turn Coordinator ────────────────────────────────────── */
function drawTC(hasPower, bankDeg, slip) {
  const cv = document.getElementById('tc'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const S = cv.width, cx = S/2, cy = S/2-8, R = S/2-4;
  drawBase(ctx, S);

  // Scale marks
  [-24,24].forEach(a => tick(ctx,cx,cy,R-3,R-14,a-90,'#fff',2));
  [[-30,'L'],[30,'R']].forEach(([a,l]) => {
    const lp=polar(cx,cy,R-28,a-90);
    txt(ctx,lp.x,lp.y+14,l,{fillStyle:'#ccc',font:`bold ${S*.1}px Courier New`});
  });

  // Miniature airplane
  const dispBank = hasPower ? Math.max(-30,Math.min(30,bankDeg)) : 0;
  const aColor = hasPower ? '#ff0' : '#555';
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(dispBank*DEG);
  ctx.strokeStyle=aColor; ctx.lineWidth=2.5; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-30,0); ctx.lineTo(-10,0);
  ctx.moveTo(-10,0); ctx.lineTo(0,5);
  ctx.moveTo(0,5);   ctx.lineTo(10,0);
  ctx.moveTo(10,0);  ctx.lineTo(30,0);
  ctx.moveTo(-6,10); ctx.lineTo(6,10);
  ctx.stroke(); ctx.restore();

  // Ball tube
  const tubY = cy+R*.52+12;
  ctx.save();
  ctx.fillStyle='#0a0a0a'; ctx.strokeStyle='#444'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.roundRect(cx-32,tubY-10,64,20,10); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='#fff'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(cx-12,tubY-7); ctx.lineTo(cx-12,tubY+7);
  ctx.moveTo(cx+12,tubY-7); ctx.lineTo(cx+12,tubY+7); ctx.stroke();
  // Ball (centered when no power)
  const bx = cx + (hasPower ? Math.max(-24,Math.min(24,(slip||0)*24)) : 0);
  const ballGrad=ctx.createRadialGradient(bx-2,tubY-2,1,bx,tubY,8);
  ballGrad.addColorStop(0,'#bbb'); ballGrad.addColorStop(1,'#2a2a2a');
  ctx.beginPath(); ctx.arc(bx,tubY,8,0,TAU); ctx.fillStyle=ballGrad; ctx.fill();
  ctx.strokeStyle='#777'; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();

  txt(ctx,cx,cy+R*.72+8,'NO PITCH INFO',{fillStyle:'#2a2a2a',font:`${S*.056}px Courier New`});
  if (!hasPower) noPowerFlag(ctx,cx,cy+8,R);
}

/* ── Garmin G5 HSI ───────────────────────────────────────── */
function drawG5HSI(hasPower, headingDeg) {
  const cv = document.getElementById('hi'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const S = cv.width, cx = S/2, cy = S/2, R = S/2-4;
  ctx.clearRect(0,0,S,S);

  ctx.save();
  ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.clip();

  if (!hasPower) {
    ctx.fillStyle='#030503'; ctx.fillRect(0,0,S,S);
    ctx.restore();
    txt(ctx,cx,cy-10,'G5',{fillStyle:'#1e2a1e',font:`bold ${S*.26}px Arial`});
    txt(ctx,cx,cy+16,'GARMIN',{fillStyle:'#161e16',font:`bold ${S*.075}px Arial`});
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU);
    ctx.strokeStyle='#0d1a0d'; ctx.lineWidth=2; ctx.stroke(); ctx.restore();
    return;
  }

  // Dark HSI background
  ctx.fillStyle='#080808'; ctx.fillRect(0,0,S,S);

  // Rotating compass rose
  ctx.save();
  ctx.translate(cx,cy); ctx.rotate(-headingDeg*DEG); ctx.translate(-cx,-cy);

  for (let d=0; d<360; d+=5) {
    const long=d%10===0;
    tick(ctx,cx,cy,R-3,long?R-16:R-9,d,'#aaa',long?1.5:1);
  }
  const cardinals={0:'N',90:'E',180:'S',270:'W'};
  for (let d=0; d<360; d+=30) {
    const lp=polar(cx,cy,R-30,d);
    ctx.save();
    ctx.fillStyle=d===0?'#ff4444':'#ccc';
    ctx.font=`bold ${S*(cardinals[d]?0.1:0.08)}px Arial`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(cardinals[d]||(d/10).toString(),lp.x,lp.y);
    ctx.restore();
  }
  ctx.restore();

  // ── VOR CDI — course pointer + deviation needle ───────────
  const normA = a => ((a % 360) + 540) % 360 - 180;
  const obs1 = state.nav.obs1;
  const radial = state.nav.vor1Radial;
  // Signed angular error between current position and on-course position
  const courseError = normA(radial - (obs1 + 180) % 360);
  // TO when OBS ≈ bearing to station (|diff| < 90°)
  const isTO = Math.abs(normA(obs1 - (radial + 180) % 360)) < 90;
  const cdiDevRaw = Math.max(-1, Math.min(1, -courseError / 10));
  const cdiDev = isTO ? cdiDevRaw : -cdiDevRaw; // FROM reverses sensing

  // OBS direction on screen, relative to lubber line (current heading = up)
  const obsAng = ((obs1 - headingDeg) % 360 + 360) % 360;
  const cpRad   = (obsAng - 90) * DEG;           // canvas radians (0°=right, -90°=up)
  const perpRad = cpRad + Math.PI / 2;            // perpendicular = deflection axis
  const MAX_DEV = 22;                             // pixels for full-scale (±10°) deflection
  const devX = cdiDev * MAX_DEV * Math.cos(perpRad);
  const devY = cdiDev * MAX_DEV * Math.sin(perpRad);

  // Deviation reference dots (±1 and ±2 dots; 1 dot = 5° = MAX_DEV/2 px)
  ctx.save(); ctx.strokeStyle = '#3a3a4a'; ctx.lineWidth = 1;
  for (const d of [-2, -1, 1, 2]) {
    const dOff = d * (MAX_DEV / 2);
    ctx.beginPath();
    ctx.arc(cx + dOff * Math.cos(perpRad), cy + dOff * Math.sin(perpRad), 2.5, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  // Course baseline (dashed dim magenta — the reference line through center)
  const bTip  = polar(cx, cy, R - 10, obsAng);
  const bTail = polar(cx, cy, R - 10, obsAng + 180);
  ctx.save(); ctx.strokeStyle = '#5a1a5a'; ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.moveTo(bTail.x, bTail.y); ctx.lineTo(bTip.x, bTip.y); ctx.stroke();
  ctx.setLineDash([]); ctx.restore();

  // CDI needle (bright magenta bar, parallel to course, offset by deviation)
  const nHalf = 26;
  const nx = cx + devX, ny = cy + devY;
  const nTipX  = nx + nHalf * Math.cos(cpRad), nTipY  = ny + nHalf * Math.sin(cpRad);
  const nTailX = nx - nHalf * Math.cos(cpRad), nTailY = ny - nHalf * Math.sin(cpRad);
  ctx.save(); ctx.strokeStyle = '#e040e0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(nTailX, nTailY); ctx.lineTo(nTipX, nTipY); ctx.stroke();
  // Arrowhead at tip
  const aL = 9, aA = 0.45;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(nTipX, nTipY);
  ctx.lineTo(nTipX - aL * Math.cos(cpRad - aA), nTipY - aL * Math.sin(cpRad - aA));
  ctx.moveTo(nTipX, nTipY);
  ctx.lineTo(nTipX - aL * Math.cos(cpRad + aA), nTipY - aL * Math.sin(cpRad + aA));
  ctx.stroke();
  ctx.restore();

  // TO / FROM flag
  ctx.save();
  ctx.fillStyle = isTO ? '#001800' : '#180a00';
  ctx.strokeStyle = isTO ? '#0a3a0a' : '#3a1800'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(cx - R * 0.62, cy - 9, 28, 16, 2); ctx.fill(); ctx.stroke();
  txt(ctx, cx - R * 0.62 + 14, cy - 1, isTO ? 'TO' : 'FR', {
    fillStyle: isTO ? '#00dd44' : '#ffaa00',
    font: `bold ${S * 0.078}px Courier New`
  });
  ctx.restore();

  // Aircraft symbol
  ctx.save(); ctx.strokeStyle='#00e5ff'; ctx.lineWidth=2.5; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(cx-14,cy); ctx.lineTo(cx-4,cy);
  ctx.moveTo(cx-4,cy);  ctx.lineTo(cx,cy+4);
  ctx.moveTo(cx,cy+4);  ctx.lineTo(cx+4,cy);
  ctx.moveTo(cx+4,cy);  ctx.lineTo(cx+14,cy);
  ctx.moveTo(cx-4,cy+8);ctx.lineTo(cx+4,cy+8);
  ctx.stroke(); ctx.restore();

  // Fixed lubber line
  ctx.save(); ctx.strokeStyle='#ffcc00'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(cx,cy-R+2); ctx.lineTo(cx,cy-R+16); ctx.stroke(); ctx.restore();

  // Heading readout
  ctx.save();
  ctx.fillStyle='#001200'; ctx.strokeStyle='#1a4a1a'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.roundRect(cx-18,cy+R*.42,36,18,2); ctx.fill(); ctx.stroke();
  txt(ctx,cx,cy+R*.42+9,Math.round(headingDeg%360).toString().padStart(3,'0'),
    {fillStyle:'#00e5ff',font:`bold ${S*.09}px Courier New`});
  ctx.restore();

  ctx.restore(); // clip

  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU);
  ctx.strokeStyle='#1a2a1a'; ctx.lineWidth=2; ctx.stroke(); ctx.restore();
  txt(ctx,cx+R*.62,cy-R*.65,'G5',{fillStyle:'#1a4a1a',font:`bold ${S*.09}px Arial`});
}

/* ── Vertical Speed Indicator ────────────────────────────── */
function vsiAng(fpm) {
  const c=Math.max(-2000,Math.min(2000,fpm));
  return Math.sign(c)*Math.pow(Math.abs(c)/2000,0.72)*150;
}
function drawVSI(hasPower, vsiFpm) {
  const cv=document.getElementById('vsi'); if (!cv) return;
  const ctx=cv.getContext('2d');
  const S=cv.width, cx=S/2, cy=S/2, R=S/2-4;
  drawBase(ctx,S);

  [[-2000,'2'],[-1000,'1'],[0,'0'],[1000,'1'],[2000,'2']].forEach(([f,l])=>{
    const a=vsiAng(f);
    tick(ctx,cx,cy,R-3,R-15,a,'#bbb',1.5);
    const lp=polar(cx,cy,R-27,a);
    txt(ctx,lp.x,lp.y,l,{fillStyle:'#ccc',font:`bold ${S*.075}px Courier New`});
  });
  [[-500],[-1500],[500],[1500]].forEach(([f])=>tick(ctx,cx,cy,R-3,R-9,vsiAng(f),'#666',1));

  txt(ctx,cx-R*.28,cy-R*.35,'UP',{fillStyle:'#444',font:`${S*.065}px Courier New`});
  txt(ctx,cx+R*.28,cy-R*.35,'DN',{fillStyle:'#444',font:`${S*.065}px Courier New`});
  txt(ctx,cx,cy+R*.55,'FPM×100',{fillStyle:'#444',font:`${S*.065}px Courier New`});

  const ang = hasPower ? vsiAng(vsiFpm) : 0;
  const nc  = hasPower ? '#fff' : '#555';
  drawNeedle(ctx,cx,cy,ang,R-22,2.5,nc);
  hub(ctx,cx,cy,5,'#aaa');
  if (!hasPower) noPowerFlag(ctx,cx,cy,R);
}

/* ── Tachometer ──────────────────────────────────────────── */
function rpmAng(rpm){return -150+(Math.min(3000,Math.max(0,rpm))/3000)*300;}
function drawTach(hasPower, rpm) {
  const cv=document.getElementById('tach'); if (!cv) return;
  const ctx=cv.getContext('2d');
  const S=cv.width, cx=S/2, cy=S/2, R=S/2-3;
  drawBase(ctx,S);

  arc(ctx,cx,cy,R-5,rpmAng(1500),rpmAng(2750),'#00cc44',4);
  tick(ctx,cx,cy,R-2,R-11,rpmAng(2750),'#ff2200',2.5);
  for (let r=0;r<=3000;r+=100) {
    const long=r%500===0;
    tick(ctx,cx,cy,R-2,long?R-13:R-7,rpmAng(r),'#999',long?1.5:1);
    if (long) {
      const lp=polar(cx,cy,R-22,rpmAng(r));
      txt(ctx,lp.x,lp.y,(r/100).toString(),{fillStyle:'#aaa',font:`${S*.085}px Courier New`});
    }
  }
  txt(ctx,cx,cy+R*.52,'RPM×100',{fillStyle:'#444',font:`${S*.075}px Courier New`});

  const ang = hasPower ? rpmAng(rpm) : rpmAng(0);
  const nc  = hasPower ? '#fff' : '#555';
  drawNeedle(ctx,cx,cy,ang,R-16,2,nc);
  hub(ctx,cx,cy,4,'#aaa');
  if (!hasPower) noPowerFlag(ctx,cx,cy,R);
}

/* ── Oil Temperature ─────────────────────────────────────── */
function oilTA(t){return -140+(Math.max(60,Math.min(250,t))-60)/190*280;}
function drawOilTemp(hasPower,t) {
  const cv=document.getElementById('oil-temp'); if (!cv) return;
  const ctx=cv.getContext('2d');
  const S=cv.width, cx=S/2, cy=S/2, R=S/2-3;
  drawBase(ctx,S);

  arc(ctx,cx,cy,R-5,oilTA(100),oilTA(245),'#00cc44',4);
  arc(ctx,cx,cy,R-5,oilTA(245),oilTA(250),'#ff2200',4);
  [75,100,150,200,245].forEach(v=>{
    tick(ctx,cx,cy,R-2,R-12,oilTA(v),'#999',1.5);
    const lp=polar(cx,cy,R-21,oilTA(v));
    txt(ctx,lp.x,lp.y,v.toString(),{fillStyle:'#aaa',font:`${S*.075}px Courier New`});
  });
  txt(ctx,cx,cy-R*.35,'°F',{fillStyle:'#444',font:`${S*.08}px Courier New`});

  const ang=hasPower?oilTA(t):oilTA(60);
  const nc=hasPower?'#fff':'#555';
  drawNeedle(ctx,cx,cy,ang,R-16,2,nc);
  hub(ctx,cx,cy,4,'#aaa');
  if (!hasPower) noPowerFlag(ctx,cx,cy,R);
}

/* ── Oil Pressure ────────────────────────────────────────── */
function oilPA(p){return -140+(Math.max(0,Math.min(100,p))/100)*280;}
function drawOilPress(hasPower,p) {
  const cv=document.getElementById('oil-press'); if (!cv) return;
  const ctx=cv.getContext('2d');
  const S=cv.width, cx=S/2, cy=S/2, R=S/2-3;
  drawBase(ctx,S);

  arc(ctx,cx,cy,R-5,oilPA(0), oilPA(25), '#ff2200',4);
  arc(ctx,cx,cy,R-5,oilPA(25),oilPA(60), '#00cc44',4);
  arc(ctx,cx,cy,R-5,oilPA(60),oilPA(90), '#ffcc00',4);
  arc(ctx,cx,cy,R-5,oilPA(90),oilPA(100),'#ff2200',4);
  [0,25,50,60,75,100].forEach(v=>{
    tick(ctx,cx,cy,R-2,R-12,oilPA(v),'#999',1.5);
    const lp=polar(cx,cy,R-22,oilPA(v));
    txt(ctx,lp.x,lp.y,v.toString(),{fillStyle:'#aaa',font:`${S*.07}px Courier New`});
  });
  txt(ctx,cx,cy-R*.35,'PSI',{fillStyle:'#444',font:`${S*.08}px Courier New`});

  const ang=hasPower?oilPA(p):oilPA(0);
  const nc=hasPower?'#fff':'#555';
  drawNeedle(ctx,cx,cy,ang,R-16,2,nc);
  hub(ctx,cx,cy,4,'#aaa');
  if (!hasPower) noPowerFlag(ctx,cx,cy,R);
}

/* ── Fuel Gauges ─────────────────────────────────────────── */
function fuelA(g){return -140+(Math.max(0,Math.min(24,g))/24)*280;}
function drawFuelGauge(id, hasPower, gal) {
  const cv=document.getElementById(id); if (!cv) return;
  const ctx=cv.getContext('2d');
  const S=cv.width, cx=S/2, cy=S/2, R=S/2-3;
  drawBase(ctx,S);

  arc(ctx,cx,cy,R-5,fuelA(0), fuelA(4), '#ff2200',4);
  arc(ctx,cx,cy,R-5,fuelA(4), fuelA(24),'#00cc44',4);
  [{g:0,l:'E'},{g:6,l:'¼'},{g:12,l:'½'},{g:18,l:'¾'},{g:24,l:'F'}].forEach(({g,l})=>{
    tick(ctx,cx,cy,R-2,R-13,fuelA(g),'#999',1.5);
    const lp=polar(cx,cy,R-23,fuelA(g));
    txt(ctx,lp.x,lp.y,l,{fillStyle:'#aaa',font:`bold ${S*.085}px Courier New`});
  });
  txt(ctx,cx,cy+R*.3,(hasPower?gal.toFixed(1):'--'),{fillStyle:'#555',font:`${S*.09}px Courier New`});

  const ang=hasPower?fuelA(gal):fuelA(0);
  const nc=hasPower?'#fff':'#555';
  drawNeedle(ctx,cx,cy,ang,R-16,2,nc);
  hub(ctx,cx,cy,4,'#aaa');
  if (!hasPower) noPowerFlag(ctx,cx,cy,R);
}

/* ── Ammeter ─────────────────────────────────────────────── */
function ampA(a){return(Math.max(-50,Math.min(50,a))/50)*140;}
function drawAmmeter(hasPower, amps) {
  const cv=document.getElementById('ammeter'); if (!cv) return;
  const ctx=cv.getContext('2d');
  const S=cv.width, cx=S/2, cy=S/2, R=S/2-3;
  drawBase(ctx,S);

  arc(ctx,cx,cy,R-5,ampA(-50),ampA(0), '#ff6600',4);
  arc(ctx,cx,cy,R-5,ampA(0),  ampA(50),'#00cc44',4);
  [-50,-25,0,25,50].forEach(v=>{
    tick(ctx,cx,cy,R-2,R-13,ampA(v),'#999',1.5);
    const lp=polar(cx,cy,R-23,ampA(v));
    txt(ctx,lp.x,lp.y,Math.abs(v).toString(),{fillStyle:'#aaa',font:`${S*.07}px Courier New`});
  });
  txt(ctx,cx-R*.5,cy-R*.3,'D',{fillStyle:'#444',font:`${S*.07}px Courier New`});
  txt(ctx,cx+R*.5,cy-R*.3,'C',{fillStyle:'#444',font:`${S*.07}px Courier New`});

  const ang=hasPower?ampA(amps):0;
  const nc=hasPower?'#fff':'#555';
  drawNeedle(ctx,cx,cy,ang,R-16,2,nc);
  hub(ctx,cx,cy,4,'#aaa');
  if (!hasPower) noPowerFlag(ctx,cx,cy,R);
}

/* ── Magneto Switch (always visible) ────────────────────── */
const MAG_POS=['OFF','R','L','BOTH','START'];
const MAG_ANG=[-120,-60,0,60,120];

function drawMagneto(pos) {
  const cv=document.getElementById('magneto-switch'); if (!cv) return;
  const ctx=cv.getContext('2d');
  const S=cv.width, cx=S/2, cy=S/2, R=S/2-3;
  ctx.clearRect(0,0,S,S);

  // Background
  ctx.save();
  const bg=ctx.createRadialGradient(cx-S*.15,cy-S*.15,1,cx,cy,R);
  bg.addColorStop(0,'#1e1e1e'); bg.addColorStop(1,'#0a0a0a');
  ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.fillStyle=bg; ctx.fill();
  ctx.strokeStyle='#3a3a3a'; ctx.lineWidth=2; ctx.stroke();
  ctx.restore();

  // Detent marks
  MAG_ANG.forEach(a=>{
    const p1=polar(cx,cy,R-2,a), p2=polar(cx,cy,R-8,a);
    ctx.save(); ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y);
    ctx.strokeStyle='#333'; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore();
  });

  // Labels
  MAG_POS.forEach((l,i)=>{
    const lp=polar(cx,cy,R-18,MAG_ANG[i]);
    const isActive=i===pos;
    const color = isActive ? (pos===4?'#ffdd00':'#ffffff') : '#555';
    ctx.save();
    ctx.fillStyle=color; ctx.font=`bold ${S*.09}px Courier New`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(l,lp.x,lp.y);
    ctx.restore();
  });

  // Knob body
  const kg=ctx.createRadialGradient(cx-4,cy-4,2,cx,cy,16);
  kg.addColorStop(0,'#6a6a6a'); kg.addColorStop(1,'#1a1a1a');
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,16,0,TAU);
  ctx.fillStyle=kg; ctx.fill(); ctx.strokeStyle='#555'; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore();

  // Indicator line on knob
  const tip=polar(cx,cy,12,MAG_ANG[pos]);
  ctx.save(); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(tip.x,tip.y);
  ctx.strokeStyle=pos===4?'#ffdd00':'#ddd';
  ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.stroke(); ctx.restore();

  // Click-direction hint arrows (subtle)
  txt(ctx,cx-R*.45,cy+R*.7,'◄',{fillStyle:'#2a2a2a',font:`${S*.08}px Arial`});
  txt(ctx,cx+R*.45,cy+R*.7,'►',{fillStyle:'#2a2a2a',font:`${S*.08}px Arial`});
}

/* ── Fuel Selector (always visible) ─────────────────────── */
const FSEL={OFF:-120,LEFT:-60,BOTH:0,RIGHT:60};
function drawFuelSelector(pos) {
  const cv=document.getElementById('fuel-selector'); if (!cv) return;
  const ctx=cv.getContext('2d');
  const S=cv.width, cx=S/2, cy=S/2, R=S/2-3;
  ctx.clearRect(0,0,S,S);

  const bg=ctx.createRadialGradient(cx-S*.15,cy-S*.15,1,cx,cy,R);
  bg.addColorStop(0,'#1e1e1e'); bg.addColorStop(1,'#0a0a0a');
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU);
  ctx.fillStyle=bg; ctx.fill(); ctx.strokeStyle='#3a3a3a'; ctx.lineWidth=2; ctx.stroke(); ctx.restore();

  Object.values(FSEL).forEach(a=>{
    const p1=polar(cx,cy,R-2,a),p2=polar(cx,cy,R-8,a);
    ctx.save(); ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y);
    ctx.strokeStyle='#333'; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore();
  });

  Object.entries(FSEL).forEach(([l,ang])=>{
    const lp=polar(cx,cy,R-18,ang);
    const isActive=l===pos;
    ctx.save(); ctx.fillStyle=isActive?'#00cc44':'#555';
    ctx.font=`bold ${S*.09}px Courier New`;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(l,lp.x,lp.y); ctx.restore();
  });

  const ang=FSEL[pos]||0;
  const kg=ctx.createRadialGradient(cx-4,cy-4,2,cx,cy,16);
  kg.addColorStop(0,'#6a6a6a'); kg.addColorStop(1,'#1a1a1a');
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,16,0,TAU);
  ctx.fillStyle=kg; ctx.fill(); ctx.strokeStyle='#555'; ctx.lineWidth=1.5; ctx.stroke(); ctx.restore();

  const tip=polar(cx,cy,12,ang);
  ctx.save(); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(tip.x,tip.y);
  ctx.strokeStyle='#00cc44'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.stroke(); ctx.restore();

  txt(ctx,cx-R*.45,cy+R*.7,'◄',{fillStyle:'#2a2a2a',font:`${S*.08}px Arial`});
  txt(ctx,cx+R*.45,cy+R*.7,'►',{fillStyle:'#2a2a2a',font:`${S*.08}px Arial`});
}

/* ── Garmin GNS 430 Display ──────────────────────────────── */
function drawG430(hasPower) {
  const cv=document.getElementById('g430-canvas'); if (!cv) return;
  const ctx=cv.getContext('2d');
  const W=cv.width, H=cv.height;
  ctx.clearRect(0,0,W,H);

  if (!hasPower) {
    ctx.fillStyle='#000a00'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#0a1a0a'; ctx.lineWidth=1; ctx.strokeRect(.5,.5,W-1,H-1);
    return;
  }

  ctx.fillStyle='#001200'; ctx.fillRect(0,0,W,H);

  // Split COM | NAV — active tuning side slightly brighter background
  const sel = (typeof g430TuneUnit !== 'undefined') ? g430TuneUnit : 'com1';
  ctx.save();
  ctx.fillStyle = sel === 'com1' ? '#001c00' : '#001600';
  ctx.fillRect(0, 0, W/2, H);
  ctx.fillStyle = sel === 'nav1' ? '#001c00' : '#001600';
  ctx.fillRect(W/2, 0, W/2, H);
  ctx.strokeStyle='#1a3a1a'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
  ctx.restore();

  // COM side
  const comSel = sel === 'com1';
  txt(ctx,W/4, 11,'COM1',{fillStyle: comSel ? '#44ee88' : '#2a6a2a', font:`bold ${comSel?'9':'8'}px Courier New`});
  txt(ctx,W/4, 32,state.radios.com1.active.toFixed(3),  {fillStyle:'#00dd44', font:'bold 15px Courier New'});
  txt(ctx,W/4, 54,state.radios.com1.standby.toFixed(3), {fillStyle: comSel ? '#22aa44' : '#1a5a1a', font:'11px Courier New'});
  txt(ctx,W/4, 70,comSel ? '▸ STBY' : 'STBY',          {fillStyle: comSel ? '#00cc44' : '#1a3a1a', font:'7px Courier New'});

  // NAV side
  const navSel = sel === 'nav1';
  txt(ctx,W*3/4, 11,'NAV1',{fillStyle: navSel ? '#44ee88' : '#2a6a2a', font:`bold ${navSel?'9':'8'}px Courier New`});
  txt(ctx,W*3/4, 32,state.radios.nav1.active.toFixed(3),  {fillStyle:'#00dd44', font:'bold 15px Courier New'});
  txt(ctx,W*3/4, 54,state.radios.nav1.standby.toFixed(3), {fillStyle: navSel ? '#22aa44' : '#1a5a1a', font:'11px Courier New'});
  txt(ctx,W*3/4, 70,navSel ? '▸ STBY' : 'STBY',          {fillStyle: navSel ? '#00cc44' : '#1a3a1a', font:'7px Courier New'});

  // Highlight border on selected side
  ctx.save();
  ctx.strokeStyle='#00cc44'; ctx.lineWidth=1.5;
  if (comSel) ctx.strokeRect(1.5, 1.5, W/2-3, H-3);
  else        ctx.strokeRect(W/2+1.5, 1.5, W/2-3, H-3);
  ctx.restore();

  ctx.strokeStyle='#1a4a1a'; ctx.lineWidth=1; ctx.strokeRect(.5,.5,W-1,H-1);
}

/* ── Circuit Breaker Panel ───────────────────────────────── */
function buildCBPanel() {
  const container=document.getElementById('cb-panel'); if (!container) return;
  container.innerHTML='';
  Object.keys(state.circuitBreakers).forEach(name=>{
    const div=document.createElement('div');
    div.className='cb-item'+(state.circuitBreakers[name]?' tripped':'');
    div.id='cb-'+name.replace(/\s+/g,'_');
    div.title=name+' — click to '+(state.circuitBreakers[name]?'reset':'trip');
    div.innerHTML=`<div class="cb-btn"></div><div class="cb-lbl">${name}</div>`;
    div.addEventListener('click',()=>{
      state.circuitBreakers[name]=!state.circuitBreakers[name];
      div.classList.toggle('tripped');
      div.title=name+' — click to '+(state.circuitBreakers[name]?'reset':'trip');
      showToast(name+': '+(state.circuitBreakers[name]?'TRIPPED ⚡':'RESET'));
    });
    container.appendChild(div);
  });
}

/* ── Master draw call ────────────────────────────────────── */
function drawAllInstruments() {
  try {
    const pwr = state.electrical.battery;
    const av  = state.electrical.avionics && !state.circuitBreakers['AVIONICS'];
    const cbOk = name => !state.circuitBreakers[name];

    drawASI(pwr, state.flight.iasKts);
    drawG5PFD(pwr, state.flight.pitchDeg, state.flight.bankDeg);
    drawALT(pwr, state.flight.altitudeFt, state.flight.baroInHg);
    drawTC(pwr && cbOk('TURN COORD'), state.flight.bankDeg, 0);
    drawG5HSI(pwr && cbOk('GYRO'), state.flight.headingDeg);
    drawVSI(pwr, state.flight.vsiFpm);
    drawTach(pwr, state.engine.rpm);
    drawOilTemp(pwr, state.engine.oilTempF);
    drawOilPress(pwr, state.engine.oilPressurePsi);
    drawFuelGauge('fuel-left',  pwr, state.fuel.leftGal);
    drawFuelGauge('fuel-right', pwr, state.fuel.rightGal);
    drawAmmeter(pwr, state.electrical.amperage);
    drawMagneto(state.engine.magnetos);
    drawFuelSelector(state.fuel.selector);
    drawG430(av);
  } catch(e) {
    console.error('drawAllInstruments error:', e);
  }
}
