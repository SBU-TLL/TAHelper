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

    //roster assignment within the dashboard
    $request = json_decode((string)file_get_contents('php://input'), true);
    if (is_array($request) && ($request['action'] ?? '') === 'assign') {
        $dataPath = $TAHELPER_DATA . '/json/data.json';
        $current = json_decode((string)file_get_contents($dataPath), true);
        if (!is_array($current) || !isset($current['Student Groups'], $current['TA Groups'])) {
            tahelper_deny(503, "The current roster is missing or unreadable.\n");
        }
        if (!is_array($request['students'] ?? null) || !is_array($request['tas'] ?? null)) {
            tahelper_deny(400, "Roster assignments must include students and TAs.\n");
        }

        $groups = [];
        foreach ($current['Student Groups'] as $student) {
            if (isset($student['Group'])) $groups[$student['Group']] = true;
        }
        foreach ($current['TA Groups'] as $ta) {
            foreach (['Group', 'GTAGroups'] as $field) {
                foreach (($ta[$field] ?? []) as $group) $groups[$group] = true;
            }
        }
        $studentsByNetID = [];
        foreach ($current['Student Groups'] as $studentKey => &$student) {
            $studentsByNetID[$student['NetID']] = [$studentKey, &$student];
        }
        unset($student);
        if (count($request['students']) !== count($studentsByNetID)) {
            tahelper_deny(400, "Every student must have exactly one group.\n");
        }
        foreach ($request['students'] as $netID => $group) {
            if (!isset($studentsByNetID[$netID]) || !is_string($group) || !isset($groups[$group])) {
                tahelper_deny(400, "The student assignment contains an unknown student or group.\n");
            }
            $currentSection = explode('-', (string)$studentsByNetID[$netID][1]['Group'], 2)[0];
            $targetSection = explode('-', $group, 2)[0];
            //another check to make sure students stay in their section
            if ($currentSection !== $targetSection) {
                tahelper_deny(400, "Students may only be assigned within their section.\n");
            }
            $studentsByNetID[$netID][1]['Group'] = $group;
        }

        $facilitators = [];
        foreach ($current['TA Groups'] as $netID => &$ta) {
            if (($ta['Type'] ?? '') === 'Group Facilitator') {
                $facilitators[$netID] = true;
                $ta['Group'] = [];
            }
        }
        unset($ta);
        $assignedGroups = [];
        foreach ($request['tas'] as $netID => $groupsForTA) {
            if (!isset($facilitators[$netID])) {
                tahelper_deny(400, "Only Group Facilitators may be assigned to groups.\n");
            }
            if (!is_array($groupsForTA)) {
                $groupsForTA = ($groupsForTA === null || $groupsForTA === '') ? [] : [$groupsForTA];
            }
            foreach ($groupsForTA as $group) {
                if (!is_string($group) || !isset($groups[$group]) || isset($assignedGroups[$group])) {
                    tahelper_deny(400, "The TA assignment contains an unknown or duplicate group.\n");
                }
                $current['TA Groups'][$netID]['Group'][] = $group;
                $assignedGroups[$group] = true;
            }
        }
        if (count($request['tas']) > count($facilitators)) {
            tahelper_deny(400, "The TA assignment contains an unknown TA.\n");
        }

        $temporaryPath = $dataPath . '.tmp.' . bin2hex(random_bytes(6));
        $json = json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($json === false || file_put_contents($temporaryPath, $json) === false || !rename($temporaryPath, $dataPath)) {
            @unlink($temporaryPath);
            tahelper_deny(500, "The roster assignments could not be saved.\n");
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['saved' => true]);
        exit;
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