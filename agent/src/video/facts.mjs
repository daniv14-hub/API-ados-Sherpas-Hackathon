// Reads the plan JSON and returns plain facts for the video (goals, score, gaps, cash, life cover...).
// Every value is taken from the case file; nothing is projected or recalculated.
import { personaSections } from '../persona.mjs';
import { concernTitle, worryCategory } from '../options.mjs';

// Facts are values read from the case data. Nothing here computes a new number.

export function money(v) {
  if (Math.abs(v) < 1e6) return '$' + Math.round(v).toLocaleString('en-US');
  const m = Number((v / 1e6).toFixed(2));
  return `$${m} million`;
}

// A usable gap is a positive finite number; "Not applicable", missing or 0 is null.
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const gapOrNull = (v) => (num(v) && v > 0 ? v : null);
const year = (iso) => (iso ? new Date(iso).getUTCFullYear() : null);

function buildGoals(fh) {
  const summary = fh.goals.goalsSummary ?? [];
  const amountOf = (type) => num(summary.find((g) => String(g.goalType).toLowerCase() === type)?.amount);
  const goals = [];
  const retirementYears = fh.goals.chartGoals.filter((g) => g.goalType === 'RETIREMENT').map((g) => year(g.date));
  let retirementDone = false;
  for (const g of fh.goals.chartGoals) {
    switch (g.goalType) {
      case 'RETIREMENT':
        if (retirementDone) break; // one retirement goal per household (earliest year)
        retirementDone = true;
        goals.push({ type: 'retirement', label: 'Retirement', year: Math.min(...retirementYears), amount: null });
        break;
      case 'COLLEGE':
        goals.push({ type: 'college', label: g.name, year: year(g.date), amount: null });
        break;
      case 'VACATION': {
        const yearly = /every year/i.test(summary.find((s) => String(s.goalType).toLowerCase() === 'vacation')?.value ?? '');
        goals.push({ type: 'vacation', label: g.name, year: year(g.date), amount: amountOf('vacation'), yearly });
        break;
      }
      case 'PURCHASE': {
        const purchases = summary.filter((s) => String(s.goalType).toLowerCase() === 'purchase');
        const kind = /vehicle/i.test(g.name ?? '') ? 'VEHICLE' : 'REAL_ESTATE';
        const match = purchases.find((s) => String(s.subType ?? '').startsWith(kind)) ?? (purchases.length === 1 ? purchases[0] : null);
        goals.push({ type: 'purchase', label: g.name, year: year(g.date), amount: num(match?.amount) });
        break;
      }
      default:
        break; // BANKRUPTCY markers etc. are not goals
    }
  }
  return goals;
}

function gap(topic, label, have, haveLabel, rawGap, gapLabel) {
  const g = gapOrNull(rawGap);
  if (g === null) return null;
  return { topic, label, have: num(have), haveLabel, gap: g, gapLabel };
}

function buildGaps(fh) {
  const r = fh.key_metrics?.ratios ?? {};
  return {
    retirement: gap('retirement', 'Retirement', null, null, r.retirementSavings?.planningGapAtRetirementAgeInTodaysDollars, 'still missing'),
    protection: gap('protection', 'Life cover', r.lifeInsurance?.clientCoverage, 'in life cover', r.lifeInsurance?.lifeInsuranceCoverageGapsAndExcess?.clientShortfall, 'of cover missing'),
    college: gap('college', 'College', r.educationSavings?.current529AccountsBalance, 'in the 529', r.educationSavings?.totalGAP, 'still missing'),
    debt: gap('debt', 'Card debt', null, null, r.creditCardDebt?.balance, 'on the card'),
    cash: gap('cash', 'Emergency fund', r.emergencyFund?.emergencyFund, 'in the emergency fund', r.emergencyFund?.shortfallToAdjustedMin, 'still missing'),
  };
}

