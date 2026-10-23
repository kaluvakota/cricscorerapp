<?php
/* Cric-Scorer — core helpers: database, JSON output, authentication */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/version.php';

if (!function_exists('mb_substr')) { function mb_substr($s, $start, $len = null) { return $len === null ? substr($s, $start) : substr($s, $start, $len); } }

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        $pdo->exec("SET time_zone = '" . date('P') . "'");
    }
    return $pdo;
}
function q(string $sql, array $p = []): PDOStatement { $s = db()->prepare($sql); $s->execute($p); return $s; }
function rows(string $sql, array $p = []): array { return q($sql, $p)->fetchAll(); }
function row(string $sql, array $p = []): ?array { $r = q($sql, $p)->fetch(); return $r ?: null; }
function val(string $sql, array $p = []) { $v = q($sql, $p)->fetchColumn(); return $v === false ? null : $v; }
function lastId(): int { return (int) db()->lastInsertId(); }

class ApiError extends Exception {
    public int $status;
    public function __construct(string $msg, int $status = 400) { parent::__construct($msg); $this->status = $status; }
}
function fail(string $msg, int $status = 400): void { throw new ApiError($msg, $status); }
function out($data): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function str_in(array $in, string $k, int $max = 150): string {
    $v = trim((string)($in[$k] ?? ''));
    return mb_substr($v, 0, $max);
}
function int_in(array $in, string $k, int $def = 0): int { return isset($in[$k]) && $in[$k] !== '' && $in[$k] !== null ? (int)$in[$k] : $def; }
function nint($v): ?int { return ($v === null || $v === '' || (int)$v === 0) ? null : (int)$v; }
function valid_color(string $c, string $def = '#0d4a36'): string { return preg_match('/^#[0-9a-fA-F]{6}$/', $c) ? $c : $def; }

/* ---------- Automatic database upgrades (safe to run on every request) ---------- */
function ensure_schema(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    if (!val("SHOW TABLES LIKE 'academy_progress'")) {
        db()->exec("CREATE TABLE IF NOT EXISTS academy_progress (
            user_id INT NOT NULL, lesson_id VARCHAR(20) NOT NULL, best_correct INT NOT NULL DEFAULT 0, total INT NOT NULL DEFAULT 0,
            stars TINYINT NOT NULL DEFAULT 0, attempts INT NOT NULL DEFAULT 0, xp INT NOT NULL DEFAULT 0,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, lesson_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }
    if (val("SHOW COLUMNS FROM innings LIKE 'max_overs'")) return;   // already on the DLS schema
    db()->exec("ALTER TABLE innings ADD COLUMN max_overs INT NOT NULL DEFAULT 20 AFTER target, ADD COLUMN start_overs INT NOT NULL DEFAULT 20 AFTER max_overs, ADD COLUMN dls TINYINT(1) NOT NULL DEFAULT 0 AFTER start_overs");
    db()->exec("UPDATE innings i JOIN matches m ON m.id=i.match_id SET i.max_overs=m.overs, i.start_overs=m.overs");
    if (!val("SHOW COLUMNS FROM matches LIKE 'dls_g50'"))
        db()->exec("ALTER TABLE matches ADD COLUMN dls_g50 INT NOT NULL DEFAULT 200 AFTER last_man_stands, ADD COLUMN inn2_overs INT NULL AFTER dls_g50, ADD COLUMN result_method VARCHAR(10) NULL AFTER inn2_overs");
    db()->exec("CREATE TABLE IF NOT EXISTS interruptions (
        id INT AUTO_INCREMENT PRIMARY KEY, match_id INT NOT NULL, innings_no TINYINT NOT NULL, legal_balls INT NOT NULL,
        wickets INT NOT NULL, overs_before INT NOT NULL, overs_after INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX (match_id),
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

/* ---------- Sessions & auth ---------- */
function start_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_name('CRICSESS');
        session_set_cookie_params([
            'lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax',
            'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        ]);
        session_start();
    }
}

function public_user(array $u): array {
    return ['id' => (int)$u['id'], 'username' => $u['username'], 'display_name' => $u['display_name'], 'is_admin' => (bool)$u['is_admin']];
}

function current_user(): ?array {
    static $cache = false;
    if ($cache !== false) return $cache;
    start_session();
    $u = null;
    if (!empty($_SESSION['uid'])) {
        $u = row('SELECT * FROM users WHERE id=?', [$_SESSION['uid']]);
    }
    if (!$u && !empty($_COOKIE['cs_rt']) && strpos($_COOKIE['cs_rt'], ':') !== false) {
        [$tid, $tok] = explode(':', $_COOKIE['cs_rt'], 2);
        $t = row('SELECT * FROM user_tokens WHERE id=? AND expires_at > NOW()', [(int)$tid]);
        if ($t && hash_equals($t['token_hash'], hash('sha256', $tok))) {
            $u = row('SELECT * FROM users WHERE id=?', [$t['user_id']]);
            if ($u) { session_regenerate_id(true); $_SESSION['uid'] = (int)$u['id']; }
        }
    }
    $cache = $u;
    return $u;
}

function issue_remember_token(int $uid): void {
    $tok = bin2hex(random_bytes(32));
    q('INSERT INTO user_tokens (user_id, token_hash, expires_at) VALUES (?,?,DATE_ADD(NOW(), INTERVAL 90 DAY))', [$uid, hash('sha256', $tok)]);
    $id = lastId();
    setcookie('cs_rt', $id . ':' . $tok, [
        'expires' => time() + 90 * 86400, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
}

function clear_remember_token(): void {
    if (!empty($_COOKIE['cs_rt']) && strpos($_COOKIE['cs_rt'], ':') !== false) {
        [$tid] = explode(':', $_COOKIE['cs_rt'], 2);
        q('DELETE FROM user_tokens WHERE id=?', [(int)$tid]);
    }
    setcookie('cs_rt', '', ['expires' => time() - 3600, 'path' => '/']);
}

function login_user(array $u, bool $remember = true): void {
    start_session();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    if ($remember) issue_remember_token((int)$u['id']);
}

function require_user(): array {
    $u = current_user();
    if (!$u) fail('Please log in', 401);
    return $u;
}

/* ---------- Permissions ---------- */
function can_edit_team(?array $team, array $u): bool {
    if (!$team) return false;
    if ($u['is_admin']) return true;
    return $team['category'] === 'custom' && (int)$team['owner_id'] === (int)$u['id'];
}
function can_edit_owned(?array $obj, ?array $u): bool {
    if (!$obj || !$u) return false;
    return $u['is_admin'] || (int)$obj['owner_id'] === (int)$u['id'];
}
