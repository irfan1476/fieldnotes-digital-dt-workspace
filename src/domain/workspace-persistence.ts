/**
 * Durable, browser-safe state and semantic event primitives for an activity.
 *
 * The UI can keep using Excalidraw's native values. This module treats board
 * payloads as JSON so it does not couple the persistence format to a specific
 * Excalidraw release.
 */

export const WORKSPACE_SCHEMA_VERSION = 2 as const;
export const DEFAULT_WORKSPACE_STORAGE_KEY = 'dt-workspace:activity-state:v2';
export const LEGACY_BOARD_STORAGE_KEY = 'dt-workspace:empathy-map:v1';
export const LEGACY_HISTORY_STORAGE_KEY = 'dt-workspace:empathy-map:iterations:v1';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject { [key: string]: JsonValue | undefined }

export type TeamRole = 'facilitator' | 'participant' | 'observer';
export type IterationStatus =
  | 'started'
  | 'working'
  | 'checkpoint-saved'
  | 'team-review'
  | 'decision-recorded'
  | 'closed'
  | 'reopened';

export interface ActorReference {
  id: string;
  displayName: string;
  role: TeamRole;
}

export interface BoardState {
  elements: JsonValue[];
  appState: JsonObject;
  files: Record<string, JsonValue>;
}

export interface ActivityFields {
  [fieldId: string]: JsonValue | undefined;
}

