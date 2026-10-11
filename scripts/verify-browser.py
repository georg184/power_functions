"""Exercise offline hosts or the published app with its real CDN runtime."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import BrowserContext, Frame, Locator, Page, expect, sync_playwright

STORAGE_KEY: str = "power-functions-state-v1"


def ready(target: Page | Frame) -> None:
    """Wait for all currently visible mathematical content to be typeset.

    Args:
        target: Standalone document or sandboxed application frame.
    """
    target.wait_for_function("""() => document.querySelector('#app')?.dataset.mathReady === 'true'
      && [...document.querySelectorAll('.math')].every(node=>node.querySelector('mjx-container'))""")
    assert target.locator("mjx-merror, [data-mjx-error]").count() == 0
    assert target.locator("#notice").inner_text() == ""


def exercise(target: Page | Frame, *, keyboard: bool = False) -> None:
    """Verify task generation, selective solutions and sheet replacement.

    Args:
        target: Standalone document or sandboxed application frame.
        keyboard: Whether to activate controls using the keyboard. PyHTML's
            calibrated CSS zoom is not reflected in Playwright's frame click coordinates.
    """
    def activate(locator: Locator) -> None:
        """Activate a real UI control through the selected input path.

        Args:
            locator: Button or solution disclosure to activate.
        """
        if keyboard:
            locator.focus()
            locator.press("Enter")
        else:
            locator.click()

    ready(target)
    activate(target.locator('[data-mode="numbers"]'))
    ready(target)
    expect(target.locator(".exercise")).to_have_count(10)
    expect(target.locator(".solution-body")).to_have_count(0)
    target.locator("summary").first.focus()
    target.locator("summary").first.press("Enter")
    expect(target.locator(".solution-body")).to_have_count(1)
    ready(target)
    expect(target.locator(".solution-body dl dt")).to_have_count(3)
    activate(target.locator("#toggle-all"))
    expect(target.locator(".solution-body")).to_have_count(10)
    ready(target)
    activate(target.locator("#toggle-all"))
    expect(target.locator(".solution-body")).to_have_count(0)
    before = target.locator(".question").evaluate_all("nodes=>nodes.map(node=>node.innerHTML)")
    activate(target.locator("#generate"))
    ready(target)
    assert before != target.locator(".question").evaluate_all("nodes=>nodes.map(node=>node.innerHTML)")
    for level in ("easy", "medium", "hard", "progressive"):
        target.locator("#level").select_option(level)
        ready(target)
    target.locator("#count").select_option("6")
    ready(target)
    expect(target.locator(".exercise")).to_have_count(6)
    activate(target.locator("summary").nth(2))
    expect(target.locator(".solution-body")).to_have_count(1)
    ready(target)


def mounted_frame(page: Page, options: dict[str, object]) -> Frame:
    """Mount a new real-bridge occurrence and wait for its ready handshake.

    Args:
        page: Fixture parent page.
        options: Initial state and host presentation options.
    """
    page.evaluate("options => fixture.mount(options)", options)
    page.wait_for_function("fixture.messages.some(message=>message.kind==='ready')")
    frame = page.frame_locator("iframe")
    expect(frame.locator("#app")).to_be_attached()
    child = page.locator("iframe").element_handle().content_frame()
    assert child is not None
    child.wait_for_function("window.MuWeaveModuleBridge?.isInitialized()")
    return child


def verify_standalone(context: BrowserContext, directory: Path) -> None:
    """Check offline operation, localization, mobile layout and persistent work.

    Args:
        context: Isolated browser context with network requests blocked.
        directory: Prepared test pages and screenshot output directory.
    """
    page = context.new_page()
    page.goto((directory / "standalone.html").as_uri())
    exercise(page)
    saved = page.evaluate("key=>JSON.parse(localStorage.getItem(key))", STORAGE_KEY)
    for language, title in (("en", "Power functions"), ("fr", "Fonctions puissances"), ("de", "Potenzfunktionen")):
        page.locator("#language").select_option(language)
        ready(page)
        expect(page.locator("h1")).to_have_text(title)
        expect(page.locator("#app")).to_have_attribute("aria-label", title)
        current = page.evaluate("key=>JSON.parse(localStorage.getItem(key))", STORAGE_KEY)
        assert current["seed"] == saved["seed"] and current["revealed"] == [2]
    page.reload()
    ready(page)
    expect(page.locator("details[open]")).to_have_count(1)
    assert page.locator("details[open]").get_attribute("data-solution") == "2"
    page.screenshot(path=str(directory / "numbers.png"), full_page=True)
    page.set_viewport_size({"width": 375, "height": 812})
    ready(page)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Mobile page overflow"
    page.screenshot(path=str(directory / "mobile.png"), full_page=True)
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.locator("#back").click()
    page.locator('[data-mode="parameters"]').click()
    ready(page)
    # Restore a deterministic hard sheet containing a cancelled denominator.
    state = {"schema": 1, "language": "de", "mode": "parameters", "count": 6,
             "level": "hard", "seed": 0, "revealed": list(range(6))}
    page.evaluate("([key,value])=>localStorage.setItem(key,JSON.stringify(value))", [STORAGE_KEY, state])
    page.reload()
    ready(page)
    expect(page.locator(".domain-note")).not_to_have_count(0)
    assert "ursprünglich ausgeschlossene Wert" in page.locator(".domain-note").first.inner_text()
    page.screenshot(path=str(directory / "parameters.png"), full_page=True)
    for details in page.locator("details").all():
        details.locator("summary").click()
    expect(page.locator(".solution-body")).to_have_count(0)
    for details in page.locator("details").all():
        details.locator("summary").click()
    expect(page.locator("#toggle-all")).to_have_text("Alle Lösungen verbergen")
    ready(page)
    page.locator("#generate").click()
    ready(page)
    expect(page.locator(".solution-body")).to_have_count(0)

    broken = {**state, "schema": 999}
    page.evaluate("([key,value])=>localStorage.setItem(key,JSON.stringify(value))", [STORAGE_KEY, broken])
    page.reload()
    expect(page.locator("#notice")).to_contain_text("nicht überschrieben")
    assert page.evaluate("key=>JSON.parse(localStorage.getItem(key))", STORAGE_KEY) == broken
    page.evaluate("key=>localStorage.removeItem(key)", STORAGE_KEY)
    for filename, message in (("no-runtime.html", "Formeldarstellung"), ("mixed-version.html", "App-Versionen")):
        page.goto((directory / filename).as_uri())
        expect(page.locator("#notice")).to_contain_text(message)
        assert page.locator("button:enabled").count() == 0
    page.close()


def verify_bridge(context: BrowserContext, directory: Path) -> None:
    """Check sandbox communication, restoration, typography and disabled state.

    Args:
        context: Isolated browser context with network requests blocked.
        directory: Prepared fixture directory.
    """
    page = context.new_page()
    page.goto((directory / "host.html").as_uri())
    child = mounted_frame(page, {"presentation": "compact"})
    exercise(child)
    expect(child.locator(".page-header")).not_to_be_visible()
    page.evaluate("fixture.send('request-snapshot')")
    page.wait_for_function("fixture.messages.some(message=>message.kind==='snapshot')")
    saved = page.evaluate("fixture.state")
    assert saved["revealed"] == [2]
    child = mounted_frame(page, {"state": saved, "presentation": "full",
                                "typography": {"fontSizePt": 13, "lineHeight": 1.5, "scaleFactor": 1.2}})
    ready(child)
    expect(child.locator(".page-header")).to_be_visible()
    expect(child.locator("details[open]")).to_have_count(1)
    assert child.evaluate("MuWeaveModuleBridge.getTypography().fontSizePt") == 13
    assert abs(child.evaluate("parseFloat(getComputedStyle(document.body).fontSize)") - 13 * 4 / 3) < 0.01
    page.evaluate("fixture.send('request-snapshot')")
    page.wait_for_function("fixture.messages.some(message=>message.kind==='snapshot')")
    assert page.evaluate("fixture.state") == saved
    page.evaluate("fixture.send('host-disabled')")
    expect(child.locator("#notice")).to_contain_text("gesperrt")
    assert child.locator("button:enabled, select:enabled").count() == 0
    page.evaluate("fixture.send('request-snapshot')")
    page.wait_for_function("fixture.messages.filter(message=>message.kind==='snapshot').length===2")
    assert page.evaluate("fixture.state") == saved
    child = mounted_frame(page, {"noRuntime": True})
    expect(child.locator("#notice")).to_contain_text("Formeldarstellung")
    broken = {**saved, "schema": 999}
    child = mounted_frame(page, {"state": broken})
    expect(child.locator("#notice")).to_contain_text("nicht überschrieben")
    page.evaluate("fixture.send('request-snapshot')")
    page.wait_for_function("fixture.messages.some(message=>message.kind==='snapshot')")
    assert page.evaluate("fixture.state") == broken
    page.close()


def verify_pyhtml(context: BrowserContext, directory: Path) -> None:
    """Exercise inline/tab instances and initialization inside a closed applet.

    A hidden applet has zero layout height. Initialization must not send an
    invalid height or misdiagnose the resulting bridge error as failed math.

    Args:
        context: Isolated browser context with network requests blocked.
        directory: Prepared fixture directory.
    """
    page = context.new_page()
    page.goto((directory / "smoke.html").as_uri())
    dialog = page.locator('[data-muweave-applet-dialog]')
    expect(dialog).not_to_be_visible()
    applet_root = dialog.locator('[data-muweave-interactive-instance="power-applet"]')
    expect(applet_root).to_have_attribute("data-muweave-interactive-ready", "true")
    applet_child = applet_root.locator("iframe").element_handle().content_frame()
    assert applet_child is not None
    ready(applet_child)
    root = page.locator('[data-muweave-interactive-instance="power-inline"]')
    expect(root).to_have_attribute("data-muweave-interactive-ready", "true")
    child = root.locator("iframe").element_handle().content_frame()
    assert child is not None
    exercise(child, keyboard=True)
    expect(child.locator(".page-header")).not_to_be_visible()
    assert page.locator('[data-muweave-interactive-error="true"]').count() == 0
    tab_root = page.locator('[data-muweave-interactive-instance="power-tab"]')
    with page.expect_popup() as pending:
        tab_root.locator("button").first.click()
    popup = pending.value
    popup.wait_for_load_state()
    expect(tab_root).to_have_attribute("data-muweave-interactive-ready", "true")
    tab_child = popup.locator("iframe").element_handle().content_frame()
    assert tab_child is not None
    ready(tab_child)
    expect(tab_child.locator(".page-header")).to_be_visible()
    tab_child.locator('[data-mode="parameters"]').click()
    ready(tab_child)
    expect(tab_child.locator(".exercise")).to_have_count(6)
    tab_child.locator("summary").first.click()
    ready(tab_child)
    popup.close()
    opener = page.get_by_role('link', name='Applet öffnen', exact=True)
    opener.focus()
    opener.press('Enter')
    expect(dialog).to_be_visible()
    exercise(applet_child, keyboard=True)
    questions = applet_child.locator('.question').evaluate_all('nodes=>nodes.map(node=>node.innerHTML)')
    dialog.locator('[data-muweave-applet-close]').focus()
    dialog.locator('[data-muweave-applet-close]').press('Enter')
    expect(dialog).not_to_be_visible()
    ready(applet_child)
    opener.focus()
    opener.press('Enter')
    expect(dialog).to_be_visible()
    ready(applet_child)
    expect(applet_child.locator('details[open]')).to_have_count(1)
    assert applet_child.locator('.question').evaluate_all('nodes=>nodes.map(node=>node.innerHTML)') == questions
    page.close()


def verify_online(context: BrowserContext, url: str, directory: Path) -> None:
    """Check the deployed version and typeset solutions with the real CDN runtime.

    Args:
        context: Isolated browser context with network access enabled.
        url: Published application URL or local source entry URI.
        directory: Destination for the public-page screenshot.
    """
    page = context.new_page()
    response = page.goto(url)
    if response is not None:
        assert response.ok, f"Entry returned HTTP {response.status}"
    manifest = json.loads((Path(__file__).resolve().parent.parent / "muweb/muweave-module.json").read_text())
    ready(page)
    assert page.evaluate("window.GG_APP_VERSION") == manifest["version"]
    exercise(page)
    # Restored deterministic sheets cover deferred font loads, including blackboard R.
    # The CDN path previously started a broken speech worker when revealing solutions.
    for mode in ("numbers", "parameters"):
        for seed in (0, 42, 123456789):
            state = {"schema": 1, "language": "de", "mode": mode, "count": 12,
                     "level": "progressive", "seed": seed, "revealed": list(range(12))}
            page.evaluate("([key,value])=>localStorage.setItem(key,JSON.stringify(value))", [STORAGE_KEY, state])
            page.reload()
            ready(page)
            expect(page.locator(".solution-body")).to_have_count(12)
        for language in ("en", "fr", "de"):
            page.locator("#language").select_option(language)
            ready(page)
            expect(page.locator(".solution-body")).to_have_count(12)
    page.screenshot(path=str(directory / "online.png"), full_page=True)
    page.set_viewport_size({"width": 375, "height": 812})
    ready(page)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Mobile page overflow"
    page.close()


def main() -> None:
    """Run browser checks with an isolated, disposable browser profile."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--browser", default="/usr/bin/google-chrome")
    parser.add_argument("--only", choices=("all", "standalone", "bridge", "pyhtml", "online"), default="all")
    parser.add_argument("--url", default="https://georg184.github.io/power_functions/",
                        help="Entry URL for --only online; also accepts a local file URI")
    args = parser.parse_args()
    directory = args.directory.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    requests: list[str] = []
    errors: list[str] = []
    with sync_playwright() as playwright:
        launch_args = ["--no-sandbox", "--disable-dev-shm-usage"]
        if args.only != "online":
            launch_args.append("--host-resolver-rules=MAP * ~NOTFOUND")
        browser = playwright.chromium.launch(executable_path=args.browser, headless=True,
                                             args=launch_args)
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        if args.only == "online":
            context.on("requestfailed", lambda request: errors.append(f"{request.url}: {request.failure}"))
            context.on("response", lambda response: errors.append(f"HTTP {response.status}: {response.url}") if response.status >= 400 else None)
        else:
            context.route("http**://**", lambda route: (requests.append(route.request.url), route.abort()))
        context.on("page", lambda page: page.on("pageerror", lambda error: errors.append(str(error))))
        if args.only == "online":
            verify_online(context, args.url, directory)
            print("Online: release version, real CDN formulas, both task modes, solutions, languages and mobile passed.", flush=True)
        if args.only in ("all", "standalone"):
            verify_standalone(context, directory)
            print("Standalone: solutions, generation, languages, reload, mobile and failure checks passed.", flush=True)
        if args.only in ("all", "bridge"):
            verify_bridge(context, directory)
            print("Real MuWeb bridge: compact/full, typography, restore, snapshots and disabled state passed.", flush=True)
        if args.only in ("all", "pyhtml"):
            verify_pyhtml(context, directory)
            print("Installed PyHTML: offline inline, tab and initially closed applet occurrences passed.", flush=True)
        browser.close()
    assert not requests, requests
    assert not errors, errors
    print("No uncaught browser errors or failed requests." if args.only == "online"
          else "No external requests or uncaught browser errors.")


if __name__ == "__main__":
    main()
