# 留学规划之必需详细档案 (Voyage Profile Spec)

本文件是航行步骤（detail refinement，第 4 步）必须填满的完整档案清单。LLM 在每一回合的提问、用户的回答、上传文件的总结、测评摘要，最终都要汇聚成下文这张表。表中每一项都必须显式覆盖**正向偏好**（最想要 / 最看重）+ **反向偏好**（最不能接受 / 最想避开）+ **细节确认**（核对上传或推断出来的值）三个维度之一或多个，缺一不可。

> 凡是档案里写下的事实都必须可以追溯到：上传文件的原文、测评的得分、或用户在航行中本人回答过的一句话。不允许 LLM 自行猜测。

---

## 前置维度 (Stage) —— 必须先于其他问题确认

`profile.stage` 是整张表的入口。它决定了后续哪些题目可问、哪些必须跳过。LLM 必须在前 1-2 回合内确认 `stage.current_education` 和 `stage.target_level`（除非上传/测评已经填好）。

| 子字段 | 取值 | 含义 |
|---|---|---|
| `current_education` | high_school_inprogress / high_school_grad / undergrad_inprogress / bachelor_holder / master_inprogress / master_holder / working_professional / other | 当前学业状态 |
| `target_level` | undergrad / master_coursework / master_research / phd / exchange / prep_pathway / unsure | 申请目标层级 |
| `target_intake` | this_semester / next_semester / this_year / next_year / later | 期望入学时间窗 |

### 题目作用域 (Question Scope) 规则

| 题目类型 | 必须先满足 | 不满足时的行为 |
|---|---|---|
| 大学 GPA / 平均分 | current_education ∈ { undergrad_inprogress, bachelor_holder, master_*, working_professional } | 跳过，patch.notes 记 "stage:no_university_gpa" |
| 工作年限 | current_education ∈ { bachelor_holder, master_*, working_professional } | 跳过，patch.notes 记 "stage:no_work_yet" |
| 科研经历 | current_education ∈ { undergrad_inprogress, bachelor_holder, master_*, working_professional } | 跳过 |
| 论文 vs 毕业项目 | target_level ∈ { master_*, phd } | 跳过 |
| 博士导师风格 | target_level ∈ { master_research, phd } | 跳过 |
| 高中分流 / 文理科 | current_education ∈ { high_school_* } | 仅在此场景问 |

---

## Affirmation 多样化规则

每回合开头 1 句 `affirmation` 必须呼应用户上一句的真实内容，不能机械地说 "好的，明白"。按用户输入类型分四种模式：

| 用户输入类型 | Affirmation 模式 | 示例 |
|---|---|---|
| 给出具体值 | 简短复述 | "收到，本科在读，目标是硕士。" |
| 质疑 / 不适用 | 承认 + 调整 | "理解，那大学 GPA 这题不适用，我跳过，先确认你的高中情况。" |
| 不知道 / 无所谓 | 接受中立 | "好的，那这条先记成无明显偏好。" |
| 长段说明 | 一句总结 | "听上去你最在意的是学费控制在 30 万以内，研究氛围次之。" |

禁止连续两回合用同一开头。禁止使用 "非常感谢" / "棒极了" 等过度热情套话。

---

## 字段类型：事实 (FACT) vs 偏好 (PREFERENCE)

档案里的字段分两类，提问方式严格不同：

- **FACT 字段**：用户的客观事实，只有一个真值。包括 `credentials.gpa`、`credentials.language`、`credentials.other_tests`、`credentials.work_years`、`credentials.research_experience`。
  - 如果上传文件里出现过该值 → 用 **CONFIRMATION** 框架："我看到成绩单上 GPA 是 3.5/4.0，对吗？"
  - 如果完全没有线索 → 用 **FACTUAL** 框架："你目前的 GPA 大约是多少？是哪个分制？"
  - **绝不允许**写成"最想要的 GPA 是多少"、"你希望自己的 IELTS 是多少"——GPA / 雅思是事实，不是愿望。
- **PREFERENCE 字段**：goals / field / geography / funding / signals / personality_check 下的所有子项。用 **POSITIVE**（最想要 / 最看重）或 **NEGATIVE**（最不能接受 / 最想避开）框架，每回合在两者间切换。

---

## 用户面文本不得出现枚举码

`patch` 里保留英文枚举（`employability` / `ranking` / `AU` / `post_grad` / `capstone_vs_thesis`…）；但 `question.prompt`、`affirmation`、`question.rationale`、`question.options[].label`、`done_reason` 等用户可见字段必须翻译成自然中文（或英文 locale 下的自然英文）。例如：

