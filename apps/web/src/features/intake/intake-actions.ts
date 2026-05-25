"use server";

import { redirect } from "next/navigation";
import { parseIntakeFormData, intakeToProfile } from "./intake-schema";
import { runReportFromProfile } from "../../lib/run-report";

export async function submitIntakeAction(formData: FormData): Promise<void> {
    const values = parseIntakeFormData(formData);
    const profile = intakeToProfile(values);
    const { code } = await runReportFromProfile(profile);
    redirect(`/r/${code}`);
}
