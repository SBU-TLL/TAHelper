<?php

if(!isset($_FILES['imageZip']) || $_FILES['imageZip']['error'] !== UPLOAD_ERR_OK) {
    tahelper_deny(400, "Upload a zip file with images.\n");
}

$tmpPath = $_FILES['imageZip']['tmp_name'];
$extractedDir = sys_get_temp_dir() . '/tahelper_images_' . bin2hex(random_bytes(6));
if(!mkdir($extractedDir) || !is_dir($extractedDir)) {
    tahelper_deny(500, "Could not create temporary directory.\n");
}

$zip = new ZipArchive();
if($zip->open($tmpPath) === true) {
    $zip->extractTo($extractedDir);
    $zip->close();

    $command = escapeshellcmd("python3 ./../extractStudentsFromHTML.py --in " . $extractedDir . " --out " . $TAHELPER_DATA . "/images");
    $output = [];
    $resultCode = null;

    exec($command, $output, $resultCode);
    removeDir($extractedDir);

    if($resultCode !== 0) {
        tahelper_deny(500, "Could not extract student images from HTML files.\n");
        echo implode("\n", $output);
    }else {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['saved' => true]);
        exit;
    }
} else {
    tahelper_deny(400, "Could not open the zip file.\n");
}

function removeDir($dir) {
    if (!is_dir($dir)) {
        return;
    }
    $files = array_diff(scandir($dir), ['.', '..']);
    foreach ($files as $file) {
        $path = "$dir/$file";
        if (is_dir($path)) {
            removeDir($path);
        } else {
            unlink($path);
        }
    }
    rmdir($dir);
}
?>