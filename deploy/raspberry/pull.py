#!/usr/bin/env python3
"""Pull static test releases. Compatible with Python 3.7; standard library only."""
import argparse
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile
import time


RELEASE_RE = re.compile(r"^[a-f0-9]{40}-[1-9][0-9]*-[1-9][0-9]*$")
PATH_RE = re.compile(r"^[A-Za-z0-9_.\-/]+$")
MAX_BYTES = 50 * 1024 * 1024


def digest(data):
    return hashlib.sha256(data).hexdigest()


def validate_payload(archive):
    if len(archive) > MAX_BYTES:
        raise ValueError("Release exceeds size limit")
    files = {}
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as package:
        members = package.getmembers()
        if len(members) > 2000:
            raise ValueError("Too many archive entries")
        total = 0
        for member in members:
            name = member.name.rstrip("/")
            if (not PATH_RE.fullmatch(name) or name.startswith("/")
                    or any(part in ("", ".", "..") for part in name.split("/"))):
                raise ValueError("Unsafe archive path")
            if member.isdir():
                continue
            if not member.isfile() or name in files:
                raise ValueError("Links, special files and duplicates are forbidden")
            total += member.size
            if total > MAX_BYTES:
                raise ValueError("Expanded release exceeds size limit")
            files[name] = package.extractfile(member).read()
    manifest = json.loads(files.pop("manifest.json"))
    release_id = manifest.get("releaseId", "")
    if (manifest.get("schema") != 1 or not RELEASE_RE.fullmatch(release_id)
            or release_id != "{sha}-{runId}-{attempt}".format(**manifest)):
        raise ValueError("Invalid release identity")
    expected = {"site/" + name: checksum for name, checksum in manifest["files"].items()}
    if set(files) != set(expected) or not {"site/index.html", "site/.htaccess"}.issubset(files):
        raise ValueError("Unexpected file inventory")
    for name, data in files.items():
        if (name not in ("site/index.html", "site/.htaccess")
                and not name.startswith("site/releases/" + release_id + "/")):
            raise ValueError("File outside release directory")
        if digest(data) != expected[name]:
            raise ValueError("Checksum mismatch: " + name)
    marker = 'name="hugoli-release" content="{}"'.format(release_id).encode()
    if marker not in files["site/index.html"]:
        raise ValueError("HTML release marker mismatch")
    return manifest, files


def atomic_write(destination, data):
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
    with tempfile.NamedTemporaryFile(dir=str(destination.parent), prefix=".incoming-", delete=False) as handle:
        temporary = Path(handle.name)
        try:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
            os.chmod(str(temporary), 0o644)
            os.replace(str(temporary), str(destination))
        finally:
            if temporary.exists():
                temporary.unlink()


def install_payload(root, manifest, files):
    public = root / "public"
    release_id = manifest["releaseId"]
    # Immutable resources first; the existing index remains usable on failure.
    for name, data in sorted(files.items()):
        if name in ("site/index.html", "site/.htaccess"):
            continue
        target = public / name[len("site/"):]
        if target.exists():
            if digest(target.read_bytes()) != digest(data):
                raise ValueError("Existing immutable resource differs: " + name)
        else:
            atomic_write(target, data)
    version = root / "versions" / release_id
    version.mkdir(parents=True, exist_ok=True, mode=0o755)
    atomic_write(version / "index.html", files["site/index.html"])
    atomic_write(version / "manifest.json", (json.dumps(manifest, sort_keys=True) + "\n").encode())
    # Apache ignores uploaded .htaccess; MIME and access rules live in root-owned config.
    atomic_write(public / "index.html", files["site/index.html"])
    status = {key: manifest[key] for key in ("sha", "runId", "attempt", "releaseId")}
    status["deployedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    atomic_write(public / "_deployment.json", (json.dumps(status) + "\n").encode())


def git(state, *arguments):
    return subprocess.check_output(["git", "--git-dir=" + str(state / "repository.git")] + list(arguments),
                                   stderr=subprocess.STDOUT, timeout=40)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="/etc/hugoli-deploy/test.json")
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    # Test only until the user has validated it. No production path is accepted.
    if (config.get("root") != "/var/www/hugoli/test"
            or config.get("branch") != "site-test"
            or config.get("repository") != "https://github.com/HugoFram/hugoliwedding.git"
            or config.get("state") != "/var/lib/hugoli-deploy"):
        raise ValueError("Unexpected deployment target")
    root, state = Path(config["root"]), Path(config["state"])
    if root.is_symlink() or state.is_symlink():
        raise ValueError("Deployment roots must not be symlinks")
    state.mkdir(parents=True, exist_ok=True)
    with (state / "test.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        repository = state / "repository.git"
        if not repository.exists():
            subprocess.check_call(["git", "init", "--bare", str(repository)], stdout=subprocess.DEVNULL)
            git(state, "remote", "add", "origin", config["repository"])
        if git(state, "remote", "get-url", "origin").decode().strip() != config["repository"]:
            raise ValueError("Unexpected Git origin")
        branch = "refs/heads/" + config["branch"]
        # An absent branch is normal before the first GitHub publication.
        exists = git(state, "ls-remote", "--heads", "origin", branch)
        if not exists.strip():
            print("Waiting for the first site-test publication")
            return
        git(state, "fetch", "--depth=1", "origin", branch)
        commit = git(state, "rev-parse", "FETCH_HEAD").decode().strip()
        applied = state / "test-applied-commit"
        if applied.exists() and applied.read_text().strip() == commit:
            print("Test already current: " + commit)
            return
        manifest, files = validate_payload(git(state, "archive", "--format=tar", "FETCH_HEAD"))
        install_payload(root, manifest, files)
        atomic_write(applied, (commit + "\n").encode())
        print("Test deployed: " + manifest["releaseId"])


if __name__ == "__main__":
    main()
