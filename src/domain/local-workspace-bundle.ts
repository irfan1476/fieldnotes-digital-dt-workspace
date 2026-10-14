/**
 * Portable, browser-local transfer records for the FieldNotes prototype.
 *
 * A bundle is an explicit file export/import boundary. It helps a team move a
 * local board, iteration history, and room context between browsers, but it
 * does not provide authentication, realtime transport, conflict resolution,
 * or shared access to a workspace.
 */

import {
  DEFAULT_WORKSPACE_STORAGE_KEY,
  saveWorkspace,
  type WorkspaceDocument,
} from './workspace-persistence';
import {
  saveLocalIterationWorkspace,
  type LocalIterationWorkspace,
} from './local-iteration-shell';
import {
  saveLocalRoomSession,
  type LocalRoomSession,
} from './local-room-session';

export const LOCAL_WORKSPACE_BUNDLE_SCHEMA_VERSION = 1 as const;
export const LOCAL_WORKSPACE_BUNDLE_KIND = 'fieldnotes-local-workspace-bundle' as const;

export interface LocalWorkspaceBundle {
  kind: typeof LOCAL_WORKSPACE_BUNDLE_KIND;
  schemaVersion: typeof LOCAL_WORKSPACE_BUNDLE_SCHEMA_VERSION;
  appName: 'FieldNotes - Digital DT Workspace';
  exportedAt: string;
  workspaceId: string;
  /** The source key is retained as metadata; import may override it. */
  workspaceStorageKey?: string;
  activityId?: string;
  iterationId?: string;
  workspaceDocument?: WorkspaceDocument;
  iterationWorkspace?: LocalIterationWorkspace;
  roomSessions: LocalRoomSession[];
}

export interface CreateLocalWorkspaceBundleInput {
  workspaceId: string;
  workspaceStorageKey?: string;
  activityId?: string;
  iterationId?: string;
  workspaceDocument?: WorkspaceDocument;
  iterationWorkspace?: LocalIterationWorkspace;
  roomSession?: LocalRoomSession;
  roomSessions?: LocalRoomSession[];
}

export type ParsedLocalWorkspaceBundle =
  | { ok: true; bundle: LocalWorkspaceBundle }
  | { ok: false; error: string };

export interface ImportLocalWorkspaceBundleOptions {
  /** Import into this browser's active workspace key. */
  workspaceStorageKey?: string;
  /** Import into this browser's active workspace id. */
  workspaceId?: string;
}

export interface ImportLocalWorkspaceBundleResult {
  ok: boolean;
  imported: string[];
  warnings: string[];
}

function clone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWorkspaceDocument(value: unknown): value is WorkspaceDocument {
  return isRecord(value)
    && value.schemaVersion === 2
    && typeof value.workspaceId === 'string'
    && typeof value.updatedAt === 'string'
    && isRecord(value.activities);
}

function isIterationWorkspace(value: unknown): value is LocalIterationWorkspace {
  return isRecord(value)
    && (value.schemaVersion === 1 || value.schemaVersion === 2)
    && typeof value.workspaceId === 'string'
    && typeof value.updatedAt === 'string'
    && typeof value.activeIterationId === 'string'
    && Array.isArray(value.iterations)
    && value.iterations.length > 0;
}

function isRoomSession(value: unknown): value is LocalRoomSession {
  return isRecord(value)
    && value.schemaVersion === 1
    && typeof value.roomId === 'string'
    && typeof value.workspaceId === 'string'
    && typeof value.activityId === 'string'
    && typeof value.iterationId === 'string'
    && typeof value.name === 'string'
    && Array.isArray(value.participants);
}

function normalizeBundle(value: unknown): LocalWorkspaceBundle | undefined {
  if (!isRecord(value)
    || value.kind !== LOCAL_WORKSPACE_BUNDLE_KIND
    || value.schemaVersion !== LOCAL_WORKSPACE_BUNDLE_SCHEMA_VERSION
    || value.appName !== 'FieldNotes - Digital DT Workspace'
    || typeof value.exportedAt !== 'string'
    || typeof value.workspaceId !== 'string'
    || !Array.isArray(value.roomSessions)
    || !value.roomSessions.every(isRoomSession)) return undefined;

  const workspaceDocument = value.workspaceDocument;
  const iterationWorkspace = value.iterationWorkspace;
  if (workspaceDocument !== undefined && !isWorkspaceDocument(workspaceDocument)) return undefined;
  if (iterationWorkspace !== undefined && !isIterationWorkspace(iterationWorkspace)) return undefined;
  if (typeof value.workspaceStorageKey !== 'undefined' && typeof value.workspaceStorageKey !== 'string') return undefined;
  if (typeof value.activityId !== 'undefined' && typeof value.activityId !== 'string') return undefined;
  if (typeof value.iterationId !== 'undefined' && typeof value.iterationId !== 'string') return undefined;

  return clone(value as unknown as LocalWorkspaceBundle);
}

