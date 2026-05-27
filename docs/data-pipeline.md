# 数据管线规范（Data Pipeline）

> 本文件定义院校 / 项目 / 签证数据的采集、清洗、校验、入库流程。所有写入 `packages/core/data/*.json` 的修改必须经过此管线（或与之等价的人工流程）。任何偏离需在 PR 描述中说明理由并补 ADR。
>
> 上游契约：`packages/core/src/schemas/`。
> 下游消费者：`packages/core/src/data/index.ts` 在模块初始化时 Zod 校验全部数据。

---

## 1. 目标与非目标

### 1.1 目标

- 把 Phase 1 数据集从当前 **11 所院校 / 75 个项目** 扩到 spec FR-3.1 / FR-3.2 的 **≥ 200 所院校 / ≥ 500 项目**。
- 让"加一个院校 / 项目"这件事**可复算、可追溯、可审计**：每条记录都能回放到一个 fetch + parse + normalize 的过程。
- 把"是否引入这条数据"的决策 **与运行时解耦**：production JSON 永远是人工 reviewed 的快照，draft 仅供管线产出。

### 1.2 非目标

- **不**自动写入 production JSON。所有 production 写入必须由人 commit。
- **不**做实时爬取。production 不发外网请求；管线只在 CI / 本地手动跑。
- **不**抓取需要登录 / 模拟交互 / 绕反爬的页面；不抓取受版权保护的排行榜原始数据（只取自身公开摘要页或政府开放数据）。
- **不**收集任何能识别个人的数据。

---

## 2. 仓库布局

```
packages/data-pipeline/                # 新 workspace（见 ADR 0005）
├── package.json
├── tsconfig.json
├── src/
│   ├── sources/                       # 每来源一文件
│   │   ├── _types.ts                  # SourceModule 接口
│   │   ├── studyaustralia.ts
│   │   ├── unsw-program-catalog.ts
│   │   ├── ukcisa-fees.ts
│   │   └── ...
│   ├── fetchers/
│   │   ├── http.ts                    # undici + rate-limit + cache
│   │   └── pdf.ts                     # PDF -> text，可选
│   ├── parsers/                       # HTML -> RawRecord
│   ├── normalize/
│   │   ├── gpa.ts                     # WAM / 百分制 -> 0-4
│   │   ├── tuition.ts                 # 任意币种 -> AUD（静态汇率表）
│   │   ├── field.ts                   # 自由字符串 -> ProgramSchema.field 大类
│   │   └── tags.ts                    # 推断 ProgramTag
│   ├── validate.ts                    # 复用 core 的 UniversitySchema / ProgramSchema
│   ├── diff.ts                        # 与 data/*.json 比对生成 patch
│   ├── promote.ts                     # 把单条 draft 搬进 production JSON
│   ├── pipeline.ts                    # source -> fetch -> parse -> normalize -> validate -> draft
│   └── cli.ts                         # node 入口
├── drafts/                            # 管线输出，受 git 跟踪但不被 core 引用
│   ├── universities.au.draft.json
│   ├── programs.au.draft.json
│   └── _incomplete.json               # 校验未过的留底
├── reports/                           # 每次 run 的统计 / 缺口
│   └── YYYY-MM-DD-<source>.md
├── fixtures/                          # 抓取页 HTML 快照
│   └── <source>/<hash>.html
└── exchange-rates.json                # 静态 fx 表，季度复核
```

### 2.1 与 `packages/core` 的关系

- `data-pipeline` **import** `@isp0526/core` 的 Zod schemas（`UniversitySchema` / `ProgramSchema` / `VisaRouteMapSchema` / `SourceCitationSchema`）。
- `core/src/data/index.ts` **不** import `data-pipeline`。
- `drafts/` 目录不会被 `core/src/data/index.ts` 加载，因此即便存在脏数据也无法污染 production。

---

## 3. 数据契约（必须遵循的 schema）

所有字段定义在 `packages/core/src/schemas/institution.ts` 与 `source.ts`。下表只列管线层的硬约束：

