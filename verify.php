<?php
/* Cric-Scorer - the one-tap WhatsApp link: /v/TOKEN verifies the number and signs the player in */
require_once __DIR__ . '/inc/core.php';
$msg = ''; $ok = false;
try {
    ensure_schema();
    $u = otp_consume(preg_replace('/[^a-f0-9]/', '', (string)($_GET['t'] ?? '')) ?: null);
    $ok = true;
    $msg = 'Verified! Welcome, ' . $u['display_name'] . ' 🎉';
} catch (Throwable $e) {
    $msg = $e instanceof ApiError ? $e->getMessage() : 'Something went wrong. Please try again.';
}
header('X-Robots-Tag: noindex');
?><!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Cric-Scorer · <?= $ok ? 'Verified' : 'Link not valid' ?></title>
<?php if ($ok): ?><meta http-equiv="refresh" content="2;url=./#/?verified=1"><?php endif; ?>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d4a36;font-family:system-ui,-apple-system,sans-serif;padding:20px}
.box{background:#fff;border-radius:20px;padding:24px;max-width:380px;text-align:center}
a{display:block;margin-top:16px;background:#0d4a36;color:#fff;text-decoration:none;font-weight:800;padding:13px;border-radius:13px}</style></head>
<body><div class="box"><div style="font-size:44px"><?= $ok ? '✅' : '🏏' ?></div><h2><?= $ok ? 'Mobile verified' : 'Link not valid' ?></h2>
<p><?= htmlspecialchars($msg) ?></p><a href="./#/<?= $ok ? '?verified=1' : 'login' ?>"><?= $ok ? 'Open Cric-Scorer' : 'Back to Cric-Scorer' ?></a></div></body></html>
