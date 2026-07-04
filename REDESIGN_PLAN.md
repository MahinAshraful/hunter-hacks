# Civic Redesign + Multilingual Support — Working Plan

> **Temporary working document.** Delete before final merge if not wanted in the repo.
> Written so a junior engineer (or another agent) can pick up any step and execute
> it exactly, with zero unstated context.

## Goals (from product owner)

1. **Design**: softer colors, subtle shadows, generous spacing, rounded corners.
   Remove the "AI-generated / futuristic" feel. Read as a calm, professional,
   reassuring **public-service platform** (think NYC.gov / gov.uk). WCAG AA
   contrast. Minimal, purposeful animation.
2. **i18n**: complete UI translation system, switchable from anywhere, easy to
   add languages. **Never translate legal output** (AI-drafted complaint text,
   RA-89 PDF fill, companion-doc PDF) — those stay English.
3. **Zero functional regressions.** Every feature, workflow, API, and
   validation rule behaves identically.

## Decisions already made (with rationale)

| Decision | Choice | Why |
|---|---|---|
| Palette direction | Civic blue/neutral (owner picked over "warm but calmer") | Reads immediately as government-adjacent service |
| Languages at launch | EN + Spanish + Chinese (Simplified) + Bengali | NYC's top tenant languages; owner selected |
| /info story prose | Stays English for now; banner shown in other locales | ~2,500 words × 3 languages deferred; dictionary structure supports adding later (`story.*` keys) |
| i18n library | **None** — hand-rolled ~100-line context provider | Every page is already a client component; no routing/middleware needed; zero new deps (constraint: keep framework intact) |
| Theme mechanism | Keep ALL existing CSS custom-property names (`--brass`, `--paper`, `--rust`…), change only their **values** | The entire component layer uses Tailwind classes like `bg-brass`/`text-rust`; renaming would touch every file for zero user value. Names documented as *roles* in globals.css header: `--brass` = primary accent (now blue), `--paper` = page bg, `--bone` = card surface, `--verdigris` = success, `--rust` = danger |
| Display font | Dropped Fraunces serif entirely; `.font-display` → Inter semibold | The italic editorial serif + drop caps were the core of the "AI-generated" feel. One CSS rule restyles every heading; `font-display` class names stay in JSX |
| Map basemap | Removed the `#13171f` dark background override → default light "liberty" style | The dark cinematic globe + gold HUD was the most theatrical element. Map features/behavior 100% preserved (globe projection, fly-to, highlight, pin) |

## Architecture of the i18n layer (all NEW files under `src/lib/i18n/`)

```
src/lib/i18n/
  index.tsx            LanguageProvider + useI18n() hook (client context)
  messages/en.ts       Canonical dictionary. `export const en = {...} as const`
                       + `export type MessageKey = keyof typeof en`
  messages/es.ts       `export const es: Record<MessageKey, string> = {...}`
  messages/zh.ts       same shape (Simplified Chinese)
  messages/bn.ts       same shape (Bengali)
src/components/LanguageSwitcher.tsx   <select> with globe icon
```

Key mechanics a maintainer must know:

- **Type safety**: every non-EN dictionary is typed `Record<MessageKey, string>`.
  Adding a key to `en.ts` without adding it to es/zh/bn = **compile error**.
  Adding a language = one new file + 2 lines in `index.tsx` (`Locale` union +
  `LOCALES` array + `DICTIONARIES` map).
- **Interpolation**: `t('form.err.endAfterStart', { date })` replaces `{date}`.
  Regex: `/\{(\w+)\}/g`. Unknown placeholders are left as-is.
- **Persistence**: localStorage key `airs:locale`. Restored in a `useEffect`
  AFTER mount (never in the useState initializer) — the static prerender is
  always English; restoring post-mount avoids React hydration mismatches.
- **`<html lang>`** is synced on every locale change (screen readers).
- **Fallback**: `t()` falls back to the English string if a locale's value is
  empty.
