// SPDX-License-Identifier: MIT
import { useState } from 'react';
import { readTextAt } from './fs/memory';
import { AccessDirectory } from './fs/fs-access';
import type { DirectoryLike } from './fs/types';
import { createDemoFolder, DEMO_START } from './demo/content';
import { StartPage } from './components/StartPage';
import { Workspace } from './components/Workspace';

type Screen =
  | { readonly kind: 'start' }
  | {
      readonly kind: 'workspace';
      readonly root: DirectoryLike;
      readonly demo: boolean;
      readonly initial?: string[];
    };

function demoScreen(): Screen {
  const root = createDemoFolder();
  // Hook untuk test E2E dan inspeksi manual: baca isi file demo.
  window.__markpiwDemo = { read: (path) => readTextAt(root, path.split('/')) };
  return { kind: 'workspace', root, demo: true, initial: DEMO_START };
}

export function App() {
  const [screen, setScreen] = useState<Screen>(() =>
    new URLSearchParams(location.search).has('demo') ? demoScreen() : { kind: 'start' },
  );
  if (screen.kind === 'start') {
    return (
      <StartPage
        onOpen={(handle) =>
          setScreen({ kind: 'workspace', root: new AccessDirectory(handle), demo: false })
        }
        onDemo={() => setScreen(demoScreen())}
      />
    );
  }
  return (
    <Workspace
      root={screen.root}
      demo={screen.demo}
      {...(screen.initial ? { initial: screen.initial } : {})}
      onClose={() => setScreen({ kind: 'start' })}
    />
  );
}
