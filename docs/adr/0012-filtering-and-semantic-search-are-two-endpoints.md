# Filtering and semantic search are two endpoints, not one

A Recruiter who wants everyone in Damascus should not have to invent a sentence to search
for. `GET /v1/search/candidates` required `q`, so "just filter" was unaskable, and the
obvious repair — make `q` optional and branch inside — was rejected because the two things
it would branch between are not variants of one request. A ranking cannot be paged to its
end, and no honest cursor exists for it: relevance has no immutable key, and the one field
that looks like a key, distance, is exactly the wrong thing to page on, because
`WHERE distance > x` abandons the HNSW graph and degrades to a sequential scan. A filter is
the opposite on every count — every answer it gives is a yes or a no, so it orders by
something stable and pages to the end. Their payloads disagree too: a semantic hit carries
the profile fragment that matched, and there is no such fragment when nothing was matched
against. So `/v1/search/candidates` keeps its required `q` and ranks, `GET /v1/candidates`
takes only structured filters and pages properly, and each one tells the truth about what it
can do. Filters remain on both: "backend engineer who ran payment systems, in Aleppo" is the
question Recruiters actually ask, and the split is about not *demanding* a query, not about
withholding filters from the one that takes one.
