// SPDX-License-Identifier: MIT
export {
  definitionOf,
  indexSpecDoc,
  isSpecId,
  normalizeTerm,
  SPEC_FILES,
  SPEC_KINDS,
  specKindOf,
} from './index-doc';
export type { SpecDoc, SpecKind, SpecSection, TaskStatus } from './index-doc';
export { buildSpecGraph, MAX_RELATED, MAX_TERM_SECTIONS } from './graph';
export type { Coverage, Progress, SectionRef, SectionTrace, SpecGraph, TraceLink } from './graph';
export { SPEC_DEBOUNCE_MS, SpecModel } from './model';
export type { SpecModelOptions, SpecSnapshot } from './model';
