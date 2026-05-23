// Source citation contract.
//
// Every institution fact and every generated recommendation reason must point
// back to either a public URL or a rule ID. Anything that cannot be traced is
// dropped during the post-LLM filter step.

import { z } from "zod";

export const SourceCitationSchema = z
  .object({
    source_id: z.string().min(1),
    kind: z.enum(["url", "rule", "dataset_row"]),
    url: z.string().url().optional(),
    rule_id: z.string().min(1).optional(),
    last_verified_date: z.string().date().optional(),
    note: z.string().max(280).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "url" && !value.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "url is required when kind is 'url'",
        path: ["url"],
      });
    }
    if (value.kind === "rule" && !value.rule_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rule_id is required when kind is 'rule'",
        path: ["rule_id"],
      });
    }
  });

export type SourceCitation = z.infer<typeof SourceCitationSchema>;
