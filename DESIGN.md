# Arva — Style Reference

> Pastoral editorial magazine spread on a cream field.

**Theme:** light · **Source:** Arva design system (refero.design)

Arva uses a pastoral editorial language: a warm cream (bone) canvas replaces pure white, deep forest green anchors the brand, and quilted pastel surfaces (sky blue, peach, sage, bone) tile across content sections like fields seen from altitude. Typography pairs a refined editorial serif (Reckless) with a neutral sans (Inter), giving a printed-magazine feel over typical SaaS chrome. Buttons are dramatically **pill-shaped** (100–110px radius), photography dominates above the fold at full-bleed, and the only saturated color besides the brand green is a vivid **lime marquee strip** — a single high-energy accent against an otherwise quiet, earth-toned system.

---

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Forest Ink | `#07503f` | `--color-forest-ink` | Primary brand color — header/nav fill, section dividers, footer. Deep teal-green against warm cream creates agricultural gravitas. |
| Vivid Lime | `#e8fe85` | `--color-vivid-lime` | Promotional marquee strip, highlight bars, occasional link-hover wash — the only high-energy accent, earning attention through scarcity. |
| Bone | `#f1efdf` | `--color-bone` | Page canvas / base background — warm off-white replacing pure white to feel organic and printed. |
| Pure White | `#ffffff` | `--color-pure-white` | Card surfaces, input fills, button text, icon backgrounds — the bright counterpoint against bone. |
| Ash Gray | `#efefef` | `--color-ash-gray` | Secondary card surface, subtle section dividers. |
| Charcoal | `#212529` | `--color-charcoal` | Primary body text, headings on light, icon strokes — near-black for high contrast on cream. |
| Graphite | `#353535` | `--color-graphite` | Secondary text, link/button borders, subdued UI outlines. |
| Pewter | `#6d6d6d` | `--color-pewter` | Muted helper text, tertiary button text and borders. |
| Sky Card | `#b2cee7` | `--color-sky-card` | Quilted pastel tile — partner testimonials and category blocks. |
| Peach Card | `#fceace` | `--color-peach-card` | Warm pastel tile alternating with sky and sage. |
| Sage Card | `#e6ecd5` | `--color-sage-card` | Soft green pastel tile for agrarian category blocks. |
| Moss | `#c3cda7` | `--color-moss` | Subtle borders, input outlines, decorative dividers within body content. |

---

## Tokens — Typography

### Inter — primary UI & body sans · `--font-inter`
Handles everything from 12px nav metadata to 80–90px hero display. Weights 100–600. Negative tracking tightens display sizes (-0.037em at 80–90px); positive tracking (+0.025em) opens up small caps and badges.

### Reckless — display serif · `--font-reckless`
Editorial headlines. At 57px the light weight (300) feels literary and unhurried; at 500–600 it becomes section anchors. Tight tracking (-0.012em). **Substitute:** Cormorant Garamond, GT Sectra, Source Serif Pro.

### RecklessLight — ultra-light serif · `--font-recklesslight`
Body-leading headlines and pull-quotes. The 100 weight at 25–28px creates a delicate editorial voice. **Substitute:** Cormorant Garamond Light.

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 12px | 1.5 | 0.025em | `--text-caption` |
| body-sm | 14px | 1.5 | 0.025em | `--text-body-sm` |
| body | 16px | 1.52 | -0.022em | `--text-body` |
| subheading | 24px | 1.24 | -0.012em | `--text-subheading` |
| heading-sm | 37px | 1.22 | -0.012em | `--text-heading-sm` |
| heading | 45px | 1.06 | -0.012em | `--text-heading` |
| heading-lg | 57px | 1.06 | -0.022em | `--text-heading-lg` |
| display | 80px | 1.0 | -0.037em | `--text-display` |

---

## Tokens — Spacing & Shape

**Density:** comfortable

### Border Radius

| Element | Value |
|---------|-------|
| cards | 20px |
| links | 26px |
| hero-cards | 30px |
| inputs | 33px |
| buttons | 100px (pill) |
| nav-pills | 110px (pill) |

### Layout

- **Page max-width:** 1200px
- **Section gap:** 50px
- **Card padding:** 30px
- **Element gap:** 8px

---

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 1 | Canvas | `#f1efdf` | Full-page warm bone background |
| 2 | Card | `#ffffff` | Bright white content cards layered over bone |
| 3 | Quilt tiles | sky/peach/sage/ash | Rotating pastel category & testimonial tiles |
| 4 | Forest band | `#07503f` | Dark interstitial sections, nav, footer |

---

## Components

### Lime Marquee Strip
Top promotional banner. Full-bleed `#e8fe85`, repeating dark text (Inter 12–14px) separated by outlined checkmarks. Runs full width above the main nav.

### Forest Nav Header
Full-bleed `#07503f` bar. Lowercase wordmark + leaf icon, white Inter 15px nav links, and a white "Get in touch" pill (110px radius, `#212529` text).

### Pill CTA Button (Forest Filled)
Primary action. Background `#07503f`, text `#ffffff`, 100px radius, 10px 24px padding, Inter 500–600 / 14–15px, 0.025em tracking.

### Pill Outline Button (Ghost)
Secondary action. Transparent fill, 1px border `#353535`, 100px radius. Used for "I'm a Company" paired with a filled "I'm a Farmer" primary.

### Full-Bleed Hero with Photography
Full-viewport landscape photograph (aerial field, warm greens). Centered white serif headline at 57–80px (Reckless 300 or Inter 600), two pill buttons below, "Scroll to explore" with down-arrow at bottom. No overlay — image is the background.

### Pastel Quilt Card
Testimonial / category tile. One of four pastel tones (`#b2cee7` sky, `#fceace` peach, `#e6ecd5` sage, `#efefef` ash), 20px radius, 30px padding, centered content. Cards sit side-by-side in a 3-column row, used as a quilted series — not randomly distributed.

### Forest Section Banner
Dark interstitial. Full-bleed `#07503f`, white serif headline, white body, small icon-and-text benefit blocks in a 2×2 grid with icons in circular 30–40px containers.

### Input Field
White fill, 1px border `#c3cda7` (moss) or `#353535`, **33px radius** (distinctly more pill than card), 12px vertical padding, Inter 16px. Focus ring `#07503f`.

### Section Divider Header
Left-aligned serif headline (Reckless 45–57px, `#212529`) on bone, with an optional 1–2 line Inter 17px intro. Typography carries the hierarchy — no decorative element.

---

## Do's and Don'ts

### Do
- Use `#f1efdf` (Bone) as the page canvas on every light section — never substitute pure `#ffffff` as the base.
- Apply the 100px pill radius to every button regardless of variant — the pill is a brand signature.
- Pair Reckless (serif) at 45–57px for headlines with Inter (sans) at 14–17px for body — the serif/sans tension defines the editorial voice.
- Let `#e8fe85` lime appear only on the marquee strip and tiny promo accents — it earns attention through scarcity.
- Use the four pastel surfaces as a rotating quilted series within a row, not randomly distributed.
- Fill nav bars and section dividers solid `#07503f` — the dark green bands are the structural backbone.
- Set hero headlines at 57–80px (Reckless 300 or Inter 600), centered, over full-bleed landscape photography.

### Don't
- Do not use `#ffffff` as the page background — always layer it over `#f1efdf` to preserve the warm printed feel.
- Do not apply small radii (4–8px) to buttons or cards — the 20px+ and 100px+ radii are non-negotiable.
- Do not introduce additional saturated colors — forest green + the single lime accent carry the system.
