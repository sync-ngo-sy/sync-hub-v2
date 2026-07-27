from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from jinja2 import Environment, StrictUndefined

from sync_comms.email import UnsendableEmailError
from sync_core.communications import ApplicationConfirmation

if TYPE_CHECKING:
    from collections.abc import Mapping

    from jinja2 import Template

    from sync_core.communications import CommunicationPayload

# Everything interpolated into an email is somebody's typing — a candidate's own name, a
# job title a recruiter wrote. The markup escapes it; the plain-text part must not.
_MARKUP: Final = Environment(autoescape=True, undefined=StrictUndefined)
_PLAIN: Final = Environment(autoescape=False, undefined=StrictUndefined)


@dataclass(frozen=True, slots=True)
class RenderedEmail:
    subject: str
    html: str
    text: str


@dataclass(frozen=True, slots=True)
class EmailTemplate:
    subject: Template
    html: Template
    text: Template

    def render(self, payload: CommunicationPayload) -> RenderedEmail:
        values = payload.model_dump(mode="json")
        return RenderedEmail(
            subject=self.subject.render(values).strip(),
            html=self.html.render(values).strip(),
            text=self.text.render(values).strip(),
        )


def _template(*, subject: str, html: str, text: str) -> EmailTemplate:
    return EmailTemplate(
        subject=_PLAIN.from_string(subject),
        html=_MARKUP.from_string(html),
        text=_PLAIN.from_string(text),
    )


APPLICATION_CONFIRMATION: Final = _template(
    subject="We have your application for {{ job_title }}",
    html="""
<p>Hi {{ candidate_name }},</p>
<p>
  {{ tenant_name }} has received your application for <strong>{{ job_title }}</strong>.
  Their team reviews it from here, and you can follow it in your applications list.
</p>
<p>Your reference is {{ application_id }}.</p>
<p>— Sync</p>
""",
    text="""
Hi {{ candidate_name }},

{{ tenant_name }} has received your application for {{ job_title }}. Their team reviews it
from here, and you can follow it in your applications list.

Your reference is {{ application_id }}.

— Sync
""",
)

TEMPLATES: Final[Mapping[str, EmailTemplate]] = {
    ApplicationConfirmation.template_key: APPLICATION_CONFIRMATION,
}


def render(template_key: str | None, payload: CommunicationPayload) -> RenderedEmail:
    template = TEMPLATES.get(template_key or "")
    if template is None:
        raise UnsendableEmailError(f"no template is registered as {template_key!r}")
    return template.render(payload)
