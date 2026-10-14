import type { Contribution } from "../domain/workspace-persistence";
import { summarizeDotVoting } from "../domain/dot-voting-rules";
import "../dot-voting.css";

export type VoteRoundState = "setup" | "open" | "closed";
export type VoteLedger = Record<string, Record<string, number>>;

interface DotVotingPanelProps {
  candidates: readonly Contribution[];
  actorId: string;
  actorName: string;
  budget: number;
  roundState: VoteRoundState;
  votes: VoteLedger;
  facilitator?: boolean;
  readOnly?: boolean;
  onCast: (candidateId: string) => void;
  onRetract: (candidateId: string) => void;
  onRoundStateChange?: (state: VoteRoundState) => void;
  tieResolution?: string;
  onTieResolutionChange?: (value: string) => void;
  completionErrors?: readonly string[];
}

export function DotVotingPanel({ candidates, actorId, actorName, budget, roundState, votes, facilitator = false, readOnly = false, onCast, onRetract, onRoundStateChange, tieResolution = "", onTieResolutionChange, completionErrors = [] }: DotVotingPanelProps) {
  const allocation = votes[actorId] ?? {};
  const used = Object.values(allocation).reduce((total, count) => total + count, 0);
  const remaining = Math.max(0, budget - used);
  const summary = summarizeDotVoting(votes, candidates.map((candidate) => candidate.id));
  const tallyById = new Map(summary.tallies.map((tally) => [tally.candidateId, tally]));
  const orderedCandidates = [...candidates].sort((a, b) => (tallyById.get(b.id)?.total ?? 0) - (tallyById.get(a.id)?.total ?? 0));

  return <section className="dot-voting-panel" aria-labelledby="dot-voting-heading">
    <header><div><span className="dot-voting-kicker">Decision round</span><h2 id="dot-voting-heading">Dot voting</h2></div><span className={`dot-voting-state dot-voting-state--${roundState}`}>{roundState}</span></header>

    {facilitator && <div className="dot-voting-facilitator"><div><strong>Round control</strong><p>Totals stay hidden from participants until the round closes.</p></div>{roundState === "setup" ? <button type="button" onClick={() => onRoundStateChange?.("open")} disabled={readOnly || candidates.length === 0}>Open voting</button> : roundState === "open" ? <button type="button" onClick={() => onRoundStateChange?.("closed")} disabled={readOnly}>Close and reveal</button> : <button type="button" onClick={() => onRoundStateChange?.("open")} disabled={readOnly}>Reopen round</button>}</div>}

    <div className="dot-voting-budget" aria-live="polite"><span>{actorName}</span><strong>{roundState === "closed" ? `${used} cast` : `${remaining} of ${budget} votes left`}</strong></div>

    {candidates.length === 0 ? <div className="dot-voting-empty"><strong>No candidates yet</strong><p>Add candidate cards in the Candidates region before opening the round.</p></div> : <div className="dot-voting-candidates">{orderedCandidates.map((candidate) => { const ownVotes = allocation[candidate.id] ?? 0; const total = tallyById.get(candidate.id)?.total ?? 0; const leading = summary.winningCandidateIds.includes(candidate.id); return <article key={candidate.id} className={roundState === "closed" && leading && total > 0 ? "is-leading" : ""}><div className="dot-voting-candidate-copy"><p>{candidate.content}</p><small>{candidate.author.displayName}</small></div>{roundState === "closed" ? <output aria-label={`${total} total votes`}>{total}<small>{total === 1 ? "vote" : "votes"}</small></output> : <div className="dot-voting-allocation"><button type="button" aria-label={`Remove a vote from ${candidate.content}`} disabled={readOnly || roundState !== "open" || ownVotes === 0} onClick={() => onRetract(candidate.id)}>−</button><output aria-label={`${ownVotes} of your votes`}>{ownVotes}</output><button type="button" aria-label={`Vote for ${candidate.content}`} disabled={readOnly || roundState !== "open" || remaining === 0} onClick={() => onCast(candidate.id)}>+</button></div>}</article>; })}</div>}

    {roundState === "closed" && summary.tied && facilitator && <div className="dot-voting-tie" role="status"><strong>Tie requires a facilitator decision</strong><p>{summary.winningCandidateIds.length} candidates share the highest tally. Record what the team will carry forward.</p><textarea rows={3} value={tieResolution} onChange={(event) => onTieResolutionChange?.(event.target.value)} placeholder="Record the tie-break decision and rationale…" disabled={readOnly} /></div>}
    {facilitator && completionErrors.length > 0 && <div className="dot-voting-completion-errors" role="alert"><strong>Before completing this method</strong><ul>{completionErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}

    {roundState === "setup" && <p className="dot-voting-help">The facilitator will open the round after the team agrees on criteria and candidates.</p>}
    {roundState === "open" && <p className="dot-voting-help">Your allocation is attributed in this local prototype. Other totals are hidden until closure.</p>}
    {roundState === "closed" && <p className="dot-voting-help">The tally informs the discussion. Record the final decision and any objections separately.</p>}
  </section>;
}
