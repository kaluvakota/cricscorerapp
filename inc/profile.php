<?php
/* Cric-Scorer — player profile: photo or figure, bio, cricket profile, linked scorer player */

const PROFILE_ROLES = ['Batter', 'Bowler', 'All-rounder', 'Wicket-keeper'];
const PROFILE_BATTING = ['Right-hand bat', 'Left-hand bat'];
const PROFILE_BOWLING = ['Right-arm fast', 'Right-arm fast-medium', 'Right-arm medium', 'Left-arm fast', 'Left-arm fast-medium', 'Left-arm medium',
                         'Right-arm offbreak', 'Right-arm legbreak', 'Slow left-arm orthodox', 'Left-arm wrist-spin'];
const AVATAR_PRESETS = ['bat', 'ball', 'gloves', 'trophy', 'lion', 'tiger', 'eagle', 'rocket', 'fire', 'star', 'bolt', 'target', 'crown', 'rhino', 'shark', 'wolf'];
const AVATAR_DIR = 'uploads/avatars';

/** Cricket-profile fields shown to anyone allowed to see the player */
function cricket_profile(array $r): array {
    $p = null;
    if (!empty($r['player_id'])) {
        $pl = row('SELECT p.id, p.name, t.id team_id, t.name team, t.short_name, t.color FROM players p JOIN teams t ON t.id=p.team_id WHERE p.id=?', [$r['player_id']]);
        if ($pl) $p = ['id' => (int)$pl['id'], 'name' => $pl['name'], 'team_id' => (int)$pl['team_id'], 'team' => $pl['team'], 'short_name' => $pl['short_name'], 'color' => $pl['color']];
    }
    return ['bio' => $r['bio'] ?? null, 'role' => $r['role'] ?? null, 'batting_style' => $r['batting_style'] ?? null,
            'bowling_style' => $r['bowling_style'] ?? null, 'experience_years' => isset($r['experience_years']) ? (int)$r['experience_years'] : null,
            'avatar_preset' => $r['avatar_preset'] ?? null, 'player' => $p];
}

/** Save the editable profile fields sent from My Profile */
function profile_fields_save(array $u, array $in): void {
    $set = []; $vals = [];
    if (array_key_exists('bio', $in)) { $b = trim(preg_replace('/\s+/u', ' ', (string)$in['bio'])); $set[] = 'bio=?'; $vals[] = $b === '' ? null : mb_substr($b, 0, 160); }
    if (array_key_exists('role', $in)) { $set[] = 'role=?'; $vals[] = in_array($in['role'], PROFILE_ROLES, true) ? $in['role'] : null; }
    if (array_key_exists('batting_style', $in)) { $set[] = 'batting_style=?'; $vals[] = in_array($in['batting_style'], PROFILE_BATTING, true) ? $in['batting_style'] : null; }
    if (array_key_exists('bowling_style', $in)) { $set[] = 'bowling_style=?'; $vals[] = in_array($in['bowling_style'], PROFILE_BOWLING, true) ? $in['bowling_style'] : null; }
    if (array_key_exists('experience_years', $in)) {
        $e = $in['experience_years'];
        $set[] = 'experience_years=?'; $vals[] = ($e === '' || $e === null) ? null : max(0, min(60, (int)$e));
    }
    if (array_key_exists('avatar_preset', $in)) { $set[] = 'avatar_preset=?'; $vals[] = in_array($in['avatar_preset'], AVATAR_PRESETS, true) ? $in['avatar_preset'] : null; }
    if (array_key_exists('player_id', $in)) {
        $pid = nint($in['player_id']);
        if ($pid) {
            $pl = row('SELECT p.id, t.category, t.owner_id FROM players p JOIN teams t ON t.id=p.team_id WHERE p.id=?', [$pid]);
            if (!$pl) fail('Player not found');
            if ($pl['category'] !== 'custom') fail('Pick yourself from one of your own teams (not an IPL or international squad) 😄');
            $other = val('SELECT username FROM users WHERE player_id=? AND id<>?', [$pid, $u['id']]);
            if ($other) fail('That player is already linked to @' . $other);
        }
        $set[] = 'player_id=?'; $vals[] = $pid;
    }
    if ($set) q('UPDATE users SET ' . implode(', ', $set) . ' WHERE id=?', array_merge($vals, [$u['id']]));
}

