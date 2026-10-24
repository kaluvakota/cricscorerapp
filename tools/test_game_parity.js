// Dev check: node tools/test_game_parity.js | php tools/test_game_parity.php
// Plays 8000 random balls and 300 whole games with the JavaScript rules and prints them for PHP to replay.
const GE = require('../assets/game-engine.js');
const r = GE.rng(20261024), cases = [], games = [];
const kinds = ['none', 'tap', 'swipe', 'swipe', 'swipe'];
for (let i = 0; i < 8000; i++) {
  const balls = Object.keys(GE.BALLS).concat(['', '', 'bogus']);
  const bw = GE.CHARS[Math.floor(r() * GE.CHARS.length)], bt = GE.CHARS[Math.floor(r() * GE.CHARS.length)];
  const c = { type: Math.floor(r() * 3), varn: Math.floor(r() * 3) - 1, x: r() * 3.2 - 1.6, l: r(), v: r(), seed: Math.floor(r() * 4294967296), ball: balls[Math.floor(r() * balls.length)], side: r() < 0.5 ? 1 : -1, bw: bw.id, bt: bt.id,
    shot: { k: kinds[Math.floor(r() * kinds.length)], a: r() * 340 - 170, p: r(), dt: (r() - 0.5) * 900 }, seed2: Math.floor(r() * 4294967296), free: r() < 0.1 };
  c.d = GE.deliver(c.type, c.varn, c.x, c.l, c.v, c.seed, c.ball, c.side, bw.bowl);
  c.res = GE.resolve(c.d, c.shot, c.seed2, c.free, bt.bat); cases.push(c);
}
for (let k = 0; k < 300; k++) {
  const pick = () => GE.CHARS[Math.floor(r() * GE.CHARS.length)].id;
  const squads = [{ bat: pick(), bowl: [pick(), pick()] }, { bat: pick(), bowl: [pick()] }];
  const g = GE.newGame(1 + Math.floor(r() * 3), 1 + Math.floor(r() * 4), Math.floor(r() * 2), squads, 'dubai'), moves = [];
  while (g.phase !== 'done') {
    const inn = g.inn[g.cur], sq = g.squads[1 - inn.bat], bowler = sq.bowl[Math.floor(r() * sq.bowl.length)];
    GE.setBowler(g, bowler);
    const b = GE.cpuBowl(r, GE.bowlerOf(g).bowl.style), seed = Math.floor(r() * 4294967296), d = GE.bowl(g, b.type, b.varn, b.x, b.l, b.v, seed, b.ball, b.side);
    const s = GE.cpuBat(d, r, 0.6); GE.bat(g, s);
    moves.push([b.type, b.varn, b.x, b.l, b.v, seed, s, b.ball, b.side, bowler]);
  }
  games.push({ overs: g.overs, wickets: g.wickets, first: g.inn[0].bat, squads, moves, inn: g.inn.map(i => [i.runs, i.wk, i.balls, i.extras, i.wd, i.nb]), winner: g.winner, result: g.result });
}
process.stdout.write(JSON.stringify({ cases, games }));
