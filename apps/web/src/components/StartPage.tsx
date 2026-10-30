// SPDX-License-Identifier: MIT
import { FolderOpen, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { forgetFolder, type RecentFolder, recentFolders, rememberFolder } from '../storage';
import { webStrings as s } from '../strings';

export function StartPage(props: {
  onOpen: (handle: FileSystemDirectoryHandle) => void;
  onDemo: () => void;
}) {
  const supported = typeof window.showDirectoryPicker === 'function';
  const secure = window.isSecureContext;
  const [recent, setRecent] = useState<RecentFolder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supported) void recentFolders().then(setRecent);
  }, [supported]);

  const pick = async () => {
    setError(null);
    try {
      const handle = await window.showDirectoryPicker?.({ mode: 'readwrite', id: 'markpiw' });
      if (!handle) return;
      await rememberFolder(handle);
      props.onOpen(handle);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(String(e));
    }
  };

  const reopen = async (folder: RecentFolder) => {
    setError(null);
    try {
      let permission = await folder.handle.queryPermission({ mode: 'readwrite' });
      if (permission === 'prompt')
        permission = await folder.handle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') return;
      await rememberFolder(folder.handle);
      props.onOpen(folder.handle);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="web-start">
      <div className="web-start-card">
        <h1>{s.title}</h1>
        <p className="web-muted">{s.tagline}</p>
        {!supported && <p className="web-warning">{s.unsupported}</p>}
        {supported && !secure && <p className="web-warning">{s.insecure}</p>}
        <div className="web-start-actions">
          <button
            type="button"
            className="web-primary"
            onClick={() => void pick()}
            disabled={!supported || !secure}
          >
            <FolderOpen size={18} aria-hidden /> {s.openFolder}
          </button>
          <button type="button" className="web-secondary" onClick={props.onDemo}>
            <Sparkles size={18} aria-hidden /> {s.tryDemo}
          </button>
        </div>
        <p className="web-muted web-small">{s.demoHint}</p>
        {error && <p className="web-warning">{error}</p>}
        {recent.length > 0 && (
          <section className="web-recent">
            <h2>{s.recent}</h2>
            <ul>
              {recent.map((folder) => (
                <li key={folder.name}>
                  <button type="button" className="web-link" onClick={() => void reopen(folder)}>
                    {folder.name}
                  </button>
                  <button
                    type="button"
                    className="web-quiet"
                    onClick={() =>
                      void forgetFolder(folder.name).then(() => recentFolders().then(setRecent))
                    }
                  >
                    {s.forget}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
