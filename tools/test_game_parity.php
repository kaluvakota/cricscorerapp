<?php
/* Dev check: node tools/test_game_parity.js | php tools/test_game_parity.php */
require __DIR__ . '/../inc/game.php';
$in = json_decode(stream_get_contents(STDIN), true);
$bad = 0;
$same = fn($a, $b) => is_float($a) || is_float($b) ? abs((float)$a - (float)$b) < 1e-9 : $a === $b;
foreach ($in['cases'] as $i => $c) {
    $d = ge_deliver($c['type'], $c['varn'], (float)$c['x'], (float)$c['l'], (float)$c['v'], (int)$c['seed'], (string)$c['ball'], (int)$c['side'], ge_char($c['bw'])['bowl']);
    foreach (['x', 'l', 'fx', 'q', 'travel', 'wide', 'noball', 'swing', 'ball', 'mod', 'type', 'varn', 'side'] as $k) if (!$same($d[$k], $c['d'][$k])) { if ($bad++ < 5) echo "delivery $i: $k PHP=" . json_encode($d[$k]) . ' JS=' . json_encode($c['d'][$k]) . "\n"; }
    $res = ge_resolve($c['d'], ge_shot_in($c['shot']), (int)$c['seed2'], (bool)$c['free'], ge_char($c['bt'])['bat']);
    foreach (['kind', 'runs', 'extra', 'wicket', 'timing', 'text', 'a', 'dist', 'loft', 'fielder', 'legal'] as $k) if (!$same($res[$k], $c['res'][$k])) { if ($bad++ < 8) echo "ball $i: $k PHP=" . json_encode($res[$k]) . ' JS=' . json_encode($c['res'][$k]) . "\n"; }
}
foreach ($in['games'] as $i => $gm) {
    $g = ge_new_game($gm['overs'], $gm['wickets'], $gm['first'], $gm['squads'], 'dubai');
    foreach ($gm['moves'] as [$t, $v, $x, $l, $pw, $seed, $shot, $ball, $side, $bowler]) { ge_set_bowler($g, $bowler); ge_bowl($g, $t, $v, (float)$x, (float)$l, (float)$pw, (int)$seed, (string)$ball, (int)$side); ge_bat($g, ge_shot_in($shot)); }
    $inn = array_map(fn($x) => [$x['runs'], $x['wk'], $x['balls'], $x['extras'], $x['wd'], $x['nb']], $g['inn']);
    if ($inn !== $gm['inn'] || $g['winner'] !== $gm['winner'] || $g['result'] !== $gm['result']) { if ($bad++ < 5) echo "game $i differs: PHP " . json_encode($inn) . ' JS ' . json_encode($gm['inn']) . "\n"; }
}
echo $bad ? "FAIL: $bad differences\n" : 'PASS: ' . count($in['cases']) . ' balls and ' . count($in['games']) . " games identical in PHP and JavaScript\n";
exit($bad ? 1 : 0);
