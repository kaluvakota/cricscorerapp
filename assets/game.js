/* Cric-Scorer · Gully Duel - quick 1v1 cricket in the style of Cricket League.
   Behind-the-batter view. Bat: touch and hold to lift the bat as the bowler runs in, then release and flick the way you
   want to hit (short flick = along the ground, long flick = in the air, plain tap = block). Bowl: pick a bowler each
   over, a named delivery, over or round the wicket, drag the landing circle and stop the power bar in the blue.
   Three wides or three no-balls lose the game; time out twice and you lose. Coins for every game unlock new players.
   Rules live in game-engine.js (and inc/game.php for online games). */
'use strict';
const Duel = (() => {
  const X = {};
  const G = window.GE;
  const SIDE_UI = [[1, 'Over the wicket'], [-1, 'Round the wicket']];
  const BALL_ICON = { seam: '🎯', outswing: '↪️', inswing: '↩️', bouncer: '⬆️', yorker: '⬇️', slower: '🐢', cutter: '✂️', offbreak: '🌀', legbreak: '🔄', doosra: '🎭', flipper: '⚡', arm: '➡️' };
  const BAND = [[0, 0.16, 'Yorker', 'rgba(140,90,220,.30)'], [0.16, 0.42, 'Full', 'rgba(40,140,240,.26)'], [0.42, 0.66, 'Good', 'rgba(70,200,90,.30)'], [0.66, 0.84, 'Short', 'rgba(255,160,40,.30)'], [0.84, 1, 'Bouncer', 'rgba(230,50,60,.30)']];
  const BOWL_TIME = 15;
  const get = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const seed32 = () => (Math.random() * 4294967296) >>> 0;
  const lineName = x => (Math.abs(x) > 1.3 ? 'Wide!' : x > 0.42 ? 'Outside off' : x < -0.42 ? 'Leg side' : 'On the stumps');
  const stadiumOf = id => G.STADIUMS.find(s => s.id === id) || G.STADIUMS[0];
  const STYLE_NAME = ['Fast', 'Swing', 'Spin'];
  const face = (c, size = 40) => `<span class="ch-face" style="width:${size}px;height:${size}px;background:${c.kit};font-size:${Math.round(size * 0.42)}px">${esc(c.name[0])}</span>`;

  let D = null;           // the game on screen
  let P = null;           // my game profile: coins, unlocked players, squad, stadium
  let raf = 0;

  /* ================= Lobby, squad and stadium ================= */
  async function profile(force) {
    if (!P || force) P = await api('game_profile');
    if (!G.squadOk(P.squad)) P.squad = { bat: 'aarav', bowl: ['zara', 'rohan', 'aarav'] };
    return P;
  }
  X.lobby = async () => {
    leaveScreen();
    mount(topbar('Gully Duel', { back: true, refresh: false }) + `<div class="content">${sk(3)}</div>`, 'more');
    await profile(true);
    const ov = +get('cs_duel_ov', 2), wk = +get('cs_duel_wk', 2), st = stadiumOf(P.stadium);
    const opt = (name, vals, cur) => `<div class="seg duel-seg">${vals.map(v => `<button type="button" class="${v === cur ? 'on' : ''}" onclick="Duel.pick(this,'${name}',${v})">${v}</button>`).join('')}</div>`;
    const sq = P.squad, bat = G.charById(sq.bat);
    mount(topbar('Gully Duel', { back: true, refresh: false }) + `<div class="content">
      <div class="duel-hero"><div class="row" style="justify-content:space-between"><div><h2>Bat vs Bowl</h2><p>Quick 2-over matches. Swipe to smash, aim to bowl them out!</p></div>
        <div class="coins">🪙 ${P.coins}<small>${P.wins}W · ${P.losses}L</small></div></div></div>
      <div class="card squad-card" onclick="go('#/play/squad')"><div class="row"><div class="faces">${face(bat, 46)}${sq.bowl.map(id => face(G.charById(id), 34)).join('')}</div>
        <div class="grow"><b>My squad</b><div class="small muted">🏏 ${esc(bat.name)} · 🎯 ${sq.bowl.map(id => esc(G.charById(id).name)).join(', ')}</div></div><span class="chev">${I.chev}</span></div></div>
      <div class="card" onclick="Duel.stadiumSheet()" style="cursor:pointer"><div class="row"><span class="stad-dot" style="background:linear-gradient(${st.sky[0]},${st.grass})"></span><div class="grow"><b>🏟️ ${esc(st.name)}</b><div class="small muted">Tap to change stadium</div></div><span class="chev">${I.chev}</span></div></div>
      <div class="card"><div class="row" style="justify-content:space-between"><b>Overs each</b>${opt('ov', [1, 2, 3, 5], ov)}</div>
        <div class="row" style="justify-content:space-between;margin-top:10px"><b>Wickets</b>${opt('wk', [1, 2, 3, 5], wk)}</div></div>
      <div class="duel-modes">
        <button class="duel-mode" onclick="Duel.startCpu()"><span class="ic">⚡</span><b>Quick match</b><span>You vs the computer - win coins!</span></button>
        <button class="duel-mode" onclick="Duel.createRoom()"><span class="ic">📱📱</span><b>Play a friend online</b><span>Get a 4-digit code</span></button>
        <button class="duel-mode" onclick="Duel.joinSheet()"><span class="ic">🔢</span><b>Join with a code</b><span>Type your friend's code</span></button>
        <button class="duel-mode" onclick="Duel.startLocal()"><span class="ic">👫</span><b>Two players, one phone</b><span>Pass the phone</span></button>
        <button class="duel-mode" onclick="Duel.startNets()"><span class="ic">🥅</span><b>Practice nets</b><span>Endless balls, no pressure</span></button>
      </div>
      <div class="card"><b>How to play</b><div class="small muted duel-how">
        <p>🏏 <b>Batting:</b> as the bowler runs in, <b>touch and hold</b> to lift your bat. When the ball reaches you, <b>let go and flick</b> in the direction you want to hit. A <b>short flick</b> keeps it on the ground, a <b>long flick</b> goes in the air (sixes - but you can be caught!). A plain <b>tap</b> blocks.</p>
        <p>⏱️ The bar on the left grades your timing: <b style="color:#1c7ed6">blue</b> is perfect. Hit the <b>gaps</b> between fielders on the little map.</p>
        <p>🎯 <b>Bowling:</b> pick a bowler for the over, a delivery (outswing, yorker, doosra…), over or round the wicket, <b>drag the circle</b> to the spot and tap <b>BOWL</b> with the power bar in the <b style="color:#1c7ed6">blue</b>. Red = no-ball and a free hit.</p>
        <p>⚠️ <b>Three wides or three no-balls</b> and you lose. Run out of time twice and you lose. Win games to earn 🪙 and unlock new players.</p></div></div>
    </div>`, 'more');
  };
  X.pick = (btn, name, v) => { btn.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn)); put('cs_duel_' + name, v); };
  const opts = () => ({ overs: +get('cs_duel_ov', 2), wickets: +get('cs_duel_wk', 2), squad: P && P.squad, stadium: P && P.stadium });

  X.squad = async () => {
    leaveScreen();
    mount(topbar('My squad', { back: true, refresh: false }) + `<div class="content">${sk(3)}</div>`, 'more');
    await profile();
    drawSquad();
  };
  function drawSquad() {
    const sq = P.squad, bar = (v, max = 1.4) => `<i style="width:${Math.round(Math.min(1, v / max) * 100)}%"></i>`;
    const cards = G.CHARS.map(c => {
      const have = P.chars.includes(c.id), isBat = sq.bat === c.id, bi = sq.bowl.indexOf(c.id);
      return `<div class="ch-card ${have ? '' : 'locked'}"><div class="row">${face(c, 48)}<div class="grow"><b>${esc(c.name)}</b><div class="small muted">${esc(c.tag)} · ${STYLE_NAME[c.bowl.style]} bowler</div></div>
          ${have ? `<div class="ch-roles">${isBat ? '<span class="role-tag on">🏏 Batter</span>' : ''}${bi >= 0 ? `<span class="role-tag on">🎯 Bowler ${bi + 1}</span>` : ''}</div>` : `<span class="ch-cost">🪙 ${c.cost}</span>`}</div>
        <div class="ch-stats"><span>Power</span><div>${bar(c.bat.power)}</div><span>Timing</span><div>${bar(c.bat.timing)}</div><span>Pace</span><div>${bar(c.bowl.pace)}</div><span>Accuracy</span><div>${bar(c.bowl.acc)}</div><span>Swing/turn</span><div>${bar(c.bowl.move)}</div></div>
        <div class="row" style="margin-top:8px">${have
          ? `<button class="btn sm ${isBat ? 'light' : ''}" onclick="Duel.setBat('${c.id}')">${isBat ? '✓ Batting' : 'Make batter'}</button><button class="btn sm ${bi >= 0 ? 'light' : ''}" onclick="Duel.toggleBowl('${c.id}')">${bi >= 0 ? '✓ Bowling' : 'Add as bowler'}</button>`
          : `<button class="btn sm lime" ${P.coins < c.cost ? 'disabled' : ''} onclick="Duel.unlock('${c.id}',${c.cost})">${P.coins < c.cost ? `Need ${c.cost - P.coins} more 🪙` : `Unlock for 🪙 ${c.cost}`}</button>`}</div></div>`;
    }).join('');
    mount(topbar('My squad', { back: true, refresh: false }) + `<div class="content">
      <div class="card"><div class="row"><div class="grow"><b>🪙 ${P.coins} coins</b><div class="small muted">Win a game: +60 online, +30 vs the computer. Lose: +15 / +10.</div></div></div></div>
      <div class="small muted" style="margin:0 2px 10px">Pick <b>one batter</b> and up to <b>three bowlers</b>. You choose which bowler bowls each over during the game.</div>
      ${cards}</div>`, 'more');
  }
  X.setBat = id => { P.squad.bat = id; saveSquad(); };
  X.toggleBowl = id => {
    const b = P.squad.bowl, i = b.indexOf(id);
    if (i >= 0) { if (b.length === 1) return toast('Keep at least one bowler', true); b.splice(i, 1); }
    else { if (b.length >= 3) return toast('Three bowlers max - remove one first', true); b.push(id); }
    saveSquad();
  };
  function saveSquad() { run(async () => { P = await api('game_squad', { squad: P.squad, stadium: P.stadium }); drawSquad(); }); }
  X.unlock = (id, cost) => confirmSheet(`Unlock ${G.charById(id).name}?`, `Spend 🪙 ${cost} of your ${P.coins} coins.`, 'Unlock', () => run(async () => {
    P = await api('game_unlock', { id }); closeSheet(); toast(`${G.charById(id).name} joined your squad! 🎉`); Sound.fx('cheer'); drawSquad();
  }), false);
  X.stadiumSheet = () => sheet(`<h3>🏟️ Choose a stadium</h3><div class="stad-grid">${G.STADIUMS.map(s => `<button class="stad ${P.stadium === s.id ? 'on' : ''}" style="background:linear-gradient(${s.sky[0]},${s.sky[1]} 45%,${s.grass} 46%)" onclick="Duel.setStadium('${s.id}')"><b>${esc(s.name)}</b><span>${s.night ? '🌙 Night' : '☀️ Day'}</span></button>`).join('')}</div>`);
  X.setStadium = id => run(async () => { P.stadium = id; P = await api('game_squad', { squad: P.squad, stadium: id }); closeSheet(); X.lobby(); });

  /* ================= Local games ================= */
  X.startCpu = () => sheet(`<h3>🪙 Toss time!</h3><div class="sub">You won the toss. What would you like to do?</div>
      <div class="grid2"><button class="btn" onclick="Duel.cpuGo(0)">🏏 Bat first</button><button class="btn light" onclick="Duel.cpuGo(1)">🎯 Bowl first</button></div>`);
  X.cpuGo = first => {
    closeSheet();
    const o = opts(), r = G.rng(seed32());
    const pool = G.CHARS.map(c => c.id), pick = () => pool.splice(Math.floor(r() * pool.length), 1)[0];
    const cpuSquad = { bat: pick(), bowl: [pick(), pick(), pick()] };
    startLocal({ mode: 'cpu', g: G.newGame(o.overs, o.wickets, first, [P.squad, cpuSquad], P.stadium), names: [S.user.display_name.split(' ')[0], 'Computer'], human: [true, false] });
  };
  X.startNets = () => startLocal({ mode: 'nets', g: G.newGame(20, 10, 0, [P.squad, { bat: 'aarav', bowl: ['zara', 'rohan', 'dev'] }], P.stadium), names: [S.user.display_name.split(' ')[0], 'Bowling machine'], human: [true, false], nets: { runs: 0, balls: 0, outs: 0, perfect: 0, fours: 0, sixes: 0 } });
  X.startLocal = () => {
    const n = (get('cs_duel_names', '') || '').split('|');
    sheet(`<h3>👫 Two players, one phone</h3><div class="sub">Pass the phone - one bowls, the other bats, then swap. Both play with your squad.</div>
      <form onsubmit="Duel.localGo(event)"><div class="grid2"><div class="field"><label>Player 1</label><input class="input" name="a" value="${esc(n[0] || 'Aarush')}" maxlength="16" required></div>
      <div class="field"><label>Player 2</label><input class="input" name="b" value="${esc(n[1] || 'Aayush')}" maxlength="16" required></div></div>
      <button class="btn block">🪙 Toss & play</button></form>`);
  };
  X.localGo = e => {
    e.preventDefault();
    const f = formData(e.target), names = [f.a.trim() || 'Player 1', f.b.trim() || 'Player 2'];
    put('cs_duel_names', names.join('|')); closeSheet();
    const o = opts(), first = Math.random() < 0.5 ? 0 : 1;
    startLocal({ mode: 'local', g: G.newGame(o.overs, o.wickets, first, [P.squad, P.squad], P.stadium), names, human: [true, true], toss: `🪙 ${names[first]} won the toss and will bat first!` });
  };
  function startLocal(o) {
    D = Object.assign({ me: 0, dead: false, r: G.rng(seed32()), aim: { x: 0.15, l: 0.5, ball: '', side: 1 } }, o);
    openScreen();
    if (o.toss) toast(o.toss);
    nextLocal();
  }
  async function nextLocal() {
    if (!D || D.dead) return;
    const g = D.g;
    drawHud();
    if (g.phase === 'done') return showResult();
    const inn = g.inn[g.cur], bowler = 1 - inn.bat;
    if (D.human[bowler]) {
      if (inn.balls % 6 === 0 && D.mode !== 'nets' && g.squads[bowler].bowl.length > 1) await pickBowlerSheet();
      if (!D || D.dead) return;
      return setPhase('bowl');
    }
    if (inn.balls % 6 === 0) G.setBowler(g, g.squads[bowler].bowl[Math.floor(D.r() * g.squads[bowler].bowl.length)]);
    setPhase('wait', D.mode === 'nets' ? '' : `${D.names[bowler]} is getting ready to bowl…`);
    await sleep(D.mode === 'nets' ? 400 : 800);
    if (!D || D.dead) return;
    const b = G.cpuBowl(D.r, G.bowlerOf(g).bowl.style);
    localBowl(b);
  }
  async function localBowl(b) {
    const g = D.g, d = G.bowl(g, 0, 0, b.x, b.l, b.v, seed32(), b.ball, b.side), batter = g.inn[g.cur].bat;
    const human = D.human[batter];
    if (D.mode === 'local') { setPhase('wait', `${D.names[batter]}, get ready to bat!`); await sleep(1200); if (!D || D.dead) return; }
    setPhase(human ? 'bat' : 'wait', human ? '' : `${D.names[batter]} is batting…`);
    const cpu = human ? null : G.cpuBat(d, D.r, 0.62);
    const shot = await playBall(d, { human, cpu });
    if (!D || D.dead) return;
    const res = G.bat(g, shot);
    if (D.nets) tallyNets(res);
    await showOutcome(res);
    if (!D || D.dead) return;
    if (D.mode === 'nets' && (g.phase === 'done' || g.cur === 1)) { D.g = G.newGame(20, 10, 0, g.squads, g.stadium); }
    if (res.inningsOver && D.mode !== 'nets') await inningsBreak();
    nextLocal();
  }
  function tallyNets(res) {
    const n = D.nets;
    n.runs += res.runs; if (res.legal) n.balls++; if (res.kind === 'out') n.outs++; if (res.timing === 'perfect') n.perfect++;
    if (res.runs === 4) n.fours++; if (res.runs === 6) n.sixes++;
  }
  /** Local/CPU: the human bowler ran out of time */
  function localTimeout() {
    const g = D.g, who = 1 - g.inn[g.cur].bat;
    const what = G.timeout(g, who);
    if (what === 'lost') { setPhase('wait', ''); drawHud(); return showResult(); }
    flash('TIME OUT - last warning!', 'bad'); Sound.fx('wide');
    const b = G.cpuBowl(D.r, G.bowlerOf(g).bowl.style);
    localBowl(b);
  }

  /* ================= Online games ================= */
  X.createRoom = () => run(async () => { const r = await api('game_create', opts()); go('#/play/room/' + r.code); });
  X.joinSheet = () => sheet(`<h3>🔢 Join a game</h3><div class="sub">Ask your friend for the 4-digit code on their screen.</div>
    <form onsubmit="Duel.joinGo(event)"><input class="input duel-code-in" name="code" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="0000" autocomplete="off" required autofocus>
    <button class="btn block" style="margin-top:12px">Join game</button></form>`);
  X.joinGo = e => { e.preventDefault(); const c = formData(e.target).code.trim(); closeSheet(); go('#/play/join/' + c); };
  X.join = code => run(async () => {
    mount(topbar('Gully Duel', { back: true, refresh: false }) + `<div class="content">${sk(2)}</div>`, 'more');
    await profile();
    const r = await api('game_join', { code, squad: P.squad });
    go('#/play/room/' + r.code);
  });
  X.room = async code => {
    leaveScreen();
    await profile();
    const r = await api('game_get', { code });
    if (r.status === 'waiting') return waitingRoom(r);
    startOnline(r);
  };
  function waitingRoom(r) {
    const link = location.origin + location.pathname + '#/play/join/' + r.code;
    mount(topbar('Gully Duel', { back: true, refresh: false }) + `<div class="content"><div class="card duel-wait">
      <div class="small muted">Tell your friend this code</div><div class="duel-code">${esc(r.code)}</div>
      <div class="small muted">They open <b>Gully Duel → Join with a code</b> and type it in.</div>
      <div class="duel-dots"><i></i><i></i><i></i></div><b>Waiting for your friend to join…</b>
      <div class="small muted" style="margin-top:4px">${r.overs} over${r.overs > 1 ? 's' : ''} each · ${r.wickets} wicket${r.wickets > 1 ? 's' : ''}</div>
      <div class="grid2" style="margin-top:14px"><button class="btn light" onclick="Duel.shareCode('${esc(r.code)}','${esc(link)}')">📤 Send code</button><button class="btn light" onclick="Duel.cancelRoom('${esc(r.code)}')">Cancel</button></div>
    </div></div>`, 'more');
    const tok = S.routeTok;
    const poll = async () => {
      if (tok !== S.routeTok) return;
      try { const s = await api('game_get', { code: r.code }); if (s.status !== 'waiting') { Sound.fx('cheer'); return startOnline(s); } } catch (e) { if (e.stale) return; }
      setTimeout(poll, 1500);
    };
    setTimeout(poll, 1500);
  }
  X.shareCode = async (code, link) => {
    const text = `🏏 Play Gully Duel with me on Cric-Scorer! Code: ${code}`;
    if (navigator.share) { try { await navigator.share({ title: 'Gully Duel', text, url: link }); } catch (e) { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(text + '\n' + link); toast('Copied! Paste it to your friend'); } catch (e) { toast('Code: ' + code); } }
  };
  X.cancelRoom = code => run(async () => { await api('game_leave', { code }); go('#/play'); });

  function startOnline(r) {
    D = { mode: 'online', code: r.code, v: r.v, g: r.state, names: r.names, me: r.me, human: [true, true], dead: false, status: r.status,
      aim: { x: 0.15, l: 0.5, ball: '', side: 1 }, shownBall: 0, shownLast: r.state && r.state.last ? r.state.last.id : 0, chain: Promise.resolve(), rematch: r.rematch, warnedN: -1 };
    openScreen();
    if (r.state && r.state.toss !== undefined && !r.state.n) toast(`🪙 ${r.names[r.state.toss]} won the toss and will bat first!`);
    onlineApply(r, true);
    pollOnline();
  }
  async function pollOnline() {
    if (!D || D.dead || D.mode !== 'online') return;
    try { const r = await apiQuiet('game_get', { code: D.code, v: D.v }); if (D && !D.dead && !r.same) onlineApply(r); } catch (e) { /* keep trying */ }
    if (D && !D.dead && D.mode === 'online') D.pollT = setTimeout(pollOnline, D.status === 'live' ? 600 : 2500);
  }
  function apiQuiet(action, data) {
    return fetch('api.php?action=' + action, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CricScorer', 'X-App-Version': window.CS_VERSION || '' }, body: JSON.stringify(data) })
      .then(r => r.json()).then(j => { if (j.error) throw new Error(j.error); return j; });
  }
  function onlineApply(r, first) {
    if (!D || (r.v < D.v && !first)) return;
    D.v = r.v; D.g = r.state; D.names = r.names; D.status = r.status; D.rematch = r.rematch;
    const g = D.g;
    if (D.rematch && D.resultShown) { const c = D.rematch; leaveScreen(); return go('#/play/room/' + c); }
    D.chain = D.chain.then(async () => {
      if (!D || D.dead) return;
      const last = g.last;
      if (last && last.id !== D.shownLast) {
        D.shownLast = last.id; D.curBall = last.delivery;
        if (D.shownBall !== last.id) { D.shownBall = last.id; setPhase('wait', ''); await playBall(last.delivery, { replay: last }); }
        await showOutcome(last);
        if (last.inningsOver) await inningsBreak();
      }
      if (g.warned && g.warned.n !== D.warnedN && g.phase !== 'done') { D.warnedN = g.warned.n; flash(g.warned.who === D.me ? 'TIME OUT - last warning!' : 'Opponent timed out - warning', 'bad'); }
      onlineTurn();
    });
  }
  async function onlineTurn() {
    if (!D || D.dead) return;
    const g = D.g;
    drawHud();
    if (D.status === 'abandoned' || g.phase === 'done') return showResult();
    const inn = g.inn[g.cur], batter = inn.bat, bowler = 1 - batter;
    if (g.phase === 'bowl') {
      if (bowler === D.me) {
        if (inn.balls % 6 === 0 && !inn.bowler && g.squads[bowler].bowl.length > 1 && D.pickedFor !== g.n) { D.pickedFor = g.n; await pickBowlerSheet(); if (!D || D.dead) return; }
        setPhase('bowl');
      } else {
        setPhase('wait', `${D.names[bowler]} is choosing a delivery…`);
        clearTimeout(D.stuckT);
        D.stuckT = setTimeout(() => { if (D && !D.dead && D.g.phase === 'bowl') setPhase('wait', `${D.names[bowler]} is taking too long…`, 'bowl'); }, 26000);
      }
    } else if (g.phase === 'bat' && g.ball && D.shownBall !== g.ball.id) {
      D.shownBall = g.ball.id;
      const ball = g.ball;
      D.curBall = ball;
      if (batter === D.me) {
        setPhase('bat');
        D.chain = D.chain.then(() => playBall(ball, { human: true }).then(async shot => {
          if (!D || D.dead) return;
          try { const r = await apiQuiet('game_bat', Object.assign({ code: D.code, id: ball.id }, shot)); if (D && !D.dead) onlineApply(r); }
          catch (e) { toast(e.message, true); }
        }));
      } else {
        setPhase('wait', `${D.names[batter]} is facing…`);
        D.chain = D.chain.then(() => playBall(ball, { watch: true }));
        clearTimeout(D.stuckT);
        D.stuckT = setTimeout(() => { if (D && !D.dead && D.g.phase === 'bat') setPhase('wait', `${D.names[batter]} hasn't played yet…`, 'bat'); }, 21000);
      }
    }
  }
  X.nudge = () => { if (D && D.mode === 'online' && D.g.ball) apiQuiet('game_nudge', { code: D.code, id: D.g.ball.id }).then(r => onlineApply(r)).catch(e => toast(e.message, true)); };
  X.callTime = () => { if (D && D.mode === 'online') apiQuiet('game_timeout', { code: D.code }).then(r => onlineApply(r)).catch(e => toast(e.message, true)); };

  /** Start of an over: which bowler? */
  function pickBowlerSheet() {
    return new Promise(res => {
      const g = D.g, inn = g.inn[g.cur], sq = g.squads[1 - inn.bat];
      X._pickBowler = id => {
        closeSheet();
        if (D.mode === 'online') apiQuiet('game_set_bowler', { code: D.code, bowler: id }).then(r => { onlineApply(r); }).catch(() => {});
        else G.setBowler(g, id);
        D.aim.ball = ''; res();
      };
      sheet(`<h3>🎯 Who bowls this over?</h3><div class="sub">Over ${Math.floor(inn.balls / 6) + 1} of ${g.overs}</div>
        <div class="bowler-list">${sq.bowl.map(id => { const c = G.charById(id); return `<button class="bowler-pick" onclick="Duel._pickBowler('${id}')">${face(c, 44)}<div class="grow"><b>${esc(c.name)}</b><div class="small muted">${STYLE_NAME[c.bowl.style]} · ${esc(c.tag)}</div></div><span class="chev">${I.chev}</span></button>`; }).join('')}</div>`, { locked: true });
    });
  }

  /* ================= The game screen ================= */
  function openScreen() {
    closeSheet();
    let el = document.getElementById('duel');
    if (!el) { el = document.createElement('div'); el.id = 'duel'; document.body.appendChild(el); }
    document.body.classList.add('duel-open');
    el.className = 'duel mode-' + D.mode + (get('cs_duel_portrait', '0') === '1' ? ' force-portrait' : '');
    el.innerHTML = `<div class="d-top"><button class="d-x" aria-label="Exit game" onclick="Duel.exit()">✕</button><div class="d-hud" id="dHud"></div>
        <button class="d-x" aria-label="Sound" onclick="Duel.toggleSound()" id="dSnd">${Sound.sfx ? '🔊' : '🔇'}</button></div>
      <div class="d-stage"><canvas id="dCv"></canvas><div class="d-ui" id="dUi"></div><div class="d-flash" id="dFlash"></div><div class="d-msg" id="dMsg"></div></div>
      <div class="d-rotate"><div class="phone">📱</div><b>Turn your phone sideways</b><span>Gully Duel is played in landscape. Turn off rotation lock if the screen doesn't turn.</span>
        <button class="btn sm light" onclick="Duel.portrait()">Play upright instead</button></div>`;
    try {
      const fs = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (fs && fs.then) fs.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
    } catch (e) { /* not supported */ }
    D.cv = document.getElementById('dCv');
    D.cv.addEventListener('pointerdown', onDown);
    D.cv.addEventListener('pointermove', onMove);
    D.cv.addEventListener('pointerup', onUp);
    D.cv.addEventListener('pointercancel', onUp);
    window.addEventListener('resize', onResize);
    V.reset();
    V.crowd = []; for (let i = 0; i < 160; i++) V.crowd.push([Math.random(), Math.random(), Math.random()]);
    onResize();
    loop();
  }
  function leaveScreen() {
    if (D) { D.dead = true; clearTimeout(D.pollT); clearTimeout(D.stuckT); clearInterval(D.timerI); }
    D = null;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    const el = document.getElementById('duel'); if (el) el.remove();
    document.body.classList.remove('duel-open');
    closeSheet();
    try { if (document.fullscreenElement) document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* fine */ }
  }
  X.leave = leaveScreen;
  X.exit = () => {
    if (!D) return go('#/play');
    const playing = D.mode !== 'nets' && D.g && D.g.phase !== 'done' && D.status !== 'abandoned' && (D.g.n || 0) > 0;
    const doExit = () => { const code = D && D.mode === 'online' && D.status === 'live' ? D.code : null; leaveScreen(); if (code) api('game_leave', { code }).catch(() => {}); go('#/play'); };
    if (!playing) return doExit();
    App._duelExit = doExit;
    sheet(`<h3>Leave the game?</h3><div class="sub">${D.mode === 'online' ? 'Your friend will win the game.' : 'This game will not be saved.'}</div>
      <div class="grid2"><button class="btn light" onclick="closeSheet()">Keep playing</button><button class="btn red" onclick="closeSheet();App._duelExit()">Leave</button></div>`);
  };
  X.portrait = () => { put('cs_duel_portrait', '1'); const el = document.getElementById('duel'); if (el) el.classList.add('force-portrait'); onResize(); };
  X.toggleSound = () => { Sound.setSfx(!Sound.sfx); Sound.setVoice(Sound.sfx); const b = document.getElementById('dSnd'); if (b) b.textContent = Sound.sfx ? '🔊' : '🔇'; };

  /* ---------- Score strip ---------- */
  function drawHud() {
    const el = document.getElementById('dHud'); if (!el || !D || !D.g) return;
    if (D.nets) {
      const n = D.nets, sr = n.balls ? Math.round(n.runs * 100 / n.balls) : 0;
      el.innerHTML = `<div class="d-score">🥅 ${n.runs} <small>off ${n.balls} ball${n.balls === 1 ? '' : 's'}</small></div><span class="d-need">Strike rate ${sr}</span>
        <div class="d-vs">⭐ ${n.perfect} perfect · ${n.fours}×4 · ${n.sixes}×6 · ${n.outs} out</div>`;
      return;
    }
    const g = D.g, inn = g.inn[g.cur], bat = D.names[inn.bat], bowl = D.names[1 - inn.bat], bw = G.bowlerOf(g);
    let need = '';
    if (g.cur === 1 && g.phase !== 'done') need = `<span class="d-need">Need ${Math.max(0, g.inn[0].runs + 1 - inn.runs)} off ${g.overs * 6 - inn.balls}</span>`;
    else if (g.cur === 0) need = `<span class="d-need">${g.overs} ov · ${g.wickets} wkt</span>`;
    const chips = inn.log.slice(-6).map(x => `<i class="c c${x === 'W' ? 'w' : x === '4' ? '4' : x === '6' ? '6' : x === 'wd' || x === 'nb' ? 'x' : ''}">${x === '0' ? '•' : x}</i>`).join('');
    const extras = (inn.wd || inn.nb) ? `<span class="d-ex ${inn.wd >= 2 || inn.nb >= 2 ? 'hot' : ''}">WD ${inn.wd}/3 · NB ${inn.nb}/3</span>` : '';
    el.innerHTML = `<div class="d-score"><b>${esc(bat)}</b> ${inn.runs}/${inn.wk} <small>(${G.oversStr(inn.balls)})</small></div>${need}${g.free && g.phase !== 'done' ? '<span class="d-free">FREE HIT</span>' : ''}${extras}
      <div class="d-vs">🎯 ${esc(bowl)} · ${esc(bw.name)}</div><div class="d-chips">${chips}</div>`;
  }

  /* ---------- Controls on top of the picture ---------- */
  function setPhase(phase, waitText = '', stuck = '') {
    if (!D) return;
    D.phase = phase;
    clearInterval(D.timerI);
    const ui = document.getElementById('dUi'); if (!ui) return;
    const g = D.g, inn = g.inn[g.cur], batter = inn.bat, bowler = 1 - batter;
    V.bands = phase === 'bowl';
    V.marker = phase === 'bowl' ? { x: D.aim.x, l: D.aim.l } : null;
    if (phase === 'bowl') {
      const a = D.aim, bw = G.bowlerOf(g), balls = G.ballsFor(bw.bowl.style);
      if (!balls.includes(a.ball)) a.ball = balls[0];
      ui.innerHTML = `<div class="d-col d-lcol"><div class="d-role">🎯 ${esc(D.names[bowler])} · ${esc(bw.name)} (${STYLE_NAME[bw.bowl.style]})</div>
          <div class="d-balls">${balls.map(b => `<button type="button" class="${a.ball === b ? 'on' : ''}" data-b="${b}" onclick="Duel.setBall('${b}')">${BALL_ICON[b] || '🎯'}<span>${esc(G.BALLS[b][3])}</span></button>`).join('')}</div>
          <div class="d-chipset d-side">${SIDE_UI.map(([v, l]) => `<button type="button" class="${a.side === v ? 'on' : ''}" onclick="Duel.setSide(${v})">${v > 0 ? '↗️' : '↖️'}<span>${l}</span></button>`).join('')}</div>
          <div class="d-aimtxt" id="dAim"></div><div class="d-timer" id="dTimer"></div></div>
        <div class="d-col d-rcol"><div class="d-power"><div class="z"></div><div class="slider" id="dSlider"></div></div>
          <button type="button" class="d-bowlbtn" id="dBowl" onclick="Duel.release()">BOWL</button></div>
        <div class="d-hint">👆 Drag the circle to aim · tap <b>BOWL</b> in the blue</div>`;
      aimText();
      D.powerT0 = performance.now();
      startTimer(BOWL_TIME, () => { if (D.mode === 'online') X.release(); else localTimeout(); });
    } else if (phase === 'bat') {
      ui.innerHTML = `<div class="d-col d-lcol"><div class="d-role">🏏 ${esc(D.names[batter])} · ${esc(G.charById(g.squads[batter].bat).name)}</div><div class="d-tbar" id="dTbar"><i class="cur" id="dTcur"></i><i class="hitmark" id="dTmark"></i></div></div>
        <div class="d-hint">${get('cs_duel_seen', '0') === '1' ? 'Hold to lift the bat · let go and flick to hit' : '👉 <b>Hold</b> to lift the bat · <b>let go and flick</b> to hit · short = ground · long = air · tap = block'}</div>`;
      put('cs_duel_seen', '1');
      drawTimingBar();
    } else {
      ui.innerHTML = waitText || stuck ? `<div class="d-wait"><span class="duel-dots"><i></i><i></i><i></i></span>${esc(waitText)}${stuck === 'bat' ? '<br><button class="btn sm light" onclick="Duel.nudge()">Count it as a leave</button>' : stuck === 'bowl' ? '<br><button class="btn sm light" onclick="Duel.callTime()">⏱ Call time</button>' : ''}</div>` : '';
    }
  }
  function startTimer(secs, onEnd) {
    let left = secs;
    const t = document.getElementById('dTimer'); if (t) t.textContent = `⏱ ${left}s`;
    D.timerI = setInterval(() => {
      if (!D || D.phase !== 'bowl') return clearInterval(D && D.timerI);
      left--; const tt = document.getElementById('dTimer'); if (tt) { tt.textContent = `⏱ ${left}s`; tt.classList.toggle('low', left <= 5); }
      if (left <= 0) { clearInterval(D.timerI); onEnd(); }
    }, 1000);
  }
  function aimText() {
    const el = document.getElementById('dAim'); if (!el || !D) return;
    const a = D.aim;
    el.innerHTML = `<b>${G.lengthName(a.l)}</b> · <span class="${Math.abs(a.x) > 1.3 ? 'bad' : ''}">${lineName(a.x)}</span>`;
  }
  X.setBall = b => { if (!D || D.phase !== 'bowl') return; D.aim.ball = b; document.querySelectorAll('.d-balls button').forEach(x => x.classList.toggle('on', x.dataset.b === b)); };
  X.setSide = v => { if (!D || D.phase !== 'bowl') return; D.aim.side = v; document.querySelectorAll('.d-side button').forEach((x, i) => x.classList.toggle('on', SIDE_UI[i][0] === v)); };
  function powerNow() {
    const bw = G.bowlerOf(D.g), per = [1500, 1750, 2000][bw.bowl.style] / (bw.bowl.pace > 1.1 ? 1.15 : 1), t = (performance.now() - D.powerT0) % per / per;
    return t < 0.5 ? t * 2 : 2 - t * 2;
  }
  X.release = () => {
    if (!D || D.phase !== 'bowl') return;
    const v = powerNow(), a = D.aim, q = G.quality(v);
    D.phase = 'released';
    clearInterval(D.timerI);
    V.bands = false;
    const btn = document.getElementById('dBowl'); if (btn) btn.disabled = true;
    flash({ perfect: 'PERFECT BALL!', good: 'Good ball', ok: 'Okay ball', noball: 'NO-BALL!' }[q], q === 'perfect' || q === 'good' ? 'good' : 'bad');
    if (D.mode === 'online') {
      apiQuiet('game_bowl', { code: D.code, n: D.g.n, type: 0, varn: 0, x: a.x, l: a.l, v, ball: a.ball, side: a.side }).then(r => onlineApply(r)).catch(err => { toast(err.message, true); if (D) setPhase('bowl'); });
    } else localBowl({ x: a.x, l: a.l, v, ball: a.ball, side: a.side });
  };

  /* ---------- Touch: drag the aiming circle; hold, release and flick to bat ---------- */
  let sw = null;
  function pt(e) { const r = D.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * D.dpr, y: (e.clientY - r.top) * D.dpr, t: performance.now() }; }
  function onDown(e) {
    if (!D) return;
    e.preventDefault();
    try { D.cv.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
    const p = pt(e);
    if (D.phase === 'bowl') { D.dragging = true; aimAt(p); return; }
    if (D.phase === 'bat' && !D.swung) { sw = { x0: p.x, y0: p.y, pts: [p], fired: false }; V.lift = true; }
  }
  function onMove(e) {
    if (!D) return;
    const p = pt(e);
    if (D.phase === 'bowl' && D.dragging) return aimAt(p);
    if (sw && !sw.fired) {
      sw.pts.push(p); if (sw.pts.length > 12) sw.pts.shift();
      if (D.ballLive) { V.trail = sw.pts.slice(); if (Math.hypot(p.x - sw.x0, p.y - sw.y0) > maxSwipe()) fire(p); }
      else { sw.x0 = p.x; sw.y0 = p.y; }        // still waiting for the ball: the flick starts from wherever the finger is now
    }
  }
  function onUp(e) {
    if (!D) return;
    D.dragging = false;
    if (sw && !sw.fired) {
      if (D.ballLive) fire(pt(e));
      else { V.lift = false; sw = null; }         // let go before the ball came: bat down again, no shot
    } else sw = null;
  }
  const maxSwipe = () => Math.min(D.cv.width, D.cv.height) * 0.42;
  function fire(p) {
    sw.fired = true; V.lift = false;
    const dx = p.x - sw.x0, dy = p.y - sw.y0, len = Math.hypot(dx, dy), tap = 14 * D.dpr;
    const k = len < tap ? 'tap' : 'swipe';
    const a = k === 'tap' ? 0 : Math.atan2(dx, -dy) * 180 / Math.PI;
    const pw = k === 'tap' ? 0 : Math.max(0, Math.min(1, (len - tap) / (maxSwipe() - tap)));
    D.swung = { k, a: Math.round(a * 10) / 10, p: Math.round(pw * 1000) / 1000, at: p.t };
    V.trailColor = pw >= 0.6 ? '#ffd43b' : '#ffffff';
    setTimeout(() => { V.trail = null; }, 250);
    sw = null;
  }
  function aimAt(p) {
    const k = geo(), s = (p.y - k.yH) / (k.yB - k.yH);
    if (s <= 0.05) return;
    const z = k.Dc / s - k.Dc;
    D.aim.l = Math.max(0, Math.min(1, (z - 1) / 10));
    D.aim.x = Math.max(-1.6, Math.min(1.6, (p.x - k.cx) / (k.k0 * s)));
    V.marker = { x: D.aim.x, l: D.aim.l };
    aimText();
  }

  /* ================= Drawing: a 3D-ish view from behind the batter ================= */
  const V = {
    reset() { Object.assign(V, { ball: null, ring: null, marker: null, bands: false, trail: null, trailColor: '#fff', swing: 0, swingDir: 0, swingT: 0, lift: false, liftA: 0, stumps: 0, bowler: 0, arm: 0, path: null, catchAt: -1, tcur: null, shake: 0, fieldRun: null }); },
  };
  function onResize() {
    if (!D || !D.cv) return;
    const r = D.cv.parentElement.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    D.cv.width = Math.max(10, Math.round(r.width * dpr)); D.cv.height = Math.max(10, Math.round(r.height * dpr));
    D.dpr = dpr;
  }
  function geo() {
    const W = D.cv.width, H = D.cv.height;
    const yH = H * 0.09, yB = H * 0.84, Dc = 6;
    return { W, H, cx: W / 2, yH, yB, Dc, k0: Math.min(W * 0.085, H * 0.17) };
  }
  function proj(k, x, z, h = 0) {
    const s = k.Dc / (k.Dc + Math.max(z, -k.Dc + 0.6));
    return { x: k.cx + x * k.k0 * s, y: k.yH + (k.yB - k.yH) * s - h * k.k0 * 0.9 * s, s };
  }
  const zOfL = l => 1 + l * 10;
  const FIELD_R = 55;
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!D || !D.cv) return;
    const c = D.cv.getContext('2d'), k = geo(), W = k.W, H = k.H, st = stadiumOf(D.g && D.g.stadium);
    c.save();
    if (V.shake > 0) { c.translate((Math.random() - 0.5) * V.shake * D.dpr, (Math.random() - 0.5) * V.shake * D.dpr); V.shake *= 0.9; if (V.shake < 0.3) V.shake = 0; }
    // sky, stands and crowd
    const sky = c.createLinearGradient(0, 0, 0, k.yH);
    sky.addColorStop(0, st.sky[0]); sky.addColorStop(1, st.sky[1]);
    c.fillStyle = sky; c.fillRect(0, 0, W, k.yH + 2);
    const standTop = k.yH * 0.35;
    c.fillStyle = st.stand; c.fillRect(0, standTop, W, k.yH - standTop);
    for (let i = 0; i < V.crowd.length; i++) { const [a, b, col] = V.crowd[i]; c.fillStyle = `hsl(${Math.floor(col * 360)},70%,${st.night ? 55 : 62}%)`; c.beginPath(); c.arc(a * W, standTop + 3 * D.dpr + b * (k.yH - standTop - 6 * D.dpr), 1.6 * D.dpr, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.12)'; for (let r = 1; r < 3; r++) c.fillRect(0, standTop + (k.yH - standTop) * r / 3, W, 1 * D.dpr);
    if (st.night) { for (const fx of [0.12, 0.88]) { c.fillStyle = '#cfd8dc'; c.fillRect(fx * W - 1.5 * D.dpr, 0, 3 * D.dpr, standTop); const gl = c.createRadialGradient(fx * W, 2 * D.dpr, 0, fx * W, 2 * D.dpr, 22 * D.dpr); gl.addColorStop(0, 'rgba(255,255,220,.95)'); gl.addColorStop(1, 'rgba(255,255,220,0)'); c.fillStyle = gl; c.fillRect(fx * W - 22 * D.dpr, 0, 44 * D.dpr, 26 * D.dpr); } }
    // ground
    c.fillStyle = st.grass; c.fillRect(0, k.yH, W, H);
    for (let z = -2, i = 0; z < 70; z += 4, i++) {
      const a = proj(k, 0, z), b = proj(k, 0, z + 4);
      c.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.035)';
      c.fillRect(0, b.y, W, a.y - b.y);
    }
    const far = proj(k, 0, FIELD_R);
    c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(0, far.y - 1, W, 2 * D.dpr);
    // the pitch
    const p0l = proj(k, -1.6, -2.2), p0r = proj(k, 1.6, -2.2), p1l = proj(k, -1.6, 22), p1r = proj(k, 1.6, 22);
    c.fillStyle = st.pitch;
    c.beginPath(); c.moveTo(p0l.x, p0l.y); c.lineTo(p1l.x, p1l.y); c.lineTo(p1r.x, p1r.y); c.lineTo(p0r.x, p0r.y); c.closePath(); c.fill();
    if (V.bands) {
      for (const [l0, l1, name, col] of BAND) {
        const a = proj(k, -1.6, zOfL(l0)), b = proj(k, 1.6, zOfL(l0)), cc = proj(k, 1.6, zOfL(l1)), d = proj(k, -1.6, zOfL(l1));
        c.fillStyle = col; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.lineTo(cc.x, cc.y); c.lineTo(d.x, d.y); c.closePath(); c.fill();
        const m = proj(k, 1.75, zOfL((l0 + l1) / 2));
        c.fillStyle = 'rgba(255,255,255,.9)'; c.font = `800 ${Math.max(10 * D.dpr, 13 * D.dpr * Math.sqrt(m.s))}px Nunito,system-ui,sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText(name, m.x, m.y);
      }
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.setLineDash([5 * D.dpr, 5 * D.dpr]); c.lineWidth = 1.2 * D.dpr;
      for (const xx of [-1.3, 1.3]) { const a = proj(k, xx, -0.5), b = proj(k, xx, 12); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      c.strokeStyle = 'rgba(214,40,57,.55)';
      for (const xx of [-0.42, 0.42]) { const a = proj(k, xx, -0.5), b = proj(k, xx, 12); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      c.setLineDash([]);
    }
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2 * D.dpr;
    for (const z of [0, 20]) { const a = proj(k, -1.8, z), b = proj(k, 1.8, z); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
    drawStumps(c, k, 21.2, 0);
    drawFielders(c, k, true);
    // the bowler: runs in from deep, arm goes over at release
    const side = (D.curBall && D.phase !== 'bowl' ? D.curBall.side : D.aim.side) || 1;
    const bz = 21.5 + (1 - V.bowler) * 11, bx = side * 0.8;
    drawPerson(c, k, bx, bz, kitOf(D.g, 1 - D.g.inn[D.g.cur].bat), '#f1f3f5', 1.05, V.bowler > 0.05 && V.bowler < 1 ? Math.sin(V.bowler * 18) * 0.5 : 0, V.arm);
    if (V.ring) ring(c, k, V.ring.x, zOfL(V.ring.l), 'rgba(255,255,255,.85)', V.ring.a);
    if (V.marker) ring(c, k, V.marker.x, zOfL(V.marker.l), Math.abs(V.marker.x) > 1.3 ? '#ff6b6b' : '#ffffff', 1, true);
    const ballFar = V.ball && V.ball.z > 1.5;
    if (ballFar) drawBall(c, k);
    drawStumps(c, k, -1.2, V.stumps);
    drawBatter(c, k);
    if (!ballFar && V.ball) drawBall(c, k);
    drawFielders(c, k, false);
    if (V.trail && V.trail.length > 1) {
      c.strokeStyle = V.trailColor; c.lineCap = 'round'; c.lineJoin = 'round';
      for (let i = 1; i < V.trail.length; i++) { c.globalAlpha = i / V.trail.length; c.lineWidth = (3 + i * 0.8) * D.dpr; c.beginPath(); c.moveTo(V.trail[i - 1].x, V.trail[i - 1].y); c.lineTo(V.trail[i].x, V.trail[i].y); c.stroke(); }
      c.globalAlpha = 1;
    }
    c.restore();
    drawMap(c, k);
    if (D.phase === 'bowl') drawPower();
    if (V.tcur !== null) drawTimingBar();
    V.liftA += ((V.lift ? 1 : 0) - V.liftA) * 0.25;
  }
  const kitOf = (g, who) => (g && g.squads ? G.charById(g.squads[who].bat).kit : '#1c7ed6');
  function ring(c, k, x, z, col, alpha = 1, handle = false) {
    const p = proj(k, x, z), rx = 0.55 * k.k0 * p.s, ry = rx * 0.38;
    c.globalAlpha = alpha; c.strokeStyle = col; c.lineWidth = 2.5 * D.dpr;
    c.beginPath(); c.ellipse(p.x, p.y, rx, ry, 0, 0, 7); c.stroke();
    c.beginPath(); c.ellipse(p.x, p.y, rx * 0.35, ry * 0.35, 0, 0, 7); c.fillStyle = col; c.fill();
    if (handle) { c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(p.x, p.y, rx * 1.6, ry * 1.6, 0, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  }
  function drawStumps(c, k, z, fall) {
    const b = proj(k, 0, z), top = proj(k, 0, z, 0.75), w = 0.42 * k.k0 * b.s;
    c.strokeStyle = '#f4e3c1'; c.lineWidth = Math.max(2, 0.09 * k.k0 * b.s); c.lineCap = 'round';
    for (const i of [-1, 0, 1]) { c.beginPath(); c.moveTo(b.x + i * w * 0.6, b.y); c.lineTo(b.x + i * w * 0.6 + i * fall * w * 1.4, top.y + fall * (b.y - top.y) * 0.5); c.stroke(); }
    if (!fall) { c.strokeStyle = '#b5651d'; c.lineWidth = Math.max(1.5, 0.05 * k.k0 * b.s); c.beginPath(); c.moveTo(b.x - w * 0.7, top.y); c.lineTo(b.x + w * 0.7, top.y); c.stroke(); }
    else { c.fillStyle = '#b5651d'; c.fillRect(b.x - w * 1.6 - fall * w, top.y - fall * w * 2, w * 0.8, 3 * D.dpr); c.fillRect(b.x + w * 0.8 + fall * w, top.y - fall * w * 2.4, w * 0.8, 3 * D.dpr); }
  }
  /** a little person: shirt colour, cap, scale, running bob, bowling arm (0..1 = windmill) */
  function drawPerson(c, k, x, z, shirt, cap, scale, bob = 0, arm = 0) {
    const f = proj(k, x, z), u = k.k0 * f.s * scale, y = f.y - Math.abs(bob) * u * 0.15;
    c.fillStyle = '#e9ecef'; c.fillRect(f.x - u * 0.2, y - u * 0.72, u * 0.16, u * 0.72 + bob * u * 0.1); c.fillRect(f.x + u * 0.04, y - u * 0.72, u * 0.16, u * 0.72 - bob * u * 0.1);
    c.fillStyle = shirt; c.fillRect(f.x - u * 0.22, y - u * 1.45, u * 0.44, u * 0.75);
    c.fillStyle = '#c68e5a'; c.beginPath(); c.arc(f.x, y - u * 1.65, u * 0.2, 0, 7); c.fill();
    c.fillStyle = cap; c.beginPath(); c.arc(f.x, y - u * 1.72, u * 0.2, Math.PI, 0); c.fill();
    if (arm > 0) { const an = -Math.PI / 2 + arm * Math.PI * 1.6; c.strokeStyle = '#c68e5a'; c.lineWidth = u * 0.1; c.lineCap = 'round'; c.beginPath(); c.moveTo(f.x + u * 0.2, y - u * 1.35); c.lineTo(f.x + u * 0.2 + Math.cos(an) * u * 0.55, y - u * 1.35 + Math.sin(an) * u * 0.55); c.stroke(); }
  }
  function curType() {
    if (D.curBall && D.phase !== 'bowl') return D.curBall.type;
    return G.bowlerOf(D.g).bowl.style;
  }
  function fieldPos(a, r) { const rad = a * Math.PI / 180; return { x: Math.sin(rad) * r * FIELD_R, z: Math.cos(rad) * r * FIELD_R }; }
  function drawFielders(c, k, farOnes) {
    const f = G.FIELDS[curType()], kit = kitOf(D.g, 1 - D.g.inn[D.g.cur].bat);
    f.forEach(([a, r], i) => {
      let p = fieldPos(a, r);
      if (V.fieldRun && V.fieldRun.i === i) { p = { x: p.x + (V.fieldRun.x - p.x) * V.fieldRun.e, z: p.z + (V.fieldRun.z - p.z) * V.fieldRun.e }; }
      if (p.z < 2) return;
      if ((p.z > 1.5) !== farOnes) return;
      const dive = V.fieldRun && V.fieldRun.i === i && V.fieldRun.e > 0.85 ? 1 : 0;
      drawPerson(c, k, p.x, p.z, V.catchAt === i ? '#ffd43b' : kit, '#0b3d66', 1.3 - dive * 0.35, V.fieldRun && V.fieldRun.i === i ? Math.sin(performance.now() / 60) : 0);
    });
  }
  function drawBatter(c, k) {
    const f = proj(k, -1.15, -0.4), u = k.k0 * f.s * 0.72;
    c.globalAlpha = D.phase === 'bowl' ? 0.35 : 1;
    c.fillStyle = '#f8f9fa'; c.fillRect(f.x - u * 0.34, f.y - u * 1.0, u * 0.26, u * 1.0); c.fillRect(f.x + u * 0.06, f.y - u * 1.0, u * 0.26, u * 1.0);
    c.fillStyle = kitOf(D.g, D.g.inn[D.g.cur].bat); c.beginPath(); c.roundRect ? c.roundRect(f.x - u * 0.4, f.y - u * 2.0, u * 0.8, u * 1.05, u * 0.15) : c.rect(f.x - u * 0.4, f.y - u * 2.0, u * 0.8, u * 1.05); c.fill();
    c.fillStyle = '#ffffff'; c.font = `900 ${u * 0.42}px Barlow Condensed, system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('7', f.x, f.y - u * 1.5);
    c.fillStyle = '#1f3d8a'; c.beginPath(); c.arc(f.x, f.y - u * 2.25, u * 0.3, 0, 7); c.fill();
    // the bat: rests on the ground, lifts behind when you hold, swings through on the shot
    const swv = V.swing, lift = V.liftA, base = { x: f.x + u * 0.45, y: f.y - u * 1.35 };
    const rest = -150 + 55 * lift;
    const ang = (rest + swv * (180 + V.swingDir * 0.6)) * Math.PI / 180;
    const len = u * 1.5;
    c.strokeStyle = '#e8c88f'; c.lineWidth = u * 0.22; c.lineCap = 'round';
    c.beginPath(); c.moveTo(base.x, base.y); c.lineTo(base.x + Math.cos(ang) * len, base.y + Math.sin(ang) * len * 0.8); c.stroke();
    c.strokeStyle = '#212529'; c.lineWidth = u * 0.12;
    c.beginPath(); c.moveTo(base.x, base.y); c.lineTo(base.x + Math.cos(ang) * len * 0.3, base.y + Math.sin(ang) * len * 0.24); c.stroke();
    c.globalAlpha = 1;
  }
  function drawBall(c, k) {
    const b = V.ball, g = proj(k, b.x, b.z, 0), p = proj(k, b.x, b.z, b.h), r = Math.max(2.5 * D.dpr, 0.13 * k.k0 * p.s);
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(g.x, g.y, r * 1.1, r * 0.45, 0, 0, 7); c.fill();
    c.fillStyle = '#d62839'; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = Math.max(1, r * 0.18); c.beginPath(); c.arc(p.x, p.y, r * 0.65, -0.7, 1); c.stroke();
  }
  function drawMap(c, k) {
    const R = Math.min(k.W, k.H) * 0.17, cx = k.W - R - 10 * D.dpr, cy = R + 10 * D.dpr;
    c.fillStyle = 'rgba(10,40,22,.72)'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.5 * D.dpr; c.stroke();
    c.setLineDash([3 * D.dpr, 3 * D.dpr]); c.beginPath(); c.arc(cx, cy, R * 0.55, 0, 7); c.strokeStyle = 'rgba(255,255,255,.3)'; c.stroke(); c.setLineDash([]);
    c.fillStyle = '#d9c88f'; c.fillRect(cx - R * 0.04, cy - R * 0.3, R * 0.08, R * 0.32);
    G.FIELDS[curType()].forEach(([a, r], i) => {
      const rad = a * Math.PI / 180;
      c.fillStyle = V.catchAt === i ? '#ffd43b' : '#74c0fc';
      c.beginPath(); c.arc(cx + Math.sin(rad) * r * R, cy - Math.cos(rad) * r * R, 3.2 * D.dpr, 0, 7); c.fill();
    });
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(cx, cy, 2.6 * D.dpr, 0, 7); c.fill();
    if (V.path) {
      const rad = V.path.a * Math.PI / 180, d = Math.min(1.15, V.path.d) * V.path.e;
      const ex = cx + Math.sin(rad) * d * R, ey = cy - Math.cos(rad) * d * R;
      c.strokeStyle = V.path.loft ? '#ffd43b' : '#ffffff'; c.lineWidth = 2.2 * D.dpr; c.setLineDash(V.path.loft ? [4 * D.dpr, 3 * D.dpr] : []);
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(ex, ey); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#d62839'; c.beginPath(); c.arc(ex, ey, 3.5 * D.dpr, 0, 7); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = `800 ${9 * D.dpr}px Nunito,system-ui`; c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillText('OFF ▸', cx + R * 0.55, cy + R + 3 * D.dpr); c.fillText('◂ LEG', cx - R * 0.55, cy + R + 3 * D.dpr);
  }
  function drawPower() {
    const s = document.getElementById('dSlider'); if (!s || !D) return;
    s.style.bottom = `calc(${(powerNow() * 100).toFixed(1)}% - 3px)`;
  }
  function drawTimingBar() {
    const bar = document.getElementById('dTbar'); if (!bar || !D) return;
    if (!bar.dataset.z && D.curBall) {
      const d = D.curBall; let w = G.batterStats(D.g).timing; if (d.mod === 'slower' || d.mod === 'doosra') w *= 0.85; if (d.l < 0.16) w *= 0.75; if (d.l > 0.84) w *= 0.9; if (d.q === 'perfect') w *= 0.85;
      const span = 500, pct = ms => 50 + (ms / span) * 50;
      const stops = [[-380, '#e8590c'], [-210, '#fab005'], [-125, '#40c057'], [-60, '#1c7ed6'], [60, '#40c057'], [125, '#fab005'], [210, '#e8590c'], [380, '#e03131']];
      let grad = `#e03131 0%`;
      for (let i = 0; i < stops.length; i++) { const [ms, col] = stops[i]; const p = Math.max(0, Math.min(100, pct(ms * w))); grad += `, ${i === 0 ? '#e03131' : stops[i - 1][1]} ${p}%, ${col} ${p}%`; }
      grad += `, #e03131 100%`;
      bar.style.background = `linear-gradient(180deg, ${grad})`;
      bar.dataset.z = '1';
    }
    const cur = document.getElementById('dTcur');
    if (cur && V.tcur !== null) { cur.style.top = `${Math.max(0, Math.min(100, 50 + V.tcur / 500 * 50))}%`; cur.style.opacity = Math.abs(V.tcur) < 520 ? 1 : 0.25; }
  }

  /** Bowl one ball on screen. human: this phone's batter plays; cpu: the computer's shot; watch/replay: just show it */
  async function playBall(d, { human = false, cpu = null, replay = null, watch = false } = {}) {
    if (!D) return { k: 'none', a: 0, p: 0, dt: 0 };
    V.reset(); V.marker = null; V.bands = false;
    D.curBall = d; D.swung = null; D.ballLive = false; sw = null;
    const bar = document.getElementById('dTbar'); if (bar) delete bar.dataset.z;
    const bw = G.charById(d.bowler), bName = G.BALLS[d.ball] ? G.BALLS[d.ball][3] : STYLE_NAME[d.type];
    msg(d.free ? '🎉 FREE HIT - you can\'t be out!' : human ? `${bw.name} · ${bName}${d.side === -1 ? ' · round the wicket' : ''}` : '');
    const runup = replay ? 500 : 1150;
    await animate(runup, p => { V.bowler = p; V.arm = p > 0.75 ? (p - 0.75) * 4 : 0; });
    if (!D || D.dead) return { k: 'none', a: 0, p: 0, dt: 0 };
    V.ring = { x: d.x, l: d.l, a: 0.9 };
    D.ballLive = human;
    const T = d.travel, t0 = performance.now(), arrive = t0 + T, zb = zOfL(d.l);
    const x0 = (d.side || 1) * 0.6, z0 = 19.5, h0 = 2.2, zEnd = -1.6;
    const ub = (z0 - zb) / z0, hb = d.mod === 'flipper' || d.mod === 'arm' ? 0.18 + d.l * 1.0 : 0.25 + d.l * 1.6;
    const cpuAt = cpu && cpu.k !== 'none' ? arrive + cpu.dt : null;
    const repAt = replay && replay.shot !== 'leave' && replay.timing !== 'leave' ? arrive + ({ early: -220, late: 220, ok: -150, good: -80, miss: -330 }[replay.timing] || 0) : null;
    const swingAt = cpuAt || repAt;
    let shotDone = false;
    await new Promise(res => {
      const step = now => {
        if (!D || D.dead) return res();
        const u = (now - t0) / T, uMax = 1 + 420 / T;
        V.tcur = human ? now - arrive : null;
        let x, z, h;
        if (u <= ub) {
          const p = u / ub;
          z = z0 + (zb - z0) * p;
          x = x0 + (d.x - x0) * p + (d.type === 1 ? -d.swing * 0.9 * p * (1 - p) : 0);
          h = h0 * (1 - p) * (1 + 0.25 * p);
        } else {
          const p = (u - ub) / (1 - ub);
          z = zb + (0 - zb) * p;
          x = d.x + (d.fx - d.x) * Math.min(p, 1.3);
          h = hb * Math.sin(Math.min(p, 1) * Math.PI / 2);
          if (p > 1) z = (p - 1) * zEnd * 3;
          V.ring && (V.ring.a = Math.max(0, 0.9 - p));
        }
        V.ball = { x, z, h };
        if (!shotDone && ((human && D.swung) || (swingAt && now >= swingAt))) { shotDone = true; V.swingT = now; V.swingDir = human ? D.swung.a : cpu ? cpu.a : replay ? replay.a : 0; }
        if (V.swingT) V.swing = Math.min(1, (now - V.swingT) / 160);
        if (u >= uMax || (shotDone && now > Math.max(arrive, V.swingT) + 90 && (human ? D.swung.k !== 'none' : true))) return res();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    D.ballLive = false; V.lift = false; sw = null;
    V.tcur = null;
    if (human) {
      if (D.swung) { const s = D.swung; markTiming(s.at - arrive); return { k: s.k, a: s.a, p: s.p, dt: Math.round(s.at - arrive) }; }
      return { k: 'none', a: 0, p: 0, dt: 0 };
    }
    return cpu ? { k: cpu.k, a: cpu.a, p: cpu.p, dt: cpu.dt } : { k: 'none', a: 0, p: 0, dt: 0 };
  }
  function markTiming(dt) {
    const m = document.getElementById('dTmark'); if (m) { m.style.top = `${Math.max(0, Math.min(100, 50 + dt / 500 * 50))}%`; m.style.opacity = 1; }
  }
  function animate(ms, fn) {
    return new Promise(res => {
      const t0 = performance.now();
      const step = now => { if (!D || D.dead) return res(); const p = Math.min(1, (now - t0) / ms); fn(p, now); if (p < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step);
    });
  }

  async function showOutcome(res) {
    if (!D) return;
    if (res.timing && res.timing !== 'leave') flash({ perfect: 'PERFECT!', good: 'GOOD', ok: 'OK', early: 'TOO EARLY', late: 'TOO LATE', miss: 'MISSED' }[res.timing], res.timing === 'perfect' || res.timing === 'good' ? 'good' : 'bad');
    const d = res.delivery || {};
    const start = V.ball ? Object.assign({}, V.ball) : { x: -0.2, z: 0.3, h: 0.6 };
    if (res.kind === 'out' && (res.wicket === 'bowled' || res.wicket === 'lbw')) {
      V.ball = { x: d.fx || 0, z: -1.1, h: 0.4 };
      if (res.wicket === 'bowled') { Sound.fx('bowled'); await animate(450, p => { V.stumps = p; }); }
    } else if (res.shot && res.shot !== 'leave' && res.timing !== 'miss' && res.kind !== 'wide') {
      const fp = fieldPos(res.a, Math.min(res.dist, 1.25));
      const peak = res.loft ? 9 + res.dist * 6 : 0.4;
      V.catchAt = res.fielder;
      V.path = { a: res.a, d: res.dist, loft: res.loft, e: 0 };
      if (res.fielder >= 0) V.fieldRun = { i: res.fielder, x: fp.x, z: fp.z, e: 0 };
      else {   // the nearest fielder chases the ball
        const f = G.FIELDS[d.type || 0]; let best = -1, bd = 9;
        f.forEach(([a, r], i) => { const dd = Math.abs(a - res.a); if (dd < bd && r < 1) { bd = dd; best = i; } });
        if (best >= 0 && bd < 40) V.fieldRun = { i: best, x: fp.x, z: fp.z, e: 0 };
      }
      const dur = res.runs >= 4 ? 1100 : 800;
      Sound.fx(res.timing === 'perfect' ? 'four' : 'dot');
      await animate(dur, p => {
        const e = 1 - Math.pow(1 - p, 2);
        V.ball = { x: start.x + (fp.x - start.x) * e, z: start.z + (fp.z - start.z) * e, h: Math.max(0, start.h * (1 - p) + Math.sin(p * Math.PI) * peak) };
        V.path.e = e; if (V.fieldRun) V.fieldRun.e = Math.min(1, p * 1.2);
      });
    }
    const inn = D.g.inn[res.inn] || D.g.inn[D.g.cur], bat = D.names[inn.bat], bowl = D.names[1 - inn.bat];
    if (res.kind === 'runs' && res.runs === 6) { popup('SIX!', bat, 'b6', '🚀'); Sound.fx('six'); V.shake = 14; if (typeof confetti === 'function') confetti(); }
    else if (res.kind === 'runs' && res.runs === 4) { popup('FOUR!', bat, 'b4', '🏏'); Sound.fx('four'); }
    else if (res.kind === 'out') { popup('OUT!', `${bat} · ${res.wicket}`, 'w', res.wicket === 'bowled' ? '🎯' : '☝️'); if (res.wicket !== 'bowled') Sound.fx('out'); }
    else if (res.kind === 'wide') { popup('WIDE', `${inn.wd}/3 - three and you lose!`, 'w', '↔️'); Sound.fx('wide'); }
    else if (res.noball) { popup('NO-BALL', `${inn.nb}/3 · free hit next!`, 'w', '🚫'); Sound.fx('wide'); }
    else Sound.fx(res.runs ? 'run' : 'dot');
    msg(res.text);
    Sound.say(res.kind === 'out' ? `${bowl} gets ${bat}! ${res.text}` : res.text);
    drawHud();
    await sleep(res.kind === 'runs' && res.runs >= 4 || res.kind === 'out' ? 1900 : 1300);
    V.reset();
    const m = document.getElementById('dTmark'); if (m) m.style.opacity = 0;
  }
  function flash(text, kind) {
    const f = document.getElementById('dFlash'); if (!f) return;
    f.textContent = text; f.className = 'd-flash show ' + kind;
    clearTimeout(f._t); f._t = setTimeout(() => { f.className = 'd-flash'; }, 1100);
  }
  function msg(text) { const m = document.getElementById('dMsg'); if (m) { m.textContent = text || ''; m.classList.toggle('show', !!text); } }

  async function inningsBreak() {
    if (!D) return;
    const g = D.g, a = g.inn[0], chaser = D.names[g.inn[1].bat];
    msg('');
    const el = document.getElementById('duel'); if (!el) return;
    const o = document.createElement('div'); o.className = 'd-over';
    o.innerHTML = `<div class="d-card"><div class="big">🔄</div><h3>Innings break</h3><p>${esc(D.names[a.bat])} scored <b>${a.runs}/${a.wk}</b></p>
      <p><b>${esc(chaser)}</b> needs <b>${a.runs + 1}</b> to win from ${g.overs * 6} balls.</p><p class="small muted">Swap - the batter now bowls!</p></div>`;
    el.appendChild(o);
    Sound.say(`End of the innings. ${chaser} needs ${a.runs + 1} to win.`);
    await sleep(3200);
    o.remove();
  }
  function showResult() {
    if (!D || D.resultShown) return;
    D.resultShown = true;
    const g = D.g;
    const abandoned = D.status === 'abandoned';
    const text = abandoned && !(g.result && g.result.by === 'forfeit') ? 'The game was stopped.' : G.resultText(g, D.names);
    const iWon = D.mode === 'online' ? g.winner === D.me : D.mode === 'cpu' ? g.winner === 0 : g.winner >= 0;
    const el = document.getElementById('duel'); if (!el) return;
    setPhase('done');
    const draw = coins => {
      const o = document.createElement('div'); o.className = 'd-over';
      o.innerHTML = `<div class="d-card"><div class="big">${g.winner === -1 ? '🤝' : iWon ? '🏆' : '😮'}</div><h3>${esc(text)}</h3>
        ${g.inn.map(i => `<p>${esc(D.names[i.bat])}: <b>${i.runs}/${i.wk}</b> (${G.oversStr(i.balls)}) · ${i.fours}×4 ${i.sixes}×6</p>`).join('')}
        ${coins ? `<p class="coins-won">🪙 +${coins} coins</p>` : ''}
        <div class="grid2" style="margin-top:12px"><button class="btn lime" onclick="Duel.again()">🔁 ${D.mode === 'online' ? 'Rematch' : 'Play again'}</button><button class="btn light" onclick="Duel.leave();go('#/play')">Done</button></div></div>`;
      el.appendChild(o);
    };
    if (D.mode === 'online') draw(g.awarded ? g.awarded[D.me] : 0);
    else if (D.mode === 'cpu') api('game_record', { mode: 'cpu', overs: g.overs, wickets: g.wickets, balls: g.inn[0].balls + g.inn[1].balls, winner: g.winner }).then(r => { if (P && r.coins) P.coins += r.coins; draw(r.coins); }).catch(() => draw(0));
    else { if (D.mode === 'local') api('game_record', { mode: 'local', overs: g.overs, wickets: g.wickets, balls: g.inn[0].balls + g.inn[1].balls, winner: g.winner }).catch(() => {}); draw(0); }
    if (g.winner !== -1 && (iWon || D.mode === 'local')) { Sound.fx('win'); if (typeof confetti === 'function') confetti(); }
    Sound.say(text.replace(/[🏆🤝]/g, ''));
  }
  X.again = () => {
    if (!D) return;
    if (D.mode === 'cpu') { leaveScreen(); return X.startCpu(); }
    if (D.mode === 'local') {
      const names = D.names, g = D.g, first = 1 - g.inn[0].bat;
      leaveScreen(); startLocal({ mode: 'local', g: G.newGame(g.overs, g.wickets, first, g.squads, g.stadium), names, human: [true, true] }); return;
    }
    apiQuiet('game_rematch', { code: D.code }).then(r => { leaveScreen(); go('#/play/room/' + r.code); }).catch(e => toast(e.message, true));
  };

  return X;
})();
window.Duel = Duel;
