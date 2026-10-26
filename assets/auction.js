/* Cric-Scorer - Aaryush Premier League (APL) Auction - browser side.
   The server decides everything (bids, timer, sales); this file polls auc_state every 2 s and draws it. */
'use strict';
window.Auction = (() => {
  const ROLE_ICON = { 'Batter': '🏏', 'Wicket-keeper': '🧤', 'All-rounder': '⭐', 'Bowler': '🎯' };
  const pref = (k, d) => { try { const v = localStorage.getItem('apl_' + k); return v === null ? d : v === '1'; } catch (e) { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem('apl_' + k, v ? '1' : '0'); } catch (e) { /* ignore */ } };
  const A = { st: null, since: 0, lastLot: null, timer: null, poll: null, anim: pref('anim', true), sfx: pref('sfx', true), voice: pref('voice', true), tab: 'live', lastVersion: 0, busy: false, said: {} };

  const coin = n => `<b class="apl-coin">${n}</b>`;
  const initials = n => esc(String(n || '?').split(' ').map(w => w[0]).slice(0, 2).join(''));
  const teamChip = t => `<span class="apl-tchip" style="--tc:${esc(t.color)}">${esc(t.avatar)} ${esc(t.name)}</span>`;
  const SND = () => (typeof Sound !== 'undefined' ? Sound : null);
  // The auction has its own audio switches (independent of the scoring sounds): gavel & crowd effects, and an auctioneer voice
  const fx = k => { if (A.sfx && SND()) Sound.fx(k, true); };
  const say = (text, interrupt = false) => { if (A.voice && SND() && Sound.hasSpeech) Sound.say(text, { delay: 60, interrupt, force: true }); };
  const unlockAudio = () => { if (SND()) Sound.unlock(); };
  document.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const roleWord = r => ({ 'Batter': 'batter', 'Wicket-keeper': 'wicket-keeper batter', 'All-rounder': 'all-rounder', 'Bowler': 'bowler' }[r] || 'player');
  function presentLine(lot) { return pick([`Lot ${lot.lot_no}. ${lot.name}, ${roleWord(lot.role)}${lot.country ? ' from ' + lot.country : ''}${lot.franchise && lot.franchise !== 'APL' ? ', ' + lot.franchise : ''}. Base price ${lot.base_price} coins. Who will open the bidding?`,
    `Next up, ${lot.name}! ${lot.overseas ? 'Overseas ' : ''}${roleWord(lot.role)}. We start at ${lot.base_price} coins.`, `Here comes ${lot.name}, ${roleWord(lot.role)}. Opening at ${lot.base_price}. Any takers?`]); }

  /* ---------- home ---------- */
  async function home() {
    mount(topbar('APL Auction', { back: true }) + `<div class="content">${sk(3)}</div>`, 'more');
    const d = await api('auc_home', {});
    const live = d.rooms.filter(r => r.status !== 'done'), done = d.rooms.filter(r => r.status === 'done');
    mount(topbar('APL Auction', { back: true, sub: 'Aaryush Premier League' }) + `<div class="content apl">
      <div class="apl-hero"><div class="apl-hero-t">🔨 Aaryush Premier League</div><div class="apl-hero-s">Bid virtual coins for IPL stars with friends and family - on your own phones, in real time. No real money, ever.</div>
        <div class="grid2" style="margin-top:12px"><button class="btn lime" onclick="go('#/apl/new')">＋ Create auction</button><button class="btn light" onclick="go('#/apl/join')">🔑 Join with code</button></div></div>
      ${live.length ? `<div class="section"><h2>My auctions</h2><span class="small muted">${live.length}</span></div><div class="card flush list">${live.map(r => `<div class="item" onclick="go('#/apl/room/${esc(r.code)}')"><span class="avatar">${r.status === 'lobby' ? '🛋️' : r.status === 'paused' ? '⏸️' : '🔴'}</span><div class="grow"><div class="t ellipsis">${esc(r.name)}</div><div class="s">${esc(r.team_name)} · ${plural(r.members, 'team')} · ${r.status === 'lobby' ? 'waiting to start' : r.status}${r.is_host ? ' · you host' : ''} · code ${esc(r.code)}</div></div><span class="chev">${I.chev}</span></div>`).join('')}</div>` : ''}
      <div class="tiles" style="margin-top:12px">
        <div class="tile" onclick="go('#/apl/teams')"><span class="ic">🧢</span>My teams</div>
        <div class="tile" onclick="go('#/apl/players')"><span class="ic">🃏</span>Player gallery</div>
        <div class="tile" onclick="go('#/apl/rules')"><span class="ic">📜</span>Auction rules</div>
        <div class="tile" onclick="go('#/apl/help')"><span class="ic">🎓</span>How to play</div></div>
      ${done.length ? `<div class="section"><h2>Completed auctions</h2></div><div class="card flush list">${done.map(r => `<div class="item" onclick="go('#/apl/room/${esc(r.code)}')"><span class="avatar">🏆</span><div class="grow"><div class="t ellipsis">${esc(r.name)}</div><div class="s">${esc(r.team_name)} · ${plural(r.members, 'team')}</div></div><span class="chev">${I.chev}</span></div>`).join('')}</div>` : ''}
      ${d.recent.length ? `<div class="section"><h2>Recent results</h2></div>${d.recent.map(r => { const t = (r.top || '').split('|'); return `<div class="card" style="cursor:pointer" onclick="go('#/apl/room/${esc(r.code)}')"><b>${esc(r.name)}</b><div class="small muted">${plural(r.members, 'team')} · ${esc(fmtDate(r.ended_at, false))}</div>${t[0] ? `<div class="small" style="margin-top:4px">💎 Top buy: <b>${esc(t[0])}</b> for ${t[1]} coins (${esc(t[2])})</div>` : ''}</div>`; }).join('')}` : ''}
    </div>`, 'more');
  }

  /* ---------- create ---------- */
  async function create() {
    mount(topbar('Create auction', { back: true }) + `<div class="content">${sk(3)}</div>`, 'more');
    const d = await api('auc_home', {}); const s = d.defaults; A.pick = { color: d.colors[0], avatar: d.avatars[0] };
    const f = (name, label, val, type = 'number', extra = '') => `<div class="field"><label>${label}</label><input class="input" name="${name}" type="${type}" value="${esc(val)}" ${extra}></div>`;
    mount(topbar('Create auction', { back: true }) + `<form class="content apl" onsubmit="Auction.createGo(event)">
      <div class="card">${f('name', 'Auction name', s.name, 'text', 'maxlength="80"')}
        <div class="field"><label>Your team name</label><input class="input" name="team_name" maxlength="40" placeholder="e.g. Aaryush Warriors" required></div>
        <div class="field"><label>Team colour</label><div class="apl-swatches" id="sw">${d.colors.map(c => `<button type="button" class="sw ${c === A.pick.color ? 'on' : ''}" style="background:${c}" onclick="Auction.pickColor(this,'${c}')"></button>`).join('')}</div></div>
        <div class="field"><label>Avatar</label><div class="apl-swatches" id="av">${d.avatars.map(a => `<button type="button" class="av ${a === A.pick.avatar ? 'on' : ''}" onclick="Auction.pickAvatar(this,'${a}')">${a}</button>`).join('')}</div></div>
        <div class="field"><label>Favourite IPL team (inspiration)</label><select class="input" name="fav"><option value="">-</option>${d.franchises.map(t => `<option value="${t.short_name}">${esc(t.name)}</option>`).join('')}</select></div></div>
      <div class="section"><h2>Players in the pool</h2></div>
      <div class="card"><div class="small muted" style="margin-bottom:8px">Pick the franchises whose squads go under the hammer (none = all 10). You can add your own players in the lobby.</div>
        <div class="chips wrap">${d.franchises.map(t => `<label class="chip apl-fr" style="--tc:${t.color}"><input type="checkbox" name="fr" value="${t.short_name}"> ${t.short_name} <small>${t.players}</small></label>`).join('')}</div></div>
      <div class="section"><h2>Rules</h2></div>
      <div class="card"><div class="grid3">${f('purse', 'Purse (coins)', s.purse, 'number', 'min="10" max="100000"')}${f('max_participants', 'Max teams', s.max_participants, 'number', 'min="2" max="20"')}${f('squad_size', 'Squad size', s.squad_size, 'number', 'min="1" max="25"')}</div>
        <div class="grid3">${f('xi_size', 'Playing XI', s.xi_size, 'number', 'min="1" max="25"')}${f('overseas_limit', 'Overseas max', s.overseas_limit, 'number', 'min="0" max="25"')}${f('role_cap', 'Max per role (0 = none)', s.role_cap, 'number', 'min="0" max="25"')}</div>
        <div class="grid3">${f('timer', 'Bid timer (s)', s.timer, 'number', 'min="5" max="120"')}${f('fast_timer', 'Fast timer (s)', s.fast_timer, 'number', 'min="3" max="60"')}${f('min_inc', 'Min increment', s.min_inc, 'number', 'min="1"')}</div>
        <div class="grid3">${f('base_price', 'Base price', s.base_price, 'number', 'min="1"')}${f('overseas_extra', 'Overseas + base', s.overseas_extra, 'number', 'min="0"')}<div class="field"><label>Format</label><select class="input" name="mode"><option value="standard">Standard</option><option value="accelerated">Accelerated</option></select></div></div>
        <div class="field"><label>Bigger steps at higher prices</label><div class="grid2"><input class="input" name="band1" placeholder="from 20 → +2" value="20:2"><input class="input" name="band2" placeholder="from 50 → +5" value="50:5"></div><div class="small muted">Write as from:step, e.g. 20:2 means bids of 20 coins and above go up by 2.</div></div>
        <div class="field"><label>Unsold players</label><select class="input" name="unsold"><option value="end">Come back once at the end</option><option value="none">Stay unsold</option></select></div>
        <label class="switch"><span><b>Timer resets on every bid</b><div class="small muted">Like a real auction - going once, going twice…</div></span><input type="checkbox" name="reset_on_bid" checked><span class="knob"></span></label>
        <label class="switch" style="margin-top:8px"><span><b>I bid too</b><div class="small muted">Off = you only run the auction (auctioneer)</div></span><input type="checkbox" name="host_plays" checked><span class="knob"></span></label></div>
      <div class="small muted" style="margin:8px 2px">Rooms are private: only people with the 8-character code can join. Coins are virtual - there is no money in this game.</div>
      <button class="btn block" style="margin:6px 0 20px">Create room →</button></form>`, 'more');
  }
  A.pickColor = (el, c) => { A.pick.color = c; el.parentNode.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === el)); };
  A.pickAvatar = (el, a) => { A.pick.avatar = a; el.parentNode.querySelectorAll('.av').forEach(x => x.classList.toggle('on', x === el)); };
  A.createGo = e => {
    e.preventDefault(); const d = formData(e.target);
    const bands = ['band1', 'band2'].map(k => (d[k] || '').split(':').map(Number)).filter(b => b.length === 2 && b[0] > 0 && b[1] > 0);
    const settings = { purse: +d.purse, max_participants: +d.max_participants, squad_size: +d.squad_size, xi_size: +d.xi_size, overseas_limit: +d.overseas_limit, role_cap: +d.role_cap, timer: +d.timer, fast_timer: +d.fast_timer, min_inc: +d.min_inc,
      base_price: +d.base_price, overseas_extra: +d.overseas_extra, mode: d.mode, bands, unsold: d.unsold, reset_on_bid: d.reset_on_bid, host_plays: d.host_plays, franchises: [...e.target.querySelectorAll('[name=fr]:checked')].map(x => x.value) };
    run(async () => { const r = await api('auc_create', { name: d.name, team_name: d.team_name, color: A.pick.color, avatar: A.pick.avatar, fav: d.fav, settings }); toast('Room created - share the code!'); go('#/apl/room/' + r.code); }, e.submitter);
  };

  /* ---------- join ---------- */
  async function join(code) {
    code = (code || '').toUpperCase();
    mount(topbar('Join auction', { back: true }) + `<div class="content apl"><div class="card"><h3 style="margin:0 0 6px">🔑 Enter the room code</h3><div class="small muted" style="margin-bottom:10px">Ask the host for the 8-character code or open their invite link.</div>
      <form class="row" onsubmit="event.preventDefault();Auction.lookup(this.code.value)"><input class="input grow apl-code" name="code" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="ABCD2345" value="${esc(code)}" required><button class="btn">Find</button></form></div><div id="jr"></div></div>`, 'more');
    if (code.length === 8) A.lookup(code);
  }
  A.lookup = code => run(async () => {
    const d = await api('auc_lookup', { code }); const r = d.room;
    if (d.joined) { go('#/apl/room/' + r.code); return; }
    A.pick = { color: d.colors[Math.floor(Math.random() * d.colors.length)], avatar: d.avatars[Math.floor(Math.random() * d.avatars.length)] };
    const el = document.getElementById('jr'); if (!el) return;
    if (r.status !== 'lobby') { el.innerHTML = `<div class="card empty"><div class="big">🔒</div><b>${esc(r.name)}</b><br>This auction has already ${r.status === 'done' ? 'finished' : 'started'} - ask the host for a new room.</div>`; return; }
    el.innerHTML = `<form class="card" onsubmit="Auction.joinGo(event,'${esc(r.code)}')"><b style="font-size:17px">${esc(r.name)}</b><div class="small muted">Host: ${esc(r.host)} · ${r.members}/${r.max} teams · ${r.purse} coins each</div>
      <div class="field" style="margin-top:10px"><label>Your team name</label><input class="input" name="team_name" maxlength="40" required placeholder="e.g. Aayush Avengers"></div>
      <div class="field"><label>Team colour</label><div class="apl-swatches">${d.colors.map(c => `<button type="button" class="sw ${c === A.pick.color ? 'on' : ''}" style="background:${c}" onclick="Auction.pickColor(this,'${c}')"></button>`).join('')}</div></div>
      <div class="field"><label>Avatar</label><div class="apl-swatches">${d.avatars.map(a => `<button type="button" class="av ${a === A.pick.avatar ? 'on' : ''}" onclick="Auction.pickAvatar(this,'${a}')">${a}</button>`).join('')}</div></div>
      <div class="field"><label>Favourite IPL team</label><select class="input" name="fav"><option value="">-</option>${d.franchises.map(t => `<option value="${t.short_name}">${esc(t.name)}</option>`).join('')}</select></div>
      <button class="btn block">Join the auction →</button></form>`;
  });
  A.joinGo = (e, code) => { e.preventDefault(); const d = formData(e.target); run(async () => { const r = await api('auc_join', { code, team_name: d.team_name, color: A.pick.color, avatar: A.pick.avatar, fav: d.fav }); go('#/apl/room/' + r.code); }, e.submitter); };

  /* ---------- the room: lobby / live / results ---------- */
  async function room(code) {
    stop();
    mount(topbar('APL Auction', { back: true, refresh: false }) + `<div class="content">${sk(3)}</div>`, 'more');
    let st;
    try { const j = await api('auc_join', { code }); st = await api('auc_state', { id: j.id, since: 0 }); }
    catch (e) { if (/not in this auction|No auction|already started/.test(e.message)) { go('#/apl/join/' + code); return; } throw e; }
    A.st = st; A.since = st.events.length ? st.events[0].id : 0; A.lastLot = st.lot ? st.lot.id : null; A.lastVersion = st.room.version; A.tab = st.room.status === 'done' ? 'results' : (A.tab === 'results' ? 'live' : A.tab);
    draw(true);
    if (st.room.status === 'live' && st.lot) say(presentLine(st.lot) + (st.lot.high_bidder ? ` The bid stands at ${st.lot.high_bid} with ${st.lot.high_bidder.name}.` : ''), true);
    A.poll = setInterval(poll, 2000); S.timers.push(A.poll);
    A.timer = setInterval(tickClock, 200); S.timers.push(A.timer);
  }
  function stop() { if (A.poll) clearInterval(A.poll); if (A.timer) clearInterval(A.timer); A.poll = A.timer = null; }
  async function poll() {
    if (!A.st || document.hidden || A.busy) return;
    try {
      const st = await api('auc_state', { id: A.st.room.id, since: A.since });
      apply(st);
    } catch (e) { setOffline(true); }
  }
  function setOffline(off) { const b = document.getElementById('aplOff'); if (b) b.style.display = off ? 'block' : 'none'; }
  function apply(st) {
    setOffline(false);
    const prev = A.st; A.st = st;
    const newEvents = st.events.filter(e => e.id > A.since).reverse();
    if (st.events.length) A.since = Math.max(A.since, ...st.events.map(e => e.id));
    newEvents.forEach(e => react(e, prev));
    const lotChanged = (st.lot ? st.lot.id : null) !== A.lastLot; A.lastLot = st.lot ? st.lot.id : null;
    if (lotChanged) A.said = {};
    if (st.room.status === 'done' && prev && prev.room.status !== 'done') { A.tab = 'results'; draw(true); return; }
    if (st.room.version !== A.lastVersion || lotChanged) { A.lastVersion = st.room.version; draw(false); }
  }
  function react(e, prev) {
    const d = e.data || {}, me = A.st.me;
    switch (e.kind) {
      case 'bid_accepted': fx('bid'); flash('bid'); A.said = {}; say(pick([`${d.team}, ${d.amount}!`, `${d.amount} coins from ${d.team}.`, `${d.team} goes to ${d.amount}!`, `${d.amount}! ${d.team} in the lead.`])); break;
      case 'player_sold': banner(`SOLD! ${d.name} → ${d.team} for ${d.price} coins`, 'sold'); fx('gavel'); setTimeout(() => fx(me && d.participant === me.id ? 'win' : 'sold'), 250); say(`Sold! ${d.name} goes to ${d.team} for ${d.price} coins.`, true); if (me && d.participant === me.id && A.anim && typeof confetti === 'function') confetti(); break;
      case 'player_unsold': banner(`UNSOLD - ${d.name}${d.again ? ' (back later)' : ''}`, 'unsold'); fx('gavel'); setTimeout(() => fx('wide'), 250); say(`No bids. ${d.name} goes unsold${d.again ? ', we will see him again later' : ''}.`, true); break;
      case 'player_presented': if (A.st.lot) say(presentLine(A.st.lot), true); break;
      case 'auction_started': banner('The auction has started!', 'sold'); fx('milestone'); say('Welcome to the Aaryush Premier League auction! Purses are full, paddles are ready. Let us begin.', true); break;
      case 'auction_paused': banner('Paused by the host', 'info'); say('The auction is paused.', true); break;
      case 'auction_resumed': banner('And we are back!', 'info'); say('And we are back!', true); break;
      case 'auction_completed': banner('That\'s a wrap - the auction is complete!', 'sold'); fx('win'); say('That is a wrap! The auction is complete. Check the results for the final squads.', true); break;
      case 'participant_joined': if (prev && prev.room.status === 'lobby') toast(`${d.team} joined ${d.host ? '(host)' : ''}`); break;
      case 'participant_left': toast(`${d.team} left`); break;
    }
  }
  function banner(text, cls) {
    document.querySelectorAll('.apl-banner').forEach(x => x.remove());
    const b = document.createElement('div'); b.className = 'apl-banner ' + cls + (A.anim ? '' : ' still'); b.textContent = text; document.body.appendChild(b); setTimeout(() => b.remove(), 2600);
  }
  function flash(kind) { const el = document.getElementById('aplBid'); if (el && A.anim) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); } }
  // local countdown between polls, corrected by the server's secs_left every poll
  function tickClock() {
    const st = A.st; if (!st || !st.lot) return;
    if (st.room.status === 'live') { st.lot.secs_left = Math.max(0, st.lot.secs_left - 0.2); }
    const el = document.getElementById('aplClock'); if (!el) return;
    const s = st.lot.secs_left, total = st.room.settings.mode === 'accelerated' ? st.room.settings.fast_timer : st.room.settings.timer;
    el.querySelector('b').textContent = Math.ceil(s);
    el.style.setProperty('--p', Math.max(0, Math.min(1, s / total)));
    el.classList.toggle('hot', s <= 5 && st.room.status === 'live');
    if (st.room.status === 'live') {
      const k = st.lot.id + ':' + (st.lot.high_bid || 0);
      if (s <= 5.2 && s > 4.8 && A.said[k + 'once'] !== true) { A.said[k + 'once'] = true; say(st.lot.high_bidder ? `${st.lot.high_bid} coins, going once...` : 'No bids yet... going once...'); }
      if (s <= 2.6 && s > 2.2 && A.said[k + 'twice'] !== true) { A.said[k + 'twice'] = true; say('Going twice...'); }
      if (s <= 3.2 && s > 0 && Math.abs(s - Math.round(s)) < 0.12 && A.said['t' + k + Math.round(s)] !== true) { A.said['t' + k + Math.round(s)] = true; fx('tick'); }
    }
    if (s <= 0 && st.room.status === 'live' && !A.busy) { el.querySelector('b').textContent = '…'; poll(); }
  }

  function draw(full) {
    const st = A.st, r = st.room, me = st.me;
    const sub = `Code ${r.code} · ${plural(st.teams.length, 'team')}${r.status === 'live' ? ' · LIVE' : r.status === 'paused' ? ' · paused' : r.status === 'done' ? ' · finished' : ' · lobby'}`;
    const actions = `<button class="icon-btn" aria-label="Auction audio" onclick="Auction.audioSheet()">${A.sfx || A.voice ? '🔊' : '🔇'}</button><button class="icon-btn" aria-label="Share invite" onclick="Auction.invite()">${I.share}</button><button class="icon-btn" aria-label="Options" onclick="Auction.menu()">${I.dots}</button>`;
    let body;
    if (r.status === 'lobby') body = lobbyView(st);
    else if (A.tab === 'results' || r.status === 'done') body = resultsShell(st);
    else if (A.tab === 'team') body = teamView(st);
    else if (A.tab === 'host') body = hostView(st);
    else body = liveView(st);
    const tabs = r.status === 'lobby' ? '' : `<div class="seg scroll" style="margin:0 0 10px">${[['live', '🔨 Live'], ['team', '🧢 My team'], ...(r.is_host ? [['host', '🎛️ Host']] : []), ['results', '🏆 Results']].map(([k, l]) => `<button class="${A.tab === k ? 'on' : ''}" onclick="Auction.setTab('${k}')">${l}</button>`).join('')}</div>`;
    const html = topbar(r.name, { back: true, actions, sub, refresh: false }) + `<div class="content apl"><div id="aplOff" class="notice" style="display:none">Reconnecting… your bids are safe - the server keeps the auction running.</div>${tabs}${body}</div>`;
    mount(html, 'more', { keepScroll: !full });
    if (A.tab === 'results' && r.status === 'done' && !A.res) loadResults();
  }
  A.setTab = k => { A.tab = k; draw(true); if (k === 'results') loadResults(); };

  /* ---------- lobby ---------- */
  function lobbyView(st) {
    const r = st.room, s = r.settings, me = st.me;
    const url = (window.CS_SITE_URL || location.origin + '/') + '#/apl/join/' + r.code;
    return `<div class="card apl-codecard"><div class="small muted">Room code - share it with friends</div><div class="apl-bigcode" onclick="Auction.copy('${esc(r.code)}')">${esc(r.code)}</div>
      <div class="grid2"><button class="btn light" onclick="Auction.copy('${esc(url)}')">🔗 Copy invite link</button><button class="btn" onclick="Auction.invite()">💬 Share on WhatsApp</button></div></div>
      <div class="section"><h2>Teams in the room</h2><span class="small muted">${st.teams.length}/${s.max_participants}</span></div>
      <div class="card flush list">${st.teams.map(t => `<div class="item"><span class="avatar" style="background:${esc(t.color)};color:#fff">${esc(t.avatar)}</span><div class="grow"><div class="t">${esc(t.name)}${t.is_host ? ' <span class="role-tag">HOST</span>' : ''}${!t.is_bidder ? ' <span class="role-tag">AUCTIONEER</span>' : ''}</div><div class="s">${esc(t.owner)}${t.fav ? ' · ❤️ ' + esc(t.fav) : ''} · ${t.online ? '🟢 online' : '⚪ away'}</div></div>
        ${me && t.id === me.id ? '<button class="btn sm light" onclick="Auction.editTeam()">Edit</button>' : r.is_host && !t.is_host ? `<button class="btn sm light" onclick="Auction.kick(${t.id})">Remove</button>` : ''}</div>`).join('')}</div>
      <div class="section"><h2>Rules</h2>${r.is_host ? '<a href="#" onclick="event.preventDefault();Auction.settingsSheet()">Edit ›</a>' : ''}</div>
      <div class="card flush"><div class="kv" style="border-top:0"><span>Purse</span><span>${s.purse} coins</span></div><div class="kv"><span>Squad / XI</span><span>${s.squad_size} / ${s.xi_size}</span></div><div class="kv"><span>Overseas max</span><span>${s.overseas_limit}</span></div><div class="kv"><span>Timer</span><span>${s.timer} s (${s.fast_timer} s accelerated)</span></div><div class="kv"><span>Base price</span><span>${s.base_price} (+${s.overseas_extra} overseas)</span></div><div class="kv"><span>Steps</span><span>+${s.min_inc}${s.bands.map(b => `, from ${b[0]}: +${b[1]}`).join('')}</span></div><div class="kv"><span>Pool</span><span>${st.pool ? st.pool.n : '-'} players${s.franchises.length ? ' (' + s.franchises.join(', ') + ')' : ' (all 10 franchises)'}</span></div><div class="kv"><span>Unsold</span><span>${s.unsold === 'end' ? 'come back once' : 'stay unsold'}</span></div></div>
      ${st.pool && st.pool.custom.length ? `<div class="section"><h2>Your added players</h2></div><div class="card flush list">${st.pool.custom.map(p => `<div class="item"><span class="avatar">${ROLE_ICON[p.role]}</span><div class="grow"><div class="t">${esc(p.name)}</div><div class="s">${esc(p.role)} · base ${p.base_price}</div></div>${r.is_host ? `<button class="btn sm light" onclick="Auction.poolRemove(${p.id})">✕</button>` : ''}</div>`).join('')}</div>` : ''}
      ${r.is_host ? `<div class="grid2" style="margin-top:10px"><button class="btn light" onclick="Auction.addPlayerSheet()">＋ Add a player</button><button class="btn lime" onclick="Auction.start()">🔨 Start auction</button></div><div class="small muted" style="margin-top:6px">Needs at least 2 bidding teams. Settings lock when you start.</div>` : `<div class="card empty small" style="margin-top:10px">⏳ Waiting for the host to start…</div><button class="btn light block" onclick="Auction.leave()">Leave room</button>`}`;
  }

  /* ---------- live auction ---------- */
  function liveView(st) {
    const r = st.room, lot = st.lot, me = st.me, s = r.settings;
    if (!lot) return `<div class="card empty"><div class="big">${r.status === 'paused' ? '⏸️' : '⏳'}</div>${r.status === 'paused' ? 'The host has paused the auction.' : 'Bringing in the next player…'}</div>` + teamsStrip(st);
    const hb = lot.high_bidder; const mineTop = me && hb && hb.id === me.id;
    const canBid = me && me.is_bidder && r.status === 'live' && !mineTop && me.purse >= lot.next_bid && me.slots > 0 && !(lot.overseas && me.overseas >= s.overseas_limit);
    const why = !me ? 'Watching' : !me.is_bidder ? 'You are the auctioneer' : mineTop ? 'You hold the highest bid' : me.slots <= 0 ? 'Your squad is full' : me.purse < lot.next_bid ? 'Not enough coins' : (lot.overseas && me.overseas >= s.overseas_limit) ? 'Overseas limit reached' : r.status === 'paused' ? 'Paused' : '';
    const quick = [lot.next_bid, lot.next_bid + Math.max(1, s.min_inc), lot.next_bid + 2 * Math.max(1, s.min_inc)].filter((v, i, a) => a.indexOf(v) === i && (!me || v <= me.purse));
    return `<div class="apl-stage" style="--tc:${esc(lot.franchise_color || '#0d4a36')}">
      <div class="apl-lotno">Lot ${lot.lot_no} · ${r.queue} to come${r.status === 'paused' ? ' · ⏸️ PAUSED' : ''}${s.mode === 'accelerated' ? ' · ⚡ accelerated' : ''}</div>
      <div class="apl-player ${A.anim ? 'reveal' : ''}" key="${lot.id}"><div class="apl-pic">${initials(lot.name)}</div>
        <div class="apl-pinfo"><div class="apl-pname">${esc(lot.name)}</div><div class="apl-pmeta">${ROLE_ICON[lot.role] || ''} ${esc(lot.role)} · ${esc(lot.country || '')} ${lot.overseas ? '✈️ overseas' : '🇮🇳'}</div>
          <div class="apl-pmeta small">${esc([lot.batting_style, lot.bowling_style].filter(Boolean).join(' · '))}</div><div class="apl-pmeta small">${lot.franchise ? 'Franchise: ' + esc(lot.franchise) : ''} · base ${lot.base_price}</div></div>
        <div class="apl-clock" id="aplClock" style="--p:1"><b>${Math.ceil(lot.secs_left)}</b><span>sec</span></div></div>
      <div class="apl-bidrow" id="aplBid"><div><div class="small">${hb ? 'Highest bid' : 'Opening at'}</div><div class="apl-amount">${hb ? lot.high_bid : lot.base_price} <small>coins</small></div></div>
        <div class="grow" style="text-align:right">${hb ? `<div class="small">held by</div>${teamChip(hb)}` : '<div class="small muted">No bids yet</div>'}<div class="small muted">${lot.competing} team${lot.competing === 1 ? '' : 's'} bidding · ${lot.bids} bid${lot.bids === 1 ? '' : 's'}</div></div></div>
    </div>
    ${me ? `<div class="apl-ctl"><button class="btn lime block apl-bidbtn" ${canBid ? '' : 'disabled'} onclick="Auction.bid(${lot.id},${lot.next_bid})">${canBid ? `🔨 Bid ${lot.next_bid} coins` : esc(why)}</button>
      ${canBid && quick.length > 1 ? `<div class="chips" style="margin-top:8px">${quick.slice(1).map(v => `<button class="chip" onclick="Auction.bid(${lot.id},${v})">Jump to ${v}</button>`).join('')}</div>` : ''}
      <div class="apl-mine"><span>💰 ${me.purse} left</span><span>🧢 ${me.players}/${s.squad_size}</span><span>✈️ ${me.overseas}/${s.overseas_limit}</span><span>spent ${me.spent}</span></div></div>` : ''}
    ${lot.history.length ? `<div class="card flush"><div class="kv" style="border-top:0"><span>Bids on this player</span><span></span></div>${lot.history.map(h => `<div class="kv"><span>${esc(h.team)}</span><span>${h.amount}</span></div>`).join('')}</div>` : ''}
    ${st.upcoming.length ? `<div class="section"><h2>Coming up</h2></div><div class="chips">${st.upcoming.map(p => `<span class="chip">${ROLE_ICON[p.role]} ${esc(p.name)} · ${p.base_price}</span>`).join('')}</div>` : ''}
    ${teamsStrip(st)}`;
  }
  function teamsStrip(st) {
    return `<div class="section"><h2>Teams</h2><span class="small muted">purse · players</span></div><div class="apl-teams">${st.teams.map(t => `<div class="apl-team ${st.me && t.id === st.me.id ? 'me' : ''} ${t.is_bidder ? '' : 'dim'}" style="--tc:${esc(t.color)}"><div class="row" style="gap:6px"><span class="apl-av">${esc(t.avatar)}</span><b class="ellipsis grow">${esc(t.name)}</b>${t.online ? '' : '<span title="offline">⚪</span>'}</div><div class="small">${t.is_bidder ? `💰 ${t.purse} · 🧢 ${t.players}` : 'auctioneer'}</div></div>`).join('')}</div>`;
  }

  /* ---------- my team ---------- */
  function teamView(st) {
    const me = st.me, s = st.room.settings;
    if (!me) return '<div class="card empty">You are watching this auction.</div>';
    const roles = {}; st.roster.forEach(p => { roles[p.role] = (roles[p.role] || 0) + 1; });
    const need = ['Batter', 'Wicket-keeper', 'All-rounder', 'Bowler'].map(r => `<div class="apl-rolebox ${roles[r] ? 'ok' : ''}"><b>${roles[r] || 0}</b><span>${ROLE_ICON[r]} ${r}</span></div>`).join('');
    return `<div class="card apl-teamhead" style="--tc:${esc(me.color)}"><span class="apl-av big">${esc(me.avatar)}</span><div class="grow"><b style="font-size:20px">${esc(me.name)}</b><div class="small">${esc(me.owner)}${me.fav ? ' · ❤️ ' + esc(me.fav) : ''}</div></div></div>
      <div class="card flush"><div class="statgrid">${[[me.purse, 'Coins left'], [me.spent, 'Spent'], [me.players + '/' + s.squad_size, 'Squad'], [me.slots, 'Slots left'], [me.players - me.overseas, 'Indian'], [me.overseas + '/' + s.overseas_limit, 'Overseas']].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('')}</div></div>
      <div class="section"><h2>Squad balance</h2><span class="small muted">aim for all four</span></div><div class="apl-roles">${need}</div>
      <div class="section"><h2>My players</h2><span class="small muted">${st.roster.length}</span></div>
      ${st.roster.length ? `<div class="apl-cards">${st.roster.map(p => playerCard(p, p.price)).join('')}</div>` : '<div class="card empty small">No players yet - go win some bids!</div>'}`;
  }
  function playerCard(p, price, tag = '') {
    return `<div class="apl-card" style="--tc:${esc(p.franchise_color || '#0d4a36')}"><div class="apl-cardtop"><span>${esc(p.franchise || 'APL')}</span><span>${p.overseas ? '✈️' : '🇮🇳'}</span></div><div class="apl-cardpic">${initials(p.name)}</div><b class="ellipsis">${esc(p.name)}</b><div class="small">${ROLE_ICON[p.role]} ${esc(p.role)}</div>${price !== undefined ? `<div class="apl-cardprice">${price} coins</div>` : ''}${tag}</div>`;
  }

  /* ---------- host console ---------- */
  function hostView(st) {
    const r = st.room, s = r.settings, lot = st.lot;
    const btn = (label, fn, cls = 'light') => `<button class="btn ${cls}" onclick="${fn}">${label}</button>`;
    return `<div class="card"><b>🎛️ Host console</b><div class="small muted">Status: ${r.status} · lot ${r.lot_no} · ${r.queue} queued · ${r.sold} sold · ${r.unsold} unsold</div>
      <div class="grid2" style="margin-top:10px">${r.status === 'live' ? btn('⏸️ Pause', "Auction.host('pause')") : r.status === 'paused' ? btn('▶️ Resume', "Auction.host('resume')", '') : ''}${lot && !lot.high_bidder && r.status !== 'done' ? btn('⏭️ Skip (unsold)', "Auction.host('skip')") : ''}${r.status === 'live' && lot ? btn('⏱️ +10 s', "Auction.host('extend',{secs:10})") : ''}${r.status !== 'done' ? btn('🏁 End auction', 'Auction.endConfirm()', 'light') : btn('🔒 Close room', "Auction.host('close')")}</div></div>
      <div class="card"><div class="row" style="justify-content:space-between"><b>Timer & mode</b><span class="small muted">applies to the next players</span></div>
        <form class="grid3" style="margin-top:8px" onsubmit="event.preventDefault();Auction.host('timer',{timer:+this.t.value,fast_timer:+this.f.value,mode:this.m.value})"><input class="input" name="t" type="number" min="5" max="120" value="${s.timer}" title="Standard timer"><input class="input" name="f" type="number" min="3" max="60" value="${s.fast_timer}" title="Fast timer"><select class="input" name="m"><option value="standard" ${s.mode === 'standard' ? 'selected' : ''}>Standard</option><option value="accelerated" ${s.mode === 'accelerated' ? 'selected' : ''}>Accelerated</option></select><button class="btn sm" style="grid-column:1/-1">Save</button></form></div>
      <div class="section"><h2>Queue</h2><span class="small muted">tap to bring forward / withdraw</span></div>
      <div id="aplQueue">${st.upcoming.map(p => `<div class="card row" style="margin-bottom:8px"><span class="avatar">${ROLE_ICON[p.role]}</span><div class="grow"><b>${esc(p.name)}</b><div class="small muted">${esc(p.role)} · base ${p.base_price}</div></div><button class="btn sm light" onclick="Auction.host('next',{lot_id:${p.id}})">Next</button><button class="btn sm light" onclick="Auction.host('withdraw',{lot_id:${p.id}})">✕</button></div>`).join('') || '<div class="card empty small">Queue is empty.</div>'}</div>
      <button class="btn light block" onclick="Auction.addPlayerSheet()">＋ Add a player to the queue</button>
      <div class="section"><h2>Purses & squads</h2></div><div class="card flush">${st.teams.map(t => `<div class="kv"><span>${esc(t.avatar)} ${esc(t.name)}</span><span>${t.is_bidder ? `${t.purse} coins · ${t.players} players · ✈️ ${t.overseas}` : 'auctioneer'}</span></div>`).join('')}</div>
      <div class="section"><h2>Unsold / withdrawn</h2><span class="small muted">reopen any time</span></div><div id="aplUnsold"><button class="btn light block" onclick="Auction.unsoldSheet()">Show list</button></div>
      <div class="small muted" style="margin-top:10px">Accepted bids and sales cannot be edited. Bonus points and corrections are recorded in the audit log on the results page.</div>`;
  }
  A.host = (what, extra = {}) => run(async () => { A.busy = true; try { const st = await api('auc_host', { id: A.st.room.id, do: what, ...extra }); apply(st); draw(true); } finally { A.busy = false; } });
  A.endConfirm = () => confirmSheet('End the auction now?', 'The current player is finalised and everyone else stays unsold. Results are shown to all teams.', 'End auction', () => { closeSheet(); A.host('end'); });
  A.unsoldSheet = () => run(async () => {
    const res = await api('auc_results', { id: A.st.room.id });
    sheet(`<h3>Unsold & withdrawn</h3><div class="plist">${res.unsold.map(p => `<button class="pbtn" onclick="closeSheet();Auction.host('reopen',{lot_id:${p.id}})">${ROLE_ICON[p.role]} ${esc(p.name)}<span class="s">${esc(p.status)} · base ${p.base_price} · tap to reopen</span></button>`).join('') || '<div class="muted small">Nobody is unsold.</div>'}</div>`);
  });
  A.addPlayerSheet = () => sheet(`<h3>＋ Add a player</h3><div class="sub">A friend, a family member, or a made-up star.</div><form onsubmit="event.preventDefault();Auction.addPlayer(this)">
    <div class="field"><label>Name</label><input class="input" name="name" maxlength="100" required placeholder="e.g. Aayush Rocket"></div>
    <div class="grid2"><div class="field"><label>Role</label><select class="input" name="role">${Object.keys(ROLE_ICON).map(r => `<option>${r}</option>`).join('')}</select></div><div class="field"><label>Base price</label><input class="input" name="base_price" type="number" min="1" max="50" value="${A.st.room.settings.base_price}"></div></div>
    <div class="grid2"><div class="field"><label>Country</label><input class="input" name="country" value="India" maxlength="50"></div><label class="switch" style="margin-top:22px"><span><b>Overseas</b></span><input type="checkbox" name="overseas"><span class="knob"></span></label></div>
    <button class="btn block">Add</button></form>`);
  A.addPlayer = f => run(async () => { const d = formData(f); await api('auc_pool_add', { id: A.st.room.id, ...d }); closeSheet(); toast('Player added'); await poll(); draw(true); });
  A.poolRemove = id => run(async () => { await api('auc_pool_remove', { id: A.st.room.id, lot_id: id }); await poll(); draw(true); });
  A.kick = id => confirmSheet('Remove this team?', 'They can join again with the code.', 'Remove', () => run(async () => { await api('auc_kick', { id: A.st.room.id, participant_id: id }); closeSheet(); await poll(); draw(true); }));
  A.leave = () => confirmSheet('Leave this room?', 'You can join again with the code while it is in the lobby.', 'Leave', () => run(async () => { await api('auc_leave', { id: A.st.room.id }); closeSheet(); go('#/apl'); }));
  A.start = () => run(async () => { unlockAudio(); A.busy = true; try { const st = await api('auc_start', { id: A.st.room.id }); A.tab = 'live'; apply(st); draw(true); fx('milestone'); } finally { A.busy = false; } });
  A.bid = (lotId, amount) => run(async () => {
    if (A.busy) return; unlockAudio(); A.busy = true;
    const btn = document.querySelector('.apl-bidbtn'); if (btn) btn.disabled = true;
    try {
      const r = await api('auc_bid', { id: A.st.room.id, lot_id: lotId, amount });
      if (r.error_code === 'stale') { toast(r.message, true); fx('wrong'); }
      else { if (navigator.vibrate) navigator.vibrate(15); }
      apply(r); draw(false);
    } finally { A.busy = false; }
  });
  A.settingsSheet = () => {
    const s = A.st.room.settings, f = (n, l, v, extra = '') => `<div class="field"><label>${l}</label><input class="input" name="${n}" type="number" value="${v}" ${extra}></div>`;
    sheet(`<h3>Rules</h3><form onsubmit="event.preventDefault();Auction.saveSettings(this)"><div class="field"><label>Auction name</label><input class="input" name="name" maxlength="80" value="${esc(A.st.room.name)}"></div>
      <div class="grid3">${f('purse', 'Purse', s.purse, 'min="10"')}${f('max_participants', 'Max teams', s.max_participants, 'min="2" max="20"')}${f('squad_size', 'Squad', s.squad_size, 'min="1" max="25"')}</div>
      <div class="grid3">${f('xi_size', 'XI', s.xi_size, 'min="1"')}${f('overseas_limit', 'Overseas', s.overseas_limit, 'min="0"')}${f('role_cap', 'Per role', s.role_cap, 'min="0"')}</div>
      <div class="grid3">${f('timer', 'Timer', s.timer, 'min="5" max="120"')}${f('fast_timer', 'Fast', s.fast_timer, 'min="3" max="60"')}${f('min_inc', 'Step', s.min_inc, 'min="1"')}</div>
      <div class="grid2">${f('base_price', 'Base price', s.base_price, 'min="1"')}${f('overseas_extra', 'Overseas +', s.overseas_extra, 'min="0"')}</div>
      <label class="switch"><span><b>I bid too</b></span><input type="checkbox" name="host_plays" ${s.host_plays ? 'checked' : ''}><span class="knob"></span></label>
      <button class="btn block" style="margin-top:10px">Save</button></form>`);
  };
  A.saveSettings = f => run(async () => { const d = formData(f); const name = d.name; delete d.name; Object.keys(d).forEach(k => { if (k !== 'host_plays') d[k] = +d[k]; }); await api('auc_settings', { id: A.st.room.id, name, settings: d }); closeSheet(); toast('Saved ✓'); await poll(); draw(true); });
  A.editTeam = () => { const me = A.st.me; A.pick = { color: me.color, avatar: me.avatar };
    sheet(`<h3>Your team</h3><form onsubmit="event.preventDefault();Auction.saveTeam(this)"><div class="field"><label>Team name</label><input class="input" name="team_name" maxlength="40" value="${esc(me.name)}" required></div>
      <div class="field"><label>Colour</label><div class="apl-swatches">${['#F9CD05', '#004BA0', '#EC1C24', '#3A225D', '#F26522', '#EA1A85', '#DD1F2D', '#17479E', '#1B2133', '#A72B2A', '#0d4a36', '#8e44ad'].map(c => `<button type="button" class="sw ${c === me.color ? 'on' : ''}" style="background:${c}" onclick="Auction.pickColor(this,'${c}')"></button>`).join('')}</div></div>
      <div class="field"><label>Avatar</label><div class="apl-swatches">${['🦁', '🐯', '🦅', '🐘', '🦈', '🐉', '🦊', '🐺', '🦄', '🐻', '🦖', '🐬', '🏏', '⚡', '🔥', '🌟'].map(a => `<button type="button" class="av ${a === me.avatar ? 'on' : ''}" onclick="Auction.pickAvatar(this,'${a}')">${a}</button>`).join('')}</div></div>
      <button class="btn block">Save</button></form>`); };
  A.saveTeam = f => run(async () => { await api('auc_profile', { id: A.st.room.id, team_name: f.team_name.value, color: A.pick.color, avatar: A.pick.avatar }); closeSheet(); await poll(); draw(true); });
  A.copy = text => { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Copied ✓')).catch(() => prompt('Copy this:', text)); };
  A.invite = async () => {
    const r = A.st.room, url = (window.CS_SITE_URL || location.origin + '/') + '#/apl/join/' + r.code;
    const text = `🔨 Join my APL Auction "${r.name}" on Cric-Scorer! Room code: ${r.code}\n${url}`;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { /* cancelled */ } }
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  };
  A.menu = () => sheet(`<h3>Options</h3><div class="plist">
    <button class="pbtn" onclick="Auction.setAnim(!Auction.anim);closeSheet()">${A.anim ? '🎞️ Turn animations off' : '🎞️ Turn animations on'}</button>
    <button class="pbtn" onclick="Auction.setSfx(!Auction.sfx);closeSheet()">${A.sfx ? '🔇 Mute gavel & crowd sounds' : '🔊 Gavel & crowd sounds on'}</button>
    <button class="pbtn" onclick="Auction.setVoice(!Auction.voice);closeSheet()">${A.voice ? '🤐 Mute the auctioneer voice' : '🎙️ Auctioneer voice on'}</button>
    <button class="pbtn" onclick="closeSheet();Auction.testAudio()">▶️ Test sound & voice</button>
    <button class="pbtn" onclick="closeSheet();Auction.invite()">💬 Share invite</button>
    <button class="pbtn" onclick="closeSheet();go('#/apl/rules')">📜 Auction rules</button>
    ${A.st.room.status === 'done' ? '<button class="pbtn" onclick="closeSheet();Auction.csv()">⬇️ Download results (CSV)</button><button class="pbtn" onclick="closeSheet();window.print()">🖨️ Print summary</button>' : ''}
    <button class="pbtn" onclick="closeSheet();go('#/apl')">🏠 APL home</button></div>`);
  A.setAnim = v => { A.anim = v; setPref('anim', v); document.body.classList.toggle('apl-still', !v); };
  A.setSfx = v => { A.sfx = v; setPref('sfx', v); unlockAudio(); draw(false); };
  A.setVoice = v => { A.voice = v; setPref('voice', v); unlockAudio(); if (!v && SND()) Sound.stopVoice(); draw(false); };
  A.testAudio = () => { unlockAudio(); fx('gavel'); setTimeout(() => fx('sold'), 300); say('Testing, testing. Sold to the lucky bidder!', true); if (!SND() || !Sound.hasSpeech) toast('This browser has no text-to-speech voice', true); else toast('Turn up the volume and switch off silent mode'); };
  A.audioSheet = () => sheet(`<h3>🔊 Auction audio</h3><div class="sub">Gavel, crowd and an auctioneer who calls every bid - "going once, going twice, sold!"</div>
    <label class="switch" style="margin-bottom:10px"><span><b>Gavel & crowd sounds</b></span><input type="checkbox" ${A.sfx ? 'checked' : ''} onchange="Auction.setSfx(this.checked)"><span class="knob"></span></label>
    <label class="switch" style="margin-bottom:10px"><span><b>Auctioneer voice</b><div class="small muted">${SND() && Sound.hasSpeech ? 'Reads out the player, every bid and the sale' : 'This browser has no text-to-speech voice'}</div></span><input type="checkbox" ${A.voice ? 'checked' : ''} onchange="Auction.setVoice(this.checked)"><span class="knob"></span></label>
    <button class="btn block" onclick="Auction.testAudio()">▶️ Test</button><div class="small muted" style="margin-top:10px">On iPhone the ring/silent switch must be off for sound. Audio starts after your first tap on the page.</div>`);
  A.csv = () => run(async () => { const r = await api('auc_csv', { id: A.st.room.id }); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv' })); a.download = `apl-auction-${A.st.room.code}.csv`; document.body.appendChild(a); a.click(); a.remove(); });

  /* ---------- results ---------- */
  function resultsShell(st) { return `<div id="aplRes">${A.res && A.res.room.id === st.room.id ? resultsView(A.res) : sk(3)}</div>`; }
  async function loadResults() {
    try { A.res = await api('auc_results', { id: A.st.room.id }); const el = document.getElementById('aplRes'); if (el) el.innerHTML = resultsView(A.res); } catch (e) { toast(e.message, true); }
  }
  function resultsView(res) {
    const h = res.highlights, s = res.room.settings, me = A.st.me;
    const medal = i => ['🥇', '🥈', '🥉'][i] || (i + 1);
    const xiOf = t => (t.xi || []).length ? t.squad.filter(p => t.xi.includes(p.id)) : [];
    return `<div class="apl-hero small"><div class="apl-hero-t">🏆 ${esc(res.room.name)}</div><div class="apl-hero-s">${h.sold} sold · ${h.unsold} unsold · ${h.bids} bids${res.room.status !== 'done' ? ' · still running' : ''}</div></div>
      <div class="apl-hl">${h.top ? `<div class="card"><div class="small muted">💎 Most expensive</div><b>${esc(h.top.name)}</b><div class="small">${h.top.price} coins → ${esc(h.top.team)}</div></div>` : ''}${h.most ? `<div class="card"><div class="small muted">🧢 Most players</div><b>${esc(h.most.team)}</b><div class="small">${h.most.n} players</div></div>` : ''}${h.rich ? `<div class="card"><div class="small muted">💰 Biggest purse left</div><b>${esc(h.rich.team)}</b><div class="small">${h.rich.purse} coins</div></div>` : ''}</div>
      <div class="section"><h2>Leaderboard</h2><span class="small muted" onclick="Auction.scoreHelp()">how? ⓘ</span></div>
      <div class="card flush list">${res.teams.filter(t => t.is_bidder).map((t, i) => `<div class="item" onclick="Auction.showTeam(${t.id})"><span class="rank">${medal(i)}</span><span class="avatar" style="background:${esc(t.color)};color:#fff">${esc(t.avatar)}</span><div class="grow"><div class="t ellipsis">${esc(t.name)}</div><div class="s">${t.players} players · ${t.balance}/4 roles · ${t.purse} left (${t.used_pct}% used)${t.bonus ? ' · bonus ' + t.bonus : ''}</div></div><b class="big-num">${t.score}</b></div>`).join('')}</div>
      ${me && res.room.status === 'done' ? `<button class="btn light block" onclick="Auction.xiSheet()">🏏 ${(me.xi || []).length ? 'Change' : 'Pick'} my playing XI</button>` : ''}
      <div class="section"><h2>Squads</h2></div>
      ${res.teams.map(t => `<div class="card" style="border-left:6px solid ${esc(t.color)}"><div class="row" style="justify-content:space-between"><b>${esc(t.avatar)} ${esc(t.name)}</b><span class="small muted">${t.spent} spent · ${t.purse} left</span></div>
        <div class="small muted">🏏 ${t.roles['Batter']} · 🧤 ${t.roles['Wicket-keeper']} · ⭐ ${t.roles['All-rounder']} · 🎯 ${t.roles['Bowler']} · ✈️ ${t.overseas}</div>
        ${t.squad.length ? `<div class="chips wrap" style="margin-top:8px">${t.squad.map(p => `<span class="chip ${xiOf(t).some(x => x.id === p.id) ? 'on' : ''}">${ROLE_ICON[p.role]} ${esc(p.name)} <small>${p.price}</small></span>`).join('')}</div>` : '<div class="small muted" style="margin-top:6px">No players bought</div>'}
        ${xiOf(t).length ? `<div class="small" style="margin-top:6px">Playing XI (highlighted): ${xiOf(t).length}/${s.xi_size}</div>` : ''}</div>`).join('')}
      <div class="section"><h2>Every sale</h2><span class="small muted">${res.sold.length}</span></div>
      <div class="card flush"><table class="tbl"><tr><th>#</th><th>Player</th><th>Team</th><th>Coins</th></tr>${res.sold.map(p => `<tr><td>${p.lot_no}</td><td><div class="nm">${esc(p.name)}</div><div class="how">${ROLE_ICON[p.role]} ${esc(p.role)}${p.overseas ? ' ✈️' : ''}</div></td><td>${esc(p.team)}</td><td><b>${p.price}</b></td></tr>`).join('')}</table></div>
      ${res.unsold.length ? `<div class="section"><h2>Unsold</h2></div><div class="chips wrap">${res.unsold.map(p => `<span class="chip">${ROLE_ICON[p.role]} ${esc(p.name)}</span>`).join('')}</div>` : ''}
      <div class="section"><h2>Bid history</h2><span class="small muted">${res.bids.length}</span></div>
      <div class="card flush" style="max-height:320px;overflow:auto">${res.bids.slice().reverse().map(b => `<div class="kv"><span>#${b.lot_no} ${esc(b.player)}</span><span>${esc(b.team)} · ${b.amount}</span></div>`).join('') || '<div class="muted small" style="padding:12px">No bids.</div>'}</div>
      ${res.audit.length ? `<div class="section"><h2>Audit log</h2></div><div class="card flush">${res.audit.map(e => `<div class="note">${esc(fmtDate(e.created_at))} · ${esc(e.kind.replace(/_/g, ' '))}${e.data ? ' · ' + esc(Object.entries(e.data).map(([k, v]) => k + ': ' + v).join(', ')) : ''}</div>`).join('')}</div>` : ''}
      ${res.room.is_host ? `<div class="grid2" style="margin-top:12px"><button class="btn light" onclick="Auction.csv()">⬇️ CSV</button><button class="btn light" onclick="Auction.bonusSheet()">🎖️ Bonus points</button></div>` : ''}`;
  }
  A.scoreHelp = () => { const p = A.st.room.settings.points; sheet(`<h3>How the leaderboard works</h3><div class="small">Score = players bought × ${p.player} + roles covered (batter, keeper, all-rounder, bowler: 0-4) × ${p.balance} + coins left × ${p.coin} + bonus points from the host.<br><br>Spending the most coins does not win - a balanced squad does. The host set these weights when creating the room, and every bonus is written to the audit log.</div>`); };
  A.showTeam = id => { const t = A.res.teams.find(x => x.id === id); if (!t) return; sheet(`<h3>${esc(t.avatar)} ${esc(t.name)}</h3><div class="sub">${esc(t.owner)} · ${t.players} players · ${t.spent} spent · ${t.purse} left</div><div class="apl-cards">${t.squad.map(p => playerCard(p, p.price)).join('') || '<div class="muted small">No players</div>'}</div>`); };
  A.xiSheet = () => { const me = A.st.me, s = A.st.room.settings; A.xiPick = new Set(me.xi || []);
    const draw2 = () => sheet(`<h3>🏏 My playing XI</h3><div class="sub">Pick up to ${s.xi_size} (max ${Math.min(4, s.overseas_limit)} overseas) - ${A.xiPick.size} chosen</div><div class="plist">${A.st.roster.map(p => `<button class="pbtn ${A.xiPick.has(p.id) ? 'on' : ''}" onclick="Auction.xiToggle(${p.id})"><span class="chk">${A.xiPick.has(p.id) ? '✓' : ''}</span>${ROLE_ICON[p.role]} ${esc(p.name)}<span class="s">${esc(p.role)}${p.overseas ? ' ✈️' : ''}</span></button>`).join('')}</div><button class="btn block" onclick="Auction.xiSave()">Save XI</button>`);
    A.xiDraw = draw2; draw2(); };
  A.xiToggle = id => { if (A.xiPick.has(id)) A.xiPick.delete(id); else { if (A.xiPick.size >= A.st.room.settings.xi_size) return toast('XI is full', true); A.xiPick.add(id); } A.xiDraw(); };
  A.xiSave = () => run(async () => { await api('auc_xi', { id: A.st.room.id, xi: [...A.xiPick] }); closeSheet(); toast('Playing XI saved ✓'); await poll(); A.res = null; draw(true); loadResults(); });
  A.bonusSheet = () => sheet(`<h3>🎖️ Bonus points</h3><div class="sub">For things the computer can't judge - best team name, fair play, loudest cheer. Written to the audit log.</div><form onsubmit="event.preventDefault();Auction.bonusGo(this)">
    <div class="field"><label>Team</label><select class="input" name="participant_id">${A.res.teams.map(t => `<option value="${t.id}">${esc(t.name)} (now ${t.bonus})</option>`).join('')}</select></div>
    <div class="grid2"><div class="field"><label>Bonus (total)</label><input class="input" type="number" name="bonus" min="-100" max="100" value="0"></div><div class="field"><label>Reason</label><input class="input" name="note" maxlength="120" placeholder="e.g. best team name"></div></div><button class="btn block">Save</button></form>`);
  A.bonusGo = f => run(async () => { const d = formData(f); await api('auc_host', { id: A.st.room.id, do: 'bonus', participant_id: +d.participant_id, bonus: +d.bonus, note: d.note }); closeSheet(); A.res = null; await loadResults(); });

  /* ---------- my teams across auctions, gallery, rules, help ---------- */
  async function teams() {
    mount(topbar('My APL teams', { back: true }) + `<div class="content">${sk(3)}</div>`, 'more');
    const d = await api('auc_home', {});
    mount(topbar('My APL teams', { back: true }) + `<div class="content apl">${d.rooms.length ? `<div class="card flush list">${d.rooms.map(r => `<div class="item" onclick="go('#/apl/room/${esc(r.code)}')"><span class="avatar">🧢</span><div class="grow"><div class="t">${esc(r.team_name)}</div><div class="s">${esc(r.name)} · ${r.status}</div></div><span class="chev">${I.chev}</span></div>`).join('')}</div>` : '<div class="card empty"><div class="big">🧢</div>No teams yet - create or join an auction.</div>'}</div>`, 'more');
  }
  async function gallery() {
    A.g = A.g || { q: '', team: '', role: '', overseas: '' };
    mount(topbar('Player gallery', { back: true }) + `<div class="content">${sk(3)}</div>`, 'more');
    const d = await api('auc_gallery', A.g);
    mount(topbar('Player gallery', { back: true, sub: `${d.players.length} players` }) + `<div class="content apl">
      <div class="search">${I.search}<input class="input" placeholder="Search by name or country" value="${esc(A.g.q)}" onchange="Auction.g.q=this.value;Auction.gallery()"></div>
      <div class="row" style="margin-bottom:10px;gap:6px"><select class="input" onchange="Auction.g.team=this.value;Auction.gallery()"><option value="">All teams</option>${d.teams.map(t => `<option value="${t.short_name}" ${A.g.team === t.short_name ? 'selected' : ''}>${t.short_name}</option>`).join('')}</select>
        <select class="input" onchange="Auction.g.role=this.value;Auction.gallery()"><option value="">All roles</option>${d.roles.map(r => `<option ${A.g.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
        <select class="input" onchange="Auction.g.overseas=this.value;Auction.gallery()"><option value="">All</option><option value="0" ${A.g.overseas === '0' ? 'selected' : ''}>Indian</option><option value="1" ${A.g.overseas === '1' ? 'selected' : ''}>Overseas</option></select></div>
      <div class="apl-cards">${d.players.map(p => playerCard({ ...p, franchise_color: p.color }, undefined, `<div class="small muted">base ${p.base_price}</div>`)).join('')}</div>
      <div class="small muted" style="margin-top:10px">Squads come from the app's IPL teams (admin can edit them in Teams). Base prices are game settings, not real auction prices.</div></div>`, 'more');
  }
  function rules() {
    mount(topbar('Auction rules', { back: true }) + `<div class="content apl"><div class="card"><h3 style="margin:0 0 8px">📜 How the APL Auction works</h3><ol class="apl-ol">
      <li>Every team starts with the same purse of <b>virtual coins</b> (default 100). Coins only exist inside the game - no real money, ever.</li>
      <li>Players come up one at a time at their <b>base price</b>. The first bid is the base price; after that each bid must be at least one step higher (bigger steps at higher prices).</li>
      <li>A <b>timer</b> runs for every player (default 15 s). A new bid resets it. When it hits zero the player is <b>SOLD</b> to the highest bidder, the coins come off their purse, and the next player comes up automatically.</li>
      <li>No bids? The player is <b>UNSOLD</b> and comes back once at the end (host's choice).</li>
      <li>You can't bid more coins than you have, past your squad size, past the overseas limit, or when you already hold the highest bid.</li>
      <li>If two people bid at the same moment the server accepts whichever arrived first - the other sees "bid first" and can go again.</li>
      <li>The host can pause, resume, skip a player with no bids, bring a player forward, withdraw or reopen players, switch to <b>accelerated</b> mode (shorter timer), and end the auction. Accepted bids and sales can never be changed.</li>
      <li>The <b>leaderboard</b> rewards balanced squads: players bought, roles covered and coins left, plus any bonus points the host awards (all logged).</li>
      <li>After the auction each team picks a <b>playing XI</b> from their squad.</li></ol></div>
      <div class="small muted">Squads and roles come from Cric-Scorer's IPL teams. Team names and colours are inspired by the IPL; no official logos are used.</div></div>`, 'more');
  }
  function help() {
    mount(topbar('How to play', { back: true }) + `<div class="content apl"><div class="card"><h3 style="margin:0 0 8px">🎓 Five steps</h3><ol class="apl-ol">
      <li><b>Create</b> an auction (or <b>Join</b> one with the 8-letter code / invite link). Pick a team name, colour and avatar.</li>
      <li>Everyone opens the room on their own phone. The host taps <b>Start</b> when at least two teams are in.</li>
      <li>Watch the player card and the countdown. Tap the big <b>Bid</b> button to bid the next amount - or "Jump to" a higher one.</li>
      <li>Keep an eye on <b>My team</b>: coins left, slots and overseas count. Build a balanced squad - batters, a keeper, all-rounders and bowlers.</li>
      <li>When the hammer falls on the last player, see the <b>Results</b>, pick your playing XI, and share the CSV or a screenshot.</li></ol>
      <div class="small muted" style="margin-top:8px">Lost your connection? Just reopen the room - the auction kept running on the server and you'll see exactly where it is.</div></div>
      <div class="grid2"><button class="btn" onclick="go('#/apl/new')">＋ Create auction</button><button class="btn light" onclick="go('#/apl/join')">🔑 Join with code</button></div></div>`, 'more');
  }
  Object.assign(A, { home, create, join, room, teams, gallery, rules, help, stop });
  return A;
})();
