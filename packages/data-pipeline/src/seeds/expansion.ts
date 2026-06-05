import type { Country, ProgramTag, TeachingStyle } from "@isp0526/core";

export type UniSeed = {
    id: string;
    name_en: string;
    name_zh: string;
    country: Country;
    city: string;
    city_size: "mega" | "large" | "medium" | "small";
    climate: "tropical" | "subtropical" | "temperate" | "cold";
    reputation_score: number;
    chinese_community_density: number;
    safety_index: number;
    homepage: string;
};

export const AU_EXPANSION: UniSeed[] = [
    { id: "monash", name_en: "Monash University", name_zh: "蒙纳士大学", country: "AU", city: "Melbourne", city_size: "mega", climate: "temperate", reputation_score: 0.91, chinese_community_density: 0.72, safety_index: 0.86, homepage: "https://www.monash.edu/" },
    { id: "uwa", name_en: "The University of Western Australia", name_zh: "西澳大学", country: "AU", city: "Perth", city_size: "large", climate: "subtropical", reputation_score: 0.87, chinese_community_density: 0.5, safety_index: 0.9, homepage: "https://www.uwa.edu.au/" },
    { id: "adelaide", name_en: "The University of Adelaide", name_zh: "阿德莱德大学", country: "AU", city: "Adelaide", city_size: "large", climate: "temperate", reputation_score: 0.86, chinese_community_density: 0.48, safety_index: 0.89, homepage: "https://www.adelaide.edu.au/" },
    { id: "uts", name_en: "University of Technology Sydney", name_zh: "悉尼科技大学", country: "AU", city: "Sydney", city_size: "mega", climate: "subtropical", reputation_score: 0.84, chinese_community_density: 0.78, safety_index: 0.84, homepage: "https://www.uts.edu.au/" },
    { id: "macquarie", name_en: "Macquarie University", name_zh: "麦考瑞大学", country: "AU", city: "Sydney", city_size: "mega", climate: "subtropical", reputation_score: 0.83, chinese_community_density: 0.65, safety_index: 0.85, homepage: "https://www.mq.edu.au/" },
    { id: "rmit", name_en: "RMIT University", name_zh: "皇家墨尔本理工大学", country: "AU", city: "Melbourne", city_size: "mega", climate: "temperate", reputation_score: 0.82, chinese_community_density: 0.7, safety_index: 0.83, homepage: "https://www.rmit.edu.au/" },
    { id: "qut", name_en: "Queensland University of Technology", name_zh: "昆士兰科技大学", country: "AU", city: "Brisbane", city_size: "large", climate: "subtropical", reputation_score: 0.81, chinese_community_density: 0.58, safety_index: 0.87, homepage: "https://www.qut.edu.au/" },
    { id: "griffith", name_en: "Griffith University", name_zh: "格里菲斯大学", country: "AU", city: "Brisbane", city_size: "large", climate: "subtropical", reputation_score: 0.78, chinese_community_density: 0.52, safety_index: 0.86, homepage: "https://www.griffith.edu.au/" },
    { id: "deakin", name_en: "Deakin University", name_zh: "迪肯大学", country: "AU", city: "Melbourne", city_size: "mega", climate: "temperate", reputation_score: 0.77, chinese_community_density: 0.55, safety_index: 0.85, homepage: "https://www.deakin.edu.au/" },
    { id: "curtin", name_en: "Curtin University", name_zh: "科廷大学", country: "AU", city: "Perth", city_size: "large", climate: "subtropical", reputation_score: 0.76, chinese_community_density: 0.45, safety_index: 0.88, homepage: "https://www.curtin.edu.au/" },
    { id: "uow", name_en: "University of Wollongong", name_zh: "卧龙岗大学", country: "AU", city: "Wollongong", city_size: "medium", climate: "subtropical", reputation_score: 0.75, chinese_community_density: 0.42, safety_index: 0.87, homepage: "https://www.uow.edu.au/" },
    { id: "newcastle", name_en: "University of Newcastle", name_zh: "纽卡斯尔大学（澳洲）", country: "AU", city: "Newcastle", city_size: "medium", climate: "subtropical", reputation_score: 0.74, chinese_community_density: 0.4, safety_index: 0.86, homepage: "https://www.newcastle.edu.au/" },
    { id: "swinburne", name_en: "Swinburne University of Technology", name_zh: "斯威本科技大学", country: "AU", city: "Melbourne", city_size: "mega", climate: "temperate", reputation_score: 0.73, chinese_community_density: 0.6, safety_index: 0.84, homepage: "https://www.swinburne.edu.au/" },
    { id: "latrobe", name_en: "La Trobe University", name_zh: "乐卓博大学", country: "AU", city: "Melbourne", city_size: "mega", climate: "temperate", reputation_score: 0.72, chinese_community_density: 0.5, safety_index: 0.85, homepage: "https://www.latrobe.edu.au/" },
    { id: "flinders", name_en: "Flinders University", name_zh: "弗林德斯大学", country: "AU", city: "Adelaide", city_size: "large", climate: "temperate", reputation_score: 0.71, chinese_community_density: 0.38, safety_index: 0.88, homepage: "https://www.flinders.edu.au/" },
    { id: "jcu", name_en: "James Cook University", name_zh: "詹姆斯库克大学", country: "AU", city: "Townsville", city_size: "medium", climate: "tropical", reputation_score: 0.7, chinese_community_density: 0.25, safety_index: 0.87, homepage: "https://www.jcu.edu.au/" },
    { id: "murdoch", name_en: "Murdoch University", name_zh: "默多克大学", country: "AU", city: "Perth", city_size: "large", climate: "subtropical", reputation_score: 0.69, chinese_community_density: 0.35, safety_index: 0.89, homepage: "https://www.murdoch.edu.au/" },
    { id: "usq", name_en: "University of Southern Queensland", name_zh: "南昆士兰大学", country: "AU", city: "Toowoomba", city_size: "small", climate: "subtropical", reputation_score: 0.65, chinese_community_density: 0.2, safety_index: 0.9, homepage: "https://www.usq.edu.au/" },
    { id: "westernsydney", name_en: "Western Sydney University", name_zh: "西悉尼大学", country: "AU", city: "Sydney", city_size: "mega", climate: "subtropical", reputation_score: 0.74, chinese_community_density: 0.68, safety_index: 0.83, homepage: "https://www.westernsydney.edu.au/" },
    { id: "acu", name_en: "Australian Catholic University", name_zh: "澳洲天主教大学", country: "AU", city: "Melbourne", city_size: "mega", climate: "temperate", reputation_score: 0.64, chinese_community_density: 0.45, safety_index: 0.86, homepage: "https://www.acu.edu.au/" },
    { id: "cqu", name_en: "Central Queensland University", name_zh: "中央昆士兰大学", country: "AU", city: "Rockhampton", city_size: "small", climate: "subtropical", reputation_score: 0.63, chinese_community_density: 0.22, safety_index: 0.88, homepage: "https://www.cqu.edu.au/" },
    { id: "bond", name_en: "Bond University", name_zh: "邦德大学", country: "AU", city: "Gold Coast", city_size: "medium", climate: "subtropical", reputation_score: 0.72, chinese_community_density: 0.3, safety_index: 0.89, homepage: "https://bond.edu.au/" },
    { id: "utas", name_en: "University of Tasmania", name_zh: "塔斯马尼亚大学", country: "AU", city: "Hobart", city_size: "medium", climate: "temperate", reputation_score: 0.68, chinese_community_density: 0.28, safety_index: 0.91, homepage: "https://www.utas.edu.au/" },
    { id: "feduni", name_en: "Federation University Australia", name_zh: "联邦大学", country: "AU", city: "Ballarat", city_size: "small", climate: "temperate", reputation_score: 0.6, chinese_community_density: 0.18, safety_index: 0.9, homepage: "https://federation.edu.au/" },
    { id: "vu", name_en: "Victoria University", name_zh: "维多利亚大学（澳洲）", country: "AU", city: "Melbourne", city_size: "mega", climate: "temperate", reputation_score: 0.66, chinese_community_density: 0.55, safety_index: 0.82, homepage: "https://www.vu.edu.au/" },
    { id: "csu", name_en: "Charles Sturt University", name_zh: "查尔斯特大学", country: "AU", city: "Bathurst", city_size: "small", climate: "temperate", reputation_score: 0.62, chinese_community_density: 0.15, safety_index: 0.89, homepage: "https://www.csu.edu.au/" },
    { id: "scu", name_en: "Southern Cross University", name_zh: "南十字星大学", country: "AU", city: "Lismore", city_size: "small", climate: "subtropical", reputation_score: 0.61, chinese_community_density: 0.12, safety_index: 0.88, homepage: "https://www.scu.edu.au/" },
    { id: "une", name_en: "University of New England", name_zh: "新英格兰大学", country: "AU", city: "Armidale", city_size: "small", climate: "temperate", reputation_score: 0.64, chinese_community_density: 0.1, safety_index: 0.92, homepage: "https://www.une.edu.au/" },
    { id: "canberra", name_en: "University of Canberra", name_zh: "堪培拉大学", country: "AU", city: "Canberra", city_size: "medium", climate: "temperate", reputation_score: 0.67, chinese_community_density: 0.35, safety_index: 0.9, homepage: "https://www.canberra.edu.au/" },
    { id: "ecu", name_en: "Edith Cowan University", name_zh: "埃迪斯科文大学", country: "AU", city: "Perth", city_size: "large", climate: "subtropical", reputation_score: 0.68, chinese_community_density: 0.38, safety_index: 0.88, homepage: "https://www.ecu.edu.au/" },
];

