# Job view events are kept whole for a year, then swept

Status: accepted; the sweep itself is not built yet, and this record is what it will be built to.

`job_view_events` gains a row every time an anonymous browser opens a Job. It is the
fastest-growing table on the platform by an order of magnitude — every other table grows when
somebody decides something, this one grows when somebody scrolls — and until now nothing said
how long a row lives. That is a decision, not an oversight to leave standing: an analytics
table with no retention story is one that eventually costs more to store and vacuum than the
questions it answers are worth, and the questions it answers all look back weeks.

**Rows are kept for 365 days and then deleted.** The readers are the Dashboard's rolling
windows and a Tracked link's view count; the longest window any of them asks for is a year, so
a year is the point past which a row answers nothing. The sweep is a scheduled `delete` over
`viewed_at`, belonging with the queue sweeps the worker's `/scheduled` endpoint already runs,
and bounded per invocation for the same reason those are — one unbounded transaction over a
year of accumulated rows is worse than a slow recovery. Nothing depends on it having run: the
table is correct at any size, so a sweep that is late costs disk and nothing else.

**Not partitioned.** Declarative partitioning by month would make the sweep a `drop table`
instead of a `delete`, which is the right answer at a volume this table does not have and will
not have soon: a Job board doing ten thousand views a day writes 3.6 million rows a year, which
Postgres indexes and deletes from without noticing. Partitioning is not free either — it needs
a partition-creation job of its own, and `job_view_events` carries a composite foreign key to
`tracked_job_links` that partitioning would have to be designed around. The decision is
deliberately reversible: nothing outside the sweep reads `viewed_at` as anything but a range,
so converting to a partitioned table later changes no query in the API.

**A view is not personal data to keep.** `session_id` is a cookie this platform issued and
`visitor_hash` is a salted one-way hash of an address and a user agent, so a row already
identifies nobody — but "nobody, for a year" is a smaller claim to have to defend than
"nobody, forever", and deleting is what makes the claim true rather than argued.

Rejected: keeping everything and revisiting when it hurts, which is how a table gets large
enough that the first attempt to clean it up is an outage; and aggregating into daily counts on
write, which throws away the per-session detail that application attribution reads and cannot
be un-thrown-away.
