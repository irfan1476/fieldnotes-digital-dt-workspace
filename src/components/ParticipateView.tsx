import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import "../participate.css";

export const EMPATHY_REGIONS = ["say", "think", "do", "feel"] as const;

export type EmpathyRegion = (typeof EMPATHY_REGIONS)[number];
export type MobileWorkspaceView = "board" | "participate" | "review";

export interface ParticipantIdentity {
  id: string;
  name: string;
  initials: string;
  color?: string;
}

export interface EmpathyContribution {
  id: string;
  region: EmpathyRegion;
  text: string;
  author: ParticipantIdentity;
  createdAt: string;
  updatedAt?: string;
}

export interface NewContributionInput {
  region: EmpathyRegion;
  text: string;
}

export interface ParticipateViewProps {
  contributions: readonly EmpathyContribution[];
  currentUser: ParticipantIdentity;
  /** Observers can navigate and read, but cannot add, edit, move, or delete. */
  readOnly?: boolean;
  readOnlyReason?: string;
  lockedRegions?: readonly EmpathyRegion[];
  guidedRegion?: EmpathyRegion | null;
  activeView?: MobileWorkspaceView;
  initialRegion?: EmpathyRegion;
  activityTitle?: string;
  activityContext?: string;
  onViewChange?: (view: MobileWorkspaceView) => void;
  onCreate: (input: NewContributionInput) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, region: EmpathyRegion) => void;
}

type RegionDefinition = {
  id: EmpathyRegion;
  label: string;
  shortPrompt: string;
  prompt: string;
};

const REGION_DEFINITIONS: readonly RegionDefinition[] = [
  { id: "say", label: "Say", shortPrompt: "Words and phrases", prompt: "What does the person say in their own words? Capture direct language when possible." },
  { id: "think", label: "Think", shortPrompt: "Beliefs and questions", prompt: "What might the person be thinking, expecting, or questioning? Mark assumptions clearly." },
  { id: "do", label: "Do", shortPrompt: "Visible actions", prompt: "What actions and behaviours did the team observe? Focus on evidence rather than interpretation." },
  { id: "feel", label: "Feel", shortPrompt: "Emotions and needs", prompt: "What emotions or unmet needs appear? Describe the evidence behind the interpretation." },
] as const;

