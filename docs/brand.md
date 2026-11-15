# Sherpas brand — what we use and where it came from

Collected by the desktop Claude on 15/11/2026 from official sources only: the client plan app
(`app.sherpaswealth.com/plan/shared/...`, the Johnsons' "Open the plan" link) and the marketing site (`sherpaswealth.com`).
Rule (D9): use these. Don't invent colors, fonts or logos. The mascot is ours to design (Q-MASCOT), on top of this brand.

## Files
- `assets/brand/sherpas-logo.svg` — official wordmark "sherpas" (lowercase), `fill="currentColor"` (copied from the app header).
- `assets/brand/sherpas-logo-dark.svg` (#15161A) and `sherpas-logo-white.svg` (#FFFFFF, as on the dark marketing hero).
- `assets/brand/tokens.css` — colors, fonts, radii as CSS variables. Import it instead of hard-coding values.
- `assets/brand/screenshots/` — the real UI for reference: `app-score-summary.jpg`, `app-recommendations.jpg`,
  `app-projection-chart.jpg` (client app, mobile width), `website-hero.jpg` (marketing site).

## The look in one paragraph
The **client app** (what families already see, so what we must fit into) is light, calm and clean: off-white/light-gray
page (`#f3f3f3`), white cards with a 1px light border (`#e2e5eb`) and ~10px radius, near-black text (`#15161a`),
big **Poppins** semibold headings ("Your Financial Health Score is:", "Summary"), everything else in **Inter**.
The brand accent is a **blue `#4666d7`** (section titles like "Recommendations", chart lines, highlights). The score
hero card has a soft lavender-blue gradient. Status colors: red `#cd3b3b` (score 52, high priority), amber, green.
Charts are smooth area charts with a gray/blue gradient fill. No heavy shadows. The **marketing site** is darker
(navy `#161827` background) with a periwinkle→blue gradient (`#948df7 → #4565d6`) on pill buttons and accent words.

## How it applies to our three parts
- **Mascot conversation and game:** same light app look (cards, Inter/Poppins, brand blue) so it can drop into the app.
  The game can be more playful (motion, rewards, mission cards) but keeps this palette and type, not a new one.
- **Video:** the En Plata / Punto Ciego style (D10) re-skinned: their cream background and orange/red highlights are
  replaced by Sherpas neutrals + brand blue, with red/amber/green only for status. Headings in Poppins.
- **Logo:** the wordmark in the header/intro/outro. Don't alter it (no recoloring outside dark/white/currentColor).

## Not collected / not found
- No standalone icon/symbol mark was found besides the wordmark (the site favicon is
  `https://framerusercontent.com/images/Kh9up4faDYw7WBpuHfhGvbGMhpw.png`, not downloaded).
- No official brand guidelines document. These tokens are what their live product uses.
