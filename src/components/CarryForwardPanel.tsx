import { useState } from "react";
import type { ActivityTemplate } from "../domain/activity-model";
import type { Contribution } from "../domain/workspace-persistence";
import "../carry-forward.css";

interface CarryForwardPanelProps {
  sourceMethodName: string;
  contributions: readonly Contribution[];
  targets: readonly ActivityTemplate[];
  onCarry: (targetActivityId: string, contributionIds: readonly string[]) => void;
}

export function CarryForwardPanel({ sourceMethodName, contributions, targets, onCarry }: CarryForwardPanelProps) {
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  if (targets.length === 0) return null;

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return <section className="carry-forward-panel" aria-labelledby="carry-forward-heading">
    <div className="carry-forward-heading"><div><span className="eyebrow">ITERATION HANDOFF</span><h2 id="carry-forward-heading">Carry selected work forward</h2><p>Keep the source record intact while making chosen outputs available to the next method.</p></div><span className="carry-forward-count">{selected.length} selected</span></div>
    <label className="carry-forward-target">Next method<select value={targetId} onChange={(event) => setTargetId(event.target.value)}>{targets.map((target) => <option value={target.id} key={target.id}>{target.name}</option>)}</select></label>
    <div className="carry-forward-list">{contributions.length === 0 ? <p className="carry-forward-empty">Add a contribution before choosing what to carry forward.</p> : contributions.map((item) => <label className="carry-forward-item" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} /><span><strong>{item.content}</strong><small>{sourceMethodName} · {item.author.displayName}</small></span></label>)}</div>
    <button type="button" className="carry-forward-button" disabled={!targetId || selected.length === 0} onClick={() => { onCarry(targetId, selected); setSelected([]); }}>Carry selected outputs</button>
  </section>;
}

