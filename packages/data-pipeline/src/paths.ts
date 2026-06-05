import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, "../../..");
export const CORE_DATA = path.join(REPO_ROOT, "packages/core/data");
export const DRAFTS_DIR = path.join(REPO_ROOT, "packages/data-pipeline/drafts");
export const REPORTS_DIR = path.join(REPO_ROOT, "packages/data-pipeline/reports");

export function dataFile(country: "au" | "uk" | "ca", kind: "universities" | "programs") {
    return path.join(CORE_DATA, `${kind}.${country}.json`);
}

export function draftFile(country: "au" | "uk" | "ca", kind: "universities" | "programs") {
    return path.join(DRAFTS_DIR, `${kind}.${country}.draft.json`);
}
