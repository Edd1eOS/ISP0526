#!/usr/bin/env node
/**
 * 运行测试 300 次并进行统计学分析
 * 收集指标：执行时间、通过/失败、异常情况
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 核心测试列表（规则引擎 + AI 适配器）
const CORE_TESTS = [
  'packages/core/src/rules/recommend.test.ts',
  'packages/core/src/rules/dimensions/academic-fit.test.ts',
  'packages/core/src/rules/dimensions/budget.test.ts',
];

const RUNS = 300;
const results = {
  totalRuns: RUNS,
  runs: [],
  passed: 0,
  failed: 0,
  errors: [],
  executionTimes: [],
};

console.log(`\n🧪 Starting 300-run test suite for ${CORE_TESTS.length} core tests...\n`);
console.log(`Total iterations: ${RUNS}\n`);

let currentRun = 0;

for (let i = 0; i < RUNS; i++) {
  currentRun = i + 1;
  const startTime = Date.now();
  let success = false;
  let errorMsg = null;

  try {
    // Run the test with minimal output
    const cmd = `cd d:\\ISP0526 && npx vitest run ${CORE_TESTS.join(' ')} --reporter=silent 2>&1`;
    const output = execSync(cmd, { encoding: 'utf-8' });
    
    // Check for failures in output
    if (output.includes('FAIL') || output.includes('fail') || output.includes('error')) {
      success = false;
      errorMsg = output.substring(0, 200);
    } else {
      success = true;
    }
  } catch (error) {
    success = false;
    errorMsg = error.message.substring(0, 200);
  }

  const duration = Date.now() - startTime;
  results.executionTimes.push(duration);
  
  if (success) {
    results.passed++;
  } else {
    results.failed++;
    if (errorMsg) results.errors.push({ run: currentRun, error: errorMsg });
  }

  results.runs.push({
    run: currentRun,
    success,
    duration,
    timestamp: new Date().toISOString(),
  });

  // Progress indicator
  if (currentRun % 50 === 0) {
    const passRate = ((results.passed / currentRun) * 100).toFixed(1);
    console.log(`✓ ${currentRun}/${RUNS} completed | Pass rate: ${passRate}%`);
  }
}

// Statistical analysis
const times = results.executionTimes;
const mean = times.reduce((a, b) => a + b, 0) / times.length;
const variance = times.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / times.length;
const stdDev = Math.sqrt(variance);
const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];
const min = Math.min(...times);
const max = Math.max(...times);
const q1 = times[Math.floor(times.length * 0.25)];
const q3 = times[Math.floor(times.length * 0.75)];
const iqr = q3 - q1;

// Z-test: Check if pass rate is significantly different from expected (assume 95% expected)
const expectedPassRate = 0.95;
const actualPassRate = results.passed / RUNS;
const passRateStdErr = Math.sqrt((expectedPassRate * (1 - expectedPassRate)) / RUNS);
const zScore = (actualPassRate - expectedPassRate) / passRateStdErr;
const pValue = 2 * (1 - normalCDF(Math.abs(zScore))); // Two-tailed

// Outlier detection (1.5 * IQR rule)
const outliers = times.filter(t => t < q1 - 1.5 * iqr || t > q3 + 1.5 * iqr);

console.log(`\n${'='.repeat(70)}`);
console.log(`📊 STATISTICAL ANALYSIS - 300 TEST RUNS`);
console.log(`${'='.repeat(70)}\n`);

console.log(`✅ SUCCESS METRICS:`);
console.log(`   Total runs: ${RUNS}`);
console.log(`   Passed: ${results.passed} (${((results.passed / RUNS) * 100).toFixed(2)}%)`);
console.log(`   Failed: ${results.failed} (${((results.failed / RUNS) * 100).toFixed(2)}%)`);
console.log(`\n⏱️  EXECUTION TIME ANALYSIS:`);
console.log(`   Mean: ${mean.toFixed(2)}ms`);
console.log(`   Median: ${median.toFixed(2)}ms`);
console.log(`   Std Dev: ${stdDev.toFixed(2)}ms`);
console.log(`   Min: ${min.toFixed(2)}ms`);
console.log(`   Max: ${max.toFixed(2)}ms`);
console.log(`   Q1 (25%): ${q1.toFixed(2)}ms`);
console.log(`   Q3 (75%): ${q3.toFixed(2)}ms`);
console.log(`   IQR: ${iqr.toFixed(2)}ms`);
console.log(`\n📈 DISTRIBUTION TESTS:`);
console.log(`   Outliers (1.5*IQR): ${outliers.length} (${((outliers.length / RUNS) * 100).toFixed(2)}%)`);
console.log(`   Coefficient of Variation: ${((stdDev / mean) * 100).toFixed(2)}%`);

console.log(`\n🔬 Z-TEST (Pass Rate vs Expected 95%):`);
console.log(`   Observed: ${(actualPassRate * 100).toFixed(2)}%`);
console.log(`   Expected: ${(expectedPassRate * 100).toFixed(2)}%`);
console.log(`   Z-score: ${zScore.toFixed(4)}`);
console.log(`   P-value: ${pValue.toFixed(4)}`);
console.log(`   Result: ${pValue < 0.05 ? '⚠️  SIGNIFICANT DEVIATION' : '✅ No significant deviation'}`);

console.log(`\n📋 ERROR SUMMARY:`);
if (results.errors.length > 0) {
  results.errors.slice(0, 5).forEach(err => {
    console.log(`   Run ${err.run}: ${err.error.substring(0, 60)}...`);
  });
  if (results.errors.length > 5) {
    console.log(`   ... and ${results.errors.length - 5} more errors`);
  }
} else {
  console.log(`   No errors recorded`);
}

console.log(`\n${'='.repeat(70)}\n`);

// Normality test (Shapiro-Wilk approximation for large n)
const W = calculateShapiroWilk(times.sort((a, b) => a - b));
console.log(`Shapiro-Wilk W-statistic: ${W.toFixed(4)}`);
console.log(`Distribution: ${W > 0.95 ? '✅ Likely normal' : '⚠️  May not be normal'}\n`);

// Save results to JSON
const reportPath = path.join(__dirname, 'test-300-run-report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  metadata: {
    tests: CORE_TESTS,
    timestamp: new Date().toISOString(),
    runs: RUNS,
  },
  summary: {
    passed: results.passed,
    failed: results.failed,
    passRate: (results.passed / RUNS * 100).toFixed(2) + '%',
  },
  executionTime: {
    mean: mean.toFixed(2),
    median: median.toFixed(2),
    stdDev: stdDev.toFixed(2),
    min: min.toFixed(2),
    max: max.toFixed(2),
  },
  distribution: {
    q1: q1.toFixed(2),
    q3: q3.toFixed(2),
    iqr: iqr.toFixed(2),
    outliers: outliers.length,
    coefficientOfVariation: ((stdDev / mean) * 100).toFixed(2) + '%',
  },
  statistics: {
    zTest: {
      zScore: zScore.toFixed(4),
      pValue: pValue.toFixed(4),
      significant: pValue < 0.05,
    },
    shapiroWilk: W.toFixed(4),
  },
}, null, 2));

console.log(`📄 Full report saved to: ${reportPath}\n`);

// Helper: Normal CDF approximation
function normalCDF(z) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.sqrt(2);

  const t = 1 / (1 + p * z);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-z * z);

  return 0.5 * (1 + sign * y);
}

// Simplified Shapiro-Wilk test
function calculateShapiroWilk(data) {
  const n = data.length;
  const mean = data.reduce((a, b) => a + b) / n;
  
  // Coefficients for n=300 (approximation)
  let numerator = 0;
  const halfN = Math.floor(n / 2);
  
  for (let i = 0; i < halfN; i++) {
    const coeff = (i + 1) / (n - i);
    numerator += coeff * (data[n - i - 1] - data[i]);
  }
  
  const denominator = data.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0);
  return Math.pow(numerator, 2) / denominator;
}
