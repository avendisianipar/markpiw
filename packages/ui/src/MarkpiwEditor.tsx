// SPDX-License-Identifier: LicenseRef-Proprietary
// Komposisi editor lengkap: toolbar, halaman, popover, slash menu, banner, notifikasi.
import type { EditorController, EditorSnapshot } from '@markpiw/editor';
import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';
import { EditorContext, useEditorSnapshot } from './context';
import { EditorHost } from './EditorHost';
import { EditorErrorBoundary } from './ErrorBoundary';
import { ImagePopover } from './ImagePopover';
import { LinkPopover } from './LinkPopover';
import { Notice } from './Notice';
import { Outline } from './Outline';
import { type BannerAction, ReadOnlyBanner } from './ReadOnlyBanner';
import { SlashMenu } from './SlashMenu';
import { type ColorScheme, ThemeToggle } from './ThemeToggle';
import { Toolbar } from './Toolbar';

export interface MarkpiwEditorProps {
  readonly controller: EditorController;
  /** Konten di kiri toolbar (mis. status simpan atau nama file). */
  readonly topBar?: ReactNode;
  /** Aksi pemulihan untuk banner read-only. */
  readonly recoveryActions?: readonly BannerAction[];
  /** Teks untuk mode baca-saja saat crash (biasanya isi file terakhir yang valid). */
  readonly fallbackText: () => string;
  /** Skema warna aktif; bila diisi bersama `onColorSchemeChange`, tombol tema tampil di kanan. */
  readonly colorScheme?: ColorScheme;
  readonly onColorSchemeChange?: (next: ColorScheme) => void;
}

const selectZoom = (s: EditorSnapshot) => s.zoom;

function Surface({
  controller,
  topBar,
  recoveryActions,
  colorScheme,
  onColorSchemeChange,
}: Omit<MarkpiwEditorProps, 'fallbackText'>) {
  const zoom = useEditorSnapshot(selectZoom);
  const file = useRef<HTMLInputElement>(null);
  const canvas = useRef<HTMLElement>(null);
  const pickImage = () => file.current?.click();
  useEffect(() => {
    const sub = controller.onUiRequest((request) => {
      if (request === 'image') pickImage();
    });
    return () => sub.dispose();
  }, [controller]);
  return (
    <div className="mp-root" style={{ '--mp-zoom': zoom / 100 } as CSSProperties}>
      <header className="mp-topbar">
        {topBar}
        <Toolbar onPickImage={pickImage} />
        {colorScheme && onColorSchemeChange && (
          <div className="mp-topbar-end">
            <ThemeToggle scheme={colorScheme} onChange={onColorSchemeChange} />
          </div>
        )}
      </header>
      <ReadOnlyBanner actions={recoveryActions ?? []} />
      <div className="mp-body">
        <main ref={canvas} className="mp-canvas">
          <article className="mp-page">
            <EditorHost controller={controller} />
          </article>
        </main>
        <Outline canvas={canvas} />
      </div>
      <SlashMenu />
      <LinkPopover />
      <ImagePopover />
      <Notice />
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        hidden
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) void controller.commands.insertImageFile(chosen);
          event.target.value = '';
        }}
      />
    </div>
  );
}

export function MarkpiwEditor(props: MarkpiwEditorProps) {
  const { controller, fallbackText, ...rest } = props;
  return (
    <EditorContext.Provider value={controller}>
      <EditorErrorBoundary fallbackText={fallbackText}>
        <Surface controller={controller} {...rest} />
      </EditorErrorBoundary>
    </EditorContext.Provider>
  );
}
