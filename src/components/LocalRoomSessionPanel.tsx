import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  buildLocalRoomLink,
  cleanRoomName,
  cleanRoomParticipantName,
  createLocalRoomSession,
  readLocalRoomSession,
  saveLocalRoomSession,
  setLocalRoomStatus,
  updateLocalRoomContext,
  upsertLocalRoomParticipant,
  type LocalRoomRole,
  type LocalRoomSession,
  type LocalRoomStatus,
} from '../domain/local-room-session';
import { WebSocketCollaborationTransport } from '../domain/collaboration-client';
import type { CollaborationConnectionState, CollaborationRole, RoomMember } from '../domain/collaboration-protocol';
import { bootstrapRemoteRoom, createCapabilityToken, createRemoteInvite, remoteSocketUrl, revokeRemoteRoomMember, updateRemoteRoomStatus } from '../domain/remote-room-service';
import '../local-room-session.css';

export interface LocalRoomSessionPanelProps {
  /** Stable browser-local room key. A share link does not make this remotely accessible. */
  workspaceId: string;
  activityId: string;
  iterationId: string;
  roomId?: string;
  initialRoomName?: string;
  initialDisplayName?: string;
  role?: LocalRoomRole;
  /** Defaults to the current page URL; useful for deterministic link previews in tests. */
  baseUrl?: string;
  onSessionChange?: (session: LocalRoomSession) => void;
  className?: string;
}

function baseUrl(override?: string): string {
  if (override) return override;
  if (typeof window !== 'undefined') return window.location.href;
  return 'http://localhost/';
}

function defaultRoomId(workspaceId: string): string {
  return `room:${workspaceId}`;
}

function statusLabel(status: LocalRoomStatus): string {
  return status === 'open' ? 'Open' : status === 'paused' ? 'Paused' : 'Closed';
}

function roleLabel(role: LocalRoomRole): string {
  return role === 'facilitator' ? 'Facilitator' : role === 'observer' ? 'Observer' : 'Participant';
}

