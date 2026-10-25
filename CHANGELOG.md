# Cric-Scorer changelog

The admin portal (More → Admin portal → Updates) reads this file from GitHub to show "what's new"
before installing. Add a `## <version> - <date>` section with `-` bullet points for every release,
and bump `APP_VERSION` in `inc/version.php`.

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
