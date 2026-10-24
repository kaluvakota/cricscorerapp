<?php
/* Cric-Scorer - scoring engine, scorecards, results and statistics */

const BOWLER_WICKETS = ['bowled', 'caught', 'lbw', 'stumped', 'hit wicket'];
const WICKET_TYPES   = ['bowled', 'caught', 'lbw', 'run out', 'stumped', 'hit wicket', 'retired hurt'];
require_once __DIR__ . '/dls.php';

function overs_str(int $balls, int $bpo): string { return intdiv($balls, $bpo) . '.' . ($balls % $bpo); }

function load_match(int $id, bool $lock = false): array {
    $m = row('SELECT * FROM matches WHERE id=?' . ($lock ? ' FOR UPDATE' : ''), [$id]);
    if (!$m) fail('Match not found', 404);
    return $m;
}
function latest_innings(int $matchId): ?array {
    return row('SELECT * FROM innings WHERE match_id=? ORDER BY innings_no DESC LIMIT 1', [$matchId]);
}
function xi_ids(int $matchId, int $teamId): array {
    return array_map('intval', array_column(rows('SELECT player_id FROM match_players WHERE match_id=? AND team_id=? ORDER BY bat_order, player_id', [$matchId, $teamId]), 'player_id'));
}
function out_ids(int $inningsId): array {
    return array_map('intval', array_column(rows('SELECT dismissed_id FROM balls WHERE innings_id=? AND is_wicket=1 AND dismissed_id IS NOT NULL', [$inningsId]), 'dismissed_id'));
}
function available_batters(array $inn): array {
    $xi = xi_ids((int)$inn['match_id'], (int)$inn['batting_team_id']);
    $out = out_ids((int)$inn['id']);
    $crease = array_filter([(int)$inn['striker_id'], (int)$inn['non_striker_id']]);
    return array_values(array_diff($xi, $out, $crease));
}
function recompute_innings(int $innId): array {
    $a = row('SELECT COALESCE(SUM(total_runs),0) r, COALESCE(SUM(is_wicket),0) w, COALESCE(SUM(is_legal),0) l, COALESCE(SUM(extra_runs),0) e FROM balls WHERE innings_id=?', [$innId]);
    q('UPDATE innings SET runs=?, wickets=?, legal_balls=?, extras=? WHERE id=?', [(int)$a['r'], (int)$a['w'], (int)$a['l'], (int)$a['e'], $innId]);
    return row('SELECT * FROM innings WHERE id=?', [$innId]);
}
function add_innings_batter(int $innId, int $pid): void {
    if (!val('SELECT 1 FROM innings_batters WHERE innings_id=? AND player_id=?', [$innId, $pid])) {
        $pos = (int)val('SELECT COALESCE(MAX(position),0) FROM innings_batters WHERE innings_id=?', [$innId]) + 1;
        q('INSERT INTO innings_batters (innings_id, player_id, position) VALUES (?,?,?)', [$innId, $pid, $pos]);
    }
}

/** Why the innings is over, or null if it continues */
function innings_end_reason(array $m, array $inn): ?string {
    $bpo = (int)$m['balls_per_over'];
    if ((int)$inn['innings_no'] === 2 && $inn['target'] !== null && (int)$inn['runs'] >= (int)$inn['target']) return 'target';
    if ((int)$inn['legal_balls'] >= (int)$inn['max_overs'] * $bpo) return 'overs';
    $atCrease = count(array_filter([(int)$inn['striker_id'], (int)$inn['non_striker_id']]));
    $canBat = $atCrease + count(available_batters($inn));
    $need = $m['last_man_stands'] ? 1 : 2;
    if ($canBat < $need) return 'all out';
    return null;
}

/* ---------- Match flow ---------- */

function set_playing_xi(array $m, array $in): void {
    if ($m['status'] !== 'scheduled' || latest_innings((int)$m['id'])) fail('Playing XI can only be changed before the match starts');
    $max = (int)$m['players_per_side'];
    $min = $m['last_man_stands'] ? 1 : 2;
    q('DELETE FROM match_players WHERE match_id=?', [$m['id']]);
    q('UPDATE matches SET toss_winner_id=NULL, toss_decision=NULL WHERE id=?', [$m['id']]);
    foreach ([(int)$m['team1_id'], (int)$m['team2_id']] as $tid) {
        $ids = array_values(array_unique(array_map('intval', (array)($in['xi'][$tid] ?? $in['xi'][(string)$tid] ?? []))));
        if (count($ids) < $min) fail("Select at least $min player(s) for each team");
        if (count($ids) > $max) fail("Select at most $max players per team");
        $order = 0;
        foreach ($ids as $pid) {
            if (!val('SELECT 1 FROM players WHERE id=? AND team_id=?', [$pid, $tid])) fail('A selected player does not belong to the team');
            q('INSERT INTO match_players (match_id, team_id, player_id, bat_order) VALUES (?,?,?,?)', [$m['id'], $tid, $pid, ++$order]);
        }
    }
}

function set_toss(array $m, array $in): void {
    if (latest_innings((int)$m['id'])) fail('The match has already started');
    $w = (int)($in['winner_id'] ?? 0);
    $d = $in['decision'] ?? '';
    if (!in_array($w, [(int)$m['team1_id'], (int)$m['team2_id']], true)) fail('Pick the team that won the toss');
    if (!in_array($d, ['bat', 'bowl'], true)) fail('Choose bat or bowl');
    q('UPDATE matches SET toss_winner_id=?, toss_decision=? WHERE id=?', [$w, $d, $m['id']]);
}

