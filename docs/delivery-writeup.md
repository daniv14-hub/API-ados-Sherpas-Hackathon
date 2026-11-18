# Sherpy — bring the plan to life (team APIñados) — DRAFT for the team to review

**The problem.** A family gets a thorough Sherpas financial plan, and nobody reads it. Ten recommendations and a
score do not tell them what to do on Monday morning.

**What we built.** A mobile-first journey, led by Sherpy, a friendly Sherpas advisor mascot, in three steps:

1. **A voice conversation, not a form.** Sherpy breaks the ice like a good advisor on a call and learns what the plan
   cannot know: their main goal, their biggest worry, how much risk each partner accepts, whether they prefer numbers
   or what it means for the family, and how much detail they want. When a couple disagrees (college or retirement
   first? sell or hold in a crash?), Sherpy mediates instead of picking a side, then saves only what they confirm.
2. **A personal explainer video, built while they talk.** About two minutes, ready seconds after the call ends.
   It tells their plan as a story: the life their goals give them, the honest truth of where they stand today, and
   the steps that close the gap. Wording adapts to each profile (numbers first or meaning first, more or less detail).
3. **A mission path.** Every recommendation in the plan becomes a mission on a game-like path, split into small,
   guided steps: see your own figures, write down what you have today, rank priorities together, send a ready-made
   email to HR, tick what you did. Each finished mission is a checkpoint where the Sherpas score moves (only by the
   plan's own numbers). Sherpy is always one tap away in a voice bubble and knows the mission they are looking at.

**Why it works.**
- It is about *them*: their names, their kids' college years, their own disagreements, in their preferred style.
- It moves them to act: one small step at a time instead of a document, with the next step always clear.
- It stays honest: **every figure comes from the family's Sherpas plan.** The language model writes wording only;
  numbers enter through placeholders filled from the data and are checked before anything is shown or spoken.
  When the plan does not know something (an insurance price, an employer match), we say so.
- It works for any family: missions are generated from the plan's three advice sources (web recommendations, report
  recommendations, "we should look into" notes) with tests that enforce the standard on every case.

**What we considered and dropped.** A classic questionnaire (friction, people drop out); a menu of explanation styles
(choice paralysis); an interactive dashboard (it still has to be read, and Sherpas already has one); a generic
finance video (not personal, does not hook); a video per step (slower and costlier than game levels); a leaderboard
between families (money data is too sensitive).

**How it is built.** Node 22, plain HTML/CSS/JS (no framework). Voice: Gemini realtime through the hackathon proxy,
relayed by our backend so keys never reach the browser. Video: GPT-5 mini writes the lines, ElevenLabs narrates,
scenes are animated in the browser in the Sherpas style. Case data from the Sherpas MCP. 227 automated tests.

*Team: Dani, Javi, Nico.*
