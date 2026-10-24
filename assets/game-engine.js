/* Cric-Scorer · Gully Duel - the rules (Cricket League style).
   Bowling: pick Fast / Swing / Spin (and In / Straight / Out), drag the marker to where the ball should land,
            and stop the power bar in the blue for a perfect ball (red = no-ball, then a free hit).
   Batting: swipe in the direction you want to hit as the ball reaches the bat. Short swipe = along the ground,
            long swipe = in the air, tap = block. Timing decides how well you hit it; the fielders decide the rest.
   The same rules run on the server (inc/game.php) for two-phone games - tools/test_game_parity.* keeps them identical.
   Directions are in degrees: 0 = straight back past the bowler, + = off side, - = leg side (right-handed batter). */
'use strict';
(function (root) {
  const TYPES = ['fast', 'swing', 'spin'];
  const TRAVEL = [880, 1000, 1200];                  // ms from release to the bat
  const LENGTHS = [[0.16, 'Yorker'], [0.42, 'Full'], [0.66, 'Good'], [0.84, 'Short'], [1.01, 'Bouncer']];
  // Fielders: [direction, distance (boundary = 1), name] - a different field for each kind of bowler
  const FIELDS = [
    [[150, 0.24, 'Slip'], [125, 0.3, 'Gully'], [98, 0.52, 'Point'], [55, 0.55, 'Cover'], [16, 0.48, 'Mid-off'], [-16, 0.48, 'Mid-on'], [-60, 0.55, 'Mid-wicket'], [-98, 0.52, 'Square leg'], [-155, 0.92, 'Fine leg']],
    [[150, 0.24, 'Slip'], [98, 0.52, 'Point'], [55, 0.55, 'Cover'], [16, 0.48, 'Mid-off'], [-16, 0.48, 'Mid-on'], [-60, 0.55, 'Mid-wicket'], [-98, 0.52, 'Square leg'], [155, 0.92, 'Third man'], [-25, 0.93, 'Long-on']],
    [[150, 0.2, 'Slip'], [95, 0.5, 'Point'], [50, 0.55, 'Cover'], [15, 0.5, 'Mid-off'], [-15, 0.5, 'Mid-on'], [-55, 0.55, 'Mid-wicket'], [-95, 0.92, 'Deep square leg'], [25, 0.93, 'Long-off'], [-28, 0.93, 'Long-on']],
  ];
  const RAD = 0.0174533;
  /* Your squad: everyone can bat and bowl, but each is better at something. bat: power (how far), timing (how forgiving).
     bowl: pace (speed), acc (accuracy), move (swing / turn). 1 = normal. The first three are free. */
  const CHARS = [
    { id: 'aarav', name: 'Aarav', tag: 'All-rounder', cost: 0, bat: { power: 1, timing: 1 }, bowl: { style: 1, pace: 1, acc: 1, move: 1 }, kit: '#1c7ed6' },
    { id: 'zara', name: 'Zara', tag: 'Fast bowler', cost: 0, bat: { power: 0.9, timing: 0.95 }, bowl: { style: 0, pace: 1.08, acc: 1.05, move: 0.9 }, kit: '#e8590c' },
    { id: 'rohan', name: 'Rohan', tag: 'Spinner', cost: 0, bat: { power: 0.9, timing: 1 }, bowl: { style: 2, pace: 1, acc: 1.05, move: 1.1 }, kit: '#2f9e44' },
    { id: 'kabir', name: 'Kabir', tag: 'Power hitter', cost: 200, bat: { power: 1.18, timing: 0.92 }, bowl: { style: 1, pace: 0.95, acc: 0.9, move: 0.9 }, kit: '#7048e8' },
    { id: 'meera', name: 'Meera', tag: 'Timing queen', cost: 200, bat: { power: 1, timing: 1.22 }, bowl: { style: 2, pace: 1, acc: 1, move: 0.9 }, kit: '#d6336c' },
    { id: 'dev', name: 'Dev', tag: 'Swing king', cost: 250, bat: { power: 0.95, timing: 1 }, bowl: { style: 1, pace: 1.02, acc: 1, move: 1.35 }, kit: '#0ca678' },
    { id: 'tara', name: 'Tara', tag: 'Leg-spinner', cost: 250, bat: { power: 0.92, timing: 1.05 }, bowl: { style: 2, pace: 0.98, acc: 0.95, move: 1.4 }, kit: '#f59f00' },
    { id: 'arjun', name: 'Arjun', tag: 'Express pace', cost: 400, bat: { power: 1, timing: 0.95 }, bowl: { style: 0, pace: 1.2, acc: 0.92, move: 1 }, kit: '#c92a2a' },
    { id: 'ishan', name: 'Ishan', tag: 'Finisher', cost: 400, bat: { power: 1.12, timing: 1.1 }, bowl: { style: 1, pace: 1, acc: 1, move: 1 }, kit: '#1864ab' },
    { id: 'sana', name: 'Sana', tag: 'Captain', cost: 600, bat: { power: 1.1, timing: 1.15 }, bowl: { style: 2, pace: 1, acc: 1.15, move: 1.2 }, kit: '#5c940d' },
    { id: 'vikram', name: 'Vikram', tag: 'Yorker machine', cost: 600, bat: { power: 0.95, timing: 1 }, bowl: { style: 0, pace: 1.12, acc: 1.3, move: 1.05 }, kit: '#343a40' },
    { id: 'aditi', name: 'Aditi', tag: 'Superstar', cost: 800, bat: { power: 1.2, timing: 1.2 }, bowl: { style: 1, pace: 1.1, acc: 1.1, move: 1.2 }, kit: '#e67700' },
  ];
  const charById = id => CHARS.find(c => c.id === id) || CHARS[0];
  /* Named deliveries: [bowler style, movement, special]. Style 0 = fast, 1 = swing/medium, 2 = spin */
  const BALLS = {
    seam: [0, 0, '', 'Seam-up'], outswing: [1, 1, '', 'Outswing'], inswing: [1, -1, '', 'Inswing'], bouncer: [0, 0, 'bouncer', 'Bouncer'],
    yorker: [0, 0, 'yorker', 'Yorker'], slower: [1, 0, 'slower', 'Slower ball'], cutter: [0, 1, '', 'Leg-cutter'],
    offbreak: [2, -1, '', 'Off-break'], legbreak: [2, 1, '', 'Leg-break'], doosra: [2, 1, 'doosra', 'Doosra'], flipper: [2, 0, 'flipper', 'Flipper'], arm: [2, 0, 'arm', 'Arm ball'],
  };
  const ballsFor = style => style === 0 ? ['seam', 'bouncer', 'yorker', 'cutter', 'slower'] : style === 1 ? ['outswing', 'inswing', 'slower', 'yorker', 'bouncer'] : ['offbreak', 'legbreak', 'doosra', 'flipper', 'arm'];
  const STADIUMS = [
    { id: 'mumbai', name: 'Mumbai', sky: ['#0b2a1a', '#174d2c'], grass: '#2f8a43', pitch: '#d9c88f', stand: '#1b3a66', night: true },
    { id: 'dubai', name: 'Dubai', sky: ['#1c1230', '#4a2a6b'], grass: '#2e9448', pitch: '#e2d4a0', stand: '#5f3dc4', night: true },
    { id: 'melbourne', name: 'Melbourne', sky: ['#7fbfe8', '#cfe7f8'], grass: '#3b9a4d', pitch: '#cdbf86', stand: '#495057', night: false },
    { id: 'london', name: "London", sky: ['#9fb6c9', '#dbe5ee'], grass: '#2f8a3c', pitch: '#c9bd8c', stand: '#6c3f1d', night: false },
    { id: 'johannesburg', name: 'Johannesburg', sky: ['#f3b36b', '#ffd9a0'], grass: '#4a9a3f', pitch: '#d5c38a', stand: '#8d2e2e', night: false },
    { id: 'dhaka', name: 'Dhaka', sky: ['#0d2b26', '#1f5a4d'], grass: '#2a8f46', pitch: '#dccf99', stand: '#0b7285', night: true },
  ];

  function rng(seed) {                               // mulberry32 - gives the same numbers in PHP
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t = (t ^ ((t + (Math.imul(t ^ (t >>> 7), t | 61) >>> 0)) >>> 0)) >>> 0;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const r3 = v => Math.floor(v * 1000 + 0.5) / 1000;  // same rounding in PHP
  const lengthName = l => LENGTHS.find(x => l < x[0])[1];
  const quality = v => { const e = Math.abs(v - 0.5) * 2; return e <= 0.12 ? 'perfect' : e <= 0.4 ? 'good' : e <= 0.85 ? 'ok' : 'noball'; };

  /** The ball that is actually bowled: x = line (0 middle stump, + off side), l = length (0 yorker … 1 bouncer), v = power bar 0…1 */
  /** The ball that is actually bowled. ball = a BALLS key (or '' for the plain type/varn), side = 1 over the wicket, -1 round, bst = bowler stats */
  function deliver(type, varn, x, l, v, seed, ball, side, bst) {
    const B = BALLS[ball || ''] || null, mod = B ? B[2] : '';
    if (B) { type = B[0]; varn = B[1]; }
    type = clamp(type | 0, 0, 2); varn = type === 0 && !B ? 0 : clamp(varn | 0, -1, 1);
    const st = bst || { pace: 1, acc: 1, move: 1 };
    side = side === -1 ? -1 : 1;
    const r = rng(seed), q = quality(clamp(+v || 0, 0, 1));
    const sc = { perfect: 0.03, good: 0.08, ok: 0.16, noball: 0.1 }[q] * (2 - st.acc);
    let aimL = +l;
    if (mod === 'bouncer') aimL = Math.max(aimL, 0.86);
    if (mod === 'yorker') aimL = Math.min(aimL, 0.1);
    const lx = r3(clamp(+x + (r() - 0.5) * 2 * sc + side * 0.05, -1.6, 1.6));
    const ll = r3(clamp(aimL + (r() - 0.5) * 1.6 * sc, 0, 1));
    const amt = varn * (type === 1 ? 0.35 : 0.45) * (q === 'perfect' ? 1.25 : q === 'good' ? 1 : 0.7) * st.move * (mod === 'doosra' ? 0.9 : 1);
    const fx = r3(lx + (type === 2 ? amt : amt * 0.4));
    let travel = TRAVEL[type] * (q === 'perfect' ? 0.94 : q === 'good' ? 1 : 1.05) / st.pace;
    if (mod === 'slower') travel *= 1.18;
    if (mod === 'flipper' || mod === 'arm') travel *= 0.92;
    travel = Math.round(travel);
    return { type, varn, x: lx, l: ll, fx, swing: r3(amt), q, travel, wide: Math.abs(lx) > 1.3, noball: q === 'noball', ball: B ? ball : '', mod, side };
  }

  function timingOf(d, shot, bst) {
    if (!shot || shot.k === 'none') return 'leave';
    let w = (bst && bst.timing) || 1;
    if (d.mod === 'slower' || d.mod === 'doosra') w *= 0.85;
    if (d.l < 0.16) w *= 0.75;
    if (d.l > 0.84) w *= 0.9;
    if (d.q === 'perfect') w *= 0.85;
    const a = Math.abs(+shot.dt || 0) / w;
    if (a <= 60) return 'perfect';
    if (a <= 125) return 'good';
    if (a <= 210) return 'ok';
    if (a <= 380) return shot.dt < 0 ? 'early' : 'late';
    return 'miss';
  }
  const CONTACT = { perfect: 1, good: 0.86, ok: 0.68, early: 0.45, late: 0.45, miss: 0 };

  /** One ball. shot = {k: 'none'|'tap'|'swipe', a: direction, p: power 0…1, dt: ms late (+) or early (-)} */
  function resolve(d, shot, seed, freeHit, bst) {
    bst = bst || { power: 1, timing: 1 };
    const r = rng(seed);
    const R = [r(), r(), r(), r(), r(), r()];
    const base = { kind: 'dot', runs: 0, extra: 0, legal: true, wicket: null, timing: 'leave', shot: 'leave', text: '', a: 0, dist: 0, loft: false, fielder: -1, free: !!freeHit };
    if (d.wide) return Object.assign(base, { kind: 'wide', runs: 0, extra: 1, legal: false, text: 'Wide ball! One extra run.' });
    const safe = !!freeHit || d.noball;
    if (d.noball) Object.assign(base, { extra: 1, legal: false });
    const timing = timingOf(d, shot, bst);
    const onStumps = Math.abs(d.fx) <= 0.42 && d.l < 0.78;
    const out = (w, text) => safe ? Object.assign(base, { text: (d.noball ? 'No-ball - ' : 'Free hit - ') + 'saved! ' + text.split('!')[0] + '… but not out!' })
      : Object.assign(base, { kind: 'out', wicket: w, text });
    base.timing = timing;
    base.shot = timing === 'leave' ? 'leave' : shot.k;
    if (timing === 'leave') {
      if (onStumps && R[0] < 0.6) return out(R[1] < 0.6 ? 'bowled' : 'lbw', R[1] < 0.6 ? 'Left it… and it crashed into the stumps!' : 'No shot, hit on the pad - LBW!');
      return Object.assign(base, { text: 'Left alone.' });
    }
    if (timing === 'miss') {
      if (onStumps && R[0] < 0.45) return out(R[1] < 0.6 ? 'bowled' : 'lbw', R[1] < 0.6 ? 'Missed it - clean bowled!' : 'Missed it, struck in front - LBW!');
      if (R[0] > 0.86) return out('caught', 'Thin edge… caught by the keeper!');
      return Object.assign(base, { text: 'Swing and a miss!' });
    }
    let c = CONTACT[timing];
    if (shot.k === 'tap') {                          // the block: safe, a single now and then
      if ((timing === 'early' || timing === 'late') && R[0] < 0.05) return out('caught', 'Bat-pad… snapped up close in!');
      const one = c >= 0.68 && R[1] < 0.35;
      return Object.assign(base, { kind: one ? 'runs' : 'dot', runs: one ? 1 : 0, a: (R[2] - 0.5) * 60, dist: one ? 0.3 : 0.12, text: one ? 'Pushed into the gap for a quick single.' : 'Solid block.' });
    }
    const p = clamp(+shot.p || 0, 0, 1);
    let a = clamp(+shot.a || 0, -170, 170);
    const loft = p >= 0.6;
    let edge = 0;
    if (timing === 'early') a -= 22 + R[1] * 18;
    else if (timing === 'late') a += 22 + R[1] * 18;
    else a += (R[1] - 0.5) * (timing === 'ok' ? 24 : timing === 'good' ? 12 : 5);
    if (d.fx > 0.6 && a < -45) { c *= 0.75; edge += 0.08; }          // dragging a ball wide of off stump to leg
    if (d.fx < -0.5 && a > 60) { c *= 0.8; edge += 0.06; }           // slicing a leg-side ball to off
    if (Math.abs(d.swing) > 0.2 && timing !== 'perfect') edge += 0.05;
    if (d.l > 0.84 && !loft) c *= 0.8;                               // hard to keep a bouncer down
    if (d.l < 0.16 && loft) c *= 0.8;                                // hard to loft a yorker
    if ((d.mod === 'flipper' || d.mod === 'arm') && loft) c *= 0.85;  // skidding balls stay low
    a = clamp(a, -175, 175);
    const edgeChance = timing === 'early' || timing === 'late' ? 0.18 + edge : timing === 'ok' ? 0.06 + edge : timing === 'good' ? 0.02 + edge * 0.5 : 0;
    if (R[0] < edgeChance) {
      if (R[2] < 0.4) return out('caught', 'Edged… and caught behind!');
      const four = p > 0.6 && R[3] < 0.3;
      return Object.assign(base, { kind: 'runs', runs: four ? 4 : 1, a: d.fx >= 0 ? 150 : -150, dist: four ? 1.05 : 0.5, text: four ? 'Edged… past the slips for FOUR!' : 'Thick edge, they run one.' });
    }
    const field = FIELDS[d.type];
    let dist = ((loft ? c * (0.42 + 0.66 * p) : c * (0.34 + 0.72 * p)) + (R[3] - 0.5) * 0.12) * bst.power;
    dist = clamp(dist, 0.05, 1.3);
    Object.assign(base, { a: r3(a), loft });
    if (!loft) {
      let hit = -1, best = 9;
      for (let i = 0; i < field.length; i++) {
        const f = field[i], lat = Math.abs(a - f[0]) * RAD * f[1];
        if (f[1] <= dist + 0.05 && lat < 0.075 && f[1] < best) { hit = i; best = f[1]; }
      }
      if (hit >= 0) {
        const f = field[hit];
        const runs = f[1] < 0.62 ? (p > 0.7 && c > 0.8 && R[4] < 0.3 ? 1 : 0) : (R[4] < 0.35 ? 2 : 1);
        return Object.assign(base, { kind: runs ? 'runs' : 'dot', runs, dist: r3(f[1]), fielder: hit, text: runs ? `${runs === 2 ? 'Two runs' : 'A single'} - fielded at ${f[2].toLowerCase()}.` : `Straight to ${f[2].toLowerCase()}. No run.` });
      }
      if (dist >= 0.98) return Object.assign(base, { kind: 'runs', runs: 4, dist: 1.05, text: `FOUR! Raced away ${zone(a)}.` });
      const runs = dist < 0.3 ? 0 : dist < 0.56 ? 1 : dist < 0.9 ? 2 : 3;
      return Object.assign(base, { kind: runs ? 'runs' : 'dot', runs, dist: r3(dist), text: runs ? `${runs} run${runs > 1 ? 's' : ''}, ${zone(a)}.` : 'Played softly. No run.' });
    }
    if (dist >= 1) {
      for (let i = 0; i < field.length; i++) {
        const f = field[i];
        if (f[1] >= 0.85 && Math.abs(a - f[0]) * RAD * f[1] < 0.11 && dist < 1.08 && R[4] < 0.6) return Object.assign(out('caught', `Caught right on the boundary at ${f[2].toLowerCase()}!`), { a: r3(a), loft: true, dist: r3(f[1]), fielder: i });
      }
      return Object.assign(base, { kind: 'runs', runs: 6, dist: r3(Math.min(dist, 1.25)), text: `SIX! Smashed ${zone(a)}!` });
    }
    for (let i = 0; i < field.length; i++) {
      const f = field[i];
      if (Math.abs(a - f[0]) * RAD * f[1] < 0.13 && Math.abs(f[1] - dist) < 0.2) {
        if (R[4] < (timing === 'perfect' ? 0.5 : 0.66)) return Object.assign(out('caught', `Up in the air… caught at ${f[2].toLowerCase()}!`), { a: r3(a), loft: true, dist: r3(f[1]), fielder: i });
        return Object.assign(base, { kind: 'runs', runs: 1, dist: r3(f[1]), fielder: i, text: `Dropped at ${f[2].toLowerCase()}! They scamper a single.` });
      }
    }
    const runs = dist >= 0.85 ? 4 : dist < 0.5 ? 1 : 2;
    return Object.assign(base, { kind: 'runs', runs, dist: r3(dist), text: runs === 4 ? `FOUR! Lofted ${zone(a)}, one bounce over the rope.` : `Lofted into the gap, ${runs} run${runs > 1 ? 's' : ''}.` });
  }
  function zone(a) {
    const A = Math.abs(a);
    if (A < 12) return 'straight down the ground';
    if (a > 0) return A < 35 ? 'past mid-off' : A < 75 ? 'through the covers' : A < 115 ? 'past point' : 'down to third man';
    return A < 35 ? 'past mid-on' : A < 75 ? 'through mid-wicket' : A < 115 ? 'past square leg' : 'down to fine leg';
  }

  /* ---------- A whole match: one innings each ---------- */
  function newInn(bat) { return { bat, runs: 0, wk: 0, balls: 0, fours: 0, sixes: 0, extras: 0, wd: 0, nb: 0, log: [], bowler: null }; }
  /** squads: [{bat: charId, bowl: [charId, …]}, …] for player 0 and 1 (optional - defaults to the free players) */
  function newGame(overs, wickets, firstBat, squads, stadium) {
    const def = { bat: 'aarav', bowl: ['zara', 'rohan', 'aarav'] };
    return { overs: clamp(overs | 0, 1, 20), wickets: clamp(wickets | 0, 1, 10), inn: [newInn(firstBat), newInn(1 - firstBat)], cur: 0, phase: 'bowl', ball: null, last: null, result: null, winner: null, n: 0, free: false,
      squads: [squadOk(squads && squads[0]) || def, squadOk(squads && squads[1]) || def], tmo: [0, 0], stadium: STADIUMS.some(s => s.id === stadium) ? stadium : 'mumbai' };
  }
  function squadOk(sq) {
    if (!sq || !CHARS.some(c => c.id === sq.bat)) return null;
    const bowl = (Array.isArray(sq.bowl) ? sq.bowl : []).filter(id => CHARS.some(c => c.id === id)).slice(0, 3);
    return bowl.length ? { bat: sq.bat, bowl } : null;
  }
  function batterStats(g) { return charById(g.squads[g.inn[g.cur].bat].bat).bat; }
  function bowlerOf(g) { const inn = g.inn[g.cur], sq = g.squads[1 - inn.bat]; return charById(inn.bowler && sq.bowl.includes(inn.bowler) ? inn.bowler : sq.bowl[0]); }
  /** Pick who bowls this over (only between overs, or before the first ball) */
  function setBowler(g, id) {
    const inn = g.inn[g.cur], sq = g.squads[1 - inn.bat];
    if (g.phase !== 'bowl' || inn.balls % 6 !== 0 || !sq.bowl.includes(id)) return false;
    inn.bowler = id; return true;
  }
  const oversStr = b => Math.floor(b / 6) + '.' + (b % 6);
  function bowl(g, type, varn, x, l, v, seed, ball, side) {
    if (g.phase !== 'bowl') throw new Error('Not time to bowl');
    const bw = bowlerOf(g);
    if (ball && !ballsFor(bw.bowl.style).includes(ball)) ball = '';
    const d = deliver(type, varn, x, l, v, seed, ball, side, bw.bowl);
    d.seed = seed >>> 0; d.id = ++g.n; d.free = g.free; d.bowler = bw.id;
    g.ball = d; g.phase = 'bat';
    return d;
  }
  function bat(g, shot) {
    if (g.phase !== 'bat' || !g.ball) throw new Error('No ball to play');
    const d = g.ball, res = resolve(d, shot, (d.seed ^ 0x5bd1e995) >>> 0, d.free, batterStats(g)), inn = g.inn[g.cur];
    inn.runs += res.runs + res.extra; inn.extras += res.extra;
    if (res.kind === 'wide') inn.wd++;
    if (d.noball) inn.nb++;
    if (res.legal) inn.balls++;
    if (res.kind === 'out') inn.wk++;
    if (res.runs === 4) inn.fours++;
    if (res.runs === 6) inn.sixes++;
    inn.log.push(res.kind === 'out' ? 'W' : res.kind === 'wide' ? 'wd' : d.noball ? 'nb' : String(res.runs));
    if (inn.log.length > 12) inn.log.shift();
    g.free = d.noball || (g.free && !res.legal);        // a free hit follows a no-ball
    res.id = d.id; res.delivery = d; res.inn = g.cur; res.noball = d.noball;
    g.last = res; g.ball = null; g.phase = 'bowl';
    const over = inn.balls >= g.overs * 6 || inn.wk >= g.wickets;
    if (inn.wd >= 3 || inn.nb >= 3) forfeit(g, 1 - inn.bat, inn.wd >= 3 ? 'wides' : 'noballs');   // three wides or three no-balls and the bowler loses
    else if (g.cur === 1 && inn.runs > g.inn[0].runs) finish(g);
    else if (over) { if (g.cur === 0) { g.cur = 1; g.free = false; res.inningsOver = true; } else finish(g); }
    return res;
  }
  /** A player ran out of time. The first time is a warning; the second loses the game. */
  function timeout(g, who) {
    g.tmo[who] = (g.tmo[who] || 0) + 1;
    if (g.tmo[who] >= 2) { forfeit(g, who, 'timeout'); return 'lost'; }
    return 'warning';
  }
  function forfeit(g, loser, reason) {
    g.phase = 'done'; g.ball = null; g.winner = 1 - loser; g.result = { by: 'forfeit', n: 0, reason };
  }
  function finish(g) {
    const a = g.inn[0], b = g.inn[1];
    g.phase = 'done';
    if (b.runs > a.runs) { g.winner = b.bat; g.result = { by: 'wickets', n: g.wickets - b.wk }; }
    else if (a.runs > b.runs) { g.winner = a.bat; g.result = { by: 'runs', n: a.runs - b.runs }; }
    else { g.winner = -1; g.result = { by: 'tie', n: 0 }; }
  }
  function resultText(g, names) {
    if (!g.result) return '';
    if (g.result.by === 'tie') return "It's a tie! 🤝";
    if (g.result.by === 'forfeit') return `${names[g.winner]} won - ${{ wides: 'three wides', noballs: 'three no-balls', timeout: 'opponent timed out twice', left: 'opponent left' }[g.result.reason] || 'forfeit'}`;
    const n = g.result.n, w = names[g.winner];
    return g.result.by === 'runs' ? `${w} won by ${n} run${n === 1 ? '' : 's'}` : `${w} won by ${n} wicket${n === 1 ? '' : 's'}`;
  }

  /* ---------- The computer ---------- */
  function cpuBowl(r, style) {
    const type = style === undefined ? (r() < 0.4 ? 0 : r() < 0.55 ? 1 : 2) : style;
    const balls = ballsFor(type), ball = balls[Math.floor(r() * balls.length)];
    const varn = type ? Math.floor(r() * 3) - 1 : 0;
    const pick = r();
    const l = pick < 0.14 ? 0.06 + r() * 0.06 : pick < 0.24 ? 0.86 + r() * 0.1 : 0.3 + r() * 0.42;
    const x = -0.3 + r() * 1.1;
    const v = 0.5 + (r() + r() + r() - 1.5) * 0.4;
    return { type, varn, x, l, v, ball, side: r() < 0.8 ? 1 : -1 };
  }
  function gaps(type) {                              // directions between fielders, for aiming
    const f = FIELDS[type].map(x => x[0]).filter(a => Math.abs(a) < 140).sort((a, b) => a - b), o = [];
    for (let i = 0; i < f.length - 1; i++) if (f[i + 1] - f[i] > 25) o.push((f[i] + f[i + 1]) / 2);
    return o;
  }
  function cpuBat(d, r, skill = 0.7) {
    if (Math.abs(d.fx) > 1.0 && r() < 0.6) return { k: 'none', a: 0, p: 0, dt: 0 };
    if (r() < 0.12) return { k: 'tap', a: 0, p: 0, dt: (r() + r() - 1) * 200 };
    const g = gaps(d.type), a = g[Math.floor(r() * g.length)] + (r() - 0.5) * 16;
    const dt = (r() + r() + r() - 1.5) * (1.15 - skill) * 380;
    return { k: 'swipe', a, p: 0.3 + r() * 0.65, dt };
  }

  const GE = { TYPES, TRAVEL, LENGTHS, FIELDS, CHARS, BALLS, STADIUMS, charById, ballsFor, rng, clamp, quality, lengthName, deliver, timingOf, resolve, newGame, squadOk, batterStats, bowlerOf, setBowler, bowl, bat, timeout, forfeit, finish, resultText, oversStr, cpuBowl, cpuBat, gaps };
  if (typeof module !== 'undefined' && module.exports) module.exports = GE; else root.GE = GE;
})(typeof self !== 'undefined' ? self : this);
