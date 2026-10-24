<?php
/* Public cricket lessons from the Academy - /learn (index) and /learn/<lesson-slug> */
require_once __DIR__ . '/inc/seo.php';

/* Field diagram (same layout as the app: right-handed batter at the top, off side on the left) */
const FIELD_POS = [
    'keeper' => [200, 96, 'Wicket-keeper', 0, -15], 'bowler' => [200, 284, 'Bowler', 0, 27],
    'first-slip' => [176, 100, '1st slip', 0, 27], 'second-slip' => [154, 106, '2nd slip', 0, -15], 'third-slip' => [134, 115, '3rd slip', -2, 27],
    'gully' => [116, 126, 'Gully', -14, 5, 'end'], 'fly-slip' => [118, 56, 'Fly slip', 0, -15],
    'leg-slip' => [226, 104, 'Leg slip', 12, -10, 'start'], 'leg-gully' => [252, 124, 'Leg gully', 14, 5, 'start'],
    'short-leg' => [230, 156, 'Short leg', 14, 5, 'start'], 'silly-point' => [170, 158, 'Silly point', -4, 28],
    'silly-mid-off' => [172, 194, 'Silly mid-off', -14, 5, 'end'], 'silly-mid-on' => [228, 194, 'Silly mid-on', 14, 5, 'start'],
    'point' => [88, 160, 'Point', 0, 27], 'backward-point' => [98, 134, 'Backward point', -14, 5, 'end'], 'cover' => [88, 212, 'Cover', 0, 27],
    'extra-cover' => [120, 264, 'Extra cover', 0, 27], 'mid-off' => [164, 304, 'Mid-off', -6, 27], 'mid-on' => [236, 304, 'Mid-on', 6, 27],
    'mid-wicket' => [306, 234, 'Mid-wicket', 0, 27], 'square-leg' => [308, 150, 'Square leg', 0, 27], 'short-fine-leg' => [270, 86, 'Short fine leg', 0, -15],
    'fine-leg' => [290, 32, 'Fine leg', 0, 28], 'third-man' => [112, 32, 'Third man', 0, 28],
    'deep-point' => [12, 154, 'Deep point', 14, -14, 'start'], 'deep-cover' => [28, 264, 'Deep cover', 14, -14, 'start'],
    'long-off' => [160, 388, 'Long-off', -2, -15], 'long-on' => [240, 388, 'Long-on', 2, -15], 'cow-corner' => [320, 352, 'Cow corner', -12, -15, 'end'],
    'deep-mid-wicket' => [376, 268, 'Deep mid-wicket', -14, -14, 'end'], 'deep-square-leg' => [388, 152, 'Deep square leg', -14, -14, 'end'],
    'straight' => [200, 392, 'Straight', 0, -15],
];
function field_svg(?array $fig, string $alt): string {
    if (!$fig || ($fig['type'] ?? '') !== 'field') return '';
    $marks = array_values(array_filter($fig['mark'] ?? [], fn($k) => isset(FIELD_POS[$k])));
    $show = ($fig['labels'] ?? true) !== false;
    $s = '<figure class="field"><svg viewBox="-14 -14 428 446" role="img" aria-label="' . e($alt) . '" xmlns="http://www.w3.org/2000/svg">'
       . '<circle cx="200" cy="200" r="198" fill="#2f8a43" stroke="#fff" stroke-width="3"/>'
       . '<circle cx="200" cy="200" r="124" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2" stroke-dasharray="6 6"/>'
       . '<rect x="191" y="132" width="18" height="138" rx="2" fill="#d8c79a"/>'
       . '<line x1="185" y1="146" x2="215" y2="146" stroke="#fff" stroke-width="1.5"/><line x1="185" y1="256" x2="215" y2="256" stroke="#fff" stroke-width="1.5"/>'
       . '<rect x="196" y="138" width="8" height="4" fill="#7a4a1d"/><rect x="196" y="260" width="8" height="4" fill="#7a4a1d"/>'
       . '<text x="0" y="420" font-size="13" font-weight="900" fill="#126148">◀ OFF SIDE</text><text x="400" y="420" text-anchor="end" font-size="13" font-weight="900" fill="#126148">LEG SIDE ▶</text>'
       . '<text x="200" y="420" text-anchor="middle" font-size="11" fill="#5d6b63">Right-handed batter at top</text>';
    foreach (['keeper', 'bowler'] as $k) if (!in_array($k, $marks, true)) $s .= '<circle cx="' . FIELD_POS[$k][0] . '" cy="' . FIELD_POS[$k][1] . '" r="5" fill="rgba(255,255,255,.6)"/>';
    if (!empty($fig['arrow']) && isset(FIELD_POS[$fig['arrow']])) {
        [$x, $y] = FIELD_POS[$fig['arrow']];
        $ex = 200 + ($x - 200) * 0.92; $ey = 150 + ($y - 150) * 0.92;
        $s .= '<line x1="200" y1="150" x2="' . round($ex) . '" y2="' . round($ey) . '" stroke="#fff" stroke-width="4" stroke-linecap="round"/>'
            . '<circle cx="' . round($ex) . '" cy="' . round($ey) . '" r="7" fill="#d62839" stroke="#fff" stroke-width="2"/>';
    }
    foreach ($marks as $k) { [$x, $y] = FIELD_POS[$k]; $s .= "<circle cx=\"$x\" cy=\"$y\" r=\"10\" fill=\"#ffd23f\" stroke=\"#13241b\" stroke-width=\"2.5\"/>"; }
    foreach ($marks as $k) {
        $p = FIELD_POS[$k]; [$x, $y, $name] = $p; $lx = $p[3] ?? 0; $ly = $p[4] ?? -15; $an = $p[5] ?? 'middle';
        $s .= $show ? '<text x="' . ($x + $lx) . '" y="' . ($y + $ly) . '" text-anchor="' . $an . '" font-size="12.5" font-weight="900" fill="#fff" stroke="#13241b" stroke-width="4" paint-order="stroke">' . e($name) . '</text>'
                    : "<text x=\"$x\" y=\"" . ($y + 5) . '" text-anchor="middle" font-size="14" font-weight="900" fill="#13241b">?</text>';
    }
    return $s . '</svg>' . ($alt ? '<figcaption>' . e($alt) . '</figcaption>' : '') . '</figure>';
}

