// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import type { Disposable, SiblingFiles } from '@markpiw/host';
import { parseMarkdown } from '@markpiw/markdown';
import { describe, expect, it } from 'vitest';
import {
  buildSpecGraph,
  definitionOf,
  indexSpecDoc,
  normalizeTerm,
  type SpecDoc,
  type SpecKind,
  SpecModel,
  specKindOf,
} from '../src';

const fixture = (name: string) =>
  readFileSync(new URL(`./fixtures/task-comments/${name}`, import.meta.url), 'utf8');

const index = (kind: SpecKind, text: string): SpecDoc =>
  indexSpecDoc(kind, parseMarkdown(text).doc);

const example = () => ({
  requirements: index('requirements', fixture('requirements.md')),
  design: index('design', fixture('design.md')),
  tasks: index('tasks', fixture('tasks.md')),
});

describe('specKindOf', () => {
  it('recognises the three spec files, case-insensitively', () => {
    expect(specKindOf('requirements.md')).toBe('requirements');
    expect(specKindOf('Design.md')).toBe('design');
    expect(specKindOf('TASKS.MD')).toBe('tasks');
    expect(specKindOf('README.md')).toBeNull();
  });
});

describe('definitionOf', () => {
  it('reads the ID at the start of a heading', () => {
    expect(definitionOf('FR-1: Menulis Komentar')).toBe('FR-1');
    expect(definitionOf('T1 — Schema database')).toBe('T1');
    expect(definitionOf('NFR-2 Performa')).toBe('NFR-2');
    expect(definitionOf('AC-1.2 Validasi')).toBe('AC-1.2');
    expect(definitionOf('API Endpoints')).toBeNull();
    expect(definitionOf('R2D2 catatan')).toBeNull();
    expect(definitionOf('Tasks')).toBeNull();
  });
});

describe('normalizeTerm', () => {
  it('drops HTTP methods, call parens and generic terms', () => {
    expect(normalizeTerm('GET /api/v1/tasks/{task_id}/comments')).toBe(
      '/api/v1/tasks/{task_id}/comments',
    );
    expect(normalizeTerm('validBody()')).toBe('validBody');
    expect(normalizeTerm('DELETE')).toBeNull();
    expect(normalizeTerm('[ ]')).toBeNull();
    expect(normalizeTerm('201')).toBeNull();
    expect(normalizeTerm('design.md')).toBeNull();
  });
});

describe('indexSpecDoc on the example spec', () => {
  it('finds requirement and task IDs with GitHub slugs', () => {
    const { requirements, tasks } = example();
    expect(requirements.sections.filter((s) => s.id).map((s) => s.id)).toEqual([
      'FR-1',
      'FR-2',
      'FR-3',
      'FR-4',
      'FR-5',
      'FR-6',
      'FR-7',
    ]);
    const t1 = tasks.sections.find((s) => s.id === 'T1');
    expect(t1?.slug).toBe('t1--schema-database-comments-dan-mentions');
    expect(tasks.sections.filter((s) => s.id).map((s) => s.id)).toEqual([
      'T1',
      'T2',
      'T3',
      'T4',
      'T5',
      'T6',
    ]);
  });

  it('reads task status from the Status line', () => {
    const { tasks } = example();
    expect(tasks.sections.filter((s) => s.id).map((s) => s.status)).toEqual(Array(6).fill('todo'));
  });

  it('collects references to other IDs and skips code blocks', () => {
    const { tasks } = example();
    const t2 = tasks.sections.find((s) => s.id === 'T2');
    expect(t2?.refs).toContain('T1');
    expect(t2?.refs).toContain('T4');
    // Diagram dependensi ada di code block: tidak dihitung sebagai rujukan section-nya.
    const order = tasks.sections.find((s) => s.title === 'Urutan dan Dependensi');
    expect(order?.refs).toEqual(['T2', 'T4']);
  });

  it('collects normalised inline code terms and a snippet', () => {
    const { requirements } = example();
    const fr1 = requirements.sections.find((s) => s.id === 'FR-1');
    expect(fr1?.terms).toContain('/api/v1/tasks/{task_id}/comments');
    expect(fr1?.terms).toContain('validation_failed');
    expect(fr1?.snippet.startsWith('WHEN Space member mengirim POST')).toBe(true);
    expect(fr1?.snippet.length).toBeLessThanOrEqual(160);
  });
});

