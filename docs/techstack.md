# 技术栈（TechStack）

> 所有选型 + 版本锁。任何替换必须先开 ADR（`docs/adr/`）讨论。
> 版本一栏遵循 "锁主版本，跟次版本" 原则——main 与 minor 升级须 PR + CI 验证。

---

## 1. 应用层

| 类别 | 选型 | 版本 | 理由 |
|---|---|---|---|
| 框架 | Next.js (App Router, Turbopack) | ^16 | SSR + Edge + Vercel 一键部署；React 19 RSC 默认；Turbopack stable |
| UI 库 | React | ^19 | 配套 Next 16 |
| 语言 | TypeScript | ^5.9 | strict 模式 + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`；规则引擎类型安全 |
| 样式 | Tailwind CSS | ^4 | 暖色系定制；utility-first；token 通过 `@theme inline` 注入 CSS variables |
| 组件 | shadcn/ui | latest | Copy-in 而非 npm 安装；无运行时锁 |
| 动效 | Framer Motion | ^11 | 微交互；与 React 19 兼容 |
| 国际化 | next-intl | ^3 | 中英双语；App Router 原生支持 |
| 状态 | Zustand | ^5 | 全局轻量状态；persist 中间件 |
| 数据获取 | TanStack Query | ^5 | 缓存 + 乐观更新 |
| 表单 | React Hook Form + Zod | ^7 + ^3 | 类型 + 校验合一 |
| 客户端文档解析 | pdfjs-dist + mammoth | ^4 + ^1 | PDF 文本主线程抽取（避开 Turbopack worker 装配）；DOCX 走 mammoth browser bundle `extractRawText`，弃 styling 只保留纯文本喂给抽取 prompt |

---

## 2. 数据与后端

| 类别 | 选型 | 版本 | 理由 |
|---|---|---|---|
| 数据库 | Supabase Postgres | latest | 托管；RLS；Sydney 区 ap-southeast-2 |
| 鉴权 | Supabase Auth (Magic Link) | latest | 仅邮箱；避开微信资质 / ICP 备案 |
| 存储 | Supabase Storage | latest | PDF / 图片报告 |
| 安全 | Row-Level Security | n/a | 所有用户数据表强制 RLS |

---

## 3. AI 层

| 用途 | 模型 | 调用方式 | 备注 |
|---|---|---|---|
| 推荐文案生成（默认） | Gemini 2.0 Flash | Vercel AI SDK (`ai` ^6, `@ai-sdk/google` ^3) | 免费档（10 RPM / 1500 请求每日），单次批量返回所有推荐项 |
| 推荐文案生成（fallback） | 模板渲染（`packages/core/ai/templates/narrative-template.ts`） | 纯 TS | 当 `GOOGLE_GENERATIVE_AI_API_KEY` 未配置 / LLM 失败 / post-filter 拒收时启用，零外部依赖 |
| 表单字段抽取 | Gemini 2.0 Flash | Vercel AI SDK | 同上 |
| 语音转文字 | Whisper (OpenAI) | API | 待启用 |
| 文档 OCR | GPT-4o-mini Vision | API | 待启用 |

**适配层**：所有 LLM 调用走 `packages/core/ai/` 抽象层；`GenerateObjectFn` 由调用方（如 `apps/web/src/lib/ai/google-narrative.ts`）注入。核心包不直接依赖任何 LLM SDK，便于多 runtime 移植。

**输出契约**：每次调用 → Zod 校验 → `filterNarrative` 丢弃未引用合法 `source_id` 的字段 → 调用方接收 `Result<T, AIError>` 并按需回退到模板。

---

## 4. 基础设施

| 类别 | 选型 | 备注 |
|---|---|---|
| 托管 | Vercel Hobby | 0 成本；`xxx.vercel.app` 二级域名 |
| 包管理 | pnpm | ^11.2.2（**强约束**：pnpm 11 用 `node:sqlite`，要求 Node ≥ 22.13） |
| 仓库结构 | Monorepo | `apps/web` + `packages/core`，pnpm workspaces 单根 lockfile |
| Node 运行时 | Node | ^22.13 LTS（本地 24.11，CI 锁 22；root `package.json` `engines.node` 已声明） |
| 构建脚本审批 | `pnpm-workspace.yaml` `allowBuilds` | 显式允许 `sharp` / `unrs-resolver` 跑安装脚本，其余依赖默认拒跑 |

---

## 5. 可观测

| 类别 | 选型 | 备注 |
|---|---|---|
| 产品分析 | PostHog Cloud | 漏斗、留存、A/B |
| 错误追踪 | Sentry | 前后端通用 |
| 日志 | Vercel Logs + Supabase Logs | Phase 1 不接外部 SIEM |

---

## 6. 测试

| 类别 | 选型 | 覆盖范围 |
|---|---|---|
| 单元 / 集成 | Vitest | 规则引擎、AI 适配、工具函数 |
| 端到端 | Playwright | 关键用户流：测评 → 报告 → 分享 |
| 类型 | tsc --noEmit | CI 必过 |
| Lint | ESLint + Prettier | flat config |

---

## 7. 协作工具（MCP）

| 服务器 | 用途 |
|---|---|
| context7 | 实时拉取库 / 框架 / API 文档 |
| supabase | 数据库探索 / migration / 日志 / advisors |
| github | Issue / PR / 代码搜索 |
| tavily | 院校信息检索（数据采集阶段） |

---

## 8. 不采用清单（含理由）

| 候选 | 不采用理由 |
|---|---|
| Streamlit | 暖色系定制弱；不能演化到 React Native |
| Lovable / v0 | 生成代码不可控；后期维护成本高 |
| Prisma | Supabase 直连 + 类型生成已够用；少一层抽象 |
| Redux | Zustand 足够 Phase 1 规模 |
| MBTI 测评 | 商标受限；学界共识弱于 Big Five |
| 微信登录 | 资质 / ICP 备案门槛；Magic Link 已覆盖目标用户 |
