import { FormEvent, useEffect, useMemo, useState } from "react";
import type { BlueprintRegion } from "../domain/blueprint-model";
import type { Contribution } from "../domain/workspace-persistence";
import type { MobileWorkspaceView, ParticipantIdentity } from "./ParticipateView";
import { StructuredMethodComposer, structuredMethodForTitle } from "./StructuredMethodComposer";
import "../participate.css";

interface MethodParticipateViewProps {
  title: string;
  context: string;
  regions: readonly BlueprintRegion[];
  contributions: readonly Contribution[];
  currentUser: ParticipantIdentity;
  readOnly?: boolean;
  readOnlyReason?: string;
  lockedRegions?: readonly string[];
  guidedRegion?: string | null;
  activeView?: MobileWorkspaceView;
  onViewChange?: (view: MobileWorkspaceView) => void;
  onCreate: (regionId: string, text: string) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, regionId: string) => void;
}

const views: readonly { id: MobileWorkspaceView; label: string; icon: string }[] = [
  { id: "board", label: "Board", icon: "▦" },
  { id: "participate", label: "Participate", icon: "+" },
  { id: "review", label: "Review", icon: "✓" },
];

export function MethodParticipateView({ title, context, regions, contributions, currentUser, readOnly = false, readOnlyReason, lockedRegions = [], guidedRegion, activeView = "participate", onViewChange, onCreate, onEdit, onDelete, onMove }: MethodParticipateViewProps) {
  const [regionId, setRegionId] = useState(regions[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const activeRegion = regions.find((region) => region.id === regionId) ?? regions[0];
  const visible = useMemo(() => contributions.filter((item) => item.regionId === activeRegion?.id), [activeRegion?.id, contributions]);
  const locked = activeRegion ? lockedRegions.includes(activeRegion.id) : true;
  const disabled = readOnly || locked;
  const structuredMethod = structuredMethodForTitle(title);

  useEffect(() => {
    if (guidedRegion && regions.some((region) => region.id === guidedRegion)) setRegionId(guidedRegion);
  }, [guidedRegion, regions]);

  if (!activeRegion) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || disabled) return;
    onCreate(activeRegion.id, draft.trim());
    setDraft("");
  }

  return <section className="participate-view" aria-label={`${title} participation view`}>
    <header className="participate-header"><div><span className="participate-kicker">{context}</span><h1>{title}</h1></div><div className="participate-person"><span className="participate-avatar" style={{ backgroundColor: currentUser.color }}>{currentUser.initials}</span><span>{readOnly ? "Observer" : "Participant"}</span></div></header>
    {disabled && <div className="participate-readonly" role="status"><span aria-hidden="true">○</span>{readOnly ? readOnlyReason ?? "You are viewing this activity in read-only mode." : `${activeRegion.label} is closed for contributions by the facilitator.`}</div>}
    <div className="participate-region-tabs" role="tablist" aria-label={`${title} regions`}>{regions.map((region) => <button type="button" role="tab" aria-selected={region.id === activeRegion.id} className={region.id === activeRegion.id ? "is-active" : ""} key={region.id} onClick={() => { setRegionId(region.id); setEditingId(null); }}><span>{region.label}</span><small>{contributions.filter((item) => item.regionId === region.id).length}</small></button>)}</div>
    <div className={`participate-prompt participate-prompt--${activeRegion.accent}`} role="tabpanel"><span className="participate-region-label">{activeRegion.label}</span><div><strong>{activeRegion.description}</strong><p>{activeRegion.contributionPrompt}</p></div></div>
    {!disabled && (structuredMethod ? <StructuredMethodComposer method={structuredMethod} region={activeRegion} onCreate={(content) => onCreate(activeRegion.id, content)} /> : <form className="participate-composer" onSubmit={submit}><label htmlFor="method-new-contribution">Add to {activeRegion.label}</label><textarea id="method-new-contribution" rows={3} maxLength={500} value={draft} placeholder="Write one contribution per card…" onChange={(event) => setDraft(event.target.value)} /><div><small>{draft.length}/500</small><button type="submit" disabled={!draft.trim()}>Add card</button></div></form>)}
    <div className="participate-feed"><div className="participate-feed-heading"><h2>{activeRegion.label}</h2><span>{visible.length} {visible.length === 1 ? "card" : "cards"}</span></div>{visible.length === 0 ? <div className="participate-empty"><span aria-hidden="true">＋</span><strong>No contributions here yet</strong><p>{disabled ? "Contributions will remain visible here when available." : "Add the first contribution for this part of the method."}</p></div> : <div className="participate-card-list">{visible.map((item) => { const canModify = !disabled && item.author.id === currentUser.id; const editing = editingId === item.id; return <article className={`participate-card participate-card--${activeRegion.accent}`} key={item.id}>{editing ? <form className="participate-edit-form" onSubmit={(event) => { event.preventDefault(); if (!editingText.trim()) return; onEdit(item.id, editingText.trim()); setEditingId(null); }}><label htmlFor={`edit-${item.id}`}>Edit contribution</label><textarea id={`edit-${item.id}`} autoFocus rows={4} maxLength={500} value={editingText} onChange={(event) => setEditingText(event.target.value)} /><div><button type="button" className="participate-text-button" onClick={() => setEditingId(null)}>Cancel</button><button type="submit" className="participate-primary-button">Save</button></div></form> : <><p>{item.content}</p><footer><span className="participate-author"><i style={{ backgroundColor: currentUser.color }}>{item.author.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}</i>{item.author.displayName}</span><time dateTime={item.updatedAt}>{new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></footer>{canModify && <div className="participate-card-actions"><label><span>Move to</span><select value={item.regionId} onChange={(event) => onMove(item.id, event.target.value)}>{regions.map((region) => <option value={region.id} key={region.id}>{region.label}</option>)}</select></label><button type="button" onClick={() => { setEditingId(item.id); setEditingText(item.content); }}>Edit</button><button type="button" className="is-danger" onClick={() => onDelete(item.id)}>Delete</button></div>}</>}</article>; })}</div>}</div>
    <nav className="participate-mobile-nav" aria-label="Activity views">{views.map((view) => <button type="button" className={activeView === view.id ? "is-active" : ""} key={view.id} onClick={() => onViewChange?.(view.id)}><span aria-hidden="true">{view.icon}</span>{view.label}</button>)}</nav>
  </section>;
}
