// SPDX-License-Identifier: MIT
// Graf trace antar dokumen spec: definisi ID, rujukan masuk/keluar, section terkait lewat istilah
// kode yang sama, coverage requirement oleh task, dan progres task.
import {
  SPEC_KINDS,
  type SpecDoc,
  type SpecKind,
  type SpecSection,
  type TaskStatus,
} from './index-doc';

/** Istilah yang muncul di lebih dari sekian section dianggap terlalu umum untuk menautkan. */
export const MAX_TERM_SECTIONS = 5;
/** Jumlah maksimal section terkait (lewat istilah) yang ditampilkan per section. */
export const MAX_RELATED = 6;

export interface SectionRef {
  readonly kind: SpecKind;
  readonly index: number;
}

export interface TraceLink {
  readonly kind: SpecKind;
  readonly index: number;
  readonly id: string | null;
  readonly title: string;
  readonly slug: string;
  readonly snippet: string;
  readonly status: TaskStatus | null;
  /** Untuk tautan lewat istilah: istilah yang sama-sama disebut. */
  readonly terms: readonly string[];
}

export interface SectionTrace {
  /** Section yang dirujuk oleh section ini (lewat ID). */
  readonly outgoing: readonly TraceLink[];
  /** Section yang merujuk ID section ini. */
  readonly incoming: readonly TraceLink[];
  /** Section di dokumen lain yang menyebut istilah kode yang sama. */
  readonly related: readonly TraceLink[];
}

export interface Coverage {
  readonly total: number;
  readonly covered: number;
  /** Requirement ber-ID yang belum dirujuk task mana pun. */
  readonly uncovered: readonly TraceLink[];
}

export interface Progress {
  readonly total: number;
  readonly done: number;
  readonly doing: number;
}

export interface SpecGraph {
  readonly docs: Readonly<Partial<Record<SpecKind, SpecDoc>>>;
  /** ID → section yang mendefinisikannya (definisi pertama bila ganda). */
  readonly definitions: ReadonlyMap<string, SectionRef>;
  /** ID yang didefinisikan lebih dari sekali. */
  readonly duplicates: readonly string[];
  /** Null bila dokumen requirements atau tasks tidak ada. */
  readonly coverage: Coverage | null;
  /** Progres task di `tasks.md` (section ber-ID, atau checkbox bila tidak ada); null bila kosong. */
  readonly progress: Progress | null;
  section(kind: SpecKind, index: number): SpecSection | null;
  link(ref: SectionRef): TraceLink | null;
  trace(kind: SpecKind, index: number): SectionTrace;
}

const EMPTY_TRACE: SectionTrace = { outgoing: [], incoming: [], related: [] };

function toLink(kind: SpecKind, section: SpecSection, terms: readonly string[] = []): TraceLink {
  return {
    kind,
    index: section.index,
    id: section.id,
    title: section.title,
    slug: section.slug,
    snippet: section.snippet,
    status: section.status,
    terms,
  };
}

function progressOf(tasks: SpecDoc | undefined): Progress | null {
  if (!tasks) return null;
  const withId = tasks.sections.filter((s) => s.id !== null && s.status !== null);
  if (withId.length > 0) {
    return {
      total: withId.length,
      done: withId.filter((s) => s.status === 'done').length,
      doing: withId.filter((s) => s.status === 'doing').length,
    };
  }
  const { done, total } = tasks.checkboxes;
  return total > 0 ? { total, done, doing: 0 } : null;
}

export function buildSpecGraph(docs: Partial<Record<SpecKind, SpecDoc>>): SpecGraph {
  const present = SPEC_KINDS.filter((kind) => docs[kind] !== undefined);
  const definitions = new Map<string, SectionRef>();
  const duplicates = new Set<string>();
  for (const kind of present) {
    for (const section of docs[kind]?.sections ?? []) {
      if (!section.id) continue;
      if (definitions.has(section.id)) duplicates.add(section.id);
      else definitions.set(section.id, { kind, index: section.index });
    }
  }

  const section = (kind: SpecKind, index: number): SpecSection | null =>
    docs[kind]?.sections[index] ?? null;
  const link = (ref: SectionRef): TraceLink | null => {
    const found = section(ref.kind, ref.index);
    return found ? toLink(ref.kind, found) : null;
  };

  // Rujukan masuk: ID → section yang menyebutnya.
  const incoming = new Map<string, SectionRef[]>();
  // Frekuensi istilah: istilah → section yang menyebutnya.
  const termSections = new Map<string, SectionRef[]>();
  for (const kind of present) {
    for (const s of docs[kind]?.sections ?? []) {
      for (const ref of s.refs) {
        if (!definitions.has(ref)) continue;
        const list = incoming.get(ref) ?? [];
        list.push({ kind, index: s.index });
        incoming.set(ref, list);
      }
      for (const term of s.terms) {
        const list = termSections.get(term) ?? [];
        list.push({ kind, index: s.index });
        termSections.set(term, list);
      }
    }
  }

  const trace = (kind: SpecKind, index: number): SectionTrace => {
    const self = section(kind, index);
    if (!self) return EMPTY_TRACE;
    const same = (ref: SectionRef) => ref.kind === kind && ref.index === index;
    const outgoing = self.refs
      .map((id) => definitions.get(id))
      .filter((ref): ref is SectionRef => ref !== undefined && !same(ref))
      .map(link)
      .filter((l): l is TraceLink => l !== null);
    const into = (self.id ? (incoming.get(self.id) ?? []) : [])
      .filter((ref) => !same(ref))
      .map(link)
      .filter((l): l is TraceLink => l !== null);
    const linked = new Set([...outgoing, ...into].map((l) => `${l.kind}:${l.index}`));
    const shared = new Map<string, { ref: SectionRef; terms: string[] }>();
    for (const term of self.terms) {
      const holders = termSections.get(term) ?? [];
      if (holders.length > MAX_TERM_SECTIONS) continue;
      for (const ref of holders) {
        const key = `${ref.kind}:${ref.index}`;
        if (ref.kind === kind || linked.has(key)) continue;
        const entry = shared.get(key) ?? { ref, terms: [] };
        entry.terms.push(term);
        shared.set(key, entry);
      }
    }
    const order = (ref: SectionRef) => SPEC_KINDS.indexOf(ref.kind) * 1e6 + ref.index;
    const related = [...shared.values()]
      .sort((a, b) => b.terms.length - a.terms.length || order(a.ref) - order(b.ref))
      .slice(0, MAX_RELATED)
      .map(({ ref, terms }) => {
        const found = section(ref.kind, ref.index);
        return found ? toLink(ref.kind, found, terms) : null;
      })
      .filter((l): l is TraceLink => l !== null);
    return { outgoing, incoming: into, related };
  };

  let coverage: Coverage | null = null;
  const requirements = docs.requirements;
  if (requirements && docs.tasks) {
    const withId = requirements.sections.filter((s) => s.id !== null);
    const uncovered = withId.filter(
      (s) => !(incoming.get(s.id as string) ?? []).some((ref) => ref.kind === 'tasks'),
    );
    coverage = {
      total: withId.length,
      covered: withId.length - uncovered.length,
      uncovered: uncovered.map((s) => toLink('requirements', s)),
    };
  }

  return {
    docs,
    definitions,
    duplicates: [...duplicates],
    coverage,
    progress: progressOf(docs.tasks),
    section,
    link,
    trace,
  };
}
