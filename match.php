<?php
/* Shareable match page - /m/<id>. Gives WhatsApp, Facebook etc. a real score preview.
   Public matches only, and always "noindex" so children's names never appear in Google. */
require_once __DIR__ . '/inc/core.php';
require_once __DIR__ . '/inc/engine.php';
require_once __DIR__ . '/inc/seo.php';

$id = (int)($_GET['id'] ?? 0);
$st = null;
try { ensure_schema(); $st = $id ? match_state($id, null) : null; } catch (Throwable $e) { $st = null; }
header('X-Robots-Tag: noindex, nofollow');

if (!$st) {
    http_response_code(404);
    page_start(['title' => 'Match not available - Cric-Scorer', 'description' => 'This match is private or no longer exists.', 'path' => "m/$id", 'noindex' => true]);
    echo '<h1>🔒 Match not available</h1><p class="lead">This match is private, or it has been deleted.</p>'
       . '<div class="cta-box"><h2>Score your own matches</h2><p>Cric-Scorer is a free cricket scoring app for kids, families and clubs.</p><a class="btn lime" href="' . e(site_url('#/register')) . '">Start free</a></div>';
    page_end();
    exit;
}

$m = $st['match']; $t1 = $st['team1']; $t2 = $st['team2'];
$team = fn($id) => (int)$t1['id'] === (int)$id ? $t1 : $t2;
$inns = $st['innings'];
$scoreOf = function ($t) use ($inns) { foreach ($inns as $i) if ((int)$i['batting_team_id'] === (int)$t['id']) return $i['runs'] . '/' . $i['wickets'] . ' (' . $i['overs'] . ')'; return null; };
$s1 = $scoreOf($t1); $s2 = $scoreOf($t2);
$live = $m['status'] === 'live';
if ($m['result_text']) $status = $m['result_text'];
elseif ($live && $inns) {
    $c = end($inns); $bt = $team($c['batting_team_id']);
    $status = $c['target'] ? "{$bt['short_name']} need {$c['need']} runs from {$c['balls_left']} balls" : "{$bt['short_name']} batting · run rate " . number_format((float)$c['crr'], 2);
} elseif ($m['status'] === 'scheduled') $status = 'Starts ' . date('j M Y, g:i a', strtotime((string)$m['match_date']));
else $status = 'Match';
$title = "{$t1['short_name']} " . ($s1 ?: '') . " vs {$t2['short_name']} " . ($s2 ?: '');
$title = trim(preg_replace('/\s+/', ' ', $title)) . ($live ? ' · LIVE' : '');
$desc = $status . ($m['title'] ? ' · ' . $m['title'] : '') . ($m['tournament']['name'] ?? '' ? ' · ' . $m['tournament']['name'] : '') . ' - scored live on Cric-Scorer.';

page_start(['title' => "$title - Cric-Scorer", 'og_title' => ($live ? '🔴 ' : '🏏 ') . $title, 'description' => $desc, 'path' => "m/$id", 'noindex' => true]);
?>
<p class="crumbs"><?= e($m['tournament']['name'] ?? 'Friendly match') ?><?= $m['title'] ? ' · ' . e($m['title']) : '' ?><?= $live ? ' · <b style="color:#d62839">● LIVE</b>' : '' ?></p>
<div class="card">
  <?php foreach ([[$t1, $s1], [$t2, $s2]] as [$t, $s]): ?>
    <div class="row" style="justify-content:space-between;padding:6px 0">
      <b style="font-size:20px"><span style="display:inline-block;min-width:44px;text-align:center;border-radius:9px;padding:2px 6px;margin-right:8px;background:<?= e($t['color']) ?>;color:#fff;font-size:13px"><?= e($t['short_name']) ?></span><?= e($t['name']) ?></b>
      <span class="score"><?= e($s ?: '–') ?></span>
    </div>
  <?php endforeach; ?>
  <p style="margin:10px 0 0;font-weight:800;color:#126148"><?= e($status) ?></p>
  <?php if (!empty($m['player_of_match'])): ?><p style="margin:6px 0 0">⭐ Player of the Match: <b><?= e($m['player_of_match']['name']) ?></b></p><?php endif; ?>
  <p class="updated" style="margin:8px 0 0"><?= (int)$m['overs'] ?> overs a side<?= $m['venue'] ? ' · ' . e($m['venue']) : '' ?><?= $m['match_date'] ? ' · ' . e(date('j M Y', strtotime((string)$m['match_date']))) : '' ?></p>
</div>
<?php foreach ($inns as $i):
    $bt = $team($i['batting_team_id']);
    $bats = $i['batting']; usort($bats, fn($a, $b) => $b['r'] <=> $a['r']);
    $bowls = $i['bowling']; usort($bowls, fn($a, $b) => [$b['w'], $a['r']] <=> [$a['w'], $b['r']]); ?>
<div class="card">
  <h3 style="margin-top:0"><?= e($bt['name']) ?> - <?= e($i['runs'] . '/' . $i['wickets']) ?> (<?= e($i['overs']) ?> ov)</h3>
  <table class="data"><tr><th>Top batters</th><th>R</th><th>B</th></tr>
    <?php foreach (array_slice($bats, 0, 3) as $b): ?><tr><td><?= e($b['name']) ?></td><td><b><?= (int)$b['r'] ?></b></td><td><?= (int)$b['b'] ?></td></tr><?php endforeach; ?></table>
  <table class="data"><tr><th>Top bowlers</th><th>O</th><th>W-R</th></tr>
    <?php foreach (array_slice($bowls, 0, 3) as $b): ?><tr><td><?= e($b['name']) ?></td><td><?= e($b['o']) ?></td><td><b><?= (int)$b['w'] ?>-<?= (int)$b['r'] ?></b></td></tr><?php endforeach; ?></table>
</div>
<?php endforeach; ?>
<div class="row"><a class="btn lime" href="<?= e(site_url('#/match/' . $id)) ?>"><?= $live ? '📡 Watch live - ball by ball' : '📋 Full scorecard' ?></a></div>
<div class="cta-box"><h2>Score your own matches free</h2><p>Live scores, commentary, tournaments and cricket lessons for kids.</p><a class="btn lime" href="<?= e(site_url('#/register')) ?>">Start free</a></div>
<?php page_end();
