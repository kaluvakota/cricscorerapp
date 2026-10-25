<?php
/* Cric-Scorer - Sign in with Google and Google reCAPTCHA (keys live in config.local.php) */

// Safe defaults, in case the server still has an older config.php without these settings
defined('GOOGLE_CLIENT_ID')     || define('GOOGLE_CLIENT_ID', '');
defined('GOOGLE_ALLOW_SIGNUP')  || define('GOOGLE_ALLOW_SIGNUP', true);
defined('RECAPTCHA_SITE_KEY')   || define('RECAPTCHA_SITE_KEY', '');
defined('RECAPTCHA_SECRET_KEY') || define('RECAPTCHA_SECRET_KEY', '');
defined('RECAPTCHA_VERSION')    || define('RECAPTCHA_VERSION', 'v2');
defined('RECAPTCHA_MIN_SCORE')  || define('RECAPTCHA_MIN_SCORE', 0.5);
defined('GOOGLE_TOKENINFO_URL') || define('GOOGLE_TOKENINFO_URL', 'https://oauth2.googleapis.com/tokeninfo');
defined('RECAPTCHA_VERIFY_URL') || define('RECAPTCHA_VERIFY_URL', 'https://www.google.com/recaptcha/api/siteverify');

function google_enabled(): bool { return trim((string)GOOGLE_CLIENT_ID) !== ''; }
function recaptcha_enabled(): bool { return trim((string)RECAPTCHA_SITE_KEY) !== '' && trim((string)RECAPTCHA_SECRET_KEY) !== ''; }
function recaptcha_version(): string { return strtolower((string)RECAPTCHA_VERSION) === 'v3' ? 'v3' : 'v2'; }

/** Settings the phone needs (public values only - never the secret key) */
function auth_public_config(): array {
    return [
        'google_client_id' => google_enabled() ? GOOGLE_CLIENT_ID : null,
        'google_signup' => (bool)GOOGLE_ALLOW_SIGNUP,
        'recaptcha' => recaptcha_enabled() ? ['site_key' => RECAPTCHA_SITE_KEY, 'version' => recaptcha_version()] : null,
        'whatsapp' => function_exists('wa_enabled') && wa_enabled(),
        'whatsapp_kind' => defined('WHATSAPP_TEMPLATE_KIND') ? WHATSAPP_TEMPLATE_KIND : 'button',
    ];
}

/** Small HTTPS helper: curl when available, PHP streams otherwise. Returns decoded JSON or null. */
function http_json(string $url, ?array $post = null): ?array {
    $body = $post !== null ? http_build_query($post) : null;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_CONNECTTIMEOUT => 6,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_HTTPHEADER => ['Accept: application/json']]);
        if ($body !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, $body); }
        $res = curl_exec($ch);
        curl_close($ch);
    } else {
        $opts = ['http' => ['timeout' => 10, 'ignore_errors' => true, 'header' => "Accept: application/json\r\n"]];
        if ($body !== null) { $opts['http']['method'] = 'POST'; $opts['http']['header'] .= "Content-Type: application/x-www-form-urlencoded\r\n"; $opts['http']['content'] = $body; }
        $res = @file_get_contents($url, false, stream_context_create($opts));
    }
    if (!is_string($res) || $res === '') return null;
    $j = json_decode($res, true);
    return is_array($j) ? $j : null;
}

