// SPDX-License-Identifier: LicenseRef-Proprietary
// Tombol mode terang/gelap di ujung kanan topbar; host (web/VS Code) yang menyimpan pilihannya.
import { Moon, Sun } from 'lucide-react';
import { ToggleButton } from 'react-aria-components';
import { t } from './strings/id';

export type ColorScheme = 'light' | 'dark';

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true } as const;

export function ThemeToggle(props: { scheme: ColorScheme; onChange: (next: ColorScheme) => void }) {
  const dark = props.scheme === 'dark';
  return (
    <ToggleButton
      className="mp-tool mp-theme-toggle"
      aria-label={t('toolbar.darkMode')}
      isSelected={dark}
      onChange={(selected) => props.onChange(selected ? 'dark' : 'light')}
    >
      <span title={t('toolbar.darkMode')} className="mp-tool-inner">
        {dark ? <Moon {...ICON} /> : <Sun {...ICON} />}
      </span>
    </ToggleButton>
  );
}