| 字段 | 规则 |
|---|---|
| `id` | 全局唯一；`<inst>-<slug>` 形式；小写、连字符；不得复用历史 id |
| `name_en` / `name_zh` | 双语必填；name_zh 必须是常用译名（不得机翻） |
| `country` | `CountrySchema` 七国之一；不在范围内的来源直接丢弃 |
| `tuition.currency` | 当前 schema 强制 `AUD`；非 AUD 货币由 `normalize/tuition.ts` 转换 |
| `tuition.annual` | 取 **国际生 sticker price**，单位年。带学期价的来源需 ×2 并写明 note |
| `gpa_min` | 0-4 制；百分制 / WAM / GPA5 由 `normalize/gpa.ts` 转换；置信度低于阈值的留 `_incomplete.json` |
| `reputation_score` / `chinese_community_density` / `safety_index` | 0-1 归一化；归一基线在 `normalize/` 内显式定义并写注释 |
| `tags` | 仅可用 `ProgramTagSchema` 八个枚举值；机器推断的 tag 必须在 PR 中可解释 |
| `sources` | 至少 1 条；每条必含 `source_id` + `kind`(url/rule/dataset_row) + `last_verified_date` |
| `source_id` | 形如 `<inst>_<topic>_<yyyy>`，全小写、下划线分隔；本仓库内唯一 |

### 3.1 source_id 命名约定

- `unsw_mit_2026`：UNSW Master of IT 2026 年度信息页
- `studyaustralia_visa500_2026`：澳洲教育官网签证页
- `qs_au_topcs_2026`：QS 澳洲 CS 排名摘要页

如需新前缀，先在 PR 描述中声明并更新本节。

---

## 4. 流水线 7 步

```
SourceModule.fetch()
   ↓ raw HTML/JSON/PDF
parse()
   ↓ RawRecord (unknown 字段保留)
normalize()
   ↓ candidate matching ProgramSchema / UniversitySchema shape
validate()  ← Zod
   ↓ pass        ↓ fail
diff()         _incomplete.json
   ↓
drafts/*.draft.json   (机器写)
   ↓ 人工 review
promote()  (人执行)
   ↓
packages/core/data/*.json   (production)
```

### 4.1 各步硬约束

| 步骤 | 硬约束 |
|---|---|
| fetch | 限频 ≥ 1 req / s / host；UA 标识 `ISP0526-DataPipeline/0.x (+contact-url)`；遵守 `robots.txt`；GET only；同一 URL 24h 内复用 fixture |
| parse | 失败必须抛带 URL + selector 的错误；不得 silent skip |
| normalize | 任一字段降级（如币种换算、GPA 转换）必须写 `note`；置信度 < 0.7 的记录进 `_incomplete.json` |
| validate | 直接 `UniversitySchema.parse` / `ProgramSchema.parse`；失败进 `_incomplete.json`，不进 draft |
| diff | 输出 `+add` / `~change` / `=same` / `?conflict`（同 id 字段冲突）四类 |
| promote | 必须人工执行 `pnpm pipeline promote <id>`；不得在 CI 上自动跑；promote 同时把对应 source 加入 PR diff |

### 4.2 SourceModule 接口（pseudo）

```ts
// packages/data-pipeline/src/sources/_types.ts
export interface SourceModule {
  id: string;                                   // 与 source_id 前缀一致
  country: Country;
  kind: "university_list" | "program_detail" | "visa_route";
  robotsAllowed: () => Promise<boolean>;        // 跑前自检
  fetch: (ctx: FetchCtx) => AsyncIterable<RawPage>;
  parse: (page: RawPage) => Iterable<RawRecord>;
  normalize: (record: RawRecord) => NormalizedDraft;
  // 不在接口里做 validate / diff / promote —— 那是管线的事
}
```

---

## 5. 法务与伦理边界

参见 `docs/prohibition.md`，本节做具体落地：

