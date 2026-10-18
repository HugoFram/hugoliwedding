#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd -- "$(dirname -- "$0")"
test "$(id -u)" = 0
test -f /etc/hugoli-deploy/owned-production-installation
test -f /etc/letsencrypt/live/hugoli-mariage.frammery.com/fullchain.pem
test -f /etc/letsencrypt/live/hugoli-mariage.frammery.com/privkey.pem
enabled=/etc/apache2/sites-enabled/hugoli-z-production-https.conf
if test -e "$enabled" || test -L "$enabled"; then
  echo 'Production HTTPS is already configured.' >&2; exit 1
fi
backup="/var/backups/hugoli-production-https-$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$backup"
cp -a /etc/apache2 "$backup/apache2"
python3 baseline.py > "$backup/baseline.json"
curl -fsS --resolve hugoli-mariage-test.frammery.com:443:127.0.0.1 https://hugoli-mariage-test.frammery.com/ > "$backup/test-index.html"
rollback() {
  rm -f -- /etc/apache2/sites-enabled/hugoli-z-production-https.conf
  cp -a "$backup/apache2/sites-available/hugoli-production-http.conf" /etc/apache2/sites-available/hugoli-production-http.conf
  apache2ctl configtest && apache2ctl graceful
  echo "Production HTTPS disabled; backup: $backup" >&2
}
trap 'rollback; exit 1' ERR
install -m 644 hugoli-z-production-https.conf /etc/apache2/sites-available/hugoli-z-production-https.conf
ln -s ../sites-available/hugoli-z-production-https.conf "$enabled"
python3 - <<'PY'
from pathlib import Path
path = Path('/etc/apache2/sites-available/hugoli-production-http.conf')
text = path.read_text()
marker = '    DocumentRoot /var/www/hugoli/production/public\n'
assert text.count(marker) == 1
redirect = '''    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/\\.well-known/acme-challenge/
    RewriteRule ^ https://hugoli-mariage.frammery.com%{REQUEST_URI} [R=301,L]
'''
path.write_text(text.replace(marker, marker + redirect))
PY
apache2ctl configtest
apache2ctl graceful
sleep 2
python3 baseline.py "$backup/baseline.json"
curl -fsS --resolve hugoli-mariage-test.frammery.com:443:127.0.0.1 https://hugoli-mariage-test.frammery.com/ | cmp - "$backup/test-index.html"
curl -fsS --resolve hugoli-mariage.frammery.com:443:127.0.0.1 https://hugoli-mariage.frammery.com/_deployment.json
install -m 755 hugoli-production-cert-deploy /etc/letsencrypt/renewal-hooks/deploy/hugoli-production-cert-deploy
printf '\nProduction HTTPS active. Backup: %s\n' "$backup"
