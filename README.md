# TAHelper

A tool for helping teaching assistants take attendance and record observations
about the students and groups they supervise.

TAs sign in, drill down **Session → Group → Student**, and fill in a short
questionnaire per student (and per group). Responses are stored as one JSON file
per evaluation and can be exported to CSV.

**One deployment serves several courses.** Each course is a directory under the
web root — `/BIO201/`, `/BIO354/` — and they share all of the code. What differs
is the data each directory's symlinks point at, so a course cannot see another
course's roster, photos or responses. The bare URL lists the courses.

---

## Local development

```bash
ddev start          # everything below is provisioned automatically
```

Open the printed URL and sign in with one of the bundled test accounts
(password is the username + `pass`):

| Login | Role in the app | What they see |
|---|---|---|
| `professor` / `professorpass` | Professor | all sessions → groups → students |
| `ta` / `tapass` | GTAs | all sessions → groups → students |
| `student` / `studentpass` | Group Facilitator | straight to their own groups |

**No real student data is involved.** `ddev start` provisions a *synthetic*
roster per course (24 invented students, placeholder photos). See "Student data"
below.

### What `ddev start` provisions

These files are intentionally **not** in git — each environment supplies its own:

| File | Provisioned from |
|---|---|
| `www/.htaccess` | `.ddev/tahelper/htaccess` (the Shibboleth gate) |
| `data/<COURSE>/json/data.json` | `.ddev/tahelper/data.sample.json` (**synthetic** roster) |
| `data/<COURSE>/json/templates.json` | `.ddev/tahelper/templates.sample.json` |
| placeholder photos | generated into that course's `images/` storage dir |

Courses are discovered, not listed: any `www/<COURSE>/` with a matching
`data/<COURSE>/` is provisioned. Nothing existing is overwritten, so your
local edits — and a real roster you have imported — survive restarts.

### Handy commands

```bash
ddev roster BIO201                        # regenerate that course's synthetic roster
ddev roster BIO201 --students 60 --sections 3
ddev photos --course BIO354               # does this course have all its photos?
ddev sheet-dump BIO354 --list             # what is in the course spreadsheet?
ddev roster-real BIO354                   # import the REAL roster (staff — see below)
ddev add-test-ta BIO354 ta_netid ta_name    # a login that can reach a REAL roster
```

Every one of these takes the course as its first argument and touches only that
course. Run them with no argument to list the installed courses.

---

## Student data

**The real roster must never be committed, and is not needed to develop.**

* Each course's `json/data.json`, `templates.json` and `log.json` are
  **generated**, and live outside the repo under
  `data/<COURSE>/json/`. On production they are produced by
  `makeJSON.py`; locally they are synthetic.
* The Google service-account key (`client_secret.json`) is gitignored and is
  distributed out-of-band to staff who run the import — it is the only thing
  that unlocks the live roster. Only the empty `client_secret.example.json`
  template is in the repo.
* `ddev start` installs a **pre-commit hook** that refuses to commit the
  generated roster files, the credentials, or extracted SOLAR pages/photos.

### Importing the real roster (staff only)

Only needed if you are maintaining the live course — day-to-day development
should stay on the synthetic roster.

**1. Get the credentials.** Ask the maintainer for `client_secret.json` (the
Google service-account key) and drop it in the **repo root**, next to
`makeJSON.py`. It is gitignored. Without it the import stops with a message
telling you to use the synthetic generator instead.

**2. Look at the spreadsheet first.** The import transforms the sheet on the way
in, so if the result looks wrong you cannot tell whether the script or the sheet
is at fault. `dumpSheet.py` downloads the workbook untouched:

```bash
ddev sheet-dump BIO354 --list     # tab names + row counts, writes nothing
ddev sheet-dump BIO354            # every tab -> sheet-dump/BIO354/*.csv
```

Open the CSVs in Excel/Numbers. This is also how you check the sheet without a
Google account that has access to it — only the service account needs access.

