import { useMemo, useState } from "react";
import type {
  ActorReference,
  JsonValue,
  SemanticEvent,
  SemanticEventType,
} from "../domain/workspace-persistence";
import "../activity-history.css";

export interface ActivityHistoryProps {
  events: readonly SemanticEvent[];
  /** Optional roster includes people who have not produced an event yet. */
  actors?: readonly ActorReference[];
  title?: string;
  className?: string;
}

const EVENT_LABELS: Record<SemanticEventType, string> = {
  "element-created": "Created an element",
  "element-deleted": "Deleted an element",
  "content-edited": "Edited content",
  "style-changed": "Changed styling",
  "element-moved": "Moved an element",
  "elements-grouped": "Grouped elements",
  "elements-ungrouped": "Ungrouped elements",
  "elements-connected": "Connected elements",
  "vote-cast": "Cast a vote",
  "vote-retracted": "Retracted a vote",
  "output-carried-forward": "Carried outputs forward",
  "layout-migrated": "Applied a board layout update",
  "contribution-submitted": "Added a contribution",
  "contribution-updated": "Updated a contribution",
  "blueprint-version-created": "Published a blueprint version",
  "activity-step-changed": "Changed the activity step",
  "checkpoint-saved": "Saved a checkpoint",
  "iteration-status-changed": "Changed the iteration status",
};

const EVENT_TONES: Partial<Record<SemanticEventType, string>> = {
  "contribution-submitted": "create",
  "element-created": "create",
  "vote-cast": "decision",
  "checkpoint-saved": "checkpoint",
  "blueprint-version-created": "structure",
  "iteration-status-changed": "structure",
  "element-deleted": "remove",
  "vote-retracted": "remove",
  "output-carried-forward": "decision",
  "layout-migrated": "structure",
};

function isString(value: JsonValue | undefined): value is string {
  return typeof value === "string";
}

