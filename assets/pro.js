/* Cric-Scorer - pro scoring UI (v1.16): ball details & wagon wheel, editing earlier balls, more dismissals,
   penalty runs, powerplay, super over, analysis charts, officials & live stream, scorecard image, player insights.
   Loaded after app.js; it extends or replaces a few of its screen builders. */
'use strict';

const ZONES = { 1: 'Third man', 2: 'Point', 3: 'Cover', 4: 'Long off', 5: 'Long on', 6: 'Mid-wicket', 7: 'Square leg', 8: 'Fine leg' };
const SHOT_ICON = { drive: '🏏', cut: '✂️', pull: '💪', hook: '🪝', sweep: '🧹', 'reverse sweep': '🔄', flick: '👆', glance: '👀', defence: '🛡️', loft: '🚀', slog: '💥', scoop: '🥄', edge: '😬', leave: '🙅', other: '❓' };
const askShot = () => { try { return localStorage.getItem('cs_askshot') === '1'; } catch (e) { return false; } };

/* ---------- scoring pad: extra tools ---------- */
const wheelOn = () => { try { return localStorage.getItem('cs_wheel') !== '0'; } catch (e) { return true; } };
const _scorePad = scorePad;
scorePad = () => (wheelOn() ? wheelPad() : '') + _scorePad() + `<div class="pad-tools"><button onclick="App.toggleWheel()">${wheelOn() ? '🎯 Hide wheel' : '🎯 Wheel scoring'}</button><button onclick="App.fieldSheet()">🧤 Set field</button></div>
  <div class="pad-tools"><button onclick="App.lastBallDetail()">🎯 Shot & fielding</button><button onclick="App.penaltySheet()">⚖️ Penalty runs</button><button onclick="App.changeBatterSheet()">🔀 Wrong batter</button></div>`;
App.toggleWheel = () => { try { localStorage.setItem('cs_wheel', wheelOn() ? '0' : '1'); } catch (e) { /* ignore */ } drawMatch(false); };

