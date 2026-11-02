# Merilis extension VS Code

Dokumen ini ditujukan untuk maintainer markpiw. Rilis berjalan otomatis setelah PR yang
menaikkan versi di-merge ke `main`.

## Alur otomatis

Workflow [`CI`](../.github/workflows/ci.yml) berjalan di setiap PR dan setiap push ke `main`:

| Job         | Isi                                                                                |
| ----------- | ---------------------------------------------------------------------------------- |
| **Verify**  | `pnpm verify` dan pengecekan info rilis (versi web = extension, CHANGELOG lengkap) |
| **E2E web** | `pnpm test:e2e` di Chrome headless                                                 |
| **VS Code** | `pnpm test:vscode` (integration + webview) di VS Code stable dengan layar virtual  |
| **Release** | Hanya di `main`, setelah ketiga job di atas lulus                                  |

Job **Release** membaca versi dari `apps/vscode/package.json`. Jika release `v<versi>` belum
ada, job ini:

1. membangun `markpiw.vsix` (`pnpm package:vscode`);
2. membuat tag dan GitHub Release `v<versi>` (ditandai **Latest**) dengan asset `markpiw.vsix`
   dan catatan dari `docs/releases/v<versi>.md`, atau bagian versi itu di `CHANGELOG.md` jika
   file catatan tidak ada;
3. mem-publish ke Visual Studio Marketplace dan/atau Open VSX jika secret-nya dipasang (lihat
   di bawah).

Jika release untuk versi itu sudah ada, job ini selesai tanpa melakukan apa-apa. Jadi merge
yang tidak menaikkan versi tidak menerbitkan rilis.

## Menyiapkan rilis

Di branch PR:

1. Naikkan `version` di `apps/vscode/package.json` **dan** `apps/web/package.json` sesuai
   Semantic Versioning.
2. Di `CHANGELOG.md`, pindahkan isi **Unreleased** ke bagian `## [<versi>] - <tanggal>` dan
   perbarui link perbandingan di bagian bawah.
3. Opsional: tulis catatan rilis yang lebih ramah pengguna di `docs/releases/v<versi>.md`.
4. Perbarui versi yang disebut di README jika ada.
5. Cek catatan yang akan terbit: `node tooling/release-info.mjs`.

Buka PR, tunggu semua job CI hijau, lalu merge. Release terbit beberapa menit kemudian.

## Pembaruan otomatis bagi pengguna

Extension yang dipasang dari `.vsix` tidak pernah diperbarui otomatis oleh VS Code. Agar
pengguna menerima update otomatis, extension harus terbit di marketplace:

- **Visual Studio Marketplace** (VS Code): buat publisher `avendisianipar` di
  <https://marketplace.visualstudio.com/manage>, buat Personal Access Token Azure DevOps dengan
  scope _Marketplace → Manage_, lalu simpan sebagai secret repository `VSCE_PAT`.
- **Open VSX** (VSCodium, Cursor, dan editor turunan lain): buat token di
  <https://open-vsx.org/user-settings/tokens>, buat namespace `avendisianipar`, lalu simpan
  sebagai secret `OVSX_PAT`.

Secret dipasang lewat **Settings → Secrets and variables → Actions** atau
`gh secret set VSCE_PAT`. Setelah secret ada, setiap rilis berikutnya otomatis ikut terbit di
marketplace tersebut.

## Menerbitkan manual (darurat)

Jika workflow tidak bisa dipakai, jalankan seluruh verifikasi lokal lalu:

```bash
pnpm verify && pnpm test:e2e && pnpm test:vscode
pnpm package:vscode
node tooling/release-info.mjs   # tampilkan tag dan catatan rilis
gh release create v<versi> apps/vscode/markpiw.vsix \
  --title "Release <versi>" --notes-file docs/releases/v<versi>.md --latest
```

Setelah release tersedia, unduh kembali asset `.vsix`, pasang ke VS Code yang bersih, dan
jalankan smoke test.
