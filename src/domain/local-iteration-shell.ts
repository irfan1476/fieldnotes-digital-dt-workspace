/**
 * Local-only iteration containers for the prototype workshop shell.
 *
 * These records reference the existing activity and iteration identifiers but
 * deliberately do not rewrite activity revisions or board data. Iteration
 * records and checkpoints are append-only at the domain boundary: a close
 * creates a new immutable record version, and a reopen creates a new successor
 * iteration linked to the closed predecessor.
 */

export const LOCAL_ITERATION_SCHEMA_VERSION = 2 as const;
export type LocalIterationStatus = 'working' | 'closed';

export type LocalIterationVersionReason =
  | 'started'
  | 'checkpoint-saved'
  | 'closed'
  | 'reopened'
  | 'participant-updated';

export interface LocalParticipantIdentity {
  id: string;
  displayName: string;
  joinedAt: string;
}

export interface LocalIterationContainer {
  id: string;
  number: number;
  /** Monotonic record version within this iteration id. */
  recordVersion: number;
  objective: string;
  status: LocalIterationStatus;
  activeActivityId: string;
  parentIterationId?: string;
  /** Set on a successor created by reopening a closed iteration. */
  reopenedFromIterationId?: string;
  startedAt: string;
  startedBy: string;
  closedAt?: string;
  closedBy?: string;
  participants: LocalParticipantIdentity[];
}

/** An immutable point-in-time record for audit/history views. */
export interface LocalIterationVersion {
  id: string;
  iterationId: string;
  version: number;
  reason: LocalIterationVersionReason;
  savedAt: string;
  savedBy: string;
  snapshot: LocalIterationContainer;
}

/** Named immutable metadata plus the complete iteration record at save time. */
export interface LocalIterationCheckpoint {
  id: string;
  iterationId: string;
  label: string;
  note?: string;
  savedAt: string;
  savedBy: string;
  iterationVersionId: string;
  snapshot: LocalIterationContainer;
}

export interface LocalIterationWorkspace {
  schemaVersion: typeof LOCAL_ITERATION_SCHEMA_VERSION;
  workspaceId: string;
  updatedAt: string;
  iterations: LocalIterationContainer[];
  activeIterationId: string;
  /** Append-only record history. The latest snapshot remains in iterations. */
  iterationVersions: LocalIterationVersion[];
  /** Append-only named iteration snapshots. */
  checkpoints: LocalIterationCheckpoint[];
}

export type LocalIterationSaveResult = { ok: true } | { ok: false; message: string };

const STORAGE_PREFIX = 'dt-workshop-shell:v1:';

const safeId = (prefix: string): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
};

const cleanName = (name: string): string => name.trim().replace(/\s+/g, ' ').slice(0, 60);

