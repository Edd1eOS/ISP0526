// Country-level reference calendar.
//
// Used as a fallback by the plan page when a program does not yet carry its
// own `deadlines` payload from official sources. Surfaced in the UI as the
// "typical rhythm" — never presented as an authoritative deadline for a
// specific program. Months are 1-indexed; days are anchored at the 1st or
// 15th to make timeline arithmetic deterministic.
//
// Sources cited at point of use; this template encodes well-known intake
// patterns (e.g. UK September intake, AU February / July intakes) rather
// than any single institution's calendar.

import type { Country } from "../schemas/institution";

export interface CalendarMilestone {
    readonly key:
    | "application_open"
    | "application_deadline"
    | "decision_by"
    | "deposit_deadline"
    | "visa_window"
    | "intake_start";
    readonly label_zh: string;
    // Month / day pair for the calendar year that the milestone happens in.
    // `yearOffset` 0 = same calendar year as the intake; -1 = the year prior.
    readonly month: number;
    readonly day: number;
    readonly yearOffset: -1 | 0;
}

export interface CountryCalendar {
    readonly country: Country;
    readonly intakeMonth: number;
    readonly note_zh: string;
    readonly milestones: readonly CalendarMilestone[];
}

// Each entry assumes the next available main intake. The plan UI projects
// these onto a real-time axis using the upcoming intake year.
export const COUNTRY_CALENDARS: Record<Country, CountryCalendar> = {
    UK: {
        country: "UK",
        intakeMonth: 9,
        note_zh: "英国硕士主入学为 9 月",
        milestones: [
            {
                key: "application_open",
                label_zh: "递交开放",
                month: 10,
                day: 1,
                yearOffset: -1,
            },
            {
                key: "application_deadline",
                label_zh: "主要截止",
                month: 3,
                day: 15,
                yearOffset: 0,
            },
            {
                key: "decision_by",
                label_zh: "Offer 落定",
                month: 5,
                day: 1,
                yearOffset: 0,
            },
            {
                key: "deposit_deadline",
                label_zh: "押金截止",
                month: 6,
                day: 1,
                yearOffset: 0,
            },
            {
                key: "visa_window",
                label_zh: "签证递交窗口",
                month: 7,
                day: 15,
                yearOffset: 0,
            },
            {
                key: "intake_start",
                label_zh: "开学",
                month: 9,
                day: 25,
                yearOffset: 0,
            },
        ],
    },
    US: {
        country: "US",
        intakeMonth: 9,
        note_zh: "美国秋季入学为 8-9 月",
        milestones: [
            {
                key: "application_open",
                label_zh: "递交开放",
                month: 9,
                day: 1,
                yearOffset: -1,
            },
            {
                key: "application_deadline",
                label_zh: "主要截止",
                month: 1,
                day: 5,
                yearOffset: 0,
            },
            {
                key: "decision_by",
                label_zh: "Offer 落定",
                month: 3,
                day: 15,
                yearOffset: 0,
            },
            {
                key: "deposit_deadline",
                label_zh: "押金截止",
                month: 4,
                day: 15,
                yearOffset: 0,
            },
            {
                key: "visa_window",
                label_zh: "签证递交窗口",
                month: 6,
                day: 1,
                yearOffset: 0,
            },
            {
                key: "intake_start",
                label_zh: "开学",
                month: 8,
                day: 25,
                yearOffset: 0,
            },
        ],
    },
    CA: {
        country: "CA",
        intakeMonth: 9,
        note_zh: "加拿大秋季入学为 9 月",
        milestones: [
            {
                key: "application_open",
                label_zh: "递交开放",
                month: 10,
                day: 1,
                yearOffset: -1,
            },
            {
                key: "application_deadline",
                label_zh: "主要截止",
                month: 1,
                day: 15,
                yearOffset: 0,
            },
            {
                key: "decision_by",
                label_zh: "Offer 落定",
                month: 4,
                day: 1,
                yearOffset: 0,
            },
            {
                key: "deposit_deadline",
                label_zh: "押金截止",
                month: 5,
                day: 1,
                yearOffset: 0,
            },
            {
                key: "visa_window",
                label_zh: "学签递交窗口",
                month: 6,
                day: 1,
                yearOffset: 0,
            },
            {
                key: "intake_start",
                label_zh: "开学",
                month: 9,
                day: 5,
                yearOffset: 0,
            },
        ],
    },
    AU: {
        country: "AU",
        intakeMonth: 2,
        note_zh: "澳大利亚主入学为 2 月，7 月也有补录",
        milestones: [
            {
                key: "application_open",
                label_zh: "递交开放",
                month: 6,
                day: 1,
                yearOffset: -1,
            },
            {
                key: "application_deadline",
                label_zh: "主要截止",
                month: 11,
                day: 30,
                yearOffset: -1,
            },
            {
                key: "decision_by",
                label_zh: "Offer 落定",
                month: 12,
                day: 20,
                yearOffset: -1,
            },
            {
                key: "deposit_deadline",
                label_zh: "押金截止",
                month: 1,
                day: 15,
                yearOffset: 0,
            },
            {
                key: "visa_window",
                label_zh: "签证递交窗口",
                month: 1,
                day: 20,
                yearOffset: 0,
            },
            {
                key: "intake_start",
                label_zh: "开学",
                month: 2,
                day: 20,
                yearOffset: 0,
            },
        ],
    },
    NZ: {
        country: "NZ",
        intakeMonth: 2,
        note_zh: "新西兰主入学为 2 月",
        milestones: [
            {
                key: "application_open",
                label_zh: "递交开放",
                month: 7,
                day: 1,
                yearOffset: -1,
            },
            {
                key: "application_deadline",
                label_zh: "主要截止",
                month: 11,
                day: 15,
                yearOffset: -1,
            },
            {
                key: "decision_by",
                label_zh: "Offer 落定",
                month: 12,
                day: 15,
                yearOffset: -1,
            },
            {
                key: "deposit_deadline",
                label_zh: "押金截止",
                month: 1,
                day: 10,
                yearOffset: 0,
            },
            {
                key: "visa_window",
                label_zh: "签证递交窗口",
                month: 1,
                day: 20,
                yearOffset: 0,
            },
            {
                key: "intake_start",
                label_zh: "开学",
                month: 2,
                day: 25,
                yearOffset: 0,
            },
        ],
    },
    HK: {
        country: "HK",
        intakeMonth: 9,
        note_zh: "香港授课型硕士主入学为 9 月",
        milestones: [
            {
                key: "application_open",
                label_zh: "递交开放",
                month: 9,
                day: 15,
                yearOffset: -1,
            },
            {
                key: "application_deadline",
                label_zh: "主要截止",
                month: 1,
                day: 31,
                yearOffset: 0,
            },
            {
                key: "decision_by",
                label_zh: "Offer 落定",
                month: 4,
                day: 1,
                yearOffset: 0,
            },
            {
                key: "deposit_deadline",
                label_zh: "押金截止",
                month: 5,
                day: 1,
                yearOffset: 0,
            },
            {
                key: "visa_window",
                label_zh: "学签递交窗口",
                month: 6,
                day: 15,
                yearOffset: 0,
            },
            {
                key: "intake_start",
                label_zh: "开学",
                month: 9,
                day: 5,
                yearOffset: 0,
            },
        ],
    },
    SG: {
        country: "SG",
        intakeMonth: 8,
        note_zh: "新加坡授课型硕士主入学为 8 月",
        milestones: [
            {
                key: "application_open",
                label_zh: "递交开放",
                month: 10,
                day: 1,
                yearOffset: -1,
            },
            {
                key: "application_deadline",
                label_zh: "主要截止",
                month: 1,
                day: 31,
                yearOffset: 0,
            },
            {
                key: "decision_by",
                label_zh: "Offer 落定",
                month: 4,
                day: 1,
                yearOffset: 0,
            },
            {
                key: "deposit_deadline",
                label_zh: "押金截止",
                month: 5,
                day: 1,
                yearOffset: 0,
            },
            {
                key: "visa_window",
                label_zh: "学签递交窗口",
                month: 6,
                day: 1,
                yearOffset: 0,
            },
            {
                key: "intake_start",
                label_zh: "开学",
                month: 8,
                day: 5,
                yearOffset: 0,
            },
        ],
    },
};