/* Tap-to-score wagon wheel: rings for 0-6, eight zones, fielders shown where the scorer placed them */
const RINGS = [0.14, 0.32, 0.48, 0.62, 0.78, 0.84, 1.0];   // outer edge of the band for 0,1,2,3,4,5,6
function wheelPad() {
  const inn = curInn(), field = inn.field || {};
  const size = 330, c = size / 2, R = c - 4;
  let g = '';
  for (let k = RINGS.length - 1; k >= 0; k--) g += `<circle cx="${c}" cy="${c}" r="${(RINGS[k] * R).toFixed(1)}" class="wr${k} wring"/>`;
  for (let z = 1; z <= 8; z++) {
    const a0 = -Math.PI / 2 + (z - 5) * Math.PI / 4;
    g += `<line x1="${c}" y1="${c}" x2="${(c + R * Math.cos(a0)).toFixed(1)}" y2="${(c + R * Math.sin(a0)).toFixed(1)}" class="wsp"/>`;
    const a = a0 + Math.PI / 8;
    g += `<text x="${(c + R * 0.91 * Math.cos(a)).toFixed(1)}" y="${(c + R * 0.91 * Math.sin(a)).toFixed(1)}" class="wl">${ZONES[z]}</text>`;
    const f = field[z];
    if (f) g += `<g class="wf"><circle cx="${(c + R * 0.64 * Math.cos(a)).toFixed(1)}" cy="${(c + R * 0.64 * Math.sin(a)).toFixed(1)}" r="11"/><text x="${(c + R * 0.64 * Math.cos(a)).toFixed(1)}" y="${(c + R * 0.64 * Math.sin(a) + 4).toFixed(1)}">${esc(f.name.split(' ').map(w => w[0]).slice(0, 2).join(''))}</text></g>`;
  }
  // ring labels up the off side (north-west) so they don't sit on the fielders
  const la = -Math.PI / 2 - Math.PI / 8 * 0.5;
  [0, 1, 2, 3, 4, 5, 6].forEach(k => { const r = ((k ? RINGS[k - 1] : 0) + RINGS[k]) / 2 * R; g += `<text x="${(c + r * Math.cos(la)).toFixed(1)}" y="${(c + r * Math.sin(la) + 5).toFixed(1)}" class="wn">${k === 0 ? '•' : k}</text>`; });
  g += `<rect x="${c - 2}" y="${c - 10}" width="4" height="20" rx="2" fill="#c9a44c"/>`;
  return `<div class="wheel-pad"><svg viewBox="0 0 ${size} ${size}" id="wheelSvg" onclick="App.wheelTap(event)">${g}</svg>
    <div class="small muted" style="text-align:center">Tap where the ball went - the ring is the runs. Commentary says it for you.</div></div>`;
}
App.wheelTap = ev => {
  const svg = document.getElementById('wheelSvg'); if (!svg || S.busy) return;
  const r = svg.getBoundingClientRect(), c = r.width / 2, R = c - 4 * r.width / 330;
  const dx = ev.clientX - r.left - c, dy = ev.clientY - r.top - c;
  const d = Math.sqrt(dx * dx + dy * dy) / R;
  if (d > 1.08) return;
  let runs = 6; for (let k = 0; k < RINGS.length; k++) if (d <= RINGS[k]) { runs = k; break; }
  const t = ((Math.atan2(dy, dx) - Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const zone = Math.floor(t / (Math.PI / 4)) + 1;
  if (navigator.vibrate) navigator.vibrate(8);
  App.ballZ(runs, zone);
};
App.ballZ = (runs, zone) => scoreAction('match_ball', { runs, shot_zone: zone });

/* ---------- retire / timed out ---------- */
App.retireSheet = () => {
  const st = S.m, inn = curInn();
  const crease = [inn.striker_id, inn.non_striker_id].filter(Boolean);
  const waiting = st.xi[inn.batting_team_id].filter(p => st.available_batters.includes(p.id));
  sheet(`<h3>Retire / timed out</h3><div class="sub">Pick what happened</div>
    <div class="kv" style="border-top:0;padding-left:0"><span>🩹 Retired hurt</span><span class="muted">not out - can bat again</span></div>
    <div class="plist">${crease.map(id => `<button class="pbtn" onclick="App.ball(0,null,{type:'retired hurt',dismissed_id:${id}})">${esc(pname(id))}</button>`).join('')}</div>
    <div class="kv" style="padding-left:0"><span>🚶 Retired out</span><span class="muted">counts as a wicket</span></div>
    <div class="plist">${crease.map(id => `<button class="pbtn" onclick="App.ball(0,null,{type:'retired out',dismissed_id:${id}})">${esc(pname(id))}</button>`).join('')}</div>
    ${waiting.length ? `<div class="kv" style="padding-left:0"><span>⏱️ Timed out</span><span class="muted">next batter didn't arrive in time</span></div>
    <div class="plist">${waiting.map(p => `<button class="pbtn" onclick="App.ball(0,null,{type:'timed out',dismissed_id:${p.id}})">${esc(p.name)}</button>`).join('')}</div>` : ''}`);
};

/* ---------- wicket sheet with the extra dismissal types ---------- */
drawWicket = () => {
  const st = S.m, inn = curInn(), w = S.w;
  let types = [['bowled', 'Bowled'], ['caught', 'Caught'], ['lbw', 'LBW'], ['run out', 'Run out'], ['stumped', 'Stumped'], ['hit wicket', 'Hit wicket'], ['obstructing the field', 'Obstructing'], ['hit the ball twice', 'Hit ball twice']];
  if (w.extra === 'wd') types = types.filter(t => ['stumped', 'run out', 'hit wicket', 'obstructing the field'].includes(t[0]));
  if (['nb', 'b', 'lb'].includes(w.extra)) types = types.filter(t => ['run out', 'obstructing the field', 'hit the ball twice'].includes(t[0]));
  if (!w.type && types.length === 1) w.type = types[0][0];
  const chip = (label, fn, on) => `<button class="chip ${on ? 'on' : ''}" onclick="${fn}">${esc(label)}</button>`;
  const exName = { wd: 'wide', nb: 'no ball', b: 'bye', lb: 'leg bye' }[w.extra];
  const fieldW = ['run out', 'obstructing the field', 'hit the ball twice'].includes(w.type);
  let h = `<h3>Wicket! ☝️</h3><div class="sub">${exName ? 'Out on a ' + exName : 'How did the batter get out?'}</div>
    <div class="chips wrap">${types.map(([k, l]) => chip(l, `App.wSet('type','${k}')`, w.type === k)).join('')}</div>`;
  if (fieldW) {
    h += `<div class="field" style="margin-top:14px"><label>Who is out?</label><div class="chips wrap">${[inn.striker_id, inn.non_striker_id].filter(Boolean).map(id => chip(pname(id) + (id === inn.striker_id ? ' (striker)' : ''), `App.wSet('dismissed',${id})`, w.dismissed === id)).join('')}</div></div>
      <div class="field"><label>${w.extra === 'nb' ? 'Runs off the bat' : 'Runs completed'} before the wicket</label><div class="chips wrap">${[0, 1, 2, 3].map(r => chip(String(r), `App.wSet('runs',${r})`, w.runs === r)).join('')}</div></div>`;
  }
  if (['caught', 'run out', 'stumped'].includes(w.type)) {
    const label = w.type === 'caught' ? 'Caught by' : w.type === 'stumped' ? 'Stumped by (keeper)' : 'Run out by (optional)';
    h += `<div class="field" style="margin-top:14px"><label>${label}</label><div class="chips wrap">${st.xi[inn.bowling_team_id].map(p => chip((p.role === 'Wicket-keeper' ? '🧤 ' : '') + p.name + (p.id === inn.bowler_id ? ' (bowler)' : ''), `App.wSet('fielder',${p.id})`, w.fielder === p.id)).join('')}</div></div>`;
  }
  h += `<button class="btn red block" style="margin-top:8px" ${!w.type ? 'disabled' : ''} onclick="App.confirmWicket()">Confirm OUT</button>`;
  sheet(h);
};
App.confirmWicket = () => {
  const w = S.w;
  if (w.type === 'caught' && !w.fielder) return toast('Who took the catch?', true);
  const fieldW = ['run out', 'obstructing the field', 'hit the ball twice'].includes(w.type);
  let extra = w.extra, runs = fieldW ? w.runs : 0;
  if (['b', 'lb'].includes(extra) && runs === 0) extra = null;
  scoreAction('match_ball', { runs, extra, wicket: { type: w.type, fielder_id: w.fielder, dismissed_id: w.dismissed } });
};

/* ---------- ball details: shot type, wagon wheel, dropped catch, runs saved / missed ---------- */
App.lastBallDetail = () => {
  const inn = curInn();
  if (!inn.timeline.length) return toast('No ball to tag yet', true);
  App.ballDetailSheet(inn.id, inn.timeline[inn.timeline.length - 1].seq);
};
App.ballDetailSheet = (innId, seq) => {
  const st = S.m, inn = st.innings.find(i => i.id === innId), b = inn.timeline.find(x => x.seq === seq);
  if (!b) return;
  S.bd = { innId, seq, shot: b.shot || null, zone: b.zone || null, drop: b.drop_id || null, field: b.field_id || null, fruns: b.field_runs || 0 };
  drawBallDetail();
};
App.bdSet = (k, v) => { S.bd[k] = S.bd[k] === v && k !== 'fruns' ? null : v; drawBallDetail(); };
function drawBallDetail() {
  const st = S.m, d = S.bd, inn = st.innings.find(i => i.id === d.innId), b = inn.timeline.find(x => x.seq === d.seq);
  const chip = (label, fn, on) => `<button class="chip ${on ? 'on' : ''}" onclick="${fn}">${esc(label)}</button>`;
  const fielders = st.xi[inn.bowling_team_id];
  const chk = askShot();
  sheet(`<h3>🎯 Ball ${b.ov} - ${esc(b.label === '0' ? 'dot ball' : b.label)}</h3><div class="sub">${esc(b.desc)}</div>
    <div class="field"><label>Shot</label><div class="chips wrap">${st.match.shot_types.map(s => chip(`${SHOT_ICON[s] || ''} ${s}`, `App.bdSet('shot','${s}')`, d.shot === s)).join('')}</div></div>
    <div class="field"><label>Where did it go? <span class="muted">(right-hander's view, batter at the bottom)</span></label>${wagonWheel([], { pick: d.zone || 0, size: 230 })}</div>
    <div class="field"><label>Dropped catch by</label><div class="chips wrap">${fielders.map(p => chip(p.name, `App.bdSet('drop',${p.id})`, d.drop === p.id)).join('')}</div></div>
    <div class="field"><label>Fielding - runs saved (+) or given away (-)</label><div class="chips wrap">${[3, 2, 1, -1, -2, -3].map(r => chip((r > 0 ? '+' : '') + r, `App.bdSet('fruns',${r})`, d.fruns === r)).join('')}</div>
      ${d.fruns ? `<div class="chips wrap" style="margin-top:6px">${fielders.map(p => chip(p.name, `App.bdSet('field',${p.id})`, d.field === p.id)).join('')}</div>` : ''}</div>
    <label class="switch" style="margin:4px 0 10px"><span><b>Ask after every scoring shot</b><div class="small muted">Opens this sheet automatically</div></span><input type="checkbox" ${chk ? 'checked' : ''} onchange="try{localStorage.setItem('cs_askshot',this.checked?'1':'0')}catch(e){}"><span class="knob"></span></label>
    <div class="grid2"><button class="btn light" onclick="closeSheet()">Skip</button><button class="btn" onclick="App.bdSave()">Save</button></div>`);
}
App.pickZone = z => { if (S.fs) { S.fs.zone = S.fs.zone === z ? null : z; drawFieldSheet(); } else if (S.bd) App.bdSet('zone', z); };
App.fieldSheet = () => {
  const inn = curInn(); const pos = {}; Object.entries(inn.field || {}).forEach(([z, f]) => { pos[z] = f.id; });
  S.fs = { pos, zone: null }; drawFieldSheet();
};
function drawFieldSheet() {
  const st = S.m, inn = curInn(), f = S.fs;
  const xi = st.xi[inn.bowling_team_id];
  const nameOf = id => (xi.find(p => p.id === id) || { name: '?' }).name;
  const used = new Set(Object.values(f.pos));
  const chip = (label, fn, on, dis = false) => `<button class="chip ${on ? 'on' : ''}" ${dis ? 'disabled' : ''} onclick="${fn}">${esc(label)}</button>`;
  const labels = {}; Object.entries(f.pos).forEach(([z, id]) => { labels[z] = { name: nameOf(id) }; });
  sheet(`<h3>🧤 Set the field</h3><div class="sub">Tap a zone, then the fielder standing there. Commentary then says who fielded the ball. Bowler and keeper are known already.</div>
    ${wagonWheel([], { pick: f.zone || 0, size: 250, field: labels })}
    ${f.zone ? `<div class="field"><label>${ZONES[f.zone]}</label><div class="chips wrap">${chip('nobody', `App.fsSet(null)`, !f.pos[f.zone])}${xi.filter(p => p.id !== inn.bowler_id).map(p => chip(p.name, `App.fsSet(${p.id})`, f.pos[f.zone] === p.id, used.has(p.id) && f.pos[f.zone] !== p.id)).join('')}</div></div>` : ''}
    ${Object.keys(f.pos).length ? `<div class="small" style="margin:6px 0 10px">${Object.entries(f.pos).map(([z, id]) => `<b>${ZONES[z]}</b>: ${esc(nameOf(id))}`).join(' · ')}</div>` : ''}
    <div class="grid2"><button class="btn light" onclick="S.fs=null;closeSheet()">Cancel</button><button class="btn" onclick="App.fsSave()">Save field</button></div>`);
}
App.fsSet = id => { const f = S.fs; if (!f.zone) return; if (id) f.pos[f.zone] = id; else delete f.pos[f.zone]; f.zone = null; drawFieldSheet(); };
App.fsSave = () => run(async () => { S.m = await api('match_field', { id: S.m.match.id, positions: S.fs.pos }); S.fs = null; closeSheet(); toast('Field set ✓'); drawMatch(false); });
App.bdSave = () => run(async () => {
  const d = S.bd;
  S.m = await api('match_ball_detail', { id: S.m.match.id, innings_id: d.innId, seq: d.seq, shot_type: d.shot || '', shot_zone: d.zone || 0, drop_id: d.drop, field_id: d.fruns ? d.field : null, field_runs: d.fruns ? d.fruns : 0 });
  closeSheet(); toast('Ball tagged ✓'); drawMatch(false);
});
// ask for the shot after a scoring stroke when the scorer wants that
const _closeSheet = closeSheet;
closeSheet = () => { S.fs = null; _closeSheet(); };
const _ballFn = App.ball;
App.ball = async (runs, extra = null, wicket = null) => {
  const ok = await _ballFn(runs, extra, wicket);
  if (ok && askShot() && !wicket && extra !== 'wd' && runs > 0 && S.m && S.m.needs === 'ball') { const inn = curInn(); const b = inn.timeline[inn.timeline.length - 1]; if (b) App.ballDetailSheet(inn.id, b.seq); }
  return ok;
};

/** Wagon wheel SVG. balls: [{z, r, w}] ; opts.pick highlights one zone and makes zones tappable */
function wagonWheel(balls, { pick = null, size = 260, title = '', field = null } = {}) {
  const c = size / 2, R = c - 6, lines = [];
  const col = r => r >= 6 ? '#e63946' : r >= 4 ? '#1d7ad8' : r >= 3 ? '#8e44ad' : r >= 2 ? '#2a9d8f' : '#6c757d';
  const seg = []; const zoneRuns = {};
  for (let z = 1; z <= 8; z++) {
    const a0 = -Math.PI / 2 + (z - 1 - 4) * Math.PI / 4, a1 = a0 + Math.PI / 4;
    const p = (a, r) => [c + r * Math.cos(a), c + r * Math.sin(a)];
    const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R);
    seg.push(`<path d="M${c},${c} L${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" class="wz ${pick === z ? 'on' : ''}" ${pick !== null ? `onclick="App.pickZone(${z})"` : ''}/>`);
    const [lx, ly] = p((a0 + a1) / 2, R * 0.78);
    seg.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="wl">${ZONES[z]}</text>`);
    if (field && field[z]) { const [fx, fy] = p((a0 + a1) / 2, R * 0.5); seg.push(`<g class="wf" pointer-events="none"><circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="11"/><text x="${fx.toFixed(1)}" y="${(fy + 4).toFixed(1)}">${esc(field[z].name.split(' ').map(w => w[0]).slice(0, 2).join(''))}</text></g>`); }
  }
  balls.forEach((b, i) => {
    const a0 = -Math.PI / 2 + (b.z - 1 - 4) * Math.PI / 4;
    const a = a0 + Math.PI / 8 + ((i * 37) % 11 - 5) / 11 * Math.PI / 10;   // spread shots inside the zone
    const len = b.r >= 6 ? R : b.r >= 4 ? R * 0.96 : b.r === 3 ? R * 0.7 : b.r === 2 ? R * 0.55 : b.r === 1 ? R * 0.4 : R * 0.2;
    lines.push(`<line x1="${c}" y1="${c}" x2="${(c + len * Math.cos(a)).toFixed(1)}" y2="${(c + len * Math.sin(a)).toFixed(1)}" stroke="${col(b.r)}" stroke-width="${b.r >= 4 ? 2.5 : 1.6}" stroke-linecap="round" opacity=".9"/>`);
    zoneRuns[b.z] = (zoneRuns[b.z] || 0) + b.r;
  });
  for (let z = 1; z <= 8 && balls.length; z++) {
    const a0 = -Math.PI / 2 + (z - 1 - 4) * Math.PI / 4;
    const [lx, ly] = [c + R * 0.52 * Math.cos(a0 + Math.PI / 8), c + R * 0.52 * Math.sin(a0 + Math.PI / 8)];
    if (zoneRuns[z]) lines.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="wr">${zoneRuns[z]}</text>`);
  }
  return `<div class="wagon">${title ? `<div class="small muted" style="text-align:center;margin-bottom:4px">${title}</div>` : ''}<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <circle cx="${c}" cy="${c}" r="${R}" class="wg"/>${seg.join('')}${lines.join('')}
    <rect x="${c - 2}" y="${c - 11}" width="4" height="22" rx="2" fill="#c9a44c"/><circle cx="${c}" cy="${c}" r="3.5" fill="#0d4a36"/></svg>
    ${balls.length ? '<div class="wlegend"><i style="background:#6c757d"></i>1 <i style="background:#2a9d8f"></i>2 <i style="background:#8e44ad"></i>3 <i style="background:#1d7ad8"></i>4 <i style="background:#e63946"></i>6</div>' : ''}</div>`;
}

