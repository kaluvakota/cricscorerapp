<?php
/* Cric-Scorer - mobile numbers and WhatsApp verification through the Meta Cloud API.
   We send a WhatsApp template message with a 6-digit code and a one-tap link (https://your-site/v/TOKEN).
   Tapping the link verifies the number and signs the player in - no code to type. The code is a fallback.
   Verification is optional: players can use the app without it. Keys live in config.local.php. */

defined('WHATSAPP_TOKEN')         || define('WHATSAPP_TOKEN', '');             // Meta "permanent" system-user access token
defined('WHATSAPP_PHONE_ID')      || define('WHATSAPP_PHONE_ID', '');          // the Phone number ID from WhatsApp → API Setup
defined('WHATSAPP_TEMPLATE')      || define('WHATSAPP_TEMPLATE', 'cricscorer_verify');
defined('WHATSAPP_TEMPLATE_LANG') || define('WHATSAPP_TEMPLATE_LANG', 'en');
defined('WHATSAPP_API_URL')       || define('WHATSAPP_API_URL', 'https://graph.facebook.com/v21.0/');
defined('DEFAULT_COUNTRY_CODE')   || define('DEFAULT_COUNTRY_CODE', '91');     // numbers typed without a country code are Indian
defined('OTP_MINUTES')            || define('OTP_MINUTES', 15);

function wa_enabled(): bool { return trim((string)WHATSAPP_TOKEN) !== '' && trim((string)WHATSAPP_PHONE_ID) !== ''; }

/** "98765 43210", "+91 98765-43210", "09876543210" → "919876543210" (digits only, with country code). Null if it doesn't look like a phone number. */
function normalize_mobile(?string $raw): ?string {
    $d = preg_replace('/\D/', '', (string)$raw);
    if ($d === '') return null;
    if (strlen($d) === 10 && !in_array(DEFAULT_COUNTRY_CODE, ['1'], true)) $d = DEFAULT_COUNTRY_CODE . $d;
    elseif (strlen($d) === 11 && $d[0] === '0') $d = DEFAULT_COUNTRY_CODE . substr($d, 1);
    if (strlen($d) < 10 || strlen($d) > 15) return null;
    return $d;
}
function pretty_mobile(?string $m): string {
    if (!$m) return '';
    if (strpos($m, DEFAULT_COUNTRY_CODE) === 0 && strlen($m) === strlen(DEFAULT_COUNTRY_CODE) + 10) { $n = substr($m, strlen(DEFAULT_COUNTRY_CODE)); return '+' . DEFAULT_COUNTRY_CODE . ' ' . substr($n, 0, 5) . ' ' . substr($n, 5); }
    return '+' . $m;
}
function mask_mobile(?string $m): string { return $m ? '+' . substr($m, 0, 2) . ' ••••• ' . substr($m, -3) : ''; }

/** Send the template. Returns ['ok'=>bool, 'error'=>string] */
function wa_send_verify(string $mobile, string $code, string $link): array {
    if (!wa_enabled()) return ['ok' => false, 'error' => 'WhatsApp is not set up on this website yet'];
    $tokenPart = basename($link);
    $payload = ['messaging_product' => 'whatsapp', 'to' => $mobile, 'type' => 'template', 'template' => [
        'name' => WHATSAPP_TEMPLATE, 'language' => ['code' => WHATSAPP_TEMPLATE_LANG],
        'components' => [
            ['type' => 'body', 'parameters' => [['type' => 'text', 'text' => $code]]],
            ['type' => 'button', 'sub_type' => 'url', 'index' => '0', 'parameters' => [['type' => 'text', 'text' => $tokenPart]]],
        ]]];
    $url = rtrim(WHATSAPP_API_URL, '/') . '/' . WHATSAPP_PHONE_ID . '/messages';
    $body = json_encode($payload);
    $headers = ['Content-Type: application/json', 'Authorization: Bearer ' . WHATSAPP_TOKEN];
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers, CURLOPT_SSL_VERIFYPEER => true]);
        $res = curl_exec($ch); $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    } else {
        $res = @file_get_contents($url, false, stream_context_create(['http' => ['method' => 'POST', 'header' => implode("\r\n", $headers) . "\r\n", 'content' => $body, 'timeout' => 15, 'ignore_errors' => true]]));
        $http = 0; foreach ($http_response_header ?? [] as $h) if (preg_match('#^HTTP/\S+ (\d+)#', $h, $m)) $http = (int)$m[1];
        $err = '';
    }
    $j = $res ? json_decode($res, true) : null;
    if ($http >= 200 && $http < 300 && !empty($j['messages'])) return ['ok' => true];
    $msg = $j['error']['message'] ?? ($err ?: "HTTP $http");
    error_log("Cric-Scorer WhatsApp send failed for " . mask_mobile($mobile) . ": $msg");
    return ['ok' => false, 'error' => 'WhatsApp message could not be sent (' . $msg . ')'];
}

