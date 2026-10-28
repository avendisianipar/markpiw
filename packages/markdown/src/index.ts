// SPDX-License-Identifier: LicenseRef-Proprietary
export { schema } from './schema';
export type {
  NodeName,
  MarkName,
  BlockNodeName,
  InlineNodeName,
  SrcKey,
  Profile,
  SourceEntry,
  SourceIndex,
  ParsedDoc,
  GuardFailure,
  Contribution,
} from './types';
export { parseMarkdown } from './parse';
export { serializeMarkdown } from './serialize/serialize';
export { verifyRoundTrip } from './guard';
export { diffText } from './diff';
