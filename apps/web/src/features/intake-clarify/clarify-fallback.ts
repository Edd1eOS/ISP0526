// Deterministic clarify fallback. Drives the chat when the LLM is
// unavailable. Each assistant question carries a hidden marker
// "[[ask:KEY:N]]" where N is the attempt number for that field. On the
// next turn we:
//   1. parse the user's reply for that field;
//   2. if parsed -> apply patch and pick the next missing field;
//   3. if not parsed AND user expressed skip-intent -> advance;
//   4. if not parsed AND N >= 2 -> advance (give up, user can edit form);
//   5. if not parsed AND N == 1 -> re-ask with a shorter clarifier.
// This is intentionally a tiny rule engine, not a model.

import type {
    ClarifyPatch,
    FormFieldKey,
} from "./clarify-schema";

export interface FallbackTurnInput {
    readonly messages: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
    readonly missingKeys: ReadonlyArray<FormFieldKey>;
}

export interface FallbackTurnResult {
    readonly reply: string;
    readonly patch?: ClarifyPatch;
    readonly done: boolean;
}

const MARKER_RE = /\[\[ask:(\w+)(?::(\d+))?\]\]/;
const STRIP_RE = /\[\[ask:\w+(?::\d+)?\]\]/g;

function appendMarker(text: string, key: FormFieldKey, attempt: number): string {
    return `${text}\n\n[[ask:${key}:${attempt}]]`;
}

function stripMarker(text: string): string {
    return text.replace(STRIP_RE, "").trim();
}

function lastAsked(
    messages: ReadonlyArray<{ role: string; content: string }>,
): { key: FormFieldKey; attempt: number } | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role !== "assistant") continue;
        const hit = MARKER_RE.exec(m.content);
        if (hit)
            return {
                key: hit[1] as FormFieldKey,
                attempt: hit[2] ? parseInt(hit[2], 10) : 1,
            };
        return undefined;
    }
    return undefined;
}

function lastUser(
    messages: ReadonlyArray<{ role: string; content: string }>,
): string {
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") return messages[i].content;
    }
    return "";
}

// Skip / give-up signals from the student.
function isSkip(text: string): boolean {
    const t = text.toLowerCase();
    return /不知道|没想好|没.*想法|不太清楚|不清楚|说不准|随便|都行|跳过|skip|下一个|下一题|算了|不想.*答|够了|够.*了|干嘛.*问|干吗.*问|没意见|无所谓|whatever|没有/i.test(
        t,
    );
}

// Strip the skip phrases out of a reply so the leftover (if any) can be
// echoed back as context. Returns a trimmed leftover, or "" if nothing
// substantive remains.
function extractExtraContext(text: string): string {
    const skipPhrases = /不知道|没想好|没.*想法|不太清楚|不清楚|说不准|随便|都行|跳过|skip|下一个|下一题|算了|不想.*答|够了|够.*了|没意见|无所谓|whatever|都没有|没有/gi;
    const stripped = text
        .replace(skipPhrases, " ")
        .replace(/[，。,.!！?？；;:\s]+/g, " ")
        .trim();
    if (stripped.length < 2 || stripped.length > 40) return "";
    return stripped;
}

// --- per-field interpreters ---------------------------------------------

function parseTargetField(text: string): string | undefined {
    const t = text.toLowerCase();
    if (/土木|civil/.test(text)) return "Civil Engineering";
    if (/电气|电子|electrical/.test(text)) return "Electrical Engineering";
    if (/机械|mechanical/.test(text)) return "Mechanical Engineering";
    if (/工程|engineering/.test(text)) return "Civil Engineering";
    if (/数据|data/.test(text)) return "Data Science";
    if (/it|信息技术|资讯/.test(t)) return "Information Technology";
    if (/计算机|cs|computing|comp\s*sci/.test(t)) return "Computing";
    if (/金融|finance/.test(text)) return "Finance";
    if (/mba|工商管理/.test(t)) return "Business Administration";
    if (/商科|商学|business|commerce|商/.test(t)) return "Business";
    if (/设计|design/.test(text)) return "Design";
    if (/tesol|英语教学|英语老师/.test(t)) return "TESOL";
    return undefined;
}

