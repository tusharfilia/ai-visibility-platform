# Demo Swagger Walkthrough

This guide walks through testing the self-serve demo workflow entirely from Swagger on the deployed API.

## Prerequisites

- Deployment running with `MOCK_PROVIDERS=false`.
- Provider/API keys configured for the engines you plan to use (`PERPLEXITY_API_KEY`, `BRAVE_API_KEY`, `OPENAI_API_KEY`, etc.).
- Jobs worker deployed and connected to Redis (the `runPrompt` queue must execute).

## Step 1 – Generate the Summary

1. Open Swagger UI at `/v1/docs`.
2. Expand **Demo › POST /v1/demo/summary**.
3. Click *Try it out* and send a payload such as:
   ```json
   {
     "domain": "https://stripe.com"
   }
   ```
4. Copy the returned `demoRunId`. Subsequent steps use this value.

## Step 2 – Build Prompts

1. Expand **Demo › POST /v1/demo/prompts**.
2. Provide the `demoRunId` and one or more seed prompts:
   ```json
   {
     "demoRunId": "<demoRunId-from-summary>",
     "seedPrompts": [
       "Why choose Stripe for online payments?",
       "Stripe vs PayPal fees"
     ]
   }
   ```
3. The response includes the final prompt set that will be run.

## Step 3 – Confirm Competitors

1. Expand **Demo › POST /v1/demo/competitors**.
2. Send the `demoRunId` and (optionally) a curated competitor list:
   ```json
   {
     "demoRunId": "<demoRunId-from-summary>",
     "competitorDomains": ["paypal.com", "adyen.com"]
   }
   ```
3. If you omit `competitorDomains`, the API will auto-suggest competitors via the LLM.

## Step 4 – Run the Analysis

1. Expand **Demo › POST /v1/demo/run**.
2. Supply the `demoRunId` and desired engines (omit `engines` to use the default set):
   ```json
   {
     "demoRunId": "<demoRunId-from-summary>",
     "engines": ["PERPLEXITY", "BRAVE", "OPENAI"]
   }
   ```
3. The endpoint validates provider credentials and enqueues jobs. The response shows how many were queued.

## Step 5 – Track Progress

1. Poll **Demo › GET /v1/demo/status/{demoRunId}** until `status` becomes `analysis_complete` (or `analysis_failed`).
2. Progress fields include `totalJobs`, `completedJobs`, `failedJobs`, `remainingJobs`, and the overall `progress` percentage.

## Step 6 – Review Insights & Recommendations

Once the status is `analysis_complete`:

- **Demo › GET /v1/demo/insights** returns aggregate metrics:
  - Prompt run totals and costs
  - Share-of-voice and sentiment split for the brand vs competitors
  - Engine performance breakdown
  - Top citation domains & narrative highlights

- **Demo › GET /v1/demo/recommendations** returns prioritized actions grouped by category (`visibility`, `sentiment`, `citations`, `execution`, `coverage`). Each recommendation includes suggested next steps.

## (Optional) Clean Up

To remove demo data manually, delete rows referencing the `demoRunId` in these tables:

- `demo_runs`
- `prompts` (where `tags` contains `demo`)
- `prompt_runs`, `answers`, `mentions`, `citations`

Execute the deletes from the SQL console or add a one-off script if desired.