function titleCase(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(actor: ActorReference) {
  const value = actor.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return value || "?";
}

function eventDetail(event: SemanticEvent): string | undefined {
  const { payload } = event;
  const action = isString(payload.action) ? payload.action : undefined;
  const region = isString(payload.region) ? payload.region : undefined;
  const from = isString(payload.from) ? payload.from : undefined;
  const to = isString(payload.to) ? payload.to : undefined;

  if (event.type === "contribution-submitted" && region) return `Added to ${titleCase(region)}`;
  if (event.type === "contribution-updated" && action === "content-edited") return "Changed the contribution text";
  if (event.type === "contribution-updated" && action === "region-changed" && to) {
    return `Moved from ${titleCase(from ?? "another region")} to ${titleCase(to)}`;
  }
  if (event.type === "contribution-updated" && action === "deleted") return "Removed a contribution from the activity";

  const label = ["label", "checkpointLabel", "changeNote", "step", "status", "region", "targetMethod"]
    .map((key) => payload[key])
    .find(isString);
  if (label) return titleCase(label);

  if (event.targetIds.length > 1) return `${event.targetIds.length} items affected`;
  return undefined;
}

function dayKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const difference = Math.round((todayStart - dateStart) / 86_400_000);
  if (difference === 0) return "Today";
  if (difference === 1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fullDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function uniqueActors(events: readonly SemanticEvent[], roster: readonly ActorReference[]) {
  const actors = new Map<string, ActorReference>();
  roster.forEach((actor) => actors.set(actor.id, actor));
  events.forEach((event) => {
    if (!actors.has(event.actor.id)) actors.set(event.actor.id, event.actor);
  });
  return [...actors.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function ActivityHistory({
  events,
  actors = [],
  title = "Activity history",
  className = "",
}: ActivityHistoryProps) {
  const [actorFilter, setActorFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<SemanticEventType | "all">("all");

  const availableActors = useMemo(() => uniqueActors(events, actors), [events, actors]);
  const availableTypes = useMemo(
    () => [...new Set(events.map((event) => event.type))].sort((a, b) => EVENT_LABELS[a].localeCompare(EVENT_LABELS[b])),
    [events],
  );
  const filteredEvents = useMemo(
    () => events
      .filter((event) => actorFilter === "all" || event.actor.id === actorFilter)
      .filter((event) => typeFilter === "all" || event.type === typeFilter)
      .slice()
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)),
    [events, actorFilter, typeFilter],
  );
  const groups = useMemo(() => {
    const grouped = new Map<string, SemanticEvent[]>();
    filteredEvents.forEach((event) => {
      const key = dayKey(event.occurredAt);
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    });
    return [...grouped.entries()];
  }, [filteredEvents]);

  const filtersActive = actorFilter !== "all" || typeFilter !== "all";

  return (
    <section className={`activity-history ${className}`.trim()} aria-labelledby="activity-history-title">
      <header className="activity-history__header">
        <div>
          <span className="activity-history__kicker">Iteration record</span>
          <h2 id="activity-history-title">{title}</h2>
        </div>
        <span className="activity-history__total" aria-live="polite">
          {filteredEvents.length} {filteredEvents.length === 1 ? "action" : "actions"}
        </span>
      </header>

      <div className="activity-history__filters" aria-label="Filter activity history">
        <label>
          <span>Person</span>
          <select value={actorFilter} onChange={(event) => setActorFilter(event.target.value)}>
            <option value="all">Everyone</option>
            {availableActors.map((actor) => (
              <option value={actor.id} key={actor.id}>{actor.displayName} · {titleCase(actor.role)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Action</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as SemanticEventType | "all")}
          >
            <option value="all">All actions</option>
            {availableTypes.map((type) => <option value={type} key={type}>{EVENT_LABELS[type]}</option>)}
          </select>
        </label>
        {filtersActive && (
          <button
            type="button"
            className="activity-history__clear"
            onClick={() => {
              setActorFilter("all");
              setTypeFilter("all");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="activity-history__empty" role="status">
          <span aria-hidden="true">◎</span>
          <strong>{events.length === 0 ? "No activity yet" : "No matching actions"}</strong>
          <p>{events.length === 0
            ? "Meaningful contributions, decisions, and framework changes will appear here."
            : "Change or clear the filters to see more of this iteration."}</p>
          {filtersActive && <button type="button" onClick={() => { setActorFilter("all"); setTypeFilter("all"); }}>Show all actions</button>}
        </div>
      ) : (
        <div className="activity-history__groups">
          {groups.map(([key, dayEvents]) => (
            <section className="activity-history__day" key={key} aria-labelledby={`history-day-${key}`}>
              <h3 id={`history-day-${key}`}>{dayLabel(dayEvents[0].occurredAt)}</h3>
              <ol>
                {dayEvents.map((event) => {
                  const detail = eventDetail(event);
                  const count = event.coalescedCount ?? 1;
                  return (
                    <li className={`activity-history__event activity-history__event--${EVENT_TONES[event.type] ?? "default"}`} key={event.id}>
                      <span className="activity-history__avatar" aria-hidden="true">{initials(event.actor)}</span>
                      <div className="activity-history__event-body">
                        <div className="activity-history__event-heading">
                          <p><strong>{event.actor.displayName}</strong> {EVENT_LABELS[event.type].toLocaleLowerCase()}</p>
                          {count > 1 && <span className="activity-history__count" aria-label={`${count} changes combined`}>×{count}</span>}
                        </div>
                        {detail && <p className="activity-history__detail">{detail}</p>}
                        <div className="activity-history__meta">
                          <span>{titleCase(event.actor.role)}</span>
                          <span aria-hidden="true">·</span>
                          <time dateTime={event.occurredAt} title={fullDateLabel(event.occurredAt)}>{timeLabel(event.occurredAt)}</time>
                          {event.firstOccurredAt && count > 1 && <span>combined over one action</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

export default ActivityHistory;
