# TanStack Query Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all manual state-management hooks with TanStack Query for optimistic updates and unified cache management.

**Architecture:** Add `@tanstack/react-query` as a dependency. Create a single `src/hooks/queries.ts` file containing all query/mutation hooks. Wrap `App` in `QueryClientProvider`. Remove old hooks. Move the `CommentWithFreshness` type to `api.ts` to break the circular import.

**Tech Stack:** React 18, TanStack Query v5, picomatch (existing)

---

### Task 1: Install TanStack Query

**Files:**
- Modify: `package.json`

**Step 1: Add the dependency**

Run: `cd /Users/zfaria/sources/diff-review && pnpm add @tanstack/react-query`

**Step 2: Verify installation**

Run: `pnpm list @tanstack/react-query`
Expected: Shows `@tanstack/react-query` version 5.x

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "minor: add @tanstack/react-query dependency"
```

---

### Task 2: Move CommentWithFreshness type to api.ts

The `CommentWithFreshness` type is currently defined in `useComments.ts` and imported by `api.ts`, `DiffView.tsx`, and `DiffFile.tsx`. Moving it to `api.ts` breaks the circular dependency and lets us delete the old hooks cleanly.

**Files:**
- Modify: `src/api.ts` — add `CommentWithFreshness` export
- Modify: `src/hooks/useComments.ts` — re-export from api.ts (temporary, removed in Task 4)
- Modify: `src/components/DiffView/DiffView.tsx` — update import path
- Modify: `src/components/DiffView/DiffFile.tsx` — update import path

**Step 1: Add the type to api.ts**

In `src/api.ts`, after the `ReviewedFileState` interface, add:

```ts
export type CommentWithFreshness = Comment & { freshness?: "fresh" | "stale" | "orphaned" };
```

And remove the import of `CommentWithFreshness` from the top of `api.ts` (line 2: `import type { CommentWithFreshness } from "./hooks/useComments";`).

**Step 2: Update useComments.ts to re-export**

Replace the type definition line with:

```ts
export type { CommentWithFreshness } from "../api";
```

**Step 3: Update DiffView.tsx import**

Change:
```ts
import type { CommentWithFreshness } from "../../hooks/useComments";
```
To:
```ts
import type { CommentWithFreshness } from "../../api";
```

**Step 4: Update DiffFile.tsx import**

Same change as Step 3.

**Step 5: Verify it compiles**

Run: `cd /Users/zfaria/sources/diff-review && npx tsc --noEmit -p tsconfig.json 2>&1 | head -30`

If no tsconfig.json for the frontend, try: `npx vite build --mode development 2>&1 | tail -20`

**Step 6: Commit**

```bash
git add src/api.ts src/hooks/useComments.ts src/components/DiffView/DiffView.tsx src/components/DiffView/DiffFile.tsx
git commit -m "chore: move CommentWithFreshness type to api.ts"
```

---

### Task 3: Create src/hooks/queries.ts with all query and mutation hooks

**Files:**
- Create: `src/hooks/queries.ts`

**Step 1: Write the hooks file**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import picomatch from "picomatch";
import * as api from "../api";
import type { ReviewedFileState, CommentWithFreshness } from "../api";

// --- Query Keys ---

export const reviewKeys = {
  all: ["review"] as const,
  diff: (base: string, head: string) => ["review", base, head, "diff"] as const,
  files: (base: string, head: string) => ["review", base, head, "files"] as const,
  comments: (base: string, head: string) => ["review", base, head, "comments"] as const,
};

export const preferencesKeys = {
  all: ["preferences"] as const,
};

// --- Diff ---

export function useDiffQuery(base: string, head: string) {
  return useQuery({
    queryKey: reviewKeys.diff(base, head),
    queryFn: () => api.getDiff(base, head),
    enabled: !!base && !!head && base !== head,
  });
}

// --- Files ---

export function useFilesQuery(base: string, head: string) {
  return useQuery({
    queryKey: reviewKeys.files(base, head),
    queryFn: () => api.getFiles(base, head).then(r => r.files),
    enabled: !!base && !!head && base !== head,
  });
}

// --- Comments & Reviewed Files ---

interface CommentsData {
  comments: CommentWithFreshness[];
  reviewedFiles: Record<string, ReviewedFileState>;
}

export function useCommentsQuery(base: string, head: string) {
  return useQuery<CommentsData>({
    queryKey: reviewKeys.comments(base, head),
    queryFn: () => api.getComments(base, head),
    enabled: !!base && !!head,
  });
}

export function useAddCommentMutation(base: string, head: string) {
  const queryClient = useQueryClient();
  const key = reviewKeys.comments(base, head);

  return useMutation({
    mutationFn: (data: { file: string; startLine: number; endLine: number; side: "old" | "new"; body: string }) =>
      api.createComment({ base, head, ...data }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useResolveCommentMutation(base: string, head: string) {
  const queryClient = useQueryClient();
  const key = reviewKeys.comments(base, head);

  return useMutation({
    mutationFn: (id: string) => api.updateComment(id, { base, head, status: "resolved" }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useReopenCommentMutation(base: string, head: string) {
  const queryClient = useQueryClient();
  const key = reviewKeys.comments(base, head);

  return useMutation({
    mutationFn: (id: string) => api.updateComment(id, { base, head, status: "open" }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useDeleteCommentMutation(base: string, head: string) {
  const queryClient = useQueryClient();
  const key = reviewKeys.comments(base, head);

  return useMutation({
    mutationFn: (id: string) => api.deleteComment(id, base, head),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useMarkReviewedMutation(base: string, head: string) {
  const queryClient = useQueryClient();
  const key = reviewKeys.comments(base, head);

  return useMutation({
    mutationFn: (file: string) => api.markFileReviewed(file, base, head),
    onMutate: async (file) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CommentsData>(key);
      queryClient.setQueryData<CommentsData>(key, old => {
        if (!old) return old;
        return {
          ...old,
          reviewedFiles: {
            ...old.reviewedFiles,
            [file]: { reviewedAt: new Date().toISOString(), fileHash: "", fresh: true },
          },
        };
      });
      return { previous };
    },
    onError: (_err, _file, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

export function useUnmarkReviewedMutation(base: string, head: string) {
  const queryClient = useQueryClient();
  const key = reviewKeys.comments(base, head);

  return useMutation({
    mutationFn: (file: string) => api.unmarkFileReviewed(file, base, head),
    onMutate: async (file) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CommentsData>(key);
      queryClient.setQueryData<CommentsData>(key, old => {
        if (!old) return old;
        const { [file]: _, ...rest } = old.reviewedFiles;
        return { ...old, reviewedFiles: rest };
      });
      return { previous };
    },
    onError: (_err, _file, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

// --- Preferences ---

export function usePreferencesQuery() {
  const { data: patterns = { global: [], repo: [] }, ...rest } = useQuery({
    queryKey: preferencesKeys.all,
    queryFn: () => api.getPreferences(),
  });

  const allPatterns = useMemo(() => [...patterns.global, ...patterns.repo], [patterns]);

  const isIgnored = useCallback(
    (filePath: string) => {
      if (allPatterns.length === 0) return false;
      return picomatch.isMatch(filePath, allPatterns);
    },
    [allPatterns]
  );

  return { patterns, isIgnored, ...rest };
}

export function useAddIgnorePatternMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pattern, scope }: { pattern: string; scope: "global" | "repo" }) =>
      api.addIgnorePattern(pattern, scope),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: preferencesKeys.all });
    },
  });
}

export function useRemoveIgnorePatternMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pattern, scope }: { pattern: string; scope: "global" | "repo" }) =>
      api.removeIgnorePattern(pattern, scope),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: preferencesKeys.all });
    },
  });
}
```

