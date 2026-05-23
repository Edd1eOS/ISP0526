/**
 * Token preview / smoke test for Warm Claymorphism.
 * This page exists to visually verify design tokens during sprint 0.
 * It will be replaced by the real landing page in a later PR.
 */

export default function Home() {
  return (
    <main className="bg-bg min-h-screen w-full px-6 py-16 sm:px-12">
      <div className="mx-auto max-w-3xl space-y-12">
        <header className="space-y-3">
          <span className="text-text-muted text-sm uppercase tracking-widest">
            ISP0526 · sprint 0
          </span>
          <h1 className="text-text text-4xl font-bold leading-tight sm:text-5xl">
            一站式留学启动器
          </h1>
          <p className="text-text-muted max-w-xl text-lg leading-relaxed">
            Warm claymorphism token preview. All visuals here are driven by CSS
            variables — no hardcoded colors or shadows.
          </p>
        </header>

        {/* Card surface */}
        <section
          className="bg-surface space-y-4 p-8"
          style={{
            borderRadius: "var(--radius-card-lg)",
            boxShadow: "var(--shadow-clay-card)",
          }}
        >
          <h2 className="text-text text-2xl font-semibold">卡片表面</h2>
          <p className="text-text-muted">
            柔和的奶米背景上，浅蜜桃卡片承载内容。圆角 40px，外部柔光投影模拟黏土质感。
          </p>

          {/* Buttons row */}
          <div className="flex flex-col gap-4 pt-4 sm:flex-row">
            <button
              type="button"
              className="text-text-on-primary px-6 py-3 text-base font-semibold transition-transform active:scale-95"
              style={{
                background: "var(--gradient-primary)",
                borderRadius: "var(--radius-button)",
                boxShadow: "var(--shadow-clay-primary)",
              }}
            >
              开始测评
            </button>

            <button
              type="button"
              className="text-text px-6 py-3 text-base font-semibold transition-transform active:scale-95"
              style={{
                background: "var(--gradient-raised)",
                borderRadius: "var(--radius-button)",
                boxShadow: "var(--shadow-clay-raised)",
              }}
            >
              了解更多
            </button>
          </div>
        </section>

        {/* Palette swatches */}
        <section className="space-y-4">
          <h2 className="text-text text-xl font-semibold">调色板</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {SWATCHES.map((s) => (
              <div
                key={s.token}
                className="flex flex-col items-center gap-2 p-3 text-center"
                style={{
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius-card-md)",
                  boxShadow: "var(--shadow-clay-raised)",
                }}
              >
                <span
                  className="h-12 w-12"
                  style={{
                    background: `var(${s.token})`,
                    borderRadius: "var(--radius-icon)",
                  }}
                  aria-hidden
                />
                <span className="text-text text-xs font-medium">{s.name}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

const SWATCHES: ReadonlyArray<{ token: string; name: string }> = [
  { token: "--color-bg", name: "bg" },
  { token: "--color-surface", name: "surface" },
  { token: "--color-primary-from", name: "primary" },
  { token: "--color-accent", name: "accent" },
  { token: "--color-warning", name: "warning" },
];

