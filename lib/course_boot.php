<?php
/**
 * Shared bootstrap for every per-course entry point.
 *
 * The entry point sets $TAHELPER_COURSE and requires this file. It then has:
 *   $TAHELPER_DATA  absolute path to that course's data (outside the web root)
 *   $TAHELPER_USER  the signed-in user: cn, nickname, sn, and their Type
 *
 * Two things happen here that used to happen nowhere.
 *
 * 1. ACCESS IS CHECKED PER COURSE. The web server only requires *a* Shibboleth
 *    session, so previously any university netID could read any course's roster
 *    — the app merely rendered a blank page for people it did not recognise,
 *    which is a display convention, not a control. Each course's staff list is
 *    the "TA Groups" section of its own data.json, so that is what we check.
 *
 * 2. IDENTITY COMES FROM THE SERVER. The page used to fetch iam.php over HTTP
 *    to learn who you were; the values are already in $_SERVER, so the shell
 *    now emits them directly.
 */

$course = $TAHELPER_COURSE ?? null;
if (!is_string($course) || !preg_match('/^[A-Za-z0-9_-]+$/', $course)) {
    http_response_code(500);
    exit("course_boot.php: the entry point set no valid \$TAHELPER_COURSE.\n");
}

// Data lives outside the web root, reachable only through this constant — which
// is why nothing under www/ can be fetched directly any more.
$TAHELPER_DATA = dirname(__DIR__) . '/data/' . $course;

/** Refuse the request with a plain-text explanation. */
function tahelper_deny(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    exit($message);
}

// mod_shib populates these; the .htaccess session gate runs before PHP, so an
// empty cn means the gate is misconfigured rather than that the user is a guest.
$netid = $_SERVER['cn'] ?? null;
if (!$netid) {
    tahelper_deny(403,
        "No identity on this request.\n\n"
      . "The Shibboleth session gate should run before this page. If you reached\n"
      . "here you are signed in but no attributes were exported to the app.\n");
}

$rosterFile = $TAHELPER_DATA . '/json/data.json';
$roster = is_readable($rosterFile) ? json_decode((string)file_get_contents($rosterFile), true) : null;
if (!is_array($roster) || !isset($roster['TA Groups'])) {
    tahelper_deny(503,
        "$course is not set up yet: its roster is missing or unreadable.\n\n"
      . "Import it with:  ddev roster-real $course      (or: ddev roster $course)\n");
}

$staff = $roster['TA Groups'];
if (!isset($staff[$netid])) {
    tahelper_deny(403,
        "'$netid' is not on the staff list for $course.\n\n"
      . "Access is per course: the list is the 'TA Groups' tab of $course's\n"
      . "spreadsheet. Being staff on another course does not grant access here.\n");
}

$TAHELPER_USER = [
    'cn'       => $netid,
    'nickname' => $_SERVER['nickname'] ?? null,
    'sn'       => $_SERVER['sn'] ?? null,
    'Type'     => $staff[$netid]['Type'] ?? null,
];
