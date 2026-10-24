<?php
/* Cric-Scorer · Gully Duel - bat vs bowl on two phones (Cricket League style: swipe to bat, marker + power bar to bowl).
   The rules are a line-by-line copy of assets/game-engine.js (tools/test_game_parity.php keeps them identical). */

const GE_TRAVEL = [880, 1000, 1200];
const GE_FIELDS = [
    [[150, 0.24, 'Slip'], [125, 0.3, 'Gully'], [98, 0.52, 'Point'], [55, 0.55, 'Cover'], [16, 0.48, 'Mid-off'], [-16, 0.48, 'Mid-on'], [-60, 0.55, 'Mid-wicket'], [-98, 0.52, 'Square leg'], [-155, 0.92, 'Fine leg']],
    [[150, 0.24, 'Slip'], [98, 0.52, 'Point'], [55, 0.55, 'Cover'], [16, 0.48, 'Mid-off'], [-16, 0.48, 'Mid-on'], [-60, 0.55, 'Mid-wicket'], [-98, 0.52, 'Square leg'], [155, 0.92, 'Third man'], [-25, 0.93, 'Long-on']],
    [[150, 0.2, 'Slip'], [95, 0.5, 'Point'], [50, 0.55, 'Cover'], [15, 0.5, 'Mid-off'], [-15, 0.5, 'Mid-on'], [-55, 0.55, 'Mid-wicket'], [-95, 0.92, 'Deep square leg'], [25, 0.93, 'Long-off'], [-28, 0.93, 'Long-on']],
];
const GE_RAD = 0.0174533;
const GE_CONTACT = ['perfect' => 1, 'good' => 0.86, 'ok' => 0.68, 'early' => 0.45, 'late' => 0.45, 'miss' => 0];

