<?php
/**
 * Serves this course's generated JSON, behind the per-course staff check.
 *
 * These files used to sit in the web root as plain static files, so any
 * university netID with a Shibboleth session could fetch any course's roster —
 * real student names and netIDs. They now live outside the web root and are
 * only reachable here, after lib/course_boot.php has confirmed the caller is on
 * this course's staff list.
 */
$files = ['data' => 'data.json', 'templates' => 'templates.json', 'log' => 'log.json'];
$which = (string)($_GET['f'] ?? 'data');
if (!isset($files[$which])) {
    tahelper_deny(404, "No such roster file.\n");
}

$path = $TAHELPER_DATA . '/json/' . $files[$which];
if (!is_readable($path)) {
    tahelper_deny(404, "{$files[$which]} has not been generated for this course yet.\n");
}

header('Content-Type: application/json; charset=utf-8');
// The roster is regenerated out of band; a cached copy silently shows the wrong
// groups or an outdated role.
header('Cache-Control: no-store');
readfile($path);
