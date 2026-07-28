from __future__ import annotations

import re
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from jinja2 import Environment, StrictUndefined
from markupsafe import Markup, escape

from sync_comms.email import UnsendableEmailError
from sync_core.communications import ApplicationConfirmation, ApplicationRejection, RecruiterMessage

if TYPE_CHECKING:
    from collections.abc import Mapping

    from jinja2 import Template

    from sync_core.communications import CommunicationPayload

# Everything interpolated into an email is somebody's typing — a candidate's own name, a
# job title a recruiter wrote. The markup escapes it; the plain-text part must not.
_MARKUP: Final = Environment(autoescape=True, undefined=StrictUndefined)
_PLAIN: Final = Environment(autoescape=False, undefined=StrictUndefined)

_BLANK_LINE: Final = re.compile(r"\n\s*\n")


def _paragraphs(text: str) -> Markup:
    """A recruiter's plain typing as markup: a blank line parts paragraphs, a single one breaks
    a line. Only the message a Recruiter wrote needs it — the rest of the prose here is ours,
    and already markup. Doing it with `white-space` instead would lose the shape of the message
    in every Outlook, which renders mail through Word.
    """
    blocks = (
        escape(block.strip()).replace("\n", Markup("<br>"))
        for block in _BLANK_LINE.split(text)
        if block.strip()
    )
    return Markup("\n").join(Markup("<p>{}</p>").format(block) for block in blocks)


_MARKUP.filters["paragraphs"] = _paragraphs


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

APPLICATION_REJECTION: Final = _template(
    subject="Your application for {{ job_title }}",
    html="""
<p>Hi {{ candidate_name }},</p>
<p>
  {{ tenant_name }} has decided not to take your application for
  <strong>{{ job_title }}</strong> any further. Thank you for the time you gave it.
</p>
<p>Your other applications are unaffected, and you are welcome to apply for future roles.</p>
<p>— Sync</p>
""",
    text="""
Hi {{ candidate_name }},

{{ tenant_name }} has decided not to take your application for {{ job_title }} any further.
Thank you for the time you gave it.

Your other applications are unaffected, and you are welcome to apply for future roles.

— Sync
""",
)

RECRUITER_MESSAGE: Final = _template(
    subject="{{ subject }}",
    html="""
{{ body | paragraphs }}
<p>— {{ tenant_name }}, via Sync</p>
""",
    text="""
{{ body }}

— {{ tenant_name }}, via Sync
""",
)

TEMPLATES: Final[Mapping[str, EmailTemplate]] = {
    ApplicationConfirmation.template_key: APPLICATION_CONFIRMATION,
    ApplicationRejection.template_key: APPLICATION_REJECTION,
    RecruiterMessage.template_key: RECRUITER_MESSAGE,
}


def render(template_key: str | None, payload: CommunicationPayload) -> RenderedEmail:
    template = TEMPLATES.get(template_key or "")
    if template is None:
        raise UnsendableEmailError(f"no template is registered as {template_key!r}")
    return template.render(payload)