export function LocalRoomSessionPanel({
  workspaceId,
  activityId,
  iterationId,
  roomId: requestedRoomId,
  initialRoomName = 'Design thinking room',
  initialDisplayName = 'Local participant',
  role = 'participant',
  baseUrl: linkBaseUrl,
  onSessionChange,
  className = '',
}: LocalRoomSessionPanelProps) {
  const idPrefix = useId().replace(/:/g, '');
  const titleId = `${idPrefix}-room-title`;
  const roomNameId = `${idPrefix}-room-name`;
  const participantNameId = `${idPrefix}-room-participant`;
  const membersTitleId = `${idPrefix}-room-members-title`;
  const roomId = useMemo(() => cleanRoomName(requestedRoomId ?? defaultRoomId(workspaceId)), [requestedRoomId, workspaceId]);
  const [session, setSession] = useState<LocalRoomSession>();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [roomName, setRoomName] = useState(initialRoomName);
  const [feedback, setFeedback] = useState('');
  const [link, setLink] = useState('');
  const [remoteToken, setRemoteToken] = useState('');
  const [remoteMemberId, setRemoteMemberId] = useState('');
  const [remoteRole, setRemoteRole] = useState<CollaborationRole | undefined>();
  const [remoteState, setRemoteState] = useState<CollaborationConnectionState>('idle');
  const [remoteMembers, setRemoteMembers] = useState<RoomMember[]>([]);
  const [remoteRoomStatus, setRemoteRoomStatus] = useState<LocalRoomStatus>('open');
  const [remoteError, setRemoteError] = useState('');
  const transportRef = useRef<WebSocketCollaborationTransport>();

  const remoteTokenKey = `fieldnotes:room-token:${roomId}`;
  const remoteMemberKey = `fieldnotes:room-member:${roomId}`;

  function contextOnlyLink(value: string): string {
    const url = new URL(value);
    url.searchParams.delete('roomToken');
    url.searchParams.delete('roomMember');
    url.hash = '';
    return url.toString();
  }

  useEffect(() => {
    const stored = readLocalRoomSession(roomId);
    const next = stored
      ? updateLocalRoomContext(stored, { workspaceId, activityId, iterationId })
      : createLocalRoomSession({
        roomId,
        workspaceId,
        activityId,
        iterationId,
        name: initialRoomName,
        displayName: initialDisplayName,
        role,
      });
    const activeMember = next.participants[0];
    const named = activeMember?.displayName || cleanRoomParticipantName(initialDisplayName) || 'Local participant';
    const saved = saveLocalRoomSession(next);
    setSession(next);
    setDisplayName(named);
    setRoomName(next.name);
    setLink(contextOnlyLink(buildLocalRoomLink(baseUrl(linkBaseUrl), { roomId: next.roomId, workspaceId, activityId, iterationId, displayName: named, role })));
    setFeedback(saved.ok ? '' : saved.message);
    onSessionChange?.(next);
  }, [roomId, workspaceId, activityId, iterationId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const inviteToken = new URLSearchParams(window.location.hash.slice(1)).get('invite')?.trim();
    if (inviteToken) {
      setRemoteState('connecting');
      return undefined;
    }
    const params = new URLSearchParams(window.location.search);
    const fromLink = params.get('roomToken')?.trim() || '';
    const storedToken = window.localStorage.getItem(remoteTokenKey) || '';
    const nextToken = fromLink || storedToken;
    const fromLinkMember = params.get('roomMember')?.trim() || '';
    const storedMember = window.localStorage.getItem(remoteMemberKey) || '';
    const nextMember = fromLinkMember || storedMember;
    if (fromLink) window.localStorage.setItem(remoteTokenKey, fromLink);
    if (fromLinkMember) window.localStorage.setItem(remoteMemberKey, fromLinkMember);
    setRemoteToken(nextToken);
    setRemoteMemberId(nextMember);
  }, [remoteMemberKey, remoteTokenKey]);

  useEffect(() => {
    const onRoomReady = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string; token?: string; memberId?: string; role?: CollaborationRole }>).detail;
      if (!detail?.token || (detail.roomId && detail.roomId !== roomId)) return;
      window.localStorage.setItem(remoteTokenKey, detail.token);
      if (detail.memberId) window.localStorage.setItem(remoteMemberKey, detail.memberId);
      setRemoteToken(detail.token);
      setRemoteMemberId(detail.memberId || '');
      if (detail.role) setRemoteRole(detail.role);
    };
    window.addEventListener('fieldnotes:room-ready', onRoomReady);
    return () => window.removeEventListener('fieldnotes:room-ready', onRoomReady);
  }, [remoteMemberKey, remoteTokenKey, roomId]);

  useEffect(() => {
    if (!remoteToken) {
      setRemoteState('idle');
      return undefined;
    }
    const transport = new WebSocketCollaborationTransport({
      url: remoteSocketUrl(roomId),
      join: { roomId, workspaceId, activityId, iterationId, requestedRole: role, displayName, accessToken: remoteToken },
    });
    transportRef.current = transport;
    const removeStateListener = transport.onStateChange(setRemoteState);
    const removeEventListener = transport.onEvent((event) => {
      if (event.type === 'room.snapshot' && event.snapshot) {
        setRemoteMembers(event.snapshot.members);
        setRemoteRoomStatus(event.snapshot.status);
        const self = event.snapshot.members.find((member) => member.id === remoteMemberId);
        if (self) setRemoteRole(self.role);
        setRemoteError('');
      } else if (event.type === 'room.member.joined' && event.member) {
        setRemoteMembers((members) => members.some((member) => member.id === event.member?.id) ? members : [...members, event.member!]);
      } else if (event.type === 'room.member.left' && event.member) {
        setRemoteMembers((members) => members.map((member) => member.id === event.member?.id ? { ...member, presence: 'away' } : member));
      } else if (event.type === 'room.member.presence' && event.member) {
        setRemoteMembers((members) => members.map((member) => member.id === event.member?.id ? event.member! : member));
      } else if (event.type === 'room.member.revoked' && event.memberId) {
        setRemoteMembers((members) => members.filter((member) => member.id !== event.memberId));
      } else if (event.type === 'room.status.changed' && event.status) {
        setRemoteRoomStatus(event.status);
      } else if (event.type === 'room.error' && event.error) {
        setRemoteError(event.error.message);
      }
    });
    transport.connect();
    return () => {
      removeStateListener();
      removeEventListener();
      transport.close();
      if (transportRef.current === transport) transportRef.current = undefined;
    };
  }, [activityId, displayName, iterationId, remoteMemberId, remoteToken, role, roomId, workspaceId]);

  useEffect(() => {
    if (!session) return;
    const member = session.participants[0];
    setLink(contextOnlyLink(buildLocalRoomLink(baseUrl(linkBaseUrl), {
      roomId: session.roomId,
      workspaceId: session.workspaceId,
      activityId: session.activityId,
      iterationId: session.iterationId,
      displayName: member?.displayName,
      role: remoteRole ?? member?.role,
    })));
  }, [remoteMemberId, remoteRole, remoteToken, session]);

  async function startSharedRoom() {
    if (role !== 'facilitator' || !session) return;
    const token = remoteToken || createCapabilityToken();
    try {
      const identity = await bootstrapRemoteRoom({ roomId: session.roomId, workspaceId, activityId, iterationId, displayName }, token);
      window.localStorage.setItem(remoteTokenKey, token);
      if (identity.memberId) window.localStorage.setItem(remoteMemberKey, identity.memberId);
      setRemoteToken(token);
      setRemoteMemberId(identity.memberId);
      setRemoteRole('facilitator');
      window.dispatchEvent(new CustomEvent('fieldnotes:room-ready', { detail: { roomId: session.roomId, token, memberId: identity.memberId } }));
      setFeedback('Shared room ready. Use a participant invite to grant access; the context link alone is not an invite.');
    } catch (error) {
      setRemoteError(error instanceof Error ? error.message : 'The shared room could not be started.');
    }
  }

  function createIndependentRoom() {
    if (role !== 'facilitator') return;
    const id = `room-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
    const url = new URL(window.location.href);
    url.searchParams.set('room', id);
    url.searchParams.set('role', 'facilitator');
    url.searchParams.delete('roomToken');
    url.searchParams.delete('roomMember');
    window.location.assign(url.toString());
  }

  async function copyInvite(inviteRole: CollaborationRole) {
    if (!session || !remoteToken || (remoteRole ?? role) !== 'facilitator') return;
    try {
      const invite = await createRemoteInvite(session.roomId, remoteToken, inviteRole, inviteRole === 'observer' ? 'Observer' : 'Participant');
      const inviteUrl = new URL(buildLocalRoomLink(baseUrl(linkBaseUrl), { roomId: session.roomId, workspaceId, activityId, iterationId, displayName: invite.displayName, role: invite.role }));
      inviteUrl.searchParams.delete('roomToken');
      inviteUrl.searchParams.delete('roomMember');
      inviteUrl.hash = new URLSearchParams({ invite: invite.inviteToken }).toString();
      const value = inviteUrl.toString();
      setLink(value);
      await navigator.clipboard.writeText(value);
      setFeedback(`${inviteRole === 'observer' ? 'Observer' : 'Participant'} invite copied. It expires in 24 hours and can be redeemed once.`);
    } catch (error) {
      setRemoteError(error instanceof Error ? error.message : 'The invite could not be created.');
    }
  }

  function commit(next: LocalRoomSession, message?: string) {
    setSession(next);
    const result = saveLocalRoomSession(next);
    setFeedback(result.ok ? (message ?? 'Saved in this browser.') : result.message);
    onSessionChange?.(next);
    const member = next.participants[0];
    setLink(contextOnlyLink(buildLocalRoomLink(baseUrl(linkBaseUrl), {
      roomId: next.roomId,
      workspaceId: next.workspaceId,
      activityId: next.activityId,
      iterationId: next.iterationId,
      displayName: member?.displayName,
      role: remoteRole ?? member?.role,
    })));
  }

  function saveDetails(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!session) return;
    const name = cleanRoomParticipantName(displayName);
    if (!name) {
      setFeedback('Enter a display name to continue.');
      return;
    }
    const next = upsertLocalRoomParticipant(
      updateLocalRoomContext(session, { workspaceId, activityId, iterationId, name: roomName }),
      { participantId: session.participants[0]?.id, displayName: name, role },
    );
    setDisplayName(name);
    setRoomName(cleanRoomName(roomName) || 'Design thinking room');
    commit(next, 'Room details saved in this browser.');
  }

  async function changeStatus(status: LocalRoomStatus) {
    if (!session || (remoteState === 'connected' ? remoteRole !== 'facilitator' : role !== 'facilitator')) return;
    try {
      if (remoteState === 'connected' && remoteToken) await updateRemoteRoomStatus(roomId, remoteToken, status);
      commit(setLocalRoomStatus(session, status), `Room marked ${statusLabel(status).toLowerCase()}.`);
      if (remoteState === 'connected') setRemoteRoomStatus(status);
    } catch (error) {
      setRemoteError(error instanceof Error ? error.message : 'The room status could not be changed.');
    }
  }

  async function removeMember(memberId: string) {
    if (!remoteToken || remoteRole !== 'facilitator') return;
    try {
      await revokeRemoteRoomMember(roomId, remoteToken, memberId);
      setRemoteMembers((members) => members.filter((member) => member.id !== memberId));
      setFeedback('Room access revoked and the participant seat released.');
    } catch (error) {
      setRemoteError(error instanceof Error ? error.message : 'Room access could not be revoked.');
    }
  }

  async function copyLink() {
    if (!session) return;
    const member = session.participants[0];
    const value = contextOnlyLink(buildLocalRoomLink(baseUrl(linkBaseUrl), {
      roomId: session.roomId,
      workspaceId: session.workspaceId,
      activityId: session.activityId,
      iterationId: session.iterationId,
      displayName: member?.displayName,
      role: remoteRole ?? member?.role,
    }));
    setLink(value);
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(remoteState === 'connected' ? 'Room context link copied; it does not grant access. Use a participant invite for shared access.' : 'Room link copied. It carries context only; it does not sync this room.');
    } catch {
      setFeedback(remoteState === 'connected' ? 'Context link ready below; it does not grant access. Use a participant invite for shared access.' : 'Room link ready below. Copy it manually; it does not sync this room.');
    }
  }

  if (!session) return <section className={`local-room-panel ${className}`}>Loading local room…</section>;
  const participantSeats = remoteMembers.filter((member) => member.role === 'participant').length;
  const onlineMembers = remoteMembers.filter((member) => member.presence === 'active').length;
  const facilitatorMode = remoteState === 'connected' ? remoteRole === 'facilitator' : role === 'facilitator';
  const shownStatus = remoteState === 'connected' ? remoteRoomStatus : session.status;

  return (
    <section className={`local-room-panel ${className}`.trim()} aria-labelledby={titleId}>
      <header className="local-room-panel__header">
        <div>
          <span className="local-room-panel__eyebrow">Team room</span>
          <h2 id={titleId}>{session.name}</h2>
        </div>
        <span className={`local-room-panel__local-badge ${remoteState === 'connected' ? 'is-remote' : ''}`}><i aria-hidden="true" /> {remoteState === 'connected' ? 'Shared room' : 'Local only'}</span>
      </header>

      <p className="local-room-panel__notice">{remoteState === 'connected' ? 'This room is connected. Board edits and activity notes sync live and are saved in the shared room.' : 'This room is saved in this browser. Start a shared room to let invited teammates see and edit the same board.'}</p>

      <form className="local-room-panel__details" onSubmit={saveDetails}>
        <label htmlFor={roomNameId}>Room name</label>
        <input id={roomNameId} value={roomName} maxLength={80} onChange={(event) => setRoomName(event.target.value)} />
        <label htmlFor={participantNameId}>Your name</label>
        <div className="local-room-panel__name-row">
          <input id={participantNameId} value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} />
          <button type="submit">Save</button>
        </div>
      </form>

      <div className="local-room-panel__status-row">
        <span className={`local-room-panel__status local-room-panel__status--${shownStatus}`}><i aria-hidden="true" /> {statusLabel(shownStatus)}</span>
        <span className="local-room-panel__role">You are a {roleLabel(remoteRole ?? role).toLowerCase()}</span>
        <span className="local-room-panel__count">{remoteState === 'connected' ? `${participantSeats}/20 participant seats · ${onlineMembers} online` : `${session.participants.length} local ${session.participants.length === 1 ? 'member' : 'members'}`}</span>
      </div>

      <section className="local-room-panel__members" aria-labelledby={membersTitleId}>
        <h3 id={membersTitleId}>{remoteState === 'connected' ? 'Shared presence' : 'Local presence'}</h3>
        <ul>{(remoteState === 'connected' ? remoteMembers : session.participants).map((member) => <li key={member.id}><span className="local-room-panel__avatar">{member.displayName.slice(0, 2).toUpperCase()}</span><span><strong>{member.displayName}</strong><small>{roleLabel(member.role)} · {member.presence}</small></span>{remoteState === 'connected' && facilitatorMode && member.role !== 'facilitator' && <button type="button" onClick={() => void removeMember(member.id)} aria-label={`Revoke ${member.displayName}'s room access`}>Remove</button>}</li>)}</ul>
        <p>{remoteState === 'connected' ? 'Presence and board changes are shared with this room.' : 'Presence is local until a shared room is started.'}</p>
      </section>

      {!remoteToken && facilitatorMode && <><button type="button" className="local-room-panel__primary-action" onClick={() => void startSharedRoom()}>Start shared room</button><button type="button" onClick={createIndependentRoom}>Create independent team room</button></>}
      {remoteState === 'connecting' || remoteState === 'reconnecting' ? <p className="local-room-panel__feedback" role="status">Connecting to shared room…</p> : null}
      {remoteError && <p className="local-room-panel__feedback" role="alert">{remoteError}</p>}

      {facilitatorMode && <div className="local-room-panel__status-actions" role="group" aria-label="Room status controls">
        {(['open', 'paused', 'closed'] as LocalRoomStatus[]).map((status) => <button key={status} type="button" className={shownStatus === status ? 'is-active' : ''} onClick={() => void changeStatus(status)}>{statusLabel(status)}</button>)}
      </div>}

      <div className="local-room-panel__share">
        <div><strong>Invite context</strong><small>Use this link to open the same activity and iteration.</small></div>
        <button type="button" onClick={copyLink}>Copy room link</button>
        <code>{link}</code>
      </div>
      {remoteState === 'connected' && facilitatorMode && <div className="local-room-panel__invite-actions" role="group" aria-label="Shared room invite controls"><button type="button" onClick={() => void copyInvite('participant')}>Copy participant invite</button><button type="button" onClick={() => void copyInvite('observer')}>Copy observer invite</button></div>}
      {feedback && <p className="local-room-panel__feedback" role="status">{feedback}</p>}
    </section>
  );
}

export default LocalRoomSessionPanel;
