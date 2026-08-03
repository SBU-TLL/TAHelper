#!/usr/bin/env bash
# DDEV-only: provision the env-supplied files this app expects but never commits.
#
# TAHelper deliberately keeps three files out of git because each environment
# supplies its own (production ships real ones):
#   www/iam.php            - returns the logged-in identity from Shibboleth
#   www/.htaccess          - the Shibboleth session gate
#   www/json/dataDev.json  - the course roster (TAs, students, groups)
# Without them a fresh clone can't even boot, so we drop dev copies in on start.
# Existing files are never overwritten.
set -u

SRC=/mnt/ddev_config/tahelper   # .ddev/ is mounted here inside the web container
APP=/var/www/html/www

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

install_if_missing "$SRC/iam-template.php" "$APP/iam.php"
install_if_missing "$SRC/htaccess"         "$APP/.htaccess"
install_if_missing "$SRC/dataDev.json"     "$APP/json/dataDev.json"

# Runtime output dirs (gitignored, so absent on a fresh clone).
mkdir -p "$APP/studentResponses" "$APP/groupResponses"
