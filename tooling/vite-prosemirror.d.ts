import type { Plugin } from 'vite';
/** Pisahkan nama tipe dari daftar re-export nilai di satu file source vendor. */
export declare function rewriteTypeReexports(code: string, file: string): string;
export declare function prosemirrorTypeReexports(): Plugin;
