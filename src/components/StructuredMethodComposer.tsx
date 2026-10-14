import { FormEvent, useMemo, useState } from "react";
import type { BlueprintRegion } from "../domain/blueprint-model";

type StructuredMethod = "stakeholder-map" | "customer-journey" | "insight-cards";

interface StructuredMethodComposerProps {
  method: StructuredMethod;
  region: BlueprintRegion;
  disabled?: boolean;
  onCreate: (content: string) => void;
}

type Field = { id: string; label: string; placeholder: string; required?: boolean };

const FIELDS: Record<StructuredMethod, readonly Field[]> = {
  "stakeholder-map": [
    { id: "who", label: "Person or group", placeholder: "e.g. Frontline support team", required: true },
    { id: "role", label: "Role / stake", placeholder: "What role do they play or what is at stake?" },
    { id: "influence", label: "Influence or impact", placeholder: "High influence, directly affected, depends on…" },
    { id: "evidence", label: "Evidence / relationship", placeholder: "Source, relationship, tension, or missing voice" },
  ],
  "customer-journey": [
    { id: "action", label: "Action", placeholder: "What does the person do at this stage?", required: true },
    { id: "feeling", label: "Feeling", placeholder: "What might they feel or expect?" },
    { id: "friction", label: "Pain point", placeholder: "Where is there friction, delay, or uncertainty?" },
    { id: "opportunity", label: "Opportunity / evidence", placeholder: "What could improve, and what supports this observation?" },
  ],
  "insight-cards": [
    { id: "finding", label: "Finding", placeholder: "State the pattern or unexpected observation", required: true },
    { id: "evidence", label: "Evidence reference", placeholder: "Quote, observation, interview, or source" },
    { id: "implication", label: "Implication", placeholder: "Why does this matter for the person or challenge?" },
    { id: "uncertainty", label: "Uncertainty", placeholder: "What is still an inference or needs testing?" },
  ],
};

const labels: Record<StructuredMethod, string> = {
  "stakeholder-map": "Add stakeholder",
  "customer-journey": "Add journey moment",
  "insight-cards": "Add insight card",
};

/**
 * A method-aware contribution form. It keeps structured method evidence in the
 * existing Contribution record as a readable, portable text card, so the same
 * content can be rendered on the board, exported, and carried forward without
 * introducing a second persistence model.
 */
export function StructuredMethodComposer({ method, region, disabled = false, onCreate }: StructuredMethodComposerProps) {
  const fields = FIELDS[method];
  const [values, setValues] = useState<Record<string, string>>({});
  const hasRequired = useMemo(() => fields.filter((field) => field.required).every((field) => values[field.id]?.trim()), [fields, values]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled || !hasRequired) return;
    const lines = fields
      .map((field) => ({ label: field.label, value: values[field.id]?.trim() ?? "" }))
      .filter(({ value }) => value)
      .map(({ label, value }) => `${label}: ${value}`);
    onCreate(lines.join("\n"));
    setValues({});
  }

  return <form className="structured-composer" onSubmit={submit} aria-label={`${labels[method]} for ${region.label}`}>
    <div className="structured-composer-heading">
      <div><span className="structured-composer-kicker">Structured capture</span><strong>{labels[method]}</strong></div>
      <span>{region.label}</span>
    </div>
    <div className="structured-composer-fields">
      {fields.map((field, index) => <label key={field.id}>
        <span>{field.label}{field.required ? " *" : ""}</span>
        <textarea
          id={`${method}-${region.id}-${field.id}`}
          rows={index === 0 ? 2 : 1}
          value={values[field.id] ?? ""}
          placeholder={field.placeholder}
          required={field.required}
          aria-required={field.required || undefined}
          disabled={disabled}
          onChange={(event) => setValues((current) => ({ ...current, [field.id]: event.target.value }))}
        />
      </label>)}
    </div>
    <div className="structured-composer-footer"><small>Labels keep evidence separate from interpretation.</small><button type="submit" disabled={disabled || !hasRequired}>{labels[method]}</button></div>
  </form>;
}

export function structuredMethodForTitle(title: string): StructuredMethod | null {
  const normalized = title.trim().toLowerCase();
  if (normalized === "stakeholder map") return "stakeholder-map";
  if (normalized === "customer journey") return "customer-journey";
  if (normalized === "insight cards") return "insight-cards";
  return null;
}