/** Create a code + link for a mobile number. purpose: 'link' (attach to the signed-in account), 'login', 'signup' */
function otp_request(string $mobileRaw, string $purpose, ?array $u, array $extra = []): array {
    $mobile = normalize_mobile($mobileRaw);
    if (!$mobile) fail('Enter a valid mobile number, e.g. 98765 43210');
    $owner = row('SELECT id, username, display_name FROM users WHERE mobile=?', [$mobile]);
    if ($purpose === 'link') {
        if (!$u) fail('Please log in', 401);
        if ($owner && (int)$owner['id'] !== (int)$u['id']) fail('That number is already used by another player');
    } elseif ($purpose === 'login') {
        if (!$owner) return ['ok' => true, 'new' => true, 'mobile' => mask_mobile($mobile)];   // no account yet: the app offers sign-up
    } elseif ($purpose === 'signup') {
        if ($owner) return ['ok' => true, 'exists' => true, 'mobile' => mask_mobile($mobile)];  // already a player: just log in
        if (empty($extra['consent'])) fail('Please tick the box to agree to the Terms of Use and Privacy Policy');
        if (trim((string)($extra['display_name'] ?? '')) === '') fail('Enter your name');
    }
    // no more than 3 messages to a number in 10 minutes
    if ((int)val('SELECT COUNT(*) FROM otp_tokens WHERE mobile=? AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)', [$mobile]) >= 3) fail('Too many messages to that number. Please wait a few minutes and try again.');
    $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $token = bin2hex(random_bytes(16));
    $data = $purpose === 'signup' ? ['display_name' => mb_substr(trim((string)$extra['display_name']), 0, 100)] : [];
    q('INSERT INTO otp_tokens (token_hash, code_hash, mobile, purpose, user_id, data, expires_at) VALUES (?,?,?,?,?,?,DATE_ADD(NOW(), INTERVAL ? MINUTE))',
      [hash('sha256', $token), password_hash($code, PASSWORD_DEFAULT), $mobile, $purpose, $purpose === 'link' ? $u['id'] : ($owner['id'] ?? null), json_encode($data), (int)OTP_MINUTES]);
    $id = lastId();
    $link = rtrim(SITE_URL, '/') . '/v/' . $token;
    $sent = wa_send_verify($mobile, $code, $link);
    $out = ['ok' => true, 'id' => $id, 'mobile' => mask_mobile($mobile), 'sent' => $sent['ok'], 'minutes' => (int)OTP_MINUTES];
    if (!$sent['ok']) {
        $out['error_hint'] = $sent['error'];
        // While WhatsApp is not set up, the admin (or DEBUG) can see the link to test with
        if ((defined('DEBUG') && DEBUG) || ($u && !empty($u['is_admin']))) { $out['dev_link'] = $link; $out['dev_code'] = $code; }
        else fail($sent['error']);
    }
    return $out;
}

/** The player tapped the link (or typed the code). Returns the user now verified / logged in. */
function otp_consume(?string $token, ?int $id = null, ?string $code = null): array {
    $t = $token ? row('SELECT * FROM otp_tokens WHERE token_hash=? AND used_at IS NULL', [hash('sha256', $token)])
                : ($id ? row('SELECT * FROM otp_tokens WHERE id=? AND used_at IS NULL', [$id]) : null);
    if (!$t) fail('This link has already been used or is not valid. Ask for a new one.');
    if (strtotime($t['expires_at']) < time()) fail('This link has expired. Ask for a new one.');
    if (!$token) {
        if ((int)$t['tries'] >= 5) fail('Too many wrong codes. Ask for a new one.');
        if (!password_verify((string)$code, $t['code_hash'])) { q('UPDATE otp_tokens SET tries=tries+1 WHERE id=?', [$t['id']]); fail('That code is not right'); }
    }
    q('UPDATE otp_tokens SET used_at=NOW() WHERE id=?', [$t['id']]);
    $mobile = $t['mobile'];
    if ($t['purpose'] === 'link') {
        $u = row('SELECT * FROM users WHERE id=?', [$t['user_id']]);
        if (!$u) fail('Account not found');
        if (val('SELECT 1 FROM users WHERE mobile=? AND id<>?', [$mobile, $u['id']])) fail('That number is now used by another player');
        q('UPDATE users SET mobile=?, mobile_verified_at=NOW() WHERE id=?', [$mobile, $u['id']]);
    } elseif ($t['purpose'] === 'login') {
        $u = row('SELECT * FROM users WHERE mobile=?', [$mobile]);
        if (!$u) fail('No account uses that number any more');
        if (!$u['mobile_verified_at']) q('UPDATE users SET mobile_verified_at=NOW() WHERE id=?', [$u['id']]);
    } else {   // signup
        $u = row('SELECT * FROM users WHERE mobile=?', [$mobile]);
        if (!$u) {
            $data = json_decode((string)$t['data'], true) ?: [];
            $name = $data['display_name'] ?? ('Player ' . substr($mobile, -4));
            $base = preg_replace('/[^a-z0-9]/', '', strtolower(explode(' ', trim($name))[0])) ?: 'player';
            $un = $base . substr($mobile, -4); $n = 0;
            while (val('SELECT 1 FROM users WHERE username=?', [$un])) $un = $base . substr($mobile, -4) . (++$n);
            $first = !val('SELECT 1 FROM users LIMIT 1');
            q('INSERT INTO users (username, password_hash, display_name, is_admin, mobile, mobile_verified_at, terms_accepted_at) VALUES (?,?,?,?,?,NOW(),NOW())', [$un, '', $name, $first ? 1 : 0, $mobile]);
            $u = row('SELECT * FROM users WHERE id=?', [lastId()]);
        }
    }
    $u = row('SELECT * FROM users WHERE id=?', [$u['id']]);
    login_user($u, true);
    return $u;
}
function otp_cleanup(): void { try { q('DELETE FROM otp_tokens WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)'); } catch (Throwable $e) { /* fine */ } }
