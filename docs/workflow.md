# 开发工作流（Workflow）

> 本文件定义代码 / 文档 / 发布的标准流程。任何不在此处描述的操作均视为非常规操作，需在 PR 描述中说明理由。

---

## 1. 分支模型（GitHub Flow 简化版）

| 分支 | 用途 | 保护规则 |
|---|---|---|
| `main` | 生产分支，永远可部署 | 禁止直推；必须 PR + CI 通过 + 1 审 |
| `feat/*` | 功能开发 | 短生命周期，合并后删除 |
| `fix/*` | Bug 修复 | 同上 |
| `chore/*` | 杂项（依赖、CI、文档） | 同上 |
| `docs/*` | 纯文档变更 | 同上 |
| `spike/*` | 探索性实验 | 不合并 main，验证后转 feat 或废弃 |

**命名**：`<type>/<scope>-<short-desc>`，全小写、连字符分隔。例：`feat/rules-engine-scoring`、`fix/i18n-zh-fallback`。

---

## 2. 提交规范（Conventional Commits）

格式：`<type>(<scope>): <subject>`

| type | 含义 |
|---|---|
| feat | 新功能 |
| fix | Bug 修复 |
| docs | 文档 |
| chore | 工具 / 配置 / 依赖 |
| refactor | 重构（无行为变化） |
| test | 测试 |
| perf | 性能优化 |
| ci | CI / 部署 |
| revert | 回滚 |

**规则**：
- subject 用英文小写、动词原形开头、不加句点，例：`feat(rules): add gpa tolerance threshold`
- 破坏性变更：在 type 后加 `!` 或 footer 写 `BREAKING CHANGE: <desc>`
- 关联 issue：footer `Refs #12` 或 `Closes #12`

---

## 3. PR 流程

1. 从最新 `main` 拉分支
2. 推送前本地必须通过：`pnpm lint && pnpm typecheck && pnpm test`
3. 开 PR → 模板自动加载 → 填写：变更摘要、关联 spec 章节、测试证据、风险评估
4. CI 必须全绿
5. 至少 1 人 Review；自审 PR 也必须用 GitHub Suggestion 形式留痕
6. **必须更新** `docs/change_record.md`（除纯空白 / 格式 PR）
7. **Squash merge** 到 main，删除源分支

---

## 4. 发布流程（Phase 1 暂用滚动发布）

- 合并到 `main` → Vercel 自动部署到生产
- 每次 main 合并打 tag：`v0.<minor>.<patch>`（语义化版本）
- Release Notes 由 `change_record.md` 章节复制生成

Phase 2 引入 App Store 后再切到 release branch + signed build 流程，单独文档。

---

## 5. 文档变更流程

| 文档 | 更改方式 |
|---|---|
| `docs/spec.md` | 须开 PR + 标签 `spec-change` + ADR（若涉及架构） |
| `docs/workflow.md` / `prohibition.md` / `techstack.md` | 须开 PR + 团队共识 |
| `docs/change_record.md` | 每个非空 PR 必须追加条目 |
| `docs/adr/*.md` | 新决策追加 ADR 文件，已废弃 ADR 改状态而非删除 |

---

## 6. 数据 / 迁移流程

- 所有 schema 变更通过 Supabase migration 文件（`supabase/migrations/<timestamp>_<name>.sql`）
- 通过 Supabase MCP `apply_migration` 应用到开发环境（移除 `--read-only` 后）
- main 合并后由 CI 应用到生产
- 禁止在控制台手改 schema

---

## 7. 工作回滚

- 代码：`git revert <sha>` 开 PR 合并；紧急情况由仓库管理员强制 reset（须事后写事故报告）
- 部署：Vercel Dashboard → Deployments → 选历史成功版本 → Promote
- 数据：Supabase Point-in-Time Recovery（付费功能，Phase 1 暂用每日导出备份）
