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
  function deliver(type, varn, x, l, v, seed) {
    type = clamp(type | 0, 0, 2); varn = type === 0 ? 0 : clamp(varn | 0, -1, 1);
    const r = rng(seed), q = quality(clamp(+v || 0, 0, 1));
    const sc = { perfect: 0.03, good: 0.08, ok: 0.16, noball: 0.1 }[q];
    const lx = r3(clamp(+x + (r() - 0.5) * 2 * sc, -1.6, 1.6));
    const ll = r3(clamp(+l + (r() - 0.5) * 1.6 * sc, 0, 1));
    const amt = varn * (type === 1 ? 0.35 : 0.45) * (q === 'perfect' ? 1.25 : q === 'good' ? 1 : 0.7);
    const fx = r3(lx + (type === 2 ? amt : amt * 0.4));
    const travel = Math.round(TRAVEL[type] * (q === 'perfect' ? 0.94 : q === 'good' ? 1 : 1.05));
    return { type, varn, x: lx, l: ll, fx, swing: r3(amt), q, travel, wide: Math.abs(lx) > 1.3, noball: q === 'noball' };
  }

  function timingOf(d, shot) {
    if (!shot || shot.k === 'none') return 'leave';
    let w = 1;
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
  function resolve(d, shot, seed, freeHit) {
    const r = rng(seed);
    const R = [r(), r(), r(), r(), r(), r()];
    const base = { kind: 'dot', runs: 0, extra: 0, legal: true, wicket: null, timing: 'leave', shot: 'leave', text: '', a: 0, dist: 0, loft: false, fielder: -1, free: !!freeHit };
    if (d.wide) return Object.assign(base, { kind: 'wide', runs: 0, extra: 1, legal: false, text: 'Wide ball! One extra run.' });
    const safe = !!freeHit || d.noball;
    if (d.noball) Object.assign(base, { extra: 1, legal: false });
    const timing = timingOf(d, shot);
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
    a = clamp(a, -175, 175);
    const edgeChance = timing === 'early' || timing === 'late' ? 0.18 + edge : timing === 'ok' ? 0.06 + edge : timing === 'good' ? 0.02 + edge * 0.5 : 0;
    if (R[0] < edgeChance) {
      if (R[2] < 0.4) return out('caught', 'Edged… and caught behind!');
      const four = p > 0.6 && R[3] < 0.3;
      return Object.assign(base, { kind: 'runs', runs: four ? 4 : 1, a: d.fx >= 0 ? 150 : -150, dist: four ? 1.05 : 0.5, text: four ? 'Edged… past the slips for FOUR!' : 'Thick edge, they run one.' });
    }
    const field = FIELDS[d.type];
    let dist = (loft ? c * (0.42 + 0.66 * p) : c * (0.34 + 0.72 * p)) + (R[3] - 0.5) * 0.12;
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
  function newInn(bat) { return { bat, runs: 0, wk: 0, balls: 0, fours: 0, sixes: 0, extras: 0, log: [] }; }
  function newGame(overs, wickets, firstBat) {
    return { overs: clamp(overs | 0, 1, 20), wickets: clamp(wickets | 0, 1, 10), inn: [newInn(firstBat), newInn(1 - firstBat)], cur: 0, phase: 'bowl', ball: null, last: null, result: null, winner: null, n: 0, free: false };
  }
  const oversStr = b => Math.floor(b / 6) + '.' + (b % 6);
  function bowl(g, type, varn, x, l, v, seed) {
    if (g.phase !== 'bowl') throw new Error('Not time to bowl');
    const d = deliver(type, varn, x, l, v, seed);
    d.seed = seed >>> 0; d.id = ++g.n; d.free = g.free;
    g.ball = d; g.phase = 'bat';
    return d;
  }
  function bat(g, shot) {
    if (g.phase !== 'bat' || !g.ball) throw new Error('No ball to play');
    const d = g.ball, res = resolve(d, shot, (d.seed ^ 0x5bd1e995) >>> 0, d.free), inn = g.inn[g.cur];
    inn.runs += res.runs + res.extra; inn.extras += res.extra;
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
    if (g.cur === 1 && inn.runs > g.inn[0].runs) finish(g);
    else if (over) { if (g.cur === 0) { g.cur = 1; g.free = false; res.inningsOver = true; } else finish(g); }
    return res;
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
    const n = g.result.n, w = names[g.winner];
    return g.result.by === 'runs' ? `${w} won by ${n} run${n === 1 ? '' : 's'}` : `${w} won by ${n} wicket${n === 1 ? '' : 's'}`;
  }

  /* ---------- The computer ---------- */
  function cpuBowl(r) {
    const type = r() < 0.4 ? 0 : r() < 0.55 ? 1 : 2;
    const varn = type ? Math.floor(r() * 3) - 1 : 0;
    const pick = r();
    const l = pick < 0.14 ? 0.06 + r() * 0.06 : pick < 0.24 ? 0.86 + r() * 0.1 : 0.3 + r() * 0.42;
    const x = -0.3 + r() * 1.1;
    const v = 0.5 + (r() + r() + r() - 1.5) * 0.4;
    return { type, varn, x, l, v };
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

  const GE = { TYPES, TRAVEL, LENGTHS, FIELDS, rng, clamp, quality, lengthName, deliver, timingOf, resolve, newGame, bowl, bat, finish, resultText, oversStr, cpuBowl, cpuBat, gaps };
  if (typeof module !== 'undefined' && module.exports) module.exports = GE; else root.GE = GE;
})(typeof self !== 'undefined' ? self : this);