**3. Import the roster.**

```bash
ddev roster-real BIO354        # or BIO201, or any installed course
```

This **writes** that course's `json/data.json`, `templates.json` and
`log.json` under `data/<COURSE>/json/`. The text
it prints is only a progress log — do **not** redirect it to a file (`> x.json`
gives you a log full of student data, not a roster). Add `TAHELPER_VERBOSE=1`
for per-tab detail.

Both the roster *and* the questionnaires come from the spreadsheet, so this is
also how you pick up edited questions.

**4. Get the photos.** These cannot be fetched automatically — see
[`extractStudentsFromHTML.py`](#extractstudentsfromhtmlpy--student-photos)
below. Save the SOLAR roster pages, then:

```bash
ddev photos --in ./solar-pages --out data/BIO354/images   # straight into storage
ddev photos --course BIO354                               # who has no photo?
```

`--out data/<COURSE>/images` writes straight through that course's symlink into
its storage, so there is nothing left to copy by hand.

**5. When you're done**, get the real data off your machine:

```bash
ddev roster BIO354             # restores that course's synthetic roster
rm -rf sheet-dump/             # and any spreadsheet dumps
```

> ⚠️ While a real import is in place, `data/` holds real student names and
> netIDs. They are gitignored and the pre-commit hook blocks
> committing them, but don't copy them elsewhere, and don't leave them lying
> around after you're finished.

**On the production host** run the script directly — with no
`TAHELPER_JSON_DIR` set it writes to the live path
(`/home/tltsecure/apache2/htdocs/<COURSE>/TAHelper/json/`):

```bash
python3 makeJSON.py BIO201
```

---

## The data pipeline

Two independent scripts, joined only by a SHA-256 hash of the student ID:

```
Google Sheet ──makeJSON.py──────────────> json/data.json      (roster)
 (one sheet,   service account            json/templates.json (questionnaires)
  5 tabs)      client_secret.json         json/log.json       (import timestamp)

saved SOLAR ──extractStudentsFromHTML.py─> {Name},{sha256(SID)}.jpg
 pages                                      (photos only, no JSON)

the app requests:  images/{Name},{SID}.jpg     ← SID *is* that hash
```

Hashing means the browser never sees a raw student ID, and the two halves of the
pipeline can be produced independently.

### `makeJSON.py` — roster import (**reads real student data**)

```bash
python3 makeJSON.py BIO201
```

Reads the tabs `TA Groups`, `Section Info`, `Student Groups`,
`Student Evaluation`, `Group Evaluation`. Note the **questionnaires live in the
spreadsheet**, not in code. Roles must be exactly `Professor`, `GTAs` or
`Group Facilitator` — anything else makes the app render a blank page.

Everything is overridable; defaults are the production values, so the production
host is unaffected:

| Variable | Default |
|---|---|
| `TAHELPER_JSON_DIR` | `/home/tltsecure/apache2/htdocs/<COURSE>/TAHelper/json/` |
| `TAHELPER_SHEET_ID` | built-in per-course map (BIO201, BIO354) |
| `TAHELPER_CREDENTIALS` | `client_secret.json` next to the script |

It exits with a clear message if the credentials are absent, pointing at the
synthetic generator instead.

### `dumpSheet.py` — look at the spreadsheet (**reads real student data**)

```bash
python3 dumpSheet.py BIO354 --list                        # inventory only
python3 dumpSheet.py BIO354                               # dump every tab to CSV
python3 dumpSheet.py BIO354 --photos ./solar-pages/out    # why don't they match?
```

Downloads the workbook verbatim — **every** tab, including ones `makeJSON.py`
ignores (marked in the listing), plus the title and when it was last edited. Use
it when a roster looks wrong, or when you have no Google account with access to
the sheet. Uses the same `client_secret.json` and `TAHELPER_SHEET_ID` /
`TAHELPER_CREDENTIALS` overrides as `makeJSON.py`, and reads the course →
spreadsheet map straight out of `makeJSON.py`, so there is only one such map.

`--photos DIR` diagnoses a roster that doesn't line up with the extracted
photos, **without** having to generate a roster first. The two halves of the
pipeline join on `sha256(Student ID)`, so it hashes the sheet's Student ID
column and compares against the `{Name},{sha256}.jpg` files, by hash *and* by
name. That separates the two possible causes:

| hash match | name match | meaning |
|---|---|---|
| 0 | 0 | different cohorts — the sheet isn't this term's roster |
| 0 | high | right people, wrong identifier — the sheet's `Student ID` isn't SOLAR's 9-digit EMPLID |

The CSVs contain names, netIDs and **raw** student IDs. They are written to
`sheet-dump/` (gitignored, mode 0600, blocked by the pre-commit hook) — delete
them when you are done. Only counts and masked samples go to stdout, so
redirecting the output cannot create a file full of student rows.

### `extractStudentsFromHTML.py` — student photos

```bash
python3 extractStudentsFromHTML.py --in ./saved-solar --out ./Temp
python3 extractStudentsFromHTML.py --verify data/BIO354/json/data.json \
                                   --images data/BIO354/images
```

Input is SOLAR class-roster pages **saved to disk** (each `<name>.html` plus its
`<name>_files/` folder). Point `--out` at `data/<COURSE>/images` to write them
straight into that course's storage.

**These scripts do not log in to SOLAR.** Photos can only come from pages you
save yourself: open the class roster in SOLAR with photos visible, *File → Save
Page As… → "Web page, complete"* (giving `<name>.html` + `<name>_files/`), put
those in one folder, and pass it with `--in`.

Note also that `makeJSON.py` **writes files**; its stdout is only a log. Piping
it to a `.json` file does not produce a roster — and the file would contain raw
student data.

There are two different questions here, and they need different flags:

| Question | Command |
|---|---|
| Does this course have the photos it needs **right now**? | `ddev photos --course BIO354` |
| Would extracting my saved SOLAR pages produce the right names? | `ddev photos --verify data/BIO354/json/data.json` |

`--verify` on its own compares the roster against what the **saved SOLAR pages**
under `--in` would produce — it never looks at a course's installed `images/`, so
in a multi-course checkout it happily compares one course's roster against
another course's export and reports everything missing. `--course` (or
`--verify … --images …`) compares against what is actually installed.

