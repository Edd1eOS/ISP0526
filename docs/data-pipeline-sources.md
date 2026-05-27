# 数据来源手册（Sources Playbook）

> 与 `docs/data-pipeline.md` 配套。本文件登记每一个 SourceModule 的法务前置、URL 范围、抓取节流、字段映射、已知坑点。**新增来源必须先在此登记并通过 review，再写代码。**

---

## 0. 新来源登记模板

复制下方块到「§3 来源登记表」之前，PR 中填完整后才能开始实现：

```
### <source_id 前缀>

- 用途：university_list | program_detail | visa_route
- 国家：AU | UK | CA | ...
- 站点根：https://...
- robots.txt：是否允许抓取目标路径？粘贴最近一次校验结果
- 版权声明：站点是否声明数据可复用？粘贴关键段落
- 节流：req/s 上限，建议保留 ≥ 1s 间隔
- 字段映射：
  | 来源字段 | 落点（Schema 路径） | 转换 |
  |---|---|---|
- 置信度低的字段：列出哪些字段必须人工兜底
- 不抓取的字段：列出该来源含但不应进入数据库的字段（如教师邮箱）
- 已知坑：分页/重定向/编码/PDF 异常等
- 复核周期：建议 90 / 180 天
```

---

## 1. 通用抓取约束（所有 SourceModule 都必须遵守）

| 维度 | 规则 |
|---|---|
| User-Agent | `ISP0526-DataPipeline/0.x (+https://<contact-url>)`；不得伪造 |
| HTTP 方法 | 仅 `GET`，禁 `POST` / `PUT` |
| 频率 | 单 host ≥ 1 req / 1.0 s；burst ≤ 3 |
| 429 / 503 | 立即退避（指数 backoff，max 3 次），仍失败则中止该 source 本轮 run |
| robots.txt | 每次 run 前 fetch + 解析；disallow 的路径直接跳过 |
| Cache | 同一 URL 24h 内复用 fixture，CI 必须命中 fixture |
| Cookies | 不持久；不模拟 session |
| JS 渲染 | 禁止；如目标页需要 JS，弃用该来源或寻找官方 API |
| 重定向 | 跟随同 host 重定向 ≤ 3 跳；跨 host 重定向中止并记录 |
| 编码 | 强制按 HTTP `Content-Type` 解码；无声明时假定 UTF-8，失败则记录到 reports/ |
| 大小 | 单页 ≤ 5 MB；超出则记录 url 进 `oversized.json`，不解析 |

---

## 2. PII 与敏感数据红线

下列字段**永远不入库**，即便页面有：

- 任何在职员工的姓名、邮箱、电话、办公地址
- 学生证件号、学号、申请号
- 内部账号、admin 后台 URL
- 价格之外的支付凭据（账户号、SWIFT 等）

如来源页混入这些数据，parser 必须显式 strip；不可依赖 normalize 兜底。

---

## 3. 来源登记表（按 source_id 前缀字母序）

> 起步阶段为空，由下一个 agent 按下列建议优先级补齐。每补一个来源开一个独立 PR。

### 建议优先级（按落地难度从低到高）

1. **`studyaustralia_providers_2026`** — 澳洲教育部 study.gov.au 上的 CRICOS provider list（公开开放数据；机构 shell 字段全；无版权问题）。预计扩 ~30 所 AU 院校 shell。
2. **`ukcisa_fees_2026`** — UKCISA 公开学费指南，可批量补 UK program 学费基线。
3. **`canada_designated_2026`** — 加拿大 IRCC 公布的 DLI 名单（CSV 下载，零反爬）。补 CA 院校 shell。
4. **`unsw_handbook_2026` / `usyd_handbook_2026` / ...** — 单校 program 目录。每校一个 SourceModule，逐校扩 program。
5. **`govuk_studentvisa_2026`** — UK 学签官方页，更新 `visa-routes.json`。

每条登记后必须更新 `docs/data-pipeline.md` §3.1 的 `source_id` 命名示例如有变。

---

## 4. 常见映射模式

### 4.1 GPA 转换（落 `normalize/gpa.ts`）

| 来源刻度 | 转换到 0-4 |
|---|---|
| 百分制 0-100 | `clamp((x - 50) / 12.5, 0, 4)`（保守，50% = 0, 100% = 4） |
| WAM 0-100（澳洲） | 同上 |
| GPA 4.3（北美 A+） | `min(x, 4)` |
| GPA 5.0（高中风格） | `clamp(x * 0.8, 0, 4)` |
| First / 2:1 / 2:2（UK） | First=3.7、2:1=3.3、2:2=2.7、Third=2.3 |

转换函数必须返回 `{ value, confidence, note }`；confidence < 0.7 进 `_incomplete.json`。

### 4.2 学费转换（落 `normalize/tuition.ts`）

- 输入：来源原币种 + 数额 + 是否含 GST。
- 静态汇率表：`packages/data-pipeline/exchange-rates.json`，季度人工复核，记录 `as_of` 日期。
- 输出：`{ currency: "AUD", annual: <int>, note: "原 GBP 29500 @ 1 GBP = 1.92 AUD as of 2026-01-15" }`。
- 学期价：×2 + note。
- 范围价（如 30,000-35,000）：取下限 + note。

### 4.3 项目领域归一（落 `normalize/field.ts`）

来源里的项目领域字段是自由文本（"Master of Information Technology", "MSc Computer Science", "Information Systems"），归一到几十个标准大类，例如：

- `Computer Science`
- `Information Technology`
- `Data Science`
- `Software Engineering`
- `Business Analytics`
- ...

未匹配的领域进 `_incomplete.json` 待人工补类目。**严禁让 LLM 自由生成新类目**。

---

## 5. 与 AI 层的关系

参见 `.github/instructions/ai-layer.instructions.md`。本管线**不调用 LLM 产生事实字段**。允许的 AI 用法仅限：

- `name_zh` 的辅助译名建议（人工必须 review）。
- 来源页主题相关性预判（"这一页是不是 program 详情页"）。
- 文本去噪（去 nav / footer / 广告）。

任何 AI 输出在写入 draft 前必须经过 Zod 校验 + post-filter；不得直接落 production。

---

## 6. 终止与下线

某来源任何时刻发生下列情况之一，立即在 `docs/change_record.md` 标记 `pipeline-source-deprecated` 并停用：

- robots.txt 改为 disallow 目标路径
- 站点改版导致 parser 连续 2 轮 run 全部失败
- 法务声明变更（出现明确禁止抓取条款）
- 来源 ToS 中新增任何与 §1 / §2 冲突的条款

下线后已写入 production 的记录**保留**，但 `sources[].note` 追加 `source decommissioned <date>`，并在下一轮季度复核中寻找替代来源。
