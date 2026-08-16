"""Writing the seeded world, through the API's own services and nothing else.

This module deliberately calls no SQL of its own for anything a Recruiter or a Candidate could
do in the product. An Application is submitted by `ApplicationService.submit`, so its Snapshot
is copied and its Screening verdict computed the same way a real one is; a move goes through
`ApplicationReviewService.move`, so the status history, the Candidate's Notification and the
rejection email all happen because the code that owns them ran.

The exceptions are named where they appear, and each is something no client can do:

- the two rows a Candidate's Profile is (the service that writes them also sends a confirmation
  email and hands back nothing the seed can use);
- settling `ingestion_jobs`, which the worker's queue engine owns rather than the pipeline;
- `job_view_events`, which are written by a public GET the seed would otherwise have to fake a
  browser for — and would still not be able to spread over a month;
- a Tenant's `plan`, which nothing in the product sets at all.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from io import BytesIO
from secrets import token_hex, token_urlsafe
from typing import TYPE_CHECKING, Final

from fastapi import UploadFile
from sqlalchemy import select, update
from starlette.datastructures import Headers

from seed import cast
from seed.documents import as_docx, as_pdf, cv_lines
from sync_api.access_requests import AccessRequestService
from sync_api.applications import (
    ApplicationReviewService,
    ApplicationService,
    ApplicationStatusChange,
    HireAnswer,
    MatchAssessmentService,
    NewApplication,
    SubmittedAnswer,
)
from sync_api.auth import ActingProfile
from sync_api.candidates import ActingCandidate, CandidateProfile, CandidateProfileService
from sync_api.crm import (
    ABOUT_APPLICATIONS,
    ABOUT_CANDIDATES,
    ON_APPLICATIONS,
    ON_CANDIDATES,
    NewNote,
    NewTag,
    NoteService,
    TagAssignmentService,
    TagService,
    TalentPoolService,
)
from sync_api.cvs import CvService
from sync_api.jobs import (
    JobChanges,
    JobService,
    NewTrackedLink,
    TrackedLinkChanges,
    TrackedLinkService,
    Visitor,
)
from sync_api.messaging import (
    MessageTemplateChanges,
    MessageTemplateService,
    NewMessageTemplate,
    OutgoingMessage,
    OutreachService,
)
from sync_api.platform import PlatformService, create_platform_admin
from sync_api.tenants import ActingRecruiter, TenantService, TenantSummary
from sync_assessments import AssessedMatch
from sync_assessments.openai_assessor import OpenAiMatchAssessor
from sync_core import transaction
from sync_core.models import (
    AccountType,
    ApplicationStatus,
    AssessmentStatus,
    Candidate,
    CanonicalRole,
    IngestionJob,
    IngestionStatus,
    JobStatus,
    JobViewEvent,
    Language,
    LanguageProficiency,
    Location,
    MatchAssessmentJob,
    Profile,
    SkillImportance,
    SkillTaxonomy,
    Tenant,
)
from sync_ingestion import CvIngestion
from sync_ingestion.review import Vocabularies, reviewable
from sync_parsers import (
    CvFile,
    ParsedCv,
    ParsedEducation,
    ParsedExperience,
    ParsedLanguage,
    ParsedProject,
    ParsedSkill,
    Vocabulary,
)

if TYPE_CHECKING:
    from decimal import Decimal
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

    from seed.identities import Identities
    from sync_api.auth import GoTrue
    from sync_assessments import (
        AssessedApplication,
        HeldSkill,
        MatchAssessor,
        MatchRequest,
        RequiredLanguage,
        RequiredSkill,
    )
    from sync_core import Database, Settings, Storage

#: Named so a reader of `application_ai_match_assessments.model_name` can tell at a glance that
#: no model wrote the row. A seed that put `gpt-4o-mini` there would be inventing evidence.
SEED_ASSESSOR: Final = "seed-assessor"

#: What a CV parse failed with, on the one Candidate seeded into that state.
A_FAILED_PARSE: Final = "The file is a photograph of a document rather than a document."


class _NeverParses:
    """Stands in for the CV extractor `CvIngestion` is built with.

    The seed only ever calls `store` and `fail`, neither of which reads a file: one writes
    a parse that has already been derived from the profile, the other records that there
    will not be one. Reaching a model from a seed would cost money and make the fixtures
    different on every run.
    """

    model = "never-parses"

    async def extract(self, file: CvFile, vocabulary: Vocabulary) -> ParsedCv:
        raise NotImplementedError("the seed derives a parse rather than reading one")


class Clock:
    """One instant the whole seed is measured back from.

    Every fixture says "days ago" rather than a date: the Dashboard's windows are rolling, so a
    seed pinned to dates would fall out of "the last 7 days" on its second day.
    """

    def __init__(self) -> None:
        self.now = datetime.now(UTC)

    def ago(self, days: float) -> datetime:
        return self.now - timedelta(days=days)

    def after(self, moment: datetime, *, hours: float) -> datetime:
        """A moment a little later, never later than now — history has to stay in the past."""
        return min(moment + timedelta(hours=hours), self.now - timedelta(seconds=1))


@dataclass
class Seeded:
    """Every id the seed made, so the passes after it can find their rows."""

    clock: Clock
    operator: UUID | None = None
    tenants: dict[str, UUID] = field(default_factory=dict)
    recruiters: dict[str, UUID] = field(default_factory=dict)
    candidates: dict[str, UUID] = field(default_factory=dict)
    cvs: dict[tuple[str, str], UUID] = field(default_factory=dict)
    jobs: dict[str, UUID] = field(default_factory=dict)
    links: dict[str, UUID] = field(default_factory=dict)
    link_tokens: dict[str, str] = field(default_factory=dict)
    applications: dict[tuple[str, str], UUID] = field(default_factory=dict)
    tags: dict[tuple[str, str], UUID] = field(default_factory=dict)
    templates: dict[tuple[str, str], UUID] = field(default_factory=dict)
    counts: dict[str, int] = field(default_factory=dict)

    def counted(self, what: str, many: int = 1) -> None:
        self.counts[what] = self.counts.get(what, 0) + many


#: How much of the score the Job's own criteria carry. The rest is how strong the application
#: reads in itself — the same split the instructions give a real model, because a stand-in that
#: graded a different thing would make the seeded world a poor rehearsal for the deployed one.
_CRITERIA_SHARE: Final = 0.5

#: Where "deep" starts. Beyond it, more years stop adding to the score: the difference between
#: eight years and twenty is not what a Recruiter is sorting on.
_DEEP_YEARS: Final = 8

#: A work history long enough to show a direction rather than a single post.
_ENOUGH_ROLES: Final = 3

#: What a half with nothing in it scores. A Job that states no criteria at all has not said the
#: applicant answers none of them, so neither 0 nor 100 would be honest.
_NOTHING_TO_WEIGH: Final = 0.5

#: `language_proficiency` is an unordered enum in Postgres; this is the order it means. Spelled
#: again here rather than reached for inside Screening, which keeps its own copy private — the
#: stand-in is not entitled to Screening's internals just because it grades the same criteria.
_PROFICIENCIES: Final = (
    LanguageProficiency.BEGINNER,
    LanguageProficiency.INTERMEDIATE,
    LanguageProficiency.ADVANCED,
    LanguageProficiency.FLUENT,
    LanguageProficiency.NATIVE,
)


class SeedAssessor:
    """Deterministic advice, in the shape a model's would take — and grading what a model is
    told to grade.

    The stand-in for a reseed with no OpenAI key. It weighs the Job's criteria for about half
    the score, exactly as the instructions do, and the strength of the application itself for
    the rest: how deep the work goes, whether the roles show a progression, whether the
    candidate said what they actually did, and how much of the profile they filled in.

    It grades every part rather than ticking it. A checklist over the required skills is what
    this used to be, and on a Job asking for one or two skills it could only answer 0 or 100 —
    a number that told a Recruiter nothing Screening had not already told them, in a column
    meant for sorting.
    """

    model = SEED_ASSESSOR

    async def assess(self, request: MatchRequest) -> AssessedMatch:
        job, applied = request.job, request.application
        required = [skill for skill in job.skills if skill.importance is SkillImportance.REQUIRED]
        held = {skill.name: skill for skill in applied.skills}
        evidenced = [skill.name for skill in required if skill.name in held]
        missing = [skill.name for skill in required if skill.name not in held]

        evidence = _evidence_score(applied)
        criteria = _weighed(
            (0.50, _skills_score(required, held)),
            (0.30, _experience_score(job.minimum_total_experience_years, applied)),
            (0.20, _languages_score(job.languages, applied)),
        )
        craft = _weighed(
            (0.30, _depth_score(applied)),
            (0.20, _progression_score(applied)),
            (0.30, evidence),
            (0.20, _substantiation_score(applied)),
        )
        share = round(100.0 * (_CRITERIA_SHARE * criteria + (1 - _CRITERIA_SHARE) * craft), 1)

        return AssessedMatch(
            match_percentage=share,
            explanation=(
                f"{applied.headline or 'The application'} against {job.title}: "
                f"{len(evidenced)} of {len(required) or 'no'} required skills evidenced, "
                f"{applied.total_experience_years or 0} years of work across "
                f"{len(applied.experiences)} roles. Seeded advice, not a model's."
            ),
            strengths=[f"{name} is evidenced" for name in evidenced]
            + [
                entry.job_title
                for entry in applied.experiences
                if entry.description and entry.is_current
            ],
            gaps=[f"{name} is not listed" for name in missing]
            + (
                []
                if evidence > 0.5
                else ["The work history says the roles but not what was done in them"]
            ),
        )


def _weighed(*parts: tuple[float, float | None]) -> float:
    """The parts that apply, averaged by their weight. A Job asking for no languages is not a
    Job the applicant scored zero on — that part simply is not one of the things being weighed,
    so the weights left redistribute over themselves."""
    counted = [(weight, score) for weight, score in parts if score is not None]
    total = sum(weight for weight, _ in counted)
    if not total:
        return _NOTHING_TO_WEIGH
    return sum(weight * score for weight, score in counted) / total


def _skills_score(required: list[RequiredSkill], held: dict[str, HeldSkill]) -> float | None:
    """Part marks per skill: holding it is most of the answer, and holding it for as long as
    the Job asked is the rest."""
    if not required:
        return None
    earned = 0.0
    for skill in required:
        carried = held.get(skill.name)
        if carried is None:
            continue
        earned += 0.7
        wanted = skill.minimum_years
        years = carried.years_experience
        if wanted is None or years is None:
            earned += 0.15
        else:
            earned += 0.3 * min(1.0, float(years) / wanted)
    return min(1.0, earned / len(required))


def _experience_score(minimum: Decimal | None, applied: AssessedApplication) -> float | None:
    years = applied.total_experience_years
    if years is None:
        return None
    if minimum is None or minimum <= 0:
        return min(1.0, years / _DEEP_YEARS)
    return min(1.0, years / float(minimum))


def _languages_score(
    wanted: tuple[RequiredLanguage, ...], applied: AssessedApplication
) -> float | None:
    if not wanted:
        return None
    spoken = {language.name: language.proficiency for language in applied.languages}
    earned = 0.0
    for language in wanted:
        held = spoken.get(language.name)
        if held is None:
            continue
        earned += (
            1.0
            if _PROFICIENCIES.index(held) >= _PROFICIENCIES.index(language.minimum_proficiency)
            else 0.5
        )
    return earned / len(wanted)


def _depth_score(applied: AssessedApplication) -> float | None:
    years = applied.total_experience_years
    return None if years is None else min(1.0, years / _DEEP_YEARS)


def _progression_score(applied: AssessedApplication) -> float:
    return min(1.0, len(applied.experiences) / _ENOUGH_ROLES)


def _evidence_score(applied: AssessedApplication) -> float:
    """Whether the roles say what was done in them, rather than only that they were held."""
    if not applied.experiences:
        return 0.0
    said = [entry for entry in applied.experiences if entry.description]
    return len(said) / len(applied.experiences)


def _substantiation_score(applied: AssessedApplication) -> float:
    """How much of the profile the Candidate actually filled in."""
    filled = [
        bool(applied.summary),
        bool(applied.educations),
        bool(applied.projects),
        bool(applied.headline),
    ]
    return sum(filled) / len(filled)


def _the_assessor(settings: Settings) -> MatchAssessor:
    """The real model where there is a key for one, and the stand-in where there is not.

    The seeded world is what the platform is judged by before anybody's real Applications
    arrive, and a Match score is only worth looking at if it behaves the way the deployed one
    will. So the seed pays for the calls — a couple of dozen of them, once per reseed — rather
    than showing a number no model produced.

    Falling back rather than failing keeps a reseed possible with no key at all, which is what
    a contributor who only wants the fixtures has. The rows then say `seed-assessor`, so nobody
    mistakes the stand-in's arithmetic for a reading.
    """
    if settings.openai_api_key is None:
        print(
            "  No SYNC_OPENAI_API_KEY: Match scores will be the stand-in's arithmetic, "
            f"recorded as {SEED_ASSESSOR!r} rather than as a model."
        )
        return SeedAssessor()
    return OpenAiMatchAssessor.build(
        api_key=settings.openai_api_key.get_secret_value(),
        model=settings.openai_assessment_model,
        timeout_seconds=settings.openai_timeout_seconds,
    )


class World:
    """The seed, in the order the constraints allow it to be written."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        database: Database,
        gotrue: GoTrue,
        identities: Identities,
        storage: Storage,
        settings: Settings,
    ) -> None:
        self._db = session
        self._gotrue = gotrue
        self._identities = identities
        self._storage = storage
        self._settings = settings
        self._seeded = Seeded(clock=Clock())
        self._acting: dict[str, ActingRecruiter] = {}
        self._candidate_acting: dict[str, ActingCandidate] = {}
        self._questions: dict[tuple[str, str], UUID] = {}
        self._sessions: dict[tuple[str, str], str] = {}
        # `store` and `fail` are the two halves of the pipeline that need no model: one
        # writes a parse that already exists, the other records that there will not be one.
        self._ingestion = CvIngestion(database, storage, _NeverParses())
        # Built once: every Application in the world is read through the same one, so the
        # scores in a seeded pipeline can be compared with each other.
        self._assessor = _the_assessor(settings)

    async def build(self) -> Seeded:
        await self._operator()
        await self._access_requests()
        await self._workspaces()
        await self._people()
        await self._postings()
        await self._traffic()
        await self._pipelines()
        await self._closures()
        await self._records()
        return self._seeded

    # ── The operator, and the queue a Tenant starts in ────────────────────────────────────

    async def _operator(self) -> None:
        admin = await create_platform_admin(
            self._db,
            self._gotrue,
            email=cast.OPERATOR.email,
            password=cast.PASSWORD,
            full_name=cast.OPERATOR.full_name,
        )
        self._seeded.operator = admin.id
        self._seeded.counted("platform admins")

    async def _access_requests(self) -> None:
        """Every ask a stranger could have typed, in each of the three states one can be in."""
        service = self._requests()
        for asked in cast.ACCESS_REQUESTS:
            await service.submit(
                company=asked.company, full_name=asked.full_name, email=asked.email
            )
            self._seeded.counted("access requests")
        for asked in cast.ACCESS_REQUESTS:
            if asked.outcome == "dismissed":
                await service.dismiss(await self._pending_id(asked.email))

    async def _workspaces(self) -> None:
        """Each Tenant, its founding admin, and the team they invited."""
        for tenant in cast.TENANTS:
            if tenant.from_access_request:
                # The real route in: converting the ask opens the Tenant and invites the person
                # it named. Nothing about the Tenant is retyped here.
                created = await self._requests().convert(
                    await self._pending_id(tenant.admin.email), slug=tenant.slug
                )
                tenant_id, admin_id = created.tenant.id, created.founding_admin.id
            else:
                created = await self._platform().create_tenant(
                    name=tenant.name,
                    slug=tenant.slug,
                    email=tenant.admin.email,
                    full_name=tenant.admin.full_name,
                )
                tenant_id, admin_id = created.tenant.id, created.founding_admin.id

            self._seeded.tenants[tenant.key] = tenant_id
            self._seeded.recruiters[tenant.admin.key] = admin_id
            self._seeded.counted("tenants")
            self._seeded.counted("recruiters")
            await self._identities.settle(admin_id, password=cast.PASSWORD)

            members = TenantService(self._db, self._gotrue, recruiter_portal_url=self._portal())
            for teammate in tenant.team:
                invited = await members.invite(
                    tenant_id=tenant_id,
                    email=teammate.email,
                    full_name=teammate.full_name,
                    role=teammate.role,
                )
                self._seeded.recruiters[teammate.key] = invited.id
                self._seeded.counted("recruiters")
                await self._identities.settle(invited.id, password=cast.PASSWORD)
                if not teammate.is_active:
                    await members.change_member(
                        tenant_id=tenant_id, recruiter_id=invited.id, is_active=False
                    )

            # The plan is the one thing about a Tenant nothing in the product can set — worth
            # knowing, and worth seeding all three of so the Platform Portal has them to render.
            async with transaction(self._db):
                await self._db.execute(
                    update(Tenant).where(Tenant.id == tenant_id).values(plan=tenant.plan)
                )
            if not tenant.is_active:
                await self._platform().set_tenant_status(tenant_id, is_active=False)

    # ── Candidates: accounts, CV files, parses, profiles ──────────────────────────────────

    async def _people(self) -> None:
        for person in cast.CANDIDATES:
            profile_id = await self._identities.confirmed(
                email=person.email, password=cast.PASSWORD
            )
            # The two rows `AuthService._provision_candidate` writes. Reached directly because
            # the service around it also mints an identity and mails a confirmation link, and
            # the account here is already confirmed.
            async with transaction(self._db):
                self._db.add(
                    Profile(
                        id=profile_id,
                        account_type=AccountType.CANDIDATE,
                        full_name=person.profile.full_name,
                    )
                )
                await self._db.flush()
                self._db.add(Candidate(id=profile_id))

            self._seeded.candidates[person.key] = profile_id
            self._seeded.counted("candidates")
            self._candidate_acting[person.key] = ActingCandidate(
                profile=ActingProfile(
                    id=profile_id,
                    email=person.email,
                    full_name=person.profile.full_name,
                    account_type=AccountType.CANDIDATE,
                    avatar_url=None,
                    phone=person.profile.phone,
                    phone_country=person.profile.phone_country,
                    has_account_row=True,
                )
            )

            await self._cvs_of(person, profile_id)
            if person.profile.skills or person.profile.experiences:
                await CandidateProfileService(self._db).replace(profile_id, person.profile)
                self._seeded.counted("profiles filled in")

    async def _cvs_of(self, person: cast.SeededCandidate, profile_id: UUID) -> None:
        service = CvService(self._db, self._storage, self._settings)
        location = await self._location_name(person.profile.location_key)

        for entry in person.cvs:
            said = _as_of(person.profile, entry.trims)
            lines = cv_lines(said, email=person.email, location=location)
            body = as_docx(lines) if entry.kind == "docx" else as_pdf(lines)
            uploaded = await service.upload(profile_id, _an_upload(entry.display_name, body))
            cv_id = uploaded.id
            self._seeded.cvs[person.key, entry.display_name] = cv_id
            self._seeded.counted("CVs")

            if entry.state == "ready":
                parsed = await self._parse_of(person, entry, location, said)
                async with transaction(self._db):
                    await self._ingestion.store(self._db, cv_id, parsed)
                await self._settle_ingestion(cv_id, ok=True)
            else:
                # Writes the Notification the Candidate is told by, exactly as the worker would.
                async with transaction(self._db):
                    await self._ingestion.fail(self._db, cv_id, A_FAILED_PARSE)
                await self._settle_ingestion(cv_id, ok=False)
                self._seeded.counted("failed CV parses")

        # `store` adopts the first CV read as the current one; anything else is the Candidate's
        # own choice, and deleting is only possible once it is not current.
        for entry in person.cvs:
            if entry.is_current:
                await service.make_current(profile_id, self._cv_of(person, entry))
        for entry in person.cvs:
            if entry.deleted:
                await service.remove(profile_id, self._cv_of(person, entry))
                self._seeded.counted("deleted CVs")

    def _cv_of(self, person: cast.SeededCandidate, entry: cast.SeededCv) -> UUID:
        return self._seeded.cvs[person.key, entry.display_name]

    async def _parse_of(
        self,
        person: cast.SeededCandidate,
        entry: cast.SeededCv,
        location: str | None,
        profile: CandidateProfile,
    ) -> ParsedCv:
        """What the platform read out of the file — normalised by the same code the worker uses.

        Derived from the profile, so the CV, its parse and the profile agree. One CV is seeded
        with a parse that *drifts*: an extra unmapped skill and a headline of its own, so the
        review screen has a real difference to show rather than a form that agrees with itself.
        """
        drift = entry.parse_drifts
        parsed = ParsedCv(
            full_name=profile.full_name,
            email=person.email,
            phone=profile.phone,
            detected_language="en",
            canonical_role=profile.canonical_role_key,
            headline=(
                f"{profile.headline} (from the CV)"
                if drift and profile.headline
                else profile.headline
            ),
            summary=profile.summary,
            location=location,
            linkedin_url=profile.linkedin_url,
            github_url=profile.github_url,
            portfolio_url=profile.portfolio_url,
            experiences=[
                ParsedExperience(
                    job_title=held.job_title,
                    company_name=held.company_name,
                    start_year=held.start_year,
                    start_month=held.start_month,
                    end_year=held.end_year,
                    end_month=held.end_month,
                    is_current=held.is_current,
                    description=held.description,
                )
                for held in profile.experiences
            ],
            educations=[
                ParsedEducation(
                    institution=studied.institution,
                    degree=studied.degree,
                    field_of_study=studied.field_of_study,
                    graduation_year=studied.graduation_year,
                    description=studied.description,
                )
                for studied in profile.educations
            ],
            skills=[
                ParsedSkill(name=skill.name, years_experience=skill.years_experience)
                for skill in profile.skills
            ],
            languages=[
                ParsedLanguage(code=spoken.code, proficiency=spoken.proficiency)
                for spoken in profile.languages
            ],
            projects=[
                ParsedProject(
                    name=built.name,
                    description=built.description,
                    project_url=built.project_url,
                    repository_url=built.repository_url,
                    start_year=built.start_year,
                    start_month=built.start_month,
                    end_year=built.end_year,
                    end_month=built.end_month,
                )
                for built in profile.projects
            ],
            unmapped_skills=[*profile.unmapped_skills, *(["Terraform Cloud"] if drift else [])],
        )
        return reviewable(parsed, await self._vocabulary())

    async def _settle_ingestion(self, cv_id: UUID, *, ok: bool) -> None:
        """Close the queue row the `ingest_on_upload` trigger opened.

        The pipeline does not touch `ingestion_jobs` — the worker's queue engine owns that — so
        a seed that left them `pending` would hand a running worker a stack of files to re-read,
        at a cost, for no change.
        """
        settled = self._seeded.clock.now
        async with transaction(self._db):
            await self._db.execute(
                update(IngestionJob)
                .where(IngestionJob.cv_id == cv_id)
                .values(
                    status=IngestionStatus.COMPLETED if ok else IngestionStatus.FAILED,
                    attempts=1 if ok else 3,
                    error_message=None if ok else A_FAILED_PARSE,
                    started_at=settled,
                    completed_at=settled,
                    available_at=None,
                )
            )

    # ── Jobs, criteria and links ──────────────────────────────────────────────────────────

    async def _postings(self) -> None:
        for posting in cast.JOBS:
            recruiter = self._recruiter(posting.author)
            jobs = JobService(self._db)
            created = await jobs.create(recruiter, posting.new)
            self._seeded.jobs[posting.key] = created.id
            self._seeded.counted("jobs")

            # Before the first Application, which locks them for good.
            criteria = await jobs.replace_criteria(recruiter, created.id, posting.criteria)
            for question in criteria.questions:
                self._questions[posting.key, question.question_text] = question.id
            self._seeded.counted("job questions", len(criteria.questions))
            self._seeded.counted("job skill requirements", len(criteria.skills))
            self._seeded.counted("job language requirements", len(criteria.languages))

            # Published now, closed or archived only once its Applications have arrived:
            # applying to a Job that is no longer published is refused, correctly, and a
            # closed Job with a pipeline behind it is a state the product has to render.
            if posting.published_days_ago is not None:
                await jobs.change(recruiter, created.id, JobChanges(status=JobStatus.PUBLISHED))

            links = TrackedLinkService(self._db)
            for link in posting.links:
                made = await links.create(
                    recruiter,
                    created.id,
                    NewTrackedLink(
                        name=link.name,
                        expires_at=(
                            None
                            if link.expires_in_days is None
                            else self._seeded.clock.ago(-link.expires_in_days)
                        ),
                    ),
                )
                self._seeded.links[link.key] = made.id
                self._seeded.link_tokens[link.key] = made.token
                self._seeded.counted("tracked links")
                if not link.is_active:
                    await links.change(
                        recruiter, created.id, made.id, TrackedLinkChanges(is_active=False)
                    )

    async def _traffic(self) -> None:
        """The Job views a month of traffic left behind.

        Written directly, and the one thing here that is: a view is recorded by a public `GET`,
        so the alternative is a fake browser making two hundred requests it would then have to
        have made on two hundred different days. The rows are the same shape the endpoint
        writes — a session id it issued, and a salted hash that is nobody's address.
        """
        rows: list[JobViewEvent] = []
        for posting in cast.JOBS:
            job_id = self._seeded.jobs[posting.key]
            for link in posting.links:
                for index in range(link.views):
                    rows.append(
                        JobViewEvent(
                            job_id=job_id,
                            tracked_link_id=self._seeded.links[link.key],
                            session_id=token_urlsafe(16),
                            visitor_hash=token_hex(32),
                            viewed_at=self._spread(link.created_days_ago, index, link.views),
                        )
                    )
            for index in range(posting.direct_views):
                rows.append(
                    JobViewEvent(
                        job_id=job_id,
                        tracked_link_id=None,
                        session_id=token_urlsafe(16),
                        visitor_hash=token_hex(32),
                        viewed_at=self._spread(
                            posting.published_days_ago or posting.created_days_ago,
                            index,
                            posting.direct_views,
                        ),
                    )
                )
        async with transaction(self._db):
            self._db.add_all(rows)
        self._seeded.counted("job views", len(rows))

    def _spread(self, since_days_ago: float, index: int, many: int) -> datetime:
        """Traffic thinning out as a posting ages, rather than a flat line nobody's ad produces."""
        share = (index + 1) / max(many, 1)
        return self._seeded.clock.ago(since_days_ago * (1 - share**0.6))

    # ── Applications, and where a Recruiter took them ─────────────────────────────────────

    async def _pipelines(self) -> None:
        for applied in cast.APPLICATIONS:
            application_id = await self._submit(applied)
            self._seeded.applications[applied.candidate, applied.job] = application_id
            self._seeded.counted("applications")

            job = _job(applied.job)
            recruiter = self._recruiter(_first_recruiter_of(job.tenant))
            review = ApplicationReviewService(self._db, self._storage, self._settings)
            for status in applied.moves:
                await review.move(
                    recruiter,
                    application_id,
                    ApplicationStatusChange(
                        status=status, start_date=self._started_on(applied, status)
                    ),
                )
                self._seeded.counted("pipeline moves")
            if applied.hire_confirmed is not None:
                await ApplicationService(self._db).answer_hire(
                    self._candidate_acting[applied.candidate],
                    application_id,
                    HireAnswer(confirmed=applied.hire_confirmed),
                )
                self._seeded.counted("answered hire claims")
            if applied.withdrawn:
                await ApplicationService(self._db).withdraw(
                    self._candidate_acting[applied.candidate], application_id
                )
                self._seeded.counted("withdrawals")

            # One reading per Application, which is all an Application can carry: this stands
            # in for the worker, which the seed does not run.
            await MatchAssessmentService(self._db, self._assessor).assess(recruiter, application_id)
            self._seeded.counted("AI match assessments")
            await self._settle_assessment(application_id)

    async def _settle_assessment(self, application_id: UUID) -> None:
        """Close the queue row the `assess_on_arrival` trigger opened.

        The seed writes its own readings, deterministically and for nothing, so the row is
        already answered. Left `pending` it would hand a running worker every Application in the
        seeded world to read against a real provider, at a real cost, for a number that would
        only change on every reseed.
        """
        settled = self._seeded.clock.now
        async with transaction(self._db):
            await self._db.execute(
                update(MatchAssessmentJob)
                .where(MatchAssessmentJob.application_id == application_id)
                .values(
                    status=AssessmentStatus.COMPLETED,
                    attempts=1,
                    error_message=None,
                    started_at=settled,
                    completed_at=settled,
                    available_at=None,
                )
            )

    def _started_on(
        self, applied: cast.SeededApplication, status: ApplicationStatus
    ) -> date | None:
        """The day a claimed hire says the work began. Only a `hired` move carries one."""
        if status is not ApplicationStatus.HIRED:
            return None
        if applied.starts_in_days is None:
            raise ValueError(
                f"{applied.candidate} is hired for {applied.job} but names no start day"
            )
        return self._seeded.clock.ago(-applied.starts_in_days).date()

    async def _closures(self) -> None:
        """Take the Jobs that are done off the board, now that they have their pipelines."""
        jobs = JobService(self._db)
        for posting in cast.JOBS:
            if posting.status in (JobStatus.CLOSED, JobStatus.ARCHIVED):
                await jobs.change(
                    self._recruiter(posting.author),
                    self._seeded.jobs[posting.key],
                    JobChanges(status=posting.status),
                )

    async def _submit(self, applied: cast.SeededApplication) -> UUID:
        answers = [
            SubmittedAnswer(
                question_id=self._questions[applied.job, text],
                answer_boolean=given if isinstance(given, bool) else None,
                answer_text=None if isinstance(given, bool) else given,
            )
            for text, given in applied.answers.items()
        ]
        submitted = await ApplicationService(self._db).submit(
            self._candidate_acting[applied.candidate],
            await self._visitor(applied),
            NewApplication(job_id=self._seeded.jobs[applied.job], answers=answers),
        )
        return submitted.id

    async def _visitor(self, applied: cast.SeededApplication) -> Visitor:
        """The browser that applied, and the campaign link it had last read the Job through.

        Attribution is the visitor's, not the applicant's: `ApplicationService` looks for the
        newest view this session made of this Job through a link. So the seed gives an applicant
        who came through a campaign one more view — theirs — on that link.
        """
        session_id = token_urlsafe(16)
        if applied.via is None:
            return Visitor(session_id=session_id, visitor_hash=token_hex(32))

        async with transaction(self._db):
            self._db.add(
                JobViewEvent(
                    job_id=self._seeded.jobs[applied.job],
                    tracked_link_id=self._seeded.links[applied.via],
                    session_id=session_id,
                    visitor_hash=token_hex(32),
                    viewed_at=self._seeded.clock.ago(applied.applied_days_ago + 0.05),
                )
            )
        self._seeded.counted("job views")
        return Visitor(session_id=session_id, visitor_hash=token_hex(32))

    # ── What each Tenant filed about all of it ────────────────────────────────────────────

    async def _records(self) -> None:
        await self._tags()
        await self._templates()
        await self._application_records()
        await self._candidate_records()

    async def _tags(self) -> None:
        """A Tenant opens with a vocabulary of its own, so a name the cast asks for may be one
        of those already. Reuse it rather than asking for a second Tag of the same name."""
        for tag in cast.TAGS:
            recruiter = self._recruiter(_first_recruiter_of(tag.tenant))
            service = TagService(self._db)
            already = {
                (existing.name, existing.scope): existing.id
                for existing in await service.tags(recruiter)
            }
            found = already.get((tag.name, tag.scope))
            if found is None:
                found = (await service.create(recruiter, NewTag(name=tag.name, scope=tag.scope))).id
                self._seeded.counted("tags")
            self._seeded.tags[tag.tenant, tag.name] = found

    async def _templates(self) -> None:
        for template in cast.TEMPLATES:
            recruiter = self._recruiter(template.author)
            service = MessageTemplateService(self._db)
            written = NewMessageTemplate(
                name=template.name, subject=template.subject, body=template.body
            )
            already = {
                existing.name: existing.id for existing in await service.templates(recruiter)
            }
            found = already.get(template.name)
            if found is None:
                found = (await service.create(recruiter, written)).id
                self._seeded.counted("message templates")
            else:
                await service.revise(
                    recruiter, found, MessageTemplateChanges(**written.model_dump())
                )
            self._seeded.templates[template.tenant, template.name] = found

    async def _application_records(self) -> None:
        for applied in cast.APPLICATIONS:
            application_id = self._seeded.applications[applied.candidate, applied.job]
            tenant = _job(applied.job).tenant

            for author, text in applied.notes:
                await NoteService(self._db, ABOUT_APPLICATIONS).write(
                    self._recruiter(author), application_id, NewNote(text=text)
                )
                self._seeded.counted("notes")
            for name in applied.tags:
                await TagAssignmentService(self._db, ON_APPLICATIONS).put_on(
                    self._recruiter(_first_recruiter_of(tenant)),
                    application_id,
                    self._seeded.tags[tenant, name],
                )
                self._seeded.counted("tag assignments")
            for name in applied.messages:
                recruiter = self._recruiter(_first_recruiter_of(tenant))
                await OutreachService(self._db).send(
                    recruiter,
                    application_id,
                    OutgoingMessage(template_id=self._seeded.templates[tenant, name]),
                )
                self._seeded.counted("recruiter messages")

    async def _candidate_records(self) -> None:
        for record in cast.CANDIDATE_RECORDS:
            candidate_id = self._seeded.candidates[record.candidate]
            keeper = self._recruiter(_first_recruiter_of(record.tenant))

            if record.pooled:
                await TalentPoolService(self._db).save(keeper, candidate_id)
                self._seeded.counted("talent pool entries")
            for author, text in record.notes:
                await NoteService(self._db, ABOUT_CANDIDATES).write(
                    self._recruiter(author), candidate_id, NewNote(text=text)
                )
                self._seeded.counted("notes")
            for name in record.tags:
                await TagAssignmentService(self._db, ON_CANDIDATES).put_on(
                    keeper, candidate_id, self._seeded.tags[record.tenant, name]
                )
                self._seeded.counted("tag assignments")

    # ── The small amount of plumbing the services need ────────────────────────────────────

    def _platform(self) -> PlatformService:
        return PlatformService(self._db, self._gotrue, recruiter_portal_url=self._portal())

    def _requests(self) -> AccessRequestService:
        return AccessRequestService(self._db, self._platform())

    def _portal(self) -> str:
        return str(self._settings.recruiter_portal_url)

    async def _pending_id(self, email: str) -> UUID:
        for waiting in await self._requests().pending():
            if waiting.email == email.lower():
                return waiting.id
        raise LookupError(f"no pending access request for {email}")

    def _recruiter(self, key: str) -> ActingRecruiter:
        """A Recruiter as the services take them. Built once each, and never for a suspended
        Tenant through `acting_recruiter` — that refuses, which is the point of it."""
        if key not in self._acting:
            profile_id = self._seeded.recruiters[key]
            person = _recruiter_named(key)
            tenant = _tenant_of(key)
            self._acting[key] = ActingRecruiter(
                profile=ActingProfile(
                    id=profile_id,
                    email=person.email,
                    full_name=person.full_name,
                    account_type=AccountType.RECRUITER,
                    avatar_url=None,
                    phone=None,
                    phone_country=None,
                    has_account_row=True,
                ),
                tenant=TenantSummary(
                    id=self._seeded.tenants[tenant.key], name=tenant.name, slug=tenant.slug
                ),
                role=person.role,
            )
        return self._acting[key]

    async def _location_name(self, key: str | None) -> str | None:
        if key is None:
            return None
        return await self._db.scalar(select(Location.name).where(Location.key == key))

    async def _vocabulary(self) -> Vocabularies:
        """The spellings a parse is normalised against: skills, roles and language codes."""
        skills = list(await self._db.scalars(select(SkillTaxonomy.canonical_name)))
        roles = list(await self._db.scalars(select(CanonicalRole.key)))
        codes = list(await self._db.scalars(select(Language.code)))
        return Vocabularies(
            taxonomy={name.lower(): name for name in skills},
            roles={key.lower(): key for key in roles},
            languages={code.lower(): code for code in codes},
        )