/* ---------- penalty runs ---------- */
App.penaltySheet = () => {
  const st = S.m, m = st.match;
  const list = m.penalties.length ? `<div class="card flush" style="margin-bottom:10px">${m.penalties.map(p => `<div class="kv"><span>${esc(teamById(p.team_id).short_name)} +${p.runs}${p.reason ? ' · ' + esc(p.reason) : ''}</span>${st.can_edit ? `<button class="btn sm light" onclick="App.penaltyUndo(${p.id})">Remove</button>` : '<span></span>'}</div>`).join('')}</div>` : '';
  sheet(`<h3>⚖️ Penalty runs</h3><div class="sub">5 penalty runs go to the other side for things like the ball hitting a helmet on the ground, a fielding-side time-out, or illegal fielding. You can also award bonus runs.</div>${list}
    <form onsubmit="event.preventDefault();App.penaltyAdd(this)">
      <div class="field"><label>Runs go to</label><select class="input" name="team_id"><option value="${st.team1.id}">${esc(st.team1.name)}</option><option value="${st.team2.id}">${esc(st.team2.name)}</option></select></div>
      <div class="grid2"><div class="field"><label>Runs</label><input class="input" type="number" name="runs" min="1" max="50" value="5"></div><div class="field"><label>Reason (optional)</label><input class="input" name="reason" maxlength="80" placeholder="e.g. ball hit the helmet"></div></div>
      <button class="btn block">Award runs</button></form>`);
};
App.penaltyAdd = f => run(async () => { S.m = await api('match_penalty', { id: S.m.match.id, team_id: +f.team_id.value, runs: +f.runs.value, reason: f.reason.value }); closeSheet(); toast('Penalty runs added'); drawMatch(false); });
App.penaltyUndo = pid => run(async () => { S.m = await api('match_penalty_undo', { id: S.m.match.id, penalty_id: pid }); closeSheet(); toast('Penalty removed'); drawMatch(false); });

/* ---------- wrong batter / overs / powerplay / officials ---------- */
App.changeBatterSheet = () => {
  const st = S.m, inn = curInn();
  const faced = new Set(); inn.timeline.forEach(b => { faced.add(b.bat_id); if (b.ns_id) faced.add(b.ns_id); if (b.out_id) faced.add(b.out_id); });
  const fresh = [inn.striker_id, inn.non_striker_id].filter(id => id && !faced.has(id));
  if (!fresh.length) return sheet(`<h3>🔀 Wrong batter?</h3><div class="sub">Both batters have already been at the crease for a ball, so they can't be swapped. Use 🩹 Retire if someone has to leave.</div>`);
  const waiting = st.xi[inn.batting_team_id].filter(p => st.available_batters.includes(p.id));
  S.cb = { out: fresh[0], in: null };
  sheet(`<h3>🔀 Wrong batter?</h3><div class="sub">Swap a batter who was picked by mistake and hasn't faced a ball yet.</div>
    <div class="field"><label>Replace</label><div class="chips wrap" id="cbout">${fresh.map(id => `<button class="chip ${S.cb.out === id ? 'on' : ''}" onclick="S.cb.out=${id};[...this.parentNode.children].forEach(c=>c.classList.toggle('on',c===this))">${esc(pname(id))}</button>`).join('')}</div></div>
    <div class="field"><label>With</label><div class="plist">${waiting.map(p => `<button class="pbtn" onclick="App.changeBatter(${p.id})">${roleIcon(p.role)} ${esc(p.name)}</button>`).join('')}</div></div>`);
};
App.changeBatter = inId => run(async () => { S.m = await api('match_batter_change', { id: S.m.match.id, out_id: S.cb.out, in_id: inId }); closeSheet(); toast('Batter changed'); drawMatch(false); });

