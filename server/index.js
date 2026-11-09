import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const PROJECT_FILE = path.join(DATA_DIR, 'project.json');
const DIST_DIR = process.env.DIST_DIR || path.resolve(__dirname, '../apps/web/dist');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory project state
let currentProject = null;
let projectVersion = 1;
let saveTimer = null;

// Initial rich demo project if no project.json exists
function createFallbackDemoProject() {
  const pId = 'p_' + Math.random().toString(36).substring(2, 9);
  const bId = 'b_' + Math.random().toString(36).substring(2, 9);
  const m1Id = 'm_' + Math.random().toString(36).substring(2, 9);
  const m2Id = 'm_' + Math.random().toString(36).substring(2, 9);
  const ep1Id = 'ep_' + Math.random().toString(36).substring(2, 9);

  return {
    schemaVersion: 1,
    id: pId,
    name: 'Auftragserfassung (Server Shared)',
    boards: [
      {
        id: bId,
        name: 'Positionen Erfassen',
        kind: 'flow',
        lanes: [
          { id: 'l_ui', name: 'User Actions', color: '#FFC21A', height: 520, kind: 'ui' },
          { id: 'l_api', name: 'API', color: '#1E9BFF', height: 280, kind: 'api' },
          { id: 'l_model', name: 'Model', color: '#FF9F1C', height: 600, kind: 'model' },
        ],
        nodes: [
          {
            id: 'n_action',
            kind: 'userAction',
            label: 'Press Tätigkeit',
            position: { x: 120, y: 180 },
          },
          {
            id: 'n_ep1',
            kind: 'endpoint',
            endpointId: ep1Id,
            position: { x: 340, y: 550 },
          },
          {
            id: 'n_m1',
            kind: 'model',
            modelId: m1Id,
            position: { x: 340, y: 840 },
          },
          {
            id: 'n_m2',
            kind: 'model',
            modelId: m2Id,
            position: { x: 340, y: 1040 },
          },
        ],
        edges: [
          {
            id: 'e_1',
            source: 'n_action',
            target: 'n_ep1',
            sourceHandle: 'right',
            targetHandle: 'left',
            kind: 'flow',
            label: '',
          },
          {
            id: 'e_2',
            source: 'n_ep1',
            target: 'n_m1',
            sourceHandle: 'bottom',
            targetHandle: 'top',
            kind: 'response',
            label: '',
          },
          {
            id: 'e_3',
            source: 'n_m1',
            target: 'n_m2',
            sourceHandle: 'bottom',
            targetHandle: 'top',
            kind: 'response',
            label: 'positionen',
          },
        ],
      },
    ],
    models: [
      {
        id: m1Id,
        name: 'PagedPositionenRESTModel',
        description: '',
        fields: [
          { id: 'f_1', name: 'positionen', type: 'List<TaetigkeitPositionRESTModel>' },
          { id: 'f_2', name: 'currentPage', type: 'int' },
          { id: 'f_3', name: 'requestedEntriesPerPage', type: 'int' },
        ],
      },
      {
        id: m2Id,
        name: 'TaetigkeitPositionRESTModel',
        description: '',
        fields: [
          { id: 'f_10', name: 'uuid', type: 'String' },
          { id: 'f_11', name: 'nummer', type: 'String', nullable: true },
          { id: 'f_12', name: 'name', type: 'String', nullable: true },
          { id: 'f_13', name: 'preis', type: 'double', nullable: true },
          { id: 'f_14', name: 'menge', type: 'double', nullable: true },
        ],
      },
    ],
    endpoints: [
      {
        id: ep1Id,
        method: 'POST',
        path: 'Taetigkeiten / Positionen',
        description: '',
        params: [
          { id: 'p_1', name: 'taetigkeitUuid', type: 'String' },
          { id: 'p_2', name: 'page', type: 'int' },
          { id: 'p_3', name: 'entriesPerPage', type: 'int' },
        ],
        responseModelId: m1Id,
      },
    ],
    components: [],
    assets: {},
  };
}

// Load project from file or initialize
try {
  if (fs.existsSync(PROJECT_FILE)) {
    const raw = fs.readFileSync(PROJECT_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.boards) && parsed.boards.length > 0) {
      currentProject = parsed;
      console.log(`[EventFlow Server] Loaded project "${currentProject.name}" from ${PROJECT_FILE}`);
    }
  }
} catch (err) {
  console.warn('[EventFlow Server] Could not read existing project.json, will create new one:', err.message);
}

if (!currentProject) {
  currentProject = createFallbackDemoProject();
  try {
    fs.writeFileSync(PROJECT_FILE, JSON.stringify(currentProject, null, 2), 'utf-8');
    console.log(`[EventFlow Server] Created initial demo project in ${PROJECT_FILE}`);
  } catch (err) {
    console.error('[EventFlow Server] Failed to write initial project.json:', err);
  }
}

// Schedule debounced disk save
function scheduleDiskSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(PROJECT_FILE, JSON.stringify(currentProject, null, 2), 'utf-8');
      console.log(`[EventFlow Server] Auto-saved project to disk (version ${projectVersion})`);
    } catch (err) {
      console.error('[EventFlow Server] Disk save error:', err);
    }
  }, 250);
}

