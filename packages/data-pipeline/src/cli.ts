#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { auditDataset } from "./audit";
import { diffPrograms, diffUniversities, summarizeDiff } from "./diff";
import { generateExpansionDrafts, promoteDraftsToProduction } from "./generate";
import { DRAFTS_DIR, REPORTS_DIR } from "./paths";
import { loadAllProduction, loadProduction, verifyProduction } from "./validate";

const [, , command, ...args] = process.argv;
const write = args.includes("--write");
const dryRun = !write;

function help() {
    console.log(`
ISP0526 data pipeline

  verify              Validate production JSON (Zod)
  audit               Completeness report
  generate expansion  Build expansion drafts from seeds
  diff <au|uk|ca>     Compare drafts vs production
  promote             Merge drafts → production (--write required)
  run expansion       generate + promote in one shot (--write)

Examples:
  npx tsx src/cli.ts verify
  npx tsx src/cli.ts generate expansion
  npx tsx src/cli.ts run expansion --write
`);
}

async function main() {
    switch (command) {
        case "verify": {
            const r = verifyProduction();
            console.log(JSON.stringify(r, null, 2));
            process.exit(r.ok ? 0 : 1);
        }
        case "audit": {
            const { universities, programs } = loadAllProduction();
            const report = auditDataset(universities, programs);
            fs.mkdirSync(REPORTS_DIR, { recursive: true });
            const out = path.join(REPORTS_DIR, `${new Date().toISOString().slice(0, 10)}-audit.json`);
            fs.writeFileSync(out, JSON.stringify(report, null, 2));
            console.log(JSON.stringify(report, null, 2));
            console.log(`\nSaved: ${out}`);
            break;
        }
        case "generate": {
            if (args[0] !== "expansion") {
                console.error("Usage: generate expansion");
                process.exit(1);
            }
            const r = generateExpansionDrafts();
            console.log("Drafts written to packages/data-pipeline/drafts/");
            r.summary.forEach((s) => console.log(" ", s));
            break;
        }
        case "diff": {
            const country = args[0] ?? "au";
            const prod = loadProduction(country);
            const draftUniPath = path.join(DRAFTS_DIR, `universities.${country}.draft.json`);
            const draftProgPath = path.join(DRAFTS_DIR, `programs.${country}.draft.json`);
            if (!fs.existsSync(draftUniPath)) {
                console.error("No draft found. Run: generate expansion");
                process.exit(1);
            }
            const draftUni = JSON.parse(fs.readFileSync(draftUniPath, "utf-8"));
            const draftProg = JSON.parse(fs.readFileSync(draftProgPath, "utf-8"));
            const uDiff = diffUniversities(prod.universities, draftUni);
            const pDiff = diffPrograms(prod.programs, draftProg);
            console.log("Universities:", summarizeDiff(uDiff));
            console.log("Programs:", summarizeDiff(pDiff));
            break;
        }
        case "promote": {
            const results = promoteDraftsToProduction(dryRun);
            results.forEach((r) => console.log(r));
            if (dryRun) console.log("\nDry run. Pass --write to update production JSON.");
            else {
                const v = verifyProduction();
                console.log("\nPost-promote verify:", v.stats);
                if (!v.ok) {
                    console.error(v.errors);
                    process.exit(1);
                }
            }
            break;
        }
        case "run": {
            if (args[0] !== "expansion") {
                console.error("Usage: run expansion [--write]");
                process.exit(1);
            }
            generateExpansionDrafts();
            const results = promoteDraftsToProduction(dryRun);
            results.forEach((r) => console.log(r));
            if (dryRun) {
                console.log("\nDry run complete. Re-run with --write to promote.");
            } else {
                const v = verifyProduction();
                console.log("\nProduction:", v.stats);
            }
            break;
        }
        default:
            help();
            process.exit(command ? 1 : 0);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
