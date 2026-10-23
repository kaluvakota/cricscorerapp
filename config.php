<?php
/**
 * Cric-Scorer by Aaryush — configuration
 * Edit the database settings below to match your web server (cPanel > MySQL Databases).
 */
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'cric_scorer');
define('DB_USER', 'cric_user');
define('DB_PASS', 'change_me');

define('APP_NAME', 'Cric-Scorer');
define('APP_TAGLINE', 'by Aaryush');

// Set to true only while troubleshooting — shows database error details.
define('DEBUG', false);

// Timezone used for match dates
date_default_timezone_set('Asia/Kolkata');
