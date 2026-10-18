#!/usr/bin/env bash
# Add production to the existing installation, using an explicitly approved release.
set -euo pipefail
export LC_ALL=C
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd -- "$(dirname -- "$0")"
test "$(id -u)" = 0
initial_archive=$(readlink -f -- "${1:?Supply the approved release tar}")
approved_release=${2:?Supply the approved release ID}
test -f "$initial_archive"
test -f /etc/hugoli-deploy/owned-test-installation
if test -e /var/www/hugoli/production && ! test -f /etc/hugoli-deploy/owned-production-installation; then
  echo 'Existing production directory is not owned by this installer.' >&2; exit 1
fi
if test -e /etc/apache2/sites-enabled/hugoli-z-production-https.conf; then
  echo 'Production HTTPS is already active. Do not rerun the bootstrap.' >&2; exit 1
fi
backup="/var/backups/hugoli-production-$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$backup"
cp -a /etc/apache2 "$backup/apache2"
cp -a /opt/hugoli-deploy/pull.py "$backup/pull.py"
python3 baseline.py > "$backup/baseline.json"
curl -fsS --resolve hugoli-mariage-test.frammery.com:443:127.0.0.1 https://hugoli-mariage-test.frammery.com/ > "$backup/test-index.html"
apache2ctl configtest
if ! getent passwd hugoli-production >/dev/null; then
  useradd --system --create-home --home-dir /var/lib/hugoli-production-deploy --shell /usr/sbin/nologin hugoli-production
fi
test "$(getent passwd hugoli-production | cut -d: -f6)" = /var/lib/hugoli-production-deploy
install -d -m 755 -o hugoli-production -g hugoli-production /var/lib/hugoli-production-deploy /var/www/hugoli/production /var/www/hugoli/production/public /var/www/hugoli/production/versions
install -m 644 pull.py /opt/hugoli-deploy/pull.py.incoming
mv -f -- /opt/hugoli-deploy/pull.py.incoming /opt/hugoli-deploy/pull.py
install -m 644 production.json /etc/hugoli-deploy/production.json
touch /etc/hugoli-deploy/owned-production-installation
install -m 600 -o hugoli-production -g hugoli-production "$initial_archive" /var/lib/hugoli-production-deploy/initial.tar
sudo -u hugoli-production python3 - /var/lib/hugoli-production-deploy/initial.tar "$approved_release" <<'PY'
import sys
from pathlib import Path
sys.path.insert(0, '/opt/hugoli-deploy')
from pull import validate_payload, install_payload
manifest, files = validate_payload(Path(sys.argv[1]).read_bytes())
assert manifest['releaseId'] == sys.argv[2], 'Not the explicitly approved release'
install_payload(Path('/var/www/hugoli/production'), manifest, files)
print('Approved production release installed: ' + manifest['releaseId'])
PY
rm -f -- /var/lib/hugoli-production-deploy/initial.tar
enabled=/etc/apache2/sites-enabled/hugoli-production-http.conf
rollback() {
  rm -f -- /etc/apache2/sites-enabled/hugoli-production-http.conf
  apache2ctl configtest && apache2ctl graceful
  echo "Production HTTP disabled; backup: $backup" >&2
}
trap 'rollback; exit 1' ERR
install -m 644 hugoli-production-http.conf /etc/apache2/sites-available/hugoli-production-http.conf
if ! test -L "$enabled"; then ln -s ../sites-available/hugoli-production-http.conf "$enabled"; fi
apache2ctl configtest
apache2ctl graceful
sleep 2
python3 baseline.py "$backup/baseline.json"
curl -fsS --resolve hugoli-mariage-test.frammery.com:443:127.0.0.1 https://hugoli-mariage-test.frammery.com/ | cmp - "$backup/test-index.html"
curl -fsS -H 'Host: hugoli-mariage.frammery.com' http://127.0.0.1/_deployment.json
install -m 644 hugoli-production-pull.service /etc/systemd/system/hugoli-production-pull.service
install -m 644 hugoli-production-pull.timer /etc/systemd/system/hugoli-production-pull.timer
systemd-analyze verify /etc/systemd/system/hugoli-production-pull.service /etc/systemd/system/hugoli-production-pull.timer
systemctl daemon-reload
systemctl enable --now hugoli-production-pull.timer
systemctl start hugoli-production-pull.service
printf '\nProduction HTTP installation complete. Backup: %s\n' "$backup"
