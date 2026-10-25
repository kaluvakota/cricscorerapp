<?php
/* Cric-Scorer - Meta WhatsApp webhook. Meta calls this when a player taps the Verify button (or writes to the number).
   Set the same secret word here (WHATSAPP_WEBHOOK_TOKEN in config.local.php) and in Meta → WhatsApp → Configuration → Webhook. */
require_once __DIR__ . '/inc/core.php';
if ($_SERVER['REQUEST_METHOD'] === 'GET') {               // Meta checks the address once when you save it
    if (WHATSAPP_WEBHOOK_TOKEN !== '' && ($_GET['hub_mode'] ?? '') === 'subscribe' && hash_equals(WHATSAPP_WEBHOOK_TOKEN, (string)($_GET['hub_verify_token'] ?? ''))) { echo $_GET['hub_challenge'] ?? ''; exit; }
    http_response_code(403); echo 'Webhook token does not match'; exit;
}
$raw = file_get_contents('php://input') ?: '';
if (WHATSAPP_APP_SECRET !== '') {                          // signature check, when the app secret is configured
    $sig = (string)($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '');
    if (!hash_equals('sha256=' . hash_hmac('sha256', $raw, WHATSAPP_APP_SECRET), $sig)) { http_response_code(403); exit; }
}
http_response_code(200); echo 'OK';                        // answer Meta straight away, then do the work
if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
try { ensure_schema(); wa_handle_webhook(json_decode($raw, true) ?: []); } catch (Throwable $e) { error_log('Cric-Scorer WhatsApp webhook: ' . $e->getMessage()); }
