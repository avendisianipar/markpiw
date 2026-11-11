// SPDX-License-Identifier: MIT
// Panel trace di kanan dokumen. Tab "Bagian ini": keterkaitan section di kursor (rujukan keluar,
// rujukan masuk, section terkait lewat istilah kode). Tab "Cakupan": requirement tanpa task.
import type { EditorSnapshot } from '@markpiw/editor';
import type { TraceLink } from '@markpiw/spec';
import { TriangleAlert, X } from 'lucide-react';
import { useEditorSnapshot } from '../context';
import { t } from '../strings/id';
import { KindBadge, StatusIcon, titleWithoutId } from './parts';
import type { SpecApi } from './useSpec';

export type TraceTab = 'section' | 'coverage';

export interface TracePanelProps {
  readonly spec: SpecApi;
  readonly tab: TraceTab;
  readonly onTab: (tab: TraceTab) => void;
  readonly onClose: () => void;
}

const selectSection = (s: EditorSnapshot) => s.section;

function LinkItem({ link, spec }: { readonly link: TraceLink; readonly spec: SpecApi }) {
  return (
    <li>
      <button
        type="button"
        className="mp-trace-link"
        title={link.snippet || link.title}
        onClick={() => spec.navigate({ kind: link.kind, index: link.index, slug: link.slug })}
      >
        <KindBadge kind={link.kind} />
        <span className="mp-trace-link-body">
          <span className="mp-trace-link-title">
            {link.id && <span className="mp-trace-link-id">{link.id}</span>}
            <span>{titleWithoutId(link.title, link.id)}</span>
          </span>
          {link.terms.length > 0 && (
            <span className="mp-trace-terms">
              {link.terms.slice(0, 3).map((term) => (
                <code key={term}>{term}</code>
              ))}
              {link.terms.length > 3 && <span>+{link.terms.length - 3}</span>}
            </span>
          )}
        </span>
        {link.status && <StatusIcon status={link.status} />}
      </button>
    </li>
  );
}

function Group(props: {
  readonly title: string;
  readonly links: readonly TraceLink[];
  readonly spec: SpecApi;
}) {
  if (props.links.length === 0) return null;
  return (
    <section className="mp-trace-group">
      <h3 className="mp-trace-group-title">
        {props.title} <span className="mp-trace-count">{props.links.length}</span>
      </h3>
      <ul className="mp-trace-list">
        {props.links.map((link) => (
          <LinkItem key={`${link.kind}:${link.index}`} link={link} spec={props.spec} />
        ))}
      </ul>
    </section>
  );
}

function SectionTab({ spec }: { readonly spec: SpecApi }) {
  const index = useEditorSnapshot(selectSection);
  const { graph, active } = spec.snapshot;
  const section = index === null ? null : graph.section(active, index);
  if (!section) return <p className="mp-trace-hint">{t('trace.noSection')}</p>;
  const trace = graph.trace(active, section.index);
  const empty =
    trace.outgoing.length === 0 && trace.incoming.length === 0 && trace.related.length === 0;
  return (
    <>
      <div className="mp-trace-current">
        <KindBadge kind={active} />
        <span className="mp-trace-link-title">
          {section.id && <span className="mp-trace-link-id">{section.id}</span>}
          <span>{titleWithoutId(section.title, section.id)}</span>
        </span>
        {section.status && <StatusIcon status={section.status} />}
      </div>
      {empty ? (
        <p className="mp-trace-hint">
          {section.id ? t('trace.empty', { id: section.id }) : t('trace.emptyNoId')}
        </p>
      ) : (
        <>
          <Group title={t('trace.outgoing')} links={trace.outgoing} spec={spec} />
          <Group title={t('trace.incoming')} links={trace.incoming} spec={spec} />
          <Group title={t('trace.related')} links={trace.related} spec={spec} />
        </>
      )}
    </>
  );
}

function CoverageTab({ spec }: { readonly spec: SpecApi }) {
  const { coverage } = spec.snapshot.graph;
  if (!coverage) return <p className="mp-trace-hint">{t('trace.needBoth')}</p>;
  if (coverage.total === 0) return <p className="mp-trace-hint">{t('trace.noRequirementIds')}</p>;
  if (coverage.uncovered.length === 0)
    return <p className="mp-trace-hint">{t('trace.allCovered')}</p>;
  return (
    <>
      <Group title={t('trace.uncovered')} links={coverage.uncovered} spec={spec} />
      <p className="mp-trace-hint">{t('trace.coverageTip')}</p>
    </>
  );
}

export function TracePanel({ spec, tab, onTab, onClose }: TracePanelProps) {
  const { graph, loading } = spec.snapshot;
  return (
    <aside className="mp-trace" aria-label={t('trace.label')}>
      <header className="mp-trace-head">
        <div className="mp-trace-tabs" role="tablist">
          {(['section', 'coverage'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              className="mp-trace-tab"
              aria-selected={tab === id}
              onClick={() => onTab(id)}
            >
              {t(id === 'section' ? 'trace.tabSection' : 'trace.tabCoverage')}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mp-trace-close"
          aria-label={t('trace.close')}
          title={t('trace.close')}
          onClick={onClose}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </header>
      <div className="mp-trace-body" role="tabpanel">
        {graph.duplicates.length > 0 && (
          <p className="mp-trace-warn">
            <TriangleAlert size={14} aria-hidden="true" />
            {t('trace.duplicate', { ids: graph.duplicates.join(', ') })}
          </p>
        )}
        {loading ? (
          <p className="mp-trace-hint">{t('trace.loading')}</p>
        ) : tab === 'section' ? (
          <SectionTab spec={spec} />
        ) : (
          <CoverageTab spec={spec} />
        )}
      </div>
    </aside>
  );
}
