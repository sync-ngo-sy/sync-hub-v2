# CVs are parsed by sending the file itself to the model, behind a CvExtractor port; there is no local text-extraction pipeline

Status: accepted

CV parsing sends the original PDF/DOC/DOCX to OpenAI as a file input (Files API upload,
`purpose="user_data"`, deleted in a `finally` after the call) and gets a validated
`ParsedCv` back via the Responses API's structured outputs
(`responses.parse(text_format=ParsedCv)`). The repo deliberately contains no
pdfminer/unstructured/mammoth-style extraction code: the platform does page rasterization
and text-layer extraction better than we would, and the accepted `input_file` types cover
every MIME the `cvs` bucket allows.

The whole OpenAI dependency lives behind two small ports — `CvExtractor` (parsing) and an
embeddings port (`text-embedding-3-small`, `dimensions=768`, matching `vector(768)`).
Portability to open-source serving was examined and the conclusion recorded: the lock-in
is **not** the API shape (vLLM already serves `/v1/responses` and `/v1/embeddings`) but
the server-side file ingestion itself, which no OSS stack provides. Chasing wire-format
compatibility therefore buys nothing; a future switch means writing one new adapter that
renders pages to images or extracts text, and touching nothing else.

Skill mapping happens in-model: the parse prompt embeds the canonical `skill_taxonomy`
names and `ParsedCv` skills must come from that list; everything else lands in an
`unmapped_skills` list surfaced at candidate review. Those names **persist** — a `text[]`
on `candidates`, copied to `application_profile_snapshots` with the rest of the Snapshot —
so a recruiter reading a profile or an Application sees them, and they feed the search
embedding. Screening never reads them: an unmapped name has no `taxonomy_id` to measure a
Job's criteria against.

## Considered options

- **Local text extraction + text prompt** — a parser dependency per format, worse layout
  fidelity, and it re-implements what the model platform already does.
- **LiteLLM (or similar) abstraction from day one** — a translation layer for optionality
  the port pattern provides for free; still can't make an OSS model ingest a DOCX.
