#!/usr/bin/env python3
"""Generate a SYNTHETIC roster (and matching placeholder photos) for local dev.

Local development must never need the real course roster. This produces data in
exactly the shape makeJSON.py emits — same keys, same sha256-of-student-id
convention, same {Name},{hash}.jpg photo filenames — but with invented people,
so the app can be developed and demoed without touching student data.

No Google credentials, no network, no SOLAR pages required.

Usage:
    python3 makeSyntheticRoster.py                 # writes into www/json and www/images
    python3 makeSyntheticRoster.py --out-dir DIR --image-dir DIR
    python3 makeSyntheticRoster.py --students 40 --sections 2 --groups 4
"""
import argparse
import hashlib
import json
import os
import random

# Roles exactly as TAHelperUI.js expects them (ROLES in www/js/TAHelperUI.js).
ROLE_PROFESSOR = "Professor"
ROLE_GTA = "GTAs"
ROLE_FACILITATOR = "Group Facilitator"

FIRST = ["Alex", "Bailey", "Casey", "Devon", "Emerson", "Finley", "Gray", "Harper",
         "Indigo", "Jules", "Kai", "Lennon", "Micah", "Noor", "Oakley", "Parker",
         "Quinn", "Reese", "Sage", "Tatum", "Umber", "Vale", "Wren", "Yuki"]
LAST = ["Adler", "Brooks", "Chen", "Diaz", "Ellis", "Farrow", "Gupta", "Hayes",
        "Ibrahim", "Jensen", "Kowalski", "Lombardi", "Mensah", "Nakamura",
        "Okafor", "Petrov", "Quintero", "Rivera", "Silva", "Tanaka"]


def hash_sid(sid: str) -> str:
    """Same convention as makeJSON.py / extractStudentsFromHTML.py."""
    return hashlib.sha256(sid.encode("utf-8")).hexdigest()


def placeholder_png(path: str, label: str) -> None:
    """Write a simple placeholder image; falls back to a 1x1 PNG without Pillow."""
    try:
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (240, 320), (232, 234, 238))
        draw = ImageDraw.Draw(img)
        draw.rectangle([0, 0, 239, 319], outline=(150, 155, 165), width=3)
        draw.text((14, 150), label[:22], fill=(60, 63, 70))
        img.save(path, "PNG")
    except ImportError:
        # 1x1 grey PNG, so the pipeline still works without Pillow installed.
        with open(path, "wb") as fh:
            fh.write(bytes.fromhex(
                "89504e470d0a1a0a0000000d49484452000000010000000108020000009077"
                "3dF80000000c4944415408d763a8a8a800030000ffff03000006000557bfab"
                "d40000000049454e44ae426082".replace("F8", "f8")))


def build(students: int, sections: int, groups_per_section: int, seed: int):
    random.seed(seed)
    names = [f"{f} {l}" for f in FIRST for l in LAST]
    random.shuffle(names)

    group_ids = [f"{s}-{g}" for s in range(1, sections + 1)
                 for g in range(1, groups_per_section + 1)]

    data = {
        "Section Info": {"Section": {
            str(s): t for s, t in zip(
                range(1, sections + 1),
                ["8:25AM-9:20AM", "9:30AM-10:25AM", "11:00AM-11:55AM",
                 "12:30PM-1:25PM", "2:00PM-2:55PM", "3:30-4:25PM"])
        }},
        "Student Groups": {},
        "TA Groups": {},
    }

    # --- students -----------------------------------------------------------
    roster = []
    for i in range(students):
        name = names[i % len(names)]
        first, last = name.split(" ", 1)
        netid = f"{first[0]}{last}{i}".lower()[:12]
        sid = f"9{i:08d}"                      # obviously fake student id
        key = hash_sid(sid)
        data["Student Groups"][key] = {
            "GTAGroups": [],
            "Group": group_ids[i % len(group_ids)],
            "Name": name,
            "NetID": netid,
            "SID": key,                        # hashed, exactly like makeJSON.py
            "Warning": "",
        }
        roster.append((name, key))

    # --- staff: one per role the UI implements ------------------------------
    # These netIDs match the bundled test-IdP personas, so `student`, `ta` and
    # `professor` logins land on a real role without any extra mapping.
    data["TA Groups"]["testprof"] = {
        "GTAGroups": [], "Group": list(group_ids), "Name": "Test Professor",
        "NetID": "testprof", "Type": ROLE_PROFESSOR,
        "Evaluators": [{"Name": "Test GTA", "NetID": "testta"},
                       {"Name": "Test Facilitator", "NetID": "teststudent"}],
    }
    data["TA Groups"]["testta"] = {
        "GTAGroups": [], "Group": list(group_ids), "Name": "Test GTA",
        "NetID": "testta", "Type": ROLE_GTA,
        "Evaluators": [{"Name": "Test Facilitator", "NetID": "teststudent"}],
    }
    data["TA Groups"]["teststudent"] = {
        "GTAGroups": [], "Group": group_ids[:2], "Name": "Test Facilitator",
        "NetID": "teststudent", "Type": ROLE_FACILITATOR,
    }
    data["TA Groups"]["testadmin"] = {
        "GTAGroups": [], "Group": list(group_ids), "Name": "Test Admin",
        "NetID": "testadmin", "Type": ROLE_PROFESSOR,
        "Evaluators": [],
    }
    return data, roster


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out-dir", default=os.path.join(here, "www", "json"),
                    help="where data.json is written (default: www/json)")
    ap.add_argument("--image-dir", default=os.path.join(here, "www", "images"),
                    help="where placeholder photos are written (default: www/images)")
    ap.add_argument("--students", type=int, default=24)
    ap.add_argument("--sections", type=int, default=2)
    ap.add_argument("--groups", type=int, default=3, help="groups per section")
    ap.add_argument("--seed", type=int, default=1, help="keep output reproducible")
    ap.add_argument("--no-images", action="store_true")
    ap.add_argument("--force", action="store_true",
                    help="overwrite an existing data.json")
    args = ap.parse_args()

    data, roster = build(args.students, args.sections, args.groups, args.seed)

    os.makedirs(args.out_dir, exist_ok=True)
    out = os.path.join(args.out_dir, "data.json")
    if os.path.exists(out) and not args.force:
        print(f"refusing to overwrite {out} (use --force)")
        return
    with open(out, "w") as fh:
        json.dump(data, fh, sort_keys=True, indent=4, separators=(",", ": "))
    print(f"wrote {out}: {len(data['Student Groups'])} students, "
          f"{len(data['TA Groups'])} staff")

    if not args.no_images:
        os.makedirs(args.image_dir, exist_ok=True)
        for name, key in roster:
            placeholder_png(os.path.join(args.image_dir, f"{name},{key}.jpg"), name)
        print(f"wrote {len(roster)} placeholder photos to {args.image_dir}")


if __name__ == "__main__":
    main()
