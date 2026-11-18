# Handoff — Mission content (Pillar 3)

**From:** desktop Claude session with the team, Tue 17/11/2026, 20:15–21:30 (Europe/Madrid).
**For:** Claude Code, to build tonight. Read this after `docs/STATUS.md` and `docs/decisions.md`.
**Scope:** only **what the missions are and how they are distributed** (content). Nothing here is about screens,
visuals, map, rewards or animation. Design is still open and needs the team (D7).

> An earlier file from the same session, `docs/game-design-proposal.md` (+ `prototype/`, + a 3-mission
> `agent/data/missions/daniel-emily-johnson.json`), is a **design proposal the team has NOT approved**. Do not build UI
> from it. Its 3-mission JSON is **superseded** by §5 of this file (it also said "term life", which is our advice,
> not the plan's; see rule R4).

---

## 1. What the team decided tonight (log these in `decisions.md`, status DECIDED, "team via desktop session 17/11")

1. **A mission = one piece of the plan's advice turned into real-world action**, split into small steps.
2. **Nothing from the plan's advice is cut.** The missions must cover **everything** the family sees as advice in
   Sherpas, just more guided and easier. Every advice item must map to at least one step (coverage, §6).
3. **The advice comes from 3 sources, joined** (§2). They exist for **every** case, not only the Johnsons.
4. **Missions that don't move the Sherpas score are included** (e.g. cash reserve, credit card). They show their real
   effect from the plan instead of score points.
5. **Each action step comes with a "kit"**: the practical help that brings the real-world action down to ~10 minutes
   (what to have at hand, who to contact, a ready-to-send message). Kits never add financial advice the plan doesn't give.

## 2. The 3 advice sources (all from the Sherpas MCP data; same fields in all 4 cases, checked 17/11)

Notation in this file: `FH:` = `cases/<id>/financial-health.json`, `IA:` = `cases/<id>/investment-analysis.json`.

| # | Where the family sees it | Field | Johnson count |
|---|--------------------------|-------|---------------|
| S1 | Sherpas web app, "Recommendations" box | `FH: narrative.summary_recommendations` | 5 bullets |
| S2 | PDF report, "What we're recommending" page | `IA: narrative.recommendations_main` (text, same as the PDF) + `IA: analysis.summary.assetAllocation` (current vs target mix chart) + `IA: narrative.recommendations_scenarios` (how each mix behaved in past markets) | 6 bullets + chart |
| S3 | "We should look into" line at the end of each area, + the investment "also meaningful" note | `FH: narrative.{retirement,assets,debt,savings}_what_to_look_into` + `IA: narrative.portfolio_today_also_meaningful` | 4 lines + HSA note |

Score effects (for missions that have them): `FH: score.top_moves[]` and `FH: score.combined_moves[]`.
The PDF itself is not needed: S2's text and chart are in `IA:`. Samantha has no PDF but has all fields.

## 3. Content rules

- **R1 — No invented figures.** Every number comes from `FH:`/`IA:` with its path, or is typed by the family
  themselves (e.g. the amount they agree to save). The family's own numbers are labelled as theirs.
  Dollar values are shown rounded to the whole dollar, as the plan's own text does (JSON `15032.01` → $15,032);
  tests compare after the same rounding. A `src` with `{a,b}` or `[0..1]` names several fields.
- **R2 — Score only by exact lookup (D6).** One move done → its `top_moves[].score_after`; two or more → the
  `combined_moves[]` entry whose `moves` set **equals** the done set; no exact match → no score. Never add or average.
- **R3 — Missions without a top_move show no score**, only the plan's own facts for that topic.
- **R4 — Kits are how-to, not advice.** They can say what to ask, what to have at hand, where to look. They must not
  pick a product or amount the plan doesn't (e.g. don't say "term life"; the plan only says "life cover").
- **R5 — Where the plan says something is unknown, the step says so** (e.g. "the plan has no price for umbrella cover").
- **R6 — "No action now" items are not missions** but are still shown, as "keep in view" (§5.9). Not cut.
- **R7 — Couples (D2):** individual matters (own life cover, own 401(k)) are done by each person; joint matters
  (shared money, joint policies) together. Single-person cases (Carter, Samantha): every step is theirs.

## 4. General model (works for any case)

**Step types inside a mission** (content structure, every mission uses some of them in this order):
1. **Learn** — the plan's facts for this topic: what they have vs what the plan recommends.
2. **Prepare** — gather what the action needs (find current policies, confirm data the plan is missing).
3. **Decide** — only for money choices; the family decides, the plan's facts are put in front of them.
4. **Act / Close** — the real-world commitment (apply, sign, set up a transfer or deferral).

