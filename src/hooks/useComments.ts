import { useState, useEffect, useCallback } from "react";
import * as api from "../api";
import type { Comment } from "../types/schema";
import type { ReviewedFileState } from "../api";

export type CommentWithFreshness = Comment & { freshness?: "fresh" | "stale" | "orphaned" };

export function useComments(base: string, head: string) {
  const [comments, setComments] = useState<CommentWithFreshness[]>([]);
  const [reviewedFiles, setReviewedFiles] = useState<Record<string, ReviewedFileState>>({});

  const refresh = useCallback(() => {
    if (!base || !head) return;
    api.getComments(base, head).then(({ comments, reviewedFiles }) => {
      setComments(comments);
      setReviewedFiles(reviewedFiles ?? {});
    });
  }, [base, head]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addComment = async (data: {
    file: string;
    startLine: number;
    endLine: number;
    side: "old" | "new";
    body: string;
  }) => {
    await api.createComment({ base, head, ...data });
    refresh();
  };

  const resolveComment = async (id: string) => {
    await api.updateComment(id, { base, head, status: "resolved" });
    refresh();
  };

  const reopenComment = async (id: string) => {
    await api.updateComment(id, { base, head, status: "open" });
    refresh();
  };

  const removeComment = async (id: string) => {
    await api.deleteComment(id, base, head);
    refresh();
  };

  const markReviewed = async (file: string) => {
    await api.markFileReviewed(file, base, head);
    refresh();
  };

  const unmarkReviewed = async (file: string) => {
    await api.unmarkFileReviewed(file, base, head);
    refresh();
  };

  return {
    comments, addComment, resolveComment, reopenComment, removeComment,
    reviewedFiles, markReviewed, unmarkReviewed,
    refresh,
  };
}
