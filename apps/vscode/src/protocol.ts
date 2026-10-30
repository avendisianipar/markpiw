// SPDX-License-Identifier: MIT
// Protokol pesan webview ↔ extension (spesifikasi 7.2), divalidasi Valibot di kedua arah.
import * as v from 'valibot';

const TextChange = v.object({
  from: v.pipe(v.number(), v.integer(), v.minValue(0)),
  to: v.pipe(v.number(), v.integer(), v.minValue(0)),
  insert: v.string(),
});

const UiState = v.object({
  zoom: v.number(),
  scrollTop: v.number(),
  selection: v.nullable(v.object({ anchor: v.number(), head: v.number() })),
});

const Theme = v.picklist(['light', 'dark']);

const HostError = v.object({
  code: v.picklist(['permission', 'conflict', 'not-found', 'io', 'invalid-path']),
  message: v.string(),
});

export const WebviewMessage = v.variant('type', [
  v.object({ type: v.literal('ready') }),
  v.object({ type: v.literal('edits'), baseVersion: v.number(), changes: v.array(TextChange) }),
  v.object({
    type: v.literal('saveAsset'),
    requestId: v.number(),
    /** Isi file dalam base64 (pesan webview harus bisa di-serialize JSON). */
    data: v.string(),
    mime: v.string(),
  }),
  v.object({ type: v.literal('resolveImages'), requestId: v.number(), paths: v.array(v.string()) }),
  v.object({ type: v.literal('openLink'), target: v.string() }),
  v.object({ type: v.literal('uiState'), state: UiState }),
  v.object({ type: v.literal('undo') }),
  v.object({ type: v.literal('redo') }),
  v.object({ type: v.literal('setTheme'), theme: Theme }),
]);

export const ExtensionMessage = v.variant('type', [
  v.object({
    type: v.literal('init'),
    text: v.string(),
    version: v.number(),
    uiState: v.nullable(UiState),
    config: v.object({ assetsFolder: v.string() }),
    /** Pilihan tema tersimpan; null = ikut tema VS Code. */
    theme: v.nullable(Theme),
  }),
  v.object({ type: v.literal('editsApplied'), version: v.number() }),
  v.object({ type: v.literal('externalChange'), text: v.string(), version: v.number() }),
  v.object({
    type: v.literal('assetSaved'),
    requestId: v.number(),
    result: v.variant('ok', [
      v.object({ ok: v.literal(true), value: v.string() }),
      v.object({ ok: v.literal(false), error: HostError }),
    ]),
  }),
  v.object({
    type: v.literal('imagesResolved'),
    requestId: v.number(),
    urls: v.record(v.string(), v.nullable(v.string())),
  }),
  /** Tema dipilih di panel lain; diterapkan tanpa disimpan ulang. */
  v.object({ type: v.literal('theme'), theme: Theme }),
]);

export type WebviewMessage = v.InferOutput<typeof WebviewMessage>;
export type ExtensionMessage = v.InferOutput<typeof ExtensionMessage>;

export function parseWebviewMessage(data: unknown): WebviewMessage | null {
  const result = v.safeParse(WebviewMessage, data);
  return result.success ? result.output : null;
}

export function parseExtensionMessage(data: unknown): ExtensionMessage | null {
  const result = v.safeParse(ExtensionMessage, data);
  return result.success ? result.output : null;
}

/** Terapkan perubahan (offset pada teks lama, urut naik, tidak tumpang tindih) ke teks. */
export function applyChanges(
  text: string,
  changes: readonly { from: number; to: number; insert: string }[],
): string {
  let out = '';
  let cursor = 0;
  for (const change of [...changes].sort((a, b) => a.from - b.from)) {
    out += text.slice(cursor, change.from) + change.insert;
    cursor = change.to;
  }
  return out + text.slice(cursor);
}
