<?php
// BIO201 entry point for the shared evaluationInfo endpoint. course_boot.php resolves this
// course's data directory and refuses anyone not on its staff list.
$TAHELPER_COURSE = 'BIO201';
require dirname(__DIR__, 2) . '/lib/course_boot.php';
require dirname(__DIR__, 2) . '/lib/evaluationInfo.php';
