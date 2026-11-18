// Demo family for the recorded demo (team, 18/11): Daniel and Emily Johnson are played by pre-recorded
// ElevenLabs lines. This file only decides which line answers what Sherpy just said. No DOM, no audio.
// The story: they disagree on the main goal (college vs retirement) and on risk (growth vs moderate);
// Sherpy mediates both. Answers match the Johnsons' persona (Daniel growth, Emily moderate).

export const LINES = [
  { id: 'present', who: 'Daniel', text: "Hi Sherpy! It's both of us here, Daniel and Emily." },
  { id: 'goal-daniel', who: 'Daniel', text: "Daniel here. For me it's college. Oliver starts in just a few years, and I want that covered." },
  { id: 'goal-emily', who: 'Emily', text: "And this is Emily. Honestly, I'd put retirement first. We aren't saving anything for it right now." },
  { id: 'goal-agree', who: 'Emily', text: "Okay, Daniel, you're right, the kids come first. Let's put college first, and keep retirement right behind it." },
  { id: 'worry', who: 'Daniel', text: "This is Daniel. What worries us most is protecting the family if something happens to one of us." },
  { id: 'risk-daniel', who: 'Daniel', text: "Daniel here. I'd buy more. If prices drop, that's a discount." },
  { id: 'risk-emily', who: 'Emily', text: "Emily here. I wouldn't sell, but I'd wait it out. And honestly, I'd be pretty nervous." },
  { id: 'risk-agree', who: 'Emily', text: "Daniel, I can live with staying invested, as long as we don't take big bets with the kids' money." },
  { id: 'style-daniel', who: 'Daniel', text: "Daniel here. Give me the numbers." },
  { id: 'style-emily', who: 'Emily', text: "Emily here. Tell me what it means for our family." },
  { id: 'detail', who: 'Emily', text: "This is Emily. The key numbers are enough for us." },
  { id: 'yes-daniel', who: 'Daniel', text: "Yes, that's right." },
  { id: 'yes-emily', who: 'Emily', text: 'Yes, exactly.' },
  { id: 'thanks', who: 'Emily', text: 'Thank you, Sherpy!' },
  // Missions screen, "Ask Sherpy" bubble.
  { id: 'ask-mission', who: 'Emily', text: "What's the second step of this mission?" },
];

const has = (s, re) => re.test(s);

