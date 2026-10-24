<?php
/* Local testing only: php -S 127.0.0.1:8081 tools/dev-router.php  (mimics the .htaccess friendly URLs) */
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$root = dirname(__DIR__);
$map = ['#^/privacy/?$#' => 'privacy.php', '#^/terms/?$#' => 'terms.php', '#^/learn/?$#' => 'learn.php', '#^/sitemap\.xml$#' => 'sitemap.php', '#^/robots\.txt$#' => 'robots.php'];
foreach ($map as $re => $file) if (preg_match($re, $path)) { chdir($root); require "$root/$file"; return true; }
if (preg_match('#^/learn/([a-z0-9-]+)/?$#', $path, $m)) { $_GET['l'] = $m[1]; chdir($root); require "$root/learn.php"; return true; }
if (preg_match('#^/m/([0-9]+)/?$#', $path, $m)) { $_GET['id'] = $m[1]; chdir($root); require "$root/match.php"; return true; }
if ($path === '/' ) { chdir($root); require "$root/index.php"; return true; }
return false;
