# Contact details are read one profile at a time, never from a list

A Tenant may read a Searchable Candidate's phone and email, which the search projection
previously refused to carry at all. What replaces that refusal is not "expose them" but
"expose them one at a time": they appear on `GET /v1/tenants/me/candidates/{id}` and nowhere
else, so no list — search results, the directory, the talent pool — ever carries a way to
reach anybody. The distinction being drawn is between *reach* and *harvest*. A Recruiter who
opens a profile to contact one person is the point of the product; a single authenticated
request that returns a hundred phone numbers, and pages to the whole Searchable population,
is a different thing wearing the same clothes. Rejected: keeping them hidden entirely, which
made a found Candidate unreachable and pushed Recruiters toward guessing addresses; and
putting them on list payloads, which is what the frontend would find most convenient and is
precisely the shape worth refusing.

Email is joined from `auth.users` at read time rather than copied into `profiles`, because
only `auth.users` holds a *confirmed* address — the reason email was kept out of the
Application Snapshot too. A denormalised column would be a second copy that drifts and that
would have to track confirmation and change flows to stay true; a join on one row, in a
query that is already reading one row, cannot be stale. This is a deliberate coupling of
exactly one query to GoTrue's table, and it is confined to the profile read for that reason.

Note that `is_searchable` now means more than it did when existing Candidates switched it
on. They opted in under a projection that promised never to expose contact details. This was
weighed and accepted without re-consent, on the grounds that the opt-in has always been an
opt-in to being *found* by Tenants, and that a Tenant reading one profile at a time is the
thing being opted into rather than a new use of the data.
