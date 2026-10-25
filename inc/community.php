<?php
/* Cric-Scorer v1.18 - community: grounds directory (ground owners add their ground) and the "Looking for" board
   (opponent team, players, umpire, scorer, ground). Contact details are shown only when the poster chooses to. */

const LOOKING_KINDS = ['opponent' => 'Opponent team', 'player' => 'Players', 'umpire' => 'Umpire', 'scorer' => 'Scorer', 'ground' => 'Ground', 'team' => 'A team to join'];
const PITCH_TYPES = ['turf', 'matting', 'cement', 'astro', 'box', 'other'];

function schema_v118(): void {
    $t = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';
    db()->exec("CREATE TABLE IF NOT EXISTS grounds (id INT AUTO_INCREMENT PRIMARY KEY, owner_id INT NOT NULL, name VARCHAR(120) NOT NULL, address VARCHAR(250) NULL, city VARCHAR(80) NOT NULL, area VARCHAR(80) NULL,
        map_url VARCHAR(255) NULL, pitch VARCHAR(12) NULL, lights TINYINT(1) NOT NULL DEFAULT 0, size VARCHAR(40) NULL, facilities VARCHAR(300) NULL, price VARCHAR(80) NULL, timings VARCHAR(120) NULL,
        contact_name VARCHAR(80) NULL, contact_mobile VARCHAR(20) NULL, about VARCHAR(600) NULL, is_active TINYINT(1) NOT NULL DEFAULT 1, views INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (owner_id), INDEX (city), FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE) $t");
    db()->exec("CREATE TABLE IF NOT EXISTS lookings (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, kind VARCHAR(12) NOT NULL, title VARCHAR(120) NOT NULL, details VARCHAR(600) NULL,
        city VARCHAR(80) NOT NULL, area VARCHAR(80) NULL, play_date DATE NULL, overs TINYINT NULL, ball_type VARCHAR(12) NULL, team_id INT NULL, ground_id INT NULL,
        contact VARCHAR(80) NULL, status ENUM('open','closed') NOT NULL DEFAULT 'open', replies INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX (status, city), INDEX (user_id), INDEX (kind), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) $t");
    db()->exec("CREATE TABLE IF NOT EXISTS looking_replies (id INT AUTO_INCREMENT PRIMARY KEY, looking_id INT NOT NULL, user_id INT NOT NULL, message VARCHAR(400) NOT NULL, contact VARCHAR(80) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX (looking_id), FOREIGN KEY (looking_id) REFERENCES lookings(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE) $t");
    if (!val("SHOW COLUMNS FROM matches LIKE 'ground_id'")) db()->exec("ALTER TABLE matches ADD COLUMN ground_id INT NULL AFTER venue, ADD INDEX idx_ground (ground_id)");
}

function ground_row(array $g, ?array $u): array {
    $mine = $u && ((int)$g['owner_id'] === (int)$u['id'] || !empty($u['is_admin']));
    return ['id' => (int)$g['id'], 'name' => $g['name'], 'address' => $g['address'], 'city' => $g['city'], 'area' => $g['area'], 'map_url' => $g['map_url'], 'pitch' => $g['pitch'],
            'lights' => (bool)$g['lights'], 'size' => $g['size'], 'facilities' => $g['facilities'], 'price' => $g['price'], 'timings' => $g['timings'], 'contact_name' => $g['contact_name'],
            'contact_mobile' => $g['contact_mobile'] ? pretty_mobile($g['contact_mobile']) : null, 'wa' => $g['contact_mobile'] ?: null, 'about' => $g['about'], 'is_active' => (bool)$g['is_active'],
            'views' => (int)$g['views'], 'mine' => $mine, 'owner' => $g['owner_name'] ?? null, 'matches' => (int)($g['matches'] ?? 0), 'created_at' => $g['created_at']];
}

