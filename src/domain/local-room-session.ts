/**
 * Browser-local room/session records for the collaboration prototype.
 *
 * A room link carries context (room, workspace, activity, iteration and an
 * optional display name), but it does not grant access or synchronize data.
 * This boundary is intentional until a server-backed room transport exists.
 */

export type LocalRoomStatus = 'open' | 'paused' | 'closed';
export type LocalRoomRole = 'facilitator' | 'participant' | 'observer';

export interface LocalRoomParticipant {
  id: string;
  displayName: string;
  role: LocalRoomRole;
  joinedAt: string;
  lastSeenAt: string;
  presence: 'active' | 'away';
}

export interface LocalRoomSession {
  schemaVersion: 1;
  roomId: string;
  workspaceId: string;
  activityId: string;
  iterationId: string;
  name: string;
  status: LocalRoomStatus;
  createdAt: string;
  updatedAt: string;
  participants: LocalRoomParticipant[];
}

export interface LocalRoomLinkContext {
  roomId: string;
  workspaceId: string;
  activityId: string;
  iterationId: string;
  displayName?: string;
  role?: LocalRoomRole;
}

export type LocalRoomSaveResult = { ok: true } | { ok: false; message: string };

const STORAGE_PREFIX = 'dt-room-session:v1:';

const safeId = (prefix: string): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
};

export function cleanRoomName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 80);
}

export function cleanRoomParticipantName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 60);
}

function storageKey(roomId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(roomId)}`;
}

function now(): string {
  return new Date().toISOString();
}

function isRole(value: unknown): value is LocalRoomRole {
  return value === 'facilitator' || value === 'participant' || value === 'observer';
}

function isStatus(value: unknown): value is LocalRoomStatus {
  return value === 'open' || value === 'paused' || value === 'closed';
}

function isParticipant(value: unknown): value is LocalRoomParticipant {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LocalRoomParticipant>;
  return typeof item.id === 'string'
    && typeof item.displayName === 'string'
    && isRole(item.role)
    && typeof item.joinedAt === 'string'
    && typeof item.lastSeenAt === 'string'
    && (item.presence === 'active' || item.presence === 'away');
}

function isSession(value: unknown): value is LocalRoomSession {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LocalRoomSession>;
  return item.schemaVersion === 1
    && typeof item.roomId === 'string'
    && typeof item.workspaceId === 'string'
    && typeof item.activityId === 'string'
    && typeof item.iterationId === 'string'
    && typeof item.name === 'string'
    && isStatus(item.status)
    && typeof item.createdAt === 'string'
    && typeof item.updatedAt === 'string'
    && Array.isArray(item.participants)
    && item.participants.every(isParticipant);
}

export function readLocalRoomSession(roomId: string): LocalRoomSession | undefined {
  if (typeof window === 'undefined' || !roomId.trim()) return undefined;
  try {
    const raw = window.localStorage.getItem(storageKey(roomId));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) && parsed.roomId === roomId ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function saveLocalRoomSession(session: LocalRoomSession): LocalRoomSaveResult {
  if (typeof window === 'undefined') return { ok: false, message: 'Browser storage is unavailable.' };
  try {
    const next = { ...session, updatedAt: now() };
    window.localStorage.setItem(storageKey(session.roomId), JSON.stringify(next));
    return { ok: true };
  } catch {
    return { ok: false, message: 'This browser could not save the local room record.' };
  }
}

export function createLocalRoomSession(input: {
  roomId?: string;
  workspaceId: string;
  activityId: string;
  iterationId: string;
  name?: string;
  displayName: string;
  role?: LocalRoomRole;
}): LocalRoomSession {
  const timestamp = now();
  const displayName = cleanRoomParticipantName(input.displayName) || 'Local participant';
  const roomId = cleanRoomName(input.roomId ?? '') || safeId('room');
  const participant: LocalRoomParticipant = {
    id: safeId('member'),
    displayName,
    role: input.role ?? 'participant',
    joinedAt: timestamp,
    lastSeenAt: timestamp,
    presence: 'active',
  };
  return {
    schemaVersion: 1,
    roomId,
    workspaceId: input.workspaceId,
    activityId: input.activityId,
    iterationId: input.iterationId,
    name: cleanRoomName(input.name ?? '') || 'Design thinking room',
    status: 'open',
    createdAt: timestamp,
    updatedAt: timestamp,
    participants: [participant],
  };
}

export function upsertLocalRoomParticipant(
  session: LocalRoomSession,
  input: { participantId?: string; displayName: string; role?: LocalRoomRole },
): LocalRoomSession {
  const displayName = cleanRoomParticipantName(input.displayName);
  if (!displayName) return session;
  const timestamp = now();
  const existing = input.participantId
    ? session.participants.find((participant) => participant.id === input.participantId)
    : session.participants.find((participant) => participant.displayName === displayName);
  const participant: LocalRoomParticipant = existing
    ? { ...existing, displayName, role: input.role ?? existing.role, lastSeenAt: timestamp, presence: 'active' }
    : {
      id: safeId('member'),
      displayName,
      role: input.role ?? 'participant',
      joinedAt: timestamp,
      lastSeenAt: timestamp,
      presence: 'active',
    };
  return {
    ...session,
    updatedAt: timestamp,
    participants: existing
      ? session.participants.map((item) => item.id === existing.id ? participant : item)
      : [...session.participants, participant],
  };
}

export function updateLocalRoomContext(
  session: LocalRoomSession,
  input: { workspaceId: string; activityId: string; iterationId: string; name?: string },
): LocalRoomSession {
  return {
    ...session,
    workspaceId: input.workspaceId,
    activityId: input.activityId,
    iterationId: input.iterationId,
    name: cleanRoomName(input.name ?? session.name) || session.name,
    updatedAt: now(),
  };
}

export function setLocalRoomStatus(session: LocalRoomSession, status: LocalRoomStatus): LocalRoomSession {
  return { ...session, status, updatedAt: now() };
}

export function buildLocalRoomLink(baseUrl: string, context: LocalRoomLinkContext): string {
  const url = new URL(baseUrl);
  url.searchParams.set('room', context.roomId);
  url.searchParams.set('workspace', context.workspaceId);
  url.searchParams.set('activity', context.activityId);
  // Keep the existing iteration-shell query names compatible with the pilot.
  url.searchParams.set('iteration', context.iterationId);
  url.searchParams.set('demoIteration', context.iterationId);
  if (context.displayName && cleanRoomParticipantName(context.displayName)) {
    const name = cleanRoomParticipantName(context.displayName);
    url.searchParams.set('participant', name);
    url.searchParams.set('demoParticipant', name);
  }
  if (context.role) url.searchParams.set('role', context.role);
  return url.toString();
}

export function readLocalRoomLinkContext(input: string | URL): LocalRoomLinkContext | undefined {
  try {
    const url = typeof input === 'string' ? new URL(input, 'http://localhost/') : input;
    const roomId = url.searchParams.get('room')?.trim();
    const workspaceId = url.searchParams.get('workspace')?.trim();
    const activityId = url.searchParams.get('activity')?.trim();
    const iterationId = (url.searchParams.get('iteration') || url.searchParams.get('demoIteration'))?.trim();
    if (!roomId || !workspaceId || !activityId || !iterationId) return undefined;
    const role = url.searchParams.get('role');
    return {
      roomId,
      workspaceId,
      activityId,
      iterationId,
      displayName: url.searchParams.get('participant') || url.searchParams.get('demoParticipant') || undefined,
      role: isRole(role) ? role : undefined,
    };
  } catch {
    return undefined;
  }
}
