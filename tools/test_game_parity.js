// Dev check: node tools/test_game_parity.js | php tools/test_game_parity.php
// Plays 5000 random balls and 300 whole games with the JavaScript rules and prints them for PHP to replay.
const GE = require('../assets/game-engine.js');
const r = GE.rng(20261024), cases = [], games = [];
const shots = GE.SHOTS.concat(['leave']);
for (let i = 0; i < 5000; i++) {
  const c = { pace: Math.floor(r() * 3), line: Math.floor(r() * 4), length: Math.floor(r() * 5), e: (r() * 2 - 1), shot: shots[Math.floor(r() * shots.length)], delta: (r() - 0.5) * 900, seed: Math.floor(r() * 4294967296) };
  const d = GE.deliver(c.pace, c.line, c.length, c.e);
  c.d = d; c.res = GE.resolve(d, c.shot, c.delta, c.seed); cases.push(c);
}
for (let k = 0; k < 300; k++) {
  const g = GE.newGame(1 + Math.floor(r() * 3), 1 + Math.floor(r() * 4), Math.floor(r() * 2)), moves = [];
  while (g.phase !== 'done') {
    const b = GE.cpuBowl(r), seed = Math.floor(r() * 4294967296), d = GE.bowl(g, b.pace, b.line, b.length, b.e, seed);
    const s = GE.cpuBat(d, r, 0.6); GE.bat(g, s.shot, s.delta);
    moves.push([b.pace, b.line, b.length, b.e, seed, s.shot, s.delta]);
  }
  games.push({ overs: g.overs, wickets: g.wickets, first: g.inn[0].bat, moves, inn: g.inn.map(i => [i.runs, i.wk, i.balls]), winner: g.winner, result: g.result });
}
process.stdout.write(JSON.stringify({ cases, games }));
