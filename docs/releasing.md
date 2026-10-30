# Merilis extension VS Code

Dokumen ini ditujukan untuk maintainer markpiw.

## Menyiapkan rilis

1. Naikkan `version` di `apps/vscode/package.json` sesuai Semantic Versioning.
2. Perbarui `CHANGELOG.md` dan pindahkan perubahan dari bagian **Unreleased** ke versi baru.
3. Pastikan checkout bersih dan seluruh verifikasi lulus:

   ```bash
   pnpm verify
   pnpm test:e2e
   pnpm test:vscode
   ```

4. Build paket VSIX:

   ```bash
   pnpm package:vscode
   ```

   Hasil build tersedia di `apps/vscode/markpiw.vsix`.

## Menerbitkan GitHub Release

Buat tag dan release dengan nomor versi yang sama dengan package:

```bash
gh release create v0.2.0 apps/vscode/markpiw.vsix \
  --title "markpiw 0.2.0" \
  --notes "Ringkasan perubahan…"
```

Setelah release tersedia:

1. Unduh kembali asset `.vsix` dari halaman release.
2. Pasang ke VS Code yang bersih dan jalankan smoke test.
3. Pastikan badge release dan tautan `releases/latest` di README mengarah ke versi baru.
4. Umumkan bahwa pengguna instalasi VSIX perlu memperbarui extension secara manual.
