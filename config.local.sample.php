<?php
/**
 * Cric-Scorer - ALL private server settings in one file.
 *
 * 1. Copy this file to   config.local.php   (same folder as index.php).
 * 2. Fill in the values below.
 * 3. Never commit config.local.php - Git ignores it, and updates never overwrite it.
 *    The web server also refuses to show it to anyone (.htaccess).
 */

/* ===== 1. Database - hPanel → Databases → Management ===== */
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'u123456789_cric_score');   // full name incl. the u…_ prefix
define('DB_USER', 'u123456789_cric_score');   // full user incl. the u…_ prefix
define('DB_PASS', 'your-database-password');

/* ===== 2. Sign in with Google (Gmail) - leave '' to switch off =====
 * Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID
 * → Application type "Web application" → Authorised JavaScript origins:
 *      https://cricscorerapp.com   (and https://cric-score.unical.in if you use it)
 * Copy the Client ID (ends in .apps.googleusercontent.com). No client secret is needed.
 */
define('GOOGLE_CLIENT_ID', '');
define('GOOGLE_ALLOW_SIGNUP', true);           // false = only players who linked Google in My Profile can use it

/* ===== 3. Google reCAPTCHA - leave '' to switch off =====
 * https://www.google.com/recaptcha/admin/create → choose v2 "I'm not a robot" Checkbox (or v3)
 * → Domains: cricscorerapp.com, cric-score.unical.in → copy the Site key and Secret key.
 */
define('RECAPTCHA_VERSION', 'v2');             // 'v2' = tick box, 'v3' = invisible (must match the key type)
define('RECAPTCHA_SITE_KEY', '');
define('RECAPTCHA_SECRET_KEY', '');
define('RECAPTCHA_MIN_SCORE', 0.5);            // v3 only

/* ===== 4. Website & legal details (SEO, share previews, Privacy Policy, Terms) ===== */
define('SITE_URL', 'https://cricscorerapp.com');           // your main web address, no slash at the end
define('CONTACT_EMAIL', 'privacy@cricscorerapp.com');      // shown on the Privacy Policy - create this mailbox in hPanel → Emails
// define('ORG_NAME', 'Unical Systems Private Limited');
// define('ORG_ADDRESS', '206, 3rd Floor, DSL Abacus IT Park, IDA Uppal, Hyderabad, Telangana 500039, India');
// define('GRIEVANCE_OFFICER', 'Shiva Kaluvakota');

/* ===== 5. One-tap updates (Admin portal → Updates) - works as is for the public GitHub repo ===== */
// define('UPDATE_REPO', 'kaluvakota/cricscorerapp');
// define('UPDATE_BRANCH', 'main');
// define('GITHUB_TOKEN', '');                 // only if the repo is made private: a read-only "Contents" token

/* ===== 6. App options ===== */
// define('APP_TIMEZONE', 'Asia/Kolkata');
// define('DEBUG', true);                      // show error details while fixing problems - turn off afterwards