export const UK_EXPANSION: UniSeed[] = [
    { id: "oxford", name_en: "University of Oxford", name_zh: "牛津大学", country: "UK", city: "Oxford", city_size: "medium", climate: "temperate", reputation_score: 0.99, chinese_community_density: 0.35, safety_index: 0.9, homepage: "https://www.ox.ac.uk/" },
    { id: "cambridge", name_en: "University of Cambridge", name_zh: "剑桥大学", country: "UK", city: "Cambridge", city_size: "medium", climate: "temperate", reputation_score: 0.99, chinese_community_density: 0.32, safety_index: 0.91, homepage: "https://www.cam.ac.uk/" },
    { id: "ucl", name_en: "University College London", name_zh: "伦敦大学学院", country: "UK", city: "London", city_size: "mega", climate: "temperate", reputation_score: 0.96, chinese_community_density: 0.65, safety_index: 0.8, homepage: "https://www.ucl.ac.uk/" },
    { id: "lse", name_en: "London School of Economics and Political Science", name_zh: "伦敦政治经济学院", country: "UK", city: "London", city_size: "mega", climate: "temperate", reputation_score: 0.95, chinese_community_density: 0.55, safety_index: 0.79, homepage: "https://www.lse.ac.uk/" },
    { id: "kcl", name_en: "King's College London", name_zh: "伦敦国王学院", country: "UK", city: "London", city_size: "mega", climate: "temperate", reputation_score: 0.94, chinese_community_density: 0.58, safety_index: 0.81, homepage: "https://www.kcl.ac.uk/" },
    { id: "bristol", name_en: "University of Bristol", name_zh: "布里斯托大学", country: "UK", city: "Bristol", city_size: "large", climate: "temperate", reputation_score: 0.9, chinese_community_density: 0.4, safety_index: 0.85, homepage: "https://www.bristol.ac.uk/" },
    { id: "warwick", name_en: "University of Warwick", name_zh: "华威大学", country: "UK", city: "Coventry", city_size: "large", climate: "temperate", reputation_score: 0.89, chinese_community_density: 0.42, safety_index: 0.86, homepage: "https://warwick.ac.uk/" },
    { id: "glasgow", name_en: "University of Glasgow", name_zh: "格拉斯哥大学", country: "UK", city: "Glasgow", city_size: "large", climate: "temperate", reputation_score: 0.88, chinese_community_density: 0.38, safety_index: 0.84, homepage: "https://www.gla.ac.uk/" },
    { id: "birmingham", name_en: "University of Birmingham", name_zh: "伯明翰大学", country: "UK", city: "Birmingham", city_size: "large", climate: "temperate", reputation_score: 0.87, chinese_community_density: 0.45, safety_index: 0.83, homepage: "https://www.birmingham.ac.uk/" },
    { id: "leeds", name_en: "University of Leeds", name_zh: "利兹大学", country: "UK", city: "Leeds", city_size: "large", climate: "temperate", reputation_score: 0.86, chinese_community_density: 0.48, safety_index: 0.84, homepage: "https://www.leeds.ac.uk/" },
    { id: "sheffield", name_en: "University of Sheffield", name_zh: "谢菲尔德大学", country: "UK", city: "Sheffield", city_size: "large", climate: "temperate", reputation_score: 0.85, chinese_community_density: 0.44, safety_index: 0.85, homepage: "https://www.sheffield.ac.uk/" },
    { id: "nottingham", name_en: "University of Nottingham", name_zh: "诺丁汉大学", country: "UK", city: "Nottingham", city_size: "large", climate: "temperate", reputation_score: 0.84, chinese_community_density: 0.46, safety_index: 0.86, homepage: "https://www.nottingham.ac.uk/" },
    { id: "durham", name_en: "Durham University", name_zh: "杜伦大学", country: "UK", city: "Durham", city_size: "small", climate: "temperate", reputation_score: 0.88, chinese_community_density: 0.25, safety_index: 0.92, homepage: "https://www.durham.ac.uk/" },
    { id: "standrews", name_en: "University of St Andrews", name_zh: "圣安德鲁斯大学", country: "UK", city: "St Andrews", city_size: "small", climate: "temperate", reputation_score: 0.87, chinese_community_density: 0.15, safety_index: 0.93, homepage: "https://www.st-andrews.ac.uk/" },
    { id: "southampton", name_en: "University of Southampton", name_zh: "南安普顿大学", country: "UK", city: "Southampton", city_size: "large", climate: "temperate", reputation_score: 0.83, chinese_community_density: 0.35, safety_index: 0.87, homepage: "https://www.southampton.ac.uk/" },
    { id: "exeter", name_en: "University of Exeter", name_zh: "埃克塞特大学", country: "UK", city: "Exeter", city_size: "medium", climate: "temperate", reputation_score: 0.82, chinese_community_density: 0.3, safety_index: 0.9, homepage: "https://www.exeter.ac.uk/" },
    { id: "york", name_en: "University of York", name_zh: "约克大学（英国）", country: "UK", city: "York", city_size: "medium", climate: "temperate", reputation_score: 0.83, chinese_community_density: 0.28, safety_index: 0.91, homepage: "https://www.york.ac.uk/" },
];

