#!/usr/bin/env python3
"""Record response fingerprints and service identities, never private page content."""
import hashlib
import http.client
import json
import ssl
import subprocess
import sys


def snapshot():
    result = {"http": {}, "services": {}}
    probes = [(80, "unmatched.invalid", False), (80, "hugoli.frammery.com", False),
              (443, "unmatched.invalid", False), (2581, "localhost", False),
              (2582, "localhost", False), (25444, "localhost", True),
              (25445, "localhost", True), (2583, "hugoli.frammery.com", True),
              (2584, "hugogallery.frammery.com", True)]
    for port, host, tls in probes:
        key = str(port) + ":" + host
        try:
            # Local diagnostic only: existing sites have expired certificates.
            connection = (http.client.HTTPSConnection("127.0.0.1", port, timeout=8,
                          context=ssl._create_unverified_context()) if tls
                          else http.client.HTTPConnection("127.0.0.1", port, timeout=8))
            connection.request("GET", "/", headers={"Host": host})
            response = connection.getresponse()
            body = response.read()
            item = {"status": response.status}
            if port == 80:
                item["sha256"] = hashlib.sha256(body).hexdigest()
            result["http"][key] = item
            connection.close()
        except Exception as error:
            result["http"][key] = {"error": type(error).__name__}
    units = subprocess.check_output(["systemctl", "list-units", "--type=service", "--state=running",
                                     "--no-legend", "--no-pager"], universal_newlines=True)
    for line in units.splitlines():
        unit = line.split()[0]
        if unit.startswith("hugoli-"):
            continue
        result["services"][unit] = subprocess.check_output(
            ["systemctl", "show", unit, "--property=MainPID", "--value"], universal_newlines=True).strip()
    return result


if __name__ == "__main__":
    current = snapshot()
    if len(sys.argv) == 2:
        expected = json.load(open(sys.argv[1]))
        if current["http"] != expected["http"]:
            raise SystemExit("Existing HTTP responses changed: " + json.dumps(current["http"], sort_keys=True))
        changed = [name for name, pid in expected["services"].items() if current["services"].get(name) != pid]
        if changed:
            raise SystemExit("Existing service identities changed: " + ", ".join(changed))
        print("Existing sites and service parent PIDs are unchanged")
    else:
        print(json.dumps(current, indent=2, sort_keys=True))
