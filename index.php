<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/inc/version.php';
if (!file_exists(__DIR__ . '/install.lock') && file_exists(__DIR__ . '/install.php')) { header('Location: install.php'); exit; }
$v = APP_VERSION;
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1">
<title><?= htmlspecialchars(APP_NAME) ?> · <?= htmlspecialchars(APP_TAGLINE) ?></title>
<meta name="description" content="Cric-Scorer by Aaryush — live ball-by-ball cricket scoring app">
<meta name="theme-color" content="#0d4a36">
<link rel="manifest" href="manifest.json">
<link rel="icon" type="image/png" sizes="192x192" href="assets/icons/icon-192.png">
<link rel="apple-touch-icon" href="assets/icons/icon-180.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Cric-Scorer">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Nunito:wght@500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/app.css?v=<?= $v ?>">
</head>
<body>
<div id="splash">
  <img class="logo" src="assets/icons/icon-192.png" alt="">
  <h1>Cric-Scorer</h1>
  <p>by Aaryush</p>
</div>
<div id="app"></div>
<nav id="tabbar" class="hidden" aria-label="Main"></nav>
<div id="sheet-root"></div>
<div id="toast" role="status" aria-live="polite"></div>
<div id="ptr" aria-hidden="true"><span></span></div>
<script>window.CS_VERSION = <?= json_encode(APP_VERSION) ?>;</script>
<script src="assets/sound.js?v=<?= $v ?>"></script>
<script src="assets/app.js?v=<?= $v ?>"></script>
</body>
</html>
