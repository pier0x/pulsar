# Pulsar → Nothing Design Redesign Plan

## Overview

Full visual overhaul of Pulsar from the current zinc/blue theme to the Nothing design system. Monochrome, typographic, industrial. Dark-first (OLED black) with full light mode support.

**Current state:** Inter font, zinc-800/900 cards, blue-600 accents, rounded-xl/2xl corners, colorful status badges, Headless UI menus, Heroicons (solid/outline), Recharts with gradients.

**Target:** Space Grotesk + Space Mono + Doto, pure black (#000) background, #111 surfaces, red (#D71921) as the single accent, pill buttons, ALL CAPS monospace labels, segmented progress bars, mechanical/instrument aesthetic.

---

## Phase 0: Foundation (Do First)

### 0.1 — Font Stack
- **Remove:** Inter from Google Fonts link in `root.tsx`
- **Add:** Space Grotesk (300,400,500,700), Space Mono (400,700), Doto (400-700)
- **Update `tailwind.css`:** Define `--font-body`, `--font-mono`, `--font-display` mapping to Nothing fonts
- Tailwind config: `font-body` → Space Grotesk, `font-mono` → Space Mono, `font-display` → Doto

### 0.2 — Color Token System
Replace the entire oklch-based CSS variable system in `tailwind.css` with Nothing tokens:

```css
:root {
  /* Nothing Dark (default) */
  --black: #000000;
  --surface: #111111;
  --surface-raised: #1A1A1A;
  --border: #222222;
  --border-visible: #333333;
  --text-disabled: #666666;
  --text-secondary: #999999;
  --text-primary: #E8E8E8;
  --text-display: #FFFFFF;
  --accent: #D71921;
  --accent-subtle: rgba(215,25,33,0.15);
  --success: #4A9E5C;
  --warning: #D4A843;
  --interactive: #5B9BF6;
}

/* Light mode */
.light { /* flip per Nothing token table */ }
```

- Remove all oklch colors, sidebar tokens, chart colors
- Map Tailwind semantic colors to Nothing tokens (e.g. `--color-background: var(--black)`)
- Drop the `.dark` variant — dark is default, add `.light` variant instead

### 0.3 — Spacing & Radius Reset
- Base spacing already 4/8/16px (compatible)
- Reduce border-radius globally: cards → 12-16px, buttons → 999px (pill) or 4-8px (technical), inputs → 8px
- Remove all `rounded-2xl`, `rounded-xl` on cards → replace with `rounded-[12px]` or custom token
- Kill all shadows and backdrop-blur

### 0.4 — Typography Scale
Define Nothing type scale as Tailwind utilities or CSS tokens:
- `text-display-xl` (72px), `text-display-lg` (48px), `text-display-md` (36px)
- `text-heading` (24px), `text-subheading` (18px)
- `text-body` (16px), `text-body-sm` (14px)
- `text-caption` (12px), `text-label` (11px, ALL CAPS, Space Mono, 0.08em tracking)

---

## Phase 1: Shared Component Library (Reusable Across All Pages)

All components live in `app/components/ui/`. Every page reuses these — no inline one-off styling.

### 1.1 — `button.tsx` (rewrite)
- **Primary:** White bg, black text, pill (999px radius), Space Mono ALL CAPS 13px, 0.06em tracking
- **Secondary:** Transparent, 1px border `--border-visible`, pill
- **Ghost:** Transparent, no border, `--text-secondary`
- **Destructive:** Transparent, 1px border `--accent`, red text, pill
- Remove blue-600 entirely. Remove all `rounded-xl`.
- Min height 44px, padding 12px 24px
- Hover: border/text brightens, no scale or shadow

### 1.2 — `card.tsx` (rewrite)
- Background: `--surface` (#111)
- Border: `1px solid var(--border)` (#222)
- Radius: 12-16px
- Padding: 16-24px
- **No shadows, no backdrop-blur, no bg-zinc-900**
- CardHeader/CardTitle/CardDescription update to Nothing typography

### 1.3 — `input.tsx` (rewrite)
- Underline style preferred: transparent bg, `1px solid --border-visible` bottom only
- OR full border with 8px radius
- Label above: `--label` style (Space Mono, ALL CAPS, `--text-secondary`)
- Focus: border → `--text-primary`
- Error: border → `--accent`
- Font: Space Mono for data entry fields
- Remove bg-zinc-800/50, rounded-xl

### 1.4 — `select.tsx` (rewrite)
- Same as input: underline or bordered, 8px radius
- Space Mono for values
- Custom chevron in `--text-secondary`

### 1.5 — `label.tsx` (rewrite)
- Space Mono, 11px, ALL CAPS, letter-spacing 0.08em
- Color: `--text-secondary`
- This is THE Nothing signature element — used everywhere

### 1.6 — `badge.tsx` (rewrite)
- Remove colored backgrounds (blue/emerald/yellow/red tints)
- Border: `1px solid --border-visible`, no fill
- Text: Space Mono, `--caption` size, ALL CAPS
- Radius: 999px (pill) or 4px (technical)
- Active/status: border + text color changes only (success/warning/accent)

### 1.7 — `alert.tsx` (rewrite)
- Remove colored backgrounds
- Error: `1px solid --accent` border, `--accent` text, no bg tint
- Success: `1px solid --success`, text in `--success`
- Format: `[ERROR] message` or `[SAVED]` — bracket prefix, Space Mono
- No toast popups — inline status only

### 1.8 — `form-field.tsx` (update)
- Use new Label component
- Error text: `--accent` color, Space Mono caption
- Hint text: `--text-disabled`

### 1.9 — NEW `stat-row.tsx`
Reusable for Accounts, Positions, Settings — anywhere we show label:value pairs.
- Left: Space Mono, ALL CAPS, `--text-secondary`
- Right: value in `--text-primary`, unit in `--label` size
- Optional status color on value (success/warning/accent)
- Optional trend arrow (inherits value color)
- Divider: `1px solid --border` between rows

### 1.10 — NEW `segmented-bar.tsx`
Nothing's signature progress visualization. Use for:
- Portfolio allocation percentages
- Position P&L bars
- Any progress/proportion display
- Discrete blocks with 2px gaps, square ends
- Color by status (neutral/good/warning/over)

### 1.11 — NEW `section-header.tsx`
Consistent section titles across all pages:
- Space Mono, ALL CAPS, `--text-secondary`, `--label` size
- Optional count badge
- Optional right-side action (ghost button)

### 1.12 — NEW `data-table.tsx`
Shared table for positions, settings history, account details:
- Header: `--label` style, bottom border `--border-visible`
- Cell: Space Mono numeric, Space Grotesk text
- Numbers right-aligned, text left-aligned
- No zebra striping
- Active row: `--surface-raised` bg + left 2px accent bar

### 1.13 — NEW `modal.tsx`
Replace any existing dialogs:
- Backdrop: `rgba(0,0,0,0.8)`
- Dialog: `--surface` bg, `1px solid --border-visible`, 16px radius
- Max 480px centered
- Close: `[ X ]` ghost button top-right
- No shadows

### 1.14 — NEW `empty-state.tsx`
For pages with no data:
- Centered, 96px+ padding
- Headline: `--text-secondary`
- Description: `--text-disabled`, 1 sentence
- Optional dot-matrix background
- No mascots, no illustrations

### 1.15 — `logo.tsx` (rewrite)
- Replace Tailwind placeholder logo
- "PULSAR" in Doto font, display size
- Or Space Mono ALL CAPS with dot accent
- Monochrome only

---

## Phase 2: Layout Components

### 2.1 — `sidebar.tsx` (rewrite)
- Background: `--black` (flush with page)
- Navigation: Space Mono, ALL CAPS labels
- Active: `--text-display` + left 2px accent bar or dot indicator
- Inactive: `--text-disabled`
- Remove rounded-4xl, bg-zinc-800/20
- Remove Heroicons → switch to Lucide thin (monoline, 1.5px stroke)
- Consider bracket notation: `[ DASHBOARD ]  ACCOUNTS  ASSETS`

### 2.2 — `navbar.tsx` (rewrite)
- Strip Headless UI Menu → replace with Nothing-style dropdown (or flat actions)
- Page title: Space Grotesk heading, `--text-display`
- Refresh button: secondary pill button, Space Mono `[ REFRESH ]`
- User menu: minimal, ghost button
- Remove logo from navbar (it's in sidebar)
- Refresh status: inline `[SYNCING...]` or `[LAST: 5M AGO]` text, not spinner

### 2.3 — `mobile-nav.tsx` (rewrite)
- Background: `--black` or `--surface`
- Remove backdrop-blur
- Labels: Space Mono, ALL CAPS, 10-11px
- Active: `--text-display` + dot above
- Inactive: `--text-disabled`
- Switch from Heroicons solid/outline to Lucide thin
- Remove rounded-xl on tap targets

### 2.4 — `_app.tsx` layout
- Body background: `--black` (#000)
- Remove `p-2 sm:p-4` outer padding (or keep minimal)
- Content max-width stays 7xl but with more breathing room

---

## Phase 3: Page-by-Page Redesign

### 3.1 — Dashboard (`_index.tsx`) — THE showcase page
This is where Nothing design shines. Hero metrics + instrument widgets.

**Layout (3-layer hierarchy):**
1. **Primary:** Total portfolio value in Doto at 48-72px. THE number.
2. **Secondary:** Change percentage, period selector (segmented control), chart
3. **Tertiary:** Account breakdown, top movers — metadata level

**Components to use:**
- Hero number: Doto `--display-xl`, `--text-display`
- Change %: Space Mono, colored by status (green/red)
- Period selector: `segmented-control` (Nothing style — pill container, inverted active)
- Portfolio chart: Simplify Recharts — single 1.5px white line, no gradient fill, no area, horizontal grid only in `--border`, axis labels in Space Mono `--caption`
- Wallet stacked cards → replace with flat stat-rows or segmented bars showing allocation
- Portfolio breakdown: Replace donut chart with segmented bars per category
- Top movers: stat-rows with trend arrows, status colors on values

**Kill:**
- Framer Motion spring/bounce animations → subtle 200ms ease-out opacity
- Colorful chain badges → monochrome with `--text-secondary`
- Gradient chart area fill → single line

### 3.2 — Accounts (`_app.accounts.tsx`)
**Layout:**
- Section header: `CONNECTED ACCOUNTS` (label style)
- Each account: stat-row (name left, balance right, status color)
- Expand to show tokens/holdings as indented sub-rows
- Add wallet form: underline inputs, pill button
- Network badges: `--border-visible` border only, no color fills

**Components:** stat-row, section-header, badge (monochrome), input, button, modal (for delete confirm)

### 3.3 — Assets (`_app.assets.tsx`)
**Layout:**
- Section header: `PHYSICAL ASSETS`
- Asset cards: `--surface` card, image left (if any), name + category label, value as hero number per card
- Edit modal: Nothing modal with underline inputs
- Category: ALL CAPS badge, `--border-visible` border
- Add form: clean underline fields

**Components:** card, stat-row, badge, modal, input, button, empty-state

### 3.4 — Positions (`_app.positions.tsx`)
**Layout:**
- Section header: `TRACKED POSITIONS`
- Position list as data-table
- P&L values: status colored (green/red)
- Price column: Space Mono
- Segmented bar showing gain/loss proportion per position
- Refresh button: secondary pill

**Components:** data-table, segmented-bar, stat-row, button, section-header

### 3.5 — Settings (`_app.settings.tsx`)
**Layout:**
- Sections with clear `--space-2xl` gaps
- Each setting: stat-row layout (label left, control right)
- Inputs: underline style
- Selects: underline style
- Danger zone: `1px solid --accent` card border
- History/snapshots: data-table

**Components:** stat-row, input, select, button (destructive for danger), section-header, data-table

### 3.6 — Onboard (`onboard.tsx`)
**Layout:**
- Centered, `--black` background
- "PULSAR" in Doto, large, centered (the one moment of surprise)
- Subtitle: Space Mono, `--text-secondary`, ALL CAPS: `CREATE YOUR ACCOUNT`
- Form: underline inputs, white pill submit button
- Clean, minimal, confident through emptiness

### 3.7 — Login (via `_index.tsx` unauthenticated state)
- Same as onboard but simpler — just username + password
- `[ LOGIN ]` pill button

---

## Phase 4: Icon & Animation Migration

### 4.1 — Icons
- **Remove:** `@heroicons/react` (solid + outline packages)
- **Keep:** `lucide-react` (already partially used)
- **Rule:** Monoline, 1.5px stroke, no fill, 24x24
- Update all icon imports across sidebar, mobile-nav, navbar, pages

### 4.2 — Animation
- **Keep** Framer Motion but constrain:
  - Duration: 150-250ms micro, 300-400ms transitions
  - Easing: `[0.25, 0.1, 0.25, 1]` (ease-out) — no spring, no bounce
  - Prefer opacity over position
  - Remove `AnimatePresence` slide animations → fade only
  - Remove scale transforms on hover

---

## Phase 5: Polish

### 5.1 — Loading States
- Replace any skeleton loaders with `[LOADING...]` bracket text
- Segmented spinner for full-page loads
- Refresh: `[SYNCING...]` inline text near trigger

### 5.2 — Empty States
- Use `empty-state.tsx` component
- Dot-matrix background pattern optional
- One headline, one line description, one action button

### 5.3 — Error States
- Input errors: border → `--accent`, message below
- Form errors: `[ERROR] message` in Space Mono
- Never red backgrounds — red border + text only

### 5.4 — Meta & Theme
- Update `<meta name="theme-color">` to `#000000`
- Page titles stay "Pulsar"
- Remove `bg-zinc-900` from body → `bg-[var(--black)]` or `bg-black`

---

## Component Reuse Map

Shows which shared components each page uses:

| Component | Dashboard | Accounts | Assets | Positions | Settings | Onboard |
|-----------|:---------:|:--------:|:------:|:---------:|:--------:|:-------:|
| button | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| card | ✓ | ✓ | ✓ | | | |
| input | | ✓ | ✓ | ✓ | ✓ | ✓ |
| select | | ✓ | ✓ | | ✓ | |
| label | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| badge | ✓ | ✓ | ✓ | ✓ | | |
| alert | | ✓ | ✓ | ✓ | ✓ | ✓ |
| stat-row | ✓ | ✓ | ✓ | ✓ | ✓ | |
| segmented-bar | ✓ | | | ✓ | | |
| section-header | ✓ | ✓ | ✓ | ✓ | ✓ | |
| data-table | | | | ✓ | ✓ | |
| modal | | ✓ | ✓ | | ✓ | |
| empty-state | ✓ | ✓ | ✓ | ✓ | | |
| logo | ✓ | | | | | ✓ |

---

## Execution Order

1. **Phase 0** — Foundation (fonts, colors, spacing) — everything depends on this
2. **Phase 1** — Component library (build all shared components)
3. **Phase 2** — Layout (sidebar, navbar, mobile nav)
4. **Phase 3.1** — Dashboard first (highest visual impact)
5. **Phase 3.6 + 3.7** — Onboard/Login (simple, quick wins)
6. **Phase 3.2-3.5** — Remaining pages
7. **Phase 4** — Icon migration + animation cleanup
8. **Phase 5** — Polish pass

**Estimated scope:** ~20 files to create/rewrite, ~15 files to update. The component library (Phase 1) is the biggest investment but pays off across every page.

---

## Files to Delete/Replace

- `app/components/ui/stacked-cards.tsx` → replace with stat-rows + segmented bars on dashboard
- `app/components/ui/portfolio-chart.tsx` → unused (portfolio-value-chart.tsx is the active one)
- `app/components/ui/asset-card.tsx` → inline into asset page or replace with card + stat-row
- `app/components/ui/transaction-table.tsx` → replace with data-table component
- `@heroicons/react` packages → remove after Lucide migration