const VIEW_ITEMS: readonly { id: MobileWorkspaceView; label: string; icon: string }[] = [
  { id: "board", label: "Board", icon: "▦" },
  { id: "participate", label: "Participate", icon: "+" },
  { id: "review", label: "Review", icon: "✓" },
] as const;

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ParticipateView({
  contributions,
  currentUser,
  readOnly = false,
  readOnlyReason,
  lockedRegions = [],
  guidedRegion = null,
  activeView = "participate",
  initialRegion = "say",
  activityTitle = "Empathy map",
  activityContext = "Observe / Activity",
  onViewChange,
  onCreate,
  onEdit,
  onDelete,
  onMove,
}: ParticipateViewProps) {
  const [region, setRegion] = useState<EmpathyRegion>(initialRegion);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const regionLocked = lockedRegions.includes(region);
  const contributionDisabled = readOnly || regionLocked;

  const activeRegion = REGION_DEFINITIONS.find((item) => item.id === region)!;
  const visibleContributions = useMemo(
    () => contributions.filter((contribution) => contribution.region === region),
    [contributions, region],
  );

  useEffect(() => {
    if (editingId && !contributions.some((item) => item.id === editingId)) {
      setEditingId(null);
      setEditingText("");
    }
  }, [contributions, editingId]);

  useEffect(() => {
    if (guidedRegion) {
      setRegion(guidedRegion);
      setEditingId(null);
    }
  }, [guidedRegion]);

  function submitContribution(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || contributionDisabled) return;
    onCreate({ region, text });
    setDraft("");
    inputRef.current?.focus();
  }

  function beginEdit(contribution: EmpathyContribution) {
    if (contributionDisabled) return;
    setEditingId(contribution.id);
    setEditingText(contribution.text);
  }

  function submitEdit(event: FormEvent, id: string) {
    event.preventDefault();
    const text = editingText.trim();
    if (!text || contributionDisabled) return;
    onEdit(id, text);
    setEditingId(null);
    setEditingText("");
  }

  return (
    <section className="participate-view" aria-label={`${activityTitle} participation view`}>
      <header className="participate-header">
        <div>
          <span className="participate-kicker">{activityContext}</span>
          <h1>{activityTitle}</h1>
        </div>
        <div className="participate-person" aria-label={`Signed in as ${currentUser.name}`}>
          <span className="participate-avatar" style={{ backgroundColor: currentUser.color ?? "#2e80d9" }}>
            {currentUser.initials}
          </span>
          <span>{readOnly ? "Observer" : "Participant"}</span>
        </div>
      </header>

      {(readOnly || regionLocked) && (
        <div className="participate-readonly" role="status">
          <span aria-hidden="true">○</span>
          {readOnly
            ? (readOnlyReason ?? "You are viewing this activity in read-only mode.")
            : `${activeRegion.label} is closed for contributions by the facilitator.`}
        </div>
      )}

      <div className="participate-region-tabs" role="tablist" aria-label="Empathy map regions">
        {REGION_DEFINITIONS.map((item) => {
          const count = contributions.filter((contribution) => contribution.region === item.id).length;
          return (
            <button
              type="button"
              role="tab"
              aria-selected={region === item.id}
              aria-controls="participate-region-panel"
              className={region === item.id ? "is-active" : ""}
              key={item.id}
              onClick={() => {
                setRegion(item.id);
                setEditingId(null);
              }}
            >
              <span>{item.label}</span>
              <small>{count}</small>
            </button>
          );
        })}
      </div>

      <div className={`participate-prompt participate-prompt--${region}`} id="participate-region-panel" role="tabpanel">
        <span className="participate-region-label">{activeRegion.label}</span>
        <div>
          <strong>{activeRegion.shortPrompt}</strong>
          <p>{activeRegion.prompt}</p>
        </div>
      </div>

      {!contributionDisabled && (
        <form className="participate-composer" onSubmit={submitContribution}>
          <label htmlFor="participate-new-contribution">Add to {activeRegion.label}</label>
          <textarea
            ref={inputRef}
            id="participate-new-contribution"
            rows={3}
            value={draft}
            maxLength={500}
            placeholder="Write one observation per card…"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div>
            <small>{draft.length}/500</small>
            <button type="submit" disabled={!draft.trim()}>Add card</button>
          </div>
        </form>
      )}

      <div className="participate-feed">
        <div className="participate-feed-heading">
          <h2>{activeRegion.label} contributions</h2>
          <span>{visibleContributions.length} {visibleContributions.length === 1 ? "card" : "cards"}</span>
        </div>

        {visibleContributions.length === 0 ? (
          <div className="participate-empty">
            <span aria-hidden="true">＋</span>
            <strong>No contributions here yet</strong>
            <p>{contributionDisabled ? "The team’s contributions will appear here when this region is open." : "Add the first observation for this region."}</p>
          </div>
        ) : (
          <div className="participate-card-list">
            {visibleContributions.map((contribution) => {
              const canModify = !contributionDisabled && contribution.author.id === currentUser.id;
              const isEditing = editingId === contribution.id;
              return (
                <article className={`participate-card participate-card--${region}`} key={contribution.id}>
                  {isEditing ? (
                    <form className="participate-edit-form" onSubmit={(event) => submitEdit(event, contribution.id)}>
                      <label htmlFor={`edit-${contribution.id}`}>Edit contribution</label>
                      <textarea
                        id={`edit-${contribution.id}`}
                        autoFocus
                        rows={4}
                        maxLength={500}
                        value={editingText}
                        onChange={(event) => setEditingText(event.target.value)}
                      />
                      <div>
                        <button type="button" className="participate-text-button" onClick={() => setEditingId(null)}>Cancel</button>
                        <button type="submit" className="participate-primary-button" disabled={!editingText.trim()}>Save</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p>{contribution.text}</p>
                      <footer>
                        <span className="participate-author">
                          <i style={{ backgroundColor: contribution.author.color ?? "#8c6bb1" }}>{contribution.author.initials}</i>
                          {contribution.author.name}
                        </span>
                        <time dateTime={contribution.updatedAt ?? contribution.createdAt}>
                          {contribution.updatedAt ? "Edited " : ""}{formatTime(contribution.updatedAt ?? contribution.createdAt)}
                        </time>
                      </footer>
                      {canModify && (
                        <div className="participate-card-actions">
                          <label>
                            <span>Move to</span>
                            <select
                              aria-label={`Move contribution by ${contribution.author.name}`}
                              value={contribution.region}
                              onChange={(event) => onMove(contribution.id, event.target.value as EmpathyRegion)}
                            >
                              {REGION_DEFINITIONS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                            </select>
                          </label>
                          <button type="button" onClick={() => beginEdit(contribution)}>Edit</button>
                          <button type="button" className="is-danger" onClick={() => onDelete(contribution.id)}>Delete</button>
                        </div>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <nav className="participate-mobile-nav" aria-label="Activity views">
        {VIEW_ITEMS.map((item) => (
          <button
            type="button"
            className={activeView === item.id ? "is-active" : ""}
            aria-current={activeView === item.id ? "page" : undefined}
            key={item.id}
            onClick={() => onViewChange?.(item.id)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </section>
  );
}

export default ParticipateView;
