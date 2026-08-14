"""What Manatal actually holds about a candidate, and where each of it goes.

Run this before trusting a migration. A field map written from documentation is a guess; this
counts what the account in front of you really returns, how often it is filled, and which of it
the migration reads. Anything it reports as `decide` is data nobody has ruled on yet — either it
gets a home, or somebody accepts losing it when Manatal is switched off.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Final

from manatal import (
    COMPANY_KEYS,
    DEGREE_KEYS,
    DESCRIPTION_KEYS,
    HEADLINE_KEYS,
    ID_KEYS,
    LOCATION_KEYS,
    NAME_KEYS,
    PHONE_KEYS,
    PICTURE_KEYS,
    SKILL_KEYS,
    TAG_KEYS,
    UNIVERSITY_KEYS,
)

if TYPE_CHECKING:
    from collections.abc import Iterable, Mapping, Sequence

    from manatal import Candidate

#: How much of a value to show as an example. Enough to recognise the field, not enough to turn
#: the report into a data dump of somebody's CV.
SAMPLE_LENGTH: Final = 60

#: Blobs whose own keys are worth counting one by one.
NESTED: Final = ("custom_fields",)


class Home(StrEnum):
    """What the migration does with a field."""

    MIGRATED = "migrated"
    ARCHIVED = "archived only"
    IGNORED = "no home in Sync"
    DECIDE = "decide"


@dataclass(frozen=True, slots=True)
class Mapped:
    home: Home
    lands_in: str


#: The field map, as this migration currently understands it. Keys are matched
#: case-insensitively. Anything Manatal returns that is not in here comes back as `decide`,
#: which is the whole point: an unknown field is a decision somebody owes, not a silent drop.
FIELD_MAP: Final[dict[str, Mapped]] = {
    **{key: Mapped(Home.MIGRATED, "the ledger's key for this candidate") for key in ID_KEYS},
    **{key: Mapped(Home.MIGRATED, "profiles.full_name") for key in NAME_KEYS},
    "first_name": Mapped(Home.MIGRATED, "profiles.full_name"),
    "last_name": Mapped(Home.MIGRATED, "profiles.full_name"),
    "email": Mapped(Home.MIGRATED, "auth.users.email"),
    "emails": Mapped(Home.MIGRATED, "auth.users.email (the first)"),
    **{key: Mapped(Home.MIGRATED, "profiles.phone") for key in PHONE_KEYS},
    **{key: Mapped(Home.MIGRATED, "candidates.headline") for key in HEADLINE_KEYS},
    **{key: Mapped(Home.MIGRATED, "candidates.unmapped_skills") for key in SKILL_KEYS},
    **{
        key: Mapped(Home.MIGRATED, "candidates.location_key, matched by name")
        for key in LOCATION_KEYS
    },
    **{
        key: Mapped(Home.MIGRATED, "candidate_experiences, with the position")
        for key in COMPANY_KEYS
    },
    **{key: Mapped(Home.MIGRATED, "candidate_educations.degree") for key in DEGREE_KEYS},
    **{key: Mapped(Home.MIGRATED, "candidate_educations.institution") for key in UNIVERSITY_KEYS},
    **{
        key: Mapped(Home.MIGRATED, "a Note, private to the importing Tenant")
        for key in DESCRIPTION_KEYS
    },
    **{key: Mapped(Home.MIGRATED, "profiles.avatar_url") for key in PICTURE_KEYS},
    **{key: Mapped(Home.MIGRATED, "tenant_tags and an assignment") for key in TAG_KEYS},
    "custom_fields": Mapped(Home.MIGRATED, "a Note, private to the importing Tenant"),
    "custom_fields.spokenenglishproficiencylevel": Mapped(
        Home.MIGRATED, "candidate_languages (en), and the Note in full"
    ),
    "custom_fields.writtenenglishproficiencylevel": Mapped(
        Home.MIGRATED, "candidate_languages (en), and the Note in full"
    ),
    "custom_fields.graduationyear": Mapped(Home.MIGRATED, "candidate_educations.graduation_year"),
    "custom_fields.highestdegree": Mapped(
        Home.MIGRATED, "candidate_educations.degree, where Manatal's own is empty"
    ),
    "custom_fields.linkedinprofile": Mapped(Home.MIGRATED, "the Note — Sync holds no social links"),
    "custom_fields.reference": Mapped(Home.MIGRATED, "the Note"),
    "custom_fields.positiontype": Mapped(Home.MIGRATED, "the Note"),
    "custom_fields.role": Mapped(Home.IGNORED, "a Manatal portal role, meaningless here"),
    "resume": Mapped(Home.MIGRATED, "the cvs bucket, then the CV parse"),
    "resume_url": Mapped(Home.MIGRATED, "the cvs bucket, then the CV parse"),
    "updated_at": Mapped(Home.MIGRATED, "the ledger"),
    "created_at": Mapped(Home.MIGRATED, "the ledger"),
    # Read off the CV instead. Manatal's own structured sections are archived rather than
    # written, because the parse produces the taxonomy-mapped shape this schema stores and two
    # sources writing the same tables is how a profile ends up with everything twice.
    "experiences": Mapped(Home.ARCHIVED, "candidate_experiences, from the CV parse"),
    "educations": Mapped(Home.ARCHIVED, "candidate_educations, from the CV parse"),
    "languages": Mapped(Home.ARCHIVED, "candidate_languages, from the CV parse"),
    # Manatal's own workflow, which does not survive the move by design.
    # Demographic data this platform does not collect. Not an oversight and not a gap to close:
    # a schema with nowhere to put somebody's gender cannot screen on it by accident.
    "gender": Mapped(Home.IGNORED, "Sync holds no demographic data, by design"),
    "birth_date": Mapped(Home.IGNORED, "Sync holds no demographic data, by design"),
    # Manatal's own bookkeeping, meaningless once it is switched off.
    "hash": Mapped(Home.IGNORED, "Manatal's own identifier"),
    "external_id": Mapped(Home.IGNORED, "Manatal's own identifier"),
    "creator": Mapped(Home.IGNORED, "a Manatal user id, which names nobody here"),
    "source_type": Mapped(Home.IGNORED, "how they reached Manatal, which Sync cannot restate"),
    "source_details": Mapped(Home.IGNORED, "how they reached Manatal, which Sync cannot restate"),
    "source_other": Mapped(Home.IGNORED, "how they reached Manatal, which Sync cannot restate"),
    "zipcode": Mapped(Home.IGNORED, "the location taxonomy is as fine-grained as Sync gets"),
    "candidate_industries": Mapped(Home.IGNORED, "Sync has no industry taxonomy"),
    "current_department": Mapped(Home.IGNORED, "Sync records the company, not the department"),
    # Read this one before the run rather than after.
    "consent": Mapped(Home.DECIDE, "nothing yet — and it bears on Global search"),
    "consent_date": Mapped(Home.DECIDE, "nothing yet — and it bears on Global search"),
    "stage": Mapped(Home.IGNORED, "Sync has its own Pipeline, per Application"),
    "status": Mapped(Home.IGNORED, "Sync has its own Pipeline, per Application"),
    "owner": Mapped(Home.IGNORED, "imports are attributed to the configured Recruiter"),
    "organization": Mapped(Home.IGNORED, "the importing Tenant is the organization here"),
}


@dataclass
class Field:
    """One key Manatal returned, and how much of the account actually has it."""

    key: str
    present: int = 0
    filled: int = 0
    kinds: Counter[str] = field(default_factory=Counter)
    example: str = ""

    def saw(self, value: object) -> None:
        self.present += 1
        self.kinds[type(value).__name__] += 1
        if _is_filled(value):
            self.filled += 1
            if not self.example:
                self.example = _sample(value)

    def fill_rate(self, of: int) -> float:
        return 0.0 if of == 0 else self.filled / of

    @property
    def mapped(self) -> Mapped:
        return FIELD_MAP.get(self.key.lower(), Mapped(Home.DECIDE, "nothing yet"))


@dataclass
class Census:
    """Every field seen across the candidates read, and what becomes of each."""

    counted: int = 0
    fields: dict[str, Field] = field(default_factory=dict)

    def read(self, candidates: Iterable[Candidate]) -> Census:
        for candidate in candidates:
            self.counted += 1
            for key, value in candidate.raw.items():
                self.fields.setdefault(key, Field(key=key)).saw(value)
                # An account keeps everything its recruiters actually asked for in custom
                # fields, so counting the blob as one field hides the real inventory.
                if key in NESTED and isinstance(value, dict):
                    for inner, held in value.items():
                        nested = f"{key}.{inner}"
                        self.fields.setdefault(nested, Field(key=nested)).saw(held)
        return self

    def by_home(self, home: Home) -> list[Field]:
        return sorted(
            (found for found in self.fields.values() if found.mapped.home is home),
            key=lambda found: (-found.filled, found.key),
        )

    @property
    def undecided(self) -> list[Field]:
        """Fields nobody has ruled on that some candidate actually has data in. Empty ones are
        not worth a decision; these are."""
        return [found for found in self.by_home(Home.DECIDE) if found.filled]

    def as_lines(self) -> list[str]:
        lines = [f"Read {self.counted} candidates from Manatal.", ""]
        for home in Home:
            found = self.by_home(home)
            if not found:
                continue
            lines.append(f"{home.value.upper()} ({len(found)})")
            lines += [
                f"  {entry.key:<28} {entry.fill_rate(self.counted):>6.0%} filled  "
                f"→ {entry.mapped.lands_in}" + (f"   e.g. {entry.example}" if entry.example else "")
                for entry in found
            ]
            lines.append("")
        if self.undecided:
            lines += [
                "Undecided fields carrying data:",
                "  " + ", ".join(entry.key for entry in self.undecided),
                "",
                "Each is either given a home in the migration or knowingly dropped. They are",
                "archived either way, so this is a decision you can still take afterwards.",
            ]
        else:
            lines.append("Every field carrying data has a decision against it.")
        return lines


def census_of(candidates: Sequence[Candidate]) -> Census:
    return Census().read(candidates)


def _is_filled(value: object) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list | dict | tuple):
        return bool(value)
    return True


def _sample(value: object) -> str:
    shown = ", ".join(str(entry) for entry in value) if isinstance(value, list) else str(value)
    shown = " ".join(shown.split())
    return shown if len(shown) <= SAMPLE_LENGTH else f"{shown[:SAMPLE_LENGTH]}…"


def as_mapping(candidate: Candidate) -> Mapping[str, Any]:
    """The archive record for one candidate: everything Manatal said, plus what we read it as."""
    return {
        "manatal_candidate_id": candidate.external_id,
        "read_as": {
            "full_name": candidate.full_name,
            "email": candidate.email,
            "phone": candidate.phone,
            "headline": candidate.headline,
            "skills": list(candidate.skills),
            "updated_at": (
                None if candidate.updated_at is None else candidate.updated_at.isoformat()
            ),
        },
        "manatal_record": dict(candidate.raw),
    }
