# Potenzfunktionen

Aufgabengenerator im Stil der MuWeave-Items **283** und **303**. Die App erzeugt
neue Funktionsterme und zeigt die Musterlösungen auf Wunsch einzeln oder für
das gesamte Aufgabenblatt. Die Oberfläche ist auf Deutsch, Englisch und
Französisch verfügbar.

## Verwenden

Öffne `index.html` im Browser oder über einen statischen Webserver. Diese
Fassung lädt die festgelegte MathJax-Version aus dem CDN. Die mit dem unten
beschriebenen Build erzeugte **`build/power_functions.html`** ist eine einzelne
HTML-Datei, die auch ohne Internet funktioniert.

Wähle **Nur Zahlen** oder **Mit Parametern**, anschließend bei Bedarf die
Aufgabenanzahl (6, 10 oder 12) und die Schwierigkeit. **Aufbauend** führt von
einfachen Potenzen und Produkten bis zu verschachtelten Potenzen, Differenzen
und Bruchtermen. **Neue Aufgaben** erzeugt ein neues Blatt und verbirgt dessen
Lösungen. **Musterlösung** öffnet die Rechenschritte, die Standardform, die
unabhängige Variable, den Grad und den Skalierungsfaktor.

Die unabhängige Variable wechselt zwischen `x`, `t`, `s` und `u`. Zusätzliche
Buchstaben stehen für feste reelle Zahlen ungleich 0. Die Aufgaben sind so
gewählt, dass der Skalierungsfaktor für alle erlaubten Parameterwerte ungleich
0 bleibt und der Grad eine positive ganze Zahl ist. Bei Bruchtermen bleibt
die ursprüngliche Einschränkung der Definitionsmenge auch nach dem Kürzen
sichtbar; die Lösung erklärt die Ergänzung durch den Funktionswert 0.

Der Browser merkt sich das aktuelle Blatt, die Sprache und die geöffneten
Lösungen lokal, soweit Browser-Speicher verfügbar ist. Im MuWeave-Dokument
übernimmt dessen Speichermechanismus den Stand. Es gibt keine automatische
Antwortbewertung und keine Übertragung an einen Server.

## MuWeave verwenden

Die Modul-ID lautet `power_functions`; die einzige Aktivität ist `main`.
Beide Aufgabenbereiche werden innerhalb dieser Aktivität ausgewählt.
`compact` zeigt die Übung ohne den globalen Seitentitel und Sprachschalter;
`full` zeigt die vollständige App. Die bestehende MuWeb-Schnittstelle liefert
Schriftgröße, Zeilenabstand und Größenabstufungen vom Dokument.

Nach der Installation in die interaktive Bibliothek:

```text
µblock.interactive("power_functions", instance="potenzfunktionen-generator")
```

Für das vollständige Layout ergänze `presentation="full"`. Für einen
separaten Tab ergänze `open="tab"`. Jede Einbindung benötigt eine eigene
`instance`-Identität. Das erzeugte HTML-Dokument funktioniert offline.

Das Modul benötigt das deklarierte Profil `muweave-mathjax-4-svg-v1`.
Verwende deshalb beim HTML-Export ausdrücklich `--math-renderer=mathjax`
(`pyhtml`) beziehungsweise `--html-math-renderer=mathjax` (`muweave`).

