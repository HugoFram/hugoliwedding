import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

from pull import validate_payload, install_payload


def payload(attempt="1", corrupt=False, extra=None):
    release_id = "a" * 40 + "-123-" + attempt
    content = {"index.html": ('<meta name="hugoli-release" content="' + release_id + '">').encode(),
               ".htaccess": b"ignored configuration",
               "releases/" + release_id + "/assets/app.mjs": b"example javascript"}
    manifest = {"schema": 1, "sha": "a" * 40, "runId": "123", "attempt": attempt,
                "releaseId": release_id, "files": {name: hashlib.sha256(value).hexdigest() for name, value in content.items()}}
    archive = io.BytesIO()
    with tarfile.open(fileobj=archive, mode="w:") as tar:
        files = {"site/" + name: value for name, value in content.items()}
        files["manifest.json"] = json.dumps(manifest).encode()
        if corrupt: files["site/index.html"] = b"tampered"
        for name, value in files.items():
            member = tarfile.TarInfo(name)
            member.size = len(value)
            tar.addfile(member, io.BytesIO(value))
        if extra: tar.addfile(extra)
    return archive.getvalue()


class DeploymentTests(unittest.TestCase):
    def test_valid_release_and_status(self):
        manifest, files = validate_payload(payload())
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            install_payload(root, manifest, files)
            self.assertEqual((root / "public/index.html").read_bytes(), files["site/index.html"])
            self.assertEqual(json.loads((root / "public/_deployment.json").read_text())["releaseId"], manifest["releaseId"])
            self.assertFalse((root / "public/.htaccess").exists())

    def test_tampering_rejected(self):
        with self.assertRaises(ValueError): validate_payload(payload(corrupt=True))

    def test_traversal_rejected(self):
        with self.assertRaises(ValueError): validate_payload(payload(extra=tarfile.TarInfo("../escape")))

    def test_symlink_rejected(self):
        link = tarfile.TarInfo("site/link")
        link.type, link.linkname = tarfile.SYMTYPE, "/etc/passwd"
        with self.assertRaises(ValueError): validate_payload(payload(extra=link))

    def test_previous_assets_retained(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for attempt in ("1", "2"): install_payload(root, *validate_payload(payload(attempt)))
            self.assertTrue((root / "public/releases" / ("a" * 40 + "-123-1/assets/app.mjs")).exists())
            self.assertIn(b"-123-2", (root / "public/index.html").read_bytes())

    def test_immutable_conflict_preserves_index(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manifest, files = validate_payload(payload())
            install_payload(root, manifest, files)
            index = (root / "public/index.html").read_bytes()
            (root / "public/releases" / manifest["releaseId"] / "assets/app.mjs").write_bytes(b"unexpected data")
            with self.assertRaises(ValueError): install_payload(root, manifest, files)
            self.assertEqual((root / "public/index.html").read_bytes(), index)


if __name__ == "__main__": unittest.main()
