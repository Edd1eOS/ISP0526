import { UploadDropzone } from "../../../features/intake-upload/upload-dropzone";

export default function IntakeUploadPage() {
    return (
        <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
            <div className="mx-auto max-w-5xl space-y-10">
                <header className="space-y-2">
                    <span className="text-text-muted text-sm uppercase tracking-widest">
                        上传文件
                    </span>
                    <h1 className="text-text text-3xl font-bold leading-tight sm:text-4xl">
                        把材料丢给我，AI 帮你抽字段
                    </h1>
                    <p className="text-text-muted max-w-2xl">
                        支持 PDF（≤ 10 MB）。先客户端解析文本，下一步会送入
                        Gemini 抽取关键信息，然后跳到审阅页让你确认。
                    </p>
                </header>
                <UploadDropzone />
            </div>
        </main>
    );
}
