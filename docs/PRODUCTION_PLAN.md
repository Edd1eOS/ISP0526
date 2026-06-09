# 生产执行计划

## 当前状态
- 数据集规模：94 所学校，485 条项目
- 现阶段重点：数据清洗和来源可追踪性，不再继续盲目加量
- Phase 1：已收尾

## Phase 1 已完成内容
- 修正匹配逻辑里对缺失 GPA 的处理
- 修正 `stepping_stone` 误标问题
- 建立审计指标，能持续追踪：
  - `genericSourcePrograms`
  - `masterWithSteppingStone`
  - 缺失 GPA / IELTS / 学费
- 清理掉 UK 里的普通硕士误标
- 清理掉 CA 里的普通硕士误标
- 保留缺失学费的留白，不做虚假补数

## 当前审计结果
- `genericSourcePrograms = 342`
- `masterWithSteppingStone = 0`
- `missingGpa = 6`
- `missingIelts = 17`
- `missingTuition = 374`

## 现存问题
- 过多项目仍使用学校首页或泛招生页作为来源
- 学费字段仍只支持 `AUD`，会限制真实数据录入
- 本科和衔接课程数量仍偏少，后续需要继续补

## 下一步
1. 先做来源精细化，优先处理 AU / UK / CA 的泛链接
2. 再补本科、foundation、pathway、diploma
3. 学费字段改造后，再批量补官方币种数据
4. 每批都跑 `verify`、`audit` 和测试

## 约束
- 不写虚假数据
- 搜不到就留白
- 不改无关模块
- 每条新增数据都要可追踪