// Parse a number, including Chinese magnitude suffixes 万/亿 and the
// shorthand "k" (60k -> 60000).
function parseNumber(text: string): number | undefined {
    const yi = /(\d+(?:\.\d+)?)\s*亿/.exec(text);
    if (yi) return Math.round(parseFloat(yi[1]) * 1e8);
    const wan = /(\d+(?:\.\d+)?)\s*万/.exec(text);
    if (wan) return Math.round(parseFloat(wan[1]) * 10000);
    const k = /(\d+(?:\.\d+)?)\s*k\b/i.exec(text);
    if (k) return Math.round(parseFloat(k[1]) * 1000);
    const plain = /(\d+(?:\.\d+)?)/.exec(text);
    if (plain) return parseFloat(plain[1]);
    return undefined;
}

// AUD-per-unit rates. Roughly current-ish; we're parsing student
// guesstimates not bank settlements.
const CURRENCY_AUD_RATE: Array<{ test: RegExp; rate: number }> = [
    { test: /aud|澳币|澳元|澳币|澳/i, rate: 1 },
    { test: /人民币|rmb|cny|￥|元(?!\s*aud)/i, rate: 1 / 4.7 },
    { test: /usd|美元|美刀|\$/i, rate: 1.5 },
    { test: /hkd|港币|港元/i, rate: 1 / 5.1 },
    { test: /eur|欧元|欧/i, rate: 1.65 },
    { test: /gbp|英镑/i, rate: 2.0 },
    { test: /jpy|日元|日币/i, rate: 1 / 100 },
    { test: /sgd|新币|新加坡币/i, rate: 1.15 },
    { test: /cad|加币/i, rate: 1.1 },
];

// Currencies we deliberately don't translate (joke or extreme inflation).
const CURRENCY_REJECT_RE = /津巴布韦|委内瑞拉|玻利瓦尔|zwl|vef/i;

function parseBudget(text: string): number | undefined {
    if (CURRENCY_REJECT_RE.test(text)) return undefined;
    const n = parseNumber(text);
    if (n === undefined) return undefined;
    let rate = 1 / 4.7; // default: RMB on a Chinese-first platform
    for (const c of CURRENCY_AUD_RATE) {
        if (c.test.test(text)) {
            rate = c.rate;
            break;
        }
    }
    const aud = Math.round(n * rate);
    if (aud < 5000 || aud > 500000) return undefined;
    return aud;
}

function parseGpa(text: string): number | undefined {
    const n = parseNumber(text);
    if (n === undefined) return undefined;
    if (n > 4 && n <= 5) return Math.round((n / 5) * 4 * 100) / 100;
    if (n > 5 && n <= 100) return Math.round((n / 100) * 4 * 100) / 100;
    if (n >= 0 && n <= 4) return n;
    return undefined;
}

function parseIelts(text: string): number | undefined {
    const n = parseNumber(text);
    if (n === undefined || n < 0 || n > 9) return undefined;
    return n;
}

function parseTeachingStyle(
    text: string,
): "theory_heavy" | "balanced" | "applied_heavy" | undefined {
    if (/^1\b|理论|学术|research/i.test(text)) return "theory_heavy";
    if (/^2\b|平衡|都行|balanced/i.test(text)) return "balanced";
    if (/^3\b|实践|应用|动手|applied|practical/i.test(text)) return "applied_heavy";
    return undefined;
}

function parseCitySize(
    text: string,
): "mega" | "large" | "medium" | "small" | undefined {
    if (/^1\b|超大|悉尼|sydney|墨尔本|melbourne|大都市/i.test(text)) return "mega";
    if (/^2\b|大城市|brisbane|布里斯班|perth|珀斯/i.test(text)) return "large";
    if (/^3\b|中等|adelaide|阿德莱德/i.test(text)) return "medium";
    if (/^4\b|小城|乡村|town|small/i.test(text)) return "small";
    return undefined;
}