export function createLocalWorkspaceBundle(input: CreateLocalWorkspaceBundleInput): LocalWorkspaceBundle {
  const roomSessions = [...(input.roomSessions ?? []), ...(input.roomSession ? [input.roomSession] : [])]
    .filter((session, index, sessions) => sessions.findIndex((candidate) => candidate.roomId === session.roomId) === index)
    .map(clone);
  return {
    kind: LOCAL_WORKSPACE_BUNDLE_KIND,
    schemaVersion: LOCAL_WORKSPACE_BUNDLE_SCHEMA_VERSION,
    appName: 'FieldNotes - Digital DT Workspace',
    exportedAt: new Date().toISOString(),
    workspaceId: input.workspaceId,
    workspaceStorageKey: input.workspaceStorageKey,
    activityId: input.activityId,
    iterationId: input.iterationId,
    workspaceDocument: input.workspaceDocument ? clone(input.workspaceDocument) : undefined,
    iterationWorkspace: input.iterationWorkspace ? clone(input.iterationWorkspace) : undefined,
    roomSessions,
  };
}

export function serializeLocalWorkspaceBundle(bundle: LocalWorkspaceBundle): string {
  const normalized = normalizeBundle(bundle);
  if (!normalized) throw new Error('Cannot serialize an invalid FieldNotes workspace bundle.');
  return JSON.stringify(normalized, null, 2);
}

export function parseLocalWorkspaceBundle(raw: string): ParsedLocalWorkspaceBundle {
  try {
    const parsed: unknown = JSON.parse(raw);
    const bundle = normalizeBundle(parsed);
    return bundle
      ? { ok: true, bundle }
      : { ok: false, error: 'This file is not a supported FieldNotes workspace bundle.' };
  } catch {
    return { ok: false, error: 'The selected file is not valid JSON.' };
  }
}

export function downloadLocalWorkspaceBundle(bundle: LocalWorkspaceBundle, filename = 'fieldnotes-workspace.json'): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const blob = new Blob([serializeLocalWorkspaceBundle(bundle)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

export function importLocalWorkspaceBundle(
  bundle: LocalWorkspaceBundle,
  options: ImportLocalWorkspaceBundleOptions = {},
): ImportLocalWorkspaceBundleResult {
  const normalized = normalizeBundle(bundle);
  if (!normalized) return { ok: false, imported: [], warnings: ['The bundle could not be validated.'] };
  const workspaceId = options.workspaceId ?? normalized.workspaceId;
  const imported: string[] = [];
  const warnings: string[] = [];

  if (normalized.workspaceDocument) {
    const document = clone(normalized.workspaceDocument);
    document.workspaceId = workspaceId;
    const result = saveWorkspace(
      document,
      options.workspaceStorageKey ?? normalized.workspaceStorageKey ?? DEFAULT_WORKSPACE_STORAGE_KEY,
    );
    if (!result.ok) return { ok: false, imported, warnings: [result.error ?? 'Workspace board could not be saved.'] };
    imported.push('board and activity history');
    if (result.error) warnings.push(result.error);
  }

  if (normalized.iterationWorkspace) {
    const iterationWorkspace = clone(normalized.iterationWorkspace);
    iterationWorkspace.workspaceId = workspaceId;
    const result = saveLocalIterationWorkspace(iterationWorkspace);
    if (!result.ok) return { ok: false, imported, warnings: [result.message] };
    imported.push('iteration history');
  }

  for (const session of normalized.roomSessions) {
    const result = saveLocalRoomSession({ ...clone(session), workspaceId });
    if (!result.ok) warnings.push(`Room ${session.roomId} was not imported: ${result.message}`);
    else imported.push(`room ${session.name}`);
  }

  return { ok: true, imported, warnings };
}
