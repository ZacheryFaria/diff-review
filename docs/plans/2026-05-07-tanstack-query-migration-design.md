# TanStack Query Migration

## Problem

When marking a file as "reviewed", the UI waits for the full network round-trip before collapsing the file. The current architecture uses plain `useState` with a fire-and-refetch pattern after mutations, creating perceptible latency on every state change.

## Solution

Replace all three custom hooks (`useDiff`, `useComments`, `usePreferences`) with TanStack Query queries and mutations. Optimistic updates eliminate perceived latency for mutations.

## Architecture

A `QueryClientProvider` wraps the app at the root. All server state lives in the query cache — no more manual `useState` for async data.

### Query Key Structure

```
['review', baseCommit, headCommit, 'diff']
['review', baseCommit, headCommit, 'comments']
['preferences']  // global, not review-scoped
```

Switching reviews (different base/head) automatically drops stale cache entries.

### Hook Mapping

| Current Hook | New Hook | Type |
|---|---|---|
| `useDiff` | `useDiffQuery` | `useQuery` |
| `useComments` (read) | `useCommentsQuery` | `useQuery` |
| `useComments` (markReviewed) | `useMarkReviewedMutation` | `useMutation` + optimistic |
| `useComments` (unmarkReviewed) | `useUnmarkReviewedMutation` | `useMutation` + optimistic |
| `usePreferences` | `usePreferencesQuery` + `useUpdatePreferencesMutation` | `useQuery` + `useMutation` |

### Optimistic Update Pattern (markReviewed)

```ts
useMutation({
  mutationFn: (file: string) => api.markFileReviewed(file),
  onMutate: async (file) => {
    await queryClient.cancelQueries({ queryKey: commentsKey });
    const previous = queryClient.getQueryData(commentsKey);
    queryClient.setQueryData(commentsKey, (old) => ({
      ...old,
      reviewedFiles: {
        ...old.reviewedFiles,
        [file]: { reviewedAt: new Date().toISOString(), fileHash: '', fresh: true }
      }
    }));
    return { previous };
  },
  onError: (_err, _file, context) => {
    queryClient.setQueryData(commentsKey, context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: commentsKey });
  },
});
```

### File Changes

1. **New:** `src/hooks/queries.ts` — all query/mutation hooks
2. **Modified:** `src/App.tsx` — wrap with `QueryClientProvider`, replace hook usage
3. **Unchanged:** `src/api.ts` — functions consumed as queryFn/mutationFn
4. **Removed:** `src/hooks/useDiff.ts`, `src/hooks/useComments.ts`, `src/hooks/usePreferences.ts`
5. **Modified:** `package.json` — add `@tanstack/react-query`

### What stays the same

- `fetchJson` wrapper and all API functions
- Server routes — no backend changes
- Component data shapes — components receive the same types
