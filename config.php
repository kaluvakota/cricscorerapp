<?php
/**
 * Cric-Scorer by Aaryush — configuration
 *
 * DO NOT put your real database password in this file — it is in Git.
 * Instead, copy config.local.sample.php to config.local.php on the server
 * and put your real settings there. config.local.php is ignored by Git,
 * so updates (git pull or zip upload) never overwrite it.
 */
if (file_exists(__DIR__ . '/config.local.php')) {
    require __DIR__ . '/config.local.php';
}

// Defaults (used only for anything config.local.php does not define)
defined('DB_HOST')     || define('DB_HOST', 'localhost');
defined('DB_PORT')     || define('DB_PORT', '3306');
defined('DB_NAME')     || define('DB_NAME', 'cric_scorer');
defined('DB_USER')     || define('DB_USER', 'cric_user');
defined('DB_PASS')     || define('DB_PASS', 'change_me');

defined('APP_NAME')    || define('APP_NAME', 'Cric-Scorer');
defined('APP_TAGLINE') || define('APP_TAGLINE', 'by Aaryush');

// Set to true only while troubleshooting — shows database error details.
defined('DEBUG')       || define('DEBUG', false);

// Timezone used for match dates
date_default_timezone_set(defined('APP_TIMEZONE') ? APP_TIMEZONE : 'Asia/Kolkata');
