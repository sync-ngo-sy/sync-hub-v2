import datetime
import decimal
import enum
import uuid
from typing import Any, Optional

from pgvector.sqlalchemy.vector import VECTOR
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Computed,
    Date,
    DateTime,
    Enum,
    ForeignKeyConstraint,
    Identity,
    Index,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    SmallInteger,
    String,
    Table,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class AccessRequestStatus(enum.StrEnum):
    PENDING = "pending"
    CONVERTED = "converted"
    DISMISSED = "dismissed"


class AccountType(enum.StrEnum):
    CANDIDATE = "candidate"
    RECRUITER = "recruiter"
    PLATFORM_ADMIN = "platform_admin"


class ApplicationQuestionType(enum.StrEnum):
    YES_NO = "yes_no"
    SHORT_TEXT = "short_text"


class ApplicationStatus(enum.StrEnum):
    NEW = "new"
    REVIEWING = "reviewing"
    SHORTLISTED = "shortlisted"
    INTERVIEW = "interview"
    OFFER = "offer"
    HIRED = "hired"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"


class AssessmentStatus(enum.StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class CommunicationChannel(enum.StrEnum):
    EMAIL = "email"
    SMS = "sms"


class CommunicationStatus(enum.StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    SENT = "sent"
    FAILED = "failed"


class CommunicationType(enum.StrEnum):
    APPLICATION_CONFIRMATION = "application_confirmation"
    APPLICATION_REJECTION = "application_rejection"
    RECRUITER_MESSAGE = "recruiter_message"


class CvParsingStatus(enum.StrEnum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class EmploymentType(enum.StrEnum):
    FULL_TIME = "full_time"
    PART_TIME = "part_time"
    CONTRACT = "contract"
    TEMPORARY = "temporary"
    INTERNSHIP = "internship"
    VOLUNTEER = "volunteer"


class HireConfirmation(enum.StrEnum):
    UNANSWERED = "unanswered"
    CONFIRMED = "confirmed"
    DENIED = "denied"


class IngestionStatus(enum.StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobStatus(enum.StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"
    ARCHIVED = "archived"


class LanguageProficiency(enum.StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    FLUENT = "fluent"
    NATIVE = "native"


class LocationKind(enum.StrEnum):
    COUNTRY = "country"
    GOVERNORATE = "governorate"


class NotificationType(enum.StrEnum):
    CV_PARSE_FAILED = "cv_parse_failed"
    CV_PARSE_SUCCEEDED = "cv_parse_succeeded"
    APPLICATION_STAGE_CHANGED = "application_stage_changed"


class QualificationStatus(enum.StrEnum):
    PENDING = "pending"
    QUALIFIED = "qualified"
    DISQUALIFIED = "disqualified"
    REVIEW_REQUIRED = "review_required"


class RecruiterRole(enum.StrEnum):
    ADMIN = "admin"
    RECRUITER = "recruiter"


class SkillImportance(enum.StrEnum):
    REQUIRED = "required"
    PREFERRED = "preferred"
    OPTIONAL = "optional"


class StatusChangeSource(enum.StrEnum):
    RECRUITER = "recruiter"
    CANDIDATE = "candidate"
    SYSTEM = "system"


class TagScope(enum.StrEnum):
    CANDIDATE = "candidate"
    APPLICATION = "application"


class TenantPlan(enum.StrEnum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class WorkMode(enum.StrEnum):
    ONSITE = "onsite"
    HYBRID = "hybrid"
    REMOTE = "remote"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "email_change_confirm_status >= 0 AND email_change_confirm_status <= 2",
            name="users_email_change_confirm_status_check",
        ),
        PrimaryKeyConstraint("id", name="users_pkey"),
        UniqueConstraint("phone", name="users_phone_key"),
        Index(
            "confirmation_token_idx",
            "confirmation_token",
            postgresql_where="((confirmation_token)::text !~ '^[0-9 ]*$'::text)",
            unique=True,
        ),
        Index(
            "email_change_token_current_idx",
            "email_change_token_current",
            postgresql_where="((email_change_token_current)::text !~ '^[0-9 ]*$'::text)",
            unique=True,
        ),
        Index(
            "email_change_token_new_idx",
            "email_change_token_new",
            postgresql_where="((email_change_token_new)::text !~ '^[0-9 ]*$'::text)",
            unique=True,
        ),
        Index(
            "reauthentication_token_idx",
            "reauthentication_token",
            postgresql_where="((reauthentication_token)::text !~ '^[0-9 ]*$'::text)",
            unique=True,
        ),
        Index(
            "recovery_token_idx",
            "recovery_token",
            postgresql_where="((recovery_token)::text !~ '^[0-9 ]*$'::text)",
            unique=True,
        ),
        Index(
            "users_email_partial_key",
            "email",
            postgresql_where="(is_sso_user = false)",
            unique=True,
        ),
        Index("users_instance_id_email_idx", "instance_id"),
        Index("users_instance_id_idx", "instance_id"),
        Index("users_is_anonymous_idx", "is_anonymous"),
        {"comment": "Auth: Stores user login data within a secure schema.", "schema": "auth"},
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    is_sso_user: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.",
    )
    is_anonymous: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    instance_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    aud: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    encrypted_password: Mapped[str | None] = mapped_column(String(255))
    email_confirmed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    invited_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    confirmation_token: Mapped[str | None] = mapped_column(String(255))
    confirmation_sent_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    recovery_token: Mapped[str | None] = mapped_column(String(255))
    recovery_sent_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    email_change_token_new: Mapped[str | None] = mapped_column(String(255))
    email_change: Mapped[str | None] = mapped_column(String(255))
    email_change_sent_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    last_sign_in_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    raw_app_meta_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    raw_user_meta_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    is_super_admin: Mapped[bool | None] = mapped_column(Boolean)
    created_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    updated_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    phone: Mapped[str | None] = mapped_column(Text, server_default=text("NULL::character varying"))
    phone_confirmed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    phone_change: Mapped[str | None] = mapped_column(
        Text, server_default=text("''::character varying")
    )
    phone_change_token: Mapped[str | None] = mapped_column(
        String(255), server_default=text("''::character varying")
    )
    phone_change_sent_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    confirmed_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(True), Computed("LEAST(email_confirmed_at, phone_confirmed_at)", persisted=True)
    )
    email_change_token_current: Mapped[str | None] = mapped_column(
        String(255), server_default=text("''::character varying")
    )
    email_change_confirm_status: Mapped[int | None] = mapped_column(
        SmallInteger, server_default=text("0")
    )
    banned_until: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    reauthentication_token: Mapped[str | None] = mapped_column(
        String(255), server_default=text("''::character varying")
    )
    reauthentication_sent_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))


t_candidate_directory_profiles = Table(
    "candidate_directory_profiles",
    Base.metadata,
    Column("candidate_id", Uuid),
    Column("created_at", DateTime(True)),
    Column("full_name", Text),
    Column("avatar_url", Text),
    Column("headline", Text),
    Column("summary", Text),
    Column("location_key", Text),
    Column("location_name", Text),
    Column("canonical_role_key", Text),
    Column("canonical_role_name", Text),
    Column("total_experience_years", Integer),
    Column("language_names", ARRAY(Text())),
    schema="public",
)


t_candidate_search_profiles = Table(
    "candidate_search_profiles",
    Base.metadata,
    Column("candidate_id", Uuid),
    Column("created_at", DateTime(True)),
    Column("full_name", Text),
    Column("avatar_url", Text),
    Column("headline", Text),
    Column("summary", Text),
    Column("location_key", Text),
    Column("location_name", Text),
    Column("canonical_role_key", Text),
    Column("canonical_role_name", Text),
    Column("total_experience_years", Integer),
    Column("language_names", ARRAY(Text())),
    schema="public",
)


class Candidate(Base):
    __tablename__ = "candidates"
    __table_args__ = (
        CheckConstraint(
            "NOT is_searchable OR current_cv_id IS NOT NULL", name="candidates_searchable_needs_cv"
        ),
        CheckConstraint(
            "NOT is_searchable OR profile_completed_at IS NOT NULL",
            name="candidates_searchable_needs_a_complete_profile",
        ),
        CheckConstraint(
            "account_type = 'candidate'::account_type", name="candidates_account_type_check"
        ),
        CheckConstraint(
            "github_url IS NULL OR github_url ~~ 'https://github.com/%%'::text AND length(github_url) <= 2000",
            name="candidates_github_url_shape",
        ),
        CheckConstraint("length(headline) <= 200", name="candidates_headline_length"),
        CheckConstraint("length(summary) <= 5000", name="candidates_summary_length"),
        CheckConstraint(
            "linkedin_url IS NULL OR linkedin_url ~~ 'https://www.linkedin.com/in/%%'::text AND length(linkedin_url) <= 2000",
            name="candidates_linkedin_url_shape",
        ),
        CheckConstraint(
            "portfolio_url IS NULL OR (portfolio_url ~~ 'http://%%'::text OR portfolio_url ~~ 'https://%%'::text) AND length(portfolio_url) <= 2000",
            name="candidates_portfolio_url_shape",
        ),
        CheckConstraint(
            "profile_completed_at IS NULL OR current_cv_id IS NOT NULL AND headline IS NOT NULL AND btrim(headline) <> ''::text AND summary IS NOT NULL AND btrim(summary) <> ''::text AND location_key IS NOT NULL AND canonical_role_key IS NOT NULL",
            name="candidates_completed_profile_is_filled_in",
        ),
        CheckConstraint("total_experience_years >= 0", name="candidates_total_experience_nonneg"),
        ForeignKeyConstraint(
            ["canonical_role_key"],
            ["public.canonical_roles.key"],
            name="candidates_canonical_role_fk",
        ),
        ForeignKeyConstraint(
            ["id", "account_type"],
            ["public.profiles.id", "public.profiles.account_type"],
            ondelete="CASCADE",
            name="candidates_id_account_type_fkey",
        ),
        ForeignKeyConstraint(
            ["id", "current_cv_id"],
            ["public.cvs.candidate_id", "public.cvs.id"],
            ondelete="RESTRICT",
            name="candidates_current_cv_fk",
        ),
        ForeignKeyConstraint(
            ["location_key"], ["public.locations.key"], name="candidates_location_fk"
        ),
        PrimaryKeyConstraint("id", name="candidates_pkey"),
        Index("candidates_canonical_role_idx", "canonical_role_key"),
        Index("candidates_current_cv_id_idx", "current_cv_id"),
        Index(
            "candidates_directory_idx",
            "created_at",
            "id",
            postgresql_where="(is_searchable AND (deleted_at IS NULL))",
        ),
        Index("candidates_location_key_idx", "location_key"),
        Index(
            "candidates_searchable_idx",
            "id",
            postgresql_where="(is_searchable AND (deleted_at IS NULL))",
        ),
        Index("candidates_total_experience_idx", "total_experience_years"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    account_type: Mapped[AccountType] = mapped_column(
        Enum(
            AccountType,
            values_callable=lambda cls: [member.value for member in cls],
            name="account_type",
        ),
        nullable=False,
        server_default=text("'candidate'::account_type"),
    )
    total_experience_years: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    unmapped_skills: Mapped[list[str]] = mapped_column(
        ARRAY(Text()), nullable=False, server_default=text("'{}'::text[]")
    )
    is_searchable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("false")
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    current_cv_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    headline: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    location_key: Mapped[str | None] = mapped_column(Text)
    canonical_role_key: Mapped[str | None] = mapped_column(Text)
    linkedin_url: Mapped[str | None] = mapped_column(Text)
    github_url: Mapped[str | None] = mapped_column(Text)
    portfolio_url: Mapped[str | None] = mapped_column(Text)
    profile_completed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))

    canonical_role: Mapped[Optional["CanonicalRole"]] = relationship("CanonicalRole", viewonly=True)
    profile: Mapped["Profile"] = relationship("Profile", viewonly=True)
    cv: Mapped[Optional["Cv"]] = relationship("Cv", foreign_keys=[id, current_cv_id], viewonly=True)
    location: Mapped[Optional["Location"]] = relationship("Location", viewonly=True)


class CanonicalRole(Base):
    __tablename__ = "canonical_roles"
    __table_args__ = (
        PrimaryKeyConstraint("key", name="canonical_roles_pkey"),
        UniqueConstraint("name", name="canonical_roles_name_key"),
        {"schema": "public"},
    )

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)


class Cv(Base):
    __tablename__ = "cvs"
    __table_args__ = (
        CheckConstraint(
            "parsing_status <> 'failed'::cv_parsing_status OR parsing_error IS NOT NULL",
            name="cvs_failure_has_a_reason",
        ),
        CheckConstraint(
            "parsing_status <> 'ready'::cv_parsing_status OR parsed_cv_data IS NOT NULL AND parsed_at IS NOT NULL",
            name="cvs_ready_has_a_parse",
        ),
        ForeignKeyConstraint(
            ["candidate_id"],
            ["public.candidates.id"],
            ondelete="CASCADE",
            name="cvs_candidate_id_fkey",
        ),
        ForeignKeyConstraint(
            ["detected_language"], ["public.languages.code"], name="cvs_detected_language_fk"
        ),
        PrimaryKeyConstraint("id", name="cvs_pkey"),
        UniqueConstraint("candidate_id", "id", name="cvs_candidate_id_id_key"),
        Index(
            "cvs_candidate_file_hash_active_uidx",
            "candidate_id",
            "file_hash",
            postgresql_where="(deleted_at IS NULL)",
            unique=True,
        ),
        Index("cvs_candidate_parsing_status_idx", "candidate_id", "parsing_status"),
        Index("cvs_detected_language_idx", "detected_language"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_hash: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_cv_schema_version: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("1")
    )
    parsing_status: Mapped[CvParsingStatus] = mapped_column(
        Enum(
            CvParsingStatus,
            values_callable=lambda cls: [member.value for member in cls],
            name="cv_parsing_status",
        ),
        nullable=False,
        server_default=text("'uploaded'::cv_parsing_status"),
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    detected_language: Mapped[str | None] = mapped_column(Text)
    parsed_cv_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    parsing_error: Mapped[str | None] = mapped_column(Text)
    parsed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))

    candidate: Mapped["Candidate"] = relationship(
        "Candidate", foreign_keys=[candidate_id], viewonly=True
    )
    language: Mapped[Optional["Language"]] = relationship("Language", viewonly=True)


class EmbeddingModel(Base):
    __tablename__ = "embedding_models"
    __table_args__ = (
        PrimaryKeyConstraint("model", name="embedding_models_pkey"),
        Index("embedding_models_holds_one_model", unique=True),
        {"schema": "public"},
    )

    model: Mapped[str] = mapped_column(Text, primary_key=True)
    established_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )


