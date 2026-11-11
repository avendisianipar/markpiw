// SPDX-License-Identifier: MIT
// Komposisi editor lengkap: toolbar, halaman, popover, slash menu, banner, notifikasi.
import type { EditorController, EditorSnapshot } from '@markpiw/editor';
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react';
import { EditorContext, useEditorSnapshot } from './context';
import { EditorHost } from './EditorHost';
import { EditorErrorBoundary } from './ErrorBoundary';
import { ImagePopover } from './ImagePopover';
import { LinkPopover } from './LinkPopover';
import { Notice } from './Notice';
import { Outline } from './Outline';
import { type BannerAction, ReadOnlyBanner } from './ReadOnlyBanner';
import { SearchBar } from './SearchBar';
import { SlashMenu } from './SlashMenu';
import { SpecBar } from './spec/SpecBar';
import { TraceHover } from './spec/TraceHover';
import { type TraceTab, TracePanel } from './spec/TracePanel';
import { useSpec } from './spec/useSpec';
import { type ColorScheme, ThemeToggle } from './ThemeToggle';
import { SearchButton, Toolbar, ZoomControls } from './Toolbar';

export interface MarkpiwEditorProps {
  readonly controller: EditorController;
  /** Konten di kiri toolbar (mis. status simpan atau nama file). */
  readonly topBar?: ReactNode;
  /** Aksi pemulihan untuk banner read-only. */
  readonly recoveryActions?: readonly BannerAction[];
  /** Teks untuk mode baca-saja saat crash (biasanya isi file terakhir yang valid). */
  readonly fallbackText: () => string;
  /** Skema warna aktif; tombol tema di kanan topbar meminta host menggantinya. */
  readonly colorScheme: ColorScheme;
  readonly onColorSchemeChange: (next: ColorScheme) => void;
}

const selectZoom = (s: EditorSnapshot) => s.zoom;

/** Lebar minimum agar panel trace terbuka secara default (di bawahnya panel menutupi dokumen). */
const TRACE_INLINE_MIN_WIDTH = 640;
/**
 * Panel trace terbuka/tertutup, diingat selama halaman hidup (mis. saat pindah file di web).
 * Null = belum pernah dipilih: terbuka bila jendela cukup lebar.
 */
let traceOpenChoice: boolean | null = null;
const traceOpenInitial = () =>
  traceOpenChoice ?? (typeof window === 'undefined' || window.innerWidth > TRACE_INLINE_MIN_WIDTH);

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
  const spec = useSpec(controller);
  const [traceOpen, setTraceOpenState] = useState(traceOpenInitial);
  const [traceTab, setTraceTab] = useState<TraceTab>('section');
  const setTraceOpen = (open: boolean) => {
    traceOpenChoice = open;
    setTraceOpenState(open);
  };
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
        <div className="mp-topbar-end">
          <SearchButton />
          <span className="mp-tool-sep" aria-hidden="true" />
          <ZoomControls />
          <span className="mp-tool-sep" aria-hidden="true" />
          <ThemeToggle scheme={colorScheme} onChange={onColorSchemeChange} />
        </div>
      </header>
      {spec && (
        <SpecBar
          spec={spec}
          traceOpen={traceOpen}
          onToggleTrace={() => setTraceOpen(!traceOpen)}
          onShowCoverage={() => {
            setTraceTab('coverage');
            setTraceOpen(true);
          }}
        />
      )}
      <ReadOnlyBanner actions={recoveryActions ?? []} />
      <div className="mp-body">
        <div className="mp-body-main">
          <main ref={canvas} className="mp-canvas">
            <article className="mp-page">
              <EditorHost controller={controller} />
            </article>
          </main>
          <Outline canvas={canvas} />
          <SearchBar />
        </div>
        {spec && traceOpen && (
          <TracePanel
            spec={spec}
            tab={traceTab}
            onTab={setTraceTab}
            onClose={() => setTraceOpen(false)}
          />
        )}
      </div>
      {spec && <TraceHover spec={spec} canvas={canvas} />}
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
