#!/usr/bin/env bash
# Run as root on the existing Pi. No apt operations or service restarts.
set -euo pipefail
export LC_ALL=C
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd -- "$(dirname -- "$0")"
test "$(id -u)" = 0
test -f "${1:?Supply the initial release tar archive}"
initial_archive=$(readlink -f -- "$1")
if test -e /etc/apache2/sites-enabled/hugoli-test-https.conf; then
  echo 'HTTPS is already enabled. Do not rerun the initial HTTP bootstrap.' >&2
  exit 1
fi
if test -e /var/www/hugoli && ! test -f /etc/hugoli-deploy/owned-test-installation; then
  echo 'Existing HugOli directory is not owned by this installer.' >&2
  exit 1
fi
if ! test -f /etc/hugoli-deploy/owned-test-installation && ss -H -ltn 'sport = :2585' | grep -q .; then
  echo 'Port 2585 is already in use.' >&2
  exit 1
fi
backup="/var/backups/hugoli-test-$(date +%Y%m%d-%H%M%S)"
install -d -m 700 "$backup"
cp -a /etc/apache2 "$backup/apache2"
python3 baseline.py > "$backup/baseline.json"
apache2ctl configtest
if ! getent passwd hugoli-deploy >/dev/null; then
  useradd --system --create-home --home-dir /var/lib/hugoli-deploy --shell /usr/sbin/nologin hugoli-deploy
fi
test "$(getent passwd hugoli-deploy | cut -d: -f6)" = /var/lib/hugoli-deploy
install -d -m 755 /opt/hugoli-deploy /etc/hugoli-deploy /var/www/hugoli
install -d -m 755 -o hugoli-deploy -g hugoli-deploy /var/lib/hugoli-deploy /var/www/hugoli/test /var/www/hugoli/test/public /var/www/hugoli/test/versions
install -d -m 755 /var/www/hugoli/acme/.well-known/acme-challenge
install -m 644 pull.py /opt/hugoli-deploy/pull.py
install -m 644 test.json /etc/hugoli-deploy/test.json
touch /etc/hugoli-deploy/owned-test-installation
chmod 644 /etc/hugoli-deploy/owned-test-installation
install -m 600 -o hugoli-deploy -g hugoli-deploy "$initial_archive" /var/lib/hugoli-deploy/initial.tar
sudo -u hugoli-deploy python3 - /var/lib/hugoli-deploy/initial.tar <<'PY'
import sys
from pathlib import Path
sys.path.insert(0, '/opt/hugoli-deploy')
from pull import validate_payload, install_payload
manifest, files = validate_payload(Path(sys.argv[1]).read_bytes())
install_payload(Path('/var/www/hugoli/test'), manifest, files)
print('Initial test release installed: ' + manifest['releaseId'])
PY
rm -f -- /var/lib/hugoli-deploy/initial.tar
for name in 000-hugoli-preserve-http.conf hugoli-test-http.conf; do
  enabled="/etc/apache2/sites-enabled/$name"
  if test -e "$enabled" || test -L "$enabled"; then
    test "$(readlink -- "$enabled")" = "../sites-available/$name"
  fi
  install -m 644 "$name" "/etc/apache2/sites-available/$name"
  if ! test -L "$enabled"; then ln -s "../sites-available/$name" "$enabled"; fi
done
rollback() {
  # Remove only these new links. Never rewrite existing configuration.
  rm -f -- /etc/apache2/sites-enabled/000-hugoli-preserve-http.conf /etc/apache2/sites-enabled/hugoli-test-http.conf
  apache2ctl configtest && apache2ctl graceful
  echo "Test Apache configuration disabled; backup: $backup" >&2
}
if ! apache2ctl configtest; then rollback; exit 1; fi
if ! apache2ctl graceful; then rollback; exit 1; fi
sleep 2
if ! python3 baseline.py "$backup/baseline.json"; then rollback; exit 1; fi
curl --fail --silent --show-error http://127.0.0.1:2585/_deployment.json
install -m 644 hugoli-test-pull.service /etc/systemd/system/hugoli-test-pull.service
install -m 644 hugoli-test-pull.timer /etc/systemd/system/hugoli-test-pull.timer
systemd-analyze verify /etc/systemd/system/hugoli-test-pull.service /etc/systemd/system/hugoli-test-pull.timer
systemctl daemon-reload
systemctl enable --now hugoli-test-pull.timer
systemctl start hugoli-test-pull.service
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q '^Status: active'; then
  cp -a /etc/ufw "$backup/ufw"
  # Only the existing LAN may access the preview port; keep all other rules.
  ufw allow from 192.168.1.0/24 to any port 2585 proto tcp comment 'HugOli LAN preview'
fi
printf '\nTest installation complete. Backup: %s\n' "$backup"