**Topic catalogue** → one mission per topic that appears in the case's sources:

| Topic | Typical advice wording | Seen in |
|-------|-----------------------|---------|
| Life (and disability) cover | "review life cover", "keep life, disability… in place" | Johnson, Weah, Carter, Samantha |
| Umbrella / property cover | "add umbrella", "close the umbrella and property gap" | all 4 |
| Shared cash-flow decision | "talk through how X compete for the same cash flow", "decide how college should share your cash flow" | Johnson, Weah, Carter, Samantha |
| Retirement saving | 401(k), match, IRA/Roth, "confirm whether a workplace plan is available" | all 4 |
| Tax-advantaged accounts (HSA, IRA) | "use your HSA limits", "an HSA if your plan qualifies" | all 4 (own mission or step in Retirement, by how the case words it) |
| Cash reserve / near-term cash | "build your cash reserve", "January 2027 home purchase", "surplus cash above your reserve" | all 4 |
| High-rate debt | "24.9% / 18% / 20% card" | Johnson, Weah, Carter |
| College | "529 funding", "plan for college within your cash" | Johnson, Weah, Samantha |
| Investment mix / risk | "target mix", "revisit your invested mix", "spread concentrated exposures", "tax cost" | all 4 |
| Keep in view (no action) | "keep income dependence in view", "no action now" | Johnson, others to check |

**Distribution (order):**
1. If the plan states an order ("Start by strengthening your protection"), those missions go first, in that order.
2. Then the **shared cash-flow decision** mission (or personal decision, for single-person cases).
3. The missions that compete for the same money go **in the order the family chose** in that decision.
   If they didn't choose: the order they appear in S1.
4. Missions that don't draw on cash flow (investment mix) go last by default.
5. "Keep in view" items close the path.

**Deriving missions for a new case:** list every item from S1–S3 → assign each to a topic → one mission per topic →
attach the top_move whose title matches the topic (if any) → order by the rules above → check coverage (every item
mapped). For tonight only the Johnsons are hand-written; for the other cases only the item listing is automated (§7).

## 5. The Johnsons (`daniel-emily-johnson`) — 8 missions, 26 steps

Base score 52 (`FH: score.published_score`). Score path in the default order: 52 → 57 (M1) → 60 (M2) → 60 (M4).

### M1 · Protect the family — life cover · effort low · **score 52 → 57** (`FH: score.top_moves[0]`, "Raise mortality coverage")
Individual (each). Covers S1-1, S2-1.

| Fact | Value | Source |
|------|-------|--------|
| Daniel's life cover today (whole life) | 250000 | `FH: key_metrics.ratios.lifeInsurance.clientCoverage` |
| Recommended for Daniel, from | 1600000 | `FH: key_metrics.ratios.lifeInsurance.recommendedClientMinCoverage` |
| Recommended for Daniel, to | 2400000 | `FH: key_metrics.ratios.lifeInsurance.recommendedClientMaxCoverage` |
| Emily's life cover today (whole life) | 200000 | `FH: key_metrics.ratios.lifeInsurance.coClientCoverage` |
| Recommended for Emily, from | 1200000 | `FH: key_metrics.ratios.lifeInsurance.recommendedCoClientMinCoverage` |
| Recommended for Emily, to | 1800000 | `FH: key_metrics.ratios.lifeInsurance.recommendedCoClientMaxCoverage` |
| Household cover after the plan's move | 1616000 | `FH: score.top_moves[0].target_amount` |
| Daniel's income at risk | 160000 | `FH: key_metrics.ratios.lifeInsurance.clientEarnedIncome` |
| Emily's income at risk | 120000 | `FH: key_metrics.ratios.lifeInsurance.coClientEarnedIncome` |

Steps:
1. **Learn** (together) — each person's cover vs their recommended range; if one income stopped, the other carries
   the household. Do **not** split the household move ($1,166,000) between them: show each one's own range.
2. **Prepare** (each) — find your current policy. *Kit:* where to find it (insurer letter, HR benefits portal), what to
   note (insurer, amount, type).
3. **Act** (each) — ask for a quote inside your recommended range. *Kit:* what an insurer will ask (age, health,
   income, amount, how long you want cover), compare two or three quotes, questions to ask about each.
4. **Close** (each) — choose and apply.