function community_action(string $action, array $in, ?array $u): array {
    switch ($action) {
        /* ---------- grounds ---------- */
        case 'grounds_list': {
            $q = trim((string)($in['q'] ?? '')); $city = trim((string)($in['city'] ?? ''));
            $w = ['g.is_active=1']; $p = [];
            if (!empty($in['mine']) && $u) { $w = ['g.owner_id=?']; $p[] = $u['id']; }
            if ($city !== '') { $w[] = 'g.city LIKE ?'; $p[] = "%$city%"; }
            if ($q !== '') { $w[] = '(g.name LIKE ? OR g.area LIKE ? OR g.address LIKE ? OR g.city LIKE ?)'; array_push($p, "%$q%", "%$q%", "%$q%", "%$q%"); }
            $rows = rows('SELECT g.*, u.display_name owner_name, (SELECT COUNT(*) FROM matches m WHERE m.ground_id=g.id) matches FROM grounds g JOIN users u ON u.id=g.owner_id WHERE ' . implode(' AND ', $w) . ' ORDER BY g.city, g.name LIMIT 100', $p);
            $cities = array_column(rows('SELECT city, COUNT(*) n FROM grounds WHERE is_active=1 GROUP BY city ORDER BY n DESC, city LIMIT 30'), 'city');
            return ['grounds' => array_map(fn($g) => ground_row($g, $u), $rows), 'cities' => $cities];
        }
        case 'ground_get': {
            $g = row('SELECT g.*, u.display_name owner_name, (SELECT COUNT(*) FROM matches m WHERE m.ground_id=g.id) matches FROM grounds g JOIN users u ON u.id=g.owner_id WHERE g.id=?', [int_in($in, 'id')]);
            if (!$g || (!$g['is_active'] && !($u && ((int)$g['owner_id'] === (int)$u['id'] || !empty($u['is_admin']))))) fail('Ground not found', 404);
            if (!$u || (int)$g['owner_id'] !== (int)$u['id']) { q('UPDATE grounds SET views=views+1 WHERE id=?', [$g['id']]); $g['views']++; }
            [$vs, $vp] = vis_sql($u);
            $recent = match_summaries(rows("SELECT * FROM matches WHERE ground_id=? AND $vs ORDER BY COALESCE(match_date, created_at) DESC LIMIT 6", array_merge([$g['id']], $vp)));
            $open = rows("SELECT l.id, l.title, l.play_date FROM lookings l WHERE l.ground_id=? AND l.status='open' ORDER BY l.id DESC LIMIT 5", [$g['id']]);
            return ['ground' => ground_row($g, $u), 'recent' => $recent, 'lookings' => $open];
        }
        case 'ground_save': {
            if (!$u) fail('Sign in first', 401);
            $id = nint($in['id'] ?? null);
            if ($id) { $g = row('SELECT * FROM grounds WHERE id=?', [$id]); if (!$g || ((int)$g['owner_id'] !== (int)$u['id'] && empty($u['is_admin']))) fail('Not your ground', 403); }
            elseif ((int)val('SELECT COUNT(*) FROM grounds WHERE owner_id=?', [$u['id']]) >= 10) fail('You can list up to 10 grounds');
            $name = str_in($in, 'name', 120); $city = str_in($in, 'city', 80);
            if (mb_strlen($name) < 3) fail('Give the ground a name');
            if ($city === '') fail('Which city is it in?');
            $map = str_in($in, 'map_url', 255);
            if ($map !== '' && !preg_match('~^https?://~i', $map)) fail('The map link must start with http:// or https://');
            $pitch = in_array($in['pitch'] ?? '', PITCH_TYPES, true) ? $in['pitch'] : null;
            $mob = trim((string)($in['contact_mobile'] ?? ''));
            if ($mob !== '') { $mob = normalize_mobile($mob); if ($mob === null) fail('Enter a valid mobile number for bookings (or leave it blank)'); } else $mob = null;
            $vals = [$name, str_in($in, 'address', 250) ?: null, $city, str_in($in, 'area', 80) ?: null, $map ?: null, $pitch, !empty($in['lights']) ? 1 : 0, str_in($in, 'size', 40) ?: null,
                     str_in($in, 'facilities', 300) ?: null, str_in($in, 'price', 80) ?: null, str_in($in, 'timings', 120) ?: null, str_in($in, 'contact_name', 80) ?: null, $mob, str_in($in, 'about', 600) ?: null, isset($in['is_active']) ? (empty($in['is_active']) ? 0 : 1) : 1];
            if ($id) q('UPDATE grounds SET name=?, address=?, city=?, area=?, map_url=?, pitch=?, lights=?, size=?, facilities=?, price=?, timings=?, contact_name=?, contact_mobile=?, about=?, is_active=? WHERE id=?', array_merge($vals, [$id]));
            else { q('INSERT INTO grounds (name, address, city, area, map_url, pitch, lights, size, facilities, price, timings, contact_name, contact_mobile, about, is_active, owner_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', array_merge($vals, [$u['id']])); $id = lastId(); }
            return ['id' => $id];
        }
        case 'ground_delete': {
            if (!$u) fail('Sign in first', 401);
            $g = row('SELECT * FROM grounds WHERE id=?', [int_in($in, 'id')]);
            if (!$g || ((int)$g['owner_id'] !== (int)$u['id'] && empty($u['is_admin']))) fail('Not your ground', 403);
            q('UPDATE matches SET ground_id=NULL WHERE ground_id=?', [$g['id']]);
            q('UPDATE lookings SET ground_id=NULL WHERE ground_id=?', [$g['id']]);
            q('DELETE FROM grounds WHERE id=?', [$g['id']]);
            return ['ok' => true];
        }

        /* ---------- looking for ---------- */
        case 'looking_list': {
            $kind = (string)($in['kind'] ?? ''); $city = trim((string)($in['city'] ?? '')); $q = trim((string)($in['q'] ?? ''));
            $w = ["l.status='open'"]; $p = [];
            if (!empty($in['mine']) && $u) { $w = ['l.user_id=?']; $p[] = $u['id']; }
            if (isset(LOOKING_KINDS[$kind])) { $w[] = 'l.kind=?'; $p[] = $kind; }
            if ($city !== '') { $w[] = 'l.city LIKE ?'; $p[] = "%$city%"; }
            if ($q !== '') { $w[] = '(l.title LIKE ? OR l.details LIKE ? OR l.area LIKE ?)'; array_push($p, "%$q%", "%$q%", "%$q%"); }
            $rows = rows('SELECT l.*, u.display_name, u.username, u.is_private, t.name team_name, t.short_name team_short, t.color team_color, g.name ground_name
                          FROM lookings l JOIN users u ON u.id=l.user_id LEFT JOIN teams t ON t.id=l.team_id LEFT JOIN grounds g ON g.id=l.ground_id WHERE ' . implode(' AND ', $w) . ' ORDER BY l.id DESC LIMIT 100', $p);
            $cities = array_column(rows("SELECT city, COUNT(*) n FROM lookings WHERE status='open' GROUP BY city ORDER BY n DESC, city LIMIT 30"), 'city');
            return ['posts' => array_map(fn($l) => looking_row($l, $u, false), $rows), 'cities' => $cities, 'kinds' => LOOKING_KINDS];
        }
        case 'looking_get': {
            $l = row('SELECT l.*, u.display_name, u.username, u.is_private, t.name team_name, t.short_name team_short, t.color team_color, g.name ground_name FROM lookings l JOIN users u ON u.id=l.user_id LEFT JOIN teams t ON t.id=l.team_id LEFT JOIN grounds g ON g.id=l.ground_id WHERE l.id=?', [int_in($in, 'id')]);
            if (!$l) fail('Post not found', 404);
            $mine = $u && ((int)$l['user_id'] === (int)$u['id'] || !empty($u['is_admin']));
            $replies = $mine ? rows('SELECT r.*, u.display_name, u.username FROM looking_replies r JOIN users u ON u.id=r.user_id WHERE r.looking_id=? ORDER BY r.id', [$l['id']])
                             : ($u ? rows('SELECT r.*, u.display_name, u.username FROM looking_replies r JOIN users u ON u.id=r.user_id WHERE r.looking_id=? AND r.user_id=? ORDER BY r.id', [$l['id'], $u['id']]) : []);
            return ['post' => looking_row($l, $u, true), 'replies' => array_map(fn($r) => ['id' => (int)$r['id'], 'user_id' => (int)$r['user_id'], 'name' => $r['display_name'], 'username' => $r['username'], 'message' => $r['message'], 'contact' => $r['contact'], 'at' => $r['created_at'], 'mine' => $u && (int)$r['user_id'] === (int)$u['id']], $replies)];
        }
        case 'looking_save': {
            if (!$u) fail('Sign in first', 401);
            $id = nint($in['id'] ?? null);
            if ($id) { $l = row('SELECT * FROM lookings WHERE id=?', [$id]); if (!$l || ((int)$l['user_id'] !== (int)$u['id'] && empty($u['is_admin']))) fail('Not your post', 403); }
            elseif ((int)val("SELECT COUNT(*) FROM lookings WHERE user_id=? AND status='open'", [$u['id']]) >= 10) fail('You already have 10 open posts - close some first');
            $kind = (string)($in['kind'] ?? ''); if (!isset(LOOKING_KINDS[$kind])) fail('Pick what you are looking for');
            $title = str_in($in, 'title', 120); $city = str_in($in, 'city', 80);
            if (mb_strlen($title) < 4) fail('Write a short title');
            if ($city === '') fail('Which city?');
            $date = str_in($in, 'play_date', 20); $date = $date ? date('Y-m-d', strtotime($date)) : null;
            $team = nint($in['team_id'] ?? null);
            if ($team && !can_use_team($team, $u)) fail('You can only post for a team you can use');
            $ground = nint($in['ground_id'] ?? null);
            if ($ground && !val('SELECT 1 FROM grounds WHERE id=? AND is_active=1', [$ground])) $ground = null;
            $overs = nint($in['overs'] ?? null); if ($overs !== null) $overs = max(1, min(100, $overs));
            $bt = in_array($in['ball_type'] ?? '', BALL_TYPES, true) ? $in['ball_type'] : null;
            $vals = [$kind, $title, str_in($in, 'details', 600) ?: null, $city, str_in($in, 'area', 80) ?: null, $date, $overs, $bt, $team, $ground, str_in($in, 'contact', 80) ?: null];
            if ($id) q('UPDATE lookings SET kind=?, title=?, details=?, city=?, area=?, play_date=?, overs=?, ball_type=?, team_id=?, ground_id=?, contact=? WHERE id=?', array_merge($vals, [$id]));
            else { q('INSERT INTO lookings (kind, title, details, city, area, play_date, overs, ball_type, team_id, ground_id, contact, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', array_merge($vals, [$u['id']])); $id = lastId(); }
            return ['id' => $id];
        }
        case 'looking_close': case 'looking_reopen': case 'looking_delete': {
            if (!$u) fail('Sign in first', 401);
            $l = row('SELECT * FROM lookings WHERE id=?', [int_in($in, 'id')]);
            if (!$l || ((int)$l['user_id'] !== (int)$u['id'] && empty($u['is_admin']))) fail('Not your post', 403);
            if ($action === 'looking_delete') q('DELETE FROM lookings WHERE id=?', [$l['id']]);
            else q('UPDATE lookings SET status=? WHERE id=?', [$action === 'looking_close' ? 'closed' : 'open', $l['id']]);
            return ['ok' => true];
        }
        case 'looking_reply': {
            if (!$u) fail('Sign in first', 401);
            $l = row('SELECT * FROM lookings WHERE id=?', [int_in($in, 'id')]);
            if (!$l || $l['status'] !== 'open') fail('This post is closed');
            if ((int)$l['user_id'] === (int)$u['id']) fail("That's your own post");
            $msg = str_in($in, 'message', 400); if (mb_strlen($msg) < 2) fail('Write a message');
            if (val('SELECT 1 FROM looking_replies WHERE looking_id=? AND user_id=?', [$l['id'], $u['id']])) q('UPDATE looking_replies SET message=?, contact=? WHERE looking_id=? AND user_id=?', [$msg, str_in($in, 'contact', 80) ?: null, $l['id'], $u['id']]);
            else { q('INSERT INTO looking_replies (looking_id, user_id, message, contact) VALUES (?,?,?,?)', [$l['id'], $u['id'], $msg, str_in($in, 'contact', 80) ?: null]); q('UPDATE lookings SET replies=replies+1 WHERE id=?', [$l['id']]); }
            return ['ok' => true];
        }
    }
    fail('Unknown action', 404);
}

function looking_row(array $l, ?array $u, bool $full): array {
    $mine = $u && ((int)$l['user_id'] === (int)$u['id'] || !empty($u['is_admin']));
    return ['id' => (int)$l['id'], 'kind' => $l['kind'], 'kind_label' => LOOKING_KINDS[$l['kind']] ?? $l['kind'], 'title' => $l['title'], 'details' => $l['details'], 'city' => $l['city'], 'area' => $l['area'],
            'play_date' => $l['play_date'], 'overs' => $l['overs'] !== null ? (int)$l['overs'] : null, 'ball_type' => $l['ball_type'], 'status' => $l['status'], 'replies' => (int)$l['replies'],
            'team' => $l['team_id'] ? ['id' => (int)$l['team_id'], 'name' => $l['team_name'], 'short_name' => $l['team_short'], 'color' => $l['team_color']] : null,
            'ground' => $l['ground_id'] ? ['id' => (int)$l['ground_id'], 'name' => $l['ground_name']] : null,
            'by' => $l['is_private'] && !$mine ? null : ['id' => (int)$l['user_id'], 'name' => $l['display_name'], 'username' => $l['username']],
            'contact' => $full ? $l['contact'] : null, 'mine' => $mine, 'created_at' => $l['created_at']];
}

/** Open "looking for" posts and grounds in the user's city for the Home screen */
function community_home(?array $u): array {
    $n = (int)val("SELECT COUNT(*) FROM lookings WHERE status='open'");
    $g = (int)val('SELECT COUNT(*) FROM grounds WHERE is_active=1');
    return ['open_posts' => $n, 'grounds' => $g];
}
