<?php
/* Cric-Scorer · Gully Duel - bat vs bowl on two phones.
   The rules are a line-by-line copy of assets/game-engine.js (tools/test_game_parity.php keeps them identical). */

const GE_PACES = ['fast', 'medium', 'spin'];
const GE_SHOTS = ['defend', 'drive', 'cut', 'pull', 'sweep', 'loft'];
const GE_TRAVEL = ['fast' => 950, 'medium' => 1150, 'spin' => 1400];
const GE_FIT = [
    'defend' => [0.75, 0.8, 0.9, 0.6, 0.45, 0.8],
    'drive' => [0.3, 0.95, 0.6, 0.2, 0.05, 1],
    'cut' => [0.05, 0.3, 0.6, 0.95, 0.5, 0.5],
    'pull' => [0.05, 0.15, 0.45, 0.95, 0.8, 0.6],
    'sweep' => [0.2, 0.8, 0.65, 0.15, 0, 0.6],
    'loft' => [0.15, 0.9, 0.5, 0.3, 0.4, 1],
];
const GE_LINE_FIT = [
    'defend' => [0.9, 1, 1, 1], 'drive' => [0.8, 1, 0.9, 0.75], 'cut' => [1, 0.9, 0.5, 0.2],
    'pull' => [0.35, 0.6, 0.9, 1], 'sweep' => [0.4, 0.7, 0.9, 1], 'loft' => [0.7, 0.9, 1, 0.9],
];
const GE_PACE_FIT = [
    'defend' => [1, 1, 1], 'drive' => [0.95, 1, 0.95], 'cut' => [1, 1, 0.9], 'pull' => [1, 0.95, 0.85], 'sweep' => [0.5, 0.8, 1.15], 'loft' => [0.85, 1, 1.05],
];
const GE_POWER = ['defend' => 0.3, 'drive' => 0.82, 'cut' => 0.78, 'pull' => 0.88, 'sweep' => 0.74, 'loft' => 1.15];
const GE_RISK = ['defend' => 0.01, 'drive' => 0.05, 'cut' => 0.06, 'pull' => 0.07, 'sweep' => 0.07, 'loft' => 0.13];
const GE_DIR = ['defend' => 5, 'drive' => 25, 'cut' => 80, 'pull' => -70, 'sweep' => -95, 'loft' => 10];
const GE_ZONE = ['defend' => 'back down the pitch', 'drive' => 'through the covers', 'cut' => 'past point', 'pull' => 'over midwicket', 'sweep' => 'to fine leg', 'loft' => 'over long-on'];
const GE_T_FACTOR = ['perfect' => 1, 'good' => 0.8, 'early' => 0.45, 'late' => 0.45, 'miss' => 0.1];

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

function ge_deliver(int $pace, int $line, int $length, float $e): array {
    $d = ['pace' => isset(GE_PACES[$pace]) ? $pace : 1, 'line' => ge_clamp($line, 0, 3), 'length' => ge_clamp($length, 0, 4), 'wide' => false, 'acc' => 'perfect'];
    $a = abs($e);
    if ($a > 0.85) {
        if ($e > 0) { $d['wide'] = true; $d['acc'] = 'wide'; $d['line'] = 0; }
        else { $d['length'] = 5; $d['acc'] = 'fulltoss'; }
    } elseif ($a > 0.25) {
        $d['acc'] = 'off';
        $d['length'] = ge_clamp($d['length'] + ($e > 0 ? 1 : -1), 0, 4);
    } elseif ($a > 0.1) $d['acc'] = 'good';
    $d['travel'] = GE_TRAVEL[GE_PACES[$d['pace']]];
    return $d;
}

function ge_timing(?string $shot, float $delta): string {
    if (!$shot || $shot === 'leave') return 'leave';
    $a = abs($delta);
    if ($a <= 70) return 'perfect';
    if ($a <= 150) return 'good';
    if ($a <= 280) return $delta < 0 ? 'early' : 'late';
    return 'miss';
}

