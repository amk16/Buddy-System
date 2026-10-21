"""The reader-feedback loop — turns her reactions into a profile, and a profile
into a proposed "steer" for the curator.

Plain English, end to end:

1. The dashboard records small events when she reacts to a card (More like this,
   Loved, Less like this, an Undo) or to a whole issue (useful / fine / noise),
   plus two quiet ones: she opened a card's details, or clicked its headline.
   Those events land, one JSON object per line, in ``feedback/YYYY-MM.jsonl`` on
   the git branch ``feedback``.
2. This module reads them, matches each one back to the real card it was about,
   and adds up a score per section. Recent reactions count more than old ones —
   a reaction's weight halves every ``half_life_days`` — because taste drifts.
3. From those numbers it can ask an LLM to name the *emergent axes* of her taste
   (an axis = a dimension the data reveals, like "hands-on tools over strategy
   essays") and to draft a short paragraph of instructions — the **steer**.
4. Nothing changes automatically. The proposal sits in ``profile/proposal.yaml``
   until Ali runs ``pipeline.py --accept-steer``, which writes
   ``backend/steer.yaml``; only then does the curator's prompt carry it.

Everything in step 2 is deterministic and unit-tested, so any number in the
report can be explained without asking a model what it was thinking.

The module is named ``reader_profile`` rather than ``profile`` on purpose:
``profile`` is a Python standard-library module name, and ``backend/`` sits first
on ``sys.path`` during a run, so the short name would shadow it.
"""

from __future__ import annotations

import json
import math
import subprocess
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import yaml

import store
from config import STEER_PATH, Config
from reader_profile_report import render_report
from gemini_interactions import HTTP_OPTIONS, create_with_retry, output_text
from pydantic import BaseModel
from url_resolve import canonicalize

# How much one reaction is worth before decay. The explicit ones dominate; the
# implicit ones (she opened it, she clicked it) measure engagement rather than
# satisfaction, so they are deliberately small.
WEIGHTS = {"loved": 2.0, "more": 1.0, "less": -1.0, "click": 0.5, "open": 0.25}

# A whole-issue check-in ("was this issue useful?"), spread over its sections.
ISSUE_VALUES = {"useful": 1.0, "fine": 0.0, "noise": -1.0}

EXPLICIT = ("loved", "more", "less")
IMPLICIT = ("open", "click")

ROOT = Path(__file__).resolve().parent.parent
PROFILE_DIR = ROOT / "profile"

# Working files for the Claude Code proposer, mirroring the pool/curated pattern:
# the run writes the evidence, the session writes the proposal back.
EVIDENCE_PATH = Path(__file__).resolve().parent / "profile_evidence.json"
PROPOSAL_INPUT_PATH = Path(__file__).resolve().parent / "profile_proposal.json"

# Hard limits on what the model is allowed to hand back.
MAX_WORDS = 120
WEIGHT_FLOOR = 0.25
WEIGHT_CEILING = 3.0

# How many of the newest issues define "the mix she is currently getting".
MIX_WINDOW_ISSUES = 14

# Sample size at which confidence reaches about 63%. Small on purpose: this is a
# feed of one reader, not a survey.
CONFIDENCE_SCALE = 8.0


# --- reading the raw events ---------------------------------------------------

def _parse_ts(ts) -> datetime | None:
    """Parse an ISO-8601 timestamp, tolerating a trailing "Z" and a missing
    timezone. Returns None when it cannot be read at all."""
    if not isinstance(ts, str) or not ts.strip():
        return None
    text = ts.strip()
    if text.endswith(("Z", "z")):
        text = text[:-1] + "+00:00"
    try:
        moment = datetime.fromisoformat(text)
    except ValueError:
        return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment


