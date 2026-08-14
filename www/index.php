<?php
/**
 * Site entry point.
 *
 * One deployment serves several courses, each from its own directory:
 *   /BIO201/   /BIO354/   …
 * They share all the code; what differs is the data behind each one. A directory
 * counts as a course when it holds an index.php and has a matching data/<COURSE>
 * directory outside the web root, so adding a course needs no edit here.
 *
 * With exactly one course installed there is nothing to choose — go straight in.
 */
$courses = [];
$dataRoot = dirname(__DIR__) . '/data';
foreach (glob(__DIR__ . '/*', GLOB_ONLYDIR) as $dir) {
    if (is_file("$dir/index.php") && is_dir("$dataRoot/" . basename($dir))) {
        $courses[] = basename($dir);
    }
}
sort($courses);

if (count($courses) === 1) {
    header('Location: /' . rawurlencode($courses[0]) . '/', true, 302);
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TAHelper</title>
    <link href="/css/index.css" rel="stylesheet" type="text/css">
    <style>
        body { font-family: system-ui, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 16px; color: #222; }
        h1 { margin-bottom: 4px; }
        p.sub { color: #666; margin-top: 0; }
        ul { list-style: none; padding: 0; }
        li { margin: 10px 0; }
        a.course { display: block; padding: 14px 18px; border: 1px solid #ddd; border-radius: 8px;
                   text-decoration: none; color: #900; font-weight: 600; font-size: 18px; }
        a.course:hover { background: #f6f6f6; }
    </style>
</head>
<body>
    <h1>TAHelper</h1>
    <p class="sub">Choose a course.</p>
    <?php if (!$courses): ?>
        <p>No courses are installed. Each course is a directory under the web root
           containing an <code>index.php</code> and a <code>json/</code> link to its data.</p>
    <?php else: ?>
        <ul>
            <?php foreach ($courses as $c): ?>
                <li><a class="course" href="/<?= rawurlencode($c) ?>/"><?= htmlspecialchars($c, ENT_QUOTES, 'UTF-8') ?></a></li>
            <?php endforeach; ?>
        </ul>
    <?php endif; ?>
</body>
</html>
