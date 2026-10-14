import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { ParticipateView } from "./components/ParticipateView";
import type { EmpathyContribution, EmpathyRegion, MobileWorkspaceView, NewContributionInput } from "./components/ParticipateView";
import { FacilitatorControls } from "./components/FacilitatorControls";
import { ActivityHistory } from "./components/ActivityHistory";
import { MethodParticipateView } from "./components/MethodParticipateView";
import { DotVotingPanel } from "./components/DotVotingPanel";
import type { VoteLedger, VoteRoundState } from "./components/DotVotingPanel";
import { CarryForwardPanel } from "./components/CarryForwardPanel";
import { ToolChooser } from "./components/ToolChooser";
import { LocalIterationShell } from "./components/LocalIterationShell";
import { LocalRoomSessionPanel } from "./components/LocalRoomSessionPanel";
import { IterationReport } from "./components/IterationReport";
import { ACTIVITY_TEMPLATES, STAGES, templatesForStage } from "./data/activity-templates";
import { IMPLEMENTED_METHOD_IDS, METHOD_BLUEPRINTS } from "./data/method-blueprints";
import type { TemplateField } from "./domain/activity-model";
import { addEventToActivity, appendCheckpoint, createActivityState, createSemanticEvent, DEFAULT_WORKSPACE_STORAGE_KEY, getCurrentRevision, loadWorkspace, restoreCheckpointAsRevision, saveWorkspace } from "./domain/workspace-persistence";
import type { ActorReference, Contribution, JsonObject, SemanticEvent, SemanticEventType, WorkspaceActivityState, WorkspaceDocument } from "./domain/workspace-persistence";
import { validateDotVotingCompletion } from "./domain/dot-voting-rules";
import { copySelectedContributions } from "./domain/carry-forward";
import { deriveBoardEvents } from "./domain/board-events";
import { readLocalIterationWorkspace } from "./domain/local-iteration-shell";
import { WebSocketCollaborationTransport } from "./domain/collaboration-client";
import { createRequestId, type CollaborationConnectionState } from "./domain/collaboration-protocol";
import { createCapabilityToken, redeemRemoteInvite, remoteSocketUrl } from "./domain/remote-room-service";
import "./canvas.css";
import "./responsive.css";
import "./fieldnotes-shell.css";

const requestedActivityId = typeof window === "undefined" ? "empathy-map" : new URLSearchParams(window.location.search).get("activity");
const ACTIVITY_ID = requestedActivityId && IMPLEMENTED_METHOD_IDS.includes(requestedActivityId) ? requestedActivityId : "empathy-map";
const launchParams = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
const launchInviteToken = typeof window === "undefined" ? "" : new URLSearchParams(window.location.hash.slice(1)).get("invite")?.trim() || "";
async function inviteRedemptionStorageKey(roomId: string, inviteToken: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inviteToken));
  const suffix = Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, "0")).join("");
  return `fieldnotes:invite-redemption:${roomId}:${suffix}`;
}
// Start every page load in the clean Board layout. Panel state is intentionally
// session-only so a refresh cannot reopen a drawer over the workspace.
const initialSidebarState = () => true;
const DEFAULT_ITERATION_ID = "design-iteration-01";
const LOCAL_WORKSPACE_ID = "local-workspace";
const DESIGN_ITERATION_ID = launchParams.get("iteration") || launchParams.get("demoIteration") || DEFAULT_ITERATION_ID;
const ROOM_ID = launchParams.get("room") ?? `room:${LOCAL_WORKSPACE_ID}`;
const WORKSPACE_ID = launchParams.has("room") ? `${LOCAL_WORKSPACE_ID}:${encodeURIComponent(ROOM_ID)}` : LOCAL_WORKSPACE_ID;
const WORKSPACE_STORAGE_KEY = `${DESIGN_ITERATION_ID === DEFAULT_ITERATION_ID
  ? DEFAULT_WORKSPACE_STORAGE_KEY
  : `${DEFAULT_WORKSPACE_STORAGE_KEY}:${encodeURIComponent(DESIGN_ITERATION_ID)}`}${launchParams.has("room") ? `:room:${encodeURIComponent(ROOM_ID)}` : ""}`;
const savedIterationWorkspace = readLocalIterationWorkspace(WORKSPACE_ID);
const savedIteration = savedIterationWorkspace?.iterations.find((iteration) => iteration.id === DESIGN_ITERATION_ID);
const INITIAL_DISPLAY_NAME = launchParams.get("demoParticipant") || savedIteration?.participants[0]?.displayName || "Irfan";
const DESIGN_ITERATION_NUMBER = savedIteration?.number ?? 1;
const IMPLEMENTED_TEMPLATES = ACTIVITY_TEMPLATES.filter((template) => IMPLEMENTED_METHOD_IDS.includes(template.id));
const activeTemplate = IMPLEMENTED_TEMPLATES.find((template) => template.id === ACTIVITY_ID)!;
const activeBlueprint = METHOD_BLUEPRINTS[ACTIVITY_ID];
const activeStage = activeTemplate.stage;
const stageMethods = templatesForStage(activeStage).filter((template) => IMPLEMENTED_METHOD_IDS.includes(template.id));
const activityHref = (methodId: string) => {
  const params = new URLSearchParams(launchParams);
  params.set("activity", methodId);
  return `?${params.toString()}`;
};
const STAGE_STARTER_METHOD_IDS: Record<string, string> = {
  understand: "problem-statement",
  observe: "empathy-map",
  "define-point-of-view": "insight-cards",
  ideate: "brainwriting",
  prototype: "storyboard-prototype",
  test: "testing-sheet",
  reflect: "reflection",
};
const LOCAL_ACTOR: ActorReference = { id: "irfan", displayName: INITIAL_DISPLAY_NAME, role: "participant" };
const FACILITATOR_ACTOR: ActorReference = { ...LOCAL_ACTOR, role: "facilitator" };
const initialsForName = (name: string) => name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "LP";
const currentUser = { id: LOCAL_ACTOR.id, name: LOCAL_ACTOR.displayName, initials: initialsForName(LOCAL_ACTOR.displayName), color: "#2e80d9" };
const ExcalidrawCanvas = lazy(async () => {
  const module = await import("@excalidraw/excalidraw");
  return { default: module.Excalidraw };
});

type BoardElement = any;
type SavedBoard = { elements: readonly BoardElement[]; appState?: Partial<AppState>; files?: BinaryFiles; fields?: Record<string, string> };
const LOCKED_REGIONS_FIELD = "__facilitation_locked_regions";
const GUIDED_REGION_FIELD = "__facilitation_guided_region";
const VOTE_ROUND_STATE_FIELD = "__vote_round_state";
const VOTE_LEDGER_FIELD = "__vote_ledger";
const VOTE_TIE_RESOLUTION_FIELD = "__vote_tie_resolution";
const BOARD_LAYOUT_VERSION_FIELD = "__board_layout_version";
const RESIZE_SPACES_FIELD = "__resize_spaces_mode";
const CURRENT_BOARD_LAYOUT_VERSION = "v2";

type WorkspaceRole = "facilitator" | "participant" | "observer";
type WorkspaceView = MobileWorkspaceView | "facilitate" | "toolkit" | "iteration" | "report";

const empathyBlueprintToRegion: Record<string, EmpathyRegion> = {
  says: "say",
  does: "do",
  "thinks-feels": "think",
  "needs-questions": "feel",
};

const historyActors: ActorReference[] = [
  FACILITATOR_ACTOR,
  { id: "maya", displayName: "Maya", role: "participant" },
  { id: "jon", displayName: "Jon", role: "observer" },
];

function FieldNotesMark() {
  return <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="16" fill="#202a3a"/><path d="M18 13h21l9 9v29H18z" fill="#fff"/><path d="M39 13v9h9" fill="#c8d9f4"/><path d="M24 30h17M24 36h17M24 42h11" fill="none" stroke="#202a3a" strokeLinecap="round" strokeWidth="3"/><circle cx="42" cy="45" r="3.5" fill="#e39a52"/></svg>;
}