/** Check a Google ID token with Google; returns the verified profile or fails */
function google_verify(string $credential): array {
    if (!google_enabled()) fail('Google sign-in is not set up on this server');
    if ($credential === '' || strlen($credential) > 4096) fail('Google sign-in failed - please try again');
    $t = http_json(GOOGLE_TOKENINFO_URL . '?id_token=' . rawurlencode($credential));
    if (!$t) fail('Could not reach Google to check your sign-in. Please try again.');
    if (!empty($t['error']) || !empty($t['error_description'])) fail('Google sign-in expired - please try again');
    if (($t['aud'] ?? '') !== GOOGLE_CLIENT_ID) fail('This Google sign-in was not made for Cric-Scorer');
    if (!in_array($t['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)) fail('Google sign-in could not be verified');
    if ((int)($t['exp'] ?? 0) < time()) fail('Google sign-in expired - please try again');
    $verified = $t['email_verified'] ?? false;
    if (!($verified === true || $verified === 'true')) fail('Your Google email address is not verified');
    if (empty($t['sub']) || empty($t['email'])) fail('Google did not share your account details');
    return ['sub' => (string)$t['sub'], 'email' => strtolower((string)$t['email']),
            'name' => trim((string)($t['name'] ?? $t['given_name'] ?? '')), 'picture' => (string)($t['picture'] ?? '')];
}

/** Require a passed reCAPTCHA when it is switched on */
function recaptcha_check(array $in, string $action): void {
    if (!recaptcha_enabled()) return;
    $token = (string)($in['captcha'] ?? '');
    if ($token === '') fail(recaptcha_version() === 'v2' ? 'Please tick "I\'m not a robot"' : 'Security check did not load - please refresh and try again');
    $r = http_json(RECAPTCHA_VERIFY_URL, ['secret' => RECAPTCHA_SECRET_KEY, 'response' => $token, 'remoteip' => $_SERVER['REMOTE_ADDR'] ?? '']);
    if (!$r) fail('Could not reach Google to check the security test. Please try again.');
    if (empty($r['success'])) fail('Security check failed - please try the "I\'m not a robot" box again');
    if (recaptcha_version() === 'v3') {
        if (isset($r['action']) && $r['action'] !== $action) fail('Security check failed - please refresh and try again');
        if ((float)($r['score'] ?? 0) < (float)RECAPTCHA_MIN_SCORE) fail('Security check failed - please try again in a moment');
    }
}

/** Make a unique username from a Google email, e.g. aarush.k@gmail.com → aarush.k, aarush.k2 … */
function username_from_email(string $email): string {
    $base = strtolower(preg_replace('/[^a-z0-9_.]/i', '', explode('@', $email)[0]));
    $base = trim($base, '.');
    if (strlen($base) < 3) $base = 'player' . $base;
    $base = substr($base, 0, 26);
    $name = $base; $n = 1;
    while (val('SELECT 1 FROM users WHERE username=?', [$name])) $name = $base . (++$n);
    return $name;
}

/** Sign in (or sign up) with a verified Google account */
function google_login(array $in): array {
    start_session();
    if (!empty($in['pending'])) {
        // Second step for a brand-new player: the Google account we checked a moment ago, now with consent
        $p = $_SESSION['g_pending'] ?? null;
        if (!$p || time() - (int)$p['t'] > 900) { unset($_SESSION['g_pending']); fail('That took too long - tap "Sign in with Google" again'); }
        $g = $p['g'];
    } else {
        $g = google_verify((string)($in['credential'] ?? ''));
    }
    $u = row('SELECT * FROM users WHERE google_sub=?', [$g['sub']]);
    if (!$u) {
        // A player who linked this Gmail address earlier, before Google IDs were stored
        $u = row('SELECT * FROM users WHERE email=? AND google_sub IS NULL', [$g['email']]);
        if ($u) q('UPDATE users SET google_sub=? WHERE id=?', [$g['sub'], $u['id']]);
    }
    if (!$u) {
        if (!GOOGLE_ALLOW_SIGNUP) fail('No Cric-Scorer account is linked to ' . $g['email'] . '. Log in with your username first, then link Google in My Profile.');
        if (empty($in['consent'])) {
            // Don't create anything until the player (or their parent) agrees to the Terms and Privacy Policy
            $_SESSION['g_pending'] = ['g' => $g, 't' => time()];
            return ['needs_consent' => true, 'email' => $g['email'], 'name' => $g['name']];
        }
        unset($_SESSION['g_pending']);
        $first = !val('SELECT 1 FROM users LIMIT 1');
        q('INSERT INTO users (username, password_hash, display_name, is_admin, email, google_sub, avatar_url, terms_accepted_at) VALUES (?,?,?,?,?,?,?,NOW())',
          [username_from_email($g['email']), '', mb_substr($g['name'] ?: explode('@', $g['email'])[0], 0, 100), $first ? 1 : 0, $g['email'], $g['sub'], mb_substr($g['picture'], 0, 255) ?: null]);
        $u = row('SELECT * FROM users WHERE id=?', [lastId()]);
        $created = true;
    } else {
        q('UPDATE users SET email=? WHERE id=?', [$g['email'], $u['id']]);
        if (!avatar_is_upload($u['avatar_url'] ?? null)) q('UPDATE users SET avatar_url=? WHERE id=?', [mb_substr($g['picture'], 0, 255) ?: null, $u['id']]);
        $u = row('SELECT * FROM users WHERE id=?', [$u['id']]);
    }
    login_user($u, true);
    return ['user' => public_user($u), 'created' => !empty($created)];
}

/** Link the signed-in player's account to a Google account */
function google_link(array $u, array $in): array {
    $g = google_verify((string)($in['credential'] ?? ''));
    $other = row('SELECT id, username FROM users WHERE google_sub=? AND id<>?', [$g['sub'], $u['id']]);
    if ($other) fail('That Google account is already linked to the player "' . $other['username'] . '"');
    q('UPDATE users SET google_sub=?, email=? WHERE id=?', [$g['sub'], $g['email'], $u['id']]);
    if (!avatar_is_upload($u['avatar_url'] ?? null) && $g['picture'] !== '') q('UPDATE users SET avatar_url=? WHERE id=?', [mb_substr($g['picture'], 0, 255), $u['id']]);
    return ['user' => public_user(row('SELECT * FROM users WHERE id=?', [$u['id']]))];
}

function google_unlink(array $u): array {
    if ((string)$u['password_hash'] === '') fail('Set a password first, so you can still log in without Google');
    q('UPDATE users SET google_sub=NULL WHERE id=?', [$u['id']]);
    return ['user' => public_user(row('SELECT * FROM users WHERE id=?', [$u['id']]))];
}
