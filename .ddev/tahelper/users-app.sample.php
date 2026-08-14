<?php
/**
 * Extra IdP logins for THIS app, merged over the shared personas in
 * users-base.php (see authsources.php).
 *
 * Copied to .ddev/shib-idp/config/users-app.php — normally by
 * `ddev add-test-ta`, which
 * also adds the matching staff row to the course roster. The real file is
 * gitignored: these identities are per-developer scaffolding, not project
 * configuration, so committing them just accumulates other people's logins.
 *
 * Why this exists: the four shared personas (student/ta/professor/admin) are in
 * the SYNTHETIC roster, so they can sign in to a course seeded by
 * `ddev roster <COURSE>`. They are deliberately absent from a real imported
 * roster and, now that access is enforced per course, are refused there. A login
 * defined here plus a matching roster row is how you exercise a real roster.
 *
 * Local testing only: the IdP ships with the DDEV add-on and never runs in
 * production, and the roster row lives under data/, which is gitignored.
 */
return [
    'yournetid:yournetidpass' => [
        'cn' => ['yournetid'],
        'eppn' => ['yournetid@stonybrook.edu'],
        'mail' => ['yournetid@stonybrook.edu'],
        'givenName' => ['Your'],
        'nickname' => ['Your'],
        'sn' => ['Name'],
        'displayName' => ['Your Name'],
        'affiliation' => ['employee@stonybrook.edu'],
    ],
];
