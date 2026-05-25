// Visa-route reference data contract.
//
// Each country in `packages/core/data/visa-routes.json` ships its student
// visa class, typical end-to-end processing weeks, the ordered application
// steps, and an authoritative source citation. The scoring layer reads this
// to compute the `visa_feasibility` dimension.

import { z } from "zod";
import { CountrySchema } from "./institution";
import { SourceCitationSchema } from "./source";

export const VisaStepSchema = z.object({
    id: z.string().min(1),
    name_en: z.string().min(1),
    // Typical elapsed time for this step in calendar weeks.
    weeks: z.number().min(0).max(52),
});
export type VisaStep = z.infer<typeof VisaStepSchema>;

export const VisaRouteSchema = z.object({
    country_name_en: z.string().min(1),
    country_name_zh: z.string().min(1),
    visa_class: z.string().min(1),
    // Typical end-to-end weeks for a well-prepared applicant.
    total_weeks_typical: z.number().min(1).max(104),
    // Available post-study work years; a proxy for migration friendliness.
    post_study_work_years: z.number().min(0).max(10),
    steps: z.array(VisaStepSchema).min(1),
    source: SourceCitationSchema,
});
export type VisaRoute = z.infer<typeof VisaRouteSchema>;

export const VisaRouteMapSchema = z.record(CountrySchema, VisaRouteSchema);
export type VisaRouteMap = z.infer<typeof VisaRouteMapSchema>;