// Resolve a calendar milestone to a concrete Date in the upcoming intake.
// `referenceDate` defaults to the current date; the next intake is the
// earliest occurrence of the country's intake month after that reference.
export function resolveMilestone(
    country: Country,
    milestone: CalendarMilestone,
    referenceDate: Date = new Date(),
): Date {
    const cal = COUNTRY_CALENDARS[country]!;
    const refYear = referenceDate.getUTCFullYear();
    const refMonth = referenceDate.getUTCMonth() + 1;
    // Intake year: the next year that contains the intake month from now.
    const intakeYear =
        refMonth <= cal.intakeMonth ? refYear : refYear + 1;
    const year = intakeYear + milestone.yearOffset;
    // Months in JS Date are 0-indexed.
    return new Date(Date.UTC(year, milestone.month - 1, milestone.day));
}

// Resolve a milestone against an explicitly chosen intake (year + month).
// Use this when the user has picked a target intake; it ignores the country's
// default intake month and pins the timeline to the user's choice.
export function resolveMilestoneForIntake(
    country: Country,
    milestone: CalendarMilestone,
    intakeYear: number,
): Date {
    void country;
    const year = intakeYear + milestone.yearOffset;
    return new Date(Date.UTC(year, milestone.month - 1, milestone.day));
}
