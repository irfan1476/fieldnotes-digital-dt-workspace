import type { ActorReference, JsonObject, JsonValue, SemanticEvent } from './workspace-persistence';
import { createMoveEvent, createSemanticEvent } from './workspace-persistence';

/** The small subset of an Excalidraw element needed for semantic auditing. */
export interface BoardElementLike {
  readonly id: string;
  readonly type?: string;
  readonly x?: number;
  readonly y?: number;
  readonly text?: string;
  readonly originalText?: string;
  readonly isDeleted?: boolean;
  readonly groupIds?: readonly string[] | null;
  readonly boundElements?: readonly unknown[] | null;
  readonly startBinding?: unknown;
  readonly endBinding?: unknown;
  readonly [key: string]: unknown;
}

export interface BoardEventContext {
  readonly actor: ActorReference;
  readonly activityId: string;
  readonly iterationId: string;
  readonly blueprintVersionId: string;
  readonly occurredAt?: string;
}

const STYLE_KEYS = [
  'strokeColor', 'backgroundColor', 'fillStyle', 'strokeWidth', 'strokeStyle',
  'roughness', 'opacity', 'fontSize', 'fontFamily', 'textAlign', 'verticalAlign',
  'roundness', 'startArrowhead', 'endArrowhead', 'locked', 'link',
] as const;

function sortedIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice().sort()
    : [];
}

function stableValue(element: BoardElementLike, keys: readonly string[]): JsonObject {
  return Object.fromEntries(keys.map((key) => [key, element[key] as never])) as JsonObject;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function jsonValue(value: unknown): JsonValue {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function event(context: BoardEventContext, type: SemanticEvent['type'], elementId: string, payload: JsonObject): SemanticEvent {
  return createSemanticEvent({
    type,
    occurredAt: context.occurredAt ?? new Date().toISOString(),
    actor: context.actor,
    activityId: context.activityId,
    iterationId: context.iterationId,
    blueprintVersionId: context.blueprintVersionId,
    targetIds: [elementId],
    payload,
  });
}

/**
 * Derives user-meaningful events from two Excalidraw scene snapshots.
 *
 * Excalidraw emits many intermediate changes while a pointer is down. The
 * caller persists these events through appendSemanticEvent, which coalesces
 * consecutive movement/content bursts. Tiny moves are discarded here.
 */
export function deriveBoardEvents(
  previousElements: readonly BoardElementLike[],
  nextElements: readonly BoardElementLike[],
  context: BoardEventContext,
): SemanticEvent[] {
  const previous = new Map(previousElements.map((element) => [element.id, element]));
  const next = new Map(nextElements.map((element) => [element.id, element]));
  const events: SemanticEvent[] = [];

  for (const element of nextElements) {
    const before = previous.get(element.id);
    if (!before) {
      if (!element.isDeleted) events.push(event(context, 'element-created', element.id, { elementType: element.type ?? 'unknown' }));
      continue;
    }

    if (!before.isDeleted && element.isDeleted) {
      events.push(event(context, 'element-deleted', element.id, { elementType: element.type ?? before.type ?? 'unknown' }));
      continue;
    }
    if (before.isDeleted && !element.isDeleted) {
      events.push(event(context, 'element-created', element.id, { elementType: element.type ?? 'unknown', restored: true }));
      continue;
    }
    if (element.isDeleted) continue;

    if (typeof before.x === 'number' && typeof before.y === 'number' && typeof element.x === 'number' && typeof element.y === 'number') {
      const move = createMoveEvent({
        actor: context.actor,
        activityId: context.activityId,
        iterationId: context.iterationId,
        blueprintVersionId: context.blueprintVersionId,
        elementId: element.id,
        from: { x: before.x, y: before.y },
        to: { x: element.x, y: element.y },
        occurredAt: context.occurredAt,
      });
      if (move) events.push(move);
    }

    const previousContent = { text: before.text, originalText: before.originalText };
    const nextContent = { text: element.text, originalText: element.originalText };
    if (!sameValue(previousContent, nextContent)) {
      events.push(event(context, 'content-edited', element.id, { elementType: element.type ?? 'unknown', before: previousContent, after: nextContent }));
    }

    const previousStyle = stableValue(before, STYLE_KEYS);
    const nextStyle = stableValue(element, STYLE_KEYS);
    if (!sameValue(previousStyle, nextStyle)) {
      events.push(event(context, 'style-changed', element.id, { elementType: element.type ?? 'unknown', before: previousStyle, after: nextStyle }));
    }

    const previousGroups = sortedIds(before.groupIds);
    const nextGroups = sortedIds(element.groupIds);
    if (!sameValue(previousGroups, nextGroups)) {
      events.push(event(context, nextGroups.length > previousGroups.length ? 'elements-grouped' : 'elements-ungrouped', element.id, { before: previousGroups, after: nextGroups }));
    }

    const previousBindings = { boundElements: jsonValue(before.boundElements ?? null), startBinding: jsonValue(before.startBinding ?? null), endBinding: jsonValue(before.endBinding ?? null) };
    const nextBindings = { boundElements: jsonValue(element.boundElements ?? null), startBinding: jsonValue(element.startBinding ?? null), endBinding: jsonValue(element.endBinding ?? null) };
    if (!sameValue(previousBindings, nextBindings)) {
      events.push(event(context, 'elements-connected', element.id, { before: previousBindings, after: nextBindings }));
    }
  }

  return events;
}
