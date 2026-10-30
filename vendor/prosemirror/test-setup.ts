// SPDX-License-Identifier: MIT
// Node >= 21 punya `navigator` global (di macOS `platform` = "MacIntel"), sehingga
// prosemirror-keymap menganggap Mod = Cmd. Test upstream ditulis untuk runner tanpa
// `navigator`; hapus agar hasilnya tidak bergantung pada OS mesin yang menjalankan test.
Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true });