function parseTags(text: string): string[] | undefined {
    const tags = new Set<string>();
    if (/学科|顶尖|top|排名|强|world.class/i.test(text)) tags.add("field_top");
    if (/移民|留下|prr?|pr\b|permanent/i.test(text)) tags.add("migration_friendly");
    if (/就业|工作|实习|career|job/i.test(text)) tags.add("career_pipeline");
    if (/性价比|便宜|cheap|value|划算/i.test(text)) tags.add("value_for_money");
    if (/奖学金|scholarship/i.test(text)) tags.add("scholarship_rich");
    if (/华人|中国人|chinese.community/i.test(text)) tags.add("chinese_community");
    const nums = text.match(/[1-6]/g) ?? [];
    const numTags = [
        "field_top",
        "migration_friendly",
        "career_pipeline",
        "value_for_money",
        "scholarship_rich",
        "chinese_community",
    ];
    for (const d of nums) tags.add(numTags[parseInt(d, 10) - 1]);
    return tags.size > 0 ? Array.from(tags) : undefined;
}

function parseTargetLevel(
    text: string,
): "bachelor" | "master" | "phd" | undefined {
    if (/本科|学士|undergrad|bachelor/i.test(text)) return "bachelor";
    if (/硕士|master|研究生/i.test(text)) return "master";
    if (/博士|phd|doctor/i.test(text)) return "phd";
    return undefined;
}

// --- question bank -------------------------------------------------------

const QUESTIONS: Record<FormFieldKey, string> = {
    target_field:
        "先确认下专业方向：IT、数据、计算机、商科、金融、工程、设计、TESOL，最近的是哪个？",
    annual_budget_aud:
        "预算一年留多少？给个数字就行，例如「6 万 AUD」或「20 万人民币」我帮你换算。",
    preferred_tags:
        "你最看重哪两三点？可以直接说，也可以报数字（多选）：1 学科顶尖 / 2 利于移民 / 3 就业渠道 / 4 性价比 / 5 奖学金 / 6 华人社区。",
    gpa: "GPA 大概多少？4 分制说就行（百分制也可以，我来换）。",
    ielts_overall: "雅思总分考了吗？没考也可以直接说没考。",
    teaching_style:
        "你喜欢哪种上课风格？1 偏理论 / 2 平衡 / 3 偏实践。",
    city_size:
        "想去多大的城市？1 超大（悉尼/墨尔本）/ 2 大城市（布里斯班/珀斯）/ 3 中等（阿德莱德）/ 4 小城市。",
    target_level: "目标学位：本科 / 硕士 / 博士？",
};

// Second-attempt phrasings — shorter and more forgiving when the first
// answer was unparseable.
const RETRY_QUESTIONS: Record<FormFieldKey, string> = {
    target_field:
        "刚才没看懂，可以直接说个最近的：IT、数据、商科、工程、金融、设计、TESOL；或者打「跳过」。",
    annual_budget_aud:
        "我换算不了这个币种，给个 AUD 或人民币的数字试试？打「跳过」也行。",
    preferred_tags:
        "直接说一个最看重的就行，比如「就业」「移民」「性价比」；或者打「跳过」。",
    gpa: "给个 4 分制数字就行，例如 3.6；没把握就打「跳过」。",
    ielts_overall: "0 到 9 之间的总分就行，没考过打「跳过」。",
    teaching_style: "理论 / 平衡 / 实践 三选一；不确定就打「跳过」。",
    city_size:
        "超大 / 大 / 中 / 小 城市，挑一个；不确定就打「跳过」。",
    target_level: "本科 / 硕士 / 博士，三选一。",
};

// --- main entry ----------------------------------------------------------

