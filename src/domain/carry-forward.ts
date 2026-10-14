import type { ActorReference, ActivityRevision, Contribution } from './workspace-persistence';

/**
 * A carry-forward is a copy into a later activity. The original record stays
 * where it was; this provenance record makes the relationship explicit so a
 * later team can tell which iteration and blueprint produced the copied work.
 */
export type CarryForwardOutputKind = 'contribution' | 'field' | 'board-selection';

export interface CarryForwardSource {
  readonly kind: CarryForwardOutputKind;
  readonly id: string;
  readonly activityId: string;
  readonly iterationId: string;
  readonly revisionId: string;
  readonly revisionVersion: number;
  readonly blueprintVersionId: string;
  readonly author?: ActorReference;
}

export interface CarryForwardTarget {
  readonly activityId: string;
  readonly iterationId: string;
  readonly revisionId: string;
  readonly revisionVersion: number;
  readonly blueprintVersionId: string;
}

export interface CarryForwardProvenance {
  readonly source: CarryForwardSource;
  readonly target: CarryForwardTarget;
  readonly copiedAt: string;
  readonly copiedBy: ActorReference;
}

/** A generic selected output for fields and board selections. */
export interface CarriedForwardOutput<T = unknown> extends CarryForwardProvenance {
  readonly id: string;
  readonly kind: CarryForwardOutputKind;
  readonly value: T;
}

export interface CarriedForwardContribution extends CarriedForwardOutput<Contribution> {
  readonly kind: 'contribution';
  readonly contribution: Contribution;
}

export interface CarryForwardRevisionRef {
  readonly id: string;
  readonly version: number;
  readonly blueprintVersionId: string;
}

export interface CopyContributionInput {
  readonly contribution: Contribution;
  readonly sourceRevision: CarryForwardRevisionRef | Pick<ActivityRevision, 'id' | 'version' | 'blueprintVersionId'>;
  readonly target: CarryForwardTarget;
  readonly copiedBy: ActorReference;
  readonly copiedAt: string;
  /** The target contribution ID is supplied by the persistence layer. */
  readonly newContributionId: string;
  /** A copied record may be placed in a target region without changing its source region. */
  readonly targetRegionId?: string;
}

export interface CopyOutputInput<T> {
  readonly kind: Exclude<CarryForwardOutputKind, 'contribution'>;
  readonly source: CarryForwardSource;
  readonly target: CarryForwardTarget;
  readonly value: T;
  readonly copiedBy: ActorReference;
  readonly copiedAt: string;
  readonly id: string;
}

function required(value: string, label: string): string {
  if (!value.trim()) throw new Error(`Carry-forward ${label} is required.`);
  return value;
}

function positiveVersion(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Carry-forward ${label} must be a positive integer.`);
  }
  return value;
}

function clone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function validateTarget(target: CarryForwardTarget): CarryForwardTarget {
  return {
    activityId: required(target.activityId, 'target activity ID'),
    iterationId: required(target.iterationId, 'target iteration ID'),
    revisionId: required(target.revisionId, 'target revision ID'),
    revisionVersion: positiveVersion(target.revisionVersion, 'target revision version'),
    blueprintVersionId: required(target.blueprintVersionId, 'target blueprint version ID'),
  };
}

function validateSource(source: CarryForwardSource): CarryForwardSource {
  return {
    ...source,
    id: required(source.id, 'source ID'),
    activityId: required(source.activityId, 'source activity ID'),
    iterationId: required(source.iterationId, 'source iteration ID'),
    revisionId: required(source.revisionId, 'source revision ID'),
    revisionVersion: positiveVersion(source.revisionVersion, 'source revision version'),
    blueprintVersionId: required(source.blueprintVersionId, 'source blueprint version ID'),
  };
}

/**
 * Build a provenance-preserving generic output. This is useful for a selected
 * field value or a group of board element IDs where a Contribution is too
 * narrow. The value is cloned so the source object cannot be mutated through
 * the target record.
 */
export function createCarryForwardOutput<T>(input: CopyOutputInput<T>): CarriedForwardOutput<T> {
  const id = required(input.id, 'output ID');
  const source = validateSource(input.source);
  const target = validateTarget(input.target);
  required(input.copiedAt, 'copy timestamp');
  if (!input.copiedBy.id.trim()) throw new Error('Carry-forward copier ID is required.');

  return {
    id,
    kind: input.kind,
    value: clone(input.value),
    source,
    target,
    copiedAt: input.copiedAt,
    copiedBy: clone(input.copiedBy),
  };
}

/**
 * Copy a contribution into a target activity while preserving the source
 * activity, iteration, revision, blueprint version and author in provenance.
 * The returned Contribution is a new record; the source remains untouched.
 */
export function copyContributionToTarget(input: CopyContributionInput): CarriedForwardContribution {
  const sourceContribution = clone(input.contribution);
  const sourceRevision = input.sourceRevision;
  const source: CarryForwardSource = {
    kind: 'contribution',
    id: required(sourceContribution.id, 'source contribution ID'),
    activityId: required(sourceContribution.activityId, 'source activity ID'),
    iterationId: required(sourceContribution.iterationId, 'source iteration ID'),
    revisionId: required(sourceRevision.id, 'source revision ID'),
    revisionVersion: positiveVersion(sourceRevision.version, 'source revision version'),
    blueprintVersionId: required(sourceRevision.blueprintVersionId, 'source blueprint version ID'),
    author: clone(sourceContribution.author),
  };
  const target = validateTarget(input.target);
  const newId = required(input.newContributionId, 'new contribution ID');
  required(input.copiedAt, 'copy timestamp');
  if (!input.copiedBy.id.trim()) throw new Error('Carry-forward copier ID is required.');

  const contribution: Contribution = {
    ...sourceContribution,
    id: newId,
    activityId: target.activityId,
    iterationId: target.iterationId,
    regionId: input.targetRegionId ?? sourceContribution.regionId,
    boardElementIds: [...sourceContribution.boardElementIds],
    tags: [...sourceContribution.tags],
    author: clone(sourceContribution.author),
    createdAt: input.copiedAt,
    updatedAt: input.copiedAt,
    status: 'submitted',
  };

  return {
    id: newId,
    kind: 'contribution',
    value: clone(contribution),
    contribution,
    source,
    target,
    copiedAt: input.copiedAt,
    copiedBy: clone(input.copiedBy),
  };
}

/**
 * Copy a selected set of contributions in one deterministic operation. The
 * caller supplies IDs so local storage and a future server can use the same
 * idempotency strategy rather than silently duplicating outputs on retry.
 */
export function copySelectedContributions(input: {
  readonly selections: readonly CopyContributionInput[];
}): readonly CarriedForwardContribution[] {
  const seen = new Set<string>();
  return input.selections.map((selection) => {
    if (seen.has(selection.newContributionId)) {
      throw new Error(`Duplicate carried-forward contribution ID: ${selection.newContributionId}`);
    }
    seen.add(selection.newContributionId);
    return copyContributionToTarget(selection);
  });
}

