#!/usr/bin/env python3
"""Download a course's Google Sheet as CSV so you can inspect it yourself.

makeJSON.py reads the sheet and immediately turns it into json/data.json, so
there is no way to see what the spreadsheet actually contains before it has been
transformed. This script is the missing look-before-you-import step: it dumps
every tab verbatim to CSV, and prints an inventory of the workbook.

    python3 dumpSheet.py BIO354 --list        # just the tab names, writes nothing
    python3 dumpSheet.py BIO354               # dump every tab to sheet-dump/BIO354/
    python3 dumpSheet.py BIO354 --photos ./solar-pages/out

The last form answers "why don't the roster and the photos match?" without
generating a roster first: the join between the two halves of the pipeline is
sha256(Student ID), so it hashes the sheet's Student ID column and checks those
hashes against the {Name},{sha256}.jpg files the photo extractor produced.

>>> READS REAL STUDENT DATA <<<  The CSVs contain names, netIDs and raw student
IDs. They are written gitignored and mode 0600, and stdout deliberately stays
free of student data (only counts and masked samples) so that redirecting this
script's output can never create a file full of roster rows. Delete the dump
when you are done:  rm -rf sheet-dump/
"""
import argparse
import ast
import csv
import hashlib
import os
import re
import sys

from googleapiclient import discovery
from google.oauth2 import service_account

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
]

HERE = os.path.dirname(os.path.abspath(__file__))

# Tabs makeJSON.py actually consumes — everything else in the workbook is
# ignored by the import, which is worth seeing when a roster looks wrong.
TABS_USED_BY_IMPORT = {
    "TA Groups", "Section Info", "Student Groups",
    "Student Evaluation", "Group Evaluation",
}

PHOTO_RE = re.compile(r",([0-9a-f]{64})\.(?:jpg|jpeg|png)$", re.IGNORECASE)