Eigenständige Anwendung: **[Potenzfunktionen](https://georg184.github.io/power_functions/)**.
Das MuWeb-Modul verwendet dieselbe Adresse als öffentliches PDF-/QR-Ziel.
Der Quellcode liegt im [GitHub-Repository](https://github.com/georg184/power_functions).

## Bauen und prüfen

Audience: application maintainers

Die Befehle laufen im App-Verzeichnis. `python` bezeichnet eine Umgebung mit
den installierten Workspace-Paketen MuWeb und PyHTML; für die mathematische
Prüfung zusätzlich SymPy. Node.js führt die reinen Generatortests aus.
Die Browserprüfung benötigt Playwright und Chrome; `--browser PATH` wählt
ein anderes Chromium-Programm. Die Entwicklung benötigt keinen npm-Build.

```bash
node tests/core.test.cjs
node --check js/core.js
node --check js/app.js
python scripts/verify-mathematics.py
python scripts/prepare-browser-checks.py /tmp/power-functions-check
python -m muweb validate /tmp/power-functions-check/power_functions.muweb
python scripts/verify-browser.py /tmp/power-functions-check
```

Die separate Online-Prüfung verwendet das echte CDN und ein frisches
Browserprofil. Sie kontrolliert die veröffentlichte Versionskennung und
deckt insbesondere erst beim Öffnen von Lösungen geladene Formelzeichen ab:

```bash
python scripts/verify-browser.py /tmp/power-functions-check --only online
```

Mit `--url file:///ABSOLUTER/PFAD/power_functions/index.html` lässt sich
dieselbe Prüfung vor einer Veröffentlichung gegen die lokalen Quellen ausführen.

Die Vorbereitung baut ein frisches Modul, eine Offline-Seite, einen echten
sandboxierten Bridge-Host und eine unabhängige PyHTML-Datei mit Inline- und
Tab-Einbindung. Alle Testdaten bleiben unter `/tmp`. Die Browserprüfung sperrt
Netzwerkzugriffe und prüft unter anderem Lösungen, Sprachen, mobile Breite,
Snapshot/Wiederherstellung, abweichende Host-Typografie, Speichersperre und
sichtbare Fehler bei fehlender Mathematik-Laufzeit oder gemischten Versionen.
Die SymPy-Prüfung beweist die Äquivalenz jeder erzeugten Lösungsstufe anhand
der ursprünglichen Ausdrucksbäume und kontrolliert die Definitionslücken
vor dem Kürzen.

Eigenständigen Build erzeugen:

```bash
python scripts/build-muweb.py /tmp/power-functions-check/power_functions.muweb \
  --offline-page build/power_functions.html
```

Der Producer baut deterministische, validierte `.muweb`-Bytes. Er bündelt die
App und die unveränderte MuWeb-Bridge; die Formel-Laufzeit liefert im Modul
der Host. Für die optionale Offline-Seite verwendet er die geprüfte, lokal
installierte PyHTML-MathJax-Laufzeit. Erst nach allen Prüfungen installieren:

```bash
python -m muweb install /tmp/power-functions-check/power_functions.muweb \
  --interactive-dir /mnt/data/sync/software/Python/ggpackages/muweave_library/interactive
```

Der gemeinsame Typografie-Adapter wird durch
[`shared/sync-muweave-typography.py`](../shared/sync-muweave-typography.py)
generiert. Seine lokale Kopie wird nicht von Hand geändert. Die
Versionskennungen in Einstiegspunkt, Generator, UI, lokalen Asset-URLs und
Modulmanifest müssen übereinstimmen. Der aktuelle Wert steht in
`muweb/muweave-module.json`.

## Gespeicherter Zustand

Schema **1** enthält vollständig `schema`, `language`, `mode`, `count`,
`level`, `seed` und `revealed`. `mode=null` bezeichnet die Startauswahl.
`seed` ist eine vorzeichenlose 32-Bit-Zahl; die übrigen Auswahlwerte werden
gegen die erlaubten Werte geprüft. `revealed` enthält eindeutige Indizes der
geöffneten Lösungen. Daraus rekonstruiert die App alle Aufgaben und Schritte
deterministisch. Es gibt keinen weiteren fachlichen Zustand außerhalb dieses
Snapshots; Schriftgrößen und Fensterabmessungen sind Präsentationsdaten.

Eine Änderung der Zuordnung von Seed und Aufgaben nach einer Auslieferung
erfordert eine neue ganzzahlige `state_version` und eine explizite Migration.
Ungültige gespeicherte Daten werden sichtbar diagnostiziert und unverändert
erhalten. In eigenständigen Seiten lautet der Speichername
`power-functions-state-v1`; eingebettet nutzt die App ausschließlich die
MuWeb-Bridge. Eine Speichersperre des Hosts deaktiviert Änderungen.

## Veröffentlichung

Git-Remote: `git@github.com:georg184/power_functions.git`, Branch `main`.
GitHub Pages verwendet den Workflow `.github/workflows/deploy-pages.yml`.
Er prüft die JavaScript-Syntax und die Generatortests und veröffentlicht
anschließend ausschließlich `index.html`, `.nojekyll`, `css/` und `js/`.
Lokale Build-Ergebnisse und Testdaten gehören nicht zur Veröffentlichung.

Nach den lokalen Prüfungen Änderungen im App-Repository committen und mit
`git push origin main` veröffentlichen. Mit
`gh run list --workflow deploy-pages.yml` den Lauf bestimmen und mit
`gh run watch RUN_ID --exit-status` bis zum Abschluss verfolgen. Anschließend
die öffentliche Seite mit einem frischen Browserprofil öffnen, die Versionskennung
in `index.html` und den JavaScript-Dateien vergleichen und beide Aufgabenbereiche
samt Musterlösungen prüfen.

Für den Einsatz als Applet in MuWeave steht Item 304 zur Verfügung:

```text
µblock.applet(item=304)
```

Die Beschreibung bleibt im Dokument, während **Applet öffnen** die eingebettete
Offline-App in einem Dialog öffnet. Das PDF enthält dieselbe Beschreibung mit
einem Link und QR-Code zur öffentlichen Anwendung. Der Aufgabenstand bleibt
über die Modulinstanz `potenzfunktionen-generator` erhalten. Das Item benötigt
wie die direkte MuWeb-Einbindung den MathJax-Renderer im HTML-Export.
