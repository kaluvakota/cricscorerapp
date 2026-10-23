<?php
/* Cric-Scorer by Aaryush — one-time installer. Delete this file after installation. */
require_once __DIR__ . '/config.php';
$lock = __DIR__ . '/install.lock';
$msg = ''; $err = ''; $done = false; $pdo = null; $hasData = false;

function page($title, $body) {
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install Cric-Scorer</title>
    <style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0d4a36;color:#13241b;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .box{background:#fff;border-radius:22px;max-width:440px;width:100%;padding:26px 22px;box-shadow:0 20px 50px rgba(0,0,0,.3)}
    h1{margin:0;font-size:28px}.tag{color:#15803d;font-weight:800;letter-spacing:2px;text-transform:uppercase;font-size:11px;margin-bottom:18px}
    label{display:block;font-size:12px;font-weight:800;color:#66756d;text-transform:uppercase;letter-spacing:.5px;margin:12px 0 5px}
    input{width:100%;box-sizing:border-box;padding:12px;border-radius:12px;border:1.5px solid #e2ddd0;font-size:16px}
    button,.btn{display:block;width:100%;margin-top:18px;padding:14px;border:0;border-radius:13px;background:#0d4a36;color:#fff;font-weight:800;font-size:16px;cursor:pointer;text-align:center;text-decoration:none;box-sizing:border-box}
    .err{background:#fde7e9;color:#a1121f;padding:12px;border-radius:12px;font-size:14px;margin:10px 0}.ok{background:#e6f4ea;color:#15803d;padding:12px;border-radius:12px;font-size:14px;margin:10px 0}
    code{background:#f2efe6;padding:2px 6px;border-radius:6px}li{margin:4px 0}</style></head><body><div class="box">
    <img src="assets/icons/icon-192.png" width="64" height="64" alt=""><h1>' . $title . '</h1><div class="tag">Cric-Scorer · by Aaryush</div>' . $body . '</div></body></html>';
    exit;
}

if (file_exists($lock)) {
    page('Already installed', '<p>Cric-Scorer is installed. For safety, please <b>delete <code>install.php</code></b> from your server.</p><a class="btn" href="index.php">Open the app →</a>');
}
if (version_compare(PHP_VERSION, '7.4.0', '<')) page('PHP too old', '<div class="err">PHP 7.4 or newer is required. Your server has PHP ' . PHP_VERSION . '.</div>');
if (!extension_loaded('pdo_mysql')) page('Missing extension', '<div class="err">The PHP extension <b>pdo_mysql</b> is not enabled. Enable it in cPanel → Select PHP Version → Extensions.</div>');

try {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Throwable $e) {
    page('Database connection failed', '<div class="err">' . htmlspecialchars($e->getMessage()) . '</div>
      <p>Open <code>config.php</code> and set the correct values:</p><ul><li><code>DB_HOST</code> (usually <code>localhost</code>)</li><li><code>DB_NAME</code> — the database you created</li><li><code>DB_USER</code> / <code>DB_PASS</code> — a MySQL user with full access to that database</li></ul><a class="btn" href="install.php">Try again</a>');
}
try { $hasData = (bool)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn(); } catch (Throwable $e) { $hasData = false; }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (($_POST['mode'] ?? '') === 'keep' && $hasData) {
        file_put_contents($lock, date('c'));
        page('All set!', '<div class="ok">Existing data kept. Installation finished.</div><p>Please <b>delete <code>install.php</code></b> from your server now.</p><a class="btn" href="index.php">Open Cric-Scorer →</a>');
    }
    $un = strtolower(trim($_POST['username'] ?? ''));
    $pw = (string)($_POST['password'] ?? '');
    $dn = trim($_POST['display_name'] ?? '') ?: $un;
    if (!preg_match('/^[a-z0-9_.]{3,30}$/', $un)) $err = 'Username: 3–30 letters, numbers, dot or underscore.';
    elseif (strlen($pw) < 6) $err = 'Password must be at least 6 characters.';
    else {
        try {
            @set_time_limit(120);
            $sql = file_get_contents(__DIR__ . '/sql/cric_scorer.sql');
            foreach (preg_split('/;\s*\n/', $sql) as $stmt) {
                $lines = array_filter(explode("\n", $stmt), fn($l) => trim($l) !== '' && strpos(ltrim($l), '--') !== 0);
                $clean = trim(implode("\n", $lines));
                if ($clean !== '') $pdo->exec($clean);
            }
            $st = $pdo->prepare('INSERT INTO users (username, password_hash, display_name, is_admin) VALUES (?,?,?,1)');
            $st->execute([$un, password_hash($pw, PASSWORD_DEFAULT), $dn]);
            file_put_contents($lock, date('c'));
            $teams = $pdo->query('SELECT COUNT(*) FROM teams')->fetchColumn();
            $players = $pdo->query('SELECT COUNT(*) FROM players')->fetchColumn();
            page('Installed! 🎉', "<div class=\"ok\">Database created with <b>$teams teams</b> and <b>$players players</b> (IPL + international). Admin account <b>" . htmlspecialchars($un) . "</b> is ready.</div>
              <p>Important: please <b>delete <code>install.php</code></b> from your server now.</p><a class=\"btn\" href=\"index.php\">Open Cric-Scorer →</a>");
        } catch (Throwable $e) {
            $err = 'Install failed: ' . $e->getMessage();
        }
    }
}

$warn = $hasData ? '<div class="err">This database already has Cric-Scorer data. Installing again will <b>erase everything</b> (matches, teams, users).</div>
  <form method="post"><input type="hidden" name="mode" value="keep"><button style="background:#15803d">Keep my data & finish setup</button></form><p style="text-align:center;color:#66756d;margin:14px 0 0">— or start fresh —</p>' : '';
page('Install', ($err ? '<div class="err">' . htmlspecialchars($err) . '</div>' : '') . '<div class="ok">✓ Connected to database <b>' . htmlspecialchars(DB_NAME) . '</b></div>' . $warn . '
  <p>Create the main (admin) account. Admin can edit IPL & international squads.</p>
  <form method="post"><input type="hidden" name="mode" value="fresh">
  <label>Your name</label><input name="display_name" placeholder="e.g. Dad" required>
  <label>Username</label><input name="username" autocapitalize="none" required>
  <label>Password</label><input name="password" type="password" minlength="6" required>
  <button>Install Cric-Scorer</button></form>');
