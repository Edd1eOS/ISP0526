"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractPdfText } from "@/lib/pdf/extract-pdf-text";
import { extractDocxText } from "@/lib/docx/extract-docx-text";
import { trackEvent } from "../../lib/analytics/track";
import { startIntakeFromTextAction } from "./upload-actions";

type FileStatus = "queued" | "parsing" | "done" | "error";

interface QueuedFile {
    readonly id: string;
    readonly file: File;
    status: FileStatus;
    progress: number;
    text?: string;
    error?: string;
}

const PDF_MIME = "application/pdf";
const DOCX_MIME =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ACCEPTED_TYPES = [PDF_MIME, DOCX_MIME];
// reason: some browsers leave `file.type` empty for .docx dragged from
// Explorer; fall back to the extension before rejecting the file.
const ACCEPTED_EXTS = [".pdf", ".docx"];
const MAX_BYTES = 10 * 1024 * 1024;

function detectKind(file: File): "pdf" | "docx" | null {
    const name = file.name.toLowerCase();
    if (file.type === PDF_MIME || name.endsWith(".pdf")) return "pdf";
    if (file.type === DOCX_MIME || name.endsWith(".docx")) return "docx";
    return null;
}

export function UploadDropzone() {
    const router = useRouter();
    const [files, setFiles] = useState<ReadonlyArray<QueuedFile>>([]);
    const [dragOver, setDragOver] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const acceptFiles = useCallback(async (incoming: FileList | File[]) => {
        const accepted: QueuedFile[] = [];
        for (const file of Array.from(incoming)) {
            if (!detectKind(file)) continue;
            if (file.size > MAX_BYTES) continue;
            accepted.push({
                id: `${file.name}:${file.size}:${Date.now()}`,
                file,
                status: "queued",
                progress: 0,
            });
        }
        if (accepted.length === 0) return;
        setFiles((prev) => [...prev, ...accepted]);
        for (const queued of accepted) {
            // eslint-disable-next-line react-hooks/immutability
            void parseOne(queued);
        }
    }, []);

    const parseOne = async (queued: QueuedFile) => {
        setFiles((prev) =>
            prev.map((f) =>
                f.id === queued.id ? { ...f, status: "parsing", progress: 10 } : f,
            ),
        );
        try {
            const kind = detectKind(queued.file);
            let text: string;
            if (kind === "pdf") {
                text = await extractPdfText(queued.file, (pct) => {
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.id === queued.id
                                ? { ...f, progress: Math.max(f.progress, pct) }
                                : f,
                        ),
                    );
                });
            } else if (kind === "docx") {
                // mammoth has no progress callback; bump to 50% so the bar moves.
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === queued.id ? { ...f, progress: 50 } : f,
                    ),
                );
                text = await extractDocxText(queued.file);
            } else {
                throw new Error("unsupported file type");
            }
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === queued.id
                        ? { ...f, status: "done", progress: 100, text }
                        : f,
                ),
            );
        } catch (cause) {
            const msg = cause instanceof Error ? cause.message : "解析失败";
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === queued.id
                        ? { ...f, status: "error", error: msg }
                        : f,
                ),
            );
        }
    };

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files) void acceptFiles(e.dataTransfer.files);
    };

    const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) void acceptFiles(e.target.files);
        e.target.value = "";
    };

    const removeFile = (id: string) => {
        setFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const doneCount = files.filter((f) => f.status === "done").length;
    const canSubmit = doneCount > 0 && !submitting;

    const onSubmit = async () => {
        setSubmitting(true);
        trackEvent("intake_submitted", { channel: "upload" });
        try {
            const done = files.filter((f) => f.status === "done" && f.text);
            // Concatenate all uploaded sources into one prompt; label by the
            // first filename so the review page can show provenance.
            const combinedText = done
                .map((f) => `=== ${f.file.name} ===\n${f.text}`)
                .join("\n\n");
            const label =
                done.length === 1
                    ? done[0]!.file.name
                    : `${done[0]!.file.name} 等 ${done.length} 份`;
            const result = await startIntakeFromTextAction({
                source: "upload",
                label,
                text: combinedText,
            });
            if (!result.ok || !result.sessionId) {
                alert(`抽取失败：${result.error ?? "未知错误"}`);
                setSubmitting(false);
                return;
            }
            router.push(`/intake/review/${result.sessionId}`);
        } catch (cause) {
            // eslint-disable-next-line no-console
            console.error("[upload] submit failed", cause);
            alert("出错了，再试一次？");
            setSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className="flex min-h-[360px] flex-col items-center justify-center gap-5 p-8 transition-colors"
                style={{
                    background: "var(--color-surface)",
                    borderRadius: "var(--radius-card-md)",
                    boxShadow: "var(--shadow-clay-card)",
                    border: dragOver
                        ? "2px dashed var(--color-primary-from)"
                        : "2px dashed var(--color-surface-alt)",
                }}
            >
                <span className="text-5xl" aria-hidden>
                    ☁️
                </span>
                <div className="space-y-1 text-center">
                    <p className="text-text text-base font-semibold">
                        拖入 PDF 或 Word 文件
                    </p>
                    <p className="text-text-muted text-xs">
                        简历 / 成绩单 / 录取信均可 · .pdf / .docx · ≤ 10 MB
                    </p>
                </div>
                <span className="text-text-muted text-xs uppercase tracking-widest">
                    或
                </span>
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="text-text-on-primary px-5 py-2.5 text-sm font-semibold transition-transform active:scale-95"
                    style={{
                        background: "var(--gradient-primary)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-primary)",
                    }}
                >
                    选择文件
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept={[...ACCEPTED_TYPES, ...ACCEPTED_EXTS].join(",")}
                    multiple
                    onChange={onPick}
                    className="hidden"
                />
            </div>

            <div className="space-y-3">
                <h2 className="text-text text-sm font-medium uppercase tracking-widest">
                    收件篮 · {files.length}
                </h2>
                {files.length === 0 ? (
                    <p className="text-text-muted text-sm">
                        空空如也。丢一份过来，或点“挑一份”。
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {files.map((f) => (
                            <FileRow
                                key={f.id}
                                queued={f}
                                onRemove={() => removeFile(f.id)}
                            />
                        ))}
                    </ul>
                )}

                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={!canSubmit}
                    className="text-text-on-primary mt-2 w-full px-6 py-3 text-base font-semibold transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                        background: "var(--gradient-primary)",
                        borderRadius: "var(--radius-button)",
                        boxShadow: "var(--shadow-clay-primary)",
                    }}
                >
                    {submitting
                        ? "AI 读中…请稍等"
                        : doneCount > 0
                            ? `带着这 ${doneCount} 份去审阅`
                            : "等文件准备好再继续"}
                </button>
            </div>
        </div>
    );
}

