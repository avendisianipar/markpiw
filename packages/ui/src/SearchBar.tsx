// SPDX-License-Identifier: MIT
// Kotak cari (Ctrl/⌘+F): kata kunci, hitungan "x dari y", navigasi hasil, dan tutup. Hasil
// disorot dan dipilih oleh editor; komponen ini hanya mengirim perintah ke controller.
import type { EditorController, EditorSnapshot } from '@markpiw/editor';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ICON, isMac, tip } from './blocks';
import { useController, useEditorSnapshot } from './context';
import { t } from './strings/id';

const selectSearch = (s: EditorSnapshot) => s.search;

/** Ctrl/⌘+F di mana pun dalam halaman (toolbar, kotak cari) membuka atau memfokuskan pencarian. */
function useFindShortcut(controller: EditorController) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Di dalam editor, keymap ProseMirror sudah menanganinya (dan memanggil preventDefault).
      if (event.defaultPrevented) return;
      const mod = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      if (!mod || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'f') return;
      event.preventDefault();
      controller.openSearch();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controller]);
}

export function SearchBar() {
  const controller = useController();
  const search = useEditorSnapshot(selectSearch);
  const input = useRef<HTMLInputElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useFindShortcut(controller);

  useEffect(() => {
    const sub = controller.onUiRequest((request) => {
      if (request === 'search') setFocusRequest((n) => n + 1);
    });
    return () => sub.dispose();
  }, [controller]);
  useEffect(() => {
    if (focusRequest === 0) return;
    input.current?.focus();
    input.current?.select();
  }, [focusRequest]);

  if (!search) return null;
  const { query, total, current } = search;
  const status =
    total > 0
      ? t('search.count')
          .replace('{current}', String(current + 1))
          .replace('{total}', String(total))
      : query === ''
        ? ''
        : t('search.none');

  return (
    <div className="mp-popover mp-search" role="search">
      <input
        ref={input}
        className="mp-search-input"
        value={query}
        placeholder={t('search.placeholder')}
        aria-label={t('search.label')}
        spellCheck={false}
        onChange={(event) => controller.setSearchQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            controller.searchStep(event.shiftKey ? -1 : 1);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            controller.closeSearch();
          }
        }}
      />
      <span
        className="mp-search-count"
        data-empty={query !== '' && total === 0 ? '' : undefined}
        aria-live="polite"
      >
        {status}
      </span>
      <button
        type="button"
        className="mp-icon-button"
        aria-label={t('search.prev')}
        title={tip(t('search.prev'), 'Shift+Enter')}
        disabled={total === 0}
        onClick={() => controller.searchStep(-1)}
      >
        <ChevronUp {...ICON} />
      </button>
      <button
        type="button"
        className="mp-icon-button"
        aria-label={t('search.next')}
        title={tip(t('search.next'), 'Enter')}
        disabled={total === 0}
        onClick={() => controller.searchStep(1)}
      >
        <ChevronDown {...ICON} />
      </button>
      <button
        type="button"
        className="mp-icon-button"
        aria-label={t('search.close')}
        title={tip(t('search.close'), 'Esc')}
        onClick={() => controller.closeSearch()}
      >
        <X {...ICON} />
      </button>
    </div>
  );
}
