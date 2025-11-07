# Demo Self-Serve Swagger Workflow – Task Tracker

This checklist mirrors the implementation phases for the new demo workflow so we can track progress explicitly.

## Phase 1 – Scaffolding (✅ Done)
- [x] Add `demo_runs` table migration
- [x] Extend Prisma schema with `DemoRun` model
- [x] Scaffold Demo module (DTOs, service, controller)
- [x] Register Demo module in `AppModule`
- [x] Expose placeholder Swagger endpoints for the flow

## Phase 2 – Domain Intake & AI Summary
- [x] Implement `POST /v1/demo/summary` logic (LLM summary, workspace/demo-run creation)
- [x] Persist user overrides, update status to `summary_ready`
- [x] Document response schema in Swagger

## Phase 3 – Prompt Generation & Confirmation
- [x] Implement `POST /v1/demo/prompts` (LLM prompt expansion + dedupe)
- [x] Persist final prompts in `prompts` table
- [x] Update demo status to `prompts_ready`
- [x] Add Swagger examples for prompt confirmation

## Phase 4 – Competitor Discovery & Confirmation
- [x] Implement `POST /v1/demo/competitors` (run quick searches + parse domains)
- [x] Store confirmed competitor set
- [x] Update demo status to `competitors_ready`
- [x] Document expected payloads/results in Swagger

## Phase 5 – Run Analysis Jobs
- [x] Implement `POST /v1/demo/run` to seed engines and enqueue prompt runs
- [x] Tag queue jobs with `demoRunId`
- [x] Update workers to publish progress into `demo_runs`
- [x] Implement `/v1/demo/status/{demoRunId}` for live progress

## Phase 6 – Insights & Recommendations
- [x] Aggregate visibility metrics for brand vs competitors
- [x] Implement `/v1/demo/insights`
- [x] Implement `/v1/demo/recommendations`
- [x] Surface maturity/visibility tables in responses

## Phase 7 – Polish & Documentation
- [x] Add validation/error handling for step order and missing configs
- [x] Update README/Swagger instructions for end-to-end usage
- [ ] (Optional) Provide cleanup endpoint/script for demo data