| 枚举码 | 中文用户面用语 |
|---|---|
| `employability` | 就业前景 |
| `ranking` | 学校排名 |
| `location` | 地理位置 |
| `research` | 科研机会 |
| `network` | 校友与人脉 |
| `culture` | 校园文化 |
| `cost` | 学费 / 总花费 |
| `safety` | 安全 |
| `climate` | 气候 |
| `language` | 语言 |
| `post_grad` | 毕业后去向 |
| `capstone_vs_thesis` | 毕业项目 vs 学术论文 |
| `scholarship_priority` | 奖学金重要程度 |
| `AU / UK / US / CA / NZ / IE / DE / NL / SG / HK / JP / FR` | 澳大利亚 / 英国 / 美国 / 加拿大 / 新西兰 / 爱尔兰 / 德国 / 荷兰 / 新加坡 / 香港 / 日本 / 法国 |

---

## 反假定原则

LLM 永远只能引用 `CURRENT_PROFILE` JSON 与 `HISTORY` 区段里已经存在的值。**如果某字段在 CURRENT_PROFILE 里是空的，必须 ASK，不允许 CONFIRM**。例如：

- 错误："我看到你在关键因素里列出了 location、employability、ranking，对吗？" ←—— 用户根本还没说过这些，是模型自己编的。
- 正确：先 ASK "在选项目时，你最看重的三个因素是什么？（如学校排名、就业前景、地理位置、科研机会、学费、安全等）"，等用户回答后再用 CONFIRMATION 复核。

---

## 命名与编号

| 维度 ID | 中文名 | 对应 `VoyageProfile` 字段 |
|---|---|---|
| A | 留学目标与时间窗 | `goals.*` |
| B | 学习方向 | `field.*` |
| C | 地理与生活 | `geography.*` |
| D | 资金 | `funding.*` |
| E | 个人材料 | `credentials.*` |
| F | 决策信号 | `signals.*` |
| G | 性格佐证 | `personality_check.*` |

档案里每一个维度都按"正向 / 反向 / 确认"三栏对齐——下文每张表都按这个结构展开。

---

## A 留学目标与时间窗 (goals)

| 子项 | 正向 (positive) | 反向 (negative) | 确认 (confirmation) |
|---|---|---|---|
| `motivations` | 主动选定的最重要 2-3 个动机（career / research / passion / immigration / family / horizon） | 明确剔除的动机（"我并不是为了移民"） | 核对上传简历里写的求职目标是否与所选 motivations 一致 |
| `post_grad` | 毕业后首选（return_home / stay_local / third_country / undecided） | 不可接受的去向（"绝不回国"或"绝不留在当地"） | 若简历或文书提过特定国家工作意向，须确认 |
| `phd_intent` | 读博意愿等级 | 明确不考虑读博的人需置 `no` 而非空着 | 若上传过研究经历、论文，必须问一句"是否考虑读博" |
| `employability_vs_passion` | -2..2 标尺：-2 完全为了就业；+2 完全凭兴趣 | 反面：用户拒绝把就业作为决策权重应记 -2 一侧；拒绝把兴趣作为权重记 +2 一侧 | 与测评 Big Five "Openness" 对照确认（高 O 倾向兴趣端） |
| `urgency` | this_year / next_year / exploring | 反向不可接受："等不到明年" / "明年绝不入学" | 核对申请季时间（如果上传里有时间线） |

**A 维必填阈值**：5 个子项中至少 4 个有值；其中 `urgency` 与 `post_grad` 是硬性必填。

---

## B 学习方向 (field)

| 子项 | 正向 | 反向 | 确认 |
|---|---|---|---|
| `primary` | 一个清晰的目标专业字符串（例如 "Data Science"） | — | 若简历背景与目标差距大，必须确认（"你本科是机械，确定要转 CS 吗？"） |
| `secondary` | 可接受的备选方向 1-5 个 | — | — |
| `avoid` | — | 明确不想读的方向（"不要纯理论数学"） | — |
| `capstone_vs_thesis` | thesis / capstone / either / unsure | 反向："不接受写大论文"应映射为 `capstone` | — |
| `pace` | intensive / balanced / extended / flexible | — | 与 `urgency` 交叉确认（urgency=this_year + pace=extended 需复核） |
| `teaching_likes` | 最喜欢的授课方式（lecture / seminar / project / internship / research / case_study / lab） | — | — |
| `teaching_dislikes` | — | 最讨厌的授课方式（同枚举） | 与测评 Big Five "Extraversion / Openness" 交叉，例如低 E + dislike seminar 一致 |
| `assessment_likes` | exam / coursework / presentation / group_project / dissertation | — | — |
| `assessment_dislikes` | — | 同枚举的反向 | 与测评学习偏好量表对照 |
| `class_size` | small / medium / large / no_preference | — | — |
| `supervisor` | hands_on / hands_off / balanced / no_preference | — | — |
| `peer_competitiveness` | -2..2，+2 偏好高度竞争同侪 | — | 与测评 Conscientiousness 对照 |

