// SPDX-License-Identifier: MIT
import { NodeSelection } from 'prosemirror-state';
import { describe, expect, it, vi } from 'vitest';
import { cursorAt, md, press, setup, type } from './util';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (_id: string, code: string) => {
      if (code.includes('error')) throw new Error('Parse error');
      return { svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' };
    }),
  },
}));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('inline math', () => {
  it('renders $…$ from the file as MathML, file unchanged', () => {
    const text = 'Energi $E=mc^2$ di sini.\n';
    const { c, el } = setup(text);
    expect(el.querySelector('.mp-math-inline math')).not.toBeNull();
    expect(md(c)).toBe(text);
  });

  it('typing $x^2$ turns into inline math', () => {
    const { c, view } = setup('');
    cursorAt(c);
    type(view, 'luas $r^2$');
    expect(c.state.doc.firstChild?.child(1).type.name).toBe('math_inline');
    expect(md(c)).toBe('luas $r^2$\n');
  });

  it('does not treat prices as math', () => {
    const { c, view } = setup('');
    cursorAt(c);
    type(view, 'harga $5 dan $10');
    expect(md(c)).not.toContain('math');
    expect(c.state.doc.textContent).toBe('harga $5 dan $10');
    expect(c.getSnapshot().readOnly).toBeNull();
  });

  it('edits LaTeX through the input shown when the formula is selected', () => {
    const { c, el } = setup('a $x$ b\n');
    c.dispatch(c.state.tr.setSelection(NodeSelection.create(c.state.doc, 3)));
    const input = el.querySelector<HTMLInputElement>('.mp-math-input');
    expect(input?.value).toBe('x');
    input!.value = '\\frac{1}{2}';
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(md(c)).toBe('a $\\frac{1}{2}$ b\n');
    expect(el.querySelector('.mp-math-input')).toBeNull();
  });

  it('inserting empty inline math opens the input; leaving it empty removes it', () => {
    const { c, el } = setup('a\n');
    cursorAt(c, 'a');
    c.commands.insertMathInline();
    const input = el.querySelector<HTMLInputElement>('.mp-math-input');
    expect(input).not.toBeNull();
    expect(c.getSnapshot().readOnly).toBeNull();
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(c.state.doc.textContent).toBe('a');
  });

  it('shows invalid LaTeX as source instead of failing', () => {
    const { el } = setup('salah $\\frac{1$ ya\n');
    expect(el.querySelector('.mp-math-error')?.textContent).toBe('$\\frac{1$');
  });
});

describe('block math', () => {
  it('shows $$ blocks with an editable source and a rendered preview', () => {
    const text = '$$\n\\sum_{i=1}^n i\n$$\n';
    const { c, el } = setup(text);
    expect(el.querySelector('.mp-math-block code')?.textContent).toBe('\\sum_{i=1}^n i');
    expect(el.querySelector('.mp-math-block .mp-preview math')).not.toBeNull();
    expect(md(c)).toBe(text);
  });

  it('"$$" + Enter creates a math block; typing updates the preview', () => {
    const { c, view, el } = setup('');
    cursorAt(c);
    type(view, '$$');
    press(view, 'Enter');
    expect(c.state.doc.firstChild?.type.name).toBe('math_block');
    type(view, 'a+b');
    expect(md(c)).toBe('$$\na+b\n$$\n');
    expect(el.querySelector('.mp-preview math')).not.toBeNull();
  });

  it('```math code blocks also get a preview', () => {
    const { el } = setup('```math\nx\n```\n');
    expect(el.querySelector('.mp-code .mp-preview-math math')).not.toBeNull();
  });
});

describe('mermaid', () => {
  it('renders ```mermaid as an image preview below the source', async () => {
    const { el } = setup('```mermaid\nflowchart TD\n  A --> B\n```\n');
    await flush();
    await flush();
    expect(el.querySelector('.mp-preview-mermaid img')).not.toBeNull();
  });

  it('shows the error message for an invalid diagram', async () => {
    const { el } = setup('```mermaid\nerror here\n```\n');
    await flush();
    await flush();
    expect(el.querySelector('.mp-preview-error')?.textContent).toContain('Parse error');
  });

  it('slash command inserts a sample diagram', () => {
    const { c, view } = setup('');
    cursorAt(c);
    type(view, '/mermaid');
    press(view, 'Enter');
    expect(md(c)).toBe('```mermaid\nflowchart TD\n  A[Mulai] --> B[Selesai]\n```\n');
  });
});

describe('syntax highlighting', () => {
  it('decorates tokens of a known language', () => {
    const { el } = setup('```ts\nconst a = 1;\n```\n');
    expect(el.querySelector('.mp-code .hljs-keyword')?.textContent).toBe('const');
    expect(el.querySelector('.mp-code .hljs-number')?.textContent).toBe('1');
  });

  it('leaves unknown languages plain', () => {
    const { el } = setup('```bahasa-aneh\nconst a\n```\n');
    expect(el.querySelector('.mp-code [class^="hljs"]')).toBeNull();
  });
});

describe('inline math input focus and cancel', () => {
  it('keeps the input open when focus leaves to the toolbar', () => {
    const { c, el } = setup('a $x$ b\n');
    c.dispatch(c.state.tr.setSelection(NodeSelection.create(c.state.doc, 3)));
    const input = el.querySelector<HTMLInputElement>('.mp-math-input');
    input!.dispatchEvent(new FocusEvent('blur'));
    expect(el.querySelector('.mp-math-input')).not.toBeNull();
  });

  it('Escape on a new empty formula removes it', () => {
    const { c, el } = setup('a\n');
    cursorAt(c, 'a');
    c.commands.insertMathInline();
    el.querySelector('.mp-math-input')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape' }),
    );
    let count = 0;
    c.state.doc.descendants((n) => {
      if (n.type.name === 'math_inline') count++;
    });
    expect(count).toBe(0);
  });
});

describe('mermaid image size', () => {
  it('uses the viewBox size instead of width="100%"', async () => {
    const { naturalSize } = await import('../src/render');
    const svg =
      '<svg id="m" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 120px;" viewBox="0 0 120.5 80"><g/></svg>';
    expect(naturalSize(svg)).toBe(
      '<svg width="120.5" height="80" id="m" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120.5 80"><g/></svg>',
    );
  });
});
