import type { ActivityTemplate, BoardRegion } from './activity-model';

/**
 * Collaboration, iteration, and activity-blueprint contracts.
 *
 * These types keep the drawing scene separate from the rules that govern a
 * facilitated method. Excalidraw may render a blueprint, but permissions and
 * version history belong to the application domain.
 */

export const TEAM_ROLES = ['facilitator', 'participant', 'observer', 'guest'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_CAPACITY_POLICY = {
  participantMinimum: 3,
  participantDefaultMaximum: 8,
  participantExtendedMaximum: 12,
  facilitatorSeats: 1,
  facilitatorCountsAsParticipant: false,
} as const;

export type TeamPermission =
  | 'activity:view'
  | 'activity:contribute'
  | 'activity:vote'
  | 'blueprint:view'
  | 'blueprint:edit'
  | 'blueprint:publish-version'
  | 'blueprint:save-template'
  | 'facilitation:control'
  | 'iteration:create-checkpoint'
  | 'iteration:review'
  | 'iteration:close';

export const ROLE_PERMISSIONS: Readonly<Record<TeamRole, readonly TeamPermission[]>> = {
  facilitator: [
    'activity:view',
    'activity:contribute',
    'activity:vote',
    'blueprint:view',
    'blueprint:edit',
    'blueprint:publish-version',
    'blueprint:save-template',
    'facilitation:control',
    'iteration:create-checkpoint',
    'iteration:review',
    'iteration:close',
  ],
  participant: [
    'activity:view',
    'activity:contribute',
    'activity:vote',
    'blueprint:view',
  ],
  observer: ['activity:view', 'blueprint:view'],
  guest: ['activity:view', 'blueprint:view'],
} as const;

export const canRole = (role: TeamRole, permission: TeamPermission): boolean =>
  ROLE_PERMISSIONS[role].includes(permission);

export interface TeamCapacitySelection {
  /** Participant seats only. The facilitator always occupies an additional seat. */
  readonly participantSeats: number;
  readonly extendedCapacityEnabled: boolean;
}

export interface TeamCapacityValidation {
  readonly valid: boolean;
  readonly totalActiveSeats: number;
  readonly reason?: string;
}

export function validateTeamCapacity(selection: TeamCapacitySelection): TeamCapacityValidation {
  const maximum = selection.extendedCapacityEnabled
    ? TEAM_CAPACITY_POLICY.participantExtendedMaximum
    : TEAM_CAPACITY_POLICY.participantDefaultMaximum;
  const valid =
    Number.isInteger(selection.participantSeats) &&
    selection.participantSeats >= TEAM_CAPACITY_POLICY.participantMinimum &&
    selection.participantSeats <= maximum;

  return {
    valid,
    totalActiveSeats: selection.participantSeats + TEAM_CAPACITY_POLICY.facilitatorSeats,
    reason: valid
      ? undefined
      : `Participant seats must be between ${TEAM_CAPACITY_POLICY.participantMinimum} and ${maximum}.`,
  };
}

export const DESIGN_ITERATION_STATUSES = [
  'started',
  'working',
  'checkpoint-saved',
  'team-review',
  'decision-recorded',
  'closed',
  'reopened',
] as const;
export type DesignIterationStatus = (typeof DESIGN_ITERATION_STATUSES)[number];

export const DESIGN_ITERATION_TRANSITIONS: Readonly<
  Record<DesignIterationStatus, readonly DesignIterationStatus[]>
> = {
  started: ['working'],
  working: ['checkpoint-saved', 'team-review'],
  'checkpoint-saved': ['working', 'team-review'],
  'team-review': ['working', 'decision-recorded'],
  'decision-recorded': ['working', 'closed'],
  closed: ['reopened'],
  reopened: ['working', 'checkpoint-saved'],
} as const;

export const canTransitionDesignIteration = (
  from: DesignIterationStatus,
  to: DesignIterationStatus,
): boolean => DESIGN_ITERATION_TRANSITIONS[from].includes(to);

export interface DesignIteration {
  readonly id: string;
  readonly projectId: string;
  readonly number: number;
  readonly objective: string;
  readonly status: DesignIterationStatus;
  readonly activeActivityId?: string;
  readonly parentIterationId?: string;
  readonly startedAt: string;
  readonly startedBy: string;
  readonly closedAt?: string;
  readonly closedBy?: string;
  readonly reopenedAt?: string;
}

export type BlueprintChangeWindow = 'before-activity' | 'during-activity' | 'after-activity';
export type BlueprintVersionStatus = 'draft' | 'published' | 'superseded';

export interface BlueprintRegion extends BoardRegion {
  /** Elements bound to this region may move without allowing its frame to change. */
  readonly frameLockedForParticipants: true;
  readonly participantContributionAllowed: boolean;
  readonly contributionPrompt?: string;
}

export type FacilitatorControlKind =
  | 'timer'
  | 'round'
  | 'prompt-reveal'
  | 'region-lock'
  | 'contribution-visibility'
  | 'assignment'
  | 'voting'
  | 'review'
  | 'completion';

export interface FacilitatorControlOption {
  readonly id: string;
  readonly label: string;
  readonly value: string | number | boolean;
}

export interface FacilitatorControl {
  readonly id: string;
  readonly kind: FacilitatorControlKind;
  readonly label: string;
  readonly description: string;
  readonly enabledByDefault: boolean;
  readonly options?: readonly FacilitatorControlOption[];
  /** Restricts the control to method states where it has a clear purpose. */
  readonly availableInStates: readonly ('setup' | 'active' | 'review')[];
}

export interface ActivityBlueprintDefinition {
  readonly methodId: ActivityTemplate['id'];
  readonly name: string;
  readonly instructions: string;
  readonly regions: readonly BlueprintRegion[];
  readonly facilitatorControls: readonly FacilitatorControl[];
  readonly participantCanModifyFramework: false;
  readonly observerCanContribute: false;
}

export interface ActivityBlueprintVersion {
  readonly id: string;
  readonly activityId: string;
  readonly version: number;
  readonly status: BlueprintVersionStatus;
  readonly definition: ActivityBlueprintDefinition;
  readonly parentVersionId?: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly publishedAt?: string;
  readonly publishedBy?: string;
  readonly changeWindow: BlueprintChangeWindow;
  readonly changeSummary: string;
  /** True when the facilitator chose to make this activity-specific version reusable. */
  readonly savedAsReusableTemplate: boolean;
  readonly reusableTemplateId?: string;
  /** Participant work remains attached to the version on which it was created. */
  readonly preservesPriorParticipantWork: true;
}

export interface ReusableBlueprintTemplate {
  readonly id: string;
  readonly teamId: string;
  readonly name: string;
  readonly sourceBlueprintVersionId: string;
  readonly definition: ActivityBlueprintDefinition;
  readonly createdAt: string;
  readonly createdBy: string;
}

export interface BlueprintChangePolicy {
  readonly preferredChangeWindows: readonly ['before-activity', 'after-activity'];
  readonly duringActivityChangeAllowed: true;
  readonly duringActivityRequiresNewVersion: true;
  readonly changesVisibleToCurrentParticipants: true;
  readonly preservePriorParticipantWork: true;
}

export const BLUEPRINT_CHANGE_POLICY: BlueprintChangePolicy = {
  preferredChangeWindows: ['before-activity', 'after-activity'],
  duringActivityChangeAllowed: true,
  duringActivityRequiresNewVersion: true,
  changesVisibleToCurrentParticipants: true,
  preservePriorParticipantWork: true,
};

export function requiresChangeWarning(window: BlueprintChangeWindow): boolean {
  return window === 'during-activity';
}
