"""Release packaging gates, on a throwaway Git copy of the plugin; no upload, no GitLab."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SOURCES = [".gitignore", "package.json", "package-lock.json", "manifest.json", "main.js", "styles.css", "README.md",
           "docs", "scripts/package.py"]
VERSION = json.loads((ROOT / "manifest.json").read_text())["version"]
ARCHIVE = f"dot-kanban-{VERSION}.zip"


def git(cwd, *args):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


class Packaging(unittest.TestCase):
    def setUp(self):
        if not (ROOT / "main.js").exists():
            self.skipTest("main.js is missing: run npm run build first")
        self.dir = Path(tempfile.mkdtemp(prefix="kanban-package-"))
        self.addCleanup(shutil.rmtree, self.dir)
        for name in SOURCES:
            source, target = ROOT / name, self.dir / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if source.is_dir():
                shutil.copytree(source, target)
            else:
                shutil.copy2(source, target)
        git(self.dir, "init", "-q")
        git(self.dir, "add", ".")
        git(self.dir, "-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "-qm", "release")

    def package(self, **env):
        clean = {k: v for k, v in os.environ.items() if k not in ("CI_COMMIT_TAG", "SOURCE_DATE_EPOCH")}
        return subprocess.run(["python3", "scripts/package.py"], cwd=self.dir, env={**clean, **env},
                              capture_output=True, text=True)

    def test_archive_holds_the_plugin_its_docs_and_build_info(self):
        result = self.package()
        self.assertEqual(result.returncode, 0, result.stderr)
        dist = self.dir / "dist"
        line = (dist / "SHA256SUMS").read_text()
        self.assertEqual(line, f"{hashlib.sha256((dist / ARCHIVE).read_bytes()).hexdigest()}  {ARCHIVE}\n")
        with zipfile.ZipFile(dist / ARCHIVE) as zipped:
            names = set(zipped.namelist())
            info = json.loads(zipped.read("dot-kanban/BUILD.json"))
            manifest = json.loads(zipped.read("dot-kanban/manifest.json"))
        docs = {f"dot-kanban/{p.relative_to(self.dir)}" for p in (self.dir / "docs").rglob("*") if p.suffix in (".md", ".json")}
        expected = {f"dot-kanban/{n}" for n in ["main.js", "manifest.json", "styles.css", "README.md", "BUILD.json"]}
        self.assertEqual(names, expected | docs)
        self.assertTrue(docs, "the documentation is shipped")
        self.assertEqual(manifest["id"], "dot-kanban")
        self.assertEqual(info["version"], VERSION)
        self.assertEqual(info["commit"], git(self.dir, "rev-parse", "HEAD"))
        self.assertFalse(info["dirty"])

    def test_same_commit_gives_the_same_bytes(self):
        self.assertEqual(self.package().returncode, 0)
        first = (self.dir / "dist" / ARCHIVE).read_bytes()
        (self.dir / "dist" / ARCHIVE).unlink()
        self.assertEqual(self.package().returncode, 0)
        self.assertEqual((self.dir / "dist" / ARCHIVE).read_bytes(), first)

    def test_a_tag_must_name_the_version(self):
        result = self.package(CI_COMMIT_TAG="99.0.0")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Git tag must match", result.stderr)
        self.assertEqual(self.package(CI_COMMIT_TAG=VERSION).returncode, 0)

    def test_a_release_is_never_packaged_from_a_modified_checkout(self):
        with open(self.dir / "styles.css", "a") as f:
            f.write("/* local change */\n")
        result = self.package(CI_COMMIT_TAG=VERSION)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Refusing to package a modified release checkout", result.stderr)
        # Outside a release the archive is built, and says it is dirty.
        self.assertEqual(self.package().returncode, 0)
        with zipfile.ZipFile(self.dir / "dist" / ARCHIVE) as zipped:
            self.assertTrue(json.loads(zipped.read("dot-kanban/BUILD.json"))["dirty"])

    def test_versions_must_agree(self):
        manifest = json.loads((self.dir / "manifest.json").read_text())
        manifest["version"] = "99.0.0"
        (self.dir / "manifest.json").write_text(json.dumps(manifest))
        result = self.package()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("versions must agree", result.stderr)


if __name__ == "__main__":
    unittest.main()
