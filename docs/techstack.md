# 技术栈（TechStack）

> 所有选型 + 版本锁。任何替换必须先开 ADR（`docs/adr/`）讨论。
> 版本一栏遵循 "锁主版本，跟次版本" 原则——main 与 minor 升级须 PR + CI 验证。

---

## 1. 应用层

| 类别 | 选型 | 版本 | 理由 |
|---|---|---|---|
| 框架 | Next.js (App Router) | ^15 | SSR + Edge + Vercel 一键部署；React 19 RSC 默认 |
| UI 库 | React | ^19 | 配套 Next 15 |
| 语言 | TypeScript | ^5.5 | strict 模式；规则引擎类型安全 |
| 样式 | Tailwind CSS | ^4 | 暖色系定制；utility-first；CSS variables |
| 组件 | shadcn/ui | latest | Copy-in 而非 npm 安装；无运行时锁 |
| 动效 | Framer Motion | ^11 | 微交互；与 React 19 兼容 |
| 国际化 | next-intl | ^3 | 中英双语；App Router 原生支持 |
| 状态 | Zustand | ^5 | 全局轻量状态；persist 中间件 |
| 数据获取 | TanStack Query | ^5 | 缓存 + 乐观更新 |
| 表单 | React Hook Form + Zod | ^7 + ^3 | 类型 + 校验合一 |

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
| 表单字段抽取 | Gemini 2.5 Flash | Vercel AI SDK | 低延迟 + 低成本 |
| 推荐文案生成 | Claude Sonnet 4 / GPT-4o-mini | Vercel AI SDK | 二选一，A/B 评估 |
| 语音转文字 | Whisper (OpenAI) | API | 用户口述输入 |
| 文档 OCR | GPT-4o-mini Vision | API | 成绩单 / 雅思图片 |

**适配层**：所有 LLM 调用走 `packages/core/ai/` 抽象层；切模型仅改配置不改业务代码。

---

## 4. 基础设施

| 类别 | 选型 | 备注 |
|---|---|---|
| 托管 | Vercel Hobby | 0 成本；`xxx.vercel.app` 二级域名 |
| 包管理 | pnpm | ^9（已装 11.2.2） |
| 仓库结构 | Monorepo | `apps/web` + `packages/core` |
| Node 运行时 | Node | ^20 LTS（本地 24.11，CI 锁 20） |

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
