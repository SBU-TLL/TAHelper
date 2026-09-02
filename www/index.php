<?php
/**
 * Site entry point.
 *
 * One deployment serves several courses, each from its own directory:
 *   /BIO201/   /BIO354/   …
 * They share all the code; what differs is the data behind each one. Any
 * directory here holding an index.php is a course, so adding one needs no edit
 * here. Its data lives in data/<COURSE>/, outside this web root.
 *
 * With exactly one course installed there is nothing to choose — go straight in.
 */
$courses = [];
foreach (glob(__DIR__ . '/*', GLOB_ONLYDIR) as $dir) {
    if (is_file("$dir/index.php")) {
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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Alumni+Sans:wght@400;500;600;700;800;900&family=Barlow:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="/css/index.css" rel="stylesheet" type="text/css">
    <style>
        :root {
            --sbu-dark-red: #6B000D;
            --sbu-border: rgba(0, 0, 0, 0.12);
            --sbu-text: #1f2a37;
        }

        * {
            box-sizing: border-box;
        }

        body {
            max-width: 760px;
            margin: 0 auto;
            padding: 72px 20px 48px;
            background: #bebebe;
            color: var(--sbu-text);
            font-family: 'Barlow', 'Segoe UI', sans-serif;
            overflow-x: hidden;
        }

        .course-shell {
            background: #ffffff;
            border: 1px solid var(--sbu-border);
            border-radius: 18px;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
            padding: 2rem;
            max-width: 100%;
        }

        h1 {
            margin: 0 0 0.5rem;
            color: var(--sbu-dark-red);
            font-family: 'Alumni Sans', 'Barlow', sans-serif;
            font-size: clamp(3rem, 7vw, 5rem);
            line-height: 0.9;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            font-weight: 800;
        }

        p.sub {
            margin: 0 0 1.5rem;
            color: #4d5965;
            font-size: 1.2rem;
            font-weight: 600;
        }

        ul {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        li {
            margin: 0 0 0.8rem;
        }

        a.course {
            display: block;
            padding: 1rem 1.1rem;
            border: 1px solid var(--sbu-border);
            border-radius: 12px;
            background: #fff;
            color: var(--sbu-dark-red);
            text-decoration: none;
            font-weight: 700;
            font-size: 1.2rem;
            letter-spacing: 0.02em;
            box-shadow: 0 8px 18px rgba(0, 0, 0, 0.04);
            word-break: break-word;
        }

        a.course:hover,
        a.course:focus {
            background: #f7f7f7;
            border-color: rgba(107, 0, 13, 0.25);
        }

        .course-note {
            margin-top: 1rem;
            color: var(--sbu-text);
            line-height: 1.6;
        }

        code {
            background: #f1f1f1;
            color: var(--sbu-dark-red);
            border-radius: 6px;
            padding: 0.2rem 0.4rem;
            word-break: break-word;
        }
    </style>
</head>
<body>
    <div class="course-shell">
        <h1>TAHelper</h1>
        <p class="sub">Choose a course.</p>
        <?php if (!$courses): ?>
            <p class="course-note">No courses are installed. Each course is a directory under the web root
               containing an <code>index.php</code> and a <code>json/</code> link to its data.</p>
        <?php else: ?>
            <ul>
                <?php foreach ($courses as $c): ?>
                    <li><a class="course" href="/<?= rawurlencode($c) ?>/"><?= htmlspecialchars($c, ENT_QUOTES, 'UTF-8') ?></a></li>
                <?php endforeach; ?>
            </ul>
        <?php endif; ?>
    </div>
</body>
</html>
