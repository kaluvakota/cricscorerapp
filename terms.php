<?php
/* Terms of Use - served at /terms */
require_once __DIR__ . '/inc/seo.php';
$org = e(ORG_NAME); $mail = e(CONTACT_EMAIL); $addr = e(ORG_ADDRESS);
page_start([
    'title' => 'Terms of Use - Cric-Scorer',
    'description' => 'The simple rules for using Cric-Scorer, the free cricket scoring and learning app by ' . ORG_NAME . '.',
    'path' => 'terms',
    'jsonld' => [ld_breadcrumbs([['Home', ''], ['Terms of Use', 'terms']])],
]);
?>
<p class="crumbs"><a href="<?= e(site_url()) ?>">Home</a> › Terms of Use</p>
<h1>Terms of Use</h1>
<p class="updated">Last updated: <?= e(POLICY_UPDATED) ?></p>
<p class="lead">Welcome to Cric-Scorer! These terms are the rules for using the app. By creating an account or using Cric-Scorer, you agree to them and to our <a href="<?= e(site_url('privacy')) ?>">Privacy Policy</a>.</p>

<h2>1. Who provides Cric-Scorer</h2>
<p>Cric-Scorer ("Cric-Scorer by Aaryush") is provided by <b><?= $org ?></b>, <?= $addr ?>. Contact: <a href="mailto:<?= $mail ?>"><?= $mail ?></a>.</p>

<h2>2. It's free</h2>
<p>Cric-Scorer is free to use. There are no subscriptions, ads or in-app purchases. If we ever offer paid extras, we will tell you clearly before anything changes, and you will never be charged without agreeing first.</p>

<h2>3. Who can use it</h2>
<ul>
  <li>Anyone can use Cric-Scorer. If you are <b>under 18</b>, you must have your <b>parent or legal guardian's permission</b>, and they agree to these terms for you.</li>
  <li>Parents and guardians are responsible for their child's use of the app and can ask us to delete the child's account at any time.</li>
</ul>

<h2>4. Your account</h2>
<ul>
  <li>Keep your password secret, and don't share your account. You are responsible for what happens in it.</li>
  <li>Use a real-sounding name or nickname. Don't pretend to be someone else, including famous cricketers.</li>
  <li>Tell us straight away if you think someone else is using your account.</li>
</ul>

<h2>5. Play fair: what's not allowed</h2>
<ul>
  <li>Bullying, rude, hateful or adult content in names, bios, team names, match titles or photos.</li>
  <li>Sharing other people's private information (such as phone numbers, addresses or schools), or photos of other people without their permission.</li>
  <li>Spamming, using bots or scripts, trying to break or overload the app, or getting into accounts or data that aren't yours.</li>
  <li>Using Cric-Scorer for anything illegal, including betting or gambling.</li>
</ul>
<p>We may remove content or suspend accounts that break these rules, especially to keep children safe.</p>

<h2>6. Your content</h2>
<p>The teams, players, matches, photos and other things you add stay yours. You give us permission to store them and show them in the app as your privacy settings allow, so the app can work: for example, showing a public match to people you share it with. You can delete your content or your whole account at any time. Only upload photos you have the right to use.</p>

<h2>7. Teams, players and cricket information</h2>
<ul>
  <li>IPL and international team squads are included for fun and practice scoring. They may not be fully up to date, and you can edit your own copies.</li>
  <li>Cric-Scorer is an independent app. It is <b>not affiliated with, endorsed by or connected to</b> the BCCI, the IPL, the ICC, MCC or any cricket board, league, team or player. Team and player names belong to their respective owners and are used only to identify them.</li>
  <li>The Cricket Academy explains the Laws of Cricket in simple words for learning. For official matches, the MCC Laws of Cricket and the competition's own playing conditions always apply.</li>
  <li>The DLS calculator uses the published Standard Edition method. Professional matches use the official DLS software, whose targets can differ slightly.</li>
</ul>

<h2>8. Availability and changes</h2>
<p>We work hard to keep Cric-Scorer running, but it is provided <b>"as is"</b>: there may sometimes be bugs, interruptions or data loss. Keep your own note of results that really matter. We may change, add or remove features over time.</p>

<h2>9. Limits on our responsibility</h2>
<p>As far as the law allows, <?= $org ?> is not responsible for indirect losses, or for decisions made using scores or statistics from the app. Nothing in these terms limits rights you have under Indian consumer law that cannot be excluded.</p>

<h2>10. Ending your use</h2>
<p>You can stop using Cric-Scorer and delete your account at any time (<i>More → My Profile → Delete my account</i>). We may suspend or close accounts that seriously or repeatedly break these terms.</p>

<h2>11. Law and disputes</h2>
<p>These terms are governed by the laws of India. Any dispute will be handled by the courts in Hyderabad, Telangana. Please contact us first, though: most problems can be sorted out quickly by email.</p>

<h2>12. Changes to these terms</h2>
<p>If we change these terms, we will update the date at the top and, for important changes, let you know in the app first.</p>

<div class="cta-box"><h2>Questions?</h2><p>Write to us any time, and we're happy to help.</p><a class="btn lime" href="mailto:<?= $mail ?>"><?= $mail ?></a></div>
<?php page_end();
