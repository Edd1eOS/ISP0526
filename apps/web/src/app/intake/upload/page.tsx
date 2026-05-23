import { UploadDropzone } from "../../../features/intake-upload/upload-dropzone";

export default function IntakeUploadPage() {
    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-5xl space-y-10">
                <header className="space-y-2">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        传个文件
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        把你的过去丢进来，AI 替你拎重点
                    </h1>
                    <p className="text-text-muted max-w-2xl">
                        简历、成绩单、录取信都行（PDF，≤ 10 MB）。AI 读完会把关键信息整理好，下一步你只要核对、改两笔，就能直接生成报告。
                    </p>
                </header>
                <UploadDropzone />
            </div>
        </main>
    );
}