App.oversSheet = () => {
  const m = S.m.match;
  sheet(`<h3>🔢 Change overs</h3><div class="sub">Allowed before the match and during the first innings - for example if the ground is only free for a shorter time. For rain use Rain / DLS instead.</div>
    <form class="row" onsubmit="event.preventDefault();App.setOvers(this.o.value)"><input class="input grow" type="number" name="o" min="1" max="100" value="${m.overs}"><button class="btn sm">Save</button></form>`);
};
App.setOvers = v => run(async () => { S.m = await api('match_overs', { id: S.m.match.id, overs: +v }); closeSheet(); toast('Overs updated'); drawMatch(false); });
App.powerplaySheet = () => {
  const m = S.m.match;
  sheet(`<h3>⚡ Powerplay</h3><div class="sub">Number of powerplay overs at the start of each innings (0 = none). Shown on the scoreboard and in Analysis.</div>
    <form class="row" onsubmit="event.preventDefault();App.setPP(this.o.value)"><input class="input grow" type="number" name="o" min="0" max="${m.overs}" value="${m.powerplay_overs}"><button class="btn sm">Save</button></form>`);
};
App.setPP = v => run(async () => { S.m = await api('match_powerplay', { id: S.m.match.id, overs: +v }); closeSheet(); toast('Powerplay saved'); drawMatch(false); });
App.detailsSheet = () => {
  const m = S.m.match, o = m.officials || {};
  const f = (k, l, ph) => `<div class="field"><label>${l}</label><input class="input" name="${k}" maxlength="60" value="${esc(o[k] || '')}" placeholder="${ph}"></div>`;
  sheet(`<h3>🧑‍⚖️ Officials & live stream</h3><div class="sub">Shown on the match page for everyone.</div>
    <form onsubmit="event.preventDefault();App.saveDetails(this)"><div class="grid2">${f('umpire1', 'Umpire 1', 'Name')}${f('umpire2', 'Umpire 2', 'Name')}${f('third_umpire', 'Third umpire', 'optional')}${f('referee', 'Match referee', 'optional')}${f('scorer_name', 'Scorer', 'Name')}${f('commentator', 'Commentator', 'optional')}</div>
      <div class="field"><label>Live stream link (YouTube / Facebook / any)</label><input class="input" name="stream_url" type="url" maxlength="255" value="${esc(m.stream_url || '')}" placeholder="https://youtube.com/live/..."></div>
      <button class="btn block">Save</button></form>`);
};
App.saveDetails = f => run(async () => { S.m = await api('match_details', { id: S.m.match.id, ...formData(f) }); closeSheet(); toast('Saved ✓'); drawMatch(false); });
App.superOver = () => confirmSheet('Play a super over?', 'Each side bats one over with two wickets. The side that batted second bats first. Super-over runs do not count in player stats.', 'Start super over',
  () => run(async () => { S.m = await api('match_super_over', { id: S.m.match.id }); closeSheet(); toast('Super over! Pick the openers'); drawMatch(false); }), false);

/* ---------- match options menu ---------- */
App.matchMenu = () => {
  const st = S.m, m = st.match;
  const live = st.innings.length && curInn().status === 'live' && m.status === 'live';
  const inn1 = !st.innings.length || (st.innings.length === 1 && curInn().status === 'live');
  sheet(`<h3>Match options</h3><div class="sub">${esc(st.team1.name)} vs ${esc(st.team2.name)}</div><div class="plist">
    ${st.needs === 'completed' && m.status !== 'abandoned' ? '<button class="pbtn" onclick="App.undo()">↶ Undo last ball (re-open match)</button>' : ''}
    ${m.can_super_over && st.can_edit ? '<button class="pbtn" onclick="App.superOver()">🔥 Play a super over</button>' : ''}
    ${live ? '<button class="pbtn" onclick="App.endInnings()">⏹️ End this innings now</button>' : ''}
    ${['live', 'scheduled'].includes(m.status) || m.result_method === 'rain' ? '<button class="pbtn" onclick="App.rainSheet()">🌧️ Rain / DLS - reduce overs, revised target</button>' : ''}
    ${inn1 && m.status !== 'completed' ? `<button class="pbtn" onclick="App.oversSheet()">🔢 Change overs <span class="s">${m.overs} overs now</span></button>` : ''}
    ${m.status !== 'completed' ? `<button class="pbtn" onclick="App.powerplaySheet()">⚡ Powerplay overs <span class="s">${m.powerplay_overs || 'none'}</span></button>` : ''}
    ${m.status !== 'abandoned' ? '<button class="pbtn" onclick="App.penaltySheet()">⚖️ Penalty / bonus runs</button>' : ''}
    ${st.innings.length ? '<button class="pbtn" onclick="S.mTab=\'overs\';closeSheet();drawMatch(false);toast(\'Tap any ball in the Overs tab to edit it\')">✏️ Edit an earlier ball</button>' : ''}
    <button class="pbtn" onclick="App.detailsSheet()">🧑‍⚖️ Officials & live stream</button>
    ${['live', 'scheduled'].includes(m.status) ? '<button class="pbtn" onclick="App.abandon()">⛔ Abandon match (no result)</button>' : ''}
    ${st.is_owner ? `<button class="pbtn" onclick="App.scorerSheet()">✍️ Scorer <span class="s">${m.scorer ? esc(m.scorer.display_name) + ' (@' + esc(m.scorer.username) + ')' : 'only you'}</span></button>` : ''}
    ${st.is_owner ? (m.visibility === 'private'
      ? '<button class="pbtn" onclick="App.setVis(\'public\')">🌍 Make match public <span class="s">everyone can watch</span></button>'
      : '<button class="pbtn" onclick="App.setVis(\'private\')">🔒 Make match private <span class="s">only you can see it</span></button>') : ''}
    ${m.visibility === 'private' ? '' : '<button class="pbtn" onclick="App.shareMatch()">🔗 Share live score link</button>'}
    ${m.visibility === 'private' ? '' : `<button class="pbtn" onclick="App.overlayInfo()">📺 Score overlay for streaming</button>`}
    ${st.innings.length ? '<button class="pbtn" onclick="App.downloadCard()">🖼️ Download scorecard image</button>' : ''}
    ${st.is_owner ? '<button class="pbtn" style="color:var(--red)" onclick="App.deleteMatch()">🗑️ Delete match</button>' : ''}</div>`);
};
App.overlayInfo = () => {
  const url = (window.CS_SITE_URL || location.origin + '/') + 'overlay.php?m=' + S.m.match.id;
  sheet(`<h3>📺 Score overlay</h3><div class="sub">Streaming on YouTube with OBS or a phone app? Add this link as a <b>browser source</b> (1280×140, transparent) and the live score ticker appears on your stream, updating every few seconds. Free.</div>
    <input class="input" readonly value="${esc(url)}" onclick="this.select()">
    <div class="grid2" style="margin-top:10px"><button class="btn light" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(url)}').then(()=>toast('Link copied'))">Copy link</button><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Preview</a></div>`);
};

