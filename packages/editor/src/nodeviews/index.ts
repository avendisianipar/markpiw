// SPDX-License-Identifier: LicenseRef-Proprietary
import type { EditorProps } from 'prosemirror-view';
import type { EditorController } from '../controller';

export function createNodeViews(
  _controller: EditorController,
): NonNullable<EditorProps['nodeViews']> {
  return {};
}