- **Strings with embedded links/JSX** cannot live in one key (word order varies
  by language). Convention: split into `*Pre` / `*Link` / `*Post` keys and
  compose in JSX (see `summary.disclaimerPre/Link/Post`,
  `draft.next.tip*`, `draft.subBuild*`).
- Provider is mounted once in `src/app/layout.tsx` wrapping `{children}`.
- Switcher lives in BOTH page headers (`page.tsx`, `info/story.tsx`) and the
  Footer → reachable from anywhere.

## What must NEVER be translated (hard requirement)

- `src/lib/complaint-template.ts` (LLM system prompt → English legal draft)
- `src/lib/ra89-fill.ts` (official PDF field values)
- `src/lib/pdf-export.ts` (companion-doc PDF rendering of the legal draft)
- The `text` streamed from `/api/complaint` (the draft itself)
- Server-side API error *payloads* (the client maps them to translated strings;
  e.g. the stream `error` event → client shows `t('draft.error.service')`)

## Theme token mapping (globals.css `:root`)

| Token (unchanged name) | Old (ledger) | New (civic) | Role |
|---|---|---|---|
| `--paper` | `#f6efe2` cream | `#f5f7fa` cool gray | page background |
| `--bone` | `#fbf6ea` | `#ffffff` | card surface |
| `--ink-text` | `#15171f` | `#1c2634` | body text |
| `--secondary` | `#5a4f3d` | `#435268` | secondary text (7.5:1 on white) |
| `--muted` | `#8b7e63` | `#5f6d81` | labels (≥5:1 on white for 11px eyebrows) |
| `--brass` | `#b07a1a` gold | `#2563eb` blue | primary accent/buttons (5.2:1 vs white both ways) |
| `--brass-deep` | `#875a0d` | `#1e4fc2` | hover/active |
| `--brass-wash` | `#f3e7c8` | `#e9f0fd` | tinted surfaces |
| `--verdigris(-bg/-bd)` | copper green | `#17724f` green | success |
| `--rust(-bg/-bd)` | `#9a3514` | `#b3261e` | danger |
| `--warning(-bg/-bd)` | `#8b6914` | `#8a5a00` | warning |
| `--radius-card` | 14px | 16px | card rounding |

Component-class changes in globals.css:
- `.paper` shadow: warm heavy → `0 1px 2px + 0 8px 24px` cool subtle
- `.btn-brass`: metallic 3-stop gradient + lift-on-hover → **flat blue**, white
  text, darkens on hover, `:focus-visible` outline added
- `.ink-card` (map overlays): dark glass → **white frosted** (`rgba(255,255,255,.9)` + blur), dark text
- MapLibre controls/attribution/popup: dark glass → white; **removed** the
  `filter: invert(…)` icon hack (default dark icons now correct on light bg)
- react-datepicker selected-day text `#1a1305` → `#ffffff` (on blue)
- Animations: kept fadeIn/fadeInUp/scaleIn (shorter, smaller offsets), pulse
  recolored blue; added `@media (prefers-reduced-motion: reduce)` kill-switch
- `@theme inline`: `--font-display` now aliases `--font-sans-stack`

`src/app/layout.tsx`: removed `Fraunces` Google-font import (and its `variable`
from `<html className>`); Inter + JetBrains Mono remain.

## De-theatricalization checklist (component edits, all DONE)

- `page.tsx`: removed drop-cap "A" + "Vol. I · Issue 01" eyebrow + date; new
  `hero.kicker` line; removed the radial-gradient **vignette** div over the map;
  map frame `border-ink-line bg-ink` → `border-rule bg-paper-deep`; HUD text
  `text-brass-glow` (light-on-dark) → `text-brass-deep`/`text-muted`
- `ResultCard.tsx`: removed `first-letter:` drop-cap classes; headline
  line-height 1.05 → 1.15; pill text `text-bone` → `text-white`
- `StageStepper.tsx`: roman numerals I–IV → 1–4; completed-step text
  `text-[#1a1305]` → `text-white`
- `ComplaintPreview.tsx`: tone-button active text → white; "next steps" panel
  border-2 + gradient + heavy shadow → flat `brass-wash/50` tint; removed
  invalid `bg-rust-wash/10` class (token never existed) → `bg-rust-bg/40`
