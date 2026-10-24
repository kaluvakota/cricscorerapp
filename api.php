<?php
/* Cric-Scorer by Aaryush — JSON API */
require_once __DIR__ . '/inc/core.php';
require_once __DIR__ . '/inc/engine.php';
require_once __DIR__ . '/inc/academy.php';

$action = preg_replace('/[^a-z_]/', '', $_GET['action'] ?? '');
$in = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' || ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'CricScorer') fail('Bad request', 400);
    $public = ['login', 'register', 'me', 'match_get', 'google_login'];
    ensure_schema();
    $u = current_user();
    if (!in_array($action, $public, true) && !$u) fail('Please log in', 401);
    out(handle($action, $in, $u));
} catch (ApiError $e) {
    rollback_if_needed();
    http_response_code($e->status);
    out(['error' => $e->getMessage()]);
} catch (Throwable $e) {
    rollback_if_needed();
    http_response_code(500);
    out(['error' => DEBUG ? $e->getMessage() : 'Something went wrong. Please try again.']);
}

function handle(string $action, array $in, ?array $u) {
    switch ($action) {

    /* ===== Auth ===== */
    case 'me':
        return ['user' => $u ? public_user($u) : null, 'version' => APP_VERSION, 'auth' => auth_public_config()];

    case 'register': {
        $un = strtolower(str_in($in, 'username', 50));
        $pw = (string)($in['password'] ?? '');
        $dn = str_in($in, 'display_name', 100) ?: $un;
        if (!preg_match('/^[a-z0-9_.]{3,30}$/', $un)) fail('Username: 3–30 letters, numbers, dot or underscore');
        if (strlen($pw) < 6) fail('Password must be at least 6 characters');
        if (val('SELECT 1 FROM users WHERE username=?', [$un])) fail('That username is taken');
        recaptcha_check($in, 'register');
        $first = !val('SELECT 1 FROM users LIMIT 1');
        q('INSERT INTO users (username, password_hash, display_name, is_admin) VALUES (?,?,?,?)', [$un, password_hash($pw, PASSWORD_DEFAULT), $dn, $first ? 1 : 0]);
        $nu = row('SELECT * FROM users WHERE id=?', [lastId()]);
        login_user($nu, true);
        return ['user' => public_user($nu)];
    }

    case 'login': {
        recaptcha_check($in, 'login');
        $un = strtolower(str_in($in, 'username', 50));
        $nu = row('SELECT * FROM users WHERE username=?', [$un]);
        if ($nu && (string)$nu['password_hash'] === '' && !empty($nu['google_sub'])) fail('This player signs in with Google — tap "Sign in with Google"');
        if (!$nu || !password_verify((string)($in['password'] ?? ''), $nu['password_hash'])) { usleep(600000); fail('Wrong username or password'); }
        login_user($nu, !isset($in['remember']) || $in['remember']);
        return ['user' => public_user($nu)];
    }

    case 'google_login':
        return google_login($in);
    case 'google_link':
        return google_link($u, $in);
    case 'google_unlink':
        return google_unlink($u);

    case 'logout':
        clear_remember_token();
        $_SESSION = [];
        session_destroy();
        return ['ok' => true];

    case 'profile_save': {
        $dn = str_in($in, 'display_name', 100);
        if ($dn === '') fail('Enter a name');
        q('UPDATE users SET display_name=? WHERE id=?', [$dn, $u['id']]);
        if (isset($in['is_private'])) q('UPDATE users SET is_private=? WHERE id=?', [!empty($in['is_private']) ? 1 : 0, $u['id']]);
        if (!empty($in['new_password'])) {
            if ((string)$u['password_hash'] !== '' && !password_verify((string)($in['current_password'] ?? ''), $u['password_hash'])) fail('Current password is wrong');
            if (strlen($in['new_password']) < 6) fail('New password must be at least 6 characters');
            q('UPDATE users SET password_hash=? WHERE id=?', [password_hash($in['new_password'], PASSWORD_DEFAULT), $u['id']]);
        }
        return ['user' => public_user(row('SELECT * FROM users WHERE id=?', [$u['id']]))];
    }

    /* ===== Players: search, follow, privacy ===== */
    case 'users_search':   return users_search($u, $in);
    case 'user_get':       return user_profile($u, $in);
    case 'follow_list':    return follow_list($u, $in);
    case 'follow':         return follow_user($u, $in, true);
    case 'unfollow':       return follow_user($u, $in, false);
    case 'remove_follower': return remove_follower($u, $in);
    case 'match_visibility': {
        $m = load_match(int_in($in, 'id'));
        if (!can_edit_owned($m, $u)) fail('Only the scorer of this match can change who sees it', 403);
        $v = ($in['visibility'] ?? '') === 'private' ? 'private' : 'public';
        q('UPDATE matches SET visibility=? WHERE id=?', [$v, $m['id']]);
        return match_state((int)$m['id'], $u);
    }

    /* ===== Home ===== */
    case 'home': {
        [$vs, $vp] = vis_sql($u);
        $live = match_summaries(rows("SELECT * FROM matches WHERE status='live' AND $vs ORDER BY updated_at DESC LIMIT 10", $vp));
        $mine = match_summaries(rows("SELECT * FROM matches WHERE owner_id=? AND status='scheduled' ORDER BY COALESCE(match_date, created_at) ASC LIMIT 5", [$u['id']]));
        $recent = match_summaries(rows("SELECT * FROM matches WHERE status IN ('completed','abandoned') AND $vs ORDER BY updated_at DESC LIMIT 6", $vp));
        $followFeed = match_summaries(rows("SELECT m.* FROM matches m JOIN follows f ON f.followee_id=m.owner_id AND f.follower_id=? JOIN users o ON o.id=m.owner_id
                                            WHERE m.visibility='public' AND o.is_private=0 AND m.status IN ('live','completed') ORDER BY m.updated_at DESC LIMIT 5", [$u['id']]));
        $counts = [
            'matches' => (int)val("SELECT COUNT(*) FROM matches WHERE owner_id=?", [$u['id']]),
            'teams' => (int)val("SELECT COUNT(*) FROM teams WHERE owner_id=?", [$u['id']]),
            'tournaments' => (int)val("SELECT COUNT(*) FROM tournaments WHERE owner_id=?", [$u['id']]),
        ];
        $counts += follow_counts((int)$u['id'], $u);
        return ['live' => $live, 'upcoming' => $mine, 'recent' => $recent, 'following' => $followFeed, 'counts' => $counts];
    }

    /* ===== Teams & players ===== */
    case 'teams_list': {
        $cat = $in['category'] ?? '';
        $sql = 'SELECT t.*, u.display_name owner_name, (SELECT COUNT(*) FROM players p WHERE p.team_id=t.id) players FROM teams t LEFT JOIN users u ON u.id=t.owner_id';
        $p = [];
        if (in_array($cat, ['ipl', 'international', 'custom'], true)) { $sql .= ' WHERE t.category=?'; $p[] = $cat; }
        $sql .= " ORDER BY FIELD(t.category,'custom','ipl','international'), t.name";
        $list = rows($sql, $p);
        foreach ($list as &$t) { $t['id'] = (int)$t['id']; $t['mine'] = (int)$t['owner_id'] === (int)$u['id']; $t['can_edit'] = can_edit_team($t, $u); }
        return ['teams' => $list];
    }

    case 'team_get': {
        $t = row('SELECT t.*, u.display_name owner_name FROM teams t LEFT JOIN users u ON u.id=t.owner_id WHERE t.id=?', [int_in($in, 'id')]);
        if (!$t) fail('Team not found', 404);
        $t['id'] = (int)$t['id'];
        $t['can_edit'] = can_edit_team($t, $u);
        $players = rows("SELECT * FROM players WHERE team_id=? ORDER BY FIELD(role,'Batter','Wicket-keeper','All-rounder','Bowler'), name", [$t['id']]);
        [$vs, $vp] = vis_sql($u);
        $recent = match_summaries(rows("SELECT * FROM matches WHERE (team1_id=? OR team2_id=?) AND status IN ('live','completed') AND $vs ORDER BY updated_at DESC LIMIT 5", array_merge([$t['id'], $t['id']], $vp)));
        return ['team' => $t, 'players' => $players, 'recent' => $recent];
    }

    case 'team_save': {
        $id = int_in($in, 'id');
        $name = str_in($in, 'name', 100);
        if ($name === '') fail('Enter a team name');
        $short = strtoupper(str_in($in, 'short_name', 10)) ?: strtoupper(mb_substr(preg_replace('/[^A-Za-z]/', '', $name), 0, 3));
        $color = valid_color(str_in($in, 'color', 10));
        $cap = str_in($in, 'captain', 100) ?: null;
        $ground = str_in($in, 'home_ground', 150) ?: null;
        if ($id) {
            $t = row('SELECT * FROM teams WHERE id=?', [$id]);
            if (!can_edit_team($t, $u)) fail('You cannot edit this team', 403);
            q('UPDATE teams SET name=?, short_name=?, color=?, captain=?, home_ground=? WHERE id=?', [$name, $short, $color, $cap, $ground, $id]);
        } else {
            $cat = ($u['is_admin'] && in_array($in['category'] ?? '', ['ipl', 'international'], true)) ? $in['category'] : 'custom';
            q('INSERT INTO teams (name, short_name, color, category, owner_id, captain, home_ground) VALUES (?,?,?,?,?,?,?)', [$name, $short, $color, $cat, $cat === 'custom' ? $u['id'] : null, $cap, $ground]);
            $id = lastId();
        }
        return ['id' => $id];
    }

    case 'team_delete': {
        $t = row('SELECT * FROM teams WHERE id=?', [int_in($in, 'id')]);
        if (!can_edit_team($t, $u)) fail('You cannot delete this team', 403);
        if (val('SELECT 1 FROM matches WHERE team1_id=? OR team2_id=? LIMIT 1', [$t['id'], $t['id']])) fail('This team has played matches and cannot be deleted');
        q('DELETE FROM teams WHERE id=?', [$t['id']]);
        return ['ok' => true];
    }

    case 'player_save': {
        $id = int_in($in, 'id');
        $teamId = int_in($in, 'team_id');
        if ($id) { $teamId = (int)val('SELECT team_id FROM players WHERE id=?', [$id]); }
        $t = row('SELECT * FROM teams WHERE id=?', [$teamId]);
        if (!can_edit_team($t, $u)) fail('You cannot edit players of this team', 403);
        $name = str_in($in, 'name', 100);
        if ($name === '') fail('Enter the player name');
        $role = in_array($in['role'] ?? '', ['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper'], true) ? $in['role'] : 'Batter';
        $vals = [$name, $role, str_in($in, 'batting_style', 30) ?: 'Right-hand bat', str_in($in, 'bowling_style', 40) ?: null,
                 str_in($in, 'country', 50) ?: null, str_in($in, 'jersey_no', 5) ?: null, !empty($in['is_overseas']) ? 1 : 0];
        if ($id) {
            q('UPDATE players SET name=?, role=?, batting_style=?, bowling_style=?, country=?, jersey_no=?, is_overseas=? WHERE id=?', array_merge($vals, [$id]));
        } else {
            q('INSERT INTO players (name, role, batting_style, bowling_style, country, jersey_no, is_overseas, team_id) VALUES (?,?,?,?,?,?,?,?)', array_merge($vals, [$teamId]));
            $id = lastId();
        }
        return ['id' => $id];
    }

    case 'player_delete': {
        $p = row('SELECT * FROM players WHERE id=?', [int_in($in, 'id')]);
        if (!$p) fail('Player not found', 404);
        if (!can_edit_team(row('SELECT * FROM teams WHERE id=?', [$p['team_id']]), $u)) fail('Not allowed', 403);
        if (val('SELECT 1 FROM match_players WHERE player_id=? LIMIT 1', [$p['id']])) fail('This player has played matches and cannot be deleted');
        q('DELETE FROM players WHERE id=?', [$p['id']]);
        return ['ok' => true];
    }

    case 'players_search': {
        $qs = '%' . str_in($in, 'q', 60) . '%';
        $exclude = int_in($in, 'exclude_team');
        return ['players' => rows("SELECT p.id, p.name, p.role, p.country, t.short_name team, t.color FROM players p JOIN teams t ON t.id=p.team_id
                                   WHERE p.name LIKE ? AND p.team_id<>? ORDER BY t.category='custom', p.name LIMIT 60", [$qs, $exclude])];
    }

    case 'player_copy': {
        $t = row('SELECT * FROM teams WHERE id=?', [int_in($in, 'team_id')]);
        if (!can_edit_team($t, $u)) fail('You cannot edit this team', 403);
        $n = 0;
        foreach ((array)($in['player_ids'] ?? []) as $pid) {
            $p = row('SELECT * FROM players WHERE id=?', [(int)$pid]);
            if (!$p) continue;
            if (val('SELECT 1 FROM players WHERE team_id=? AND name=?', [$t['id'], $p['name']])) continue;
            q('INSERT INTO players (team_id, name, role, batting_style, bowling_style, country, jersey_no, is_overseas) VALUES (?,?,?,?,?,?,?,?)',
              [$t['id'], $p['name'], $p['role'], $p['batting_style'], $p['bowling_style'], $p['country'], $p['jersey_no'], 0]);
            $n++;
        }
        return ['added' => $n];
    }

    case 'player_get': {
        $p = row('SELECT p.*, t.name team_name, t.short_name, t.color, t.category FROM players p JOIN teams t ON t.id=p.team_id WHERE p.id=?', [int_in($in, 'id')]);
        if (!$p) fail('Player not found', 404);
        $p['can_edit'] = can_edit_team(['category' => $p['category'], 'owner_id' => val('SELECT owner_id FROM teams WHERE id=?', [$p['team_id']])], $u);
        $recent = rows("SELECT m.id match_id, m.title, i.innings_no, i.id innings_id,
                          (SELECT COALESCE(SUM(runs_bat),0) FROM balls WHERE innings_id=i.id AND batsman_id=?) runs,
                          (SELECT COUNT(*) FROM balls WHERE innings_id=i.id AND batsman_id=? AND (extra_type IS NULL OR extra_type<>'wd')) balls,
                          (SELECT COUNT(*) FROM balls WHERE innings_id=i.id AND dismissed_id=? AND is_wicket=1) out_,
                          t1.short_name t1, t2.short_name t2, m.match_date
                        FROM innings_batters ib JOIN innings i ON i.id=ib.innings_id JOIN matches m ON m.id=i.match_id
                        JOIN teams t1 ON t1.id=m.team1_id JOIN teams t2 ON t2.id=m.team2_id
                        WHERE ib.player_id=? AND " . vis_sql($u, 'm')[0] . " ORDER BY m.id DESC LIMIT 8", array_merge([$p['id'], $p['id'], $p['id'], $p['id']], vis_sql($u, 'm')[1]));
        return ['player' => $p, 'stats' => player_stats((int)$p['id'], $u), 'recent' => $recent];
    }

    /* ===== Match types ===== */
    case 'types_list':
        return ['types' => rows('SELECT * FROM match_types WHERE is_system=1 OR owner_id=? ORDER BY is_system DESC, id', [$u['id']])];

    case 'type_save': {
        $id = int_in($in, 'id');
        $name = str_in($in, 'name', 60);
        if ($name === '') fail('Enter a name');
        $vals = [$name, max(1, min(100, int_in($in, 'overs', 20))), max(1, min(10, int_in($in, 'balls_per_over', 6))),
                 max(1, min(15, int_in($in, 'players_per_side', 11))), max(0, min(50, int_in($in, 'max_overs_bowler', 0))),
                 !empty($in['last_man_stands']) ? 1 : 0, str_in($in, 'description', 255) ?: null];
        if ($id) {
            $t = row('SELECT * FROM match_types WHERE id=?', [$id]);
            if (!$t || ($t['is_system'] && !$u['is_admin']) || (!$t['is_system'] && !can_edit_owned($t, $u))) fail('You cannot edit this match type', 403);
            q('UPDATE match_types SET name=?, overs=?, balls_per_over=?, players_per_side=?, max_overs_bowler=?, last_man_stands=?, description=? WHERE id=?', array_merge($vals, [$id]));
        } else {
            q('INSERT INTO match_types (name, overs, balls_per_over, players_per_side, max_overs_bowler, last_man_stands, description, owner_id) VALUES (?,?,?,?,?,?,?,?)', array_merge($vals, [$u['id']]));
            $id = lastId();
        }
        return ['id' => $id];
    }

    case 'type_delete': {
        $t = row('SELECT * FROM match_types WHERE id=?', [int_in($in, 'id')]);
        if (!$t || ($t['is_system'] && !$u['is_admin']) || (!$t['is_system'] && !can_edit_owned($t, $u))) fail('You cannot delete this match type', 403);
        q('DELETE FROM match_types WHERE id=?', [$t['id']]);
        return ['ok' => true];
    }

    /* ===== Matches ===== */
    case 'matches_list': {
        $st = $in['status'] ?? '';
        $where = []; $p = [];
        if (in_array($st, ['scheduled', 'live', 'completed'], true)) { $where[] = $st === 'completed' ? "status IN ('completed','abandoned')" : 'status=?'; if ($st !== 'completed') $p[] = $st; }
        $scope = $in['scope'] ?? (!empty($in['mine']) ? 'mine' : 'all');
        if ($scope === 'mine') { $where[] = 'owner_id=?'; $p[] = $u['id']; }
        elseif ($scope === 'following') { $where[] = "owner_id IN (SELECT f.followee_id FROM follows f JOIN users o ON o.id=f.followee_id WHERE f.follower_id=? AND o.is_private=0)"; $p[] = $u['id']; }
        [$vs, $vp] = vis_sql($u); $where[] = $vs; $p = array_merge($p, $vp);
        $sql = 'SELECT * FROM matches' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY ' . ($st === 'scheduled' ? 'COALESCE(match_date, created_at) ASC' : 'updated_at DESC') . ' LIMIT 100';
        return ['matches' => match_summaries(rows($sql, $p))];
    }

    case 'match_create': {
        $t1 = int_in($in, 'team1_id'); $t2 = int_in($in, 'team2_id');
        if (!$t1 || !$t2) fail('Choose both teams');
        if ($t1 === $t2) fail('Choose two different teams');
        if (!val('SELECT 1 FROM teams WHERE id=?', [$t1]) || !val('SELECT 1 FROM teams WHERE id=?', [$t2])) fail('Team not found');
        $tour = nint($in['tournament_id'] ?? null);
        if ($tour && !can_edit_owned(row('SELECT * FROM tournaments WHERE id=?', [$tour]), $u)) fail('You cannot add matches to this tournament', 403);
        $date = str_in($in, 'match_date', 20);
        $date = $date ? date('Y-m-d H:i:s', strtotime($date)) : date('Y-m-d H:i:s');
        $visibility = ($in['visibility'] ?? '') === 'private' ? 'private' : 'public';
        q('INSERT INTO matches (owner_id, tournament_id, match_type_id, title, team1_id, team2_id, overs, balls_per_over, players_per_side, max_overs_bowler, last_man_stands, venue, match_date, visibility)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
            $u['id'], $tour, nint($in['match_type_id'] ?? null), str_in($in, 'title', 100) ?: null, $t1, $t2,
            max(1, min(100, int_in($in, 'overs', 20))), max(1, min(10, int_in($in, 'balls_per_over', 6))),
            max(1, min(15, int_in($in, 'players_per_side', 11))), max(0, min(50, int_in($in, 'max_overs_bowler', 0))),
            !empty($in['last_man_stands']) ? 1 : 0, str_in($in, 'venue', 150) ?: null, $date, $visibility]);
        return ['id' => lastId()];
    }

    case 'match_get':
        return match_state(int_in($in, 'id'), $u);

    case 'match_dls_preview': {
        $m = load_match(int_in($in, 'id'));
        if (!can_view_match($m, $u)) fail('This match is private 🔒', 403);
        return dls_preview($m, max(1, int_in($in, 'overs', 1)));
    }

    case 'match_delete': {
        $m = load_match(int_in($in, 'id'));
        if (!can_edit_owned($m, $u)) fail('Not allowed', 403);
        q('DELETE FROM matches WHERE id=?', [$m['id']]);
        return ['ok' => true];
    }

    case 'match_xi': case 'match_toss': case 'match_start_innings': case 'match_ball': case 'match_batter':
    case 'match_bowler': case 'match_swap': case 'match_undo': case 'match_end_innings': case 'match_abandon':
    case 'match_rain': case 'match_rain_end': case 'match_rain_undo': case 'match_dls_level': {
        db()->beginTransaction();
        $m = load_match(int_in($in, 'id'), true);
        if (!can_edit_owned($m, $u)) fail('Only the scorer of this match can do that', 403);
        if (!in_array($action, ['match_undo', 'match_rain_undo'], true) && in_array($m['status'], ['completed', 'abandoned'], true)) fail('This match is finished');
        switch ($action) {
            case 'match_xi': set_playing_xi($m, $in); break;
            case 'match_toss': set_toss($m, $in); break;
            case 'match_start_innings': start_innings($m, $in); break;
            case 'match_ball': score_ball($m, $in); break;
            case 'match_batter': set_batter($m, $in); break;
            case 'match_bowler': set_bowler($m, $in); break;
            case 'match_swap': swap_strike($m); break;
            case 'match_undo': undo_ball($m); break;
            case 'match_end_innings': end_innings_manual($m); break;
            case 'match_rain': rain_reduce($m, $in); break;
            case 'match_rain_end': rain_end_match($m); break;
            case 'match_rain_undo': rain_undo($m); break;
            case 'match_dls_level':
                q('UPDATE matches SET dls_g50=? WHERE id=?', [in_array((int)($in['g50'] ?? 200), [200, 245], true) ? (int)$in['g50'] : 200, $m['id']]);
                dls_update_target($m);
                break;
            case 'match_abandon': q("UPDATE matches SET status='abandoned', result_text='No result (match abandoned)', winner_team_id=NULL WHERE id=?", [$m['id']]); break;
        }
        db()->commit();
        return match_state((int)$m['id'], $u);
    }

    /* ===== Tournaments ===== */
    case 'tournaments_list': {
        $list = rows('SELECT t.*, mt.name type_name, CASE WHEN u.is_private=1 AND u.id<>' . (int)$u['id'] . ' THEN NULL ELSE u.display_name END owner_name,
                        (SELECT COUNT(*) FROM tournament_teams tt WHERE tt.tournament_id=t.id) teams,
                        (SELECT COUNT(*) FROM matches m WHERE m.tournament_id=t.id) matches,
                        (SELECT COUNT(*) FROM matches m WHERE m.tournament_id=t.id AND m.status IN (\'completed\',\'abandoned\')) done,
                        (SELECT COUNT(*) FROM matches m WHERE m.tournament_id=t.id AND m.status=\'live\') live
                      FROM tournaments t LEFT JOIN match_types mt ON mt.id=t.match_type_id LEFT JOIN users u ON u.id=t.owner_id
                      ORDER BY t.created_at DESC');
        foreach ($list as &$t) { $t['mine'] = (int)$t['owner_id'] === (int)$u['id']; $t['state'] = tournament_state($t); }
        return ['tournaments' => $list];
    }

    case 'tournament_get': {
        $t = row('SELECT t.*, mt.name type_name, mt.overs, mt.balls_per_over, mt.players_per_side, mt.max_overs_bowler, mt.last_man_stands, CASE WHEN u.is_private=1 AND u.id<>' . (int)$u['id'] . ' THEN NULL ELSE u.display_name END owner_name
                  FROM tournaments t LEFT JOIN match_types mt ON mt.id=t.match_type_id LEFT JOIN users u ON u.id=t.owner_id WHERE t.id=?', [int_in($in, 'id')]);
        if (!$t) fail('Tournament not found', 404);
        $t['can_edit'] = can_edit_owned($t, $u);
        $teams = rows('SELECT t.id, t.name, t.short_name, t.color, (SELECT COUNT(*) FROM players p WHERE p.team_id=t.id) players FROM tournament_teams tt JOIN teams t ON t.id=tt.team_id WHERE tt.tournament_id=? ORDER BY t.name', [$t['id']]);
        [$vs, $vp] = vis_sql($u);
        $matches = match_summaries(rows("SELECT * FROM matches WHERE tournament_id=? AND $vs ORDER BY COALESCE(match_date, created_at), id", array_merge([$t['id']], $vp)));
        $t['matches'] = count($matches);
        $t['done'] = count(array_filter($matches, fn($m) => in_array($m['status'], ['completed', 'abandoned'], true)));
        $t['live'] = count(array_filter($matches, fn($m) => $m['status'] === 'live'));
        $t['state'] = tournament_state($t);
        return ['tournament' => $t, 'teams' => $teams, 'matches' => $matches, 'points' => points_table((int)$t['id']), 'leaders' => leaderboards((int)$t['id'], 5, $u)];
    }

    case 'tournament_save': {
        $id = int_in($in, 'id');
        $name = str_in($in, 'name', 120);
        if ($name === '') fail('Enter a tournament name');
        $fmt = in_array($in['format'] ?? '', ['league', 'knockout', 'league_final'], true) ? $in['format'] : 'league';
        $teams = array_values(array_unique(array_map('intval', (array)($in['team_ids'] ?? []))));
        if (count($teams) < 2) fail('Pick at least 2 teams');
        $vals = [$name, $fmt, nint($in['match_type_id'] ?? null), str_in($in, 'start_date', 10) ?: null, str_in($in, 'end_date', 10) ?: null, str_in($in, 'venue', 150) ?: null];
        if ($id) {
            $t = row('SELECT * FROM tournaments WHERE id=?', [$id]);
            if (!can_edit_owned($t, $u)) fail('Not allowed', 403);
            q('UPDATE tournaments SET name=?, format=?, match_type_id=?, start_date=?, end_date=?, venue=? WHERE id=?', array_merge($vals, [$id]));
            q('DELETE FROM tournament_teams WHERE tournament_id=?', [$id]);
        } else {
            q('INSERT INTO tournaments (name, format, match_type_id, start_date, end_date, venue, owner_id) VALUES (?,?,?,?,?,?,?)', array_merge($vals, [$u['id']]));
            $id = lastId();
        }
        foreach ($teams as $tid) if (val('SELECT 1 FROM teams WHERE id=?', [$tid])) q('INSERT INTO tournament_teams (tournament_id, team_id) VALUES (?,?)', [$id, $tid]);
        return ['id' => $id];
    }

    case 'tournament_delete': {
        $t = row('SELECT * FROM tournaments WHERE id=?', [int_in($in, 'id')]);
        if (!can_edit_owned($t, $u)) fail('Not allowed', 403);
        if (!empty($in['with_matches'])) q('DELETE FROM matches WHERE tournament_id=?', [$t['id']]);
        q('DELETE FROM tournaments WHERE id=?', [$t['id']]);
        return ['ok' => true];
    }

    case 'tournament_fixtures': {
        $t = row('SELECT t.*, mt.overs, mt.balls_per_over, mt.players_per_side, mt.max_overs_bowler, mt.last_man_stands FROM tournaments t LEFT JOIN match_types mt ON mt.id=t.match_type_id WHERE t.id=?', [int_in($in, 'id')]);
        if (!can_edit_owned($t, $u)) fail('Not allowed', 403);
        if (val('SELECT 1 FROM matches WHERE tournament_id=? LIMIT 1', [$t['id']])) fail('Fixtures already exist for this tournament');
        $teams = array_map('intval', array_column(rows('SELECT team_id FROM tournament_teams WHERE tournament_id=?', [$t['id']]), 'team_id'));
        $pairs = [];
        if ($t['format'] === 'knockout') {
            shuffle($teams);
            for ($i = 0; $i + 1 < count($teams); $i += 2) $pairs[] = [$teams[$i], $teams[$i + 1], 'Round 1 – Match ' . (count($pairs) + 1)];
        } else {
            // Round-robin with the circle method so rounds are balanced
            $list = $teams;
            if (count($list) % 2) $list[] = 0;
            $n = count($list); $num = 0;
            for ($r = 0; $r < $n - 1; $r++) {
                for ($i = 0; $i < $n / 2; $i++) {
                    $a = $list[$i]; $b = $list[$n - 1 - $i];
                    if ($a && $b) $pairs[] = [$a, $b, 'Match ' . (++$num)];
                }
                $list = array_merge([$list[0]], [$list[$n - 1]], array_slice($list, 1, $n - 2));
            }
        }
        $date = $t['start_date'] ? $t['start_date'] . ' 10:00:00' : date('Y-m-d H:i:s');
        foreach ($pairs as [$a, $b, $title]) {
            q('INSERT INTO matches (owner_id, tournament_id, match_type_id, title, team1_id, team2_id, overs, balls_per_over, players_per_side, max_overs_bowler, last_man_stands, venue, match_date)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [$t['owner_id'], $t['id'], $t['match_type_id'], $title, $a, $b,
               $t['overs'] ?? 20, $t['balls_per_over'] ?? 6, $t['players_per_side'] ?? 11, $t['max_overs_bowler'] ?? 0, $t['last_man_stands'] ?? 0, $t['venue'], $date]);
        }
        return ['created' => count($pairs)];
    }

    /* ===== Academy (lessons & quizzes) ===== */
    case 'academy_progress':
        return academy_progress($u);
    case 'academy_submit':
        return academy_submit($u, $in);

    /* ===== Stats ===== */
    case 'leaderboards':
        return leaderboards(nint($in['tournament_id'] ?? null), 15, $u);
    }
    fail('Unknown action', 404);
}

function rollback_if_needed(): void {
    try { if (db()->inTransaction()) db()->rollBack(); } catch (Throwable $e) { /* no connection */ }
}

function tournament_state(array $t): string {
    if ((int)$t['matches'] > 0 && (int)$t['done'] === (int)$t['matches']) return 'completed';
    if ((int)$t['done'] > 0 || (int)$t['live'] > 0) return 'ongoing';
    return 'upcoming';
}
