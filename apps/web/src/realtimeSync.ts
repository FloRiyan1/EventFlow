import type { Project } from '@eventflow/core';

export type SyncConnectionStatus = 'connected' | 'connecting' | 'disconnected';

type SyncListener = (project: Project, senderId: string) => void;
type StatusListener = (status: SyncConnectionStatus, userCount: number) => void;

class RealtimeSyncManager {
  private ws: WebSocket | null = null;
  private status: SyncConnectionStatus = 'disconnected';
  private userCount: number = 1;
  private clientId: string;
  private syncListeners = new Set<SyncListener>();
  private statusListeners = new Set<StatusListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private isDestroyed = false;

  constructor() {
    // Unique ID per browser tab/session
    let storedId = '';
    try {
      storedId = sessionStorage.getItem('eventflow_client_id') || '';
    } catch {}
    if (!storedId) {
      storedId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      try {
        sessionStorage.setItem('eventflow_client_id', storedId);
      } catch {}
    }
    this.clientId = storedId;
  }

  public getClientId(): string {
    return this.clientId;
  }

  public getStatus(): { status: SyncConnectionStatus; userCount: number } {
    return { status: this.status, userCount: this.userCount };
  }

  public onSync(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status, this.userCount);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: SyncConnectionStatus, userCount = this.userCount) {
    this.status = status;
    this.userCount = userCount;
    for (const listener of this.statusListeners) {
      try {
        listener(status, userCount);
      } catch (err) {
        console.error('[RealtimeSync] Listener error:', err);
      }
    }
  }

  /**
   * Determine WebSocket URL based on current browser window location
   * Works for root / as well as subpaths like /eventFlow/
   */
  private getWsUrl(): string {
    const isHttps = window.location.protocol === 'https:';
    const proto = isHttps ? 'wss:' : 'ws:';
    const host = window.location.host;
    const pathname = window.location.pathname.toLowerCase();

    let wsPath = '/ws';
    if (pathname.includes('/eventflow')) {
      wsPath = '/eventFlow/ws';
    }
    return `${proto}//${host}${wsPath}`;
  }

  public connect(): void {
    if (this.isDestroyed || typeof window === 'undefined') return;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');

    try {
      const url = this.getWsUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');

        // Request initial state
        this.send({ type: 'init', senderId: this.clientId });

        // Start heartbeat ping
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.send({ type: 'ping' });
          }
        }, 25000);
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.warn('[RealtimeSync] Error parsing message:', e);
        }
      };

      this.ws.onclose = () => {
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
          this.pingTimer = null;
        }
        this.setStatus('disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Socket close event will handle reconnect
      };
    } catch (e) {
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private handleServerMessage(msg: any): void {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'init':
      case 'sync': {
        // If message is from our own tab, ignore echo
        if (msg.senderId && msg.senderId === this.clientId) {
          return;
        }
        if (msg.project && Array.isArray(msg.project.boards)) {
          for (const listener of this.syncListeners) {
            try {
              listener(msg.project, msg.senderId || 'server');
            } catch (err) {
              console.error('[RealtimeSync] Sync callback error:', err);
            }
          }
        }
        break;
      }

      case 'presence': {
        const count = typeof msg.count === 'number' ? Math.max(1, msg.count) : this.userCount;
        this.setStatus(this.status, count);
        break;
      }

      case 'pong':
        break;
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    // Exponential backoff: 1.5s, 3s, 5s, max 8s
    const delay = Math.min(8000, 1500 * Math.pow(1.5, Math.min(this.reconnectAttempts, 5)));
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  public send(data: Record<string, unknown>): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
        return true;
      } catch (e) {
        console.warn('[RealtimeSync] Send error:', e);
      }
    }
    return false;
  }

  /**
   * Broadcast an updated project state to all other connected clients
   */
  public broadcastProject(project: Project): void {
    this.send({
      type: 'update',
      project,
      senderId: this.clientId,
      timestamp: Date.now(),
    });
  }

  /**
   * Direct HTTP fetch for instant initial load before WS handshake settles
   */
  public async fetchServerProject(): Promise<Project | null> {
    try {
      const pathname = window.location.pathname.toLowerCase();
      let apiPath = '/api/project';
      if (pathname.includes('/eventflow')) {
        apiPath = '/eventFlow/api/project';
      }

      const res = await fetch(apiPath);
      if (res.ok) {
        const data = await res.json();
        if (data && data.project && Array.isArray(data.project.boards)) {
          return data.project as Project;
        }
      }
    } catch {
      // Backend not running or offline, return null
    }
    return null;
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}

// Global singleton instance for the browser session
export const realtimeSync = new RealtimeSyncManager();
