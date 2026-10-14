import {
  createRequestId,
  DEFAULT_RECONNECT_POLICY,
  nextReconnectDelay,
  type CollaborationConnectionState,
  type CollaborationTransport,
  type RoomClientEvent,
  type RoomClientRequest,
  type RoomJoinRequest,
} from './collaboration-protocol';

export interface WebSocketCollaborationOptions {
  url: string;
  join: Omit<RoomJoinRequest, 'type' | 'requestId'>;
  reconnect?: Partial<typeof DEFAULT_RECONNECT_POLICY>;
  WebSocketImpl?: typeof WebSocket;
}

/**
 * Browser WebSocket transport with bounded reconnect behavior.
 *
 * The server must validate the access token and reject unauthorized writes;
 * this client never treats a socket connection as proof of authorization.
 */
export class WebSocketCollaborationTransport implements CollaborationTransport {
  private socket?: WebSocket;
  private state: CollaborationConnectionState = 'idle';
  private closedByCaller = false;
  private attempt = 0;
  private reconnectTimer?: number;
  private readonly stateListeners = new Set<(state: CollaborationConnectionState) => void>();
  private readonly eventListeners = new Set<(event: RoomClientEvent) => void>();
  private readonly WebSocketImpl: typeof WebSocket;
  private readonly policy: typeof DEFAULT_RECONNECT_POLICY;

  constructor(private readonly options: WebSocketCollaborationOptions) {
    this.WebSocketImpl = options.WebSocketImpl ?? globalThis.WebSocket;
    this.policy = { ...DEFAULT_RECONNECT_POLICY, ...options.reconnect };
  }

  connect(): void {
    if (this.closedByCaller || this.socket || typeof this.WebSocketImpl === 'undefined') return;
    this.setState(this.attempt > 0 ? 'reconnecting' : 'connecting');
    const socket = new this.WebSocketImpl(this.options.url);
    this.socket = socket;
    socket.addEventListener('open', () => {
      this.attempt = 0;
      this.setState('connected');
      this.send({ type: 'room.join', requestId: createRequestId('join'), ...this.options.join });
    });
    socket.addEventListener('message', (event) => this.handleMessage(event.data));
    socket.addEventListener('error', () => this.setState('error'));
    socket.addEventListener('close', (event) => {
      this.socket = undefined;
      if (event.code === 1008) {
        this.closedByCaller = true;
        this.setState('closed');
        return;
      }
      if (this.closedByCaller) {
        this.setState('closed');
        return;
      }
      this.scheduleReconnect();
    });
  }

  send(request: RoomClientRequest): boolean {
    if (this.socket?.readyState !== this.WebSocketImpl.OPEN) return false;
    this.socket.send(JSON.stringify(request));
    return true;
  }

  close(code = 1000, reason = 'Client closed the room connection'): void {
    this.closedByCaller = true;
    if (this.reconnectTimer !== undefined) window.clearTimeout(this.reconnectTimer);
    this.socket?.close(code, reason);
    this.socket = undefined;
    this.setState('closed');
  }

  onStateChange(listener: (state: CollaborationConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  onEvent(listener: (event: RoomClientEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  private handleMessage(data: unknown): void {
    try {
      const value = typeof data === 'string' ? JSON.parse(data) as RoomClientEvent : data as RoomClientEvent;
      if (!value || typeof value !== 'object' || typeof value.type !== 'string') return;
      this.eventListeners.forEach((listener) => listener(value));
    } catch {
      this.eventListeners.forEach((listener) => listener({ type: 'room.error', error: { code: 'invalid-message', message: 'The room server sent invalid JSON.' } }));
    }
  }

  private scheduleReconnect(): void {
    if (this.closedByCaller || this.attempt >= this.policy.maxAttempts) {
      this.setState('error');
      return;
    }
    const delay = nextReconnectDelay(this.attempt, this.policy);
    this.attempt += 1;
    this.setState('reconnecting');
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, delay);
  }

  private setState(state: CollaborationConnectionState): void {
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }
}