// The last question Sherpy asked decides the answer; state keeps the story moving (each disagreement once).
export function createFamilyScript() {
  const said = new Set();
  let lastGeneric = false;
  let lastQ = '';
  let lastAnswer = null;
  // Story order, used when Sherpy didn't understand a generic answer: say the next line not said yet.
  const STORY = ['present', 'goal-daniel', 'goal-emily', 'goal-agree', 'worry', 'risk-daniel', 'risk-emily', 'risk-agree', 'style-daniel', 'style-emily', 'detail'];
  // Topics in Sherpy's agenda. The story never goes back: once Sherpy moves to a later topic, earlier ones are closed
  // (18/11 take: Sherpy saved "college" for both right after Daniel, and the family kept going back to the goal).
  const GROUP = { present: 0, 'goal-daniel': 1, 'goal-emily': 1, 'goal-agree': 1, worry: 2, 'risk-daniel': 3, 'risk-emily': 3, 'risk-agree': 3, 'style-daniel': 4, 'style-emily': 4, detail: 5 };
  const nextUnsaid = (except) => STORY.find((id) => !said.has(id) && id !== except) ?? null;
  const once = (id) => {
    // Never the same story line twice: if the rule picks one already said, move on to the next one not said.
    if (said.has(id) && id in GROUP) id = nextUnsaid(id) ?? (id.endsWith('emily') ? 'yes-emily' : 'yes-daniel');
    said.add(id);
    if (id in GROUP) for (const [k, g] of Object.entries(GROUP)) if (g < GROUP[id]) said.add(k);
    lastGeneric = false;
    return id;
  };
  return {
    said: () => [...said],
    reply(sherpyText) {
      const all = String(sherpyText ?? '');
      // Answer what Sherpy asks: every question of the turn (it often acknowledges first, then asks, sometimes
      // in two questions: "What is your main goal right now? Is it retirement, or college?").
      const sentences = all.split(/(?<=[.!?])\s+/);
      const asks = sentences.filter((x) => x.includes('?'));
      const q = (asks.length ? asks.join(' ') : sentences.pop() ?? '').toLowerCase();
      const s = all.toLowerCase();
      const to = /\bemily\b/.test(q) && !/\bdaniel\b/.test(q) ? 'Emily' : /\bdaniel\b/.test(q) && !/\bemily\b/.test(q) ? 'Daniel' : null;
      // Sherpy asking exactly the same question again means our last answer did not land: move the story on.
      const repeated = q && q === lastQ && lastAnswer;
      lastQ = q;
      const pick = (id) => { lastAnswer = id; return id; };
      if (repeated) { const n = nextUnsaid(lastAnswer); if (n) return pick(once(n)); }
      return pick(this.choose(q, s, to));
    },
    choose(q, s, to) {

      if (has(s, /video now|putting together your video/)) return null; // the closing line: nothing to answer
      if (!said.has('present') && has(q, /who (do i|am i)|pleasure|speaking with|talking (to|with)|first names?|your names?|introduce|who('s| is)? (here|joining|with)|joining (us|me|today)|both (of you )?here/)) return once('present');
      const bothRisk = said.has('risk-daniel') && said.has('risk-emily');
      // Mediation after both answered ("What feels at stake for each of you regarding market drops?").
      if (bothRisk && !said.has('risk-agree') && !said.has('style-daniel')
        && has(q, /comfortable|at stake|feel|together|middle|both|each of you|work for|balance|matter/)) return once('risk-agree');
      if (!bothRisk && has(q, /20 ?%|twenty percent|drop|f[ae]ll|sell|buy more|markets? (went|go) down/)) {
        const who = to ?? (said.has('risk-daniel') ? 'Emily' : 'Daniel');
        return once(who === 'Emily' ? 'risk-emily' : 'risk-daniel');
      }
      if (said.has('risk-daniel') && said.has('risk-emily') && !said.has('risk-agree') && !said.has('style-daniel')
        && has(q, /comfortable|at stake|feel|together|middle|both|work for|balance|matter/)) return once('risk-agree');
      // Detail before style: "the big picture, the key numbers, or everything?" also says "numbers".
      if (has(q, /detail|big picture|key numbers|everything/)) return once('detail');
      if (has(q, /numbers|what it means for (your|the)|how do you (like|prefer)|prefer to hear|like to hear/)) {
        const who = to ?? (said.has('style-daniel') ? 'Emily' : 'Daniel');
        return once(who === 'Emily' ? 'style-emily' : 'style-daniel');
      }
      if (has(q, /worr|keeps? you up|concern|stress|nervous about/)) return once('worry');
      if (has(q, /goal|most important|matters most|priorit|focus on|comes first|first for|retirement.*college|college.*retirement/)) {
        if (!said.has('goal-daniel') && to !== 'Emily') return once('goal-daniel');
        if (!said.has('goal-emily')) return once('goal-emily');
        if (!said.has('goal-agree')) return once('goal-agree');
      }
      if (said.has('goal-daniel') && said.has('goal-emily') && !said.has('goal-agree')
        && has(q, /both|together|feel|why|matter|work for|middle|balance|agree/)) return once('goal-agree');
      if (has(q, /anything else|any questions/)) return once('thanks');
      // A generic answer that didn't land ("Sorry, I didn't catch that"): move the story on instead of repeating it.
      if (lastGeneric && has(s, /didn'?t (quite )?(catch|understand|get)|could you (please )?(repeat|say that)|say that again/)) {
        const next = STORY.find((id) => !said.has(id));
        if (next) return once(next);
      }
      lastGeneric = true;
      return to === 'Emily' ? 'yes-emily' : 'yes-daniel'; // a confirmation ("So college first, right?")
    },
  };
}
