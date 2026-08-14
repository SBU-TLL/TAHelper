<?php
/**
 * Serves one student photo, behind the same per-course staff check as the roster.
 *
 * Photos are named "{Name},{sha256(StudentID)}.jpg". Only the basename of the
 * request is used and the result is confined with realpath(), so no request can
 * reach outside this course's images directory.
 */
$name = basename(str_replace('\\', '/', (string)($_GET['f'] ?? '')));
if ($name === '' || $name[0] === '.') {
    tahelper_deny(400, "Bad photo name.\n");
}

$dir  = realpath($TAHELPER_DATA . '/images');
$path = $dir === false ? false : realpath($dir . DIRECTORY_SEPARATOR . $name);
if ($path === false || strpos($path, $dir . DIRECTORY_SEPARATOR) !== 0 || !is_file($path)) {
    tahelper_deny(404, "No such photo.\n");
}

$info = @getimagesize($path);
header('Content-Type: ' . ($info['mime'] ?? 'application/octet-stream'));
header('Content-Length: ' . filesize($path));
header('Cache-Control: private, max-age=300');
readfile($path);
