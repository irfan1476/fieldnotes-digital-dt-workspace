/**
 * Domain types for the book-based design-thinking workspace.
 *
 * These types deliberately contain product metadata and concise original
 * prompts. They do not reproduce text, illustrations, or scans from either
 * source book.
 */

export const DESIGN_THINKING_STAGES = [
  'understand',
  'observe',
  'define-point-of-view',
  'ideate',
  'prototype',
  'test',
  'reflect',
] as const;

export type DesignThinkingStage = (typeof DESIGN_THINKING_STAGES)[number];

export type ActivityStatus = 'not-started' | 'active' | 'reviewed';
export type ActivityFormat = 'board' | 'form' | 'board-and-form';
export type FieldType = 'text' | 'textarea' | 'url' | 'date' | 'number' | 'select';

export interface SourceReference {
  /** Human-readable source title, kept short for the UI. */
  readonly book: 'The Design Thinking Toolbox' | 'Design Thinking';
  readonly toolOrChapter: string;
  /** Printed page numbers in the supplied edition, not PDF page indexes. */
  readonly printedPages: string;
  readonly version: '2020 supplied edition';
  /** Explains how this product adapts the method. */
  readonly adaptationNote: string;
}

export interface TemplateField {
  readonly id: string;
  readonly label: string;
  readonly type: FieldType;
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly helpText?: string;
  readonly options?: readonly string[];
}

export interface BoardRegion {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly accent: 'blue' | 'green' | 'sand' | 'dark' | 'neutral';
  readonly suggestedWidth: number;
  readonly suggestedHeight: number;
}

export interface ActivityTemplate {
  readonly id: string;
  readonly stage: DesignThinkingStage;
  readonly name: string;
  readonly shortDescription: string;
  readonly purpose: string;
  readonly whenToUse: string;
  readonly teamFormat: string;
  readonly suggestedMinutes: number;
  readonly format: ActivityFormat;
  readonly prompt: string;
  readonly source: SourceReference;
  readonly fields: readonly TemplateField[];
  readonly boardRegions: readonly BoardRegion[];
  readonly retainedOutputs: readonly string[];
}

export interface ActivityInstance {
  readonly id: string;
  readonly templateId: string;
  readonly stage: DesignThinkingStage;
  readonly iterationId: string;
  readonly title: string;
  readonly status: ActivityStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt?: string;
}

export interface StageDefinition {
  readonly id: DesignThinkingStage;
  readonly number: number;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly color: 'blue' | 'green' | 'sand' | 'dark' | 'neutral';
}

