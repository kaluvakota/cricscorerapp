# Cric-Scorer changelog

The admin portal (More → Admin portal → Updates) reads this file from GitHub to show "what's new"
before installing. Add a `## <version> - <date>` section with `-` bullet points for every release,
and bump `APP_VERSION` in `inc/version.php`.

## 1.18.2 - 25 October 2026
- Login button now says "Log in" (was "Let's play 🏏")

## 1.18.1 - 25 October 2026
- Sign-up: one password field with a show/hide (👁) button instead of "confirm password" - easier on phones and works with automated testers that expect a single password input

## 1.18.0 - 25 October 2026
- Grounds directory: ground owners and academies list their ground (address, map link, pitch type, floodlights, size, timings, price, facilities, contact person and a WhatsApp number) - players find grounds by city, open the map, tap "WhatsApp to book", start a match there or post a "looking for" for it; ground pages show matches scored there and views
- Pick a listed ground as the venue when creating a match; the match page links to the ground
- "Looking for" board: post for an opponent team, players, umpire, scorer, ground or a team to join - with city, area, date, overs, ball type, your team and an optional contact; filter by kind and city, search, share on WhatsApp
- Replies stay inside the app: only the poster sees them (with the replier's profile and contact); mark a post as sorted, reopen, edit or delete; up to 10 open posts and 10 grounds per account
- Home tiles and More-menu entries for Looking for and Grounds

## 1.17.0 - 25 October 2026
- Player page rebuilt with tabs: Matches (full history with your runs/wickets per match, won/lost, load more), Stats, Awards, Badges, Teams, Insights
- Filters on Matches and Stats: year, result, tournament, playing for, against, ball type, overs
- Full stats cards: batting adds ducks and won/lost; bowling adds maidens, 3/5-wicket hauls, strike rate, wides, no-balls, dot balls, 4s/6s conceded; new fielding card (catches, caught behind, run outs, stumpings, runs saved/given, drops) and captain card (matches, won, lost, win %, tosses)
- Awards: every Player of the Match, best batter and best bowler with the figures that earned it; Badges: fifty, century, quick fire, six machine, 50 stand, 3-wicket haul, five-for, hat-trick, maiden, safe hands, duck
- Teams played for (since, played, won, lost); player level (Rookie → Aspirant → Regular → Star → Legend) and profile views
- Captain and wicket-keeper picked in the playing XI (C / WK) - used for captain stats and caught-behind
- Match page: Summary tab (best performances, auto match notes - team 50s, batter 50/100s, 50 partnerships, bowler hauls, innings start/end and break timings - scorer notes log, match points), MVP tab (batting + bowling + fielding points, published formula), Teams tab (both XIs)
- Tournament Stats tab shows an MVP leaderboard; bonus points per match add to the points table
- Ball type (leather / tennis / rubber) and round name on a match (new-match form or Officials sheet)

## 1.16.1 - 25 October 2026
- Wheel scoring: a tap-to-score wagon wheel above the pad - rings for • 1 2 3 4 5 6, eight zones; tap where the ball went and the runs and direction are recorded in one go (🎯 Hide wheel to switch it off)
- Commentary and the voice now say where it went: "cut for 2 runs to point, fielded by Rohit", "FOUR! driven through cover", "SIX! over long on"
- 🧤 Set field: place the fielders on the wheel (zone → player) so commentary names who fielded the ball; fielders show on the wheel while scoring

## 1.16.0 - 25 October 2026
- Edit or delete any earlier ball (Overs / Ball by ball tab) - everything after it is re-counted with the same batters and bowlers; works after the match too
- New dismissals: retired out, timed out, obstructing the field, hit the ball twice (plus retired hurt, which stays not out)
- Wrong batter? Swap a batter who has not faced a ball yet; change the overs during the first innings; replace a bowler mid-over
- Penalty / bonus runs for either side with a reason; powerplay overs (set when creating the match or any time) shown on the scoreboard
- Shot & fielding on every ball: shot type, wagon-wheel direction, dropped catch, runs saved or given away - tap 🎯 or switch on "ask after every scoring shot"
- New Analysis tab: Manhattan, worm, run rate, wagon wheel per batter, wickets pie, types of runs, all partnerships, powerplay and fielding
- Super over for tied matches (one over, two wickets; the side that batted second bats first)
- Result card shows Player of the Match, best batter and best bowler
- Match officials (umpires, third umpire, referee, scorer, commentator) and a live-stream link - YouTube plays right on the match page
- Download the scorecard as an image to share on WhatsApp
- Free score overlay for streamers: overlay.php?m=ID as a browser source in OBS or any streaming app
- Free player insights on every profile: batting and bowling by phase (powerplay / middle / death), how they get out, favourite shots, career wagon wheel, fielding, strengths and things to work on
- Tournament stats show a boundary tracker (fours, sixes, run rate, dot-ball %)
- Minutes batted on the scorecard; super-over runs are kept out of career stats and NRR

## 1.15.1 - 25 October 2026
- More → Invite friends: four ready-made messages (fun, for my team, for parents, short) to share on WhatsApp or anywhere, or copy

## 1.15.0 - 25 October 2026
- Players in a team can have a WhatsApp number; when that person later joins or verifies with the same number, their account is linked automatically and all matches scored under that name become their stats
- Add players: the search now also finds players who use the app (by name, username or number), including brand-new accounts in no team yet, so anyone can add them to a team

## 1.14.5 - 25 October 2026
- Admin portal: Players tab - every player's name, username and ID, joined/last-seen dates, verified tick, with search and paging

## 1.14.4 - 25 October 2026
- Find players by their full WhatsApp number (exact number only; numbers are never shown in results; private profiles stay hidden)
- Clearer message when a number is already linked to another account - one account per number

## 1.14.3 - 25 October 2026
- WhatsApp: support Meta "Authentication" templates (Copy code / Autofill) with WHATSAPP_TEMPLATE_KIND = 'code'; Meta's full error reason is shown to the admin

## 1.14.0 - 24 October 2026
- Mobile number on your profile (optional, one account per number) with WhatsApp verification through the Meta Cloud API
- One-tap WhatsApp link: tapping it verifies the number and signs you in - no code to type (a 6-digit code works as a fallback)
- Sign in or join with WhatsApp instead of a password
- Cricket academies: register with name and address, add students by username, mobile number or name; each academy gets its own team that students can play with
- Verified players show a tick; profiles show the academies they train at

## 1.13.0 - 24 October 2026
- Only the player who created a match (and the admin) can score it - everyone else just watches
- The creator can name one other player as scorer by username (Match options → Scorer) and take it back any time
- The named scorer sees the match under My matches; only the creator can delete it, make it private or change the scorer

## 1.12.0 - 24 October 2026
- Gully Duel plays like Cricket League: quick 2-over 1v1 matches in six stadiums (Mumbai, Dubai, Melbourne, London, Johannesburg, Dhaka)
- Batting: touch and hold to lift the bat as the bowler runs in, let go and flick to hit; timing bar on the left
- Bowling: choose a bowler each over, named deliveries (outswing, inswing, yorker, bouncer, slower ball, off-break, leg-break, doosra, flipper, arm ball), over or round the wicket, power bar
- Three wides or three no-balls lose the game; a 15-second bowling timer - time out twice and you lose
- Squad of 12 players with power, timing, pace, accuracy and swing stats; coins for every game unlock new players
- Fielders chase and dive, crowds, floodlights and camera shake on sixes

## 1.11.0 - 24 October 2026
- Custom teams are now protected: only the owner (and players they allow) can pick a team for matches and tournaments, or copy its players
- Other players tap "Ask to use this team"; the owner sees the request on the team page and taps Allow or Decline
- Owners can add players by username, remove them again, or open the team to everyone
- Locked teams show a 🔒 in the match and tournament pickers; IPL and international teams stay open to all

## 1.10.0 - 24 October 2026
- Gully Duel rebuilt in the style of Cricket League: the camera is behind the batter and the ball comes towards you
- Batting: swipe the way you want to hit as the ball arrives - short swipe along the ground, long swipe in the air, tap to block
- Timing bar shows perfect (blue), good, ok, early and late - wider timing window, so runs are much easier to score
- Bowling: choose Fast, Swing or Spin (In / Straight / Out), drag the circle to where the ball should land, stop the power bar in the blue
- Real fielders with a mini-map of the gaps, catches, boundary catches, no-balls and free hits
- New Practice nets mode to learn batting

## 1.9.0 - 24 October 2026
- New game: Gully Duel - one player bowls, the other bats, on two phones (4-digit code), one phone held sideways, or against the computer
- Admin portal with usage stats: players joined and active, matches, games, Academy - totals only, no personal details
- Roll out new features to selected players or everyone from the admin portal
- One-tap updates from GitHub with automatic backup and roll back, plus "ask everyone to update now"
- Help & feedback: players send messages and see replies in the app
- Announcements on the Home screen
- Error reports with reference codes (personal details blanked out)

## 1.8.0 - 24 October 2026
- Home page for visitors, free Learn cricket pages, sitemap and search-engine data
- Shareable match pages with the score in WhatsApp previews
- Privacy Policy and Terms of Use, consent at sign-up, Delete my account

## 1.7.1 - 23 October 2026
- Find players works on every MySQL version; clearer error references

## 1.7.0 - 23 October 2026
- Player profiles: photo or figure, bio, cricket profile and linked career stats

## 1.6.0 - 22 October 2026
- Follow players, private profiles and private matches

## 1.5.0 - 22 October 2026
- Sign in with Google and Google reCAPTCHA

## 1.4.0 - 21 October 2026
- Cricket Academy: lessons, quizzes, XP, ranks and certificate

## 1.3.0 - 21 October 2026
- DLS method for rain-affected matches