function ge_imul(int $a, int $b): int {      // 32-bit multiply, like JavaScript's Math.imul
    return (((($a >> 16) * $b) & 0xFFFF) << 16) + ($a & 0xFFFF) * $b & 0xFFFFFFFF;
}
function ge_rng(int $seed): Closure {        // mulberry32
    $a = $seed & 0xFFFFFFFF;
    return function () use (&$a): float {
        $a = ($a + 0x6D2B79F5) & 0xFFFFFFFF;
        $t = $a;
        $t = ge_imul($t ^ ($t >> 15), $t | 1);
        $t = ($t ^ (($t + ge_imul($t ^ ($t >> 7), $t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF;
        return (($t ^ ($t >> 14)) & 0xFFFFFFFF) / 4294967296;
    };
}
function ge_clamp($v, $lo, $hi) { return $v < $lo ? $lo : ($v > $hi ? $hi : $v); }
function ge_r3(float $v): float { return floor($v * 1000 + 0.5) / 1000; }
function ge_quality(float $v): string { $e = abs($v - 0.5) * 2; return $e <= 0.12 ? 'perfect' : ($e <= 0.4 ? 'good' : ($e <= 0.85 ? 'ok' : 'noball')); }

function ge_deliver(int $type, int $varn, float $x, float $l, float $v, int $seed): array {
    $type = ge_clamp($type, 0, 2); $varn = $type === 0 ? 0 : ge_clamp($varn, -1, 1);
    $r = ge_rng($seed); $q = ge_quality(ge_clamp($v, 0, 1));
    $sc = ['perfect' => 0.03, 'good' => 0.08, 'ok' => 0.16, 'noball' => 0.1][$q];
    $lx = ge_r3(ge_clamp($x + ($r() - 0.5) * 2 * $sc, -1.6, 1.6));
    $ll = ge_r3(ge_clamp($l + ($r() - 0.5) * 1.6 * $sc, 0, 1));
    $amt = $varn * ($type === 1 ? 0.35 : 0.45) * ($q === 'perfect' ? 1.25 : ($q === 'good' ? 1 : 0.7));
    $fx = ge_r3($lx + ($type === 2 ? $amt : $amt * 0.4));
    $travel = (int)floor(GE_TRAVEL[$type] * ($q === 'perfect' ? 0.94 : ($q === 'good' ? 1 : 1.05)) + 0.5);
    return ['type' => $type, 'varn' => $varn, 'x' => $lx, 'l' => $ll, 'fx' => $fx, 'swing' => ge_r3($amt), 'q' => $q, 'travel' => $travel, 'wide' => abs($lx) > 1.3, 'noball' => $q === 'noball'];
}

function ge_timing(array $d, array $shot): string {
    if (($shot['k'] ?? 'none') === 'none') return 'leave';
    $w = 1;
    if ($d['l'] < 0.16) $w *= 0.75;
    if ($d['l'] > 0.84) $w *= 0.9;
    if ($d['q'] === 'perfect') $w *= 0.85;
    $dt = (float)($shot['dt'] ?? 0);
    $a = abs($dt) / $w;
    if ($a <= 60) return 'perfect';
    if ($a <= 125) return 'good';
    if ($a <= 210) return 'ok';
    if ($a <= 380) return $dt < 0 ? 'early' : 'late';
    return 'miss';
}
function ge_zone(float $a): string {
    $A = abs($a);
    if ($A < 12) return 'straight down the ground';
    if ($a > 0) return $A < 35 ? 'past mid-off' : ($A < 75 ? 'through the covers' : ($A < 115 ? 'past point' : 'down to third man'));
    return $A < 35 ? 'past mid-on' : ($A < 75 ? 'through mid-wicket' : ($A < 115 ? 'past square leg' : 'down to fine leg'));
}

function ge_resolve(array $d, array $shot, int $seed, bool $freeHit): array {
    $r = ge_rng($seed);
    $R = [$r(), $r(), $r(), $r(), $r(), $r()];
    $base = ['kind' => 'dot', 'runs' => 0, 'extra' => 0, 'legal' => true, 'wicket' => null, 'timing' => 'leave', 'shot' => 'leave', 'text' => '', 'a' => 0, 'dist' => 0, 'loft' => false, 'fielder' => -1, 'free' => $freeHit];
    if (!empty($d['wide'])) return array_merge($base, ['kind' => 'wide', 'runs' => 0, 'extra' => 1, 'legal' => false, 'text' => 'Wide ball! One extra run.']);
    $safe = $freeHit || !empty($d['noball']);
    if (!empty($d['noball'])) $base = array_merge($base, ['extra' => 1, 'legal' => false]);
    $timing = ge_timing($d, $shot);
    $onStumps = abs($d['fx']) <= 0.42 && $d['l'] < 0.78;
    $base['timing'] = $timing;
    $base['shot'] = $timing === 'leave' ? 'leave' : $shot['k'];
    $out = function (string $w, string $text) use (&$base, $safe, $d): array {
        if ($safe) { $base['text'] = (!empty($d['noball']) ? 'No-ball - ' : 'Free hit - ') . 'saved! ' . explode('!', $text)[0] . '… but not out!'; return $base; }
        return array_merge($base, ['kind' => 'out', 'wicket' => $w, 'text' => $text]);
    };
    if ($timing === 'leave') {
        if ($onStumps && $R[0] < 0.6) return $out($R[1] < 0.6 ? 'bowled' : 'lbw', $R[1] < 0.6 ? 'Left it… and it crashed into the stumps!' : 'No shot, hit on the pad - LBW!');
        return array_merge($base, ['text' => 'Left alone.']);
    }
    if ($timing === 'miss') {
        if ($onStumps && $R[0] < 0.45) return $out($R[1] < 0.6 ? 'bowled' : 'lbw', $R[1] < 0.6 ? 'Missed it - clean bowled!' : 'Missed it, struck in front - LBW!');
        if ($R[0] > 0.86) return $out('caught', 'Thin edge… caught by the keeper!');
        return array_merge($base, ['text' => 'Swing and a miss!']);
    }
    $c = GE_CONTACT[$timing];
    if ($shot['k'] === 'tap') {
        if (($timing === 'early' || $timing === 'late') && $R[0] < 0.05) return $out('caught', 'Bat-pad… snapped up close in!');
        $one = $c >= 0.68 && $R[1] < 0.35;
        return array_merge($base, ['kind' => $one ? 'runs' : 'dot', 'runs' => $one ? 1 : 0, 'a' => ($R[2] - 0.5) * 60, 'dist' => $one ? 0.3 : 0.12, 'text' => $one ? 'Pushed into the gap for a quick single.' : 'Solid block.']);
    }
    $p = ge_clamp((float)($shot['p'] ?? 0), 0, 1);
    $a = ge_clamp((float)($shot['a'] ?? 0), -170, 170);
    $loft = $p >= 0.6;
    $edge = 0;
    if ($timing === 'early') $a -= 22 + $R[1] * 18;
    elseif ($timing === 'late') $a += 22 + $R[1] * 18;
    else $a += ($R[1] - 0.5) * ($timing === 'ok' ? 24 : ($timing === 'good' ? 12 : 5));
    if ($d['fx'] > 0.6 && $a < -45) { $c *= 0.75; $edge += 0.08; }
    if ($d['fx'] < -0.5 && $a > 60) { $c *= 0.8; $edge += 0.06; }
    if (abs($d['swing']) > 0.2 && $timing !== 'perfect') $edge += 0.05;
    if ($d['l'] > 0.84 && !$loft) $c *= 0.8;
    if ($d['l'] < 0.16 && $loft) $c *= 0.8;
    $a = ge_clamp($a, -175, 175);
    $edgeChance = ($timing === 'early' || $timing === 'late') ? 0.18 + $edge : ($timing === 'ok' ? 0.06 + $edge : ($timing === 'good' ? 0.02 + $edge * 0.5 : 0));
    if ($R[0] < $edgeChance) {
        if ($R[2] < 0.4) return $out('caught', 'Edged… and caught behind!');
        $four = $p > 0.6 && $R[3] < 0.3;
        return array_merge($base, ['kind' => 'runs', 'runs' => $four ? 4 : 1, 'a' => $d['fx'] >= 0 ? 150 : -150, 'dist' => $four ? 1.05 : 0.5, 'text' => $four ? 'Edged… past the slips for FOUR!' : 'Thick edge, they run one.']);
    }
    $field = GE_FIELDS[$d['type']];
    $dist = ($loft ? $c * (0.42 + 0.66 * $p) : $c * (0.34 + 0.72 * $p)) + ($R[3] - 0.5) * 0.12;
    $dist = ge_clamp($dist, 0.05, 1.3);
    $base['a'] = ge_r3($a); $base['loft'] = $loft;
    if (!$loft) {
        $hit = -1; $best = 9;
        foreach ($field as $i => $f) {
            $lat = abs($a - $f[0]) * GE_RAD * $f[1];
            if ($f[1] <= $dist + 0.05 && $lat < 0.075 && $f[1] < $best) { $hit = $i; $best = $f[1]; }
        }
        if ($hit >= 0) {
            $f = $field[$hit];
            $runs = $f[1] < 0.62 ? ($p > 0.7 && $c > 0.8 && $R[4] < 0.3 ? 1 : 0) : ($R[4] < 0.35 ? 2 : 1);
            return array_merge($base, ['kind' => $runs ? 'runs' : 'dot', 'runs' => $runs, 'dist' => ge_r3($f[1]), 'fielder' => $hit,
                'text' => $runs ? ($runs === 2 ? 'Two runs' : 'A single') . ' - fielded at ' . strtolower($f[2]) . '.' : 'Straight to ' . strtolower($f[2]) . '. No run.']);
        }
        if ($dist >= 0.98) return array_merge($base, ['kind' => 'runs', 'runs' => 4, 'dist' => 1.05, 'text' => 'FOUR! Raced away ' . ge_zone($a) . '.']);
        $runs = $dist < 0.3 ? 0 : ($dist < 0.56 ? 1 : ($dist < 0.9 ? 2 : 3));
        return array_merge($base, ['kind' => $runs ? 'runs' : 'dot', 'runs' => $runs, 'dist' => ge_r3($dist), 'text' => $runs ? "$runs run" . ($runs > 1 ? 's' : '') . ', ' . ge_zone($a) . '.' : 'Played softly. No run.']);
    }
    if ($dist >= 1) {
        foreach ($field as $i => $f) {
            if ($f[1] >= 0.85 && abs($a - $f[0]) * GE_RAD * $f[1] < 0.11 && $dist < 1.08 && $R[4] < 0.6)
                return array_merge($out('caught', 'Caught right on the boundary at ' . strtolower($f[2]) . '!'), ['a' => ge_r3($a), 'loft' => true, 'dist' => ge_r3($f[1]), 'fielder' => $i]);
        }
        return array_merge($base, ['kind' => 'runs', 'runs' => 6, 'dist' => ge_r3(min($dist, 1.25)), 'text' => 'SIX! Smashed ' . ge_zone($a) . '!']);
    }
    foreach ($field as $i => $f) {
        if (abs($a - $f[0]) * GE_RAD * $f[1] < 0.13 && abs($f[1] - $dist) < 0.2) {
            if ($R[4] < ($timing === 'perfect' ? 0.5 : 0.66)) return array_merge($out('caught', 'Up in the air… caught at ' . strtolower($f[2]) . '!'), ['a' => ge_r3($a), 'loft' => true, 'dist' => ge_r3($f[1]), 'fielder' => $i]);
            return array_merge($base, ['kind' => 'runs', 'runs' => 1, 'dist' => ge_r3($f[1]), 'fielder' => $i, 'text' => 'Dropped at ' . strtolower($f[2]) . '! They scamper a single.']);
        }
    }
    $runs = $dist >= 0.85 ? 4 : ($dist < 0.5 ? 1 : 2);
    return array_merge($base, ['kind' => 'runs', 'runs' => $runs, 'dist' => ge_r3($dist), 'text' => $runs === 4 ? 'FOUR! Lofted ' . ge_zone($a) . ', one bounce over the rope.' : "Lofted into the gap, $runs run" . ($runs > 1 ? 's' : '') . '.']);
}

function ge_new_inn(int $bat): array { return ['bat' => $bat, 'runs' => 0, 'wk' => 0, 'balls' => 0, 'fours' => 0, 'sixes' => 0, 'extras' => 0, 'log' => []]; }
function ge_new_game(int $overs, int $wickets, int $firstBat): array {
    return ['overs' => ge_clamp($overs, 1, 20), 'wickets' => ge_clamp($wickets, 1, 10), 'inn' => [ge_new_inn($firstBat), ge_new_inn(1 - $firstBat)],
        'cur' => 0, 'phase' => 'bowl', 'ball' => null, 'last' => null, 'result' => null, 'winner' => null, 'n' => 0, 'free' => false];
}
function ge_bowl(array &$g, int $type, int $varn, float $x, float $l, float $v, int $seed): array {
    $d = ge_deliver($type, $varn, $x, $l, $v, $seed);
    $d['seed'] = $seed & 0xFFFFFFFF; $d['id'] = ++$g['n']; $d['free'] = !empty($g['free']); $d['at'] = time();
    $g['ball'] = $d; $g['phase'] = 'bat';
    return $d;
}
function ge_bat(array &$g, array $shot): array {
    $d = $g['ball'];
    $res = ge_resolve($d, $shot, ((int)$d['seed'] ^ 0x5bd1e995) & 0xFFFFFFFF, !empty($d['free']));
    $i = $g['cur'];
    $g['inn'][$i]['runs'] += $res['runs'] + $res['extra']; $g['inn'][$i]['extras'] += $res['extra'];
    if ($res['legal']) $g['inn'][$i]['balls']++;
    if ($res['kind'] === 'out') $g['inn'][$i]['wk']++;
    if ($res['runs'] === 4) $g['inn'][$i]['fours']++;
    if ($res['runs'] === 6) $g['inn'][$i]['sixes']++;
    $g['inn'][$i]['log'][] = $res['kind'] === 'out' ? 'W' : ($res['kind'] === 'wide' ? 'wd' : (!empty($d['noball']) ? 'nb' : (string)$res['runs']));
    if (count($g['inn'][$i]['log']) > 12) array_shift($g['inn'][$i]['log']);
    $g['free'] = !empty($d['noball']) || (!empty($g['free']) && !$res['legal']);
    $res['id'] = $d['id']; $res['delivery'] = $d; $res['inn'] = $i; $res['noball'] = !empty($d['noball']);
    $g['last'] = $res; $g['ball'] = null; $g['phase'] = 'bowl';
    $inn = $g['inn'][$i];
    $over = $inn['balls'] >= $g['overs'] * 6 || $inn['wk'] >= $g['wickets'];
    if ($i === 1 && $inn['runs'] > $g['inn'][0]['runs']) ge_finish($g);
    elseif ($over) { if ($i === 0) { $g['cur'] = 1; $g['free'] = false; $g['last']['inningsOver'] = true; } else ge_finish($g); }
    return $g['last'];
}
function ge_finish(array &$g): void {
    $a = $g['inn'][0]; $b = $g['inn'][1];
    $g['phase'] = 'done';
    if ($b['runs'] > $a['runs']) { $g['winner'] = $b['bat']; $g['result'] = ['by' => 'wickets', 'n' => $g['wickets'] - $b['wk']]; }
    elseif ($a['runs'] > $b['runs']) { $g['winner'] = $a['bat']; $g['result'] = ['by' => 'runs', 'n' => $a['runs'] - $b['runs']]; }
    else { $g['winner'] = -1; $g['result'] = ['by' => 'tie', 'n' => 0]; }
}
/** A shot sent by a phone, made safe */
function ge_shot_in(array $in): array {
    $k = in_array($in['k'] ?? '', ['none', 'tap', 'swipe'], true) ? $in['k'] : 'none';
    return ['k' => $k, 'a' => (float)ge_clamp((float)($in['a'] ?? 0), -180, 180), 'p' => (float)ge_clamp((float)($in['p'] ?? 0), 0, 1), 'dt' => (float)ge_clamp((float)($in['dt'] ?? 0), -5000, 5000)];
}

/* ---------- Online rooms ---------- */
function game_require(array $u): void {
    if (!feature_on($u, 'game')) fail('Gully Duel is not switched on for your account yet', 403);
}
function game_load(array $u, string $code, bool $lock = false): array {
    $code = preg_replace('/\D/', '', $code);
    $g = row('SELECT * FROM games WHERE code=? AND mode=\'online\' AND (p0=? OR p1=?) ORDER BY id DESC LIMIT 1' . ($lock ? ' FOR UPDATE' : ''), [$code, $u['id'], $u['id']]);
    if (!$g) fail('Game not found. Check the code.', 404);
    $g['st'] = $g['state'] ? json_decode($g['state'], true) : null;
    $g['me'] = (int)$g['p0'] === (int)$u['id'] ? 0 : 1;
    return $g;
}
function game_save(array $g, array $extra = []): void {
    $sets = ['state=?', 'version=version+1']; $vals = [json_encode($g['st'], JSON_UNESCAPED_UNICODE)];
    foreach ($extra as $k => $v) { $sets[] = "$k=?"; $vals[] = $v; }
    $vals[] = $g['id'];
    q('UPDATE games SET ' . implode(', ', $sets) . ' WHERE id=?', $vals);
}
function game_view(array $g): array {
    $names = []; $avatars = [];
    foreach ([$g['p0'], $g['p1']] as $pid) {
        $p = $pid ? row('SELECT display_name, avatar_url, avatar_preset FROM users WHERE id=?', [$pid]) : null;
        $names[] = $p ? $p['display_name'] : 'Waiting…';
        $avatars[] = $p ? ['avatar' => $p['avatar_url'], 'avatar_preset' => $p['avatar_preset'], 'display_name' => $p['display_name']] : null;
    }
    return ['code' => $g['code'], 'v' => (int)$g['version'], 'status' => $g['status'], 'me' => $g['me'], 'names' => $names, 'players' => $avatars,
        'state' => $g['st'], 'rematch' => $g['rematch_code'] ?: null, 'host' => $g['me'] === 0, 'overs' => (int)$g['overs'], 'wickets' => (int)$g['wickets'], 'now' => time()];
}

function game_action(string $action, array $u, array $in) {
    game_require($u);
    switch ($action) {
    case 'game_create': {
        $overs = ge_clamp((int)($in['overs'] ?? 2), 1, 10); $wk = ge_clamp((int)($in['wickets'] ?? 2), 1, 10);
        q("UPDATE games SET status='abandoned' WHERE p0=? AND status='waiting'", [$u['id']]);
        $code = game_new_code();
        q("INSERT INTO games (code, mode, p0, status, overs, wickets) VALUES (?, 'online', ?, 'waiting', ?, ?)", [$code, $u['id'], $overs, $wk]);
        return game_view(game_load($u, $code));
    }
    case 'game_join': {
        $code = preg_replace('/\D/', '', (string)($in['code'] ?? ''));
        db()->beginTransaction();
        $g = row("SELECT * FROM games WHERE code=? AND mode='online' AND status IN ('waiting','live') ORDER BY id DESC LIMIT 1 FOR UPDATE", [$code]);
        if (!$g) { db()->rollBack(); fail('No game with that code. Ask your friend for the 4-digit code.', 404); }
        if ((int)$g['p0'] === (int)$u['id'] || (int)$g['p1'] === (int)$u['id']) { db()->commit(); return game_view(game_load($u, $code)); }
        if ($g['status'] !== 'waiting') { db()->rollBack(); fail('That game has already started', 409); }
        $first = random_int(0, 1);                       // the toss: winner bats first
        $st = ge_new_game((int)$g['overs'], (int)$g['wickets'], $first);
        $st['toss'] = $first;
        q("UPDATE games SET p1=?, status='live', state=?, version=version+1 WHERE id=?", [$u['id'], json_encode($st), $g['id']]);
        db()->commit();
        return game_view(game_load($u, $code));
    }
    case 'game_get': {
        $g = game_load($u, (string)($in['code'] ?? ''));
        if (isset($in['v']) && (int)$in['v'] === (int)$g['version']) return ['same' => true, 'v' => (int)$g['version'], 'now' => time()];
        return game_view($g);
    }
    case 'game_bowl': {
        db()->beginTransaction();
        $g = game_load($u, (string)($in['code'] ?? ''), true);
        $st = &$g['st'];
        if ($g['status'] !== 'live' || $st['phase'] !== 'bowl') { db()->rollBack(); fail('Not your turn to bowl', 409); }
        if (1 - $st['inn'][$st['cur']]['bat'] !== $g['me']) { db()->rollBack(); fail("You're batting - wait for the ball!", 409); }
        if ((int)($in['n'] ?? -1) !== (int)$st['n']) { db()->rollBack(); return game_view($g); }     // a double tap
        ge_bowl($st, (int)($in['type'] ?? 0), (int)($in['varn'] ?? 0), (float)ge_clamp((float)($in['x'] ?? 0), -1.6, 1.6), (float)ge_clamp((float)($in['l'] ?? 0.5), 0, 1), (float)ge_clamp((float)($in['v'] ?? 0.5), 0, 1), random_int(1, 0x7FFFFFFF));
        unset($st);
        game_save($g);
        db()->commit();
        return game_view(game_load($u, $g['code']));
    }
    case 'game_bat':
    case 'game_nudge': {
        db()->beginTransaction();
        $g = game_load($u, (string)($in['code'] ?? ''), true);
        $st = &$g['st'];
        if ($g['status'] !== 'live' || $st['phase'] !== 'bat' || (int)($in['id'] ?? 0) !== (int)$st['ball']['id']) { db()->rollBack(); return game_view($g); }
        $batter = $st['inn'][$st['cur']]['bat'];
        if ($action === 'game_bat') {
            if ($batter !== $g['me']) { db()->rollBack(); fail("You're bowling!", 409); }
            ge_bat($st, ge_shot_in($in));
        } else {                                          // the batter's phone went quiet: count it as a leave
            if ($batter === $g['me'] || time() - (int)$st['ball']['at'] < 20) { db()->rollBack(); return game_view($g); }
            ge_bat($st, ['k' => 'none', 'a' => 0, 'p' => 0, 'dt' => 0]);
        }
        $done = $st['phase'] === 'done';
        $winner = $st['winner'];
        $balls = $st['inn'][0]['balls'] + $st['inn'][1]['balls'];
        unset($st);
        game_save($g, $done ? ['status' => 'done', 'winner' => $winner, 'balls' => $balls] : ['balls' => $balls]);
        db()->commit();
        return game_view(game_load($u, $g['code']));
    }
    case 'game_leave': {
        $g = game_load($u, (string)($in['code'] ?? ''));
        if (in_array($g['status'], ['waiting', 'live'], true)) {
            if ($g['status'] === 'live') { $g['st']['phase'] = 'done'; $g['st']['winner'] = 1 - $g['me']; $g['st']['result'] = ['by' => 'forfeit', 'n' => 0]; }
            game_save($g, ['status' => 'abandoned', 'winner' => $g['status'] === 'live' ? 1 - $g['me'] : null]);
        }
        return ['ok' => true];
    }
    case 'game_rematch': {
        db()->beginTransaction();
        $g = game_load($u, (string)($in['code'] ?? ''), true);
        if ($g['rematch_code']) { db()->commit(); return game_view(game_load($u, $g['rematch_code'])); }
        if (!in_array($g['status'], ['done', 'abandoned'], true) || !$g['p1']) { db()->rollBack(); fail('Finish this game first', 409); }
        $code = game_new_code();
        $first = $g['st'] ? 1 - (int)$g['st']['inn'][0]['bat'] : 0;     // swap who bats first
        $st = ge_new_game((int)$g['overs'], (int)$g['wickets'], $first);
        $st['toss'] = $first;
        q("INSERT INTO games (code, mode, p0, p1, status, overs, wickets, state, version) VALUES (?, 'online', ?, ?, 'live', ?, ?, ?, 1)",
          [$code, $g['p0'], $g['p1'], $g['overs'], $g['wickets'], json_encode($st)]);
        game_save($g, ['rematch_code' => $code]);
        db()->commit();
        return game_view(game_load($u, $code));
    }
    case 'game_record': {                                 // a finished one-phone or vs-computer game, for the stats only
        $mode = ($in['mode'] ?? '') === 'cpu' ? 'cpu' : 'local';
        q("INSERT INTO games (code, mode, p0, status, overs, wickets, balls, winner) VALUES ('', ?, ?, 'done', ?, ?, ?, ?)",
          [$mode, $u['id'], ge_clamp((int)($in['overs'] ?? 1), 1, 10), ge_clamp((int)($in['wickets'] ?? 1), 1, 10), ge_clamp((int)($in['balls'] ?? 0), 0, 200), isset($in['winner']) ? ge_clamp((int)$in['winner'], -1, 1) : null]);
        return ['ok' => true];
    }
    }
    fail('Unknown game action');
}
function game_new_code(): string {
    for ($i = 0; $i < 50; $i++) {
        $c = (string)random_int(1000, 9999);
        if (!val("SELECT 1 FROM games WHERE code=? AND status IN ('waiting','live') LIMIT 1", [$c])) return $c;
    }
    fail('Too many games right now - try again in a minute', 503);
}