def load_sheet_ids():
    """Read SHEET_IDS out of makeJSON.py without importing it.

    makeJSON.py does its work at import time (it reads sys.argv and talks to
    Google), so it cannot be imported. Parsing the assignment keeps that file the
    single source of truth for course -> spreadsheet: adding a course there is
    enough, and there is no second copy of the map to drift out of date.
    """
    source = os.path.join(HERE, "makeJSON.py")
    try:
        with open(source) as fh:
            tree = ast.parse(fh.read())
    except OSError:
        return {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and any(
                isinstance(t, ast.Name) and t.id == "SHEET_IDS" for t in node.targets):
            try:
                return ast.literal_eval(node.value)
            except ValueError:
                return {}
    return {}


def resolve_credentials():
    """Same lookup as makeJSON.py, with the same guidance when it is missing."""
    secret_file = os.environ.get(
        "TAHELPER_CREDENTIALS", os.path.join(HERE, "client_secret.json"))
    if not os.path.exists(secret_file):
        raise SystemExit(
            f"Google service-account credentials not found at {secret_file}.\n"
            "This script reads the REAL course spreadsheet and needs the same key\n"
            "as makeJSON.py. Ask the maintainer for client_secret.json and put it\n"
            "in the repo root (it is gitignored).")
    return service_account.Credentials.from_service_account_file(secret_file, scopes=SCOPES)


def a1(tab):
    """Quote a tab name for use as an A1 range."""
    return "'" + tab.replace("'", "''") + "'"


def describe_file(credentials, spreadsheet_id):
    """When was the sheet last edited, and by whom? Best effort."""
    try:
        drive = discovery.build("drive", "v3", credentials=credentials)
        return drive.files().get(
            fileId=spreadsheet_id,
            fields="name,modifiedTime,lastModifyingUser(displayName)").execute()
    except Exception as exc:                                # noqa: BLE001
        print(f"  (could not read file metadata: {exc})")
        return {}


def safe_filename(tab):
    return re.sub(r"[^\w .()-]", "_", tab).strip() or "tab"


def write_csv(path, rows):
    """Write rows verbatim, padding the ragged tails Sheets returns."""
    width = max((len(r) for r in rows), default=0)
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        for row in rows:
            writer.writerow(list(row) + [""] * (width - len(row)))
    os.chmod(path, 0o600)


def mask(value):
    """Show enough of an id to recognise its shape, not enough to identify anyone."""
    if len(value) <= 4:
        return "*" * len(value)
    return value[:3] + "*" * (len(value) - 5) + value[-2:]


def normalise_name(name):
    """Order-insensitive name key, so 'Jane Doe' and 'Doe,Jane' compare equal."""
    tokens = re.findall(r"[a-z]+", name.lower())
    return " ".join(sorted(tokens))


def profile_ids(rows, header):
    """Describe the Student ID column: shape, blanks, duplicates, stray spaces.

    The pipeline joins roster to photos on sha256(Student ID), so a sheet holding
    a different identifier than SOLAR's EMPLID (netID, a dash-formatted id, an id
    with a stray space) can never match no matter how right the cohort is.
    """
    if "Student ID" not in header:
        return None
    idx = header.index("Student ID")
    raw = [r[idx] for r in rows if idx < len(r)]
    values = [v.strip() for v in raw if v.strip()]
    return {
        "rows": len(rows),
        "present": len(values),
        "blank": len(rows) - len(values),
        "unique": len(set(values)),
        "untrimmed": sum(1 for v in raw if v != v.strip() and v.strip()),
        "lengths": sorted({len(v) for v in values}),
        "all_digits": all(v.isdigit() for v in values) if values else False,
        "samples": values[:3],
        "hashes": {hashlib.sha256(v.encode("utf-8")).hexdigest() for v in values},
    }


def read_photo_dir(path):
    """Collect (hash, name) pairs from {Name},{sha256}.jpg filenames."""
    entries = []
    for root, _dirs, files in os.walk(path):
        for name in files:
            match = PHOTO_RE.search(name)
            if match:
                entries.append((match.group(1).lower(), name[:match.start()]))
    return entries


def compare_photos(sheet_rows, header, photo_dir):
    profile = profile_ids(sheet_rows, header)
    if profile is None:
        print("\n  Cannot compare: the Student Groups tab has no 'Student ID' column.")
        return

    photos = read_photo_dir(photo_dir)
    if not photos:
        raise SystemExit(
            f"\n  No '{{Name}},{{sha256}}.jpg' photos found under {photo_dir}.\n"
            "  Produce them first:  ddev photos --in <saved SOLAR pages> --out ./out")

    photo_hashes = {h for h, _ in photos}
    matched = profile["hashes"] & photo_hashes

    sheet_names = set()
    first = header.index("First Name") if "First Name" in header else None
    last = header.index("Last Name") if "Last Name" in header else None
    for row in sheet_rows:
        if first is not None and last is not None and max(first, last) < len(row):
            sheet_names.add(normalise_name(f"{row[first]} {row[last]}"))
    photo_names = {normalise_name(n) for _, n in photos}

    print(f"\n  photo files                : {len(photos)} ({len(photo_hashes)} distinct)")
    print(f"  sheet student ids          : {len(profile['hashes'])}")
    print(f"  MATCH on sha256(Student ID): {len(matched)}")
    print(f"  MATCH on name (any order)  : {len(sheet_names & photo_names)}")

    if matched:
        return
    print(
        "\n  Nothing joins. The two independent explanations are:\n"
        "    * different cohorts  — the sheet is not this term's roster.\n"
        "                           A name overlap near 0 above points here.\n"
        "    * different id       — the sheet's Student ID is not SOLAR's EMPLID\n"
        "                           (netID, dashes, leading zeros, stray space).\n"
        "                           A healthy name overlap with 0 hash matches\n"
        "                           points here.\n"
        f"  Sheet ids look like {[mask(s) for s in profile['samples']]}"
        f" (length {profile['lengths']}, all digits: {profile['all_digits']}).\n"
        "  SOLAR EMPLIDs are 9 digits. Open the CSV to compare the names by eye.")


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("course", help="course code, e.g. BIO354 (or set TAHELPER_SHEET_ID)")
    ap.add_argument("--out", dest="out_dir", default="sheet-dump",
                    help="where the CSVs are written (default: sheet-dump/)")
    ap.add_argument("--tab", dest="tabs", action="append", metavar="NAME",
                    help="dump only this tab (repeatable; default: every tab)")
    ap.add_argument("--list", action="store_true",
                    help="show the workbook inventory and exit, writing nothing")
    ap.add_argument("--photos", metavar="DIR",
                    help="cross-check the Student ID column against extracted photos")
    args = ap.parse_args()

    sheet_ids = load_sheet_ids()
    spreadsheet_id = os.environ.get("TAHELPER_SHEET_ID") or sheet_ids.get(args.course)
    if not spreadsheet_id:
        raise SystemExit(
            f"No spreadsheet configured for '{args.course}'. Known courses: "
            f"{', '.join(sorted(sheet_ids)) or '(none found in makeJSON.py)'}. "
            "Set TAHELPER_SHEET_ID to override.")

    credentials = resolve_credentials()
    service = discovery.build("sheets", "v4", credentials=credentials)
    sheets = service.spreadsheets()

    meta = sheets.get(spreadsheetId=spreadsheet_id).execute()
    info = describe_file(credentials, spreadsheet_id)

    print(f'Spreadsheet: "{meta.get("properties", {}).get("title", "?")}"')
    print(f"  id           {spreadsheet_id}")
    print(f"  url          https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit")
    if info.get("modifiedTime"):
        who = info.get("lastModifyingUser", {}).get("displayName", "unknown")
        print(f"  last edited  {info['modifiedTime']} by {who}")

    tab_names = [s["properties"]["title"] for s in meta.get("sheets", [])]
    print(f"\n{len(tab_names)} tab(s)  (* = read by makeJSON.py):")
    for tab in tab_names:
        used = "*" if tab in TABS_USED_BY_IMPORT else " "
        print(f"  {used} {tab}")
    missing = TABS_USED_BY_IMPORT - set(tab_names)
    if missing:
        print(f"\n  WARNING: makeJSON.py expects tabs that are not here: {sorted(missing)}")

    wanted = args.tabs or tab_names
    unknown = [t for t in wanted if t not in tab_names]
    if unknown:
        raise SystemExit(f"\nNo such tab(s): {unknown}")

    if args.list and not args.photos:
        print("\n(--list: nothing written)")
        return

    out_dir = os.path.join(args.out_dir, args.course)
    if not args.list:
        os.makedirs(out_dir, exist_ok=True)

    print()
    student_rows, student_header = [], []
    for tab in wanted:
        values = sheets.values().get(
            spreadsheetId=spreadsheet_id, range=a1(tab)).execute().get("values", [])
        if not values:
            print(f"  {tab}: empty")
            continue
        header, rows = values[0], values[1:]
        if tab == "Student Groups":
            student_header, student_rows = header, rows

        if args.list:
            print(f"  {tab}: {len(rows)} rows — columns: {', '.join(header)}")
            continue

        path = os.path.join(out_dir, safe_filename(tab) + ".csv")
        write_csv(path, values)
        print(f"  {tab}: {len(rows)} rows -> {path}")
        print(f"      columns: {', '.join(header)}")

        profile = profile_ids(rows, header)
        if profile:
            print(f"      Student ID: {profile['present']} present, "
                  f"{profile['blank']} blank, {profile['unique']} unique, "
                  f"length {profile['lengths']}, all digits: {profile['all_digits']}")
            if profile["untrimmed"]:
                print(f"      NOTE: {profile['untrimmed']} id(s) have surrounding "
                      "whitespace (makeJSON.py strips before hashing)")
            print(f"      e.g. {[mask(s) for s in profile['samples']]}")

    if not args.list:
        print(f"\nWrote CSVs to {os.path.abspath(out_dir)} (mode 0600, gitignored).")
        print("Open them in Excel/Numbers to check the roster BEFORE importing.")
        print("Delete them when you are done:  rm -rf " + os.path.abspath(args.out_dir))

    if args.photos:
        if not student_rows:
            print("\n  No 'Student Groups' rows read, so there is nothing to compare.")
        else:
            compare_photos(student_rows, student_header, args.photos)


if __name__ == "__main__":
    sys.exit(main())