### M2 · Shield what you've built — umbrella cover · effort low · **score → 60 with M1** (`FH: score.combined_moves[0]`; alone 56, `top_moves[1]`)
Joint. Covers S1-1, S2-2, and the umbrella observation on home/auto.

| Fact | Value | Source |
|------|-------|--------|
| Recommended umbrella cover (they have none) | 1000000 | `FH: key_metrics.ratios.umbrella.recommendedCoverage` |
| Home and car a claim could reach | 785000 | `FH: key_metrics.protection.umbrellaInsurance.assetExposed.assetExposedSummary[3][2]` |
| Cash and investments a claim could reach | 344000 | `FH: key_metrics.protection.umbrellaInsurance.assetExposed.totalLiquidAssets` |
| Price of umbrella cover | not in the plan | `FH: narrative.protection_umbrella_short_observations` |

Steps:
1. **Learn** — what a large claim could reach; recommended cover.
2. **Prepare** — find your home and auto policies. The plan has them flagged as not insured, maybe just missing
   detail; an umbrella sits on top of them. *Kit:* where to find them, what to note (insurer, liability limits).
3. **Act** — ask for an umbrella quote. *Kit:* usually the same insurer as home/auto; what they'll ask. The plan has no
   price, so this quote is the first real number.
4. **Close** — sign.

### M3 · Decide together where your $15,032 goes — shared cash-flow decision · no score
Joint, each first gives their own view. Covers S1-5, S2-5, S3 retirement and debt ("how the mortgage payment fits").
This decision sets the order of M4–M7.

| Fact | Value | Source |
|------|-------|--------|
| Free cash flow per year | 15032 | `FH: key_metrics.cashflowStatement.freeCashflow.total` |
| Cash reserve gap | 92360 | `FH: key_metrics.ratios.emergencyFund.shortfallToAdjustedMin` |
| Extra retirement saving the plan calls for, per year | 34165 | `FH: key_metrics.ratios.retirementSavings.requiredExtraSavings` |
| Credit card balance | 18000 | `FH: profile.liabilities[0].balance` |
| Extra college saving needed in the first year | 1927.57 | `FH: key_metrics.facts.education.extraYearlySaving.value` |
| Mortgage payment per month | 4100 | `FH: profile.liabilities[2].monthly_payment` |

Steps:
1. **Learn** — the four needs that draw on the same money; the plan says the data does not settle which comes first
   (`FH: narrative.debt_short_observations`), so it's their choice.
2. **Decide** (each) — each person puts the four in their own order. *Demo note (D13):* this is where Daniel (Growth)
   and Emily (Moderate) can differ.
3. **Decide** (together) — agree one order, and optionally how much of the $15,032 goes to each (their numbers,
   labelled as theirs). *Kit:* the plan's facts side by side; the plan's own advice to take small steps.

### M4 · Start paying your future selves — retirement saving · effort medium · **score stays 60** (`FH: score.combined_moves[2]`, all three moves; alone 55, `top_moves[2]`)
Mixed: HR and deferral are each; amount comes from M3. Covers S1-3, S2-4, S3 retirement/assets/savings, HSA note.