**B 维必填阈值**：`primary` 必填；`teaching_likes` ∪ `teaching_dislikes` 总元素 ≥ 3；`assessment_likes` ∪ `assessment_dislikes` 总元素 ≥ 2。

---

## C 地理与生活 (geography)

| 子项 | 正向 | 反向 | 确认 |
|---|---|---|---|
| `target_countries` | ≥ 1 个国家，每个含 `direction ∈ {love, like, neutral}` + 简短理由 | 在 `direction ∈ {dislike, hate}` 的国家也同样放在 target_countries（直接体现"考虑过但不想去"），或放进 `excluded_countries` | 若上传里出现国家名（例如英国 PR、亲属在美国），必须确认是加分还是减分 |
| `excluded_countries` | — | 主动排除的国家（必填 reason） | — |
| `city_size` | metro / large / mid / town / no_preference | 反向："绝不去小镇" 等同选择 metro/large 三者之一并显式标 `dislike` 项 | — |
| `climate_likes` | warm_dry / warm_humid / temperate / cold | — | — |
| `climate_dislikes` | — | 同枚举的反向 | — |
| `distance_from_home` | close / moderate / far / no_preference | — | — |
| `safety_priority` | 0..4，数字越大越看重安全 | — | — |
| `food_pref` | asian_easy / diverse / any | — | — |
| `transit_pref` | public_transit / walkable / car_friendly / any | — | — |
| `accommodation_pref` | on_campus / homestay / private_rental / shared / any | — | — |
| `social_scene` | -2..2，+2 偏好夜生活/社交活跃；-2 偏好安静 | — | 与测评 Extraversion 对照 |

**C 维必填阈值**：`target_countries` 至少 1 条带 direction；`climate_likes` 或 `climate_dislikes` 至少 1 条；`city_size` 必填；`safety_priority` 必填。

---

## D 资金 (funding)

| 子项 | 正向 | 反向 | 确认 |
|---|---|---|---|
| `annual_budget_aud` | 年度可承受预算（澳元） | — | 若上传里出现工资单 / 资助协议，需确认 |
| `flexibility` | strict / stretchable_10 / stretchable_25 / flexible | — | — |
| `sources` | family / self_savings / loan / scholarship / employer / other（可多选） | 没有的来源不要勾 | — |
| `scholarship_priority` | 0..2，2 = 必须有奖学金 | — | — |
| `work_intent` | must_work / want_work / indifferent / no_work | 反向：用户说"读书期间不打工"应直接选 `no_work` | — |
| `price_vs_rank` | -2..2，-2 完全看价格、+2 完全看排名 | — | — |

**D 维必填阈值**：`annual_budget_aud` 必填（或用户明确拒答时记 `notes`）；`scholarship_priority`、`work_intent` 必填。

---

## E 个人材料 (credentials)

| 子项 | 正向 | 反向 | 确认（最重要） |
|---|---|---|---|
| `gpa` | value + scale + self_confidence | — | **强制确认**：若上传成绩单提到 GPA，必须发问一次"我看到成绩单是 X，对吗？" |
| `language` | kind + overall + 四项 + taken_at + retake_plan + target_overall | — | **强制确认**：上传里有语言成绩则必须复核 |
| `other_tests` | gre / gmat / sat / act 状态 | 没考的就 status=`none` | 若简历或文书提及，须确认 |
| `work_years` | 工作年限 | — | 与简历推断对照确认 |
| `research_experience` | none / course / internship / publication | — | 若简历列出论文或科研助理，须确认级别 |

**E 维必填阈值**：`gpa` 必有 value（或显式 unsure）；`language.kind` 必填；`work_years` 与 `research_experience` 必填（可填 0 / none）。

---

## F 决策信号 (signals)

| 子项 | 正向 | 反向 | 确认 |
|---|---|---|---|
| `must_haves` | 1-5 条短句，描述硬性需求（"项目里必须有实习"） | — | — |
| `avoid_list` | — | 1-5 条短句，描述 dealbreaker（"绝对不要 12 个月以内速成"） | — |
| `liked_institutions` | 1-8 个心仪院校 | — | 若上传文书里提过名校，必须复核 |
| `disliked_institutions` | — | 1-8 个排除院校 | — |
| `decisive_factors` | 3 个最关键因子（ranking / cost / employability / research / location / network / culture / safety / climate / language） | — | — |

