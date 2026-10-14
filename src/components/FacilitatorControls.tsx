import { useEffect, useMemo, useState } from "react";
import { EMPATHY_MAP_BLUEPRINT } from "../data/empathy-map-blueprint";
import type { ActivityBlueprintDefinition } from "../domain/blueprint-model";
import "../facilitator-controls.css";

export type FacilitationPhase = "setup" | "active" | "review";
export type FacilitationTimerStatus = "idle" | "running" | "paused" | "finished";

export interface FacilitationTimerState {
  minutes: number;
  remainingSeconds: number;
  status: FacilitationTimerStatus;
}

export interface GuidedPromptState {
  regionId: string | null;
  index: number | null;
  total: number;
}

export interface FacilitatorControlsProps {
  blueprint?: ActivityBlueprintDefinition;
  phase?: FacilitationPhase;
  initialTimerMinutes?: number;
  initialRegionLocks?: Readonly<Record<string, boolean>>;
  initialPromptIndex?: number | null;
  initialReviewMode?: boolean;
  disabled?: boolean;
  onTimerChange?: (timer: FacilitationTimerState) => void;
  onPromptChange?: (prompt: GuidedPromptState) => void;
  onRegionLockChange?: (regionId: string, locked: boolean) => void;
  onReviewModeChange?: (enabled: boolean) => void;
  onComplete: () => void;
}

