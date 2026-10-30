import type { Plugin } from 'vite';
/** Direktori paket pihak ketiga pemilik sebuah modul bundle, atau null untuk kode markpiw. */
export declare function packageDirOf(id: string): string | null;
/** Teks THIRD_PARTY_NOTICES untuk sekumpulan path modul yang dibundel. */
export declare function renderNotices(moduleIds: Iterable<string>): string;
/** Tulis THIRD_PARTY_NOTICES.txt ke output build. */
export declare function thirdPartyNotices(fileName?: string): Plugin;
/** Tulis daftar modul bundle (JSON) untuk digabung dengan bundle lain sebelum notices dibuat. */
export declare function bundledModules(fileName: string): Plugin;
