# syntax=docker/dockerfile:1
###############################################################################
# Production image — TAHelper (TA evaluation SPA + PHP)
#
# Tech stack : jQuery SPA (index.html + js/ MVC) + 2 PHP endpoints —
#              evaluationInfo.php (GET template / saved response; POST saves per-
#              eval JSON to studentResponses/ & groupResponses/) and
#              responseInfo.php (download/clear responses as CSV). Data templates
#              in json/templates.json. jQuery/jQuery-UI load from a public CDN.
#              No database, no Composer.
# Web server : Apache (php:8.3-apache) — production ships a Shibboleth .htaccess
#              (see below); AllowOverride All lets it apply.
#
# Authentication — environment-provisioned "secret files" (NOT baked in):
#   The SPA fetches ./iam.php -> {cn, nickname, sn} (Shibboleth attrs), and keys
#   the user by cn into json/dataDev.json. iam.php and json/dataDev.json are
#   per-environment and are gitignored + EXCLUDED from this image. Production
#   MUST provide its own at runtime (mount / Ansible-provision):
#     * iam.php            — the REAL one reads $_SERVER Shibboleth attrs
#     * json/dataDev.json  — the environment's TA/Student group roster
#     * .htaccess          — the Shibboleth gate (this is the ONLY access control
#                            the endpoints have — they do no server-side authz)
#     * images/            — student photos (PII), if used
#   Baking the local MOCK iam.php (cn=testta) into prod would make every visitor
#   "testta" — hence the exclusion.
#
# Runs non-root (www-data) on unprivileged port 8080.
###############################################################################
FROM php:8.3-apache

# --- Apache modules (headers for parity; prod .htaccess is Shibboleth) ---
RUN set -eux; \
    a2enmod rewrite headers

# --- Run as a non-root user on an unprivileged port (8080) ---
RUN set -eux; \
    sed -ri 's/^Listen 80$/Listen 8080/' /etc/apache2/ports.conf; \
    sed -ri 's/:80>/:8080>/' /etc/apache2/sites-available/000-default.conf

# --- Security hardening (suppress server tokens/signature, TRACE, ETag) ---
RUN set -eux; \
    { \
      echo 'ServerTokens Prod'; \
      echo 'ServerSignature Off'; \
      echo 'TraceEnable Off'; \
      echo 'FileETag None'; \
    } > /etc/apache2/conf-available/zzz-hardening.conf; \
    a2enconf zzz-hardening

# --- Docroot policy: AllowOverride All so the provisioned Shibboleth .htaccess
#     applies; no dir listing; log to stdout/stderr ---
RUN set -eux; \
    { \
      echo '<Directory /var/www/html>'; \
      echo '    Options -Indexes +FollowSymLinks'; \
      echo '    AllowOverride All'; \
      echo '    Require all granted'; \
      echo '</Directory>'; \
      echo 'ErrorLog /dev/stderr'; \
      echo 'CustomLog /dev/stdout combined'; \
    } > /etc/apache2/conf-available/zzz-docroot.conf; \
    a2enconf zzz-docroot

# --- Application code. .dockerignore excludes .ddev/, .git/, .env*, Dockerfile,
#     the env-specific secret files (iam.php, json/dataDev.json), student photos
#     (images/), the response data dirs (recreated writable below), docs and
#     OS junk. ---
COPY --chown=www-data:www-data . /var/www/html/

# --- Permissions: read-only app tree owned by www-data, plus writable response
#     dirs where the endpoints save per-eval JSON (mount volumes here in
#     production for persistence) ---
RUN set -eux; \
    find /var/www/html -type d -exec chmod 0755 {} +; \
    find /var/www/html -type f -exec chmod 0644 {} +; \
    mkdir -p /var/www/html/studentResponses /var/www/html/groupResponses; \
    chown -R www-data:www-data /var/www/html/studentResponses /var/www/html/groupResponses; \
    chmod -R 0775 /var/www/html/studentResponses /var/www/html/groupResponses; \
    chown -R www-data:www-data /var/run/apache2 /var/log/apache2 /var/lock; \
    chmod -R g=u /var/run/apache2 /var/log/apache2 /var/lock

USER www-data
EXPOSE 8080
VOLUME ["/var/www/html/studentResponses", "/var/www/html/groupResponses"]

# php:apache base CMD = apache2-foreground
