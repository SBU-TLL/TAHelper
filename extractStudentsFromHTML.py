#!/usr/bin/env python3
"""Extract student photos from saved SOLAR class-roster pages.

Input  : SOLAR pages saved to disk — each <name>.html plus its <name>_files/
         directory (the script reads <name>_files/SA_LEARNING_MANAGEMENT.SS_FACULTY.html).
Output : one image per student, named  {Name},{sha256(StudentID)}.jpg

That filename is the contract with the rest of the app: makeJSON.py stores the
same sha256 as each student's "SID", and TAHelperUI.js requests
    images/${student.Name},${student.SID}.jpg
so the hash is what links a roster row to a photo without ever exposing a raw
student ID to the browser.

Usage:
    python3 extractStudentsFromHTML.py                       # ./ -> ./Temp
    python3 extractStudentsFromHTML.py --in DIR --out DIR
    python3 extractStudentsFromHTML.py --verify www/json/data.json
        ^ don't copy anything; just report which roster students would get a
          photo and which would silently show a broken image.
"""
import argparse
import glob
import hashlib
import json
import os
import re
import shutil

from bs4 import BeautifulSoup

ROSTER_PAGE = "SA_LEARNING_MANAGEMENT.SS_FACULTY.html"
BLANK_IMAGE = "no-image.png"


def hash_sid(sid: str) -> str:
    """sha256 of the student id.

    NOTE: the id is stripped first. makeJSON.py does `.strip()` on the value it
    reads from the sheet, so any stray whitespace scraped out of the SOLAR HTML
    would otherwise produce a different hash and the photo would never match.
    """
    return hashlib.sha256(sid.strip().encode("utf-8")).hexdigest()


def make_blank_image(path: str) -> None:
    try:
        from PIL import Image
        Image.new("RGB", (800, 1280), (255, 255, 255)).save(path, "PNG")
    except ImportError:
        open(path, "wb").close()


def scrape(in_dir: str):
    """Yield (name, student_id, photo_path) for every student found."""
    blank = os.path.join(in_dir, BLANK_IMAGE)
    if not os.path.exists(blank):
        make_blank_image(blank)

    for html_file in sorted(glob.glob(os.path.join(in_dir, "*.html"))):
        resource_dir = f"{html_file.split('.html')[0]}_files"
        page = os.path.join(resource_dir, ROSTER_PAGE)
        if not os.path.exists(page):
            print(f"  skip {os.path.basename(html_file)}: no {ROSTER_PAGE}")
            continue

        with open(page, encoding="utf-8", errors="replace") as fh:
            soup = BeautifulSoup(fh.read(), "html.parser")

        ids = [i.get_text() for i in soup.find_all("span", {"id": re.compile("MAIN_EMPLID")})]
        names = [i.get_text() for i in soup.find_all("span", {"id": re.compile("MAIN_SNAME")})]

        photos = []
        for div in soup.find_all("div", {"id": re.compile("EMPL_PHOTO_EMPLOYEE_PHOTO")}):
            tag = div.find("img")
            if not tag:
                photos.append(blank)
            else:
                photos.append(os.path.join(resource_dir, tag["src"].split("/")[1]))

        for idx, sid in enumerate(ids):
            name = names[idx].strip() if idx < len(names) else ""
            photo = photos[idx] if idx < len(photos) else blank
            yield name, sid.strip(), photo


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--in", dest="in_dir", default=".",
                    help="directory holding the saved SOLAR .html pages (default: .)")
    ap.add_argument("--out", dest="out_dir", default="Temp",
                    help="where photos are written (default: Temp)")
    ap.add_argument("--verify", metavar="DATA_JSON", default=None,
                    help="compare against a roster instead of copying photos")
    args = ap.parse_args()

    found = list(scrape(args.in_dir))
    print(f"found {len(found)} students in {os.path.abspath(args.in_dir)}")

    if not found:
        print(
            "\n  No saved SOLAR pages here. This script does NOT log in to SOLAR —\n"
            "  it reads pages you have already saved to disk:\n"
            "    1. open the class roster in SOLAR (with photos shown)\n"
            "    2. save the page  (File > Save Page As… > 'Web page, complete')\n"
            "       which gives you  <name>.html  +  <name>_files/\n"
            "    3. put those in one folder and pass it:  --in <folder>\n")

    if args.verify:
        try:
            with open(args.verify) as fh:
                payload = json.load(fh)
            roster = payload["Student Groups"]
        except json.JSONDecodeError:
            raise SystemExit(
                f"{args.verify} is not valid JSON.\n"
                "Note: makeJSON.py WRITES the roster to json/data.json — its stdout is\n"
                "only a log, so redirecting it (`> file.json`) does not produce a roster\n"
                "(and would contain raw student data). Point --verify at the real file,\n"
                "e.g.  --verify www/json/data.json")
        except KeyError:
            raise SystemExit(
                f"{args.verify} has no 'Student Groups' key — is it a roster file?\n"
                "Expected the output of makeJSON.py / makeSyntheticRoster.py "
                "(e.g. www/json/data.json).")
        # roster is keyed by the hash; the app asks for "{Name},{SID}.jpg"
        expected = {f"{s['Name']},{s['SID']}.jpg" for s in roster.values()}
        produced = {f"{name},{hash_sid(sid)}.jpg" for name, sid, _ in found}

        matched = expected & produced
        print(f"\n  roster students : {len(expected)}")
        print(f"  photos produced : {len(produced)}")
        print(f"  MATCHED         : {len(matched)}")
        missing = sorted(expected - produced)
        extra = sorted(produced - expected)
        if missing:
            print(f"\n  {len(missing)} roster students would have NO photo, e.g.:")
            for m in missing[:5]:
                print(f"    {m}")
        if extra:
            print(f"\n  {len(extra)} photos match no roster student, e.g.:")
            for e in extra[:5]:
                print(f"    {e}")
        if missing or extra:
            print("\n  Mismatches are usually a name-format difference: makeJSON.py builds\n"
                  "  'First Last' from the sheet, while SOLAR's MAIN_SNAME is often\n"
                  "  'Last,First'. Compare a pair above before changing either script.")
        return

    os.makedirs(args.out_dir, exist_ok=True)
    written = 0
    for name, sid, photo in found:
        dest = os.path.join(args.out_dir, f"{name},{hash_sid(sid)}.jpg")
        try:
            shutil.copyfile(photo, dest)
            written += 1
        except OSError as exc:
            print(f"  {name}: {exc}")
    print(f"wrote {written} photos to {os.path.abspath(args.out_dir)}")


if __name__ == "__main__":
    main()