// MIME types dictionary for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

// HTTP Server
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Normalize /eventFlow and /eventflow
  const isEventFlowPrefix = pathname.toLowerCase().startsWith('/eventflow');

  // Handle redirect from /eventFlow to /eventFlow/
  if (pathname === '/eventFlow' || pathname === '/eventflow') {
    res.writeHead(301, { Location: '/eventFlow/' });
    res.end();
    return;
  }

  // Strip prefix for API or static files
  let cleanPath = pathname;
  if (isEventFlowPrefix) {
    cleanPath = pathname.replace(/^\/eventflow/i, '') || '/';
  }

  // CORS headers for API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoints
  if (cleanPath === '/api/project') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        project: currentProject,
        version: projectVersion,
        clientsCount: clients.size,
      }));
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const nextProject = parsed.project || parsed;
          if (nextProject && Array.isArray(nextProject.boards)) {
            currentProject = nextProject;
            projectVersion++;
            scheduleDiskSave();
            broadcast({
              type: 'sync',
              project: currentProject,
              senderId: parsed.senderId || 'http-api',
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, version: projectVersion }));
            return;
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid project format' }));
      });
      return;
    }
  }

  if (cleanPath === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      clients: clients.size,
      version: projectVersion,
    }));
    return;
  }

  // Static File Serving
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  // Calculate local file path
  let relativeFilePath = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\//, '');
  let filePath = path.join(DIST_DIR, relativeFilePath);

  // Security check to avoid path traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if requested file exists, else fallback to index.html (SPA routing)
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('EventFlow app not built yet. Please run: npm run build');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      // Cache headers: index.html no-cache, assets immutable
      if (ext === '.html') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

// WebSocket Server for Real-Time Synchronization
const wss = new WebSocketServer({ noServer: true });
const clients = new Map(); // ws -> { id: string, connectedAt: number }

function broadcast(msg, excludeWs = null) {
  const payload = JSON.stringify(msg);
  for (const [wsClient] of clients.entries()) {
    if (wsClient !== excludeWs && wsClient.readyState === WebSocket.OPEN) {
      try {
        wsClient.send(payload);
      } catch (err) {
        console.warn('[EventFlow WS] Send error:', err);
      }
    }
  }
}

function broadcastPresence() {
  broadcast({
    type: 'presence',
    count: clients.size,
  });
}

// Upgrade listener for WebSockets
server.on('upgrade', (request, socket, head) => {
  const reqUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname.toLowerCase();

  // Match /ws, /eventFlow/ws, /eventflow/ws
  if (pathname === '/ws' || pathname === '/eventflow/ws' || pathname.endsWith('/ws')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  clients.set(ws, { id: clientId, connectedAt: Date.now() });

  console.log(`[EventFlow WS] Client connected: ${clientId} (Total: ${clients.size})`);

  // Send current project immediately upon connection
  ws.send(JSON.stringify({
    type: 'init',
    project: currentProject,
    version: projectVersion,
    clientId,
  }));

  // Update presence count for everyone
  broadcastPresence();

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'init') {
        ws.send(JSON.stringify({
          type: 'init',
          project: currentProject,
          version: projectVersion,
          clientId,
        }));
        return;
      }

      if (msg.type === 'update') {
        if (msg.project && Array.isArray(msg.project.boards)) {
          currentProject = msg.project;
          projectVersion++;
          scheduleDiskSave();

          // Immediately broadcast the updated project to all other clients!
          broadcast({
            type: 'sync',
            project: currentProject,
            senderId: msg.senderId || clientId,
          }, ws);
        }
        return;
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
    } catch (e) {
      console.warn('[EventFlow WS] Failed to handle message:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[EventFlow WS] Client disconnected: ${clientId} (Total: ${clients.size})`);
    broadcastPresence();
  });

  ws.on('error', (err) => {
    console.warn(`[EventFlow WS] Client error (${clientId}):`, err.message);
  });
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
======================================================
🚀 EventFlow Live Server running on port ${PORT}
👉 Local:            http://localhost:${PORT}
👉 EventFlow URL:    http://localhost:${PORT}/eventFlow/
👉 WebSocket URL:    ws://localhost:${PORT}/ws
📁 Persistent Data:  ${PROJECT_FILE}
📁 Static Assets:    ${DIST_DIR}
👥 Realtime Sync:    ACTIVE for all connected users!
======================================================
  `);
});

// Clean shutdown
process.on('SIGINT', () => {
  console.log('\n[EventFlow Server] Shutting down, saving current state...');
  try {
    fs.writeFileSync(PROJECT_FILE, JSON.stringify(currentProject, null, 2), 'utf-8');
    console.log('[EventFlow Server] State saved. Goodbye!');
  } catch (err) {
    console.error('[EventFlow Server] Save on exit failed:', err);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[EventFlow Server] SIGTERM received, saving state...');
  try {
    fs.writeFileSync(PROJECT_FILE, JSON.stringify(currentProject, null, 2), 'utf-8');
  } catch {}
  process.exit(0);
});
