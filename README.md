# TAHelper

A tool for helping teaching assistants take attendance and record observations
about the students and groups they supervise.

TAs sign in, drill down **Session → Group → Student**, and fill in a short
questionnaire per student (and per group). Responses are stored as one JSON file
per evaluation and can be exported to CSV.

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
roster (24 invented students, placeholder photos). See "Student data" below.

### What `ddev start` provisions

These files are intentionally **not** in git — each environment supplies its own:

| File | Provisioned from |
|---|---|
| `www/iam.php` | `.ddev/tahelper/iam-template.php` (production ships a real one) |
| `www/.htaccess` | `.ddev/tahelper/htaccess` (the Shibboleth gate) |
| `www/json/data.json` | `.ddev/tahelper/data.sample.json` (**synthetic** roster) |
| `www/json/templates.json` | `.ddev/tahelper/templates.sample.json` |
| placeholder photos | generated into the `images/` storage dir |

Nothing existing is overwritten, so your local edits survive restarts.

### Handy commands

```bash
ddev roster                     # regenerate the synthetic roster + photos
ddev roster --students 60 --sections 3
ddev photos --verify www/json/data.json   # check photo filenames match a roster
ddev roster-real BIO201         # import the REAL roster (staff only — see below)
```

---

## Student data

**The real roster must never be committed, and is not needed to develop.**

* `www/json/data.json`, `templates.json`, `log.json` are **generated** and
  gitignored. On production they are produced by `makeJSON.py`; locally they are
  synthetic.
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

**2. Import the roster.**

```bash
ddev roster-real BIO201        # or BIO354
```

This **writes** `www/json/data.json`, `templates.json` and `log.json`. The text
it prints is only a progress log — do **not** redirect it to a file (`> x.json`
gives you a log full of student data, not a roster). Add `TAHELPER_VERBOSE=1`
for per-tab detail.

Both the roster *and* the questionnaires come from the spreadsheet, so this is
also how you pick up edited questions.

**3. Get the photos.** These cannot be fetched automatically — see
[`extractStudentsFromHTML.py`](#extractstudentsfromhtmlpy--student-photos)
below. Save the SOLAR roster pages, then:

```bash
ddev photos --in ./solar-pages --out ./solar-pages/out
ddev photos --verify www/json/data.json     # who would have no photo?
```

Copy the resulting `{Name},{hash}.jpg` files into the course's images directory
(`www/images`, which is a symlink into the userData storage).

**4. When you're done**, get the real data off your machine:

```bash
ddev roster                    # restores the synthetic roster
```

> ⚠️ While a real import is in place, your working copy holds real student
> names and netIDs. They are gitignored and the pre-commit hook blocks
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

### `extractStudentsFromHTML.py` — student photos

```bash
python3 extractStudentsFromHTML.py --in ./saved-solar --out ./Temp
python3 extractStudentsFromHTML.py --verify www/json/data.json
```

Input is SOLAR class-roster pages **saved to disk** (each `<name>.html` plus its
`<name>_files/` folder). Copy the resulting images into the course's `images/`
storage directory.

**These scripts do not log in to SOLAR.** Photos can only come from pages you
save yourself: open the class roster in SOLAR with photos visible, *File → Save
Page As… → "Web page, complete"* (giving `<name>.html` + `<name>_files/`), put
those in one folder, and pass it with `--in`.

Note also that `makeJSON.py` **writes files**; its stdout is only a log. Piping
it to a `.json` file does not produce a roster — and the file would contain raw
student data.

`--verify` compares generated filenames against a roster and reports students
who would have no photo — worth running after any import, because a mismatch is
otherwise silent. The usual cause is name formatting: `makeJSON.py` builds
`"First Last"` from the sheet, while SOLAR's `MAIN_SNAME` is often `"Last,First"`.

### `makeSyntheticRoster.py` — fake data for development

```bash
python3 makeSyntheticRoster.py --students 40 --sections 3 --force
```

Produces the same shape as `makeJSON.py` with invented people and placeholder
photos. No credentials, no network.

---

## Layout

```
www/                     web root (docroot)
  index.html  js/  css/  the jQuery SPA
  iam.php                identity (env-supplied)
  evaluationInfo.php     read/write one evaluation
  responseInfo.php       CSV export / clear
  upload.php             photo upload
  json/                  roster + questionnaires (generated, gitignored)
  studentResponses/ groupResponses/ images/   → symlinks to userData storage
makeJSON.py  extractStudentsFromHTML.py  makeSyntheticRoster.py   pipeline
requirements.txt         python deps (installed into the DDEV web image)
```

## Known issues

* `evaluationInfo.php` and `responseInfo.php` perform **no server-side
  authorization** — any signed-in user can read or overwrite another TA's
  evaluations by changing the `filename` parameter. Needs fixing before this is
  relied on for grades.
* Evaluations are keyed `{evaluator}_{group}_{student}` with no date, so saving
  again **overwrites** the previous record rather than keeping history.