class Language(Base):
    __tablename__ = "languages"
    __table_args__ = (
        PrimaryKeyConstraint("code", name="languages_pkey"),
        UniqueConstraint("name", name="languages_name_key"),
        {"schema": "public"},
    )

    code: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)


class Location(Base):
    __tablename__ = "locations"
    __table_args__ = (
        PrimaryKeyConstraint("key", name="locations_pkey"),
        UniqueConstraint("name", name="locations_name_key"),
        {"schema": "public"},
    )

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[LocationKind] = mapped_column(
        Enum(
            LocationKind,
            values_callable=lambda cls: [member.value for member in cls],
            name="location_kind",
        ),
        nullable=False,
    )


t_placements = Table(
    "placements",
    Base.metadata,
    Column("application_id", Uuid),
    Column("tenant_id", Uuid),
    Column("claimed_by_recruiter_id", Uuid),
    Column("start_date", Date),
    Column("claimed_at", DateTime(True)),
    Column("confirmed_at", DateTime(True)),
    schema="public",
)


class SkillCategory(Base):
    __tablename__ = "skill_categories"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="skill_categories_pkey"),
        UniqueConstraint("name", name="skill_categories_name_key"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )


class Tenant(Base):
    __tablename__ = "tenants"
    __table_args__ = (
        PrimaryKeyConstraint("id", name="tenants_pkey"),
        UniqueConstraint("slug", name="tenants_slug_key"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    plan: Mapped[TenantPlan] = mapped_column(
        Enum(
            TenantPlan,
            values_callable=lambda cls: [member.value for member in cls],
            name="tenant_plan",
        ),
        nullable=False,
        server_default=text("'free'::tenant_plan"),
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )


class AccessRequest(Base):
    __tablename__ = "access_requests"
    __table_args__ = (
        CheckConstraint(
            "\nCASE status\n    WHEN 'pending'::access_request_status THEN decided_at IS NULL AND tenant_id IS NULL\n    WHEN 'dismissed'::access_request_status THEN decided_at IS NOT NULL AND tenant_id IS NULL\n    WHEN 'converted'::access_request_status THEN decided_at IS NOT NULL\n    ELSE NULL::boolean\nEND",
            name="access_requests_decision",
        ),
        CheckConstraint("btrim(company) <> ''::text", name="access_requests_company_not_blank"),
        CheckConstraint("btrim(full_name) <> ''::text", name="access_requests_full_name_not_blank"),
        CheckConstraint(
            "email ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'::text",
            name="access_requests_email_shape",
        ),
        ForeignKeyConstraint(
            ["tenant_id"],
            ["public.tenants.id"],
            ondelete="SET NULL",
            name="access_requests_tenant_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="access_requests_pkey"),
        Index(
            "access_requests_one_pending_per_email_idx",
            postgresql_where="(status = 'pending'::access_request_status)",
            unique=True,
        ),
        Index(
            "access_requests_pending_idx",
            "created_at",
            postgresql_where="(status = 'pending'::access_request_status)",
        ),
        Index("access_requests_tenant_id_idx", "tenant_id"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    company: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[AccessRequestStatus] = mapped_column(
        Enum(
            AccessRequestStatus,
            values_callable=lambda cls: [member.value for member in cls],
            name="access_request_status",
        ),
        nullable=False,
        server_default=text("'pending'::access_request_status"),
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    decided_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))

    tenant: Mapped[Optional["Tenant"]] = relationship("Tenant", viewonly=True)


class CandidateEducation(Base):
    __tablename__ = "candidate_educations"
    __table_args__ = (
        CheckConstraint(
            "graduation_year IS NULL OR graduation_year >= 1900 AND graduation_year <= 2100",
            name="cedu_grad_year_range",
        ),
        ForeignKeyConstraint(
            ["candidate_id"],
            ["public.candidates.id"],
            ondelete="CASCADE",
            name="candidate_educations_candidate_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="candidate_educations_pkey"),
        Index("candidate_educations_grad_year_idx", "candidate_id", "graduation_year"),
        Index("candidate_educations_sort_order_idx", "candidate_id", "sort_order"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    institution: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    degree: Mapped[str | None] = mapped_column(Text)
    field_of_study: Mapped[str | None] = mapped_column(Text)
    graduation_year: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)

    candidate: Mapped["Candidate"] = relationship("Candidate", viewonly=True)


class CandidateEmbeddingJob(Base):
    __tablename__ = "candidate_embedding_jobs"
    __table_args__ = (
        CheckConstraint("attempts >= 0", name="cej_attempts_nonneg"),
        ForeignKeyConstraint(
            ["candidate_id"],
            ["public.candidates.id"],
            ondelete="CASCADE",
            name="candidate_embedding_jobs_candidate_id_fkey",
        ),
        PrimaryKeyConstraint("candidate_id", name="candidate_embedding_jobs_pkey"),
        Index("candidate_embedding_jobs_claim_idx", "updated_at", postgresql_where="dirty"),
        Index(
            "candidate_embedding_jobs_stuck_idx",
            "claimed_at",
            postgresql_where="(claimed_at IS NOT NULL)",
        ),
        {"schema": "public"},
    )

    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    dirty: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    revision: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("1"))
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    claimed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    error_message: Mapped[str | None] = mapped_column(Text)

    candidate: Mapped["Candidate"] = relationship("Candidate", viewonly=True)


class CandidateExperience(Base):
    __tablename__ = "candidate_experiences"
    __table_args__ = (
        CheckConstraint(
            "NOT is_current OR end_year IS NULL AND end_month IS NULL",
            name="cexp_current_has_no_end",
        ),
        CheckConstraint(
            "end_month IS NULL OR end_month >= 1 AND end_month <= 12", name="cexp_end_month_range"
        ),
        CheckConstraint(
            "end_year IS NULL OR end_year >= 1900 AND end_year <= 2100", name="cexp_end_year_range"
        ),
        CheckConstraint("is_current OR end_year IS NOT NULL", name="cexp_finished_work_has_an_end"),
        CheckConstraint(
            "start_month IS NULL OR start_month >= 1 AND start_month <= 12",
            name="cexp_start_month_range",
        ),
        CheckConstraint(
            "start_year IS NULL OR end_year IS NULL OR end_year > start_year OR end_year = start_year AND COALESCE(end_month, 12) >= COALESCE(start_month, 1)",
            name="cexp_ordered",
        ),
        CheckConstraint(
            "start_year IS NULL OR start_year >= 1900 AND start_year <= 2100",
            name="cexp_start_year_range",
        ),
        ForeignKeyConstraint(
            ["candidate_id"],
            ["public.candidates.id"],
            ondelete="CASCADE",
            name="candidate_experiences_candidate_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="candidate_experiences_pkey"),
        Index("candidate_experiences_sort_order_idx", "candidate_id", "sort_order"),
        Index("candidate_experiences_start_year_idx", "candidate_id", "start_year"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    job_title: Mapped[str] = mapped_column(Text, nullable=False)
    start_year: Mapped[int] = mapped_column(Integer, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    company_name: Mapped[str | None] = mapped_column(Text)
    start_month: Mapped[int | None] = mapped_column(Integer)
    end_year: Mapped[int | None] = mapped_column(Integer)
    end_month: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)

    candidate: Mapped["Candidate"] = relationship("Candidate", viewonly=True)


class CandidateLanguage(Base):
    __tablename__ = "candidate_languages"
    __table_args__ = (
        ForeignKeyConstraint(
            ["candidate_id"],
            ["public.candidates.id"],
            ondelete="CASCADE",
            name="candidate_languages_candidate_id_fkey",
        ),
        ForeignKeyConstraint(
            ["language_code"],
            ["public.languages.code"],
            name="candidate_languages_language_code_fkey",
        ),
        PrimaryKeyConstraint("candidate_id", "language_code", name="candidate_languages_pkey"),
        Index("candidate_languages_language_idx", "language_code", "candidate_id"),
        Index("candidate_languages_sort_order_idx", "candidate_id", "sort_order"),
        {"schema": "public"},
    )

    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    language_code: Mapped[str] = mapped_column(Text, primary_key=True)
    proficiency: Mapped[LanguageProficiency] = mapped_column(
        Enum(
            LanguageProficiency,
            values_callable=lambda cls: [member.value for member in cls],
            name="language_proficiency",
        ),
        nullable=False,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )

    candidate: Mapped["Candidate"] = relationship("Candidate", viewonly=True)
    language: Mapped["Language"] = relationship("Language", viewonly=True)


class CandidateProfileChunk(Base):
    __tablename__ = "candidate_profile_chunks"
    __table_args__ = (
        ForeignKeyConstraint(
            ["candidate_id"],
            ["public.candidates.id"],
            ondelete="CASCADE",
            name="candidate_profile_chunks_candidate_id_fkey",
        ),
        ForeignKeyConstraint(
            ["embedding_model"],
            ["public.embedding_models.model"],
            name="candidate_profile_chunks_embedding_model_fkey",
        ),
        PrimaryKeyConstraint("id", name="candidate_profile_chunks_pkey"),
        UniqueConstraint(
            "candidate_id",
            "chunk_index",
            name="candidate_profile_chunks_candidate_id_chunk_index_key",
        ),
        Index(
            "candidate_profile_chunks_embedding_hnsw",
            "embedding",
            postgresql_ops={"embedding": "vector_cosine_ops"},
            postgresql_using="hnsw",
        ),
        Index("candidate_profile_chunks_search_idx", "search_vector", postgresql_using="gin"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    chunk_text: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    embedding: Mapped[Any] = mapped_column(VECTOR(768), nullable=False)
    embedding_model: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    chunk_type: Mapped[str | None] = mapped_column(Text)
    search_vector: Mapped[Any | None] = mapped_column(
        TSVECTOR, Computed("to_tsvector('english'::regconfig, chunk_text)", persisted=True)
    )

    candidate: Mapped["Candidate"] = relationship("Candidate", viewonly=True)
    embedding_model_: Mapped["EmbeddingModel"] = relationship("EmbeddingModel", viewonly=True)


class CandidateProject(Base):
    __tablename__ = "candidate_projects"
    __table_args__ = (
        CheckConstraint(
            "end_month IS NULL OR end_month >= 1 AND end_month <= 12", name="cproj_end_month_range"
        ),
        CheckConstraint(
            "start_month IS NULL OR start_month >= 1 AND start_month <= 12",
            name="cproj_start_month_range",
        ),
        CheckConstraint(
            "start_year IS NULL OR end_year IS NULL OR end_year > start_year OR end_year = start_year AND COALESCE(end_month, 12) >= COALESCE(start_month, 1)",
            name="cproj_ordered",
        ),
        ForeignKeyConstraint(
            ["candidate_id"],
            ["public.candidates.id"],
            ondelete="CASCADE",
            name="candidate_projects_candidate_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="candidate_projects_pkey"),
        Index("candidate_projects_sort_order_idx", "candidate_id", "sort_order"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    description: Mapped[str | None] = mapped_column(Text)
    project_url: Mapped[str | None] = mapped_column(Text)
    repository_url: Mapped[str | None] = mapped_column(Text)
    start_year: Mapped[int | None] = mapped_column(Integer)
    start_month: Mapped[int | None] = mapped_column(Integer)
    end_year: Mapped[int | None] = mapped_column(Integer)
    end_month: Mapped[int | None] = mapped_column(Integer)

    candidate: Mapped["Candidate"] = relationship("Candidate", viewonly=True)


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"
    __table_args__ = (
        CheckConstraint("attempts >= 0", name="ingestion_jobs_attempts_nonneg"),
        ForeignKeyConstraint(
            ["cv_id"], ["public.cvs.id"], ondelete="CASCADE", name="ingestion_jobs_cv_id_fkey"
        ),
        PrimaryKeyConstraint("id", name="ingestion_jobs_pkey"),
        UniqueConstraint("cv_id", name="ingestion_jobs_cv_id_key"),
        Index(
            "ingestion_jobs_claim_idx",
            "available_at",
            postgresql_where="(status = ANY (ARRAY['pending'::ingestion_status, 'processing'::ingestion_status]))",
        ),
        Index("ingestion_jobs_status_created_idx", "status", "created_at"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    cv_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status: Mapped[IngestionStatus] = mapped_column(
        Enum(
            IngestionStatus,
            values_callable=lambda cls: [member.value for member in cls],
            name="ingestion_status",
        ),
        nullable=False,
        server_default=text("'pending'::ingestion_status"),
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    available_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    started_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    completed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))

    cv: Mapped["Cv"] = relationship("Cv", viewonly=True)


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = (
        CheckConstraint(
            "num_nonnulls(phone, phone_country) <> 1", name="profiles_phone_has_a_country"
        ),
        CheckConstraint("phone ~ '^\\+[1-9][0-9]{1,14}$'::text", name="profiles_phone_is_e164"),
        CheckConstraint("phone_country ~ '^[A-Z]{2}$'::text", name="profiles_phone_country_is_iso"),
        ForeignKeyConstraint(
            ["id"], ["auth.users.id"], ondelete="CASCADE", name="profiles_id_fkey"
        ),
        PrimaryKeyConstraint("id", name="profiles_pkey"),
        UniqueConstraint("id", "account_type", name="profiles_id_account_type_key"),
        Index("profiles_active_idx", "id", postgresql_where="(deleted_at IS NULL)"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    account_type: Mapped[AccountType] = mapped_column(
        Enum(
            AccountType,
            values_callable=lambda cls: [member.value for member in cls],
            name="account_type",
        ),
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    avatar_url: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text)
    phone_country: Mapped[str | None] = mapped_column(Text)
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))

    user: Mapped["User"] = relationship("User", viewonly=True)


class SkillTaxonomy(Base):
    __tablename__ = "skill_taxonomy"
    __table_args__ = (
        ForeignKeyConstraint(
            ["category_id"], ["public.skill_categories.id"], name="skill_taxonomy_category_id_fkey"
        ),
        PrimaryKeyConstraint("id", name="skill_taxonomy_pkey"),
        UniqueConstraint("canonical_name", name="skill_taxonomy_canonical_name_key"),
        Index("skill_taxonomy_category_id_idx", "category_id"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    category_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    canonical_name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )

    category: Mapped["SkillCategory"] = relationship("SkillCategory", viewonly=True)


class TenantTag(Base):
    __tablename__ = "tenant_tags"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id"], ["public.tenants.id"], name="tenant_tags_tenant_id_fkey"
        ),
        PrimaryKeyConstraint("id", name="tenant_tags_pkey"),
        UniqueConstraint("id", "scope", name="tenant_tags_id_scope_key"),
        UniqueConstraint("tenant_id", "id", name="tenant_tags_tenant_id_id_key"),
        UniqueConstraint("tenant_id", "scope", "name", name="tenant_tags_tenant_id_scope_name_key"),
        Index("tenant_tags_tenant_scope_name_ci_uidx", "tenant_id", "scope", unique=True),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    scope: Mapped[TagScope] = mapped_column(
        Enum(
            TagScope, values_callable=lambda cls: [member.value for member in cls], name="tag_scope"
        ),
        nullable=False,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", viewonly=True)


class CandidateSkill(Base):
    __tablename__ = "candidate_skills"
    __table_args__ = (
        CheckConstraint("years_experience >= 0::numeric", name="cskill_years_nonneg"),
        ForeignKeyConstraint(
            ["candidate_id"],
            ["public.candidates.id"],
            ondelete="CASCADE",
            name="candidate_skills_candidate_id_fkey",
        ),
        ForeignKeyConstraint(
            ["taxonomy_id"], ["public.skill_taxonomy.id"], name="candidate_skills_taxonomy_id_fkey"
        ),
        PrimaryKeyConstraint("candidate_id", "taxonomy_id", name="candidate_skills_pkey"),
        Index("candidate_skills_sort_order_idx", "candidate_id", "sort_order"),
        Index("candidate_skills_taxonomy_idx", "taxonomy_id", "candidate_id"),
        {"schema": "public"},
    )

    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    taxonomy_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    years_experience: Mapped[decimal.Decimal] = mapped_column(Numeric(4, 1), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )

    candidate: Mapped["Candidate"] = relationship("Candidate", viewonly=True)
    taxonomy: Mapped["SkillTaxonomy"] = relationship("SkillTaxonomy", viewonly=True)


class PlatformAdmin(Base):
    __tablename__ = "platform_admins"
    __table_args__ = (
        CheckConstraint(
            "account_type = 'platform_admin'::account_type",
            name="platform_admins_account_type_check",
        ),
        ForeignKeyConstraint(
            ["id", "account_type"],
            ["public.profiles.id", "public.profiles.account_type"],
            ondelete="CASCADE",
            name="platform_admins_id_account_type_fkey",
        ),
        PrimaryKeyConstraint("id", name="platform_admins_pkey"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    account_type: Mapped[AccountType] = mapped_column(
        Enum(
            AccountType,
            values_callable=lambda cls: [member.value for member in cls],
            name="account_type",
        ),
        nullable=False,
        server_default=text("'platform_admin'::account_type"),
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )

    profile: Mapped["Profile"] = relationship("Profile", viewonly=True)


class Recruiter(Base):
    __tablename__ = "recruiters"
    __table_args__ = (
        CheckConstraint(
            "account_type = 'recruiter'::account_type", name="recruiters_account_type_check"
        ),
        ForeignKeyConstraint(
            ["id", "account_type"],
            ["public.profiles.id", "public.profiles.account_type"],
            ondelete="CASCADE",
            name="recruiters_id_account_type_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id"], ["public.tenants.id"], name="recruiters_tenant_id_fkey"
        ),
        PrimaryKeyConstraint("id", name="recruiters_pkey"),
        UniqueConstraint("tenant_id", "id", name="recruiters_tenant_id_id_key"),
        Index("recruiters_tenant_id_idx", "tenant_id"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    account_type: Mapped[AccountType] = mapped_column(
        Enum(
            AccountType,
            values_callable=lambda cls: [member.value for member in cls],
            name="account_type",
        ),
        nullable=False,
        server_default=text("'recruiter'::account_type"),
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    role: Mapped[RecruiterRole] = mapped_column(
        Enum(
            RecruiterRole,
            values_callable=lambda cls: [member.value for member in cls],
            name="recruiter_role",
        ),
        nullable=False,
        server_default=text("'recruiter'::recruiter_role"),
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )

    profile: Mapped["Profile"] = relationship("Profile", viewonly=True)
    tenant: Mapped["Tenant"] = relationship("Tenant", viewonly=True)


class CandidateTagAssignment(Base):
    __tablename__ = "candidate_tag_assignments"
    __table_args__ = (
        CheckConstraint(
            "scope = 'candidate'::tag_scope", name="candidate_tag_assignments_scope_check"
        ),
        ForeignKeyConstraint(
            ["candidate_id"],
            ["public.candidates.id"],
            name="candidate_tag_assignments_candidate_id_fkey",
        ),
        ForeignKeyConstraint(
            ["tag_id", "scope"],
            ["public.tenant_tags.id", "public.tenant_tags.scope"],
            ondelete="CASCADE",
            name="candidate_tag_assignments_tag_id_scope_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "added_by_recruiter_id"],
            ["public.recruiters.tenant_id", "public.recruiters.id"],
            name="candidate_tag_assignments_tenant_id_added_by_recruiter_id_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "tag_id"],
            ["public.tenant_tags.tenant_id", "public.tenant_tags.id"],
            ondelete="CASCADE",
            name="candidate_tag_assignments_tenant_id_tag_id_fkey",
        ),
        PrimaryKeyConstraint("candidate_id", "tag_id", name="candidate_tag_assignments_pkey"),
        Index("candidate_tag_assignments_added_by_idx", "added_by_recruiter_id"),
        Index("candidate_tag_assignments_tag_idx", "tag_id"),
        Index("candidate_tag_assignments_tenant_candidate_idx", "tenant_id", "candidate_id"),
        {"schema": "public"},
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    tag_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    scope: Mapped[TagScope] = mapped_column(
        Enum(
            TagScope, values_callable=lambda cls: [member.value for member in cls], name="tag_scope"
        ),
        nullable=False,
        server_default=text("'candidate'::tag_scope"),
    )
    added_by_recruiter_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )

    candidate: Mapped["Candidate"] = relationship("Candidate", viewonly=True)
    tag_scope: Mapped["TenantTag"] = relationship(
        "TenantTag", foreign_keys=[tag_id, scope], viewonly=True
    )
    recruiter: Mapped["Recruiter"] = relationship("Recruiter", viewonly=True)
    tenant_tag: Mapped["TenantTag"] = relationship(
        "TenantTag", foreign_keys=[tenant_id, tag_id], viewonly=True
    )


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint("length(description) <= 5000", name="jobs_description_length"),
        CheckConstraint("length(title) <= 200", name="jobs_title_length"),
        CheckConstraint(
            "minimum_total_experience_years IS NULL OR minimum_total_experience_years >= 0::numeric",
            name="jobs_min_experience_nonneg",
        ),
        ForeignKeyConstraint(
            ["location_key"], ["public.locations.key"], name="jobs_location_key_fkey"
        ),
        ForeignKeyConstraint(
            ["tenant_id", "created_by_recruiter_id"],
            ["public.recruiters.tenant_id", "public.recruiters.id"],
            name="jobs_tenant_id_created_by_recruiter_id_fkey",
        ),
        ForeignKeyConstraint(["tenant_id"], ["public.tenants.id"], name="jobs_tenant_id_fkey"),
        PrimaryKeyConstraint("id", name="jobs_pkey"),
        UniqueConstraint("tenant_id", "id", name="jobs_tenant_id_id_key"),
        Index("jobs_created_by_idx", "created_by_recruiter_id"),
        Index("jobs_location_key_idx", "location_key"),
        Index(
            "jobs_published_created_idx",
            "created_at",
            "id",
            postgresql_where="(status = 'published'::job_status)",
        ),
        Index("jobs_search_idx", "search_vector", postgresql_using="gin"),
        Index("jobs_status_expires_at_idx", "status", "expires_at"),
        Index("jobs_tenant_created_idx", "tenant_id", "created_at", "id"),
        Index("jobs_tenant_published_at_idx", "tenant_id", "published_at"),
        Index("jobs_tenant_status_created_idx", "tenant_id", "status", "created_at", "id"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    created_by_recruiter_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[JobStatus] = mapped_column(
        Enum(
            JobStatus,
            values_callable=lambda cls: [member.value for member in cls],
            name="job_status",
        ),
        nullable=False,
        server_default=text("'draft'::job_status"),
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    location_key: Mapped[str | None] = mapped_column(Text)
    employment_type: Mapped[EmploymentType | None] = mapped_column(
        Enum(
            EmploymentType,
            values_callable=lambda cls: [member.value for member in cls],
            name="employment_type",
        )
    )
    work_mode: Mapped[WorkMode | None] = mapped_column(
        Enum(
            WorkMode, values_callable=lambda cls: [member.value for member in cls], name="work_mode"
        )
    )
    minimum_total_experience_years: Mapped[decimal.Decimal | None] = mapped_column(Numeric(4, 1))
    expires_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    published_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(True),
        comment="When this Job first went live. Null while it has never been published, and never rewritten by a later republish.",
    )
    search_vector: Mapped[Any | None] = mapped_column(TSVECTOR)

    location: Mapped[Optional["Location"]] = relationship("Location", viewonly=True)
    recruiter: Mapped["Recruiter"] = relationship("Recruiter", viewonly=True)
    tenant: Mapped["Tenant"] = relationship("Tenant", viewonly=True)


class MessageTemplate(Base):
    __tablename__ = "message_templates"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "created_by_recruiter_id"],
            ["public.recruiters.tenant_id", "public.recruiters.id"],
            name="message_templates_tenant_id_created_by_recruiter_id_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id"], ["public.tenants.id"], name="message_templates_tenant_id_fkey"
        ),
        PrimaryKeyConstraint("id", name="message_templates_pkey"),
        UniqueConstraint("tenant_id", "name", name="message_templates_tenant_id_name_key"),
        Index("message_templates_created_by_idx", "created_by_recruiter_id"),
        Index("message_templates_tenant_name_ci_uidx", "tenant_id", unique=True),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    created_by_recruiter_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )

    recruiter: Mapped["Recruiter"] = relationship("Recruiter", viewonly=True)
    tenant: Mapped["Tenant"] = relationship("Tenant", viewonly=True)


class TalentPoolMember(Base):
    __tablename__ = "talent_pool_members"
    __table_args__ = (
        ForeignKeyConstraint(
            ["candidate_id"], ["public.candidates.id"], name="talent_pool_members_candidate_id_fkey"
        ),
        ForeignKeyConstraint(
            ["tenant_id", "added_by_recruiter_id"],
            ["public.recruiters.tenant_id", "public.recruiters.id"],
            name="talent_pool_members_tenant_id_added_by_recruiter_id_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id"], ["public.tenants.id"], name="talent_pool_members_tenant_id_fkey"
        ),
        PrimaryKeyConstraint("tenant_id", "candidate_id", name="talent_pool_members_pkey"),
        Index("talent_pool_members_added_by_idx", "added_by_recruiter_id"),
        Index("talent_pool_members_candidate_idx", "candidate_id"),
        Index("talent_pool_members_tenant_added_idx", "tenant_id", "added_at", "candidate_id"),
        {"schema": "public"},
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    added_by_recruiter_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    added_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )

    candidate: Mapped["Candidate"] = relationship("Candidate", viewonly=True)
    recruiter: Mapped["Recruiter"] = relationship("Recruiter", viewonly=True)
    tenant: Mapped["Tenant"] = relationship("Tenant", viewonly=True)


class JobApplicationQuestion(Base):
    __tablename__ = "job_application_questions"
    __table_args__ = (
        CheckConstraint(
            "question_type = 'yes_no'::application_question_type OR accepted_boolean_answer IS NULL",
            name="jaq_boolean_answer_only_for_yes_no",
        ),
        CheckConstraint("sort_order >= 0", name="jaq_sort_order_nonneg"),
        ForeignKeyConstraint(
            ["job_id"],
            ["public.jobs.id"],
            ondelete="CASCADE",
            name="job_application_questions_job_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="job_application_questions_pkey"),
        UniqueConstraint("job_id", "id", name="job_application_questions_job_id_id_key"),
        Index("jaq_job_sort_order_idx", "job_id", "sort_order"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[ApplicationQuestionType] = mapped_column(
        Enum(
            ApplicationQuestionType,
            values_callable=lambda cls: [member.value for member in cls],
            name="application_question_type",
        ),
        nullable=False,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    accepted_boolean_answer: Mapped[bool | None] = mapped_column(Boolean)

    job: Mapped["Job"] = relationship("Job", viewonly=True)


class JobLanguage(Base):
    __tablename__ = "job_languages"
    __table_args__ = (
        ForeignKeyConstraint(
            ["job_id"], ["public.jobs.id"], ondelete="CASCADE", name="job_languages_job_id_fkey"
        ),
        ForeignKeyConstraint(
            ["language_code"], ["public.languages.code"], name="job_languages_language_code_fkey"
        ),
        PrimaryKeyConstraint("job_id", "language_code", name="job_languages_pkey"),
        Index("job_languages_language_code_idx", "language_code"),
        {"schema": "public"},
    )

    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    language_code: Mapped[str] = mapped_column(Text, primary_key=True)
    minimum_proficiency: Mapped[LanguageProficiency] = mapped_column(
        Enum(
            LanguageProficiency,
            values_callable=lambda cls: [member.value for member in cls],
            name="language_proficiency",
        ),
        nullable=False,
    )

    job: Mapped["Job"] = relationship("Job", viewonly=True)
    language: Mapped["Language"] = relationship("Language", viewonly=True)


class JobSkill(Base):
    __tablename__ = "job_skills"
    __table_args__ = (
        CheckConstraint(
            "minimum_years IS NULL OR minimum_years >= 0", name="job_skills_min_years_nonneg"
        ),
        ForeignKeyConstraint(
            ["job_id"], ["public.jobs.id"], ondelete="CASCADE", name="job_skills_job_id_fkey"
        ),
        ForeignKeyConstraint(
            ["taxonomy_id"], ["public.skill_taxonomy.id"], name="job_skills_taxonomy_id_fkey"
        ),
        PrimaryKeyConstraint("id", name="job_skills_pkey"),
        UniqueConstraint("job_id", "taxonomy_id", name="job_skills_job_id_taxonomy_id_key"),
        Index("job_skills_taxonomy_id_idx", "taxonomy_id"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    taxonomy_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    importance: Mapped[SkillImportance] = mapped_column(
        Enum(
            SkillImportance,
            values_callable=lambda cls: [member.value for member in cls],
            name="skill_importance",
        ),
        nullable=False,
        server_default=text("'preferred'::skill_importance"),
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    minimum_years: Mapped[int | None] = mapped_column(Integer)

    job: Mapped["Job"] = relationship("Job", viewonly=True)
    taxonomy: Mapped["SkillTaxonomy"] = relationship("SkillTaxonomy", viewonly=True)


class TrackedJobLink(Base):
    __tablename__ = "tracked_job_links"
    __table_args__ = (
        ForeignKeyConstraint(
            ["tenant_id", "created_by_recruiter_id"],
            ["public.recruiters.tenant_id", "public.recruiters.id"],
            name="tracked_job_links_tenant_id_created_by_recruiter_id_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "job_id"],
            ["public.jobs.tenant_id", "public.jobs.id"],
            name="tracked_job_links_tenant_id_job_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="tracked_job_links_pkey"),
        UniqueConstraint("job_id", "id", name="tracked_job_links_job_id_id_key"),
        UniqueConstraint("tenant_id", "id", name="tracked_job_links_tenant_id_id_key"),
        UniqueConstraint(
            "tenant_id", "job_id", "name", name="tracked_job_links_tenant_id_job_id_name_key"
        ),
        UniqueConstraint("token", name="tracked_job_links_token_key"),
        Index("tracked_job_links_created_by_idx", "created_by_recruiter_id"),
        Index("tracked_job_links_job_active_idx", "job_id", "is_active"),
        Index("tracked_job_links_tenant_created_idx", "tenant_id", "created_at", "id"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    created_by_recruiter_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    token: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    expires_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))

    recruiter: Mapped["Recruiter"] = relationship("Recruiter", viewonly=True)
    job: Mapped["Job"] = relationship("Job", viewonly=True)


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        CheckConstraint(
            "current_match_score >= 0::numeric AND current_match_score <= 100::numeric",
            name="applications_current_match_score_range",
        ),
        CheckConstraint(
            "num_nonnulls(current_match_assessment_id, current_match_score) <> 1",
            name="applications_current_match_is_whole",
        ),
        CheckConstraint(
            "qualification_status <> 'disqualified'::qualification_status OR qualification_reason IS NOT NULL",
            name="applications_disqualification_has_a_reason",
        ),
        ForeignKeyConstraint(
            ["id", "current_match_assessment_id"],
            [
                "public.application_ai_match_assessments.application_id",
                "public.application_ai_match_assessments.id",
            ],
            name="applications_current_match_assessment_fk",
        ),
        ForeignKeyConstraint(
            ["candidate_id", "cv_id"],
            ["public.cvs.candidate_id", "public.cvs.id"],
            name="applications_candidate_id_cv_id_fkey",
        ),
        ForeignKeyConstraint(
            ["candidate_id"], ["public.candidates.id"], name="applications_candidate_id_fkey"
        ),
        ForeignKeyConstraint(
            ["job_id", "tracked_link_id"],
            ["public.tracked_job_links.job_id", "public.tracked_job_links.id"],
            name="applications_tracked_link_fk",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "job_id"],
            ["public.jobs.tenant_id", "public.jobs.id"],
            name="applications_tenant_id_job_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="applications_pkey"),
        UniqueConstraint("candidate_id", "job_id", name="applications_candidate_id_job_id_key"),
        UniqueConstraint("id", "candidate_id", name="applications_id_candidate_id_key"),
        UniqueConstraint("job_id", "id", name="applications_job_id_id_key"),
        UniqueConstraint("tenant_id", "id", name="applications_tenant_id_id_key"),
        Index("applications_cv_id_idx", "cv_id"),
        Index("applications_job_applied_at_idx", "job_id", "applied_at", "id"),
        Index(
            "applications_job_match_score_idx",
            "job_id",
            text("COALESCE(current_match_score, (-1)) DESC"),
            text("id DESC"),
        ),
        Index("applications_job_status_idx", "job_id", "status"),
        Index("applications_job_tracked_link_idx", "job_id", "tracked_link_id"),
        Index("applications_tenant_applied_at_idx", "tenant_id", "applied_at", "id"),
        Index(
            "applications_tenant_match_score_idx",
            "tenant_id",
            text("COALESCE(current_match_score, (-1)) DESC"),
            text("id DESC"),
        ),
        Index("applications_tenant_status_idx", "tenant_id", "status"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    cv_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(
            ApplicationStatus,
            values_callable=lambda cls: [member.value for member in cls],
            name="application_status",
        ),
        nullable=False,
        server_default=text("'new'::application_status"),
    )
    qualification_status: Mapped[QualificationStatus] = mapped_column(
        Enum(
            QualificationStatus,
            values_callable=lambda cls: [member.value for member in cls],
            name="qualification_status",
        ),
        nullable=False,
        server_default=text("'pending'::qualification_status"),
    )
    applied_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    tracked_link_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    qualification_reason: Mapped[str | None] = mapped_column(Text)
    current_match_assessment_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    current_match_score: Mapped[decimal.Decimal | None] = mapped_column(Numeric(5, 2))

    cv: Mapped["Cv"] = relationship("Cv", viewonly=True)
    candidate: Mapped["Candidate"] = relationship("Candidate", viewonly=True)
    tracked_job_link: Mapped[Optional["TrackedJobLink"]] = relationship(
        "TrackedJobLink", viewonly=True
    )
    job: Mapped["Job"] = relationship("Job", viewonly=True)


class JobViewEvent(Base):
    __tablename__ = "job_view_events"
    __table_args__ = (
        ForeignKeyConstraint(
            ["job_id", "tracked_link_id"],
            ["public.tracked_job_links.job_id", "public.tracked_job_links.id"],
            name="job_view_events_job_id_tracked_link_id_fkey",
        ),
        ForeignKeyConstraint(
            ["job_id"], ["public.jobs.id"], ondelete="CASCADE", name="job_view_events_job_id_fkey"
        ),
        PrimaryKeyConstraint("id", name="job_view_events_pkey"),
        Index("job_view_events_job_link_viewed_idx", "job_id", "tracked_link_id", "viewed_at"),
        Index("job_view_events_job_viewed_idx", "job_id", "viewed_at"),
        Index("job_view_events_link_viewed_idx", "tracked_link_id", "viewed_at"),
        Index(
            "job_view_events_session_job_attribution_idx",
            "session_id",
            "job_id",
            "viewed_at",
            "id",
            postgresql_include=["tracked_link_id"],
            postgresql_where="(tracked_link_id IS NOT NULL)",
        ),
        Index(
            "job_view_events_session_job_idx",
            "session_id",
            "job_id",
            "tracked_link_id",
            "viewed_at",
        ),
        {"schema": "public"},
    )

    id: Mapped[int] = mapped_column(
        BigInteger,
        Identity(
            always=True,
            start=1,
            increment=1,
            minvalue=1,
            maxvalue=9223372036854775807,
            cycle=False,
            cache=1,
        ),
        primary_key=True,
        autoincrement=True,
    )
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    viewed_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    tracked_link_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    session_id: Mapped[str | None] = mapped_column(Text)
    visitor_hash: Mapped[str | None] = mapped_column(Text)

    tracked_job_link: Mapped[Optional["TrackedJobLink"]] = relationship(
        "TrackedJobLink", viewonly=True
    )
    job: Mapped["Job"] = relationship("Job", viewonly=True)


class ApplicationAiMatchAssessment(Base):
    __tablename__ = "application_ai_match_assessments"
    __table_args__ = (
        CheckConstraint(
            "match_percentage >= 0::numeric AND match_percentage <= 100::numeric",
            name="aima_percentage_range",
        ),
        ForeignKeyConstraint(
            ["application_id"],
            ["public.applications.id"],
            ondelete="CASCADE",
            name="application_ai_match_assessments_application_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="application_ai_match_assessments_pkey"),
        UniqueConstraint(
            "application_id", "id", name="application_ai_match_assessments_application_id_id_key"
        ),
        Index("application_ai_match_assessments_app_created_idx", "application_id", "created_at"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    match_percentage: Mapped[decimal.Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    model_name: Mapped[str] = mapped_column(Text, nullable=False)
    prompt_version: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    explanation: Mapped[str | None] = mapped_column(Text)
    assessment_details: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    application: Mapped["Application"] = relationship(
        "Application", viewonly=True, foreign_keys=[application_id]
    )


class ApplicationAnswer(Base):
    __tablename__ = "application_answers"
    __table_args__ = (
        CheckConstraint(
            "answer_boolean IS NOT NULL AND answer_text IS NULL OR answer_boolean IS NULL AND answer_text IS NOT NULL",
            name="aans_one_answer_kind",
        ),
        ForeignKeyConstraint(
            ["job_id", "application_id"],
            ["public.applications.job_id", "public.applications.id"],
            ondelete="CASCADE",
            name="application_answers_job_id_application_id_fkey",
        ),
        ForeignKeyConstraint(
            ["job_id", "question_id"],
            ["public.job_application_questions.job_id", "public.job_application_questions.id"],
            name="application_answers_job_id_question_id_fkey",
        ),
        PrimaryKeyConstraint("application_id", "question_id", name="application_answers_pkey"),
        Index("application_answers_job_question_idx", "job_id", "question_id"),
        {"schema": "public"},
    )

    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    question_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    answer_boolean: Mapped[bool | None] = mapped_column(Boolean)
    answer_text: Mapped[str | None] = mapped_column(Text)

    application: Mapped["Application"] = relationship("Application", viewonly=True)
    job_application_question: Mapped["JobApplicationQuestion"] = relationship(
        "JobApplicationQuestion", viewonly=True
    )


class ApplicationEducation(Base):
    __tablename__ = "application_educations"
    __table_args__ = (
        CheckConstraint(
            "graduation_year IS NULL OR graduation_year >= 1900 AND graduation_year <= 2100",
            name="aedu_grad_year_range",
        ),
        ForeignKeyConstraint(
            ["application_id"],
            ["public.applications.id"],
            ondelete="CASCADE",
            name="application_educations_application_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="application_educations_pkey"),
        Index("application_educations_grad_year_idx", "application_id", "graduation_year"),
        Index("application_educations_sort_order_idx", "application_id", "sort_order"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    institution: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    degree: Mapped[str | None] = mapped_column(Text)
    field_of_study: Mapped[str | None] = mapped_column(Text)
    graduation_year: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)

    application: Mapped["Application"] = relationship("Application", viewonly=True)


class ApplicationExperience(Base):
    __tablename__ = "application_experiences"
    __table_args__ = (
        CheckConstraint(
            "NOT is_current OR end_year IS NULL AND end_month IS NULL",
            name="aexp_current_has_no_end",
        ),
        CheckConstraint(
            "end_month IS NULL OR end_month >= 1 AND end_month <= 12", name="aexp_end_month_range"
        ),
        CheckConstraint(
            "end_year IS NULL OR end_year >= 1900 AND end_year <= 2100", name="aexp_end_year_range"
        ),
        CheckConstraint("is_current OR end_year IS NOT NULL", name="aexp_finished_work_has_an_end"),
        CheckConstraint(
            "start_month IS NULL OR start_month >= 1 AND start_month <= 12",
            name="aexp_start_month_range",
        ),
        CheckConstraint(
            "start_year IS NULL OR end_year IS NULL OR end_year > start_year OR end_year = start_year AND COALESCE(end_month, 12) >= COALESCE(start_month, 1)",
            name="aexp_ordered",
        ),
        CheckConstraint(
            "start_year IS NULL OR start_year >= 1900 AND start_year <= 2100",
            name="aexp_start_year_range",
        ),
        ForeignKeyConstraint(
            ["application_id"],
            ["public.applications.id"],
            ondelete="CASCADE",
            name="application_experiences_application_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="application_experiences_pkey"),
        Index("application_experiences_sort_order_idx", "application_id", "sort_order"),
        Index("application_experiences_start_year_idx", "application_id", "start_year"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    job_title: Mapped[str] = mapped_column(Text, nullable=False)
    start_year: Mapped[int] = mapped_column(Integer, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    company_name: Mapped[str | None] = mapped_column(Text)
    start_month: Mapped[int | None] = mapped_column(Integer)
    end_year: Mapped[int | None] = mapped_column(Integer)
    end_month: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)

    application: Mapped["Application"] = relationship("Application", viewonly=True)


class ApplicationLanguage(Base):
    __tablename__ = "application_languages"
    __table_args__ = (
        ForeignKeyConstraint(
            ["application_id"],
            ["public.applications.id"],
            ondelete="CASCADE",
            name="application_languages_application_id_fkey",
        ),
        ForeignKeyConstraint(
            ["language_code"],
            ["public.languages.code"],
            name="application_languages_language_code_fkey",
        ),
        PrimaryKeyConstraint("application_id", "language_code", name="application_languages_pkey"),
        Index("application_languages_language_idx", "language_code", "application_id"),
        Index("application_languages_sort_order_idx", "application_id", "sort_order"),
        {"schema": "public"},
    )

    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    language_code: Mapped[str] = mapped_column(Text, primary_key=True)
    proficiency: Mapped[LanguageProficiency] = mapped_column(
        Enum(
            LanguageProficiency,
            values_callable=lambda cls: [member.value for member in cls],
            name="language_proficiency",
        ),
        nullable=False,
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    application: Mapped["Application"] = relationship("Application", viewonly=True)
    language: Mapped["Language"] = relationship("Language", viewonly=True)


class ApplicationProfileSnapshot(Base):
    __tablename__ = "application_profile_snapshots"
    __table_args__ = (
        CheckConstraint(
            "github_url IS NULL OR github_url ~~ 'https://github.com/%%'::text AND length(github_url) <= 2000",
            name="asnap_github_url_shape",
        ),
        CheckConstraint(
            "linkedin_url IS NULL OR linkedin_url ~~ 'https://www.linkedin.com/in/%%'::text AND length(linkedin_url) <= 2000",
            name="asnap_linkedin_url_shape",
        ),
        CheckConstraint(
            "num_nonnulls(phone, phone_country) <> 1", name="asnap_phone_has_a_country"
        ),
        CheckConstraint("phone ~ '^\\+[1-9][0-9]{1,14}$'::text", name="asnap_phone_is_e164"),
        CheckConstraint("phone_country ~ '^[A-Z]{2}$'::text", name="asnap_phone_country_is_iso"),
        CheckConstraint(
            "portfolio_url IS NULL OR (portfolio_url ~~ 'http://%%'::text OR portfolio_url ~~ 'https://%%'::text) AND length(portfolio_url) <= 2000",
            name="asnap_portfolio_url_shape",
        ),
        CheckConstraint("total_experience_years >= 0", name="asnap_total_experience_nonneg"),
        ForeignKeyConstraint(
            ["application_id"],
            ["public.applications.id"],
            ondelete="CASCADE",
            name="application_profile_snapshots_application_id_fkey",
        ),
        PrimaryKeyConstraint("application_id", name="application_profile_snapshots_pkey"),
        {"schema": "public"},
    )

    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    unmapped_skills: Mapped[list[str]] = mapped_column(
        ARRAY(Text()), nullable=False, server_default=text("'{}'::text[]")
    )
    total_experience_years: Mapped[int] = mapped_column(Integer, nullable=False)
    captured_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    phone: Mapped[str | None] = mapped_column(Text)
    phone_country: Mapped[str | None] = mapped_column(Text)
    headline: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    canonical_role: Mapped[str | None] = mapped_column(Text)
    linkedin_url: Mapped[str | None] = mapped_column(Text)
    github_url: Mapped[str | None] = mapped_column(Text)
    portfolio_url: Mapped[str | None] = mapped_column(Text)

    application: Mapped["Application"] = relationship("Application", viewonly=True)


class ApplicationProject(Base):
    __tablename__ = "application_projects"
    __table_args__ = (
        CheckConstraint(
            "end_month IS NULL OR end_month >= 1 AND end_month <= 12", name="aproj_end_month_range"
        ),
        CheckConstraint(
            "start_month IS NULL OR start_month >= 1 AND start_month <= 12",
            name="aproj_start_month_range",
        ),
        CheckConstraint(
            "start_year IS NULL OR end_year IS NULL OR end_year > start_year OR end_year = start_year AND COALESCE(end_month, 12) >= COALESCE(start_month, 1)",
            name="aproj_ordered",
        ),
        ForeignKeyConstraint(
            ["application_id"],
            ["public.applications.id"],
            ondelete="CASCADE",
            name="application_projects_application_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="application_projects_pkey"),
        Index("application_projects_sort_order_idx", "application_id", "sort_order"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    description: Mapped[str | None] = mapped_column(Text)
    project_url: Mapped[str | None] = mapped_column(Text)
    repository_url: Mapped[str | None] = mapped_column(Text)
    start_year: Mapped[int | None] = mapped_column(Integer)
    start_month: Mapped[int | None] = mapped_column(Integer)
    end_year: Mapped[int | None] = mapped_column(Integer)
    end_month: Mapped[int | None] = mapped_column(Integer)

    application: Mapped["Application"] = relationship("Application", viewonly=True)


class ApplicationQualificationHistory(Base):
    __tablename__ = "application_qualification_history"
    __table_args__ = (
        CheckConstraint(
            "qualification_status <> 'disqualified'::qualification_status OR qualification_reason IS NOT NULL",
            name="aqh_disqualification_has_a_reason",
        ),
        ForeignKeyConstraint(
            ["application_id"],
            ["public.applications.id"],
            ondelete="CASCADE",
            name="application_qualification_history_application_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="application_qualification_history_pkey"),
        Index("application_qualification_history_app_created_idx", "application_id", "created_at"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    qualification_status: Mapped[QualificationStatus] = mapped_column(
        Enum(
            QualificationStatus,
            values_callable=lambda cls: [member.value for member in cls],
            name="qualification_status",
        ),
        nullable=False,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    qualification_reason: Mapped[str | None] = mapped_column(Text)
    screening_version: Mapped[str | None] = mapped_column(Text)

    application: Mapped["Application"] = relationship("Application", viewonly=True)


class ApplicationSkill(Base):
    __tablename__ = "application_skills"
    __table_args__ = (
        CheckConstraint("years_experience >= 0::numeric", name="askill_years_nonneg"),
        ForeignKeyConstraint(
            ["application_id"],
            ["public.applications.id"],
            ondelete="CASCADE",
            name="application_skills_application_id_fkey",
        ),
        ForeignKeyConstraint(
            ["taxonomy_id"],
            ["public.skill_taxonomy.id"],
            name="application_skills_taxonomy_id_fkey",
        ),
        PrimaryKeyConstraint("application_id", "taxonomy_id", name="application_skills_pkey"),
        Index("application_skills_sort_order_idx", "application_id", "sort_order"),
        Index("application_skills_taxonomy_idx", "taxonomy_id", "application_id"),
        {"schema": "public"},
    )

    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    taxonomy_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    years_experience: Mapped[decimal.Decimal] = mapped_column(Numeric(4, 1), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    application: Mapped["Application"] = relationship("Application", viewonly=True)
    taxonomy: Mapped["SkillTaxonomy"] = relationship("SkillTaxonomy", viewonly=True)


class ApplicationStatusHistory(Base):
    __tablename__ = "application_status_history"
    __table_args__ = (
        CheckConstraint(
            "change_source = 'system'::status_change_source OR changed_by_profile_id IS NOT NULL",
            name="ash_human_decision_has_an_author",
        ),
        ForeignKeyConstraint(
            ["application_id"],
            ["public.applications.id"],
            ondelete="CASCADE",
            name="application_status_history_application_id_fkey",
        ),
        ForeignKeyConstraint(
            ["changed_by_profile_id"],
            ["public.profiles.id"],
            name="application_status_history_changed_by_profile_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="application_status_history_pkey"),
        Index("application_status_history_app_created_idx", "application_id", "created_at"),
        Index("application_status_history_changed_by_idx", "changed_by_profile_id"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    change_source: Mapped[StatusChangeSource] = mapped_column(
        Enum(
            StatusChangeSource,
            values_callable=lambda cls: [member.value for member in cls],
            name="status_change_source",
        ),
        nullable=False,
    )
    new_status: Mapped[ApplicationStatus] = mapped_column(
        Enum(
            ApplicationStatus,
            values_callable=lambda cls: [member.value for member in cls],
            name="application_status",
        ),
        nullable=False,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    changed_by_profile_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    previous_status: Mapped[ApplicationStatus | None] = mapped_column(
        Enum(
            ApplicationStatus,
            values_callable=lambda cls: [member.value for member in cls],
            name="application_status",
        )
    )
    reason: Mapped[str | None] = mapped_column(Text)

    application: Mapped["Application"] = relationship("Application", viewonly=True)
    changed_by_profile: Mapped[Optional["Profile"]] = relationship("Profile", viewonly=True)


class ApplicationTagAssignment(Base):
    __tablename__ = "application_tag_assignments"
    __table_args__ = (
        CheckConstraint(
            "scope = 'application'::tag_scope", name="application_tag_assignments_scope_check"
        ),
        ForeignKeyConstraint(
            ["tag_id", "scope"],
            ["public.tenant_tags.id", "public.tenant_tags.scope"],
            ondelete="CASCADE",
            name="application_tag_assignments_tag_id_scope_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "added_by_recruiter_id"],
            ["public.recruiters.tenant_id", "public.recruiters.id"],
            name="application_tag_assignments_tenant_id_added_by_recruiter_i_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "application_id"],
            ["public.applications.tenant_id", "public.applications.id"],
            ondelete="CASCADE",
            name="application_tag_assignments_tenant_id_application_id_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "tag_id"],
            ["public.tenant_tags.tenant_id", "public.tenant_tags.id"],
            ondelete="CASCADE",
            name="application_tag_assignments_tenant_id_tag_id_fkey",
        ),
        PrimaryKeyConstraint("application_id", "tag_id", name="application_tag_assignments_pkey"),
        Index("application_tag_assignments_added_by_idx", "added_by_recruiter_id"),
        Index("application_tag_assignments_tag_idx", "tag_id"),
        Index("application_tag_assignments_tenant_app_idx", "tenant_id", "application_id"),
        {"schema": "public"},
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    tag_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    scope: Mapped[TagScope] = mapped_column(
        Enum(
            TagScope, values_callable=lambda cls: [member.value for member in cls], name="tag_scope"
        ),
        nullable=False,
        server_default=text("'application'::tag_scope"),
    )
    added_by_recruiter_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )

    tag_scope: Mapped["TenantTag"] = relationship(
        "TenantTag", foreign_keys=[tag_id, scope], viewonly=True
    )
    recruiter: Mapped["Recruiter"] = relationship("Recruiter", viewonly=True)
    application: Mapped["Application"] = relationship("Application", viewonly=True)
    tenant_tag: Mapped["TenantTag"] = relationship(
        "TenantTag", foreign_keys=[tenant_id, tag_id], viewonly=True
    )


class Communication(Base):
    __tablename__ = "communications"
    __table_args__ = (
        CheckConstraint(
            "application_id IS NULL OR tenant_id IS NOT NULL", name="comm_app_needs_tenant"
        ),
        CheckConstraint("attempts >= 0", name="comm_attempts_nonneg"),
        CheckConstraint(
            "initiated_by_recruiter_id IS NULL OR application_id IS NOT NULL",
            name="comm_recruiter_needs_app",
        ),
        CheckConstraint(
            "initiated_by_recruiter_id IS NULL OR tenant_id IS NOT NULL",
            name="comm_recruiter_needs_tenant",
        ),
        CheckConstraint(
            "tenant_id IS NOT NULL OR application_id IS NULL AND initiated_by_recruiter_id IS NULL",
            name="comm_platform_shape",
        ),
        ForeignKeyConstraint(
            ["application_id", "candidate_id"],
            ["public.applications.id", "public.applications.candidate_id"],
            name="communications_application_id_candidate_id_fkey",
        ),
        ForeignKeyConstraint(
            ["candidate_id"], ["public.candidates.id"], name="communications_candidate_id_fkey"
        ),
        ForeignKeyConstraint(
            ["tenant_id", "application_id"],
            ["public.applications.tenant_id", "public.applications.id"],
            name="communications_tenant_id_application_id_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "initiated_by_recruiter_id"],
            ["public.recruiters.tenant_id", "public.recruiters.id"],
            name="communications_tenant_id_initiated_by_recruiter_id_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id"], ["public.tenants.id"], name="communications_tenant_id_fkey"
        ),
        PrimaryKeyConstraint("id", name="communications_pkey"),
        UniqueConstraint("idempotency_key", name="communications_idempotency_key_key"),
        Index("communications_application_idx", "application_id"),
        Index("communications_candidate_idx", "candidate_id"),
        Index(
            "communications_claim_idx",
            "available_at",
            postgresql_where="(status = ANY (ARRAY['queued'::communication_status, 'processing'::communication_status]))",
        ),
        Index(
            "communications_provider_msg_uidx",
            "provider",
            "provider_message_id",
            postgresql_where="((provider IS NOT NULL) AND (provider_message_id IS NOT NULL))",
            unique=True,
        ),
        Index("communications_status_created_idx", "status", "created_at"),
        Index("communications_tenant_application_idx", "tenant_id", "application_id", "created_at"),
        Index("communications_tenant_candidate_idx", "tenant_id", "candidate_id", "created_at"),
        Index("communications_tenant_recruiter_idx", "tenant_id", "initiated_by_recruiter_id"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    channel: Mapped[CommunicationChannel] = mapped_column(
        Enum(
            CommunicationChannel,
            values_callable=lambda cls: [member.value for member in cls],
            name="communication_channel",
        ),
        nullable=False,
    )
    communication_type: Mapped[CommunicationType] = mapped_column(
        Enum(
            CommunicationType,
            values_callable=lambda cls: [member.value for member in cls],
            name="communication_type",
        ),
        nullable=False,
    )
    status: Mapped[CommunicationStatus] = mapped_column(
        Enum(
            CommunicationStatus,
            values_callable=lambda cls: [member.value for member in cls],
            name="communication_status",
        ),
        nullable=False,
        server_default=text("'queued'::communication_status"),
    )
    recipient: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    idempotency_key: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    application_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    initiated_by_recruiter_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    subject: Mapped[str | None] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)
    provider: Mapped[str | None] = mapped_column(Text)
    provider_message_id: Mapped[str | None] = mapped_column(Text)
    template_key: Mapped[str | None] = mapped_column(Text)
    available_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    started_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    completed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    sent_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))

    application_candidate: Mapped[Optional["Application"]] = relationship(
        "Application", foreign_keys=[application_id, candidate_id], viewonly=True
    )
    candidate: Mapped["Candidate"] = relationship("Candidate", viewonly=True)
    tenant_application: Mapped[Optional["Application"]] = relationship(
        "Application", foreign_keys=[tenant_id, application_id], viewonly=True
    )
    recruiter: Mapped[Optional["Recruiter"]] = relationship("Recruiter", viewonly=True)
    tenant: Mapped[Optional["Tenant"]] = relationship("Tenant", viewonly=True)


class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (
        CheckConstraint("num_nonnulls(application_id, candidate_id) = 1", name="notes_one_subject"),
        ForeignKeyConstraint(
            ["candidate_id"], ["public.candidates.id"], name="notes_candidate_id_fkey"
        ),
        ForeignKeyConstraint(
            ["tenant_id", "application_id"],
            ["public.applications.tenant_id", "public.applications.id"],
            ondelete="CASCADE",
            name="notes_tenant_id_application_id_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "recruiter_id"],
            ["public.recruiters.tenant_id", "public.recruiters.id"],
            name="notes_tenant_id_recruiter_id_fkey",
        ),
        ForeignKeyConstraint(["tenant_id"], ["public.tenants.id"], name="notes_tenant_id_fkey"),
        PrimaryKeyConstraint("id", name="notes_pkey"),
        Index(
            "notes_application_created_idx",
            "application_id",
            "created_at",
            "id",
            postgresql_where="(application_id IS NOT NULL)",
        ),
        Index("notes_candidate_idx", "candidate_id", postgresql_where="(candidate_id IS NOT NULL)"),
        Index(
            "notes_tenant_candidate_created_idx",
            "tenant_id",
            "candidate_id",
            "created_at",
            "id",
            postgresql_where="(candidate_id IS NOT NULL)",
        ),
        Index("notes_tenant_recruiter_idx", "tenant_id", "recruiter_id"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    recruiter_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    note_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    candidate_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)

    candidate: Mapped[Optional["Candidate"]] = relationship("Candidate", viewonly=True)
    application: Mapped[Optional["Application"]] = relationship("Application", viewonly=True)
    recruiter: Mapped["Recruiter"] = relationship("Recruiter", viewonly=True)
    tenant: Mapped["Tenant"] = relationship("Tenant", viewonly=True)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(
            "(payload ->> 'type'::text) = type::text", name="notifications_payload_type_matches"
        ),
        CheckConstraint(
            "type::text <> 'application_stage_changed'::text OR application_id IS NOT NULL",
            name="notifications_stage_change_has_an_application",
        ),
        ForeignKeyConstraint(
            ["application_id", "recipient_profile_id"],
            ["public.applications.id", "public.applications.candidate_id"],
            ondelete="CASCADE",
            name="notifications_application_id_recipient_profile_id_fkey",
        ),
        ForeignKeyConstraint(
            ["recipient_profile_id"],
            ["public.profiles.id"],
            ondelete="CASCADE",
            name="notifications_recipient_profile_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="notifications_pkey"),
        Index("notifications_application_idx", "application_id"),
        Index("notifications_recipient_created_idx", "recipient_profile_id", "created_at", "id"),
        Index(
            "notifications_recipient_unread_idx",
            "recipient_profile_id",
            postgresql_where="(read_at IS NULL)",
        ),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    recipient_profile_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    type: Mapped[NotificationType] = mapped_column(
        Enum(
            NotificationType,
            values_callable=lambda cls: [member.value for member in cls],
            name="notification_type",
        ),
        nullable=False,
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    application_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    read_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))

    application: Mapped[Optional["Application"]] = relationship("Application", viewonly=True)
    recipient_profile: Mapped["Profile"] = relationship("Profile", viewonly=True)


class HireClaim(Base):
    __tablename__ = "hire_claims"
    __table_args__ = (
        CheckConstraint(
            "confirmation = 'unanswered'::hire_confirmation AND answered_at IS NULL OR confirmation <> 'unanswered'::hire_confirmation AND answered_at IS NOT NULL",
            name="hire_claim_answer_has_its_moment",
        ),
        ForeignKeyConstraint(
            ["status_history_id"],
            ["public.application_status_history.id"],
            ondelete="CASCADE",
            name="hire_claims_status_history_id_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "application_id"],
            ["public.applications.tenant_id", "public.applications.id"],
            ondelete="CASCADE",
            name="hire_claims_tenant_id_application_id_fkey",
        ),
        ForeignKeyConstraint(
            ["tenant_id", "claimed_by_recruiter_id"],
            ["public.recruiters.tenant_id", "public.recruiters.id"],
            name="hire_claims_tenant_id_claimed_by_recruiter_id_fkey",
        ),
        PrimaryKeyConstraint("application_id", name="hire_claims_pkey"),
        {"schema": "public"},
    )

    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    claimed_by_recruiter_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status_history_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    confirmation: Mapped[HireConfirmation] = mapped_column(
        Enum(
            HireConfirmation,
            values_callable=lambda cls: [member.value for member in cls],
            name="hire_confirmation",
        ),
        nullable=False,
        server_default=text("'unanswered'::hire_confirmation"),
    )
    claimed_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    answered_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))

    status_history: Mapped["ApplicationStatusHistory"] = relationship(
        "ApplicationStatusHistory", viewonly=True
    )
    application: Mapped["Application"] = relationship("Application", viewonly=True)
    recruiter: Mapped["Recruiter"] = relationship("Recruiter", viewonly=True)


class MatchAssessmentJob(Base):
    __tablename__ = "match_assessment_jobs"
    __table_args__ = (
        CheckConstraint("attempts >= 0", name="maj_attempts_nonneg"),
        ForeignKeyConstraint(
            ["application_id"],
            ["public.applications.id"],
            ondelete="CASCADE",
            name="match_assessment_jobs_application_id_fkey",
        ),
        PrimaryKeyConstraint("id", name="match_assessment_jobs_pkey"),
        UniqueConstraint("application_id", name="match_assessment_jobs_application_id_key"),
        Index(
            "match_assessment_jobs_claim_idx",
            "available_at",
            postgresql_where="(status = ANY (ARRAY['pending'::assessment_status, 'processing'::assessment_status]))",
        ),
        Index("match_assessment_jobs_status_created_idx", "status", "created_at"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, server_default=text("gen_random_uuid()")
    )
    application_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status: Mapped[AssessmentStatus] = mapped_column(
        Enum(
            AssessmentStatus,
            values_callable=lambda cls: [member.value for member in cls],
            name="assessment_status",
        ),
        nullable=False,
        server_default=text("'pending'::assessment_status"),
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(True), nullable=False, server_default=text("now()")
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    available_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    started_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))
    completed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(True))

    application: Mapped["Application"] = relationship("Application", viewonly=True)
