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

export function useEditCommentMutation(base: string, head: string) {
  const queryClient = useQueryClient();
  const key = reviewKeys.comments(base, head);

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.updateComment(id, { base, head, body }),
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
