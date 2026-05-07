export interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  additions?: number;
  deletions?: number;
}

interface FileStat {
  file: string;
  additions: number;
  deletions: number;
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
  const dirs = nodes
    .filter(n => n.children.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = nodes
    .filter(n => n.children.length === 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const dir of dirs) {
    dir.children = sortTree(dir.children);
  }

  return [...dirs, ...files];
}

export function buildFileTree(files: FileStat[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const stat of files) {
    const segments = stat.file.split("/");
    let current = root;
    let cumulativePath = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      cumulativePath = cumulativePath ? `${cumulativePath}/${segment}` : segment;
      const isLeaf = i === segments.length - 1;

      let node = current.find(n => n.name === segment);
      if (!node) {
        node = {
          name: segment,
          path: cumulativePath,
          children: [],
          ...(isLeaf ? { additions: stat.additions, deletions: stat.deletions } : {}),
        };
        current.push(node);
      }

      current = node.children;
    }
  }

  return collapseTree(sortTree(root));
}

function collapseTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.map(node => {
    if (node.children.length === 0) return node;
    node.children = collapseTree(node.children);
    // Flatten: if a dir has exactly one child and that child is also a dir, merge them
    if (node.children.length === 1 && node.children[0].children.length > 0) {
      const child = node.children[0];
      return {
        name: `${node.name}/${child.name}`,
        path: child.path,
        children: child.children,
      };
    }
    return node;
  });
}

export function getExpandedPaths(activeFile: string | null): Set<string> {
  if (activeFile === null) return new Set();

  const segments = activeFile.split("/");
  const paths = new Set<string>();

  // All segments except the last (leaf) are directory paths to expand
  for (let i = 0; i < segments.length - 1; i++) {
    const path = segments.slice(0, i + 1).join("/");
    paths.add(path);
  }

  return paths;
}
