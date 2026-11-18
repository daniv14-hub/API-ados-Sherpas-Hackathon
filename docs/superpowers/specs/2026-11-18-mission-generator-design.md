# Mission generator v2 — design (PROPOSAL, waiting for team approval)

Date 18/11. Asked by Dani after the Samantha demo: generated missions (Samantha, Carter, Weah) are 3 generic
missions × 3 steps with a Done button; the Johnson hand-written ones are what we want. Goal: a generator that
builds Johnson-quality missions for **any** case, including a future real user. The demo keeps the hand-written
Johnson file (it overrides the generator).

## Facts checked (18/11, all 4 cases)
- The 3 advice sources exist in every case with the same fields: S1 `FH: narrative.summary_recommendations`,
  S2 `IA: narrative.recommendations_main` + `recommendations_scenarios` + `analysis.summary.assetAllocation`,
  S3 `FH: narrative.*_what_to_look_into` + `IA: narrative.portfolio_today_also_meaningful`. 19–20 items per case.
- `score.top_moves`: 3 in every case. `score.combined_moves`: Johnson 4, Weah 4, **Samantha 0, Carter 0**.
- The current generator already reads S1–S3 (`listAdvice`); it fails at structuring: missions only from
  top_moves, keyword match on move titles, one fixed 3-step template, no facts, no interactive blocks.
- A first-keyword classification (scratch trial) puts most items in the right topic, but misses: shared
  cash-flow decisions ("compete for the same cash flow"), HSA lines mentioning other items, past-market lines.

## Decision taken by the team (Dani, 18/11)
Like the Johnsons: **every topic of the catalogue present in the case is its own mission, with or without score.**

## How it works (pipeline)
1. **Collect.** Advice items from S1–S3 (`listAdvice`, unchanged) + facts from the case JSON (reuse the video's
   `buildFacts` and add per-topic extractors; every fact keeps its JSON path `src`).
2. **Classify each advice item into one topic** (catalogue below). See open question Q1 for the method.
3. **Decide the missions.** A topic becomes a mission if it has at least one advice item **or** a top_move.
   Items that are only about past market behaviour join the investment mission's learn step. Anything that
   fits no topic goes to "More advice from your plan" (and to Sherpy). Nothing is dropped.
4. **Fill a mission template per topic** (below): title, facts that exist in this case, steps with interactive
   blocks (same block kinds as the Johnson file: bars, fields, checklist, email, rank, agree, choice, agreed,
   recall). Template wording is fixed English written by us; **no numbers in template text**, numbers only
   through facts. The learn step quotes the plan's own advice text for that topic ("What your plan says").
5. **Score** only by exact lookup (D6): a mission linked to a top_move shows its own before→after; combined
   scores only from `combined_moves` (none for Samantha/Carter, so none shown there).
6. **People (R7).** From the persona/household: one adult → "you"; couple → individual topics per person
   (life cover, own retirement account), shared topics together.
7. **Order.** Protection first, then the shared cash-flow decision, then cash, retirement, debt, college,
   investing; the family's main goal and worry from the conversation move their topic forward (existing
   `orderMissions`).
8. **Hand-written file wins.** If `data/missions/<case>.json` exists (Johnson), it is used as is.

## Topic catalogue and templates (data-driven variants)
| Topic | Mission when | Variants chosen from data | Interactive steps |
|---|---|---|---|
| Life (and disability) cover | advice or life shortfall | shortfall per person / already in range (Samantha: "keep in place") | bars cover vs range per person; fields: current policy; checklist: quote inside own range; fields: what you applied for |
| Umbrella / property | advice or umbrella/coverage-gap move | umbrella missing / homeowners-auto gap (Samantha) | bars what a claim could reach; fields: current policies and limits; checklist: ask for quote at plan amount |
| Shared cash-flow decision | items that weigh priorities against one cash flow | free cash flow positive / **negative (Samantha, Carter: "yearly shortfall", no total shown against it)** | rank needs (each person); agree order + optional amounts |
| Cash reserve / near-term cash | cash advice | below target / **surplus above target (Weah)** / near-term purchase (Carter home 2027) | bars cash vs target; agreed amount; fields: transfer set up |
| Retirement | retirement advice or move | saving nothing / **withdrawal-rate move (Carter)** / workplace plan unknown (Samantha) | bars today vs limit or gap; HR/plan email when the plan says something is unconfirmed; agreed amount; fields: contribution set |
| Tax-advantaged accounts (HSA, IRA, Roth) | tax advice | own mission if ≥2 items, else a step in Retirement | checklist of accounts the plan names; email question "does my health plan qualify for an HSA" |
| High-rate debt | debt advice | payment vs balance / pay from surplus cash (Weah) | bars interest part of payment; choice keep vs pay more |
| College | college advice | 529 empty / gap per child and start year | bars saved vs gap; agreed amount; fields: contribution |
| Investment mix / risk | invest advice or allocation/concentration move | mix vs target / concentration (Samantha VTI, Carter) / risk talk for couples | bars mix vs target; past-market notes as read-only; checklist to bring to the advisor review |

## Standard enforced by tests (all cases, plus a stripped fake case with fields missing)
- Every advice item is in a mission step or in "More advice" (coverage), and nothing is listed twice.
- Every fact value equals the JSON at its `src`.
- Every non-learn step has at least one interactive block; "I did it" waits for it.
- No digits in template wording; scores only from top_moves/combined_moves.
- Missing or empty fields never throw and never produce a figure: that fact/block/topic is skipped.

## Open questions for the team
- **Q1 — How to classify advice into topics.**
  A) Keyword rules + small per-topic phrase lists (deterministic, free, testable; may misfile odd wording, the
  coverage test shows it). B) gpt-5-mini picks one topic per item from the fixed list, cached per case
  (handles any wording for real users; it only picks a label, never writes numbers or text; costs cents).
  C) Rules first, model only for items the rules can't place. **Recommendation: C.**
- **Q2 — Time.** Estimated 3–4 h of work. Delivery is tonight 23:59 and the demo video + one-pager are still
  pending. Build now, or after the delivery?
