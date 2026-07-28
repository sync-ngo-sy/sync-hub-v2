# sync-assessments

The AI match assessment: advice on how well one Application answers one Job, and never a
verdict — Screening decides that on its own, deterministically.

- `assessor.py` — the `MatchAssessor` port, the request it reads (a Job's criteria and the
  Application's frozen Snapshot), and the one failure a caller has to handle.
- `schema.py` — `AssessedMatch`, which is both what the port returns and the structured
  output the model is made to answer in.
- `prompt.py` — the instructions and the document the model reads them against, plus the
  `PROMPT_VERSION` recorded on every assessment. Both move together: change what the model
  is shown, and the version it was shown under changes with it.
- `openai_assessor.py` — the adapter. The only module that knows the provider's name.
