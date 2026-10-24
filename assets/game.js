/* Cric-Scorer · Gully Duel - one player bowls, the other bats, ball by ball.
   Modes: vs Computer, two players on one phone (held sideways), or two phones online with a 4-digit code.
   Rules live in game-engine.js (and inc/game.php for online games). */
'use strict';
const Duel = (() => {
  const X = {};
  const G = window.GE;
  const SHOT_UI = [['defend', '🛡️', 'Defend'], ['drive', '➡️', 'Drive'], ['cut', '✂️', 'Cut'], ['pull', '💥', 'Pull'], ['sweep', '🧹', 'Sweep'], ['loft', '🚀', 'Loft']];
  const PACE_UI = [['🔥', 'Fast'], ['⚡', 'Medium'], ['🌀', 'Spin']];
  const LINE_UI = ['Wide', 'Off', 'Middle', 'Leg'];
  const LEN_UI = ['Yorker', 'Full', 'Good', 'Short', 'Bouncer'];
  const get = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };

  let D = null;           // the game on screen
  let raf = 0;

  /* ================= Lobby ================= */
  X.lobby = () => {
    leaveScreen();
    const ov = +get('cs_duel_ov', 2), wk = +get('cs_duel_wk', 3);
    const opt = (name, vals, cur) => `<div class="seg duel-seg" data-name="${name}">${vals.map(v => `<button type="button" class="${v === cur ? 'on' : ''}" onclick="Duel.pick(this,'${name}',${v})">${v}</button>`).join('')}</div>`;
    mount(topbar('Gully Duel', { back: true, refresh: false }) + `<div class="content">
      <div class="duel-hero"><div class="big">🏏🎯</div><h2>Bat vs Bowl</h2><p>One of you bowls, the other bats - every ball is a battle! Turn your phone sideways to play.</p></div>
      <div class="card"><div class="row" style="justify-content:space-between"><b>Overs each</b>${opt('ov', [1, 2, 3, 5], ov)}</div>
        <div class="row" style="justify-content:space-between;margin-top:10px"><b>Wickets</b>${opt('wk', [1, 2, 3, 5], wk)}</div></div>
      <div class="duel-modes">
        <button class="duel-mode" onclick="Duel.startCpu()"><span class="ic">🤖</span><b>vs Computer</b><span>Practise your batting and bowling</span></button>
        <button class="duel-mode" onclick="Duel.startLocal()"><span class="ic">👫</span><b>Two players, one phone</b><span>Bowler on the left, batter on the right</span></button>
        <button class="duel-mode" onclick="Duel.createRoom()"><span class="ic">📱📱</span><b>Two phones - create game</b><span>Get a 4-digit code for your friend</span></button>
        <button class="duel-mode" onclick="Duel.joinSheet()"><span class="ic">🔢</span><b>Two phones - join game</b><span>Type your friend's code</span></button>
      </div>
      <div class="card"><b>How to play</b><div class="small muted" style="margin-top:6px">
        🎯 <b>Bowler:</b> pick your pace and tap the spot on the pitch to aim at. Then tap <b>BOWL</b> when the needle is in the green - miss it and you might bowl a wide or a full toss!<br>
        🏏 <b>Batter:</b> watch where the ball pitches and tap a shot <b>just as the ball reaches you</b>. Pull and cut the short ones, drive the full ones, defend the good ones. Don't tap and you leave the ball - but not if it's hitting the stumps!<br>
        ⏱️ Timing is everything: <b>PERFECT</b> timing goes for four or six.</div></div>
    </div>`, 'more');
  };
  X.pick = (btn, name, v) => { btn.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn)); put('cs_duel_' + name, v); };
  const opts = () => ({ overs: +get('cs_duel_ov', 2), wickets: +get('cs_duel_wk', 3) });

  /* ================= Local games (vs computer / one phone) ================= */
  const seed32 = () => (Math.random() * 4294967296) >>> 0;
  X.startCpu = () => {
    sheet(`<h3>🪙 Toss time!</h3><div class="sub">Do you want to bat or bowl first?</div>
      <div class="grid2"><button class="btn" onclick="Duel.cpuGo(0)">🏏 Bat first</button><button class="btn light" onclick="Duel.cpuGo(1)">🎯 Bowl first</button></div>`);
  };
  X.cpuGo = first => {
    closeSheet();
    const o = opts();
    startLocalGame({ mode: 'cpu', g: G.newGame(o.overs, o.wickets, first), names: [S.user.display_name.split(' ')[0], 'Computer'], human: [true, false] });
  };
  X.startLocal = () => {
    const n = (get('cs_duel_names', '') || '').split('|');
    sheet(`<h3>👫 Two players, one phone</h3><div class="sub">Hold the phone sideways between you: the bowler plays on the left, the batter on the right.</div>
      <form onsubmit="Duel.localGo(event)"><div class="grid2"><div class="field"><label>Player 1</label><input class="input" name="a" value="${esc(n[0] || 'Aarush')}" maxlength="16" required></div>
      <div class="field"><label>Player 2</label><input class="input" name="b" value="${esc(n[1] || 'Aayush')}" maxlength="16" required></div></div>
      <button class="btn block">🪙 Toss & play</button></form>`);
  };
  X.localGo = e => {
    e.preventDefault();
    const f = formData(e.target), names = [f.a.trim() || 'Player 1', f.b.trim() || 'Player 2'];
    put('cs_duel_names', names.join('|')); closeSheet();
    const o = opts(), first = Math.random() < 0.5 ? 0 : 1;
    toast(`🪙 ${names[first]} won the toss and will bat first!`);
    startLocalGame({ mode: 'local', g: G.newGame(o.overs, o.wickets, first), names, human: [true, true] });
  };
  function startLocalGame(o) {
    D = { mode: o.mode, g: o.g, names: o.names, human: o.human, me: 0, busy: false, r: G.rng(seed32()), aim: { pace: 1, line: 2, length: 2 }, dead: false };
    openScreen();
    nextLocal();
  }
  function nextLocal() {
    if (!D || D.dead) return;
    const g = D.g;
    drawHud();
    if (g.phase === 'done') return showResult();
    const bowler = 1 - g.inn[g.cur].bat;
    if (D.human[bowler]) setPanels('bowl');
    else { setPanels('wait', `${D.names[bowler]} is running in…`); setTimeout(() => { if (!D || D.dead) return; const b = G.cpuBowl(D.r); localBowl(b.pace, b.line, b.length, b.e); }, 900); }
  }
  function localBowl(pace, line, length, e) {
    const g = D.g, d = G.bowl(g, pace, line, length, e, seed32()), batter = g.inn[g.cur].bat;
    const cpu = !D.human[batter] ? G.cpuBat(d, D.r, 0.62) : null;
    setPanels(D.human[batter] ? 'bat' : 'wait', D.human[batter] ? '' : `${D.names[batter]} is batting…`);
    playBall(d, { human: D.human[batter], cpu }).then(({ shot, delta }) => {
      if (!D || D.dead) return;
      const res = G.bat(g, shot, delta);
      return showOutcome(res).then(() => {
        if (res.inningsOver) return inningsBreak().then(nextLocal);
        nextLocal();
      });
    });
  }

  /* ================= Online games ================= */
  X.createRoom = () => run(async () => {
    const o = opts(), r = await api('game_create', o);
    go('#/play/room/' + r.code);
  });
  X.joinSheet = () => sheet(`<h3>🔢 Join a game</h3><div class="sub">Ask your friend for the 4-digit code on their screen.</div>
    <form onsubmit="Duel.joinGo(event)"><input class="input duel-code-in" name="code" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="0000" autocomplete="off" required autofocus>
    <button class="btn block" style="margin-top:12px">Join game</button></form>`);
  X.joinGo = e => { e.preventDefault(); const c = formData(e.target).code.trim(); closeSheet(); go('#/play/join/' + c); };
  X.join = code => run(async () => {
    mount(topbar('Gully Duel', { back: true, refresh: false }) + `<div class="content">${sk(2)}</div>`, 'more');
    const r = await api('game_join', { code });
    go('#/play/room/' + r.code);
  });
  X.room = async code => {
    leaveScreen();
    const r = await api('game_get', { code });
    if (r.status === 'waiting') return waitingRoom(r);
    startOnline(r);
  };
  function waitingRoom(r) {
    const link = location.origin + location.pathname + '#/play/join/' + r.code;
    mount(topbar('Gully Duel', { back: true, refresh: false }) + `<div class="content"><div class="card duel-wait">
      <div class="small muted">Tell your friend this code</div><div class="duel-code">${esc(r.code)}</div>
      <div class="small muted">They open <b>Gully Duel → Two phones - join game</b> and type it in.</div>
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
    D = { mode: 'online', code: r.code, v: r.v, g: r.state, names: r.names, me: r.me, human: [true, true], busy: false, dead: false, status: r.status,
      aim: { pace: 1, line: 2, length: 2 }, shownBall: 0, shownLast: r.state && r.state.last ? r.state.last.id : 0, chain: Promise.resolve(), stuckSince: 0, rematch: r.rematch };
    openScreen();
    if (r.state && r.state.toss !== undefined && !r.state.n) toast(`🪙 ${r.names[r.state.toss]} won the toss and will bat first!`);
    onlineApply(r, true);
    pollOnline();
  }
  async function pollOnline() {
    if (!D || D.dead || D.mode !== 'online') return;
    try {
      const r = await apiQuiet('game_get', { code: D.code, v: D.v });
      if (D && !D.dead && !r.same) onlineApply(r);
    } catch (e) { /* keep trying */ }
    if (D && !D.dead && D.mode === 'online') D.pollT = setTimeout(pollOnline, D.status === 'live' ? 650 : 2500);
  }
  function apiQuiet(action, data) {                  // the game keeps its own screen, so ignore route changes
    return fetch('api.php?action=' + action, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CricScorer', 'X-App-Version': window.CS_VERSION || '' }, body: JSON.stringify(data) })
      .then(r => r.json()).then(j => { if (j.error) throw new Error(j.error); return j; });
  }
  function onlineApply(r, first) {
    if (r.v < D.v && !first) return;
    D.v = r.v; D.g = r.state; D.names = r.names; D.status = r.status; D.rematch = r.rematch;
    const g = D.g;
    if (D.rematch && D.resultShown) { const c = D.rematch; leaveScreen(); return go('#/play/room/' + c); }
    D.chain = D.chain.then(async () => {
      if (!D || D.dead) return;
      const last = g.last;
      if (last && last.id !== D.shownLast) {            // a ball we haven't animated yet
        D.shownLast = last.id;
        const iBatted = g.inn[last.inn].bat === D.me;
        if (D.shownBall !== last.id) { D.shownBall = last.id; setPanels('wait', ''); await playBall(last.delivery, { human: false, replay: last }); }
        else if (iBatted) { /* result came back from my own shot - already animated the ball */ }
        await showOutcome(last);
        if (last.inningsOver) await inningsBreak();
      }
      onlineTurn();
    });
  }
  function onlineTurn() {
    if (!D || D.dead) return;
    const g = D.g;
    drawHud();
    if (D.status === 'abandoned' || g.phase === 'done') return showResult();
    const batter = g.inn[g.cur].bat, bowler = 1 - batter;
    if (g.phase === 'bowl') {
      if (bowler === D.me) setPanels('bowl');
      else setPanels('wait', `${D.names[bowler]} is choosing a delivery…`);
    } else if (g.phase === 'bat' && g.ball && D.shownBall !== g.ball.id) {
      D.shownBall = g.ball.id;
      if (batter === D.me) {
        setPanels('bat');
        D.chain = D.chain.then(() => playBall(g.ball, { human: true }).then(async ({ shot, delta }) => {
          if (!D || D.dead) return;
          try { const r = await apiQuiet('game_bat', { code: D.code, id: g.ball.id, shot, delta }); if (D && !D.dead) onlineApply(r); }
          catch (e) { toast(e.message, true); }
        }));
      } else {
        setPanels('wait', `${D.names[batter]} is facing…`);
        D.stuckSince = Date.now();
        D.chain = D.chain.then(() => playBall(g.ball, { human: false, watch: true }));
        clearTimeout(D.stuckT);
        D.stuckT = setTimeout(() => { if (D && !D.dead && D.g.phase === 'bat') setPanels('wait', `${D.names[batter]} hasn't played yet…`, true); }, 21000);
      }
    }
  }
  X.nudge = () => { if (D && D.mode === 'online') apiQuiet('game_nudge', { code: D.code, id: D.g.ball && D.g.ball.id }).then(r => onlineApply(r)).catch(e => toast(e.message, true)); };

  /* ================= The game screen ================= */
  function openScreen() {
    closeSheet();
    let el = document.getElementById('duel');
    if (!el) { el = document.createElement('div'); el.id = 'duel'; document.body.appendChild(el); }
    document.body.classList.add('duel-open');
    el.className = 'duel mode-' + D.mode + (get('cs_duel_portrait', '0') === '1' ? ' force-portrait' : '');
    el.innerHTML = `<div class="d-top"><button class="d-x" aria-label="Exit game" onclick="Duel.exit()">✕</button><div class="d-hud" id="dHud"></div>
        <button class="d-x" aria-label="Sound" onclick="Duel.toggleSound()" id="dSnd">${Sound.sfx ? '🔊' : '🔇'}</button></div>
      <div class="d-main"><div class="d-panel d-left" id="dLeft"></div><div class="d-field"><canvas id="dCv"></canvas><div class="d-flash" id="dFlash"></div><div class="d-msg" id="dMsg"></div></div><div class="d-panel d-right" id="dRight"></div></div>
      <div class="d-rotate"><div class="phone">📱</div><b>Turn your phone sideways</b><span>Gully Duel is played in landscape. Turn off rotation lock if the screen doesn't turn.</span>
        <button class="btn sm light" onclick="Duel.portrait()">Play upright instead</button></div>`;
    // Android: go full screen and lock to landscape (iPhone ignores this and shows the "turn your phone" note)
    try {
      const fs = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (fs && fs.then) fs.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
    } catch (e) { /* not supported */ }
    D.cv = document.getElementById('dCv');
    window.addEventListener('resize', onResize);
    onResize();
    loop();
  }
  function leaveScreen() {
    if (D) { D.dead = true; clearTimeout(D.pollT); clearTimeout(D.stuckT); if (D.meterRaf) cancelAnimationFrame(D.meterRaf); }
    D = null;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    const el = document.getElementById('duel'); if (el) el.remove();
    document.body.classList.remove('duel-open');
    try { if (document.fullscreenElement) document.exitFullscreen(); if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* fine */ }
  }
  X.leave = leaveScreen;
  X.exit = () => {
    if (!D) return go('#/play');
    const playing = D.g && D.g.phase !== 'done' && D.status !== 'abandoned' && (D.g.n || 0) > 0;
    const doExit = () => { const code = D && D.mode === 'online' && D.status === 'live' ? D.code : null; leaveScreen(); if (code) api('game_leave', { code }).catch(() => {}); go('#/play'); };
    if (!playing) return doExit();
    App._duelExit = doExit;
    sheet(`<h3>Leave the game?</h3><div class="sub">${D.mode === 'online' ? 'Your friend will win the game.' : 'This game will not be saved.'}</div>
      <div class="grid2"><button class="btn light" onclick="closeSheet()">Keep playing</button><button class="btn red" onclick="closeSheet();App._duelExit()">Leave</button></div>`);
  };
  X.portrait = () => { put('cs_duel_portrait', '1'); const el = document.getElementById('duel'); if (el) el.classList.add('force-portrait'); onResize(); };
  X.toggleSound = () => { Sound.setSfx(!Sound.sfx); Sound.setVoice(Sound.sfx); const b = document.getElementById('dSnd'); if (b) b.textContent = Sound.sfx ? '🔊' : '🔇'; };

  /* ---------- Top score strip ---------- */
  function drawHud() {
    const el = document.getElementById('dHud'); if (!el || !D || !D.g) return;
    const g = D.g, inn = g.inn[g.cur], bat = D.names[inn.bat], bowl = D.names[1 - inn.bat];
    let need = '';
    if (g.cur === 1 && g.phase !== 'done') {
      const t = g.inn[0].runs + 1 - inn.runs, b = g.overs * 6 - inn.balls;
      need = `<span class="d-need">Need ${Math.max(0, t)} off ${b}</span>`;
    } else if (g.cur === 0) need = `<span class="d-need">${g.overs} ov · ${g.wickets} wkt</span>`;
    const chips = inn.log.slice(-6).map(x => `<i class="c c${x === 'W' ? 'w' : x === '4' ? '4' : x === '6' ? '6' : x === 'wd' ? 'x' : ''}">${x === '0' ? '•' : x}</i>`).join('');
    el.innerHTML = `<div class="d-score"><b>${esc(bat)}</b> ${inn.runs}/${inn.wk} <small>(${G.oversStr(inn.balls)})</small></div>${need}
      <div class="d-vs">🎯 ${esc(bowl)}</div><div class="d-chips">${chips}</div>`;
  }

  /* ---------- Controls ---------- */
  // which side shows what: one phone = bowler left, batter right; otherwise my controls go on my side
  function setPanels(phase, waitText = '', stuck = false) {
    if (!D) return;
    D.phase = phase;
    const L = document.getElementById('dLeft'), R = document.getElementById('dRight'); if (!L || !R) return;
    const g = D.g, batter = g.inn[g.cur].bat, bowler = 1 - batter;
    const bowlHuman = D.mode === 'online' ? bowler === D.me : D.human[bowler];
    const batHuman = D.mode === 'online' ? batter === D.me : D.human[batter];
    L.innerHTML = bowlHuman ? bowlerPanel(phase === 'bowl', bowler) : sideCard(bowler, '🎯 Bowling', phase === 'bowl' ? waitText : '');
    R.innerHTML = batHuman ? batterPanel(phase === 'bat', batter) : sideCard(batter, '🏏 Batting', phase === 'bat' || phase === 'wait' ? waitText : '', stuck);
    if (bowlHuman && phase === 'bowl') startMeter();
    if (phase === 'wait' && waitText && !(bowlHuman && phase === 'bowl')) msg(waitText);
  }
  function sideCard(p, role, text, stuck) {
    return `<div class="d-side"><div class="d-role">${role}</div><div class="d-name">${esc(D.names[p])}</div>${D.mode === 'cpu' && p === 1 ? '<div class="d-bot">🤖</div>' : ''}
      ${text ? `<div class="d-wait"><span class="duel-dots"><i></i><i></i><i></i></span>${esc(text)}</div>` : ''}
      ${stuck ? `<button class="btn sm light" onclick="Duel.nudge()">Count it as a leave</button>` : ''}</div>`;
  }
  function bowlerPanel(active, p) {
    const a = D.aim;
    let grid = '';
    for (let len = 0; len < 5; len++) for (let line = 0; line < 4; line++)
      grid += `<button type="button" class="cell ${a.line === line && a.length === len ? 'on' : ''}" data-line="${line}" data-len="${len}" onclick="Duel.aimAt(${line},${len})" aria-label="${LINE_UI[line]}, ${LEN_UI[len]}"></button>`;
    return `<div class="d-bowl ${active ? '' : 'off'}"><div class="d-role">🎯 ${esc(D.names[p])} bowls</div>
      <div class="d-pace">${PACE_UI.map(([e, l], i) => `<button type="button" class="${a.pace === i ? 'on' : ''}" onclick="Duel.pace(${i})">${e}<span>${l}</span></button>`).join('')}</div>
      <div class="d-map"><div class="stumps"></div><div class="grid">${grid}</div><div class="lens">${LEN_UI.map(l => `<span>${l}</span>`).join('')}</div></div>
      <div class="d-aim" id="dAim">${LINE_UI[a.line]} · ${LEN_UI[a.length]}</div>
      <div class="d-meter"><div class="zone"></div><div class="needle" id="dNeedle"></div></div>
      <button type="button" class="d-bowlbtn" id="dBowl" onclick="Duel.release()" ${active ? '' : 'disabled'}>BOWL</button></div>`;
  }
  function batterPanel(active, p) {
    return `<div class="d-bat ${active ? 'ready' : 'off'}"><div class="d-role">🏏 ${esc(D.names[p])} bats</div>
      <div class="d-shots">${SHOT_UI.map(([k, e, l]) => `<button type="button" class="shot" data-shot="${k}" onpointerdown="Duel.shot('${k}',event)">${e}<span>${l}</span></button>`).join('')}</div>
      <div class="d-tip" id="dTip">${active ? 'Tap a shot as the ball reaches you!' : 'Get ready…'}</div></div>`;
  }
  X.aimAt = (line, len) => {
    if (!D || D.phase !== 'bowl') return;
    D.aim.line = line; D.aim.length = len;
    document.querySelectorAll('.d-map .cell').forEach(c => c.classList.toggle('on', +c.dataset.line === line && +c.dataset.len === len));
    const a = document.getElementById('dAim'); if (a) a.textContent = `${LINE_UI[line]} · ${LEN_UI[len]}`;
  };
  X.pace = i => { if (!D || D.phase !== 'bowl') return; D.aim.pace = i; document.querySelectorAll('.d-pace button').forEach((b, k) => b.classList.toggle('on', k === i)); startMeter(); };
  function startMeter() {
    if (D.meterRaf) cancelAnimationFrame(D.meterRaf);
    const speed = [0.0062, 0.0048, 0.0036][D.aim.pace], t0 = performance.now();
    const step = now => {
      if (!D || D.phase !== 'bowl') return;
      D.meterE = Math.sin((now - t0) * speed);
      const n = document.getElementById('dNeedle'); if (n) n.style.left = (50 + D.meterE * 47) + '%';
      D.meterRaf = requestAnimationFrame(step);
    };
    D.meterRaf = requestAnimationFrame(step);
  }
  X.release = () => {
    if (!D || D.phase !== 'bowl' || D.busy) return;
    const e = D.meterE || 0, a = D.aim;
    D.phase = 'released';
    cancelAnimationFrame(D.meterRaf);
    const btn = document.getElementById('dBowl'); if (btn) btn.disabled = true;
    const acc = Math.abs(e) <= 0.1 ? 'Perfect release!' : Math.abs(e) <= 0.25 ? 'Good release' : Math.abs(e) <= 0.85 ? (e > 0 ? 'A bit short' : 'A bit full') : (e > 0 ? 'Oh no - wide!' : 'Full toss!');
    flash(acc, Math.abs(e) <= 0.25 ? 'good' : 'bad');
    if (D.mode === 'online') {
      apiQuiet('game_bowl', { code: D.code, n: D.g.n, pace: a.pace, line: a.line, length: a.length, e }).then(r => onlineApply(r)).catch(err => { toast(err.message, true); if (D) setPanels('bowl'); });
    } else localBowl(a.pace, a.line, a.length, e);
  };
  X.shot = (k, ev) => {
    if (ev) ev.preventDefault();
    if (!D || !D.ballLive || D.swung) return;
    D.swung = { shot: k, at: performance.now() };
    document.querySelectorAll('.d-shots .shot').forEach(b => b.classList.toggle('hit', b.dataset.shot === k));
  };

  /* ---------- Canvas: the ground, the pitch and the ball ---------- */
  const V = { ball: null, trail: [], flight: null, stumpsDown: 0, batSwing: 0, fielder: null };
  function onResize() {
    if (!D || !D.cv) return;
    const r = D.cv.parentElement.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    D.cv.width = Math.max(10, r.width * dpr); D.cv.height = Math.max(10, r.height * dpr);
    D.cv.style.width = r.width + 'px'; D.cv.style.height = r.height + 'px';
    D.dpr = dpr;
  }
  function geo() {
    const W = D.cv.width, H = D.cv.height;
    const R = Math.min(W * 0.48, H * 0.62);
    const cx = W / 2, cy = H * 0.5;
    const top = cy - R * 0.42, bot = cy + R * 0.5;      // batter's stumps at the top, bowler at the bottom
    return { W, H, R, cx, cy, top, bot, pw: R * 0.12 };
  }
  // ball position on screen: u = 0 at the bowler's hand … 1 at the batter; h = height (0 = ground)
  function ballXY(k, u, line, h) {
    const sh = k.pw * 0.22;
    const off = [-2.6, -0.9, 0, 0.9][line] * sh;
    const x = k.cx + off * (0.25 + 0.75 * u);
    const y = k.bot + (k.top - k.bot) * u;
    return { x, y: y - h * k.R * 0.09, gy: y, r: k.R * (0.032 + h * 0.012) };
  }
  const BOUNCE = [0.95, 0.84, 0.72, 0.56, 0.46, 2];
  const RISE = [0.08, 0.4, 0.65, 0.95, 1.4, 0];
  function heightAt(len, u) {
    const ub = BOUNCE[len];
    if (len === 5) return 1.2 - 0.45 * u;              // full toss: never bounces
    if (u < ub) { const p = u / ub; return 1.25 * (1 - p) * (1 + 0.35 * p); }
    return RISE[len] * Math.sin(Math.min(1, (u - ub) / (1 - ub)) * Math.PI / 2);
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!D || !D.cv) return;
    const c = D.cv.getContext('2d'), k = geo();
    c.clearRect(0, 0, k.W, k.H);
    // ground
    const grd = c.createRadialGradient(k.cx, k.cy, k.R * 0.2, k.cx, k.cy, k.R * 1.05);
    grd.addColorStop(0, '#4cae5b'); grd.addColorStop(1, '#2d7d3e');
    c.fillStyle = '#1f5e2e'; c.fillRect(0, 0, k.W, k.H);
    c.beginPath(); c.ellipse(k.cx, k.cy, k.R * 1.0, k.R * 0.98, 0, 0, Math.PI * 2); c.fillStyle = grd; c.fill();
    c.lineWidth = 3 * D.dpr; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke();
    for (let i = -6; i <= 6; i += 2) { c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(k.cx + i * k.R * 0.08, k.cy - k.R, k.R * 0.08, k.R * 2); }
    c.setLineDash([6 * D.dpr, 6 * D.dpr]); c.beginPath(); c.ellipse(k.cx, k.cy, k.R * 0.55, k.R * 0.53, 0, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5 * D.dpr; c.stroke(); c.setLineDash([]);
    // fielders
    c.fillStyle = '#f2b134';
    for (const [a, d] of [[30, 0.85], [80, 0.6], [140, 0.9], [-40, 0.82], [-95, 0.65], [-150, 0.9], [175, 0.5], [0, 0.95], [115, 0.3]]) {
      const rad = a * Math.PI / 180; c.beginPath(); c.arc(k.cx - Math.sin(rad) * k.R * d * 0.95, k.top + Math.cos(rad) * k.R * d * 0.95 * (a === 0 ? 1 : 1), k.R * 0.022, 0, Math.PI * 2); c.fill();
    }
    // pitch
    c.fillStyle = '#d8c690';
    c.fillRect(k.cx - k.pw / 2, k.top - k.R * 0.05, k.pw, k.bot - k.top + k.R * 0.1);
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5 * D.dpr;
    for (const y of [k.top + k.R * 0.035, k.bot - k.R * 0.035]) { c.beginPath(); c.moveTo(k.cx - k.pw * 0.75, y); c.lineTo(k.cx + k.pw * 0.75, y); c.stroke(); }
    // stumps (batter end) - they fly when bowled
    const sw = k.pw * 0.22, sy = k.top - k.R * 0.005, fall = V.stumpsDown;
    c.strokeStyle = '#7a4a1d'; c.lineWidth = Math.max(2, k.R * 0.012);
    for (const i of [-1, 0, 1]) { c.beginPath(); c.moveTo(k.cx + i * sw * 0.45, sy); c.lineTo(k.cx + i * sw * 0.45 + i * fall * 14 * D.dpr, sy - k.R * 0.05 + fall * 10 * D.dpr); c.stroke(); }
    c.fillStyle = '#7a4a1d'; c.fillRect(k.cx - k.pw * 0.08, k.bot + k.R * 0.01, k.pw * 0.16, k.R * 0.012);
    // batter (right-handed, standing on the leg side of the stumps) and bowler
    const bx = k.cx + sw * 0.9, by = k.top + k.R * 0.015;
    c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(bx, by, k.R * 0.03, k.R * 0.022, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1f3d8a'; c.beginPath(); c.arc(bx, by - k.R * 0.004, k.R * 0.016, 0, Math.PI * 2); c.fill();
    const sa = -0.6 + V.batSwing * 2.2;
    c.strokeStyle = '#e8c88f'; c.lineWidth = Math.max(3, k.R * 0.016); c.lineCap = 'round';
    c.beginPath(); c.moveTo(bx - k.R * 0.012, by + k.R * 0.006); c.lineTo(bx - k.R * 0.012 - Math.cos(sa) * k.R * 0.075, by + k.R * 0.006 + Math.sin(sa) * k.R * 0.075); c.stroke();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(k.cx - sw * 0.7, k.bot + k.R * 0.05, k.R * 0.022, 0, Math.PI * 2); c.fill();
    // the ball
    const b = V.ball;
    if (b) {
      for (let i = 0; i < V.trail.length; i++) { const t = V.trail[i]; c.fillStyle = `rgba(255,255,255,${0.04 + i * 0.025})`; c.beginPath(); c.arc(t.x, t.y, t.r * 0.8, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(b.x, b.gy, b.r * 1.1, b.r * 0.55, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d62839'; c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1 * D.dpr; c.beginPath(); c.arc(b.x, b.y, b.r * 0.7, -0.6, 0.9); c.stroke();
    }
    if (V.pitchMark) { c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.5 * D.dpr; c.beginPath(); c.ellipse(V.pitchMark.x, V.pitchMark.y, k.R * 0.03, k.R * 0.015, 0, 0, Math.PI * 2); c.stroke(); }
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function animate(ms, fn) {
    return new Promise(res => {
      const t0 = performance.now();
      const step = now => { if (!D || D.dead) return res(); const p = Math.min(1, (now - t0) / ms); fn(p, now); if (p < 1) requestAnimationFrame(step); else res(); };
      requestAnimationFrame(step);
    });
  }

  /** Bowl one ball on screen. human: the batter on this phone taps a shot; cpu: the computer's shot; replay: a result to show */
  async function playBall(d, { human = false, cpu = null, replay = null, watch = false } = {}) {
    if (!D) return { shot: 'leave', delta: 0 };
    const len = d.length, line = d.line, T = d.travel, runup = replay ? 500 : 1100;
    V.ball = null; V.trail = []; V.stumpsDown = 0; V.batSwing = 0; V.pitchMark = null;
    msg(watch || replay ? '' : human ? 'Here it comes… 👀' : '');
    await sleep(runup);
    if (!D || D.dead) return { shot: 'leave', delta: 0 };
    D.swung = null; D.ballLive = human;
    const t0 = performance.now(), arrive = t0 + T, shotAt = cpu && cpu.shot !== 'leave' ? arrive + cpu.delta : replay && replay.shot !== 'leave' ? arrive + (replay.timing === 'early' ? -200 : replay.timing === 'late' ? 200 : replay.timing === 'good' ? -100 : replay.timing === 'miss' ? -320 : 0) : null;
    let bounced = false;
    msg('');
    await new Promise(res => {
      const step = now => {
        if (!D || D.dead) return res();
        const uMax = 1 + 330 / T, u = Math.min(uMax, (now - t0) / T);
        const k = geo();
        if (d.wide) { const p = ballXY(k, Math.min(u, 1), 0, heightAt(2, Math.min(u, 1))); p.x -= k.pw * 0.5 * Math.min(u, 1); V.ball = p; }
        else {
          let ln = line; const turn = d.pace === 2 && u > BOUNCE[len] ? (u - BOUNCE[len]) * 1.6 : 0;
          const p = ballXY(k, u, ln, heightAt(len, Math.min(u, 1))); p.x += turn * k.pw * 0.22; V.ball = p;
        }
        if (!bounced && len < 5 && u >= BOUNCE[len]) { bounced = true; const pm = ballXY(geo(), BOUNCE[len], line, 0); V.pitchMark = { x: pm.x, y: pm.gy }; }
        V.trail.push({ x: V.ball.x, y: V.ball.y, r: V.ball.r }); if (V.trail.length > 8) V.trail.shift();
        if ((D.swung || (shotAt && now >= shotAt)) && !V.swingT) V.swingT = now;
        if (V.swingT) V.batSwing = Math.min(1, (now - V.swingT) / 140);
        if (u >= uMax || (human && D.swung && now > arrive + 120) || (!human && shotAt && now > Math.max(arrive, shotAt) + 60)) return res();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    V.swingT = 0;
    D.ballLive = false;
    if (human) {
      if (D.swung) return { shot: D.swung.shot, delta: Math.round(D.swung.at - arrive) };
      return { shot: 'leave', delta: 0 };
    }
    return cpu ? { shot: cpu.shot, delta: cpu.delta } : { shot: 'leave', delta: 0 };
  }

  /** After the ball: timing flash, the ball flying off the bat, pop-ups, sounds and commentary */
  async function showOutcome(res) {
    if (!D) return;
    const k = geo();
    if (res.timing && res.timing !== 'leave') flash({ perfect: 'PERFECT!', good: 'Good timing', early: 'Too early!', late: 'Too late!', miss: 'Missed it!' }[res.timing], res.timing === 'perfect' || res.timing === 'good' ? 'good' : 'bad');
    const start = V.ball ? { x: V.ball.x, y: V.ball.y } : { x: k.cx, y: k.top };
    if (res.kind === 'out' && (res.wicket === 'bowled' || res.wicket === 'lbw')) {
      if (res.wicket === 'bowled') await animate(500, p => { V.stumpsDown = p; });
    } else if (res.kind === 'runs' || (res.kind === 'out' && res.wicket === 'caught' && res.dist) || res.kind === 'dot') {
      const rad = (res.dir || 0) * Math.PI / 180, dist = (res.dist || 0.15) * k.R * 0.95;
      const ex = k.cx - Math.sin(rad) * dist, ey = k.top + Math.cos(rad) * dist;
      const loft = res.runs === 6 ? 1 : res.shot === 'loft' || (res.kind === 'out' && res.wicket === 'caught') ? 0.6 : 0.12;
      await animate(res.runs >= 4 ? 900 : 650, p => {
        const e = 1 - Math.pow(1 - p, 2);
        const h = Math.sin(p * Math.PI) * loft;
        V.ball = { x: start.x + (ex - start.x) * e, y: start.y + (ey - start.y) * e - h * k.R * 0.25, gy: start.y + (ey - start.y) * e, r: k.R * (0.032 + h * 0.03) };
        V.trail.push({ x: V.ball.x, y: V.ball.y, r: V.ball.r }); if (V.trail.length > 10) V.trail.shift();
      });
    }
    const inn = D.g.inn[res.inn], bat = D.names[inn.bat], bowl = D.names[1 - inn.bat];
    if (res.kind === 'runs' && res.runs === 6) { popup('SIX!', bat, 'b6', '🚀'); Sound.fx('six'); }
    else if (res.kind === 'runs' && res.runs === 4) { popup('FOUR!', bat, 'b4', '🏏'); Sound.fx('four'); }
    else if (res.kind === 'out') { popup('OUT!', `${bat} · ${res.wicket}`, 'w', res.wicket === 'bowled' ? '🎯' : '☝️'); Sound.fx(res.wicket === 'bowled' ? 'bowled' : 'out'); }
    else if (res.kind === 'wide') { popup('WIDE', '+1 run', 'w', '↔️'); Sound.fx('wide'); }
    else Sound.fx(res.runs ? 'run' : 'dot');
    msg(res.text);
    Sound.say(res.kind === 'out' ? `${bowl} gets ${bat}! ${res.text}` : res.text);
    drawHud();
    await sleep(res.kind === 'runs' && res.runs >= 4 || res.kind === 'out' ? 1700 : 1100);
    V.ball = null; V.trail = []; V.stumpsDown = 0; V.batSwing = 0; V.pitchMark = null;
    document.querySelectorAll('.d-shots .shot').forEach(b => b.classList.remove('hit'));
  }
  function flash(text, kind) {
    const f = document.getElementById('dFlash'); if (!f) return;
    f.textContent = text; f.className = 'd-flash show ' + kind;
    clearTimeout(f._t); f._t = setTimeout(() => { f.className = 'd-flash'; }, 900);
  }
  function msg(text) { const m = document.getElementById('dMsg'); if (m) { m.textContent = text || ''; m.classList.toggle('show', !!text); } }

  async function inningsBreak() {
    if (!D) return;
    const g = D.g, a = g.inn[0];
    const chaser = D.names[g.inn[1].bat];
    msg('');
    const el = document.getElementById('duel'); if (!el) return;
    const o = document.createElement('div'); o.className = 'd-over';
    o.innerHTML = `<div class="d-card"><div class="big">🔄</div><h3>Innings break</h3><p>${esc(D.names[a.bat])} scored <b>${a.runs}/${a.wk}</b></p>
      <p><b>${esc(chaser)}</b> needs <b>${a.runs + 1}</b> to win from ${g.overs * 6} balls.</p><p class="small muted">Swap roles - the batter now bowls!</p></div>`;
    el.appendChild(o);
    Sound.say(`End of the innings. ${chaser} needs ${a.runs + 1} to win.`);
    await sleep(3200);
    o.remove();
  }
  function showResult() {
    if (!D || D.resultShown) return;
    D.resultShown = true;
    const g = D.g;
    const forfeit = D.status === 'abandoned' || (g.result && g.result.by === 'forfeit');
    const text = forfeit ? (g.winner === D.me ? 'Your friend left the game - you win! 🏆' : 'The game was stopped.') : G.resultText(g, D.names);
    const iWon = D.mode === 'online' ? g.winner === D.me : D.mode === 'cpu' ? g.winner === 0 : g.winner >= 0;
    if (D.mode !== 'online') api('game_record', { mode: D.mode, overs: g.overs, wickets: g.wickets, balls: g.inn[0].balls + g.inn[1].balls, winner: g.winner }).catch(() => {});
    const el = document.getElementById('duel'); if (!el) return;
    setPanels('done');
    const o = document.createElement('div'); o.className = 'd-over';
    o.innerHTML = `<div class="d-card"><div class="big">${g.winner === -1 ? '🤝' : iWon ? '🏆' : '😮'}</div><h3>${esc(text)}</h3>
      ${g.inn.map(i => `<p>${esc(D.names[i.bat])}: <b>${i.runs}/${i.wk}</b> (${G.oversStr(i.balls)}) · ${i.fours}×4 ${i.sixes}×6</p>`).join('')}
      <div class="grid2" style="margin-top:12px"><button class="btn lime" onclick="Duel.again()">🔁 ${D.mode === 'online' ? 'Rematch' : 'Play again'}</button><button class="btn light" onclick="Duel.leave();go('#/play')">Done</button></div></div>`;
    el.appendChild(o);
    if (g.winner !== -1 && (iWon || D.mode === 'local')) { Sound.fx('win'); if (typeof confetti === 'function') confetti(); }
    Sound.say(text.replace(/[🏆🤝]/g, ''));
  }
  X.again = () => {
    if (!D) return;
    if (D.mode === 'cpu') { leaveScreen(); return X.startCpu(); }
    if (D.mode === 'local') {
      const names = D.names, g = D.g, first = 1 - g.inn[0].bat;
      leaveScreen(); startLocalGame({ mode: 'local', g: G.newGame(g.overs, g.wickets, first), names, human: [true, true] }); return;
    }
    apiQuiet('game_rematch', { code: D.code }).then(r => { leaveScreen(); go('#/play/room/' + r.code); }).catch(e => toast(e.message, true));
  };

  return X;
})();
window.Duel = Duel;
