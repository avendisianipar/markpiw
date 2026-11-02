// SPDX-License-Identifier: MIT
// Dipakai workflow CI: tulis version, tag, dan notes_file ke $GITHUB_OUTPUT.
// Jalankan lokal (`node tooling/release-info.mjs`) untuk melihat catatan rilis yang akan terbit.
import { appendFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { releaseInfo } from './release.ts';

const root = resolve(import.meta.dirname, '..');
const info = releaseInfo(root);
const notesFile = join(process.env.RUNNER_TEMP ?? tmpdir(), `release-notes-${info.tag}.md`);
writeFileSync(notesFile, info.notes);

const output = `version=${info.version}\ntag=${info.tag}\nnotes_file=${notesFile}\n`;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
else process.stdout.write(`${output}\n${info.notes}`);
