<?php
/* Dev check: node tools/test_game_parity.js | php tools/test_game_parity.php */
require __DIR__ . '/../inc/game.php';
$in = json_decode(stream_get_contents(STDIN), true);
$bad = 0;
foreach ($in['cases'] as $i => $c) {
    $d = ge_deliver($c['pace'], $c['line'], $c['length'], (float)$c['e']);
    $res = ge_resolve($d, $c['shot'], (float)$c['delta'], (int)$c['seed']);
    foreach (['kind', 'runs', 'wicket', 'timing', 'text'] as $k) if ($res[$k] !== $c['res'][$k]) { if ($bad++ < 5) echo "ball $i: $k PHP=" . json_encode($res[$k]) . ' JS=' . json_encode($c['res'][$k]) . "\n"; }
    foreach (['length', 'line', 'wide', 'acc'] as $k) if ($d[$k] !== $c['d'][$k]) { if ($bad++ < 5) echo "delivery $i: $k differs\n"; }
}
foreach ($in['games'] as $i => $gm) {
    $g = ge_new_game($gm['overs'], $gm['wickets'], $gm['first']);
    foreach ($gm['moves'] as [$p, $l, $len, $e, $seed, $shot, $delta]) { ge_bowl($g, $p, $l, $len, (float)$e, (int)$seed); ge_bat($g, $shot, (float)$delta); }
    $inn = array_map(fn($x) => [$x['runs'], $x['wk'], $x['balls']], $g['inn']);
    if ($inn !== $gm['inn'] || $g['winner'] !== $gm['winner'] || $g['result'] !== $gm['result']) { if ($bad++ < 5) echo "game $i differs: PHP " . json_encode($inn) . ' JS ' . json_encode($gm['inn']) . "\n"; }
}
echo $bad ? "FAIL: $bad differences\n" : 'PASS: ' . count($in['cases']) . ' balls and ' . count($in['games']) . " games identical in PHP and JavaScript\n";
exit($bad ? 1 : 0);
