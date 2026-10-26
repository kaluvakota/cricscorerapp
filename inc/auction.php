<?php
/* Cric-Scorer - Aaryush Premier League (APL) Auction: a multiplayer IPL-style player auction with virtual coins.
   Server-authoritative: every bid, timer and sale is decided here inside a locked transaction; browsers only poll
   (room_state every ~2 s) and render. Lots have a deadline stored in the database; whoever polls first after the
   deadline triggers the finalisation (auc_tick), so a server restart or a closed phone never loses or duplicates a sale. */

const AUC_DEFAULTS = ['name' => 'Aaryush Premier League Auction', 'max_participants' => 10, 'purse' => 100, 'squad_size' => 18, 'xi_size' => 11, 'overseas_limit' => 8,
    'timer' => 15, 'fast_timer' => 8, 'min_inc' => 1, 'bands' => [[20, 2], [50, 5]], 'mode' => 'standard', 'unsold' => 'end', 'host_plays' => 1,
    'base_price' => 2, 'overseas_extra' => 1, 'reset_on_bid' => 1, 'role_cap' => 0, 'franchises' => [], 'points' => ['player' => 1, 'balance' => 5, 'coin' => 0.2]];
const AUC_ROLES = ['Batter', 'Wicket-keeper', 'All-rounder', 'Bowler'];
const AUC_COLORS = ['#F9CD05', '#004BA0', '#EC1C24', '#3A225D', '#F26522', '#EA1A85', '#DD1F2D', '#17479E', '#1B2133', '#A72B2A', '#0d4a36', '#8e44ad'];
const AUC_AVATARS = ['🦁', '🐯', '🦅', '🐘', '🦈', '🐉', '🦊', '🐺', '🦄', '🐻', '🦖', '🐬', '🏏', '⚡', '🔥', '🌟'];

