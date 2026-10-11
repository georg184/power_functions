"""Build the offline MuWeb module and optional standalone offline HTML page."""

import argparse
import json
from pathlib import Path
import re
import tempfile

from muweb import build_artifact, module_bridge_source, write_artifact

ROOT: Path = Path(__file__).resolve().parent.parent
CSP: str = (
    "default-src 'none'; connect-src 'none'; object-src 'none'; "
    "base-uri 'none'; form-action 'none'; script-src 'unsafe-inline' "
    "'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; "
    "font-src data:; frame-src 'none'; worker-src 'none'"
)
SCRIPTS: tuple[str, ...] = (
    "js/core.js", "js/vendor/muweave-typography.js", "js/app.js"
)
RUNTIME_TAG: str = (
    '<script defer src="https://cdn.jsdelivr.net/npm/@mathjax/'
    'mathjax-modern-font@4.1.3/tex-mml-svg-mathjax-modern.js"></script>'
)


def compose_html(*, embedded: bool) -> str:
    """Inline the same app assets for an offline standalone page or host module.

    Args:
        embedded: Whether to use MuWeb's bridge and host-owned math runtime.
    """
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    manifest = json.loads((ROOT / "muweb/muweave-module.json").read_text())
    version = manifest["version"]
    if f"window.GG_APP_VERSION = '{version}'" not in html:
        raise ValueError("Manifest and entry versions differ")
    for path in ("js/core.js", "js/app.js"):
        if not re.search(rf"const (?:APP_)?VERSION = '{re.escape(version)}'", (ROOT / path).read_text()):
            raise ValueError(f"Manifest and {path} versions differ")

    replacements = {
        f'<link rel="stylesheet" href="css/styles.css?v={version}">':
            f'<style>{(ROOT / "css/styles.css").read_text(encoding="utf-8")}</style>',
        f'<script src="js/mathjax-config.js?v={version}"></script>': "",
        RUNTIME_TAG: "",
        **{f'<script defer src="{path}?v={version}"></script>': "" for path in SCRIPTS},
    }
    for old, new in replacements.items():
        if html.count(old) != 1:
            raise ValueError(f"Expected exactly one entry fragment: {old}")
        html = html.replace(old, new, 1)
    if embedded:
        html = html.replace("<head>", f'<head>\n<meta http-equiv="Content-Security-Policy" content="{CSP}">', 1)
    else:
        # Use the exact installed profile, including its offline font data.
        from pyhtml.mathjax import _mathjax_runtime_markup

        html = html.replace("</head>", _mathjax_runtime_markup() + "\n</head>", 1)
    sources = [(ROOT / path).read_text(encoding="utf-8") for path in SCRIPTS]
    if embedded:
        sources.insert(1, module_bridge_source())
    scripts = "\n".join(f"<script>{source.replace('</script', '<\\/script')}</script>" for source in sources)
    # A bundled runtime may contain literal HTML tag strings in JavaScript.
    # The last closing body belongs to the actual entry document.
    before, after = html.rsplit("</body>", 1)
    return before + scripts + "\n</body>" + after


def main() -> None:
    """Build and validate the module; optionally emit an offline standalone page."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Destination named power_functions.muweb")
    parser.add_argument("--offline-page", type=Path, help="Optional standalone offline HTML destination")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="power-functions-build-") as temporary:
        source = Path(temporary)
        (source / "muweave-module.json").write_bytes((ROOT / "muweb/muweave-module.json").read_bytes())
        (source / "embed.html").write_text(compose_html(embedded=True), encoding="utf-8")
        artifact = build_artifact(source)
        write_artifact(artifact, args.output)
    if args.offline_page:
        html = compose_html(embedded=False)
        args.offline_page.parent.mkdir(parents=True, exist_ok=True)
        args.offline_page.write_text(html, encoding="utf-8")
    print(f"Validated {args.output} ({artifact.content_digest})")


if __name__ == "__main__":
    main()
