import type { ActivityBlueprintDefinition, FacilitatorControl } from "../domain/blueprint-model";
import { EMPATHY_MAP_BLUEPRINT } from "./empathy-map-blueprint";

const commonControls: readonly FacilitatorControl[] = [
  {
    id: "round-timer",
    kind: "timer",
    label: "Contribution timer",
    description: "Set a visible timebox for the current contribution step.",
    enabledByDefault: false,
    availableInStates: ["setup", "active"],
    options: [
      { id: "five-minutes", label: "5 minutes", value: 5 },
      { id: "ten-minutes", label: "10 minutes", value: 10 },
      { id: "fifteen-minutes", label: "15 minutes", value: 15 },
    ],
  },
  {
    id: "region-locks",
    kind: "region-lock",
    label: "Contribution controls",
    description: "Open or close contribution to each part of the method.",
    enabledByDefault: true,
    availableInStates: ["setup", "active", "review"],
  },
  {
    id: "guided-prompts",
    kind: "prompt-reveal",
    label: "Guided prompts",
    description: "Reveal one method prompt at a time while the whole framework remains visible.",
    enabledByDefault: false,
    availableInStates: ["setup", "active"],
  },
  {
    id: "review-mode",
    kind: "review",
    label: "Team review",
    description: "Pause contribution and review the team's work together.",
    enabledByDefault: true,
    availableInStates: ["active", "review"],
  },
  {
    id: "complete-method",
    kind: "completion",
    label: "Complete method",
    description: "Finish this activity after review and retain unresolved questions.",
    enabledByDefault: true,
    availableInStates: ["review"],
  },
] as const;

