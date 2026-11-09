import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';

function realtimeDevPlugin(): Plugin {
  return {
    name: 'realtime-sync-dev',
    configureServer(server) {
      const DATA_DIR = path.resolve(__dirname, '../../data');
      const PROJECT_FILE = path.join(DATA_DIR, 'project.json');
      if (!fs.existsSync(DATA_DIR)) {
        try {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        } catch {}
      }

      let currentProject: any = null;
      try {
        if (fs.existsSync(PROJECT_FILE)) {
          currentProject = JSON.parse(fs.readFileSync(PROJECT_FILE, 'utf-8'));
        }
      } catch {}

      const wss = new WebSocketServer({ noServer: true });
      const clients = new Map<WebSocket, string>();

      function broadcast(msg: any, excludeWs?: WebSocket) {
        const payload = JSON.stringify(msg);
        for (const [ws] of clients.entries()) {
          if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(payload);
            } catch {}
          }
        }
      }

      function broadcastPresence() {
        broadcast({ type: 'presence', count: clients.size });
      }

      let saveTimer: ReturnType<typeof setTimeout> | null = null;
      function scheduleSave() {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          try {
            if (currentProject) {
              fs.writeFileSync(PROJECT_FILE, JSON.stringify(currentProject, null, 2), 'utf-8');
            }
          } catch {}
        }, 250);
      }

      server.httpServer?.on('upgrade', (req, socket, head) => {
        const url = req.url || '';
        if (url.includes('/ws')) {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
          });
        }
      });

      wss.on('connection', (ws) => {
        const id = 'dev_' + Math.random().toString(36).substring(2, 7);
        clients.set(ws, id);

        if (currentProject) {
          ws.send(JSON.stringify({ type: 'init', project: currentProject, senderId: id }));
        }
        broadcastPresence();

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'init' && currentProject) {
              ws.send(JSON.stringify({ type: 'init', project: currentProject, senderId: id }));
              return;
            }
            if (msg.type === 'update' && msg.project) {
              currentProject = msg.project;
              scheduleSave();
              broadcast({ type: 'sync', project: currentProject, senderId: msg.senderId }, ws);
              return;
            }
            if (msg.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong' }));
              return;
            }
          } catch {}
        });

        ws.on('close', () => {
          clients.delete(ws);
          broadcastPresence();
        });
      });

      // API route for initial project fetch
      server.middlewares.use('/api/project', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ project: currentProject, clientsCount: clients.size }));
      });
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  plugins: [react(), realtimeDevPlugin()],
  resolve: {
    alias: {
      '@eventflow/core': path.resolve(__dirname, '../../packages/core/src'),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
