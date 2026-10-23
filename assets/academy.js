/* Cric-Scorer Academy — learn cricket: lessons first, then quizzes, stars, XP and ranks */
'use strict';
const Academy = (() => {
  let D = null;            // syllabus data (assets/academy.json)
  let P = null;            // my progress from the server
  const A = {};

  /* ---------- Field diagram (right-handed batter, batter's end at the top, off side on the left) ---------- */
  // [x, y, name, label dx, label dy, anchor]  — hand-placed on a 400×400 field, batter's stumps at y=140
  const POS = {
    keeper: [200, 100, 'Wicket-keeper', 0, -15], bowler: [200, 284, 'Bowler', 0, 27],
    'first-slip': [174, 104, '1st slip', 0, 27], 'second-slip': [150, 112, '2nd slip', 0, -15], 'third-slip': [128, 124, '3rd slip', -2, 27],
    gully: [104, 142, 'Gully', -14, 5, 'end'], 'fly-slip': [118, 56, 'Fly slip', 0, -15],
    'leg-slip': [226, 104, 'Leg slip', 12, -10, 'start'], 'leg-gully': [252, 124, 'Leg gully', 14, 5, 'start'],
    'short-leg': [230, 156, 'Short leg', 14, 5, 'start'], 'silly-point': [170, 158, 'Silly point', -4, 28],
    'silly-mid-off': [172, 194, 'Silly mid-off', -14, 5, 'end'], 'silly-mid-on': [228, 194, 'Silly mid-on', 14, 5, 'start'],
    point: [64, 150, 'Point', 0, 27], 'backward-point': [84, 108, 'Backward point', 0, -15], cover: [88, 212, 'Cover', 0, 27],
    'extra-cover': [120, 264, 'Extra cover', 0, 27], 'mid-off': [164, 304, 'Mid-off', -6, 27], 'mid-on': [236, 304, 'Mid-on', 6, 27],
    'mid-wicket': [306, 234, 'Mid-wicket', 0, 27], 'square-leg': [318, 146, 'Square leg', 0, 27], 'short-fine-leg': [270, 86, 'Short fine leg', 0, -15],
    'fine-leg': [290, 32, 'Fine leg', 0, 28], 'third-man': [112, 32, 'Third man', 0, 28],
    'deep-point': [12, 154, 'Deep point', 14, -14, 'start'], 'deep-cover': [28, 264, 'Deep cover', 14, -14, 'start'],
    'long-off': [160, 388, 'Long-off', -2, -15], 'long-on': [240, 388, 'Long-on', 2, -15], 'cow-corner': [320, 352, 'Cow corner', -12, -15, 'end'],
    'deep-mid-wicket': [376, 268, 'Deep mid-wicket', -14, -14, 'end'], 'deep-square-leg': [388, 152, 'Deep square leg', -14, -14, 'end'],
    straight: [200, 392, 'Straight', 0, -15],
  };
  A.posName = k => (POS[k] ? POS[k][2] : k);
  function fieldSVG(fig) {
    if (!fig || fig.type !== 'field') return '';
    const marks = (fig.mark || []).filter(k => POS[k]);
    const show = fig.labels !== false;
    const BAT = 140, BOWL = 262;
    let s = `<svg class="ac-field" viewBox="-14 -14 428 446" role="img" aria-label="Cricket field diagram">
      <defs><radialGradient id="grass" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#43a352"/><stop offset="1" stop-color="#2a7a3b"/></radialGradient>
      <marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#fff"/></marker></defs>
      <circle cx="200" cy="200" r="198" fill="url(#grass)" stroke="#fff" stroke-width="3"/>
      <circle cx="200" cy="200" r="124" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-dasharray="6 6"/>
      <rect x="191" y="${BAT - 8}" width="18" height="${BOWL - BAT + 16}" rx="2" fill="#d8c79a"/>
      <line x1="185" y1="${BAT + 6}" x2="215" y2="${BAT + 6}" stroke="#fff" stroke-width="1.5"/><line x1="185" y1="${BOWL - 6}" x2="215" y2="${BOWL - 6}" stroke="#fff" stroke-width="1.5"/>
      <rect x="196" y="${BAT - 2}" width="8" height="4" fill="#7a4a1d"/><rect x="196" y="${BOWL - 2}" width="8" height="4" fill="#7a4a1d"/>

      <text x="205" y="${BAT + 22}" class="ac-mini">🏏</text>
      <text x="0" y="420" class="ac-side2">◀ OFF SIDE</text><text x="400" y="420" text-anchor="end" class="ac-side2">LEG SIDE ▶</text>
      <text x="200" y="420" text-anchor="middle" class="ac-mini2">RH batter at top</text>`;
    for (const k of ['keeper', 'bowler']) if (!marks.includes(k)) s += `<circle cx="${POS[k][0]}" cy="${POS[k][1]}" r="5" fill="rgba(255,255,255,.55)"/>`;
    if (fig.arrow && POS[fig.arrow]) {
      const [x, y] = POS[fig.arrow];
      const ex = 200 + (x - 200) * 0.92, ey = BAT + 10 + (y - BAT - 10) * 0.92;
      s += `<line x1="200" y1="${BAT + 10}" x2="${ex}" y2="${ey}" stroke="#fff" stroke-width="4" stroke-linecap="round" marker-end="url(#ah)" class="ac-arrow"/>
            <circle cx="${ex}" cy="${ey}" r="7" fill="#d62839" stroke="#fff" stroke-width="2"/>`;
    }
    marks.forEach(k => { const [x, y] = POS[k]; s += `<circle cx="${x}" cy="${y}" r="10" fill="#ffd23f" stroke="#13241b" stroke-width="2.5" class="ac-dot"/>`; });
    marks.forEach(k => {
      const [x, y, name, lx = 0, ly = -15, anchor = 'middle'] = POS[k];
      s += show ? `<text x="${x + lx}" y="${y + ly}" text-anchor="${anchor}" class="ac-lbl">${esc(name)}</text>` : `<text x="${x}" y="${y + 5}" text-anchor="middle" class="ac-q">?</text>`;
    });
    return `<div class="ac-fig">${s}</svg></div>`;
  }
  A.fieldSVG = fieldSVG;
  const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const plain = t => String(t || '').replace(/\*\*/g, '');

  /* ---------- Data ---------- */
  async function ensure(force = false) {
    if (!D) D = await (await fetch('assets/academy.json?v=' + (window.CS_VERSION || ''), { cache: 'no-cache' })).json();
    if (!P || force) P = await api('academy_progress');
  }
  const lessons = () => D.modules.flatMap(m => m.lessons.map(l => ({ ...l, module: m })));
  const prog = id => P.progress[id] || null;
  const passed = id => (prog(id)?.stars || 0) >= 1;
  function unlocked(id) {
    if (S.user?.is_admin) return true;                         // parents can open anything
    const all = lessons();
    const i = all.findIndex(l => l.id === id);
    if (id === 'final') return all.every(l => passed(l.id));
    return i <= 0 || passed(all[i - 1].id);
  }
  const nextLesson = () => lessons().find(l => !passed(l.id)) || null;
  const starsHtml = (n, big = false) => `<span class="ac-stars ${big ? 'big' : ''}">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('')}</span>`;
  const moduleDone = m => m.lessons.every(l => passed(l.id));

  /* ---------- Home: syllabus, rank, leaderboard ---------- */
  A.home = async () => {
    mount(topbar('Cricket Academy') + `<div class="content">${sk(4)}</div>`, 'learn');
    await ensure(true);
    const r = P.rank, all = lessons();
    const done = all.filter(l => passed(l.id)).length;
    const stars = Object.values(P.progress).reduce((a, p) => a + p.stars, 0);
    const pct = r.next ? Math.round((P.xp - r.min) / (r.next.xp - r.min) * 100) : 100;
    const nx = nextLesson();
    const finalP = prog('final'), finalPassed = finalP && finalP.stars > 0;
    const mods = D.modules.map((m, mi) => {
      const mDone = m.lessons.filter(l => passed(l.id)).length;
      const mStars = m.lessons.reduce((a, l) => a + (prog(l.id)?.stars || 0), 0);
      const open = unlocked(m.lessons[0].id);
      const rows = m.lessons.map((l, li) => {
        const p = prog(l.id), u = unlocked(l.id);
        const icon = !u ? '🔒' : p && p.stars ? '✅' : (nx && nx.id === l.id ? '▶️' : '📖');
        return `<div class="item ${u ? '' : 'locked'}" onclick="${u ? `go('#/learn/lesson/${l.id}')` : "toast('Pass the lesson before to unlock this one 🔒')"}">
          <span class="ac-ic">${icon}</span><div class="grow"><div class="t">${mi + 1}.${li + 1} ${esc(l.title)}</div>
          <div class="s">${l.emoji || ''} ${l.cards.length} cards · ${l.quiz.length} questions · ${l.minutes || 4} min${p ? ` · best ${p.best}/${p.total}` : ''}</div></div>
          ${p ? starsHtml(p.stars) : ''}</div>`;
      }).join('');
      return `<div class="card flush ac-mod ${open ? '' : 'locked'}">
        <div class="ac-mod-h"><span class="ac-mod-e">${m.emoji}</span><div class="grow"><b>Module ${mi + 1}: ${esc(m.title)}</b>
        <div class="small muted">${esc(m.desc || '')}</div>
        <div class="progress"><i style="width:${Math.round(mDone / m.lessons.length * 100)}%"></i></div>
        <div class="small muted" style="margin-top:4px">${mDone}/${m.lessons.length} lessons · ${mStars}/${m.lessons.length * 3} ★ ${moduleDone(m) ? ` · <b class="ac-badge">🎖️ ${esc(m.badge)} badge</b>` : ''}</div></div></div>
        <div class="list">${rows}</div></div>`;
    }).join('');
    const board = P.leaderboard.length ? `<div class="card flush list">${P.leaderboard.map((b, i) => `<div class="item ${b.me ? 'ac-me' : ''}"><span class="rank">${['🥇', '🥈', '🥉'][i] || i + 1}</span>
        <div class="grow"><div class="t">${esc(b.name)}${b.me ? ' (you)' : ''}</div><div class="s">${b.rank.icon} ${esc(b.rank.name)} · ${b.passed} lessons · ${b.stars} ★</div></div><b class="big-num">${b.xp}</b><span class="small muted">XP</span></div>`).join('')}</div>`
      : '<div class="card empty small">Finish a quiz to get on the leaderboard!</div>';
    mount(topbar('Cricket Academy') + `<div class="board ac-hero">
        <div class="row"><span class="ac-rank-ic">${r.icon}</span><div class="grow"><div class="small" style="opacity:.8">Your rank</div><b class="ac-rank">${esc(r.name)}</b></div>
        <div style="text-align:right"><b class="big-num" style="color:var(--lime)">${P.xp}</b><div class="small" style="opacity:.8">XP</div></div></div>
        <div class="progress" style="background:rgba(255,255,255,.15);margin-top:10px"><i style="background:var(--lime);width:${pct}%"></i></div>
        <div class="other">${r.next ? `${r.next.xp - P.xp} XP to ${r.next.icon} ${esc(r.next.name)}` : 'Top rank reached — you are a Cricket Legend!'}</div>
        <div class="ac-stats"><span><b>${done}/${all.length}</b> lessons</span><span><b>${stars}</b> ★ stars</span><span><b>${D.modules.filter(moduleDone).length}/${D.modules.length}</b> badges</span></div>
      </div>
      <div class="content">
        ${nx ? `<button class="btn lime block" style="margin-bottom:14px" onclick="go('#/learn/lesson/${nx.id}')">▶️ ${done ? 'Continue' : 'Start'}: ${esc(nx.title)}</button>`
             : `<button class="btn lime block" style="margin-bottom:14px" onclick="go('#/learn/quiz/final')">🏆 ${finalPassed ? 'Retake' : 'Take'} the Final Exam</button>`}
        <div class="notice">📚 <b>How it works:</b> read each lesson, then pass its quiz (60%+) to unlock the next. 3 ★ = 90%+. Pass every lesson to unlock the <b>Final Exam</b> and win your certificate!</div>
        <div class="section"><h2>Syllabus</h2><span class="small muted">${D.modules.length} modules · ${all.length} lessons</span></div>
        ${mods}
        <div class="card ac-final ${unlocked('final') ? '' : 'locked'}" onclick="${unlocked('final') ? "go('#/learn/quiz/final')" : "toast('Pass all lessons to unlock the Final Exam 🔒')"}">
          <div class="row"><span style="font-size:40px">${unlocked('final') ? '🏆' : '🔒'}</span><div class="grow"><b style="font-size:17px">${esc(D.final?.title || 'Final Exam')}</b>
          <div class="small muted">${D.final ? D.final.quiz.length : 0} questions from the whole syllabus · pass mark 75%</div>
          ${finalP ? `<div class="small" style="margin-top:4px">Best: ${finalP.best}/${finalP.total} ${starsHtml(finalP.stars)}</div>` : ''}</div></div>
          ${finalPassed ? `<button class="btn block" style="margin-top:10px" onclick="event.stopPropagation();go('#/learn/certificate')">🎓 View my certificate</button>` : ''}</div>
        <div class="section"><h2>🏅 Academy leaderboard</h2></div>${board}
        <div class="section"><h2>Ranks</h2></div>
        <div class="card flush list">${P.ranks.map(x => `<div class="item ${x.name === r.name ? 'ac-me' : ''}"><span class="ac-ic">${x.icon}</span><div class="grow t">${esc(x.name)}</div><span class="small muted">${x.xp} XP</span></div>`).join('')}</div>
        <p class="small muted" style="text-align:center;margin-top:14px">XP = 10 per correct answer + 10 per star (best attempt counts). Final exam counts double.</p>
      </div>`, 'learn');
  };

  /* ---------- Lesson: teaching cards ---------- */
  A.lesson = async (id, startAt = 0) => {
    await ensure();
    const l = lessons().find(x => x.id === id);
    if (!l) return go('#/learn');
    if (!unlocked(id)) { toast('This lesson is locked 🔒'); return go('#/learn'); }
    S.acLesson = { id, i: startAt };
    drawLesson();
  };
  function drawLesson() {
    const st = S.acLesson, l = lessons().find(x => x.id === st.id), c = l.cards[st.i], last = st.i === l.cards.length - 1;
    const dots = l.cards.map((_, k) => `<i class="${k === st.i ? 'on' : k < st.i ? 'done' : ''}"></i>`).join('');
    mount(topbar(l.title, { back: true, sub: `Module: ${l.module.title}`, refresh: false, actions: `<button class="icon-btn" aria-label="Read aloud" onclick="Academy.readCard()">${SPK}</button>` }) +
      `<div class="content"><div class="ac-dots">${dots}</div>
        <div class="card ac-card"><div class="ac-card-n">Card ${st.i + 1} of ${l.cards.length}</div>
          <h2 class="ac-card-t">${st.i === 0 ? (l.emoji || '') + ' ' : ''}${md(c.title)}</h2>
          ${fieldSVG(c.fig)}
          ${(c.body || []).map(b => `<p>${md(b)}</p>`).join('')}
          ${c.fact ? `<div class="ac-fact">💡 ${md(c.fact)}</div>` : ''}
        </div>
        <div class="grid2"><button class="btn light" ${st.i === 0 ? 'disabled' : ''} onclick="Academy.card(-1)">← Back</button>
        ${last ? `<button class="btn red" onclick="go('#/learn/quiz/${l.id}')">Start quiz →</button>` : `<button class="btn" onclick="Academy.card(1)">Next →</button>`}</div>
        ${last ? `<p class="small muted" style="text-align:center">${l.quiz.length} questions · you need ${Math.ceil(l.quiz.length * 0.6)} right to pass</p>` : ''}
      </div>`, null);
  }
  A.card = d => {
    const l = lessons().find(x => x.id === S.acLesson.id);
    S.acLesson.i = Math.max(0, Math.min(l.cards.length - 1, S.acLesson.i + d));
    Sound.stopVoice(); drawLesson();
  };
  A.readCard = () => {
    const l = lessons().find(x => x.id === S.acLesson.id), c = l.cards[S.acLesson.i];
    Sound.unlock(); if (!Sound.voice) Sound.setVoice(true);
    Sound.say([c.title, ...(c.body || []), c.fact ? 'Did you know? ' + c.fact : ''].map(plain).join('. '), { delay: 50 });
  };

  /* ---------- Quiz ---------- */
  const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  A.quiz = async id => {
    await ensure();
    const isFinal = id === 'final';
    const src = isFinal ? D.final : lessons().find(x => x.id === id);
    if (!src) return go('#/learn');
    if (!unlocked(id)) { toast(isFinal ? 'Pass every lesson to unlock the Final Exam 🔒' : 'This quiz is locked 🔒'); return go('#/learn'); }
    // Keep original question indices so the server can mark; shuffle answer options for every attempt
    const qs = src.quiz.map((q, i) => ({ ...q, i, order: q.options.length === 2 && /^(true|false)$/i.test(q.options[0]) ? [0, 1] : shuffle(q.options.map((_, k) => k)) }));
    S.acQuiz = { id, title: isFinal ? src.title : src.title, qs: isFinal ? shuffle(qs) : qs, n: 0, answers: {}, picked: null, streak: 0, best: 0, right: 0 };
    drawQuestion();
  };
  function drawQuestion() {
    const z = S.acQuiz, q = z.qs[z.n], answered = z.picked !== null;
    const bar = z.qs.map((qq, k) => { const a = z.answers[qq.i]; return `<i class="${k === z.n ? 'on' : a === undefined ? '' : a === qq.a ? 'ok' : 'bad'}"></i>`; }).join('');
    const opts = q.order.map(k => {
      let cls = '';
      if (answered) { if (k === q.a) cls = 'ok'; else if (k === z.picked) cls = 'bad'; else cls = 'dim'; }
      return `<button class="ac-opt ${cls}" ${answered ? 'disabled' : ''} onclick="Academy.pick(${k})">${md(q.options[k])}</button>`;
    }).join('');
    mount(topbar(z.id === 'final' ? 'Final Exam' : 'Quiz: ' + z.title, { back: true, refresh: false, sub: `Question ${z.n + 1} of ${z.qs.length}` }) +
      `<div class="content"><div class="ac-qbar">${bar}</div>
        <div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="pill">${z.right} correct</span>${z.streak >= 2 ? `<span class="pill live" style="background:#f97316">🔥 ${z.streak} in a row</span>` : ''}</div>
        <div class="card ac-qcard"><div class="ac-qn">Q${z.n + 1}</div><h2 class="ac-qt">${md(q.q)}</h2>${fieldSVG(q.fig)}</div>
        <div class="ac-opts">${opts}</div>
        ${answered ? `<div class="ac-ex ${z.picked === q.a ? 'ok' : 'bad'}"><b>${z.picked === q.a ? pickPraise() : 'Not quite!'}</b> ${md(q.ex || '')}</div>
          <button class="btn block" onclick="Academy.nextQ(this)">${z.n === z.qs.length - 1 ? 'See my score 🏁' : 'Next question →'}</button>` : ''}
      </div>`, null);
  }
  const PRAISE = ['Correct! 🎉', 'Spot on! 🏏', 'Brilliant! ⭐', 'Howzat — right! ☝️', 'Superb! 🔥', 'Well played! 👏'];
  let lastPraise = PRAISE[0];
  const pickPraise = () => lastPraise;
  A.pick = k => {
    const z = S.acQuiz, q = z.qs[z.n];
    if (z.picked !== null) return;
    z.picked = k; z.answers[q.i] = k;
    Sound.unlock();
    if (k === q.a) { z.right++; z.streak++; z.best = Math.max(z.best, z.streak); lastPraise = PRAISE[Math.floor(Math.random() * PRAISE.length)]; Sound.fx('correct'); if (navigator.vibrate) navigator.vibrate(15); }
    else { z.streak = 0; Sound.fx('wrong'); if (navigator.vibrate) navigator.vibrate([30, 40, 30]); }
    drawQuestion();
    setTimeout(() => document.querySelector('.ac-ex')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };
  A.nextQ = btn => {
    const z = S.acQuiz;
    if (z.n < z.qs.length - 1) { z.n++; z.picked = null; drawQuestion(); window.scrollTo(0, 0); return; }
    const src = z.id === 'final' ? D.final.quiz : lessons().find(x => x.id === z.id).quiz;
    const answers = src.map((_, i) => z.answers[i]);
    run(async () => {
      const r = await api('academy_submit', { lesson_id: z.id, answers });
      P = null; await ensure(true);
      drawResult(r);
    }, btn);
  };
  function drawResult(r) {
    const z = S.acQuiz, isFinal = r.lesson_id === 'final';
    const pct = Math.round(r.correct / r.total * 100);
    const all = lessons(), i = all.findIndex(l => l.id === r.lesson_id), next = all[i + 1];
    const rankUp = r.rank.name !== r.rank_before.name;
    const title = isFinal ? (r.passed ? 'You passed the Final Exam!' : 'Not passed yet') : (r.stars === 3 ? 'Perfect innings!' : r.passed ? 'Lesson passed!' : 'So close!');
    mount(topbar(isFinal ? 'Final Exam' : 'Quiz result', { back: false, refresh: false }) +
      `<div class="content"><div class="card ac-result">
        <div class="ac-res-emoji">${r.passed ? (r.stars === 3 ? '🏆' : '🎉') : '💪'}</div>
        <h2>${title}</h2>
        ${starsHtml(r.stars, true)}
        <div class="ac-score"><b>${r.correct}</b>/${r.total}<span>${pct}%</span></div>
        <div class="ac-xp">${r.xp_gained > 0 ? `+${r.xp_gained} XP` : r.new_best ? 'Best score kept' : 'No new XP — beat your best score to earn more'}</div>
        <div class="small muted">Best streak: ${z.best} 🔥 · Pass mark ${Math.round(r.pass_mark * 100)}%</div>
        ${rankUp ? `<div class="ac-rankup">⬆️ Rank up! <b>${r.rank.icon} ${esc(r.rank.name)}</b></div>` : ''}
        ${!r.passed ? `<p class="small" style="margin-top:10px">${isFinal ? 'Revise the modules where you dropped marks, then try again.' : 'Read the lesson cards again — every answer is in them — then retry.'}</p>` : ''}
      </div>
      <div class="plist">
        ${r.passed && next && !isFinal ? `<button class="btn block" onclick="go('#/learn/lesson/${next.id}')">Next lesson: ${esc(next.title)} →</button>` : ''}
        ${r.passed && !next && !isFinal ? `<button class="btn block" onclick="go('#/learn/quiz/final')">🏆 Take the Final Exam</button>` : ''}
        ${isFinal && r.passed ? `<button class="btn block" onclick="go('#/learn/certificate')">🎓 Get my certificate</button>` : ''}
        ${!r.passed && !isFinal ? `<button class="btn block" onclick="Academy.lesson('${r.lesson_id}')">📖 Read the lesson again</button>` : ''}
        <button class="btn light block" onclick="Academy.quiz('${r.lesson_id}')">🔁 Try again</button>
        <button class="btn light block" onclick="Academy.review()">📝 Review my answers</button>
        <button class="btn light block" onclick="go('#/learn')">← Back to syllabus</button>
      </div></div>`, 'learn');
    S.acLast = r;
    // Celebrate
    if (r.passed) {
      Sound.fx(r.stars === 3 || isFinal ? 'win' : 'cheer');
      if (r.stars === 3 || isFinal || rankUp) confetti();
      popup(isFinal ? 'CERTIFIED!' : r.stars === 3 ? '3 STARS!' : 'PASSED!', `${r.correct}/${r.total} correct`, 'ms', isFinal ? '🎓' : '⭐');
    } else Sound.fx('wrong');
    const spoken = (r.passed ? `Well done ${S.user.display_name}! ` : `Good try ${S.user.display_name}. `) + `You scored ${r.correct} out of ${r.total}` +
      (r.passed ? `, and earned ${r.stars} star${r.stars === 1 ? '' : 's'}.` : '. Read the lesson again and have another go.') + (rankUp ? ` Rank up! You are now a ${r.rank.name}!` : '');
    Sound.say(spoken, { delay: 600 });
  }
  A.review = () => {
    const z = S.acQuiz;
    sheet(`<h3>Your answers</h3><div class="sub">${z.right}/${z.qs.length} correct</div>` + z.qs.map((q, k) => {
      const a = z.answers[q.i], ok = a === q.a;
      return `<div class="ac-rev ${ok ? 'ok' : 'bad'}"><div><b>${ok ? '✅' : '❌'} Q${k + 1}.</b> ${md(q.q)}</div>
        ${!ok ? `<div class="small">Your answer: ${md(q.options[a] ?? '—')}</div>` : ''}
        <div class="small"><b>Correct:</b> ${md(q.options[q.a])}</div><div class="small muted">${md(q.ex || '')}</div></div>`;
    }).join(''));
  };

  /* ---------- Certificate ---------- */
  A.certificate = async () => {
    await ensure(true);
    const f = prog('final');
    if (!f || !f.stars) { toast('Pass the Final Exam to earn your certificate'); return go('#/learn'); }
    const stars = Object.values(P.progress).reduce((a, p) => a + p.stars, 0);
    const date = new Date(String(f.date).replace(' ', 'T')).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    mount(topbar('My Certificate', { back: true, refresh: false, actions: `<button class="icon-btn" aria-label="Print" onclick="window.print()">🖨️</button>` }) +
      `<div class="content"><div class="ac-cert">
        <div class="ac-cert-in">
          <div class="ac-cert-logo">${LOGO}</div>
          <div class="ac-cert-k">Cric-Scorer Academy · by Aaryush</div>
          <div class="ac-cert-h">Certificate of Achievement</div>
          <div class="small">This certifies that</div>
          <div class="ac-cert-name">${esc(S.user.display_name)}</div>
          <div class="small">has completed the full cricket syllabus — Laws of the Game, Field Positions, Batting, Bowling, Fielding & Wicket-keeping — and passed the Final Exam with</div>
          <div class="ac-cert-score">${f.best}/${f.total} · ${starsHtml(f.stars)}</div>
          <div class="ac-cert-t">🏏 Certified Cricket Expert 🏏</div>
          <div class="ac-cert-meta"><span>${esc(P.rank.icon + ' ' + P.rank.name)}<br><small>Rank</small></span><span>${P.xp} XP · ${stars} ★<br><small>Academy record</small></span><span>${esc(date)}<br><small>Date</small></span></div>
          <div class="ac-cert-sign"><span>Head Coach</span><span>Cric-Scorer Academy</span></div>
        </div></div>
        <button class="btn block" style="margin-top:12px" onclick="window.print()">🖨️ Print / save as PDF</button></div>`, 'learn');
    confetti();
  };

  return A;
})();
window.Academy = Academy;
