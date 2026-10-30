// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { cursorAt, md, press, setup, type } from './util';

const typed = (text: string) => {
  const s = setup('');
  cursorAt(s.c);
  type(s.view, text);
  return s;
};

describe('input rules', () => {
  it.each([
    ['# A', '# A\n'],
    ['### A', '### A\n'],
    ['> A', '> A\n'],
    ['- A', '- A\n'],
    ['* A', '* A\n'],
    ['1. A', '1. A\n'],
    ['3) A', '3) A\n'],
    ['[ ] A', '- [ ] A\n'],
    ['[x] A', '- [x] A\n'],
    ['a **b** c', 'a **b** c\n'],
    ['a __b__ c', 'a __b__ c\n'],
    ['a *b* c', 'a *b* c\n'],
    ['a _b_ c', 'a _b_ c\n'],
    ['a ~~b~~ c', 'a ~~b~~ c\n'],
    ['a `b` c', 'a `b` c\n'],
  ])('%j → %j', (input, expected) => {
    expect(md(typed(input).c)).toBe(expected);
  });

  it('autolinks URLs, www addresses and emails when a space is typed', () => {
    const { c } = typed('see https://x.io and www.a.com or me@a.com ');
    const links: string[] = [];
    c.state.doc.descendants((n) => {
      const link = n.marks.find((m) => m.type.name === 'link');
      if (link) links.push(`${n.text}→${link.attrs.href as string}`);
    });
    expect(links).toEqual([
      'https://x.io→https://x.io',
      'www.a.com→http://www.a.com',
      'me@a.com→mailto:me@a.com',
    ]);
    expect(md(c)).toBe('see https://x.io and www.a.com or me@a.com\n');
  });

  it('Backspace right after a rule undoes it', () => {
    const { c, view } = typed('# ');
    press(view, 'Backspace');
    expect(c.state.doc.firstChild?.type.name).toBe('paragraph');
    expect(c.state.doc.textContent).toBe('# ');
  });

  it('code fence and horizontal rule on Enter', () => {
    const fence = typed('```js');
    press(fence.view, 'Enter');
    type(fence.view, 'x');
    expect(md(fence.c)).toBe('```js\nx\n```\n');
    const hr = typed('---');
    press(hr.view, 'Enter');
    type(hr.view, 'b');
    expect(md(hr.c)).toBe('---\n\nb\n');
  });
});

describe('keymap', () => {
  it('Mod-b, Mod-Alt-2 and Mod-Shift-8', () => {
    const { c, view } = typed('ab');
    press(view, 'Mod-Alt-2');
    expect(md(c)).toBe('## ab\n');
    press(view, 'Mod-Alt-0');
    press(view, 'Mod-Shift-8');
    expect(md(c)).toBe('- ab\n');
  });

  it('Enter splits list items; Enter on an empty item leaves the list', () => {
    const { c, view } = typed('- a');
    press(view, 'Enter');
    type(view, 'b');
    expect(md(c)).toBe('- a\n- b\n');
    press(view, 'Enter');
    press(view, 'Enter');
    type(view, 'c');
    expect(md(c)).toBe('- a\n- b\n\nc\n');
  });

  it('task items continue as unchecked tasks', () => {
    const { c, view } = typed('[x] a');
    press(view, 'Enter');
    type(view, 'b');
    expect(md(c)).toBe('- [x] a\n- [ ] b\n');
  });

  it('Tab and Shift-Tab nest and lift list items', () => {
    const { c, view } = typed('- a');
    press(view, 'Enter');
    type(view, 'b');
    press(view, 'Tab');
    expect(md(c)).toBe('- a\n  - b\n');
    press(view, 'Shift-Tab');
    expect(md(c)).toBe('- a\n- b\n');
  });

  it('Tab moves between table cells and adds a row at the end', () => {
    const { c, view } = typed('x');
    c.commands.insertTable(2, 2);
    type(view, 'h1');
    press(view, 'Tab');
    type(view, 'h2');
    press(view, 'Tab');
    type(view, 'c1');
    press(view, 'Tab');
    press(view, 'Tab');
    expect(c.state.doc.child(1).childCount).toBe(3);
    expect(md(c)).toBe('x\n\n| h1 | h2 |\n| --- | --- |\n| c1 |  |\n|  |  |\n');
  });
});

describe('placeholder, trailing paragraph and links', () => {
  it('shows a placeholder on the empty active paragraph', () => {
    const { el } = typed('');
    expect(el.querySelector('.mp-placeholder')?.getAttribute('data-placeholder')).toBe(
      "Ketik '/' untuk perintah…",
    );
  });

  it('keeps a paragraph after a trailing table', () => {
    const { c } = typed('x');
    c.commands.insertTable(2, 2);
    expect(c.state.doc.lastChild?.type.name).toBe('paragraph');
  });

  it('Mod+click opens links through the host', () => {
    const { view, host } = setup('[docs](https://x.io/d)\n');
    const pos = 2;
    const event = new MouseEvent('click', { ctrlKey: true, metaKey: true });
    view.someProp('handleClick', (f) => f(view, pos, event));
    expect(host.opened).toEqual(['https://x.io/d']);
  });
});