def _git_feedback_lines(ref: str, repo_root: Path) -> list[str]:
    """Every line of every ``feedback/*.jsonl`` file on a git ref.

    A missing ref, a directory that is not a git repository, a hung git, or a file
    with bytes that are not valid text are all normal states out here — none of
    them may raise. Undecodable bytes are replaced rather than rejected, so one
    corrupt write costs that line and not the file."""
    try:
        listing = subprocess.run(
            ["git", "ls-tree", "--name-only", "-r", ref, "--", "feedback/"],
            cwd=str(repo_root),
            capture_output=True,
            text=True,
            errors="replace",
            timeout=30,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        print(f"  [profile] could not list {ref} ({exc}) — no feedback read")
        return []
    if listing.returncode != 0:
        # Almost always a ref that was never fetched. Say so: an unexplained
        # empty profile reads as "she reacted to nothing", which is a different
        # and much more misleading thing.
        fetch = ref.replace("/", " ", 1)
        print(
            f"  [profile] no feedback ref {ref} (run: git fetch {fetch}) "
            "- reading no feedback"
        )
        return []

    lines: list[str] = []
    for path in listing.stdout.splitlines():
        path = path.strip()
        if not path.endswith(".jsonl"):
            continue
        try:
            blob = subprocess.run(
                ["git", "show", f"{ref}:{path}"],
                cwd=str(repo_root),
                capture_output=True,
                text=True,
                errors="replace",
                timeout=30,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            print(f"  [profile] could not read {path} from {ref} ({exc}) — skipped")
            continue
        if blob.returncode == 0:
            lines.extend(blob.stdout.splitlines())
        else:
            print(f"  [profile] could not read {path} from {ref} — skipped")
    return lines


def load_feedback(
    feedback_dir: Path | None = None,
    ref: str = "origin/feedback",
    repo_root: Path = ROOT,
) -> list[dict]:
    """Return every feedback event, from a local directory when one is given,
    otherwise from the ``feedback`` branch. Malformed lines are skipped and
    reported — one bad write must never cost the whole history."""
    raw_lines: list[str] = []
    if feedback_dir is not None:
        directory = Path(feedback_dir)
        if directory.is_dir():
            for path in sorted(directory.glob("*.jsonl")):
                try:
                    raw_lines.extend(path.read_text().splitlines())
                except OSError:
                    continue
    else:
        raw_lines = _git_feedback_lines(ref, Path(repo_root))

    events: list[dict] = []
    malformed = 0
    for line in raw_lines:
        line = line.strip()
        if not line:
            continue
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError:
            malformed += 1
            continue
        if isinstance(parsed, dict):
            events.append(parsed)
        else:
            malformed += 1
    if malformed:
        print(f"  [profile] skipped {malformed} malformed feedback line(s)")
    return events


# --- matching events back to real cards --------------------------------------

def build_item_index(
    issues_dir: Path = store.ISSUES_DIR,
) -> tuple[dict[str, dict], list[dict]]:
    """Map every published item's canonical URL to the card itself.

    Returns ``(index, issues)`` where ``issues`` is newest-first. When the same
    URL appears in more than one issue the newest wins, so a re-run of a story is
    attributed to where she most recently saw it."""
    issues: list[dict] = []
    directory = Path(issues_dir)
    if directory.is_dir():
        for path in sorted(directory.glob("*.json")):
            if path.name == "index.json":
                continue
            try:
                issues.append(json.loads(path.read_text()))
            except (OSError, json.JSONDecodeError):
                continue
    issues = [i for i in issues if isinstance(i, dict)]
    issues.sort(key=lambda i: str(i.get("generated_at") or ""), reverse=True)

    index: dict[str, dict] = {}
    for issue in issues:
        for section in issue.get("sections") or []:
            for item in section.get("items") or []:
                key = canonicalize(item.get("url") or "")
                if not key or key in index:
                    continue
                index[key] = {
                    "issue_id": issue.get("id", ""),
                    "section": section.get("id", ""),
                    "item": item,
                }
    return index, issues


def decay(ts: str, now: datetime, half_life_days: float) -> float:
    """How much an old reaction still counts: it halves every
    ``half_life_days``. A timestamp we cannot read counts for nothing."""
    moment = _parse_ts(ts)
    if moment is None:
        return 0.0
    reference = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
    if half_life_days <= 0:
        return 1.0
    age_days = (reference - moment).total_seconds() / 86400.0
    if age_days < 0:
        return 1.0
    return 0.5 ** (age_days / half_life_days)


def _identity(event: dict) -> tuple:
    return (event.get("client_id"), canonicalize(event.get("url") or ""))


def resolve_reactions(events: list[dict]) -> list[dict]:
    """Apply undo and de-duplication, oldest event first.

    An ``undo`` takes back the most recent explicit reaction the same person made
    to the same card, and then disappears itself. The quiet signals (open, click)
    count once per person per card per kind — opening a card five times is one
    piece of evidence, not five."""
    ordered = sorted(events, key=lambda e: _parse_ts(e.get("ts")) or datetime.min.replace(tzinfo=timezone.utc))
    kept: list[dict] = []
    for event in ordered:
        kind = event.get("kind")
        key = _identity(event)
        if kind == "undo":
            for i in range(len(kept) - 1, -1, -1):
                if kept[i].get("kind") in EXPLICIT and _identity(kept[i]) == key:
                    kept.pop(i)
                    break
            continue
        if kind in IMPLICIT:
            for i in range(len(kept) - 1, -1, -1):
                if kept[i].get("kind") == kind and _identity(kept[i]) == key:
                    kept.pop(i)
                    break
        kept.append(event)
    return kept


# --- the numbers --------------------------------------------------------------

def _strip_leading_emoji(label: str) -> str:
    """Drop a label's leading emoji, the way the dashboard's ``stripEmoji`` does,
    so the report reads "Case Studies" rather than the raw id or a stray glyph."""
    i = 0
    while i < len(label) and (
        unicodedata.category(label[i]) in ("So", "Sk", "Cf", "Mn")
        or label[i] in "\ufe0f\u200d"
    ):
        i += 1
    return label[i:].strip()


def _section_labels(cfg: Config) -> dict[str, str]:
    """Display name per section id, falling back to the id itself."""
    return {
        s.id: (_strip_leading_emoji(s.label or "") or s.id) for s in cfg.sections
    }


def _mix_current(cfg: Config, issues: list[dict]) -> dict[str, float]:
    """The share of items each section actually got, over the newest issues."""
    section_ids = cfg.section_ids
    counted = {sid: 0 for sid in section_ids}
    for issue in issues[:MIX_WINDOW_ISSUES]:
        for section in issue.get("sections") or []:
            sid = section.get("id")
            if sid in counted:
                counted[sid] += len(section.get("items") or [])
    total = sum(counted.values())
    if total == 0:
        even = 1.0 / len(section_ids) if section_ids else 0.0
        return {sid: even for sid in section_ids}
    return {sid: counted[sid] / total for sid in section_ids}


def _card_entry(entry: dict, total: float, chips: list[str]) -> dict:
    item = entry["item"]
    return {
        "url": item.get("url", ""),
        "headline": item.get("headline", ""),
        "summary": item.get("summary", ""),
        "section": entry.get("section", ""),
        "source_name": item.get("source_name", ""),
        "terms": item.get("terms") or [],
        "score": round(total, 4),
        "chips": chips,
    }


def score(
    cfg: Config,
    events: list[dict],
    index: dict,
    issues: list[dict],
    now: datetime,
) -> dict:
    """Turn resolved events into the profile numbers. No LLM, no guessing."""
    half_life = cfg.feedback_half_life_days
    section_ids = cfg.section_ids
    sections = {
        sid: {"net": 0.0, "positive": 0.0, "n_explicit": 0, "n_implicit": 0}
        for sid in section_ids
    }
    chip_tallies: dict[str, dict[str, float]] = {}
    per_url: dict[str, dict] = {}
    counts = {
        "events": len(events),
        "explicit": 0,
        "implicit": 0,
        "issue_checkins": 0,
        "unmatched_urls": 0,
    }
    issues_by_id = {str(i.get("id")): i for i in issues}

    for event in events:
        kind = event.get("kind")
        weight_of_age = decay(event.get("ts", ""), now, half_life)

        if kind in EXPLICIT:
            for reason in event.get("reasons") or []:
                if not isinstance(reason, str):
                    continue
                tally = chip_tallies.setdefault(
                    reason, {"loved": 0.0, "more": 0.0, "less": 0.0, "total": 0.0}
                )
                tally[kind] += weight_of_age
                tally["total"] += weight_of_age

        if kind == "issue":
            counts["issue_checkins"] += 1
            issue = issues_by_id.get(str(event.get("issue_id")))
            value = ISSUE_VALUES.get(event.get("value"))
            if issue is None or value is None:
                continue
            targets = [
                s.get("id")
                for s in issue.get("sections") or []
                if s.get("items") and s.get("id") in sections
            ]
            if not targets:
                continue
            share = value * weight_of_age / len(targets)
            for sid in targets:
                sections[sid]["net"] += share
                if share > 0:
                    sections[sid]["positive"] += share
                sections[sid]["n_explicit"] += 1
            continue

        if kind not in WEIGHTS:
            continue

        entry = index.get(canonicalize(event.get("url") or ""))
        if entry is None:
            counts["unmatched_urls"] += 1
            continue

        weight = WEIGHTS[kind] * weight_of_age
        sid = entry.get("section")
        if sid in sections:
            sections[sid]["net"] += weight
            if weight > 0:
                sections[sid]["positive"] += weight
            if kind in EXPLICIT:
                sections[sid]["n_explicit"] += 1
            else:
                sections[sid]["n_implicit"] += 1
        counts["explicit" if kind in EXPLICIT else "implicit"] += 1

        key = canonicalize(event.get("url") or "")
        aggregate = per_url.setdefault(key, {"score": 0.0, "chips": [], "entry": entry})
        aggregate["score"] += weight
        for reason in event.get("reasons") or []:
            if isinstance(reason, str) and reason not in aggregate["chips"]:
                aggregate["chips"].append(reason)

    mix_current = _mix_current(cfg, issues)
    total_positive = sum(s["positive"] for s in sections.values())
    # Below the floor we have too little evidence to claim she wants a different
    # mix, so "ideal" is simply what she already gets and direction is zero.
    have_enough = counts["explicit"] >= cfg.feedback_min_explicit_for_proposal

    labels = _section_labels(cfg)
    out_sections = {}
    for sid in section_ids:
        raw = sections[sid]
        n = raw["n_explicit"] + raw["n_implicit"]
        if have_enough and total_positive > 0:
            ideal = raw["positive"] / total_positive
        else:
            ideal = mix_current[sid]
        # Round first, subtract second: the direction stored here must be the
        # difference of the two numbers stored beside it, not of their fuller
        # originals, or the JSON contradicts itself by a digit.
        current_r = round(mix_current[sid], 4)
        ideal_r = round(ideal, 4)
        out_sections[sid] = {
            "label": labels.get(sid, sid),
            "net": round(raw["net"], 4),
            "positive": round(raw["positive"], 4),
            "n_explicit": raw["n_explicit"],
            "n_implicit": raw["n_implicit"],
            "confidence": round(1 - math.exp(-n / CONFIDENCE_SCALE), 4),
            "mix_current": current_r,
            "mix_ideal": ideal_r,
            "direction": round(ideal_r - current_r, 4),
        }

    ranked = sorted(per_url.values(), key=lambda a: a["score"], reverse=True)
    top_k = cfg.feedback_top_k
    top_positive = [
        _card_entry(a["entry"], a["score"], a["chips"]) for a in ranked if a["score"] > 0
    ][:top_k]
    top_negative = [
        _card_entry(a["entry"], a["score"], a["chips"])
        for a in sorted(per_url.values(), key=lambda a: a["score"])
        if a["score"] < 0
    ][:top_k]

    return {
        "generated_at": now.isoformat(),
        "half_life_days": half_life,
        "counts": counts,
        "sections": out_sections,
        "chip_tallies": {
            chip: {k: round(v, 4) for k, v in tally.items()}
            for chip, tally in sorted(chip_tallies.items())
        },
        "top_positive": top_positive,
        "top_negative": top_negative,
    }


# --- the LLM layer: propose a steer, then distrust it -------------------------

class Axis(BaseModel):
    """One dimension of her taste the reactions reveal, e.g. "hands-on tools over
    strategy essays". ``current`` and ``ideal`` are positions on that dimension
    from 0 to 1."""

    name: str
    definition: str
    evidence_urls: list[str]
    current: float
    ideal: float


class SectionWeight(BaseModel):
    id: str
    weight: float


class ProposalOut(BaseModel):
    emergent_axes: list[Axis]
    profile_summary: str
    proposed_steer: str
    section_weights: list[SectionWeight]


PROPOSAL_SYSTEM = """You are reading one person's reactions to a private daily
briefing on AI for business. She is a marketer moving into AI consulting.

You receive: items she loved or asked for more of, items she asked less of, tallies
of the reasons she gave, and the section mix she currently gets versus the mix her
reactions imply. Nothing else about her exists — do not assume anything you were
not given.

Return JSON with four parts:

1. emergent_axes: 2 to 5 axes. An axis is a dimension of her taste that the data
   actually reveals — for example "hands-on tools over strategy pieces" or
   "named companies with numbers over unnamed trend stories". Each axis carries:
   - name: a short plain-English phrase, no jargon.
   - definition: ONE sentence saying what sits at each end of the axis.
   - evidence_urls: the urls of the items that show this axis. Choose ONLY from
     the urls given to you. Never write a url that was not in the input. An axis
     you cannot evidence from those urls is an axis you must not claim.
   - current: where the briefing sits today on that axis, 0 to 1.
   - ideal: where her reactions say it should sit, 0 to 1.
2. profile_summary: at most 120 words of plain English describing what she seems
   to want. No jargon, no flattery, no invented biography.
3. proposed_steer: at most 120 words of instructions a curator can actually follow,
   written in the second person about "the reader" — what to favour, what to cut,
   what to explain. Concrete, not abstract. Invent no facts.
4. section_weights: a list of {"id": <section id>, "weight": <number>} over the
   section ids given to you. 1.0 means unchanged, above 1.0 means give it more of
   the issue, below means less.

If the evidence is thin, say so plainly and propose a small, cautious change."""


def build_evidence(cfg: Config, numbers: dict) -> dict:
    """The exact, bounded packet the model is allowed to reason over."""
    sections = numbers.get("sections", {})
    return {
        "relevance_focus": cfg.relevance_focus,
        "section_ids": cfg.section_ids,
        "section_mix": {
            sid: {
                "current": sections.get(sid, {}).get("mix_current", 0.0),
                "ideal": sections.get(sid, {}).get("mix_ideal", 0.0),
            }
            for sid in cfg.section_ids
        },
        "chip_tallies": numbers.get("chip_tallies", {}),
        "top_positive": numbers.get("top_positive", []),
        "top_negative": numbers.get("top_negative", []),
    }


def _allowed_urls(evidence: dict) -> list[str]:
    cards = list(evidence.get("top_positive", [])) + list(
        evidence.get("top_negative", [])
    )
    return [c.get("url", "") for c in cards if c.get("url")]


def _truncate_words(text: str, limit: int = MAX_WORDS) -> str:
    words = (text or "").split()
    return " ".join(words[:limit])


def _clamp(value: float, low: float, high: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return low
    return max(low, min(high, number))


def filter_proposal(
    out: ProposalOut, allowed_urls: list[str], section_ids: list[str]
) -> dict:
    """Strip everything the model was not entitled to say.

    Evidence urls must be ones we handed it (compared after canonicalizing, so a
    tracking parameter or a "www." does not count as a different link); an axis
    with nothing left is dropped; every number is clamped; the prose is cut to
    120 words."""
    # Map back to OUR spelling of each url: the model may echo one back with a
    # "www." or a tracking parameter, and the report should link the exact url the
    # issue published.
    allowed = {canonicalize(u): u for u in allowed_urls if u}
    known = list(section_ids)

    axes = []
    for axis in out.emergent_axes:
        kept_urls: list[str] = []
        for candidate in axis.evidence_urls:
            ours = allowed.get(canonicalize(candidate))
            if ours is not None and ours not in kept_urls:
                kept_urls.append(ours)
        if not kept_urls:
            continue
        axes.append(
            {
                "name": axis.name.strip(),
                "definition": axis.definition.strip(),
                "evidence_urls": kept_urls,
                "current": _clamp(axis.current, 0.0, 1.0),
                "ideal": _clamp(axis.ideal, 0.0, 1.0),
            }
        )

    weights: dict[str, float] = {}
    for weight in out.section_weights:
        if weight.id in known:
            weights[weight.id] = _clamp(weight.weight, WEIGHT_FLOOR, WEIGHT_CEILING)

    return {
        "emergent_axes": axes,
        "profile_summary": _truncate_words(out.profile_summary),
        "proposed_steer": _truncate_words(out.proposed_steer),
        "section_weights": weights,
    }


def _gemini_client():
    """Split out so tests can replace it without a network or an API key."""
    from google import genai

    return genai.Client(http_options=HTTP_OPTIONS)


def _propose_gemini(cfg: Config, evidence: dict) -> dict | None:
    try:
        client = _gemini_client()
        interaction = create_with_retry(
            client,
            model=cfg.gemini_model,
            input=PROPOSAL_SYSTEM + "\n\n" + json.dumps(evidence, ensure_ascii=False),
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": ProposalOut.model_json_schema(),
            },
        )
        out = ProposalOut.model_validate_json(output_text(interaction) or "{}")
    except Exception as exc:  # noqa: BLE001 - any failure just means no proposal
        print(f"  [profile] gemini proposal failed: {exc}")
        return None
    return filter_proposal(out, _allowed_urls(evidence), evidence.get("section_ids", []))


def _propose_anthropic(cfg: Config, evidence: dict) -> dict | None:
    try:
        import anthropic

        import curator

        resp = anthropic.Anthropic().messages.parse(
            model=curator.MODEL,
            max_tokens=4000,
            system=PROPOSAL_SYSTEM,
            messages=[
                {"role": "user", "content": json.dumps(evidence, ensure_ascii=False)}
            ],
            output_format=ProposalOut,
        )
        out = resp.parsed_output
        if out is None:
            print("  [profile] anthropic proposal returned no structured output")
            return None
    except Exception as exc:  # noqa: BLE001
        print(f"  [profile] anthropic proposal failed: {exc}")
        return None
    return filter_proposal(out, _allowed_urls(evidence), evidence.get("section_ids", []))


def _propose_claude_code(evidence: dict) -> None:
    """The no-API-cost path: hand the evidence to the Claude Code session and stop.

    Same two-step shape as pool.json / curated.json — the run writes the input, the
    session writes the answer back, and a later command picks it up."""
    payload = {
        "instructions": PROPOSAL_SYSTEM,
        "output_schema": ProposalOut.model_json_schema(),
        "evidence": evidence,
    }
    try:
        EVIDENCE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    except OSError as exc:
        print(f"  [profile] could not write {EVIDENCE_PATH}: {exc}")
        return None
    print(f"  [profile] wrote {EVIDENCE_PATH} for the Claude Code proposer.")
    print(
        f"  [profile] next: write {PROPOSAL_INPUT_PATH} (the JSON above), then run\n"
        f"            python backend/pipeline.py --profile "
        f"--proposal {PROPOSAL_INPUT_PATH}"
    )
    return None


def propose(cfg: Config, evidence: dict, proposer: str) -> dict | None:
    """Ask the run's own engine for a steer. Returns None whenever there is
    nothing trustworthy to return — a failed proposal is never fatal."""
    if proposer == "gemini":
        return _propose_gemini(cfg, evidence)
    if proposer == "anthropic":
        return _propose_anthropic(cfg, evidence)
    if proposer == "claude-code":
        return _propose_claude_code(evidence)
    print(f"  [profile] unknown proposer {proposer!r} — no proposal made")
    return None


def ingest_proposal(cfg: Config, path: Path, evidence: dict) -> dict | None:
    """Read a proposal a Claude Code session wrote, through the same filter the
    API paths go through — the session is not more trusted than the API."""
    try:
        out = ProposalOut.model_validate_json(Path(path).read_text())
    except Exception as exc:  # noqa: BLE001 - unreadable or wrong-shaped file
        print(f"  [profile] could not read a proposal from {path}: {exc}")
        return None
    return filter_proposal(out, _allowed_urls(evidence), evidence.get("section_ids", []))


# --- what the loop leaves on disk --------------------------------------------

def load_active_steer(steer_path: Path = STEER_PATH) -> dict | None:
    """The steer currently in force, or None when none has been accepted."""
    path = Path(steer_path)
    if not path.exists():
        return None
    try:
        data = yaml.safe_load(path.read_text())
    except (OSError, yaml.YAMLError) as exc:
        print(f"  [profile] unreadable steer at {path}: {exc}")
        return None
    return data if isinstance(data, dict) else None


def read_proposal_file(path: Path) -> dict | None:
    """The proposal sitting on disk, or None when there is none to read."""
    target = Path(path)
    if not target.exists():
        return None
    try:
        data = yaml.safe_load(target.read_text())
    except (OSError, yaml.YAMLError) as exc:
        print(f"  [profile] unreadable proposal at {target}: {exc}")
        return None
    return data if isinstance(data, dict) else None


def is_accepted(proposal: dict | None) -> bool:
    """True once a proposal has been stamped by ``accept_steer``.

    The stamp is what stops the same proposal being accepted twice and what makes
    ``proposal_pending`` honest: a file on disk is only *pending* while nobody has
    acted on it yet."""
    return bool((proposal or {}).get("accepted_at"))


def write_outputs(
    profile: dict,
    proposal: dict | None,
    active: dict | None,
    out_dir: Path = PROFILE_DIR,
) -> None:
    """Write profile.json, the report, and — only when a fresh proposal was made
    this run — proposal.yaml.

    A fresh proposal always replaces whatever was there: newer evidence beats
    older, and the run that produced it is the one that knows the numbers. A
    proposal is never deleted automatically; instead its state is visible, through
    ``generated_at``, ``based_on`` and the ``accepted_at`` stamp.

    Sets ``profile["proposal_pending"]`` on the dictionary it is given, so the
    JSON and the caller agree about what is actually waiting for review."""
    directory = Path(out_dir)
    directory.mkdir(parents=True, exist_ok=True)
    proposal_path = directory / "proposal.yaml"

    if proposal is not None:
        counts = profile.get("counts", {})
        shown = {
            "proposed_steer": proposal.get("proposed_steer", ""),
            "section_weights": proposal.get("section_weights", {}),
            "profile_summary": proposal.get("profile_summary", ""),
            "emergent_axes": proposal.get("emergent_axes", []),
            "generated_at": profile.get("generated_at", ""),
            "based_on": {
                "explicit": counts.get("explicit", 0),
                "implicit": counts.get("implicit", 0),
                "issues": counts.get("issue_checkins", 0),
            },
        }
        proposal_path.write_text(
            yaml.safe_dump(shown, allow_unicode=True, sort_keys=False)
        )
    else:
        # No new proposal this run: whatever is already on disk still stands, and
        # its stamp decides whether anything is genuinely pending.
        shown = read_proposal_file(proposal_path)
        # The report renders that same file, so profile.json has to carry its
        # axes too. Otherwise the two outputs of one run disagree about what she
        # is like.
        profile["emergent_axes"] = (shown or {}).get("emergent_axes", [])

    profile["proposal_pending"] = shown is not None and not is_accepted(shown)

    (directory / "profile.json").write_text(
        json.dumps(profile, ensure_ascii=False, indent=2)
    )
    (directory / "report.html").write_text(render_report(profile, shown, active))


def generate(
    cfg: Config,
    *,
    proposer: str,
    feedback_dir: Path | None = None,
    proposal_path: Path | None = None,
    now: datetime | None = None,
    out_dir: Path = PROFILE_DIR,
) -> dict:
    """The whole loop: read reactions, score them, maybe ask for a steer, write
    the outputs. Returns the profile it wrote."""
    moment = now or datetime.now(timezone.utc)
    events = load_feedback(feedback_dir=feedback_dir)
    index, issues = build_item_index()
    resolved = resolve_reactions(events)
    numbers = score(cfg, resolved, index, issues, moment)
    evidence = build_evidence(cfg, numbers)

    proposal = None
    floor = cfg.feedback_min_explicit_for_proposal
    explicit = numbers["counts"]["explicit"]
    if proposal_path is not None:
        proposal = ingest_proposal(cfg, Path(proposal_path), evidence)
    elif explicit < floor:
        # Too few explicit reactions to claim we know anything — stay descriptive
        # and spend no tokens.
        print(
            f"  [profile] {explicit} explicit reaction(s); "
            f"need {floor} before proposing a steer."
        )
    else:
        proposal = propose(cfg, evidence, proposer)

    profile = dict(numbers)
    profile["emergent_axes"] = (proposal or {}).get("emergent_axes", [])

    # write_outputs fills in proposal_pending, because only it knows what ended up
    # on disk and whether that file has already been accepted.
    write_outputs(profile, proposal, load_active_steer(), out_dir=out_dir)
    return profile


def _newest_issue_timestamp(issues_dir: Path) -> str | None:
    """When the most recent published issue was generated, or None."""
    try:
        _, issues = build_item_index(issues_dir)
    except Exception as exc:  # noqa: BLE001 - only used for an advisory warning
        print(f"  [profile] could not check the newest issue: {exc}")
        return None
    return str(issues[0].get("generated_at")) if issues else None


def accept_steer(
    proposal_path: Path = PROFILE_DIR / "proposal.yaml",
    steer_path: Path = STEER_PATH,
    issues_dir: Path = store.ISSUES_DIR,
) -> int:
    """Make the pending proposal the active steer. This is the only step that
    changes what the curator is told, and only Ali runs it.

    A proposal can be accepted exactly once: on success the file is stamped with
    ``accepted_at``, and a stamped file is refused rather than silently applied
    again."""
    path = Path(proposal_path)
    data = read_proposal_file(path)
    if data is None:
        if not path.exists():
            print(f"No pending proposal at {path} — nothing to accept.")
        return 1

    if is_accepted(data):
        print(
            f"The proposal at {path} was already accepted on "
            f"{data['accepted_at']} — refusing to accept it twice."
        )
        print(
            "  Run `python backend/pipeline.py --profile` to build a fresh one "
            "from the latest reactions."
        )
        return 1

    steer = str(data.get("proposed_steer") or "").strip()
    if not steer:
        print(f"The proposal at {path} carries no steer — nothing to accept.")
        return 1

    generated_at = str(data.get("generated_at") or "")
    print(f"Accepting the proposal generated {generated_at or 'at an unknown time'}.")
    newest_issue = _newest_issue_timestamp(issues_dir)
    proposal_moment = _parse_ts(generated_at)
    newest_moment = _parse_ts(newest_issue) if newest_issue else None
    if proposal_moment and newest_moment and proposal_moment < newest_moment:
        print(
            f"  WARNING: this proposal predates the newest issue on file "
            f"({newest_issue}), so it never saw those cards. Consider running "
            "`python backend/pipeline.py --profile` first."
        )

    previous = load_active_steer(steer_path) or {}
    payload = {
        "steer": steer,
        "section_weights": data.get("section_weights") or {},
        "profile_summary": data.get("profile_summary", ""),
        "accepted_at": datetime.now(timezone.utc).isoformat(),
        "based_on": data.get("based_on") or {},
    }
    Path(steer_path).write_text(
        yaml.safe_dump(payload, allow_unicode=True, sort_keys=False)
    )

    # Stamp the proposal so it cannot be accepted again and so the next report
    # shows it as accepted rather than still waiting.
    stamped = dict(data)
    stamped["accepted_at"] = payload["accepted_at"]
    try:
        path.write_text(yaml.safe_dump(stamped, allow_unicode=True, sort_keys=False))
    except OSError as exc:
        print(f"  WARNING: the steer was written but {path} could not be stamped: {exc}")

    print(f"Accepted the proposal into {steer_path}.")
    if previous.get("steer"):
        print(f"  was: {previous['steer']}")
    else:
        print("  was: no steer active")
    print(f"  now: {steer}")
    print(f"  section lean: {payload['section_weights'] or 'unchanged'}")
    return 0
