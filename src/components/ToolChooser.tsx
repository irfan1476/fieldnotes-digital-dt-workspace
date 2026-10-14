import { useMemo, useState } from 'react';
import type { ActivityTemplate, DesignThinkingStage, StageDefinition } from '../domain/activity-model';
import '../tool-chooser.css';

export interface ToolChooserProps {
  templates: readonly ActivityTemplate[];
  stages: readonly StageDefinition[];
  implementedMethodIds: readonly string[];
  activeMethodId?: string;
  onSelect: (methodId: string) => void;
}

type TimeFilter = 'any' | '15' | '30' | '45' | '60';

const PURPOSES = [
  { id: 'any', label: 'Any purpose' },
  { id: 'frame', label: 'Frame a challenge', terms: /frame|challenge|scope|brief/i },
  { id: 'observe', label: 'Understand people', terms: /observ|interview|people|empathy|need/i },
  { id: 'define', label: 'Make sense of evidence', terms: /insight|evidence|point of view|pattern|synthesi/i },
  { id: 'generate', label: 'Generate ideas', terms: /generat|idea|possibilit|brainwrit/i },
  { id: 'decide', label: 'Choose a direction', terms: /select|choos|decision|vote|prioriti|candidate/i },
  { id: 'make', label: 'Make something tangible', terms: /prototyp|sketch|tangible|artefact/i },
  { id: 'learn', label: 'Test and learn', terms: /test|feedback|learn|response/i },
  { id: 'reflect', label: 'Reflect and iterate', terms: /reflect|iteration|carry forward|review/i },
] as const;

export function ToolChooser({ templates, stages, implementedMethodIds, activeMethodId, onSelect }: ToolChooserProps) {
  const [stageFilter, setStageFilter] = useState<DesignThinkingStage | 'all'>('all');
  const [purposeFilter, setPurposeFilter] = useState<string>('any');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('any');
  const [query, setQuery] = useState('');
  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);
  const purpose = PURPOSES.find((item) => item.id === purposeFilter) ?? PURPOSES[0];
  const visibleTemplates = templates.filter((template) => {
    if (stageFilter !== 'all' && template.stage !== stageFilter) return false;
    if (purposeFilter !== 'any' && !('terms' in purpose && purpose.terms.test(`${template.name} ${template.shortDescription} ${template.purpose} ${template.whenToUse}`))) return false;
    if (timeFilter !== 'any' && template.suggestedMinutes > Number(timeFilter)) return false;
    const searchable = `${template.name} ${template.shortDescription} ${template.purpose} ${template.whenToUse} ${template.teamFormat}`;
    return !query.trim() || searchable.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <section className="tool-chooser" aria-labelledby="tool-chooser-title">
      <header className="tool-chooser__header">
        <div><p className="tool-chooser__eyebrow">DESIGN THINKING TOOLKIT</p><h1 id="tool-chooser-title">Choose a method for this moment</h1><p>Follow the cycle, or find a method by purpose and time. Only available methods can be opened.</p></div>
        <label className="tool-chooser__search"><span>Search methods</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try “ideas” or “evidence”" /></label>
      </header>
      <div className="tool-chooser__filters" aria-label="Filter methods">
        <label><span>Cycle</span><select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as DesignThinkingStage | 'all')}><option value="all">All cycles</option>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.number}. {stage.label}</option>)}</select></label>
        <label><span>Purpose</span><select value={purposeFilter} onChange={(event) => setPurposeFilter(event.target.value)}>{PURPOSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label><span>Time available</span><select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}><option value="any">Any duration</option><option value="15">Up to 15 min</option><option value="30">Up to 30 min</option><option value="45">Up to 45 min</option><option value="60">Up to 60 min</option></select></label>
        <span className="tool-chooser__count" aria-live="polite">{visibleTemplates.length} {visibleTemplates.length === 1 ? 'method' : 'methods'}</span>
      </div>
      {visibleTemplates.length ? <div className="tool-chooser__grid">{visibleTemplates.map((template) => {
        const stage = stageById.get(template.stage);
        const available = implementedMethodIds.includes(template.id);
        const active = template.id === activeMethodId;
        const requiredInputs = template.fields.filter((field) => field.required);
        return <article className={`tool-card${active ? ' is-active' : ''}${available ? '' : ' is-planned'}`} key={template.id}>
          <div className="tool-card__top"><span className="tool-card__stage">{stage ? `${stage.number} · ${stage.label}` : template.stage}</span><span className="tool-card__time">{template.suggestedMinutes} min</span></div>
          <h2>{template.name}</h2><p className="tool-card__summary">{template.shortDescription}</p>
          <dl className="tool-card__details">
            <div><dt>Use it when</dt><dd>{template.whenToUse}</dd></div>
            <div><dt>Team format</dt><dd>{template.teamFormat}</dd></div>
            <div><dt>Required inputs</dt><dd>{requiredInputs.length ? requiredInputs.map((field) => field.label).join(' · ') : 'No required form inputs'}</dd></div>
            <div><dt>Retained output</dt><dd>{template.retainedOutputs.join(' · ')}</dd></div>
          </dl>
          {available ? <button className="tool-card__action" type="button" aria-current={active ? 'true' : undefined} onClick={() => onSelect(template.id)}>{active ? 'Open current method' : 'Open method'}<span aria-hidden="true">↗</span></button> : <div className="tool-card__unavailable"><span className="tool-card__status">Planned</span><span>Not available to launch yet</span></div>}
        </article>;
      })}</div> : <p className="tool-chooser__empty">No methods match these filters. Try a different cycle, purpose, or time.</p>}
    </section>
  );
}