/* ---------- result card: super over, best performers, officials ---------- */
resultCard = st => {
  const m = st.match;
  const hero = (icon, label, p) => p ? `<div class="pom" onclick="go('#/player/${p.id}')"><span class="avatar">${icon}</span><div><div class="small">${label}</div><b style="font-size:18px;margin:0">${esc(p.name)}</b></div></div>` : '';
  return `<div class="content"><div class="result-card"><div class="tr">${m.status === 'abandoned' ? '🌧️' : '🏆'}</div><b>${esc(m.result_text || 'Match finished')}</b>
    ${hero('⭐', 'Player of the Match', m.player_of_match)}${m.best_bat && (!m.player_of_match || m.best_bat.id !== m.player_of_match.id) ? hero('🏏', 'Best batter', m.best_bat) : ''}${m.best_bowl && (!m.player_of_match || m.best_bowl.id !== m.player_of_match.id) ? hero('🎯', 'Best bowler', m.best_bowl) : ''}</div>
    ${m.can_super_over && st.can_edit ? `<button class="btn red block" style="margin-bottom:10px" onclick="App.superOver()">🔥 It's a tie - play a super over</button>` : ''}
    <div class="grid2" style="margin-bottom:12px"><button class="btn light" onclick="App.downloadCard()">🖼️ Scorecard image</button>${st.can_edit ? `<button class="btn light" onclick="go('${m.tournament ? '#/tournament/' + m.tournament.id : '#/match/new'}')">${m.tournament ? '← Tournament' : '＋ New match'}</button>` : `<button class="btn light" onclick="App.shareMatch()">🔗 Share</button>`}</div></div>`;
};

/* ---------- stream + officials cards ---------- */
function streamEmbed(url) {
  if (!url) return '';
  let id = null; const m1 = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
  if (m1) id = m1[1];
  return `<div class="card flush stream">${id ? `<iframe src="https://www.youtube.com/embed/${esc(id)}" title="Live stream" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`
    : `<a class="btn block" href="${esc(url)}" target="_blank" rel="noopener">📺 Watch the live stream</a>`}</div>`;
}
function officialsCard(m) {
  const o = m.officials || {}; const keys = { umpire1: 'Umpire', umpire2: 'Umpire', third_umpire: 'Third umpire', referee: 'Referee', scorer_name: 'Scorer', commentator: 'Commentator' };
  const rows = Object.keys(keys).filter(k => o[k]).map(k => `<div class="kv"><span>${keys[k]}</span><span>${esc(o[k])}</span></div>`);
  if (m.penalties && m.penalties.length) rows.push(...m.penalties.map(p => `<div class="kv"><span>⚖️ Penalty runs</span><span>+${p.runs} to ${esc(teamById(p.team_id).short_name)}${p.reason ? ' · ' + esc(p.reason) : ''}</span></div>`));
  if (m.powerplay_overs) rows.push(`<div class="kv"><span>⚡ Powerplay</span><span>${plural(m.powerplay_overs, 'over')}</span></div>`);
  return rows.length ? `<div class="card flush" style="margin-bottom:12px"><div class="kv" style="border-top:0"><span>Match officials</span><span></span></div>${rows.join('')}</div>` : '';
}
const _preBoard = preBoard;
preBoard = st => _preBoard(st) + (st.match.stream_url || (st.match.officials && Object.keys(st.match.officials).length) ? `<div class="content" style="padding-bottom:0">${streamEmbed(st.match.stream_url)}${officialsCard(st.match)}</div>` : '');

/* ---------- tabs: + Analysis, tappable balls in Overs ---------- */
matchTabs = st => {
  const tabs = [['card', 'Scorecard'], ['overs', 'Overs'], ['comm', 'Ball by ball'], ['analysis', 'Analysis']];
  const n = st.innings.length;
  if (S.cardInn === null || S.cardInn >= n || S.cardInnN !== n) { S.cardInn = n - 1; S.cardInnN = n; }
  const innName = i => (i.super ? 'SO ' : '') + teamById(i.batting_team_id).short_name;
  const innSel = n > 1 && S.mTab !== 'analysis' ? `<div class="chips" style="margin-bottom:10px">${st.innings.map((i, k) => `<button class="chip ${k === S.cardInn ? 'on' : ''}" onclick="S.cardInn=${k};drawMatch(false)">${esc(innName(i))} ${i.runs}/${i.wickets}</button>`).join('')}</div>` : '';
  const inn = st.innings[S.cardInn];
  const body = S.mTab === 'overs' ? oversView(st, inn) : S.mTab === 'comm' ? commView(st, inn) : S.mTab === 'analysis' ? analysisView(st) : scorecardView(st, inn);
  const extra = (S.mTab === 'card') ? streamEmbed(st.match.stream_url) + officialsCard(st.match) : '';
  return `<div class="content" style="padding-top:2px">${extra}<div class="seg">${tabs.map(([k, l]) => `<button class="${S.mTab === k ? 'on' : ''}" onclick="S.mTab='${k}';drawMatch(false)">${l}</button>`).join('')}</div>${innSel}${body}</div>`;
};
const _scorecardView = scorecardView;
scorecardView = (st, inn) => {
  let h = _scorecardView(st, inn);
  if (inn.extras_detail.pen) h = h.replace(`nb ${inn.extras_detail.nb})`, `nb ${inn.extras_detail.nb}, pen ${inn.extras_detail.pen})`);
  if (inn.powerplay) h = h.replace('<div class="inn-head" style="background:var(--pitch-3)">', `<div class="kv"><span>⚡ Powerplay (${plural(inn.powerplay.overs, 'over')})</span><span>${inn.powerplay.runs}/${inn.powerplay.wkts}${inn.powerplay.live ? ' · live' : ''}</span></div><div class="inn-head" style="background:var(--pitch-3)">`);
  return h;
};
oversView = (st, inn) => {
  const ov = inn.overs_list;
  if (!ov.length) return '<div class="card empty">No overs bowled yet.</div>';
  const max = Math.max(6, ...ov.map(o => o.runs));
  const bars = ov.map(o => `<div class="bar ${o.wkts ? 'hasw' : ''}" style="height:${Math.max(3, o.runs / max * 100)}%" title="Over ${o.over}: ${o.runs}"></div>`).join('');
  const step = ov.length > 20 ? 5 : ov.length > 10 ? 2 : 1;
  const xs = ov.map(o => `<span>${o.over % step === 0 || o.over === 1 ? o.over : ''}</span>`).join('');
  const byOver = {}; inn.timeline.forEach(b => (byOver[b.over_no] = byOver[b.over_no] || []).push(b));
  const list = [...ov].reverse().map(o => `<div class="comm"><span class="ov">Ov ${o.over}</span><div class="grow"><div class="row" style="justify-content:space-between"><b class="small">${esc(o.bowler)}</b><b class="small">${plural(o.runs, 'run')}${o.wkts ? ' · ' + plural(o.wkts, 'wkt') : ''}</b></div>
    <div class="row" style="gap:5px;flex-wrap:wrap;margin-top:6px">${(byOver[o.over - 1] || []).map(b => `<span ${st.can_edit ? `class="tap" onclick="App.editBallSheet(${inn.id},${b.seq})"` : ''}>${ballChip(b.label)}</span>`).join('')}</div></div></div>`).join('');
  return `<div class="card flush"><div class="kv" style="border-top:0"><span>Runs per over</span><span class="muted small">● = wicket${st.can_edit ? ' · tap a ball to edit it' : ''}</span></div><div class="bars">${bars}</div><div class="bars-x">${xs}</div>${list}</div>`;
};
commView = (st, inn) => {
  const tl = [...inn.timeline].reverse().slice(0, 150);
  if (!tl.length) return '<div class="card empty">No balls bowled yet.</div>';
  const tag = b => [b.shot ? `${SHOT_ICON[b.shot] || ''} ${b.shot}` : '', b.zone ? ZONES[b.zone] : '', b.drop ? `dropped by ${b.drop}` : '', b.field_runs ? `${b.field} ${b.field_runs > 0 ? 'saved' : 'gave away'} ${Math.abs(b.field_runs)}` : ''].filter(Boolean).join(' · ');
  return `<div class="card flush">${tl.map(b => `<div class="comm ${b.w ? 'w' : ''}" ${st.can_edit ? `onclick="App.editBallSheet(${inn.id},${b.seq})"` : ''}><span class="ov">${b.ov}</span><div class="grow" style="display:flex;align-items:flex-start;gap:8px">${ballChip(b.label)}<span class="small" style="flex:1">${esc(b.desc)}${tag(b) ? `<div class="muted">${esc(tag(b))}</div>` : ''}</span>${b.pp ? '<span class="pill up" style="flex:none">PP</span>' : ''}</div></div>`).join('')}</div>`;
};

/* ---------- edit / delete an earlier ball ---------- */
App.editBallSheet = (innId, seq) => {
  const st = S.m, inn = st.innings.find(i => i.id === innId), b = inn.timeline.find(x => x.seq === seq);
  if (!b || !st.can_edit) return;
  const nonDelivery = ['retired hurt', 'retired out', 'timed out'].includes(b.wt);
  S.eb = { innId, seq, runs: b.ex === 'wd' ? Math.max(0, b.xr - 1) : (b.ex === 'b' || b.ex === 'lb') ? b.xr : b.rb, extra: b.ex, wtype: b.wt, out: b.out_id, fld: b.fld_id, nd: nonDelivery, b };
  drawEditBall();
};
App.ebSet = (k, v) => { S.eb[k] = v; if (k === 'wtype' && v && !['run out', 'obstructing the field', 'hit the ball twice', 'retired hurt', 'retired out', 'timed out'].includes(v)) S.eb.out = S.eb.b.bat_id; if (k === 'wtype' && !v) { S.eb.out = null; S.eb.fld = null; } drawEditBall(); };
function drawEditBall() {
  const st = S.m, e = S.eb, b = e.b, inn = st.innings.find(i => i.id === e.innId);
  const chip = (label, fn, on) => `<button class="chip ${on ? 'on' : ''}" onclick="${fn}">${esc(label)}</button>`;
  const types = [['', 'Not out'], ['bowled', 'Bowled'], ['caught', 'Caught'], ['lbw', 'LBW'], ['run out', 'Run out'], ['stumped', 'Stumped'], ['hit wicket', 'Hit wicket'], ['obstructing the field', 'Obstructing'], ['hit the ball twice', 'Hit twice']];
  const crease = [b.bat_id, b.ns_id].filter(Boolean);
  const fieldW = ['run out', 'obstructing the field', 'hit the ball twice'].includes(e.wtype);
  let h = `<h3>✏️ Edit ball ${b.ov}</h3><div class="sub">${esc(b.desc)}</div>`;
  if (e.nd) h += `<div class="notice">This entry is "${esc(b.wt)}" - it can only be deleted.</div>`;
  else h += `<div class="field"><label>Runs${e.extra === 'wd' ? ' (besides the wide)' : e.extra === 'nb' ? ' off the bat' : ''}</label><div class="chips wrap">${[0, 1, 2, 3, 4, 5, 6, 7].map(r => chip(String(r), `App.ebSet('runs',${r})`, e.runs === r)).join('')}</div></div>
    <div class="field"><label>Extra</label><div class="chips wrap">${[[null, 'None'], ['wd', 'Wide'], ['nb', 'No ball'], ['b', 'Byes'], ['lb', 'Leg byes']].map(([k, l]) => chip(l, `App.ebSet('extra',${k === null ? 'null' : `'${k}'`})`, e.extra === k)).join('')}</div></div>
    <div class="field"><label>Wicket</label><div class="chips wrap">${types.map(([k, l]) => chip(l, `App.ebSet('wtype',${k ? `'${k}'` : 'null'})`, (e.wtype || '') === k)).join('')}</div></div>
    ${fieldW ? `<div class="field"><label>Who was out?</label><div class="chips wrap">${crease.map(id => chip(pname(id), `App.ebSet('out',${id})`, e.out === id)).join('')}</div></div>` : ''}
    ${['caught', 'run out', 'stumped'].includes(e.wtype) ? `<div class="field"><label>Fielder</label><div class="chips wrap">${st.xi[inn.bowling_team_id].map(p => chip(p.name, `App.ebSet('fld',${p.id})`, e.fld === p.id)).join('')}</div></div>` : ''}`;
  h += `<div class="grid2" style="margin-top:6px"><button class="btn light" style="color:var(--red)" onclick="App.deleteBall()">🗑️ Delete ball</button>${e.nd ? '<button class="btn light" onclick="closeSheet()">Close</button>' : '<button class="btn" onclick="App.saveBall()">Save changes</button>'}</div>
    <div class="small muted" style="margin-top:10px">Every ball after this one is re-counted automatically with the same batters and bowlers.</div>`;
  sheet(h);
}
App.saveBall = () => run(async () => {
  const e = S.eb;
  const wicket = e.wtype ? { type: e.wtype, dismissed_id: e.out || e.b.bat_id, fielder_id: e.fld } : null;
  S.m = await api('match_ball_edit', { id: S.m.match.id, innings_id: e.innId, seq: e.seq, runs: e.runs, extra: e.extra, wicket });
  closeSheet(); toast('Ball updated - later balls re-counted'); drawMatch(false);
});
App.deleteBall = () => confirmSheet('Delete this ball?', 'It is removed and everything after it is re-counted.', 'Delete', () => run(async () => {
  const e = S.eb;
  S.m = await api('match_ball_delete', { id: S.m.match.id, innings_id: e.innId, seq: e.seq });
  closeSheet(); toast('Ball deleted'); drawMatch(false);
}));

/* ---------- Analysis tab ---------- */
function analysisView(st) {
  const inns = st.innings.filter(i => !i.super);
  if (!inns.length || !inns.some(i => i.timeline.length)) return '<div class="card empty">Charts appear once the first ball is bowled.</div>';
  S.anBat = S.anBat || {};
  const colOf = i => teamById(i.batting_team_id).color || '#0d4a36';
  const name = i => teamById(i.batting_team_id).short_name;
  const bpo = st.match.balls_per_over;
  // Manhattan
  const maxOv = Math.max(...inns.map(i => i.overs_list.length), 1);
  const maxR = Math.max(6, ...inns.flatMap(i => i.overs_list.map(o => o.runs)));
  const W = 320, H = 150, px = 28, py = 10, gw = (W - px - 6) / maxOv;
  let man = '';
  inns.forEach((i, k) => i.overs_list.forEach(o => {
    const bw = Math.max(2, (gw - 4) / inns.length), x = px + (o.over - 1) * gw + k * bw, h = (o.runs / maxR) * (H - py - 18);
    man += `<rect x="${x.toFixed(1)}" y="${(H - 18 - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${colOf(i)}" rx="2"/>` + (o.wkts ? `<circle cx="${(x + bw / 2).toFixed(1)}" cy="${(H - 24 - h).toFixed(1)}" r="3" fill="#e63946"/>` : '');
  }));
  const xl = []; for (let o = 1; o <= maxOv; o += (maxOv > 20 ? 5 : maxOv > 10 ? 2 : 1)) xl.push(`<text x="${(px + (o - 1) * gw + gw / 2).toFixed(1)}" y="${H - 4}" class="ax">${o}</text>`);
  const yl = [0, Math.round(maxR / 2), maxR].map(v => `<text x="${px - 4}" y="${(H - 18 - v / maxR * (H - py - 18) + 4).toFixed(1)}" class="ax" text-anchor="end">${v}</text><line x1="${px}" x2="${W}" y1="${(H - 18 - v / maxR * (H - py - 18)).toFixed(1)}" y2="${(H - 18 - v / maxR * (H - py - 18)).toFixed(1)}" class="grid"/>`);
  const legend = inns.map(i => `<span><i style="background:${colOf(i)}"></i>${esc(name(i))}</span>`).join('');
  // Worm (cumulative runs per ball) and run rate per over
  const worm = inns.map(i => { let r = 0; const pts = [[0, 0]]; let legal = 0; i.timeline.forEach(b => { r += b.rb + b.xr; if (!['wd', 'nb'].includes(b.ex) && !['retired hurt', 'retired out', 'timed out'].includes(b.wt)) legal++; pts.push([legal / bpo, r, b.w]); }); return pts; });
  const maxX = Math.max(...worm.map(p => p[p.length - 1][0]), 1), maxY = Math.max(...worm.map(p => p[p.length - 1][1]), 10);
  const wormSvg = inns.map((i, k) => { const p = worm[k]; const path = p.map(([x, y], j) => `${j ? 'L' : 'M'}${(px + x / maxX * (W - px - 6)).toFixed(1)},${(H - 18 - y / maxY * (H - py - 18)).toFixed(1)}`).join(' ');
    const dots = p.filter(q => q[2]).map(([x, y]) => `<circle cx="${(px + x / maxX * (W - px - 6)).toFixed(1)}" cy="${(H - 18 - y / maxY * (H - py - 18)).toFixed(1)}" r="3" fill="#e63946"/>`).join('');
    return `<path d="${path}" fill="none" stroke="${colOf(i)}" stroke-width="2.5" stroke-linejoin="round"/>${dots}`; }).join('');
  const wx = []; for (let o = 0; o <= Math.ceil(maxX); o += (maxX > 20 ? 5 : maxX > 10 ? 2 : 1)) wx.push(`<text x="${(px + o / maxX * (W - px - 6)).toFixed(1)}" y="${H - 4}" class="ax">${o}</text>`);
  const wy = [0, Math.round(maxY / 2), maxY].map(v => `<text x="${px - 4}" y="${(H - 18 - v / maxY * (H - py - 18) + 4).toFixed(1)}" class="ax" text-anchor="end">${v}</text>`);
  const rr = inns.map(i => { let r = 0; return i.overs_list.map((o, j) => { r += o.runs; return +(r / (j + 1)).toFixed(2); }); });
  const maxRR = Math.max(6, ...rr.flat());
  const rrSvg = inns.map((i, k) => `<path d="${rr[k].map((v, j) => `${j ? 'L' : 'M'}${(px + (j + 1) / maxOv * (W - px - 6)).toFixed(1)},${(H - 18 - v / maxRR * (H - py - 18)).toFixed(1)}`).join(' ')}" fill="none" stroke="${colOf(i)}" stroke-width="2.5" stroke-linejoin="round"/>`).join('');
  const ry = [0, (maxRR / 2).toFixed(1), maxRR.toFixed(1)].map(v => `<text x="${px - 4}" y="${(H - 18 - v / maxRR * (H - py - 18) + 4).toFixed(1)}" class="ax" text-anchor="end">${v}</text>`);
  // Wickets pie
  const wk = {}; inns.forEach(i => i.timeline.forEach(b => { if (b.w) wk[b.wt] = (wk[b.wt] || 0) + 1; }));
  // Types of runs
  const runTypes = inns.map(i => { const t = { dot: 0, 1: 0, 2: 0, 3: 0, 4: 0, 6: 0, extras: 0 }; i.timeline.forEach(b => { if (['retired hurt', 'retired out', 'timed out'].includes(b.wt)) return; if (b.ex && b.ex !== 'nb') t.extras += b.xr; else if (b.ex === 'nb') { t.extras += b.xr; if (b.rb in t) t[b.rb]++; } else if (b.rb === 0) t.dot++; else if (b.rb in t) t[b.rb]++; }); return t; });
  // Wagon wheel filter
  const allBats = []; inns.forEach(i => i.batting.forEach(b => allBats.push({ id: b.id, name: b.name, inn: i.id })));
  const sel = S.anBat.id || null;
  const wagonBalls = inns.flatMap(i => i.wagon.filter(w => !sel || w.p === sel).map(w => ({ z: w.z, r: w.r })));
  const card = (title, body, note = '') => `<div class="card flush" style="margin-bottom:12px"><div class="kv" style="border-top:0"><span>${title}</span><span class="muted small">${note}</span></div>${body}</div>`;
  const svg = inner => `<svg viewBox="0 0 ${W} ${H}" class="chart">${inner}</svg>`;
  const pie = (data, colors) => { const tot = Object.values(data).reduce((a, b) => a + b, 0); if (!tot) return '<div class="muted small" style="padding:12px 14px">No wickets yet</div>'; let a = -Math.PI / 2; const cx = 60, cy = 60, r = 52; let paths = ''; const leg = [];
    Object.entries(data).forEach(([k, v], i) => { const a1 = a + v / tot * Math.PI * 2; const large = a1 - a > Math.PI ? 1 : 0; const p = t => [cx + r * Math.cos(t), cy + r * Math.sin(t)]; const [x0, y0] = p(a), [x1, y1] = p(a1);
      paths += tot === v ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${colors[i % colors.length]}"/>` : `<path d="M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${colors[i % colors.length]}"/>`; a = a1; leg.push(`<span><i style="background:${colors[i % colors.length]}"></i>${esc(k)} <b>${v}</b></span>`); });
    return `<div class="pie"><svg viewBox="0 0 120 120" width="120" height="120">${paths}</svg><div class="legend col">${leg.join('')}</div></div>`; };
  const PIEC = ['#0d4a36', '#1d7ad8', '#e63946', '#f4a261', '#8e44ad', '#2a9d8f', '#c9a44c', '#6c757d'];
  const typeRows = ['dot', '1', '2', '3', '4', '6', 'extras'].map(k => `<tr><td>${{ dot: 'Dot balls', 1: 'Singles', 2: 'Twos', 3: 'Threes', 4: 'Fours', 6: 'Sixes', extras: 'Extras' }[k]}</td>${runTypes.map(t => `<td>${t[k]}</td>`).join('')}</tr>`).join('');
  const parts = inns.map(i => `<div class="kv"><span>${esc(name(i))}</span><span></span></div>` + (i.partnerships.length ? i.partnerships.map(p => { const mx = Math.max(...i.partnerships.map(q => q.runs), 1); return `<div class="part"><div class="row" style="justify-content:space-between"><span class="small"><b>${p.players.map(q => esc(q.name) + ' ' + q.r + '(' + q.b + ')').join(' & ')}</b></span><b>${p.runs} (${p.balls})</b></div><div class="pbar"><i style="width:${Math.round(p.runs / mx * 100)}%;background:${colOf(i)}"></i></div><div class="small muted">${p.unbroken ? 'unbroken' : 'wicket ' + p.wkt} · ${p.unbroken ? 'current' : 'at ' + p.score}</div></div>`; }).join('') : '<div class="muted small" style="padding:8px 14px">No partnerships yet</div>')).join('');
  const field = inns.flatMap(i => i.fielding.map(f => `<div class="kv"><span>${f.kind === 'drop' ? '🫳 Dropped catch' : f.kind === 'saved' ? '🧤 Runs saved' : '😬 Runs given away'}</span><span>${esc(f.name)}${f.runs ? ' · ' + f.runs : ''}${f.bat ? ' · off ' + esc(f.bat) : ''} · ov ${f.ov}</span></div>`));
  const pp = inns.filter(i => i.powerplay).map(i => `<div class="kv"><span>${esc(name(i))}</span><span>${i.powerplay.runs}/${i.powerplay.wkts} in ${i.powerplay.overs} ov (RR ${i.powerplay.balls ? (i.powerplay.runs * bpo / i.powerplay.balls).toFixed(2) : '0.00'})</span></div>`);
  return `<div class="legend" style="margin-bottom:8px">${legend}</div>
    ${card('Manhattan', svg(yl.join('') + man + xl.join('')), 'runs per over · ● wicket')}
    ${card('Worm', svg(wy.join('') + wormSvg + wx.join('')), 'runs vs overs')}
    ${card('Run rate', svg(ry.join('') + rrSvg + xl.join('')), 'after each over')}
    ${card('Wagon wheel', `<div class="chips" style="padding:6px 14px 0">${[['', 'All batters'], ...allBats.map(b => [b.id, b.name])].map(([id, n]) => `<button class="chip ${(sel || '') === id ? 'on' : ''}" onclick="S.anBat={id:${id || 'null'}};drawMatch(false)">${esc(n)}</button>`).join('')}</div>` + (wagonBalls.length ? wagonWheel(wagonBalls, { size: 280 }) : '<div class="muted small" style="padding:12px 14px">Tag shots with 🎯 Shot & fielding while scoring to fill the wheel.</div>'), 'runs by direction')}
    ${card('Wickets', pie(wk, PIEC), 'how batters got out')}
    ${card('Types of runs', `<table class="tbl"><tr><th></th>${inns.map(i => `<th>${esc(name(i))}</th>`).join('')}</tr>${typeRows}</table>`)}
    ${card('Partnerships', parts)}
    ${pp.length ? card('⚡ Powerplay', pp.join('')) : ''}
    ${field.length ? card('Fielding', field.join('')) : ''}`;
}

