/* Cric-Scorer by Aaryush — mobile web app */
'use strict';

const App = {};
const S = { user: null, m: null, mTab: 'card', cardInn: null, timers: [], busy: false, deferredInstall: null, mtab: 'live', mine: false, teamCat: null, tTab: 'matches', statTab: 'runs' };
const $ = (s, el = document) => el.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const go = h => { if (location.hash === h) render(); else location.hash = h; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : (/(ch|sh|s|x)$/.test(w) ? 'es' : 's')}`;

/* ---------- Icons ---------- */
const sv = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  home: sv('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  ball: sv('<circle cx="12" cy="12" r="9"/><path d="M7 4.5c3 4 3 11 0 15M17 4.5c-3 4-3 11 0 15"/>'),
  team: sv('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14c3 0 5 2.2 5 5"/>'),
  trophy: sv('<path d="M8 4h8v5a4 4 0 01-8 0V4z"/><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4"/><path d="M12 13v4M8 21h8M9 17h6"/>'),
  more: sv('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'),
  back: sv('<path d="M15 18l-6-6 6-6"/>'),
  plus: sv('<path d="M12 5v14M5 12h14"/>'),
  search: sv('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  share: sv('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>'),
  dots: sv('<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>'),
  chev: sv('<path d="M9 6l6 6-6 6"/>'),
  edit: sv('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>'),
  refresh: sv('<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 5v6h-6"/>'),
  learn: sv('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/><path d="M22 9v6"/>'),
};
const LOGO = `<svg class="logo" viewBox="0 0 64 64" aria-label="Cric-Scorer logo"><rect width="64" height="64" rx="18" fill="#0d4a36"/><rect x="2" y="2" width="60" height="60" rx="16" fill="none" stroke="#b6e94a" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="3 3"/>
<g fill="#f6ecd2"><rect x="13" y="17" width="4.5" height="32" rx="2.2"/><rect x="21" y="17" width="4.5" height="32" rx="2.2"/><rect x="29" y="17" width="4.5" height="32" rx="2.2"/><rect x="12" y="13.5" width="10" height="3" rx="1.5"/><rect x="24.5" y="13.5" width="10" height="3" rx="1.5"/></g>
<circle cx="44" cy="40" r="12.5" fill="#d62839"/><path d="M36 31.5c5 5 5 12 0 17.5M52 31.5c-5 5-5 12 0 17.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-dasharray="2.2 2.2"/><circle cx="40" cy="35" r="3" fill="#fff" opacity=".25"/></svg>`;

/* ---------- Helpers ---------- */
function textOn(hex) {
  const h = String(hex || '#0d4a36').replace('#', '');
  const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#13241b' : '#ffffff';
}
function badge(t, cls = '') {
  if (!t) return '';
  return `<span class="badge ${cls}" style="background:${esc(t.color)};color:${textOn(t.color)}">${esc(String(t.short_name || t.name || '?').slice(0, 4))}</span>`;
}
const ROLE_ICON = { 'Batter': '🏏', 'Wicket-keeper': '🧤', 'All-rounder': '⭐', 'Bowler': '🎯' };
const roleIcon = r => ROLE_ICON[r] || '🏏';
function fmtDate(s, withTime = true) {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  if (isNaN(d)) return s;
  const o = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
  return d.toLocaleDateString('en-IN', o) + (withTime ? ', ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '');
}
function localDT(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const sk = n => '<div class="skeleton"></div>'.repeat(n);
function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked ? 1 : 0;
    else o[el.name] = el.value;
  }
  return o;
}

async function api(action, data = {}) {
  let r;
  try {
    r = await fetch('api.php?action=' + action, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CricScorer' },
      body: JSON.stringify(data),
    });
  } catch (e) { throw new Error('No internet connection. Please try again.'); }
  let j;
  try { j = await r.json(); } catch (e) { throw new Error('Server error (' + r.status + ')'); }
  if (r.status === 401 && !['me', 'login'].includes(action)) { S.user = null; S.after = location.hash; go('#/login'); }
  if (j.error) throw new Error(j.error);
  return j;
}
let toastTimer;
function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = '', 2600);
}
async function run(fn, btn) {
  try { if (btn) btn.disabled = true; return await fn(); }
  catch (e) { toast(e.message || 'Something went wrong', true); }
  finally { if (btn) btn.disabled = false; }
}

/* ---------- Shell ---------- */
function topbar(title, { back = false, actions = '', sub = '', refresh = true } = {}) {
  return `<header class="topbar">${back ? `<button class="icon-btn" aria-label="Back" onclick="App.back()">${I.back}</button>` : ''}
    <h1>${esc(title)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</h1>${refresh ? `<button class="icon-btn refresh-btn" aria-label="Refresh" onclick="App.refresh()">${I.refresh}</button>` : ''}${actions}</header>`;
}
let navDepth = -1;
App.back = () => { if (navDepth > 0) history.back(); else go('#/'); };
function mount(html, tab, { keepScroll = false } = {}) {
  const app = $('#app');
  const y = window.scrollY;
  app.innerHTML = html;
  app.classList.toggle('no-tabbar', !tab);
  renderTabbar(tab);
  window.scrollTo(0, keepScroll ? y : 0);
}
function renderTabbar(tab) {
  const bar = $('#tabbar');
  if (!tab || !S.user) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  const items = [['home', '#/', 'Home', I.home], ['matches', '#/matches', 'Matches', I.ball], ['learn', '#/learn', 'Learn', I.learn], ['teams', '#/teams', 'Teams', I.team], ['tournaments', '#/tournaments', 'Cups', I.trophy], ['more', '#/more', 'More', I.more]];
  bar.innerHTML = `<div class="wrap">${items.map(([k, h, l, ic]) => `<a href="${h}" class="${k === tab ? 'on' : ''}">${ic}<span>${l}</span><i class="pip"></i></a>`).join('')}</div>`;
}
function sheet(html, { locked = false } = {}) {
  $('#sheet-root').innerHTML = `<div class="sheet-bg" ${locked ? '' : 'onclick="closeSheet()"'}></div><div class="sheet" role="dialog"><div class="grab"></div>${html}</div>`;
}
function closeSheet() { $('#sheet-root').innerHTML = ''; }
function confirmSheet(title, text, label, fn, danger = true) {
  App._confirm = fn;
  sheet(`<h3>${esc(title)}</h3><div class="sub">${esc(text)}</div>
    <div class="grid2"><button class="btn light" onclick="closeSheet()">Cancel</button><button class="btn ${danger ? 'red' : ''}" onclick="App._confirm()">${esc(label)}</button></div>`);
}

