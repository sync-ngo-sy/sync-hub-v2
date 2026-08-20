from __future__ import annotations

PROFICIENCY: dict[str, str] = {
    "native": "native",
    "bilingual": "native",
    "mother": "native",
    "fluent": "fluent",
    "professional": "fluent",
    "proficient": "fluent",
    "advanced": "advanced",
    "upper": "advanced",
    "intermediate": "intermediate",
    "conversational": "intermediate",
    "moderate": "intermediate",
    "beginner": "beginner",
    "basic": "beginner",
    "elementary": "beginner",
    "limited": "beginner",
    "none": "beginner",
}

PROFICIENCY_ORDER: tuple[str, ...] = (
    "native",
    "fluent",
    "advanced",
    "intermediate",
    "beginner",
)


def proficiency_of(*stated: str | None) -> str | None:
    found = {
        PROFICIENCY[word]
        for text in stated
        if text
        for word in [text.strip().split()[0].strip(" -:,.").lower()]
        if word in PROFICIENCY
    }
    return next((level for level in PROFICIENCY_ORDER if level in found), None)
