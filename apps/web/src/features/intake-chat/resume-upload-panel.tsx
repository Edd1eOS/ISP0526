"use client";

/**
 * ResumeUploadPanel
 *
 * Lightweight drag-and-drop + file-picker panel used by the chat module to
 * accept a resume / transcript / offer letter at any point during the
 * conversation. Parses the file in the browser (same helpers as the legacy
 * upload door), then calls the server action that returns a ClarifyPatch
 * the chat can merge into its accumulated state.
 *
 * This component owns no chat state; it reports its progress via callbacks
 * and lets the parent decide how to render success / error feedback.
 */

import { useCallback, useRef, useState, useTransition } from "react";
import { extractPdfText } from "@/lib/pdf/extract-pdf-text";
import { extractDocxText } from "@/lib/docx/extract-docx-text";
import {
    extractResumeForChatAction,
    type ResumeExtractResult,
} from "./chat-actions";

const PDF_MIME = "application/pdf";
const DOCX_MIME =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_BYTES = 10 * 1024 * 1024;

function detectKind(file: File): "pdf" | "docx" | null {
    const name = file.name.toLowerCase();
    if (file.type === PDF_MIME || name.endsWith(".pdf")) return "pdf";
    if (file.type === DOCX_MIME || name.endsWith(".docx")) return "docx";
    return null;
}

export interface ResumeUploadResult extends ResumeExtractResult {
    readonly fileName: string;
}

interface Props {
    readonly onResult: (r: ResumeUploadResult) => void;
    readonly variant?: "primary" | "sidebar";
    readonly title?: string;
    readonly hint?: string;
    readonly emphasised?: boolean;
}

type Status = "idle" | "parsing" | "extracting" | "done" | "error";

export function ResumeUploadPanel({
    onResult,
    variant = "primary",
    title,
    hint,
    emphasised = false,
}: Props) {
    const [status, setStatus] = useState<Status>("idle");
    const [progress, setProgress] = useState(0);
    const [fileName, setFileName] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [, startTransition] = useTransition();

    const handleFile = useCallback(
        (file: File) => {
            setError(null);
            const kind = detectKind(file);
            if (!kind) {
                setStatus("error");
                setError("只支持 PDF 或 Word(.docx) 文件");
                return;
            }
            if (file.size > MAX_BYTES) {
                setStatus("error");
                setError("文件超过 10 MB，换个小一点的？");
                return;
            }
            setStatus("parsing");
            setProgress(5);
            setFileName(file.name);

            void (async () => {
                try {
                    let text: string;
                    if (kind === "pdf") {
                        text = await extractPdfText(file, (pct) => {
                            setProgress((prev) => Math.max(prev, pct * 0.8));
                        });
                    } else {
                        setProgress(40);
                        text = await extractDocxText(file);
                    }
                    setProgress(85);
                    setStatus("extracting");
                    startTransition(async () => {
                        try {
                            const r = await extractResumeForChatAction(text);
                            setProgress(100);
                            if (!r.ok) {
                                setStatus("error");
                                setError(r.error ?? "解析失败");
                                return;
                            }
                            setStatus("done");
                            onResult({ ...r, fileName: file.name });
                        } catch (cause) {
                            // eslint-disable-next-line no-console
                            console.error(
                                "[resume-upload] extraction failed",
                                cause,
                            );
                            setStatus("error");
                            setError("提取失败，再试一次？");
                        }
                    });
                } catch (cause) {
                    const msg =
                        cause instanceof Error ? cause.message : "解析失败";
                    setStatus("error");
                    setError(msg);
                }
            })();
        },
        [onResult],
    );

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = "";
    };

    const compact = variant === "sidebar";
    const resolvedTitle = title ?? "上传简历";
    const resolvedHint =
        hint ?? "PDF / Word · 自动读出你的学历和分数";

    return (
        <div
            onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col gap-3 transition-colors ${compact ? "p-4" : "p-6"
                }`}
            style={{
                background: emphasised
                    ? "var(--gradient-raised)"
                    : "var(--color-surface)",
                borderRadius: "var(--radius-card-md)",
                boxShadow: emphasised
                    ? "var(--shadow-clay-card)"
                    : "var(--shadow-clay-raised)",
                border: dragOver
                    ? "2px dashed var(--color-primary-from)"
                    : "2px dashed transparent",
            }}
        >
            <div className="space-y-1">
                <p className="text-text text-sm font-semibold">
                    {resolvedTitle}
                </p>
                <p className="text-text-muted text-xs leading-relaxed">
                    {resolvedHint}
                </p>
            </div>

            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={status === "parsing" || status === "extracting"}
                className="text-text-on-primary px-3 py-2 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50"
                style={{
                    background: "var(--gradient-primary)",
                    borderRadius: "var(--radius-button)",
                    boxShadow: "var(--shadow-clay-primary)",
                    color: "var(--color-text-on-primary)",
                }}
            >
                {status === "parsing"
                    ? "读取中…"
                    : status === "extracting"
                        ? "整理中…"
                        : status === "done"
                            ? "再传一份"
                            : "选择文件 / 拖到这里"}
            </button>
            <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={onPick}
            />

            {status === "parsing" || status === "extracting" ? (
                <div
                    className="h-1.5 w-full overflow-hidden"
                    style={{
                        background: "var(--color-surface-alt)",
                        borderRadius: 999,
                    }}
                    aria-hidden
                >
                    <div
                        className="h-full transition-all"
                        style={{
                            width: `${progress}%`,
                            background: "var(--gradient-primary)",
                        }}
                    />
                </div>
            ) : null}

            {status === "done" && fileName ? (
                <p
                    className="text-xs"
                    style={{ color: "var(--color-primary-from)" }}
                >
                    已读取「{fileName}」
                </p>
            ) : null}

            {status === "error" && error ? (
                <p
                    className="text-xs"
                    style={{ color: "var(--color-danger)" }}
                >
                    {error}
                </p>
            ) : null}
        </div>
    );
}
