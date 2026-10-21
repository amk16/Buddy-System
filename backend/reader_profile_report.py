"""The local HTML report for the reader-feedback loop.

Split out from ``reader_profile.py`` so the numbers and the presentation stay
separable: nothing here reads a file, calls a model, or decides anything. It
takes the profile dictionary and returns a string.

The report is opened straight off disk and is never served, so it carries no
JavaScript, no stylesheet links and no web fonts — just the feed's own colours
from ``frontend/src/index.css`` and whatever fonts the machine already has.
"""

from __future__ import annotations

import html

# Colours lifted from frontend/src/index.css so the report looks like the feed.
# --border-strong carries the "current" bars and --accent the "ideal" ones, so
# the two rows read apart at a glance.
REPORT_CSS = """
  :root {
    --paper: #faf7f0; --card: #fffdf8; --cream-2: #f3eee2; --brief-bg: #fdf3cd;
    --border: #e7e0d2; --border-strong: #d8cfba; --ink: #2c2a26;
    --ink-soft: #5f594e; --accent: #6e530e; --brand-yellow: #ffd700;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 16px 64px; background: var(--paper); color: var(--ink);
    font-family: "Source Sans 3", ui-sans-serif, system-ui, sans-serif;
    font-size: 17px; line-height: 1.65;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  h1, h2, h3 {
    font-family: "Fraunces", "Iowan Old Style", Georgia, serif;
    line-height: 1.3; margin: 0 0 8px;
  }
  h1 { font-size: 30px; }
  h2 { font-size: 23px; margin-top: 48px; padding-bottom: 8px;
       border-bottom: 2px solid var(--brand-yellow); }
  h3 { font-size: 19px; }
  .meta { color: var(--ink-soft); font-size: 14px; margin: 0 0 4px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px;
          padding: 16px; margin: 12px 0; }
  .row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  .bar-label { font-size: 13px; color: var(--ink-soft); width: 64px; flex: none; }
  .bar-track { background: var(--cream-2); border-radius: 4px; height: 12px;
               flex: 1; overflow: hidden; }
  .bar-fill { height: 100%; background: var(--border-strong); }
  .bar-fill.ideal { background: var(--accent); }
  .bar-line { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
  .bar-value { font-size: 13px; color: var(--ink-soft); width: 48px; flex: none;
               text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 15px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); }
  th { color: var(--ink-soft); font-weight: 600; font-size: 13px;
       text-transform: uppercase; letter-spacing: 0.04em; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .cols { display: flex; gap: 16px; flex-wrap: wrap; }
  .cols > div { flex: 1 1 300px; background: var(--brief-bg);
                border: 1px solid var(--border); border-radius: 10px; padding: 16px; }
  ul { padding-left: 20px; margin: 8px 0; }
  li { margin: 6px 0; }
  a { color: var(--accent); }
  .muted { color: var(--ink-soft); }
  .note { font-size: 14px; color: var(--ink-soft); margin-top: 4px; }
"""


def _date_only(timestamp) -> str:
    """The calendar day out of an ISO timestamp — the report never needs more."""
    return str(timestamp or "")[:10]


def _bar(label: str, value, extra_class: str = "") -> str:
    percent = max(0.0, min(1.0, float(value or 0.0))) * 100
    return (
        f'<div class="bar-line"><span class="bar-label">{html.escape(label)}</span>'
        f'<span class="bar-track"><span class="bar-fill {extra_class}" '
        f'style="width:{percent:.1f}%"></span></span>'
        f'<span class="bar-value">{percent:.0f}%</span></div>'
    )


def _steer_column(title: str, steer, weights, summary) -> str:
    e = html.escape
    if not steer:
        return f'<div><h3>{e(title)}</h3><p class="muted">None.</p></div>'
    lean = ", ".join(
        f"{e(str(k))} &times;{float(v):g}" for k, v in (weights or {}).items()
    )
    body = f"<div><h3>{e(title)}</h3><p>{e(str(steer))}</p>"
    if lean:
        body += f'<p class="note">Section lean: {lean}</p>'
    if summary:
        body += f'<p class="note">{e(str(summary))}</p>'
    return body + "</div>"


def _pending_column(proposal: dict | None) -> str:
    """The left-hand steer column, which has three states: nothing proposed, a
    proposal waiting for review, or a proposal that has already been accepted and
    is therefore no longer pending."""
    e = html.escape
    if not proposal:
        return '<div><h3>Pending proposal</h3><p class="muted">None.</p></div>'

    accepted = proposal.get("accepted_at")
    if accepted:
        return (
            '<div><h3>Pending proposal</h3><p class="muted">'
            f"Accepted {e(_date_only(accepted))} — it is the active steer now. "
            "Nothing new is waiting for review.</p></div>"
        )

    column = _steer_column(
        "Pending proposal",
        proposal.get("proposed_steer", ""),
        proposal.get("section_weights", {}),
        proposal.get("profile_summary", ""),
    )
    generated = _date_only(proposal.get("generated_at"))
    if generated and column.endswith("</div>"):
        column = column[: -len("</div>")] + (
            f'<p class="note">Proposed {e(generated)}</p></div>'
        )
    return column


def _card_list(title: str, cards: list) -> str:
    e = html.escape
    if not cards:
        return f'<h2>{e(title)}</h2><p class="muted">None yet.</p>'
    items = "".join(
        f'<li><a href="{e(str(c.get("url", "")))}">{e(str(c.get("headline", "")))}</a>'
        f' <span class="muted">({e(str(c.get("section", "")))} · '
        f'{float(c.get("score", 0.0)):+.2f}'
        + (
            f' · {e(", ".join(str(x) for x in c.get("chips", [])))}'
            if c.get("chips")
            else ""
        )
        + ")</span></li>"
        for c in cards
    )
    return f"<h2>{e(title)}</h2><ul>{items}</ul>"


