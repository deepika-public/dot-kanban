#!/usr/bin/env python3
"""Print the CHANGELOG.md section of a version, as the text of its release.

    python3 scripts/release-notes.py            # version of manifest.json
    python3 scripts/release-notes.py 0.8.0

Fails when the version has no section, or an empty one: a release always says what
changed. Relative links become links to the files at that tag, so they work on the
GitLab and GitHub release pages."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = "https://gitlab.com/deepika-public/deepika-obsidian-toolbox/dot-kanban"


def section(text: str, version: str) -> str:
    """The body of `## [version] - date` (or `## version`), up to the next `## ` heading."""
    heading = re.compile(rf"^## \[?{re.escape(version)}\]?(?:\s+-\s+.*)?$", re.M)
    found = heading.search(text)
    if not found:
        raise SystemExit(f"CHANGELOG.md n'a pas de section pour {version}")
    rest = text[found.end():]
    end = re.search(r"^## |^\[[^\]]+\]: ", rest, re.M)
    body = (rest[: end.start()] if end else rest).strip()
    if not body:
        raise SystemExit(f"La section {version} de CHANGELOG.md est vide")
    return body


def absolute_links(body: str, version: str) -> str:
    """`](docs/x.md#a)` → `](REPO/-/blob/version/docs/x.md#a)`; web links are kept."""
    return re.sub(r"\]\((?!https?://|#)([^)\s]+)\)", rf"]({REPO}/-/blob/{version}/\1)", body)


def main() -> None:
    version = sys.argv[1] if len(sys.argv) > 1 else json.loads((ROOT / "manifest.json").read_text())["version"]
    text = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    print(absolute_links(section(text, version), version))


if __name__ == "__main__":
    main()
