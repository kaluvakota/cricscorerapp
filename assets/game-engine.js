/* Cric-Scorer · Gully Duel - the rules of the bat-vs-bowl game.
   The same rules run on the server (inc/game.php) for two-phone games, so keep both in step:
   tools/test_game_parity.php checks that they give identical results. */
'use strict';
(function (root) {
  const PACES = ['fast', 'medium', 'spin'];
  const LINES = ['wide', 'off', 'middle', 'leg'];               // wide outside off, off stump, middle, leg stump
  const LENGTHS = ['yorker', 'full', 'good', 'short', 'bouncer', 'fulltoss'];
  const SHOTS = ['defend', 'drive', 'cut', 'pull', 'sweep', 'loft'];
  const TRAVEL = { fast: 950, medium: 1150, spin: 1400 };       // ms from release to the batter
  // How well each shot suits each length: yorker, full, good, short, bouncer, full toss
  const FIT = {
    defend: [0.75, 0.8, 0.9, 0.6, 0.45, 0.8],
    drive: [0.3, 0.95, 0.6, 0.2, 0.05, 1],
    cut: [0.05, 0.3, 0.6, 0.95, 0.5, 0.5],
    pull: [0.05, 0.15, 0.45, 0.95, 0.8, 0.6],
    sweep: [0.2, 0.8, 0.65, 0.15, 0, 0.6],
    loft: [0.15, 0.9, 0.5, 0.3, 0.4, 1],
  };
  // ...and each line: wide, off, middle, leg
  const LINE_FIT = {
    defend: [0.9, 1, 1, 1], drive: [0.8, 1, 0.9, 0.75], cut: [1, 0.9, 0.5, 0.2],
    pull: [0.35, 0.6, 0.9, 1], sweep: [0.4, 0.7, 0.9, 1], loft: [0.7, 0.9, 1, 0.9],
  };
  const PACE_FIT = { // fast, medium, spin
    defend: [1, 1, 1], drive: [0.95, 1, 0.95], cut: [1, 1, 0.9], pull: [1, 0.95, 0.85], sweep: [0.5, 0.8, 1.15], loft: [0.85, 1, 1.05],
  };
  const POWER = { defend: 0.3, drive: 0.82, cut: 0.78, pull: 0.88, sweep: 0.74, loft: 1.15 };
  const RISK = { defend: 0.01, drive: 0.05, cut: 0.06, pull: 0.07, sweep: 0.07, loft: 0.13 };
  // Where the ball goes (degrees: 0 = straight back past the bowler, + = off side, - = leg side)
  const DIR = { defend: 5, drive: 25, cut: 80, pull: -70, sweep: -95, loft: 10 };
  const ZONE = { defend: 'back down the pitch', drive: 'through the covers', cut: 'past point', pull: 'over midwicket', sweep: 'to fine leg', loft: 'over long-on' };

  function rng(seed) {                                           // mulberry32 - same numbers in PHP
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

  /** Where the ball really goes: aim (line 0-3, length 0-4) plus how well the bowler hit the meter (e: -1 … 1, 0 = perfect) */
  function deliver(pace, line, length, e) {
    const d = { pace: PACES[pace] ? pace : 1, line: clamp(line | 0, 0, 3), length: clamp(length | 0, 0, 4), wide: false, acc: 'perfect' };
    const a = Math.abs(e);
    if (a > 0.85) {
      if (e > 0) { d.wide = true; d.acc = 'wide'; d.line = 0; }
      else { d.length = 5; d.acc = 'fulltoss'; }
    } else if (a > 0.25) {
      d.acc = 'off';
      d.length = clamp(d.length + (e > 0 ? 1 : -1), 0, 4);
    } else if (a > 0.1) d.acc = 'good';
    d.travel = TRAVEL[PACES[d.pace]];
    return d;
  }

  function timingOf(shot, delta) {
    if (!shot || shot === 'leave') return 'leave';
    const a = Math.abs(delta);
    if (a <= 70) return 'perfect';
    if (a <= 150) return 'good';
    if (a <= 280) return delta < 0 ? 'early' : 'late';
    return 'miss';
  }
  const T_FACTOR = { perfect: 1, good: 0.8, early: 0.45, late: 0.45, miss: 0.1 };

  /** The result of one ball. shot = one of SHOTS or 'leave'; delta = ms early (-) or late (+) */
  function resolve(d, shot, delta, seed) {
    const r = rng(seed), r1 = r(), r2 = r(), r3 = r(), r4 = r();
    if (d.wide) return { kind: 'wide', runs: 1, extra: 1, legal: false, wicket: null, timing: 'leave', shot: 'leave', text: 'Wide ball!', dir: 0, dist: 0 };
    const timing = timingOf(shot, delta);
    const onStumps = d.line >= 1;
    const res = { kind: 'dot', runs: 0, extra: 0, legal: true, wicket: null, timing, shot: timing === 'leave' ? 'leave' : shot, text: '', dir: 0, dist: 0 };
    if (timing === 'leave') {
      const danger = d.length === 0 ? 0.7 : d.length <= 2 ? 0.5 : 0;
      if (onStumps && r2 < danger) { res.kind = 'out'; res.wicket = r4 < 0.6 ? 'bowled' : 'lbw'; res.text = res.wicket === 'bowled' ? 'Left it… and it hit the stumps!' : 'Left it alone, hit on the pad - LBW!'; }
      else res.text = 'Left alone. Good judgement.';
      return res;
    }
    const fit = FIT[shot][d.length] * LINE_FIT[shot][d.line] * PACE_FIT[shot][d.pace];
    const q = clamp(fit * T_FACTOR[timing] + (r1 - 0.5) * 0.25, 0, 1.2);
    res.dir = DIR[shot] + (r3 - 0.5) * 30;
    if (timing === 'miss') {
      if (onStumps && d.length <= 2 && r2 < 0.5) { res.kind = 'out'; res.wicket = r4 < 0.6 ? 'bowled' : 'lbw'; res.text = res.wicket === 'bowled' ? 'Swing and a miss - clean bowled!' : 'Missed it, struck in front - LBW!'; }
      else if (r2 > 0.82) { res.kind = 'out'; res.wicket = 'caught'; res.text = 'Thin edge… caught behind by the keeper!'; }
      else res.text = 'Swing and a miss!';
      return res;
    }
    const catchChance = RISK[shot] * (1.6 - q) * (timing === 'early' || timing === 'late' ? 1.8 : 1);
    if (r2 < catchChance) {
      res.kind = 'out'; res.wicket = 'caught'; res.dist = 0.7;
      res.text = shot === 'loft' ? 'Up in the air… and taken in the deep!' : shot === 'defend' ? 'Bat-pad… snapped up close in!' : 'Edged it… caught!';
      return res;
    }
    if (q < 0.22 && onStumps && d.length <= 2 && r4 < 0.35) { res.kind = 'out'; res.wicket = 'bowled'; res.text = 'Wrong shot - through the gate, bowled!'; return res; }
    const v = q * POWER[shot] + (r3 - 0.5) * 0.1;
    let runs = 0;
    if ((shot === 'loft' || shot === 'pull') && v > 0.86) runs = 6;
    else if (v > 0.64) runs = 4;
    else if (v > 0.6) runs = 3;
    else if (v > 0.48) runs = 2;
    else if (v > 0.3) runs = 1;
    res.runs = runs; res.kind = runs ? 'runs' : 'dot';
    res.dist = runs === 6 ? 1.25 : runs === 4 ? 1.02 : clamp(0.25 + v * 0.7, 0.2, 0.9);
    const where = ZONE[shot];
    res.text = runs === 6 ? `SIX! Smashed ${where}!` : runs === 4 ? `FOUR! Timed beautifully ${where}.` : runs ? `${runs} run${runs > 1 ? 's' : ''}, pushed ${where}.` : shot === 'defend' ? 'Solid defence.' : 'Straight to the fielder. No run.';
    return res;
  }

  /* ---------- A whole match: two players, one innings each ---------- */
  function newGame(overs, wickets, firstBat) {
    return { overs: clamp(overs | 0, 1, 10), wickets: clamp(wickets | 0, 1, 10), inn: [newInn(firstBat), newInn(1 - firstBat)], cur: 0, phase: 'bowl', ball: null, last: null, result: null, winner: null, n: 0 };
  }
  function newInn(bat) { return { bat, runs: 0, wk: 0, balls: 0, fours: 0, sixes: 0, extras: 0, log: [] }; }
  const oversStr = b => Math.floor(b / 6) + '.' + (b % 6);

  /** Bowler releases the ball. Returns the delivery (also stored on the game). */
  function bowl(g, pace, line, length, e, seed) {
    if (g.phase !== 'bowl') throw new Error('Not time to bowl');
    const d = deliver(pace, line, length, e);
    d.seed = seed >>> 0; d.id = ++g.n;
    g.ball = d; g.phase = 'bat';
    return d;
  }
  /** Batter plays (or leaves) the ball; moves the game on. */
  function bat(g, shot, delta) {
    if (g.phase !== 'bat' || !g.ball) throw new Error('No ball to play');
    const d = g.ball, res = resolve(d, shot, delta, d.seed), inn = g.inn[g.cur];
    inn.runs += res.runs; inn.extras += res.extra;
    if (res.legal) inn.balls++;
    if (res.kind === 'out') inn.wk++;
    if (res.runs === 4 && res.legal) inn.fours++;
    if (res.runs === 6) inn.sixes++;
    const mark = res.kind === 'out' ? 'W' : res.kind === 'wide' ? 'wd' : String(res.runs);
    inn.log.push(mark); if (inn.log.length > 12) inn.log.shift();
    res.id = d.id; res.delivery = d; res.inn = g.cur;
    g.last = res; g.ball = null; g.phase = 'bowl';
    const target = g.cur === 1 ? g.inn[0].runs + 1 : null;
    const over = inn.balls >= g.overs * 6 || inn.wk >= g.wickets;
    if (g.cur === 1 && inn.runs >= target) finish(g);
    else if (over) { if (g.cur === 0) { g.cur = 1; res.inningsOver = true; } else finish(g); }
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

  /* ---------- The computer player ---------- */
  function cpuBowl(r) {     // r: a rng() function - a sensible mix of deliveries with a little wobble
    const pace = r() < 0.45 ? 0 : r() < 0.55 ? 1 : 2;
    const line = [1, 1, 2, 2, 2, 3, 0][Math.floor(r() * 7)];
    const length = [0, 1, 2, 2, 2, 3, 3, 4][Math.floor(r() * 8)];
    const e = (r() + r() + r() - 1.5) * 0.55;                   // usually close to perfect
    return { pace, line, length, e };
  }
  function cpuBat(d, r, skill = 0.7) {   // reads the length (mostly right) and times it (mostly well)
    const best = { 0: 'defend', 1: 'drive', 2: d.line === 0 ? 'cut' : 'defend', 3: d.line >= 2 ? 'pull' : 'cut', 4: r() < 0.5 ? 'pull' : 'leave', 5: 'loft' }[d.length];
    let shot = r() < skill ? best : SHOTS[Math.floor(r() * SHOTS.length)];
    if (d.length === 2 && r() < 0.25) shot = 'drive';
    if (d.length === 1 && r() < 0.3) shot = 'loft';
    const delta = (r() + r() - 1) * (1 - skill) * 520;
    return { shot, delta };
  }

  const GE = { PACES, LINES, LENGTHS, SHOTS, TRAVEL, rng, deliver, timingOf, resolve, newGame, bowl, bat, finish, resultText, oversStr, cpuBowl, cpuBat };
  if (typeof module !== 'undefined' && module.exports) module.exports = GE; else root.GE = GE;
})(typeof self !== 'undefined' ? self : this);
