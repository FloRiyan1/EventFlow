# EventFlow – UI & API Flow Modeler

EventFlow ermöglicht das Modellieren von UI → API → Model-Flows mit Figma-Screens, Hotspot-Triggern und wiederverwendbaren Models.

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Anschließend im Browser öffnen: [http://localhost:3000](http://localhost:3000)

---

## 🚀 Server-Installation & Deployment

Da EventFlow eine reine Client-Side Single Page Application (SPA) ist, gibt es mehrere einfache Möglichkeiten, sie auf einem Server bereitzustellen:

### Option 1: Mit Docker Compose (Empfohlen & am schnellsten)

Auf deinem Server (z. B. Ubuntu, Debian, Proxmox, Hetzner, Synology) mit installiertem Docker:

```bash
# 1. Repository klonen
git clone https://github.com/FloRiyan1/EventFlow.git
cd EventFlow

# 2. Container starten (baut die App & startet Nginx auf Port 3000)
docker compose up -d --build
```

Jetzt ist EventFlow im Browser unter `http://DEINE-SERVER-IP:3000` erreichbar!

Um den Port zu ändern (z. B. Port 80 statt 3000), passe einfach die `ports`-Zeile in `docker-compose.yml` an:
```yaml
ports:
  - "80:80"
```

---

### Option 2: Mit Node.js & PM2 (oder Systemd)

Wenn auf deinem Server Node.js (>= 20) installiert ist:

```bash
# 1. Repository klonen und installieren
git clone https://github.com/FloRiyan1/EventFlow.git
cd EventFlow
npm install

# 2. Produktions-Build erstellen
npm run build

# 3. Mit serve / PM2 im Hintergrund laufen lassen:
npm install -g serve pm2
pm2 start "serve -s apps/web/dist -l 3000" --name eventflow
pm2 save
pm2 startup
```

---

### Option 3: Mit vorhandenem Webserver (Nginx / Apache / Caddy)

1. Baue die statischen Dateien lokal oder auf dem Server:
   ```bash
   npm run build
   ```
2. Kopiere den Inhalt des Ordners `apps/web/dist` in das Webroot deines Webservers (z. B. `/var/www/eventflow`).
3. Konfiguriere deinen Nginx-VHost:
   ```nginx
   server {
       listen 80;
       server_name deine-domain.de;

       root /var/www/eventflow;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

---

## Features

1. **Einheitlicher Canvas-Hintergrund**: Sauberer, durchgehender Hintergrund mit dezentem Punktraster und gestrichelten Swimlane-Trennlinien.
2. **Modelpages & Board-Tabs**: Mehrere Modelpages mit Tab-Leiste, separatem Page-Fokus und selektivem Modell-Import.
3. **Apple Trackpad Steuerung**: Flüssiges 2-Finger-Panning (`PanOnScrollMode.Free`), Pinch-to-Zoom und macOS-Shortcuts.
4. **Drag & Drop mit visueller Vorschau**: Models und APIs aus der Sidebar ziehen – eine gestrichelte Vorschau-Box zeigt exakt an, wo das Element auf dem Canvas landet.
5. **Figma-Screens einfügen**: In Figma `Shift+Strg+C` (Copy as PNG), dann in EventFlow einfach `Strg+V` drücken (oder Klick auf `+ Screen (Strg+V)`).
6. **Eckige Pfeillinien (Step-Edges)**: 90°-Winkel ohne Abrundungen und ohne diagonale Knoten-Überschneidungen.
7. **Live-Felder beim Model-Editieren**: Änderungen an Feldern (Doppelklick auf Model oder über die Sidebar) aktualisieren die Ansicht auf dem Canvas sofort.
8. **Hotspot & Trigger Editor**: Doppelklick auf Screen öffnet den Editor. Rahmen aufziehen, Event festlegen (`onTap`, `onScan`, `onSubmit`...), Bedingung definieren (`unvollstaendig == true`).
9. **Dart & Java Export**: 1-Klick-Export für Dart und Java (Records, POJOs, Lombok & Jackson).
10. **KI-Integration**: PlantUML-Modellgenerierung über OpenAI / Open WebUI.
11. **Undo / Redo & Datei-Speicherung**: Portables `*.eventflow` ZIP-Format.

---

## Tests & Build

```bash
npm run test     # Vitest Unit Tests
npm run build    # Vite Production Build
```
