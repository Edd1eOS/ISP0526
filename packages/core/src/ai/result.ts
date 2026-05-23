// Minimal Result type for AI adapters. Per ai-layer.instructions.md, every
// adapter returns `Result<TOutput, AIError>` so the caller can fall back
// gracefully instead of throwing on validation failure.

export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
    return { ok: true, value };
}

export function err<E>(error: E): Err<E> {
    return { ok: false, error };
}

export type AIErrorKind =
    | "validation_failed"
    | "generation_failed"
    | "post_filter_rejected"
    | "rate_limited"
    | "timeout";

export interface AIError {
    readonly kind: AIErrorKind;
    readonly message: string;
    readonly cause?: unknown;
}