function rectangle(id: string, x: number, y: number, width: number, height: number, color: string, locked = true): BoardElement {
  const now = Date.now();
  return { id, type: "rectangle", x, y, width, height, angle: 0, strokeColor: "#272727", backgroundColor: color, fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid", roughness: 1, opacity: 100, groupIds: [], frameId: null, roundness: { type: 3 }, seed: now + x, version: 1, versionNonce: now + y, isDeleted: false, boundElements: null, updated: now, link: null, locked };
}

function textElement(id: string, x: number, y: number, width: number, text: string, fontSize = 20, locked = true): BoardElement {
  const now = Date.now();
  return { id, type: "text", x, y, width, height: Math.max(24, fontSize * 1.5), angle: 0, strokeColor: "#272727", backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 1, strokeStyle: "solid", roughness: 1, opacity: 100, groupIds: [], frameId: null, seed: now + x + y, version: 1, versionNonce: now + x + y + 3, isDeleted: false, boundElements: null, updated: now, link: null, locked, text, fontSize, fontFamily: 1, textAlign: "left", verticalAlign: "top", containerId: null, originalText: text, autoResize: true, lineHeight: 1.25 };
}

function participationRegionId(regionId: string) {
  return ACTIVITY_ID === "empathy-map" ? empathyBlueprintToRegion[regionId] ?? regionId : regionId;
}

function blueprintRegionId(regionId: string) {
  if (ACTIVITY_ID !== "empathy-map") return regionId;
  return Object.entries(empathyBlueprintToRegion).find(([, participationId]) => participationId === regionId)?.[0] ?? regionId;
}

type RegionLayout = { x: number; y: number; width: number; height: number; step?: string; shape?: "rectangle" | "ellipse" | "diamond"; noteTop?: number };

const METHOD_LAYOUTS: Record<string, Record<string, RegionLayout>> = {
  "problem-statement": {
    problem: { x: 80, y: 160, width: 610, height: 500, step: "01 · NOTICE" },
    actor: { x: 750, y: 160, width: 520, height: 500, step: "02 · PERSON" },
    context: { x: 1330, y: 160, width: 520, height: 500, step: "03 · MOMENT" },
    "current-response": { x: 1910, y: 160, width: 610, height: 500, step: "04 · TODAY" },
  },
  "empathy-map": {
    says: { x: 80, y: 130, width: 760, height: 540, step: "WORDS" },
    "thinks-feels": { x: 860, y: 130, width: 760, height: 540, step: "INNER WORLD" },
    does: { x: 80, y: 690, width: 760, height: 540, step: "OBSERVED ACTIONS" },
    "needs-questions": { x: 860, y: 690, width: 760, height: 540, step: "NEEDS · OPEN QUESTIONS" },
  },
  "how-might-we": {
    evidence: { x: 80, y: 330, width: 500, height: 470, step: "01 · START WITH A FINDING", shape: "ellipse" },
    questions: { x: 660, y: 150, width: 850, height: 840, step: "02 · OPEN UP POSSIBILITIES", noteTop: 198 },
    "scope-check": { x: 1590, y: 270, width: 540, height: 600, step: "03 · CHECK THE RANGE", shape: "diamond" },
    "selected-framing": { x: 2210, y: 330, width: 580, height: 470, step: "04 · CARRY FORWARD", shape: "ellipse" },
  },
  brainwriting: {
    "round-1": { x: 80, y: 150, width: 600, height: 460, step: "01 · WRITE QUIETLY" },
    "round-2": { x: 720, y: 150, width: 600, height: 460, step: "02 · PASS & BUILD" },
    "round-3": { x: 1360, y: 150, width: 600, height: 460, step: "03 · EXTEND" },
    "round-4": { x: 80, y: 670, width: 600, height: 460, step: "04 · PASS & BUILD" },
    "round-5": { x: 720, y: 670, width: 600, height: 460, step: "05 · COMBINE OR REDIRECT" },
    "round-6": { x: 1360, y: 670, width: 600, height: 460, step: "06 · FINAL ROUND" },
    cluster: { x: 2060, y: 400, width: 700, height: 600, step: "07 · CIRCLE · CLUSTER · SHARE", shape: "ellipse" },
  },
  "dot-voting": {
    criteria: { x: 80, y: 110, width: 1680, height: 230, step: "01 · AGREE WHAT MATTERS" },
    candidates: { x: 80, y: 390, width: 1480, height: 820, step: "02 · COMPARE CANDIDATES" },
    decision: { x: 1600, y: 390, width: 680, height: 400, step: "03 · DECISION · SEPARATE FROM TALLY", shape: "ellipse" },
    objections: { x: 1600, y: 830, width: 680, height: 400, step: "04 · KEEP OTHER VIEWS VISIBLE" },
  },
  "storyboard-prototype": {
    "frame-1": { x: 80, y: 180, width: 700, height: 760, step: "01 · BEFORE · CONTEXT" },
    "frame-2": { x: 840, y: 180, width: 700, height: 760, step: "02 · DURING · KEY MOMENT" },
    "frame-3": { x: 1600, y: 180, width: 700, height: 760, step: "03 · AFTER · WHAT CHANGED?" },
  },
  "testing-sheet": {
    question: { x: 80, y: 150, width: 700, height: 420, step: "01 · UNCERTAINTY" },
    signals: { x: 840, y: 150, width: 820, height: 420, step: "02 · WHAT WE CAN OBSERVE" },
    observations: { x: 80, y: 640, width: 1000, height: 600, step: "03 · RECORD WHAT HAPPENED" },
    conclusion: { x: 1140, y: 640, width: 820, height: 600, step: "04 · LEARNING · NEXT MOVE", shape: "diamond" },
  },
  reflection: {
    like: { x: 80, y: 160, width: 700, height: 600, step: "01 · KEEP", shape: "ellipse" },
    wish: { x: 850, y: 160, width: 700, height: 600, step: "02 · CHANGE", shape: "ellipse" },
    wonder: { x: 1620, y: 160, width: 700, height: 600, step: "03 · INVESTIGATE", shape: "ellipse" },
    "next-iteration": { x: 650, y: 850, width: 1100, height: 420, step: "04 · TURN LEARNING INTO A NEXT STEP" },
  },
};

const REGION_TINTS = { blue: "#eff6ff", green: "#eff9f1", sand: "#fbf6ec", dark: "#f3f1f7", neutral: "#f7f7f8" };
const REGION_INKS = { blue: "#2e80d9", green: "#39804e", sand: "#9a7022", dark: "#625579", neutral: "#66666b" };

function layoutForRegion(regionId: string, index: number): RegionLayout {
  const id = participationRegionId(regionId);
  return METHOD_LAYOUTS[ACTIVITY_ID]?.[id] ?? { x: 80 + (index % 2) * 600, y: 120 + Math.floor(index / 2) * 450, width: 540, height: 400, step: `${String(index + 1).padStart(2, "0")} · ${activeBlueprint.regions[index]?.label.toUpperCase()}` };
}

function seedElements(): BoardElement[] {
  const elements = activeBlueprint.regions.flatMap((region, index) => {
    const id = participationRegionId(region.id);
    const layout = layoutForRegion(region.id, index);
    const tint = REGION_TINTS[region.accent];
    const ink = REGION_INKS[region.accent];
    const frame = rectangle(id, layout.x, layout.y, layout.width, layout.height, tint);
    frame.strokeColor = `${ink}66`;
    frame.strokeWidth = 1.5;
    frame.roughness = 0;
    if (layout.shape === "ellipse" || layout.shape === "diamond") frame.type = layout.shape;
    const step = layout.step ?? region.label.toUpperCase();
    const stepElement = textElement(`${id}-step`, layout.x + 20, layout.y + 17, layout.width - 40, step, 11);
    stepElement.strokeColor = ink;
    stepElement.fontFamily = 3;
    const label = textElement(`${id}-label`, layout.x + 20, layout.y + 48, layout.width - 40, region.label.toUpperCase(), 22);
    label.fontFamily = 2;
    const prompt = textElement(`${id}-prompt`, layout.x + 20, layout.y + 80, layout.width - 40, region.contributionPrompt ?? region.description, 12);
    prompt.strokeColor = "#626267";
    return [frame, stepElement, label, prompt];
  });
  if (ACTIVITY_ID === "how-might-we") {
    const layout = METHOD_LAYOUTS[ACTIVITY_ID].questions;
    const lenses = ["Unexpected", "Emphasise the positive", "Compare", "Break into parts", "Remove the negative", "Test assumptions"];
    lenses.forEach((lens, index) => {
      const x = layout.x + 20 + (index % 3) * 202;
      const y = layout.y + 115 + Math.floor(index / 3) * 34;
      const badge = rectangle(`hmw-lens-${index + 1}`, x, y, 190, 27, "#ffffff", true);
      badge.strokeColor = "#d8d1c4";
      badge.roughness = 0;
      const label = textElement(`hmw-lens-${index + 1}-label`, x + 8, y + 6, 174, lens, 10, true);
      label.strokeColor = "#625579";
      elements.push(badge, label);
    });
  }
  return elements;
}

function boardUsesCurrentLayout(board: SavedBoard): boolean {
  return board.fields?.[BOARD_LAYOUT_VERSION_FIELD] === CURRENT_BOARD_LAYOUT_VERSION;
}

function currentTemplateElementIds() {
  const generatedIds = new Set<string>();
  activeBlueprint.regions.forEach((region) => {
    const id = participationRegionId(region.id);
    [id, `${id}-step`, `${id}-label`, `${id}-prompt`].forEach((generatedId) => generatedIds.add(generatedId));
  });
  return generatedIds;
}

function composeCurrentLayoutBoard(board: SavedBoard, savedContributions: readonly Contribution[]): SavedBoard {
  const templateScene = seedElements();
  const generatedIds = currentTemplateElementIds();
  board.elements.forEach((element) => {
    if (/^hmw-lens-\d+(-label)?$/.test(element.id)) generatedIds.add(element.id);
  });
  const preservedScene = board.elements.filter((element) => !generatedIds.has(element.id));
  const noteScene = savedContributions.flatMap((contribution) => {
    if (board.elements.some((element) => element.id === `${contribution.id}-card` && !element.isDeleted)) return [];
    const regionIndex = savedContributions.filter((item) => item.regionId === contribution.regionId && item.createdAt < contribution.createdAt).length;
    return noteElements(contribution.id, contribution.content, contribution.regionId ?? participationRegionId(activeBlueprint.regions[0]?.id ?? ""), regionIndex, contribution.author.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), templateScene);
  });
  return { ...board, elements: [...templateScene, ...preservedScene, ...noteScene], fields: { ...(board.fields ?? {}), [BOARD_LAYOUT_VERSION_FIELD]: CURRENT_BOARD_LAYOUT_VERSION, [RESIZE_SPACES_FIELD]: "false" } };
}

function notePosition(region: string, index: number, sceneElements: readonly BoardElement[] = []) {
  const regionIndex = Math.max(0, activeBlueprint.regions.findIndex((item) => participationRegionId(item.id) === region));
  const templateLayout = layoutForRegion(activeBlueprint.regions[regionIndex]?.id ?? region, regionIndex);
  const frame = sceneElements.find((element) => element.id === region && !element.isDeleted);
  const layout = frame ? { ...templateLayout, x: frame.x, y: frame.y, width: frame.width, height: frame.height } : templateLayout;
  const columns = Math.max(1, Math.floor((layout.width - 36) / 180));
  return { x: layout.x + 18 + (index % columns) * 180, y: layout.y + (layout.noteTop ?? 116) + Math.floor(index / columns) * 88 };
}

function boardNoteText(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.length ? lines[lines.length - 1] : "";
    if (current && `${current} ${word}`.length <= 21) lines[lines.length - 1] = `${current} ${word}`;
    else if (lines.length < 3) lines.push(word);
    else {
      lines[2] = `${lines[2].replace(/…$/, "")}…`;
      break;
    }
  }
  return lines.join("\n");
}

function noteElements(id: string, content: string, region: string, index: number, authorInitials = currentUser.initials, sceneElements: readonly BoardElement[] = []): BoardElement[] {
  const { x, y } = notePosition(region, index, sceneElements);
  const groupIds = [`group-${id}`];
  return [
    { ...rectangle(`${id}-card`, x, y, 165, 76, "#ffec83", false), strokeColor: "#c99b20", strokeWidth: 1, roughness: 0, groupIds },
    { ...textElement(`${id}-text`, x + 11, y + 9, 143, boardNoteText(content), 14, false), autoResize: false, height: 42, groupIds },
    { ...textElement(`${id}-meta`, x + 11, y + 55, 143, `${authorInitials} · STICKY NOTE`, 9, false), strokeColor: "#755b17", groupIds },
  ];
}

function contributionForView(item: Contribution): EmpathyContribution {
  return { id: item.id, region: (item.regionId ?? "say") as EmpathyRegion, text: item.content, author: { id: item.author.id, name: item.author.displayName, initials: item.author.id === LOCAL_ACTOR.id ? currentUser.initials : item.author.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(), color: item.author.id === LOCAL_ACTOR.id ? "#2e80d9" : "#8c6bb1" }, createdAt: item.createdAt, updatedAt: item.updatedAt === item.createdAt ? undefined : item.updatedAt };
}

