<?php
/* Cric-Scorer — return page for "Sign in with Google" in redirect mode (used by iPhone home-screen apps) */
require_once __DIR__ . '/inc/core.php';

$back = './#/';
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new ApiError('Open Cric-Scorer and tap "Sign in with Google" again.');
    // Google's CSRF protection: the same random value arrives as a cookie and in the form
    $cookie = (string)($_COOKIE['g_csrf_token'] ?? '');
    $posted = (string)($_POST['g_csrf_token'] ?? '');
    if ($cookie === '' || !hash_equals($cookie, $posted)) throw new ApiError('Sign-in check failed. Please try again.');
    ensure_schema();
    google_login(['credential' => (string)($_POST['credential'] ?? '')]);
    header('Location: ' . $back, true, 303);
    exit;
} catch (Throwable $e) {
    $msg = $e instanceof ApiError ? $e->getMessage() : 'Something went wrong. Please try again.';
}
?><!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cric-Scorer · Sign in</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d4a36;font-family:system-ui,-apple-system,sans-serif;padding:20px}
.box{background:#fff;border-radius:20px;padding:24px;max-width:380px;text-align:center}
a{display:block;margin-top:16px;background:#0d4a36;color:#fff;text-decoration:none;font-weight:800;padding:13px;border-radius:13px}</style></head>
<body><div class="box"><div style="font-size:40px">🏏</div><h2>Google sign-in didn't work</h2>
<p><?= htmlspecialchars($msg) ?></p><a href="./#/login">Back to Cric-Scorer</a></div></body></html>