export const CA_EXPANSION: UniSeed[] = [
    { id: "waterloo", name_en: "University of Waterloo", name_zh: "滑铁卢大学", country: "CA", city: "Waterloo", city_size: "medium", climate: "cold", reputation_score: 0.89, chinese_community_density: 0.55, safety_index: 0.88, homepage: "https://uwaterloo.ca/" },
    { id: "ualberta", name_en: "University of Alberta", name_zh: "阿尔伯塔大学", country: "CA", city: "Edmonton", city_size: "large", climate: "cold", reputation_score: 0.86, chinese_community_density: 0.45, safety_index: 0.87, homepage: "https://www.ualberta.ca/" },
    { id: "mcmaster", name_en: "McMaster University", name_zh: "麦克马斯特大学", country: "CA", city: "Hamilton", city_size: "large", climate: "cold", reputation_score: 0.85, chinese_community_density: 0.4, safety_index: 0.88, homepage: "https://www.mcmaster.ca/" },
    { id: "uottawa", name_en: "University of Ottawa", name_zh: "渥太华大学", country: "CA", city: "Ottawa", city_size: "large", climate: "cold", reputation_score: 0.82, chinese_community_density: 0.35, safety_index: 0.89, homepage: "https://www.uottawa.ca/" },
    { id: "queens", name_en: "Queen's University", name_zh: "皇后大学", country: "CA", city: "Kingston", city_size: "medium", climate: "cold", reputation_score: 0.84, chinese_community_density: 0.25, safety_index: 0.9, homepage: "https://www.queensu.ca/" },
    { id: "western", name_en: "Western University", name_zh: "西安大略大学", country: "CA", city: "London", city_size: "large", climate: "cold", reputation_score: 0.83, chinese_community_density: 0.38, safety_index: 0.87, homepage: "https://www.westernu.ca/" },
    { id: "dalhousie", name_en: "Dalhousie University", name_zh: "达尔豪斯大学", country: "CA", city: "Halifax", city_size: "medium", climate: "cold", reputation_score: 0.8, chinese_community_density: 0.22, safety_index: 0.91, homepage: "https://www.dal.ca/" },
    { id: "sfu", name_en: "Simon Fraser University", name_zh: "西蒙菲莎大学", country: "CA", city: "Burnaby", city_size: "large", climate: "temperate", reputation_score: 0.81, chinese_community_density: 0.65, safety_index: 0.88, homepage: "https://www.sfu.ca/" },
    { id: "uvic", name_en: "University of Victoria", name_zh: "维多利亚大学（加拿大）", country: "CA", city: "Victoria", city_size: "medium", climate: "temperate", reputation_score: 0.79, chinese_community_density: 0.3, safety_index: 0.92, homepage: "https://www.uvic.ca/" },
    { id: "yorku", name_en: "York University", name_zh: "约克大学（加拿大）", country: "CA", city: "Toronto", city_size: "mega", climate: "cold", reputation_score: 0.78, chinese_community_density: 0.68, safety_index: 0.84, homepage: "https://www.yorku.ca/" },
    { id: "concordia", name_en: "Concordia University", name_zh: "康考迪亚大学", country: "CA", city: "Montreal", city_size: "mega", climate: "cold", reputation_score: 0.76, chinese_community_density: 0.5, safety_index: 0.85, homepage: "https://www.concordia.ca/" },
    { id: "calgary", name_en: "University of Calgary", name_zh: "卡尔加里大学", country: "CA", city: "Calgary", city_size: "large", climate: "cold", reputation_score: 0.8, chinese_community_density: 0.42, safety_index: 0.89, homepage: "https://www.ucalgary.ca/" },
];

