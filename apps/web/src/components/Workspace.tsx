// SPDX-License-Identifier: MIT
import { MarkpiwEditor } from '@markpiw/ui';
import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { DirectoryLike } from '../fs/types';
import { FileSession } from '../session';
import { clearDraft, type Draft, takeDraft } from '../storage';
import { webStrings as s } from '../strings';
import { theme } from '../theme';
import { FileTree } from './FileTree';

const EXTERNAL_POLL_MS = 5000;

function StatusBadge({ session }: { session: FileSession }) {
  const status = useSyncExternalStore(session.subscribe, session.getStatus);
  return (
    <span
      className={`web-status web-status-${status}`}
      role="status"
      title={session.errorMessage ?? undefined}
    >
      {s.status[status]}
    </span>
  );
}

function ConflictDialog({ session }: { session: FileSession }) {
  const status = useSyncExternalStore(session.subscribe, session.getStatus);
  if (status !== 'conflict') return null;
  return (
    <div className="web-modal-backdrop">
      <div
        className="web-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="web-conflict-title"
      >
        <h2 id="web-conflict-title">{s.conflictTitle}</h2>
        <p>{s.conflictBody}</p>
        <div className="web-modal-actions">
          <button
            type="button"
            className="web-secondary"
            onClick={() => void session.resolveConflict('disk')}
          >
            {s.loadDisk}
          </button>
          <button
            type="button"
            className="web-primary"
            onClick={() => void session.resolveConflict('mine')}
          >
            {s.keepMine}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Workspace(props: {
  root: DirectoryLike;
  demo: boolean;
  initial?: string[];
  onClose: () => void;
}) {
  const [session, setSession] = useState<FileSession | null>(null);
  const scheme = useSyncExternalStore(theme.subscribe, theme.get);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const current = useRef<FileSession | null>(null);
  const opening = useRef<Promise<void>>(Promise.resolve());

  const open = useCallback(
    (path: string[]) => {
      opening.current = opening.current.then(async () => {
        if (current.current?.path.join('/') === path.join('/')) return;
        setError(null);
        await current.current?.close();
        try {
          const next = await FileSession.open(props.root, path, { onOpenFile: (p) => open(p) });
          current.current = next;
          setSession(next);
          const found = props.demo ? null : await takeDraft(props.root.name, path.join('/'));
          setDraft(found && found.text !== next.lastKnownText ? found : null);
        } catch (e) {
          current.current = null;
          setSession(null);
          setError(`${s.openFailed}: ${e instanceof Error ? e.message : String(e)}`);
        }
      });
    },
    [props.root, props.demo],
  );

  useEffect(() => {
    if (props.initial) open(props.initial);
  }, [open, props.initial]);

  // Simpan saat Ctrl/Cmd+S, saat tab disembunyikan/blur; cek perubahan luar saat fokus & tiap 5 dtk.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void current.current?.save();
      }
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') void current.current?.save();
    };
    const onBlur = () => void current.current?.save();
    const onFocus = () => void current.current?.checkExternal();
    const onUnload = (event: BeforeUnloadEvent) => {
      const status = current.current?.status;
      if (status === 'dirty' || status === 'saving' || status === 'conflict') {
        event.preventDefault();
        event.returnValue = s.unsaved;
      }
    };
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible' && document.hasFocus())
        void current.current?.checkExternal();
    }, EXTERNAL_POLL_MS);
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(poll);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  const close = async () => {
    await current.current?.close();
    current.current = null;
    props.onClose();
  };

  return (
    <div className="web-workspace">
      <aside className="web-sidebar">
        <div className="web-sidebar-head">
          <strong title={props.root.name}>{props.root.name}</strong>
          {props.demo && <span className="web-badge">{s.demoBadge}</span>}
          <button
            type="button"
            className="web-icon"
            aria-label={s.closeFolder}
            title={s.closeFolder}
            onClick={() => void close()}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <nav className="web-sidebar-body">
          <FileTree root={props.root} active={session?.path ?? null} onOpen={open} />
        </nav>
      </aside>
      <section className="web-main">
        {error && <p className="web-warning web-pad">{error}</p>}
        {draft && session && (
          <div className="web-draft" role="status">
            {s.draftFound}
            <button
              type="button"
              className="web-primary"
              onClick={() => {
                void session.restoreDraft(draft);
                void clearDraft(props.root.name, session.path.join('/'));
                setDraft(null);
              }}
            >
              {s.restoreDraft}
            </button>
            <button
              type="button"
              className="web-secondary"
              onClick={() => {
                void clearDraft(props.root.name, session.path.join('/'));
                setDraft(null);
              }}
            >
              {s.discardDraft}
            </button>
          </div>
        )}
        {session ? (
          <>
            <MarkpiwEditor
              key={session.path.join('/')}
              controller={session.controller}
              fallbackText={() => session.lastKnownText}
              colorScheme={scheme}
              onColorSchemeChange={theme.set}
              topBar={
                <div className="web-filebar">
                  <span className="web-filename" title={session.path.join('/')}>
                    {session.path.join(' / ')}
                  </span>
                  <StatusBadge session={session} />
                </div>
              }
              recoveryActions={[
                { label: s.undoLast, onPress: () => session.undoLastChange() },
                { label: s.reload, onPress: () => void session.reloadFromDisk() },
              ]}
            />
            <ConflictDialog session={session} />
          </>
        ) : (
          !error && <p className="web-muted web-pad">{s.pickFile}</p>
        )}
      </section>
    </div>
  );
}
