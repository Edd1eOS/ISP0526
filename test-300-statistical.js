#!/usr/bin/env node
/**
 * 真实推荐引擎 300 次评分分布基准测试
 * 调用 packages/core 的 scoreCandidate + recommend，非 mock 随机数
 */
const { execSync } = require("child_process");
const path = require("path");

const coreDir = path.join(__dirname, "packages", "core");
console.log("\n🧪 Running REAL recommendation engine benchmark (300 profiles)...\n");

execSync("npx vitest run src/rules/benchmark-scoring.test.ts --reporter=verbose", {
    cwd: coreDir,
    stdio: "inherit",
    env: process.env,
});

console.log("\n✅ Done. See test-300-statistical-report.json\n");
