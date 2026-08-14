<?php
/**
 * The SPA shell, shared by every course.
 *
 * A course entry point (www/<COURSE>/index.php) requires lib/course_boot.php —
 * which resolves the course, checks the caller is on its staff list and builds
 * $TAHELPER_USER — and then this file. The course and the user are emitted into
 * the page so the app infers neither from the URL nor from a second request.
 * Static assets are absolute (/js, /css) because they are shared; every data URL
 * stays relative so it resolves against this course's directory.
 */
$course = $TAHELPER_COURSE ?? null;
$user   = $TAHELPER_USER ?? null;
if (!is_string($course) || !is_array($user)) {
    http_response_code(500);
    exit("app_shell.php: the entry point must require lib/course_boot.php first.\n");
}
?>
<!DOCTYPE html>
<html lang="en" dir="ltr">

<head>
  <meta charset="utf-8">
  <title>TAHelper <?= htmlspecialchars($course, ENT_QUOTES, 'UTF-8') ?></title>

  <link href="/css/index.css" rel="stylesheet" type="text/css">
  <link href="/css/css-loader.css" rel="stylesheet" type="text/css">
<script src="https://code.jquery.com/jquery-3.6.0.min.js" integrity="sha256-/xUj+3OJU5yExlq6GSYGSHk7tPXikynS7ogEvDej/m4=" crossorigin="anonymous"></script>

<!-- <script src="https://code.jquery.com/ui/1.12.1/jquery-ui.js"></script> -->
  <script>
    window.TAHELPER_COURSE = <?= json_encode($course) ?>;
    // Identity, straight from the Shibboleth session. This replaced a separate
    // iam.php request for values the server already had on hand.
    window.TAHELPER_USER = <?= json_encode($user) ?>;
  </script>
  <script src="/js/index.js"></script>
</head>

<body>
  <div class="loader loader-bar is-active" data-text data-blink></div>
  <div id="left-menu" class="menu"></div>
  <div id="right-menu" class="menu"></div>
  <div id="header"></div>
  <div id="content" class="flexContainer"></div>
</body>

</html>
