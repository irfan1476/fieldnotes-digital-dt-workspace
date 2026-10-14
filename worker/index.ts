/*
 * FieldNotes' cost-zero pilot room service.
 *
 * One Durable Object owns one room. It stores the latest accepted revision
 * and member capabilities in SQLite, while WebSockets carry presence and
 * revision events to connected browsers. The browser still keeps its local
 * copy and can fall back to it if the room service is unavailable.
 */

type Role = "facilitator" | "participant" | "observer";

interface Env {
  ROOMS: DurableObjectNamespace;
}

interface MemberRecord {
  id: string;
  display_name: string;
  role: Role;
  token_hash: string;
  created_at: string;
  revoked: number;
}

interface InviteRecord {
  id: string;
  display_name: string;
  role: Role;
  token_hash: string;
  created_at: string;
  expires_at: number;
  redeemed_at: string | null;
  redeemed_member_id?: string | null;
  redeemed_token_hash?: string | null;
}

interface RevisionRecord {
  revision_number: number;
  activity_id: string;
  iteration_id: string;
  payload: string;
  created_at: string;
  request_id?: string | null;
  request_actor?: string | null;
}

interface JoinRequest {
  type: "room.join";
  requestId: string;
  roomId: string;
  workspaceId: string;
  activityId: string;
  iterationId: string;
  requestedRole: Role;
  displayName: string;
  accessToken: string;
}

interface RevisionRequest {
  type: "room.revision.append";
  requestId: string;
  roomId: string;
  baseRevisionNumber: number;
  activityId: string;
  iterationId: string;
  actorId: string;
  operation: "replace-activity-revision" | "append-event" | "append-checkpoint";
  payload: Record<string, unknown>;
}

interface PresenceRequest {
  type: "room.presence";
  roomId: string;
  memberId: string;
  presence: "active" | "away";
}

type ClientRequest = JoinRequest | RevisionRequest | PresenceRequest | {
  type: "room.leave";
  requestId: string;
  roomId: string;
  memberId: string;
};

interface SocketSession {
  member: MemberRecord;
  socket: WebSocket;
}

const PARTICIPANT_PROTECTED_FIELDS = [
  "__facilitation_locked_regions",
  "__facilitation_guided_region",
  "__vote_round_state",
  "__vote_tie_resolution",
  "__board_layout_version",
  "__resize_spaces_mode",
  "vote-budget",
];

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validWorkspaceDocument(document: unknown, workspaceId: string): boolean {
  if (!isRecord(document) || document.schemaVersion !== 2 || document.workspaceId !== workspaceId || !isRecord(document.activities)) return false;
  return Object.entries(document.activities).every(([id, value]) => {
    if (!isRecord(value) || value.activityId !== id || typeof value.iterationId !== "string" || !Array.isArray(value.revisions) || value.revisions.length === 0
      || !Array.isArray(value.blueprints) || !Array.isArray(value.checkpoints) || !Array.isArray(value.events)) return false;
    const revision = value.revisions.at(-1);
    return isRecord(revision) && revision.id === value.currentRevisionId && isRecord(revision.fields) && Array.isArray(revision.contributions)
      && isRecord(revision.board) && Array.isArray(revision.board.elements) && isRecord(revision.board.appState) && isRecord(revision.board.files);
  });
}
function sameEventOrCoalesced(previous: any, next: any, memberId: string): boolean {
  if (same(previous, next)) return true;
  return previous?.actor?.id === memberId
    && next?.actor?.id === memberId
    && previous?.type === next?.type
    && same(previous?.targetIds, next?.targetIds)
    && next?.coalescedCount > (previous?.coalescedCount ?? 1)
    && (next?.firstOccurredAt ?? next?.occurredAt) === (previous?.firstOccurredAt ?? previous?.occurredAt);
}

