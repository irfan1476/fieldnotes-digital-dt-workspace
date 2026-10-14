import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import {
  buildDemoJoinUrl,
  closeLocalIteration,
  createLocalIterationWorkspace,
  readLocalIterationWorkspace,
  reopenLocalIteration,
  saveLocalIterationCheckpoint,
  saveLocalIterationWorkspace,
  selectLocalIteration,
  startLocalSuccessorIteration,
  updateLocalParticipantName,
  type LocalIterationWorkspace,
} from '../domain/local-iteration-shell';
import {
  createLocalWorkspaceBundle,
  downloadLocalWorkspaceBundle,
  importLocalWorkspaceBundle,
  parseLocalWorkspaceBundle,
} from '../domain/local-workspace-bundle';
import { DEFAULT_WORKSPACE_STORAGE_KEY, loadWorkspace } from '../domain/workspace-persistence';
import { readLocalRoomSession } from '../domain/local-room-session';
import '../local-iteration-shell.css';

export interface LocalIterationShellProps {
  /** Stable local workspace key; does not confer membership or remote access. */
  workspaceId: string;
  /** Existing activity identifier to associate with a newly started iteration. */
  activeActivityId: string;
  initialIterationId?: string;
  initialDisplayName?: string;
  /** Defaults to the current page URL and is used only to create a demo link. */
  baseUrl?: string;
  onActiveIterationChange?: (iterationId: string) => void;
  onParticipantNameChange?: (displayName: string) => void;
  className?: string;
}

function currentBaseUrl(override?: string): string {
  if (override) return override;
  if (typeof window !== 'undefined') return window.location.href;
  return 'http://localhost/';
}

function workspaceStorageKeyForIteration(iterationId?: string): string {
  if (!iterationId || iterationId === 'design-iteration-01') return DEFAULT_WORKSPACE_STORAGE_KEY;
  return `${DEFAULT_WORKSPACE_STORAGE_KEY}:${encodeURIComponent(iterationId)}`;
}

function currentRoomId(workspaceId: string): string {
  if (typeof window !== 'undefined') {
    const room = new URLSearchParams(window.location.search).get('room')?.trim();
    if (room) return room;
  }
  return `room:${workspaceId}`;
}