**Step 2: Verify it compiles**

Run: `cd /Users/zfaria/sources/diff-review && npx vite build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add src/hooks/queries.ts
git commit -m "minor: add TanStack Query hooks for all data fetching"
```

---

### Task 4: Rewrite App.tsx to use TanStack Query hooks

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx` (or wherever ReactDOM.createRoot is — wrap with QueryClientProvider)

**Step 1: Find the entry point**

Run: `grep -rn "createRoot\|ReactDOM.render" /Users/zfaria/sources/diff-review/src/`

**Step 2: Add QueryClientProvider to the entry point**

In the entry file (likely `src/main.tsx`), wrap `<App />` with:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Wrap <App /> with:
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

**Step 3: Rewrite App.tsx**

Replace the hook imports and usage. The new `App.tsx` should:
- Remove imports of `useDiff`, `useComments`, `usePreferences`
- Import from `./hooks/queries` instead
- Replace `useDiff(base, head)` with `useDiffQuery(base, head)`
- Replace `useComments(base, head)` with `useCommentsQuery` + mutation hooks
- Replace `usePreferences()` with `usePreferencesQuery` + mutation hooks
- Replace the manual `getFiles` useEffect with `useFilesQuery(base, head)`
- Keep `getBranches` as a one-time useEffect (it sets local UI state for branch selectors)
- Replace `handleRefresh` with a function that invalidates the relevant query keys

Key mappings for the rewrite:

| Old | New |
|-----|-----|
| `diff` | `diffQuery.data?.diff ?? ""` |
| `baseCommit` | `diffQuery.data?.baseCommit ?? ""` |
| `headCommit` | `diffQuery.data?.headCommit ?? ""` |
| `diffLoading` | `diffQuery.isLoading` |
| `diffError` | `diffQuery.error?.message ?? null` |
| `comments` | `commentsQuery.data?.comments ?? []` |
| `reviewedFiles` | `commentsQuery.data?.reviewedFiles ?? {}` |
| `files` | `filesQuery.data ?? []` |
| `addComment(data)` | `addCommentMutation.mutateAsync(data)` |
| `resolveComment(id)` | `resolveCommentMutation.mutate(id)` |
| `reopenComment(id)` | `reopenCommentMutation.mutate(id)` |
| `removeComment(id)` | `deleteCommentMutation.mutate(id)` |
| `markReviewed(file)` | `markReviewedMutation.mutate(file)` |
| `unmarkReviewed(file)` | `unmarkReviewedMutation.mutate(file)` |
| `addPattern(p, s)` | `addPatternMutation.mutate({ pattern: p, scope: s })` |
| `removePattern(p, s)` | `removePatternMutation.mutate({ pattern: p, scope: s })` |
| `handleRefresh()` | `queryClient.invalidateQueries({ queryKey: reviewKeys.all })` |

**Step 4: Verify it compiles**

Run: `cd /Users/zfaria/sources/diff-review && npx vite build 2>&1 | tail -20`

**Step 5: Commit**

```bash
git add src/App.tsx src/main.tsx
git commit -m "minor: migrate App.tsx to TanStack Query hooks"
```

---

### Task 5: Delete old hook files

**Files:**
- Delete: `src/hooks/useDiff.ts`
- Delete: `src/hooks/useComments.ts`
- Delete: `src/hooks/usePreferences.ts`

**Step 1: Remove the files**

```bash
rm src/hooks/useDiff.ts src/hooks/useComments.ts src/hooks/usePreferences.ts
```

**Step 2: Verify no remaining imports reference them**

Run: `grep -rn "from.*hooks/useDiff\|from.*hooks/useComments\|from.*hooks/usePreferences" /Users/zfaria/sources/diff-review/src/`

Expected: No output (no remaining references)

**Step 3: Verify it compiles**

Run: `cd /Users/zfaria/sources/diff-review && npx vite build 2>&1 | tail -20`

**Step 4: Commit**

```bash
git add -A src/hooks/useDiff.ts src/hooks/useComments.ts src/hooks/usePreferences.ts
git commit -m "chore: remove old manual state hooks"
```

---

### Task 6: Smoke test

**Step 1: Start the dev server**

Run: `cd /Users/zfaria/sources/diff-review && pnpm dev`

**Step 2: Verify in browser**

- Open the app in browser
- Select base and head branches
- Verify diff loads
- Mark a file as reviewed — it should collapse instantly
- Unmark it — it should expand instantly
- Add a comment — verify it appears after brief refetch
- Resolve/reopen/delete a comment
- Open preferences, add/remove an ignore pattern

**Step 3: Final commit (if any fixes needed)**

Only if smoke testing reveals issues. Otherwise, done.