function start_innings(array $m, array $in): void {
    if (!$m['toss_winner_id']) fail('Do the toss first');
    $last = latest_innings((int)$m['id']);
    if ($last && ($last['status'] === 'live' || (int)$last['innings_no'] === 2)) fail('Innings already in progress');
    if (!$last) {
        $bat = $m['toss_decision'] === 'bat' ? (int)$m['toss_winner_id'] : ((int)$m['toss_winner_id'] === (int)$m['team1_id'] ? (int)$m['team2_id'] : (int)$m['team1_id']);
        $bowl = $bat === (int)$m['team1_id'] ? (int)$m['team2_id'] : (int)$m['team1_id'];
        $no = 1; $target = null; $alloc = (int)$m['overs'];
    } else {
        $bat = (int)$last['bowling_team_id']; $bowl = (int)$last['batting_team_id'];
        $no = 2; $target = (int)$last['runs'] + 1;
        $alloc = (int)$last['max_overs'];
        if ($m['inn2_overs'] !== null) $alloc = min($alloc, (int)$m['inn2_overs']);
    }
    $s = (int)($in['striker_id'] ?? 0);
    $ns = nint($in['non_striker_id'] ?? null);
    $b = (int)($in['bowler_id'] ?? 0);
    $batXi = xi_ids((int)$m['id'], $bat);
    $bowlXi = xi_ids((int)$m['id'], $bowl);
    if (!in_array($s, $batXi, true)) fail('Choose the striker');
    if ($ns === null && !($m['last_man_stands'] && count($batXi) === 1)) fail('Choose the non-striker');
    if ($ns !== null && (!in_array($ns, $batXi, true) || $ns === $s)) fail('Choose a different non-striker');
    if (!in_array($b, $bowlXi, true)) fail('Choose the opening bowler');
    q('INSERT INTO innings (match_id, innings_no, batting_team_id, bowling_team_id, target, max_overs, start_overs, striker_id, non_striker_id, bowler_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [$m['id'], $no, $bat, $bowl, $target, $alloc, $alloc, $s, $ns, $b]);
    $innId = lastId();
    if ($no === 2) dls_update_target($m);
    add_innings_batter($innId, $s);
    if ($ns) add_innings_batter($innId, $ns);
    q("UPDATE matches SET status='live' WHERE id=?", [$m['id']]);
}

function live_innings(array $m): array {
    $inn = latest_innings((int)$m['id']);
    if (!$inn || $inn['status'] !== 'live' || $m['status'] !== 'live') fail('No innings in progress');
    return $inn;
}

function score_ball(array $m, array $in): void {
    $inn = live_innings($m);
    $avail = available_batters($inn);
    if (!$inn['striker_id'] || (!$inn['non_striker_id'] && count($avail) > 0)) fail('Select the next batter first');
    if (!$inn['bowler_id']) fail('Select the bowler first');

    $extra = $in['extra'] ?? null;
    if ($extra === '' ) $extra = null;
    if ($extra !== null && !in_array($extra, ['wd', 'nb', 'b', 'lb'], true)) fail('Unknown extra');
    $runs = max(0, min(7, (int)($in['runs'] ?? 0)));
    $runsBat = 0; $extraRuns = 0;
    switch ($extra) {
        case null: $runsBat = $runs; break;
        case 'wd': $extraRuns = 1 + $runs; break;
        case 'nb': $runsBat = $runs; $extraRuns = 1; break;
        case 'b': case 'lb':
            if ($runs < 1) fail('Byes need at least 1 run');
            $extraRuns = $runs; break;
    }
    $legal = in_array($extra, ['wd', 'nb'], true) ? 0 : 1;

    $s = (int)$inn['striker_id']; $ns = $inn['non_striker_id'] ? (int)$inn['non_striker_id'] : null;
    $isW = 0; $wType = null; $dismissed = null; $fielder = null;
    if (!empty($in['wicket']) && is_array($in['wicket'])) {
        $w = $in['wicket'];
        $wType = $w['type'] ?? '';
        if (!in_array($wType, WICKET_TYPES, true)) fail('Unknown dismissal type');
        if ($extra === 'wd' && !in_array($wType, ['stumped', 'run out', 'hit wicket'], true)) fail('On a wide only stumped, run out or hit wicket is possible');
        if ($extra === 'nb' && $wType !== 'run out') fail('On a no-ball only run out is possible');
        if (in_array($extra, ['b', 'lb'], true) && $wType !== 'run out') fail('With byes only run out is possible');
        if (in_array($wType, ['run out', 'retired hurt'], true)) {
            $dismissed = (int)($w['dismissed_id'] ?? $s);
            if ($dismissed !== $s && $dismissed !== $ns) fail('The dismissed batter must be at the crease');
        } else {
            $dismissed = $s;
        }
        $isW = $wType === 'retired hurt' ? 0 : 1;
        $fielder = nint($w['fielder_id'] ?? null);
        if ($fielder && !in_array($fielder, xi_ids((int)$m['id'], (int)$inn['bowling_team_id']), true)) $fielder = null;
        if ($wType === 'retired hurt') { $runsBat = 0; $extraRuns = 0; $legal = 0; $extra = null; }
    }

    $bpo = (int)$m['balls_per_over'];
    $overNo = intdiv((int)$inn['legal_balls'], $bpo);
    $ballNo = ((int)$inn['legal_balls'] % $bpo) + 1;
    $seq = (int)val('SELECT COALESCE(MAX(seq),0) FROM balls WHERE innings_id=?', [$inn['id']]) + 1;
    q('INSERT INTO balls (innings_id, seq, over_no, ball_no, batsman_id, non_striker_id, bowler_id, runs_bat, extra_type, extra_runs, total_runs, is_legal, is_wicket, wicket_type, dismissed_id, fielder_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [$inn['id'], $seq, $overNo, $ballNo, $s, $ns, (int)$inn['bowler_id'], $runsBat, $extra, $extraRuns, $runsBat + $extraRuns, $legal, $isW, $wType, $dismissed, $fielder]);

    // Strike rotation: odd runs physically run swap ends
    if ($wType !== 'retired hurt' && $runs % 2 === 1) { [$s, $ns] = [$ns, $s]; }
    if ($dismissed) {
        if ($s === $dismissed) $s = null; elseif ($ns === $dismissed) $ns = null;
    }
    $inn = recompute_innings((int)$inn['id']);
    $bowler = (int)$inn['bowler_id'];
    if ($legal && (int)$inn['legal_balls'] % $bpo === 0) { [$s, $ns] = [$ns, $s]; $bowler = null; }

    $inn['striker_id'] = $s; $inn['non_striker_id'] = $ns;
    if ($m['last_man_stands'] && count(available_batters($inn)) === 0 && !$s && $ns) { $s = $ns; $ns = null; }
    q('UPDATE innings SET striker_id=?, non_striker_id=?, bowler_id=? WHERE id=?', [$s, $ns, $bowler, $inn['id']]);
    $inn = row('SELECT * FROM innings WHERE id=?', [$inn['id']]);
    if (innings_end_reason($m, $inn)) complete_innings($m, $inn);
}

function set_batter(array $m, array $in): void {
    $inn = live_innings($m);
    $pid = (int)($in['player_id'] ?? 0);
    if (!in_array($pid, available_batters($inn), true)) fail('That player cannot bat now');
    if (!$inn['striker_id']) q('UPDATE innings SET striker_id=? WHERE id=?', [$pid, $inn['id']]);
    elseif (!$inn['non_striker_id']) q('UPDATE innings SET non_striker_id=? WHERE id=?', [$pid, $inn['id']]);
    else fail('Both batters are already at the crease');
    add_innings_batter((int)$inn['id'], $pid);
}

function bowler_balls(int $innId, int $pid): int {
    return (int)val('SELECT COALESCE(SUM(is_legal),0) FROM balls WHERE innings_id=? AND bowler_id=?', [$innId, $pid]);
}
function prev_over_bowler(array $m, array $inn): ?int {
    $bpo = (int)$m['balls_per_over'];
    $cur = intdiv((int)$inn['legal_balls'], $bpo);
    $v = val('SELECT bowler_id FROM balls WHERE innings_id=? AND over_no=? ORDER BY seq DESC LIMIT 1', [$inn['id'], $cur - 1]);
    return $v === null ? null : (int)$v;
}

function set_bowler(array $m, array $in): void {
    $inn = live_innings($m);
    $pid = (int)($in['player_id'] ?? 0);
    $xi = xi_ids((int)$m['id'], (int)$inn['bowling_team_id']);
    if (!in_array($pid, $xi, true)) fail('Choose a bowler from the fielding side');
    $bpo = (int)$m['balls_per_over'];
    $startOfOver = (int)$inn['legal_balls'] % $bpo === 0;
    if ($startOfOver && count($xi) > 1 && prev_over_bowler($m, $inn) === $pid) fail('A bowler cannot bowl two overs in a row');
    $max = (int)$m['max_overs_bowler'];
    if ($max > 0 && $startOfOver && bowler_balls((int)$inn['id'], $pid) >= $max * $bpo) fail("This bowler has finished their $max overs");
    q('UPDATE innings SET bowler_id=? WHERE id=?', [$pid, $inn['id']]);
}

function swap_strike(array $m): void {
    $inn = live_innings($m);
    q('UPDATE innings SET striker_id=?, non_striker_id=? WHERE id=?', [$inn['non_striker_id'], $inn['striker_id'], $inn['id']]);
}

function complete_innings(array $m, array $inn): void {
    q("UPDATE innings SET status='completed' WHERE id=?", [$inn['id']]);
    if ((int)$inn['innings_no'] === 2) finish_match((int)$m['id']);
}

function end_innings_manual(array $m): void {
    $inn = live_innings($m);
    complete_innings($m, $inn);
}

function finish_match(int $matchId): void {
    $m = load_match($matchId);
    $i1 = row('SELECT * FROM innings WHERE match_id=? AND innings_no=1', [$matchId]);
    $i2 = row('SELECT * FROM innings WHERE match_id=? AND innings_no=2', [$matchId]);
    if (!$i1 || !$i2) return;
    $names = [];
    foreach (rows('SELECT id, name FROM teams WHERE id IN (?,?)', [$m['team1_id'], $m['team2_id']]) as $t) $names[(int)$t['id']] = $t['name'];
    $bpo = (int)$m['balls_per_over'];
    $dls = (int)$i2['dls'] === 1;
    $tieScore = (int)$i2['target'] - 1;            // equals team 1's score unless DLS revised it
    $tag = $dls ? ' (DLS method)' : '';
    if ((int)$i2['runs'] > $tieScore) {
        $winner = (int)$i2['batting_team_id'];
        $n = count(xi_ids($matchId, $winner));
        $left = ($m['last_man_stands'] ? $n : $n - 1) - (int)$i2['wickets'];
        $ballsLeft = (int)$i2['max_overs'] * $bpo - (int)$i2['legal_balls'];
        $text = $names[$winner] . ' won by ' . max(1, $left) . ' wicket' . (max(1, $left) === 1 ? '' : 's');
        if ($ballsLeft > 0) $text .= " ($ballsLeft ball" . ($ballsLeft === 1 ? '' : 's') . ' left)';
        $text .= $tag;
    } elseif ((int)$i2['runs'] < $tieScore) {
        $winner = (int)$i1['batting_team_id'];
        $d = $tieScore - (int)$i2['runs'];
        $text = $names[$winner] . " won by $d run" . ($d === 1 ? '' : 's') . $tag;
    } else {
        $winner = null; $text = 'Match tied' . $tag;
    }
    $pom = player_of_match($matchId, $winner);
    q("UPDATE matches SET status='completed', winner_team_id=?, result_text=?, result_method=?, player_of_match_id=? WHERE id=?", [$winner, $text, $dls ? 'dls' : null, $pom, $matchId]);
}

/** Simple impact score: runs + 25 per wicket + 10 per catch/stumping/run-out, +bonus for winning side */
function player_of_match(int $matchId, ?int $winner): ?int {
    $score = [];
    foreach (rows('SELECT b.* FROM balls b JOIN innings i ON i.id=b.innings_id WHERE i.match_id=?', [$matchId]) as $b) {
        $score[$b['batsman_id']] = ($score[$b['batsman_id']] ?? 0) + (int)$b['runs_bat'];
        if ($b['is_wicket'] && in_array($b['wicket_type'], BOWLER_WICKETS, true)) $score[$b['bowler_id']] = ($score[$b['bowler_id']] ?? 0) + 25;
        if ($b['is_wicket'] && $b['fielder_id']) $score[$b['fielder_id']] = ($score[$b['fielder_id']] ?? 0) + 10;
    }
    if (!$score) return null;
    $winnerIds = $winner ? xi_ids($matchId, $winner) : [];
    foreach ($score as $pid => $s) if (in_array((int)$pid, $winnerIds, true)) $score[$pid] = $s * 1.2;
    arsort($score);
    return (int)array_key_first($score);
}

function undo_ball(array $m): void {
    if ($m['result_method'] === 'rain') {          // undo "rain stopped play" - resume the chase
        q("UPDATE innings SET status='live' WHERE match_id=? AND innings_no=2", [$m['id']]);
        q("UPDATE matches SET status='live', winner_team_id=NULL, result_text=NULL, result_method=NULL, player_of_match_id=NULL WHERE id=?", [$m['id']]);
        return;
    }
    if ($m['status'] === 'abandoned') fail('Match was abandoned');
    $inn = latest_innings((int)$m['id']);
    if (!$inn) fail('Nothing to undo');
    $last = row('SELECT * FROM balls WHERE innings_id=? ORDER BY seq DESC LIMIT 1', [$inn['id']]);
    if (!$last) {
        // Innings has no balls yet: step back to choosing openers (or to before the start)
        q('DELETE FROM innings WHERE id=?', [$inn['id']]);
        if ((int)$inn['innings_no'] === 1) q("UPDATE matches SET status='scheduled' WHERE id=?", [$m['id']]);
        return;
    }
    undo_specific_ball($m, $inn, $last);
}

function undo_specific_ball(array $m, array $inn, array $ball): void {
    q('DELETE FROM balls WHERE id=?', [$ball['id']]);
    q("UPDATE innings SET status='live', striker_id=?, non_striker_id=?, bowler_id=? WHERE id=?", [$ball['batsman_id'], $ball['non_striker_id'], $ball['bowler_id'], $inn['id']]);
    // A second innings can only exist if this one is complete; remove an empty one if we reopened innings 1
    if ((int)$inn['innings_no'] === 1) q('DELETE FROM innings WHERE match_id=? AND innings_no=2', [$m['id']]);
    recompute_innings((int)$inn['id']);
    // Remove batters who came in after this ball but have not faced or been at the crease
    $keep = [(int)$ball['batsman_id'], (int)$ball['non_striker_id']];
    foreach (rows('SELECT player_id FROM innings_batters WHERE innings_id=?', [$inn['id']]) as $r) {
        $p = (int)$r['player_id'];
        if (in_array($p, $keep, true)) continue;
        $used = val('SELECT 1 FROM balls WHERE innings_id=? AND (batsman_id=? OR non_striker_id=? OR dismissed_id=?) LIMIT 1', [$inn['id'], $p, $p, $p]);
        if (!$used) q('DELETE FROM innings_batters WHERE innings_id=? AND player_id=?', [$inn['id'], $p]);
    }
    q("UPDATE matches SET status='live', winner_team_id=NULL, result_text=NULL, result_method=NULL, player_of_match_id=NULL WHERE id=?", [$m['id']]);
}

/* ---------- Scorecard & state ---------- */

function name_map(int $matchId): array {
    $map = [];
    foreach (rows('SELECT p.id, p.name FROM match_players mp JOIN players p ON p.id=mp.player_id WHERE mp.match_id=?', [$matchId]) as $p) $map[(int)$p['id']] = $p['name'];
    return $map;
}

function ball_label(array $b): string {
    if ($b['wicket_type'] === 'retired hurt') return 'RH';
    $l = '';
    switch ($b['extra_type']) {
        case 'wd': $l = ((int)$b['extra_runs'] > 1 ? ((int)$b['extra_runs'] - 1) : '') . 'wd'; break;
        case 'nb': $l = ((int)$b['runs_bat'] > 0 ? (int)$b['runs_bat'] : '') . 'nb'; break;
        case 'b':  $l = (int)$b['extra_runs'] . 'b'; break;
        case 'lb': $l = (int)$b['extra_runs'] . 'lb'; break;
        default:   $l = (string)(int)$b['runs_bat'];
    }
    if ($b['is_wicket']) $l = ($l === '0' ? '' : $l . '+') . 'W';
    return $l;
}

function dismissal_text(array $b, array $n): string {
    $bw = $n[(int)$b['bowler_id']] ?? '?';
    $f = $b['fielder_id'] ? ($n[(int)$b['fielder_id']] ?? '?') : null;
    switch ($b['wicket_type']) {
        case 'bowled': return "b $bw";
        case 'caught': return ($f && (int)$b['fielder_id'] === (int)$b['bowler_id']) ? "c & b $bw" : ('c ' . ($f ?? 'sub') . " b $bw");
        case 'lbw': return "lbw b $bw";
        case 'run out': return 'run out' . ($f ? " ($f)" : '');
        case 'stumped': return 'st ' . ($f ?? '?') . " b $bw";
        case 'hit wicket': return "hit wicket b $bw";
        case 'retired hurt': return 'retired hurt';
    }
    return 'out';
}

function ball_desc(array $b, array $n): string {
    $bat = $n[(int)$b['batsman_id']] ?? '?';
    $bw = $n[(int)$b['bowler_id']] ?? '?';
    $r = (int)$b['runs_bat'];
    $head = "$bw to $bat, ";
    if ($b['wicket_type'] === 'retired hurt') return ($n[(int)$b['dismissed_id']] ?? '?') . ' retired hurt';
    switch ($b['extra_type']) {
        case 'wd': $d = 'wide' . ((int)$b['extra_runs'] > 1 ? ' + ' . ((int)$b['extra_runs'] - 1) . ' run(s)' : ''); break;
        case 'nb': $d = 'no ball' . ($r ? " + $r off the bat" : ''); break;
        case 'b':  $d = (int)$b['extra_runs'] . ' bye' . ((int)$b['extra_runs'] > 1 ? 's' : ''); break;
        case 'lb': $d = (int)$b['extra_runs'] . ' leg bye' . ((int)$b['extra_runs'] > 1 ? 's' : ''); break;
        default:   $d = $r === 4 ? 'FOUR!' : ($r === 6 ? 'SIX!' : ($r === 0 ? 'no run' : "$r run" . ($r > 1 ? 's' : '')));
    }
    if ($b['is_wicket']) $d .= ' - OUT! ' . ($n[(int)$b['dismissed_id']] ?? '?') . ' ' . dismissal_text($b, $n);
    return $head . $d;
}

function innings_card(array $m, array $inn, array $names): array {
    $bpo = (int)$m['balls_per_over'];
    $balls = rows('SELECT * FROM balls WHERE innings_id=? ORDER BY seq', [$inn['id']]);
    $bat = []; $bowl = []; $overs = []; $fow = []; $timeline = [];
    $extras = ['b' => 0, 'lb' => 0, 'wd' => 0, 'nb' => 0];
    foreach (rows('SELECT player_id FROM innings_batters WHERE innings_id=? ORDER BY position', [$inn['id']]) as $r) {
        $p = (int)$r['player_id'];
        $bat[$p] = ['id' => $p, 'name' => $names[$p] ?? '?', 'r' => 0, 'b' => 0, 'f4' => 0, 'f6' => 0, 'how' => 'not out', 'out' => false];
    }
    $score = 0; $wk = 0; $legal = 0; $overRuns = [];
    $partRuns = 0; $partBalls = 0;
    foreach ($balls as $b) {
        $p = (int)$b['batsman_id'];
        if (!isset($bat[$p])) $bat[$p] = ['id' => $p, 'name' => $names[$p] ?? '?', 'r' => 0, 'b' => 0, 'f4' => 0, 'f6' => 0, 'how' => 'not out', 'out' => false];
        foreach ([(int)$b['batsman_id'], (int)$b['non_striker_id']] as $atCrease) {
            if ($atCrease && isset($bat[$atCrease]) && $bat[$atCrease]['how'] === 'retired hurt') $bat[$atCrease]['how'] = 'not out';
        }
        if ($b['wicket_type'] !== 'retired hurt') {
            if ($b['extra_type'] !== 'wd') $bat[$p]['b']++;
            $bat[$p]['r'] += (int)$b['runs_bat'];
            if ((int)$b['runs_bat'] === 4) $bat[$p]['f4']++;
            if ((int)$b['runs_bat'] === 6) $bat[$p]['f6']++;
            $bw = (int)$b['bowler_id'];
            if (!isset($bowl[$bw])) $bowl[$bw] = ['id' => $bw, 'name' => $names[$bw] ?? '?', 'balls' => 0, 'm' => 0, 'r' => 0, 'w' => 0, 'wd' => 0, 'nb' => 0, 'dots' => 0, 'f4' => 0, 'f6' => 0];
            $conceded = (int)$b['runs_bat'] + (in_array($b['extra_type'], ['wd', 'nb'], true) ? (int)$b['extra_runs'] : 0);
            $bowl[$bw]['balls'] += (int)$b['is_legal'];
            $bowl[$bw]['r'] += $conceded;
            if ($b['extra_type'] === 'wd') $bowl[$bw]['wd'] += (int)$b['extra_runs'];
            if ($b['extra_type'] === 'nb') $bowl[$bw]['nb']++;
            if ($b['is_legal'] && $conceded === 0) $bowl[$bw]['dots']++;
            if ((int)$b['runs_bat'] === 4) $bowl[$bw]['f4']++;
            if ((int)$b['runs_bat'] === 6) $bowl[$bw]['f6']++;
            if ($b['is_wicket'] && in_array($b['wicket_type'], BOWLER_WICKETS, true)) $bowl[$bw]['w']++;
            $key = $bw . ':' . $b['over_no'];
            $overRuns[$key] = ['c' => ($overRuns[$key]['c'] ?? 0) + $conceded, 'l' => ($overRuns[$key]['l'] ?? 0) + (int)$b['is_legal'], 'bw' => $bw];
            if ($b['extra_type']) $extras[$b['extra_type']] += (int)$b['extra_runs'];
        }
        $score += (int)$b['total_runs'];
        $legal += (int)$b['is_legal'];
        $partRuns += (int)$b['total_runs'];
        $partBalls += (int)$b['is_legal'];
        $o = (int)$b['over_no'];
        if (!isset($overs[$o])) $overs[$o] = ['over' => $o + 1, 'runs' => 0, 'wkts' => 0, 'balls' => [], 'bowler' => $names[(int)$b['bowler_id']] ?? '?'];
        $overs[$o]['runs'] += (int)$b['total_runs'];
        $overs[$o]['balls'][] = ball_label($b);
        if ($b['dismissed_id'] && isset($bat[(int)$b['dismissed_id']])) {
            $bat[(int)$b['dismissed_id']]['how'] = dismissal_text($b, $names);
        }
        if ($b['is_wicket']) {
            $wk++;
            $overs[$o]['wkts']++;
            $bat[(int)$b['dismissed_id']]['out'] = true;
            $fow[] = ['score' => $score, 'wkt' => $wk, 'name' => $names[(int)$b['dismissed_id']] ?? '?', 'overs' => overs_str($legal, $bpo)];
            $partRuns = 0; $partBalls = 0;
        }
        $timeline[] = ['seq' => (int)$b['seq'], 'ov' => $o . '.' . (int)$b['ball_no'], 'over_no' => $o, 'label' => ball_label($b),
            'w' => (bool)$b['is_wicket'], 'ex' => $b['extra_type'], 'rb' => (int)$b['runs_bat'], 'xr' => (int)$b['extra_runs'], 'desc' => ball_desc($b, $names),
            'bat' => $names[(int)$b['batsman_id']] ?? '', 'bowl' => $names[(int)$b['bowler_id']] ?? '', 'wt' => $b['wicket_type'],
            'out' => $b['dismissed_id'] ? ($names[(int)$b['dismissed_id']] ?? '') : null, 'out_id' => $b['dismissed_id'] ? (int)$b['dismissed_id'] : null,
            'fld' => $b['fielder_id'] ? ($names[(int)$b['fielder_id']] ?? '') : null];
    }
    foreach ($overRuns as $or) if ($or['l'] === $bpo && $or['c'] === 0) $bowl[$or['bw']]['m']++;
    foreach ($bat as &$x) $x['sr'] = $x['b'] ? round($x['r'] * 100 / $x['b'], 1) : 0;
    unset($x);
    foreach ($bowl as &$x) { $x['o'] = overs_str($x['balls'], $bpo); $x['econ'] = $x['balls'] ? round($x['r'] * $bpo / $x['balls'], 2) : 0; }
    unset($x);
    $xi = xi_ids((int)$m['id'], (int)$inn['batting_team_id']);
    $dnb = [];
    foreach ($xi as $p) if (!isset($bat[$p])) $dnb[] = ['id' => $p, 'name' => $names[$p] ?? '?'];

    $runs = (int)$inn['runs']; $lb = (int)$inn['legal_balls'];
    $res = [
        'id' => (int)$inn['id'], 'no' => (int)$inn['innings_no'], 'status' => $inn['status'],
        'batting_team_id' => (int)$inn['batting_team_id'], 'bowling_team_id' => (int)$inn['bowling_team_id'],
        'runs' => $runs, 'wickets' => (int)$inn['wickets'], 'legal_balls' => $lb, 'overs' => overs_str($lb, $bpo),
        'extras' => (int)$inn['extras'], 'extras_detail' => $extras, 'target' => $inn['target'] === null ? null : (int)$inn['target'],
        'max_overs' => (int)$inn['max_overs'], 'dls' => (bool)$inn['dls'],
        'crr' => $lb ? round($runs * $bpo / $lb, 2) : 0,
        'batting' => array_values($bat), 'bowling' => array_values($bowl), 'dnb' => $dnb,
        'fow' => $fow, 'overs_list' => array_values($overs), 'timeline' => $timeline,
        'striker_id' => $inn['striker_id'] ? (int)$inn['striker_id'] : null,
        'non_striker_id' => $inn['non_striker_id'] ? (int)$inn['non_striker_id'] : null,
        'bowler_id' => $inn['bowler_id'] ? (int)$inn['bowler_id'] : null,
        'partnership' => ['runs' => $partRuns, 'balls' => $partBalls],
    ];
    $totalBalls = (int)$inn['max_overs'] * $bpo;
    if ($res['target'] !== null) {
        $need = $res['target'] - $runs;
        $left = $totalBalls - $lb;
        $res['need'] = max(0, $need);
        $res['balls_left'] = max(0, $left);
        $res['rrr'] = $left > 0 ? round($need * $bpo / $left, 2) : 0;
    } else {
        $res['projected'] = $lb ? (int)round($runs / $lb * $totalBalls) : 0;
    }
    return $res;
}

function team_brief(int $id): ?array {
    $t = row('SELECT id, name, short_name, color, category FROM teams WHERE id=?', [$id]);
    if ($t) $t['id'] = (int)$t['id'];
    return $t;
}

function match_state(int $matchId, ?array $u): array {
    $m = load_match($matchId);
    if (!can_view_match($m, $u)) fail('This match is private 🔒', 403);
    $names = name_map($matchId);
    $t1 = team_brief((int)$m['team1_id']); $t2 = team_brief((int)$m['team2_id']);
    $xi = [];
    foreach ([(int)$m['team1_id'], (int)$m['team2_id']] as $tid) {
        $xi[$tid] = rows('SELECT p.id, p.name, p.role, p.batting_style, p.bowling_style FROM match_players mp JOIN players p ON p.id=mp.player_id WHERE mp.match_id=? AND mp.team_id=? ORDER BY mp.bat_order', [$matchId, $tid]);
    }
    $inns = [];
    foreach (rows('SELECT * FROM innings WHERE match_id=? ORDER BY innings_no', [$matchId]) as $inn) $inns[] = innings_card($m, $inn, $names);
    $last = $inns ? end($inns) : null;
    $needs = null; $avail = []; $prevBowler = null; $bowlerBalls = [];
    if (in_array($m['status'], ['completed', 'abandoned'], true)) $needs = 'completed';
    elseif (!$xi[(int)$m['team1_id']] || !$xi[(int)$m['team2_id']]) $needs = 'players';
    elseif (!$m['toss_winner_id']) $needs = 'toss';
    elseif (!$last) $needs = 'openers';
    elseif ($last['status'] === 'completed') $needs = $last['no'] === 1 ? 'openers' : 'completed';
    else {
        $innRow = row('SELECT * FROM innings WHERE id=?', [$last['id']]);
        $avail = available_batters($innRow);
        if (!$innRow['striker_id'] || (!$innRow['non_striker_id'] && count($avail) > 0)) $needs = 'new_batter';
        elseif (!$innRow['bowler_id']) $needs = 'new_bowler';
        else $needs = 'ball';
        $prevBowler = prev_over_bowler($m, $innRow);
        foreach ($last['bowling'] as $bw) $bowlerBalls[$bw['id']] = $bw['balls'];
    }
    // For the openers stage, who bats next
    $next = null;
    if ($needs === 'openers') {
        if (!$last) {
            $bat = $m['toss_decision'] === 'bat' ? (int)$m['toss_winner_id'] : ((int)$m['toss_winner_id'] === (int)$m['team1_id'] ? (int)$m['team2_id'] : (int)$m['team1_id']);
            $next = ['batting_team_id' => $bat, 'bowling_team_id' => $bat === (int)$m['team1_id'] ? (int)$m['team2_id'] : (int)$m['team1_id'], 'target' => null, 'no' => 1, 'overs' => (int)$m['overs'], 'dls' => false];
        } else {
            $i1row = row('SELECT * FROM innings WHERE id=?', [$last['id']]);
            $alloc = (int)$i1row['max_overs'];
            if ($m['inn2_overs'] !== null) $alloc = min($alloc, (int)$m['inn2_overs']);
            $target = $last['runs'] + 1; $isDls = false;
            if ($alloc !== (int)$i1row['start_overs'] || dls_needed($m, $i1row)) {
                $target = dls_target((int)$i1row['runs'], dls_innings_resources($m, $i1row), dls_R($alloc, 0), dls_g50($m)); $isDls = true;
            }
            $next = ['batting_team_id' => $last['bowling_team_id'], 'bowling_team_id' => $last['batting_team_id'], 'target' => $target, 'no' => 2, 'overs' => $alloc, 'dls' => $isDls];
        }
    }
    $tour = $m['tournament_id'] ? row('SELECT id, name FROM tournaments WHERE id=?', [$m['tournament_id']]) : null;
    $owner = val('SELECT display_name FROM users WHERE id=?', [$m['owner_id']]);
    return [
        'match' => [
            'id' => (int)$m['id'], 'title' => $m['title'], 'status' => $m['status'], 'overs' => (int)$m['overs'],
            'balls_per_over' => (int)$m['balls_per_over'], 'players_per_side' => (int)$m['players_per_side'],
            'max_overs_bowler' => (int)$m['max_overs_bowler'], 'last_man_stands' => (bool)$m['last_man_stands'],
            'dls_g50' => (int)$m['dls_g50'], 'result_method' => $m['result_method'],
            'visibility' => $m['visibility'] ?? 'public', 'owner_id' => (int)$m['owner_id'],
            'venue' => $m['venue'], 'match_date' => $m['match_date'],
            'toss_winner_id' => $m['toss_winner_id'] ? (int)$m['toss_winner_id'] : null, 'toss_decision' => $m['toss_decision'],
            'winner_team_id' => $m['winner_team_id'] ? (int)$m['winner_team_id'] : null, 'result_text' => $m['result_text'],
            'player_of_match' => $m['player_of_match_id'] ? ['id' => (int)$m['player_of_match_id'], 'name' => $names[(int)$m['player_of_match_id']] ?? val('SELECT name FROM players WHERE id=?', [$m['player_of_match_id']])] : null,
            'tournament' => $tour, 'owner' => $owner,
            'scorer' => $m['scorer_id'] ? row('SELECT id, username, display_name FROM users WHERE id=?', [$m['scorer_id']]) : null,
        ],
        'team1' => $t1, 'team2' => $t2, 'xi' => $xi, 'innings' => $inns,
        'needs' => $needs, 'available_batters' => $avail, 'prev_over_bowler' => $prevBowler, 'bowler_balls' => $bowlerBalls,
        'next' => $next,
        'dls' => $inns ? dls_info($m) : null,
        'can_edit' => can_score_match($m, $u),
        'is_owner' => can_edit_owned($m, $u),
    ];
}

/** Compact summaries for match lists */
function match_summaries(array $matches): array {
    if (!$matches) return [];
    $ids = array_map(fn($m) => (int)$m['id'], $matches);
    $ph = implode(',', array_fill(0, count($ids), '?'));
    $inns = [];
    foreach (rows("SELECT match_id, innings_no, batting_team_id, runs, wickets, legal_balls FROM innings WHERE match_id IN ($ph) ORDER BY innings_no", $ids) as $i) $inns[(int)$i['match_id']][] = $i;
    $teamIds = [];
    foreach ($matches as $m) { $teamIds[] = (int)$m['team1_id']; $teamIds[] = (int)$m['team2_id']; }
    $teamIds = array_values(array_unique($teamIds));
    $tph = implode(',', array_fill(0, count($teamIds), '?'));
    $teams = [];
    foreach (rows("SELECT id, name, short_name, color FROM teams WHERE id IN ($tph)", $teamIds) as $t) { $t['id'] = (int)$t['id']; $teams[$t['id']] = $t; }
    $ownerIds = array_values(array_unique(array_map(fn($m) => (int)$m['owner_id'], $matches)));
    $owners = [];
    foreach (rows('SELECT id, display_name, is_private FROM users WHERE id IN (' . implode(',', array_fill(0, count($ownerIds), '?')) . ')', $ownerIds) as $o)
        $owners[(int)$o['id']] = $o['is_private'] ? null : ['id' => (int)$o['id'], 'name' => $o['display_name']];
    $res = [];
    foreach ($matches as $m) {
        $sc = [];
        foreach ($inns[(int)$m['id']] ?? [] as $i) $sc[(int)$i['batting_team_id']] = $i['runs'] . '/' . $i['wickets'] . ' (' . overs_str((int)$i['legal_balls'], (int)$m['balls_per_over']) . ')';
        $res[] = [
            'id' => (int)$m['id'], 'title' => $m['title'], 'status' => $m['status'], 'overs' => (int)$m['overs'],
            'match_date' => $m['match_date'], 'venue' => $m['venue'], 'result_text' => $m['result_text'],
            'tournament_id' => $m['tournament_id'] ? (int)$m['tournament_id'] : null, 'owner_id' => (int)$m['owner_id'],
            'owner' => $owners[(int)$m['owner_id']] ?? null, 'visibility' => $m['visibility'] ?? 'public',
            'team1' => $teams[(int)$m['team1_id']] ?? null, 'team2' => $teams[(int)$m['team2_id']] ?? null,
            'score1' => $sc[(int)$m['team1_id']] ?? null, 'score2' => $sc[(int)$m['team2_id']] ?? null,
            'winner_team_id' => $m['winner_team_id'] ? (int)$m['winner_team_id'] : null,
        ];
    }
    return $res;
}

/* ---------- Tournaments: points table & leaders ---------- */

function points_table(int $tid): array {
    $teams = rows('SELECT t.id, t.name, t.short_name, t.color FROM tournament_teams tt JOIN teams t ON t.id=tt.team_id WHERE tt.tournament_id=? ORDER BY t.name', [$tid]);
    $tbl = [];
    foreach ($teams as $t) $tbl[(int)$t['id']] = ['id' => (int)$t['id'], 'name' => $t['name'], 'short_name' => $t['short_name'], 'color' => $t['color'],
        'p' => 0, 'w' => 0, 'l' => 0, 't' => 0, 'nr' => 0, 'pts' => 0, 'rf' => 0, 'bf' => 0, 'ra' => 0, 'ba' => 0];
    foreach (rows("SELECT * FROM matches WHERE tournament_id=? AND status IN ('completed','abandoned')", [$tid]) as $m) {
        $a = (int)$m['team1_id']; $b = (int)$m['team2_id'];
        if (!isset($tbl[$a]) || !isset($tbl[$b])) continue;
        $tbl[$a]['p']++; $tbl[$b]['p']++;
        if ($m['status'] === 'abandoned') { foreach ([$a, $b] as $x) { $tbl[$x]['nr']++; $tbl[$x]['pts'] += 1; } continue; }
        if (!$m['winner_team_id']) { foreach ([$a, $b] as $x) { $tbl[$x]['t']++; $tbl[$x]['pts'] += 1; } }
        else { $w = (int)$m['winner_team_id']; $l = $w === $a ? $b : $a; $tbl[$w]['w']++; $tbl[$w]['pts'] += 2; $tbl[$l]['l']++; }
        $n = [];
        foreach ([$a, $b] as $x) $n[$x] = count(xi_ids((int)$m['id'], $x));
        foreach (rows('SELECT * FROM innings WHERE match_id=?', [$m['id']]) as $i) {
            $bt = (int)$i['batting_team_id']; $bw = (int)$i['bowling_team_id'];
            $allOut = (int)$i['wickets'] >= ($m['last_man_stands'] ? $n[$bt] : $n[$bt] - 1);
            $balls = $allOut ? (int)$i['max_overs'] * (int)$m['balls_per_over'] : (int)$i['legal_balls'];
            $bpo = (int)$m['balls_per_over'];
            $tbl[$bt]['rf'] += (int)$i['runs']; $tbl[$bt]['bf'] += $balls / $bpo;
            $tbl[$bw]['ra'] += (int)$i['runs']; $tbl[$bw]['ba'] += $balls / $bpo;
        }
    }
    foreach ($tbl as &$r) {
        $for = $r['bf'] > 0 ? $r['rf'] / $r['bf'] : 0;
        $ag = $r['ba'] > 0 ? $r['ra'] / $r['ba'] : 0;
        $r['nrr'] = round($for - $ag, 3);
        unset($r['rf'], $r['bf'], $r['ra'], $r['ba']);
    }
    unset($r);
    $tbl = array_values($tbl);
    usort($tbl, fn($x, $y) => [$y['pts'], $y['nrr'], $y['w']] <=> [$x['pts'], $x['nrr'], $x['w']]);
    return $tbl;
}

function leaderboards(?int $tournamentId = null, int $limit = 10, ?array $viewer = null): array {
    [$vs, $vp] = vis_sql($viewer, 'm');
    $where = ($tournamentId ? 'WHERE m.tournament_id=?' : "WHERE m.status IN ('live','completed')") . " AND $vs";
    $p = array_merge($tournamentId ? [$tournamentId] : [], $vp);
    $batSql = "SELECT b.batsman_id pid, p.name, t.short_name team, t.color,
                SUM(CASE WHEN b.wicket_type='retired hurt' THEN 0 ELSE b.runs_bat END) runs,
                SUM(CASE WHEN b.extra_type='wd' OR b.wicket_type='retired hurt' THEN 0 ELSE 1 END) balls,
                SUM(b.runs_bat=4) fours, SUM(b.runs_bat=6) sixes, COUNT(DISTINCT m.id) mats
               FROM balls b JOIN innings i ON i.id=b.innings_id JOIN matches m ON m.id=i.match_id
               JOIN players p ON p.id=b.batsman_id JOIN teams t ON t.id=p.team_id $where
               GROUP BY b.batsman_id, p.name, t.short_name, t.color";
    $bat = rows("$batSql ORDER BY runs DESC, balls ASC LIMIT $limit", $p);
    $six = rows("$batSql HAVING sixes > 0 ORDER BY sixes DESC, runs DESC LIMIT $limit", $p);
    $four = rows("$batSql HAVING fours > 0 ORDER BY fours DESC, runs DESC LIMIT $limit", $p);
    $bowl = rows("SELECT b.bowler_id pid, p.name, t.short_name team, t.color,
                SUM(b.is_wicket=1 AND b.wicket_type IN ('bowled','caught','lbw','stumped','hit wicket')) wkts,
                SUM(b.is_legal) balls, SUM(b.runs_bat + CASE WHEN b.extra_type IN ('wd','nb') THEN b.extra_runs ELSE 0 END) runs,
                COUNT(DISTINCT m.id) mats
               FROM balls b JOIN innings i ON i.id=b.innings_id JOIN matches m ON m.id=i.match_id
               JOIN players p ON p.id=b.bowler_id JOIN teams t ON t.id=p.team_id $where
               GROUP BY b.bowler_id, p.name, t.short_name, t.color HAVING wkts > 0 ORDER BY wkts DESC, runs ASC LIMIT $limit", $p);
    $cast = function ($list) { return array_map(function ($r) { foreach ($r as $k => $v) if (is_numeric($v) && !in_array($k, ['name', 'team', 'color'], true)) $r[$k] = (int)$v; return $r; }, $list); };
    return ['runs' => $cast($bat), 'wickets' => $cast($bowl), 'sixes' => $cast($six), 'fours' => $cast($four)];
}

function player_stats(int $pid, ?array $viewer = null): array {
    [$vs, $vp] = vis_sql($viewer, 'm');
    $bat = ['mat' => 0, 'inns' => 0, 'no' => 0, 'runs' => 0, 'balls' => 0, 'hs' => 0, 'hs_no' => false, 'f4' => 0, 'f6' => 0, 'fifties' => 0, 'hundreds' => 0, 'thirties' => 0];
    $bowl = ['inns' => 0, 'balls' => 0, 'runs' => 0, 'wkts' => 0, 'best_w' => 0, 'best_r' => 0, 'three' => 0, 'five' => 0];
    $bat['mat'] = (int)val("SELECT COUNT(*) FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE mp.player_id=? AND m.status IN ('live','completed') AND $vs", array_merge([$pid], $vp));
    foreach (rows("SELECT ib.innings_id FROM innings_batters ib JOIN innings i ON i.id=ib.innings_id JOIN matches m ON m.id=i.match_id WHERE ib.player_id=? AND $vs", array_merge([$pid], $vp)) as $r) {
        $iid = (int)$r['innings_id'];
        $a = row("SELECT COALESCE(SUM(runs_bat),0) r, COALESCE(SUM(CASE WHEN extra_type='wd' OR wicket_type='retired hurt' THEN 0 ELSE 1 END),0) b,
                  COALESCE(SUM(runs_bat=4),0) f4, COALESCE(SUM(runs_bat=6),0) f6 FROM balls WHERE innings_id=? AND batsman_id=?", [$iid, $pid]);
        $out = (bool)val('SELECT 1 FROM balls WHERE innings_id=? AND dismissed_id=? AND is_wicket=1', [$iid, $pid]);
        $r_ = (int)$a['r'];
        $bat['inns']++; $bat['runs'] += $r_; $bat['balls'] += (int)$a['b']; $bat['f4'] += (int)$a['f4']; $bat['f6'] += (int)$a['f6'];
        if (!$out) $bat['no']++;
        if ($r_ > $bat['hs'] || ($r_ === $bat['hs'] && !$out)) { $bat['hs'] = $r_; $bat['hs_no'] = !$out; }
        if ($r_ >= 100) $bat['hundreds']++; elseif ($r_ >= 50) $bat['fifties']++; elseif ($r_ >= 30) $bat['thirties']++;
    }
    $outs = $bat['inns'] - $bat['no'];
    $bat['avg'] = $outs > 0 ? round($bat['runs'] / $outs, 2) : null;
    $bat['sr'] = $bat['balls'] > 0 ? round($bat['runs'] * 100 / $bat['balls'], 1) : null;
    foreach (rows("SELECT b.innings_id, SUM(b.is_legal) balls, SUM(b.runs_bat + CASE WHEN b.extra_type IN ('wd','nb') THEN b.extra_runs ELSE 0 END) runs,
                   SUM(b.is_wicket=1 AND b.wicket_type IN ('bowled','caught','lbw','stumped','hit wicket')) wkts
                   FROM balls b JOIN innings i ON i.id=b.innings_id JOIN matches m ON m.id=i.match_id WHERE b.bowler_id=? AND $vs GROUP BY b.innings_id", array_merge([$pid], $vp)) as $r) {
        $w = (int)$r['wkts']; $rr = (int)$r['runs'];
        $bowl['inns']++; $bowl['balls'] += (int)$r['balls']; $bowl['runs'] += $rr; $bowl['wkts'] += $w;
        if ($w > $bowl['best_w'] || ($w === $bowl['best_w'] && ($bowl['inns'] === 1 || $rr < $bowl['best_r']))) { $bowl['best_w'] = $w; $bowl['best_r'] = $rr; }
        if ($w >= 5) $bowl['five']++; elseif ($w >= 3) $bowl['three']++;
    }
    $bowl['econ'] = $bowl['balls'] > 0 ? round($bowl['runs'] * 6 / $bowl['balls'], 2) : null;
    $bowl['avg'] = $bowl['wkts'] > 0 ? round($bowl['runs'] / $bowl['wkts'], 2) : null;
    $catches = (int)val("SELECT COUNT(*) FROM balls b JOIN innings i ON i.id=b.innings_id JOIN matches m ON m.id=i.match_id WHERE b.fielder_id=? AND b.is_wicket=1 AND b.wicket_type IN ('caught','stumped','run out') AND $vs", array_merge([$pid], $vp));
    $pom = (int)val("SELECT COUNT(*) FROM matches m WHERE m.player_of_match_id=? AND $vs", array_merge([$pid], $vp));
    return ['batting' => $bat, 'bowling' => $bowl, 'catches' => $catches, 'pom' => $pom];
}
