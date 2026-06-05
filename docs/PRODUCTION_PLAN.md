# 生产执行计划（2026-06-05）

## 已完成 ✅

| 项 | 之前 | 现在 |
|----|------|------|
| 院校 | 11 | **70**（AU 35 / UK 20 / CA 15） |
| 项目 | 75 | **370** |
| data-pipeline | 无 | **`packages/data-pipeline`** |
| 评分基准 | 假 mock | 真实引擎 mean=**82.0**，85+ 占 **27.7%** |
| 测试 | 93 pass | **95 pass**（+pipeline 2） |

## 常用命令

```bash
# 校验 production JSON（Zod）
cd packages/data-pipeline && npx tsx src/cli.ts verify

# 完整性审计
cd packages/data-pipeline && npx tsx src/cli.ts audit

# 从 seed 生成 draft（不写 production）
cd packages/data-pipeline && npx tsx src/cli.ts generate expansion

# 对比 draft vs production
cd packages/data-pipeline && npx tsx src/cli.ts diff au

# 一键扩数据并写入 production（需 --write）
cd packages/data-pipeline && npx tsx src/cli.ts run expansion --write

# 评分分布回归
node test-300-statistical.js
```

## 下一批（冲 200 校 / 500 项目）

1. **US / NZ / HK / SG** 新建 shard：`universities.us.json` + `programs.us.json`，改 `core/src/data/index.ts` 加载
2. 在 `src/seeds/expansion.ts` 追加 seed 批次，重复 `run expansion --write`
3. 每批 promote 前人工 spot-check 5 条 `sources` + 学费 placeholder
4. 目标节奏：**每批 +30 校**，3–4 批到 200 校

## 禁止

- CI 自动 promote
- 未 `--write` 误写 production
- 用 LLM 编造假事实（学费/GPA 必须带 source + placeholder note）

## 文件位置

- Production: `packages/core/data/*.json`
- Drafts: `packages/data-pipeline/drafts/`
- Reports: `packages/data-pipeline/reports/`
- Seeds: `packages/data-pipeline/src/seeds/expansion.ts`
