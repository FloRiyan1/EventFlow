# EventFlow – UI & API Flow Modeler

EventFlow ermöglicht das Modellieren von UI → API → Model-Flows mit Figma-Screens, Hotspot-Triggern und wiederverwendbaren Models.

## Starten

```powershell
npm run dev
```

Anschließend im Browser öffnen: [http://localhost:3000](http://localhost:3000)

## Features

1. **Einheitlicher Canvas-Hintergrund**: Sauberer, durchgehender Hintergrund mit dezentem Punktraster und gestrichelten Swimlane-Trennlinien.
2. **Drag & Drop mit visueller Vorschau**: Models und APIs aus der Sidebar ziehen – eine gestrichelte Vorschau-Box zeigt exakt an, wo das Element auf dem Canvas landet.
3. **Figma-Screens einfügen**: In Figma `Shift+Strg+C` (Copy as PNG), dann in EventFlow einfach `Strg+V` drücken (oder Klick auf `+ Screen (Strg+V)`).
4. **Eckige Pfeillinien (Step-Edges)**: 90°-Winkel ohne Abrundungen und ohne diagonale Knoten-Überschneidungen.
5. **Live-Felder beim Model-Editieren**: Änderungen an Feldern (Doppelklick auf Model oder über die Sidebar) aktualisieren die Ansicht auf dem Canvas sofort.
6. **Hotspot & Trigger Editor**: Doppelklick auf Screen öffnet den Editor. Rahmen aufziehen, Event festlegen (`onTap`, `onScan`, `onSubmit`...), Bedingung definieren (`unvollstaendig == true`).
7. **Dart Export**: 1-Klick-Export aller Models als Dart-Klassen mit JSON-Serialisierung.
8. **Java Modeling & Code-Generierung**: Reines Datenmodellieren mit Java-Import (Interpretation von Java-Records & POJOs) und Java-Export (modernes Java Record, klassisches JavaBean POJO oder Lombok inkl. Jackson `@JsonProperty`).
9. **Undo / Redo**: `Strg+Z` und `Strg+Y`.
10. **Speichern / Laden**: Portables `*.eventflow` ZIP-Format.

## Tests & Build

```powershell
npm run test     # Vitest Unit Tests
npm run build    # Vite Production Build
```
