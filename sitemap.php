<?php
/* sitemap.xml - served at /sitemap.xml. Lists public pages only (never players' matches or profiles). */
require_once __DIR__ . '/inc/seo.php';
header('Content-Type: application/xml; charset=utf-8');
$day = fn(string $f) => date('Y-m-d', @filemtime(__DIR__ . '/' . $f) ?: time());
$urls = [
    ['', $day('index.php'), 'weekly', '1.0'],
    ['learn/', $day('assets/academy.json'), 'monthly', '0.9'],
];
foreach (public_lessons() as $pl) $urls[] = [lesson_url($pl), $day('assets/academy.json'), 'monthly', '0.8'];
$urls[] = ['privacy', $day('privacy.php'), 'yearly', '0.3'];
$urls[] = ['terms', $day('terms.php'), 'yearly', '0.3'];
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as [$path, $mod, $freq, $prio]) {
    echo '  <url><loc>' . e(site_url($path)) . "</loc><lastmod>$mod</lastmod><changefreq>$freq</changefreq><priority>$prio</priority></url>\n";
}
echo "</urlset>\n";
