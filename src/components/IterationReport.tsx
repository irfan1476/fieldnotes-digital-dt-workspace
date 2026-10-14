import type { ReactNode } from 'react';
import type {
  ActivityRevision,
  Contribution,
  JsonValue,
  WorkspaceActivityState,
  WorkspaceDocument,
} from '../domain/workspace-persistence';
import { ACTIVITY_TEMPLATES, STAGES } from '../data/activity-templates';
import type { ActivityTemplate } from '../domain/activity-model';
import '../iteration-report.css';

export interface IterationReportProps {
  /** The browser-local workspace snapshot to report from. */
  document: WorkspaceDocument;
  /** Optional iteration filter. Omit to include every iteration in the document. */
  iterationId?: string;
  title?: string;
  className?: string;
}

interface ReportActivity {
  state: WorkspaceActivityState;
  revision: ActivityRevision;
  template?: ActivityTemplate;
}

function currentRevision(activity: WorkspaceActivityState): ActivityRevision | undefined {
  return activity.revisions.find((revision) => revision.id === activity.currentRevisionId)
    ?? [...activity.revisions].sort((a, b) => b.version - a.version)[0];
}

function displayValue(value: JsonValue | undefined): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => displayValue(item)).filter(Boolean).join(', ');
  return Object.entries(value)
    .map(([key, item]) => `${key}: ${displayValue(item)}`)
    .filter((part) => !part.endsWith(': '))
    .join('\n');
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}

