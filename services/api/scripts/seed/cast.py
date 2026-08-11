"""Who and what the seeded platform contains. Data only — nothing here writes.

Everything is spelled as the very payload models the API validates, so a fixture that could
not have been typed into the product fails here, at import, rather than three tables later.
The Screening verdicts are deliberate: the years, proficiencies and answers below are chosen
so that every `qualification_status` the domain has is reached by an Application that honestly
earns it, and none is written by hand.

Times are "days ago", resolved against one instant when the seed runs and applied to the rows
afterwards (see `history.py`). The Dashboard's windows are rolling, so a fixture pinned to a
date would drift out of "this week" by the second day.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Final

from sync_api.candidates import (
    CandidateProfile,
    ProfileEducation,
    ProfileExperience,
    ProfileLanguage,
    ProfileProject,
    ProfileSkill,
)
from sync_api.jobs import JobCriteria, NewJob
from sync_api.jobs.payload import JobLanguageRequirement, JobQuestion, JobSkillRequirement

if TYPE_CHECKING:
    from collections.abc import Sequence

from sync_core.models import (
    ApplicationQuestionType,
    ApplicationStatus,
    EmploymentType,
    JobStatus,
    LanguageProficiency,
    RecruiterRole,
    SkillImportance,
    TagScope,
    TenantPlan,
    WorkMode,
)

#: One password for every seeded account, so signing in as anybody is one thing to remember.
#: Local fixtures only — `seed_demo.py` refuses to run against anything but a local stack.
PASSWORD: Final = "Sync-Demo-2026"

Skill = ProfileSkill
Spoken = ProfileLanguage
Held = ProfileExperience
Studied = ProfileEducation
Built = ProfileProject

NATIVE = LanguageProficiency.NATIVE
FLUENT = LanguageProficiency.FLUENT
ADVANCED = LanguageProficiency.ADVANCED
INTERMEDIATE = LanguageProficiency.INTERMEDIATE

REQUIRED = SkillImportance.REQUIRED
PREFERRED = SkillImportance.PREFERRED
OPTIONAL = SkillImportance.OPTIONAL

YES_NO = ApplicationQuestionType.YES_NO
SHORT_TEXT = ApplicationQuestionType.SHORT_TEXT


# ── Identities ────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class SeededOperator:
    """The Platform admin the whole platform is operated from."""

    email: str
    full_name: str


OPERATOR: Final = SeededOperator(email="anton@sync.ngo", full_name="Anton Najjar")


@dataclass(frozen=True, slots=True)
class SeededRecruiter:
    key: str
    email: str
    full_name: str
    role: RecruiterRole = RecruiterRole.RECRUITER
    is_active: bool = True


@dataclass(frozen=True, slots=True)
class SeededTenant:
    key: str
    name: str
    slug: str
    plan: TenantPlan
    admin: SeededRecruiter
    team: Sequence[SeededRecruiter] = ()
    is_active: bool = True
    #: Opened by converting an Access request rather than by an operator typing a name, which
    #: is how a real Tenant starts. Leaves the request `converted` and naming this Tenant.
    from_access_request: bool = False

    @property
    def everyone(self) -> tuple[SeededRecruiter, ...]:
        return (self.admin, *self.team)


#: Every address is on sync.ngo. Real people, so an invite that escapes reaches a colleague
#: rather than a stranger, and a bounce lands on our own mail server rather than a customer's.
NORTHBRIDGE: Final = SeededTenant(
    key="northbridge",
    name="Northbridge Talent",
    slug="northbridge",
    plan=TenantPlan.PRO,
    from_access_request=True,
    admin=SeededRecruiter(
        key="lama",
        email="lama@sync.ngo",
        full_name="Lama Haddad",
        role=RecruiterRole.ADMIN,
    ),
    team=[
        SeededRecruiter(key="kamal", email="kamal@sync.ngo", full_name="Kamal Nasser"),
        SeededRecruiter(
            key="lina", email="lina.haddad@northbridge.example", full_name="Lina Haddad"
        ),
        # Turned off by an admin: the one member state a roster has to be able to render.
        SeededRecruiter(
            key="omar",
            email="omar.zeid@northbridge.example",
            full_name="Omar Zeid",
            is_active=False,
        ),
    ],
)

#: An employer hiring directly, rather than an agency hiring on someone else's behalf. Both
#: shapes exist in the product and the Recruiter Portal has to read sensibly for each.
SYRIATEL: Final = SeededTenant(
    key="syriatel",
    name="Syriatel Engineering",
    slug="syriatel-engineering",
    plan=TenantPlan.FREE,
    admin=SeededRecruiter(
        key="syriatel_admin",
        email="syriatel-recruiter@sync.ngo",
        full_name="Syriatel Recruiting",
        role=RecruiterRole.ADMIN,
    ),
    team=[
        SeededRecruiter(
            key="tarek", email="tarek.aboud@syriatel-engineering.example", full_name="Tarek Aboud"
        ),
    ],
)

#: Suspended, so the Platform Portal has a suspended row to restore and the Recruiter Portal
#: has an account that meets the "this tenant is suspended" screen on sign-in.
PALMYRA: Final = SeededTenant(
    key="palmyra",
    name="Palmyra Cloud",
    slug="palmyra-cloud",
    plan=TenantPlan.ENTERPRISE,
    is_active=False,
    admin=SeededRecruiter(
        key="samir",
        email="samir.daoud@palmyra-cloud.example",
        full_name="Samir Daoud",
        role=RecruiterRole.ADMIN,
    ),
)

TENANTS: Final = (NORTHBRIDGE, SYRIATEL, PALMYRA)


@dataclass(frozen=True, slots=True)
class SeededAccessRequest:
    company: str
    full_name: str
    email: str
    #: `pending` waits in the queue, `converted` becomes the Tenant it names, `dismissed` was
    #: turned away. One address may hold only one pending request.
    outcome: str
    created_days_ago: float
    tenant: str | None = None


ACCESS_REQUESTS: Final = (
    SeededAccessRequest(
        company=NORTHBRIDGE.name,
        full_name=NORTHBRIDGE.admin.full_name,
        email=NORTHBRIDGE.admin.email,
        outcome="converted",
        created_days_ago=58,
        tenant=NORTHBRIDGE.key,
    ),
    SeededAccessRequest(
        company="Aleppo Data Systems",
        full_name="Hala Mansour",
        email="hala.mansour@aleppodata.example",
        outcome="pending",
        created_days_ago=9,
    ),
    SeededAccessRequest(
        company="Orontes Software",
        full_name="Bilal Kanaan",
        email="bilal.kanaan@orontes.example",
        outcome="pending",
        created_days_ago=4,
    ),
    SeededAccessRequest(
        company="Damascus Cloud Works",
        full_name="Noor Ajami",
        email="noor.ajami@damascuscloud.example",
        outcome="pending",
        created_days_ago=1,
    ),
    SeededAccessRequest(
        company="Cheap Watches Direct",
        full_name="Anon Ymous",
        email="offers@cheapwatches.example",
        outcome="dismissed",
        created_days_ago=21,
    ),
)


# ── Candidates ────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class SeededCv:
    display_name: str
    #: `pdf` and `docx` are both uploadable, and the two take different paths through parsing.
    kind: str = "pdf"
    created_days_ago: float = 30
    #: `ready` has been read and can be current; `failed` is what a Candidate is notified about.
    state: str = "ready"
    is_current: bool = False
    #: Soft-deleted: the Applications made with it, and the file itself, stay whole.
    deleted: bool = False
    #: A parse that says something the profile does not, so the CV review screen has real
    #: differences to show rather than a form that agrees with itself.
    parse_drifts: bool = False
    #: How much of the profile this document leaves out: the most recent `trims` jobs and
    #: projects, and `trims` years off every skill. `0` is the profile as it stands today.
    #:
    #: This is what makes a Candidate's second CV a different file rather than the same one
    #: uploaded twice — which the product refuses, correctly. It is also what an older CV
    #: actually is: the same person, before the last job.
    trims: int = 0


@dataclass(frozen=True, slots=True)
class SeededCandidate:
    key: str
    email: str
    profile: CandidateProfile
    cvs: Sequence[SeededCv] = ()
    joined_days_ago: float = 45

    @property
    def full_name(self) -> str:
        return self.profile.full_name


ABDULQADER: Final = SeededCandidate(
    key="abdulqader",
    email="abdulqader@sync.ngo",
    joined_days_ago=52,
    profile=CandidateProfile(
        full_name="AbdulQader Qassab",
        phone="+963 11 555 0134",
        headline="Backend engineer, 8 years",
        summary=(
            "Builds boring payment systems that stay up. Comfortable owning a service end to "
            "end, from the schema to the on-call rota, and happier deleting code than adding "
            "it. Currently leading a ledger rewrite in Python and PostgreSQL."
        ),
        location_key="sy-damascus",
        canonical_role_key="backend-engineer",
        is_searchable=True,
        experiences=[
            Held(
                job_title="Senior Backend Engineer",
                company_name="Acme Payments",
                start_year=2021,
                start_month=3,
                is_current=True,
                description=(
                    "Led the payments ledger rewrite in Python and PostgreSQL. Introduced "
                    "Docker-based local environments and cut deploy time from an hour to ten "
                    "minutes. Mentors three junior engineers."
                ),
            ),
            Held(
                job_title="Backend Engineer",
                company_name="Globex",
                start_year=2018,
                start_month=1,
                end_year=2021,
                end_month=2,
                description=(
                    "Built internal REST APIs in Python and Django. Ran the PostgreSQL "
                    "migration from a single instance to a replicated pair with no downtime."
                ),
            ),
        ],
        educations=[
            Studied(
                institution="Damascus University",
                degree="BSc",
                field_of_study="Computer Science",
                graduation_year=2017,
            ),
        ],
        skills=[
            Skill(name="Python", years_experience=8.0),
            Skill(name="PostgreSQL", years_experience=6.0),
            Skill(name="Docker", years_experience=5.0),
            Skill(name="FastAPI", years_experience=4.0),
            Skill(name="SQL", years_experience=7.0),
            Skill(name="Kubernetes", years_experience=2.0),
            Skill(name="AWS", years_experience=3.0),
            Skill(name="Data Analysis", years_experience=3.0),
            Skill(name="REST APIs", years_experience=7.0),
            Skill(name="Git", years_experience=8.0),
        ],
        languages=[Spoken(code="ar", proficiency=NATIVE), Spoken(code="en", proficiency=FLUENT)],
        projects=[
            Built(
                name="Ledger",
                description=(
                    "A double-entry ledger library that refuses to lose a transaction, however "
                    "hard the caller tries."
                ),
                repository_url="https://github.com/SuperMo0/ledger",
                start_year=2022,
                start_month=3,
            ),
        ],
        unmapped_skills=["Kafka", "RabbitMQ", "OpenTelemetry"],
    ),
    cvs=[
        SeededCv(
            display_name="abdulqader-qassab-cv.pdf",
            created_days_ago=14,
            is_current=True,
            parse_drifts=True,
        ),
        SeededCv(display_name="abdulqader-qassab-cv-2024.pdf", created_days_ago=40, trims=1),
        SeededCv(
            display_name="abdulqader-old-draft.pdf", created_days_ago=48, deleted=True, trims=2
        ),
    ],
)

MOWAFAK: Final = SeededCandidate(
    key="mowafak",
    email="mowafak@sync.ngo",
    joined_days_ago=41,
    profile=CandidateProfile(
        full_name="Mowafak Almahaini",
        phone="+963 21 555 0199",
        headline="Frontend engineer, 7 years",
        summary=(
            "Rebuilds interfaces that people have given up on. Owns a design system in React "
            "and TypeScript, and cares more about the empty state than the happy path."
        ),
        location_key="sy-aleppo",
        canonical_role_key="frontend-engineer",
        is_searchable=True,
        experiences=[
            Held(
                job_title="Senior Frontend Engineer",
                company_name="Initech",
                start_year=2022,
                start_month=6,
                is_current=True,
                description=(
                    "Rebuilt the customer dashboard in React and TypeScript. Owns the design "
                    "system and its accessibility audit."
                ),
            ),
            Held(
                job_title="Frontend Developer",
                company_name="Aleppo Web Studio",
                start_year=2019,
                start_month=9,
                end_year=2022,
                end_month=5,
                description="Built marketing sites and a booking flow in Vue, then in React.",
            ),
        ],
        educations=[
            Studied(
                institution="University of Aleppo",
                degree="BSc",
                field_of_study="Software Engineering",
                graduation_year=2019,
            ),
        ],
        skills=[
            Skill(name="React", years_experience=5.0),
            Skill(name="TypeScript", years_experience=5.0),
            Skill(name="JavaScript", years_experience=7.0),
            Skill(name="Next.js", years_experience=3.0),
            Skill(name="Figma", years_experience=2.0),
            Skill(name="UI/UX Design", years_experience=3.0),
            Skill(name="Git", years_experience=7.0),
        ],
        languages=[
            Spoken(code="ar", proficiency=NATIVE),
            Spoken(code="en", proficiency=ADVANCED),
            Spoken(code="fr", proficiency=INTERMEDIATE),
        ],
        projects=[
            Built(
                name="Emptystate",
                description=(
                    "A catalogue of the screens nobody designs, with the copy to go in them."
                ),
                project_url="https://example.com/emptystate",
                start_year=2023,
                start_month=1,
                end_year=2024,
                end_month=6,
            ),
        ],
        unmapped_skills=["Storybook", "Playwright"],
    ),
    # The other format a CV arrives in, so the .docx path is exercised by something.
    cvs=[
        SeededCv(
            display_name="mowafak-almahaini.docx", kind="docx", created_days_ago=20, is_current=True
        ),
    ],
)

KARIM: Final = SeededCandidate(
    key="karim",
    email="karim.sabbagh@example.com",
    joined_days_ago=38,
    profile=CandidateProfile(
        full_name="Karim Sabbagh",
        phone="+963 41 555 0121",
        headline="Platform engineer, 8 years",
        summary=(
            "Runs the boring infrastructure other people's services sit on. Terraform for "
            "everything, alerts that mean something, and a pager that mostly stays quiet."
        ),
        location_key="sy-latakia",
        canonical_role_key="devops-engineer",
        is_searchable=True,
        experiences=[
            Held(
                job_title="Platform Engineer",
                company_name="Orontes Cloud",
                start_year=2020,
                start_month=6,
                is_current=True,
                description=(
                    "Moved forty services onto Kubernetes and wrote the Terraform that "
                    "describes them. Cut the monthly cloud bill by a third."
                ),
            ),
            Held(
                job_title="Systems Administrator",
                company_name="Latakia Port Authority",
                start_year=2018,
                start_month=9,
                end_year=2020,
                end_month=5,
                description="Kept a fleet of Linux servers and the network behind them running.",
            ),
        ],
        educations=[
            Studied(
                institution="Tishreen University",
                degree="BSc",
                field_of_study="Information Technology",
                graduation_year=2018,
            ),
        ],
        skills=[
            Skill(name="Docker", years_experience=6.0),
            Skill(name="Kubernetes", years_experience=5.0),
            Skill(name="AWS", years_experience=5.0),
            Skill(name="Terraform", years_experience=4.0),
            Skill(name="Linux", years_experience=8.0),
            Skill(name="CI/CD", years_experience=6.0),
            Skill(name="Python", years_experience=5.5),
            Skill(name="PostgreSQL", years_experience=3.5),
        ],
        languages=[Spoken(code="ar", proficiency=NATIVE), Spoken(code="en", proficiency=ADVANCED)],
        projects=[
            Built(
                name="Quietpager",
                description="Alert rules that page a human only when a human can do something.",
                repository_url="https://example.com/karim/quietpager",
                start_year=2021,
                start_month=7,
            ),
        ],
        unmapped_skills=["Ansible", "Prometheus", "Grafana"],
    ),
    cvs=[
        SeededCv(display_name="karim-sabbagh-cv.pdf", created_days_ago=11, is_current=True),
    ],
)

LAYLA: Final = SeededCandidate(
    key="layla",
    email="layla.kassem@example.com",
    joined_days_ago=27,
    profile=CandidateProfile(
        full_name="Layla Kassem",
        phone="+963 31 555 0177",
        headline="Data scientist, 4 years",
        summary=(
            "Turns messy operational data into numbers somebody will act on. Prefers a clear "
            "chart and a written caveat to a model nobody can explain."
        ),
        location_key="sy-homs",
        canonical_role_key="data-scientist",
        is_searchable=True,
        experiences=[
            Held(
                job_title="Data Scientist",
                company_name="Homs Analytics",
                start_year=2022,
                start_month=4,
                is_current=True,
                description=(
                    "Built the capacity forecast the platform team plans against, and the "
                    "dashboards that show when it is wrong."
                ),
            ),
        ],
        educations=[
            Studied(
                institution="Al-Baath University",
                degree="MSc",
                field_of_study="Statistics",
                graduation_year=2022,
            ),
            Studied(
                institution="Al-Baath University",
                degree="BSc",
                field_of_study="Mathematics",
                graduation_year=2020,
            ),
        ],
        skills=[
            Skill(name="Python", years_experience=4.0),
            Skill(name="SQL", years_experience=4.0),
            Skill(name="Data Analysis", years_experience=4.0),
            Skill(name="Pandas", years_experience=4.0),
            Skill(name="NumPy", years_experience=4.0),
            Skill(name="scikit-learn", years_experience=2.0),
            Skill(name="Machine Learning", years_experience=3.0),
            Skill(name="Communication", years_experience=4.0),
        ],
        languages=[
            Spoken(code="ar", proficiency=NATIVE),
            Spoken(code="en", proficiency=FLUENT),
        ],
        projects=[],
        unmapped_skills=["R", "Tableau"],
    ),
    cvs=[
        SeededCv(display_name="layla-kassem-cv.pdf", created_days_ago=9, is_current=True),
    ],
)

NADIA: Final = SeededCandidate(
    key="nadia",
    email="nadia.rahal@example.com",
    joined_days_ago=35,
    profile=CandidateProfile(
        full_name="Nadia Rahal",
        phone="+961 1 555 0142",
        headline="Product designer, 7 years",
        summary=(
            "Designs the parts of a product nobody screenshots: settings, errors, the second "
            "visit. Writes the copy too, because the copy is the design."
        ),
        # Outside Syria, so the place taxonomy answers with a country rather than a governorate.
        location_key="lb",
        canonical_role_key="ui-ux-designer",
        is_searchable=True,
        experiences=[
            Held(
                job_title="Senior Product Designer",
                company_name="Cedrus Digital",
                start_year=2021,
                start_month=2,
                is_current=True,
                description="Owns the design system and the research that keeps changing it.",
            ),
            Held(
                job_title="Product Designer",
                company_name="Beirut Studio",
                start_year=2019,
                start_month=1,
                end_year=2021,
                end_month=1,
            ),
            Held(
                job_title="Junior Designer",
                company_name="Freelance",
                start_year=2017,
                start_month=6,
                end_year=2018,
                end_month=12,
            ),
        ],
        educations=[
            Studied(
                institution="Lebanese American University",
                degree="BA",
                field_of_study="Graphic Design",
                graduation_year=2017,
            ),
        ],
        skills=[
            Skill(name="Figma", years_experience=6.0),
            Skill(name="UI/UX Design", years_experience=7.0),
            Skill(name="Adobe Photoshop", years_experience=7.0),
            Skill(name="Communication", years_experience=6.0),
            Skill(name="Teamwork", years_experience=5.0),
            Skill(name="SQL", years_experience=2.0),
            Skill(name="Data Analysis", years_experience=2.5),
        ],
        languages=[
            Spoken(code="ar", proficiency=NATIVE),
            Spoken(code="en", proficiency=FLUENT),
            Spoken(code="fr", proficiency=ADVANCED),
        ],
        projects=[
            Built(
                name="Second Visit",
                description="A talk, then a zine, about designing for the people who come back.",
                project_url="https://example.com/secondvisit",
                start_year=2024,
                start_month=2,
                end_year=2024,
                end_month=11,
            ),
        ],
        unmapped_skills=["Design research", "Copywriting"],
    ),
    cvs=[
        SeededCv(display_name="nadia-rahal-portfolio-cv.pdf", created_days_ago=16, is_current=True),
    ],
)

#: A junior with a year and a half of work behind him: short of most years-of-work bars, and
#: short of them plainly — a dated profile leaves nothing to wonder about.
FADI: Final = SeededCandidate(
    key="fadi",
    email="fadi.chalhoub@example.com",
    joined_days_ago=12,
    profile=CandidateProfile(
        full_name="Fadi Chalhoub",
        phone="+963 11 555 0188",
        headline="Junior full-stack developer",
        summary="A year and a half in, and reading everything. Wants a team that reviews code.",
        location_key="sy-damascus",
        canonical_role_key="fullstack-engineer",
        is_searchable=True,
        experiences=[
            Held(
                job_title="Junior Developer",
                company_name="Damascus Software House",
                start_year=2025,
                start_month=2,
                is_current=True,
                description="Ships small features across a Django backend and a React frontend.",
            ),
            Held(
                job_title="Intern",
                company_name="Damascus Chamber of Commerce",
                start_year=2024,
                start_month=6,
                end_year=2024,
                end_month=8,
                description="Three months on an internal inventory tool.",
            ),
        ],
        educations=[
            Studied(
                institution="Damascus University",
                degree="BSc",
                field_of_study="Computer Engineering",
                graduation_year=2024,
            ),
        ],
        skills=[
            Skill(name="Python", years_experience=1.5),
            Skill(name="React", years_experience=3.0),
            Skill(name="TypeScript", years_experience=2.0),
            Skill(name="Django", years_experience=1.5),
            Skill(name="SQL", years_experience=2.0),
            Skill(name="Data Analysis", years_experience=2.0),
            Skill(name="Communication", years_experience=2.0),
            Skill(name="Git", years_experience=2.0),
        ],
        languages=[Spoken(code="ar", proficiency=NATIVE), Spoken(code="en", proficiency=ADVANCED)],
        projects=[
            Built(
                name="Bus times",
                description="A timetable for the Damascus microbus routes, scraped and cleaned.",
                repository_url="https://example.com/fadi/bustimes",
                start_year=2025,
                start_month=6,
            ),
        ],
        unmapped_skills=[
            "Tailwind CSS",
        ],
    ),
    cvs=[
        SeededCv(display_name="fadi-chalhoub-cv.pdf", created_days_ago=10, is_current=True),
    ],
)

#: Has a ready CV and has opted *out* of Global search, so a Tenant reaches her only through
#: the Applications she sent it. Proves reach is not the same thing as searchability.
HIBA: Final = SeededCandidate(
    key="hiba",
    email="hiba.othman@example.com",
    joined_days_ago=33,
    profile=CandidateProfile(
        full_name="Hiba Othman",
        phone="+963 11 555 0163",
        headline="QA engineer, test automation",
        summary=(
            "Writes the tests that stop a release, and the ones that stop a rollback. Python "
            "and Playwright, mostly."
        ),
        location_key="sy-rif-dimashq",
        canonical_role_key="qa-engineer",
        is_searchable=False,
        experiences=[
            Held(
                job_title="QA Engineer",
                company_name="Bright Systems",
                start_year=2023,
                start_month=2,
                is_current=True,
                description="Owns the end-to-end suite and the flake budget it runs against.",
            ),
            Held(
                job_title="QA Tester",
                company_name="Damascus Chamber of Commerce",
                start_year=2021,
                start_month=3,
                end_year=2023,
                end_month=1,
                description="Manual test passes on an internal portal.",
            ),
        ],
        educations=[
            Studied(
                institution="Damascus University",
                degree="BSc",
                field_of_study="Computer Science",
                graduation_year=2022,
            ),
        ],
        skills=[
            Skill(name="Python", years_experience=5.0),
            Skill(name="PostgreSQL", years_experience=3.0),
            Skill(name="SQL", years_experience=3.5),
            Skill(name="Git", years_experience=4.0),
            Skill(name="Jira", years_experience=3.5),
            Skill(name="Communication", years_experience=4.0),
            Skill(name="Teamwork", years_experience=4.0),
            Skill(name="Problem Solving", years_experience=4.0),
        ],
        languages=[Spoken(code="ar", proficiency=NATIVE), Spoken(code="en", proficiency=ADVANCED)],
        projects=[],
        unmapped_skills=["Playwright", "Cypress"],
    ),
    cvs=[
        SeededCv(display_name="hiba-othman-cv.pdf", created_days_ago=25, is_current=True),
    ],
)

#: The failure path: the platform could not read his CV, so he holds no current CV, cannot
#: apply, and has an unread Notification saying so.
ZIAD: Final = SeededCandidate(
    key="ziad",
    email="ziad.merhi@example.com",
    joined_days_ago=6,
    profile=CandidateProfile(
        full_name="Ziad Merhi",
        phone="+963 43 555 0155",
        headline="Mobile engineer, 4 years",
        summary="iOS and Android, and the API in between when nobody else will write it.",
        location_key="sy-tartus",
        canonical_role_key="mobile-engineer",
        is_searchable=False,
        experiences=[
            Held(
                job_title="Mobile Engineer",
                company_name="Tartus Apps",
                start_year=2022,
                start_month=1,
                is_current=True,
            ),
        ],
        educations=[
            Studied(institution="Tishreen University", degree="BSc", graduation_year=2021),
        ],
        skills=[
            Skill(name="Swift", years_experience=4.0),
            Skill(name="Kotlin", years_experience=3.0),
            Skill(name="REST APIs", years_experience=4.0),
        ],
        languages=[
            Spoken(code="ar", proficiency=NATIVE),
            Spoken(code="en", proficiency=INTERMEDIATE),
        ],
        unmapped_skills=[
            "Flutter",
        ],
    ),
    cvs=[
        SeededCv(display_name="ziad-merhi-scan.pdf", created_days_ago=5, state="failed"),
    ],
)

#: Confirmed their address and stopped. No CV, no profile, nothing — the state every account
#: passes through and the one most screens forget to design for.
RAMI: Final = SeededCandidate(
    key="rami",
    email="rami.talhouk@example.com",
    joined_days_ago=2,
    profile=CandidateProfile(full_name="Rami Talhouk"),
    cvs=[],
)

CANDIDATES: Final = (ABDULQADER, MOWAFAK, KARIM, LAYLA, NADIA, FADI, HIBA, ZIAD, RAMI)


# ── Jobs, criteria and the links that bring traffic ──────────────────────────────────────


@dataclass(frozen=True, slots=True)
class SeededLink:
    key: str
    name: str
    views: int
    is_active: bool = True
    #: Negative is already past, which makes the link unresolvable without touching its traffic.
    expires_in_days: float | None = None
    created_days_ago: float = 30


@dataclass(frozen=True, slots=True)
class SeededJob:
    key: str
    tenant: str
    author: str
    new: NewJob
    criteria: JobCriteria
    status: JobStatus
    created_days_ago: float
    published_days_ago: float | None = None
    #: Views that arrived at the Job with no link to attribute them to.
    direct_views: int = 0
    links: Sequence[SeededLink] = ()


A_RIGHT_TO_WORK: Final = "Do you have the right to work in Syria?"
AN_ON_CALL_ROTA: Final = "Are you willing to join an on-call rota?"
A_START_DATE: Final = "When could you start?"
A_DESIGN_SYSTEM: Final = "Have you shipped and owned a design system?"
A_PORTFOLIO: Final = "Where can we see your work?"
NETWORK_DATA: Final = "Have you worked with network telemetry or billing data before?"

JOBS: Final = (
    SeededJob(
        key="backend",
        tenant=NORTHBRIDGE.key,
        author="lama",
        status=JobStatus.PUBLISHED,
        created_days_ago=44,
        published_days_ago=42,
        direct_views=23,
        new=NewJob(
            title="Senior Backend Engineer",
            description=(
                "You will own the payments platform: a Python service, a PostgreSQL database "
                "that is the source of truth for money, and the queue between them.\n\n"
                "We are looking for somebody who has run a service in production and has "
                "opinions about migrations, backpressure and what belongs in a transaction. "
                "The team is four engineers in Damascus and one in Amman.\n\n"
                "On-call is one week in four, and quiet."
            ),
            location_key="sy-damascus",
            employment_type=EmploymentType.FULL_TIME,
            work_mode=WorkMode.ONSITE,
        ),
        criteria=JobCriteria(
            minimum_total_experience_years=5,
            skills=[
                JobSkillRequirement(name="Python", importance=REQUIRED, minimum_years=5),
                JobSkillRequirement(name="PostgreSQL", importance=REQUIRED, minimum_years=3),
                JobSkillRequirement(name="Docker", importance=PREFERRED, minimum_years=2),
                JobSkillRequirement(name="FastAPI", importance=PREFERRED),
                JobSkillRequirement(name="Kubernetes", importance=OPTIONAL),
            ],
            languages=[
                JobLanguageRequirement(code="ar", minimum_proficiency=NATIVE),
                JobLanguageRequirement(code="en", minimum_proficiency=ADVANCED),
            ],
            questions=[
                JobQuestion(
                    question_text=A_RIGHT_TO_WORK,
                    question_type=YES_NO,
                    is_required=True,
                    accepted_boolean_answer=True,
                ),
                # Optional *and* a knockout: skipping it leaves a bar nobody has been shown to
                # clear, which is a verdict of `review_required` rather than a refusal.
                JobQuestion(
                    question_text=AN_ON_CALL_ROTA,
                    question_type=YES_NO,
                    is_required=False,
                    accepted_boolean_answer=True,
                ),
                JobQuestion(question_text=A_START_DATE, question_type=SHORT_TEXT, is_required=True),
            ],
        ),
        links=[
            SeededLink(
                key="backend-linkedin", name="LinkedIn campaign", views=62, created_days_ago=41
            ),
            SeededLink(
                key="backend-facebook", name="Facebook group", views=28, created_days_ago=37
            ),
            SeededLink(
                key="backend-fair",
                name="University careers fair",
                views=15,
                is_active=False,
                created_days_ago=30,
            ),
            SeededLink(
                key="backend-newsletter",
                name="Newsletter - March",
                views=9,
                expires_in_days=-11,
                created_days_ago=34,
            ),
        ],
    ),
    SeededJob(
        key="frontend",
        tenant=NORTHBRIDGE.key,
        author="kamal",
        status=JobStatus.PUBLISHED,
        created_days_ago=31,
        published_days_ago=29,
        direct_views=14,
        new=NewJob(
            title="Frontend Engineer (React)",
            description=(
                "Our customer dashboard is seven years old and the people who use it every day "
                "deserve better. You will rebuild it in React and TypeScript, screen by screen, "
                "next to the designer who is redrawing it.\n\n"
                "We care about the empty state, the error state and the keyboard. Two days a "
                "week in the Aleppo office."
            ),
            location_key="sy-aleppo",
            employment_type=EmploymentType.FULL_TIME,
            work_mode=WorkMode.HYBRID,
        ),
        criteria=JobCriteria(
            minimum_total_experience_years=3,
            skills=[
                JobSkillRequirement(name="React", importance=REQUIRED, minimum_years=3),
                JobSkillRequirement(name="TypeScript", importance=REQUIRED, minimum_years=2),
                JobSkillRequirement(name="Figma", importance=PREFERRED),
                JobSkillRequirement(name="Next.js", importance=OPTIONAL),
            ],
            languages=[
                JobLanguageRequirement(code="en", minimum_proficiency=ADVANCED),
            ],
            questions=[
                JobQuestion(
                    question_text=A_DESIGN_SYSTEM,
                    question_type=YES_NO,
                    is_required=True,
                    accepted_boolean_answer=True,
                ),
                JobQuestion(question_text=A_PORTFOLIO, question_type=SHORT_TEXT, is_required=True),
            ],
        ),
        links=[
            # The same channel name on a second Job: one row per link in the tenant's list, one
            # channel on the Dashboard's card. The two answer different questions.
            SeededLink(
                key="frontend-linkedin", name="LinkedIn campaign", views=37, created_days_ago=28
            ),
            SeededLink(
                key="frontend-telegram", name="Telegram channel", views=21, created_days_ago=26
            ),
        ],
    ),
    SeededJob(
        key="devops",
        tenant=NORTHBRIDGE.key,
        author="lama",
        status=JobStatus.PUBLISHED,
        created_days_ago=22,
        published_days_ago=20,
        direct_views=10,
        new=NewJob(
            title="DevOps Engineer (contract)",
            description=(
                "Six months, extendable, to get our deployment story into a state a new "
                "engineer can understand on their first day.\n\n"
                "Kubernetes is already there and nobody trusts it. You will make it "
                "trustworthy: describe it in Terraform, put the alerts on the things that "
                "matter, and write down what you did. Fully remote, team in Damascus."
            ),
            location_key="sy-damascus",
            employment_type=EmploymentType.CONTRACT,
            work_mode=WorkMode.REMOTE,
        ),
        criteria=JobCriteria(
            minimum_total_experience_years=4,
            skills=[
                JobSkillRequirement(name="Docker", importance=REQUIRED, minimum_years=3),
                JobSkillRequirement(name="Kubernetes", importance=REQUIRED, minimum_years=2),
                JobSkillRequirement(name="AWS", importance=REQUIRED, minimum_years=2),
                JobSkillRequirement(name="Terraform", importance=PREFERRED, minimum_years=2),
                JobSkillRequirement(name="Linux", importance=PREFERRED),
            ],
            languages=[
                JobLanguageRequirement(code="en", minimum_proficiency=ADVANCED),
            ],
            questions=[
                JobQuestion(
                    question_text=AN_ON_CALL_ROTA,
                    question_type=YES_NO,
                    is_required=True,
                    accepted_boolean_answer=True,
                ),
            ],
        ),
        links=[
            SeededLink(key="devops-so", name="Stack Overflow ad", views=34, created_days_ago=19),
            # Nothing arrived through it. The row stays: a Recruiter made it, and a channel that
            # delivered nothing is worth knowing about.
            SeededLink(key="devops-twitter", name="Twitter thread", views=0, created_days_ago=18),
        ],
    ),
    SeededJob(
        key="analyst",
        tenant=NORTHBRIDGE.key,
        author="lina",
        status=JobStatus.PUBLISHED,
        created_days_ago=6,
        published_days_ago=5,
        direct_views=19,
        new=NewJob(
            title="Data Analyst (part-time)",
            description=(
                "Three days a week, helping the operations team answer its own questions.\n\n"
                "You will write SQL against a warehouse that is mostly tidy, build the weekly "
                "numbers, and say plainly when the data cannot answer what was asked. Homs "
                "office, two days from home."
            ),
            location_key="sy-homs",
            employment_type=EmploymentType.PART_TIME,
            work_mode=WorkMode.HYBRID,
        ),
        criteria=JobCriteria(
            minimum_total_experience_years=2,
            skills=[
                JobSkillRequirement(name="SQL", importance=REQUIRED, minimum_years=2),
                JobSkillRequirement(name="Data Analysis", importance=REQUIRED, minimum_years=2),
                JobSkillRequirement(name="Python", importance=PREFERRED),
                JobSkillRequirement(name="Pandas", importance=OPTIONAL),
            ],
            languages=[
                JobLanguageRequirement(code="en", minimum_proficiency=ADVANCED),
            ],
        ),
        links=[
            SeededLink(
                key="analyst-newsletter", name="Alumni newsletter", views=12, created_days_ago=5
            ),
        ],
    ),
    # Never published: criteria still editable, and invisible to every candidate.
    SeededJob(
        key="designer",
        tenant=NORTHBRIDGE.key,
        author="kamal",
        status=JobStatus.DRAFT,
        created_days_ago=3,
        new=NewJob(
            title="Product Designer",
            description=(
                "Draft. Still arguing internally about whether this is one role or two, and "
                "about the salary band. Do not publish before the Thursday review."
            ),
            location_key="sy-damascus",
            employment_type=EmploymentType.FULL_TIME,
            work_mode=WorkMode.REMOTE,
        ),
        criteria=JobCriteria(
            minimum_total_experience_years=4,
            skills=[
                JobSkillRequirement(name="Figma", importance=REQUIRED, minimum_years=3),
                JobSkillRequirement(name="UI/UX Design", importance=REQUIRED, minimum_years=4),
            ],
            languages=[
                JobLanguageRequirement(code="en", minimum_proficiency=ADVANCED),
            ],
        ),
    ),
    # Filled and taken down, with the Applications it received still readable.
    SeededJob(
        key="coordinator",
        tenant=NORTHBRIDGE.key,
        author="lina",
        status=JobStatus.CLOSED,
        created_days_ago=57,
        published_days_ago=56,
        direct_views=31,
        new=NewJob(
            title="Office Coordinator",
            description=(
                "The person who keeps the Latakia office working: suppliers, travel, the "
                "kitchen, and the paperwork nobody else enjoys. Filled - thank you to "
                "everybody who applied."
            ),
            location_key="sy-latakia",
            employment_type=EmploymentType.FULL_TIME,
            work_mode=WorkMode.ONSITE,
        ),
        criteria=JobCriteria(
            minimum_total_experience_years=1,
            skills=[
                JobSkillRequirement(name="Communication", importance=REQUIRED, minimum_years=1),
                JobSkillRequirement(name="Teamwork", importance=PREFERRED),
            ],
            languages=[
                JobLanguageRequirement(code="ar", minimum_proficiency=NATIVE),
            ],
        ),
        links=[
            SeededLink(
                key="coordinator-facebook", name="Facebook group", views=18, created_days_ago=55
            ),
        ],
    ),
    # Archived: gone from every list that matters, and still there.
    SeededJob(
        key="internship",
        tenant=NORTHBRIDGE.key,
        author="lama",
        status=JobStatus.ARCHIVED,
        created_days_ago=70,
        published_days_ago=69,
        direct_views=7,
        new=NewJob(
            title="Summer Internship: Junior Developer",
            description=(
                "Eight weeks over the summer, paired with an engineer, on something real and "
                "small. Ran in 2025 and will run again; this posting is closed."
            ),
            location_key="sy-damascus",
            employment_type=EmploymentType.INTERNSHIP,
            work_mode=WorkMode.ONSITE,
        ),
        criteria=JobCriteria(),
    ),
    SeededJob(
        key="network-data",
        tenant=SYRIATEL.key,
        author="syriatel_admin",
        status=JobStatus.PUBLISHED,
        created_days_ago=18,
        published_days_ago=17,
        direct_views=16,
        new=NewJob(
            title="Data Platform Engineer",
            description=(
                "You will own the data behind the network: the schema, the checks that catch a "
                "bad record the week it lands, and the reports the regulator reads.\n\n"
                "Telecom experience is welcome but not the only way in - somebody who has been "
                "rigorous with somebody else's messy data will do well here."
            ),
            location_key="sy-damascus",
            employment_type=EmploymentType.FULL_TIME,
            work_mode=WorkMode.ONSITE,
        ),
        criteria=JobCriteria(
            minimum_total_experience_years=3,
            skills=[
                JobSkillRequirement(name="SQL", importance=REQUIRED, minimum_years=2),
                JobSkillRequirement(name="Data Analysis", importance=REQUIRED, minimum_years=2),
                JobSkillRequirement(name="Communication", importance=PREFERRED),
            ],
            languages=[
                JobLanguageRequirement(code="ar", minimum_proficiency=NATIVE),
                JobLanguageRequirement(code="en", minimum_proficiency=FLUENT),
            ],
            questions=[
                JobQuestion(
                    question_text=NETWORK_DATA,
                    question_type=YES_NO,
                    is_required=False,
                    accepted_boolean_answer=True,
                ),
            ],
        ),
        links=[
            SeededLink(
                key="network-bulletin",
                name="Syriatel careers bulletin",
                views=26,
                created_days_ago=16,
            ),
        ],
    ),
    SeededJob(
        key="pharmacy",
        tenant=SYRIATEL.key,
        author="tarek",
        status=JobStatus.PUBLISHED,
        created_days_ago=8,
        published_days_ago=2,
        direct_views=11,
        new=NewJob(
            title="Pharmacy Assistant",
            description=(
                "Front of house at our Homs branch: dispensing under a pharmacist, stock, and "
                "the patients who need five minutes rather than one. Training provided."
            ),
            location_key="sy-homs",
            employment_type=EmploymentType.PART_TIME,
            work_mode=WorkMode.ONSITE,
        ),
        criteria=JobCriteria(
            skills=[
                JobSkillRequirement(name="Communication", importance=REQUIRED, minimum_years=1),
            ],
            languages=[
                JobLanguageRequirement(code="ar", minimum_proficiency=NATIVE),
            ],
        ),
    ),
    # A suspended Tenant's Job: published, and nobody can reach the workspace that owns it.
    SeededJob(
        key="dispatch",
        tenant=PALMYRA.key,
        author="samir",
        status=JobStatus.PUBLISHED,
        created_days_ago=63,
        published_days_ago=62,
        direct_views=4,
        new=NewJob(
            title="Dispatch Supervisor",
            description=(
                "Runs the night dispatch desk: drivers, manifests and the phone. Posted before "
                "the account was suspended."
            ),
            location_key="sy-homs",
            employment_type=EmploymentType.FULL_TIME,
            work_mode=WorkMode.ONSITE,
        ),
        criteria=JobCriteria(),
    ),
)


# ── Applications ──────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class SeededApplication:
    candidate: str
    job: str
    applied_days_ago: float
    #: Keyed by question text, because the ids do not exist until the Job is written.
    answers: dict[str, bool | str] = field(default_factory=dict)
    #: The Tracked link the applicant's browser had last read the Job through, if any.
    via: str | None = None
    #: Where a Recruiter took it after `new`, in order. Every hop writes its own history row.
    moves: Sequence[ApplicationStatus] = ()
    #: The Candidate's own move, which ends the process for everybody.
    withdrawn: bool = False
    #: How many advisory AI match assessments have been asked for. Append-only.
    assessments: int = 0
    #: `(recruiter key, text)`, oldest first.
    notes: Sequence[tuple[str, str]] = ()
    #: Names of the Tenant's application-scoped Tags.
    tags: Sequence[str] = ()
    #: Names of the Tenant's Message templates a Recruiter has sent on this Application.
    messages: Sequence[str] = ()


NEW = ApplicationStatus.NEW
REVIEWING = ApplicationStatus.REVIEWING
SHORTLISTED = ApplicationStatus.SHORTLISTED
INTERVIEW = ApplicationStatus.INTERVIEW
OFFER = ApplicationStatus.OFFER
HIRED = ApplicationStatus.HIRED
REJECTED = ApplicationStatus.REJECTED

APPLICATIONS: Final = (
    # ── Senior Backend Engineer: every verdict the domain has, on one Job ──
    SeededApplication(
        candidate="abdulqader",
        job="backend",
        applied_days_ago=39,
        via="backend-linkedin",
        answers={A_RIGHT_TO_WORK: True, AN_ON_CALL_ROTA: True, A_START_DATE: "Two weeks' notice."},
        moves=[REVIEWING, SHORTLISTED, INTERVIEW, OFFER, HIRED],
        assessments=2,
        notes=[
            (
                "lama",
                "Strongest application we have had for this "
                "role. Ledger rewrite is exactly our problem.",
            ),
            (
                "kamal",
                "Phone screen: clear on transactions, asked "
                "good questions about on-call. Moving on.",
            ),
            ("lama", "Offer accepted, starting the 1st. Closing the job."),
        ],
        tags=["Phone screened", "Take-home sent", "Culture fit"],
        messages=["Interview invitation", "Offer letter"],
    ),
    SeededApplication(
        candidate="karim",
        job="backend",
        applied_days_ago=31,
        via="backend-linkedin",
        answers={A_RIGHT_TO_WORK: True, AN_ON_CALL_ROTA: True, A_START_DATE: "A month."},
        moves=[REVIEWING, SHORTLISTED, INTERVIEW],
        assessments=1,
        notes=[
            (
                "kamal",
                "Infrastructure-first, less product code than "
                "AbdulQader, but would raise the floor for everyone.",
            ),
        ],
        tags=[
            "Phone screened",
        ],
        messages=[
            "Interview invitation",
        ],
    ),
    # Skipped the optional knockout: nobody has shown she clears that bar, or that she does not.
    SeededApplication(
        candidate="hiba",
        job="backend",
        applied_days_ago=12,
        answers={A_RIGHT_TO_WORK: True, A_START_DATE: "Immediately."},
        moves=[
            REVIEWING,
        ],
        notes=[
            ("lina", "Screening flagged the on-call question as unanswered - ask her directly."),
        ],
        tags=[
            "Needs a call",
        ],
    ),
    # No Python on the profile at all, so the required skill refuses him outright.
    SeededApplication(
        candidate="mowafak",
        job="backend",
        applied_days_ago=2,
        via="backend-facebook",
        answers={A_RIGHT_TO_WORK: True, AN_ON_CALL_ROTA: False, A_START_DATE: "Flexible."},
    ),
    SeededApplication(
        candidate="fadi",
        job="backend",
        applied_days_ago=9,
        via="backend-fair",
        answers={A_RIGHT_TO_WORK: True, AN_ON_CALL_ROTA: True, A_START_DATE: "Right away."},
        moves=[REVIEWING, REJECTED],
        notes=[
            ("lama", "Too junior for this one. Worth keeping for the internship next summer."),
        ],
        tags=[
            "Salary mismatch",
        ],
    ),
    # ── Frontend Engineer ──
    SeededApplication(
        candidate="mowafak",
        job="frontend",
        applied_days_ago=26,
        via="frontend-linkedin",
        answers={A_DESIGN_SYSTEM: True, A_PORTFOLIO: "https://github.com/SuperMo0"},
        moves=[REVIEWING, SHORTLISTED, INTERVIEW, OFFER],
        assessments=1,
        notes=[
            ("kamal", "Design system work is real - saw the Storybook. Strong on accessibility."),
            ("lina", "Panel liked him. Offer out, waiting to hear."),
        ],
        tags=["Phone screened", "Culture fit"],
        messages=[
            "Interview invitation",
        ],
    ),
    SeededApplication(
        candidate="fadi",
        job="frontend",
        applied_days_ago=8,
        via="frontend-telegram",
        answers={A_DESIGN_SYSTEM: True, A_PORTFOLIO: "https://example.com/fadi/bustimes"},
        moves=[REVIEWING, SHORTLISTED],
        notes=[
            (
                "kamal",
                "Eighteen months of work, so short of the bar on paper. "
                "React work looks fine for the level.",
            ),
        ],
        tags=[
            "Take-home sent",
        ],
    ),
    # Rejected, taken back to reviewing, and rejected again: two decisions, two emails.
    SeededApplication(
        candidate="nadia",
        job="frontend",
        applied_days_ago=24,
        answers={A_DESIGN_SYSTEM: True, A_PORTFOLIO: "https://example.com/secondvisit"},
        moves=[REJECTED, REVIEWING, REJECTED],
        notes=[
            (
                "kamal",
                "Rejected in error - she is a designer, not "
                "an engineer, but I want Lina to see this.",
            ),
            (
                "lina",
                "Agreed she is not right for this role. Saving "
                "her to the pool for the designer job.",
            ),
        ],
    ),
    # ── DevOps ──
    SeededApplication(
        candidate="karim",
        job="devops",
        applied_days_ago=17,
        via="devops-so",
        answers={AN_ON_CALL_ROTA: True},
        moves=[REVIEWING, SHORTLISTED],
        assessments=1,
        notes=[
            ("lama", "Same person as the backend shortlist. Decide which role we want him in."),
        ],
        tags=[
            "Phone screened",
        ],
    ),
    SeededApplication(
        candidate="abdulqader",
        job="devops",
        applied_days_ago=1,
        answers={AN_ON_CALL_ROTA: True},
    ),
    SeededApplication(
        candidate="hiba",
        job="devops",
        applied_days_ago=15,
        via="devops-so",
        answers={AN_ON_CALL_ROTA: True},
        moves=[
            REJECTED,
        ],
    ),
    # ── Data Analyst ──
    SeededApplication(
        candidate="layla",
        job="analyst",
        applied_days_ago=4,
        via="analyst-newsletter",
        moves=[REVIEWING, SHORTLISTED, INTERVIEW],
        notes=[
            (
                "lina",
                "Overqualified on paper and says she wants the three days. Taking her seriously.",
            ),
        ],
        tags=[
            "Phone screened",
        ],
        messages=[
            "Interview invitation",
        ],
    ),
    SeededApplication(
        candidate="abdulqader",
        job="analyst",
        applied_days_ago=3,
        moves=[
            REVIEWING,
        ],
        withdrawn=True,
        notes=[
            ("lina", "Withdrew - said the backend offer settled it."),
        ],
    ),
    SeededApplication(candidate="fadi", job="analyst", applied_days_ago=0.4),
    # ── Office Coordinator, filled ──
    SeededApplication(
        candidate="nadia",
        job="coordinator",
        applied_days_ago=52,
        via="coordinator-facebook",
        moves=[REVIEWING, SHORTLISTED, INTERVIEW, OFFER, HIRED],
        notes=[
            ("lina", "Hired. Started in June and the office has never run better."),
        ],
        tags=[
            "Culture fit",
        ],
    ),
    SeededApplication(
        candidate="hiba",
        job="coordinator",
        applied_days_ago=50,
        moves=[REVIEWING, REJECTED],
        notes=[
            ("lina", "Clearly a QA engineer applying sideways. Told her so kindly."),
        ],
    ),
    # ── Syriatel: the same Candidates, a Tenant that shares nothing with Northbridge ──
    SeededApplication(
        candidate="layla",
        job="network-data",
        applied_days_ago=13,
        via="network-bulletin",
        answers={NETWORK_DATA: True},
        moves=[
            REVIEWING,
        ],
        assessments=1,
        notes=[
            (
                "syriatel_admin",
                "Telemetry experience is thin but the rigour is there. Second interview.",
            ),
        ],
        tags=[
            "Interview booked",
        ],
        messages=[
            "Screening call invite",
        ],
    ),
    SeededApplication(
        candidate="nadia",
        job="network-data",
        applied_days_ago=6,
        notes=[
            ("tarek", "Left the trial-data question blank, hence the flag. Worth a call anyway."),
        ],
    ),
    SeededApplication(candidate="fadi", job="pharmacy", applied_days_ago=0.2),
)


# ── The Tenant's own records ──────────────────────────────────────────────────────────────


@dataclass(frozen=True, slots=True)
class SeededTag:
    tenant: str
    name: str
    scope: TagScope


TAGS: Final = (
    SeededTag(NORTHBRIDGE.key, "Strong hire", TagScope.CANDIDATE),
    SeededTag(NORTHBRIDGE.key, "Keep warm", TagScope.CANDIDATE),
    SeededTag(NORTHBRIDGE.key, "Referral", TagScope.CANDIDATE),
    SeededTag(NORTHBRIDGE.key, "Needs sponsorship", TagScope.CANDIDATE),
    SeededTag(NORTHBRIDGE.key, "Phone screened", TagScope.APPLICATION),
    SeededTag(NORTHBRIDGE.key, "Take-home sent", TagScope.APPLICATION),
    SeededTag(NORTHBRIDGE.key, "Culture fit", TagScope.APPLICATION),
    SeededTag(NORTHBRIDGE.key, "Salary mismatch", TagScope.APPLICATION),
    SeededTag(NORTHBRIDGE.key, "Needs a call", TagScope.APPLICATION),
    SeededTag(SYRIATEL.key, "Systems background", TagScope.CANDIDATE),
    SeededTag(SYRIATEL.key, "Interview booked", TagScope.APPLICATION),
)


@dataclass(frozen=True, slots=True)
class SeededCandidateRecord:
    """What a Tenant has filed about one Candidate, outside any Application."""

    tenant: str
    candidate: str
    pooled: bool = False
    pooled_days_ago: float = 20
    tags: Sequence[str] = ()
    notes: Sequence[tuple[str, str]] = ()


CANDIDATE_RECORDS: Final = (
    SeededCandidateRecord(
        tenant=NORTHBRIDGE.key,
        candidate="abdulqader",
        pooled=True,
        pooled_days_ago=38,
        tags=[
            "Strong hire",
        ],
        notes=[
            (
                "lama",
                "Hired for the backend role. Keeping the record for the reference we owe her.",
            ),
        ],
    ),
    SeededCandidateRecord(
        tenant=NORTHBRIDGE.key,
        candidate="karim",
        pooled=True,
        pooled_days_ago=30,
        tags=["Strong hire", "Keep warm"],
        notes=[
            (
                "lama",
                "Two shortlists at once. If the backend offer "
                "lands elsewhere, he is the platform hire.",
            ),
            (
                "kamal",
                "Found him through Global search before he "
                "applied - worth remembering that worked.",
            ),
        ],
    ),
    SeededCandidateRecord(
        tenant=NORTHBRIDGE.key,
        candidate="nadia",
        pooled=True,
        pooled_days_ago=23,
        tags=["Keep warm", "Referral"],
        notes=[
            (
                "lina",
                "Wrong for the frontend job, right for the "
                "designer draft. Ping her when it publishes.",
            ),
        ],
    ),
    SeededCandidateRecord(
        tenant=NORTHBRIDGE.key,
        candidate="layla",
        pooled=True,
        pooled_days_ago=4,
        tags=[
            "Keep warm",
        ],
    ),
    # Not searchable, and reachable anyway: she has applied to this Tenant.
    SeededCandidateRecord(
        tenant=NORTHBRIDGE.key,
        candidate="hiba",
        tags=[
            "Keep warm",
        ],
        notes=[
            (
                "lina",
                "Applied to three of ours. Nothing open that fits QA - tell her when there is.",
            ),
        ],
    ),
    SeededCandidateRecord(
        tenant=SYRIATEL.key,
        candidate="layla",
        pooled=True,
        pooled_days_ago=12,
        tags=[
            "Systems background",
        ],
        notes=[
            ("syriatel_admin", "Northbridge is also talking to her. Move quickly."),
        ],
    ),
    # Found through Global search, never applied here: the third way a Tenant reaches somebody.
    SeededCandidateRecord(
        tenant=SYRIATEL.key,
        candidate="mowafak",
        pooled=True,
        pooled_days_ago=9,
        notes=[
            ("tarek", "Not hiring frontend yet. Saved from search so we do not lose him."),
        ],
    ),
)


@dataclass(frozen=True, slots=True)
class SeededTemplate:
    tenant: str
    author: str
    name: str
    subject: str
    body: str
    created_days_ago: float = 40


TEMPLATES: Final = (
    SeededTemplate(
        tenant=NORTHBRIDGE.key,
        author="lama",
        name="Interview invitation",
        created_days_ago=45,
        subject="{{ job_title }} at {{ tenant_name }} - interview?",
        body=(
            "Hi {{ candidate_name }},\n\n"
            "Thank you for applying for {{ job_title }}. We would like to talk properly - "
            "would an hour this week or next suit you?\n\n"
            "Reply with two or three times that work and I will send an invitation.\n\n"
            "Best,\nThe {{ tenant_name }} team"
        ),
    ),
    SeededTemplate(
        tenant=NORTHBRIDGE.key,
        author="kamal",
        name="Take-home assignment",
        created_days_ago=44,
        subject="A small exercise for {{ job_title }}",
        body=(
            "Hi {{ candidate_name }},\n\n"
            "Next step for {{ job_title }} is a short exercise - two hours at most, and we "
            "mean that. Attached, with the instructions at the top.\n\n"
            "Take it whenever suits you this week. We read it before the interview, not "
            "instead of it.\n\n"
            "Best,\n{{ tenant_name }}"
        ),
    ),
    SeededTemplate(
        tenant=NORTHBRIDGE.key,
        author="lama",
        name="Offer letter",
        created_days_ago=40,
        subject="An offer from {{ tenant_name }}",
        body=(
            "Hi {{ candidate_name }},\n\n"
            "We would like you to join us as {{ job_title }}. The formal letter is attached, "
            "with the salary, the start date we hoped for and the benefits.\n\n"
            "Read it, sleep on it, and ask us anything.\n\n"
            "Warmly,\n{{ tenant_name }}"
        ),
    ),
    SeededTemplate(
        tenant=NORTHBRIDGE.key,
        author="lina",
        name="After the interview, no",
        created_days_ago=39,
        subject="About the {{ job_title }} role",
        body=(
            "Hi {{ candidate_name }},\n\n"
            "Thank you for the time you gave us for {{ job_title }}. We have decided not to go "
            "ahead, and I am sorry - it was a close call and the panel liked you.\n\n"
            "If you would like specific feedback, ask and I will write it properly.\n\n"
            "Best,\n{{ tenant_name }}"
        ),
    ),
    SeededTemplate(
        tenant=SYRIATEL.key,
        author="syriatel_admin",
        name="Screening call invite",
        created_days_ago=17,
        subject="{{ tenant_name }}: a 20-minute call about {{ job_title }}",
        body=(
            "Dear {{ candidate_name }},\n\n"
            "Thank you for your interest in {{ job_title }}. Before anything longer, could we "
            "have twenty minutes on the phone this week?\n\n"
            "Kind regards,\n{{ tenant_name }}"
        ),
    ),
)