function FileRow({
    queued,
    onRemove,
}: {
    queued: QueuedFile;
    onRemove: () => void;
}) {
    const sizeKb = (queued.file.size / 1024).toFixed(0);
    return (
        <li
            className="space-y-2 p-4"
            style={{
                background: "var(--color-surface)",
                borderRadius: "var(--radius-card-sm)",
                boxShadow: "var(--shadow-clay-card)",
            }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-text truncate text-sm font-medium">
                        {queued.file.name}
                    </p>
                    <p className="text-text-muted text-xs">{sizeKb} KB</p>
                </div>
                <StatusBadge status={queued.status} />
                <button
                    type="button"
                    onClick={onRemove}
                    className="text-text-muted hover:text-text text-lg leading-none"
                    aria-label="移除"
                >
                    ×
                </button>
            </div>
            <div
                className="h-1.5 w-full overflow-hidden"
                style={{
                    background: "var(--color-surface-alt)",
                    borderRadius: "999px",
                }}
            >
                <div
                    className="h-full transition-[width] duration-300"
                    style={{
                        width: `${queued.progress}%`,
                        background: "var(--gradient-primary)",
                    }}
                />
            </div>
            {queued.error ? (
                <p className="text-warning text-xs">{queued.error}</p>
            ) : null}
        </li>
    );
}

function StatusBadge({ status }: { status: FileStatus }) {
    const map: Record<FileStatus, { text: string; bg: string }> = {
        queued: { text: "排队", bg: "var(--color-surface-alt)" },
        parsing: { text: "读取中", bg: "var(--color-surface-alt)" },
        done: { text: "✓", bg: "var(--color-success, #2f9461)" },
        error: { text: "✕", bg: "var(--color-warning, #c84a3f)" },
    };
    const cfg = map[status];
    const isIcon = status === "done" || status === "error";
    return (
        <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${isIcon ? "text-white" : "text-text-muted"
                }`}
            style={{ background: cfg.bg }}
        >
            {cfg.text}
        </span>
    );
}