def _as_of(profile: CandidateProfile, trims: int) -> CandidateProfile:
    """The same person, `trims` jobs ago — what an older CV of theirs said.

    The sections are ordered most recent first, so the older document is the tail of each,
    with the years on every skill wound back. Nothing is invented: it is the profile they
    would have written before the job they have now.
    """
    if trims <= 0:
        return profile
    return profile.model_copy(
        update={
            "experiences": list(profile.experiences[trims:]),
            "projects": list(profile.projects[trims:]),
            "skills": [
                skill.model_copy(
                    update={"years_experience": max(round(skill.years_experience - trims, 1), 0.5)}
                )
                for skill in profile.skills
            ],
        }
    )


def _an_upload(filename: str, content: bytes) -> UploadFile:
    """The file as the endpoint would have handed it over: a stream, a name and a media type."""
    media_type = (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if filename.endswith(".docx")
        else "application/pdf"
    )
    return UploadFile(
        file=BytesIO(content),
        size=len(content),
        filename=filename,
        headers=Headers({"content-type": media_type}),
    )


def _job(key: str) -> cast.SeededJob:
    for posting in cast.JOBS:
        if posting.key == key:
            return posting
    raise LookupError(f"no seeded job {key}")


def _recruiter_named(key: str) -> cast.SeededRecruiter:
    for tenant in cast.TENANTS:
        for person in tenant.everyone:
            if person.key == key:
                return person
    raise LookupError(f"no seeded recruiter {key}")


def _tenant_of(recruiter_key: str) -> cast.SeededTenant:
    for tenant in cast.TENANTS:
        if any(person.key == recruiter_key for person in tenant.everyone):
            return tenant
    raise LookupError(f"no tenant for recruiter {recruiter_key}")


def _first_recruiter_of(tenant_key: str) -> str:
    for tenant in cast.TENANTS:
        if tenant.key == tenant_key:
            return tenant.admin.key
    raise LookupError(f"no seeded tenant {tenant_key}")
