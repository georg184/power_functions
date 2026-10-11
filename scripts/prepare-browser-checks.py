"""Prepare disposable standalone, real-bridge and installed-PyHTML test pages."""

import argparse
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

from muweb import install_artifact, read_artifact
from pyhtml.mathjax import _mathjax_runtime_markup

ROOT: Path = Path(__file__).resolve().parent.parent


def main() -> None:
    """Generate isolated test fixtures without installing into a consumer library."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    directory = args.directory.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    artifact_path = directory / "power_functions.muweb"
    subprocess.run([sys.executable, str(ROOT / "scripts/build-muweb.py"), str(artifact_path),
                    "--offline-page", str(directory / "standalone.html")], check=True)
    artifact = read_artifact(artifact_path)
    assert dict(artifact.manifest.runtime_requirements) == {"math": "muweave-mathjax-4-svg-v1"}
    entry = artifact.entry_bytes.decode("utf-8")
    assert "cdn.jsdelivr.net" not in entry and "window.MathJax =" not in entry
    install_artifact(artifact, directory / "interactive")

    # A real opaque-origin sandbox uses the packaged bridge unmodified. The
    # parent speaks its documented protocol and owns the saved learner state.
    runtime_entry = entry.replace("</head>", _mathjax_runtime_markup() + "</head>", 1)
    data = json.dumps({"entry": runtime_entry, "withoutRuntime": entry, "version": artifact.manifest.version}).replace("</", "<\\/")
    host = '''<!doctype html><meta charset="utf-8"><title>Power Functions bridge verification</title>
<style>body{margin:0}iframe{width:100%;height:100vh;border:0}</style>
<iframe id="module" sandbox="allow-scripts" title="Test module"></iframe>
<script>
const fixtureData = FIXTURE_DATA;
const frame = document.querySelector('iframe');
let sequence = 0, activeUrl = null, options = {}, saved = null;
window.fixture = {
  messages: [],
  send(kind,payload={}) {
    frame.contentWindow.postMessage({format:'muweave-interactive-bridge',protocolVersion:1,
      instance:'test',channel:'test-channel',sequence:sequence++,kind,payload},'*');
  },
  mount(next={}) {
    if(activeUrl) URL.revokeObjectURL(activeUrl);
    options=next; sequence=0; this.messages=[]; saved=next.state??null;
    activeUrl=URL.createObjectURL(new Blob([next.noRuntime?fixtureData.withoutRuntime:fixtureData.entry],{type:'text/html'}));
    frame.src=activeUrl+'#muweave-instance=test&muweave-channel=test-channel';
  },
  get state() {return saved;}
};
addEventListener('message', event => {
  if(event.source!==frame.contentWindow || event.data?.channel!=='test-channel') return;
  const message=event.data; fixture.messages.push(message);
  if(message.kind==='ready') fixture.send('init',{
    state: saved,
    typography: options.typography ?? {fontSizePt:10,lineHeight:1.35,scaleFactor:1.25},
    module:{id:'power_functions',version:fixtureData.version,stateVersion:1,instance:'test',
      activity:'main',presentation:options.presentation??'compact'}
  });
  if(message.kind==='state-changed' || message.kind==='snapshot') saved=message.payload.state;
});
fixture.mount();
</script>'''.replace("FIXTURE_DATA", data)
    (directory / "host.html").write_text(host, encoding="utf-8")

    source = directory / "smoke.muweave"
    source.write_text(
        'µblock.interactive("power_functions", instance="power-inline", presentation="compact")\n\n'
        'µblock.interactive("power_functions", instance="power-tab", presentation="full", open="tab")\n\n'
        'µblock.applet[url="https://georg184.github.io/power_functions/", title="Power functions"]{\n'
        'µblock.interactive("power_functions", instance="power-applet", presentation="compact")\n'
        ',,\nPractice power functions with optional worked solutions.\n}\n',
        encoding="utf-8",
    )
    subprocess.run([sys.executable, "-m", "pyhtml", str(source), "--output", str(directory / "smoke.html"),
                    "--interactive-dir", str(directory / "interactive"), "--math-renderer", "mathjax",
                    "--no-coach", "--no-template"], cwd=directory, check=True)
    html = (directory / "smoke.html").read_text(encoding="utf-8")
    assert html.count('id="muweave-mathjax"') == html.count('id="muweave-mathjax-config"') == 1
    assert 'id="muweave-runtime-profiles"' in html

    # Failure pages keep the production app adapter, with only its external
    # dependency omitted or its core version deliberately mismatched.
    spec = importlib.util.spec_from_file_location("producer", ROOT / "scripts/build-muweb.py")
    assert spec is not None and spec.loader is not None
    producer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(producer)
    standalone = producer.compose_html(embedded=False)
    (directory / "no-runtime.html").write_text(standalone.replace(_mathjax_runtime_markup(), ""), encoding="utf-8")
    (directory / "mixed-version.html").write_text(
        standalone.replace(f"const VERSION = '{artifact.manifest.version}'", "const VERSION = 'stale-version'", 1),
        encoding="utf-8",
    )
    print(f"Browser fixtures prepared in {directory}")


if __name__ == "__main__":
    main()