export const PROBLEM_STATEMENT_BLUEPRINT: ActivityBlueprintDefinition = {
  methodId: "problem-statement",
  name: "Problem statement",
  instructions: "Develop several definitions from problem, actor and context before consolidating the shared challenge.",
  participantCanModifyFramework: false,
  observerCanContribute: false,
  regions: [
    { id: "problem", label: "Problem", description: "What is the problem, and why is it a problem?", accent: "blue", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What is happening, and why does it matter?" },
    { id: "actor", label: "Actor / need", description: "Who experiences the problem or has a need?", accent: "green", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Who experiences this situation, and what do they need?" },
    { id: "context", label: "Context", description: "When and where does the problem occur?", accent: "sand", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "When and where does the problem become visible?" },
    { id: "current-response", label: "Current response", description: "How is the problem addressed today?", accent: "dark", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "How do people handle this today, including workarounds?" },
  ],
  facilitatorControls: commonControls,
};

export const HOW_MIGHT_WE_BLUEPRINT: ActivityBlueprintDefinition = {
  methodId: "how-might-we",
  name: "How might we",
  instructions: "Turn evidence and needs into several open questions, then select a framing that invites many solutions.",
  participantCanModifyFramework: false,
  observerCanContribute: false,
  regions: [
    { id: "evidence", label: "Evidence / need", description: "Ground the question in a finding from Understand or Observe.", accent: "green", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Which finding or need should this question address?" },
    { id: "questions", label: "Question candidates", description: "Write several questions beginning with How might we and an action verb.", accent: "sand", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "How might we…? Keep the wording open enough for many answers." },
    { id: "scope-check", label: "Scope check", description: "Test whether a question is too broad, too narrow or solution-led.", accent: "blue", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Would this question inspire several distinct solutions?" },
    { id: "selected-framing", label: "Selected framing", description: "Retain the chosen question and why the team selected it.", accent: "dark", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Which framing will the team carry into ideation, and why?" },
  ],
  facilitatorControls: commonControls,
};

export const BRAINWRITING_BLUEPRINT: ActivityBlueprintDefinition = {
  methodId: "brainwriting",
  name: "Brainwriting",
  instructions: "Contribute quietly in timed rounds, then build on previous ideas before clustering and selecting.",
  participantCanModifyFramework: false,
  observerCanContribute: false,
  regions: [
    { id: "round-1", label: "Round 1 · Start", description: "Write distinct first ideas without discussion.", accent: "blue", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Add one initial idea per card." },
    { id: "round-2", label: "Round 2 · Build", description: "Read earlier ideas and respond with new possibilities.", accent: "green", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Build on, combine or redirect an idea from the previous round." },
    { id: "round-3", label: "Round 3 · Extend", description: "Develop the emerging ideas further.", accent: "sand", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Push an existing possibility further or add a different response." },
    { id: "round-4", label: "Round 4 · Build", description: "Continue the silent build-on sequence.", accent: "blue", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Respond to what is already here with another development." },
    { id: "round-5", label: "Round 5 · Extend", description: "Look for combinations, reversals and overlooked directions.", accent: "green", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Add a new response that changes or strengthens a previous idea." },
    { id: "round-6", label: "Round 6 · Finish", description: "Complete the final silent contribution round.", accent: "sand", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Complete the sequence with one final development or alternative." },
    { id: "cluster", label: "Cluster / carry forward", description: "Group related ideas and retain the ones to evaluate.", accent: "dark", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Which ideas or combinations should move forward?" },
  ],
  facilitatorControls: commonControls,
};

export const DOT_VOTING_BLUEPRINT: ActivityBlueprintDefinition = {
  methodId: "dot-voting",
  name: "Dot voting",
  instructions: "Agree criteria and an equal vote budget before voting, then record the decision separately from the tally.",
  participantCanModifyFramework: false,
  observerCanContribute: false,
  regions: [
    { id: "criteria", label: "Criteria", description: "Make the basis for comparison visible before voting.", accent: "sand", suggestedWidth: 520, suggestedHeight: 260, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Which agreed criterion should guide this vote?" },
    { id: "candidates", label: "Candidates", description: "Place one idea or concept per candidate card.", accent: "blue", suggestedWidth: 520, suggestedHeight: 340, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Which idea or concept should the team compare?" },
    { id: "decision", label: "Decision", description: "Record what the team will pursue and why.", accent: "green", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What will the team pursue after seeing the tally?" },
    { id: "objections", label: "Objections / parking lot", description: "Retain minority views and useful ideas not selected now.", accent: "dark", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What concern or parked idea must remain visible?" },
  ],
  facilitatorControls: commonControls,
};

export const STORYBOARD_PROTOTYPE_BLUEPRINT: ActivityBlueprintDefinition = {
  methodId: "storyboard-prototype",
  name: "Storyboard / prototype",
  instructions: "Make the selected concept tangible across the before, during and after moments the team needs to learn about.",
  participantCanModifyFramework: false,
  observerCanContribute: false,
  regions: [
    { id: "frame-1", label: "1 · Before", description: "Set the context, trigger and user goal.", accent: "blue", suggestedWidth: 520, suggestedHeight: 320, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What happens immediately before the concept is used?" },
    { id: "frame-2", label: "2 · During", description: "Show the key interaction or service moment.", accent: "green", suggestedWidth: 520, suggestedHeight: 320, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What does the person see, do or decide?" },
    { id: "frame-3", label: "3 · After", description: "Show the result and the remaining uncertainty.", accent: "sand", suggestedWidth: 520, suggestedHeight: 320, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What changes, and what should the team test next?" },
  ],
  facilitatorControls: commonControls,
};

export const TESTING_SHEET_BLUEPRINT: ActivityBlueprintDefinition = {
  methodId: "testing-sheet",
  name: "Testing sheet",
  instructions: "Plan a small test around a learning question, observable signals and a clear next move.",
  participantCanModifyFramework: false,
  observerCanContribute: false,
  regions: [
    { id: "question", label: "Learning question", description: "Name the uncertainty the test should address.", accent: "blue", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What do we need to learn?" },
    { id: "signals", label: "Observable signals", description: "Agree what the team will look for during the test.", accent: "green", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What would we be able to see or hear?" },
    { id: "observations", label: "Observations", description: "Record what happened before interpreting it.", accent: "sand", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What happened in the test?" },
    { id: "conclusion", label: "Conclusion / next move", description: "Turn observations into a decision about the next iteration.", accent: "dark", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What changed in our understanding, and what will we try next?" },
  ],
  facilitatorControls: commonControls,
};

export const REFLECTION_BLUEPRINT: ActivityBlueprintDefinition = {
  methodId: "reflection",
  name: "Reflection",
  instructions: "Make the team's learning visible, then choose what to keep, change and investigate in the next iteration.",
  participantCanModifyFramework: false,
  observerCanContribute: false,
  regions: [
    { id: "like", label: "I like", description: "Keep what supported the work or learning.", accent: "green", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What helped the team learn or collaborate?" },
    { id: "wish", label: "I wish", description: "Name what should improve in the next attempt.", accent: "sand", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What would you change next time?" },
    { id: "wonder", label: "I wonder", description: "Keep an unresolved question visible.", accent: "blue", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What remains uncertain or worth exploring?" },
    { id: "next-iteration", label: "Next iteration", description: "Capture the next learning move and owner.", accent: "dark", suggestedWidth: 520, suggestedHeight: 300, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What will the team do next, and who will carry it?" },
  ],
  facilitatorControls: commonControls,
};

export const STAKEHOLDER_MAP_BLUEPRINT: ActivityBlueprintDefinition = {
  methodId: "stakeholder-map",
  name: "Stakeholder map",
  instructions: "Map affected people and influencing roles, show important relationships, then identify whose perspective is missing.",
  participantCanModifyFramework: false,
  observerCanContribute: false,
  regions: [
    { id: "directly-affected", label: "Directly affected", description: "People who experience the situation or its outcomes.", accent: "blue", suggestedWidth: 720, suggestedHeight: 460, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Name a person or group, their role, and how the situation affects them." },
    { id: "influencers", label: "Influencers and delivery roles", description: "People or groups who shape decisions, access, or delivery.", accent: "green", suggestedWidth: 720, suggestedHeight: 460, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Who influences or delivers the current experience? Note their role and influence." },
    { id: "relationships", label: "Relationships and gaps", description: "Show important dependencies, tensions, and voices still to involve.", accent: "sand", suggestedWidth: 720, suggestedHeight: 460, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Which relationship matters, and whose voice is still missing? Use labels or connectors on the board." },
  ],
  facilitatorControls: commonControls,
};

export const INTERVIEW_FOR_EMPATHY_BLUEPRINT: ActivityBlueprintDefinition = {
  methodId: "interview-for-empathy",
  name: "Interview for empathy",
  instructions: "Ask open prompts about specific experiences. Capture participant words and observable actions separately from team interpretation.",
  participantCanModifyFramework: false,
  observerCanContribute: false,
  regions: [
    { id: "quotes", label: "Participant words", description: "Capture short, faithful quotes with a source or time reference.", accent: "blue", suggestedWidth: 680, suggestedHeight: 440, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Record the participant's words faithfully and include an evidence reference." },
    { id: "observations", label: "Observed actions", description: "Record actions, including workarounds and context.", accent: "green", suggestedWidth: 680, suggestedHeight: 440, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What did the person do? Describe observable action and context." },
    { id: "interpretations", label: "Team interpretations", description: "Mark inferences as hypotheses, not participant statements.", accent: "sand", suggestedWidth: 680, suggestedHeight: 440, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What might this mean? Label this as a team interpretation to check." },
    { id: "follow-ups", label: "Follow-up questions", description: "Keep uncertainties and next questions visible.", accent: "dark", suggestedWidth: 680, suggestedHeight: 440, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What remains unclear, and what would you ask next?" },
  ],
  facilitatorControls: commonControls,
};

export const CUSTOMER_JOURNEY_BLUEPRINT: ActivityBlueprintDefinition = {
  methodId: "customer-journey",
  name: "Customer journey",
  instructions: "Agree the person, goal, and start/end boundaries. Map evidence through the journey in order, noting actions, feelings, pain points, and opportunities.",
  participantCanModifyFramework: false,
  observerCanContribute: false,
  regions: [
    { id: "journey-stage-1", label: "1 · Entry", description: "Actions, feelings, pain points, and opportunities at entry.", accent: "blue", suggestedWidth: 640, suggestedHeight: 460, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What does the person do and feel at entry? Mark pain points and opportunities; cite evidence." },
    { id: "journey-stage-2", label: "2 · Core experience", description: "Central steps and handoffs in sequence.", accent: "green", suggestedWidth: 640, suggestedHeight: 460, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What happens in the core experience? Note actions, handoffs, feelings, and friction with evidence." },
    { id: "journey-stage-3", label: "3 · Outcome", description: "Completion, aftermath, and unresolved needs.", accent: "sand", suggestedWidth: 640, suggestedHeight: 460, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What happens afterward? Capture outcome, lingering pain points, and possible opportunities." },
  ],
  facilitatorControls: commonControls,
};

export const INSIGHT_CARDS_BLUEPRINT: ActivityBlueprintDefinition = {
  methodId: "insight-cards",
  name: "Insight cards",
  instructions: "State a finding, attach its evidence, explain the implication, and expose what remains uncertain before framing a point of view.",
  participantCanModifyFramework: false,
  observerCanContribute: false,
  regions: [
    { id: "findings", label: "Findings", description: "State concise evidence-led findings.", accent: "blue", suggestedWidth: 700, suggestedHeight: 440, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What pattern or unexpected observation did we find?" },
    { id: "evidence", label: "Evidence references", description: "Link findings to source material, quotes, or observations.", accent: "green", suggestedWidth: 700, suggestedHeight: 440, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Which source, quote, or observation supports this finding?" },
    { id: "implications", label: "Implications", description: "Describe why the finding matters for people and the challenge.", accent: "sand", suggestedWidth: 700, suggestedHeight: 440, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Why does this matter to the person or challenge?" },
    { id: "uncertainties", label: "Uncertainties", description: "Keep assumptions and unanswered questions visible.", accent: "dark", suggestedWidth: 700, suggestedHeight: 440, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What is still an inference or needs more evidence?" },
  ],
  facilitatorControls: commonControls,
};

export const FEEDBACK_CAPTURE_GRID_BLUEPRINT: ActivityBlueprintDefinition = {
  methodId: "feedback-capture-grid",
  name: "Feedback capture grid",
  instructions: "Identify the prototype version and test context. Record reactions first, then separate questions and ideas for follow-up.",
  participantCanModifyFramework: false,
  observerCanContribute: false,
  regions: [
    { id: "likes", label: "Likes", description: "Positive reactions close to participant words.", accent: "green", suggestedWidth: 680, suggestedHeight: 440, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What did the participant like or value? Capture words or actions and source." },
    { id: "critiques", label: "Critiques", description: "Confusion, friction, and negative reactions.", accent: "sand", suggestedWidth: 680, suggestedHeight: 440, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "Where did the participant struggle, hesitate, or express concern?" },
    { id: "questions", label: "Questions", description: "What the team needs to ask or understand.", accent: "blue", suggestedWidth: 680, suggestedHeight: 440, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What questions or uncertainties did the test reveal?" },
    { id: "ideas", label: "Ideas", description: "Possible changes distinct from observed feedback.", accent: "dark", suggestedWidth: 680, suggestedHeight: 440, frameLockedForParticipants: true, participantContributionAllowed: true, contributionPrompt: "What change could be explored? Keep it distinct from the observed feedback." },
  ],
  facilitatorControls: commonControls,
};

export const IMPLEMENTATION_ACTIONS_BLUEPRINT: ActivityBlueprintDefinition = {
  methodId: "implementation-actions",
  name: "Implementation actions",
  instructions: "Break the selected direction into concrete actions with accountable owners, dates, intended results, and a later result review.",
  participantCanModifyFramework: false,
  observerCanContribute: false,
  regions: [],
  facilitatorControls: commonControls,
};

export const METHOD_BLUEPRINTS: Readonly<Record<string, ActivityBlueprintDefinition>> = {
  "problem-statement": PROBLEM_STATEMENT_BLUEPRINT,
  "empathy-map": EMPATHY_MAP_BLUEPRINT,
  "how-might-we": HOW_MIGHT_WE_BLUEPRINT,
  brainwriting: BRAINWRITING_BLUEPRINT,
  "dot-voting": DOT_VOTING_BLUEPRINT,
  "storyboard-prototype": STORYBOARD_PROTOTYPE_BLUEPRINT,
  "testing-sheet": TESTING_SHEET_BLUEPRINT,
  reflection: REFLECTION_BLUEPRINT,
  "stakeholder-map": STAKEHOLDER_MAP_BLUEPRINT,
  "interview-for-empathy": INTERVIEW_FOR_EMPATHY_BLUEPRINT,
  "customer-journey": CUSTOMER_JOURNEY_BLUEPRINT,
  "insight-cards": INSIGHT_CARDS_BLUEPRINT,
  "feedback-capture-grid": FEEDBACK_CAPTURE_GRID_BLUEPRINT,
  "implementation-actions": IMPLEMENTATION_ACTIONS_BLUEPRINT,
};

export const IMPLEMENTED_METHOD_IDS = Object.keys(METHOD_BLUEPRINTS);
