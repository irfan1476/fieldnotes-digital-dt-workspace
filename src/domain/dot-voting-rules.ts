/**
 * Pure rules for the dot-voting method.
 *
 * The board stores votes as an actor-to-candidate ledger. This module keeps
 * tallying and completion policy independent from the UI so the same rules
 * can be used by the facilitator view, review view, and a future server.
 */

export type DotVotingRoundState = "setup" | "open" | "closed";

export type VoteLedger = Record<string, Record<string, number>>;

export interface VoteTally {
  candidateId: string;
  total: number;
  rank: number;
}

export interface DotVotingSummary {
  tallies: VoteTally[];
  winningCandidateIds: string[];
  tied: boolean;
  totalVotes: number;
  voterCount: number;
}

export interface DotVotingCompletionInput {
  roundState: DotVotingRoundState;
  candidateIds: readonly string[];
  votes: VoteLedger;
  decision?: unknown;
  objections?: unknown;
  /** Required when the top tally contains more than one candidate. */
  tieResolution?: unknown;
}

export interface DotVotingCompletion {
  valid: boolean;
  errors: string[];
  summary: DotVotingSummary;
}

function nonEmptyIds(candidateIds: readonly string[]): string[] {
  return [...new Set(candidateIds.filter((candidateId) => candidateId.trim().length > 0))];
}

function positiveVoteCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value > 0 ? value : 0;
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** Return the recorded votes for one candidate, ignoring malformed values. */
export function candidateVoteTotal(votes: VoteLedger, candidateId: string): number {
  return Object.values(votes).reduce((total, allocation) => total + positiveVoteCount(allocation?.[candidateId]), 0);
}

/**
 * Calculate a deterministic tally. Ties retain the supplied candidate order,
 * which keeps the review surface stable while `winningCandidateIds` exposes
 * the actual tie to the facilitator.
 */
export function summarizeDotVoting(votes: VoteLedger, candidateIds: readonly string[]): DotVotingSummary {
  const ids = nonEmptyIds(candidateIds);
  const order = new Map(ids.map((candidateId, index) => [candidateId, index]));
  const tallies = ids
    .map((candidateId) => ({ candidateId, total: candidateVoteTotal(votes, candidateId), rank: 0 }))
    .sort((left, right) => right.total - left.total || (order.get(left.candidateId) ?? 0) - (order.get(right.candidateId) ?? 0));

  const topTotal = tallies[0]?.total ?? 0;
  const winningCandidateIds = topTotal > 0
    ? tallies.filter((tally) => tally.total === topTotal).map((tally) => tally.candidateId)
    : [];
  let lastTotal: number | undefined;
  let rank = 0;
  tallies.forEach((tally, index) => {
    if (tally.total !== lastTotal) rank = index + 1;
    tally.rank = rank;
    lastTotal = tally.total;
  });

  let totalVotes = 0;
  const voterIds = new Set<string>();
  Object.entries(votes).forEach(([actorId, allocation]) => {
    let actorTotal = 0;
    ids.forEach((candidateId) => {
      actorTotal += positiveVoteCount(allocation?.[candidateId]);
    });
    if (actorTotal > 0) {
      totalVotes += actorTotal;
      voterIds.add(actorId);
    }
  });

  return {
    tallies,
    winningCandidateIds,
    tied: winningCandidateIds.length > 1,
    totalVotes,
    voterCount: voterIds.size,
  };
}

/**
 * Check whether a closed voting round has enough recorded context to become a
 * durable activity outcome. Objections require an explicit acknowledgement;
 * entering “No objections” is a valid acknowledgement and keeps minority
 * views distinguishable from an unfinished form.
 */
export function validateDotVotingCompletion(input: DotVotingCompletionInput): DotVotingCompletion {
  const summary = summarizeDotVoting(input.votes, input.candidateIds);
  const errors: string[] = [];

  if (input.roundState !== "closed") errors.push("Close the voting round before completing the activity.");
  if (summary.tallies.length === 0) errors.push("Add at least one candidate before completing the activity.");
  if (summary.totalVotes === 0) errors.push("Record at least one vote before completing the activity.");
  if (!hasText(input.decision)) errors.push("Record the team decision and its rationale.");
  if (!hasText(input.objections)) errors.push("Record objections or explicitly acknowledge that there are no objections.");
  if (summary.tied && !hasText(input.tieResolution)) errors.push("Record the facilitator's resolution for the tied result.");

  return { valid: errors.length === 0, errors, summary };
}

