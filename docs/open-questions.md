# Open questions — agenda for the next joint session

Nothing here is decided. Claude Code: never resolve these yourself; propose options if asked.
When the team decides one, the desktop Claude moves it to `decisions.md` and deletes it here.
Format: `ID · question` — context — options — who raised it, when.

## Product (decide together)
- **Q-MASCOT · What is the mascot?** Character, name, look (on-brand), how it's animated. **To be decided in the next Claude Code session with the team** (Dani, 15/11).
- **Q-CONFIRM · How does the game know a real-world action is done?** Self-declared ("I did it") is enough for an
  MVP, but it has to be said explicitly. Raised 13/11.
- **Q-EXPERT · How do we serve experts?** The rubric asks if it works "for someone new to finance and for an
  expert". We ruled out an expert dashboard. Options: the agent detects expertise and the video uses more figures ·
  they can ask the mascot for details · both. Raised 13/11, unanswered.
- **Q-PROGRESS · What does the progress bar measure?** Options: A) the Sherpas score (only combinations the plan gives, D6) · B) share of steps completed · C) both (bar = steps, score shown at checkpoints).
- **Q-DEMO-SCRIPT · Which one or two details do the Johnsons disagree on in the demo (D13)?**

## Technical (spike gives data, team decides)
- **Q-VOICE · Can the voice model save profile fields via function calling while it talks?** A) yes, tool calls
  during the conversation · B) fallback: send each turn's transcript to `gpt-5-mini` to extract fields. Which model
  (`gpt-live-1` is $0.05/min but another protocol; `gpt-realtime-2.1-mini` uses the OpenAI Realtime protocol)?
  Answered by the voice spike (task 4). Blocks D4.

## To ask Sherpas / organisers
- **Q-SAMANTHA · Samantha has `averagePerformance: 0`** while the others are ~7.6 %. Data error? Ask in `#dudas-reto-mcp`.
- **Q-IP · Can we show the repo publicly in a LinkedIn post / portfolio?** The rules say hackathon code becomes
  Sherpas' property (the repo must still be public for the delivery).

## Logistics
- **Q-CALL · When is the next joint call?**
