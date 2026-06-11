---
name: pulse-design-review
description: Use when verifying AI Marketing Pulse UI changes — after any visual edit and before claiming frontend work complete.
---

# Pulse Design Review — screenshot-driven multi-lens critique loop

## Overview

Capture real screenshots → spawn 3 parallel reviewer agents with different
lenses → merge findings → fix must-fixes → re-capture. Exit only when all
three lenses report zero must-fix. This loop IS the UI verification for this
project; never claim frontend work complete without it.

Core principle: **reviewers look at pixels, not code.** Each reviewer gets
image files and the `buddy-system` skill path — not your opinions about the
change.

## Step 1 — Serve & tooling

```bash
cd frontend && npm run dev   # background; note the port Vite prints (5173/5174…)
npx --no-install playwright --version || npm i -D playwright
```

Chromium builds are usually already cached in `~/Library/Caches/ms-playwright`;
run `npx playwright install chromium` only if capture fails with a browser
revision error.

**Manual fallback** (only if installing is impossible): ask the user for
screenshots of the running app, or as a degraded last resort review rendered
DOM/computed styles. Never skip review entirely.

## Step 2 — Capture (3 images per iteration, minimum)

Screenshots go to a gitignored scratch dir (`/tmp/pulse-shots/` is fine).
Never commit captures.

```bash
mkdir -p /tmp/pulse-shots
npx playwright screenshot --viewport-size=1280,900 --full-page "http://localhost:PORT/" /tmp/pulse-shots/desktop.png
npx playwright screenshot --viewport-size=390,844  --full-page "http://localhost:PORT/" /tmp/pulse-shots/mobile.png
```

Expanded-card state (clicks the first Details toggle, then shoots):

```bash
node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto("http://localhost:PORT/");
  await p.waitForSelector(".card");
  const t = p.locator("button[aria-expanded]").first();
  if (await t.count()) { await t.click(); await p.waitForTimeout(400); }
  await p.screenshot({ path: "/tmp/pulse-shots/expanded.png", fullPage: true });
  await b.close();
})();' # run from frontend/ so require("playwright") resolves
```

## Step 3 — Spawn 3 reviewers IN PARALLEL (one message, three Agent calls)

Each reviewer prompt must include: the three image paths (they Read the
images), the path `.claude/skills/buddy-system/SKILL.md` (they read the
system they're auditing against), and ONE lens:

1. **Anxious-reader lens** — "You are a smart, busy, anxious reader opening
   this between client calls. First-glance reaction only: does anything feel
   overwhelming, urgent, broken, or unfinished? Is the amount of visible text
   inviting or daunting? Would you close the tab? Report concrete locations."
2. **Hierarchy lens** — "Can you locate The Brief within 2 seconds and skim
   the entire issue in ~10 seconds of scrolling? Is the reading-time cue
   visible near the top? Does expanded detail stay visually subordinate to
   the collapsed skim layer? Where does your eye stall?"
3. **Craft lens** — "Audit spacing, typography, alignment, and color against
   the exact token values in buddy-system. Flag: any off-scale spacing, any
   color not in the token set, any contrast pair that looks below 4.5:1, any
   third typeface, misaligned baselines, inconsistent radii/shadows."

Require each reviewer to return findings as: `MUST-FIX:` list and
`NICE-TO-HAVE:` list, each item with location + what + why.

## Step 4 — Merge & triage

Dedupe across reviewers. A finding is **must-fix** when it violates a
buddy-system token/rule, an accessibility floor, or makes the first glance
feel heavy/urgent. Everything else is nice-to-have (apply cheap ones, note
the rest).

## Step 5 — Fix → re-capture → re-review

Fix all must-fixes, re-run Step 2, and re-run ONLY the lenses that reported
must-fixes. **Cap: 4 iterations.** If must-fixes remain after 4, stop and
present the remaining findings to the user with screenshots — do not loop
forever, and do not silently accept them.

## Exit checklist

- [ ] All three lenses: zero must-fix on the latest captures
- [ ] Desktop + mobile + expanded state all captured on the final iteration
- [ ] Dev server killed
- [ ] No screenshots committed
