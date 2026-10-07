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
- **Stromstöße** ⚡ — zufällig erscheinende goldene Blitze; anklicken bringt
  eine Zufallsbelohnung: Energie-Windfall, **Überspannung ×7** (30 s) oder
  **Klick-Rausch ×10** (20 s). Aktive Buffs werden mit Countdown angezeigt.
- **18 Erfolge** — jeder freigeschaltete Erfolg gibt dauerhaft **+2 %**
  Gesamtleistung; Freischaltung wird per Toast eingeblendet
- **Statistik-Tab** — Spielzeit, Klicks, insgesamt erzeugt, Ausbaupunkte,
  Erfolge und gefangene Stromstöße auf einen Blick
- **Einstellungs-Menü** (⚙️) mit Tabs **Sound** & **Cheats**:
  - Lautstärke-**Regler** für Gesamt, Effekte, Musik und Brumm (persistent)
    plus An/Aus-Schalter
  - **Code-Bereich**: **Geschenk-Codes** (einmalig) für Belohnungen; ein
    geheimer **Freischalt-Code** aktiviert zusätzlich den Cheat-Modus
    (Energie, Spieltempo u. v. m.). Cheat-Codes sind verborgen, bis
    freigeschaltet.
- **Automatisches Speichern** im Browser (localStorage) inkl.
  **Offline-Gutschrift** (bis zu 12 h, „Willkommen zurück"-Toast)

## Bonus: 🏎️ KI-Rennen (`rennen/`)

Ein kleines Rennspiel, in dem **neuronale Netze per Neuroevolution** fahren
lernen. Jedes der 60 Autos hat ein eigenes Netz (8 → 10 → 6 → 2, tanh):

- **Eingaben:** 7 Abstands-Sensoren (Strahlen von −90° bis +90°) + Tempo
- **Ausgaben:** Lenkung und Gas/Bremse
- **Lernen:** Wer die Wand berührt oder nicht vorankommt, scheidet aus. Nach
  jeder Generation werden die besten Fahrer (Elite + Turnier-Auswahl)
  gekreuzt und mutiert. Meist schaffen sie nach ~5–10 Generationen alle 3 Runden.
- Live-Ansicht des **Netzes** des führenden Autos, Fitness-Verlauf, Tempo-
  und Mutations-Regler, zufällige Strecken, Speichern/Laden des besten Netzes
- **🏁 Gegen die KI fahren** — mit Pfeiltasten/WASD (oder Touch-Tasten) gegen
  das beste trainierte Netz antreten

Erreichbar über den Button „🏎️ KI-Rennen" oben im Spiel oder direkt unter
`rennen/index.html`.

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
| `rennen/nn.js` | KI-Rennen: neuronales Netz (Feed-Forward, Mutation, Crossover) |
| `rennen/sim.js` | KI-Rennen: Strecke, Physik, Sensoren, Evolution (auch in Node lauffähig) |
| `rennen/rennen.js` | KI-Rennen: Grafik, Bedienung, Rennen gegen die KI |

## Herkunft

Ausgekoppelt aus der [Elektro-Toolbox / Lernbox](https://github.com/giudicea/Lernbox),
wo das Game ursprünglich als Zusatz-Tool entstanden ist.

## Lizenz

[GPL-3.0](LICENSE) — abgeleitet vom GPL-3.0-lizenzierten Lernbox-Projekt.
