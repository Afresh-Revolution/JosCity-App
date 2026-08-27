type ReactionState = {
  user_reacted: boolean;
  reactions_count: number;
};

const overrides = new Map<number, ReactionState>();

export function parseReactedFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1" || normalized === "yes";
}

export function getCommentReaction(commentId: number): ReactionState | undefined {
  return overrides.get(commentId);
}

export function setCommentReaction(commentId: number, state: ReactionState): void {
  if (!commentId) return;
  overrides.set(commentId, {
    user_reacted: Boolean(state.user_reacted),
    reactions_count: Math.max(0, Number(state.reactions_count) || 0),
  });
}

export function applyCommentReactions<T extends {
  id?: number;
  comment_id?: number;
  user_reacted?: boolean;
  reactions_count?: number;
  replies?: T[];
}>(rows: T[]): T[] {
  return rows.map((row) => {
    const id = Number(row.comment_id ?? row.id ?? 0);
    const override = id ? overrides.get(id) : undefined;
    const replies = Array.isArray(row.replies) ? applyCommentReactions(row.replies) : row.replies;
    const user_reacted = override ? override.user_reacted : parseReactedFlag(row.user_reacted);
    const reactions_count = override
      ? override.reactions_count
      : Math.max(0, Number(row.reactions_count) || 0);
    if (id && !override) {
      overrides.set(id, { user_reacted, reactions_count });
    }
    return { ...row, replies, user_reacted, reactions_count };
  });
}
