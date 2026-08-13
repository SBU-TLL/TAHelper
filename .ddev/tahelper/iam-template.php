<?php
// DDEV template for the env-supplied iam.php (gitignored by upstream design;
// production ships its own). Reads REAL Shibboleth attributes provided by
// mod_shib — no dummy fallback: the .htaccess session gate runs first.
header('Content-Type: application/json');
echo json_encode([
    'cn' => $_SERVER['cn'] ?? null,
    'nickname' => $_SERVER['nickname'] ?? null,
    'sn' => $_SERVER['sn'] ?? null,
]);