function authorizeParticipantDocument(currentPayload: string, incomingPayload: Record<string, unknown>, member: MemberRecord, activityId: string): { ok: true; payload: Record<string, unknown> } | { ok: false; reason: string } {
  let current: any;
  try { current = JSON.parse(currentPayload); } catch { return { ok: false, reason: "The current room document is invalid." }; }
  const incoming = incomingPayload.document as any;
  const previous = current?.document as any;
  if (!validWorkspaceDocument(previous, memberWorkspaceId(previous)) || !validWorkspaceDocument(incoming, memberWorkspaceId(previous))) return { ok: false, reason: "The shared workspace document is invalid." };
  if (incoming.schemaVersion !== previous.schemaVersion || incoming.workspaceId !== previous.workspaceId || incoming.workspaceId === undefined) return { ok: false, reason: "Workspace identity cannot be changed by a participant." };
  const previousActivities = previous.activities ?? {};
  const incomingActivities = incoming.activities ?? {};
  if (!incomingActivities[activityId]) return { ok: false, reason: "The update does not contain the active room activity." };
  for (const id of Object.keys(incomingActivities)) {
    if (!previousActivities[id] && id !== activityId) return { ok: false, reason: "Participants cannot add unrelated activities to a room update." };
  }
  for (const [id, state] of Object.entries(previousActivities)) if (id !== activityId) incomingActivities[id] = state;
  const oldActivity = previousActivities[activityId];
  const nextActivity = incomingActivities[activityId];
  if (!oldActivity || !same(oldActivity.activeBlueprintVersionId, nextActivity.activeBlueprintVersionId)
    || !same(oldActivity.blueprints, nextActivity.blueprints)
    || !same(oldActivity.checkpoints, nextActivity.checkpoints)
    || oldActivity.templateId !== nextActivity.templateId
    || oldActivity.iterationId !== nextActivity.iterationId
    || oldActivity.currentRevisionId !== nextActivity.currentRevisionId) return { ok: false, reason: "Facilitator-controlled activity settings and history are read-only to participants." };
  const oldRevisions = oldActivity.revisions ?? [];
  const nextRevisions = nextActivity.revisions ?? [];
  if (oldRevisions.length !== nextRevisions.length || !oldRevisions.length) return { ok: false, reason: "Participants cannot create, remove, or restore activity revisions." };
  for (let index = 0; index < oldRevisions.length - 1; index += 1) {
    if (!same(oldRevisions[index], nextRevisions[index])) return { ok: false, reason: "Earlier activity revisions are immutable." };
  }
  const oldRevision = oldRevisions[oldRevisions.length - 1];
  const nextRevision = nextRevisions[nextRevisions.length - 1];
  for (const key of ["id", "version", "createdAt", "createdBy", "reason", "basedOnRevisionId", "blueprintVersionId", "status"]) {
    if (!same(oldRevision[key], nextRevision[key])) return { ok: false, reason: "Participants cannot change facilitator-controlled revision metadata." };
  }
  for (const key of PARTICIPANT_PROTECTED_FIELDS) {
    if (!same(oldRevision.fields?.[key], nextRevision.fields?.[key])) return { ok: false, reason: "This field is controlled by the facilitator." };
  }
  let oldVotes: Record<string, Record<string, number>> = {};
  let nextVotes: Record<string, Record<string, number>> = {};
  try {
    oldVotes = JSON.parse(oldRevision.fields?.__vote_ledger ?? "{}");
    nextVotes = JSON.parse(nextRevision.fields?.__vote_ledger ?? "{}");
  } catch { return { ok: false, reason: "The vote record is invalid." }; }
  if (!oldVotes || typeof oldVotes !== "object" || Array.isArray(oldVotes) || !nextVotes || typeof nextVotes !== "object" || Array.isArray(nextVotes)) return { ok: false, reason: "The vote record is invalid." };
  for (const actorId of Object.keys(nextVotes)) if (actorId !== member.id && !same(oldVotes[actorId] ?? {}, nextVotes[actorId] ?? {})) return { ok: false, reason: "Participants can only change their own votes." };
  if (!same(oldVotes[member.id] ?? {}, nextVotes[member.id] ?? {})) {
    if (oldRevision.fields?.__vote_round_state !== "open") return { ok: false, reason: "Voting is not open." };
    const budget = Math.min(5, Math.max(1, Number.parseInt(String(oldRevision.fields?.["vote-budget"] ?? "3"), 10) || 3));
    const candidates = new Set((nextRevision.contributions ?? []).filter((item: any) => item.regionId === "candidates").map((item: any) => item.id));
    const allocation = nextVotes[member.id] ?? {};
    const votes = Object.entries(allocation);
    if (votes.some(([candidateId, count]) => !candidates.has(candidateId) || !Number.isInteger(count) || count < 0)
      || votes.reduce((total, [, count]) => total + count, 0) > budget) return { ok: false, reason: "The vote exceeds the room budget or names an invalid candidate." };
  }
  const mergedVotes = { ...oldVotes };
  if (Object.keys(nextVotes[member.id] ?? {}).length) mergedVotes[member.id] = nextVotes[member.id];
  else delete mergedVotes[member.id];
  const allCandidates = new Set((nextRevision.contributions ?? []).filter((item: any) => item.regionId === "candidates").map((item: any) => item.id));
  const configuredBudget = Math.min(5, Math.max(1, Number.parseInt(String(oldRevision.fields?.["vote-budget"] ?? "3"), 10) || 3));
  for (const allocation of Object.values(mergedVotes)) {
    if (!allocation || typeof allocation !== "object" || Array.isArray(allocation) || Object.entries(allocation).some(([id, count]) => !allCandidates.has(id) || !Number.isInteger(count) || (count as number) < 0)
      || Object.values(allocation).reduce((total, count) => total + (Number.isInteger(count) ? count : 0), 0) > configuredBudget) return { ok: false, reason: "The room vote record is inconsistent with its candidates or budget." };
  }
  nextRevision.fields.__vote_ledger = JSON.stringify(mergedVotes);
  const oldContributions = new Map<string, any>((oldRevision.contributions ?? []).map((item: any) => [item.id, item]));
  for (const contribution of nextRevision.contributions ?? []) {
    const prior = oldContributions.get(contribution.id) as any;
    if (prior) {
      if (!same(prior.author, contribution.author) || prior.createdAt !== contribution.createdAt) return { ok: false, reason: "Contribution authorship cannot be reassigned." };
    } else {
      contribution.author = { id: member.id, displayName: member.display_name, role: "participant" };
    }
  }
  const priorEvents = new Map<string, any>((oldActivity.events ?? []).map((item: any) => [item.id, item]));
  for (const [id, prior] of priorEvents) {
    const retained = (nextActivity.events ?? []).find((event: any) => event.id === id);
    if (!retained || !sameEventOrCoalesced(prior, retained, member.id)) return { ok: false, reason: "Existing activity history is immutable." };
  }
  for (const event of nextActivity.events ?? []) {
    const prior = priorEvents.get(event.id);
    if (prior) {
      if (!sameEventOrCoalesced(prior, event, member.id)) return { ok: false, reason: "Existing activity history is immutable." };
      continue;
    }
    if (!["element-created", "element-deleted", "content-edited", "style-changed", "element-moved", "elements-grouped", "elements-ungrouped", "elements-connected", "contribution-submitted", "contribution-updated", "vote-cast", "vote-retracted"].includes(event.type)) {
      return { ok: false, reason: "This activity event requires facilitator permission." };
    }
    event.actor = { id: member.id, displayName: member.display_name, role: "participant" };
  }
  incoming.updatedAt = now();
  return { ok: true, payload: incomingPayload };
}

