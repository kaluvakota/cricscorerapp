# Cric-Scorer — by Aaryush 🏏

A mobile cricket scoring app (installable web app / PWA) built with PHP + MySQL.
Made for Aarush & Aayush.

## What's inside
- **Login & registration** (username + password, stays logged in for 90 days)
- **Teams** — 10 IPL franchises and 12 international teams pre-loaded with full squads (504 players),
  plus your own custom teams. "Pick from teams" copies stars like Kohli or Bumrah into your own team.
- **Match types** — T20, ODI, T10, Box Cricket, Gully Cricket, Backyard (Kids), Custom — or create your own
  (overs, balls per over, players per side, bowler overs limit, last-man-stands).
- **Live ball-by-ball scoring** — runs, 4s/6s, wides, no-balls, byes, leg-byes, all dismissal types,
  retired hurt, strike rotation, over changes, bowler limits, unlimited undo.
- **Scorecards** — batting/bowling cards, extras, fall of wickets, runs-per-over chart, ball-by-ball commentary,
  automatic result and Player of the Match.
- **Tournaments** — league, knockout, league + final; auto fixtures, points table with NRR, top scorers.
- **Leaderboards & player stats** — runs, average, strike rate, wickets, economy, best figures.
- **Rain rules (DLS)** — Duckworth-Lewis-Stern, ICC Standard Edition: reduce overs before or during either innings,
  revised targets, live par score and par-by-over table, "rain stopped play" results, G50 = 200 (junior/club) or 245
  (international). Scorer menu → *Rain / DLS*. The resource table is in `inc/dls.php`.
- **Cricket Academy** (Learn tab) — a full syllabus for kids: 6 modules, 29 lessons, 179 teaching cards with field
  diagrams, 232 quiz questions and a 25-question Final Exam. Lessons first, then a quiz (marked on the server);
  60% unlocks the next lesson, 3 ★ for 90%+. XP and ranks from Gully Rookie to Cricket Legend, module badges,
  family leaderboard and a printable "Certified Cricket Expert" certificate. Content: `assets/academy.json`.
- **Live sharing** — share a match link; anyone can watch the score update live (no login needed).

## Requirements
- PHP 7.4 or newer (8.x recommended) with `pdo_mysql`
- MySQL 5.7+ or MariaDB 10.3+
- HTTPS recommended (needed for "Install app" on phones)

## Install (cPanel / any shared hosting)
1. **Create a database**: cPanel → *MySQL Databases* → create a database (e.g. `youruser_cric`),
   a user with a strong password, and add the user to the database with **ALL PRIVILEGES**.
2. **Upload** the contents of this folder to your web server, e.g. `public_html/cricket/`.
3. **Copy `config.local.sample.php` to `config.local.php`** and set `DB_NAME`, `DB_USER`, `DB_PASS`
   (on Hostinger these include the `u…_` prefix). Leave `config.php` unchanged — it holds placeholders only.
4. **Open** `https://your-domain/cricket/install.php` in a browser, create the admin account, and click *Install*.
5. **Delete `install.php`** from the server.
6. Open `https://your-domain/cricket/` on the phone → browser menu → **Add to Home screen**.

Alternative to step 4: import `sql/cric_scorer.sql` in phpMyAdmin, create an empty file `install.lock`
in the app folder, then open the app and register — the **first account registered becomes admin**.

## Accounts
- The admin can edit the IPL and international squads (add/remove players when transfers happen).
- Everyone else can create their own teams, tournaments and matches, and view everyone's matches.
- Only the person who created a match can score it.

## Nginx
Apache uses the included `.htaccess` files. On Nginx, block direct access to the `inc/`, `sql/`, `data/`
and `tools/` folders and `config.php`, e.g. `location ~ ^/(inc|sql|data|tools)/ { deny all; }`.

## Updating squads
Squads are as of October 2026. Edit them in the app (log in as admin), or edit `data/*.json`
and run `python3 tools/build_sql.py` to regenerate `sql/cric_scorer.sql` for a fresh install.

## Files
```
index.php        app shell        api.php       JSON API        install.php   one-time installer
config.php       database config  inc/          scoring engine  assets/       app JS, CSS, icons
manifest.json    PWA manifest     sw.js         offline cache   sql/          schema + seed data
```

## Sign in with Google & reCAPTCHA (optional)
All keys go in `config.local.php` (see `config.local.sample.php`). Leave a key empty to keep that feature off.
- **Google:** Google Cloud Console → APIs & Services → Credentials → *OAuth client ID* → *Web application* →
  Authorised JavaScript origins `https://cricscorerapp.com` (plus any other domain you use) → put the Client ID in
  `GOOGLE_CLIENT_ID`. No client secret is needed. Players can also link Google later in *More → My Profile*.
- **reCAPTCHA:** https://www.google.com/recaptcha/admin/create → v2 "I'm not a robot" Checkbox (or v3) → add your
  domains → put the keys in `RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY` and set `RECAPTCHA_VERSION` to match.
- The server checks every Google sign-in and every captcha with Google, so it needs outbound HTTPS (normal on Hostinger).

## Keeping your password out of Git
Real database settings live in `config.local.php`, which is listed in `.gitignore` and blocked from the web
by `.htaccess`. `config.php` (in Git) only has placeholders and loads `config.local.php` when it exists, so a
`git pull` or zip upload never overwrites your server's password.