Either way, a mismatch is otherwise silent, so run one after any import. The
usual cause is name formatting: `makeJSON.py` builds `"First Last"` from the
sheet, while SOLAR's `MAIN_SNAME` is often `"Last,First"`.

### `makeSyntheticRoster.py` — fake data for development

```bash
python3 makeSyntheticRoster.py --students 40 --sections 3 --force
```

Produces the same shape as `makeJSON.py` with invented people and placeholder
photos. No credentials, no network.

---

## Layout

```
www/                       web root — CODE ONLY, no student data anywhere
  index.php                course picker (redirects if only one course)
  .htaccess                the Shibboleth gate (env-supplied)
  js/  css/                the jQuery SPA — SHARED by every course
  BIO201/                  one directory per course; six thin entry points
    index.php              the app
    roster.php             serves this course's JSON
    photo.php              serves this course's student photos
    evaluationInfo.php  responseInfo.php  upload.php
  BIO354/                  … identical
data/                      OUTSIDE the web root — the live course data
  BIO201/{json,images,studentResponses,groupResponses}
  BIO354/…                 (gitignored; see data/README.md)
lib/                       shared implementations, NOT web-servable
  course_boot.php          resolves the course, enforces its staff list, builds the user
  app_shell.php            the SPA page
  roster.php  photo.php  evaluationInfo.php  responseInfo.php  upload.php
makeJSON.py  extractStudentsFromHTML.py  makeSyntheticRoster.py   pipeline
dumpSheet.py               download the spreadsheet as CSV to inspect it
```

