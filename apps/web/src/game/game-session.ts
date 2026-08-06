import { defaultApiBaseUrl } from '../api';

const MAX_SERVER_EVENT_BYTES = 64 * 1024;
const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 5_000, 10_000] as const;

type BrowserSocket = Readonly<{
  addEventListener(type: string, listener: (event: unknown) => void): void;
  close(): void;
  send(data: string): void;
  readyState: number;
}>;
type SocketFactory = (url: string) => BrowserSocket;

export type GameServerSession = Readonly<{
  close(): void;
}>;

/**
 * Authenticated server-event transport. It deliberately knows nothing about gameplay state:
 * JSON is decoded here, then the runtime validates the versioned event before rendering it.
 * Cookies are sent by the browser's WebSocket handshake; no token is copied into the client.
 */
export function connectGameServer(
  onEvent: (raw: unknown) => void,
  options: Readonly<{
    baseUrl?: string;
    socketFactory?: SocketFactory;
    onStatus?: (status: 'connecting' | 'open' | 'closed') => void;
  }> = {},
): GameServerSession {
  const socketFactory =
    options.socketFactory ?? ((url: string) => new WebSocket(url) as unknown as BrowserSocket);
  const baseUrl = options.baseUrl ?? defaultApiBaseUrl();
  const endpoint = toWebSocketEndpoint(baseUrl);
  let socket: BrowserSocket | undefined;
  let closed = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    if (closed) return;
    options.onStatus?.('connecting');
    socket = socketFactory(endpoint);
    socket.addEventListener('open', () => {
      reconnectAttempt = 0;
      options.onStatus?.('open');
    });
    socket.addEventListener('message', (event) => {
      const data = isMessageEvent(event) ? event.data : undefined;
      if (typeof data !== 'string' || data.length > MAX_SERVER_EVENT_BYTES) return;
      try {
        onEvent(JSON.parse(data) as unknown);
      } catch {
        // Invalid JSON is a transport concern; valid JSON is still schema-checked by the runtime.
      }
    });
    socket.addEventListener('close', () => {
      socket = undefined;
      options.onStatus?.('closed');
      if (closed) return;
      const delay =
        RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]!;
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    });
  };

  connect();
  return {
    close: () => {
      closed = true;
      if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      socket?.close();
      socket = undefined;
    },
  };
}

function isMessageEvent(event: unknown): event is Readonly<{ data: unknown }> {
  return typeof event === 'object' && event !== null && 'data' in event;
}

function toWebSocketEndpoint(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/$/, '');
  if (normalized.startsWith('https://')) return `wss://${normalized.slice('https://'.length)}/ws`;
  if (normalized.startsWith('http://')) return `ws://${normalized.slice('http://'.length)}/ws`;
  // Same-origin deployment: a relative "/ws" is resolved by the WebSocket constructor against the
  // page URL, and the spec maps an http/https page scheme to ws/wss — so this correctly becomes
  // wss:// on a TLS host without the client needing to know its own domain.
  return `${normalized}/ws`;
}
