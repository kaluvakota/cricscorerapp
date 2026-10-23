<?php
/**
 * Cric-Scorer — private server settings.
 *
 * 1. Copy this file to   config.local.php   (same folder).
 * 2. Fill in your real database details from hPanel → Databases → Management.
 * 3. Never commit config.local.php — Git ignores it automatically.
 */
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'u123456789_cric_score');   // full name incl. the u…_ prefix
define('DB_USER', 'u123456789_cric_score');   // full user incl. the u…_ prefix
define('DB_PASS', 'your-database-password');

// Optional:
// define('DEBUG', true);                      // show DB errors while fixing problems
// define('APP_TIMEZONE', 'Asia/Kolkata');