**No student data is reachable over HTTP except through a PHP endpoint that
checks the caller.** Rosters, photos and responses live in `data/<COURSE>/`,
inside the repository but outside the web root — see
[Where the data lives](#where-the-data-lives).

### Signing in against a real roster

The four bundled personas exist in the *synthetic* roster, so they can sign in to
a course seeded by `ddev roster <COURSE>`. They are deliberately absent from a
real imported roster and are refused there, which leaves no way to exercise one
locally. `ddev add-test-ta` closes that in one step:

```bash
ddev add-test-ta BIO354 ta_netid ta_name    # then: ddev restart
```

It adds the staff row to that course's local roster **and** registers the login
with the bundled IdP (`<netid>pass` by default, or `--password`). Both outputs
are gitignored — they are per-developer scaffolding, not project configuration;
`.ddev/tahelper/users-app.sample.php` documents the shape. Re-run it after any
`ddev roster-real`, which regenerates the roster from the spreadsheet and drops
the row.

### Access is per course

The web server only demands *a* Shibboleth session, so on its own it lets any
university netID reach any course. `lib/course_boot.php` closes that: every
entry point resolves the course, then requires the caller to appear in the
`TA Groups` section of **that course's** roster. Being staff on BIO201 gets you
a 403 on BIO354, with a message saying so rather than a blank page.

That is also why `json/` and `images/` are no longer inside `www/`: while they
were, Apache served them directly and no PHP check could apply.

### How one codebase serves several courses

`www/<COURSE>/index.php` sets `$TAHELPER_COURSE` and includes
`lib/course_boot.php`, which resolves `$TAHELPER_DATA` (that course's storage)
and `$TAHELPER_USER`. The shared implementations read and write only through
`$TAHELPER_DATA`, so they never need to know which course they are serving. The
page emits `window.TAHELPER_COURSE` and `window.TAHELPER_USER`; shared assets
are absolute (`/js`, `/css`) and every data URL stays relative.

### Adding a course

```bash
C=BIO101
mkdir -p www/$C
for f in index evaluationInfo responseInfo upload roster photo; do
  sed "s/BIO201/$C/" www/BIO201/$f.php > www/$C/$f.php
done
ddev restart          # creates data/$C and seeds a synthetic roster
```

Nothing else needs editing: a course *is* a directory under `www/` with an
`index.php`, and the picker, the provisioner and the `ddev` commands all discover
them from there. Its data directory is created for you.

## Known issues

* `evaluationInfo.php` and `responseInfo.php` perform **no server-side
  authorization** — any signed-in user can read or overwrite another TA's
  evaluations by changing the `filename` parameter. Needs fixing before this is
  relied on for grades.
* Evaluations are keyed `{evaluator}_{group}_{student}` with no date, so saving
  again **overwrites** the previous record rather than keeping history.

## Where the data lives

```
TAHelper/
  data/<COURSE>/{json,images,studentResponses,groupResponses}
  www/                          the web root — never contains data
```

Inside the repository, outside the web root. Apache cannot serve it, so the only
way in is `roster.php` / `photo.php`, both behind the per-course staff check.

**Nothing under `data/` is ever committed.** It is gitignored except for
`data/README.md`, and `ddev start` installs a pre-commit hook that refuses
anything else there. Both guards matter: this is real student data — names,
netIDs and faces — sitting in a git checkout.

> ⚠️ **`git clean -xdf` will delete every course's data**, because removing
> ignored files is exactly what that command does. It takes `client_secret.json`
> and any saved SOLAR exports with it. Rosters can be re-imported with
> `ddev roster-real <COURSE>`; **saved evaluations cannot be recovered**. Back
> `data/` up before cleaning the working tree.

Nothing here comes from a clone. `ddev start` creates the directories and seeds a
synthetic roster for every course it finds under `www/`. To reset one course:
`ddev roster <COURSE>` (synthetic) or `ddev roster-real <COURSE>` (re-import).
