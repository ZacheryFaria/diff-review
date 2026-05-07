import { createHash } from "crypto";
import type Parser from "web-tree-sitter";
import type { Block } from "./types.js";

type SyntaxNode = Parser.SyntaxNode;

const NAMED_NODE_TYPES = new Set([
  "function_declaration",
  "method_definition",
  "class_declaration",
  "arrow_function",
  "variable_declarator",
  "function_definition",
  "class_definition",
  "method_declaration",
  "type_declaration",
  "function_item",
  "impl_item",
  "struct_item",
  "enum_item",
  "rule_set",
  "media_statement",
  "keyframes_statement",
  "struct_specifier",
  "class_specifier",
  "interface_declaration",
]);

export function hashString(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function getNodeName(node: SyntaxNode): string | null {
  const byName = node.childForFieldName("name");
  if (byName) return byName.text;

  const byDeclarator = node.childForFieldName("declarator");
  if (byDeclarator) return byDeclarator.text;

  const bySelector = node.childForFieldName("selector");
  if (bySelector) return bySelector.text;

  if (node.type === "variable_declarator" && node.firstNamedChild) {
    return node.firstNamedChild.text;
  }

  return null;
}

function walk(node: SyntaxNode, blocks: Block[]): void {
  if (NAMED_NODE_TYPES.has(node.type)) {
    const name = getNodeName(node);
    if (name) {
      const source = node.text;
      const normalized = normalizeWhitespace(source);
      blocks.push({
        name,
        type: node.type,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        bodyHash: hashString(normalized),
        nameHash: hashString(name),
        source,
      });
    }
  }

  for (const child of node.namedChildren) {
    walk(child, blocks);
  }
}

export function extractBlocks(tree: Parser.Tree, _source: string): Block[] {
  const blocks: Block[] = [];
  walk(tree.rootNode, blocks);
  return blocks;
}