function prettyStatus(status: string): string {
  return status.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fieldLabel(template: ActivityTemplate | undefined, fieldId: string): string {
  return template?.fields.find((field) => field.id === fieldId)?.label
    ?? fieldId.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fieldEntries(item: ReportActivity) {
  return Object.entries(item.revision.fields)
    .map(([id, value]) => ({ id, label: fieldLabel(item.template, id), text: displayValue(value) }))
    .filter((entry) => entry.text.length > 0);
}

function isOutcome(label: string): boolean {
  return /outcome|conclusion|decision|learning|learned|changed|result|selected|next move/i.test(label);
}

function isEvidence(label: string): boolean {
  return /evidence|observation|finding|signal|criteria|source/i.test(label);
}

function isNextStep(label: string): boolean {
  return /next|try|action|follow.?up|owner/i.test(label);
}

function methodName(item: ReportActivity): string {
  return item.template?.name ?? item.state.templateId;
}

function methodSummary(item: ReportActivity): string {
  const submitted = item.revision.contributions.filter((entry) => entry.status === 'submitted').length;
  const total = item.revision.contributions.length;
  return `${submitted} submitted contribution${submitted === 1 ? '' : 's'}${total !== submitted ? ` · ${total - submitted} draft or archived` : ''}`;
}

function renderFields(title: string, entries: ReturnType<typeof fieldEntries>, predicate?: (label: string) => boolean): ReactNode {
  const selected = predicate ? entries.filter((entry) => predicate(entry.label)) : entries;
  if (!selected.length) return null;
  return (
    <section className="iteration-report__field-section">
      <h4>{title}</h4>
      <dl className="iteration-report__fields">
        {selected.map(({ id, label, text }) => (
          <div className="iteration-report__field" key={id}>
            <dt>{label}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ContributionList({ contributions }: { contributions: readonly Contribution[] }) {
  if (!contributions.length) return <p className="iteration-report__empty">No contribution records in this revision.</p>;
  return (
    <ul className="iteration-report__contributions">
      {contributions.map((contribution) => (
        <li key={contribution.id}>
          <p>{contribution.content || '(Empty contribution)'}</p>
          <small>
            {contribution.author.displayName} · {prettyStatus(contribution.status)}
            {contribution.regionId ? ` · ${contribution.regionId.replace(/[-_]/g, ' ')}` : ''}
            {contribution.tags.length ? ` · ${contribution.tags.join(', ')}` : ''}
          </small>
        </li>
      ))}
    </ul>
  );
}

function MethodCard({ item }: { item: ReportActivity }) {
  const entries = fieldEntries(item);
  const submitted = item.revision.contributions.filter((contribution) => contribution.status === 'submitted');
  const stage = STAGES.find((candidate) => candidate.id === item.template?.stage);
  return (
    <article className="iteration-report__method">
      <header className="iteration-report__method-heading">
        <div>
          <p className="iteration-report__eyebrow">{stage?.label ?? 'Method'} · {item.state.templateId}</p>
          <h3>{methodName(item)}</h3>
        </div>
        <span className="iteration-report__status">{prettyStatus(item.revision.status)}</span>
      </header>
      <p className="iteration-report__method-meta">
        Revision {item.revision.version} · Saved {dateLabel(item.revision.createdAt)} · {methodSummary(item)}
      </p>
      {renderFields('Outcomes and recorded decisions', entries, isOutcome)}
      {renderFields('Evidence and observations', entries, isEvidence)}
      {renderFields('Next steps', entries, isNextStep)}
      {renderFields('Other recorded fields', entries, (label) => !isOutcome(label) && !isEvidence(label) && !isNextStep(label))}
      <section className="iteration-report__field-section">
        <h4>Team contributions</h4>
        <ContributionList contributions={submitted} />
      </section>
      {item.revision.contributions.some((contribution) => contribution.status !== 'submitted') && (
        <details className="iteration-report__other-contributions">
          <summary>Include drafts and archived contributions ({item.revision.contributions.length - submitted.length})</summary>
          <ContributionList contributions={item.revision.contributions.filter((contribution) => contribution.status !== 'submitted')} />
        </details>
      )}
    </article>
  );
}

export function IterationReport({ document, iterationId, title = 'Design thinking iteration report', className = '' }: IterationReportProps) {
  const allActivities = Object.values(document.activities)
    .filter((activity) => !iterationId || activity.iterationId === iterationId)
    .map((state): ReportActivity | undefined => {
      const revision = currentRevision(state);
      if (!revision) return undefined;
      return { state, revision, template: ACTIVITY_TEMPLATES.find((template) => template.id === state.templateId) };
    })
    .filter((item): item is ReportActivity => Boolean(item))
    .sort((a, b) => (a.template?.stage ?? '').localeCompare(b.template?.stage ?? '') || methodName(a).localeCompare(methodName(b)));
  const iterations = [...new Set(allActivities.map((item) => item.state.iterationId))];
  const groups = iterations.map((id) => ({
    id,
    activities: allActivities.filter((item) => item.state.iterationId === id),
  }));
  const challengeFields = allActivities.flatMap((item) => fieldEntries(item)
    .filter(({ label }) => /challenge|brief|problem statement|people affected|scope|constraint/i.test(label))
    .map((entry) => ({ ...entry, method: methodName(item), activityKey: item.state.activityId })));
  const printableId = 'iteration-report-print-root';

  return (
    <main className={`iteration-report ${className}`.trim()} id={printableId}>
      <div className="iteration-report__toolbar">
        <p>Print this report or choose “Save as PDF” in your browser’s print dialog.</p>
        <button type="button" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <header className="iteration-report__cover">
        <p className="iteration-report__eyebrow">Design thinking workspace</p>
        <h1>{title}</h1>
        <p>Prepared {dateLabel(new Date().toISOString())} · {allActivities.length} method record{allActivities.length === 1 ? '' : 's'}</p>
      </header>
      {challengeFields.length > 0 && (
        <section className="iteration-report__brief">
          <h2>Challenge and brief</h2>
          <dl className="iteration-report__fields">
            {challengeFields.map((field) => (
              <div className="iteration-report__field" key={`${field.activityKey}:${field.id}`}>
                <dt>{field.label}<span> · {field.method}</span></dt>
                <dd>{field.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {!allActivities.length && <p className="iteration-report__empty">No saved method revisions are available for this selection.</p>}
      {groups.map((group) => {
        const completed = group.activities.filter((item) => item.revision.status === 'closed');
        return (
          <section className="iteration-report__iteration" key={group.id}>
            <header className="iteration-report__iteration-heading">
              <div><p className="iteration-report__eyebrow">Iteration</p><h2>{group.id}</h2></div>
              <p>{completed.length} method{completed.length === 1 ? '' : 's'} with status “Closed” · {group.activities.length} recorded</p>
            </header>
            <div className="iteration-report__method-list">
              {group.activities.map((item) => <MethodCard key={item.state.activityId} item={item} />)}
            </div>
          </section>
        );
      })}
      <footer className="iteration-report__limits">
        <h2>Record scope and data limits</h2>
        <p>This report is generated from the workspace data supplied by this browser. The current implementation stores workspace records locally; it does not indicate that a server or other team members have received these changes. It shows each activity’s current saved revision and its recorded fields and contributions. Board drawings, attached media, event history, and unsaved edits are not reproduced here. A method is described as closed only when its saved revision status is “closed”; other statuses are shown as recorded.</p>
        <p>Keep the source workspace available if you need to inspect material outside this report.</p>
      </footer>
    </main>
  );
}

export default IterationReport;