function bootstrapWorkspace() {
  const loaded = loadWorkspace(WORKSPACE_STORAGE_KEY, WORKSPACE_ID, DESIGN_ITERATION_ID === DEFAULT_ITERATION_ID);
  let document = loaded.document;
  let activity = document.activities[ACTIVITY_ID];
  if (!activity) {
    activity = createActivityState({ activityId: ACTIVITY_ID, iterationId: DESIGN_ITERATION_ID, templateId: ACTIVITY_ID, actor: LOCAL_ACTOR, blueprintDefinition: activeBlueprint as unknown as JsonObject, board: { elements: seedElements(), appState: { viewBackgroundColor: "#ffffff" }, files: {} }, fields: { [BOARD_LAYOUT_VERSION_FIELD]: CURRENT_BOARD_LAYOUT_VERSION } });
    document = { ...document, activities: { ...document.activities, [ACTIVITY_ID]: activity } };
    saveWorkspace(document, WORKSPACE_STORAGE_KEY);
  }
  let revision = getCurrentRevision(activity);
  let board: SavedBoard = { elements: revision.board.elements.length ? revision.board.elements as BoardElement[] : seedElements(), appState: revision.board.appState as Partial<AppState>, files: revision.board.files as BinaryFiles, fields: revision.fields as Record<string, string> };
  if (!boardUsesCurrentLayout(board)) {
    const refreshedBoard = composeCurrentLayoutBoard(board, revision.contributions);
    revision = { ...revision, board: { elements: refreshedBoard.elements as any, appState: (refreshedBoard.appState ?? {}) as any, files: (refreshedBoard.files ?? {}) as any }, fields: refreshedBoard.fields ?? {} };
    activity = { ...activity, revisions: activity.revisions.map((item) => item.id === revision.id ? revision : item) };
    document = { ...document, updatedAt: new Date().toISOString(), activities: { ...document.activities, [ACTIVITY_ID]: activity } };
    saveWorkspace(document, WORKSPACE_STORAGE_KEY);
    board = refreshedBoard;
  }
  return { document, board, contributions: revision.contributions };
}

