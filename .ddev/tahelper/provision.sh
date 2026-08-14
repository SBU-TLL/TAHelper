#!/usr/bin/env bash
# DDEV-only: make a fresh clone runnable WITHOUT any real student data.
#
# One deployment serves several courses, each from its own directory under the
# web root (www/BIO201/, www/BIO354/, …). Their data lives in data/<COURSE>/ at
# the repo root — inside the repository but OUTSIDE the web root, so it is never
# served over HTTP. Everything under data/ is gitignored and the pre-commit hook
# below refuses it, because it is real student data sitting in a git checkout.
#
# Provisions the files the app needs but git deliberately does not carry:
#   www/.htaccess                - the Shibboleth session gate
#   <COURSE>/json/data.json      - SYNTHETIC roster (the real one comes from
#                                  makeJSON.py and is never committed)
#   <COURSE>/json/templates.json - questionnaire definitions
#   placeholder photos           - so the images/ code path is exercised locally
# plus the symlink targets themselves, and a git guard against committing a
# real roster.
#
# Nothing here ever overwrites a file that already exists.
set -u

SRC=/mnt/ddev_config/tahelper   # .ddev/ is mounted here inside the web container
APP=/var/www/html/www
REPO=/var/www/html
STORAGE=/var/www/html/data

# Courses are discovered from the web root rather than listed here, so adding
# www/<COURSE>/ to the repo is all it takes.
# A course IS its code directory; its data directory is created below if absent,
# so a fresh clone (which carries no data at all) still provisions correctly.
COURSES=$(cd "$APP" && for d in */; do
    d=${d%/}
    [ -f "$d/index.php" ] && echo "$d"
done)

install_if_missing() {
    local src="$1" dest="$2"
    if [ -e "$dest" ]; then
        return
    fi
    if [ ! -e "$src" ]; then
        echo "tahelper: WARNING: template missing: $src" >&2
        return
    fi
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    echo "tahelper: provisioned ${dest#$APP/}"
}

install_if_missing "$SRC/htaccess"         "$APP/.htaccess"

for COURSE in $COURSES; do
    DATA="$STORAGE/$COURSE"
    mkdir -p "$DATA/json" "$DATA/studentResponses" "$DATA/groupResponses" "$DATA/images"

    install_if_missing "$SRC/data.sample.json"      "$DATA/json/data.json"
    install_if_missing "$SRC/templates.sample.json" "$DATA/json/templates.json"

    # The UI's "last import" panel fetches json/log.json; only makeJSON.py writes
    # one, so without this the panel 404s on a synthetic roster.
    if [ ! -e "$DATA/json/log.json" ]; then
        printf '{\n    "lastImport": "%s (synthetic roster)"\n}\n' \
            "$(date '+%d/%m/%Y %H:%M:%S')" > "$DATA/json/log.json"
        echo "tahelper: $COURSE: wrote a placeholder log.json"
    fi

    # Placeholder photos for the synthetic roster, so student cards aren't broken
    # images. Best effort: skipped if the images dir already has content.
    if [ -z "$(ls -A "$DATA/images" 2>/dev/null)" ]; then
        if python3 "$REPO/makeSyntheticRoster.py" --out-dir /tmp/tahelper-seed-$COURSE \
                --image-dir "$DATA/images" --force >/dev/null 2>&1; then
            echo "tahelper: $COURSE: generated placeholder photos"
        fi
    fi
done

# --- guard: never let a real roster get committed ---------------------------
# The generated json files are gitignored, but `git add -f` (or a future change
# to .gitignore) could still stage them. This hook blocks that, and blocks the
# service-account credentials outright.
HOOK="$REPO/.git/hooks/pre-commit"
MARKER="Installed by .ddev/tahelper/provision.sh"
WANT=$(mktemp)
cat > "$WANT" <<'HOOKEOF'
#!/bin/sh
# Installed by .ddev/tahelper/provision.sh — blocks committing real student data.
# --diff-filter=ACM: only files being ADDED or MODIFIED. Removing these paths
# from tracking (a deletion) is exactly what we want people to be able to do.
blocked=$(git diff --cached --name-only --diff-filter=ACM \
  | grep -vE '^data/README\.md$' \
  | grep -E \
  -e '^(data/|client_secret\.json$)' \
  -e '(^|/)(Temp|out|sheet-dump)/' \
  -e '_files/' \
  -e 'SA_LEARNING_MANAGEMENT' \
  -e ',[0-9a-f]{64}\.(jpg|jpeg|png|JPG)$' || true)
if [ -n "$blocked" ]; then
    echo "ERROR: refusing to commit files that may contain real student data:" >&2
    echo "$blocked" | sed 's/^/  /' >&2
    echo "" >&2
    echo "These are generated from the live roster and are gitignored on purpose." >&2
    echo "Local development uses the synthetic roster (makeSyntheticRoster.py)." >&2
    echo "If you are certain, bypass with: git commit --no-verify" >&2
    exit 1
fi
HOOKEOF

# Install it, and keep it current: an existing hook that WE wrote gets refreshed
# when the guard changes (a clone set up before a new data type existed would
# otherwise keep an outdated guard forever). A hook somebody else wrote is left
# strictly alone.
if [ -d "$REPO/.git/hooks" ]; then
    if [ ! -e "$HOOK" ]; then
        cp "$WANT" "$HOOK"
        chmod +x "$HOOK"
        echo "tahelper: installed pre-commit guard against committing real roster data"
    elif grep -qF "$MARKER" "$HOOK" && ! cmp -s "$WANT" "$HOOK"; then
        cp "$WANT" "$HOOK"
        chmod +x "$HOOK"
        echo "tahelper: updated pre-commit guard against committing real roster data"
    fi
fi
rm -f "$WANT"
