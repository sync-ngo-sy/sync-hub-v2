"""The answer to "what happened?", written for whoever asked rather than whoever ran it.

The ledger is the record, but it is a JSON file of 5,000 objects — true and unreadable. This
turns it into two things a person can act on: a summary of where everybody got to, and, for
everybody who is not yet findable, which of the ten facts they are missing and what to do about
it. Both go to the terminal; the same content goes to an HTML file, because that is what gets
opened later and forwarded to somebody else.

Nothing here reads Manatal or the database. It reports what the run recorded, so it can be run
any time afterwards and cannot itself change anything.
"""

from __future__ import annotations

import html
from collections import Counter
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from completeness import IN_PLAIN_WORDS, Requirement
from ledger import State

if TYPE_CHECKING:
    from pathlib import Path

    from ledger import Ledger

#: What each state means to somebody who did not write the script.
IN_PLAIN_WORDS_STATE: Final[dict[State, str]] = {
    State.PUBLISHED: "moved across, profile written",
    State.LEFT_ALONE: "moved across, profile left as it was",
    State.IMPORTED: "moved across, waiting for their CV to be read",
    State.NO_RESUME: "skipped — no CV in Manatal to move",
    State.NO_EMAIL: "skipped — no email address, so no account could be made",
    State.ALREADY_REGISTERED: "skipped — they already have an account here",
    State.FAILED: "did not move — see the list below",
}


@dataclass(frozen=True, slots=True)
class Outcome:
    """What one run of the migration amounts to."""

    total: int
    by_state: dict[State, int]
    complete: int
    incomplete: int
    searchable: int
    withheld: int
    missing_counts: dict[Requirement, int]
    failures: tuple[tuple[str, str], ...]

    @property
    def moved(self) -> int:
        return (
            self.by_state.get(State.PUBLISHED, 0)
            + self.by_state.get(State.LEFT_ALONE, 0)
            + self.by_state.get(State.IMPORTED, 0)
        )


def outcome_of(ledger: Ledger) -> Outcome:
    entries = list(ledger)
    published = [entry for entry in entries if entry.state is State.PUBLISHED]
    # `missing` is None until a profile is published, so an unpublished entry is neither complete
    # nor incomplete — it has not been judged yet, and counting it either way would be a claim.
    judged = [entry for entry in published if entry.missing is not None]
    complete = [entry for entry in judged if not entry.missing]

    counted: Counter[Requirement] = Counter()
    for entry in judged:
        for name in entry.missing or ():
            with_a_name = _requirement(name)
            if with_a_name is not None:
                counted[with_a_name] += 1

    return Outcome(
        total=len(entries),
        by_state=dict(ledger.tally()),
        complete=len(complete),
        incomplete=len(judged) - len(complete),
        # Complete and consented: the only people another Tenant can find.
        searchable=sum(1 for entry in complete if entry.consent),
        withheld=sum(1 for entry in complete if not entry.consent),
        missing_counts=dict(counted.most_common()),
        failures=tuple(
            (entry.full_name or entry.manatal_candidate_id, entry.error or "no reason recorded")
            for entry in entries
            if entry.state is State.FAILED
        ),
    )


def _requirement(name: str) -> Requirement | None:
    try:
        return Requirement(name)
    except ValueError:  # pragma: no cover — a ledger written by a newer version of this script
        return None


def lines(outcome: Outcome) -> list[str]:
    """The report as the terminal shows it."""
    said = ["", f"{outcome.total} people were looked at in Manatal.", ""]
    for state, total in sorted(outcome.by_state.items(), key=lambda pair: -pair[1]):
        said.append(f"  {total:>6}  {IN_PLAIN_WORDS_STATE.get(state, state.value)}")

    said += ["", "Of the profiles written:", ""]
    said.append(f"  {outcome.complete:>6}  have a complete profile")
    said.append(f"  {outcome.incomplete:>6}  are missing something (listed below)")
    said += ["", "Who other companies can find in Global search:", ""]
    said.append(f"  {outcome.searchable:>6}  agreed in Manatal, so they are searchable")
    said.append(f"  {outcome.withheld:>6}  did not, so they stay private to your own workspace")

    if outcome.missing_counts:
        said += ["", "What the incomplete profiles are missing:", ""]
        for requirement, total in outcome.missing_counts.items():
            said.append(f"  {total:>6}  {IN_PLAIN_WORDS[requirement]}")

    if outcome.failures:
        said += ["", f"{len(outcome.failures)} did not move across at all:", ""]
        for name, why in outcome.failures[:20]:
            said.append(f"  {name}: {why}")
        if len(outcome.failures) > 20:
            said.append(f"  ... and {len(outcome.failures) - 20} more, all listed in the report.")
        said += ["", "Running the migration again retries only these."]
    return said