function ge_resolve(array $d, ?string $shot, float $delta, int $seed): array {
    $r = ge_rng($seed); $r1 = $r(); $r2 = $r(); $r3 = $r(); $r4 = $r();
    if (!empty($d['wide'])) return ['kind' => 'wide', 'runs' => 1, 'extra' => 1, 'legal' => false, 'wicket' => null, 'timing' => 'leave', 'shot' => 'leave', 'text' => 'Wide ball!', 'dir' => 0, 'dist' => 0];
    if ($shot !== null && $shot !== 'leave' && !isset(GE_FIT[$shot])) $shot = 'leave';
    $timing = ge_timing($shot, $delta);
    $onStumps = $d['line'] >= 1;
    $res = ['kind' => 'dot', 'runs' => 0, 'extra' => 0, 'legal' => true, 'wicket' => null, 'timing' => $timing, 'shot' => $timing === 'leave' ? 'leave' : $shot, 'text' => '', 'dir' => 0, 'dist' => 0];
    if ($timing === 'leave') {
        $danger = $d['length'] === 0 ? 0.7 : ($d['length'] <= 2 ? 0.5 : 0);
        if ($onStumps && $r2 < $danger) { $res['kind'] = 'out'; $res['wicket'] = $r4 < 0.6 ? 'bowled' : 'lbw'; $res['text'] = $res['wicket'] === 'bowled' ? 'Left it… and it hit the stumps!' : 'Left it alone, hit on the pad - LBW!'; }
        else $res['text'] = 'Left alone. Good judgement.';
        return $res;
    }
    $fit = GE_FIT[$shot][$d['length']] * GE_LINE_FIT[$shot][$d['line']] * GE_PACE_FIT[$shot][$d['pace']];
    $q = ge_clamp($fit * GE_T_FACTOR[$timing] + ($r1 - 0.5) * 0.25, 0, 1.2);
    $res['dir'] = GE_DIR[$shot] + ($r3 - 0.5) * 30;
    if ($timing === 'miss') {
        if ($onStumps && $d['length'] <= 2 && $r2 < 0.5) { $res['kind'] = 'out'; $res['wicket'] = $r4 < 0.6 ? 'bowled' : 'lbw'; $res['text'] = $res['wicket'] === 'bowled' ? 'Swing and a miss - clean bowled!' : 'Missed it, struck in front - LBW!'; }
        elseif ($r2 > 0.82) { $res['kind'] = 'out'; $res['wicket'] = 'caught'; $res['text'] = 'Thin edge… caught behind by the keeper!'; }
        else $res['text'] = 'Swing and a miss!';
        return $res;
    }
    $catch = GE_RISK[$shot] * (1.6 - $q) * ($timing === 'early' || $timing === 'late' ? 1.8 : 1);
    if ($r2 < $catch) {
        $res['kind'] = 'out'; $res['wicket'] = 'caught'; $res['dist'] = 0.7;
        $res['text'] = $shot === 'loft' ? 'Up in the air… and taken in the deep!' : ($shot === 'defend' ? 'Bat-pad… snapped up close in!' : 'Edged it… caught!');
        return $res;
    }
    if ($q < 0.22 && $onStumps && $d['length'] <= 2 && $r4 < 0.35) { $res['kind'] = 'out'; $res['wicket'] = 'bowled'; $res['text'] = 'Wrong shot - through the gate, bowled!'; return $res; }
    $v = $q * GE_POWER[$shot] + ($r3 - 0.5) * 0.1;
    $runs = 0;
    if (($shot === 'loft' || $shot === 'pull') && $v > 0.86) $runs = 6;
    elseif ($v > 0.64) $runs = 4;
    elseif ($v > 0.6) $runs = 3;
    elseif ($v > 0.48) $runs = 2;
    elseif ($v > 0.3) $runs = 1;
    $res['runs'] = $runs; $res['kind'] = $runs ? 'runs' : 'dot';
    $res['dist'] = $runs === 6 ? 1.25 : ($runs === 4 ? 1.02 : ge_clamp(0.25 + $v * 0.7, 0.2, 0.9));
    $where = GE_ZONE[$shot];
    $res['text'] = $runs === 6 ? "SIX! Smashed $where!" : ($runs === 4 ? "FOUR! Timed beautifully $where." : ($runs ? "$runs run" . ($runs > 1 ? 's' : '') . ", pushed $where." : ($shot === 'defend' ? 'Solid defence.' : 'Straight to the fielder. No run.')));
    return $res;
}

