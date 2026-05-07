import type { Block, StructuralChange } from "./types.js";
import { normalizeWhitespace } from "./block-extractor.js";

export function similarity(a: string, b: string): number {
  const tokensA = new Set(normalizeWhitespace(a).split(" "));
  const tokensB = new Set(normalizeWhitespace(b).split(" "));

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  if (union === 0) return 1;
  return intersection / union;
}

export function matchBlocks(
  oldBlocks: Block[],
  newBlocks: Block[],
  oldSource: string,
  newSource: string
): StructuralChange[] {
  const changes: StructuralChange[] = [];

  // Pass 1: Moved blocks — same bodyHash + same name, different startLine
  const matchedOldIndices = new Set<number>();
  const matchedNewIndices = new Set<number>();

  for (let i = 0; i < oldBlocks.length; i++) {
    const oldBlock = oldBlocks[i];
    for (let j = 0; j < newBlocks.length; j++) {
      if (matchedNewIndices.has(j)) continue;
      const newBlock = newBlocks[j];
      if (
        oldBlock.bodyHash === newBlock.bodyHash &&
        oldBlock.name === newBlock.name &&
        oldBlock.startLine !== newBlock.startLine
      ) {
        changes.push({
          type: "moved",
          label: `${oldBlock.type} \`${oldBlock.name}\` moved`,
          oldStartLine: oldBlock.startLine,
          oldEndLine: oldBlock.endLine,
          newStartLine: newBlock.startLine,
          newEndLine: newBlock.endLine,
          details: `Moved from line ${oldBlock.startLine} to line ${newBlock.startLine}`,
        });
        matchedOldIndices.add(i);
        matchedNewIndices.add(j);
        break;
      }
    }
  }

  // Pass 2: Renamed blocks — different name, same type, similarity > 0.8
  for (let i = 0; i < oldBlocks.length; i++) {
    if (matchedOldIndices.has(i)) continue;
    const oldBlock = oldBlocks[i];
    for (let j = 0; j < newBlocks.length; j++) {
      if (matchedNewIndices.has(j)) continue;
      const newBlock = newBlocks[j];
      if (
        oldBlock.name !== newBlock.name &&
        oldBlock.type === newBlock.type &&
        similarity(oldBlock.source, newBlock.source) > 0.8
      ) {
        changes.push({
          type: "renamed",
          label: `${oldBlock.type} \`${oldBlock.name}\` renamed to \`${newBlock.name}\``,
          oldStartLine: oldBlock.startLine,
          oldEndLine: oldBlock.endLine,
          newStartLine: newBlock.startLine,
          newEndLine: newBlock.endLine,
          details: `Renamed from \`${oldBlock.name}\` to \`${newBlock.name}\``,
        });
        matchedOldIndices.add(i);
        matchedNewIndices.add(j);
        break;
      }
    }
  }

  // Pass 3: Formatting-only — entire file normalized content matches but raw differs
  if (
    oldSource !== newSource &&
    normalizeWhitespace(oldSource) === normalizeWhitespace(newSource)
  ) {
    changes.push({
      type: "formatting",
      label: "Formatting-only change",
      details: "File content is identical after normalizing whitespace",
    });
  }

  return changes;
}
