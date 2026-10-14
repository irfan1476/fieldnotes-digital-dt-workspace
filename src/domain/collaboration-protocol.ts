/**
 * Provider-neutral protocol for authenticated FieldNotes rooms.
 *
 * The local room/session model deliberately remains separate from this
 * contract. A production transport must authenticate the join, authorize the
 * requested role, acknowledge durable revisions, and keep presence ephemeral.
 */

export type CollaborationConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'paused'
  | 'closed'
  | 'error';

export type CollaborationRole = 'facilitator' | 'participant' | 'observer';

export type CollaborationErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'room-not-found'
  | 'room-closed'
  | 'conflict'
  | 'invalid-message'
  | 'rate-limited'
  | 'server-unavailable';

export interface RoomMember {
  id: string;
  displayName: string;
  role: CollaborationRole;
  presence: 'active' | 'away';
  joinedAt: string;
  lastSeenAt: string;
}

export interface RoomRevisionPointer {
  activityId: string;
  iterationId: string;
  revisionId: string;
  revisionNumber: number;
  updatedAt: string;
}

export interface RoomSnapshot {
  roomId: string;
  workspaceId: string;
  status: 'open' | 'paused' | 'closed';
  members: RoomMember[];
  revision: RoomRevisionPointer;
  /** Durable board/activity payload is loaded separately or by an authorized join. */
  document?: Record<string, unknown>;
}

export interface RoomJoinRequest {
  type: 'room.join';
  requestId: string;
  roomId: string;
  workspaceId: string;
  activityId: string;
  iterationId: string;
  requestedRole: CollaborationRole;
  displayName: string;
  accessToken: string;
}

export interface RoomLeaveRequest {
  type: 'room.leave';
  requestId: string;
  roomId: string;
  memberId: string;
}

export interface RoomRevisionChange {
  type: 'room.revision.append';
  requestId: string;
  roomId: string;
  baseRevisionNumber: number;
  activityId: string;
  iterationId: string;
  actorId: string;
  operation: 'replace-activity-revision' | 'append-event' | 'append-checkpoint';
  payload: Record<string, unknown>;
}

export interface RoomPresenceChange {
  type: 'room.presence';
  roomId: string;
  memberId: string;
  presence: 'active' | 'away';
}

export interface RoomClientEvent {
  type: 'room.snapshot' | 'room.status.changed' | 'room.member.joined' | 'room.member.left' | 'room.member.presence' | 'room.member.revoked' | 'room.revision.accepted' | 'room.revision.rejected' | 'room.error';
  status?: RoomSnapshot['status'];
  requestId?: string;
  snapshot?: RoomSnapshot;
  member?: RoomMember;
  memberId?: string;
  revision?: RoomRevisionPointer;
  actorId?: string;
  document?: Record<string, unknown>;
  error?: { code: CollaborationErrorCode; message: string; expectedRevisionNumber?: number };
}

export type RoomClientRequest = RoomJoinRequest | RoomLeaveRequest | RoomRevisionChange | RoomPresenceChange;

export interface CollaborationTransport {
  connect(): void;
  send(request: RoomClientRequest): boolean;
  close(code?: number, reason?: string): void;
  onStateChange(listener: (state: CollaborationConnectionState) => void): () => void;
  onEvent(listener: (event: RoomClientEvent) => void): () => void;
}

export const DEFAULT_RECONNECT_POLICY = {
  initialDelayMs: 500,
  maxDelayMs: 10_000,
  maxAttempts: Infinity,
} as const;

export function canWriteRoom(role: CollaborationRole, status: RoomSnapshot['status']): boolean {
  return status === 'open' && role !== 'observer';
}

export function nextReconnectDelay(attempt: number, policy = DEFAULT_RECONNECT_POLICY): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  return Math.min(policy.maxDelayMs, policy.initialDelayMs * (2 ** safeAttempt));
}

export function createRequestId(prefix = 'request'): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}
