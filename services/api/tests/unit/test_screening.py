from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import uuid4

from sync_api.applications.screening import (
    Criteria,
    KnockoutQuestion,
    LanguageCriterion,
    SkillCriterion,
    Snapshot,
    SnapshotAnswer,
    SnapshotLanguage,
    SnapshotSkill,
    screen,
)
from sync_core.models import LanguageProficiency, QualificationStatus, SkillImportance

PYTHON = uuid4()


def a_required_skill(**changes: Any) -> SkillCriterion:
    return SkillCriterion(
        **{
            "taxonomy_id": PYTHON,
            "name": "Python",
            "importance": SkillImportance.REQUIRED,
            "minimum_years": None,
            **changes,
        }
    )


def test_a_job_that_measures_nothing_qualifies_everyone() -> None:
    verdict = screen(Criteria(), Snapshot())

    assert verdict.status is QualificationStatus.QUALIFIED
    assert verdict.reason is None


def test_a_required_skill_the_applicant_does_not_have_disqualifies() -> None:
    verdict = screen(Criteria(skills=(a_required_skill(),)), Snapshot())

    assert verdict.status is QualificationStatus.DISQUALIFIED
    assert verdict.reason is not None
    assert "Python" in verdict.reason


def test_a_required_skill_the_applicant_has_passes() -> None:
    snapshot = Snapshot(skills=(SnapshotSkill(taxonomy_id=PYTHON, years_experience=Decimal("3")),))

    verdict = screen(Criteria(skills=(a_required_skill(),)), snapshot)

    assert verdict.status is QualificationStatus.QUALIFIED


def test_too_few_years_of_a_required_skill_disqualifies() -> None:
    snapshot = Snapshot(skills=(SnapshotSkill(taxonomy_id=PYTHON, years_experience=Decimal("2")),))

    verdict = screen(Criteria(skills=(a_required_skill(minimum_years=5),)), snapshot)

    assert verdict.status is QualificationStatus.DISQUALIFIED
    assert verdict.reason is not None
    assert "Python" in verdict.reason


def test_exactly_the_years_a_required_skill_asks_for_passes() -> None:
    snapshot = Snapshot(skills=(SnapshotSkill(taxonomy_id=PYTHON, years_experience=Decimal("5")),))

    verdict = screen(Criteria(skills=(a_required_skill(minimum_years=5),)), snapshot)

    assert verdict.status is QualificationStatus.QUALIFIED


def test_unstated_years_of_a_required_skill_asks_for_a_human() -> None:
    snapshot = Snapshot(skills=(SnapshotSkill(taxonomy_id=PYTHON, years_experience=None),))

    verdict = screen(Criteria(skills=(a_required_skill(minimum_years=5),)), snapshot)

    assert verdict.status is QualificationStatus.REVIEW_REQUIRED
    assert verdict.reason is not None
    assert "Python" in verdict.reason


def test_unstated_years_are_fine_where_the_skill_itself_is_the_bar() -> None:
    snapshot = Snapshot(skills=(SnapshotSkill(taxonomy_id=PYTHON, years_experience=None),))

    verdict = screen(Criteria(skills=(a_required_skill(),)), snapshot)

    assert verdict.status is QualificationStatus.QUALIFIED


def test_a_disqualifying_rule_outranks_one_that_only_asks_for_a_human() -> None:
    unknown = uuid4()
    snapshot = Snapshot(skills=(SnapshotSkill(taxonomy_id=PYTHON, years_experience=None),))

    verdict = screen(
        Criteria(
            skills=(
                a_required_skill(minimum_years=5),
                a_required_skill(taxonomy_id=unknown, name="Go"),
            )
        ),
        snapshot,
    )

    assert verdict.status is QualificationStatus.DISQUALIFIED
    assert verdict.reason is not None
    assert "Go" in verdict.reason


def test_a_preferred_skill_never_disqualifies() -> None:
    preferred = a_required_skill(importance=SkillImportance.PREFERRED, minimum_years=10)

    verdict = screen(Criteria(skills=(preferred,)), Snapshot())

    assert verdict.status is QualificationStatus.QUALIFIED


def test_an_optional_skill_never_disqualifies() -> None:
    optional = a_required_skill(importance=SkillImportance.OPTIONAL, minimum_years=10)

    verdict = screen(Criteria(skills=(optional,)), Snapshot())

    assert verdict.status is QualificationStatus.QUALIFIED


def test_too_little_total_experience_disqualifies() -> None:
    snapshot = Snapshot(total_experience_years=2)

    verdict = screen(Criteria(minimum_total_experience_years=Decimal("5")), snapshot)

    assert verdict.status is QualificationStatus.DISQUALIFIED
    assert verdict.reason is not None
    assert "5" in verdict.reason
    assert "2" in verdict.reason


def test_enough_total_experience_passes() -> None:
    snapshot = Snapshot(total_experience_years=7)

    verdict = screen(Criteria(minimum_total_experience_years=Decimal("5")), snapshot)

    assert verdict.status is QualificationStatus.QUALIFIED