export type ProgramTemplate = {
    slug: string;
    name_en: string;
    name_zh: string;
    field: string;
    teaching_style: TeachingStyle;
    gpa_min: number;
    ielts: number;
    tuition_aud: number;
    tags: ProgramTag[];
    applied_ratio: number;
};

export const STANDARD_MASTER_TEMPLATES: ProgramTemplate[] = [
    { slug: "master-of-it", name_en: "Master of Information Technology", name_zh: "信息技术硕士", field: "Information Technology", teaching_style: "applied_heavy", gpa_min: 2.7, ielts: 6.5, tuition_aud: 52000, tags: ["field_top", "career_pipeline", "migration_friendly"], applied_ratio: 0.75 },
    { slug: "master-of-computing", name_en: "Master of Computing", name_zh: "计算机科学硕士", field: "Computing", teaching_style: "balanced", gpa_min: 2.8, ielts: 6.5, tuition_aud: 54000, tags: ["field_top", "career_pipeline"], applied_ratio: 0.65 },
    { slug: "master-of-data-science", name_en: "Master of Data Science", name_zh: "数据科学硕士", field: "Data Science", teaching_style: "balanced", gpa_min: 2.8, ielts: 6.5, tuition_aud: 56000, tags: ["field_top", "career_pipeline"], applied_ratio: 0.7 },
    { slug: "master-of-commerce", name_en: "Master of Commerce", name_zh: "商学硕士", field: "Business", teaching_style: "balanced", gpa_min: 2.7, ielts: 6.5, tuition_aud: 48000, tags: ["career_pipeline", "value_for_money"], applied_ratio: 0.55 },
    { slug: "master-of-finance", name_en: "Master of Finance", name_zh: "金融硕士", field: "Finance", teaching_style: "theory_heavy", gpa_min: 2.9, ielts: 7.0, tuition_aud: 50000, tags: ["career_pipeline", "field_top"], applied_ratio: 0.5 },
];

