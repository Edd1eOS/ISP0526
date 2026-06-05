# 推荐引擎优化结论（2026-06-05，已修正）

**结论：引擎无需改权重。问题在测试脚本用了 mock 随机数，报告全部作废。**

## 真实基准（11 校 / 75 项目 / 300 profile）

| 指标 | 假报告（已废） | 真实引擎 |
|------|----------------|----------|
| 平均分 | 44.82 | **~72** |
| 70+ 占比 | 2.3% | **~64%** |
| 数据量 | 声称 162 校 | 实际 **11 校 75 项目** |

## 立即执行（<1h）

1. ✅ `test-300-statistical.js` 改为调用真实 `recommend()`
2. ✅ `benchmark-scoring.test.ts` 写入 `test-300-statistical-report.json`
3. ⏭ 数据扩展：按 `docs/data-pipeline.md` 分批加校，每批跑 benchmark 防回归
4. ❌ **不要**改 `weights.ts`、不要加 `BASE_SCORE`——均值已在 60–70 目标区间

## 运行

```bash
node test-300-statistical.js
```

旧版 `STATISTICAL_ANALYSIS_REPORT.md` 基于错误 Shapiro-Wilk / 均匀分布卡方，忽略即可。
