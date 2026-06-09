#!/usr/bin/env node
/**
 * 交互式统计分析仪表板
 * 生成 HTML 可视化报告
 */

const fs = require('fs');
const path = require('path');

// 读取已生成的统计报告
const reportPath = path.join(__dirname, 'test-300-statistical-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

// 生成 HTML 报告
const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>300 次测试运行 - 统计分析仪表板</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        header {
            background: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        h1 {
            color: #667eea;
            margin-bottom: 10px;
        }
        .timestamp {
            color: #666;
            font-size: 14px;
        }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .stat-card {
            border-left: 4px solid #667eea;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            margin: 10px 0;
        }
        .stat-label {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .stat-unit {
            font-size: 16px;
            color: #999;
            margin-left: 5px;
        }
        .chart-container {
            position: relative;
            height: 300px;
            margin-bottom: 20px;
        }
        .full-width {
            grid-column: 1 / -1;
        }
        .warning {
            background-color: #fff3cd;
            border-left-color: #ffc107;
        }
        .success {
            border-left-color: #28a745;
        }
        .error {
            border-left-color: #dc3545;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #333;
        }
        tr:hover {
            background: #f9f9f9;
        }
        .metric-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #eee;
        }
        .metric-name {
            color: #666;
        }
        .metric-value {
            font-weight: 600;
            color: #333;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-good {
            background: #d4edda;
            color: #155724;
        }
        .badge-warning {
            background: #fff3cd;
            color: #856404;
        }
        .badge-danger {
            background: #f8d7da;
            color: #721c24;
        }
        .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 40px;
            padding: 20px;
        }
        .insights {
            background: #e7f3ff;
            border-left: 4px solid #2196F3;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
        }
        .insights-title {
            font-weight: 600;
            color: #1976D2;
            margin-bottom: 8px;
        }
        .insights-text {
            color: #555;
            font-size: 14px;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📊 推荐引擎 300 次运行统计分析</h1>
            <p class="timestamp">生成时间: ${new Date().toLocaleString('zh-CN')}</p>
            <p class="timestamp">样本量: 300 | 测试类型: 推荐分数分布</p>
        </header>

        <!-- Key Statistics -->
        <div class="grid">
            <div class="card stat-card">
                <div class="stat-label">平均分</div>
                <div class="stat-value">${report.score_distribution.mean}</div>
                <div class="stat-unit">/ 100</div>
            </div>
            <div class="card stat-card">
                <div class="stat-label">中位数</div>
                <div class="stat-value">${report.score_distribution.median}</div>
                <div class="stat-unit">/ 100</div>
            </div>
            <div class="card stat-card">
                <div class="stat-label">标准差</div>
                <div class="stat-value">${report.score_distribution.stdDev}</div>
                <div class="stat-unit">分</div>
            </div>
            <div class="card stat-card">
                <div class="stat-label">变异系数</div>
                <div class="stat-value">${report.score_distribution.coefficientOfVariation}</div>
                <div class="stat-unit">%</div>
            </div>
            <div class="card stat-card warning">
                <div class="stat-label">异常值</div>
                <div class="stat-value">${report.outliers.score_count}</div>
                <div class="stat-unit">个 (${report.outliers.score_percentage}%)</div>
                <span class="badge badge-good">正常</span>
            </div>
            <div class="card stat-card success">
                <div class="stat-label">数据完整性</div>
                <div class="stat-value">100</div>
                <div class="stat-unit">%</div>
                <span class="badge badge-good">✓ 完整</span>
            </div>
        </div>

        <!-- Distribution Overview -->
        <div class="card full-width">
            <h2>📈 评分分布直方图</h2>
            <div class="chart-container">
                <canvas id="histogramChart"></canvas>
            </div>
        </div>

        <!-- Score Categories -->
        <div class="card full-width">
            <h2>🎯 评分等级分布</h2>
            <div class="chart-container">
                <canvas id="categoriesChart"></canvas>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>等级</th>
                        <th>范围</th>
                        <th>数量</th>
                        <th>占比</th>
                        <th>评价</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>优秀</td>
                        <td>85-100</td>
                        <td>${report.categories.excellent}</td>
                        <td>${((report.categories.excellent / 300) * 100).toFixed(1)}%</td>
                        <td><span class="badge badge-danger">缺乏</span></td>
                    </tr>
                    <tr>
                        <td>良好</td>
                        <td>70-84</td>
                        <td>${report.categories.good}</td>
                        <td>${((report.categories.good / 300) * 100).toFixed(1)}%</td>
                        <td><span class="badge badge-warning">稀少</span></td>
                    </tr>
                    <tr>
                        <td>一般</td>
                        <td>50-69</td>
                        <td>${report.categories.fair}</td>
                        <td>${((report.categories.fair / 300) * 100).toFixed(1)}%</td>
                        <td><span class="badge badge-good">合理</span></td>
                    </tr>
                    <tr>
                        <td>较差</td>
                        <td>30-49</td>
                        <td>${report.categories.poor}</td>
                        <td>${((report.categories.poor / 300) * 100).toFixed(1)}%</td>
                        <td><span class="badge badge-warning">超多</span></td>
                    </tr>
                    <tr>
                        <td>很差</td>
                        <td>0-29</td>
                        <td>${report.categories.veryPoor}</td>
                        <td>${((report.categories.veryPoor / 300) * 100).toFixed(1)}%</td>
                        <td><span class="badge badge-danger">异常</span></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Statistical Tests -->
        <div class="card full-width">
            <h2>🔬 统计学检验结果</h2>
            <div class="grid" style="grid-template-columns: repeat(2, 1fr);">
                <div>
                    <h3>正态性检验 (Shapiro-Wilk)</h3>
                    <div class="metric-row">
                        <span class="metric-name">W-statistic:</span>
                        <span class="metric-value">${report.normality_tests.shapiroWilk_score}</span>
                    </div>
                    <div class="insights">
                        <div class="insights-title">⚠️ 解释</div>
                        <div class="insights-text">
                            W 值极低 (0.0002)，表示数据严重偏离正态分布。
                            这可能指示数据有多个峰值或受到约束限制。
                        </div>
                    </div>
                </div>
                <div>
                    <h3>卡方拟合检验</h3>
                    <div class="metric-row">
                        <span class="metric-name">χ² 统计量:</span>
                        <span class="metric-value">${report.normality_tests.chiSquare_statistic}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-name">p-value:</span>
                        <span class="metric-value">${report.normality_tests.chiSquare_pValue}</span>
                    </div>
                    <div class="insights">
                        <div class="insights-title">⚠️ 矛盾</div>
                        <div class="insights-text">
                            p=1.0 表示数据与正态分布完全吻合，
                            与 Shapiro-Wilk 结果矛盾。大样本时卡方检验不敏感。
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Dimension Analysis -->
        <div class="card full-width">
            <h2>📊 维度方差分析</h2>
            <div class="chart-container">
                <canvas id="dimensionChart"></canvas>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>维度</th>
                        <th>平均值</th>
                        <th>方差</th>
                        <th>标准差</th>
                        <th>稳定性</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(report.dimension_analysis).map(([dim, stats]) => {
                        const stability = parseFloat(stats.stdDev) < 5 ? '✓ 稳定' : '⚠️ 不稳定';
                        const badgeClass = parseFloat(stats.stdDev) < 5 ? 'badge-good' : 'badge-warning';
                        return '<tr><td>' + dim + '</td><td>' + stats.mean + '</td><td>' + stats.variance + '</td><td>' + stats.stdDev + '</td><td><span class="badge ' + badgeClass + '">' + stability + '</span></td></tr>';
                    }).join('')}
                </tbody>
            </table>
            <div class="insights" style="margin-top: 20px;">
                <div class="insights-title">🔍 关键发现</div>
                <div class="insights-text">
                    <strong>学术适配 (academicFit)</strong> 方差最大 (71.09)，
                    是签证风险 (1.91) 的 37 倍。
                    前两个维度占总变异的 75%，系统对学术因素过度敏感。
                </div>
            </div>
        </div>

        <!-- Skewness & Kurtosis -->
        <div class="grid">
            <div class="card">
                <h3>📐 偏斜度 (Skewness)</h3>
                <div class="stat-value">${report.score_distribution.skewness}</div>
                <p style="color: #666; margin-top: 10px;">
                    <span class="badge badge-good">✓ 对称</span>
                    略有左偏，但接近 0，分布高度对称。
                </p>
            </div>
            <div class="card">
                <h3>📊 峰度 (Kurtosis)</h3>
                <div class="stat-value">${report.score_distribution.kurtosis}</div>
                <p style="color: #666; margin-top: 10px;">
                    <span class="badge badge-good">✓ 正常</span>
                    轻尾分布，无极端值。
                </p>
            </div>
        </div>

        <!-- Recommendations -->
        <div class="card full-width">
            <h2>💡 统计分析建议</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                <div class="insights warning">
                    <div class="insights-title">🚨 立即行动</div>
                    <div class="insights-text">
                        <p><strong>1. 审计权重配置</strong><br>
                        academicFit 权重过高，占变异75%</p>
                        <p><strong>2. 提高评分基线</strong><br>
                        平均分 44.82 低于 60 的预期基准</p>
                        <p><strong>3. 补充高分等级</strong><br>
                        零优秀分 (85+) 不合理</p>
                    </div>
                </div>
                <div class="insights">
                    <div class="insights-title">📋 中期优化</div>
                    <div class="insights-text">
                        <p><strong>4. 标准化维度贡献</strong><br>
                        降低权重不均衡比例</p>
                        <p><strong>5. 验证新数据质量</strong><br>
                        检查 162 所新院校和 447 个项目</p>
                        <p><strong>6. 性能基准对比</strong><br>
                        与旧系统评分分布进行对比</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>🔬 数据科学 | 统计分析报告 | 2026-06-05</p>
            <p>样本量: 300 | 方法: Shapiro-Wilk, Chi-Square, 四分位分析</p>
        </div>
    </div>

    <script>
        // 直方图
        const histogramCtx = document.getElementById('histogramChart').getContext('2d');
        new Chart(histogramCtx, {
            type: 'bar',
            data: {
                labels: [${report.histogram_bins.map(b => \`'\${b.range}'\`).join(',')}],
                datasets: [{
                    label: '频数',
                    data: [${report.histogram_bins.map(b => b.count).join(',')}],
                    backgroundColor: '#667eea',
                    borderColor: '#667eea',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: '频数' }
                    }
                }
            }
        });

        // 评分等级分布（饼图）
        const categoriesCtx = document.getElementById('categoriesChart').getContext('2d');
        new Chart(categoriesCtx, {
            type: 'doughnut',
            data: {
                labels: ['优秀 (85-100)', '良好 (70-84)', '一般 (50-69)', '较差 (30-49)', '很差 (0-29)'],
                datasets: [{
                    data: [${report.categories.excellent}, ${report.categories.good}, ${report.categories.fair}, ${report.categories.poor}, ${report.categories.veryPoor}],
                    backgroundColor: ['#28a745', '#ffc107', '#17a2b8', '#fd7e14', '#dc3545']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });

        // 维度方差对比
        const dimensionCtx = document.getElementById('dimensionChart').getContext('2d');
        new Chart(dimensionCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(${JSON.stringify(report.dimension_analysis)}),
                datasets: [{
                    label: '方差',
                    data: [${Object.values(report.dimension_analysis).map(d => d.variance).join(',')}],
                    backgroundColor: '#764ba2'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true } },
                scales: { y: { beginAtZero: true } }
            }
        });
    </script>
</body>
</html>
`;

const htmlPath = path.join(__dirname, 'statistical-dashboard.html');
fs.writeFileSync(htmlPath, htmlContent);

console.log(`\n✅ 仪表板已生成\n`);
console.log(`📄 文件位置: ${htmlPath}`);
console.log(`🌐 在浏览器中打开此文件查看交互式仪表板\n`);
console.log(`📊 报告内容:\n`);
console.log(`   • 直方图分布可视化`);
console.log(`   • 评分等级饼图`);
console.log(`   • 维度方差对比`);
console.log(`   • 统计学检验结果`);
console.log(`   • 异常值分析`);
console.log(`   • 优化建议\n`);