export function LocalIterationShell({
  workspaceId,
  activeActivityId,
  initialIterationId,
  initialDisplayName = 'Local participant',
  baseUrl,
  onActiveIterationChange,
  onParticipantNameChange,
  className = '',
}: LocalIterationShellProps) {
  const idPrefix = useId().replace(/:/g, '');
  const titleId = `${idPrefix}-iteration-title`;
  const nameId = `${idPrefix}-iteration-name`;
  const historyTitleId = `${idPrefix}-iteration-history-title`;
  const objectiveId = `${idPrefix}-iteration-objective`;
  const [workspace, setWorkspace] = useState<LocalIterationWorkspace>();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [objective, setObjective] = useState('');
  const [checkpointLabel, setCheckpointLabel] = useState('');
  const [feedback, setFeedback] = useState('');
  const [bundleBusy, setBundleBusy] = useState(false);

  useEffect(() => {
    const existing = readLocalIterationWorkspace(workspaceId);
    const next = existing
      ? initialIterationId ? selectLocalIteration(existing, initialIterationId) : existing
      : createLocalIterationWorkspace({
      workspaceId,
      activeActivityId,
      displayName: initialDisplayName,
      initialIterationId,
    });
    setWorkspace(next);
    const active = next.iterations.find((item) => item.id === next.activeIterationId);
    const name = active?.participants[0]?.displayName ?? initialDisplayName;
    setDisplayName(name);
    if (!existing || next.activeIterationId !== existing.activeIterationId) saveLocalIterationWorkspace(next);
    onParticipantNameChange?.(name);
    onActiveIterationChange?.(next.activeIterationId);
  }, [workspaceId, initialIterationId]);

  const activeIteration = useMemo(
    () => workspace?.iterations.find((item) => item.id === workspace.activeIterationId),
    [workspace],
  );

  function commit(next: LocalIterationWorkspace, message?: string) {
    setWorkspace(next);
    const result = saveLocalIterationWorkspace(next);
    setFeedback(result.ok ? (message ?? 'Saved in this browser.') : result.message);
    onActiveIterationChange?.(next.activeIterationId);
  }

  function saveName() {
    if (!workspace || !displayName.trim()) {
      setFeedback('Enter a display name to continue.');
      return;
    }
    commit(updateLocalParticipantName(workspace, displayName), 'Display name saved in this browser.');
    onParticipantNameChange?.(displayName.trim().replace(/\s+/g, ' ').slice(0, 60));
  }

  function startIteration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspace) return;
    const next = startLocalSuccessorIteration(workspace, {
      activeActivityId,
      objective,
      displayName,
    });
    setObjective('');
    commit(next, 'New local iteration started. Existing activity and checkpoint records remain unchanged.');
  }

  function closeIteration() {
    if (!workspace || !activeIteration || activeIteration.status === 'closed') return;
    commit(closeLocalIteration(workspace, { displayName }), 'Iteration closed as an immutable local record. Start a successor to continue working.');
  }

  function reopenIteration() {
    if (!workspace || !activeIteration || activeIteration.status !== 'closed') return;
    const next = reopenLocalIteration(workspace, { displayName, activeActivityId, iterationId: activeIteration.id });
    commit(next, 'Iteration reopened as a new successor. The closed predecessor remains unchanged.');
  }

  function saveCheckpoint() {
    if (!workspace || !activeIteration || activeIteration.status === 'closed') return;
    const label = checkpointLabel.trim() || `Iteration ${activeIteration.number} checkpoint ${activeIteration.recordVersion}`;
    commit(saveLocalIterationCheckpoint(workspace, { label, displayName }), `Saved ${label}.`);
    setCheckpointLabel('');
  }

  async function copyJoinUrl() {
    if (!activeIteration) return;
    const value = buildDemoJoinUrl(currentBaseUrl(baseUrl), activeIteration.id, displayName);
    try {
      await navigator.clipboard.writeText(value);
      setFeedback('Demo URL copied. It does not grant access or synchronize this workspace.');
    } catch {
      setFeedback(value);
    }
  }

  function exportWorkspaceBundle() {
    if (!workspace || !activeIteration) return;
    const storageKey = workspaceStorageKeyForIteration(activeIteration.id);
    const board = loadWorkspace(storageKey, workspaceId, false).document;
    const room = readLocalRoomSession(currentRoomId(workspaceId));
    const bundle = createLocalWorkspaceBundle({
      workspaceId,
      workspaceStorageKey: storageKey,
      activityId: activeIteration.activeActivityId,
      iterationId: activeIteration.id,
      workspaceDocument: board,
      iterationWorkspace: workspace,
      roomSession: room,
    });
    const safeName = `${workspaceId}-${activeIteration.id}`.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'workspace';
    const downloaded = downloadLocalWorkspaceBundle(bundle, `fieldnotes-${safeName}.json`);
    setFeedback(downloaded
      ? 'Workspace bundle downloaded. It is a file transfer for this local prototype, not realtime sync.'
      : 'The workspace bundle could not be downloaded in this browser.');
  }

  async function importWorkspaceBundle(file: File) {
    setBundleBusy(true);
    try {
      const parsed = parseLocalWorkspaceBundle(await file.text());
      if (!parsed.ok) {
        setFeedback(parsed.error);
        return;
      }
      const activeId = activeIteration?.id;
      const result = importLocalWorkspaceBundle(parsed.bundle, {
        workspaceId,
        workspaceStorageKey: workspaceStorageKeyForIteration(activeId),
      });
      if (!result.ok) {
        setFeedback(result.warnings.join(' ') || 'The workspace bundle could not be imported.');
        return;
      }
      const warning = result.warnings.length ? ` ${result.warnings.join(' ')}` : '';
      setFeedback(`Imported ${result.imported.join(', ')}.${warning} Reloading this local workspace…`);
      window.setTimeout(() => window.location.reload(), 350);
    } catch {
      setFeedback('The selected workspace bundle could not be read.');
    } finally {
      setBundleBusy(false);
    }
  }

  if (!workspace || !activeIteration) return <section className={`local-iteration-shell ${className}`}>Loading local iteration…</section>;

  return (
    <section className={`local-iteration-shell ${className}`} aria-labelledby={titleId}>
      <header className="local-iteration-shell__header">
        <div>
          <span className="local-iteration-shell__eyebrow">Workshop session</span>
          <h2 id={titleId}>Iteration {activeIteration.number}</h2>
        </div>
        <span className={`local-iteration-shell__status local-iteration-shell__status--${activeIteration.status}`}><i aria-hidden="true" /> {activeIteration.status === 'closed' ? 'Closed locally' : 'Working locally'}</span>
      </header>

      <p className="local-iteration-shell__notice">This iteration is saved in this browser. The demo join URL is a bookmark only; it does not authenticate people, authorize access, or sync data.</p>

      <div className="local-iteration-shell__identity">
        <label htmlFor={nameId}>Your display name</label>
        <div className="local-iteration-shell__inline-form">
          <input id={nameId} value={displayName} maxLength={60} onChange={(event) => setDisplayName(event.target.value)} onBlur={saveName} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveName(); } }} />
          <button type="button" onClick={saveName}>Save name</button>
        </div>
        <small>Used to label your contributions in this local prototype.</small>
      </div>

      <div className="local-iteration-shell__summary">
        <span>Started {new Date(activeIteration.startedAt).toLocaleString()}</span>
        <span>Record v{activeIteration.recordVersion}</span>
        <span>{activeIteration.participants.length} local participant</span>
      </div>

      <div className="local-iteration-shell__lifecycle" aria-label="Iteration lifecycle controls">
        {activeIteration.status === 'closed' ? <button type="button" onClick={reopenIteration}>Reopen as successor</button> : <>
          <div className="local-iteration-shell__checkpoint-row"><input aria-label="Checkpoint label" value={checkpointLabel} maxLength={80} onChange={(event) => setCheckpointLabel(event.target.value)} placeholder={`Checkpoint ${activeIteration.recordVersion}`} /><button type="button" onClick={saveCheckpoint}>Save checkpoint</button></div>
          <button type="button" className="is-secondary" onClick={closeIteration}>Close iteration</button>
        </>}
      </div>

      {workspace.iterations.length > 1 && <section className="local-iteration-shell__history" aria-labelledby={historyTitleId}>
        <h3 id={historyTitleId}>Iterations in this browser</h3>
        <div>{[...workspace.iterations].sort((left, right) => right.number - left.number).map((iteration) => <button key={iteration.id} type="button" className={iteration.id === activeIteration.id ? 'is-active' : ''} disabled={iteration.id === activeIteration.id} onClick={() => commit(selectLocalIteration(workspace, iteration.id), `Opened local iteration ${iteration.number}.`)}><span>Iteration {iteration.number}</span><small>{iteration.objective || 'No objective recorded'}</small></button>)}</div>
      </section>}

      <form className="local-iteration-shell__start" onSubmit={startIteration}>
        <label htmlFor={objectiveId}>Next iteration objective <span>optional</span></label>
        <textarea id={objectiveId} rows={2} maxLength={240} value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="What will the team explore next?" />
        <button type="submit">Start iteration {workspace.iterations.length + 1}</button>
      </form>

      <section className="local-iteration-shell__bundle" aria-labelledby={`${idPrefix}-bundle-title`}>
        <div>
          <h3 id={`${idPrefix}-bundle-title`}>Portable workspace file</h3>
          <p>Move this board, iteration history, and current room context to another browser. This is an explicit file transfer; it does not create a shared room or synchronize edits.</p>
        </div>
        <div className="local-iteration-shell__bundle-actions">
          <button type="button" onClick={exportWorkspaceBundle}>Export workspace</button>
          <label className="local-iteration-shell__import">
            <span>{bundleBusy ? 'Reading bundle…' : 'Import workspace'}</span>
            <input type="file" accept="application/json,.json" disabled={bundleBusy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importWorkspaceBundle(file); }} />
          </label>
        </div>
      </section>

      <button type="button" className="local-iteration-shell__copy" onClick={copyJoinUrl}>Copy demo join URL</button>
      {feedback && <p className="local-iteration-shell__feedback" role="status">{feedback}</p>}
    </section>
  );
}

export default LocalIterationShell;
