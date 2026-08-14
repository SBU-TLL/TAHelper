# Course data

One directory per course, holding everything that course accumulates:

```
data/<COURSE>/
  json/               data.json (roster), templates.json (questionnaires), log.json
  images/             student photos, "{Name},{sha256(StudentID)}.jpg"
  studentResponses/   one JSON file per saved student evaluation
  groupResponses/     one JSON file per saved group evaluation
```

**This directory is inside the repository but outside the web root**, so Apache
never serves it; the only way in is `roster.php` / `photo.php`, which check that
the caller is on that course's staff list.

**None of it is ever committed.** Everything here except this file is gitignored,
and `ddev start` installs a pre-commit hook that refuses anything under `data/`.
It is real student data — names, netIDs and faces — living in a git checkout, so
treat the two guards as load-bearing rather than tidiness.

Two consequences worth knowing:

* **`git clean -xdf` deletes all of it**, because ignored files are exactly what
  that command removes. Rosters can be re-imported (`ddev roster-real <COURSE>`)
  but saved evaluations cannot.
* Nothing here is created by a clone. `ddev start` builds the directories and
  seeds a synthetic roster for every course it finds under `www/`.
