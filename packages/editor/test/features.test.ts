// SPDX-License-Identifier: MIT
import { Slice } from 'prosemirror-model';
import { describe, expect, it } from 'vitest';
import { isSafeHref, isSafeImageSrc } from '../src';
import { cursorAt, md, press, setup, type } from './util';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('slash menu', () => {
  it('opens on "/" in an empty paragraph and lists all items', () => {
    const { c, view } = setup('');
    cursorAt(c);
    type(view, '/');
    expect(c.getSnapshot().slash?.items).toHaveLength(20);
    expect(c.getSnapshot().slash?.query).toBe('');
  });

  it('filters by label and alias, then runs the chosen item', () => {
    const { c, view } = setup('');
    cursorAt(c);
    type(view, '/tab');
    expect(c.getSnapshot().slash?.items.map((i) => i.id)).toEqual(['table']);
    press(view, 'Enter');
    expect(c.getSnapshot().slash).toBeNull();
    expect(c.getSnapshot().inTable).toBe(true);
    expect(c.state.doc.textContent).toBe('');
  });

  it('matches Indonesian aliases and moves the selection with arrows', () => {
    const { c, view } = setup('');
    cursorAt(c);
    type(view, '/judul');
    expect(c.getSnapshot().slash?.items[0]?.id).toBe('h1');
    const { c: c2, view: v2 } = setup('');
    cursorAt(c2);
    type(v2, '/');
    press(v2, 'ArrowDown');
    press(v2, 'ArrowDown');
    expect(c2.getSnapshot().slash?.selectedIndex).toBe(2);
    press(v2, 'Enter');
    expect(md(c2)).toBe('##\n');
  });

  it('closes on Escape and does not open inside a word', () => {
    const { c, view } = setup('');
    cursorAt(c);
    type(view, '/');
    press(view, 'Escape');
    expect(c.getSnapshot().slash).toBeNull();
    type(view, 'x');
    expect(c.getSnapshot().slash).toBeNull();
    const w = setup('');
    cursorAt(w.c);
    type(w.view, 'a/b');
    expect(w.c.getSnapshot().slash).toBeNull();
  });

  it('asks the UI for an image when the image item is chosen', () => {
    const { c, view } = setup('');
    const requests: string[] = [];
    c.onUiRequest((r) => requests.push(r));
    cursorAt(c);
    type(view, '/gambar');
    press(view, 'Enter');
    expect(requests).toEqual(['image']);
  });
});

describe('paste and clipboard', () => {
  it('paste: google docs html', () => {
    const { c, view } = setup('');
    cursorAt(c);
    const html =
      '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-abc"><p dir="ltr" style="line-height:1.38"><span style="font-weight:700">Tebal</span><span style="font-weight:400"> biasa </span><a href="https://x.io" style="color:red"><span>link</span></a></p><ul><li><p>satu</p></li></ul></b><script>alert(1)</script>';
    view.pasteHTML(html);
    const out = md(c);
    expect(out).toBe('**Tebal** biasa [link](https://x.io)\n\n- satu\n');
    expect(view.dom.innerHTML).not.toContain('style=');
    expect(view.dom.innerHTML).not.toContain('script');
  });

  it('pastes markdown-looking plain text as markdown', () => {
    const { c, view } = setup('');
    cursorAt(c);
    view.pasteText('# Judul\n\n- a\n- b');
    expect(md(c)).toBe('# Judul\n\n- a\n- b\n');
  });

  it('pastes plain text into a code block verbatim', () => {
    const { c, view } = setup('```\nx\n```\n');
    cursorAt(c, 'x');
    view.pasteText('# y');
    expect(md(c)).toBe('```\nx# y\n```\n');
  });

  it('pasting an image file saves it through the host', async () => {
    const { c, view, host } = setup('a\n');
    cursorAt(c, 'a');
    const file = new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' });
    const event = { clipboardData: { files: [file], getData: () => '' }, preventDefault() {} };
    view.someProp('handlePaste', (f) => f(view, event as unknown as ClipboardEvent, Slice.empty));
    await flush();
    await flush();
    expect(host.assets.size).toBe(1);
    expect(md(c)).toBe('a![](./assets/image-0.png)\n');
  });

  it('copies selections as markdown', () => {
    const { c, view } = setup('# T\n\n**b** c\n');
    const slice = c.state.doc.slice(0, c.state.doc.content.size);
    const text = view.someProp('clipboardTextSerializer', (f) => f(slice, view));
    expect(text).toBe('# T\n\n**b** c');
  });
});

describe('node views', () => {
  it('task checkbox toggles the item', () => {
    const { c, el } = setup('- [ ] a\n');
    const box = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(box.checked).toBe(false);
    box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(md(c)).toBe('- [x] a\n');
  });

  it('images resolve relative paths through the host', async () => {
    const { el } = setup('![alt](assets/a.png)\n');
    await flush();
    expect(el.querySelector('.mp-image img')?.getAttribute('src')).toBe(
      'https://example.test/assets/a.png',
    );
  });

  it('unsafe image sources show a placeholder instead of loading', async () => {
    const { el } = setup('![x](javascript:alert(1))\n');
    await flush();
    expect(el.querySelector('.mp-image img')).toBeNull();
    expect(el.querySelector('.mp-image-missing')?.textContent).toContain('javascript:alert(1)');
  });

  it('code blocks show an editable language label', () => {
    const { c, el } = setup('```js\nx\n```\n');
    const input = el.querySelector('.mp-code-lang') as HTMLInputElement;
    expect(input.value).toBe('js');
    input.value = 'ts';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(md(c)).toBe('```ts\nx\n```\n');
  });

  it('raw blocks are labelled with their kind', () => {
    const { el } = setup('<div>\nx\n</div>\n');
    expect(el.querySelector('.mp-raw-label')?.textContent).toBe('Markdown mentah · html');
  });
});

describe('safety', () => {
  it.each([
    ['https://x.io', true],
    ['mailto:a@b.c', true],
    ['./doc.md', true],
    ['#anchor', true],
    ['javascript:alert(1)', false],
    ['vscode://x', false],
  ])('href %s → %s', (href, ok) => {
    expect(isSafeHref(href)).toBe(ok);
  });
  it.each([
    ['assets/a.png', true],
    ['https://x.io/a.png', true],
    ['blob:abc', true],
    ['http://x.io/a.png', false],
    ['data:image/png;base64,AAA', false],
    ['//evil.io/a.png', false],
  ])('src %s → %s', (src, ok) => {
    expect(isSafeImageSrc(src)).toBe(ok);
  });
});
