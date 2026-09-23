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

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!in_array($TAHELPER_USER['Type'] ?? '', ['Professor', 'GTAs'], true)) {
        tahelper_deny(403, "Only course administrators may load a roster.\n");
    }
    if (!isset($_FILES['roster']) || $_FILES['roster']['error'] !== UPLOAD_ERR_OK) {
        tahelper_deny(400, "Upload a CSV roster file.\n");
    }
    $handle = fopen($_FILES['roster']['tmp_name'], 'rb');
    if ($handle === false) {
        tahelper_deny(400, "The uploaded roster could not be read.\n");
    }
    $expected = ['Last Name', 'First Name', 'NetID', 'Student ID', 'Section', 'Group'];
    $header = fgetcsv($handle);
    if ($header === false || array_map('trim', $header) !== $expected) {
        fclose($handle);
        tahelper_deny(400, "CSV headers must be: Last Name,First Name,NetID,Student ID,Section,Group\n");
    }

    $dataPath = $TAHELPER_DATA . '/json/data.json';
    $current = json_decode((string)file_get_contents($dataPath), true);
    if (!is_array($current) || !isset($current['TA Groups'])) {
        fclose($handle);
        tahelper_deny(503, "The current roster is missing or unreadable.\n");
    }

    $students = [];
    $seenNetIDs = [];
    $seenStudentIDs = [];
    $rowNumber = 1;
    while (($row = fgetcsv($handle)) !== false) {
        $rowNumber++;
        if (count(array_filter($row, fn($value) => trim((string)$value) !== '')) === 0) {
            continue;
        }
        if (count($row) !== count($expected)) {
            fclose($handle);
            tahelper_deny(400, "CSV row $rowNumber must contain six columns.\n");
        }
        [$lastName, $firstName, $netID, $studentID, $section, $group] = array_map('trim', $row);
        if ($lastName === '' || $firstName === '' || $netID === '' || $studentID === '' || !preg_match('/^\d+$/', $section) || !preg_match('/^\d+$/', $group)) {
            fclose($handle);
            tahelper_deny(400, "CSV row $rowNumber has a missing or invalid value.\n");
        }
        if (isset($seenNetIDs[$netID]) || isset($seenStudentIDs[$studentID])) {
            fclose($handle);
            tahelper_deny(400, "CSV row $rowNumber duplicates a student.\n");
        }
        $studentKey = hash('sha256', $studentID);
        $students[$studentKey] = ['GTAGroups' => [], 'Group' => "$section-$group", 'Name' => "$firstName $lastName", 'NetID' => $netID, 'SID' => $studentKey, 'Warning' => 'Ok'];
        $seenNetIDs[$netID] = true;
        $seenStudentIDs[$studentID] = true;
    }
    fclose($handle);
    if (count($students) === 0) {
        tahelper_deny(400, "The CSV does not contain any students.\n");
    }

    $current['Student Groups'] = $students;
    $temporaryPath = $dataPath . '.tmp.' . bin2hex(random_bytes(6));
    $json = json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($temporaryPath, $json) === false || !rename($temporaryPath, $dataPath)) {
        @unlink($temporaryPath);
        tahelper_deny(500, "The roster could not be saved.\n");
    }
    foreach (glob($TAHELPER_DATA . '/studentResponses/*.json') as $response) {
        if (!unlink($response)) {
            tahelper_deny(500, "The roster was saved, but student responses could not be cleared.\n");
        }
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['students' => count($students)]);
    exit;
}

$which = (string)($_GET['f'] ?? 'data');
if (!isset($files[$which])) {
    tahelper_deny(404, "No such roster file.\n");
}
$path = $TAHELPER_DATA . '/json/' . $files[$which];
if (!is_readable($path)) {
    tahelper_deny(404, "{$files[$which]} has not been generated for this course yet.\n");
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
readfile($path);