function buildConcerns(personaMd) {
  const section = personaSections(personaMd).find((s) => /^Objective concerns/.test(s.heading));
  const concerns = {};
  for (const line of (section?.text ?? '').split('\n')) {
    const title = concernTitle(line);
    const cat = title && worryCategory(title);
    if (cat && !(cat in concerns)) concerns[cat] = title;
  }
  return concerns;
}

// Emergency months come as strings ("1", "+12"); only a plain number is usable.
const monthsOrNull = (v) => (typeof v === 'number' ? num(v) : /^\d+(\.\d+)?$/.test(String(v ?? '').trim()) ? Number(v) : null);

function buildCash(fh) {
  const ef = fh.key_metrics?.ratios?.emergencyFund;
  if (!ef) return null;
  return { have: num(ef.emergencyFund), months: monthsOrNull(ef.emergencyFundMonths), minMonths: num(ef.minRecommendedEFMonths), maxMonths: num(ef.maxRecommendedEFMonths) };
}

// One entry per adult whose life cover falls short (cover and shortfall as the case states them).
function buildProtection(fh, adults) {
  const li = fh.key_metrics?.ratios?.lifeInsurance;
  if (!li) return [];
  const gaps = li.lifeInsuranceCoverageGapsAndExcess ?? {};
  const rows = [
    { person: adults.find((p) => p.role === 'client'), cover: li.clientCoverage, shortfall: gaps.clientShortfall },
    { person: adults.find((p) => p.role === 'co-client'), cover: li.coClientCoverage, shortfall: gaps.coClientShortfall },
  ];
  return rows
    .filter((r) => r.person && gapOrNull(r.shortfall) !== null)
    .map((r) => ({ name: r.person.first_name, cover: num(r.cover), shortfall: r.shortfall }));
}

// True when the household has retirement accounts and none of them receives contributions.
function buildNoRetirementSaving(fh) {
  const accounts = (fh.profile?.accounts ?? []).filter((a) => /401\(?k\)?|\bIRA\b/i.test(a.name ?? ''));
  return accounts.length > 0 && accounts.every((a) => a.yearly_contribution_total === 0);
}

export function buildFacts(fh, personaMd) {
  const adults = fh.case.household.filter((p) => p.role === 'client' || p.role === 'co-client');
  const people = adults.map((p) => p.first_name);
  const retirementYears = fh.goals.chartGoals.filter((g) => g.goalType === 'RETIREMENT').map((g) => year(g.date));
  const ages = Object.fromEntries(adults.filter((p) => num(p.retirement_age) !== null).map((p) => [p.first_name, p.retirement_age]));

  const s = fh.score;
  const pillars = s.pillars.map((p) => ({ name: p.pillar, points: p.points_shown_in_app, score: p.score }));
  const lowest = pillars.reduce((a, b) => (b.score < a.score ? b : a));
  const moves = (s.top_moves ?? []).map((m) => ({ title: m.title, before: m.score_before, after: m.score_after }));
  const best = (s.combined_moves ?? []).reduce((a, b) => (!a || b.score_after > a.score_after ? b : a), null);

  return {
    people,
    goals: buildGoals(fh),
    score: { value: s.published_score, band: s.band, colour: s.colour, pillars, weakest: { name: lowest.name, points: lowest.points } },
    gaps: buildGaps(fh),
    moves,
    combined: best ? { moves: best.moves, after: best.score_after } : null,
    firstMission: moves[0]?.title ?? null,
    concerns: buildConcerns(personaMd),
    retirement: { year: retirementYears.length ? Math.min(...retirementYears) : null, ages },
    freeCashFlow: num(fh.key_metrics?.cashflowStatement?.freeCashflow?.total),
    cash: buildCash(fh),
    protection: buildProtection(fh, adults),
    noRetirementSaving: buildNoRetirementSaving(fh),
    retirementExtra: num(fh.key_metrics?.ratios?.retirementSavings?.requiredExtraSavings),
  };
}
