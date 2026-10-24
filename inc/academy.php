<?php
/* Cric-Scorer Academy - cricket lessons, quizzes, XP, stars, ranks (graded on the server) */

const ACADEMY_RANKS = [
    [0, 'Gully Rookie', '🧢'], [300, 'Club Cricketer', '🏏'], [800, 'District Player', '🎽'], [1400, 'State Player', '🏅'],
    [2100, 'IPL Star', '⭐'], [2800, 'International', '🌍'], [3300, 'Cricket Legend', '🏆'],
];
const ACADEMY_PASS = 0.6;           // 60% to pass a lesson and unlock the next one
const ACADEMY_FINAL_PASS = 0.75;    // 75% to pass the final exam and earn the certificate

function academy_data(): array {
    static $d = null;
    if ($d === null) {
        $d = json_decode((string)@file_get_contents(__DIR__ . '/../assets/academy.json'), true) ?: ['modules' => [], 'final' => null];
    }
    return $d;
}

/** lesson_id => ['quiz' => [...], 'weight' => xp per correct answer] */
function academy_quizzes(): array {
    static $q = null;
    if ($q !== null) return $q;
    $q = [];
    $d = academy_data();
    foreach ($d['modules'] as $m) foreach ($m['lessons'] as $l) $q[$l['id']] = ['quiz' => $l['quiz'], 'weight' => 10, 'module' => $m['id']];
    if (!empty($d['final'])) $q['final'] = ['quiz' => $d['final']['quiz'], 'weight' => 20, 'module' => 'final'];
    return $q;
}

function academy_stars(int $correct, int $total): int {
    if ($total <= 0) return 0;
    $p = $correct / $total;
    return $p >= 0.9 ? 3 : ($p >= 0.75 ? 2 : ($p >= ACADEMY_PASS ? 1 : 0));
}

function academy_rank(int $xp): array {
    $cur = ACADEMY_RANKS[0]; $next = null;
    foreach (ACADEMY_RANKS as $i => $r) {
        if ($xp >= $r[0]) { $cur = $r; $next = ACADEMY_RANKS[$i + 1] ?? null; }
    }
    return ['name' => $cur[1], 'icon' => $cur[2], 'min' => $cur[0], 'next' => $next ? ['name' => $next[1], 'icon' => $next[2], 'xp' => $next[0]] : null];
}

function academy_user_xp(int $uid): int {
    return (int)val('SELECT COALESCE(SUM(xp),0) FROM academy_progress WHERE user_id=?', [$uid]);
}

function academy_progress(array $u): array {
    $prog = [];
    foreach (rows('SELECT lesson_id, best_correct, total, stars, attempts, xp, updated_at FROM academy_progress WHERE user_id=?', [$u['id']]) as $r) {
        $prog[$r['lesson_id']] = ['best' => (int)$r['best_correct'], 'total' => (int)$r['total'], 'stars' => (int)$r['stars'],
                                  'attempts' => (int)$r['attempts'], 'xp' => (int)$r['xp'], 'date' => $r['updated_at']];
    }
    $xp = academy_user_xp((int)$u['id']);
    $board = rows("SELECT u.id, u.display_name name, SUM(a.xp) xp, SUM(a.stars) stars, SUM(a.stars > 0) passed
                   FROM academy_progress a JOIN users u ON u.id=a.user_id WHERE " . people_vis($u)[0] . "
                   GROUP BY u.id, u.display_name HAVING xp > 0 ORDER BY xp DESC LIMIT 20", people_vis($u)[1]);
    foreach ($board as &$b) { $b['xp'] = (int)$b['xp']; $b['stars'] = (int)$b['stars']; $b['passed'] = (int)$b['passed']; $b['rank'] = academy_rank($b['xp']); $b['me'] = (int)$b['id'] === (int)$u['id']; }
    unset($b);
    $maxXp = 0;
    foreach (academy_quizzes() as $q) $maxXp += count($q['quiz']) * $q['weight'] + 3 * $q['weight'];
    return ['progress' => $prog, 'xp' => $xp, 'max_xp' => $maxXp, 'rank' => academy_rank($xp), 'ranks' => array_map(fn($r) => ['xp' => $r[0], 'name' => $r[1], 'icon' => $r[2]], ACADEMY_RANKS),
            'leaderboard' => $board, 'user' => $u['display_name']];
}

function academy_submit(array $u, array $in): array {
    $lid = (string)($in['lesson_id'] ?? '');
    $qs = academy_quizzes();
    if (!isset($qs[$lid])) fail('Unknown lesson');
    $quiz = $qs[$lid]['quiz']; $w = $qs[$lid]['weight'];
    $ans = array_values((array)($in['answers'] ?? []));
    if (count($ans) !== count($quiz)) fail('Please answer every question');
    $correct = 0; $results = [];
    foreach ($quiz as $i => $q) {
        $ok = (int)$ans[$i] === (int)$q['a'];
        if ($ok) $correct++;
        $results[] = ['ok' => $ok, 'a' => (int)$q['a']];
    }
    $total = count($quiz);
    $stars = academy_stars($correct, $total);
    $passMark = $lid === 'final' ? ACADEMY_FINAL_PASS : ACADEMY_PASS;
    $passed = $correct / max(1, $total) >= $passMark;
    if ($lid === 'final' && !$passed) $stars = 0;
    $xpBefore = academy_user_xp((int)$u['id']);
    $old = row('SELECT * FROM academy_progress WHERE user_id=? AND lesson_id=?', [$u['id'], $lid]);
    $bestCorrect = max($correct, $old ? (int)$old['best_correct'] : 0);
    $bestStars = max($stars, $old ? (int)$old['stars'] : 0);
    $xp = $bestCorrect * $w + $bestStars * $w;      // only your best attempt counts - no farming XP
    if ($old) {
        q('UPDATE academy_progress SET best_correct=?, total=?, stars=?, attempts=attempts+1, xp=?, updated_at=NOW() WHERE user_id=? AND lesson_id=?',
          [$bestCorrect, $total, $bestStars, $xp, $u['id'], $lid]);
    } else {
        q('INSERT INTO academy_progress (user_id, lesson_id, best_correct, total, stars, attempts, xp) VALUES (?,?,?,?,?,1,?)',
          [$u['id'], $lid, $bestCorrect, $total, $bestStars, $xp]);
    }
    $xpAfter = academy_user_xp((int)$u['id']);
    return ['lesson_id' => $lid, 'correct' => $correct, 'total' => $total, 'stars' => $stars, 'passed' => $passed, 'pass_mark' => $passMark,
            'best' => $bestCorrect, 'best_stars' => $bestStars, 'xp_gained' => $xpAfter - $xpBefore, 'xp' => $xpAfter,
            'rank_before' => academy_rank($xpBefore), 'rank' => academy_rank($xpAfter), 'results' => $results, 'new_best' => !$old || $correct > (int)$old['best_correct']];
}