function ge_new_inn(int $bat): array { return ['bat' => $bat, 'runs' => 0, 'wk' => 0, 'balls' => 0, 'fours' => 0, 'sixes' => 0, 'extras' => 0, 'log' => []]; }
function ge_new_game(int $overs, int $wickets, int $firstBat): array {
    return ['overs' => ge_clamp($overs, 1, 10), 'wickets' => ge_clamp($wickets, 1, 10), 'inn' => [ge_new_inn($firstBat), ge_new_inn(1 - $firstBat)],
        'cur' => 0, 'phase' => 'bowl', 'ball' => null, 'last' => null, 'result' => null, 'winner' => null, 'n' => 0];
}
function ge_bowl(array &$g, int $pace, int $line, int $length, float $e, int $seed): array {
    $d = ge_deliver($pace, $line, $length, $e);
    $d['seed'] = $seed & 0xFFFFFFFF; $d['id'] = ++$g['n']; $d['at'] = time();
    $g['ball'] = $d; $g['phase'] = 'bat';
    return $d;
}
function ge_bat(array &$g, ?string $shot, float $delta): array {
    $d = $g['ball'];
    $res = ge_resolve($d, $shot, $delta, (int)$d['seed']);
    $i = $g['cur'];
    $g['inn'][$i]['runs'] += $res['runs']; $g['inn'][$i]['extras'] += $res['extra'];
    if ($res['legal']) $g['inn'][$i]['balls']++;
    if ($res['kind'] === 'out') $g['inn'][$i]['wk']++;
    if ($res['runs'] === 4 && $res['legal']) $g['inn'][$i]['fours']++;
    if ($res['runs'] === 6) $g['inn'][$i]['sixes']++;
    $g['inn'][$i]['log'][] = $res['kind'] === 'out' ? 'W' : ($res['kind'] === 'wide' ? 'wd' : (string)$res['runs']);
    if (count($g['inn'][$i]['log']) > 12) array_shift($g['inn'][$i]['log']);
    $res['id'] = $d['id']; $res['delivery'] = $d; $res['inn'] = $i;
    $g['last'] = $res; $g['ball'] = null; $g['phase'] = 'bowl';
    $inn = $g['inn'][$i];
    $over = $inn['balls'] >= $g['overs'] * 6 || $inn['wk'] >= $g['wickets'];
    if ($i === 1 && $inn['runs'] >= $g['inn'][0]['runs'] + 1) ge_finish($g);
    elseif ($over) { if ($i === 0) { $g['cur'] = 1; $g['last']['inningsOver'] = true; } else ge_finish($g); }
    return $g['last'];
}
function ge_finish(array &$g): void {
    $a = $g['inn'][0]; $b = $g['inn'][1];
    $g['phase'] = 'done';
    if ($b['runs'] > $a['runs']) { $g['winner'] = $b['bat']; $g['result'] = ['by' => 'wickets', 'n' => $g['wickets'] - $b['wk']]; }
    elseif ($a['runs'] > $b['runs']) { $g['winner'] = $a['bat']; $g['result'] = ['by' => 'runs', 'n' => $a['runs'] - $b['runs']]; }
    else { $g['winner'] = -1; $g['result'] = ['by' => 'tie', 'n' => 0]; }
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
        $overs = ge_clamp((int)($in['overs'] ?? 2), 1, 10); $wk = ge_clamp((int)($in['wickets'] ?? 3), 1, 10);
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
        ge_bowl($st, (int)($in['pace'] ?? 1), (int)($in['line'] ?? 2), (int)($in['length'] ?? 2), (float)ge_clamp((float)($in['e'] ?? 0), -1, 1), random_int(1, 0x7FFFFFFF));
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
            $shot = in_array($in['shot'] ?? '', GE_SHOTS, true) ? $in['shot'] : 'leave';
            ge_bat($st, $shot, (float)ge_clamp((float)($in['delta'] ?? 0), -5000, 5000));
        } else {                                          // the batter's phone went quiet: count it as a leave
            if ($batter === $g['me'] || time() - (int)$st['ball']['at'] < 20) { db()->rollBack(); return game_view($g); }
            ge_bat($st, 'leave', 0);
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