function memberWorkspaceId(document: any): string {
  return typeof document?.workspaceId === "string" ? document.workspaceId : "";
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization, x-fieldnotes-bootstrap-token",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  },
});

const now = () => new Date().toISOString();
const MAX_PARTICIPANTS_PER_ROOM = 20;
const MAX_OBSERVERS_PER_ROOM = 5;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
const isRole = (value: unknown): value is Role => value === "facilitator" || value === "participant" || value === "observer";

async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, "0")).join("");
}

function newToken(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}_${crypto.randomUUID()}`;
}

export class RoomDurableObject {
  private readonly state: DurableObjectState;
  private readonly sockets = new Map<WebSocket, SocketSession>();

  constructor(state: DurableObjectState) {
    this.state = state;
    state.blockConcurrencyWhile(async () => {
      state.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS members (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          revoked INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS invitations (
          id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          redeemed_at TEXT,
          redeemed_member_id TEXT,
          redeemed_token_hash TEXT
        );
        CREATE TABLE IF NOT EXISTS revisions (
          revision_number INTEGER PRIMARY KEY,
          activity_id TEXT NOT NULL,
          iteration_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          request_id TEXT,
          request_actor TEXT
        );
      `);
      const revisionColumns = state.storage.sql.exec("PRAGMA table_info(revisions)").toArray() as Array<{ name: string }>;
      if (!revisionColumns.some((column) => column.name === "request_id")) state.storage.sql.exec("ALTER TABLE revisions ADD COLUMN request_id TEXT");
      if (!revisionColumns.some((column) => column.name === "request_actor")) state.storage.sql.exec("ALTER TABLE revisions ADD COLUMN request_actor TEXT");
      state.storage.sql.exec("CREATE UNIQUE INDEX IF NOT EXISTS revisions_request_id ON revisions(request_id)");
      const invitationColumns = state.storage.sql.exec("PRAGMA table_info(invitations)").toArray() as Array<{ name: string }>;
      if (!invitationColumns.some((column) => column.name === "redeemed_member_id")) state.storage.sql.exec("ALTER TABLE invitations ADD COLUMN redeemed_member_id TEXT");
      if (!invitationColumns.some((column) => column.name === "redeemed_token_hash")) state.storage.sql.exec("ALTER TABLE invitations ADD COLUMN redeemed_token_hash TEXT");
      for (const socket of state.getWebSockets()) {
        const attachment = socket.deserializeAttachment() as { memberId?: string } | null;
        if (!attachment?.memberId) continue;
        const rows = state.storage.sql.exec("SELECT * FROM members WHERE id = ? AND revoked = 0 LIMIT 1", attachment.memberId).toArray() as MemberRecord[];
        if (rows[0]) this.sockets.set(socket, { member: rows[0], socket });
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type, authorization, x-fieldnotes-bootstrap-token",
        "access-control-allow-methods": "GET, POST, OPTIONS",
      },
    });
    const url = new URL(request.url);
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") return this.openSocket(request, url);
    if (request.method === "POST" && url.pathname.endsWith("/bootstrap")) return this.bootstrap(request);
    if (request.method === "POST" && url.pathname.endsWith("/invites/redeem")) return this.redeemInvite(request);
    if (request.method === "POST" && url.pathname.endsWith("/invites")) return this.createInvite(request);
    if (request.method === "POST" && url.pathname.endsWith("/revoke")) return this.revokeMember(request, url);
    if (request.method === "POST" && url.pathname.endsWith("/status")) return this.changeStatus(request);
    if (request.method === "GET" && url.pathname.endsWith("/state")) return this.readState(request);
    return json({ error: "not_found" }, 404);
  }

  private roomId(url: URL): string {
    const part = url.pathname.split("/").filter(Boolean).at(-2);
    return clean(part, 120);
  }

  private async memberForToken(token: string): Promise<MemberRecord | undefined> {
    const tokenHash = await hashToken(token);
    const rows = this.state.storage.sql.exec("SELECT * FROM members WHERE token_hash = ? AND revoked = 0 LIMIT 1", tokenHash).toArray() as MemberRecord[];
    return rows[0];
  }

  private meta(key: string): string | undefined {
    const rows = this.state.storage.sql.exec("SELECT value FROM room_meta WHERE key = ? LIMIT 1", key).toArray() as Array<{ value: string }>;
    return rows[0]?.value;
  }

  private currentRevision(): RevisionRecord | undefined {
    const rows = this.state.storage.sql.exec("SELECT * FROM revisions ORDER BY revision_number DESC LIMIT 1").toArray() as RevisionRecord[];
    return rows[0];
  }

  private async bootstrap(request: Request): Promise<Response> {
    const bootstrapToken = request.headers.get("x-fieldnotes-bootstrap-token")?.trim();
    if (!bootstrapToken || bootstrapToken.length < 24) return json({ error: "bootstrap_token_required" }, 400);
    if (this.meta("room_id")) {
      const existing = await this.memberForToken(bootstrapToken);
      if (existing?.role === "facilitator") return json({ roomId: this.meta("room_id"), memberId: existing.id, role: existing.role, accessToken: bootstrapToken });
      return json({ error: "room_exists" }, 409);
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const roomId = clean(body.roomId, 120);
    const workspaceId = clean(body.workspaceId, 120);
    const activityId = clean(body.activityId, 120);
    const iterationId = clean(body.iterationId, 120);
    const displayName = clean(body.displayName, 60) || "Facilitator";
    if (!roomId || roomId !== this.roomId(new URL(request.url)) || !workspaceId || !activityId || !iterationId) return json({ error: "room_context_required" }, 400);
    const memberId = `member-${crypto.randomUUID()}`;
    const timestamp = now();
    const tokenHash = await hashToken(bootstrapToken);
    this.state.storage.sql.exec("INSERT INTO room_meta (key, value) VALUES (?, ?), (?, ?), (?, ?), (?, ?)",
      "room_id", roomId, "workspace_id", workspaceId, "activity_id", activityId, "iteration_id", iterationId);
    this.state.storage.sql.exec("INSERT INTO members (id, display_name, role, token_hash, created_at, revoked) VALUES (?, ?, ?, ?, ?, 0)", memberId, displayName, "facilitator", tokenHash, timestamp);
    this.state.storage.sql.exec("INSERT INTO revisions (revision_number, activity_id, iteration_id, payload, created_at) VALUES (0, ?, ?, ?, ?)", activityId, iterationId, JSON.stringify({}), timestamp);
    return json({ roomId, memberId, role: "facilitator", accessToken: bootstrapToken });
  }

  private async createInvite(request: Request): Promise<Response> {
    const authorization = request.headers.get("authorization") ?? "";
    const facilitator = await this.memberForToken(authorization.replace(/^Bearer\s+/i, ""));
    if (!facilitator || facilitator.role !== "facilitator") return json({ error: "forbidden" }, 403);
    if ((this.meta("room_status") ?? "open") === "closed") return json({ error: "room_closed" }, 409);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    if (body.role === "facilitator") return json({ error: "facilitator_invites_not_supported" }, 403);
    const role = isRole(body.role) ? body.role : "participant";
    const displayName = clean(body.displayName, 60) || "Participant";
    const inviteToken = newToken(role);
    const inviteId = `invite-${crypto.randomUUID()}`;
    const tokenHash = await hashToken(inviteToken);
    const createdAt = now();
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    // Invitations are not seats. Capacity is enforced when the bearer link is redeemed.
    this.state.storage.sql.exec(
      "INSERT INTO invitations (id, display_name, role, token_hash, created_at, expires_at, redeemed_at, redeemed_member_id, redeemed_token_hash) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL)",
      inviteId, displayName, role, tokenHash, createdAt, expiresAt,
    );
    return json({ roomId: this.meta("room_id"), role, displayName, inviteToken, expiresAt });
  }

  private async redeemInvite(request: Request): Promise<Response> {
    if ((this.meta("room_status") ?? "open") === "closed") return json({ error: "room_closed" }, 409);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken.trim() : "";
    const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
    if (inviteToken.length < 24 || accessToken.length < 24 || inviteToken === accessToken) return json({ error: "invite_and_member_tokens_required" }, 400);
    const inviteHash = await hashToken(inviteToken);
    const accessHash = await hashToken(accessToken);
    const invitations = this.state.storage.sql.exec("SELECT * FROM invitations WHERE token_hash = ? LIMIT 1", inviteHash).toArray() as InviteRecord[];
    const invite = invitations[0];
    if (!invite) return json({ error: "invite_invalid" }, 410);
    if (invite.redeemed_at) {
      if (!invite.redeemed_member_id || invite.redeemed_token_hash !== accessHash) return json({ error: "invite_already_redeemed" }, 410);
      const redeemedMembers = this.state.storage.sql.exec("SELECT * FROM members WHERE id = ? AND revoked = 0 LIMIT 1", invite.redeemed_member_id).toArray() as MemberRecord[];
      const member = redeemedMembers[0];
      if (!member) return json({ error: "invite_member_revoked" }, 410);
      return json({ roomId: this.meta("room_id"), memberId: member.id, role: member.role, displayName: member.display_name, accessToken });
    }
    if (invite.expires_at <= Date.now()) return json({ error: "invite_expired" }, 410);

    // Count, consume invite and create member in one synchronous SQLite section.
    const count = (this.state.storage.sql.exec("SELECT COUNT(*) AS total FROM members WHERE role = ? AND revoked = 0", invite.role).toArray() as Array<{ total: number }>)[0]?.total ?? 0;
    const limit = invite.role === "participant" ? MAX_PARTICIPANTS_PER_ROOM : MAX_OBSERVERS_PER_ROOM;
    if (count >= limit) return json({ error: invite.role === "participant" ? "room_full" : "observer_limit_reached" }, 409);
    const memberId = `member-${crypto.randomUUID()}`;
    const redeemedAt = now();
    this.state.storage.sql.exec(
      "UPDATE invitations SET redeemed_at = ?, redeemed_member_id = ?, redeemed_token_hash = ? WHERE id = ? AND redeemed_at IS NULL AND expires_at > ?",
      redeemedAt, memberId, accessHash, invite.id, Date.now(),
    );
    const updateResult = this.state.storage.sql.exec("SELECT changes() AS total").toArray() as Array<{ total: number }>;
    if ((updateResult[0]?.total ?? 0) !== 1) return json({ error: "invite_already_redeemed" }, 410);
    this.state.storage.sql.exec("INSERT INTO members (id, display_name, role, token_hash, created_at, revoked) VALUES (?, ?, ?, ?, ?, 0)", memberId, invite.display_name, invite.role, accessHash, redeemedAt);
    return json({ roomId: this.meta("room_id"), memberId, role: invite.role, displayName: invite.display_name, accessToken });
  }

  private async revokeMember(request: Request, url: URL): Promise<Response> {
    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const facilitator = await this.memberForToken(token);
    if (!facilitator || facilitator.role !== "facilitator") return json({ error: "forbidden" }, 403);
    const memberId = clean(url.pathname.split("/").filter(Boolean).at(-2), 120);
    const rows = this.state.storage.sql.exec("SELECT * FROM members WHERE id = ? AND revoked = 0 LIMIT 1", memberId).toArray() as MemberRecord[];
    const member = rows[0];
    if (!member || member.role === "facilitator") return json({ error: "member_not_found" }, 404);
    this.state.storage.sql.exec("UPDATE members SET revoked = 1 WHERE id = ?", memberId);
    for (const [socket, session] of this.sockets) {
      if (session.member.id !== memberId) continue;
      this.sockets.delete(socket);
      try { socket.close(1008, "Room access revoked"); } catch { /* socket already closed */ }
    }
    this.broadcast({ type: "room.member.revoked", memberId });
    return json({ ok: true, memberId });
  }

  private async readState(request: Request): Promise<Response> {
    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const member = await this.memberForToken(token);
    if (!member) return json({ error: "unauthenticated" }, 401);
    return json(await this.snapshot(member.role, member.id));
  }

  private async changeStatus(request: Request): Promise<Response> {
    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    const member = await this.memberForToken(token);
    if (!member || member.role !== "facilitator") return json({ error: "forbidden" }, 403);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const status = body.status;
    if (status !== "open" && status !== "paused" && status !== "closed") return json({ error: "invalid_room_status" }, 400);
    this.state.storage.sql.exec("INSERT INTO room_meta (key, value) VALUES ('room_status', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", status);
    this.broadcast({ type: "room.status.changed", status });
    return json({ status });
  }

  private async openSocket(request: Request, url: URL): Promise<Response> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    void this.handleSocketMessage(socket, message);
  }

  webSocketClose(socket: WebSocket): void {
    this.handleSocketClose(socket);
  }

  private async handleSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    let message: ClientRequest;
    try {
      const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
      if (new TextEncoder().encode(text).byteLength > 1_000_000) throw new Error("Message too large.");
      message = JSON.parse(text) as ClientRequest;
    } catch {
      socket.send(JSON.stringify({ type: "room.error", error: { code: "invalid-message", message: "Invalid JSON." } }));
      return;
    }
    if (message.type === "room.join") return this.join(socket, message);
    const session = this.sockets.get(socket);
    if (!session) {
      socket.send(JSON.stringify({ type: "room.error", error: { code: "unauthenticated", message: "Join the room before sending events." } }));
      return;
    }
    if (message.type === "room.leave") return this.leave(socket, message);
    if (message.type === "room.presence") return this.presence(session, message);
    if (message.type === "room.revision.append") return this.appendRevision(socket, session, message);
  }

  private async join(socket: WebSocket, request: JoinRequest): Promise<void> {
    const member = await this.memberForToken(request.accessToken);
    if (!member || request.roomId !== this.meta("room_id") || request.workspaceId !== this.meta("workspace_id") || ((this.meta("room_status") ?? "open") === "closed" && member.role !== "facilitator")) {
      socket.send(JSON.stringify({ type: "room.error", requestId: request.requestId, error: { code: "unauthenticated", message: "This invite is invalid or expired." } }));
      socket.close(1008, "Unauthenticated");
      return;
    }
    this.sockets.set(socket, { member, socket });
    socket.serializeAttachment({ memberId: member.id });
    socket.send(JSON.stringify({ type: "room.snapshot", requestId: request.requestId, snapshot: await this.snapshot(member.role, member.id) }));
    this.broadcast({ type: "room.member.joined", member: { id: member.id, displayName: member.display_name, role: member.role, presence: "active", joinedAt: member.created_at, lastSeenAt: now() } }, socket);
  }

  private async leave(socket: WebSocket, request: { requestId: string }): Promise<void> {
    const session = this.sockets.get(socket);
    if (!session) return;
    this.sockets.delete(socket);
    this.broadcast({ type: "room.member.left", requestId: request.requestId, member: { id: session.member.id, displayName: session.member.display_name, role: session.member.role, presence: "away", joinedAt: session.member.created_at, lastSeenAt: now() } });
    socket.close(1000, "Left room");
  }

  private presence(session: SocketSession, request: PresenceRequest): void {
    this.broadcast({ type: "room.member.presence", roomId: request.roomId, member: { id: session.member.id, displayName: session.member.display_name, role: session.member.role, presence: request.presence, joinedAt: session.member.created_at, lastSeenAt: now() } });
  }

  private async appendRevision(socket: WebSocket, session: SocketSession, request: RevisionRequest): Promise<void> {
    if (session.member.role === "observer") {
      socket.send(JSON.stringify({ type: "room.revision.rejected", requestId: request.requestId, error: { code: "forbidden", message: "Observers cannot change the room." } }));
      return;
    }
    if (typeof request.requestId !== "string" || request.requestId.length < 8 || request.requestId.length > 180) {
      socket.send(JSON.stringify({ type: "room.revision.rejected", error: { code: "invalid-message", message: "A valid update ID is required." } }));
      return;
    }
    const replay = this.state.storage.sql.exec("SELECT * FROM revisions WHERE request_id = ? LIMIT 1", request.requestId).toArray() as RevisionRecord[];
    if (replay[0]) {
      if (replay[0].request_actor !== session.member.id) {
        socket.send(JSON.stringify({ type: "room.revision.rejected", requestId: request.requestId, error: { code: "forbidden", message: "This update ID belongs to another member." } }));
        return;
      }
      const document = JSON.parse(replay[0].payload).document;
      const event = { type: "room.revision.accepted", requestId: request.requestId, actorId: session.member.id, revision: { activityId: replay[0].activity_id, iterationId: replay[0].iteration_id, revisionId: `revision-${replay[0].revision_number}`, revisionNumber: replay[0].revision_number, updatedAt: replay[0].created_at }, document };
      const recipientEvent = { ...event, document: this.redactVotes({ document }, session.member.role, session.member.id) as Record<string, unknown> };
      socket.send(JSON.stringify(recipientEvent));
      return;
    }
    const current = this.currentRevision();
    const roomStatus = this.meta("room_status") ?? "open";
    if (roomStatus !== "open") {
      socket.send(JSON.stringify({ type: "room.revision.rejected", requestId: request.requestId, error: { code: "room-closed", message: roomStatus === "paused" ? "The facilitator paused this room." : "This room is closed." } }));
      return;
    }
    if (request.roomId !== this.meta("room_id") || !request.activityId || !request.iterationId) {
      socket.send(JSON.stringify({ type: "room.revision.rejected", requestId: request.requestId, error: { code: "forbidden", message: "This update does not belong to the connected room." } }));
      return;
    }
    const requestedDocument = (request.payload as any)?.document;
    const requestedActivity = requestedDocument?.activities?.[request.activityId];
    if (!validWorkspaceDocument(requestedDocument, this.meta("workspace_id") ?? "") || !requestedActivity || requestedActivity.iterationId !== request.iterationId) {
      socket.send(JSON.stringify({ type: "room.revision.rejected", requestId: request.requestId, error: { code: "invalid-message", message: "The update does not match this room's workspace and activity." } }));
      return;
    }
    if (!current || request.baseRevisionNumber !== current.revision_number) {
      socket.send(JSON.stringify({ type: "room.revision.rejected", requestId: request.requestId, error: { code: "conflict", message: "The room changed. The latest board is attached so your edit can be merged.", expectedRevisionNumber: current?.revision_number ?? 0 }, snapshot: await this.snapshot(session.member.role, session.member.id) }));
      return;
    }
    let payload = request.payload;
    if (session.member.role === "participant") {
      const authorized = authorizeParticipantDocument(current!.payload, request.payload, session.member, request.activityId);
      if (!authorized.ok) {
        socket.send(JSON.stringify({ type: "room.revision.rejected", requestId: request.requestId, error: { code: "forbidden", message: authorized.reason } }));
        return;
      }
      payload = authorized.payload;
    }
    const serializedPayload = JSON.stringify(payload);
    if (new TextEncoder().encode(serializedPayload).byteLength > 750_000) {
      socket.send(JSON.stringify({ type: "room.revision.rejected", requestId: request.requestId, error: { code: "invalid-message", message: "This board update is too large to sync. Remove large embedded images and try again." } }));
      return;
    }
    const nextNumber = current.revision_number + 1;
    const timestamp = now();
    this.state.storage.sql.exec("INSERT INTO revisions (revision_number, activity_id, iteration_id, payload, created_at, request_id, request_actor) VALUES (?, ?, ?, ?, ?, ?, ?)", nextNumber, request.activityId, request.iterationId, serializedPayload, timestamp, request.requestId, session.member.id);
    const revision = { activityId: request.activityId, iterationId: request.iterationId, revisionId: `revision-${nextNumber}`, revisionNumber: nextNumber, updatedAt: timestamp };
    this.broadcast({ type: "room.revision.accepted", requestId: request.requestId, actorId: session.member.id, revision, document: payload.document });
  }

  private async snapshot(role?: Role, memberId?: string): Promise<Record<string, unknown>> {
    const current = this.currentRevision();
    const members = (this.state.storage.sql.exec("SELECT * FROM members WHERE revoked = 0 ORDER BY created_at ASC").toArray() as MemberRecord[]).map((member) => ({
      id: member.id,
      displayName: member.display_name,
      role: member.role,
      presence: Array.from(this.sockets.values()).some((session) => session.member.id === member.id) ? "active" : "away",
      joinedAt: member.created_at,
      lastSeenAt: member.created_at,
    }));
    return {
      roomId: this.meta("room_id"),
      workspaceId: this.meta("workspace_id"),
      status: this.meta("room_status") === "paused" ? "paused" : this.meta("room_status") === "closed" ? "closed" : "open",
      members,
      revision: { activityId: current?.activity_id ?? this.meta("activity_id"), iterationId: current?.iteration_id ?? this.meta("iteration_id"), revisionId: `revision-${current?.revision_number ?? 0}`, revisionNumber: current?.revision_number ?? 0, updatedAt: current?.created_at ?? now() },
      document: current ? this.redactVotes(JSON.parse(current.payload), role, memberId) : {},
    };
  }

  private redactVotes(payload: unknown, role?: Role, memberId?: string): unknown {
    if (role !== "participant" || !memberId || !payload || typeof payload !== "object") return payload;
    const clone = JSON.parse(JSON.stringify(payload)) as any;
    for (const activity of Object.values(clone.document?.activities ?? {}) as any[]) {
      const revision = activity.revisions?.at(-1);
      if (!revision?.fields || revision.fields.__vote_round_state === "closed") continue;
      let ledger: Record<string, Record<string, number>> = {};
      try { ledger = JSON.parse(revision.fields.__vote_ledger ?? "{}"); } catch { ledger = {}; }
      revision.fields.__vote_ledger = JSON.stringify(ledger[memberId] ? { [memberId]: ledger[memberId] } : {});
    }
    return clone;
  }

  private broadcast(event: Record<string, unknown>, except?: WebSocket): void {
    for (const [socket, session] of this.sockets) {
      if (socket === except) continue;
      try {
        const recipientEvent = event.document ? { ...event, document: this.redactVotes({ document: event.document }, session.member.role, session.member.id) as Record<string, unknown> } : event;
        socket.send(JSON.stringify(recipientEvent));
      } catch { this.sockets.delete(socket); }
    }
  }

  private handleSocketClose(socket: WebSocket): void {
    const session = this.sockets.get(socket);
    if (!session) return;
    this.sockets.delete(socket);
    this.broadcast({ type: "room.member.left", member: { id: session.member.id, displayName: session.member.display_name, role: session.member.role, presence: "away", joinedAt: session.member.created_at, lastSeenAt: now() } });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, service: "fieldnotes-room" });
    const match = url.pathname.match(/^\/rooms\/([^/]+)(?:\/.*)?$/);
    if (!match) return json({ error: "not_found" }, 404);
    const roomId = decodeURIComponent(match[1]);
    const objectId = env.ROOMS.idFromName(roomId);
    const object = env.ROOMS.get(objectId);
    return object.fetch(request);
  },
};