function schema_v119(): void {
    $t = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    db()->exec("CREATE TABLE IF NOT EXISTS auc_rooms (id INT AUTO_INCREMENT PRIMARY KEY, code VARCHAR(10) NOT NULL, name VARCHAR(80) NOT NULL, host_id INT NOT NULL,
        status ENUM('lobby','live','paused','done','closed') NOT NULL DEFAULT 'lobby', settings TEXT NOT NULL, current_lot INT NULL, deadline DATETIME(3) NULL, pause_left DECIMAL(6,1) NULL,
        version INT NOT NULL DEFAULT 1, lot_no INT NOT NULL DEFAULT 0, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, started_at DATETIME NULL, ended_at DATETIME NULL,
        UNIQUE KEY uniq_code (code), INDEX (host_id), INDEX (status), FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE) $t");
    db()->exec("CREATE TABLE IF NOT EXISTS auc_participants (id INT AUTO_INCREMENT PRIMARY KEY, room_id INT NOT NULL, user_id INT NOT NULL, team_name VARCHAR(40) NOT NULL, color VARCHAR(7) NOT NULL,
        avatar VARCHAR(8) NOT NULL, fav VARCHAR(6) NULL, is_host TINYINT(1) NOT NULL DEFAULT 0, is_bidder TINYINT(1) NOT NULL DEFAULT 1, purse INT NOT NULL DEFAULT 0, spent INT NOT NULL DEFAULT 0,
        bonus INT NOT NULL DEFAULT 0, xi TEXT NULL, last_seen_at DATETIME NULL, joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_member (room_id, user_id), INDEX (user_id), FOREIGN KEY (room_id) REFERENCES auc_rooms(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) $t");
    db()->exec("CREATE TABLE IF NOT EXISTS auc_players (id INT AUTO_INCREMENT PRIMARY KEY, room_id INT NOT NULL, player_id INT NULL, name VARCHAR(100) NOT NULL, role VARCHAR(20) NOT NULL,
        country VARCHAR(50) NULL, batting_style VARCHAR(30) NULL, bowling_style VARCHAR(40) NULL, franchise VARCHAR(6) NULL, franchise_color VARCHAR(7) NULL, overseas TINYINT(1) NOT NULL DEFAULT 0,
        base_price INT NOT NULL DEFAULT 2, status ENUM('queued','live','sold','unsold','withdrawn') NOT NULL DEFAULT 'queued', sold_to INT NULL, price INT NULL, sort_order INT NOT NULL DEFAULT 0,
        high_bid INT NULL, high_bidder INT NULL, bids INT NOT NULL DEFAULT 0, lot_no INT NULL, passes INT NOT NULL DEFAULT 0,
        INDEX (room_id, status, sort_order), INDEX (sold_to), FOREIGN KEY (room_id) REFERENCES auc_rooms(id) ON DELETE CASCADE) $t");
    db()->exec("CREATE TABLE IF NOT EXISTS auc_bids (id INT AUTO_INCREMENT PRIMARY KEY, room_id INT NOT NULL, lot_id INT NOT NULL, participant_id INT NOT NULL, amount INT NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), UNIQUE KEY uniq_amount (lot_id, amount), INDEX (room_id, id), FOREIGN KEY (room_id) REFERENCES auc_rooms(id) ON DELETE CASCADE) $t");
    db()->exec("CREATE TABLE IF NOT EXISTS auc_events (id INT AUTO_INCREMENT PRIMARY KEY, room_id INT NOT NULL, kind VARCHAR(24) NOT NULL, data TEXT NULL, user_id INT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), INDEX (room_id, id), FOREIGN KEY (room_id) REFERENCES auc_rooms(id) ON DELETE CASCADE) $t");
}

/* ---------- helpers ---------- */
function auc_settings(array $r): array { $s = json_decode($r['settings'], true) ?: []; return array_replace(AUC_DEFAULTS, $s); }
function auc_event(int $roomId, string $kind, array $data = [], ?int $userId = null): void {
    q('INSERT INTO auc_events (room_id, kind, data, user_id) VALUES (?,?,?,?)', [$roomId, $kind, $data ? json_encode($data) : null, $userId]);
}
function auc_bump(int $roomId): void { q('UPDATE auc_rooms SET version=version+1 WHERE id=?', [$roomId]); }
function auc_now(): string { return date('Y-m-d H:i:s.v'); }
function auc_secs_left(?string $deadline): float { if (!$deadline) return 0; return max(0, (strtotime(substr($deadline, 0, 19)) + (float)('0.' . (explode('.', $deadline)[1] ?? '0'))) - microtime(true)); }
function auc_deadline(float $secs): string { $t = microtime(true) + $secs; return date('Y-m-d H:i:s', (int)$t) . '.' . str_pad((string)(int)(($t - floor($t)) * 1000), 3, '0', STR_PAD_LEFT); }
function auc_new_code(): string {
    $alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';     // no 0/O/1/I
    for ($i = 0; $i < 50; $i++) {
        $c = ''; for ($k = 0; $k < 8; $k++) $c .= $alpha[random_int(0, strlen($alpha) - 1)];
        if (!val('SELECT 1 FROM auc_rooms WHERE code=?', [$c])) return $c;
    }
    fail('Could not make a room code - try again', 503);
}
/** Next valid bid for a lot: base price for the first bid, otherwise current + increment for that price band */
function auc_next_bid(array $s, ?int $high, int $base): int {
    if ($high === null) return $base;
    $inc = (int)$s['min_inc'];
    foreach ((array)$s['bands'] as $b) if (is_array($b) && count($b) === 2 && $high >= (int)$b[0]) $inc = max($inc, (int)$b[1]);
    return $high + max(1, $inc);
}
function auc_load_room(int $id, bool $lock = false): array {
    $r = row('SELECT * FROM auc_rooms WHERE id=?' . ($lock ? ' FOR UPDATE' : ''), [$id]);
    if (!$r) fail('Auction not found', 404);
    return $r;
}
function auc_member(array $r, ?array $u, bool $lock = false): ?array {
    if (!$u) return null;
    return row('SELECT * FROM auc_participants WHERE room_id=? AND user_id=?' . ($lock ? ' FOR UPDATE' : ''), [$r['id'], $u['id']]) ?: null;
}
function auc_require_host(array $r, ?array $u): void {
    if (!$u || ((int)$r['host_id'] !== (int)$u['id'] && empty($u['is_admin']))) fail('Only the host can do that', 403);
}
function auc_squad_counts(int $pid): array {
    $x = row("SELECT COUNT(*) n, COALESCE(SUM(overseas),0) o FROM auc_players WHERE sold_to=? AND status='sold'", [$pid]);
    $roles = []; foreach (rows("SELECT role, COUNT(*) c FROM auc_players WHERE sold_to=? AND status='sold' GROUP BY role", [$pid]) as $rr) $roles[$rr['role']] = (int)$rr['c'];
    return ['n' => (int)$x['n'], 'overseas' => (int)$x['o'], 'roles' => $roles];
}

/* ---------- the server-side clock: finalise expired lots, present the next one ---------- */
/** Called inside a transaction with the room row locked. Returns the (possibly updated) room. */
function auc_tick(array $r): array {
    if ($r['status'] !== 'live') return $r;
    $s = auc_settings($r);
    for ($guard = 0; $guard < 3; $guard++) {
        if (!$r['current_lot']) { $r = auc_present_next($r, $s); if ($r['status'] !== 'live' || !$r['current_lot']) return $r; }
        if (auc_secs_left($r['deadline']) > 0) return $r;
        auc_finalise_lot($r, (int)$r['current_lot'], $s);
        q('UPDATE auc_rooms SET current_lot=NULL, deadline=NULL WHERE id=?', [$r['id']]);
        auc_bump((int)$r['id']);
        $r = auc_load_room((int)$r['id'], true);
    }
    return $r;
}
/** Sold to the highest bidder (purse deducted exactly once) or unsold */
function auc_finalise_lot(array $r, int $lotId, array $s): void {
    $lot = row("SELECT * FROM auc_players WHERE id=? AND room_id=? AND status='live' FOR UPDATE", [$lotId, $r['id']]);
    if (!$lot) return;
    if ($lot['high_bidder']) {
        $p = row('SELECT * FROM auc_participants WHERE id=? FOR UPDATE', [$lot['high_bidder']]);
        $price = (int)$lot['high_bid'];
        if ($p && (int)$p['purse'] >= $price) {
            q("UPDATE auc_players SET status='sold', sold_to=?, price=? WHERE id=? AND status='live'", [$p['id'], $price, $lot['id']]);
            q('UPDATE auc_participants SET purse=purse-?, spent=spent+? WHERE id=?', [$price, $price, $p['id']]);
            auc_event((int)$r['id'], 'player_sold', ['lot' => (int)$lot['id'], 'name' => $lot['name'], 'team' => $p['team_name'], 'participant' => (int)$p['id'], 'price' => $price]);
            return;
        }
    }
    $again = $s['unsold'] === 'end' && (int)$lot['passes'] < 1;      // one more go at the end of the auction
    q("UPDATE auc_players SET status=?, passes=passes+1, high_bid=NULL, high_bidder=NULL, sort_order=? WHERE id=?", [$again ? 'queued' : 'unsold', $again ? 100000 + (int)$lot['id'] : (int)$lot['sort_order'], $lot['id']]);
    auc_event((int)$r['id'], 'player_unsold', ['lot' => (int)$lot['id'], 'name' => $lot['name'], 'again' => $again]);
}
/** Put the next queued player under the hammer, or finish the auction when nobody is left */
function auc_present_next(array $r, array $s, ?int $lotId = null): array {
    $lot = $lotId ? row("SELECT * FROM auc_players WHERE id=? AND room_id=? AND status='queued' FOR UPDATE", [$lotId, $r['id']])
                  : row("SELECT * FROM auc_players WHERE room_id=? AND status='queued' ORDER BY sort_order, id LIMIT 1 FOR UPDATE", [$r['id']]);
    if (!$lot) {
        q("UPDATE auc_rooms SET status='done', current_lot=NULL, deadline=NULL, ended_at=NOW(), version=version+1 WHERE id=?", [$r['id']]);
        auc_event((int)$r['id'], 'auction_completed');
        return auc_load_room((int)$r['id'], true);
    }
    // nobody who can still buy? finish early
    $buyers = (int)val("SELECT COUNT(*) FROM auc_participants p WHERE p.room_id=? AND p.is_bidder=1 AND p.purse>=? AND (SELECT COUNT(*) FROM auc_players x WHERE x.sold_to=p.id AND x.status='sold') < ?", [$r['id'], (int)$lot['base_price'], (int)$s['squad_size']]);
    if ($buyers === 0) {
        q("UPDATE auc_players SET status='unsold' WHERE room_id=? AND status='queued'", [$r['id']]);
        return auc_present_next($r, $s);
    }
    $timer = $s['mode'] === 'accelerated' ? (int)$s['fast_timer'] : (int)$s['timer'];
    $no = (int)$r['lot_no'] + 1;
    q("UPDATE auc_players SET status='live', lot_no=?, high_bid=NULL, high_bidder=NULL, bids=0 WHERE id=?", [$no, $lot['id']]);
    q('UPDATE auc_rooms SET current_lot=?, deadline=?, lot_no=?, version=version+1 WHERE id=?', [$lot['id'], auc_deadline($timer), $no, $r['id']]);
    auc_event((int)$r['id'], 'player_presented', ['lot' => (int)$lot['id'], 'name' => $lot['name'], 'base' => (int)$lot['base_price'], 'no' => $no]);
    return auc_load_room((int)$r['id'], true);
}

/* ---------- actions ---------- */
function auction_action(string $action, array $in, ?array $u): array {
    if (!$u) fail('Sign in first', 401);
    if (!feature_on($u, 'auction')) fail('APL Auction is not switched on for you yet', 403);
    switch ($action) {
        case 'auc_home': {
            $mine = rows("SELECT r.id, r.code, r.name, r.status, r.created_at, p.team_name, p.is_host, (SELECT COUNT(*) FROM auc_participants x WHERE x.room_id=r.id) members
                          FROM auc_rooms r JOIN auc_participants p ON p.room_id=r.id AND p.user_id=? WHERE r.status<>'closed' ORDER BY r.id DESC LIMIT 30", [$u['id']]);
            foreach ($mine as &$m) { $m['id'] = (int)$m['id']; $m['members'] = (int)$m['members']; $m['is_host'] = (bool)$m['is_host']; } unset($m);
            $recent = rows("SELECT r.id, r.code, r.name, r.ended_at, (SELECT COUNT(*) FROM auc_participants x WHERE x.room_id=r.id) members,
                            (SELECT CONCAT(x.name, '|', x.price, '|', t.team_name) FROM auc_players x JOIN auc_participants t ON t.id=x.sold_to WHERE x.room_id=r.id AND x.status='sold' ORDER BY x.price DESC, x.id LIMIT 1) top
                            FROM auc_rooms r WHERE r.status='done' AND EXISTS (SELECT 1 FROM auc_participants p WHERE p.room_id=r.id AND p.user_id=?) ORDER BY r.ended_at DESC LIMIT 5", [$u['id']]);
            return ['rooms' => $mine, 'recent' => $recent, 'defaults' => AUC_DEFAULTS, 'colors' => AUC_COLORS, 'avatars' => AUC_AVATARS,
                    'franchises' => rows("SELECT id, name, short_name, color, (SELECT COUNT(*) FROM players p WHERE p.team_id=teams.id) players FROM teams WHERE category='ipl' ORDER BY name")];
        }
        case 'auc_create': {
            if ((int)val("SELECT COUNT(*) FROM auc_rooms WHERE host_id=? AND status IN ('lobby','live','paused')", [$u['id']]) >= 3) fail('You already have 3 auctions running - finish or close one first');
            $s = auc_clean_settings((array)($in['settings'] ?? []));
            $name = mb_substr(trim((string)($in['name'] ?? '')), 0, 80) ?: AUC_DEFAULTS['name'];
            db()->beginTransaction();
            q('INSERT INTO auc_rooms (code, name, host_id, settings) VALUES (?,?,?,?)', [auc_new_code(), $name, $u['id'], json_encode($s)]);
            $id = lastId();
            auc_join_room($id, $u, $in, true, $s);
            auc_seed_pool($id, $s);
            auc_event($id, 'room_created', ['name' => $name], (int)$u['id']);
            db()->commit();
            return ['id' => $id, 'code' => val('SELECT code FROM auc_rooms WHERE id=?', [$id])];
        }
        case 'auc_lookup': {              // validate a code before showing the join form
            $code = auc_code_in($in);
            $r = row('SELECT id, name, status, code, host_id FROM auc_rooms WHERE code=?', [$code]);
            if (!$r || $r['status'] === 'closed') { auc_fail_count(); fail('No auction with that code'); }
            $s = auc_settings(auc_load_room((int)$r['id']));
            $n = (int)val('SELECT COUNT(*) FROM auc_participants WHERE room_id=?', [$r['id']]);
            $me = auc_member(['id' => $r['id']], $u);
            return ['room' => ['id' => (int)$r['id'], 'name' => $r['name'], 'status' => $r['status'], 'code' => $r['code'], 'members' => $n, 'max' => (int)$s['max_participants'], 'purse' => (int)$s['purse'], 'host' => val('SELECT display_name FROM users WHERE id=?', [$r['host_id']])],
                    'joined' => (bool)$me, 'colors' => AUC_COLORS, 'avatars' => AUC_AVATARS, 'franchises' => rows("SELECT short_name, name, color FROM teams WHERE category='ipl' ORDER BY name")];
        }
        case 'auc_join': {
            $code = auc_code_in($in);
            db()->beginTransaction();
            $r = row('SELECT * FROM auc_rooms WHERE code=? FOR UPDATE', [$code]);
            if (!$r || $r['status'] === 'closed') { db()->rollBack(); auc_fail_count(); fail('No auction with that code'); }
            $me = auc_member($r, $u);
            if ($me) { db()->commit(); return ['id' => (int)$r['id'], 'code' => $r['code'], 'rejoined' => true]; }
            if ($r['status'] !== 'lobby') fail('This auction has already started - ask the host for a new room');
            $s = auc_settings($r);
            if ((int)val('SELECT COUNT(*) FROM auc_participants WHERE room_id=?', [$r['id']]) >= (int)$s['max_participants']) fail('This room is full');
            auc_join_room((int)$r['id'], $u, $in, false, $s);
            auc_bump((int)$r['id']);
            db()->commit();
            return ['id' => (int)$r['id'], 'code' => $r['code']];
        }
        case 'auc_profile': {             // change team name / colour / avatar (lobby only)
            db()->beginTransaction();
            $r = auc_load_room((int)($in['id'] ?? 0), true);
            $me = auc_member($r, $u, true); if (!$me) fail('You are not in this auction', 403);
            if ($r['status'] !== 'lobby') fail('Team details are locked once the auction starts');
            [$name, $color, $avatar, $fav] = auc_team_in($in, $me);
            q('UPDATE auc_participants SET team_name=?, color=?, avatar=?, fav=? WHERE id=?', [$name, $color, $avatar, $fav, $me['id']]);
            auc_bump((int)$r['id']); db()->commit();
            return ['ok' => true];
        }
        case 'auc_settings': {            // host edits settings in the lobby
            db()->beginTransaction();
            $r = auc_load_room((int)($in['id'] ?? 0), true); auc_require_host($r, $u);
            if ($r['status'] !== 'lobby') fail('Settings are locked once the auction starts');
            $old = auc_settings($r);
            $s = auc_clean_settings(array_replace($old, (array)($in['settings'] ?? [])));
            $name = mb_substr(trim((string)($in['name'] ?? $r['name'])), 0, 80) ?: $r['name'];
            q('UPDATE auc_rooms SET settings=?, name=?, version=version+1 WHERE id=?', [json_encode($s), $name, $r['id']]);
            if ((int)$s['purse'] !== (int)$old['purse']) q('UPDATE auc_participants SET purse=? WHERE room_id=?', [(int)$s['purse'], $r['id']]);
            if ($s['franchises'] != $old['franchises'] || (int)$s['base_price'] !== (int)$old['base_price'] || (int)$s['overseas_extra'] !== (int)$old['overseas_extra']) { q('DELETE FROM auc_players WHERE room_id=? AND player_id IS NOT NULL', [$r['id']]); auc_seed_pool((int)$r['id'], $s); }
            db()->commit();
            return ['ok' => true];
        }
        case 'auc_pool_add': {            // host adds a custom player (friends, fictional stars)
            db()->beginTransaction();
            $r = auc_load_room((int)($in['id'] ?? 0), true); auc_require_host($r, $u);
            if ($r['status'] === 'done' || $r['status'] === 'closed') fail('The auction is over');
            $name = mb_substr(trim(strip_tags((string)($in['name'] ?? ''))), 0, 100);
            if (mb_strlen($name) < 2) fail('Give the player a name');
            $role = in_array($in['role'] ?? '', AUC_ROLES, true) ? $in['role'] : 'Batter';
            $base = max(1, min(50, (int)($in['base_price'] ?? AUC_DEFAULTS['base_price'])));
            q('INSERT INTO auc_players (room_id, name, role, country, overseas, base_price, franchise, sort_order) VALUES (?,?,?,?,?,?,?,?)',
              [$r['id'], $name, $role, mb_substr(trim((string)($in['country'] ?? 'India')), 0, 50), !empty($in['overseas']) ? 1 : 0, $base, 'APL', 50000 + (int)val('SELECT COUNT(*) FROM auc_players WHERE room_id=?', [$r['id']])]);
            auc_bump((int)$r['id']); db()->commit();
            return ['id' => lastId()];
        }
        case 'auc_pool_remove': {
            db()->beginTransaction();
            $r = auc_load_room((int)($in['id'] ?? 0), true); auc_require_host($r, $u);
            $lot = row('SELECT * FROM auc_players WHERE id=? AND room_id=? FOR UPDATE', [(int)($in['lot_id'] ?? 0), $r['id']]);
            if (!$lot) fail('Player not found');
            if ($r['status'] === 'lobby') q('DELETE FROM auc_players WHERE id=?', [$lot['id']]);
            elseif ($lot['status'] === 'queued') { q("UPDATE auc_players SET status='withdrawn' WHERE id=?", [$lot['id']]); auc_event((int)$r['id'], 'player_withdrawn', ['lot' => (int)$lot['id'], 'name' => $lot['name']], (int)$u['id']); }
            else fail('Only players still in the queue can be withdrawn');
            auc_bump((int)$r['id']); db()->commit();
            return ['ok' => true];
        }
        case 'auc_kick': {                // lobby only
            db()->beginTransaction();
            $r = auc_load_room((int)($in['id'] ?? 0), true); auc_require_host($r, $u);
            if ($r['status'] !== 'lobby') fail('Participants can only be removed before the auction starts');
            $p = row('SELECT * FROM auc_participants WHERE id=? AND room_id=?', [(int)($in['participant_id'] ?? 0), $r['id']]);
            if (!$p || $p['is_host']) fail('Cannot remove that participant');
            q('DELETE FROM auc_participants WHERE id=?', [$p['id']]);
            auc_event((int)$r['id'], 'participant_left', ['team' => $p['team_name'], 'removed' => true], (int)$u['id']);
            auc_bump((int)$r['id']); db()->commit();
            return ['ok' => true];
        }
        case 'auc_leave': {
            db()->beginTransaction();
            $r = auc_load_room((int)($in['id'] ?? 0), true);
            $me = auc_member($r, $u, true); if (!$me) fail('You are not in this auction');
            if ($me['is_host']) fail('The host cannot leave - close the auction instead');
            if ($r['status'] !== 'lobby') fail('You cannot leave once the auction has started');
            q('DELETE FROM auc_participants WHERE id=?', [$me['id']]);
            auc_event((int)$r['id'], 'participant_left', ['team' => $me['team_name']], (int)$u['id']);
            auc_bump((int)$r['id']); db()->commit();
            return ['ok' => true];
        }
        case 'auc_start': {
            db()->beginTransaction();
            $r = auc_load_room((int)($in['id'] ?? 0), true); auc_require_host($r, $u);
            if ($r['status'] !== 'lobby') fail('The auction has already started');
            $s = auc_settings($r);
            $bidders = (int)val('SELECT COUNT(*) FROM auc_participants WHERE room_id=? AND is_bidder=1', [$r['id']]);
            if ($bidders < 2) fail('You need at least 2 bidding teams to start');
            if (!val('SELECT 1 FROM auc_players WHERE room_id=? LIMIT 1', [$r['id']])) fail('The player pool is empty - pick some franchises or add players');
            // shuffle the pool, keep custom players (sort_order >= 50000) in their own spot at the end
            $ids = array_column(rows('SELECT id FROM auc_players WHERE room_id=? AND sort_order<50000', [$r['id']]), 'id'); shuffle($ids);
            foreach ($ids as $i => $id) q('UPDATE auc_players SET sort_order=? WHERE id=?', [$i, $id]);
            q("UPDATE auc_rooms SET status='live', started_at=NOW(), version=version+1 WHERE id=?", [$r['id']]);
            auc_event((int)$r['id'], 'auction_started', [], (int)$u['id']);
            $r = auc_load_room((int)$r['id'], true);
            auc_present_next($r, $s);
            db()->commit();
            return auction_state((int)$r['id'], $u, 0);
        }
        case 'auc_state': return auction_state((int)($in['id'] ?? 0), $u, (int)($in['since'] ?? 0));
        case 'auc_bid': return auc_bid((int)($in['id'] ?? 0), (int)($in['lot_id'] ?? 0), (int)($in['amount'] ?? 0), $u);
        case 'auc_host': return auc_host_action((int)($in['id'] ?? 0), (string)($in['do'] ?? ''), $in, $u);
        case 'auc_xi': {
            db()->beginTransaction();
            $r = auc_load_room((int)($in['id'] ?? 0), true);
            $me = auc_member($r, $u, true); if (!$me) fail('You are not in this auction', 403);
            $s = auc_settings($r);
            $ids = array_values(array_unique(array_map('intval', (array)($in['xi'] ?? []))));
            if (count($ids) > (int)$s['xi_size']) fail('Only ' . $s['xi_size'] . ' players in the playing XI');
            $mine = array_map('intval', array_column(rows("SELECT id FROM auc_players WHERE sold_to=? AND status='sold'", [$me['id']]), 'id'));
            foreach ($ids as $id) if (!in_array($id, $mine, true)) fail('You can only pick players you bought');
            $ov = (int)val("SELECT COUNT(*) FROM auc_players WHERE id IN (" . (implode(',', array_fill(0, max(1, count($ids)), '?'))) . ") AND overseas=1", $ids ?: [0]);
            if ($ov > min(4, (int)$s['overseas_limit'])) fail('At most ' . min(4, (int)$s['overseas_limit']) . ' overseas players in the XI');
            q('UPDATE auc_participants SET xi=? WHERE id=?', [json_encode($ids), $me['id']]);
            auc_bump((int)$r['id']); db()->commit();
            return ['ok' => true];
        }
        case 'auc_results': return auc_results((int)($in['id'] ?? 0), $u);
        case 'auc_csv': return ['csv' => auc_csv((int)($in['id'] ?? 0), $u)];
        case 'auc_gallery': {
            $q = trim((string)($in['q'] ?? '')); $w = ["t.category='ipl'"]; $p = [];
            if ($q !== '') { $w[] = '(p.name LIKE ? OR p.country LIKE ?)'; $p[] = "%$q%"; $p[] = "%$q%"; }
            if (!empty($in['team'])) { $w[] = 't.short_name=?'; $p[] = (string)$in['team']; }
            if (!empty($in['role'])) { $w[] = 'p.role=?'; $p[] = (string)$in['role']; }
            if (isset($in['overseas']) && $in['overseas'] !== '') { $w[] = 'p.is_overseas=?'; $p[] = (int)$in['overseas']; }
            $list = rows('SELECT p.id, p.name, p.role, p.country, p.batting_style, p.bowling_style, p.is_overseas overseas, t.short_name franchise, t.color FROM players p JOIN teams t ON t.id=p.team_id WHERE ' . implode(' AND ', $w) . ' ORDER BY t.short_name, p.role, p.name LIMIT 600', $p);
            foreach ($list as &$x) { $x['id'] = (int)$x['id']; $x['overseas'] = (bool)$x['overseas']; $x['base_price'] = AUC_DEFAULTS['base_price'] + ($x['overseas'] ? AUC_DEFAULTS['overseas_extra'] : 0); } unset($x);
            return ['players' => $list, 'teams' => rows("SELECT short_name, name, color FROM teams WHERE category='ipl' ORDER BY name"), 'roles' => AUC_ROLES];
        }
    }
    fail('Unknown action', 404);
}

function auc_code_in(array $in): string {
    $code = strtoupper(preg_replace('/[^A-Z0-9]/i', '', (string)($in['code'] ?? '')));
    if (strlen($code) !== 8) { auc_fail_count(); fail('Room codes are 8 letters/numbers'); }
    if (!empty($_SESSION['auc_fail']) && $_SESSION['auc_fail']['n'] >= 15 && time() - $_SESSION['auc_fail']['t'] < 600) fail('Too many wrong codes - wait 10 minutes', 429);
    return $code;
}
function auc_fail_count(): void {
    $f = $_SESSION['auc_fail'] ?? ['n' => 0, 't' => time()];
    if (time() - $f['t'] > 600) $f = ['n' => 0, 't' => time()];
    $f['n']++; $_SESSION['auc_fail'] = $f;
}
function auc_clean_settings(array $in): array {
    $s = array_replace(AUC_DEFAULTS, array_intersect_key($in, AUC_DEFAULTS));
    $s['max_participants'] = max(2, min(20, (int)$s['max_participants']));
    $s['purse'] = max(10, min(100000, (int)$s['purse']));
    $s['squad_size'] = max(1, min(25, (int)$s['squad_size']));
    $s['xi_size'] = max(1, min($s['squad_size'], (int)$s['xi_size']));
    $s['overseas_limit'] = max(0, min(25, (int)$s['overseas_limit']));
    $s['timer'] = max(5, min(120, (int)$s['timer'])); $s['fast_timer'] = max(3, min(60, (int)$s['fast_timer']));
    $s['min_inc'] = max(1, min(1000, (int)$s['min_inc']));
    $s['base_price'] = max(1, min(1000, (int)$s['base_price'])); $s['overseas_extra'] = max(0, min(1000, (int)$s['overseas_extra']));
    $s['mode'] = $s['mode'] === 'accelerated' ? 'accelerated' : 'standard';
    $s['unsold'] = in_array($s['unsold'], ['end', 'none'], true) ? $s['unsold'] : 'end';
    $s['host_plays'] = empty($s['host_plays']) ? 0 : 1; $s['reset_on_bid'] = empty($s['reset_on_bid']) ? 0 : 1;
    $s['role_cap'] = max(0, min(25, (int)$s['role_cap']));
    $bands = []; foreach ((array)$s['bands'] as $b) if (is_array($b) && count($b) === 2 && (int)$b[0] > 0 && (int)$b[1] > 0) $bands[] = [(int)$b[0], (int)$b[1]];
    usort($bands, fn($a, $b) => $a[0] <=> $b[0]); $s['bands'] = array_slice($bands, 0, 6);
    $s['franchises'] = array_values(array_unique(array_filter(array_map(fn($x) => strtoupper(preg_replace('/[^A-Z]/i', '', (string)$x)), (array)$s['franchises']))));
    $pts = (array)$s['points']; $s['points'] = ['player' => max(0, min(100, (float)($pts['player'] ?? 1))), 'balance' => max(0, min(100, (float)($pts['balance'] ?? 5))), 'coin' => max(0, min(100, (float)($pts['coin'] ?? 0.2)))];
    return $s;
}
function auc_team_in(array $in, ?array $me = null): array {
    $name = mb_substr(trim(strip_tags((string)($in['team_name'] ?? ($me['team_name'] ?? '')))), 0, 40);
    if (mb_strlen($name) < 2) fail('Give your team a name');
    $color = preg_match('/^#[0-9a-f]{6}$/i', (string)($in['color'] ?? '')) ? strtoupper($in['color']) : ($me['color'] ?? AUC_COLORS[random_int(0, count(AUC_COLORS) - 1)]);
    $avatar = mb_substr(trim((string)($in['avatar'] ?? ($me['avatar'] ?? '🏏'))), 0, 4) ?: '🏏';
    $fav = strtoupper(preg_replace('/[^A-Z]/i', '', (string)($in['fav'] ?? ($me['fav'] ?? '')))) ?: null;
    return [$name, $color, $avatar, $fav];
}
function auc_join_room(int $roomId, array $u, array $in, bool $host, array $s): void {
    [$name, $color, $avatar, $fav] = auc_team_in(['team_name' => $in['team_name'] ?? ($u['display_name'] . "'s XI")] + $in);
    if (val('SELECT 1 FROM auc_participants WHERE room_id=? AND team_name=?', [$roomId, $name])) $name = mb_substr($name, 0, 36) . ' ' . random_int(2, 99);
    q('INSERT INTO auc_participants (room_id, user_id, team_name, color, avatar, fav, is_host, is_bidder, purse, last_seen_at) VALUES (?,?,?,?,?,?,?,?,?,NOW())',
      [$roomId, $u['id'], $name, $color, $avatar, $fav, $host ? 1 : 0, ($host && empty($s['host_plays'])) ? 0 : 1, (int)$s['purse']]);
    auc_event($roomId, 'participant_joined', ['team' => $name, 'host' => $host], (int)$u['id']);
}
/** Copy the chosen IPL franchises' squads (from the app's own player tables) into the room's pool */
function auc_seed_pool(int $roomId, array $s): void {
    $fr = $s['franchises'];
    $w = "t.category='ipl'"; $p = [];
    if ($fr) { $w .= ' AND t.short_name IN (' . implode(',', array_fill(0, count($fr), '?')) . ')'; $p = $fr; }
    $i = 0;
    foreach (rows("SELECT p.*, t.short_name, t.color FROM players p JOIN teams t ON t.id=p.team_id WHERE $w ORDER BY t.short_name, p.role, p.name", $p) as $x) {
        q('INSERT INTO auc_players (room_id, player_id, name, role, country, batting_style, bowling_style, franchise, franchise_color, overseas, base_price, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
          [$roomId, $x['id'], $x['name'], $x['role'], $x['country'], $x['batting_style'], $x['bowling_style'], $x['short_name'], $x['color'], (int)$x['is_overseas'], (int)$s['base_price'] + ((int)$x['is_overseas'] ? (int)$s['overseas_extra'] : 0), $i++]);
    }
}

/* ---------- bidding ---------- */
function auc_bid(int $roomId, int $lotId, int $amount, array $u): array {
    db()->beginTransaction();
    $r = auc_load_room($roomId, true);
    $me = auc_member($r, $u, true);
    if (!$me) fail('You are not in this auction', 403);
    if (!$me['is_bidder']) fail('The host is running this auction and is not bidding');
    $r = auc_tick($r);
    if ($r['status'] === 'paused') fail('The auction is paused');
    if ($r['status'] !== 'live') fail('The auction is not running');
    if ((int)$r['current_lot'] !== $lotId) { db()->commit(); return ['error_code' => 'stale', 'message' => 'That player has already been sold - here is the current one'] + auction_state($roomId, $u, 0); }
    $s = auc_settings($r);
    $lot = row("SELECT * FROM auc_players WHERE id=? AND status='live' FOR UPDATE", [$lotId]);
    if (!$lot) fail('That player is no longer up for auction');
    if ($lot['high_bidder'] && (int)$lot['high_bidder'] === (int)$me['id']) fail('You already hold the highest bid');
    $next = auc_next_bid($s, $lot['high_bid'] !== null ? (int)$lot['high_bid'] : null, (int)$lot['base_price']);
    if ($amount < $next) { db()->commit(); return ['error_code' => 'stale', 'message' => ($lot['high_bidder'] ? val('SELECT team_name FROM auc_participants WHERE id=?', [$lot['high_bidder']]) . ' bid first - ' : '') . "the next bid is $next coins"] + auction_state($roomId, $u, 0); }
    if ($amount > (int)$me['purse']) fail('Not enough coins - you have ' . $me['purse']);
    if ($amount > $next + 20 * max(1, (int)$s['min_inc']) && $amount > $next * 3) fail('That jump is too big - bid in steps');
    $c = auc_squad_counts((int)$me['id']);
    if ($c['n'] >= (int)$s['squad_size']) fail('Your squad is full (' . $s['squad_size'] . ' players)');
    if ($lot['overseas'] && $c['overseas'] >= (int)$s['overseas_limit']) fail('You already have ' . $s['overseas_limit'] . ' overseas players');
    if ((int)$s['role_cap'] > 0 && ($c['roles'][$lot['role']] ?? 0) >= (int)$s['role_cap']) fail('You already have ' . $s['role_cap'] . ' ' . strtolower($lot['role']) . 's');
    try { q('INSERT INTO auc_bids (room_id, lot_id, participant_id, amount) VALUES (?,?,?,?)', [$roomId, $lotId, $me['id'], $amount]); }
    catch (Throwable $e) { db()->rollBack(); return ['error_code' => 'stale', 'message' => 'Someone bid the same amount a moment earlier'] + auction_state($roomId, $u, 0); }
    $timer = $s['mode'] === 'accelerated' ? (int)$s['fast_timer'] : (int)$s['timer'];
    q('UPDATE auc_players SET high_bid=?, high_bidder=?, bids=bids+1 WHERE id=?', [$amount, $me['id'], $lotId]);
    if (!empty($s['reset_on_bid'])) q('UPDATE auc_rooms SET deadline=? WHERE id=?', [auc_deadline($timer), $roomId]);
    elseif (auc_secs_left($r['deadline']) < 3) q('UPDATE auc_rooms SET deadline=? WHERE id=?', [auc_deadline(3), $roomId]);   // always leave a moment to respond
    q('UPDATE auc_participants SET last_seen_at=NOW() WHERE id=?', [$me['id']]);
    auc_event($roomId, 'bid_accepted', ['lot' => $lotId, 'name' => $lot['name'], 'team' => $me['team_name'], 'participant' => (int)$me['id'], 'amount' => $amount, 'color' => $me['color']], (int)$u['id']);
    auc_bump($roomId);
    db()->commit();
    return ['ok' => true] + auction_state($roomId, $u, 0);
}

/* ---------- host console ---------- */
function auc_host_action(int $roomId, string $do, array $in, array $u): array {
    db()->beginTransaction();
    $r = auc_load_room($roomId, true); auc_require_host($r, $u);
    $s = auc_settings($r);
    switch ($do) {
        case 'pause':
            if ($r['status'] !== 'live') fail('Not running');
            q("UPDATE auc_rooms SET status='paused', pause_left=? WHERE id=?", [round(auc_secs_left($r['deadline']), 1), $r['id']]);
            auc_event($roomId, 'auction_paused', [], (int)$u['id']); break;
        case 'resume':
            if ($r['status'] !== 'paused') fail('Not paused');
            q("UPDATE auc_rooms SET status='live', deadline=?, pause_left=NULL WHERE id=?", [$r['current_lot'] ? auc_deadline(max(3, (float)$r['pause_left'])) : null, $r['id']]);
            auc_event($roomId, 'auction_resumed', [], (int)$u['id']); break;
        case 'skip':                               // current player goes unsold now
            if (!in_array($r['status'], ['live', 'paused'], true) || !$r['current_lot']) fail('No player is up right now');
            $lot = row('SELECT * FROM auc_players WHERE id=? FOR UPDATE', [$r['current_lot']]);
            if ($lot['high_bidder']) fail('There is a bid on this player - let the timer run out');
            q("UPDATE auc_players SET status='unsold', passes=passes+1 WHERE id=?", [$lot['id']]);
            auc_event($roomId, 'player_unsold', ['lot' => (int)$lot['id'], 'name' => $lot['name'], 'skipped' => true], (int)$u['id']);
            q("UPDATE auc_rooms SET current_lot=NULL, deadline=NULL, status='live' WHERE id=?", [$r['id']]);
            $r = auc_load_room($roomId, true); auc_present_next($r, $s); break;
        case 'next':                               // choose a specific queued player to come up after the current one
            $lot = row("SELECT * FROM auc_players WHERE id=? AND room_id=? AND status='queued' FOR UPDATE", [(int)($in['lot_id'] ?? 0), $r['id']]);
            if (!$lot) fail('That player is not in the queue');
            q('UPDATE auc_players SET sort_order=(SELECT COALESCE(MIN(x.sort_order),0)-1 FROM (SELECT sort_order FROM auc_players WHERE room_id=? AND status=\'queued\') x) WHERE id=?', [$r['id'], $lot['id']]);
            if (!$r['current_lot'] && $r['status'] === 'live') { $r = auc_load_room($roomId, true); auc_present_next($r, $s); }
            auc_event($roomId, 'queue_changed', ['lot' => (int)$lot['id'], 'name' => $lot['name']], (int)$u['id']); break;
        case 'reopen':                             // put an unsold player back in the queue
            $lot = row("SELECT * FROM auc_players WHERE id=? AND room_id=? AND status IN ('unsold','withdrawn') FOR UPDATE", [(int)($in['lot_id'] ?? 0), $r['id']]);
            if (!$lot) fail('That player is not unsold');
            if ($r['status'] === 'done') q("UPDATE auc_rooms SET status='live', ended_at=NULL WHERE id=?", [$r['id']]);
            q("UPDATE auc_players SET status='queued', sort_order=? WHERE id=?", [200000 + (int)$lot['id'], $lot['id']]);
            auc_event($roomId, 'player_reopened', ['lot' => (int)$lot['id'], 'name' => $lot['name']], (int)$u['id']);
            $r = auc_load_room($roomId, true); if ($r['status'] === 'live' && !$r['current_lot']) auc_present_next($r, $s); break;
        case 'withdraw':
            $lot = row("SELECT * FROM auc_players WHERE id=? AND room_id=? AND status='queued' FOR UPDATE", [(int)($in['lot_id'] ?? 0), $r['id']]);
            if (!$lot) fail('Only players in the queue can be withdrawn');
            q("UPDATE auc_players SET status='withdrawn' WHERE id=?", [$lot['id']]);
            auc_event($roomId, 'player_withdrawn', ['lot' => (int)$lot['id'], 'name' => $lot['name']], (int)$u['id']); break;
        case 'timer':                              // change the timer / mode for the following players
            $s['timer'] = max(5, min(120, (int)($in['timer'] ?? $s['timer']))); $s['fast_timer'] = max(3, min(60, (int)($in['fast_timer'] ?? $s['fast_timer'])));
            if (isset($in['mode'])) $s['mode'] = $in['mode'] === 'accelerated' ? 'accelerated' : 'standard';
            q('UPDATE auc_rooms SET settings=? WHERE id=?', [json_encode($s), $r['id']]);
            auc_event($roomId, 'settings_changed', ['timer' => $s['timer'], 'fast_timer' => $s['fast_timer'], 'mode' => $s['mode']], (int)$u['id']); break;
        case 'extend':                             // give the current player a few more seconds (before/while bidding)
            if ($r['status'] !== 'live' || !$r['current_lot']) fail('No player is up right now');
            q('UPDATE auc_rooms SET deadline=? WHERE id=?', [auc_deadline(auc_secs_left($r['deadline']) + max(1, min(60, (int)($in['secs'] ?? 10)))), $r['id']]); break;
        case 'bonus':                              // host-defined points for the leaderboard (recorded in the audit trail)
            $p = row('SELECT * FROM auc_participants WHERE id=? AND room_id=?', [(int)($in['participant_id'] ?? 0), $r['id']]);
            if (!$p) fail('Team not found');
            $b = max(-100, min(100, (int)($in['bonus'] ?? 0)));
            q('UPDATE auc_participants SET bonus=? WHERE id=?', [$b, $p['id']]);
            auc_event($roomId, 'admin_change', ['team' => $p['team_name'], 'bonus' => $b, 'note' => mb_substr((string)($in['note'] ?? ''), 0, 120)], (int)$u['id']); break;
        case 'end':                                // finish now: current lot finalised, the rest unsold
            if (!in_array($r['status'], ['live', 'paused'], true)) fail('The auction is not running');
            if ($r['current_lot']) { auc_finalise_lot($r, (int)$r['current_lot'], $s); }
            q("UPDATE auc_players SET status='unsold' WHERE room_id=? AND status IN ('queued','live')", [$r['id']]);
            q("UPDATE auc_rooms SET status='done', current_lot=NULL, deadline=NULL, ended_at=NOW() WHERE id=?", [$r['id']]);
            auc_event($roomId, 'auction_completed', ['ended_by_host' => true], (int)$u['id']); break;
        case 'close':
            if (!in_array($r['status'], ['lobby', 'done'], true)) fail('End the auction first');
            q("UPDATE auc_rooms SET status='closed' WHERE id=?", [$r['id']]);
            auc_event($roomId, 'room_closed', [], (int)$u['id']); break;
        default: fail('Unknown host action');
    }
    auc_bump($roomId);
    db()->commit();
    return auction_state($roomId, $u, 0);
}

/* ---------- state for the browsers ---------- */
function auction_state(int $roomId, array $u, int $since = 0): array {
    db()->beginTransaction();
    $r = auc_load_room($roomId, true);
    $me = auc_member($r, $u, false);
    if (!$me && empty($u['is_admin'])) { db()->rollBack(); fail('You are not in this auction - join with the room code', 403); }
    $r = auc_tick($r);
    if ($me) q('UPDATE auc_participants SET last_seen_at=NOW() WHERE id=?', [$me['id']]);
    db()->commit();
    $s = auc_settings($r);
    $parts = rows('SELECT p.*, u.display_name, u.username FROM auc_participants p JOIN users u ON u.id=p.user_id WHERE p.room_id=? ORDER BY p.is_host DESC, p.id', [$r['id']]);
    $counts = []; foreach (rows("SELECT sold_to, COUNT(*) n, SUM(overseas) o FROM auc_players WHERE room_id=? AND status='sold' GROUP BY sold_to", [$r['id']]) as $c) $counts[(int)$c['sold_to']] = $c;
    $teams = array_map(function ($p) use ($counts, $s) {
        $c = $counts[(int)$p['id']] ?? ['n' => 0, 'o' => 0];
        return ['id' => (int)$p['id'], 'user_id' => (int)$p['user_id'], 'name' => $p['team_name'], 'color' => $p['color'], 'avatar' => $p['avatar'], 'fav' => $p['fav'], 'owner' => $p['display_name'],
                'is_host' => (bool)$p['is_host'], 'is_bidder' => (bool)$p['is_bidder'], 'purse' => (int)$p['purse'], 'spent' => (int)$p['spent'], 'bonus' => (int)$p['bonus'],
                'players' => (int)$c['n'], 'overseas' => (int)$c['o'], 'slots' => max(0, (int)$s['squad_size'] - (int)$c['n']),
                'online' => $p['last_seen_at'] && (time() - strtotime($p['last_seen_at'])) < 12, 'xi' => $p['xi'] ? json_decode($p['xi'], true) : []];
    }, $parts);
    $lot = $r['current_lot'] ? row('SELECT * FROM auc_players WHERE id=?', [$r['current_lot']]) : null;
    $lotOut = null;
    if ($lot) {
        $hb = $lot['high_bidder'] ? row('SELECT id, team_name, color, avatar FROM auc_participants WHERE id=?', [$lot['high_bidder']]) : null;
        $lotOut = auc_player_out($lot) + ['high_bid' => $lot['high_bid'] !== null ? (int)$lot['high_bid'] : null, 'high_bidder' => $hb ? ['id' => (int)$hb['id'], 'name' => $hb['team_name'], 'color' => $hb['color'], 'avatar' => $hb['avatar']] : null,
            'next_bid' => auc_next_bid($s, $lot['high_bid'] !== null ? (int)$lot['high_bid'] : null, (int)$lot['base_price']), 'bids' => (int)$lot['bids'],
            'competing' => (int)val('SELECT COUNT(DISTINCT participant_id) FROM auc_bids WHERE lot_id=?', [$lot['id']]),
            'secs_left' => $r['status'] === 'paused' ? (float)$r['pause_left'] : round(auc_secs_left($r['deadline']), 1), 'lot_no' => (int)$lot['lot_no'],
            'history' => rows('SELECT b.amount, p.team_name team, p.color FROM auc_bids b JOIN auc_participants p ON p.id=b.participant_id WHERE b.lot_id=? ORDER BY b.id DESC LIMIT 8', [$lot['id']])];
    }
    $events = rows('SELECT id, kind, data, created_at FROM auc_events WHERE room_id=? AND id>? ORDER BY id DESC LIMIT 40', [$r['id'], $since]);
    foreach ($events as &$e) { $e['id'] = (int)$e['id']; $e['data'] = $e['data'] ? json_decode($e['data'], true) : null; } unset($e);
    $queueN = (int)val("SELECT COUNT(*) FROM auc_players WHERE room_id=? AND status='queued'", [$r['id']]);
    $upcoming = array_map('auc_player_out', rows("SELECT * FROM auc_players WHERE room_id=? AND status='queued' ORDER BY sort_order, id LIMIT 3", [$r['id']]));
    $myRoster = $me ? array_map(fn($x) => auc_player_out($x) + ['price' => (int)$x['price']], rows("SELECT * FROM auc_players WHERE sold_to=? AND status='sold' ORDER BY price DESC, id", [$me['id']])) : [];
    $pool = $r['status'] === 'lobby' ? ['n' => (int)val('SELECT COUNT(*) FROM auc_players WHERE room_id=?', [$r['id']]), 'custom' => array_map('auc_player_out', rows('SELECT * FROM auc_players WHERE room_id=? AND player_id IS NULL ORDER BY id', [$r['id']]))] : null;
    $myTeam = null; foreach ($teams as $t) if ($me && $t['id'] === (int)$me['id']) $myTeam = $t;
    return ['room' => ['id' => (int)$r['id'], 'code' => $r['code'], 'name' => $r['name'], 'status' => $r['status'], 'version' => (int)$r['version'], 'host_id' => (int)$r['host_id'], 'is_host' => (int)$r['host_id'] === (int)$u['id'] || !empty($u['is_admin']),
                'settings' => $s, 'lot_no' => (int)$r['lot_no'], 'queue' => $queueN, 'sold' => (int)val("SELECT COUNT(*) FROM auc_players WHERE room_id=? AND status='sold'", [$r['id']]),
                'unsold' => (int)val("SELECT COUNT(*) FROM auc_players WHERE room_id=? AND status='unsold'", [$r['id']]), 'started_at' => $r['started_at'], 'ended_at' => $r['ended_at'], 'server_time' => microtime(true)],
            'teams' => $teams, 'me' => $myTeam, 'lot' => $lotOut, 'upcoming' => $upcoming, 'events' => $events, 'roster' => $myRoster, 'pool' => $pool];
}
function auc_player_out(array $x): array {
    return ['id' => (int)$x['id'], 'player_id' => $x['player_id'] ? (int)$x['player_id'] : null, 'name' => $x['name'], 'role' => $x['role'], 'country' => $x['country'], 'batting_style' => $x['batting_style'],
            'bowling_style' => $x['bowling_style'], 'franchise' => $x['franchise'], 'franchise_color' => $x['franchise_color'], 'overseas' => (bool)$x['overseas'], 'base_price' => (int)$x['base_price'], 'status' => $x['status']];
}

/* ---------- results, leaderboard, CSV ---------- */
function auc_results(int $roomId, array $u): array {
    $r = auc_load_room($roomId);
    if (!auc_member($r, $u) && empty($u['is_admin'])) fail('You are not in this auction', 403);
    $s = auc_settings($r);
    $teams = rows('SELECT p.*, u.display_name FROM auc_participants p JOIN users u ON u.id=p.user_id WHERE p.room_id=? ORDER BY p.id', [$r['id']]);
    $sold = rows("SELECT x.*, t.team_name, t.color tcolor FROM auc_players x JOIN auc_participants t ON t.id=x.sold_to WHERE x.room_id=? AND x.status='sold' ORDER BY x.price DESC, x.lot_no", [$r['id']]);
    $unsold = rows("SELECT * FROM auc_players WHERE room_id=? AND status IN ('unsold','withdrawn') ORDER BY name", [$r['id']]);
    $out = [];
    foreach ($teams as $t) {
        $mine = array_values(array_filter($sold, fn($x) => (int)$x['sold_to'] === (int)$t['id']));
        $roles = []; foreach (AUC_ROLES as $ro) $roles[$ro] = count(array_filter($mine, fn($x) => $x['role'] === $ro));
        $balance = count(array_filter($roles));                                    // how many of the 4 roles are covered (0-4)
        $pts = $s['points'];
        $score = round(count($mine) * (float)$pts['player'] + $balance * (float)$pts['balance'] + (int)$t['purse'] * (float)$pts['coin'] + (int)$t['bonus'], 1);
        $out[] = ['id' => (int)$t['id'], 'name' => $t['team_name'], 'color' => $t['color'], 'avatar' => $t['avatar'], 'owner' => $t['display_name'], 'is_bidder' => (bool)$t['is_bidder'],
                  'purse' => (int)$t['purse'], 'spent' => (int)$t['spent'], 'start' => (int)$s['purse'], 'used_pct' => $s['purse'] ? round((int)$t['spent'] * 100 / (int)$s['purse']) : 0,
                  'players' => count($mine), 'overseas' => count(array_filter($mine, fn($x) => (int)$x['overseas'])), 'roles' => $roles, 'balance' => $balance, 'bonus' => (int)$t['bonus'], 'score' => $score,
                  'xi' => $t['xi'] ? json_decode($t['xi'], true) : [], 'squad' => array_map(fn($x) => auc_player_out($x) + ['price' => (int)$x['price']], $mine),
                  'top' => $mine ? ['name' => $mine[0]['name'], 'price' => (int)$mine[0]['price']] : null];
    }
    usort($out, fn($a, $b) => $b['score'] <=> $a['score']);
    $bids = rows('SELECT b.amount, b.created_at, p.team_name team, x.name player, x.lot_no FROM auc_bids b JOIN auc_participants p ON p.id=b.participant_id JOIN auc_players x ON x.id=b.lot_id WHERE b.room_id=? ORDER BY b.id', [$r['id']]);
    $events = rows("SELECT kind, data, created_at FROM auc_events WHERE room_id=? AND kind IN ('admin_change','player_withdrawn','player_reopened','auction_completed','auction_started','settings_changed') ORDER BY id", [$r['id']]);
    foreach ($events as &$e) $e['data'] = $e['data'] ? json_decode($e['data'], true) : null; unset($e);
    $bidders = array_values(array_filter($out, fn($t) => $t['is_bidder']));
    $most = $bidders ? array_reduce($bidders, fn($c, $t) => $c === null || $t['players'] > $c['players'] ? $t : $c) : null;
    $rich = $bidders ? array_reduce($bidders, fn($c, $t) => $c === null || $t['purse'] > $c['purse'] ? $t : $c) : null;
    return ['room' => ['id' => (int)$r['id'], 'code' => $r['code'], 'name' => $r['name'], 'status' => $r['status'], 'settings' => $s, 'started_at' => $r['started_at'], 'ended_at' => $r['ended_at'], 'is_host' => (int)$r['host_id'] === (int)$u['id'] || !empty($u['is_admin'])],
            'teams' => $out, 'sold' => array_map(fn($x) => auc_player_out($x) + ['price' => (int)$x['price'], 'team' => $x['team_name'], 'tcolor' => $x['tcolor'], 'lot_no' => (int)$x['lot_no']], $sold),
            'unsold' => array_map('auc_player_out', $unsold), 'bids' => $bids, 'audit' => $events,
            'highlights' => ['top' => $sold ? ['name' => $sold[0]['name'], 'price' => (int)$sold[0]['price'], 'team' => $sold[0]['team_name']] : null,
                             'most' => $most ? ['team' => $most['name'], 'n' => $most['players']] : null, 'rich' => $rich ? ['team' => $rich['name'], 'purse' => $rich['purse']] : null,
                             'bids' => count($bids), 'sold' => count($sold), 'unsold' => count($unsold)]];
}
function auc_csv(int $roomId, array $u): string {
    $res = auc_results($roomId, $u);
    $lines = [['Lot', 'Player', 'Role', 'Country', 'Franchise', 'Overseas', 'Base price', 'Sold to', 'Price']];
    foreach ($res['sold'] as $x) $lines[] = [$x['lot_no'], $x['name'], $x['role'], $x['country'], $x['franchise'], $x['overseas'] ? 'Yes' : 'No', $x['base_price'], $x['team'], $x['price']];
    foreach ($res['unsold'] as $x) $lines[] = ['', $x['name'], $x['role'], $x['country'], $x['franchise'], $x['overseas'] ? 'Yes' : 'No', $x['base_price'], 'UNSOLD', ''];
    $lines[] = []; $lines[] = ['Team', 'Owner', 'Players', 'Spent', 'Remaining', 'Overseas', 'Batters', 'Wicket-keepers', 'All-rounders', 'Bowlers', 'Bonus', 'Score'];
    foreach ($res['teams'] as $t) $lines[] = [$t['name'], $t['owner'], $t['players'], $t['spent'], $t['purse'], $t['overseas'], $t['roles']['Batter'], $t['roles']['Wicket-keeper'], $t['roles']['All-rounder'], $t['roles']['Bowler'], $t['bonus'], $t['score']];
    $lines[] = []; $lines[] = ['Bid history']; $lines[] = ['Time', 'Lot', 'Player', 'Team', 'Amount'];
    foreach ($res['bids'] as $b) $lines[] = [$b['created_at'], $b['lot_no'], $b['player'], $b['team'], $b['amount']];
    $f = fopen('php://memory', 'w+'); foreach ($lines as $l) fputcsv($f, $l); rewind($f); $csv = stream_get_contents($f); fclose($f);
    return $csv;
}