/* ---------- scorecard as an image ---------- */
App.downloadCard = async () => {
  const st = S.m, m = st.match, inns = st.innings;
  const W = 900, pad = 36, lh = 30; let lines = 0;
  inns.forEach(i => { lines += 4 + i.batting.length + i.bowling.length + (i.fow.length ? 1 : 0) + 1; });
  const H = 200 + lines * lh + 90;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#0d4a36'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff'; g.font = '800 40px Nunito, Arial'; g.fillText(`${st.team1.short_name} vs ${st.team2.short_name}`, pad, 70);
  g.font = '600 20px Nunito, Arial'; g.fillStyle = '#b6e94a'; g.fillText([m.title, m.tournament?.name, `${m.overs} overs`, m.venue, fmtDate(m.match_date, false)].filter(Boolean).join(' · '), pad, 104);
  g.fillStyle = '#fff'; g.font = '800 26px Nunito, Arial'; g.fillText(m.result_text || (m.status === 'live' ? 'Live' : 'Upcoming'), pad, 150);
  let y = 190;
  const row = (cols, xs, bold = false, color = '#1b1b1b') => { g.fillStyle = color; g.font = `${bold ? 800 : 600} 20px Nunito, Arial`; cols.forEach((t, i) => { g.textAlign = i ? 'right' : 'left'; g.fillText(String(t), xs[i], y); }); g.textAlign = 'left'; y += lh; };
  g.fillStyle = '#f5f1e6'; g.fillRect(0, 170, W, H - 170 - 60);
  const xs = [pad, 560, 640, 700, 760, 860];
  inns.forEach(i => {
    const bt = teamById(i.batting_team_id);
    g.fillStyle = '#0d4a36'; g.fillRect(pad - 10, y - 24, W - pad * 2 + 20, 36); g.fillStyle = '#fff'; g.font = '800 22px Nunito, Arial'; g.fillText(`${i.super ? 'Super over - ' : ''}${bt.name}  ${i.runs}/${i.wickets} (${i.overs} ov)`, pad, y + 2); y += lh + 6;
    row(['Batter', 'R', 'B', '4s', '6s', 'SR'], xs, true, '#6b6b6b');
    i.batting.forEach(b => { row([`${b.name}  ${b.how === 'not out' ? '*' : ''}`, b.r, b.b, b.f4, b.f6, b.sr], xs, false); g.fillStyle = '#8a8a8a'; g.font = '500 15px Nunito, Arial'; g.fillText(b.how, pad + 8, y - lh + 18); });
    row([`Extras ${i.extras} (b ${i.extras_detail.b}, lb ${i.extras_detail.lb}, wd ${i.extras_detail.wd}, nb ${i.extras_detail.nb}${i.extras_detail.pen ? ', pen ' + i.extras_detail.pen : ''})`], xs, false, '#444');
    if (i.fow.length) row(['FoW: ' + i.fow.map(f => `${f.score}-${f.wkt} (${f.name}, ${f.overs})`).join(', ')], xs, false, '#444');
    row(['Bowler', 'O', 'M', 'R', 'W', 'Econ'], xs, true, '#6b6b6b');
    i.bowling.forEach(b => row([b.name, b.o, b.m, b.r, b.w, b.econ], xs));
    y += 10;
  });
  g.fillStyle = '#b6e94a'; g.font = '700 18px Nunito, Arial'; g.fillText(`Scored with Cric-Scorer · ${(window.CS_SITE_URL || '').replace(/^https?:\/\//, '')}m/${m.id}`, pad, H - 24);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], `scorecard-${m.id}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'Scorecard' }); return; } catch (e) { /* fall through */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  toast('Scorecard image saved');
};

/* ---------- scoreboard tags (powerplay / super over) ---------- */
const _scoreBoard = scoreBoard;
scoreBoard = (st, inn) => {
  let h = _scoreBoard(st, inn);
  if (inn.super) h = h.replace(`${inn.no === 1 ? '1st' : '2nd'} innings</span>`, 'Super over</span>');
  if (inn.powerplay && inn.powerplay.live) h = h.replace('<div class="meta">', '<div class="meta"><span class="pp-tag">⚡ Powerplay</span>');
  return h;
};

/* ---------- new match form: powerplay ---------- */
const _viewMatchNew = viewMatchNew;
viewMatchNew = async tid => {
  await _viewMatchNew(tid);
  const grid = document.querySelector('form.content .grid3');
  if (grid) grid.insertAdjacentHTML('afterend', `<div class="field" style="margin-top:8px"><label>Powerplay overs (0 = none)</label><input class="input" type="number" name="powerplay_overs" min="0" max="100" value="0"></div>`);
};

/* ---------- player insights ---------- */
function insightsCard(ins) {
  if (!ins) return '';
  const ph = ins.phases, bp = ins.bow_phases || ins.bowl_phases;
  const any = Object.values(ph).some(p => p.b) || Object.values(bp).some(p => p.b) || Object.keys(ins.dismissals).length;
  if (!any) return `<div class="section"><h2>🔍 Insights</h2><span class="small muted">free</span></div><div class="card empty small">Insights build up as matches are scored.</div>`;
  const PH = { powerplay: '⚡ Powerplay', middle: '🧭 Middle', death: '🔥 Death' };
  const bars = (obj, val, max, fmt) => Object.entries(obj).map(([k, v]) => `<div class="irow"><span>${PH[k] || esc(k)}</span><div class="ibar"><i style="width:${max ? Math.round(val(v) / max * 100) : 0}%"></i></div><b>${fmt(v)}</b></div>`).join('');
  const phMax = Math.max(...Object.values(ph).map(p => p.sr || 0), 1), bpMax = Math.max(...Object.values(bp).map(p => p.econ || 0), 1);
  const dis = Object.entries(ins.dismissals); const dTot = dis.reduce((a, [, v]) => a + v, 0);
  const zones = Object.entries(ins.zones).map(([z, v]) => ({ z: +z, r: v.r }));
  const shots = Object.entries(ins.shots).slice(0, 6);
  return `<div class="section"><h2>🔍 Insights</h2><span class="small muted">free · like the pros</span></div>
    ${ins.strengths.length || ins.weaknesses.length ? `<div class="card"><div class="small" style="margin-bottom:6px"><b>Strengths</b></div>${ins.strengths.length ? ins.strengths.map(s => `<div class="ins ok">✅ ${esc(s)}</div>`).join('') : '<div class="small muted">Keep playing - more data needed</div>'}
      <div class="small" style="margin:10px 0 6px"><b>Work on</b></div>${ins.weaknesses.length ? ins.weaknesses.map(s => `<div class="ins warn">⚠️ ${esc(s)}</div>`).join('') : '<div class="small muted">Nothing stands out yet</div>'}</div>` : ''}
    <div class="card flush"><div class="kv" style="border-top:0"><span>🏏 Batting by phase</span><span class="muted small">strike rate</span></div><div style="padding:6px 14px 10px">${bars(ph, p => p.sr || 0, phMax, p => p.b ? `${p.r} (${p.b}) SR ${p.sr}${p.o ? ' · out ' + p.o : ''}` : '-')}</div>
      <div class="kv"><span>🎯 Bowling by phase</span><span class="muted small">economy</span></div><div style="padding:6px 14px 10px">${bars(bp, p => p.econ || 0, bpMax, p => p.b ? `${p.w}w · ${p.r} off ${Math.floor(p.b / 6)}.${p.b % 6} · econ ${p.econ}` : '-')}</div>
      ${dTot ? `<div class="kv"><span>☝️ How they get out</span><span></span></div><div style="padding:6px 14px 10px">${dis.map(([k, v]) => `<div class="irow"><span>${esc(k)}</span><div class="ibar"><i style="width:${Math.round(v / dTot * 100)}%;background:var(--red)"></i></div><b>${v}</b></div>`).join('')}</div>` : ''}
      ${shots.length ? `<div class="kv"><span>💥 Favourite shots</span><span class="muted small">runs (balls)</span></div><div style="padding:6px 14px 10px">${shots.map(([k, v]) => `<div class="irow"><span>${SHOT_ICON[k] || ''} ${esc(k)}</span><div class="ibar"><i style="width:${Math.round(v.r / Math.max(1, shots[0][1].r) * 100)}%"></i></div><b>${v.r} (${v.b})</b></div>`).join('')}</div>` : ''}
      ${zones.length ? wagonWheel(zones, { size: 260, title: 'Career wagon wheel' }) : ''}
      ${ins.fielding.drops || ins.fielding.saved || ins.fielding.missed ? `<div class="kv"><span>🧤 Fielding</span><span>${ins.fielding.saved} saved · ${ins.fielding.missed} given away · ${plural(ins.fielding.drops, 'drop')}</span></div>` : ''}</div>`;
}
const _viewPlayer = viewPlayer;
viewPlayer = async id => {
  await _viewPlayer(id);
  const d = S.player; if (!d || !d.stats || !d.stats.insights) return;
  const content = document.querySelector('#app .content, main .content, .content');
  if (content) content.insertAdjacentHTML('beforeend', insightsCard(d.stats.insights));
};

/* ---------- tournament boundary tracker ---------- */
const _viewTournament = viewTournament;
viewTournament = async id => {
  await _viewTournament(id);
  const d = S.tour; if (!d || S.tTab !== 'leaders' || !d.leaders || !d.leaders.totals) return;
  const t = d.leaders.totals, seg = document.querySelector('.content .seg');
  if (!seg) return;
  seg.insertAdjacentHTML('afterend', `<div class="card flush" style="margin-bottom:4px"><div class="kv" style="border-top:0"><span>💥 Boundary tracker</span><span class="muted small">${plural(t.mats, 'match')}</span></div>
    <div class="statgrid">${[[t.fours, 'Fours'], [t.sixes, 'Sixes'], [t.runs, 'Runs'], [t.wkts, 'Wickets'], [t.balls ? Math.round(t.dots * 100 / t.balls) + '%' : '-', 'Dot balls'], [t.balls ? (t.runs * 6 / t.balls).toFixed(2) : '-', 'Run rate']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div></div>`);
};

/* the router captured the original screen builders - point it at the extended ones */
ROUTES.forEach(r => { if (r[1] === _viewPlayer) r[1] = viewPlayer; else if (r[1] === _viewTournament) r[1] = viewTournament; else if (r[1] === _viewMatchNew) r[1] = viewMatchNew; });

/* ---------- voice commentary says where the ball went ---------- */
const _announce = announce;
announce = (before, after) => {
  const inns = after.innings, inn = inns[inns.length - 1];
  const bi = before ? before.innings.find(i => i.no === inn.no) : null;
  const b = inn && inn.timeline.length > (bi ? bi.timeline.length : 0) ? inn.timeline[inn.timeline.length - 1] : null;
  S.zoneLine = b && b.zone && !b.w && (!b.ex || b.ex === 'nb') ? b.desc.replace(/^[^,]*, /, '').replace(/!/g, '.') + '.' : null;
  try { _announce(before, after); } finally { S.zoneLine = null; }
};
const _soundLine = Sound.line;
Sound.line = (key, d) => {
  if (S.zoneLine && ['dot', 'run1', 'run2', 'run3', 'four', 'six', 'noball'].includes(key)) { const t = S.zoneLine; S.zoneLine = null; return key === 'noball' ? 'No ball. ' + t : t.charAt(0).toUpperCase() + t.slice(1); }
  return _soundLine(key, d);
};