export function uniToUniversity(seed: UniSeed, verifiedDate = "2026-06-05") {
    return {
        id: seed.id,
        name_en: seed.name_en,
        name_zh: seed.name_zh,
        country: seed.country,
        city: seed.city,
        city_size: seed.city_size,
        climate: seed.climate,
        reputation_score: seed.reputation_score,
        chinese_community_density: seed.chinese_community_density,
        safety_index: seed.safety_index,
        sources: [
            {
                source_id: `${seed.id}_homepage_2026`,
                kind: "url" as const,
                url: seed.homepage,
                last_verified_date: verifiedDate,
                note: "curated expansion batch 2026-06; institutional facts from official homepage",
            },
        ],
    };
}

export function programsForUni(seed: UniSeed, verifiedDate = "2026-06-05") {
    const countryTags: ProgramTag[] =
        seed.country === "AU" ? ["migration_friendly"] :
        seed.country === "CA" ? ["migration_friendly"] :
        ["stepping_stone"];

    return STANDARD_MASTER_TEMPLATES.map((t) => ({
        id: `${seed.id}-${t.slug}`,
        university_id: seed.id,
        name_en: t.name_en,
        name_zh: t.name_zh,
        level: "master" as const,
        duration_years: 2,
        field: t.field,
        teaching_style: t.teaching_style,
        gpa_min: t.gpa_min,
        language_min: { ielts_overall: t.ielts, ielts_min_band: 6.0 },
        tuition: { currency: "AUD" as const, annual: t.tuition_aud },
        tags: [...new Set([...t.tags, ...countryTags])],
        applied_ratio: t.applied_ratio,
        sources: [
            {
                source_id: `${seed.id}_${t.slug.replace(/-/g, "_")}_2026`,
                kind: "url" as const,
                url: seed.homepage,
                last_verified_date: verifiedDate,
                note: "placeholder sticker price; verify before launch",
            },
        ],
    }));
}