| Fact | Value | Source |
|------|-------|--------|
| Going into their 401(k)s today | 0 | `FH: narrative.summary_recommendations` ("currently $0") |
| Each can contribute per year | 24500 | `FH: key_metrics.assetsAndInvestments.contributions.employerPlanContributions[1][1]` |
| Extra saving the plan calls for, per year | 34165 | `FH: key_metrics.ratios.retirementSavings.requiredExtraSavings` |
| Retirement gap (today's dollars) | 1427456 | `FH: key_metrics.ratios.retirementSavings.planningGapAtRetirementAgeInTodaysDollars` |
| Tax it could save per year if both contribute in full | 11760 | `IA: key_metrics.savingsAndContributions.taxOpportunityCheck.annualTaxSavingsByBucket[3][5]` |
| Employer match | none recorded (the plan estimates $6,400 / $4,800, unconfirmed) | `FH: key_metrics.assetsAndInvestments.matchGapAnalysis[0..1].matchPolicyConfigured` + `IA: narrative.portfolio_today_verdict` |
| HSA: max per year, if eligible | 8750 | `FH: key_metrics.assetsAndInvestments.contributions.hsaContributions.maxContributions` |

Steps:
1. **Learn** — what goes in today, what they could put in, what the plan calls for.
2. **Prepare** (each) — ask HR two things: is there a 401(k) match, and does my health plan allow an HSA.
   *Kit:* a ready-to-send email (below).
3. **Act** (each) — set the 401(k) deferral in the employer portal, with the amount from M3. *Kit:* where it usually is
   (benefits / retirement section), what to have at hand.
4. **Act** (each, only if HR said yes to the HSA) — open/start the HSA. The plan calls it secondary, after the bigger
   priorities (`IA: narrative.portfolio_today_also_meaningful`), so it stays the last step.

*HR email kit (text, English):* "Hi, I'd like to start contributing to my 401(k). Could you tell me (1) whether the
company offers a match and how it works, and (2) whether my health plan is eligible for an HSA? Thanks, {name}."

### M5 · Build your cushion — cash reserve · no score
Joint. Covers S1-2, S2-3, S3 savings.

| Fact | Value | Source |
|------|-------|--------|
| Accessible cash today | 19000 | `FH: key_metrics.facts.cash.accessibleCash.value` |
| Months of essential expenses it covers | 1.4 | `FH: key_metrics.facts.cash.monthsCovered.value` |
| Cash target, from (reserve + near-term goals) | 111360 | `FH: key_metrics.facts.cash.totalCashNeeded.min` |
| Cash target, to | 124717.5 | `FH: key_metrics.facts.cash.totalCashNeeded.max` |
| Gap | 92360 | `FH: key_metrics.ratios.emergencyFund.shortfallToAdjustedMin` |
| Vacation payment included in the target (Jan 2027) | 4500 | `FH: key_metrics.facts.cash.nearTermGoals[0].value` |

Steps:
1. **Learn** — what the cushion is for (a lost paycheck or a big bill without selling investments); today vs target.
   The plan says it will take time and steady progress is the goal.
2. **Act** — set up an automatic monthly transfer to savings with the amount from M3. *Kit:* how, in their bank app.
3. **Close** — first transfer done. Later check-ins: they type their balance; shown against the plan's target.

### M6 · Tame the 24.9% card · no score
Daniel's card (`FH: profile.liabilities[0].owner`), decided together. Covers S1-4, S3 debt.

| Fact | Value | Source |
|------|-------|--------|
| Balance | 18000 | `FH: profile.liabilities[0].balance` |
| Interest rate | 0.249 | `FH: profile.liabilities[0].interest_rate` |
| Monthly payment | 450 | `FH: profile.liabilities[0].monthly_payment` |
| Part of each payment that is interest, at today's balance | 373.5 | `FH: key_metrics.ratios.creditCardDebt.paymentsEqualToInterest` |
| Paid off at the current payment | 2034-01 | `FH: key_metrics.ratios.creditCardDebt.ccPayoffDate` |

Steps:
1. **Learn** — costliest debt; how much of each payment is interest; payoff date at today's payment.
2. **Decide** (together) — whether a higher monthly payment fits, from M3. No new payoff date is computed (R1).
3. **Act** (Daniel) — change the autopay amount. *Kit:* where in the card's app.

### M7 · College for Oliver and Sophia — 529 · no score
Emily's 529 (`FH: profile.accounts[4].owner`), decided together. Covers S3 assets ("529 yearly funding vs its target").

| Fact | Value | Source |
|------|-------|--------|
| 529 balance | 30000 | `FH: profile.accounts[4].balance` |
| Going in per year | 8000 | `FH: profile.accounts[4].yearly_contribution_total` |
| Cost per child | 60000 | `FH: key_metrics.facts.education.totalCostPerGoal[0].value` |
| College funding gap | 106552 | `FH: key_metrics.facts.education.fundingGap.value` |
| Extra saving needed in the first year (rises each year) | 1927.57 | `FH: key_metrics.facts.education.extraYearlySaving.value` |
| Oliver starts / Sophia starts | 2033-08 / 2035-08 | `FH: goals.chartGoals[1].date` / `[2].date` |

Steps:
1. **Learn** — what's saved, what goes in, the gap, when each child starts.
2. **Act** (Emily) — adjust the 529 contribution with the amount from M3. *Kit:* where in the 529 portal.

### M8 · Invest toward your target mix · no score
Individual (Daniel's 401(k) is the account off its profile). Covers S2 chart + scenarios.

| Fact | Value | Source |
|------|-------|--------|
| Household stocks today | 0.5435 | `IA: analysis.summary.assetAllocation.currentEF.equity` |
| Household stocks, plan's target | 0.663 | `IA: analysis.summary.assetAllocation.targetEF.equity` |
| Daniel's 401(k): profile Growth, currently closest to Moderate (1 step off) | Active | `IA: key_metrics.allocationBenchmarkAnalysis.accounts[2].allocationSeverity` |
| Emily's 401(k): on target | None | `IA: key_metrics.allocationBenchmarkAnalysis.accounts[3].allocationSeverity` |

Steps:
1. **Learn** — today's mix vs target; how both behaved in past markets (`IA: narrative.recommendations_scenarios`;
   past results, not a promise).
2. **Prepare** (Daniel) — the report frames this as a proposal to review with their advisor (PDF disclosures). *Kit:*
   what to bring to that conversation.
3. **Act** (Daniel) — change the fund mix in his 401(k) portal.

### 5.9 Keep in view (not missions, still shown — R6)
- Salaries equal 54.79% of their net worth: the household leans on two paychecks; "keep in view, no action now"
  (`IA: key_metrics.concentrationAndDiversification.employerConcentration[3][2]` = 0.5479; S2-6).
- Long-term care costs are not planned for (`IA: narrative.summary_main`, "One caveat").

Default order if they skip M3's choice: M1, M2, M3, M5, M4, M6, M7, M8 (S1 order: cash before retirement before card).
Total steps: 4 + 4 + 3 + 4 + 3 + 3 + 2 + 3 = 26.

## 6. Coverage — every Johnson advice item → mission

| Source item | Mission / step |
|-------------|----------------|
| S1-1 protection: life for both + umbrella | M1, M2 |
| S1-2 build cash reserve to 8–9 months | M5 |
| S1-3 raise retirement saving + confirm match | M4 steps 2–3 |
| S1-4 24.9% card, higher payment? | M6 |
| S1-5 talk through together how protection, cash, retirement and the 529 compete | M3 |
| S2-1 Protect your income with life cover | M1 |
| S2-2 Add umbrella liability cover | M2 |
| S2-3 Rebuild your cash reserve | M5 |
| S2-4 Build retirement savings in steps (+ match) | M4 |
| S2-5 Use your yearly margin deliberately | M3 |
| S2-6 Keep income dependence in view | §5.9 |
| S2 chart: current vs target mix + scenarios | M8 |
| S3 retirement: retirement vs reserve sharing cash flow; confirm match | M3, M4 step 2 |
| S3 assets: start 401(k) contributions; 529 funding vs target; HSA; match | M4, M7 |
| S3 debt: how the mortgage payment fits; card payoff date | M3 step 1, M6 step 1 |
| S3 savings: emergency cash; more to retirement; confirm match | M5, M4 |
| IA also_meaningful: HSA, secondary, confirm eligibility first | M4 steps 2 and 4 |
| Umbrella observation: confirm home and auto cover | M2 step 2 |

## 7. What to build tonight (content only, no UI)

1. `agent/src/game/advice.mjs` — `listAdvice(caseId)`: returns every item from S1–S3 for any case, each with
   `{source, field, index, text}`. Test on all 4 cases (expect S1 = 5 bullets each; S2 = 6/6/6/5).
2. `agent/data/missions/daniel-emily-johnson.json` — replace the old 3-mission file with §5: missions, steps
   (type, owner, title, body, kit), facts with `src`, `adviceRefs` (which S-items each step covers), order rules.
   Step text has no digits except "401(k)" (R1).
3. `agent/src/game/missions.mjs` — `scoreFor(caseData, doneMoveTitles)` (R2), `orderMissions(missions, choice)` (§4).
4. Tests (`node --test`): every fact value equals the JSON at its `src` (after rounding dollars, R1); every `listAdvice` item for the Johnsons is
   referenced by ≥1 step (coverage, §6); score path 52→57→60→60; Weah {card, life} = 73; Carter 2 moves → null.
5. Log in `devlog.md`; update STATUS "Last Claude Code session". Don't touch design.

## 8. Still open (for the team, not for Claude Code)

- **Life cover figure conflict.** `FH: score.top_moves[0].action` says "Add $1,166,000… to reach $1,616,000";
  `IA: narrative.recommendations_main` says "about $1,616,000 of **added** coverage" (and to confirm it). Proposal:
  use FH (it's the score move) and ask in `#dudas-reto-mcp`.
- **M8 as a mission** (investment mix): proposed yes, last, no score. Team to confirm.
- **Q-CONFIRM** (how a step counts as done), **Q-PROGRESS**, Sherpy's lines, and all design: open.
- Missions for Weah, Carter, Samantha: only the model (§4) and `listAdvice` tonight; hand-written later if time.