- `CityMap3D.tsx`: building extrusions sandstone → cool slate ramp
  (`#c3cedb → #96a8be → #dde5ee`); highlight gold → blue (`#3b82f6`, halo
  `#bfdbfe`); pin SVG gradient gold → blue, pulse/beam rgba recolored;
  removed the `background-color #13171f` style override.
  **Do not touch** the geometry/buffer/z-fighting logic — behavior-critical.

## Translation coverage (files edited to call `t()`)

`page.tsx`, `AddressSearch.tsx`, `DemoAddresses.tsx`, `StageStepper.tsx`,
`ResultCard.tsx`, `Footer.tsx`, `RentHistoryForm.tsx`, `OverchargeSummary.tsx`,
`ComplaintPreview.tsx` (largest — cause labels, required/missing item names as
`MessageKey[]` translated at render time, email compose body, all buttons/cards),
`info/story.tsx` (header chrome + non-EN banner via `story.englishOnly`).

Patterns used (follow these for new strings):
- Static module-level option arrays store `labelKey: MessageKey`, translated at
  render (`CAUSE_OPTIONS`, `STEPS`, `DEMO_ADDRESSES`, `STATUS_CONFIG`).
- `missing` / `requiredMissing` memos return `MessageKey[]`; joined via
  `missing.map((k) => t(k)).join(', ')` at render so locale switches re-render
  without invalidating the memo.
- `Input` primitive takes `optionalLabel` prop (localized "(optional)").

## Verification results (all DONE)

1. ~~i18n core + dictionaries (en/es/zh/bn)~~ DONE
2. **Static checks** — ALL PASS:
   - `npx tsc --noEmit` clean · `npm run lint` clean · `npm test` 18/18 ·
     `npm run build` succeeds (same route table as before)
3. **Visual smoke test** (headless Edge screenshots against `npm run dev`;
   note: pass `--use-angle=swiftshader --enable-unsafe-swiftshader` or the
   WebGL map pane renders blank in headless):
   - Home (EN): light civic theme, white cards, blue accents, numbered
     steps 1–4, switcher in header ✓
   - Home `?lang=es`, `?lang=zh`, `?lang=bn`: every chrome string
     translated, map HUD included; Bengali/Chinese glyphs render via
     system fallback ✓
   - /info: civic restyle inherited; header chrome translated ✓
4. **API smoke** (behavior unchanged):
   - `POST /api/lookup` returns verdict shape + lookupId ✓
   - `POST /api/estimate` returns legal 2060 / overcharge 140/mo for the
     canonical test history — identical to test-suite expectations ✓
5. **Added during verification**: `?lang=xx` URL param as initial locale
   override (persists like a manual selection). Rationale: shareable
   language-specific links for a public service + enables headless testing.
   Implemented in `src/lib/i18n/index.tsx` restore effect.

## Not yet machine-verified (needs a human click-through)

- Interactive flow end-to-end in a real browser: search → flight →
  verdict → lease form → estimate → generate packet (needs LLM key) →
  confirm draft + PDFs remain ENGLISH in a non-EN locale.
- Language switching mid-flow preserves form state (it should — only the
  context value changes; no remount).

## Next action

Commit (owner decides message/split). Working tree currently holds the
entire redesign + i18n change set, uncommitted.

## Known trade-offs / gotchas for the next person

- One-frame English flash on load for non-EN users (client-only i18n; accepted).
- `summary.notes` ("{n} notes") has no plural rules — acceptable for these 4
  languages in this context; if adding Slavic languages, add a plural helper.
- Bengali/Chinese glyphs render via system font fallback (Inter lacks them);
  acceptable, or add Noto Sans subsets later.
- The `es/zh/bn` dictionaries were machine-authored by the implementing agent —
  a native-speaker review pass is recommended before wide release.
- `AGENTS.md` warns this Next.js version may deviate from docs; nothing in this
  change touches Next APIs beyond what already worked (client components,
  next/font, next/dynamic).