def test_exactly_the_years_the_job_asks_for_passes() -> None:
    snapshot = Snapshot(total_experience_years=5)

    verdict = screen(Criteria(minimum_total_experience_years=Decimal("5")), snapshot)

    assert verdict.status is QualificationStatus.QUALIFIED


def test_an_application_with_no_work_at_all_has_none_of_it() -> None:
    verdict = screen(Criteria(minimum_total_experience_years=Decimal("1")), Snapshot())

    assert verdict.status is QualificationStatus.DISQUALIFIED


def test_work_short_of_the_bar_is_settled_and_never_sent_to_a_human() -> None:
    """Dates are mandatory, so "we could not measure it" is no longer a state that exists."""
    verdict = screen(Criteria(minimum_total_experience_years=Decimal("5")), Snapshot())

    assert verdict.status is not QualificationStatus.REVIEW_REQUIRED


def an_arabic_bar(minimum: LanguageProficiency) -> LanguageCriterion:
    return LanguageCriterion(code="ar", name="Arabic", minimum_proficiency=minimum)


def test_a_required_language_the_applicant_does_not_speak_disqualifies() -> None:
    verdict = screen(Criteria(languages=(an_arabic_bar(LanguageProficiency.ADVANCED),)), Snapshot())

    assert verdict.status is QualificationStatus.DISQUALIFIED
    assert verdict.reason is not None
    assert "Arabic" in verdict.reason


def test_a_required_language_spoken_below_the_bar_disqualifies() -> None:
    snapshot = Snapshot(
        languages=(SnapshotLanguage(code="ar", proficiency=LanguageProficiency.INTERMEDIATE),)
    )

    verdict = screen(Criteria(languages=(an_arabic_bar(LanguageProficiency.ADVANCED),)), snapshot)

    assert verdict.status is QualificationStatus.DISQUALIFIED


def test_a_required_language_spoken_exactly_at_the_bar_passes() -> None:
    snapshot = Snapshot(
        languages=(SnapshotLanguage(code="ar", proficiency=LanguageProficiency.ADVANCED),)
    )

    verdict = screen(Criteria(languages=(an_arabic_bar(LanguageProficiency.ADVANCED),)), snapshot)

    assert verdict.status is QualificationStatus.QUALIFIED


def test_a_required_language_spoken_better_than_the_bar_passes() -> None:
    snapshot = Snapshot(
        languages=(SnapshotLanguage(code="ar", proficiency=LanguageProficiency.NATIVE),)
    )

    verdict = screen(Criteria(languages=(an_arabic_bar(LanguageProficiency.BEGINNER),)), snapshot)

    assert verdict.status is QualificationStatus.QUALIFIED


RIGHT_TO_WORK = uuid4()


def test_the_wrong_answer_to_a_knockout_question_disqualifies() -> None:
    snapshot = Snapshot(answers=(SnapshotAnswer(question_id=RIGHT_TO_WORK, answer_boolean=False),))

    verdict = screen(
        Criteria(
            knockouts=(
                KnockoutQuestion(
                    question_id=RIGHT_TO_WORK,
                    question_text="Do you have the right to work in Syria?",
                    accepted_boolean_answer=True,
                ),
            )
        ),
        snapshot,
    )

    assert verdict.status is QualificationStatus.DISQUALIFIED
    assert verdict.reason is not None
    assert "right to work" in verdict.reason


def test_the_accepted_answer_to_a_knockout_question_passes() -> None:
    snapshot = Snapshot(answers=(SnapshotAnswer(question_id=RIGHT_TO_WORK, answer_boolean=True),))

    verdict = screen(
        Criteria(
            knockouts=(
                KnockoutQuestion(
                    question_id=RIGHT_TO_WORK,
                    question_text="Do you have the right to work in Syria?",
                    accepted_boolean_answer=True,
                ),
            )
        ),
        snapshot,
    )

    assert verdict.status is QualificationStatus.QUALIFIED


def test_a_knockout_question_left_unanswered_asks_for_a_human() -> None:
    verdict = screen(
        Criteria(
            knockouts=(
                KnockoutQuestion(
                    question_id=RIGHT_TO_WORK,
                    question_text="Do you have the right to work in Syria?",
                    accepted_boolean_answer=True,
                ),
            )
        ),
        Snapshot(),
    )

    assert verdict.status is QualificationStatus.REVIEW_REQUIRED


def test_an_answer_to_a_question_that_screens_on_nothing_is_not_judged() -> None:
    snapshot = Snapshot(answers=(SnapshotAnswer(question_id=RIGHT_TO_WORK, answer_boolean=False),))

    verdict = screen(Criteria(), snapshot)

    assert verdict.status is QualificationStatus.QUALIFIED


def test_every_rule_that_failed_is_in_the_reason() -> None:
    verdict = screen(
        Criteria(
            skills=(a_required_skill(),),
            languages=(an_arabic_bar(LanguageProficiency.FLUENT),),
            minimum_total_experience_years=Decimal("5"),
        ),
        Snapshot(),
    )

    assert verdict.status is QualificationStatus.DISQUALIFIED
    assert verdict.reason is not None
    assert "Python" in verdict.reason
    assert "Arabic" in verdict.reason
    assert "5 years" in verdict.reason