1. **只抓公开页面**：招生官网公开招生信息、政府开放数据（如 study.gov.au 的 CRICOS 列表）、机构自己的公开排名摘要页。
2. **robots.txt 必读必遵**。每次 fetch 前由 fetcher 缓存并校验。被 disallow 的路径直接跳过，不重试。
3. **不模拟浏览器**：禁用 puppeteer / playwright headless 抓取。如果某来源必须 JS 渲染才能拿到数据，**改用该机构的开放 API 或弃用这个来源**。
4. **不绕反爬**：遇 429 / 403 立刻退避并记录；不轮换 IP / 不伪造 referer / 不模拟登录。
5. **不抓排行榜原始数据**：QS / THE 等的完整榜单受版权保护。只取其针对单校的公开摘要页，且只用作 `reputation_score` 的输入参考之一。
6. **零 PII**：来源页中任何包含个人信息的内容（招生官姓名、邮箱、电话）一律丢弃；只保留机构 / 项目层事实。
7. **第三方数据可重放**：所有 fetch 出的页面必须落到 `fixtures/<source>/<hash>.html`；CI 离线跑解析测试时只读 fixture，不发外网。

---

## 6. CLI 与 npm scripts

新 workspace `packages/data-pipeline` 暴露的命令（在 ADR 0005 落地后实现）：

| 命令 | 作用 | 写盘？ |
|---|---|---|
| `pnpm pipeline list-sources` | 列出已注册的 SourceModule | 否 |
| `pnpm pipeline run <source>` | 跑单个来源到 drafts/ | drafts/ + fixtures/ |
| `pnpm pipeline run --all` | 跑全部来源 | drafts/ + fixtures/ |
| `pnpm pipeline diff <country>` | 对比 drafts/ vs data/ | reports/ |
| `pnpm pipeline promote <id>` | 把一条 draft 搬进 production JSON（人工） | packages/core/data/ |
| `pnpm pipeline verify` | 全量重跑 normalize + validate（不联网） | reports/ |
| `pnpm pipeline stale --days 90` | 列 `last_verified_date` 超 90 天的记录 | 否 |

所有命令默认 dry-run；写盘命令必须显式 `--write`。

---

## 7. 复核与新鲜度

- spec FR-3.5：季度全量复核。
- `last_verified_date` 由 promote 步骤自动写入当日。
- `pnpm pipeline stale --days 90` 应在每次 release 前在 PR 中跑一次，过期记录纳入下一轮 promote 计划。
- 任一 production 记录在 PR review 中**修改了事实字段**（学费 / GPA 门槛 / 语言门槛 / deadlines），必须同步更新 `last_verified_date` 并附 source 截图或归档链接。

---

## 8. 与 spec.md 的对应关系

| spec FR | 本文件落实位置 |
|---|---|
| FR-3.1 院校规模 ≥ 200 | §1.1 目标；§6 `run --all` |
| FR-3.2 项目颗粒度 | §3 数据契约；schema 是单一事实源 |
| FR-3.3 标签体系 | §3 + `normalize/tags.ts`；tag 推断必须可解释 |
| FR-3.4 仅公开数据 + 人工 curate | §1.2 非目标；§4.1 promote 必人工；§5 法务边界 |
| FR-3.5 更新机制 + 季度复核 | §7 复核与新鲜度 |

---

## 9. 接力交接清单（给下一个 agent）

按以下顺序推进，每完成一步在 `docs/change_record.md` 追加一行：

1. 落 ADR 0005（已在 `docs/adr/0005-data-pipeline-package.md` 起草），合并后再开始。
2. 在 `pnpm-workspace.yaml` 加 `packages/data-pipeline`，建 `package.json` + `tsconfig.json`。
3. 实现 `validate.ts` + `diff.ts` + `cli.ts` 骨架（**不联网**，仅消费 drafts/ / data/ 的本地文件）。配单测覆盖 diff 三态。
4. 选 **第一个 source**：建议 `studyaustralia-providers`（政府公开 CRICOS 列表）。先只抓 university shell，不动 program。
5. 跑一次 `pipeline run studyaustralia-providers --write`，产出 `drafts/universities.au.draft.json`，把 11 所扩到 30+ 的院校 shell。
6. 人工 review → `promote` 5 所进 production，验证 `core/src/data/index.ts` 的 Zod 校验能 build 通过。
7. 再加 program 维度的 source（如 `unsw-program-catalog`），重复 4-6。
8. 每加 2 个新来源开一个 PR，对应 `docs/change_record.md` 一行。

**绝对禁止**：
- 自动 commit production JSON。
- 在 CI 跑 promote。
- 引入 headless 浏览器依赖。
- 写入任何字段时调用 LLM 生成事实（LLM 仅可用于 name_zh 的辅助译名建议，且必须人工确认）。
