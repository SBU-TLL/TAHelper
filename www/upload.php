<?php
/**
 * Image upload endpoint (student photos).
 *
 * SECURITY: this previously took the destination straight from the request
 * (`$location = $_POST['fileName']; move_uploaded_file(..., $location);`) with
 * no authentication, so anyone could write any file anywhere the web user could
 * reach — including a .php file inside the docroot, i.e. remote code execution.
 *
 * It now requires a logged-in user, confines writes to the images directory,
 * and accepts image files only. The client still chooses the file NAME (the app
 * names photos "{Name},{hash}.jpg"), but never the directory.
 */

// --- authentication ---------------------------------------------------------
// The Shibboleth .htaccess gate normally stops anonymous requests before PHP
// runs; check anyway so this endpoint is never the weak link.
session_start();
$user = $_SERVER['cn'] ?? $_SESSION['cn'] ?? null;
if (!$user && !empty($_SESSION['mail'])) {
    $user = explode('@', $_SESSION['mail'])[0];
}
if (!$user) {
    http_response_code(403);
    echo 0;
    exit;
}

// --- validate the upload ----------------------------------------------------
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo 0;
    exit;
}

$maxBytes = 8 * 1024 * 1024; // 8 MB
if ($_FILES['file']['size'] > $maxBytes) {
    http_response_code(413);
    echo 0;
    exit;
}

// Must actually be an image (checks content, not just the name).
$info = @getimagesize($_FILES['file']['tmp_name']);
$allowed = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_GIF => 'gif'];
if ($info === false || !isset($allowed[$info[2]])) {
    http_response_code(415);
    echo 0;
    exit;
}

// --- confine the destination ------------------------------------------------
// Only the basename of the requested name is used, so "../" and absolute paths
// cannot escape the images directory.
$requested = (string)($_POST['fileName'] ?? $_FILES['file']['name']);
$name = basename(str_replace('\\', '/', $requested));
// Keep the app's "{Name},{hash}.jpg" convention; drop anything else risky.
$name = preg_replace('/[^A-Za-z0-9 ,._-]/', '', $name);
if ($name === '' || $name[0] === '.') {
    http_response_code(400);
    echo 0;
    exit;
}
// Force a safe extension matching the real content type.
$name = preg_replace('/\.[A-Za-z0-9]+$/', '', $name) . '.' . $allowed[$info[2]];

$imagesDir = __DIR__ . '/images';
if (!is_dir($imagesDir)) {
    mkdir($imagesDir, 0755, true);
}
$realDir = realpath($imagesDir);
$destination = $realDir . DIRECTORY_SEPARATOR . $name;

if ($realDir === false || strpos($destination, $realDir . DIRECTORY_SEPARATOR) !== 0) {
    http_response_code(400);
    echo 0;
    exit;
}

if (move_uploaded_file($_FILES['file']['tmp_name'], $destination)) {
    echo 'images/' . $name;
} else {
    http_response_code(500);
    echo 0;
}
