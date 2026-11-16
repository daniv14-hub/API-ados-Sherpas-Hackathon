"""Generate the suited yak mascot SVG (proposal v2). Output: SVG markup string via build()."""
import math

def scallop(cx, cy, rx, ry, n, depth, start=0.0, end=2 * math.pi, closed=True, phase=0.0):
    """Ellipse whose edge is made of n outward bumps (fur). Returns path data."""
    pts = []
    for i in range(n + 1):
        a = start + (end - start) * i / n + phase
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for i in range(n):
        a = start + (end - start) * (i + 0.5) / n + phase
        qx = cx + (rx + depth) * math.cos(a)
        qy = cy + (ry + depth) * math.sin(a)
        d += f" Q{qx:.1f},{qy:.1f} {pts[i+1][0]:.1f},{pts[i+1][1]:.1f}"
    return d + ("Z" if closed else "")

def build():
    o = 'stroke="var(--ink)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"'
    mane = scallop(160, 160, 108, 96, 14, 5)
    beard = scallop(160, 228, 62, 34, 9, 13, start=0.15 * math.pi, end=0.85 * math.pi, closed=False)
    fs = 0.02 * math.pi
    fringe = scallop(160, 112, 62, 12, 7, 10, start=fs, end=math.pi - fs, closed=False)
    fringe += f" C100,62 220,62 {160 + 62 * math.cos(fs):.1f},{112 + 12 * math.sin(fs):.1f}Z"
    return f'''
<g class="body-rig">
  <!-- suit -->
  <path {o} fill="var(--suit)" d="M28,372 C32,318 52,288 96,272 L224,272 C268,288 288,318 292,372 Z"/>
  <path {o} fill="var(--shirt)" d="M110,272 L210,272 L160,384 Z"/>
  <path {o} fill="var(--lapel)" d="M94,272 L110,272 L158,380 L130,334 L106,302 L116,292 Z"/>
  <path {o} fill="var(--lapel)" d="M226,272 L210,272 L162,380 L190,334 L214,302 L204,292 Z"/>
  <path {o} fill="var(--tie)" d="M150,278 L170,278 L165,293 L173,326 L160,344 L147,326 L155,293 Z"/>
  <path {o} fill="var(--pocket)" d="M224,318 L250,318 L246,330 L240,322 L234,330 L228,322 Z"/>
  <line {o} x1="220" y1="330" x2="256" y2="330"/>
</g>
<g class="head-rig">
  <!-- horns -->
  <path {o} fill="var(--horn)" d="M86,114 C60,110 40,90 36,54 C50,76 70,86 94,96 Z"/>
  <path {o} fill="var(--horn)" d="M234,114 C260,110 280,90 284,54 C270,76 250,86 226,96 Z"/>
  <!-- shaggy head and beard -->
  <path {o} fill="var(--fur-dark)" d="{mane}"/>
  <path {o} fill="var(--fur-dark)" d="{beard}"/>
  <!-- ears -->
  <ellipse {o} fill="var(--fur)" cx="62" cy="150" rx="22" ry="12" transform="rotate(-18 62 150)"/>
  <ellipse {o} fill="var(--fur)" cx="258" cy="150" rx="22" ry="12" transform="rotate(18 258 150)"/>
  <!-- face -->
  <ellipse fill="var(--fur)" cx="160" cy="172" rx="76" ry="76"/>
  <ellipse fill="var(--cheek)" cx="112" cy="196" rx="13" ry="8"/>
  <ellipse fill="var(--cheek)" cx="208" cy="196" rx="13" ry="8"/>
  <!-- eyes -->
  <g class="eyes">
    <ellipse fill="var(--ink)" cx="130" cy="162" rx="10" ry="12"/>
    <ellipse fill="var(--ink)" cx="190" cy="162" rx="10" ry="12"/>
    <circle fill="#fff" cx="134" cy="157" r="3.6"/>
    <circle fill="#fff" cx="194" cy="157" r="3.6"/>
  </g>
  <!-- fringe over the forehead -->
  <!-- crescent brows: the dark crescent from the banner yak -->
  <path fill="var(--ink)" d="M110,146 C118,132 136,128 150,136 C138,136 124,140 113,151 Z"/>
  <path fill="var(--ink)" d="M210,146 C202,132 184,128 170,136 C182,136 196,140 207,151 Z"/>
  <!-- muzzle -->
  <ellipse {o} fill="var(--muzzle)" cx="160" cy="214" rx="46" ry="30"/>
  <ellipse fill="var(--ink)" cx="145" cy="206" rx="6" ry="4.5"/>
  <ellipse fill="var(--ink)" cx="175" cy="206" rx="6" ry="4.5"/>
  <g class="mouth-rig">
    <path class="mouth-open" fill="var(--ink)" d="M144,224 Q160,226 176,224 Q174,246 160,248 Q146,246 144,224 Z"/>
    <path class="smile" fill="none" stroke="var(--ink)" stroke-width="4.5" stroke-linecap="round" d="M144,224 Q160,236 176,224"/>
  </g>
</g>'''

if __name__ == "__main__":
    print(build())