function clone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function storageKey(workspaceId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(workspaceId)}`;
}

export function readLocalIterationWorkspace(workspaceId: string): LocalIterationWorkspace | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const candidate = parsed as Partial<Omit<LocalIterationWorkspace, 'schemaVersion'>> & { schemaVersion?: number };
    if (
      (candidate.schemaVersion !== 1 && candidate.schemaVersion !== LOCAL_ITERATION_SCHEMA_VERSION) ||
      candidate.workspaceId !== workspaceId || !Array.isArray(candidate.iterations)
    ) return undefined;
    const iterations = candidate.iterations
      .map((item, index) => normalizeIteration(item, index))
      .filter((item): item is LocalIterationContainer => Boolean(item));
    if (!iterations.length) return undefined;
    const activeIterationId = typeof candidate.activeIterationId === 'string' && iterations.some((item) => item.id === candidate.activeIterationId)
      ? candidate.activeIterationId
      : iterations[0].id;
    const iterationVersions = Array.isArray(candidate.iterationVersions)
      ? candidate.iterationVersions
        .map((item) => normalizeIterationVersion(item))
        .filter((item): item is LocalIterationVersion => Boolean(item))
      : [];
    const checkpoints = Array.isArray(candidate.checkpoints)
      ? candidate.checkpoints
        .map((item) => normalizeCheckpoint(item))
        .filter((item): item is LocalIterationCheckpoint => Boolean(item))
      : [];
    const versions = iterationVersions.length
      ? iterationVersions
      : iterations.map((iteration) => createIterationVersion(iteration, 'started', iteration.startedBy, iteration.startedAt));
    return {
      schemaVersion: LOCAL_ITERATION_SCHEMA_VERSION,
      workspaceId,
      updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
      iterations,
      activeIterationId,
      iterationVersions: versions,
      checkpoints,
    };
  } catch {
    return undefined;
  }
}

export function saveLocalIterationWorkspace(workspace: LocalIterationWorkspace): LocalIterationSaveResult {
  if (typeof window === 'undefined') return { ok: false, message: 'Browser storage is unavailable.' };
  try {
    const next: LocalIterationWorkspace = {
      ...workspace,
      schemaVersion: LOCAL_ITERATION_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      iterationVersions: workspace.iterationVersions ?? [],
      checkpoints: workspace.checkpoints ?? [],
    };
    window.localStorage.setItem(storageKey(workspace.workspaceId), JSON.stringify(next));
    return { ok: true };
  } catch {
    return { ok: false, message: 'This browser could not save the local iteration record.' };
  }
}

export function createLocalIterationWorkspace(input: {
  workspaceId: string;
  activeActivityId: string;
  objective?: string;
  displayName: string;
  initialIterationId?: string;
}): LocalIterationWorkspace {
  const startedAt = new Date().toISOString();
  const actorName = cleanName(input.displayName) || 'Local participant';
  const iteration: LocalIterationContainer = {
    id: input.initialIterationId || safeId('iteration'),
    number: 1,
    recordVersion: 1,
    objective: input.objective?.trim() ?? '',
    status: 'working',
    activeActivityId: input.activeActivityId,
    startedAt,
    startedBy: actorName,
    participants: [{ id: safeId('participant'), displayName: actorName, joinedAt: startedAt }],
  };
  const version = createIterationVersion(iteration, 'started', actorName, startedAt);
  return {
    schemaVersion: LOCAL_ITERATION_SCHEMA_VERSION,
    workspaceId: input.workspaceId,
    updatedAt: startedAt,
    iterations: [iteration],
    activeIterationId: iteration.id,
    iterationVersions: [version],
    checkpoints: [],
  };
}

export function selectLocalIteration(workspace: LocalIterationWorkspace, iterationId: string): LocalIterationWorkspace {
  if (!workspace.iterations.some((iteration) => iteration.id === iterationId)) return workspace;
  return { ...workspace, activeIterationId: iterationId, updatedAt: new Date().toISOString() };
}

export function startLocalSuccessorIteration(
  workspace: LocalIterationWorkspace,
  input: { activeActivityId: string; objective?: string; displayName: string },
): LocalIterationWorkspace {
  const previous = workspace.iterations.find((item) => item.id === workspace.activeIterationId);
  // Starting a successor closes the active record first. The closed record is
  // retained in iterationVersions, while the new iteration gets a new id.
  const prepared = previous && previous.status !== 'closed'
    ? closeLocalIteration(workspace, { displayName: input.displayName })
    : workspace;
  const closedPrevious = prepared.iterations.find((item) => item.id === previous?.id) ?? previous;
  const startedAt = new Date().toISOString();
  const actorName = cleanName(input.displayName) || 'Local participant';
  const iteration: LocalIterationContainer = {
    id: safeId('iteration'),
    number: prepared.iterations.reduce((max, item) => Math.max(max, item.number), 0) + 1,
    recordVersion: 1,
    objective: input.objective?.trim() ?? '',
    status: 'working',
    activeActivityId: input.activeActivityId,
    parentIterationId: closedPrevious?.id,
    startedAt,
    startedBy: actorName,
    participants: [{ id: safeId('participant'), displayName: actorName, joinedAt: startedAt }],
  };
  return {
    ...prepared,
    updatedAt: startedAt,
    iterations: [...prepared.iterations, iteration],
    activeIterationId: iteration.id,
    iterationVersions: [...prepared.iterationVersions, createIterationVersion(iteration, 'started', actorName, startedAt)],
  };
}

/**
 * Close the active iteration without erasing its working record. The latest
 * container is replaced by a new record version, while the previous state is
 * retained in iterationVersions and can be inspected later.
 */
export function closeLocalIteration(
  workspace: LocalIterationWorkspace,
  input: { displayName: string },
): LocalIterationWorkspace {
  const current = workspace.iterations.find((item) => item.id === workspace.activeIterationId);
  if (!current || current.status === 'closed') return workspace;
  const closedAt = new Date().toISOString();
  const closedBy = cleanName(input.displayName) || 'Local participant';
  const closed: LocalIterationContainer = {
    ...clone(current),
    recordVersion: current.recordVersion + 1,
    status: 'closed',
    closedAt,
    closedBy,
  };
  const version = createIterationVersion(closed, 'closed', closedBy, closedAt);
  return {
    ...workspace,
    updatedAt: closedAt,
    iterations: workspace.iterations.map((item) => item.id === current.id ? closed : item),
    iterationVersions: [...workspace.iterationVersions, version],
  };
}

/**
 * Reopen a closed iteration as a new successor. The predecessor remains
 * closed forever; participant work can be carried forward by the caller as a
 * separate activity-level operation.
 */
export function reopenLocalIteration(
  workspace: LocalIterationWorkspace,
  input: { iterationId?: string; activeActivityId?: string; objective?: string; displayName: string },
): LocalIterationWorkspace {
  const predecessor = workspace.iterations.find((item) => item.id === (input.iterationId ?? workspace.activeIterationId));
  if (!predecessor || predecessor.status !== 'closed') return workspace;
  const startedAt = new Date().toISOString();
  const actorName = cleanName(input.displayName) || 'Local participant';
  const successor: LocalIterationContainer = {
    id: safeId('iteration'),
    number: workspace.iterations.reduce((max, item) => Math.max(max, item.number), 0) + 1,
    recordVersion: 1,
    objective: input.objective?.trim() || predecessor.objective,
    status: 'working',
    activeActivityId: input.activeActivityId ?? predecessor.activeActivityId,
    parentIterationId: predecessor.id,
    reopenedFromIterationId: predecessor.id,
    startedAt,
    startedBy: actorName,
    participants: clone(predecessor.participants),
  };
  if (!successor.participants.some((participant) => participant.displayName === actorName)) {
    successor.participants.push({ id: safeId('participant'), displayName: actorName, joinedAt: startedAt });
  }
  return {
    ...workspace,
    updatedAt: startedAt,
    iterations: [...workspace.iterations, successor],
    activeIterationId: successor.id,
    iterationVersions: [...workspace.iterationVersions, createIterationVersion(successor, 'reopened', actorName, startedAt)],
  };
}

/** Save a named immutable metadata checkpoint for the active iteration. */
export function saveLocalIterationCheckpoint(
  workspace: LocalIterationWorkspace,
  input: { label: string; note?: string; displayName: string },
): LocalIterationWorkspace {
  const current = workspace.iterations.find((item) => item.id === workspace.activeIterationId);
  const label = input.label.trim();
  if (!current || current.status === 'closed' || !label) return workspace;
  const savedAt = new Date().toISOString();
  const savedBy = cleanName(input.displayName) || 'Local participant';
  const saved = { ...clone(current), recordVersion: current.recordVersion + 1 };
  const version = createIterationVersion(saved, 'checkpoint-saved', savedBy, savedAt);
  const checkpoint: LocalIterationCheckpoint = {
    id: safeId('iteration-checkpoint'),
    iterationId: current.id,
    label,
    note: input.note?.trim() || undefined,
    savedAt,
    savedBy,
    iterationVersionId: version.id,
    snapshot: clone(saved),
  };
  return {
    ...workspace,
    updatedAt: savedAt,
    iterations: workspace.iterations.map((item) => item.id === current.id ? saved : item),
    iterationVersions: [...workspace.iterationVersions, version],
    checkpoints: [...workspace.checkpoints, checkpoint],
  };
}

export function updateLocalParticipantName(
  workspace: LocalIterationWorkspace,
  displayName: string,
): LocalIterationWorkspace {
  const name = cleanName(displayName);
  if (!name) return workspace;
  const activeId = workspace.activeIterationId;
  const current = workspace.iterations.find((iteration) => iteration.id === activeId);
  if (!current || current.status === 'closed') return workspace;
  const updated: LocalIterationContainer = {
    ...current,
    recordVersion: current.recordVersion + 1,
    participants: current.participants.map((participant, index) => index === 0
      ? { ...participant, displayName: name }
      : participant),
    startedBy: current.startedBy === 'Local participant' ? name : current.startedBy,
  };
  const version = createIterationVersion(updated, 'participant-updated', name);
  return {
    ...workspace,
    updatedAt: new Date().toISOString(),
    iterations: workspace.iterations.map((iteration) => iteration.id === activeId ? updated : iteration),
    iterationVersions: [...workspace.iterationVersions, version],
  };
}

export function buildDemoJoinUrl(baseUrl: string, iterationId: string, displayName: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('demoIteration', iterationId);
  if (cleanName(displayName)) url.searchParams.set('demoParticipant', cleanName(displayName));
  return url.toString();
}

/** Naming parallel to the activity persistence API. */
export const appendLocalIterationCheckpoint = saveLocalIterationCheckpoint;

function createIterationVersion(
  snapshot: LocalIterationContainer,
  reason: LocalIterationVersionReason,
  savedBy: string,
  savedAt = new Date().toISOString(),
): LocalIterationVersion {
  return {
    id: safeId('iteration-version'),
    iterationId: snapshot.id,
    version: snapshot.recordVersion,
    reason,
    savedAt,
    savedBy,
    snapshot: clone(snapshot),
  };
}

function normalizeParticipant(value: unknown): LocalParticipantIdentity | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<LocalParticipantIdentity>;
  if (typeof candidate.id !== 'string' || typeof candidate.displayName !== 'string') return undefined;
  return {
    id: candidate.id,
    displayName: cleanName(candidate.displayName) || 'Local participant',
    joinedAt: typeof candidate.joinedAt === 'string' ? candidate.joinedAt : new Date().toISOString(),
  };
}

function normalizeIteration(value: unknown, index: number): LocalIterationContainer | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<LocalIterationContainer>;
  if (typeof candidate.id !== 'string' || typeof candidate.activeActivityId !== 'string') return undefined;
  const participants = Array.isArray(candidate.participants)
    ? candidate.participants.map(normalizeParticipant).filter((item): item is LocalParticipantIdentity => Boolean(item))
    : [];
  return {
    id: candidate.id,
    number: typeof candidate.number === 'number' && Number.isFinite(candidate.number) ? candidate.number : index + 1,
    recordVersion: typeof candidate.recordVersion === 'number' && Number.isFinite(candidate.recordVersion) ? candidate.recordVersion : 1,
    objective: typeof candidate.objective === 'string' ? candidate.objective : '',
    status: candidate.status === 'closed' ? 'closed' : 'working',
    activeActivityId: candidate.activeActivityId,
    ...(typeof candidate.parentIterationId === 'string' ? { parentIterationId: candidate.parentIterationId } : {}),
    ...(typeof candidate.reopenedFromIterationId === 'string' ? { reopenedFromIterationId: candidate.reopenedFromIterationId } : {}),
    startedAt: typeof candidate.startedAt === 'string' ? candidate.startedAt : new Date().toISOString(),
    startedBy: typeof candidate.startedBy === 'string' ? candidate.startedBy : 'Local participant',
    ...(typeof candidate.closedAt === 'string' ? { closedAt: candidate.closedAt } : {}),
    ...(typeof candidate.closedBy === 'string' ? { closedBy: candidate.closedBy } : {}),
    participants,
  };
}

function normalizeIterationVersion(value: unknown): LocalIterationVersion | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<LocalIterationVersion>;
  const snapshot = normalizeIteration(candidate.snapshot, 0);
  if (!snapshot || typeof candidate.id !== 'string' || typeof candidate.iterationId !== 'string') return undefined;
  const reasons: LocalIterationVersionReason[] = ['started', 'checkpoint-saved', 'closed', 'reopened', 'participant-updated'];
  return {
    id: candidate.id,
    iterationId: candidate.iterationId,
    version: typeof candidate.version === 'number' ? candidate.version : snapshot.recordVersion,
    reason: reasons.includes(candidate.reason as LocalIterationVersionReason) ? candidate.reason as LocalIterationVersionReason : 'started',
    savedAt: typeof candidate.savedAt === 'string' ? candidate.savedAt : snapshot.startedAt,
    savedBy: typeof candidate.savedBy === 'string' ? candidate.savedBy : snapshot.startedBy,
    snapshot,
  };
}

function normalizeCheckpoint(value: unknown): LocalIterationCheckpoint | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<LocalIterationCheckpoint>;
  const snapshot = normalizeIteration(candidate.snapshot, 0);
  if (!snapshot || typeof candidate.id !== 'string' || typeof candidate.iterationId !== 'string' || typeof candidate.label !== 'string' || typeof candidate.iterationVersionId !== 'string') return undefined;
  return {
    id: candidate.id,
    iterationId: candidate.iterationId,
    label: candidate.label,
    ...(typeof candidate.note === 'string' ? { note: candidate.note } : {}),
    savedAt: typeof candidate.savedAt === 'string' ? candidate.savedAt : snapshot.startedAt,
    savedBy: typeof candidate.savedBy === 'string' ? candidate.savedBy : snapshot.startedBy,
    iterationVersionId: candidate.iterationVersionId,
    snapshot,
  };
}