export interface Contribution {
  id: string;
  activityId: string;
  iterationId: string;
  author: ActorReference;
  regionId?: string;
  boardElementIds: string[];
  content: string;
  tags: string[];
  status: 'draft' | 'submitted' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface BlueprintVersion {
  id: string;
  version: number;
  createdAt: string;
  createdBy: ActorReference;
  changeNote: string;
  templateId: string;
  definition: JsonObject;
}

export interface ActivityRevision {
  id: string;
  version: number;
  createdAt: string;
  createdBy: ActorReference;
  reason: 'autosave' | 'blueprint-change' | 'restore' | 'status-change';
  basedOnRevisionId?: string;
  blueprintVersionId: string;
  status: IterationStatus;
  fields: ActivityFields;
  contributions: Contribution[];
  board: BoardState;
}

export interface ActivityCheckpoint {
  id: string;
  label: string;
  note?: string;
  savedAt: string;
  savedBy: ActorReference;
  activityRevisionId: string;
  /** A full snapshot keeps a checkpoint restorable if later revisions change. */
  snapshot: ActivityRevision;
}

export type SemanticEventType =
  | 'element-created'
  | 'element-deleted'
  | 'content-edited'
  | 'style-changed'
  | 'element-moved'
  | 'elements-grouped'
  | 'elements-ungrouped'
  | 'elements-connected'
  | 'vote-cast'
  | 'vote-retracted'
  | 'output-carried-forward'
  | 'layout-migrated'
  | 'contribution-submitted'
  | 'contribution-updated'
  | 'blueprint-version-created'
  | 'activity-step-changed'
  | 'checkpoint-saved'
  | 'iteration-status-changed';

export interface SemanticEvent {
  id: string;
  type: SemanticEventType;
  occurredAt: string;
  actor: ActorReference;
  activityId: string;
  iterationId: string;
  blueprintVersionId: string;
  targetIds: string[];
  payload: JsonObject;
  /** Equal keys may be combined within the configured time window. */
  coalescingKey?: string;
  coalescedCount?: number;
  firstOccurredAt?: string;
}

export interface WorkspaceActivityState {
  activityId: string;
  iterationId: string;
  templateId: string;
  activeBlueprintVersionId: string;
  currentRevisionId: string;
  blueprints: BlueprintVersion[];
  revisions: ActivityRevision[];
  /** Checkpoints are append-only; storage never trims this list. */
  checkpoints: ActivityCheckpoint[];
  /** Events are append-only; callers may archive them explicitly elsewhere. */
  events: SemanticEvent[];
}

export interface WorkspaceDocument {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION;
  workspaceId: string;
  updatedAt: string;
  activities: Record<string, WorkspaceActivityState>;
}

export interface SaveResult {
  ok: boolean;
  durability: 'local-storage' | 'memory-only';
  error?: string;
}

export interface LoadResult {
  document: WorkspaceDocument;
  source: 'local-storage' | 'memory-fallback' | 'legacy-migration' | 'empty';
  warnings: string[];
}

export interface EventCoalescingPolicy {
  windowMs: number;
  minimumMoveDistance: number;
}

export const DEFAULT_EVENT_POLICY: EventCoalescingPolicy = {
  windowMs: 1_500,
  minimumMoveDistance: 8,
};

const memoryFallback = new Map<string, string>();

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueId(prefix: string): string {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `${prefix}-${cryptoApi.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeJsonParse(value: string | null): unknown {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function getBrowserStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function normalizeBoard(value: unknown): BoardState {
  const source = isRecord(value) ? value : {};
  return {
    elements: Array.isArray(source.elements) ? clone(source.elements) as JsonValue[] : [],
    appState: isRecord(source.appState) ? clone(source.appState) as JsonObject : {},
    files: isRecord(source.files) ? clone(source.files) as Record<string, JsonValue> : {},
  };
}

export function createEmptyWorkspace(workspaceId = 'local-workspace'): WorkspaceDocument {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspaceId,
    updatedAt: nowIso(),
    activities: {},
  };
}

export function createActivityState(input: {
  activityId: string;
  iterationId: string;
  templateId: string;
  actor: ActorReference;
  blueprintDefinition?: JsonObject;
  board?: Partial<BoardState>;
  fields?: ActivityFields;
}): WorkspaceActivityState {
  const timestamp = nowIso();
  const blueprintId = uniqueId('blueprint');
  const revisionId = uniqueId('revision');
  const blueprint: BlueprintVersion = {
    id: blueprintId,
    version: 1,
    createdAt: timestamp,
    createdBy: clone(input.actor),
    changeNote: 'Initial activity blueprint',
    templateId: input.templateId,
    definition: clone(input.blueprintDefinition ?? {}),
  };
  const revision: ActivityRevision = {
    id: revisionId,
    version: 1,
    createdAt: timestamp,
    createdBy: clone(input.actor),
    reason: 'autosave',
    blueprintVersionId: blueprintId,
    status: 'started',
    fields: clone(input.fields ?? {}),
    contributions: [],
    board: normalizeBoard(input.board),
  };
  return {
    activityId: input.activityId,
    iterationId: input.iterationId,
    templateId: input.templateId,
    activeBlueprintVersionId: blueprintId,
    currentRevisionId: revisionId,
    blueprints: [blueprint],
    revisions: [revision],
    checkpoints: [],
    events: [],
  };
}

export function getCurrentRevision(activity: WorkspaceActivityState): ActivityRevision {
  const revision = activity.revisions.find((item) => item.id === activity.currentRevisionId);
  if (!revision) throw new Error(`Current revision ${activity.currentRevisionId} is missing.`);
  return revision;
}

/** Adds a complete immutable revision. Earlier participant work remains intact. */
export function appendActivityRevision(
  activity: WorkspaceActivityState,
  input: Omit<ActivityRevision, 'id' | 'version' | 'createdAt'> & { createdAt?: string },
): WorkspaceActivityState {
  const revision: ActivityRevision = {
    ...clone(input),
    id: uniqueId('revision'),
    version: activity.revisions.reduce((max, item) => Math.max(max, item.version), 0) + 1,
    createdAt: input.createdAt ?? nowIso(),
  };
  return {
    ...activity,
    activeBlueprintVersionId: revision.blueprintVersionId,
    currentRevisionId: revision.id,
    revisions: [...activity.revisions, revision],
  };
}

/** Creates a full, append-only checkpoint. No automatic retention limit is used. */
export function appendCheckpoint(
  activity: WorkspaceActivityState,
  input: { label: string; note?: string; actor: ActorReference; savedAt?: string },
): WorkspaceActivityState {
  const current = getCurrentRevision(activity);
  const checkpoint: ActivityCheckpoint = {
    id: uniqueId('checkpoint'),
    label: input.label,
    note: input.note,
    savedAt: input.savedAt ?? nowIso(),
    savedBy: clone(input.actor),
    activityRevisionId: current.id,
    snapshot: clone(current),
  };
  return { ...activity, checkpoints: [...activity.checkpoints, checkpoint] };
}

/** Restoring never rewrites history; it appends a new revision based on the snapshot. */
export function restoreCheckpointAsRevision(
  activity: WorkspaceActivityState,
  checkpointId: string,
  actor: ActorReference,
): WorkspaceActivityState {
  const checkpoint = activity.checkpoints.find((item) => item.id === checkpointId);
  if (!checkpoint) throw new Error(`Checkpoint ${checkpointId} is missing.`);
  const snapshot = checkpoint.snapshot;
  return appendActivityRevision(activity, {
    createdBy: actor,
    reason: 'restore',
    basedOnRevisionId: snapshot.id,
    blueprintVersionId: snapshot.blueprintVersionId,
    status: 'reopened',
    fields: snapshot.fields,
    contributions: snapshot.contributions,
    board: snapshot.board,
  });
}

export function createSemanticEvent(
  input: Omit<SemanticEvent, 'id' | 'occurredAt'> & { occurredAt?: string },
): SemanticEvent {
  return {
    ...clone(input),
    id: uniqueId('event'),
    occurredAt: input.occurredAt ?? nowIso(),
  };
}

/** Returns undefined for movement below the meaningful-distance threshold. */
export function createMoveEvent(input: {
  actor: ActorReference;
  activityId: string;
  iterationId: string;
  blueprintVersionId: string;
  elementId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  occurredAt?: string;
  policy?: EventCoalescingPolicy;
}): SemanticEvent | undefined {
  const policy = input.policy ?? DEFAULT_EVENT_POLICY;
  const distance = Math.hypot(input.to.x - input.from.x, input.to.y - input.from.y);
  if (distance < policy.minimumMoveDistance) return undefined;
  return createSemanticEvent({
    type: 'element-moved',
    occurredAt: input.occurredAt,
    actor: input.actor,
    activityId: input.activityId,
    iterationId: input.iterationId,
    blueprintVersionId: input.blueprintVersionId,
    targetIds: [input.elementId],
    coalescingKey: `move:${input.actor.id}:${input.elementId}`,
    payload: { from: input.from, to: input.to, distance },
  });
}

function canCoalesce(previous: SemanticEvent, next: SemanticEvent, policy: EventCoalescingPolicy): boolean {
  if (!previous.coalescingKey || previous.coalescingKey !== next.coalescingKey) return false;
  if (previous.type !== next.type || previous.actor.id !== next.actor.id) return false;
  const elapsed = Date.parse(next.occurredAt) - Date.parse(previous.occurredAt);
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= policy.windowMs;
}

/**
 * Coalesces pointer/typing bursts into one meaningful event. For moves, the
 * original starting point and final release position are retained.
 */
export function appendSemanticEvent(
  events: readonly SemanticEvent[],
  next: SemanticEvent | undefined,
  policy: EventCoalescingPolicy = DEFAULT_EVENT_POLICY,
): SemanticEvent[] {
  if (!next) return [...events];
  const previous = events.length > 0 ? events[events.length - 1] : undefined;
  if (!previous || !canCoalesce(previous, next, policy)) return [...events, clone(next)];

  const payload = clone(next.payload);
  if (previous.type === 'element-moved') {
    payload.from = previous.payload.from;
    const from = isRecord(payload.from) ? payload.from : {};
    const to = isRecord(payload.to) ? payload.to : {};
    if (typeof from.x === 'number' && typeof from.y === 'number' && typeof to.x === 'number' && typeof to.y === 'number') {
      payload.distance = Math.hypot(to.x - from.x, to.y - from.y);
    }
  }
  const merged: SemanticEvent = {
    ...clone(next),
    id: previous.id,
    firstOccurredAt: previous.firstOccurredAt ?? previous.occurredAt,
    coalescedCount: (previous.coalescedCount ?? 1) + 1,
    payload,
  };
  return [...events.slice(0, -1), merged];
}

export function addEventToActivity(
  activity: WorkspaceActivityState,
  event: SemanticEvent | undefined,
  policy: EventCoalescingPolicy = DEFAULT_EVENT_POLICY,
): WorkspaceActivityState {
  return { ...activity, events: appendSemanticEvent(activity.events, event, policy) };
}

function isWorkspaceDocument(value: unknown): value is WorkspaceDocument {
  return isRecord(value)
    && value.schemaVersion === WORKSPACE_SCHEMA_VERSION
    && typeof value.workspaceId === 'string'
    && typeof value.updatedAt === 'string'
    && isRecord(value.activities);
}

function legacyActor(): ActorReference {
  return { id: 'legacy-local-user', displayName: 'Local participant', role: 'participant' };
}

function migrateLegacy(storage: Storage | undefined): WorkspaceDocument | undefined {
  const boardRaw = storage?.getItem(LEGACY_BOARD_STORAGE_KEY) ?? memoryFallback.get(LEGACY_BOARD_STORAGE_KEY) ?? null;
  const historyRaw = storage?.getItem(LEGACY_HISTORY_STORAGE_KEY) ?? memoryFallback.get(LEGACY_HISTORY_STORAGE_KEY) ?? null;
  const boardValue = safeJsonParse(boardRaw);
  const historyValue = safeJsonParse(historyRaw);
  if (!isRecord(boardValue) && !Array.isArray(historyValue)) return undefined;

  const actor = legacyActor();
  let activity = createActivityState({
    activityId: 'empathy-map',
    iterationId: 'legacy-iteration',
    templateId: 'empathy-map',
    actor,
    board: isRecord(boardValue) ? normalizeBoard(boardValue) : undefined,
    fields: isRecord(boardValue) && isRecord(boardValue.fields) ? boardValue.fields as ActivityFields : {},
  });

  if (Array.isArray(historyValue)) {
    for (const [index, item] of historyValue.entries()) {
      if (!isRecord(item)) continue;
      const snapshot: ActivityRevision = {
        ...getCurrentRevision(activity),
        id: uniqueId('legacy-revision'),
        version: index + 1,
        createdAt: typeof item.savedAt === 'string' ? item.savedAt : nowIso(),
        fields: isRecord(item.fields) ? item.fields as ActivityFields : {},
        board: normalizeBoard(item),
      };
      const checkpoint: ActivityCheckpoint = {
        id: typeof item.id === 'string' ? item.id : uniqueId('legacy-checkpoint'),
        label: typeof item.label === 'string' ? item.label : `Imported iteration ${index + 1}`,
        savedAt: snapshot.createdAt,
        savedBy: actor,
        activityRevisionId: snapshot.id,
        snapshot,
      };
      activity = {
        ...activity,
        revisions: [...activity.revisions, snapshot],
        checkpoints: [...activity.checkpoints, checkpoint],
      };
    }
  }

  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspaceId: 'migrated-local-workspace',
    updatedAt: nowIso(),
    activities: { [activity.activityId]: activity },
  };
}

export function saveWorkspace(
  document: WorkspaceDocument,
  storageKey = DEFAULT_WORKSPACE_STORAGE_KEY,
): SaveResult {
  const normalized = { ...clone(document), schemaVersion: WORKSPACE_SCHEMA_VERSION, updatedAt: nowIso() };
  let serialized: string;
  try {
    serialized = JSON.stringify(normalized);
  } catch (error) {
    return { ok: false, durability: 'memory-only', error: error instanceof Error ? error.message : 'State is not serializable.' };
  }

  // Always maintain a same-session fallback, including when localStorage is full.
  memoryFallback.set(storageKey, serialized);
  const storage = getBrowserStorage();
  if (!storage) return { ok: true, durability: 'memory-only', error: 'localStorage is unavailable.' };
  try {
    storage.setItem(storageKey, serialized);
    return { ok: true, durability: 'local-storage' };
  } catch (error) {
    return {
      ok: true,
      durability: 'memory-only',
      error: error instanceof Error ? error.message : 'localStorage write failed.',
    };
  }
}

export function loadWorkspace(
  storageKey = DEFAULT_WORKSPACE_STORAGE_KEY,
  workspaceId = 'local-workspace',
  allowLegacyMigration = true,
): LoadResult {
  const warnings: string[] = [];
  const storage = getBrowserStorage();
  let stored: string | null = null;
  if (storage) {
    try {
      stored = storage.getItem(storageKey);
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'localStorage read failed.');
    }
  }
  const parsed = safeJsonParse(stored);
  if (isWorkspaceDocument(parsed)) return { document: clone(parsed), source: 'local-storage', warnings };
  if (stored) warnings.push('Stored workspace data was invalid and was not loaded.');

  const memory = safeJsonParse(memoryFallback.get(storageKey) ?? null);
  if (isWorkspaceDocument(memory)) return { document: clone(memory), source: 'memory-fallback', warnings };

  if (allowLegacyMigration) {
    try {
      const migrated = migrateLegacy(storage);
      if (migrated) {
        const result = saveWorkspace(migrated, storageKey);
        if (result.error) warnings.push(result.error);
        return { document: migrated, source: 'legacy-migration', warnings };
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Legacy migration failed.');
    }
  }
  return { document: createEmptyWorkspace(workspaceId), source: 'empty', warnings };
}

/** Explicit reset for tests/sign-out flows. It never runs as part of migration. */
export function clearWorkspaceStorage(storageKey = DEFAULT_WORKSPACE_STORAGE_KEY): SaveResult {
  memoryFallback.delete(storageKey);
  const storage = getBrowserStorage();
  if (!storage) return { ok: true, durability: 'memory-only' };
  try {
    storage.removeItem(storageKey);
    return { ok: true, durability: 'local-storage' };
  } catch (error) {
    return { ok: false, durability: 'memory-only', error: error instanceof Error ? error.message : 'localStorage removal failed.' };
  }
}
