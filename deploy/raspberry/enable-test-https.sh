#!/usr/bin/env bash
# HTTPS only after DNS and webroot certificate issuance have succeeded.
set -euo pipefail
export LC_ALL=C
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd -- "$(dirname -- "$0")"
test "$(id -u)" = 0
test -f /etc/hugoli-deploy/owned-test-installation
test -f /etc/letsencrypt/live/hugoli-mariage-test.frammery.com/fullchain.pem
test -f /etc/letsencrypt/live/hugoli-mariage-test.frammery.com/privkey.pem
backup="/var/backups/hugoli-test-https-$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$backup"
cp -a /etc/apache2 "$backup/apache2"
python3 baseline.py > "$backup/baseline.json"
apache2ctl configtest
enabled=/etc/apache2/sites-enabled/hugoli-test-https.conf
if test -e "$enabled" || test -L "$enabled"; then
  echo 'HTTPS is already configured; inspect the existing configuration.' >&2
  exit 1
fi
rollback() {
  rm -f -- /etc/apache2/sites-enabled/hugoli-test-https.conf
  cp -a "$backup/apache2/sites-available/hugoli-test-http.conf" /etc/apache2/sites-available/hugoli-test-http.conf
  apache2ctl configtest && apache2ctl graceful
  echo "HTTPS configuration disabled; backup: $backup" >&2
}
trap 'rollback; exit 1' ERR
install -m 644 hugoli-test-https.conf /etc/apache2/sites-available/hugoli-test-https.conf
ln -s ../sites-available/hugoli-test-https.conf "$enabled"
# Add the redirect only now, retaining the LAN preview and ACME HTTP access.
python3 - <<'PY'
from pathlib import Path
path = Path('/etc/apache2/sites-available/hugoli-test-http.conf')
text = path.read_text()
marker = '    DocumentRoot /var/www/hugoli/test/public\n'
assert text.count(marker) == 1
redirect = '''    RewriteEngine On
    RewriteCond %{SERVER_PORT} =80
    RewriteCond %{REQUEST_URI} !^/\\.well-known/acme-challenge/
    RewriteRule ^ https://hugoli-mariage-test.frammery.com%{REQUEST_URI} [R=301,L]
'''
path.write_text(text.replace(marker, marker + redirect))
PY
if ! apache2ctl configtest; then rollback; exit 1; fi
if ! apache2ctl graceful; then rollback; exit 1; fi
sleep 2
if ! python3 - "$backup/baseline.json" <<'PY'
import json
import sys
from baseline import snapshot
expected = json.load(open(sys.argv[1]))
current = snapshot()
# Intentional change: port 443 is now TLS, replacing its generic HTTP directory index.
expected['http'].pop('443:unmatched.invalid')
current['http'].pop('443:unmatched.invalid')
assert expected['http'] == current['http'], 'An existing application response changed'
assert all(current['services'].get(name) == pid for name, pid in expected['services'].items()), 'An existing service PID changed'
print('Existing applications and service parent PIDs are unchanged; port 443 now uses TLS')
PY
then rollback; exit 1; fi
if ! curl --fail --silent --show-error --resolve hugoli-mariage-test.frammery.com:443:127.0.0.1 https://hugoli-mariage-test.frammery.com/_deployment.json; then
  rollback; exit 1
fi
install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy
install -m 755 hugoli-test-cert-deploy /etc/letsencrypt/renewal-hooks/deploy/hugoli-test-cert-deploy
printf '\nHTTPS test enabled. Backup: %s\n' "$backup"
