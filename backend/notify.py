"""Notification seam — NO-OP STUB (v1).

A private web dashboard only works for someone with unpredictable bandwidth if
something pings them when a new issue is up. The issue already carries The Brief
(top-3) in its JSON, so a future scheduler can call notify(issue) to push a
one-line "new issue is up + top 3" message (email / WhatsApp). Not built in v1;
the seam is — wiring a provider in here requires no pipeline changes.
"""

from __future__ import annotations


def notify(issue: dict) -> None:
    # TODO(later): send a one-line "new issue is up" ping using issue["brief"].
    brief = issue.get("brief", [])
    print(f"  [notify] (stub) new issue {issue.get('id')} — {len(brief)} brief items")