function avatar_is_upload(?string $url): bool { return $url !== null && strpos($url, AVATAR_DIR . '/') === 0; }
function avatar_delete_file(?string $url): void {
    if (!avatar_is_upload($url)) return;
    $f = __DIR__ . '/../' . $url;
    if (is_file($f) && preg_match('#^uploads/avatars/u\d+_[a-f0-9]{12}\.(jpg|png|webp)$#', $url)) @unlink($f);
}
function avatar_dir(): string {
    $dir = __DIR__ . '/../' . AVATAR_DIR;
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) fail('The server could not create the photos folder (uploads/avatars). Please check folder permissions.');
    // Never let anything in uploads run as code
    $ht = __DIR__ . '/../uploads/.htaccess';
    if (!is_file($ht)) @file_put_contents($ht, "Options -Indexes\n<FilesMatch \"\\.(php|phtml|phar|pl|py|cgi|sh|html?|svg)$\">\n  Require all denied\n</FilesMatch>\n<IfModule mod_php.c>\n  php_flag engine off\n</IfModule>\n");
    return $dir;
}

/** Save a profile photo sent as a data URL (the phone already cropped it to a square) */
function avatar_upload(array $u, array $in): array {
    $data = (string)($in['image'] ?? '');
    if (!preg_match('#^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$#', $data, $m)) fail('Please choose a JPG, PNG or WebP photo');
    $bin = base64_decode($m[2], true);
    if ($bin === false || strlen($bin) < 100) fail('That photo could not be read');
    if (strlen($bin) > 2 * 1024 * 1024) fail('That photo is too big (max 2 MB)');
    $info = @getimagesizefromstring($bin);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) fail('That file is not a photo');
    if ($info[0] > 4096 || $info[1] > 4096 || $info[0] < 32 || $info[1] < 32) fail('Please use a normal-sized photo');
    $dir = avatar_dir();
    $name = 'u' . (int)$u['id'] . '_' . bin2hex(random_bytes(6));
    if (function_exists('imagecreatefromstring') && function_exists('imagejpeg') && ($src = @imagecreatefromstring($bin))) {
        // Re-draw the image: makes a clean 320×320 JPEG and strips location data and anything hidden in the file
        $w = imagesx($src); $h = imagesy($src); $side = min($w, $h);
        $dst = imagecreatetruecolor(320, 320);
        imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
        imagecopyresampled($dst, $src, 0, 0, (int)(($w - $side) / 2), (int)(($h - $side) / 2), 320, 320, $side, $side);
        $file = "$name.jpg";
        if (!imagejpeg($dst, "$dir/$file", 85)) fail('The server could not save your photo');
        imagedestroy($src); imagedestroy($dst);
    } else {
        $ext = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2]];
        $file = "$name.$ext";
        if (@file_put_contents("$dir/$file", $bin) === false) fail('The server could not save your photo');
    }
    $old = val('SELECT avatar_url FROM users WHERE id=?', [$u['id']]);
    q('UPDATE users SET avatar_url=? WHERE id=?', [AVATAR_DIR . "/$file", $u['id']]);
    avatar_delete_file($old);
    return ['user' => public_user(row('SELECT * FROM users WHERE id=?', [$u['id']]))];
}

function avatar_remove(array $u): array {
    $old = val('SELECT avatar_url FROM users WHERE id=?', [$u['id']]);
    q('UPDATE users SET avatar_url=NULL WHERE id=?', [$u['id']]);
    avatar_delete_file($old);
    return ['user' => public_user(row('SELECT * FROM users WHERE id=?', [$u['id']]))];
}
