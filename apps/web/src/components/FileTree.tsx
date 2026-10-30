// SPDX-License-Identifier: MIT
import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listMarkdownTree, type TreeEntry } from '../fs/tree';
import type { DirectoryLike } from '../fs/types';
import { webStrings as s } from '../strings';

function Branch(props: {
  dir: DirectoryLike;
  path: readonly string[];
  active: readonly string[] | null;
  onOpen: (path: string[]) => void;
  depth: number;
}) {
  const [entries, setEntries] = useState<TreeEntry[] | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let alive = true;
    void listMarkdownTree(props.dir).then((list) => alive && setEntries(list));
    return () => {
      alive = false;
    };
  }, [props.dir]);

  // Buka otomatis folder yang memuat file aktif.
  useEffect(() => {
    const next = props.active?.[props.path.length];
    if (next && props.active && props.active.length > props.path.length + 1) {
      setOpen((o) => (o[next] ? o : { ...o, [next]: true }));
    }
  }, [props.active, props.path.length]);

  if (!entries) return null;
  if (entries.length === 0 && props.depth === 0)
    return <p className="web-muted web-small web-pad">{s.noFiles}</p>;
  return (
    <ul className="web-tree" role={props.depth === 0 ? 'tree' : 'group'}>
      {entries.map((entry) => {
        const path = [...props.path, entry.name];
        const indent = { paddingLeft: `${8 + props.depth * 14}px` };
        if (entry.kind === 'file') {
          const isActive = props.active?.join('/') === path.join('/');
          return (
            <li key={entry.name} role="treeitem" aria-selected={isActive}>
              <button
                type="button"
                className={`web-tree-item${isActive ? ' web-active' : ''}`}
                style={indent}
                onClick={() => props.onOpen(path)}
              >
                <FileText size={14} aria-hidden /> {entry.name.replace(/\.(md|markdown)$/i, '')}
              </button>
            </li>
          );
        }
        const expanded = open[entry.name] ?? false;
        return (
          <li key={entry.name} role="treeitem" aria-expanded={expanded} aria-selected={false}>
            <button
              type="button"
              className="web-tree-item"
              style={indent}
              onClick={() => setOpen((o) => ({ ...o, [entry.name]: !expanded }))}
            >
              {expanded ? (
                <ChevronDown size={14} aria-hidden />
              ) : (
                <ChevronRight size={14} aria-hidden />
              )}
              <Folder size={14} aria-hidden /> {entry.name}
            </button>
            {expanded && (
              <Branch
                dir={entry.dir}
                path={path}
                active={props.active}
                onOpen={props.onOpen}
                depth={props.depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function FileTree(props: {
  root: DirectoryLike;
  active: readonly string[] | null;
  onOpen: (path: string[]) => void;
}) {
  return (
    <Branch dir={props.root} path={[]} active={props.active} onOpen={props.onOpen} depth={0} />
  );
}