describe('buildSpecGraph', () => {
  it('links requirements and design through shared code terms', () => {
    const graph = buildSpecGraph(example());
    const fr3 = graph.docs.requirements?.sections.find((s) => s.id === 'FR-3');
    const trace = graph.trace('requirements', fr3?.index ?? -1);
    const titles = trace.related.map((l) => `${l.kind}:${l.title}`);
    expect(titles).toContain('design:Comments');
    expect(trace.related.every((l) => l.kind !== 'requirements')).toBe(true);
    expect(trace.related.length).toBeLessThanOrEqual(6);
  });

  it('reports coverage: no requirement in the example is referenced by a task', () => {
    const graph = buildSpecGraph(example());
    expect(graph.coverage).toMatchObject({ total: 7, covered: 0 });
    expect(graph.progress).toEqual({ total: 6, done: 0, doing: 0 });
  });

  it('follows explicit ID references in both directions', () => {
    const graph = buildSpecGraph({
      requirements: index(
        'requirements',
        '# Req\n\n### FR-1: Tulis\n\nIsi.\n\n### FR-2: Baca\n\nIsi.\n',
      ),
      tasks: index(
        'tasks',
        '# Tasks\n\n### T1 — Backend\n\n**Requirements:** FR-1, FR-9\n\n- [x] a\n- [ ] b\n\n### T2 — UI\n\nSetelah T1. Status: `[x]`\n',
      ),
    });
    const t1 = graph.trace('tasks', 1);
    expect(t1.outgoing.map((l) => l.id)).toEqual(['FR-1']);
    expect(t1.incoming.map((l) => l.id)).toEqual(['T2']);
    const fr1 = graph.trace('requirements', 1);
    expect(fr1.incoming.map((l) => l.id)).toEqual(['T1']);
    expect(graph.coverage).toMatchObject({ total: 2, covered: 1 });
    expect(graph.coverage?.uncovered.map((l) => l.id)).toEqual(['FR-2']);
    expect(graph.docs.tasks?.sections.map((s) => s.status)).toEqual([null, 'doing', 'done']);
    expect(graph.progress).toEqual({ total: 2, done: 1, doing: 1 });
  });

  it('flags duplicate IDs and resolves to the first definition', () => {
    const graph = buildSpecGraph({
      requirements: index('requirements', '### FR-1 A\n\nx\n\n### FR-1 B\n\ny\n'),
      design: index('design', '## Desain\n\nLihat FR-1.\n'),
    });
    expect(graph.duplicates).toEqual(['FR-1']);
    expect(graph.definitions.get('FR-1')).toEqual({ kind: 'requirements', index: 0 });
    expect(graph.coverage).toBeNull();
  });

  it('ignores terms used by too many sections', () => {
    const common = Array.from({ length: 7 }, (_, i) => `## D${i}\n\nPakai \`shared_term\`.\n`).join(
      '\n',
    );
    const graph = buildSpecGraph({
      requirements: index('requirements', '### FR-1 A\n\nPakai `shared_term`.\n'),
      design: index('design', common),
    });
    expect(graph.trace('requirements', 0).related).toEqual([]);
  });

  it('falls back to checkbox progress when tasks have no IDs', () => {
    const graph = buildSpecGraph({
      tasks: index('tasks', '# Rencana\n\n- [x] 1. Satu\n- [ ] 2. Dua\n- [x] 3. Tiga\n'),
    });
    expect(graph.progress).toEqual({ total: 3, done: 2, doing: 0 });
  });
});

class FakeSiblings implements SiblingFiles {
  readonly folderName = 'task-comments';
  reads = 0;
  private listeners = new Set<() => void>();
  constructor(
    readonly fileName: string,
    public files: Record<string, string>,
  ) {}
  async read(name: string): Promise<string | null> {
    this.reads++;
    return this.files[name] ?? null;
  }
  onChange(cb: () => void): Disposable {
    this.listeners.add(cb);
    return { dispose: () => this.listeners.delete(cb) };
  }
  emit(): void {
    for (const cb of this.listeners) cb();
  }
}

describe('SpecModel', () => {
  it('is only created for spec files', () => {
    const doc = parseMarkdown('# x\n').doc;
    expect(
      SpecModel.for({ siblings: new FakeSiblings('README.md', {}), activeDoc: () => doc }),
    ).toBeNull();
  });

  it('loads siblings, reacts to their changes and to the live active doc', async () => {
    const siblings = new FakeSiblings('requirements.md', {
      'tasks.md': '### T1 — A\n\nFR-1\n',
    });
    let doc = parseMarkdown('### FR-1 Tulis\n\nx\n').doc;
    const model = SpecModel.for({ siblings, activeDoc: () => doc, debounceMs: 0 });
    if (!model) throw new Error('model');
    expect(model.getSnapshot().loading).toBe(true);
    let notified = 0;
    model.subscribe(() => notified++);
    await model.start();
    const first = model.getSnapshot();
    expect(first.loading).toBe(false);
    expect(first.files).toEqual({ requirements: true, design: false, tasks: true });
    expect(first.graph.coverage).toMatchObject({ total: 1, covered: 1 });

    siblings.files['design.md'] = '## Desain\n';
    siblings.emit();
    await new Promise((r) => setTimeout(r, 0));
    expect(model.getSnapshot().files.design).toBe(true);

    doc = parseMarkdown('### FR-1 Tulis\n\nx\n\n### FR-2 Baca\n\ny\n').doc;
    model.activeChanged();
    await new Promise((r) => setTimeout(r, 5));
    expect(model.getSnapshot().graph.coverage).toMatchObject({ total: 2, covered: 1 });
    expect(notified).toBeGreaterThanOrEqual(3);

    // Isi saudara tidak berubah: tidak ada notifikasi baru.
    const before = notified;
    await model.reload();
    expect(notified).toBe(before);
    model.dispose();
  });
});
