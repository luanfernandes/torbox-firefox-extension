# Grilling log

Status: paused after Q44 on 2026-08-22. Resume at Q45.

This file records owner decisions from the design-tree interview. Product behavior belongs in `product-spec.md`; this log prevents later rounds from reopening settled branches.

| Question | Decision |
| --- | --- |
| Q1 | Scan automatically by default, with a global pause and exact-hostname exclusions. |
| Q2 | Inspect real link destinations only. |
| Q3 | Support Hoster entries only in v1. |
| Q4 | Hide NSFW Hosters until the user opts in. |
| Q5 | Use a toolbar popup for selection and a dedicated batch tab for progress and generated links. |
| Q6 | Allow per-file selection and an explicit Generate all action. |
| Q7 | Support password-protected links and allow temporary local password storage. |
| Q8 | Recover ordinary batches after restart, observe them automatically for 24 hours, and retain terminal summaries for seven days or until dismissal. |
| Q9 | Keep generated links in batch-tab memory. Reloading or closing the tab removes them. |
| Q10 | Omit manual URL entry from v1. |
| Q11 | Leave TorBox account cleanup to TorBox. |
| Q12 | Store the API key in local extension storage with a warning and Replace and Clear actions. |
| Q13 | Scan top-level documents only. |
| Q14 | Apply site exclusions to exact hostnames. |
| Q15 | Allow operation in private windows after the user grants Zen access. |
| Q16 | Start automatic scanning only after setup and API-key validation. |
| Q17 | Disclose a candidate safety cap of at least 100. Choose the final higher value from Zen measurements. |
| Q18 | Keep complete candidates in the isolated scanner until the popup asks for them. Store only counts and service identifiers automatically. |
| Q19 | Strip URL fragments before deduplication and submission. |
| Q20 | Accept embedded URL credentials, permit catalog-matched HTTP sources, and require generated links to use HTTPS. |
| Q21 | Remove known unavailable Hosters from results. |
| Q22 | Cap a batch at 60 candidates. |
| Q23 | Create Web Downloads sequentially. |
| Q24 | Resume confirmed ordinary batches automatically for 24 hours, with a fresh Hoster preflight before the next POST. Require Resume after 24 hours. |
| Q25 | Delete a stored Hoster password after its create outcome, cancellation, or 24-hour timeout. Do not retain it with history. |
| Q26 | Retain hostname and path for attribution. Remove credentials, query, and fragment. |
| Q27 | Cap one link-generation action at 100 files. Further selections remain possible. |
| Q28 | Omit ZIP generation from v1. |
| Q29 | Make notifications optional and off by default. |
| Q30 | Open the batch tab automatically after confirmation. |
| Q31 | Treat v1 as a personal development project. Defer public distribution. |
| Q32 | Verify v1 on the latest stable Zen Browser on Windows. Chromium and other operating systems come later. |
| Q33 | Keep private-window batches ephemeral, without restart recovery or notifications. |
| Q34 | Add no special masking or warning for credential-bearing source URLs. Raw source data still follows Q26 retention. |
| Q35 | When refresh fails, keep cached matches visible without describing their availability as current. |
| Q36 | Make no malware or infection claim. Present files as TorBox-reported files. |
| Q37 | If a lost create response cannot be reconciled uniquely, keep the outcome unknown and offer a warned manual retry. |
| Q38 | Warn about a duplicate found in an active or recent extension batch, then require explicit confirmation. |
| Q39 | Select every file initially when a ready item has no more than 100 files. Include Unselect all. |
| Q40 | Render clickable links that open a new tab. Omit custom Copy buttons. |
| Q41 | When enabled, send one notification per batch when it becomes ready or needs attention. |
| Q42 | Guarantee a minimum 100-candidate cap, disclose truncation, and benchmark the final cap on Zen. |
| Q43 | Support the latest stable Zen release available when v1 is packaged. |
| Q44 | Use temporary developer installation for now. Defer signing. |

## Facts found during grilling

- TorBox's documented Web Download file model exposes no infection field. V1 makes no file-safety claim.
- A lost create response may be reconcilable by the documented MD5 of the exact submitted URL plus a creation window. Only a unique match is safe to attach.
- The 2026-08-22 public Hoster catalog's regex domains match its `domains` arrays. V1 uses parsed hostname boundaries and normalizes internationalized domains.
- Zen requires the user to grant private-window extension access. Private batches remain session-only after that grant.

