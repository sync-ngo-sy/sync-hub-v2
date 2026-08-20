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
- `pipeline.py` — the database either side of the model: `match_request` reads one Application
  into the request above, and `assessment_row` turns an answer into the row that is kept.
  `MatchAssessing` is the worker's handle on both. It lives here rather than in either caller
  because both the API and the worker assess, and a second copy of "what the model is shown" is
  how the automatic reading and the one a Recruiter asks for would drift apart.
- `openai_assessor.py` — the adapter. The only module that knows the provider's name.
