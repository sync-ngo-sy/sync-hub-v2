from __future__ import annotations

from typing import TYPE_CHECKING, Final

from sync_core.models import MessageTemplate, TagScope, TenantTag

if TYPE_CHECKING:
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

#: What a Tenant opens with. Ordinary rows from the moment they are written: nothing marks them
#: as ours, so a Tenant renames and deletes them exactly as it does the ones it writes itself.
PRESET_TAGS: Final[tuple[tuple[str, TagScope], ...]] = (
    ("Strong hire", TagScope.CANDIDATE),
    ("Keep warm", TagScope.CANDIDATE),
    ("Referral", TagScope.CANDIDATE),
    ("Needs sponsorship", TagScope.CANDIDATE),
    ("Phone screened", TagScope.APPLICATION),
    ("Interview booked", TagScope.APPLICATION),
    ("Take-home sent", TagScope.APPLICATION),
    ("Reference check", TagScope.APPLICATION),
    ("Salary mismatch", TagScope.APPLICATION),
)

PRESET_TEMPLATES: Final[tuple[tuple[str, str, str], ...]] = (
    (
        "Interview invitation",
        "An interview for {{ job_title }}?",
        "Hi {{ candidate_name }},\n\n"
        "We have read your application for {{ job_title }} and we would like to meet you.\n\n"
        "Tell us which mornings suit you this week and we will send an invitation.\n\n"
        "{{ tenant_name }}",
    ),
    (
        "Asking for more",
        "One more thing about {{ job_title }}",
        "Hi {{ candidate_name }},\n\n"
        "Thank you for applying for {{ job_title }}. Before we go further, we would like to "
        "hear more about the work you describe in your CV.\n\n"
        "Could you send us a short note about it?\n\n"
        "{{ tenant_name }}",
    ),
    (
        "Offer",
        "An offer for {{ job_title }}",
        "Hi {{ candidate_name }},\n\n"
        "We would like you to join us as {{ job_title }}. The terms are attached, and we are "
        "glad to go through them with you.\n\n"
        "{{ tenant_name }}",
    ),
    (
        "Not this time",
        "Your application for {{ job_title }}",
        "Hi {{ candidate_name }},\n\n"
        "Thank you for applying for {{ job_title }}. We are taking other applicants forward "
        "this time.\n\n"
        "We will keep your application, and we hope you apply again.\n\n"
        "{{ tenant_name }}",
    ),
)


async def seed_presets(session: AsyncSession, tenant_id: UUID, founding_admin_id: UUID) -> None:
    """Fill a new Tenant's two vocabularies, so neither opens as an empty list.

    Written in the transaction that opens the Tenant, which is the only place the founding admin
    the templates are attributed to is known to exist.
    """
    session.add_all(
        TenantTag(tenant_id=tenant_id, name=name, scope=scope) for name, scope in PRESET_TAGS
    )
    session.add_all(
        MessageTemplate(
            tenant_id=tenant_id,
            created_by_recruiter_id=founding_admin_id,
            name=name,
            subject=subject,
            body=body,
        )
        for name, subject, body in PRESET_TEMPLATES
    )
