# Kraftwerk — Idle Game ⚡

Ein kleines Strom-Idle-/Incremental-Game im Browser. Klicke, um Strom zu
erzeugen, baue Kraftwerke von der **Handkurbel** bis zum **Fusionsreaktor** und
baue dein Netz für dauerhafte Boni aus.

Reines statisches HTML/CSS/JS — **kein Build-Schritt nötig**. Einfach
`index.html` im Browser öffnen.

## Spielprinzip

- **⚡ Strom erzeugen** — manueller Klick für sofortige Energie
- **7 Kraftwerke** die automatisch produzieren, mit exponentiell steigenden
  Preisen (×1.15 pro Stück). Neue Kraftwerke schalten sich frei, sobald sie
  in Reichweite kommen.
- **Kauf-Modi** ×1 / ×10 / Max
- **Upgrades** — stärkerer Klick und +10 % Gesamt-Wirkungsgrad
- **Netzausbau (Prestige)** — alles zurücksetzen für einen dauerhaften
  **+2 %**-Bonus je Ausbaupunkt
- **Kraftwerks-Meilensteine** — je mehr Einheiten eines Kraftwerks du besitzt,
  desto öfter **verdoppelt sich dessen Leistung** (bei 10, 25, 50, 100, … Stück).
  Jede Zeile zeigt einen Fortschrittsbalken zum nächsten ×2-Bonus.
- **Obergrenzen fürs Balancing** — maximal **500 Einheiten je Kraftwerkstyp**
  (harte Kaufgrenze) und **max. 12 h** anrechenbare Offline-Zeit, damit der
  Fortschritt nicht davonläuft.
- **18 Erfolge** — jeder freigeschaltete Erfolg gibt dauerhaft **+2 %**
  Gesamtleistung; Freischaltung wird per Toast eingeblendet
- **Einstellungs-Menü** (⚙️) mit Tabs **Sound** & **Cheats**:
  - Lautstärke-**Regler** für Gesamt, Effekte, Musik und Brumm (persistent)
    plus An/Aus-Schalter
  - **Cheat-Codes** (z. B. `geld`, `turbo`, `zeitraffer`, `langsam`, `ausbau`,
    `vollausbau`) für Energie, Spieltempo u. v. m.
- **Automatisches Speichern** im Browser (localStorage) inkl.
  **Offline-Gutschrift** (bis zu 12 h, „Willkommen zurück"-Toast)

## Lokal spielen

```
# einfach die Datei öffnen …
open index.html          # macOS
xdg-open index.html      # Linux

# … oder über einen lokalen Server
python3 -m http.server
# -> http://localhost:8000
```

## Struktur

| Datei | Zweck |
| --- | --- |
| `index.html` | Spiel-Oberfläche |
| `css/styles.css` | Design-Tokens & Komponenten (Nocturne-Theme) |
| `js/game.js` | gesamte Spiellogik |
| `js/fx.js` | Grafik & Sound: originale SVG-Icons, Web-Audio-Klänge, Musik-Loop |

## Herkunft

Ausgekoppelt aus der [Elektro-Toolbox / Lernbox](https://github.com/giudicea/Lernbox),
wo das Game ursprünglich als Zusatz-Tool entstanden ist.

## Lizenz

[GPL-3.0](LICENSE) — abgeleitet vom GPL-3.0-lizenzierten Lernbox-Projekt.
