// SPDX-License-Identifier: MIT
// Bar spec di bawah toolbar: nama spec, langkah Requirements › Design › Task list, progres task,
// cakupan requirement, dan tombol panel trace.
import { SPEC_FILES, SPEC_KINDS } from '@markpiw/spec';
import { ChevronRight, FileText, PanelRight } from 'lucide-react';
import { Fragment } from 'react';
import { t } from '../strings/id';
import { kindLabel } from './parts';
import type { SpecApi } from './useSpec';

export interface SpecBarProps {
  readonly spec: SpecApi;
  readonly traceOpen: boolean;
  readonly onToggleTrace: () => void;
  readonly onShowCoverage: () => void;
}

export function SpecBar({ spec, traceOpen, onToggleTrace, onShowCoverage }: SpecBarProps) {
  const { name, active, files, graph } = spec.snapshot;
  const { progress, coverage } = graph;
  return (
    <nav className="mp-specbar" aria-label={t('spec.label')}>
      <span className="mp-specbar-name" title={name}>
        <FileText size={15} aria-hidden="true" />
        <span>{name}</span>
      </span>
      <ol className="mp-spec-steps">
        {SPEC_KINDS.map((kind, i) => {
          const current = kind === active;
          const exists = files[kind];
          const file = SPEC_FILES[kind];
          return (
            <Fragment key={kind}>
              {i > 0 && (
                <li className="mp-spec-sep" aria-hidden="true">
                  <ChevronRight size={14} />
                </li>
              )}
              <li>
                <button
                  type="button"
                  className="mp-spec-step"
                  aria-current={current ? 'page' : undefined}
                  disabled={!exists && !current}
                  title={
                    current ? file : exists ? t('spec.open', { file }) : t('spec.missing', { file })
                  }
                  onClick={() => {
                    if (!current) spec.navigate({ kind });
                  }}
                >
                  <span className="mp-spec-step-num">{i + 1}</span>
                  <span className="mp-spec-step-label">{kindLabel(kind)}</span>
                </button>
              </li>
            </Fragment>
          );
        })}
      </ol>
      <div className="mp-specbar-end">
        {progress && (
          <span
            className="mp-spec-pill"
            data-complete={progress.done === progress.total || undefined}
            title={
              progress.doing > 0 ? t('spec.progressHint', { doing: progress.doing }) : undefined
            }
          >
            <span
              className="mp-spec-meter"
              style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
              aria-hidden="true"
            />
            <span className="mp-spec-pill-text">
              {t('spec.progress', { done: progress.done, total: progress.total })}
            </span>
          </span>
        )}
        {coverage && coverage.total > 0 && (
          <button
            type="button"
            className="mp-spec-pill mp-spec-pill-button"
            data-warn={coverage.covered < coverage.total || undefined}
            data-complete={coverage.covered === coverage.total || undefined}
            title={t('spec.coverageHint')}
            onClick={onShowCoverage}
          >
            <span className="mp-spec-pill-text">
              {t('spec.coverage', { covered: coverage.covered, total: coverage.total })}
            </span>
          </button>
        )}
        <button
          type="button"
          className="mp-spec-toggle"
          aria-pressed={traceOpen}
          title={t('spec.traceToggleHint')}
          onClick={onToggleTrace}
        >
          <PanelRight size={15} aria-hidden="true" />
          <span>{t('spec.traceToggle')}</span>
        </button>
      </div>
    </nav>
  );
}