def render_report(profile: dict, proposal: dict | None, active: dict | None) -> str:
    """Build the local HTML report. Pure — it touches nothing and loads nothing
    from the network, so it can be opened straight off disk."""
    e = html.escape
    counts = profile.get("counts", {})
    parts: list[str] = []

    parts.append(
        "<h1>Reader profile</h1>"
        f'<p class="meta">Generated {e(str(profile.get("generated_at", "")))} · '
        "a reaction's weight halves every "
        f'{float(profile.get("half_life_days", 0) or 0):g} days</p>'
        f'<p class="meta">{int(counts.get("events", 0))} reactions after undo · '
        f'{int(counts.get("explicit", 0))} explicit · '
        f'{int(counts.get("implicit", 0))} implicit · '
        f'{int(counts.get("issue_checkins", 0))} issue check-ins · '
        f'{int(counts.get("unmatched_urls", 0))} reactions to cards no longer '
        "on file</p>"
        '<p class="note">The per-section counts below also include issue '
        "check-ins, which is why they can add up to more than the explicit "
        "figure here.</p>"
    )

    # --- section mix ---------------------------------------------------------
    parts.append("<h2>Section mix</h2>")
    parts.append(
        '<p class="note">Current = the share of items she actually got. '
        "Ideal = the share her reactions ask for. Direction is the gap; "
        "confidence grows with how many reactions a section has.</p>"
    )
    for sid, sec in (profile.get("sections") or {}).items():
        heading = str(sec.get("label") or sid)
        parts.append(
            f'<div class="card"><div class="row"><h3>{e(heading)}</h3>'
            f'<span class="muted">direction {float(sec.get("direction", 0.0)):+.0%} · '
            f'confidence {float(sec.get("confidence", 0.0)):.0%} · '
            f'net {float(sec.get("net", 0.0)):+.2f}</span></div>'
            + _bar("current", sec.get("mix_current", 0.0))
            + _bar("ideal", sec.get("mix_ideal", 0.0), "ideal")
            + f'<p class="note">{int(sec.get("n_explicit", 0))} explicit · '
            f'{int(sec.get("n_implicit", 0))} implicit reactions</p></div>'
        )

    # --- emergent axes -------------------------------------------------------
    axes = (proposal or {}).get("emergent_axes") or profile.get("emergent_axes") or []
    parts.append("<h2>Emergent axes</h2>")
    parts.append(
        '<p class="note">An axis is one dimension of her taste the reactions '
        "reveal. Every axis has to be backed by cards she actually reacted to.</p>"
    )
    if not axes:
        parts.append('<p class="muted">None proposed yet.</p>')
    for axis in axes:
        links = " · ".join(
            f'<a href="{e(str(u))}">{e(str(u))}</a>'
            for u in axis.get("evidence_urls", [])
        )
        parts.append(
            f'<div class="card"><h3>{e(str(axis.get("name", "")))}</h3>'
            f'<p>{e(str(axis.get("definition", "")))}</p>'
            f'<p class="note">now {float(axis.get("current", 0.0)):.2f} '
            f'&rarr; ideally {float(axis.get("ideal", 0.0)):.2f}</p>'
            f'<p class="note">{links}</p></div>'
        )

    # --- reason tallies ------------------------------------------------------
    parts.append("<h2>Reason tallies</h2>")
    parts.append(
        '<p class="note">The reason chips she tapped, each faded by age. '
        "These are the levers the curator can actually pull.</p>"
    )
    tallies = profile.get("chip_tallies") or {}
    if not tallies:
        parts.append('<p class="muted">No reasons given yet.</p>')
    else:
        rows = "".join(
            f'<tr><td>{e(str(chip))}</td>'
            f'<td class="num">{float(t.get("loved", 0.0)):.2f}</td>'
            f'<td class="num">{float(t.get("more", 0.0)):.2f}</td>'
            f'<td class="num">{float(t.get("less", 0.0)):.2f}</td>'
            f'<td class="num">{float(t.get("total", 0.0)):.2f}</td></tr>'
            for chip, t in tallies.items()
        )
        parts.append(
            '<table><tr><th>Reason</th><th class="num">Loved</th>'
            '<th class="num">More</th><th class="num">Less</th>'
            f'<th class="num">Total</th></tr>{rows}</table>'
        )

    # --- steer ---------------------------------------------------------------
    parts.append("<h2>Steer</h2>")
    parts.append(
        '<p class="note">A steer is the short paragraph of instructions the '
        "curator obeys. A proposal changes nothing until it is accepted with "
        "<code>python backend/pipeline.py --accept-steer</code>, and a proposal "
        "can only be accepted once.</p>"
    )
    parts.append(
        '<div class="cols">'
        + _pending_column(proposal)
        + _steer_column(
            "Active steer",
            (active or {}).get("steer", ""),
            (active or {}).get("section_weights", {}),
            (active or {}).get("profile_summary", ""),
        )
        + "</div>"
    )

    # --- the cards themselves -------------------------------------------------
    parts.append(_card_list("Top loved", profile.get("top_positive") or []))
    parts.append(_card_list("Top less", profile.get("top_negative") or []))

    return (
        '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        "<title>Reader profile</title>"
        f'<style>{REPORT_CSS}</style></head><body><div class="wrap">'
        + "".join(parts)
        + "</div></body></html>\n"
    )
