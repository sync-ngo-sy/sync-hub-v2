from __future__ import annotations

from typing import TYPE_CHECKING

from sync_api.problems import INVALID_APPLICATION_ANSWERS_PROBLEM_TYPE, InvalidField, Problem
from sync_core.models import ApplicationAnswer, ApplicationQuestionType

if TYPE_CHECKING:
    from collections.abc import Iterator, Sequence
    from uuid import UUID

    from sync_api.applications.payload import SubmittedAnswer
    from sync_core.models import JobApplicationQuestion

#: The answer column each question type is answered in.
_ANSWERED_IN = {
    ApplicationQuestionType.YES_NO: "answer_boolean",
    ApplicationQuestionType.SHORT_TEXT: "answer_text",
}


def refuse_unusable_answers(
    questions: Sequence[JobApplicationQuestion], submitted: Sequence[SubmittedAnswer]
) -> None:
    """Refuse an incomplete or mistyped set of answers, naming every entry that caused it.

    "Every required question answered" and "in the kind it asked for" are the backend's; the
    answer→question FK and the one-answer-kind CHECK are the database's.
    """
    faults = list(_faults(questions, submitted))
    if faults:
        raise Problem(
            status=422,
            type=INVALID_APPLICATION_ANSWERS_PROBLEM_TYPE,
            detail="The answers do not match the questions this job asks.",
            errors=[fault.model_dump() for fault in faults],
        )


def answer_rows(
    application_id: UUID, job_id: UUID, submitted: Sequence[SubmittedAnswer]
) -> list[ApplicationAnswer]:
    return [
        ApplicationAnswer(
            application_id=application_id,
            job_id=job_id,
            question_id=answer.question_id,
            answer_boolean=answer.answer_boolean,
            answer_text=answer.answer_text,
        )
        for answer in submitted
    ]


def _faults(
    questions: Sequence[JobApplicationQuestion], submitted: Sequence[SubmittedAnswer]
) -> Iterator[InvalidField]:
    asked = {question.id: question for question in questions}
    for position, answer in enumerate(submitted):
        question = asked.get(answer.question_id)
        if question is None:
            yield InvalidField(
                location=f"body.answers.{position}.question_id",
                message="This job asks no such question.",
                type="unknown_question",
            )
        elif getattr(answer, _ANSWERED_IN[question.question_type]) is None:
            yield InvalidField(
                location=f"body.answers.{position}.{_ANSWERED_IN[question.question_type]}",
                message=f"“{question.question_text}” is a {question.question_type.value} question.",
                type="answer_type_mismatch",
            )

    answered = {answer.question_id for answer in submitted}
    for question in questions:
        if question.is_required and question.id not in answered:
            yield InvalidField(
                location="body.answers",
                message=f"“{question.question_text}” has to be answered.",
                type="missing_required_answer",
            )