export function runDeterministicTurn(
    input: FallbackTurnInput,
): FallbackTurnResult {
    const patch: Mutable<ClarifyPatch> = {};
    const asked = lastAsked(input.messages);
    const userAnswer = lastUser(input.messages);

    let filled = false;
    let skipped = false;
    if (asked && userAnswer) {
        filled = applyAnswer(asked.key, userAnswer, patch);
        if (!filled && isSkip(userAnswer)) skipped = true;
    }

    // Decide whether to re-ask the same field or move on. Be more patient:
    // 3 attempts before giving up, since users often clarify across turns.
    if (asked && userAnswer && !filled && !skipped && asked.attempt < 3) {
        const reAsk = RETRY_QUESTIONS[asked.key];
        return {
            reply: appendMarker(reAsk, asked.key, asked.attempt + 1),
            done: false,
        };
    }

    // Build the remaining list. If we just filled or skipped the asked
    // field, exclude it; otherwise keep going down the list.
    const remaining = input.missingKeys.filter(
        (k) => !(asked && k === asked.key && (filled || skipped || asked.attempt >= 3)),
    );

    if (remaining.length === 0) {
        return {
            reply:
                "都聊清楚了，下方按钮就能出报告。还想改任何字段，直接点右边表单。",
            patch: Object.keys(patch).length > 0 ? patch : undefined,
            done: true,
        };
    }

    const nextKey = remaining[0];
    // Acknowledge what the user said before pivoting. If they expressed
    // a skip with extra context (e.g. "都没有，最看重校园环境"), echo the
    // extra bit so they don't feel ignored. Strip pure skip words to avoid
    // "记下了：都没有" which reads silly.
    const extra = skipped ? extractExtraContext(userAnswer) : "";
    const ack = filled
        ? ""
        : skipped
            ? extra
                ? `好，记下了你提到的「${extra}」（表单没这个选项，会作为参考）。这条先跳过。`
                : "好，这条先跳过。你之后可以在右边表单里手动选，或者留空。"
            : asked && !filled && asked.attempt >= 3
                ? "这条我没读出明确答案，先跳过——你可以在右边表单里直接选。"
                : "";
    const body = QUESTIONS[nextKey];
    const reply = ack ? `${ack}\n${body}` : body;
    return {
        reply: appendMarker(reply, nextKey, 1),
        patch: Object.keys(patch).length > 0 ? patch : undefined,
        done: false,
    };
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function applyAnswer(
    key: FormFieldKey,
    answer: string,
    patch: Mutable<ClarifyPatch>,
): boolean {
    switch (key) {
        case "target_field": {
            const v = parseTargetField(answer);
            if (v) {
                patch.target_field = v;
                return true;
            }
            return false;
        }
        case "annual_budget_aud": {
            const v = parseBudget(answer);
            if (v !== undefined) {
                patch.annual_budget_aud = v;
                return true;
            }
            return false;
        }
        case "preferred_tags": {
            const v = parseTags(answer);
            if (v) {
                // reason: parseTags returns plain string[] from a closed enum
                // set, type-narrowed by the schema enum at runtime.
                patch.preferred_tags = v as ClarifyPatch["preferred_tags"];
                return true;
            }
            return false;
        }
        case "gpa": {
            const v = parseGpa(answer);
            if (v !== undefined) {
                patch.gpa = v;
                return true;
            }
            return false;
        }
        case "ielts_overall": {
            const v = parseIelts(answer);
            if (v !== undefined) {
                patch.ielts_overall = v;
                return true;
            }
            return false;
        }
        case "teaching_style": {
            const v = parseTeachingStyle(answer);
            if (v) {
                patch.teaching_style = v;
                return true;
            }
            return false;
        }
        case "city_size": {
            const v = parseCitySize(answer);
            if (v) {
                patch.city_size = v;
                return true;
            }
            return false;
        }
        case "target_level": {
            const v = parseTargetLevel(answer);
            if (v) {
                patch.target_level = v;
                return true;
            }
            return false;
        }
    }
}

export { stripMarker };