$all = public_lessons();
$slug = isset($_GET['l']) ? preg_replace('/[^a-z0-9-]/', '', (string)$_GET['l']) : '';

if ($slug === '') {
    /* ===== Index of all lessons ===== */
    $mods = [];
    foreach ($all as $pl) $mods[$pl['module']['id']][] = $pl;
    page_start([
        'title' => 'Learn Cricket for Free - Rules, Field Positions, Batting & Bowling Lessons for Kids | Cric-Scorer',
        'description' => count($all) . ' free cricket lessons for kids and beginners: the Laws of Cricket, LBW, no-balls, field positions, batting shots, bowling, fielding and wicket-keeping - each with a quiz.',
        'path' => 'learn/',
        'jsonld' => [ld_breadcrumbs([['Home', ''], ['Learn cricket', 'learn/']]),
            ['@context' => 'https://schema.org', '@type' => 'Course', 'name' => 'Cricket Academy - learn cricket from the basics', 'description' => 'A free cricket course for kids: rules, field positions, batting, bowling, fielding and wicket-keeping, with quizzes and a final exam.',
             'provider' => ['@type' => 'Organization', 'name' => ORG_NAME, 'sameAs' => 'https://unical.in'], 'isAccessibleForFree' => true, 'inLanguage' => 'en',
             'hasCourseInstance' => ['@type' => 'CourseInstance', 'courseMode' => 'online', 'courseWorkload' => 'PT2H']]],
    ]);
    echo '<p class="crumbs"><a href="' . e(site_url()) . '">Home</a> › Learn cricket</p>';
    echo '<h1>Learn cricket for free</h1><p class="lead">' . count($all) . ' short lessons that take you from your first game to knowing the Laws like an umpire. Read a lesson here, then take its quiz in the free Cric-Scorer app to earn stars, ranks and a certificate.</p>';
    foreach ($mods as $list) {
        $m = $list[0]['module'];
        echo '<h2><span class="mod-e">' . e($m['emoji'] ?? '🏏') . '</span> Module ' . $list[0]['module_n'] . ': ' . e($m['title']) . '</h2>';
        if (!empty($m['desc'])) echo '<p>' . e($m['desc']) . '</p>';
        echo '<div class="grid">';
        foreach ($list as $pl) {
            $l = $pl['lesson'];
            echo '<a class="card" href="' . e(site_url(lesson_url($pl))) . '"><b>' . e($pl['n'] . ' ' . $l['title']) . '</b><span>' . count($l['cards']) . ' cards · ' . count($l['quiz']) . '-question quiz · ' . (int)($l['minutes'] ?? 4) . ' min</span></a>';
        }
        echo '</div>';
    }
    echo '<div class="cta-box"><h2>Earn your Certified Cricket Expert certificate</h2><p>Pass every quiz and the Final Exam in the free app.</p><a class="btn lime" href="' . e(site_url('#/register')) . '">Start learning free</a></div>';
    page_end();
    exit;
}