**F 维必填阈值**：`must_haves` ≥ 1；`avoid_list` ≥ 1；`decisive_factors` 必须正好 3 个。

---

## G 性格佐证 (personality_check)

仅在测评摘要缺失时才向用户确认；如果已经做了测评，从 `assessment_summary` 中映射即可，不要重复问。

| 子项 | 正向 | 反向 | 确认 |
|---|---|---|---|
| `classroom_style` | -2..2，+2 主动发言/讨论；-2 安静听讲 | — | 测评低 Extraversion → 偏 -2 |
| `risk_tolerance` | -2..2，+2 敢冲名校接受拒信 | — | 测评高 Openness + 低 Neuroticism → 偏 +2 |
| `structure_pref` | -2..2，+2 严格结构、明确 deliverable | — | 测评高 Conscientiousness → 偏 +2 |

---

## 完成度计算 (completeness)

`completeness` 是 0..1 的浮点数，按下面的加权求和给出，>= **0.9** 才允许 `done=true`（除非用户明确表示要结束）。

| 维度 | 权重 |
|---|---|
| A goals | 0.15 |
| B field | 0.20 |
| C geography | 0.15 |
| D funding | 0.15 |
| E credentials | 0.15 |
| F signals | 0.15 |
| G personality_check | 0.05（已做测评时直接给满） |

每个维度内部按"必填阈值"是否满足为 1 / 否则为 0，再乘以权重相加。

---

## 终止条件 (done)

LLM 只能在以下任一情况设置 `done=true`：

1. `completeness >= 0.9` 且 A/B/C/D/E/F 六个维度的必填阈值都已满足；
2. 用户在最近一回合明确表达"我想看结果 / 不想再答了"（必须在 `done_reason` 里引用原话片段）；
3. 用户连续 2 回合给出"我不知道"且模型确认所有"我不知道"已经记为 `notes` 或 `unsure`。

> **不再以回合数为停止条件**。`maxTurns` 不再使用。只看是否所有细节都已经匹配清楚（正向、反向、确认三栏都覆盖到该有的最小集）。

---

## 提问优先级 (model heuristic)

每回合按下列顺序找第一个"必填但未填"的子项作为本回合的问题来源：

1. E 维"确认"栏（上传文件里给出的事实必须先核对）。
2. A.urgency, A.post_grad。
3. D.annual_budget_aud, D.flexibility。
4. B.primary, B.avoid。
5. F.decisive_factors（必填 3 个）。
6. C.target_countries（含 direction）+ C.excluded_countries。
7. B.teaching_likes / teaching_dislikes（必须正反成对）。
8. E.language（如缺失或低置信度）。
9. F.must_haves + F.avoid_list（必须正反成对）。
10. C.city_size + C.climate + C.safety_priority。
11. D.scholarship_priority + D.work_intent。
12. B.capstone_vs_thesis + B.supervisor + B.peer_competitiveness。
13. E.research_experience + E.other_tests。
14. G.* （仅测评摘要缺失时）。
15. F.liked_institutions / disliked_institutions（可选润色）。

每次提问必须显式标明本回合是在补**正向**、**反向**还是**确认**，并通过 `landmark` 视觉化（lighthouse=确认，reef=反向，island/continent=正向）。

---

## 与上游 / 下游的连接

- 上游（输入）：
  - `VoyageProfile`（累积档案）
  - `VoyageHistoryTurn[]`（已问过的 Q/A）
  - `VoyageUploadContext[]`（上传文件总结）
  - `VoyageAssessmentSummary?`（测评得分）
- 下游（输出）：
  - 每回合的 `VoyageTurn`：`affirmation` + `patch`（合入累积档案）+ `question?` + `done` + `completeness` + `done_reason?`
  - 最终通过 `projectVoyageToClarifyPatch` 转成 `ClarifyPatch`，喂给现有 `finalizeChatIntakeAction` 推荐链路。

---

## 校验清单 (LLM self-check before emitting JSON)

LLM 每回合在生成 JSON 之前，必须在脑内回答以下问题（不输出，仅校验）：

1. 我这回合要问的子项，在本文表里是否处于"必填但未填"状态？
2. 我这回合的提问是补**正向 / 反向 / 确认**中的哪一栏？是否与上一回合的栏不同？
3. 我有没有把上传文件里的事实静默写入了 `patch`，而没有先发起确认？
4. 我给的 `completeness` 是否按上文加权法算出来的？是否大于等于 0.9 才置 `done=true`？
5. 我的问题语言、`affirmation`、`done_reason` 是否都符合 locale？
6. 我的 `patch` 是否只包含本回合从用户回答 / 上传文件 / 测评里能稳妥推断出来的字段？

任何一条没过都必须重新组织本回合输出。
