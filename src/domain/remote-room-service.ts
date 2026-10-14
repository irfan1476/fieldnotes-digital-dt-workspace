import type { CollaborationRole } from './collaboration-protocol';

export const DEFAULT_ROOM_SERVICE_URL = 'https://fieldnotes-room.dtworker.workers.dev';
export const ROOM_SERVICE_URL = (import.meta.env.VITE_ROOM_SERVICE_URL || DEFAULT_ROOM_SERVICE_URL).replace(/\/$/, '');

export interface RemoteRoomContext {
  roomId: string;
  workspaceId: string;
  activityId: string;
  iterationId: string;
  displayName: string;
}

export interface RemoteRoomIdentity {
  memberId: string;
  role: CollaborationRole;
  accessToken: string;
}

export interface RemoteInvite {
  roomId: string;
  role: CollaborationRole;
  displayName: string;
  inviteToken: string;
  expiresAt: number;
}

function roomPath(roomId: string): string {
  return `/rooms/${encodeURIComponent(roomId)}`;
}

export function createCapabilityToken(): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `fieldnotes_${uuid}_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

export async function bootstrapRemoteRoom(context: RemoteRoomContext, bootstrapToken: string): Promise<RemoteRoomIdentity> {
  const response = await fetch(`${ROOM_SERVICE_URL}${roomPath(context.roomId)}/bootstrap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-fieldnotes-bootstrap-token': bootstrapToken },
    body: JSON.stringify(context),
  });
  const payload = await response.json().catch(() => ({})) as Partial<RemoteRoomIdentity> & { error?: string };
  if (!response.ok) throw new Error(payload.error === 'room_exists'
    ? 'This room ID is already in use. Create an independent room to get a new ID.'
    : payload.error || 'The shared room could not be created.');
  if (!payload.memberId || !payload.accessToken) throw new Error('The room service returned an incomplete facilitator invite.');
  return { memberId: payload.memberId, role: payload.role === 'facilitator' ? 'facilitator' : 'participant', accessToken: payload.accessToken };
}

export async function createRemoteInvite(roomId: string, facilitatorToken: string, role: CollaborationRole, displayName: string): Promise<RemoteInvite> {
  const response = await fetch(`${ROOM_SERVICE_URL}${roomPath(roomId)}/invites`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${facilitatorToken}` },
    body: JSON.stringify({ role, displayName }),
  });
  const payload = await response.json().catch(() => ({})) as Partial<RemoteInvite> & { error?: string };
  if (!response.ok || !payload.inviteToken || !payload.role || !payload.expiresAt) {
    const message = payload.error === 'room_full'
      ? 'This room already has 20 participant seats allocated.'
      : payload.error === 'observer_limit_reached'
        ? 'This room has reached its observer limit.'
        : payload.error || 'The invite could not be created.';
    throw new Error(message);
  }
  return payload as RemoteInvite;
}

export async function redeemRemoteInvite(roomId: string, inviteToken: string, accessToken: string): Promise<RemoteRoomIdentity & { displayName: string }> {
  const response = await fetch(`${ROOM_SERVICE_URL}${roomPath(roomId)}/invites/redeem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inviteToken, accessToken }),
  });
  const payload = await response.json().catch(() => ({})) as Partial<RemoteRoomIdentity & { displayName: string }> & { error?: string };
  if (!response.ok || !payload.memberId || !payload.accessToken || !payload.role || !payload.displayName) {
    const message = payload.error === 'room_full'
      ? 'This room already has 20 participant seats allocated.'
      : payload.error === 'observer_limit_reached'
        ? 'This room has reached its observer limit.'
        : payload.error === 'invite_expired' || payload.error === 'invite_invalid' || payload.error === 'invite_already_redeemed'
          ? 'This invite is expired, invalid, or has already been used on another device.'
          : payload.error || 'The invite could not be redeemed.';
    throw new Error(message);
  }
  return { memberId: payload.memberId, role: payload.role, accessToken: payload.accessToken, displayName: payload.displayName };
}

export async function updateRemoteRoomStatus(roomId: string, facilitatorToken: string, status: 'open' | 'paused' | 'closed'): Promise<void> {
  const response = await fetch(`${ROOM_SERVICE_URL}${roomPath(roomId)}/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${facilitatorToken}` },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || 'The room status could not be changed.');
  }
}

export async function revokeRemoteRoomMember(roomId: string, facilitatorToken: string, memberId: string): Promise<void> {
  const response = await fetch(`${ROOM_SERVICE_URL}${roomPath(roomId)}/members/${encodeURIComponent(memberId)}/revoke`, {
    method: 'POST',
    headers: { authorization: `Bearer ${facilitatorToken}` },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || 'Room access could not be revoked.');
  }
}

export function remoteSocketUrl(roomId: string): string {
  const url = new URL(`${ROOM_SERVICE_URL}${roomPath(roomId)}/ws`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}