/* ===== One lesson ===== */
$i = null;
foreach ($all as $k => $pl) if ($pl['slug'] === $slug) { $i = $k; break; }
if ($i === null) {
    http_response_code(404);
    page_start(['title' => 'Lesson not found - Cric-Scorer', 'description' => 'This cricket lesson could not be found.', 'path' => 'learn/', 'noindex' => true]);
    echo '<h1>Lesson not found</h1><p>Sorry, we couldn\'t find that lesson. <a href="' . e(site_url('learn/')) . '">See all cricket lessons</a>.</p>';
    page_end();
    exit;
}
$pl = $all[$i]; $l = $pl['lesson']; $m = $pl['module'];
$first = plain_text($l['cards'][0]['body'][0] ?? $l['title']);
$desc = mb_substr($first, 0, 150) . (mb_strlen($first) > 150 ? '…' : '') . ' Free cricket lesson with quiz.';
$prev = $all[$i - 1] ?? null; $next = $all[$i + 1] ?? null;
page_start([
    'title' => $l['title'] . ' - Cricket Lesson for Kids & Beginners | Cric-Scorer',
    'og_title' => $l['title'] . ' · Learn cricket',
    'description' => $desc,
    'path' => lesson_url($pl),
    'type' => 'article',
    'jsonld' => [
        ld_breadcrumbs([['Home', ''], ['Learn cricket', 'learn/'], [$l['title'], lesson_url($pl)]]),
        ['@context' => 'https://schema.org', '@type' => 'LearningResource', 'name' => $l['title'], 'description' => $desc, 'url' => site_url(lesson_url($pl)),
         'learningResourceType' => 'Lesson', 'educationalLevel' => 'Beginner', 'inLanguage' => 'en', 'isAccessibleForFree' => true,
         'timeRequired' => 'PT' . (int)($l['minutes'] ?? 4) . 'M', 'about' => ['Cricket', $m['title']], 'teaches' => array_map(fn($c) => plain_text($c['title']), $l['cards']),
         'isPartOf' => ['@type' => 'Course', 'name' => 'Cricket Academy', 'url' => site_url('learn/')],
         'provider' => ['@type' => 'Organization', 'name' => ORG_NAME]],
    ],
]);
?>
<p class="crumbs"><a href="<?= e(site_url()) ?>">Home</a> › <a href="<?= e(site_url('learn/')) ?>">Learn cricket</a> › <?= e($m['title']) ?></p>
<h1><?= e(($l['emoji'] ?? '') . ' ' . $l['title']) ?></h1>
<p class="lead">Lesson <?= e($pl['n']) ?> of the free Cricket Academy · Module: <?= e($m['title']) ?> · <?= (int)($l['minutes'] ?? 4) ?> minute read</p>
<?php foreach ($l['cards'] as $c): ?>
<section class="card lesson-card">
  <h2 style="margin-top:0;font-size:24px"><?= rich_text($c['title']) ?></h2>
  <?= field_svg($c['fig'] ?? null, plain_text($c['title']) . ' - cricket field diagram') ?>
  <?php foreach ($c['body'] ?? [] as $b): ?><p><?= rich_text($b) ?></p><?php endforeach; ?>
  <?php if (!empty($c['fact'])): ?><div class="fact">💡 <?= rich_text($c['fact']) ?></div><?php endif; ?>
</section>
<?php endforeach; ?>

<h2>Test yourself</h2>
<p>Two sample questions from this lesson's <?= count($l['quiz']) ?>-question quiz:</p>
<?php foreach (array_slice($l['quiz'], 0, 2) as $q): ?>
<details class="q"><summary><?= rich_text($q['q']) ?></summary>
  <?= field_svg($q['fig'] ?? null, '') ?>
  <ul><?php foreach ($q['options'] as $o): ?><li><?= rich_text($o) ?></li><?php endforeach; ?></ul>
  <div class="ans">✓ <?= rich_text($q['options'][$q['a']]) ?></div><p><?= rich_text($q['ex'] ?? '') ?></p>
</details>
<?php endforeach; ?>

<div class="cta-box"><h2>Take the full quiz free</h2><p>Earn stars, climb from Gully Rookie to Cricket Legend and get your certificate in Cric-Scorer.</p>
  <a class="btn lime" href="<?= e(site_url('#/register')) ?>">Start learning free</a></div>

<div class="row" style="justify-content:space-between">
  <?php if ($prev): ?><a class="btn light" href="<?= e(site_url(lesson_url($prev))) ?>">← <?= e($prev['lesson']['title']) ?></a><?php else: ?><span></span><?php endif; ?>
  <?php if ($next): ?><a class="btn" href="<?= e(site_url(lesson_url($next))) ?>"><?= e($next['lesson']['title']) ?> →</a><?php endif; ?>
</div>
<?php page_end();
