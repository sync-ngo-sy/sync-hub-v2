"""Tenants: onboarding a hiring company, its roster, and the switches that gate both.

`TenantService` is what a request calls; `ActingRecruiter` is the standing a tenant-scoped
route has to establish before it does anything at all.
"""

from __future__ import annotations

from sync_api.tenants.access import (
    ActingRecruiter,
    TenantSummary,
    acting_recruiter,
    require_admin,
)
from sync_api.tenants.service import Member, NewTenant, TenantService

__all__ = [
    "ActingRecruiter",
    "Member",
    "NewTenant",
    "TenantService",
    "TenantSummary",
    "acting_recruiter",
    "require_admin",
]