function savedLockedRegions(board: SavedBoard): string[] {
  try {
    const value = JSON.parse(board.fields?.[LOCKED_REGIONS_FIELD] ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function boardFingerprint(board: SavedBoard) {
  return JSON.stringify({
    elements: board.elements.map((element) => [element.id, element.version, element.isDeleted, element.x, element.y, element.text]),
    background: board.appState?.viewBackgroundColor,
    files: Object.keys(board.files ?? {}).sort(),
  });
}

function mergeWorkspaceDocuments(server: WorkspaceDocument, local: WorkspaceDocument, activityId: string): WorkspaceDocument {
  const serverActivity = server.activities[activityId];
  const localActivity = local.activities[activityId];
  if (!serverActivity || !localActivity) return { ...server, ...local, activities: { ...server.activities, ...local.activities } };
  const serverRevision = getCurrentRevision(serverActivity);
  const localRevision = getCurrentRevision(localActivity);
  const byId = new Map<string, BoardElement>();
  for (const element of [...serverRevision.board.elements, ...localRevision.board.elements] as BoardElement[]) {
    const previous = byId.get(element.id);
    if (!previous || (element.version ?? 0) > (previous.version ?? 0) || ((element.version ?? 0) === (previous.version ?? 0) && (element.updated ?? 0) > (previous.updated ?? 0))) byId.set(element.id, element);
  }
  const elements = [...byId.values()];
  const contributionMap = new Map(serverRevision.contributions.map((item) => [item.id, item]));
  for (const item of localRevision.contributions) {
    const previous = contributionMap.get(item.id);
    if (!previous || item.updatedAt > previous.updatedAt) contributionMap.set(item.id, item);
  }
  const mergedContributions = [...contributionMap.values()].filter((item) => !item.boardElementIds.some((id) => byId.get(id)?.isDeleted));
  const fields = { ...serverRevision.fields, ...localRevision.fields };
  const mergedRevision = {
    ...serverRevision,
    fields,
    contributions: mergedContributions,
    board: {
      ...serverRevision.board,
      elements,
      appState: { ...serverRevision.board.appState, ...localRevision.board.appState },
      files: { ...serverRevision.board.files, ...localRevision.board.files },
    },
  };
  const revisions = serverActivity.revisions.map((revision) => revision.id === serverRevision.id ? mergedRevision : revision);
  const events = new Map([...serverActivity.events, ...localActivity.events].map((event) => [event.id, event]));
  const mergedActivity = { ...serverActivity, revisions, events: [...events.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)) };
  return { ...server, updatedAt: new Date().toISOString(), activities: { ...server.activities, [activityId]: mergedActivity } };
}

function savedVoteRoundState(board: SavedBoard): VoteRoundState {
  const value = board.fields?.[VOTE_ROUND_STATE_FIELD];
  return value === "open" || value === "closed" ? value : "setup";
}

function savedVoteLedger(board: SavedBoard): VoteLedger {
  try {
    const value = JSON.parse(board.fields?.[VOTE_LEDGER_FIELD] ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as VoteLedger : {};
  } catch {
    return {};
  }
}

function savedCarryForwardManifest(fields: Record<string, string | undefined>): unknown[] {
  try {
    const value = JSON.parse(fields.__carry_forward_manifest ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function App() {
  const initial = useRef<ReturnType<typeof bootstrapWorkspace> | null>(null);
  if (!initial.current) initial.current = bootstrapWorkspace();
  const [workspaceDocument, setWorkspaceDocument] = useState(initial.current.document);
  const [saved, setSaved] = useState<SavedBoard>(initial.current.board);
  const [contributions, setContributions] = useState<Contribution[]>(initial.current.contributions);
  const [status, setStatus] = useState("Saved on this device");
  const [teamSyncStatus, setTeamSyncStatus] = useState<CollaborationConnectionState>("idle");
  const [teamJoined, setTeamJoined] = useState(false);
  const [manualSyncState, setManualSyncState] = useState<"idle" | "syncing" | "synced">("idle");
  const [api, setApi] = useState<any>(null);
  const [role, setRole] = useState<WorkspaceRole>(() => launchParams.get("role") === "observer" ? "observer" : launchParams.get("role") === "facilitator" ? "facilitator" : "participant");
  const [participantName, setParticipantName] = useState(INITIAL_DISPLAY_NAME);
  const [navigationCollapsed, setNavigationCollapsed] = useState(initialSidebarState);
  const [guideCollapsed, setGuideCollapsed] = useState(initialSidebarState);
  const [boardFullscreen, setBoardFullscreen] = useState(false);
  const [resizeSpaces, setResizeSpaces] = useState(initial.current.board.fields?.[RESIZE_SPACES_FIELD] === "true");
  // Keep the workspace entry point consistent across desktop, tablet and phone.
  // Mobile users can switch to Participate through the view navigation, but a
  // shared workspace always opens on its spatial Board surface first.
  const [activeView, setActiveView] = useState<WorkspaceView>("board");
  const [lockedRegions, setLockedRegions] = useState<string[]>(() => savedLockedRegions(initial.current!.board));
  const [guidedRegion, setGuidedRegion] = useState<string | null>(() => initial.current!.board.fields?.[GUIDED_REGION_FIELD] || null);
  const initialIterationStatus = getCurrentRevision(initial.current.document.activities[ACTIVITY_ID]).status;
  const [reviewMode, setReviewMode] = useState(initialIterationStatus === "team-review");
  const [activityComplete, setActivityComplete] = useState(initialIterationStatus === "closed");
  const [voteRoundState, setVoteRoundState] = useState<VoteRoundState>(() => savedVoteRoundState(initial.current!.board));
  const [voteLedger, setVoteLedger] = useState<VoteLedger>(() => savedVoteLedger(initial.current!.board));
  const boardRef = useRef<SavedBoard>(saved);
  const boardFingerprintRef = useRef(boardFingerprint(saved));
  const canvasInstanceRef = useRef<any>(null);
  const contributionsRef = useRef<Contribution[]>(contributions);
  const documentRef = useRef<WorkspaceDocument>(workspaceDocument);
  const pendingBoardEventsRef = useRef<SemanticEvent[]>([]);
  const saveTimer = useRef<number | null>(null);
  const roomId = ROOM_ID;
  const [teamToken, setTeamToken] = useState(() => launchInviteToken ? "" : launchParams.get("roomToken") || window.localStorage.getItem(`fieldnotes:room-token:${roomId}`) || "");
  const teamMemberIdRef = useRef(launchInviteToken ? "" : launchParams.get("roomMember") || window.localStorage.getItem(`fieldnotes:room-member:${roomId}`) || "");
  const teamTransportRef = useRef<WebSocketCollaborationTransport>();
  const teamJoinedRef = useRef(false);
  const manualSyncPendingRef = useRef(false);
  const teamRevisionRef = useRef(0);
  const teamPendingDocumentRef = useRef<WorkspaceDocument | null>(null);
  const teamInFlightDocumentRef = useRef<WorkspaceDocument | null>(null);
  const teamRequestRef = useRef<string | null>(null);
  const teamRetryRequestIdRef = useRef<string | null>(null);
  const teamRequestTimeoutRef = useRef<number | null>(null);
  const applyRemoteDocumentRef = useRef<(document: WorkspaceDocument) => void>(() => {});
  const initialData = useMemo(() => ({ elements: saved.elements, appState: { viewBackgroundColor: "#ffffff", ...(saved.appState ?? {}) }, files: saved.files }), []);
  const activeStageDefinition = STAGES.find((stage) => stage.id === activeStage) ?? STAGES[1];
  const subtitle = activeTemplate.shortDescription;
  const checkpoints = workspaceDocument.activities[ACTIVITY_ID]?.checkpoints ?? [];

  function applyRemoteDocument(remoteDocument: WorkspaceDocument) {
    const remoteActivity = remoteDocument?.activities?.[ACTIVITY_ID];
    if (!remoteActivity || remoteActivity.iterationId !== DESIGN_ITERATION_ID) return;
    const revision = getCurrentRevision(remoteActivity);
    const nextBoard: SavedBoard = {
      elements: revision.board.elements as BoardElement[],
      appState: revision.board.appState as Partial<AppState>,
      files: revision.board.files as BinaryFiles,
      fields: revision.fields as Record<string, string>,
    };
    documentRef.current = remoteDocument;
    boardRef.current = nextBoard;
    boardFingerprintRef.current = boardFingerprint(nextBoard);
    contributionsRef.current = revision.contributions;
    setWorkspaceDocument(remoteDocument);
    setSaved(nextBoard);
    setContributions(revision.contributions);
    setVoteRoundState(savedVoteRoundState(nextBoard));
    setVoteLedger(savedVoteLedger(nextBoard));
    setLockedRegions(savedLockedRegions(nextBoard));
    setGuidedRegion(nextBoard.fields?.[GUIDED_REGION_FIELD] || null);
    saveWorkspace(remoteDocument, WORKSPACE_STORAGE_KEY);
    const instance = canvasInstanceRef.current;
    if (instance) {
      instance.updateScene({ elements: nextBoard.elements, appState: { viewBackgroundColor: "#ffffff", ...(nextBoard.appState ?? {}) } });
      if (nextBoard.files) instance.addFiles(Object.values(nextBoard.files));
    }
    setStatus("Synced to team");
  }
  applyRemoteDocumentRef.current = applyRemoteDocument;

  function sendPendingTeamDocument() {
    const transport = teamTransportRef.current;
    const pending = teamPendingDocumentRef.current;
    if (!transport || !teamJoinedRef.current || !pending || teamRequestRef.current) return;
    const requestId = teamRetryRequestIdRef.current ?? createRequestId("revision");
    teamRetryRequestIdRef.current = requestId;
    teamRequestRef.current = requestId;
    teamInFlightDocumentRef.current = pending;
    const sent = transport.send({
      type: "room.revision.append",
      requestId,
      roomId,
      baseRevisionNumber: teamRevisionRef.current,
      activityId: ACTIVITY_ID,
      iterationId: DESIGN_ITERATION_ID,
      actorId: teamMemberIdRef.current || LOCAL_ACTOR.id,
      operation: "replace-activity-revision",
      payload: { document: pending },
    });
    if (!sent) {
      teamRequestRef.current = null;
      teamInFlightDocumentRef.current = null;
      setStatus("Saved on this device · waiting for team connection");
      return;
    }
    setStatus("Syncing board with team…");
    if (teamRequestTimeoutRef.current !== null) window.clearTimeout(teamRequestTimeoutRef.current);
    teamRequestTimeoutRef.current = window.setTimeout(() => {
      if (!teamRequestRef.current) return;
      teamRequestRef.current = null;
      teamInFlightDocumentRef.current = null;
      setStatus("Team sync delayed · retrying");
      sendPendingTeamDocument();
    }, 8_000);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onRoomReady = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string; token?: string; memberId?: string }>).detail;
      if (!detail?.token || (detail.roomId && detail.roomId !== roomId)) return;
      teamMemberIdRef.current = detail.memberId || teamMemberIdRef.current;
      setTeamToken(detail.token);
    };
    window.addEventListener("fieldnotes:room-ready", onRoomReady);
    return () => window.removeEventListener("fieldnotes:room-ready", onRoomReady);
  }, [roomId]);

  useEffect(() => {
    if (!launchInviteToken) return;
    let disposed = false;
    void (async () => {
      const pendingKey = await inviteRedemptionStorageKey(roomId, launchInviteToken);
      if (disposed) return;
      const accessToken = window.localStorage.getItem(pendingKey) || createCapabilityToken();
      window.localStorage.setItem(pendingKey, accessToken);
      const identity = await redeemRemoteInvite(roomId, launchInviteToken, accessToken);
      if (disposed) return;
      window.localStorage.setItem(`fieldnotes:room-token:${roomId}`, identity.accessToken);
      window.localStorage.setItem(`fieldnotes:room-member:${roomId}`, identity.memberId);
      window.localStorage.removeItem(pendingKey);
      teamMemberIdRef.current = identity.memberId;
      setParticipantName(identity.displayName);
      setRole(identity.role);
      setTeamToken(identity.accessToken);
      const cleanUrl = new URL(window.location.href);
      cleanUrl.hash = "";
      window.history.replaceState(window.history.state, "", cleanUrl.toString());
      window.dispatchEvent(new CustomEvent("fieldnotes:room-ready", { detail: { roomId, token: identity.accessToken, memberId: identity.memberId, role: identity.role, displayName: identity.displayName } }));
    })().catch((error) => {
      if (!disposed) setStatus(error instanceof Error ? `Invite unavailable · ${error.message}` : "Invite unavailable · check the link or ask the facilitator for a new invite.");
    });
    return () => { disposed = true; };
  }, [roomId]);

  useEffect(() => {
    if (!teamToken) {
      setTeamSyncStatus("idle");
      teamJoinedRef.current = false;
      setTeamJoined(false);
      return;
    }
    const transport = new WebSocketCollaborationTransport({
      url: remoteSocketUrl(roomId),
      join: {
        roomId,
        workspaceId: WORKSPACE_ID,
        activityId: ACTIVITY_ID,
        iterationId: DESIGN_ITERATION_ID,
        requestedRole: role,
        displayName: participantName,
        accessToken: teamToken,
      },
    });
    teamTransportRef.current = transport;
    const removeStateListener = transport.onStateChange((nextState) => {
      setTeamSyncStatus(nextState);
      if (nextState === "connected") setStatus("Connecting to team…");
    });
    const removeEventListener = transport.onEvent((event) => {
      if (event.type === "room.snapshot" && event.snapshot) {
        teamJoinedRef.current = true;
        setTeamJoined(true);
        const self = event.snapshot.members.find((member) => member.id === teamMemberIdRef.current);
        if (self) {
          teamMemberIdRef.current = self.id;
          LOCAL_ACTOR.id = self.id;
          LOCAL_ACTOR.displayName = self.displayName;
          LOCAL_ACTOR.role = self.role;
          FACILITATOR_ACTOR.id = self.id;
          FACILITATOR_ACTOR.displayName = self.displayName;
          currentUser.id = self.id;
          currentUser.name = self.displayName;
          currentUser.initials = initialsForName(self.displayName);
          setParticipantName(self.displayName);
          setRole(self.role);
        }
        teamRevisionRef.current = event.snapshot.revision.revisionNumber;
        if (event.snapshot.document && Object.keys(event.snapshot.document).length) {
          const payload = event.snapshot.document as { document?: WorkspaceDocument };
          const document = payload.document ?? event.snapshot.document as unknown as WorkspaceDocument;
          const local = teamPendingDocumentRef.current ?? documentRef.current;
          const merged = mergeWorkspaceDocuments(document, local, ACTIVITY_ID);
          const differs = JSON.stringify(merged.activities[ACTIVITY_ID]) !== JSON.stringify(document.activities[ACTIVITY_ID]);
          teamPendingDocumentRef.current = differs ? merged : null;
          applyRemoteDocumentRef.current(differs ? merged : document);
        } else if (role === "facilitator") {
          teamPendingDocumentRef.current = documentRef.current;
        }
        sendPendingTeamDocument();
      } else if (event.type === "room.revision.accepted" && event.revision) {
        teamRevisionRef.current = Math.max(teamRevisionRef.current, event.revision.revisionNumber);
        if (teamRequestRef.current === event.requestId) {
          teamRequestRef.current = null;
          if (teamRetryRequestIdRef.current === event.requestId) teamRetryRequestIdRef.current = null;
          if (teamRequestTimeoutRef.current !== null) window.clearTimeout(teamRequestTimeoutRef.current);
          teamRequestTimeoutRef.current = null;
          if (teamPendingDocumentRef.current === teamInFlightDocumentRef.current) teamPendingDocumentRef.current = null;
          teamInFlightDocumentRef.current = null;
          if (manualSyncPendingRef.current && !teamPendingDocumentRef.current) {
            manualSyncPendingRef.current = false;
            setManualSyncState("synced");
            setStatus("Saved and shared with the team");
            window.setTimeout(() => setManualSyncState((current) => current === "synced" ? "idle" : current), 2_400);
          } else {
            setStatus("Synced to team");
          }
          sendPendingTeamDocument();
        } else if (event.document && event.actorId !== teamMemberIdRef.current) {
          const payload = event.document as { document?: WorkspaceDocument };
          const document = payload.document ?? event.document as unknown as WorkspaceDocument;
          const pending = teamPendingDocumentRef.current;
          if (pending) teamPendingDocumentRef.current = mergeWorkspaceDocuments(document, pending, ACTIVITY_ID);
          applyRemoteDocumentRef.current(pending ? teamPendingDocumentRef.current! : document);
          sendPendingTeamDocument();
        }
      } else if (event.type === "room.revision.rejected") {
        if (teamRequestRef.current === event.requestId) {
          teamRequestRef.current = null;
          if (teamRetryRequestIdRef.current === event.requestId) teamRetryRequestIdRef.current = null;
          if (teamRequestTimeoutRef.current !== null) window.clearTimeout(teamRequestTimeoutRef.current);
          teamRequestTimeoutRef.current = null;
          teamInFlightDocumentRef.current = null;
          if (event.error && event.error.code !== "conflict" && event.error.code !== "server-unavailable") {
            manualSyncPendingRef.current = false;
            setManualSyncState("idle");
            setStatus(`Shared save rejected · kept on this device: ${event.error.message}`);
            return;
          }
          const snapshot = (event as typeof event & { snapshot?: { revision?: { revisionNumber: number }; document?: Record<string, unknown> } }).snapshot;
          if (snapshot?.revision) teamRevisionRef.current = snapshot.revision.revisionNumber;
          if (snapshot?.document && Object.keys(snapshot.document).length) {
            const payload = snapshot.document as { document?: WorkspaceDocument };
            const latest = payload.document ?? snapshot.document as unknown as WorkspaceDocument;
            teamPendingDocumentRef.current = mergeWorkspaceDocuments(latest, teamPendingDocumentRef.current ?? documentRef.current, ACTIVITY_ID);
            applyRemoteDocumentRef.current(latest);
            window.setTimeout(sendPendingTeamDocument, 0);
          } else {
            setStatus("Sync conflict — retrying");
            window.setTimeout(sendPendingTeamDocument, 500);
          }
        }
      } else if (event.type === "room.error" && event.error) {
        setStatus(`Team sync issue: ${event.error.message}`);
        if (manualSyncPendingRef.current) {
          manualSyncPendingRef.current = false;
          setManualSyncState("idle");
        }
      }
    });
    transport.connect();
    return () => {
      teamJoinedRef.current = false;
      setTeamJoined(false);
      teamRequestRef.current = null;
      if (teamRequestTimeoutRef.current !== null) window.clearTimeout(teamRequestTimeoutRef.current);
      teamRequestTimeoutRef.current = null;
      removeStateListener();
      removeEventListener();
      transport.close();
      if (teamTransportRef.current === transport) teamTransportRef.current = undefined;
    };
  }, [teamToken, roomId, role, participantName]);

  useEffect(() => {
    if (!boardFullscreen) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    function leaveFullscreenOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, [contenteditable='true']"))) return;
      setBoardFullscreen(false);
    }
    window.addEventListener("keydown", leaveFullscreenOnEscape);
    return () => {
      window.removeEventListener("keydown", leaveFullscreenOnEscape);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [boardFullscreen]);

  useEffect(() => {
    if (resizeSpaces && (role === "observer" || reviewMode || activityComplete)) setResizeSpacesMode(false);
  }, [resizeSpaces, role, reviewMode, activityComplete]);

  function persist(nextBoard: SavedBoard, nextContributions = contributionsRef.current, event?: SemanticEvent, iterationStatus?: WorkspaceActivityState["revisions"][number]["status"], additionalEvents: readonly SemanticEvent[] = []) {
    const currentDocument = documentRef.current;
    const currentActivity = currentDocument.activities[ACTIVITY_ID];
    if (!currentActivity) return;
    const currentRevision = getCurrentRevision(currentActivity);
    const nextRevision = { ...currentRevision, status: iterationStatus ?? currentRevision.status, fields: { ...(nextBoard.fields ?? {}) }, contributions: nextContributions, board: { elements: nextBoard.elements as any, appState: (nextBoard.appState ?? {}) as any, files: (nextBoard.files ?? {}) as any } };
    let nextActivity: WorkspaceActivityState = { ...currentActivity, revisions: currentActivity.revisions.map((revision) => revision.id === currentRevision.id ? nextRevision : revision) };
    for (const nextEvent of event ? [event, ...additionalEvents] : additionalEvents) nextActivity = addEventToActivity(nextActivity, nextEvent);
    const nextDocument = { ...currentDocument, updatedAt: new Date().toISOString(), activities: { ...currentDocument.activities, [ACTIVITY_ID]: nextActivity } };
    const result = saveWorkspace(nextDocument, WORKSPACE_STORAGE_KEY);
    documentRef.current = nextDocument;
    setWorkspaceDocument(nextDocument);
    teamPendingDocumentRef.current = nextDocument;
    setStatus(teamToken ? "Saved here · syncing to team…" : result.durability === "local-storage" ? "Saved on this device" : "Saved for this session");
    sendPendingTeamDocument();
  }

  function onChange(elements: readonly BoardElement[], appState: AppState, files: BinaryFiles) {
    const next = { ...boardRef.current, elements, appState: { viewBackgroundColor: appState.viewBackgroundColor }, files };
    const fingerprint = boardFingerprint(next);
    if (fingerprint === boardFingerprintRef.current) return;
    const currentActivity = documentRef.current.activities[ACTIVITY_ID];
    if (currentActivity) {
      pendingBoardEventsRef.current.push(...deriveBoardEvents(boardRef.current.elements, elements, {
        actor: role === "facilitator" ? FACILITATOR_ACTOR : LOCAL_ACTOR,
        activityId: ACTIVITY_ID,
        iterationId: currentActivity.iterationId,
        blueprintVersionId: currentActivity.activeBlueprintVersionId,
      }));
    }
    boardFingerprintRef.current = fingerprint;
    boardRef.current = next;
    if (saveTimer.current === null) {
      setStatus("Saving…");
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        const boardEvents = pendingBoardEventsRef.current;
        pendingBoardEventsRef.current = [];
        setSaved(boardRef.current);
        persist(boardRef.current, contributionsRef.current, undefined, undefined, boardEvents);
      }, 400);
    }
  }

  function saveAndSyncNow() {
    if (role === "observer") return;
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const boardEvents = pendingBoardEventsRef.current.splice(0);
    setSaved(boardRef.current);
    persist(boardRef.current, contributionsRef.current, undefined, undefined, boardEvents);
    if (!teamToken) {
      setManualSyncState("idle");
      if (role === "facilitator") {
        setStatus("Saved on this device · start a shared room to sync");
        setActiveView("iteration");
      } else {
        setStatus("Saved on this device · ask the facilitator for a shared invite");
      }
      return;
    }
    manualSyncPendingRef.current = true;
    setManualSyncState("syncing");
    setStatus(teamJoinedRef.current ? "Sending latest board to the team…" : "Saved here · waiting for the team connection…");
    sendPendingTeamDocument();
  }

  function updateField(field: TemplateField, value: string) {
    const next = { ...boardRef.current, fields: { ...(boardRef.current.fields ?? {}), [field.id]: value } };
    boardRef.current = next; setSaved(next); persist(next);
  }

  function updateRawField(fieldId: string, value: string) {
    const next = { ...boardRef.current, fields: { ...(boardRef.current.fields ?? {}), [fieldId]: value } };
    boardRef.current = next; setSaved(next); persist(next);
  }

  function updateBoardElements(elements: readonly BoardElement[]) {
    const next = { ...boardRef.current, elements };
    boardFingerprintRef.current = boardFingerprint(next);
    boardRef.current = next; setSaved(next); if (activeView === "board") api?.updateScene({ elements });
    return next;
  }

  function setResizeSpacesMode(enabled: boolean) {
    const elements = boardRef.current.elements.map((element) => activeBlueprint.regions.some((region) => participationRegionId(region.id) === element.id) && !element.isDeleted
      ? { ...element, locked: !enabled, version: (element.version ?? 1) + 1, updated: Date.now() }
      : element);
    const next = { ...boardRef.current, elements, fields: { ...(boardRef.current.fields ?? {}), [RESIZE_SPACES_FIELD]: String(enabled) } };
    boardFingerprintRef.current = boardFingerprint(next);
    boardRef.current = next;
    setSaved(next);
    setResizeSpaces(enabled);
    if (activeView === "board") api?.updateScene({ elements });
    persist(next);
  }

  function eventFor(type: SemanticEventType, targetIds: string[], payload: JsonObject, actor = LOCAL_ACTOR) {
    const currentActivity = documentRef.current.activities[ACTIVITY_ID];
    return createSemanticEvent({ type, actor, activityId: ACTIVITY_ID, iterationId: currentActivity.iterationId, blueprintVersionId: currentActivity.activeBlueprintVersionId, targetIds, payload });
  }

  function updateParticipantName(name: string) {
    const normalized = name.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!normalized) return;
    LOCAL_ACTOR.displayName = normalized;
    FACILITATOR_ACTOR.displayName = normalized;
    currentUser.name = normalized;
    currentUser.initials = initialsForName(normalized);
    setParticipantName(normalized);
  }

  function openIteration(iterationId: string) {
    const url = new URL(window.location.href);
    const currentIterationId = url.searchParams.get("iteration") || url.searchParams.get("demoIteration") || DEFAULT_ITERATION_ID;
    if (currentIterationId === iterationId) return;
    url.searchParams.set("iteration", iterationId);
    url.searchParams.delete("demoIteration");
    window.location.assign(url.toString());
  }

  function openMethod(methodId: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("activity", methodId);
    window.location.assign(url.toString());
  }

  function createContribution(input: NewContributionInput) {
    createMethodContribution(input.region, input.text);
  }

  function createMethodContribution(regionId: string, text: string) {
    if (role === "observer") return;
    const now = new Date().toISOString();
    const id = `contribution-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const elements = noteElements(id, text, regionId, contributionsRef.current.filter((item) => item.regionId === regionId).length, currentUser.initials, boardRef.current.elements);
    const contribution: Contribution = { id, activityId: ACTIVITY_ID, iterationId: documentRef.current.activities[ACTIVITY_ID].iterationId, author: LOCAL_ACTOR, regionId, boardElementIds: elements.map((element) => element.id), content: text, tags: [], status: "submitted", createdAt: now, updatedAt: now };
    const nextContributions = [...contributionsRef.current, contribution];
    contributionsRef.current = nextContributions; setContributions(nextContributions);
    const nextBoard = updateBoardElements([...boardRef.current.elements, ...elements]);
    persist(nextBoard, nextContributions, eventFor("contribution-submitted", [id, ...contribution.boardElementIds], { region: regionId }));
  }

  function editContribution(id: string, content: string) {
    const nextContributions = contributionsRef.current.map((item) => item.id === id ? { ...item, content, updatedAt: new Date().toISOString() } : item);
    if (!nextContributions.some((item) => item.id === id)) return;
    const displayContent = boardNoteText(content);
    const elements = boardRef.current.elements.map((element) => element.id === `${id}-text` ? { ...element, text: displayContent, originalText: displayContent, version: (element.version ?? 1) + 1, updated: Date.now() } : element);
    contributionsRef.current = nextContributions; setContributions(nextContributions);
    const nextBoard = updateBoardElements(elements);
    persist(nextBoard, nextContributions, eventFor("contribution-updated", [id], { action: "content-edited" }));
  }

  function moveContribution(id: string, region: string) {
    const target = contributionsRef.current.find((item) => item.id === id);
    if (!target || target.regionId === region) return;
    const { x, y } = notePosition(region, contributionsRef.current.filter((item) => item.regionId === region).length, boardRef.current.elements);
    const elements = boardRef.current.elements.map((element) => element.id === `${id}-card` ? { ...element, x, y, version: (element.version ?? 1) + 1, updated: Date.now() } : element.id === `${id}-text` ? { ...element, x: x + 11, y: y + 9, version: (element.version ?? 1) + 1, updated: Date.now() } : element.id === `${id}-meta` ? { ...element, x: x + 11, y: y + 55, version: (element.version ?? 1) + 1, updated: Date.now() } : element);
    const nextContributions = contributionsRef.current.map((item) => item.id === id ? { ...item, regionId: region, updatedAt: new Date().toISOString() } : item);
    contributionsRef.current = nextContributions; setContributions(nextContributions);
    const nextBoard = updateBoardElements(elements);
    persist(nextBoard, nextContributions, eventFor("contribution-updated", [id], { action: "region-changed", from: target.regionId ?? "say", to: region }));
  }

  function deleteContribution(id: string) {
    const nextContributions = contributionsRef.current.filter((item) => item.id !== id);
    const contributionElementIds = new Set(contributionsRef.current.find((item) => item.id === id)?.boardElementIds ?? []);
    const elements = boardRef.current.elements.map((element) => contributionElementIds.has(element.id) ? { ...element, isDeleted: true, version: (element.version ?? 1) + 1, updated: Date.now() } : element);
    contributionsRef.current = nextContributions; setContributions(nextContributions);
    const nextBoard = updateBoardElements(elements);
    persist(nextBoard, nextContributions, eventFor("contribution-updated", [id], { action: "deleted" }));
  }

  function persistVoteState(nextRoundState: VoteRoundState, nextLedger: VoteLedger, event?: SemanticEvent) {
    const nextBoard = { ...boardRef.current, fields: { ...(boardRef.current.fields ?? {}), [VOTE_ROUND_STATE_FIELD]: nextRoundState, [VOTE_LEDGER_FIELD]: JSON.stringify(nextLedger) } };
    boardRef.current = nextBoard;
    setSaved(nextBoard);
    setVoteRoundState(nextRoundState);
    setVoteLedger(nextLedger);
    persist(nextBoard, contributionsRef.current, event);
  }

  function changeVoteRoundState(nextState: VoteRoundState) {
    if (role !== "facilitator" || ACTIVITY_ID !== "dot-voting") return;
    persistVoteState(nextState, voteLedger, eventFor("activity-step-changed", [], { action: "vote-round-state-changed", state: nextState }, FACILITATOR_ACTOR));
  }

  function castVote(candidateId: string) {
    if (voteRoundState !== "open" || role === "observer") return;
    const budget = Math.min(5, Math.max(1, Number.parseInt(boardRef.current.fields?.["vote-budget"] ?? "3", 10) || 3));
    const voterId = teamMemberIdRef.current || LOCAL_ACTOR.id;
    const allocation = voteLedger[voterId] ?? {};
    const used = Object.values(allocation).reduce((total, count) => total + count, 0);
    if (used >= budget || !contributionsRef.current.some((item) => item.id === candidateId && item.regionId === "candidates")) return;
    const nextLedger = { ...voteLedger, [voterId]: { ...allocation, [candidateId]: (allocation[candidateId] ?? 0) + 1 } };
    persistVoteState(voteRoundState, nextLedger, eventFor("vote-cast", [candidateId], { roundId: "local-vote-round", remaining: budget - used - 1 }, role === "facilitator" ? FACILITATOR_ACTOR : LOCAL_ACTOR));
  }

  function retractVote(candidateId: string) {
    if (voteRoundState !== "open" || role === "observer") return;
    const voterId = teamMemberIdRef.current || LOCAL_ACTOR.id;
    const allocation = voteLedger[voterId] ?? {};
    if ((allocation[candidateId] ?? 0) <= 0) return;
    const nextCount = allocation[candidateId] - 1;
    const nextAllocation = { ...allocation, [candidateId]: nextCount };
    if (nextCount === 0) delete nextAllocation[candidateId];
    const nextLedger = { ...voteLedger, [voterId]: nextAllocation };
    persistVoteState(voteRoundState, nextLedger, eventFor("vote-retracted", [candidateId], { roundId: "local-vote-round" }, role === "facilitator" ? FACILITATOR_ACTOR : LOCAL_ACTOR));
  }

  function saveCheckpoint() {
    if (teamJoinedRef.current && role !== "facilitator") return;
    const currentDocument = documentRef.current;
    const currentActivity = currentDocument.activities[ACTIVITY_ID];
    const checkpointLabel = `Checkpoint ${String(currentActivity.checkpoints.length + 1).padStart(2, "0")}`;
    let nextActivity = appendCheckpoint(currentActivity, { label: checkpointLabel, actor: role === "facilitator" ? FACILITATOR_ACTOR : LOCAL_ACTOR });
    const checkpointRevision = getCurrentRevision(nextActivity);
    nextActivity = { ...nextActivity, revisions: nextActivity.revisions.map((revision) => revision.id === checkpointRevision.id ? { ...revision, status: "checkpoint-saved" } : revision) };
    nextActivity = addEventToActivity(nextActivity, eventFor("checkpoint-saved", [], { label: checkpointLabel }, role === "facilitator" ? FACILITATOR_ACTOR : LOCAL_ACTOR));
    const nextDocument = { ...currentDocument, activities: { ...currentDocument.activities, [ACTIVITY_ID]: nextActivity } };
    saveWorkspace(nextDocument, WORKSPACE_STORAGE_KEY);
    documentRef.current = nextDocument;
    setWorkspaceDocument(nextDocument);
    teamPendingDocumentRef.current = nextDocument;
    setStatus(teamToken ? "Checkpoint saved · syncing to team…" : "Checkpoint saved on this device");
    sendPendingTeamDocument();
  }

  function restoreCheckpoint(checkpointId: string) {
    if (teamJoinedRef.current && role !== "facilitator") return;
    const currentDocument = documentRef.current;
    const nextActivity = restoreCheckpointAsRevision(currentDocument.activities[ACTIVITY_ID], checkpointId, LOCAL_ACTOR);
    const revision = getCurrentRevision(nextActivity);
    const nextBoard: SavedBoard = { elements: revision.board.elements as BoardElement[], appState: revision.board.appState as Partial<AppState>, files: revision.board.files as BinaryFiles, fields: revision.fields as Record<string, string> };
    const nextDocument = { ...currentDocument, activities: { ...currentDocument.activities, [ACTIVITY_ID]: nextActivity } };
    documentRef.current = nextDocument; setWorkspaceDocument(nextDocument); boardRef.current = nextBoard; boardFingerprintRef.current = boardFingerprint(nextBoard); setSaved(nextBoard); contributionsRef.current = revision.contributions; setContributions(revision.contributions);
    setVoteRoundState(savedVoteRoundState(nextBoard)); setVoteLedger(savedVoteLedger(nextBoard)); setLockedRegions(savedLockedRegions(nextBoard)); setGuidedRegion(nextBoard.fields?.[GUIDED_REGION_FIELD] || null);
    api?.updateScene({ elements: nextBoard.elements, appState: nextBoard.appState });
    if (nextBoard.files) api?.addFiles(Object.values(nextBoard.files));
    saveWorkspace(nextDocument, WORKSPACE_STORAGE_KEY); setStatus("Checkpoint restored as a new version");
  }

  function resetTemplate() {
    if (teamJoinedRef.current && role !== "facilitator") return;
    const next: SavedBoard = { elements: seedElements(), files: {}, fields: { [BOARD_LAYOUT_VERSION_FIELD]: CURRENT_BOARD_LAYOUT_VERSION } };
    boardRef.current = next; boardFingerprintRef.current = boardFingerprint(next); contributionsRef.current = []; setSaved(next); setContributions([]); setVoteRoundState("setup"); setVoteLedger({}); setLockedRegions([]); setGuidedRegion(null); api?.updateScene({ elements: next.elements, appState: { viewBackgroundColor: "#ffffff" } }); api?.scrollToContent(next.elements, { fitToContent: true, viewportZoomFactor: .82, animate: true, maxZoom: 1 }); persist(next, []);
  }

  function migrateBoardLayout() {
    // Keep an append-only checkpoint before replacing the scene so the prior
    // arrangement remains restorable if the facilitator changes their mind.
    saveCheckpoint();
    const next = composeCurrentLayoutBoard(boardRef.current, contributionsRef.current);
    boardRef.current = next;
    boardFingerprintRef.current = boardFingerprint(next);
    setSaved(next);
    api?.updateScene({ elements: next.elements, appState: { viewBackgroundColor: "#ffffff", ...(next.appState ?? {}) } });
    api?.scrollToContent(next.elements, { fitToContent: true, viewportZoomFactor: .82, animate: true, maxZoom: 1 });
    persist(next, contributionsRef.current, eventFor("layout-migrated", [], { from: "previous-layout", to: "method-specific-layout", preservedContributions: contributionsRef.current.length }));
  }

  function registerCanvasApi(instance: any) {
    if (!instance || canvasInstanceRef.current === instance) return;
    canvasInstanceRef.current = instance;
    setApi(instance);
    requestAnimationFrame(() => {
      let sceneElements = [...boardRef.current.elements];
      let repaired = false;
      contributionsRef.current.forEach((contribution) => {
        if (sceneElements.some((element) => element.id === `${contribution.id}-card` && !element.isDeleted)) return;
        const index = contributionsRef.current.filter((item) => item.regionId === contribution.regionId && item.createdAt < contribution.createdAt).length;
        const initials = contribution.author.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
        sceneElements.push(...noteElements(contribution.id, contribution.content, contribution.regionId ?? participationRegionId(activeBlueprint.regions[0].id), index, initials, sceneElements));
        repaired = true;
      });
      if (repaired) {
        const nextBoard = { ...boardRef.current, elements: sceneElements };
        boardRef.current = nextBoard;
        boardFingerprintRef.current = boardFingerprint(nextBoard);
        setSaved(nextBoard);
        persist(nextBoard, contributionsRef.current);
      }
      instance.updateScene({ elements: sceneElements, appState: { viewBackgroundColor: "#ffffff", ...(boardRef.current.appState ?? {}) } });
      if (boardRef.current.files) instance.addFiles(Object.values(boardRef.current.files));
      instance.scrollToContent(sceneElements, { fitToContent: true, viewportZoomFactor: .82, animate: false, maxZoom: 1 });
    });
  }

  function fitBoard() {
    api?.scrollToContent(boardRef.current.elements, { fitToContent: true, viewportZoomFactor: .82, animate: true, maxZoom: 1 });
  }

  async function exportBoard() {
    if (!api) return;
    const { exportToSvg } = await import("@excalidraw/excalidraw");
    const svg = await exportToSvg({ elements: boardRef.current.elements, appState: api.getAppState(), files: boardRef.current.files ?? {} });
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${ACTIVITY_ID}.svg`; anchor.click(); URL.revokeObjectURL(url);
  }

  function recordFacilitatorEvent(type: SemanticEventType, targetIds: string[], payload: JsonObject, iterationStatus?: WorkspaceActivityState["revisions"][number]["status"], board = boardRef.current) {
    persist(board, contributionsRef.current, eventFor(type, targetIds, payload, FACILITATOR_ACTOR), iterationStatus);
  }

  function changePrompt(regionId: string | null) {
    const nextRegion = regionId ? participationRegionId(regionId) : null;
    setGuidedRegion(nextRegion);
    const nextBoard = { ...boardRef.current, fields: { ...(boardRef.current.fields ?? {}), [GUIDED_REGION_FIELD]: nextRegion ?? "" } };
    boardRef.current = nextBoard;
    setSaved(nextBoard);
    recordFacilitatorEvent("activity-step-changed", regionId ? [regionId] : [], { action: regionId ? "prompt-revealed" : "guided-prompts-finished", regionId }, undefined, nextBoard);
  }

  function changeRegionLock(regionId: string, locked: boolean) {
    const mappedRegion = participationRegionId(regionId);
    const nextLockedRegions = locked ? [...new Set([...lockedRegions, mappedRegion])] : lockedRegions.filter((item) => item !== mappedRegion);
    setLockedRegions(nextLockedRegions);
    const nextBoard = { ...boardRef.current, fields: { ...(boardRef.current.fields ?? {}), [LOCKED_REGIONS_FIELD]: JSON.stringify(nextLockedRegions) } };
    boardRef.current = nextBoard;
    setSaved(nextBoard);
    recordFacilitatorEvent("activity-step-changed", [regionId], { action: locked ? "region-locked" : "region-opened", regionId }, undefined, nextBoard);
  }

  function changeReviewMode(enabled: boolean) {
    setReviewMode(enabled);
    recordFacilitatorEvent("iteration-status-changed", [], { status: enabled ? "team-review" : "working" }, enabled ? "team-review" : "working");
  }

  function completeActivity() {
    if (ACTIVITY_ID === "dot-voting") {
      const completion = validateDotVotingCompletion({
        roundState: voteRoundState,
        candidateIds: voteCandidates.map((candidate) => candidate.id),
        votes: voteLedger,
        decision: boardRef.current.fields?.decision,
        objections: boardRef.current.fields?.objections,
        tieResolution: boardRef.current.fields?.[VOTE_TIE_RESOLUTION_FIELD],
      });
      if (!completion.valid) {
        setActiveView("facilitate");
        return;
      }
    }
    setActivityComplete(true);
    setReviewMode(true);
    recordFacilitatorEvent("iteration-status-changed", [], { status: "closed" }, "closed");
    setActiveView("review");
  }

  function carryContributions(targetActivityId: string, contributionIds: readonly string[]) {
    if (role !== "facilitator" || !contributionIds.length || targetActivityId === ACTIVITY_ID) return;
    const sourceActivity = documentRef.current.activities[ACTIVITY_ID];
    if (!sourceActivity) return;
    const sourceRevision = getCurrentRevision(sourceActivity);
    const targetBlueprint = METHOD_BLUEPRINTS[targetActivityId];
    if (!targetBlueprint) return;
    const targetTemplate = ACTIVITY_TEMPLATES.find((template) => template.id === targetActivityId);
    if (!targetTemplate) return;
    const existingTarget = documentRef.current.activities[targetActivityId];
    const targetActivity = existingTarget ?? createActivityState({ activityId: targetActivityId, iterationId: DESIGN_ITERATION_ID, templateId: targetActivityId, actor: FACILITATOR_ACTOR, blueprintDefinition: targetBlueprint as unknown as JsonObject, board: { elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} } });
    const targetRevision = getCurrentRevision(targetActivity);
    const copiedAt = new Date().toISOString();
    const selected = contributions.filter((item) => contributionIds.includes(item.id));
    const targetRegionId = targetBlueprint.regions.find((region) => region.id === "candidates")?.id ?? targetBlueprint.regions[0]?.id;
    const carried = copySelectedContributions({ selections: selected.map((contribution, index) => ({ contribution, sourceRevision, target: { activityId: targetActivityId, iterationId: targetActivity.iterationId, revisionId: targetRevision.id, revisionVersion: targetRevision.version, blueprintVersionId: targetActivity.activeBlueprintVersionId }, copiedBy: FACILITATOR_ACTOR, copiedAt, newContributionId: `carried-${Date.now()}-${index}-${contribution.id}`, targetRegionId })) });
    const manifest = carried.map((item) => ({ id: item.id, sourceContributionId: item.source.id, sourceActivityId: item.source.activityId, sourceRevisionId: item.source.revisionId, sourceBlueprintVersionId: item.source.blueprintVersionId, copiedAt: item.copiedAt, copiedBy: item.copiedBy }));
    const nextTargetRevision = { ...targetRevision, contributions: [...targetRevision.contributions, ...carried.map((item) => ({ ...item.contribution, boardElementIds: [], tags: [...item.contribution.tags, `carried-from:${ACTIVITY_ID}`, `source:${item.source.id}`] }))], fields: { ...targetRevision.fields, __carry_forward_manifest: JSON.stringify([...savedCarryForwardManifest(targetRevision.fields as Record<string, string | undefined>), ...manifest]) } };
    const nextTargetActivity = { ...targetActivity, revisions: targetActivity.revisions.map((revision) => revision.id === targetRevision.id ? nextTargetRevision : revision) };
    const carryEvent = eventFor("output-carried-forward", contributionIds as string[], { targetActivityId, targetMethod: targetTemplate.name, count: carried.length }, FACILITATOR_ACTOR);
    const nextSourceActivity = addEventToActivity(sourceActivity, carryEvent);
    const nextDocument = { ...documentRef.current, updatedAt: copiedAt, activities: { ...documentRef.current.activities, [ACTIVITY_ID]: nextSourceActivity, [targetActivityId]: nextTargetActivity } };
    saveWorkspace(nextDocument, WORKSPACE_STORAGE_KEY); documentRef.current = nextDocument; setWorkspaceDocument(nextDocument); setStatus(`${carried.length} output${carried.length === 1 ? "" : "s"} carried to ${targetTemplate.name}`);
  }

  const viewContributions = contributions.map(contributionForView);
  const availableViews: WorkspaceView[] = role === "facilitator" ? ["board", "participate", "review", "toolkit", "iteration", "report", "facilitate"] : ["board", "participate", "review", "toolkit", "iteration", "report"];
  const viewSwitcher = <nav className="workspace-view-switcher" aria-label="Activity views"><button type="button" className="workspace-home-button" aria-label="Go to workspace home — Board" title="Workspace home" onClick={() => { setActiveView("board"); setNavigationCollapsed(true); setGuideCollapsed(true); setBoardFullscreen(false); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 10.5 8.5-7 8.5 7M5.5 9.5v10h13v-10M9.5 19.5v-6h5v6" /></svg></button>{availableViews.map((view) => <button type="button" className={activeView === view ? "active" : ""} key={view} onClick={() => { setActiveView(view); if (view === "board") { setNavigationCollapsed(true); setGuideCollapsed(true); } }}>{view === "facilitate" ? "Controls" : view === "toolkit" ? "Methods" : view === "iteration" ? "Iteration" : view}</button>)}</nav>;
  const readOnly = role === "observer" || reviewMode || activityComplete;
  const readOnlyReason = activityComplete ? "This activity is complete. The iteration record remains available for review." : reviewMode ? "The facilitator has paused contributions for team review." : undefined;
  const voteBudget = Math.min(5, Math.max(1, Number.parseInt(saved.fields?.["vote-budget"] ?? "3", 10) || 3));
  const voteCandidates = contributions.filter((item) => item.regionId === "candidates");
  const dotVotingCompletion = ACTIVITY_ID === "dot-voting" ? validateDotVotingCompletion({ roundState: voteRoundState, candidateIds: voteCandidates.map((candidate) => candidate.id), votes: voteLedger, decision: saved.fields?.decision, objections: saved.fields?.objections, tieResolution: saved.fields?.[VOTE_TIE_RESOLUTION_FIELD] }) : null;
  const dotVotingActorId = teamMemberIdRef.current || LOCAL_ACTOR.id;
  const dotVotingPanel = ACTIVITY_ID === "dot-voting" ? <DotVotingPanel candidates={voteCandidates} actorId={dotVotingActorId} actorName={LOCAL_ACTOR.displayName} budget={voteBudget} roundState={voteRoundState} votes={voteLedger} facilitator={role === "facilitator"} readOnly={role === "observer" || activityComplete} onCast={castVote} onRetract={retractVote} onRoundStateChange={changeVoteRoundState} tieResolution={saved.fields?.[VOTE_TIE_RESOLUTION_FIELD] ?? ""} onTieResolutionChange={(value) => updateRawField(VOTE_TIE_RESOLUTION_FIELD, value)} completionErrors={role === "facilitator" && !activityComplete ? dotVotingCompletion?.errors : []} /> : null;
  const carryForwardTargets = ACTIVITY_TEMPLATES.filter((template) => IMPLEMENTED_METHOD_IDS.includes(template.id) && template.id !== ACTIVITY_ID);
  const carryForwardPanel = role === "facilitator" && !activityComplete ? <CarryForwardPanel sourceMethodName={activeTemplate.name} contributions={contributions} targets={carryForwardTargets} onCarry={carryContributions} /> : null;
  const layoutNeedsRefresh = boardRef.current.elements.length > 0 && !boardUsesCurrentLayout(boardRef.current);

  if (activeView === "toolkit") return <div className="toolkit-view"><ToolChooser templates={ACTIVITY_TEMPLATES} stages={STAGES} implementedMethodIds={IMPLEMENTED_METHOD_IDS} activeMethodId={ACTIVITY_ID} onSelect={openMethod} />{viewSwitcher}</div>;
  if (activeView === "iteration") return <div className="iteration-view"><LocalIterationShell workspaceId={WORKSPACE_ID} activeActivityId={ACTIVITY_ID} initialIterationId={DESIGN_ITERATION_ID} initialDisplayName={participantName} onActiveIterationChange={openIteration} onParticipantNameChange={updateParticipantName} /><LocalRoomSessionPanel workspaceId={WORKSPACE_ID} activityId={ACTIVITY_ID} iterationId={DESIGN_ITERATION_ID} roomId={launchParams.get("room") ?? undefined} initialDisplayName={participantName} role={role} />{viewSwitcher}</div>;
  if (activeView === "report") return <div className="iteration-report-view"><IterationReport document={workspaceDocument} iterationId={DESIGN_ITERATION_ID} title={`Iteration ${DESIGN_ITERATION_NUMBER} report`} />{viewSwitcher}</div>;

  if (activeView === "participate") return <div className="participation-shell">{ACTIVITY_ID === "empathy-map" ? <ParticipateView contributions={viewContributions} currentUser={currentUser} readOnly={readOnly} readOnlyReason={readOnlyReason} lockedRegions={lockedRegions as EmpathyRegion[]} guidedRegion={guidedRegion as EmpathyRegion | null} activeView={activeView} activityContext={`${activeStageDefinition.label} / Tool`} onViewChange={(view) => setActiveView(view)} onCreate={createContribution} onEdit={editContribution} onDelete={deleteContribution} onMove={moveContribution} /> : <><MethodParticipateView title={activeTemplate.name} context={`${activeStageDefinition.label} / Tool`} regions={activeBlueprint.regions} contributions={contributions} currentUser={currentUser} readOnly={readOnly} readOnlyReason={readOnlyReason} lockedRegions={lockedRegions} guidedRegion={guidedRegion} activeView={activeView} onViewChange={(view) => setActiveView(view)} onCreate={createMethodContribution} onEdit={editContribution} onDelete={deleteContribution} onMove={moveContribution} />{dotVotingPanel}</>}{role === "facilitator" && <button type="button" className="facilitator-shortcut" onClick={() => setActiveView("facilitate")}>Facilitator controls</button>}</div>;

  if (activeView === "review") return <div className="review-view"><header><div><span className="eyebrow">{activeStageDefinition.label.toUpperCase()} / REVIEW</span><h1>{activeTemplate.name} review</h1></div><span>{activityComplete ? "Complete" : `${contributions.length} contributions`}</span></header>{dotVotingPanel}{carryForwardPanel}<div className="review-grid">{activeBlueprint.regions.map((region) => { const contributionRegionId = participationRegionId(region.id); return <section key={region.id}><h2>{region.label}</h2>{contributions.filter((item) => item.regionId === contributionRegionId).map((item) => <article key={item.id}><p>{item.content}</p><small>{item.author.displayName}</small></article>)}</section>; })}</div><ActivityHistory events={workspaceDocument.activities[ACTIVITY_ID]?.events ?? []} actors={historyActors} />{viewSwitcher}</div>;

  if (activeView === "facilitate") return <div className="facilitate-view"><header className="facilitate-heading"><div><span className="eyebrow">{activeStageDefinition.label.toUpperCase()} / FACILITATE</span><h1>Run {activeTemplate.name.toLowerCase()}</h1><p>{activeBlueprint.instructions}</p></div></header>{dotVotingPanel}<FacilitatorControls blueprint={activeBlueprint} phase={reviewMode ? "review" : "active"} initialRegionLocks={Object.fromEntries(activeBlueprint.regions.map((region) => [region.id, lockedRegions.includes(participationRegionId(region.id))]))} initialReviewMode={reviewMode} disabled={role !== "facilitator" || activityComplete} onPromptChange={(prompt) => changePrompt(prompt.regionId)} onRegionLockChange={changeRegionLock} onReviewModeChange={changeReviewMode} onComplete={completeActivity} />{viewSwitcher}</div>;

  return <div className={`app-shell${boardFullscreen ? " app-shell--board-fullscreen" : ""}`}>
    <header className="topbar"><div className="brand" aria-label="FieldNotes - Digital DT Workspace"><FieldNotesMark /><span className="brand-copy"><strong>FieldNotes</strong><small>Digital DT Workspace</small></span></div><nav className="crumb" aria-label="Breadcrumb"><button type="button" className="crumb-link" onClick={() => { setActiveView("iteration"); setNavigationCollapsed(true); setGuideCollapsed(true); }}>PROJECT / SERVICE DISCOVERY</button><span aria-hidden="true">·</span><button type="button" className="crumb-link" aria-current="page" onClick={() => { setActiveView("board"); setNavigationCollapsed(true); setGuideCollapsed(true); }}>ITERATION {String(DESIGN_ITERATION_NUMBER).padStart(2, "0")}</button></nav><div className="top-actions"><div className={`presence ${teamJoined && teamSyncStatus === "connected" ? "is-shared" : "is-local"}`} title={teamJoined && teamSyncStatus === "connected" ? "Connected to the shared room" : "Changes are saved in this browser only"}><i /> {teamJoined && teamSyncStatus === "connected" ? "Shared room" : "Local only"}</div><label className="role-preview">Preview as <select value={role} onChange={(event) => { const nextRole = event.target.value as WorkspaceRole; setRole(nextRole); if (nextRole !== "facilitator") setActiveView((current) => current === "facilitate" ? "board" : current); }}><option value="facilitator">Facilitator</option><option value="participant">Participant</option><option value="observer">Observer</option></select></label><span className="save-state" role="status" aria-live="polite">{status}</span><button className="button light" onClick={saveCheckpoint} disabled={teamJoined && teamSyncStatus === "connected" && role !== "facilitator"}>Save checkpoint</button><button className="button dark" onClick={exportBoard}>Export</button></div></header>
    <main className={`workspace${navigationCollapsed ? " workspace--navigation-collapsed" : ""}${guideCollapsed ? " workspace--guide-collapsed" : ""}`}>
      {(!navigationCollapsed || !guideCollapsed) && <button type="button" className="workspace-drawer-backdrop" aria-label="Close open workspace panels" onClick={() => { setNavigationCollapsed(true); setGuideCollapsed(true); }} />}
      <aside className="rail" id="workspace-navigation" aria-label="Design cycle and methods"><div className="rail-label">THE CYCLE</div>{STAGES.map((stage) => { const starterId = STAGE_STARTER_METHOD_IDS[stage.id]; const starter = IMPLEMENTED_TEMPLATES.find((template) => template.id === starterId) ?? IMPLEMENTED_TEMPLATES.find((template) => template.stage === stage.id); return <a className={`stage ${activeStage === stage.id ? "active" : ""}`} key={stage.id} href={starter ? activityHref(starter.id) : "#"} aria-current={activeStage === stage.id ? "step" : undefined} aria-label={`${String(stage.number).padStart(2, "0")} ${stage.label}${starter ? ` — opens ${starter.name}` : " — no method available yet"}`}><span>{String(stage.number).padStart(2, "0")}</span>{stage.shortLabel}</a>; })}<div className="rail-divider" /><div className="rail-label">METHODS IN {activeStageDefinition.shortLabel.toUpperCase()}</div>{stageMethods.map((template) => <a className={`activity ${template.id === ACTIVITY_ID ? "active" : ""}`} href={activityHref(template.id)} aria-current={template.id === ACTIVITY_ID ? "page" : undefined} key={template.id}><span className={`activity-dot ${template.id === ACTIVITY_ID ? "" : "muted"}`} />{template.name}</a>)}</aside>
      <section className="canvas-area"><div className="canvas-heading"><div><div className="eyebrow">{activeStageDefinition.label.toUpperCase()} / TOOL</div><h1>{activeTemplate.name}</h1><p>{subtitle}</p></div><div className="canvas-heading-actions"><button type="button" className={`button sync-action ${manualSyncState === "synced" ? "sync-confirmed" : ""}`} onClick={saveAndSyncNow} disabled={role === "observer" || manualSyncState === "syncing"} title={teamToken ? "Save pending board edits and immediately send the latest version to the shared room" : "Save locally; a facilitator must start a shared room before it can sync"}>{teamToken ? manualSyncState === "syncing" ? "Syncing…" : manualSyncState === "synced" ? "✓ Synced" : "Save & sync" : role === "facilitator" ? "Save & share" : "Save locally"}</button>{role === "facilitator" && <button className="button light" onClick={() => setActiveView("facilitate")}>Controls</button>}<button className="button light" onClick={resetTemplate}>Reset template</button></div></div><div className="workspace-panel-controls" aria-label="Workspace panels"><button type="button" className="sidebar-toggle" onClick={() => setNavigationCollapsed((collapsed) => !collapsed)} aria-label={navigationCollapsed ? "Show design cycle navigation" : "Hide design cycle navigation"} aria-controls="workspace-navigation" aria-expanded={!navigationCollapsed}><span aria-hidden="true">{navigationCollapsed ? "☷" : "‹"}</span><span>{navigationCollapsed ? "Show cycle" : "Hide cycle"}</span></button><button type="button" className="sidebar-toggle" onClick={() => setGuideCollapsed((collapsed) => !collapsed)} aria-label={guideCollapsed ? "Show method guide" : "Hide method guide"} aria-controls="workspace-guide" aria-expanded={!guideCollapsed}><span aria-hidden="true">{guideCollapsed ? "▤" : "›"}</span><span>{guideCollapsed ? "Show guide" : "Hide guide"}</span></button></div><div className="board-context"><div><strong>{layoutNeedsRefresh ? "Updated board layout available" : resizeSpaces ? "Resize method spaces" : "Sticky-note workspace"}</strong><span>{layoutNeedsRefresh ? "The method template has changed. Apply the refreshed composition; existing contributions will be preserved." : resizeSpaces ? "Drag a space’s lower-right handle to give the team more room. Finish resizing to lock the frames again." : "Add observations in Participate, then arrange and connect them on this board."}</span></div><span className="board-note-count">{contributions.length} {contributions.length === 1 ? "NOTE" : "NOTES"}</span><button type="button" className="board-context-button" onClick={fitBoard}>Fit board</button>{!layoutNeedsRefresh && <button type="button" className={`board-context-button${resizeSpaces ? " is-active" : ""}`} onClick={() => setResizeSpacesMode(!resizeSpaces)} disabled={role === "observer" || reviewMode || activityComplete} aria-pressed={resizeSpaces}>{resizeSpaces ? "Done resizing" : "Resize spaces"}</button>}{layoutNeedsRefresh && role === "facilitator" && <button type="button" className="board-context-button" onClick={migrateBoardLayout}>Apply updated layout</button>}<button type="button" className="board-add-note" onClick={() => setActiveView("participate")} disabled={role === "observer" || reviewMode || activityComplete}>+ Add sticky note</button><button type="button" className="board-fullscreen-button" onClick={() => setBoardFullscreen((current) => !current)} aria-pressed={boardFullscreen} aria-label={boardFullscreen ? "Exit fullscreen whiteboard" : "Expand whiteboard to fullscreen"} title={boardFullscreen ? "Exit fullscreen (Esc)" : "Expand whiteboard to fullscreen"}><span aria-hidden="true">{boardFullscreen ? "×" : "⛶"}</span><span>{boardFullscreen ? "Exit fullscreen" : "Full screen"}</span></button></div>{viewSwitcher}<div className="canvas-wrap"><Suspense fallback={<div className="canvas-loading"><strong>Opening the board…</strong><span>The participation view remains available while the drawing tools load.</span></div>}><ExcalidrawCanvas initialData={initialData} onChange={onChange} viewModeEnabled={role === "observer" || reviewMode || activityComplete} excalidrawAPI={registerCanvasApi} /></Suspense></div></section>
      <aside className="inspector" id="workspace-guide" aria-label="Method guide and iteration notes"><div className="inspector-section"><div className="eyebrow">GUIDE</div><h2>{activeTemplate.purpose}</h2><p>{activeTemplate.teamFormat} {activeTemplate.whenToUse}</p></div><div className="inspector-section outcome"><div className="eyebrow">TEAM NOTES</div>{activeTemplate.fields.map((field) => <label key={field.id}>{field.label}{field.required ? " *" : ""}{field.type === "textarea" ? <textarea value={saved.fields?.[field.id] ?? ""} onChange={(event) => updateField(field, event.target.value)} placeholder={field.placeholder} disabled={role === "observer"} /> : <input type={field.type === "number" ? "number" : field.type === "url" ? "url" : "text"} min={field.type === "number" ? 1 : undefined} max={field.id === "vote-budget" ? 5 : undefined} value={saved.fields?.[field.id] ?? ""} onChange={(event) => updateField(field, event.target.value)} placeholder={field.placeholder} disabled={role === "observer"} />}</label>)}</div><div className="inspector-section iterations"><div className="eyebrow">CHECKPOINT HISTORY</div>{checkpoints.length === 0 ? <p className="empty-history">Save a checkpoint when the team has captured enough evidence to review.</p> : <div className="history-list">{checkpoints.slice().reverse().map((checkpoint) => <button className="history-item" key={checkpoint.id} onClick={() => restoreCheckpoint(checkpoint.id)}><span><strong>{checkpoint.label}</strong><small>{new Date(checkpoint.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></span><span className="restore-label">Restore as new version</span></button>)}</div>}</div><div className="inspector-section team"><div className="eyebrow">TEAM PRESENCE</div><p>{teamJoined && teamSyncStatus === "connected" ? "This browser is connected to the shared room. Board changes are broadcast to connected members." : "This board is local to this browser. Open Iteration to start or join a shared room."}</p></div><div className="inspector-section source"><div className="eyebrow">SOURCE</div><p>{activeTemplate.source.book}<br /><span>{activeTemplate.source.toolOrChapter} · printed p. {activeTemplate.source.printedPages}</span></p><p className="adaptation">{activeTemplate.source.adaptationNote}</p></div></aside>
    </main>
  </div>;
}

export default App;

const root = document.getElementById("root");
if (root) {
  const runtime = window as typeof window & { __dtWorkspaceRoot?: ReturnType<typeof createRoot> };
  runtime.__dtWorkspaceRoot ??= createRoot(root);
  runtime.__dtWorkspaceRoot.render(<App />);
}