def as_html(outcome: Outcome, *, ledger_path: Path) -> str:
    """The same report as a file somebody can open, keep, and send on."""
    return _PAGE.format(
        summary=_table(
            "Where everybody got to",
            [
                (IN_PLAIN_WORDS_STATE.get(state, state.value), total)
                for state, total in sorted(outcome.by_state.items(), key=lambda pair: -pair[1])
            ],
        ),
        profiles=_table(
            "Of the profiles written",
            [
                ("Complete", outcome.complete),
                ("Missing something", outcome.incomplete),
            ],
        ),
        searchable=_table(
            "Who other companies can find",
            [
                ("Agreed in Manatal, so searchable", outcome.searchable),
                ("Did not agree, so private to your workspace", outcome.withheld),
            ],
        ),
        missing=_table(
            "What the incomplete profiles are missing",
            [
                (IN_PLAIN_WORDS[requirement], total)
                for requirement, total in outcome.missing_counts.items()
            ],
        )
        if outcome.missing_counts
        else "",
        failures=_failures(outcome),
        total=outcome.total,
        moved=outcome.moved,
        ledger=html.escape(str(ledger_path)),
    )


def as_markdown(outcome: Outcome) -> str:
    """The same report as GitHub renders it on the run's own page.

    Written for somebody who opened the run to find out how it went and should not have to
    download anything to know.
    """
    said = [
        "## Manatal migration",
        "",
        f"**{outcome.moved} of {outcome.total} people were moved into Sync.**",
        "",
        "| | |",
        "| --- | --: |",
    ]
    said += [
        f"| {IN_PLAIN_WORDS_STATE.get(state, state.value)} | {total} |"
        for state, total in sorted(outcome.by_state.items(), key=lambda pair: -pair[1])
    ]
    said += [
        "",
        "### Of the profiles written",
        "",
        "| | |",
        "| --- | --: |",
        f"| Complete | {outcome.complete} |",
        f"| Missing something | {outcome.incomplete} |",
        "",
        "### Who other companies can find in Global search",
        "",
        "| | |",
        "| --- | --: |",
        f"| Agreed in Manatal, so searchable | {outcome.searchable} |",
        f"| Did not agree, so private to your workspace | {outcome.withheld} |",
    ]
    if outcome.missing_counts:
        said += [
            "",
            "### What the incomplete profiles are missing",
            "",
            "| | |",
            "| --- | --: |",
        ]
        said += [
            f"| {IN_PLAIN_WORDS[requirement]} | {total} |"
            for requirement, total in outcome.missing_counts.items()
        ]
    if outcome.failures:
        said += [
            "",
            f"### Did not move across ({len(outcome.failures)})",
            "",
            "Running this again retries only these.",
            "",
            "| Who | Why |",
            "| --- | --- |",
        ]
        said += [f"| {_cell(name)} | {_cell(why)} |" for name, why in outcome.failures[:50]]
        if len(outcome.failures) > 50:
            said.append(f"| … and {len(outcome.failures) - 50} more | see the report file |")
    return "\n".join([*said, ""])


def _cell(text: str) -> str:
    """Table cells cannot hold a pipe or a newline, and this text came from Manatal."""
    return text.replace("|", "\\|").replace("\n", " ").replace("\r", " ")


def _table(heading: str, rows: list[tuple[str, int]]) -> str:
    if not rows:
        return ""
    body = "".join(
        f"<tr><td>{html.escape(label)}</td><td class='n'>{total}</td></tr>"
        for label, total in rows
    )
    return f"<h2>{html.escape(heading)}</h2><table>{body}</table>"


def _failures(outcome: Outcome) -> str:
    if not outcome.failures:
        return (
            "<h2>Nothing failed</h2><p>Every candidate was either moved across or "
            "deliberately skipped for one of the reasons above.</p>"
        )
    body = "".join(
        f"<tr><td>{html.escape(name)}</td><td>{html.escape(why)}</td></tr>"
        for name, why in outcome.failures
    )
    return (
        f"<h2>Did not move across ({len(outcome.failures)})</h2>"
        "<p>Running the migration again retries only these.</p>"
        f"<table><tr><th>Who</th><th>Why</th></tr>{body}</table>"
    )


_PAGE: Final = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Manatal migration report</title>
<style>
 :root {{ color-scheme: light dark; }}
 body {{ font: 16px/1.5 system-ui, sans-serif; max-width: 46rem;
         margin: 3rem auto; padding: 0 1rem; }}
 h1 {{ font-size: 1.5rem; }}
 h2 {{ font-size: 1.05rem; margin-top: 2rem; }}
 table {{ border-collapse: collapse; width: 100%; }}
 td, th {{ border-bottom: 1px solid rgba(128,128,128,.35);
           padding: .45rem .3rem; text-align: left; }}
 .n {{ text-align: right; font-variant-numeric: tabular-nums; width: 6rem; }}
 .lead {{ font-size: 1.1rem; }}
 footer {{ margin-top: 3rem; font-size: .85rem; opacity: .75; }}
</style></head><body>
<h1>Manatal migration report</h1>
<p class="lead">{moved} of {total} people were moved into Sync.</p>
{summary}
{profiles}
{searchable}
{missing}
{failures}
<footer>The full record of which Manatal candidate became which person here is in
<code>{ledger}</code>. Keep it: after Manatal is switched off it is the only copy.</footer>
</body></html>
"""