function getControl(blueprint: ActivityBlueprintDefinition, id: string) {
  const control = blueprint.facilitatorControls.find((item) => item.id === id);
  if (!control) throw new Error(`Missing facilitator control: ${id}`);
  return control;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function FacilitatorControls({
  blueprint = EMPATHY_MAP_BLUEPRINT,
  phase = "active",
  initialTimerMinutes = 5,
  initialRegionLocks = {},
  initialPromptIndex = null,
  initialReviewMode = false,
  disabled = false,
  onTimerChange,
  onPromptChange,
  onRegionLockChange,
  onReviewModeChange,
  onComplete,
}: FacilitatorControlsProps) {
  const TIMER_CONTROL = getControl(blueprint, "round-timer");
  const LOCK_CONTROL = getControl(blueprint, "region-locks");
  const PROMPT_CONTROL = getControl(blueprint, "guided-prompts");
  const REVIEW_CONTROL = getControl(blueprint, "review-mode");
  const COMPLETE_CONTROL = getControl(blueprint, "complete-method");
  const timerOptions = useMemo(
    () =>
      (TIMER_CONTROL.options ?? [])
        .filter((option) => typeof option.value === "number")
        .map((option) => ({ id: option.id, label: option.label, minutes: option.value as number })),
    [],
  );
  const safeInitialMinutes = timerOptions.some((option) => option.minutes === initialTimerMinutes)
    ? initialTimerMinutes
    : (timerOptions[0]?.minutes ?? 5);
  const [timerMinutes, setTimerMinutes] = useState(safeInitialMinutes);
  const [remainingSeconds, setRemainingSeconds] = useState(safeInitialMinutes * 60);
  const [timerStatus, setTimerStatus] = useState<FacilitationTimerStatus>("idle");
  const [promptIndex, setPromptIndex] = useState<number | null>(initialPromptIndex);
  const [regionLocks, setRegionLocks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(blueprint.regions.map((region) => [region.id, Boolean(initialRegionLocks[region.id])])),
  );
  const [reviewMode, setReviewMode] = useState(initialReviewMode || phase === "review");

  const timerAvailable = TIMER_CONTROL.availableInStates.includes(phase);
  const promptsAvailable = PROMPT_CONTROL.availableInStates.includes(phase);
  const locksAvailable = LOCK_CONTROL.availableInStates.includes(phase);
  const reviewAvailable = REVIEW_CONTROL.availableInStates.includes(phase);
  const completionAvailable = COMPLETE_CONTROL.availableInStates.includes(phase) || reviewMode;
  const activePrompt = promptIndex === null ? null : blueprint.regions[promptIndex];

  useEffect(() => {
    if (timerStatus !== "running") return;
    const interval = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          setTimerStatus("finished");
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerStatus]);

  useEffect(() => {
    onTimerChange?.({ minutes: timerMinutes, remainingSeconds, status: timerStatus });
  }, [onTimerChange, remainingSeconds, timerMinutes, timerStatus]);

  function selectTimer(minutes: number) {
    setTimerMinutes(minutes);
    setRemainingSeconds(minutes * 60);
    setTimerStatus("idle");
  }

  function startTimer() {
    if (remainingSeconds === 0) setRemainingSeconds(timerMinutes * 60);
    setTimerStatus("running");
  }

  function resetTimer() {
    setRemainingSeconds(timerMinutes * 60);
    setTimerStatus("idle");
  }

  function selectPrompt(nextIndex: number | null) {
    setPromptIndex(nextIndex);
    const region = nextIndex === null ? null : blueprint.regions[nextIndex];
    onPromptChange?.({ regionId: region?.id ?? null, index: nextIndex, total: blueprint.regions.length });
  }

  function toggleRegion(regionId: string) {
    const locked = !regionLocks[regionId];
    setRegionLocks((current) => ({ ...current, [regionId]: locked }));
    onRegionLockChange?.(regionId, locked);
  }

  function toggleReviewMode() {
    const enabled = !reviewMode;
    setReviewMode(enabled);
    onReviewModeChange?.(enabled);
  }

  return (
    <aside className="facilitator-controls" aria-label={`${blueprint.name} facilitator controls`}>
      <header className="facilitator-controls__header">
        <div>
          <span className="facilitator-controls__eyebrow">Facilitator controls</span>
          <h2>{blueprint.name}</h2>
        </div>
        <span className={`facilitator-controls__phase facilitator-controls__phase--${phase}`}>{phase}</span>
      </header>

      <section className="facilitator-control" aria-labelledby="facilitator-timer-heading">
        <div className="facilitator-control__heading">
          <div>
            <h3 id="facilitator-timer-heading">{TIMER_CONTROL.label}</h3>
            <p>{TIMER_CONTROL.description}</p>
          </div>
          <output className={`facilitator-timer facilitator-timer--${timerStatus}`} aria-live="polite">
            {formatDuration(remainingSeconds)}
          </output>
        </div>
        <div className="facilitator-segmented" aria-label="Timer duration">
          {timerOptions.map((option) => (
            <button
              type="button"
              className={timerMinutes === option.minutes ? "is-active" : ""}
              aria-pressed={timerMinutes === option.minutes}
              disabled={disabled || !timerAvailable || timerStatus === "running"}
              key={option.id}
              onClick={() => selectTimer(option.minutes)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="facilitator-actions">
          {timerStatus === "running" ? (
            <button type="button" className="facilitator-button facilitator-button--primary" disabled={disabled || !timerAvailable} onClick={() => setTimerStatus("paused")}>
              Pause
            </button>
          ) : (
            <button type="button" className="facilitator-button facilitator-button--primary" disabled={disabled || !timerAvailable} onClick={startTimer}>
              {timerStatus === "paused" ? "Resume" : timerStatus === "finished" ? "Start again" : "Start timer"}
            </button>
          )}
          <button type="button" className="facilitator-button" disabled={disabled || !timerAvailable} onClick={resetTimer}>Reset</button>
        </div>
      </section>

      <section className="facilitator-control" aria-labelledby="facilitator-prompt-heading">
        <div className="facilitator-control__heading">
          <div>
            <h3 id="facilitator-prompt-heading">{PROMPT_CONTROL.label}</h3>
            <p>{PROMPT_CONTROL.description}</p>
          </div>
          <span className="facilitator-control__count">
            {promptIndex === null ? "Off" : `${promptIndex + 1}/${blueprint.regions.length}`}
          </span>
        </div>
        {activePrompt ? (
          <div className={`facilitator-prompt facilitator-prompt--${activePrompt.accent}`} aria-live="polite">
            <strong>{activePrompt.label}</strong>
            <p>{activePrompt.contributionPrompt}</p>
          </div>
        ) : (
          <p className="facilitator-control__empty">Start the guide to reveal one contribution prompt at a time.</p>
        )}
        <div className="facilitator-actions facilitator-actions--spread">
          <button
            type="button"
            className="facilitator-button"
            disabled={disabled || !promptsAvailable || promptIndex === null || promptIndex === 0}
            onClick={() => selectPrompt((promptIndex ?? 1) - 1)}
          >
            Previous
          </button>
          {promptIndex === null ? (
            <button type="button" className="facilitator-button facilitator-button--primary" disabled={disabled || !promptsAvailable} onClick={() => selectPrompt(0)}>Start guide</button>
          ) : promptIndex < blueprint.regions.length - 1 ? (
            <button type="button" className="facilitator-button facilitator-button--primary" disabled={disabled || !promptsAvailable} onClick={() => selectPrompt(promptIndex + 1)}>Next prompt</button>
          ) : (
            <button type="button" className="facilitator-button facilitator-button--primary" disabled={disabled || !promptsAvailable} onClick={() => selectPrompt(null)}>Finish guide</button>
          )}
        </div>
      </section>

      <section className="facilitator-control" aria-labelledby="facilitator-lock-heading">
        <div className="facilitator-control__heading">
          <div>
            <h3 id="facilitator-lock-heading">{LOCK_CONTROL.label}</h3>
            <p>{LOCK_CONTROL.description}</p>
          </div>
        </div>
        <div className="facilitator-region-locks">
          {blueprint.regions.map((region) => {
            const locked = regionLocks[region.id];
            return (
              <button
                type="button"
                className={locked ? "is-locked" : "is-open"}
                aria-pressed={locked}
                disabled={disabled || !locksAvailable}
                key={region.id}
                onClick={() => toggleRegion(region.id)}
              >
                <span>{region.label}</span>
                <small>{locked ? "Closed" : "Open"}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="facilitator-control facilitator-control--review" aria-labelledby="facilitator-review-heading">
        <div className="facilitator-control__heading">
          <div>
            <h3 id="facilitator-review-heading">{REVIEW_CONTROL.label}</h3>
            <p>{REVIEW_CONTROL.description}</p>
          </div>
        </div>
        <button
          type="button"
          className={`facilitator-review-toggle ${reviewMode ? "is-active" : ""}`}
          aria-pressed={reviewMode}
          disabled={disabled || !reviewAvailable}
          onClick={toggleReviewMode}
        >
          <span aria-hidden="true">{reviewMode ? "✓" : "○"}</span>
          {reviewMode ? "Review mode is on" : "Enter review mode"}
        </button>
      </section>

      <footer className="facilitator-controls__footer">
        <p>{COMPLETE_CONTROL.description}</p>
        <button
          type="button"
          className="facilitator-complete-button"
          disabled={disabled || !completionAvailable}
          onClick={onComplete}
        >
          {COMPLETE_CONTROL.label}
        </button>
        {!completionAvailable && <small>Enter team review before completing this method.</small>}
      </footer>
    </aside>
  );
}

export default FacilitatorControls;
