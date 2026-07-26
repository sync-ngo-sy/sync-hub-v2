"""Tenant onboarding and team management (ADR-0005).

Self-serve Tenant signup and email confirmation live in `sync_api.auth` — they are the same
"provision an identity, then Postgres" shape as candidate signup. What is here is what comes
after there is a Tenant: inviting teammates by email and an admin managing their roles and
activation, all gated on the acting Recruiter being active in an active Tenant.
"""

from __future__ import annotations

from sync_api.tenants.service import ActingRecruiter, RecruiterSummary, TenantService

__all__ = ["ActingRecruiter", "RecruiterSummary", "TenantService"]
