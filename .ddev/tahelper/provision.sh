#!/usr/bin/env bash
# DDEV-only: make a fresh clone runnable WITHOUT any real student data.
#
# Provisions the files the app needs but git deliberately does not carry:
#   www/iam.php            - identity from Shibboleth (production ships its own)
#   www/.htaccess          - the Shibboleth session gate
#   www/json/data.json     - SYNTHETIC roster (the real one is generated on the
#                            production host by makeJSON.py and is gitignored)
#   www/json/templates.json- questionnaire definitions
#   placeholder photos     - so the images/ code path is exercised locally
# plus the targets of the production storage symlinks, and a git guard that
# refuses to commit a real roster.
#
# Nothing here ever overwrites a file that already exists.
set -u

SRC=/mnt/ddev_config/tahelper   # .ddev/ is mounted here inside the web container
APP=/var/www/html/www
REPO=/var/www/html
DATA=/var/www/userData/TAHelper/BIO201

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
    echo "tahelper: provisioned $(basename "$dest")"
}

install_if_missing "$SRC/iam-template.php"      "$APP/iam.php"
install_if_missing "$SRC/htaccess"              "$APP/.htaccess"
install_if_missing "$SRC/data.sample.json"      "$APP/json/data.json"
install_if_missing "$SRC/templates.sample.json" "$APP/json/templates.json"

# Targets of the committed production storage symlinks (studentResponses,
# groupResponses, images all point at ../../userData/TAHelper/BIO201/...).
mkdir -p "$DATA/studentResponses" "$DATA/groupResponses" "$DATA/images"

# Placeholder photos for the synthetic roster, so student cards aren't broken
# images. Best effort: skipped if the images dir already has content.
if [ -z "$(ls -A "$DATA/images" 2>/dev/null)" ]; then
    if python3 "$REPO/makeSyntheticRoster.py" --out-dir /tmp/tahelper-seed \
            --image-dir "$DATA/images" --force >/dev/null 2>&1; then
        echo "tahelper: generated placeholder photos"
    fi
fi

# --- guard: never let a real roster get committed ---------------------------
# The generated json files are gitignored, but `git add -f` (or a future change
# to .gitignore) could still stage them. This hook blocks that, and blocks the
# service-account credentials outright.
HOOK="$REPO/.git/hooks/pre-commit"
if [ -d "$REPO/.git/hooks" ] && [ ! -e "$HOOK" ]; then
    cat > "$HOOK" <<'HOOKEOF'
#!/bin/sh
# Installed by .ddev/tahelper/provision.sh — blocks committing real student data.
# --diff-filter=ACM: only files being ADDED or MODIFIED. Removing these paths
# from tracking (a deletion) is exactly what we want people to be able to do.
blocked=$(git diff --cached --name-only --diff-filter=ACM | grep -E \
  -e '^(www/json/(data|templates|log)\.json|client_secret\.json)$' \
  -e '(^|/)(Temp|out)/' \
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
    chmod +x "$HOOK"
    echo "tahelper: installed pre-commit guard against committing real roster data"
fi
