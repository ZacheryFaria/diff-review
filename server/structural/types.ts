export interface Block {
  name: string;
  type: string;
  startLine: number;
  endLine: number;
  bodyHash: string;
  nameHash: string;
  source: string;
}

export interface StructuralChange {
  type: "moved" | "renamed" | "formatting";
  label: string;
  oldStartLine?: number;
  oldEndLine?: number;
  newStartLine?: number;
  newEndLine?: number;
  details?: string;
}