/* ---------- Router ---------- */
const ROUTES = [
  [/^#\/login$/, viewLogin, true],
  [/^#\/register$/, viewRegister, true],
  [/^#\/?$/, viewHome],
  [/^#\/matches$/, viewMatches],
  [/^#\/match\/new(?:\?t=(\d+))?$/, viewMatchNew],
  [/^#\/match\/(\d+)$/, viewMatch, true],
  [/^#\/teams(?:\?c=(\w+))?$/, viewTeams],
  [/^#\/team\/new$/, () => viewTeamForm(null)],
  [/^#\/team\/(\d+)\/edit$/, viewTeamForm],
  [/^#\/team\/(\d+)$/, viewTeam],
  [/^#\/player\/(\d+)$/, viewPlayer],
  [/^#\/tournaments$/, viewTournaments],
  [/^#\/tournament\/new$/, () => viewTournamentForm(null)],
  [/^#\/tournament\/(\d+)\/edit$/, viewTournamentForm],
  [/^#\/tournament\/(\d+)$/, viewTournament],
  [/^#\/stats$/, viewStats],
  [/^#\/types$/, viewTypes],
  [/^#\/profile$/, viewProfile],
  [/^#\/more$/, viewMore],
  [/^#\/learn$/, () => academy('home')],
  [/^#\/learn\/lesson\/(\w+)$/, id => academy('lesson', id)],
  [/^#\/learn\/quiz\/(\w+)$/, id => academy('quiz', id)],
  [/^#\/learn\/certificate$/, () => academy('certificate')],
];
/* Cricket Academy code loads only when the Learn tab is first opened */
function loadAcademy() {
  if (window.Academy) return Promise.resolve();
  return new Promise((ok, bad) => {
    const s = document.createElement('script');
    s.src = 'assets/academy.js?v=' + (window.CS_VERSION || '');
    s.onload = ok; s.onerror = () => bad(new Error('Could not load the Academy. Check your connection.'));
    document.head.appendChild(s);
  });
}
async function academy(fn, ...args) {
  if (!window.Academy) mount(topbar('Cricket Academy') + `<div class="content">${sk(4)}</div>`, 'learn');
  await loadAcademy();
  return Academy[fn](...args);
}
function clearTimers() { S.timers.forEach(clearInterval); S.timers = []; }
async function render() {
  clearTimers(); closeSheet();
  const h = location.hash || '#/';
  for (const [re, fn, pub] of ROUTES) {
    const mm = h.match(re);
    if (!mm) continue;
    if (!pub && !S.user) { S.after = h; go('#/login'); return; }
    try { await fn(...mm.slice(1)); }
    catch (e) { mount(topbar('Oops', { back: true }) + `<div class="content"><div class="empty"><div class="big">🏏</div>${esc(e.message)}</div></div>`, S.user ? 'home' : null); }
    return;
  }
  go('#/');
}

/* ---------- Auth ---------- */
function authPage(inner) {
  return `<div class="auth">${LOGO}<h1>Cric-Scorer</h1><div class="tag">by Aaryush</div>${inner}<span class="seam">● ● ● LIVE CRICKET SCORING ● ● ●</span></div>`;
}
function viewLogin() {
  if (S.user) return go('#/');
  mount(authPage(`<form class="panel" onsubmit="App.login(event)"><h2>Welcome back! 👋</h2>
    <div class="field"><label>Username</label><input class="input" name="username" autocapitalize="none" autocomplete="username" required></div>
    <div class="field"><label>Password</label><input class="input" type="password" name="password" autocomplete="current-password" required></div>
    <button class="btn block">Let's play 🏏</button></form>
    <div class="switch-link">New player? <a href="#/register">Create an account</a></div>`), null);
}
function viewRegister() {
  if (S.user) return go('#/');
  mount(authPage(`<form class="panel" onsubmit="App.register(event)"><h2>Join the team 🏆</h2>
    <div class="field"><label>Your name</label><input class="input" name="display_name" placeholder="e.g. Aarush" required></div>
    <div class="field"><label>Username</label><input class="input" name="username" autocapitalize="none" autocomplete="username" placeholder="letters & numbers" required></div>
    <div class="field"><label>Password</label><input class="input" type="password" name="password" autocomplete="new-password" minlength="6" required></div>
    <div class="field"><label>Confirm password</label><input class="input" type="password" name="password2" autocomplete="new-password" required></div>
    <button class="btn block">Create account</button></form>
    <div class="switch-link">Already have an account? <a href="#/login">Log in</a></div>`), null);
}
App.login = e => {
  e.preventDefault();
  run(async () => { const r = await api('login', formData(e.target)); S.user = r.user; const a = S.after; S.after = null; go(a && a !== '#/login' ? a : '#/'); }, e.submitter);
};
App.register = e => {
  e.preventDefault();
  const f = formData(e.target);
  if (f.password !== f.password2) return toast('Passwords do not match', true);
  run(async () => { const r = await api('register', f); S.user = r.user; toast('Welcome, ' + r.user.display_name + '! 🎉'); go('#/'); }, e.submitter);
};
App.logout = () => run(async () => { await api('logout'); S.user = null; go('#/login'); });

/* ---------- Match card ---------- */
function matchCard(m) {
  const st = m.status === 'live' ? '<span class="pill live">Live</span>' : m.status === 'scheduled' ? '<span class="pill up">Upcoming</span>'
    : m.status === 'abandoned' ? '<span class="pill">No result</span>' : '<span class="pill done">Result</span>';
  const row = (t, sc) => `<div class="tm ${t && m.winner_team_id === t.id ? 'win' : ''}">${badge(t, 'sm')}<span class="n">${esc(t?.name)}</span><span class="sc">${esc(sc || '')}</span></div>`;
  const foot = m.result_text ? `<div class="foot">${esc(m.result_text)}</div>`
    : `<div class="foot m">${esc(fmtDate(m.match_date))}${m.venue ? ' · ' + esc(m.venue) : ''} · ${m.overs} ov</div>`;
  return `<div class="mcard ${m.status}" onclick="go('#/match/${m.id}')"><div class="top"><span class="ellipsis">${esc(m.title || 'Match')}</span>${st}</div>${row(m.team1, m.score1)}${row(m.team2, m.score2)}${foot}</div>`;
}

/* ---------- Home ---------- */
async function viewHome() {
  const name = S.user.display_name.split(' ')[0];
  const hour = new Date().getHours();
  const hi = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const hero = `<div class="hero"><div class="brand">${LOGO}<div class="grow"><b>Cric-Scorer</b><span>by Aaryush</span></div><button class="icon-btn refresh-btn" aria-label="Refresh" onclick="App.refresh()">${I.refresh}</button></div>
    <h2>${hi}, ${esc(name)}! 👋</h2><p>Ready to score today's big match?</p>
    <div class="cta"><button class="btn lime" onclick="go('#/match/new')">${I.plus} New Match</button><button class="btn ghost" onclick="go('#/tournaments')">${I.trophy} Tournaments</button></div></div>`;
  mount(hero + `<div class="content">${sk(3)}</div>`, 'home');
  const d = await api('home');
  const install = S.deferredInstall ? `<div class="install-banner"><span style="font-size:28px">📲</span><div class="grow"><b>Install Cric-Scorer</b><div class="small muted">Add it to your home screen like an app</div></div><button class="btn sm" onclick="App.install()">Install</button></div>` : '';
  const sec = (t, list, more, empty) => `<div class="section"><h2>${t}</h2>${more ? `<a href="${more}">See all</a>` : ''}</div>` + (list.length ? list.map(matchCard).join('') : (empty || ''));
  mount(hero + `<div class="stats-row"><div class="stat"><b>${d.counts.matches}</b><span>My matches</span></div><div class="stat"><b>${d.counts.teams}</b><span>My teams</span></div><div class="stat"><b>${d.counts.tournaments}</b><span>My cups</span></div></div>
    <div class="content">${install}
    ${d.live.length ? sec('🔴 Live now', d.live, '#/matches') : ''}
    ${d.upcoming.length ? sec('Up next', d.upcoming) : ''}
    ${sec('Recent results', d.recent, '#/matches', `<div class="card empty"><div class="big">🏏</div>No matches yet.<br>Tap <b>New Match</b> to score your first game!</div>`)}
    <div class="section"><h2>Explore</h2></div>
    <div class="tiles">
      <div class="tile" onclick="go('#/teams?c=ipl')"><span class="ic">🏟️</span>IPL Teams</div>
      <div class="tile" onclick="go('#/teams?c=international')"><span class="ic">🌍</span>International</div>
      <div class="tile" onclick="go('#/teams?c=custom')"><span class="ic">🧢</span>Our Teams</div>
      <div class="tile" onclick="go('#/stats')"><span class="ic">📊</span>Leaderboard</div>
      <div class="tile" style="grid-column:1/-1;background:linear-gradient(135deg,#fff7df,#ffeec2);color:#5b3d00" onclick="go('#/learn')"><span class="ic" style="background:#fff">🎓</span><div class="grow">Cricket Academy<div class="small" style="font-weight:700;opacity:.8">Lessons, quizzes & your certificate</div></div></div>
    </div></div>`, 'home');
}
App.install = async () => {
  if (!S.deferredInstall) return App.installHelp();
  S.deferredInstall.prompt();
  await S.deferredInstall.userChoice;
  S.deferredInstall = null; render();
};
App.installHelp = () => sheet(`<h3>Install as an app 📲</h3><div class="sub">Cric-Scorer works like a real app from your home screen.</div>
  ${S.deferredInstall ? `<button class="btn block" onclick="App.install()">Install now</button><div class="divider"></div>` : ''}
  <div class="card" style="box-shadow:none;border:1px solid var(--line)"><b>Android (Chrome)</b><div class="small muted">Tap the ⋮ menu → <b>Add to Home screen</b> (or <b>Install app</b>).</div></div>
  <div class="card" style="box-shadow:none;border:1px solid var(--line)"><b>iPhone / iPad (Safari)</b><div class="small muted">Tap the Share button → <b>Add to Home Screen</b>.</div></div>`);

/* ---------- Matches list ---------- */
async function viewMatches() {
  const tabs = [['live', 'Live'], ['scheduled', 'Upcoming'], ['completed', 'Completed']];
  mount(topbar('Matches') + `<div class="content"><div class="seg">${tabs.map(([k, l]) => `<button class="${S.mtab === k ? 'on' : ''}" onclick="S.mtab='${k}';render()">${l}</button>`).join('')}</div>
    <label class="switch" style="margin-bottom:12px"><span><b>Only my matches</b></span><input type="checkbox" ${S.mine ? 'checked' : ''} onchange="S.mine=this.checked;render()"><span class="knob"></span></label>
    <div id="ml">${sk(3)}</div></div><button class="fab" aria-label="New match" onclick="go('#/match/new')">${I.plus}</button>`, 'matches');
  const d = await api('matches_list', { status: S.mtab, mine: S.mine ? 1 : 0 });
  $('#ml').innerHTML = d.matches.length ? d.matches.map(matchCard).join('')
    : `<div class="card empty"><div class="big">${S.mtab === 'live' ? '📡' : S.mtab === 'scheduled' ? '📅' : '🏁'}</div>No ${S.mtab === 'scheduled' ? 'upcoming' : S.mtab} matches.</div>`;
}

/* ---------- New match ---------- */
function teamOptions(teams, selected, only = null) {
  let list = teams;
  if (only) list = teams.filter(t => only.includes(t.id));
  const groups = [['My teams', t => t.category === 'custom' && t.mine], ['Other custom teams', t => t.category === 'custom' && !t.mine], ['IPL', t => t.category === 'ipl'], ['International', t => t.category === 'international']];
  let html = '<option value="">— Choose team —</option>';
  for (const [label, f] of groups) {
    const g = list.filter(f);
    if (g.length) html += `<optgroup label="${label}">${g.map(t => `<option value="${t.id}" ${+selected === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>`;
  }
  return html;
}
async function viewMatchNew(tid) {
  mount(topbar('New Match', { back: true }) + `<div class="content">${sk(4)}</div>`, 'matches');
  const [ty, tm, to] = await Promise.all([api('types_list'), api('teams_list'), api('tournaments_list')]);
  let tour = null;
  if (tid) tour = await api('tournament_get', { id: +tid });
  S.nm = { types: ty.types, teams: tm.teams, only: tour ? tour.teams.map(t => +t.id) : null };
  const typeId = tour?.tournament.match_type_id || (ty.types.find(t => t.name === 'T20') || ty.types[0]).id;
  const t = ty.types.find(x => x.id === +typeId) || ty.types[0];
  const myTours = to.tournaments.filter(x => x.mine);
  mount(topbar(tour ? 'Add Match' : 'New Match', { back: true, sub: tour ? tour.tournament.name : '' }) + `<form class="content" onsubmit="App.createMatch(event)">
    <div class="card"><div class="vs" id="vs"></div>
      <div class="field"><label>Team A</label><select class="input" name="team1_id" onchange="App.vsPreview()" required>${teamOptions(tm.teams, null, S.nm.only)}</select></div>
      <div class="field" style="margin-bottom:4px"><label>Team B</label><select class="input" name="team2_id" onchange="App.vsPreview()" required>${teamOptions(tm.teams, null, S.nm.only)}</select></div>
      ${tour ? '' : `<div class="small muted" style="margin-top:6px">Want your own team? <a class="link" href="#/team/new">Create a team</a></div>`}</div>
    <div class="section"><h2>Match type</h2></div>
    <div class="chips" id="typechips">${ty.types.map(x => `<button type="button" class="chip ${x.id === t.id ? 'on' : ''}" data-id="${x.id}" onclick="App.pickType(${x.id})">${esc(x.name)} <small>${x.overs}ov</small></button>`).join('')}</div>
    <div class="card" style="margin-top:10px">
      <div class="grid3"><div class="field"><label>Overs</label><input class="input" type="number" name="overs" min="1" max="100" value="${t.overs}"></div>
      <div class="field"><label>Players</label><input class="input" type="number" name="players_per_side" min="1" max="15" value="${t.players_per_side}"></div>
      <div class="field"><label>Max ov/bowler</label><input class="input" type="number" name="max_overs_bowler" min="0" max="50" value="${t.max_overs_bowler}"></div></div>
      <input type="hidden" name="balls_per_over" value="${t.balls_per_over}"><input type="hidden" name="match_type_id" value="${t.id}">
      <label class="switch"><span><b>Last man stands</b><div class="small muted">Last batter can bat alone</div></span><input type="checkbox" name="last_man_stands" ${t.last_man_stands ? 'checked' : ''}><span class="knob"></span></label>
      <div class="small muted" style="margin-top:8px">Max overs per bowler: 0 = no limit.</div></div>
    <div class="section"><h2>Details</h2></div>
    <div class="card">
      <div class="field"><label>Match title</label><input class="input" name="title" placeholder="e.g. Sunday Showdown" value="${tour ? 'Match ' + (tour.matches.length + 1) : ''}"></div>
      <div class="field"><label>Venue</label><input class="input" name="venue" placeholder="e.g. Society ground" value="${esc(tour?.tournament.venue || '')}"></div>
      <div class="field"><label>Date & time</label><input class="input" type="datetime-local" name="match_date" value="${localDT()}"></div>
      ${tour ? `<input type="hidden" name="tournament_id" value="${tour.tournament.id}">` : myTours.length ? `<div class="field"><label>Tournament (optional)</label><select class="input" name="tournament_id"><option value="">— None (friendly) —</option>${myTours.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>` : ''}
    </div>
    <button class="btn block" style="margin:6px 0 20px">Create match →</button></form>`, 'matches');
  App.vsPreview();
}
App.pickType = id => {
  const t = S.nm.types.find(x => x.id === id); const f = $('form.content');
  f.overs.value = t.overs; f.players_per_side.value = t.players_per_side; f.max_overs_bowler.value = t.max_overs_bowler;
  f.balls_per_over.value = t.balls_per_over; f.match_type_id.value = t.id; f.last_man_stands.checked = !!t.last_man_stands;
  document.querySelectorAll('#typechips .chip').forEach(c => c.classList.toggle('on', +c.dataset.id === id));
};
App.vsPreview = () => {
  const f = $('form.content'); const find = id => S.nm.teams.find(t => t.id === +id);
  const a = find(f.team1_id.value), b = find(f.team2_id.value);
  const side = t => `<div class="side">${t ? badge(t, 'lg') : '<span class="badge lg" style="background:var(--soft);color:var(--muted)">?</span>'}<span>${esc(t?.name || 'Pick a team')}</span></div>`;
  $('#vs').innerHTML = side(a) + '<div class="v">VS</div>' + side(b);
};
App.createMatch = e => {
  e.preventDefault();
  const f = formData(e.target);
  if (f.team1_id === f.team2_id) return toast('Pick two different teams', true);
  run(async () => { const r = await api('match_create', f); S.m = null; go('#/match/' + r.id); }, e.submitter);
};

/* =====================================================================
   MATCH SCREEN — setup, live scoring, scorecard
   ===================================================================== */
async function viewMatch(id) {
  id = +id;
  if (!S.m || S.m.match.id !== id) {
    S.mTab = 'card'; S.cardInn = null; S.squads = null; S.toss = {}; S.op = {};
    mount(topbar('Match', { back: true }) + `<div class="content">${sk(3)}</div>`, S.user ? 'matches' : null);
  }
  S.m = await api('match_get', { id });
  drawMatch(true);
  if (S.m.match.status === 'live' && !S.m.can_edit) {
    S.timers.push(setInterval(async () => {
      if (document.hidden || location.hash !== '#/match/' + id) return;
      try { const prev = S.m; S.m = await api('match_get', { id }); drawMatch(false); announce(prev, S.m); } catch (e) { /* keep last */ }
    }, 6000));
  }
}
const curInn = () => S.m.innings[S.m.innings.length - 1];
const teamById = id => (S.m.team1.id === id ? S.m.team1 : S.m.team2);
function pname(id) {
  for (const k in S.m.xi) { const p = S.m.xi[k].find(x => x.id === id); if (p) return p.name; }
  return '?';
}
function ballChip(label) {
  let c = '';
  if (label.includes('W')) c = 'w';
  else if (label === '4') c = 'b4';
  else if (label === '6') c = 'b6';
  else if (/wd|nb|lb|b|RH/.test(label)) c = 'ex';
  else if (label === '0') c = 'dot';
  return `<span class="ball ${c}">${label === '0' ? '•' : esc(label)}</span>`;
}

function drawMatch(first) {
  const st = S.m, m = st.match, t1 = st.team1, t2 = st.team2;
  const editing = st.can_edit && st.needs !== 'completed';
  const actions = `<button class="icon-btn" id="spk" aria-label="Sound and commentary" onclick="App.soundSheet()">${spkIcon()}</button><button class="icon-btn" aria-label="Share" onclick="App.shareMatch()">${I.share}</button>` +
    (st.can_edit ? `<button class="icon-btn" aria-label="Match options" onclick="App.matchMenu()">${I.dots}</button>` :
      '');
  const sub = [m.title, m.tournament?.name].filter(Boolean).join(' · ');
  let html = topbar(`${t1.short_name} vs ${t2.short_name}`, { back: true, actions, sub });
  const inn = st.innings.length ? curInn() : null;
  html += inn ? scoreBoard(st, inn) : preBoard(st);

  if (st.needs === 'completed') html += resultCard(st);
  else if (st.can_edit) {
    if (st.needs === 'players') html += xiSetup();
    else if (st.needs === 'toss') html += tossSetup();
    else if (st.needs === 'openers') html += openersSetup();
    else html += `<div style="padding:0 0 0">${creasePanel(st, inn)}</div><div class="content" style="padding-top:0">${scorePad()}</div>`;
  } else {
    if (!inn) html += `<div class="content"><div class="card empty"><div class="big">⏳</div>The match hasn't started yet.<br>${m.toss_winner_id ? esc(teamById(m.toss_winner_id).name) + ' won the toss and chose to ' + m.toss_decision + '.' : 'Waiting for the toss.'}</div></div>`;
    else if (st.needs === 'openers') html += `<div class="content"><div class="card empty"><div class="big">☕</div>Innings break</div></div>`;
    else html += creasePanel(st, inn) + (m.status === 'live' ? `<div class="content" style="padding-top:0"><button class="btn light block" onclick="App.soundSheet()">🔊 Live commentary & crowd sounds</button></div>` : '');
  }
  if (st.innings.length) html += matchTabs(st);
  const stage = ['ball', 'new_batter', 'new_bowler'].includes(st.needs) ? 'live' : st.needs;
  const sameStage = S.lastStage === stage + ':' + m.id;
  S.lastStage = stage + ':' + m.id;
  mount(html, editing && stage === 'live' ? null : (S.user ? 'matches' : null), { keepScroll: !first && sameStage });
  if (st.can_edit) {
    if (st.needs === 'new_batter') batterSheet();
    else if (st.needs === 'new_bowler') App.bowlerSheet(false);
  }
}

function preBoard(st) {
  const m = st.match;
  const side = t => `<div class="side">${badge(t, 'lg')}<span>${esc(t.name)}</span></div>`;
  return `<div class="board"><div class="vs">${side(st.team1)}<div class="v" style="color:var(--lime)">VS</div>${side(st.team2)}</div>
    <div class="other" style="text-align:center">${m.overs} overs · ${m.players_per_side} a side${m.last_man_stands ? ' · Last man stands' : ''}${m.max_overs_bowler ? ` · ${m.max_overs_bowler} ov/bowler` : ''}</div>
    <div class="other" style="text-align:center">${esc(fmtDate(m.match_date))}${m.venue ? ' · ' + esc(m.venue) : ''}</div></div>`;
}

function scoreBoard(st, inn) {
  const m = st.match, bt = teamById(inn.batting_team_id);
  const first = st.innings.length === 2 ? st.innings[0] : null;
  let meta = `<span><i>CRR</i> ${Number(inn.crr).toFixed(2)}</span>`;
  if (inn.target) meta += `<span><i>Target</i> ${inn.target}${inn.dls ? ' <b class="dls-tag">DLS</b>' : ''}</span>` + (inn.status === 'live' ? `<span><i>RRR</i> ${Number(inn.rrr).toFixed(2)}</span>` : '');
  else if (inn.status === 'live') meta += `<span><i>Projected</i> ${inn.projected}</span>`;
  if (inn.no === 2 && inn.status === 'live' && st.dls && st.dls.par !== undefined && st.dls.active) meta += `<span><i>DLS par</i> ${st.dls.par}</span>`;
  if (inn.extras) meta += `<span><i>Extras</i> ${inn.extras}</span>`;
  let need = '';
  if (m.result_text) need = `<div class="need">🏆 ${esc(m.result_text)}</div>`;
  else if (inn.target && inn.status === 'live') need = `<div class="need">${esc(bt.name)} need ${plural(inn.need, 'run')} from ${plural(inn.balls_left, 'ball')}</div>`;
  else if (inn.no === 1 && inn.status === 'completed') need = `<div class="need">Innings break · ${esc(teamById(inn.bowling_team_id).name)} need ${inn.runs + 1} to win</div>`;
  const toss = m.toss_winner_id ? `${teamById(m.toss_winner_id).name} won the toss & chose to ${m.toss_decision}` : '';
  return `<div class="board"><div class="bt">${badge(bt, 'sm')}<span class="grow ellipsis">${esc(bt.name)}</span><span class="pill">${inn.no === 1 ? '1st' : '2nd'} innings</span></div>
    <div class="score"><b>${inn.runs}/${inn.wickets}</b><span>(${inn.overs}/${inn.max_overs} ov)</span></div>
    <div class="meta">${meta}</div>${need}
    ${first ? `<div class="other">${esc(teamById(first.batting_team_id).name)}: ${first.runs}/${first.wickets} (${first.overs} ov)</div>` : `<div class="other">${esc(toss)}</div>`}</div>`;
}

function thisOverBalls(st, inn) {
  const bpo = st.match.balls_per_over;
  let cur = Math.floor(inn.legal_balls / bpo);
  if (inn.legal_balls > 0 && inn.legal_balls % bpo === 0 && (!inn.bowler_id || inn.status === 'completed')) cur--;
  return { cur, balls: inn.timeline.filter(b => b.over_no === cur) };
}

function creasePanel(st, inn) {
  const batRow = id => {
    const b = inn.batting.find(x => x.id === id) || { name: pname(id), r: 0, b: 0, f4: 0, f6: 0, sr: 0 };
    return `<tr onclick="go('#/player/${id}')"><td>${id === inn.striker_id ? '<span class="on-strike">●</span> ' : ''}${esc(b.name)}</td><td><b>${b.r}</b></td><td>${b.b}</td><td>${b.f4}</td><td>${b.f6}</td><td>${b.sr}</td></tr>`;
  };
  const bats = [inn.striker_id, inn.non_striker_id].filter(Boolean);
  const bw = inn.bowling.find(x => x.id === inn.bowler_id);
  const { cur, balls } = thisOverBalls(st, inn);
  const p = inn.partnership;
  return `<div class="crease">
    <table><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>
      ${bats.length ? bats.map(batRow).join('') : '<tr><td colspan="6" class="muted">Waiting for batters…</td></tr>'}
      <tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr>
      ${inn.bowler_id ? `<tr class="bowl"><td>${esc(bw ? bw.name : pname(inn.bowler_id))}</td><td>${bw ? bw.o : '0.0'}</td><td>${bw ? bw.m : 0}</td><td>${bw ? bw.r : 0}</td><td><b>${bw ? bw.w : 0}</b></td><td>${bw ? bw.econ : '0.00'}</td></tr>` : '<tr class="bowl"><td colspan="6" class="muted">New over — choose the bowler</td></tr>'}
    </table>
    <div class="over-strip"><span class="lbl">Over ${cur + 1}</span>${lastBallBadge(st, inn)}${balls.length ? balls.map(b => ballChip(b.label)).join('') : '<span class="muted small">No balls yet</span>'}</div>
    <div class="partner"><span>Partnership: <b>${p.runs}</b> (${p.balls})</span><span>${inn.status === 'live' ? `${inn.max_overs * st.match.balls_per_over - inn.legal_balls} balls left` : 'Innings over'}</span></div></div>`;
}

function lastBallBadge(st, inn) {
  const bpo = st.match.balls_per_over, total = inn.max_overs * bpo;
  if (inn.status !== 'live' || !inn.bowler_id || inn.legal_balls % bpo !== bpo - 1) return '';
  return `<span class="pill live" style="flex:none;margin-right:4px">${inn.legal_balls === total - 1 ? 'Last ball of innings' : 'Last ball'}</span>`;
}
function scorePad() {
  return `<div class="pad">
    ${[0, 1, 2, 3].map(r => `<button onclick="App.ball(${r})">${r}</button>`).join('')}
    <button class="four" onclick="App.ball(4)">4</button><button class="six" onclick="App.ball(6)">6</button>
    <button class="ext" onclick="App.extraSheet('wd')">WD</button><button class="ext" onclick="App.extraSheet('nb')">NB</button>
    <button class="ext" onclick="App.extraSheet('b')">BYE</button><button class="ext" onclick="App.extraSheet('lb')">LB</button>
    <button class="undo" onclick="App.undo()">↶ Undo</button><button class="out" onclick="App.wicketSheet(null)">OUT</button></div>
    <div class="pad-tools"><button onclick="App.swap()">⇄ Swap ends</button><button onclick="App.bowlerSheet(true)">🔁 Bowler</button>
    <button onclick="App.moreRuns()">5 / 7 runs</button><button onclick="App.retireSheet()">🩹 Retire</button></div>
    <div class="pad-tools"><button onclick="App.readScore()">🎙️ Read score</button><button onclick="App.soundSheet()">${Sound.sfx || Sound.voice ? '🔊' : '🔇'} Sound & voice</button></div>`;
}

/* ----- scoring actions ----- */
async function scoreAction(action, data = {}) {
  if (S.busy) return;
  S.busy = true;
  const before = S.m;
  try {
    S.m = await api(action, { id: S.m.match.id, ...data });
    closeSheet();
    celebrate(before, S.m, action);
    drawMatch(false);
    if (navigator.vibrate) navigator.vibrate(12);
    return true;
  } catch (e) { toast(e.message, true); return false; }
  finally { S.busy = false; }
}
App.ball = (runs, extra = null, wicket = null) => scoreAction('match_ball', { runs, extra, wicket });
App.swap = () => scoreAction('match_swap');
App.undo = () => { Sound.stopVoice(); return scoreAction('match_undo').then(() => toast('Last action undone')); };
App.setBatter = id => scoreAction('match_batter', { player_id: id });
App.setBowler = id => scoreAction('match_bowler', { player_id: id });

function celebrate(before, after, action) {
  if (action === 'match_ball' || action === 'match_end_innings') announce(before, after);
}

/* Pop-ups, stadium sounds and spoken commentary for each new ball */
function announce(before, after) {
  const inns = after.innings;
  if (!inns.length) return;
  const inn = inns[inns.length - 1];
  const bi = before ? before.innings.find(i => i.no === inn.no) : null;
  const newBall = inn.timeline.length > (bi ? bi.timeline.length : 0);
  const finished = after.match.status === 'completed' && before && before.match.status !== 'completed';
  const inningsOver = inn.status === 'completed' && bi && bi.status === 'live';
  if (!newBall && !finished && !inningsOver) return;
  const team = (after.team1.id === inn.batting_team_id ? after.team1 : after.team2);
  const b = newBall ? inn.timeline[inn.timeline.length - 1] : null;
  const say = []; let fx = null;
  if (b) {
    const outBat = b.out_id ? inn.batting.find(x => x.id === b.out_id) : null;
    const d = { bat: b.bat, bowl: b.bowl, fld: b.fld || 'the fielder', out: b.out, r: outBat ? outBat.r : 0 };
    if (b.w) {
      fx = ['bowled', 'hit wicket'].includes(b.wt) ? 'bowled' : 'out';
      const key = b.wt === 'caught' && b.fld && b.fld === b.bowl ? 'caught&' : b.wt;
      popup('OUT!', `${b.out} ${outBat ? outBat.r + ' (' + outBat.b + ')' : ''}`, 'w', '☝️');
      say.push(Sound.line(key, d));
      say.push(`${team.name} are ${inn.runs} for ${inn.wickets}.`);
    } else if (b.wt === 'retired hurt') {
      say.push(`${b.out} retires hurt.`);
    } else if (b.ex === 'wd') {
      fx = 'wide'; say.push(Sound.line('wide'));
    } else if (b.ex === 'nb') {
      fx = b.rb === 6 ? 'six' : b.rb === 4 ? 'four' : 'wide';
      say.push(Sound.line('noball'));
      if (b.rb === 6) { popup('SIX!', b.bat + ' · off a no-ball', 'b6', '🚀'); say.push(Sound.line('six', d)); }
      else if (b.rb === 4) { popup('FOUR!', b.bat + ' · off a no-ball', 'b4', '🏏'); say.push(Sound.line('four', d)); }
    } else if (b.ex === 'b' || b.ex === 'lb') {
      fx = 'run'; say.push(`${b.xr} ${b.ex === 'b' ? 'bye' : 'leg bye'}${b.xr > 1 ? 's' : ''}.`);
    } else if (b.rb === 6) {
      fx = 'six'; popup('SIX!', b.bat, 'b6', '🚀'); say.push(Sound.line('six', d));
    } else if (b.rb === 4) {
      fx = 'four'; popup('FOUR!', b.bat, 'b4', '🏏'); say.push(Sound.line('four', d));
    } else if (b.rb === 0) {
      fx = 'dot'; if (Math.random() < 0.6) say.push(Sound.line('dot', d));
    } else {
      fx = 'run'; say.push(Sound.line('run' + b.rb, d) || `${b.rb} runs.`);
    }
    // Batting milestones
    const nb = inn.batting.find(x => x.name === b.bat), ob = bi && bi.batting.find(x => x.name === b.bat);
    if (nb && ob) {
      const ms = [100, 50].find(v => ob.r < v && nb.r >= v);
      if (ms) {
        setTimeout(() => { popup(ms === 100 ? 'CENTURY!' : 'FIFTY!', `${b.bat} · ${nb.r} (${nb.b})`, 'ms', ms === 100 ? '💯' : '⭐'); Sound.fx('milestone'); confetti(); }, 1700);
        say.push(Sound.line(ms === 100 ? 'hundred' : 'fifty', d));
      }
    }
    // Close finish tension
    if (inn.target && inn.status === 'live' && inn.need > 0 && inn.need <= 12 && inn.balls_left > 1) say.push(`${inn.need} needed from ${inn.balls_left} ${inn.balls_left === 1 ? 'ball' : 'balls'}!`);
    // Last ball of the over / innings coming up
    const bpo = after.match.balls_per_over, total = inn.max_overs * bpo;
    if (inn.status === 'live' && after.needs === 'ball' && inn.legal_balls % bpo === bpo - 1) {
      const lastOfInnings = inn.legal_balls === total - 1;
      if (inn.target && lastOfInnings) say.push(inn.need === 1 ? 'One run needed off the last ball!' : `${inn.need} needed off the very last ball!`);
      else if (lastOfInnings) say.push('Here comes the last ball of the innings!');
      else say.push(b.ex === 'wd' || b.ex === 'nb' ? 'Still the last ball of the over to come.' : 'Last ball of the over.');
    }
    // End of over summary
    if (after.needs === 'new_bowler' && before && before.needs === 'ball' && inn.status === 'live') {
      const o = inn.overs_list[inn.overs_list.length - 1];
      if (o) toast(`End of over ${o.over}: ${plural(o.runs, 'run')}${o.wkts ? ', ' + plural(o.wkts, 'wicket') : ''}`);
      say.push(`End of the over. ${team.name} ${inn.runs} for ${inn.wickets}.` + (inn.target ? ` They need ${inn.need} from ${inn.balls_left} balls.` : ''));
    }
  }
  if (inningsOver && inn.no === 1) {
    toast('Innings over! ' + inn.runs + '/' + inn.wickets);
    fx = fx === 'six' || fx === 'four' || fx === 'bowled' || fx === 'out' ? fx : 'cheer';
    setTimeout(() => Sound.fx('cheer'), 1200);
    say.push(`That's the end of the innings. ${team.name} finish on ${inn.runs} for ${inn.wickets} in ${String(inn.overs).replace(/\.0$/, '')} ${String(inn.overs).replace(/\.0$/, '') === '1' ? 'over' : 'overs'}. The target is ${inn.runs + 1}.`);
  }
  if (finished) {
    confetti();
    setTimeout(() => { popup('WINNER!', after.match.result_text || '', 'ms', '🏆'); Sound.fx('win'); }, b && (b.rb >= 4 || b.w) ? 1500 : 200);
    say.push(`${after.match.result_text}! ` + (after.match.player_of_match ? `Player of the match is ${after.match.player_of_match.name}. ` : '') + 'What a game!');
  }
  Sound.fx(fx);
  Sound.say(say.filter(Boolean).join(' '));
}
function popup(text, sub, cls, emoji) {
  document.querySelectorAll('.burst').forEach(x => x.remove());
  const d = document.createElement('div');
  d.className = 'burst ' + cls;
  d.innerHTML = `<div class="pop"><div class="emo">${emoji || ''}</div><span>${esc(text)}</span>${sub ? `<div class="psub">${esc(sub)}</div>` : ''}</div>`;
  document.body.appendChild(d); setTimeout(() => d.remove(), 1700);
}
function scoreReadout(st) {
  if (!st.innings.length) return `${st.team1.name} versus ${st.team2.name}. The match has not started yet.`;
  const inn = st.innings[st.innings.length - 1], m = st.match;
  const team = teamById(inn.batting_team_id);
  if (m.result_text) return `${m.result_text}.`;
  const ov = String(inn.overs).replace(/\.0$/, '');
  const parts = [`${team.name} are ${inn.runs} for ${inn.wickets} after ${ov} ${ov === '1' ? 'over' : 'overs'}.`];
  for (const id of [inn.striker_id, inn.non_striker_id].filter(Boolean)) {
    const b = inn.batting.find(x => x.id === id);
    if (b) parts.push(`${b.name} on ${b.r} off ${b.b} ${b.b === 1 ? 'ball' : 'balls'}.`);
  }
  const bw = inn.bowling.find(x => x.id === inn.bowler_id);
  if (bw) parts.push(`${bw.name} has ${bw.w} for ${bw.r}.`);
  if (inn.target && inn.status === 'live') parts.push(`They need ${inn.need} runs from ${inn.balls_left} balls.`);
  else if (inn.status === 'live' && inn.legal_balls) parts.push(`Run rate ${Number(inn.crr).toFixed(1)}.`);
  return parts.join(' ');
}
const SPK = sv('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11"/>');
const SPK_OFF = sv('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 5M22 9l-5 5"/>');
const spkIcon = () => (Sound.sfx || Sound.voice ? SPK : SPK_OFF);
App.soundSheet = () => {
  Sound.unlock();
  const sw = (label, sub, on, fn) => `<label class="switch" style="margin-bottom:10px"><span><b>${label}</b><div class="small muted">${sub}</div></span><input type="checkbox" ${on ? 'checked' : ''} onchange="${fn}(this.checked)"><span class="knob"></span></label>`;
  sheet(`<h3>Sound & commentary 🔊</h3><div class="sub">Stadium sounds and a live commentator for every ball.</div>
    ${sw('Sound effects', 'Bat sound, crowd cheering, clapping, stumps', Sound.sfx, 'App.setSfx')}
    ${Sound.hasSpeech ? sw('Commentary voice', 'Reads out every ball and the score', Sound.voice, 'App.setVoice') : '<div class="notice">This browser has no text-to-speech voice.</div>'}
    ${S.m && location.hash.startsWith('#/match/') ? `<button class="btn block" onclick="App.readScore()">🎙️ Read the score now</button>` : ''}
    <div class="grid3" style="margin-top:10px"><button class="btn sm light" onclick="App.testFx('four')">Test 4</button><button class="btn sm light" onclick="App.testFx('six')">Test 6</button><button class="btn sm light" onclick="App.testFx('bowled')">Test OUT</button></div>
    <div class="small muted" style="margin-top:10px">Tip: turn up the phone volume and switch off silent mode. On iPhone, the ring/silent switch must be off for sound.</div>`);
};
App.setSfx = v => { Sound.setSfx(v); refreshSpk(); };
App.setVoice = v => { Sound.setVoice(v); refreshSpk(); if (v) Sound.say('Commentary is on. Let\'s play!', { delay: 50 }); };
App.readScore = () => { Sound.unlock(); if (!Sound.voice) { Sound.setVoice(true); refreshSpk(); } Sound.say(scoreReadout(S.m), { delay: 50 }); };
App.testFx = k => {
  Sound.unlock();
  const t = { four: ['FOUR!', 'b4', '🏏', 'four'], six: ['SIX!', 'b6', '🚀', 'six'], bowled: ['OUT!', 'w', '☝️', 'bowled'] }[k];
  closeSheet(); popup(t[0], 'Test', t[1], t[2]); Sound.fx(k); Sound.say(Sound.line(t[3], { bat: 'Aarush', bowl: 'Aayush', out: 'Aarush', fld: 'Aayush', r: 50 }));
};
function refreshSpk() { const b = document.getElementById('spk'); if (b) b.innerHTML = spkIcon(); }
function confetti() {
  const em = ['🎉', '🏆', '⭐', '🏏', '🎊', '✨'];
  for (let i = 0; i < 36; i++) {
    const s = document.createElement('span');
    s.className = 'confetti'; s.textContent = em[i % em.length];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.animationDuration = (2 + Math.random() * 2.5) + 's';
    s.style.animationDelay = (Math.random() * .8) + 's';
    document.body.appendChild(s); setTimeout(() => s.remove(), 5500);
  }
}

App.extraSheet = type => {
  const cfg = {
    wd: ['Wide ball', 'Extra runs the batters ran (the wide itself adds 1)', [0, 1, 2, 3, 4], 'Wide + stumped / run out'],
    nb: ['No ball', 'Runs scored off the bat (the no-ball adds 1)', [0, 1, 2, 3, 4, 6], 'No ball + run out'],
    b: ['Byes', 'Runs taken', [1, 2, 3, 4], 'Byes + run out'],
    lb: ['Leg byes', 'Runs taken', [1, 2, 3, 4], 'Leg byes + run out'],
  }[type];
  sheet(`<h3>${cfg[0]}</h3><div class="sub">${cfg[1]}</div>
    <div class="opts">${cfg[2].map(r => `<button onclick="App.ball(${r},'${type}')">${(type === 'wd' || type === 'nb') ? '+' + r : r}</button>`).join('')}</div>
    <button class="btn light block" onclick="App.wicketSheet('${type}')">${cfg[3]}</button>`);
};
App.moreRuns = () => sheet(`<h3>More runs</h3><div class="sub">Overthrows or all-run boundaries</div><div class="opts">${[5, 7].map(r => `<button onclick="App.ball(${r})">${r}</button>`).join('')}</div>`);

App.wicketSheet = extra => { const inn = curInn(); S.w = { extra, type: null, fielder: null, dismissed: inn.striker_id, runs: 0 }; drawWicket(); };
App.wSet = (k, v) => { S.w[k] = v; drawWicket(); };
function drawWicket() {
  const st = S.m, inn = curInn(), w = S.w;
  let types = [['bowled', 'Bowled'], ['caught', 'Caught'], ['lbw', 'LBW'], ['run out', 'Run out'], ['stumped', 'Stumped'], ['hit wicket', 'Hit wicket']];
  if (w.extra === 'wd') types = types.filter(t => ['stumped', 'run out', 'hit wicket'].includes(t[0]));
  if (['nb', 'b', 'lb'].includes(w.extra)) types = types.filter(t => t[0] === 'run out');
  if (!w.type && types.length === 1) w.type = types[0][0];
  const chip = (label, fn, on) => `<button class="chip ${on ? 'on' : ''}" onclick="${fn}">${esc(label)}</button>`;
  const exName = { wd: 'wide', nb: 'no ball', b: 'bye', lb: 'leg bye' }[w.extra];
  let h = `<h3>Wicket! ☝️</h3><div class="sub">${exName ? 'Out on a ' + exName : 'How did the batter get out?'}</div>
    <div class="chips wrap">${types.map(([k, l]) => chip(l, `App.wSet('type','${k}')`, w.type === k)).join('')}</div>`;
  if (w.type === 'run out') {
    h += `<div class="field" style="margin-top:14px"><label>Who is run out?</label><div class="chips wrap">${[inn.striker_id, inn.non_striker_id].filter(Boolean).map(id => chip(pname(id) + (id === inn.striker_id ? ' (striker)' : ''), `App.wSet('dismissed',${id})`, w.dismissed === id)).join('')}</div></div>
      <div class="field"><label>${w.extra === 'nb' ? 'Runs off the bat' : 'Runs completed'} before the run out</label><div class="chips wrap">${[0, 1, 2, 3].map(r => chip(String(r), `App.wSet('runs',${r})`, w.runs === r)).join('')}</div></div>`;
  }
  if (['caught', 'run out', 'stumped'].includes(w.type)) {
    const label = w.type === 'caught' ? 'Caught by' : w.type === 'stumped' ? 'Stumped by (keeper)' : 'Run out by (optional)';
    h += `<div class="field" style="margin-top:14px"><label>${label}</label><div class="chips wrap">${st.xi[inn.bowling_team_id].map(p => chip((p.role === 'Wicket-keeper' ? '🧤 ' : '') + p.name + (p.id === inn.bowler_id ? ' (bowler)' : ''), `App.wSet('fielder',${p.id})`, w.fielder === p.id)).join('')}</div></div>`;
  }
  h += `<button class="btn red block" style="margin-top:8px" ${!w.type ? 'disabled' : ''} onclick="App.confirmWicket()">Confirm OUT</button>`;
  sheet(h);
}
App.confirmWicket = () => {
  const w = S.w;
  if (w.type === 'caught' && !w.fielder) return toast('Who took the catch?', true);
  let extra = w.extra, runs = w.type === 'run out' ? w.runs : 0;
  if (['b', 'lb'].includes(extra) && runs === 0) extra = null;
  scoreAction('match_ball', { runs, extra, wicket: { type: w.type, fielder_id: w.fielder, dismissed_id: w.dismissed } });
};
App.retireSheet = () => {
  const inn = curInn();
  sheet(`<h3>Retired hurt 🩹</h3><div class="sub">The batter leaves without being out and can bat again later.</div>
    <div class="plist">${[inn.striker_id, inn.non_striker_id].filter(Boolean).map(id => `<button class="pbtn" onclick="App.ball(0,null,{type:'retired hurt',dismissed_id:${id}})">${esc(pname(id))}</button>`).join('')}</div>`);
};
function batterSheet() {
  const st = S.m, inn = curInn();
  const end = !inn.striker_id ? "striker's end — on strike" : "non-striker's end";
  const players = st.xi[inn.batting_team_id].filter(p => st.available_batters.includes(p.id));
  const retired = new Set(inn.batting.filter(b => b.how === 'retired hurt').map(b => b.id));
  sheet(`<h3>Next batter 🏏</h3><div class="sub">Coming in at the ${end}</div>
    <div class="plist">${players.map(p => `<button class="pbtn" onclick="App.setBatter(${p.id})">${roleIcon(p.role)} ${esc(p.name)}<span class="s">${retired.has(p.id) ? 'retired hurt — returning' : esc(p.role)}</span></button>`).join('')}</div>
    <button class="btn light block" onclick="App.undo()">↶ Undo last ball</button>`, { locked: true });
}
App.bowlerSheet = (change = false) => {
  const st = S.m, inn = curInn(), m = st.match, bpo = m.balls_per_over;
  const start = inn.legal_balls % bpo === 0;
  const xi = st.xi[inn.bowling_team_id];
  const list = xi.map(p => {
    const f = inn.bowling.find(b => b.id === p.id);
    let dis = false, why = f ? `${f.o}-${f.m}-${f.r}-${f.w}` : 'yet to bowl';
    if (start && xi.length > 1 && p.id === st.prev_over_bowler) { dis = true; why = 'bowled last over'; }
    else if (m.max_overs_bowler && start && (st.bowler_balls[p.id] || 0) >= m.max_overs_bowler * bpo) { dis = true; why = 'overs quota done'; }
    if (change && p.id === inn.bowler_id) { dis = true; why = 'bowling now'; }
    return `<button class="pbtn" ${dis ? 'disabled' : ''} onclick="App.setBowler(${p.id})">${roleIcon(p.role)} ${esc(p.name)}<span class="s">${why}</span></button>`;
  });
  const overNo = Math.floor(inn.legal_balls / bpo) + 1;
  sheet(`<h3>${change ? 'Change bowler' : `Over ${overNo} — who bowls? 🎯`}</h3>
    <div class="sub">${change ? 'Use this if a bowler is injured mid-over.' : 'Figures shown as Overs-Maidens-Runs-Wickets'}${m.max_overs_bowler ? ` · max ${m.max_overs_bowler} overs each` : ''}</div>
    <div class="plist">${list.join('')}</div>${change ? '' : '<button class="btn light block" onclick="App.undo()">↶ Undo last ball</button>'}`, { locked: !change });
};

App.matchMenu = () => {
  const st = S.m, m = st.match;
  const live = st.innings.length && curInn().status === 'live' && m.status === 'live';
  sheet(`<h3>Match options</h3><div class="sub">${esc(st.team1.name)} vs ${esc(st.team2.name)}</div><div class="plist">
    ${st.needs === 'completed' && m.status !== 'abandoned' ? '<button class="pbtn" onclick="App.undo()">↶ Undo last ball (re-open match)</button>' : ''}
    ${live ? '<button class="pbtn" onclick="App.endInnings()">⏹️ End this innings now</button>' : ''}
    ${['live', 'scheduled'].includes(m.status) || m.result_method === 'rain' ? '<button class="pbtn" onclick="App.rainSheet()">🌧️ Rain / DLS — reduce overs, revised target</button>' : ''}
    ${['live', 'scheduled'].includes(m.status) ? '<button class="pbtn" onclick="App.abandon()">⛔ Abandon match (no result)</button>' : ''}
    <button class="pbtn" onclick="App.shareMatch()">🔗 Share live score link</button>
    <button class="pbtn" style="color:var(--red)" onclick="App.deleteMatch()">🗑️ Delete match</button></div>`);
};
/* ----- Rain / DLS (Duckworth-Lewis-Stern, ICC Standard Edition) ----- */
App.rainSheet = () => {
  const st = S.m, m = st.match, d = st.dls || {};
  const inn = st.innings.length ? curInn() : null;
  const bpo = m.balls_per_over;
  let stage, cur, minO;
  if (!inn) { stage = 'pre'; cur = m.overs; minO = 1; }
  else if (inn.status === 'completed' && inn.no === 1) { stage = 'break'; cur = d.inn2_overs ?? inn.max_overs; minO = 1; }
  else if (inn.status === 'live') { stage = inn.no === 1 ? 'inn1' : 'inn2'; cur = inn.max_overs; minO = Math.max(1, Math.ceil(inn.legal_balls / bpo)); }
  else stage = 'done';
  const intr = (d.interruptions || []).map(x => `<div class="kv"><span>Inns ${x.innings_no} · at ${x.at} ov, ${x.wickets} wkt</span><span>${x.overs_before} → ${x.overs_after} overs</span></div>`).join('');
  const level = `<div class="field" style="margin-top:12px"><label>Level (G50 — average 50-over score)</label><div class="chips wrap">
      <button class="chip ${d.g50 !== 245 ? 'on' : ''}" onclick="App.dlsLevel(200)">Junior / club — 200</button>
      <button class="chip ${d.g50 === 245 ? 'on' : ''}" onclick="App.dlsLevel(245)">International — 245</button></div></div>`;
  let body = '';
  if (stage === 'done') {
    body = m.result_method === 'rain'
      ? `<div class="notice">Result decided by rain. Play resumed? Undo it to continue the chase.</div><button class="btn block" onclick="App.undo()">↶ Undo rain result — resume play</button>`
      : `<div class="notice">The match is finished.</div>`;
  } else {
    const batName = stage === 'break' ? teamById(st.next.batting_team_id).name : stage === 'pre' ? '' : teamById(inn.batting_team_id).name;
    const what = { pre: 'Overs per side for this match', break: `Overs for ${esc(batName)}'s chase`, inn1: `Overs for ${esc(batName)} now`, inn2: `Overs for ${esc(batName)} now` }[stage];
    const sub = { pre: 'Rain before the start: both teams simply get fewer overs.', break: 'Rain at the innings break: the chasing team gets fewer overs and DLS sets the target.',
      inn1: `Rain in the 1st innings at ${inn ? inn.overs : ''} overs, ${inn ? inn.wickets : ''} down. The team batting second will get the same overs, and DLS sets the target at the break.`,
      inn2: `Rain in the chase at ${inn ? inn.overs : ''} overs, ${inn ? inn.wickets : ''} down. DLS revises the target.` }[stage];
    body = `<div class="small muted" style="margin-bottom:10px">${sub}</div>
      <div class="field"><label>${what}</label>
        <div class="row"><button class="btn sm light" onclick="App.rainStep(-1)">−</button><input class="input" id="rainOv" type="number" inputmode="numeric" min="${minO}" max="${cur}" value="${Math.max(minO, cur - 1)}" style="text-align:center;font-size:22px;font-weight:900" oninput="App.rainPreview()"><button class="btn sm light" onclick="App.rainStep(1)">+</button></div></div>
      <div id="rainPrev" class="notice" style="display:none"></div>
      <button class="btn block" onclick="App.rainApply(this)">🌧️ Apply reduced overs</button>`;
    if (stage === 'inn2') {
      body += `<div class="divider"></div>
        <div class="kv" style="border:0;padding:4px 0"><span>DLS par score now</span><span class="big-num">${d.par}</span></div>
        <div class="small muted">If no more play is possible now, ${esc(teamById(inn.batting_team_id).name)} ${inn.runs > d.par ? 'would WIN' : inn.runs === d.par ? 'would TIE' : 'would LOSE'} (score ${inn.runs}${d.can_result ? '' : `; but at least ${d.min_overs} overs are needed for a result`}).</div>
        <button class="btn red block" style="margin-top:10px" onclick="App.rainEnd()">⛈️ Rain stopped play — decide by DLS</button>
        ${d.par_table && d.par_table.length ? `<details style="margin-top:12px"><summary class="link">Par score at the end of each over (${inn.wickets} down)</summary>
          <div class="card flush" style="margin-top:8px;box-shadow:none;border:1px solid var(--line)">${d.par_table.map(r => `<div class="kv"><span>After ${r.over} overs</span><span>${r.par}</span></div>`).join('')}</div></details>` : ''}`;
    }
  }
  sheet(`<h3>Rain & DLS 🌧️</h3><div class="sub">Duckworth-Lewis-Stern method (ICC Standard Edition)</div>${body}
    ${d.R1 !== undefined ? `<div class="divider"></div><div class="kv" style="border:0;padding:3px 0"><span>Resources — team 1</span><span>${d.R1}%</span></div>${d.R2 !== undefined ? `<div class="kv" style="border:0;padding:3px 0"><span>Resources — team 2</span><span>${d.R2}%</span></div>` : ''}` : ''}
    ${intr ? `<div class="section" style="margin-top:12px"><h2 style="font-size:15px">Interruptions</h2><button class="link" onclick="App.rainUndo()">Undo last</button></div><div class="card flush" style="box-shadow:none;border:1px solid var(--line)">${intr}</div>` : (d.inn2_overs ? `<button class="link" onclick="App.rainUndo()">Undo chase overs change</button>` : '')}
    ${stage !== 'done' ? level : ''}
    <button class="link" style="margin-top:10px" onclick="App.dlsHelp()">How does DLS work?</button>`);
  if (stage !== 'done') App.rainPreview();
};
App.rainStep = dlt => { const i = $('#rainOv'); i.value = Math.min(+i.max, Math.max(+i.min, (+i.value || 0) + dlt)); App.rainPreview(); };
let rainT;
App.rainPreview = () => {
  clearTimeout(rainT);
  rainT = setTimeout(async () => {
    const el = $('#rainPrev'), ov = +($('#rainOv') || {}).value;
    if (!el || !ov) return;
    try {
      const r = await api('match_dls_preview', { id: S.m.match.id, overs: ov });
      el.style.display = 'block';
      el.innerHTML = r.target ? `Revised DLS target: <b>${r.target}</b> from ${r.overs} overs` : esc(r.note || '');
    } catch (e) { el.style.display = 'none'; }
  }, 200);
};
App.rainApply = btn => {
  const ov = +$('#rainOv').value;
  const before = S.m.innings.length ? curInn().target : null;
  run(async () => {
    if (!(await scoreAction('match_rain', { overs: ov }))) return;
    const st = S.m, inn = st.innings.length ? curInn() : null;
    let msg = `Rain! The match is reduced to ${ov} overs.`;
    if (inn && inn.no === 2 && inn.target !== before) msg = `Rain has reduced the chase to ${ov} overs. The revised DLS target is ${inn.target}.`;
    else if (st.needs === 'openers' && st.next && st.next.no === 2) msg = `Rain! ${teamById(st.next.batting_team_id).name} will chase ${st.next.target} in ${st.next.overs} overs, by the DLS method.`;
    toast(msg); Sound.say(msg, { delay: 50 });
  }, btn);
};
App.rainEnd = () => confirmSheet('Rain stopped play?', 'The match will be decided on the DLS par score right now. You can undo this if play resumes.', 'Decide by DLS', () => scoreAction('match_rain_end'), false);
App.rainUndo = () => scoreAction('match_rain_undo').then(() => toast('Rain change undone'));
App.dlsLevel = g => scoreAction('match_dls_level', { g50: g }).then(() => App.rainSheet());
App.dlsHelp = () => sheet(`<h3>How DLS works ☔</h3><div class="small" style="line-height:1.6">
  A team has two <b>resources</b> to score runs: <b>overs left</b> and <b>wickets in hand</b>. The ICC table gives the % of resources left for every combination (50 overs & 0 wickets down = 100%).<br><br>
  When rain takes overs away, each team's resources (R1, R2) are worked out. Then:<br>
  • If team 2 has <b>fewer</b> resources: target = team 1 score × R2 ÷ R1, plus 1.<br>
  • If team 2 has <b>more</b>: target = team 1 score + G50 × (R2 − R1) ÷ 100, plus 1 (G50 = 245 internationals, 200 junior/club).<br><br>
  If rain ends the match during the chase, the batting side wins if it is <b>ahead of the par score</b>, ties if level, and loses if behind — provided enough overs were bowled (20 in a 50-over game, 5 in a T20).</div>
  <button class="btn light block" style="margin-top:12px" onclick="App.rainSheet()">← Back</button>`);
App.endInnings = () => confirmSheet('End innings?', 'Use this for rain, bad light or a declaration. The innings will close at the current score.', 'End innings', () => scoreAction('match_end_innings'));
App.abandon = () => confirmSheet('Abandon match?', 'The match will be recorded as "No result".', 'Abandon', () => scoreAction('match_abandon'));
App.deleteMatch = () => confirmSheet('Delete this match?', 'All scores for this match will be removed. This cannot be undone.', 'Delete', () => run(async () => { await api('match_delete', { id: S.m.match.id }); closeSheet(); S.m = null; toast('Match deleted'); go('#/matches'); }));
App.shareMatch = async () => {
  const st = S.m, url = location.origin + location.pathname + '#/match/' + st.match.id;
  const inn = st.innings.length ? curInn() : null;
  const text = `🏏 ${st.team1.name} vs ${st.team2.name}` + (inn ? ` — ${teamById(inn.batting_team_id).short_name} ${inn.runs}/${inn.wickets} (${inn.overs})` : '') + (st.match.result_text ? ` — ${st.match.result_text}` : '') + ' · Cric-Scorer';
  closeSheet();
  if (navigator.share) { try { await navigator.share({ title: 'Cric-Scorer', text, url }); } catch (e) { /* cancelled */ } }
  else { try { await navigator.clipboard.writeText(text + '\n' + url); toast('Link copied!'); } catch (e) { toast(url); } }
};

/* ----- setup: playing XI ----- */
function xiSetup() {
  const st = S.m, m = st.match;
  if (!S.squads || S.squads.mid !== m.id) { loadSquads(); return `<div class="content">${sk(3)}</div>`; }
  const tid = S.xiTeam, team = S.squads[tid], sel = S.xiSel[tid];
  const tabs = [st.team1, st.team2].map(t => `<button class="${t.id === tid ? 'on' : ''}" onclick="S.xiTeam=${t.id};drawMatch(false)">${esc(t.short_name)} · ${S.xiSel[t.id].size}/${m.players_per_side}</button>`).join('');
  const list = team.players.map(p => `<button class="pbtn ${sel.has(+p.id) ? 'on' : ''}" onclick="App.xiToggle(${p.id})"><span class="chk">${sel.has(+p.id) ? '✓' : ''}</span>${roleIcon(p.role)} ${esc(p.name)}<span class="s">${esc(p.role)}</span></button>`).join('');
  return `<div class="content"><div class="section" style="margin-top:6px"><h2>Pick playing teams</h2><span class="small muted">up to ${m.players_per_side} each</span></div>
    <div class="seg">${tabs}</div>
    <div class="row" style="margin-bottom:10px;flex-wrap:wrap"><button class="btn sm light" onclick="App.xiFirst()">Pick first ${m.players_per_side}</button><button class="btn sm light" onclick="App.xiClear()">Clear</button>
    ${team.team.can_edit ? '<button class="btn sm light" onclick="App.quickPlayer()">+ New player</button>' : ''}</div>
    ${team.players.length ? `<div class="plist">${list}</div>` : `<div class="card empty"><div class="big">🧢</div>This team has no players yet.${team.team.can_edit ? '<br>Tap <b>+ New player</b> to add some.' : ''}</div>`}
    <button class="btn block" style="margin:8px 0 20px" onclick="App.saveXI(this)">Save teams & go to toss →</button></div>`;
}
async function loadSquads() {
  const st = S.m;
  try {
    const [a, b] = await Promise.all([api('team_get', { id: st.team1.id }), api('team_get', { id: st.team2.id })]);
    S.squads = { mid: st.match.id, [st.team1.id]: a, [st.team2.id]: b };
    S.xiSel = {};
    for (const [t, d] of [[st.team1, a], [st.team2, b]]) {
      const saved = (st.xi[t.id] || []).map(p => p.id);
      S.xiSel[t.id] = new Set(saved.length ? saved : (d.players.length <= st.match.players_per_side ? d.players.map(p => +p.id) : []));
    }
    S.xiTeam = S.xiTeam && S.squads[S.xiTeam] ? S.xiTeam : st.team1.id;
    drawMatch(false);
  } catch (e) { toast(e.message, true); }
}
App.xiToggle = id => {
  const sel = S.xiSel[S.xiTeam], max = S.m.match.players_per_side;
  if (sel.has(id)) sel.delete(id);
  else { if (sel.size >= max) return toast(`Only ${max} players allowed`, true); sel.add(id); }
  drawMatch(false);
};
App.xiFirst = () => { S.xiSel[S.xiTeam] = new Set(S.squads[S.xiTeam].players.slice(0, S.m.match.players_per_side).map(p => +p.id)); drawMatch(false); };
App.xiClear = () => { S.xiSel[S.xiTeam] = new Set(); drawMatch(false); };
App.saveXI = btn => {
  const st = S.m, min = st.match.last_man_stands ? 1 : 2;
  for (const t of [st.team1, st.team2]) if (S.xiSel[t.id].size < min) { S.xiTeam = t.id; drawMatch(false); return toast(`Pick at least ${min} players for ${t.name}`, true); }
  const xi = { [st.team1.id]: [...S.xiSel[st.team1.id]], [st.team2.id]: [...S.xiSel[st.team2.id]] };
  run(() => scoreAction('match_xi', { xi }), btn);
};
App.quickPlayer = () => {
  sheet(`<h3>New player</h3><div class="sub">Added to ${esc(S.squads[S.xiTeam].team.name)}</div>
    <form onsubmit="App.saveQuickPlayer(event)"><div class="field"><label>Name</label><input class="input" name="name" required autofocus></div>
    <div class="field"><label>Role</label><select class="input" name="role">${Object.keys(ROLE_ICON).map(r => `<option>${r}</option>`).join('')}</select></div>
    <button class="btn block">Add player</button></form>`);
};
App.saveQuickPlayer = e => {
  e.preventDefault();
  run(async () => {
    const f = formData(e.target); f.team_id = S.xiTeam;
    const r = await api('player_save', f);
    S.squads[S.xiTeam] = await api('team_get', { id: S.xiTeam });
    if (S.xiSel[S.xiTeam].size < S.m.match.players_per_side) S.xiSel[S.xiTeam].add(r.id);
    closeSheet(); drawMatch(false);
  }, e.submitter);
};

/* ----- setup: toss ----- */
function tossSetup() {
  const st = S.m, t = S.toss || {};
  const tb = x => `<button class="${t.w === x.id ? 'on' : ''}" onclick="S.toss.w=${x.id};drawMatch(false)">${badge(x)}<span>${esc(x.name)}</span></button>`;
  return `<div class="content"><div class="card">
    <div class="coin" id="coin">${esc(t.coin || 'TOSS')}</div>
    <div style="text-align:center;margin-bottom:12px"><button class="btn sm light" onclick="App.flip()">🪙 Flip the coin</button></div>
    <div class="field"><label>Who won the toss?</label><div class="toss-pick">${tb(st.team1)}${tb(st.team2)}</div></div>
    <div class="field"><label>They chose to</label><div class="toss-pick">
      <button class="${t.d === 'bat' ? 'on' : ''}" onclick="S.toss.d='bat';drawMatch(false)"><span style="font-size:30px">🏏</span>Bat first</button>
      <button class="${t.d === 'bowl' ? 'on' : ''}" onclick="S.toss.d='bowl';drawMatch(false)"><span style="font-size:30px">🎯</span>Bowl first</button></div></div>
    <button class="btn block" onclick="App.saveToss(this)">Continue →</button>
    <button class="btn light block" style="margin-top:8px" onclick="App.editXI()">← Change playing teams</button></div></div>`;
}
App.flip = () => {
  const c = $('#coin'); if (!c) return;
  c.classList.remove('flip'); void c.offsetWidth; c.classList.add('flip'); c.textContent = '…';
  setTimeout(() => { S.toss.coin = Math.random() < .5 ? 'HEADS' : 'TAILS'; c.textContent = S.toss.coin; }, 1200);
};
App.saveToss = btn => {
  if (!S.toss.w) return toast('Who won the toss?', true);
  if (!S.toss.d) return toast('Bat or bowl first?', true);
  run(() => scoreAction('match_toss', { winner_id: S.toss.w, decision: S.toss.d }), btn);
};
App.editXI = () => { S.m.needs = 'players'; S.squads = null; S.toss = {}; drawMatch(false); };

/* ----- setup: openers ----- */
function openersSetup() {
  const st = S.m, nx = st.next, op = S.op || (S.op = {});
  if (op.no !== nx.no) { S.op = { no: nx.no }; }
  const o = S.op;
  const bat = st.xi[nx.batting_team_id], bowl = st.xi[nx.bowling_team_id];
  const bt = teamById(nx.batting_team_id), bwt = teamById(nx.bowling_team_id);
  const chips = (list, key, other) => list.map(p => `<button class="chip ${o[key] === p.id ? 'on' : ''}" ${other && o[other] === p.id ? 'disabled' : ''} onclick="S.op['${key}']=${p.id};drawMatch(false)">${roleIcon(p.role)} ${esc(p.name)}</button>`).join('');
  const single = st.match.last_man_stands && bat.length === 1;
  let brk = '';
  if (nx.no === 2) {
    const i1 = st.innings[0];
    brk = `<div class="card" style="text-align:center"><div style="font-size:34px">☕</div><b class="big-num">Innings break</b>
      <div class="muted">${esc(teamById(i1.batting_team_id).name)} scored ${i1.runs}/${i1.wickets} in ${i1.overs} overs</div>
      <div style="margin-top:6px;font-weight:800;color:var(--green)">${esc(bt.name)} need ${nx.target} runs from ${nx.overs * st.match.balls_per_over} balls${nx.dls ? ` <span class="dls-tag">DLS</span>` : ''}</div>
      ${nx.dls ? `<div class="small muted" style="margin-top:4px">Target revised by the DLS method (${nx.overs} overs)</div>` : ''}</div>`;
  }
  return `<div class="content">${brk}<div class="card">
    <div class="row" style="margin-bottom:10px">${badge(bt, 'sm')}<b class="grow">${esc(bt.name)} — opening batters</b></div>
    <div class="field"><label>Striker (faces the first ball)</label><div class="chips wrap">${chips(bat, 's', 'ns')}</div></div>
    ${single ? '' : `<div class="field"><label>Non-striker</label><div class="chips wrap">${chips(bat, 'ns', 's')}</div></div>`}
    <div class="divider"></div>
    <div class="row" style="margin:10px 0">${badge(bwt, 'sm')}<b class="grow">${esc(bwt.name)} — opening bowler</b></div>
    <div class="chips wrap" style="margin-bottom:14px">${chips(bowl, 'b')}</div>
    <button class="btn block" onclick="App.startInnings(this)">Play ball! 🏏</button>
    ${nx.no === 2 ? '<button class="btn light block" style="margin-top:8px" onclick="App.undo()">↶ Undo last ball of 1st innings</button>' : '<button class="btn light block" style="margin-top:8px" onclick="App.undoToss()">← Redo the toss</button>'}
  </div></div>`;
}
App.startInnings = btn => {
  const o = S.op, st = S.m, single = st.match.last_man_stands && st.xi[st.next.batting_team_id].length === 1;
  if (!o.s || (!single && !o.ns) || !o.b) return toast('Pick both batters and the bowler', true);
  run(() => scoreAction('match_start_innings', { striker_id: o.s, non_striker_id: single ? null : o.ns, bowler_id: o.b }), btn);
};
App.undoToss = () => { S.m.needs = 'toss'; S.toss = {}; drawMatch(false); };

/* ----- result ----- */
function resultCard(st) {
  const m = st.match;
  return `<div class="content"><div class="result-card"><div class="tr">${m.status === 'abandoned' ? '🌧️' : '🏆'}</div><b>${esc(m.result_text || 'Match finished')}</b>
    ${m.player_of_match ? `<div class="pom" onclick="go('#/player/${m.player_of_match.id}')"><span class="avatar">⭐</span><div><div class="small">Player of the Match</div><b style="font-size:20px;margin:0">${esc(m.player_of_match.name)}</b></div></div>` : ''}</div>
    ${st.can_edit ? `<button class="btn light block" style="margin-bottom:12px" onclick="go('${m.tournament ? '#/tournament/' + m.tournament.id : '#/match/new'}')">${m.tournament ? '← Back to tournament' : '＋ Start another match'}</button>` : ''}</div>`;
}

/* ----- tabs: scorecard / overs / commentary ----- */
function matchTabs(st) {
  const tabs = [['card', 'Scorecard'], ['overs', 'Overs'], ['comm', 'Ball by ball']];
  const n = st.innings.length;
  if (S.cardInn === null || S.cardInn >= n || S.cardInnN !== n) { S.cardInn = n - 1; S.cardInnN = n; }
  const innSel = n > 1 ? `<div class="chips" style="margin-bottom:10px">${st.innings.map((i, k) => `<button class="chip ${k === S.cardInn ? 'on' : ''}" onclick="S.cardInn=${k};drawMatch(false)">${esc(teamById(i.batting_team_id).short_name)} ${i.runs}/${i.wickets}</button>`).join('')}</div>` : '';
  const inn = st.innings[S.cardInn];
  const body = S.mTab === 'overs' ? oversView(st, inn) : S.mTab === 'comm' ? commView(st, inn) : scorecardView(st, inn);
  return `<div class="content" style="padding-top:2px"><div class="seg">${tabs.map(([k, l]) => `<button class="${S.mTab === k ? 'on' : ''}" onclick="S.mTab='${k}';drawMatch(false)">${l}</button>`).join('')}</div>${innSel}${body}</div>`;
}
function scorecardView(st, inn) {
  const bt = teamById(inn.batting_team_id), bwt = teamById(inn.bowling_team_id);
  const live = inn.status === 'live';
  const bat = inn.batting.map(b => {
    const atCrease = live && (b.id === inn.striker_id || b.id === inn.non_striker_id);
    return `<tr onclick="go('#/player/${b.id}')"><td><div class="nm">${esc(b.name)}${atCrease && b.id === inn.striker_id ? ' *' : ''}</div><div class="how">${atCrease ? 'batting' : esc(b.how)}</div></td><td><b>${b.r}</b></td><td>${b.b}</td><td>${b.f4}</td><td>${b.f6}</td><td>${b.sr}</td></tr>`;
  }).join('');
  const ex = inn.extras_detail;
  const bowl = inn.bowling.map(b => `<tr onclick="go('#/player/${b.id}')"><td><div class="nm">${esc(b.name)}</div>${b.wd || b.nb ? `<div class="how">${b.wd ? b.wd + 'wd ' : ''}${b.nb ? b.nb + 'nb' : ''}</div>` : ''}</td><td>${b.o}</td><td>${b.m}</td><td>${b.r}</td><td><b>${b.w}</b></td><td>${b.econ}</td></tr>`).join('');
  return `<div class="card flush">
    <div class="inn-head">${badge(bt, 'sm')}<span>${esc(bt.name)}</span><b>${inn.runs}/${inn.wickets} <small style="font-size:14px">(${inn.overs})</small></b></div>
    <table class="tbl"><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>${bat || '<tr><td colspan="6" class="muted">No batting yet</td></tr>'}
      <tr><td>Extras</td><td colspan="5">${inn.extras} <span class="muted small">(b ${ex.b}, lb ${ex.lb}, wd ${ex.wd}, nb ${ex.nb})</span></td></tr>
      <tr class="total"><td>Total</td><td colspan="5">${inn.runs}/${inn.wickets} <span class="muted small">(${inn.overs} ov, RR ${Number(inn.crr).toFixed(2)})</span></td></tr></table>
    ${inn.dnb.length ? `<div class="kv"><span>${live ? 'Yet to bat' : 'Did not bat'}</span><span>${inn.dnb.map(p => esc(p.name)).join(', ')}</span></div>` : ''}
    ${inn.fow.length ? `<div class="kv"><span>Fall of wickets</span><span>${inn.fow.map(f => `${f.score}-${f.wkt} (${esc(f.name)}, ${f.overs})`).join(', ')}</span></div>` : ''}
    <div class="inn-head" style="background:var(--pitch-3)">${badge(bwt, 'sm')}<span>${esc(bwt.name)} bowling</span></div>
    <table class="tbl"><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr>${bowl || '<tr><td colspan="6" class="muted">No bowling yet</td></tr>'}</table></div>`;
}
function oversView(st, inn) {
  const ov = inn.overs_list;
  if (!ov.length) return '<div class="card empty">No overs bowled yet.</div>';
  const max = Math.max(6, ...ov.map(o => o.runs));
  const bars = ov.map(o => `<div class="bar ${o.wkts ? 'hasw' : ''}" style="height:${Math.max(3, o.runs / max * 100)}%" title="Over ${o.over}: ${o.runs}"></div>`).join('');
  const step = ov.length > 20 ? 5 : ov.length > 10 ? 2 : 1;
  const xs = ov.map(o => `<span>${o.over % step === 0 || o.over === 1 ? o.over : ''}</span>`).join('');
  const list = [...ov].reverse().map(o => `<div class="comm"><span class="ov">Ov ${o.over}</span><div class="grow"><div class="row" style="justify-content:space-between"><b class="small">${esc(o.bowler)}</b><b class="small">${plural(o.runs, 'run')}${o.wkts ? ' · ' + plural(o.wkts, 'wkt') : ''}</b></div>
    <div class="row" style="gap:5px;flex-wrap:wrap;margin-top:6px">${o.balls.map(ballChip).join('')}</div></div></div>`).join('');
  return `<div class="card flush"><div class="kv" style="border-top:0"><span>Runs per over</span><span class="muted small">● = wicket</span></div><div class="bars">${bars}</div><div class="bars-x">${xs}</div>${list}</div>`;
}
function commView(st, inn) {
  const tl = [...inn.timeline].reverse().slice(0, 150);
  if (!tl.length) return '<div class="card empty">No balls bowled yet.</div>';
  return `<div class="card flush">${tl.map(b => `<div class="comm ${b.w ? 'w' : ''}"><span class="ov">${b.ov}</span><div class="row grow" style="align-items:flex-start">${ballChip(b.label)}<span class="small" style="flex:1">${esc(b.desc)}</span></div></div>`).join('')}</div>`;
}

/* =====================================================================
   TEAMS & PLAYERS
   ===================================================================== */
async function viewTeams(cat) {
  if (cat) S.teamCat = cat;
  const c = S.teamCat || 'custom';
  const tabs = [['custom', '🧢 Our Teams'], ['ipl', '🏟️ IPL'], ['international', '🌍 International']];
  mount(topbar('Teams') + `<div class="content"><div class="seg">${tabs.map(([k, l]) => `<button class="${c === k ? 'on' : ''}" onclick="go('#/teams?c=${k}')">${l}</button>`).join('')}</div>
    <div class="search">${I.search}<input class="input" placeholder="Search teams" oninput="App.filterList(this.value)"></div>
    <div id="tl">${sk(4)}</div></div><button class="fab" aria-label="Create team" onclick="go('#/team/new')">${I.plus}</button>`, 'teams');
  const d = await api('teams_list', { category: c });
  $('#tl').innerHTML = d.teams.length ? `<div class="card flush list">${d.teams.map(t => `<div class="item" data-q="${esc((t.name + ' ' + t.short_name).toLowerCase())}" onclick="go('#/team/${t.id}')">${badge(t)}
      <div class="grow"><div class="t ellipsis">${esc(t.name)}</div><div class="s">${plural(+t.players, 'player')}${t.captain && t.captain !== 'TBA' ? ' · C: ' + esc(t.captain) : ''}${c === 'custom' ? ' · by ' + esc(t.mine ? 'you' : t.owner_name || '—') : ''}</div></div><span class="chev">${I.chev}</span></div>`).join('')}</div>`
    : `<div class="card empty"><div class="big">🧢</div>No teams here yet.<br><button class="btn" style="margin-top:12px" onclick="go('#/team/new')">Create your team</button></div>`;
}
App.filterList = q => {
  q = q.toLowerCase().trim();
  document.querySelectorAll('[data-q]').forEach(el => el.classList.toggle('hidden', q && !el.dataset.q.includes(q)));
};

async function viewTeam(id) {
  mount(topbar('Team', { back: true }) + `<div class="content">${sk(4)}</div>`, 'teams');
  const d = await api('team_get', { id: +id });
  const t = d.team; S.team = d;
  const groups = [['Batter', '🏏 Batters'], ['Wicket-keeper', '🧤 Wicket-keepers'], ['All-rounder', '⭐ All-rounders'], ['Bowler', '🎯 Bowlers']];
  const fg = textOn(t.color);
  const actions = t.can_edit ? `<button class="icon-btn" aria-label="Edit" onclick="go('#/team/${t.id}/edit')">${I.edit}</button>` : '';
  const squad = groups.map(([r, label]) => {
    const ps = d.players.filter(p => p.role === r);
    if (!ps.length) return '';
    return `<div class="section"><h2>${label}</h2><span class="small muted">${ps.length}</span></div><div class="card flush list">${ps.map(p => `<div class="item" onclick="go('#/player/${p.id}')">
      <span class="avatar">${esc(p.name.split(' ').map(w => w[0]).slice(0, 2).join(''))}</span>
      <div class="grow"><div class="t ellipsis">${esc(p.name)}${t.captain === p.name ? ' <span class="role-tag">C</span>' : ''}${+p.is_overseas ? ' ✈️' : ''}</div>
      <div class="s ellipsis">${esc([p.batting_style, p.bowling_style].filter(Boolean).join(' · '))}${p.country && t.category !== 'international' ? ' · ' + esc(p.country) : ''}</div></div>
      <span class="chev">${I.chev}</span></div>`).join('')}</div>`;
  }).join('');
  mount(topbar(t.short_name, { back: true, actions }) + `<div class="team-hero" style="background:${esc(t.color)};color:${fg}"><span class="badge lg" style="background:${fg === '#ffffff' ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.08)'};color:${fg}">${esc(String(t.short_name).slice(0, 4))}</span>
      <div><h2>${esc(t.name)}</h2><p>${{ ipl: 'IPL franchise', international: 'International team', custom: 'Custom team' }[t.category]} · ${plural(d.players.length, 'player')}</p>
      ${t.captain ? `<p>Captain: ${esc(t.captain)}</p>` : ''}${t.home_ground ? `<p>🏟️ ${esc(t.home_ground)}</p>` : ''}</div></div>
    <div class="content">
      ${t.can_edit ? `<div class="grid2" style="margin-bottom:6px"><button class="btn" onclick="App.playerForm(null)">${I.plus} Add player</button><button class="btn light" onclick="App.pickPlayers()">📋 Pick from teams</button></div>` : ''}
      ${squad || `<div class="card empty"><div class="big">🧢</div>No players yet.</div>`}
      ${d.recent.length ? `<div class="section"><h2>Recent matches</h2></div>${d.recent.map(matchCard).join('')}` : ''}
      <button class="btn light block" style="margin-top:10px" onclick="App.startWith(${t.id})">🏏 Start a match with ${esc(t.short_name)}</button>
    </div>`, 'teams');
}
App.startWith = () => go('#/match/new');  // team pickers list every team

const BAT_STYLES = ['Right-hand bat', 'Left-hand bat'];
const BOWL_STYLES = ['', 'Right-arm fast', 'Right-arm fast-medium', 'Right-arm medium', 'Left-arm fast', 'Left-arm fast-medium', 'Left-arm medium', 'Right-arm offbreak', 'Right-arm legbreak', 'Slow left-arm orthodox', 'Left-arm wrist-spin'];
App.playerForm = (pid, teamId) => {
  const p = pid ? (S.team?.players.find(x => +x.id === pid) || S.player?.player) : null;
  const tid = teamId || S.team?.team.id;
  const opt = (list, v) => list.map(x => `<option value="${esc(x)}" ${x === (v || '') ? 'selected' : ''}>${x || "Doesn't bowl"}</option>`).join('');
  sheet(`<h3>${p ? 'Edit player' : 'Add player'}</h3><form onsubmit="App.savePlayer(event,${pid || 0},${tid})">
    <div class="field"><label>Name</label><input class="input" name="name" value="${esc(p?.name || '')}" required></div>
    <div class="grid2"><div class="field"><label>Role</label><select class="input" name="role">${Object.keys(ROLE_ICON).map(r => `<option ${p?.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="field"><label>Jersey no.</label><input class="input" name="jersey_no" inputmode="numeric" value="${esc(p?.jersey_no || '')}"></div></div>
    <div class="field"><label>Batting</label><select class="input" name="batting_style">${opt(BAT_STYLES, p?.batting_style || 'Right-hand bat')}</select></div>
    <div class="field"><label>Bowling</label><select class="input" name="bowling_style">${opt(BOWL_STYLES, p?.bowling_style)}</select></div>
    <div class="field"><label>Country</label><input class="input" name="country" value="${esc(p?.country || 'India')}"></div>
    <button class="btn block">${p ? 'Save changes' : 'Add player'}</button>
    ${p ? `<button type="button" class="btn light block" style="margin-top:8px;color:var(--red)" onclick="App.deletePlayer(${pid})">Delete player</button>` : ''}</form>`);
};
App.savePlayer = (e, pid, tid) => {
  e.preventDefault();
  run(async () => { const f = formData(e.target); f.id = pid; f.team_id = tid; await api('player_save', f); closeSheet(); toast(pid ? 'Player updated' : 'Player added ✓'); render(); }, e.submitter);
};
App.deletePlayer = pid => confirmSheet('Delete player?', 'This removes the player from the team.', 'Delete', () => run(async () => {
  await api('player_delete', { id: pid }); closeSheet(); toast('Player deleted');
  if (location.hash.startsWith('#/player/')) go('#/team/' + S.player.player.team_id); else render();
}));
App.pickPlayers = () => {
  S.pickSel = new Set();
  sheet(`<h3>Pick from other teams</h3><div class="sub">Build your dream team with IPL & international stars — players are copied into your team.</div>
    <div class="search">${I.search}<input class="input" id="pq" placeholder="Search e.g. Kohli, Bumrah" oninput="App.searchPlayers(this.value)"></div>
    <div id="pres" class="plist"><div class="muted small">Type at least 2 letters…</div></div>
    <button class="btn block" id="padd" disabled onclick="App.copyPlayers(this)">Add players</button>`);
  setTimeout(() => $('#pq')?.focus(), 250);
};
let searchT;
App.searchPlayers = q => {
  clearTimeout(searchT);
  searchT = setTimeout(async () => {
    if (q.trim().length < 2) return;
    try {
      const d = await api('players_search', { q, exclude_team: S.team.team.id });
      S.pickList = d.players; drawPick();
    } catch (e) { toast(e.message, true); }
  }, 250);
};
function drawPick() {
  $('#pres').innerHTML = S.pickList.length ? S.pickList.map(p => `<button class="pbtn ${S.pickSel.has(p.id) ? 'on' : ''}" onclick="App.togglePick(${p.id})"><span class="chk">${S.pickSel.has(p.id) ? '✓' : ''}</span>${roleIcon(p.role)} ${esc(p.name)}<span class="s">${esc(p.team)}</span></button>`).join('') : '<div class="muted small">No players found.</div>';
  const b = $('#padd'); b.disabled = !S.pickSel.size; b.textContent = S.pickSel.size ? `Add ${plural(S.pickSel.size, 'player')}` : 'Add players';
}
App.togglePick = id => { S.pickSel.has(id) ? S.pickSel.delete(id) : S.pickSel.add(id); drawPick(); };
App.copyPlayers = btn => run(async () => { const r = await api('player_copy', { team_id: S.team.team.id, player_ids: [...S.pickSel] }); closeSheet(); toast(`${plural(r.added, 'player')} added ✓`); render(); }, btn);

const COLORS = ['#0d4a36', '#15803d', '#1d4ed8', '#0ea5e9', '#7c3aed', '#db2777', '#d62839', '#ea580c', '#f2b134', '#475569', '#111827', '#0f766e'];
async function viewTeamForm(id) {
  let t = { name: '', short_name: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], captain: '', home_ground: '' };
  if (id) { const d = await api('team_get', { id: +id }); t = d.team; if (!t.can_edit) return go('#/team/' + id); }
  mount(topbar(id ? 'Edit Team' : 'Create Team', { back: true }) + `<form class="content" onsubmit="App.saveTeam(event,${id || 0})">
    <div class="card" style="text-align:center"><span id="tprev">${badge(t, 'lg')}</span><div class="small muted" style="margin-top:6px">Your team badge</div></div>
    <div class="card">
      <div class="field"><label>Team name</label><input class="input" name="name" value="${esc(t.name)}" placeholder="e.g. Aarush Super Kings" required oninput="App.teamPrev()"></div>
      <div class="field"><label>Short name (2–4 letters)</label><input class="input" name="short_name" maxlength="4" value="${esc(t.short_name)}" placeholder="e.g. ASK" style="text-transform:uppercase" oninput="App.teamPrev()"></div>
      <div class="field"><label>Team colour</label><div class="swatches">${COLORS.map(c => `<span class="swatch ${c === t.color ? 'on' : ''}" data-c="${c}" style="background:${c}" onclick="App.pickColor('${c}')"></span>`).join('')}
        <input type="color" name="color" value="${esc(t.color)}" style="width:34px;height:34px;border:0;padding:0;background:none" oninput="App.teamPrev()"></div></div>
      <div class="field"><label>Captain</label><input class="input" name="captain" value="${esc(t.captain || '')}" placeholder="optional"></div>
      <div class="field"><label>Home ground</label><input class="input" name="home_ground" value="${esc(t.home_ground || '')}" placeholder="optional"></div>
    </div>
    <button class="btn block">${id ? 'Save team' : 'Create team →'}</button>
    ${id ? `<button type="button" class="btn light block" style="margin:10px 0 20px;color:var(--red)" onclick="App.deleteTeam(${id})">Delete team</button>` : ''}
  </form>`, 'teams');
}
App.pickColor = c => { const f = $('form.content'); f.color.value = c; document.querySelectorAll('.swatch').forEach(x => x.classList.toggle('on', x.dataset.c === c)); App.teamPrev(); };
App.teamPrev = () => { const f = $('form.content'); $('#tprev').innerHTML = badge({ name: f.name.value || '?', short_name: (f.short_name.value || f.name.value.replace(/[^A-Za-z]/g, '').slice(0, 3)).toUpperCase(), color: f.color.value }, 'lg'); };
App.saveTeam = (e, id) => {
  e.preventDefault();
  run(async () => { const f = formData(e.target); f.id = id; const r = await api('team_save', f); toast(id ? 'Team saved' : 'Team created! Now add players 🧢'); go('#/team/' + r.id); }, e.submitter);
};
App.deleteTeam = id => confirmSheet('Delete team?', 'The team and its players will be removed.', 'Delete', () => run(async () => { await api('team_delete', { id }); closeSheet(); toast('Team deleted'); go('#/teams'); }));

async function viewPlayer(id) {
  mount(topbar('Player', { back: true }) + `<div class="content">${sk(4)}</div>`, 'teams');
  const d = await api('player_get', { id: +id }); S.player = d;
  const p = d.player, b = d.stats.batting, w = d.stats.bowling, fg = textOn(p.color);
  const g = (v, l) => `<div><b>${v ?? '–'}</b><span>${l}</span></div>`;
  const actions = p.can_edit ? `<button class="icon-btn" aria-label="Edit" onclick="App.playerForm(${p.id},${p.team_id})">${I.edit}</button>` : '';
  mount(topbar(p.name, { back: true, actions }) + `<div class="team-hero" style="background:${esc(p.color)};color:${fg}">
      <span class="avatar" style="width:64px;height:64px;font-size:24px;background:rgba(255,255,255,.2);color:${fg}">${esc(p.name.split(' ').map(x => x[0]).slice(0, 2).join(''))}</span>
      <div><h2>${esc(p.name)}</h2><p>${roleIcon(p.role)} ${esc(p.role)}${p.jersey_no ? ' · #' + esc(p.jersey_no) : ''}</p>
      <p onclick="go('#/team/${p.team_id}')" style="cursor:pointer;text-decoration:underline">${esc(p.team_name)}</p></div></div>
    <div class="content">
      <div class="card flush"><div class="kv" style="border-top:0"><span>Batting</span><span>${esc(p.batting_style || '—')}</span></div>
        <div class="kv"><span>Bowling</span><span>${esc(p.bowling_style || '—')}</span></div>${p.country ? `<div class="kv"><span>Country</span><span>${esc(p.country)}</span></div>` : ''}</div>
      <div class="section"><h2>🏏 Batting stats</h2><span class="small muted">in Cric-Scorer matches</span></div>
      <div class="card flush"><div class="statgrid">${g(b.mat, 'Matches')}${g(b.runs, 'Runs')}${g(b.hs + (b.hs_no ? '*' : ''), 'Best')}${g(b.avg, 'Average')}${g(b.sr, 'Strike rate')}${g(b.inns, 'Innings')}${g(b.f4, 'Fours')}${g(b.f6, 'Sixes')}${g(b.fifties + b.hundreds, '50s / 100s')}</div></div>
      <div class="section"><h2>🎯 Bowling stats</h2></div>
      <div class="card flush"><div class="statgrid">${g(w.wkts, 'Wickets')}${g(w.balls ? Math.floor(w.balls / 6) + '.' + (w.balls % 6) : 0, 'Overs')}${g(w.inns ? w.best_w + '/' + w.best_r : null, 'Best')}${g(w.econ, 'Economy')}${g(w.avg, 'Average')}${g(d.stats.catches, 'Catches')}</div></div>
      ${d.stats.pom ? `<div class="card row"><span style="font-size:28px">⭐</span><b>${plural(d.stats.pom, 'Player of the Match award')}</b></div>` : ''}
      ${d.recent.length ? `<div class="section"><h2>Recent innings</h2></div><div class="card flush list">${d.recent.map(r => `<div class="item" onclick="go('#/match/${r.match_id}')"><div class="grow"><div class="t">${esc(r.t1)} vs ${esc(r.t2)}</div><div class="s">${esc(r.title || '')} ${esc(fmtDate(r.match_date, false))}</div></div><b class="big-num">${r.runs}${r.out_ ? '' : '*'}</b><span class="muted small">(${r.balls})</span></div>`).join('')}</div>` : ''}
    </div>`, 'teams');
}

/* =====================================================================
   TOURNAMENTS
   ===================================================================== */
const FORMAT = { league: 'League (round robin)', knockout: 'Knockout', league_final: 'League + Final' };
const stPill = s => s === 'ongoing' ? '<span class="pill live">Ongoing</span>' : s === 'completed' ? '<span class="pill done">Completed</span>' : '<span class="pill up">Upcoming</span>';
async function viewTournaments() {
  mount(topbar('Tournaments') + `<div class="content">${sk(3)}</div><button class="fab" aria-label="New tournament" onclick="go('#/tournament/new')">${I.plus}</button>`, 'tournaments');
  const d = await api('tournaments_list');
  mount(topbar('Tournaments') + `<div class="content">${d.tournaments.length ? d.tournaments.map(t => `<div class="card" style="cursor:pointer" onclick="go('#/tournament/${t.id}')">
      <div class="row"><span style="font-size:30px">🏆</span><div class="grow"><b style="font-size:17px">${esc(t.name)}</b><div class="small muted">${FORMAT[t.format]} · ${esc(t.type_name || 'Custom')} · ${plural(+t.teams, 'team')}</div></div>${stPill(t.state)}</div>
      <div class="progress"><i style="width:${t.matches ? Math.round(t.done / t.matches * 100) : 0}%"></i></div>
      <div class="small muted" style="margin-top:6px">${t.done}/${t.matches} matches played${t.start_date ? ' · starts ' + esc(fmtDate(t.start_date, false)) : ''}${t.mine ? '' : ' · by ' + esc(t.owner_name)}</div></div>`).join('')
    : `<div class="card empty"><div class="big">🏆</div>No tournaments yet.<br>Create your own league like the IPL!<br><button class="btn" style="margin-top:12px" onclick="go('#/tournament/new')">Create tournament</button></div>`}</div>
    <button class="fab" aria-label="New tournament" onclick="go('#/tournament/new')">${I.plus}</button>`, 'tournaments');
}
async function viewTournamentForm(id) {
  mount(topbar(id ? 'Edit Tournament' : 'New Tournament', { back: true }) + `<div class="content">${sk(4)}</div>`, 'tournaments');
  const [ty, tm] = await Promise.all([api('types_list'), api('teams_list')]);
  let t = { name: '', format: 'league', match_type_id: (ty.types.find(x => x.name === 'T20') || ty.types[0]).id, start_date: new Date().toISOString().slice(0, 10), end_date: '', venue: '' };
  S.tsel = new Set();
  if (id) { const d = await api('tournament_get', { id: +id }); t = d.tournament; if (!t.can_edit) return go('#/tournament/' + id); d.teams.forEach(x => S.tsel.add(+x.id)); }
  S.tteams = tm.teams;
  mount(topbar(id ? 'Edit Tournament' : 'New Tournament', { back: true }) + `<form class="content" onsubmit="App.saveTournament(event,${id || 0})">
    <div class="card">
      <div class="field"><label>Tournament name</label><input class="input" name="name" value="${esc(t.name)}" placeholder="e.g. Diwali Premier League" required></div>
      <div class="field"><label>Format</label><select class="input" name="format">${Object.entries(FORMAT).map(([k, l]) => `<option value="${k}" ${t.format === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="field"><label>Match type</label><select class="input" name="match_type_id">${ty.types.map(x => `<option value="${x.id}" ${+t.match_type_id === x.id ? 'selected' : ''}>${esc(x.name)} — ${x.overs} overs, ${x.players_per_side} a side</option>`).join('')}</select></div>
      <div class="grid2"><div class="field"><label>Start date</label><input class="input" type="date" name="start_date" value="${esc(t.start_date || '')}"></div>
      <div class="field"><label>End date</label><input class="input" type="date" name="end_date" value="${esc(t.end_date || '')}"></div></div>
      <div class="field"><label>Venue</label><input class="input" name="venue" value="${esc(t.venue || '')}" placeholder="optional"></div>
    </div>
    <div class="section"><h2>Teams</h2><span class="small muted" id="tcount">${S.tsel.size} selected</span></div>
    <div class="search">${I.search}<input class="input" placeholder="Search teams" oninput="App.filterList(this.value)"></div>
    <div class="plist">${tm.teams.map(x => `<button type="button" class="pbtn ${S.tsel.has(x.id) ? 'on' : ''}" data-q="${esc((x.name + ' ' + x.short_name + ' ' + x.category).toLowerCase())}" data-tid="${x.id}" onclick="App.tToggle(${x.id},this)"><span class="chk">${S.tsel.has(x.id) ? '✓' : ''}</span>${badge(x, 'sm')} ${esc(x.name)}<span class="s">${{ ipl: 'IPL', international: 'Intl', custom: 'Custom' }[x.category]}</span></button>`).join('')}</div>
    <button class="btn block" style="margin:8px 0 20px">${id ? 'Save tournament' : 'Create tournament →'}</button></form>`, 'tournaments');
}
App.tToggle = (id, el) => {
  S.tsel.has(id) ? S.tsel.delete(id) : S.tsel.add(id);
  el.classList.toggle('on', S.tsel.has(id)); el.querySelector('.chk').textContent = S.tsel.has(id) ? '✓' : '';
  $('#tcount').textContent = S.tsel.size + ' selected';
};
App.saveTournament = (e, id) => {
  e.preventDefault();
  if (S.tsel.size < 2) return toast('Pick at least 2 teams', true);
  run(async () => { const f = formData(e.target); f.id = id; f.team_ids = [...S.tsel]; const r = await api('tournament_save', f); toast(id ? 'Saved' : 'Tournament created! 🏆'); go('#/tournament/' + r.id); }, e.submitter);
};
async function viewTournament(id) {
  mount(topbar('Tournament', { back: true }) + `<div class="content">${sk(4)}</div>`, 'tournaments');
  const d = await api('tournament_get', { id: +id }); S.tour = d;
  const t = d.tournament;
  const tabs = [['matches', 'Matches'], ['points', 'Points'], ['leaders', 'Stats'], ['teams', 'Teams']];
  let body = '';
  if (S.tTab === 'points') {
    body = `<div class="card flush"><table class="tbl"><tr><th>Team</th><th>P</th><th>W</th><th>L</th><th>T/NR</th><th>Pts</th><th>NRR</th></tr>
      ${d.points.map((r, i) => `<tr onclick="go('#/team/${r.id}')"><td><div class="row" style="gap:8px"><span class="muted small">${i + 1}</span>${badge(r, 'sm')}<b>${esc(r.short_name)}</b></div></td><td>${r.p}</td><td>${r.w}</td><td>${r.l}</td><td>${r.t + r.nr}</td><td><b>${r.pts}</b></td><td>${r.nrr > 0 ? '+' : ''}${r.nrr.toFixed(3)}</td></tr>`).join('')}</table></div>
      <div class="small muted">Win = 2 pts, tie / no result = 1 pt. NRR = net run rate.</div>`;
  } else if (S.tTab === 'leaders') {
    body = leaderBlock('🏏 Most runs', d.leaders.runs, r => r.runs, r => `${r.balls} balls · SR ${r.balls ? (r.runs * 100 / r.balls).toFixed(1) : 0}`)
      + leaderBlock('🎯 Most wickets', d.leaders.wickets, r => r.wkts, r => `${r.runs} runs · ${Math.floor(r.balls / 6)}.${r.balls % 6} ov`)
      + leaderBlock('💥 Most sixes', d.leaders.sixes, r => r.sixes, r => `${r.runs} runs`);
  } else if (S.tTab === 'teams') {
    body = `<div class="card flush list">${d.teams.map(x => `<div class="item" onclick="go('#/team/${x.id}')">${badge(x)}<div class="grow"><div class="t">${esc(x.name)}</div><div class="s">${plural(+x.players, 'player')}</div></div><span class="chev">${I.chev}</span></div>`).join('')}</div>`;
  } else {
    body = (t.can_edit ? `<div class="grid2" style="margin-bottom:12px">${d.matches.length ? '' : `<button class="btn" onclick="App.fixtures(this)">⚡ Auto fixtures</button>`}<button class="btn light" ${d.matches.length ? 'style="grid-column:1/-1"' : ''} onclick="go('#/match/new?t=${t.id}')">${I.plus} Add match</button></div>` : '')
      + (d.matches.length ? d.matches.map(matchCard).join('') : `<div class="card empty"><div class="big">📅</div>No matches yet.${t.can_edit ? `<br>Tap <b>Auto fixtures</b> to create ${t.format === 'knockout' ? 'round-1 knockout' : 'all league'} matches.` : ''}</div>`);
  }
  const actions = t.can_edit ? `<button class="icon-btn" aria-label="Options" onclick="App.tourMenu()">${I.dots}</button>` : '';
  mount(topbar(t.name, { back: true, actions, sub: FORMAT[t.format] }) + `<div class="board" style="padding:16px">
      <div class="row"><span style="font-size:40px">🏆</span><div class="grow"><b style="font-family:var(--display);font-size:24px">${esc(t.name)}</b>
      <div class="other" style="margin:0">${esc(t.type_name || 'Custom')} · ${t.overs || '?'} overs · ${plural(d.teams.length, 'team')}</div>
      <div class="other" style="margin:0">${t.start_date ? esc(fmtDate(t.start_date, false)) : ''}${t.end_date ? ' – ' + esc(fmtDate(t.end_date, false)) : ''}${t.venue ? ' · ' + esc(t.venue) : ''}</div></div>${stPill(t.state)}</div>
      <div class="progress" style="background:rgba(255,255,255,.15)"><i style="background:var(--lime);width:${t.matches ? Math.round(t.done / t.matches * 100) : 0}%"></i></div>
      <div class="other">${t.done}/${t.matches} matches played</div></div>
    <div class="content"><div class="seg">${tabs.map(([k, l]) => `<button class="${S.tTab === k ? 'on' : ''}" onclick="S.tTab='${k}';render()">${l}</button>`).join('')}</div>${body}</div>`, 'tournaments');
}
function leaderBlock(title, list, val, sub) {
  return `<div class="section"><h2>${title}</h2></div>` + (list.length ? `<div class="card flush list">${list.map((r, i) => `<div class="item" onclick="go('#/player/${r.pid}')"><span class="rank">${['🥇', '🥈', '🥉'][i] || i + 1}</span>${badge({ short_name: r.team, color: r.color }, 'sm')}
    <div class="grow"><div class="t ellipsis">${esc(r.name)}</div><div class="s">${sub(r)}</div></div><b class="big-num">${val(r)}</b></div>`).join('')}</div>` : '<div class="card empty small">No data yet — play some matches!</div>');
}
App.fixtures = btn => run(async () => { const r = await api('tournament_fixtures', { id: S.tour.tournament.id }); toast(`${plural(r.created, 'match')} created ✓`); render(); }, btn);
App.tourMenu = () => sheet(`<h3>Tournament options</h3><div class="plist">
  <button class="pbtn" onclick="go('#/tournament/${S.tour.tournament.id}/edit')">✏️ Edit tournament & teams</button>
  <button class="pbtn" onclick="go('#/match/new?t=${S.tour.tournament.id}')">➕ Add a match (e.g. Final)</button>
  <button class="pbtn" style="color:var(--red)" onclick="App.deleteTour()">🗑️ Delete tournament</button></div>`);
App.deleteTour = () => confirmSheet('Delete tournament?', 'The tournament and ALL its matches will be deleted.', 'Delete', () => run(async () => { await api('tournament_delete', { id: S.tour.tournament.id, with_matches: 1 }); closeSheet(); toast('Tournament deleted'); go('#/tournaments'); }));

/* =====================================================================
   STATS, MORE, MATCH TYPES, PROFILE
   ===================================================================== */
async function viewStats() {
  const tabs = [['runs', 'Runs'], ['wickets', 'Wickets'], ['sixes', 'Sixes'], ['fours', 'Fours']];
  mount(topbar('Leaderboard', { back: true }) + `<div class="content"><div class="seg">${tabs.map(([k, l]) => `<button class="${S.statTab === k ? 'on' : ''}" onclick="S.statTab='${k}';render()">${l}</button>`).join('')}</div><div id="lb">${sk(4)}</div></div>`, 'more');
  const d = await api('leaderboards');
  const cfg = {
    runs: ['🏏 Top run scorers', r => r.runs, r => `${plural(r.mats, 'match')} · ${r.balls} balls · SR ${r.balls ? (r.runs * 100 / r.balls).toFixed(1) : 0}`],
    wickets: ['🎯 Top wicket takers', r => r.wkts, r => `${plural(r.mats, 'match')} · ${r.runs} runs · econ ${r.balls ? (r.runs * 6 / r.balls).toFixed(2) : 0}`],
    sixes: ['💥 Six machines', r => r.sixes, r => `${r.runs} runs`],
    fours: ['⚡ Boundary hitters', r => r.fours, r => `${r.runs} runs`],
  }[S.statTab];
  $('#lb').innerHTML = leaderBlock(cfg[0], d[S.statTab], cfg[1], cfg[2]);
}
function viewMore() {
  const u = S.user;
  const item = (ic, t, s, fn) => `<div class="item" onclick="${fn}"><span class="tile ic" style="box-shadow:none;padding:0;width:38px;height:38px;justify-content:center">${ic}</span><div class="grow"><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div><span class="chev">${I.chev}</span></div>`;
  mount(topbar('More') + `<div class="content">
    <div class="card row"><span class="avatar" style="width:52px;height:52px;font-size:20px;background:var(--pitch);color:#fff">${esc(u.display_name.slice(0, 1).toUpperCase())}</span>
      <div class="grow"><b style="font-size:18px">${esc(u.display_name)}</b><div class="small muted">@${esc(u.username)}${u.is_admin ? ' · Admin' : ''}</div></div>
      <button class="btn sm light" onclick="go('#/profile')">Edit</button></div>
    <div class="card flush list">
      ${item('📊', 'Leaderboard', 'Top run scorers & wicket takers', "go('#/stats')")}
      ${item('⚙️', 'Match types', 'T20, ODI, Gully cricket & your own', "go('#/types')")}
      ${item('🧢', 'Our teams', 'Teams you and your friends made', "go('#/teams?c=custom')")}
      ${item('🔊', 'Sound & commentary', (Sound.sfx ? 'Sounds on' : 'Sounds off') + ' · ' + (Sound.voice ? 'voice on' : 'voice muted'), 'App.soundSheet()')}
      ${item('📲', 'Install app', 'Add Cric-Scorer to your home screen', 'App.installHelp()')}
      ${item('🔄', 'Update app', 'Version ' + esc(window.CS_VERSION || '') + (S.newVersion ? ' · new version ' + esc(S.newVersion) + ' available!' : ' · reload the latest code'), 'App.updateApp()')}
      ${item('ℹ️', 'About Cric-Scorer', 'How scoring works', 'App.about()')}
    </div>
    <button class="btn light block" style="color:var(--red)" onclick="App.logout()">Log out</button>
    <p class="small muted" style="text-align:center;margin-top:18px">Cric-Scorer · by Aaryush 🏏</p></div>`, 'more');
}
App.about = () => sheet(`<div style="text-align:center">${LOGO.replace('class="logo"', 'style="width:64px;height:64px"')}<h3>Cric-Scorer</h3><div class="sub">by Aaryush · made for Aarush & Aayush</div></div>
  <div class="card" style="box-shadow:none;border:1px solid var(--line)"><b>Scoring tips</b><div class="small muted" style="margin-top:6px">
  • Tap <b>0–6</b> for runs off the bat.<br>• <b>WD</b> wide and <b>NB</b> no-ball add 1 run and don't count as a ball.<br>• <b>BYE/LB</b> are runs not off the bat.<br>• <b>OUT</b> records a wicket — pick how and who.<br>• Made a mistake? Tap <b>Undo</b> as many times as you need.<br>• Share the match link so family can watch the score live!</div></div>`);
async function viewTypes() {
  mount(topbar('Match Types', { back: true }) + `<div class="content">${sk(3)}</div>`, 'more');
  const d = await api('types_list'); S.types = d.types;
  mount(topbar('Match Types', { back: true }) + `<div class="content">${d.types.map(t => `<div class="card row" ${t.is_system && !S.user.is_admin ? '' : `style="cursor:pointer" onclick="App.typeForm(${t.id})"`}>
      <span class="badge" style="background:var(--pitch);color:#fff">${t.overs}</span><div class="grow"><b>${esc(t.name)}</b>${t.is_system ? ' <span class="role-tag">built-in</span>' : ''}
      <div class="small muted">${t.overs} overs · ${t.players_per_side} a side · ${t.max_overs_bowler ? t.max_overs_bowler + ' ov/bowler' : 'no bowling limit'}${t.last_man_stands ? ' · last man stands' : ''}</div></div></div>`).join('')}</div>
    <button class="fab" aria-label="New match type" onclick="App.typeForm(0)">${I.plus}</button>`, 'more');
}
App.typeForm = id => {
  const t = S.types.find(x => x.id === id) || { name: '', overs: 8, balls_per_over: 6, players_per_side: 8, max_overs_bowler: 0, last_man_stands: 0, description: '' };
  sheet(`<h3>${id ? 'Edit match type' : 'New match type'}</h3><form onsubmit="App.saveType(event,${id})">
    <div class="field"><label>Name</label><input class="input" name="name" value="${esc(t.name)}" placeholder="e.g. Terrace cricket" required></div>
    <div class="grid3"><div class="field"><label>Overs</label><input class="input" type="number" name="overs" min="1" max="100" value="${t.overs}"></div>
    <div class="field"><label>Balls/over</label><input class="input" type="number" name="balls_per_over" min="1" max="10" value="${t.balls_per_over}"></div>
    <div class="field"><label>Players</label><input class="input" type="number" name="players_per_side" min="1" max="15" value="${t.players_per_side}"></div></div>
    <div class="field"><label>Max overs per bowler (0 = no limit)</label><input class="input" type="number" name="max_overs_bowler" min="0" max="50" value="${t.max_overs_bowler}"></div>
    <label class="switch" style="margin-bottom:14px"><b>Last man stands</b><input type="checkbox" name="last_man_stands" ${+t.last_man_stands ? 'checked' : ''}><span class="knob"></span></label>
    <button class="btn block">Save</button>${id ? `<button type="button" class="btn light block" style="margin-top:8px;color:var(--red)" onclick="App.deleteType(${id})">Delete</button>` : ''}</form>`);
};
App.saveType = (e, id) => { e.preventDefault(); run(async () => { const f = formData(e.target); f.id = id; await api('type_save', f); closeSheet(); toast('Saved'); render(); }, e.submitter); };
App.deleteType = id => run(async () => { await api('type_delete', { id }); closeSheet(); render(); });
function viewProfile() {
  const u = S.user;
  mount(topbar('My Profile', { back: true }) + `<form class="content" onsubmit="App.saveProfile(event)"><div class="card">
    <div class="field"><label>Display name</label><input class="input" name="display_name" value="${esc(u.display_name)}" required></div>
    <div class="field"><label>Username</label><input class="input" value="${esc(u.username)}" disabled></div></div>
    <div class="section"><h2>Change password</h2></div><div class="card">
    <div class="field"><label>Current password</label><input class="input" type="password" name="current_password" autocomplete="current-password"></div>
    <div class="field"><label>New password</label><input class="input" type="password" name="new_password" minlength="6" autocomplete="new-password"></div></div>
    <button class="btn block">Save</button></form>`, 'more');
}
App.saveProfile = e => { e.preventDefault(); run(async () => { const r = await api('profile_save', formData(e.target)); S.user = r.user; toast('Profile saved'); go('#/more'); }, e.submitter); };

/* ---------- Refresh, pull-to-refresh & app updates ---------- */
App.refresh = async () => {
  if (S.refreshing) return;
  S.refreshing = true;
  document.querySelectorAll('.refresh-btn').forEach(b => b.classList.add('spin'));
  try {
    const me = await api('me');
    checkVersion(me.version);
    await render();
    if (!S.newVersion) toast('Updated ✓');
  } catch (e) { toast(e.message, true); }
  finally { S.refreshing = false; document.querySelectorAll('.refresh-btn').forEach(b => b.classList.remove('spin')); }
};
function checkVersion(v) {
  if (!v || !window.CS_VERSION || v === window.CS_VERSION || S.newVersion === v) return;
  S.newVersion = v;
  const bar = document.createElement('div');
  bar.className = 'update-bar';
  bar.innerHTML = `<span>🎉 New version ${esc(v)} is ready</span><button onclick="App.updateApp()">Update now</button>`;
  document.body.appendChild(bar);
}
App.updateApp = async () => {
  toast('Updating app…');
  try {
    if ('serviceWorker' in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
  } catch (e) { /* continue to reload */ }
  location.replace(location.pathname + '?r=' + Date.now() + location.hash);
};
function initPullToRefresh() {
  const ptr = $('#ptr');
  let startY = null, pull = 0;
  const reset = () => { ptr.style.transform = ''; ptr.classList.remove('ready', 'show'); startY = null; pull = 0; };
  window.addEventListener('touchstart', e => {
    if (window.scrollY > 0 || $('#sheet-root').children.length || e.touches.length !== 1) { startY = null; return; }
    startY = e.touches[0].clientY; pull = 0;
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0 || window.scrollY > 0) { reset(); return; }
    pull = Math.min(dy * 0.5, 110);
    ptr.classList.add('show'); ptr.classList.toggle('ready', pull > 70);
    ptr.style.transform = `translate(-50%, ${pull}px) rotate(${pull * 4}deg)`;
  }, { passive: true });
  window.addEventListener('touchend', () => {
    if (startY === null) return;
    const go = pull > 70;
    if (go) {
      ptr.classList.add('loading'); ptr.style.transform = 'translate(-50%, 60px)';
      App.refresh().finally(() => { ptr.classList.remove('loading'); reset(); });
    } else reset();
  }, { passive: true });
}

/* ---------- Boot ---------- */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.deferredInstall = e; });
(async function boot() {
  try { const me = await api('me'); S.user = me.user; checkVersion(me.version); } catch (e) { /* offline */ }
  initPullToRefresh();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) api('me').then(r => checkVersion(r.version)).catch(() => {}); });
  window.addEventListener('hashchange', () => { navDepth++; render(); });
  await render();
  const sp = $('#splash');
  if (sp) { setTimeout(() => sp.classList.add('out'), 350); setTimeout(() => sp.remove(), 900); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
