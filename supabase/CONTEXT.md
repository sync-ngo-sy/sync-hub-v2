# Database

The Postgres schema for the Sync Hub recruitment platform, hosted on Supabase. It holds
identity, per-tenant recruiting data, candidate profiles, applications, and the
invariants the database enforces itself (constraints, RLS, trusted RPCs).

## Language

### Identity & tenancy

**Tenant**:
An organization (a hiring company) that owns its recruiters, jobs, and private CRM data.
The unit of data isolation.
_Avoid_: Company, Org, Workspace, Account.

**Picture**:
The covering term for the two square images the platform stores for somebody: a Candidate's
avatar and a Tenant logo. They are one thing as far as *storing* one goes — re-encoded to one
512x512 WebP, kept in a public bucket under the owner's id, and replaced by writing the new
object before the old one is dropped — and the backend holds that in one place. The covering
term is never used for either of them on screen: a Candidate has an avatar and a Tenant has a
logo, and those are the words a person reads.
_Avoid_: Image, Media, Asset, Upload (that is the act).

**Tenant logo**:
The mark Candidates identify a Tenant by, on `tenants.logo_url`. One Picture in the public
`tenant-logos` bucket, so what a browser reads is never what a client sent. Public-read for
the reason a Candidate's avatar is: it is rendered by an `<img>` on a page a signed-out
visitor reads, and a signed URL would expire mid-page. Only a Tenant admin sets it.
_Avoid_: Avatar (that is a Candidate's), Icon, Brand.

**Tenant presets**:
The Tags and Message templates a Tenant opens with when a Platform admin converts the Access
request it came from, written in the transaction that opens it — the only place the founding
admin the templates are attributed to is known to exist. Ordinary
rows from that moment: no preset column, no flag, and no code that treats them as anything but
the Tenant's own, so they are renamed and deleted exactly as the ones a Recruiter writes.
_Avoid_: Defaults, Starter pack, System tags, Built-ins.

**Profile**:
The identity of one human, sharing its id with a Supabase Auth user. Holds the live
contact identity — name, avatar, phone. Every Candidate, every Recruiter and every Platform
admin *is* a Profile, and is exactly one of the three — the `account_type` discriminator and
each child table's composite foreign key make the other two physically unreferenceable.
_Avoid_: User, Account.

**Phone**:
One reachable number on a Profile, held as the country it belongs to (`phone_country`, an ISO
country) beside the number itself in E.164. Two columns rather than one string, because the
country somebody chose is not always recoverable from the number — `+1` is twenty-odd countries
— and a flag that changes on reload reads as the platform losing their answer. Every portal
writes it through one picker, and an Application freezes the number it was sent with.
_Avoid_: Mobile, Contact number, Dial code (that is the `+963`, not the field).

**Candidate**:
A Profile in the job-seeker role: owns a professional profile and applies to Jobs. One of
the three kinds a Profile can be, and never a second one as well.
_Avoid_: Job-seeker, User. (Reserve "Applicant" for the act of applying, not the person.)

**Imported candidate**:
A Candidate the platform created on somebody's behalf rather than one who signed up
(`candidates.is_imported_from_manatal`, written by `scripts/manatal-migration`). Nobody typed
their profile — it was read off a CV — and the address on it has never been confirmed by the
person behind it. Whether they have since **claimed** the account is not a column:
`auth.users.last_sign_in_at` already knows, and an account nobody has signed into has none.
_Avoid_: Ghost candidate, Shadow profile, Sourced candidate.

**Links**:
The three professional addresses a Candidate may claim — `candidates.linkedin_url`,
`github_url` and `portfolio_url`. Three columns rather than a list, because each answers a
different question and a list would have to say what every entry is. Each is stored in one
normalised form, which a CHECK holds: a LinkedIn is `https://www.linkedin.com/in/…`, a GitHub
is the account rather than one of its repositories, and a portfolio is an address a browser
would open. A handle typed on its own becomes the whole address before it is stored, and a CV
parse fills the same three fields. An Application freezes all three in its Snapshot, in the same
columns and under the same CHECKs, so an address changed afterwards never rewrites what a
Recruiter already read. Screening reads none of them, on either side.
_Avoid_: Social links, Profiles, URLs.

**Complete profile**:
A Candidate profile carrying everything the platform needs to place somebody: a CV that was
read, their name, Phone, Canonical role, Location, headline and summary, and at least one
qualification, one skill and one language. `candidates.profile_completed_at` records when it
became one and cannot be set on a profile that is not — a CHECK holds the single-row fields, and a
deferred trigger re-reads the sections and the CV each time the candidate row is written, so the
database refuses an unearned marker rather than believing the backend about one. Taking a marker
back is the backend's job, and it does it everywhere completeness can change: saving the profile,
and every path that changes which CV is current — a parse finishing, or a Candidate switching CVs.
Saving an unfinished profile is always allowed; applying to a Job and opting into Searchable are
what it gates. A work history is deliberately not among the ten: somebody who has
never held a job has a first one to find, and a platform that refuses to let them look for it is
the wrong platform. Experience still feeds Total experience, and Recruiters still filter on it.
_Avoid_: Complete, 100%, Profile score, Verified profile.

**Recruiter**:
A Profile in the staff role, belonging to exactly one Tenant. One of the three kinds a
Profile can be, and never a second one as well. `admin` is a Recruiter *role* — authority
inside their own Tenant — and has nothing to do with a Platform admin.
_Avoid_: Agent, Hiring manager.

**Platform admin**:
A Profile that operates Sync Hub itself and belongs to no Tenant: the account a Tenant is
created from, its founding admin invited from, and a Tenant suspended or restored from. The
Platform Portal serves the account type; the Candidate and Recruiter Portals do not. Created
out of band by a script run against an environment — never by signing up,
because the first one has nobody to authorise them. Distinct from a Recruiter whose role is
`admin`. The only account that may turn an Access request into a Tenant.
_Avoid_: Superuser, Staff, Sync Hub admin, Operator, Owner.

**Access request**:
A company asking to be let onto Sync Hub — a name, a person and an address, typed by a visitor
with no account. Sync Hub is sold, not self-served: nobody creates their own Tenant, so this is
where every Tenant starts. It is not an account and carries no identity; converting one is
what creates the Profile. A Platform admin either **converts** it, which opens the Tenant and
invites the founding admin it named, or **dismisses** it — and either decision takes it off
the queue for good. One *address* may hold only one pending request — the same address whatever
case it was typed in — so asking twice is asking once and the first ask stands; nothing a
stranger sends can rewrite one that is already waiting. An address whose request was dismissed
may ask again. The company, the name and the address are the only thing on the platform an
unauthenticated stranger writes, so the schema holds all three to being real rather than merely
present: a blank company or name is refused, and so is an address that is not shaped like one.
_Avoid_: Sign-up, Application (that word belongs to a Candidate applying to a Job), Lead,
Enquiry, Waitlist entry.

### Applications

**Application**:
A Candidate's immutable submission to one Job. Carries a point-in-time Snapshot of the
reviewed profile plus the Candidate's answers, and is the authoritative input to
Screening. One per (Candidate, Job). Every move it makes is appended to its history, and a move a
person decided names the person: only the platform itself moves an Application with nobody behind
it, so an entry from a Recruiter or a Candidate that names no author is one the schema refuses.
It is never put away: there is no archived status and no hidden state, because deciding an
Application and clearing it from the working list turn out to be the same act — what has ended
leaves the list of what has not, and nothing else moves.
_Avoid_: Submission, Entry, Archive (a Job is archived; an Application ends).

**Snapshot**:
The frozen, candidate-reviewed profile captured when an Application is created — identity,
Links, experience, education, skills, languages, projects (the `application_*` tables). Distinct
from the live Candidate profile *and* from the raw AI output in `cvs.parsed_cv_data`; it
may differ from both. Carries the Candidate's Total experience as it stood that day, so a
verdict can be re-explained years later from the Snapshot alone. Anything drawn from a
vocabulary — the Location, the Canonical role — is frozen as the name it went by that day
rather than as its key, so re-wording an entry never rewrites an Application already judged.
Never edited after creation —
and not by convention: a trigger refuses every update and delete on those tables and on the two
histories, for the backend's service role like anybody else, because RLS does not apply to it.
_Avoid_: Copy, Archive.

**Stage**:
What a Candidate is told about their own Application, projected from its status rather than equal
to it — Received, In review, then the outcome. Everything a Tenant does between arrival and a
decision is one Stage, so a Recruiter shortlisting and un-shortlisting somebody is invisible and
silent. A Candidate is notified when the Stage changes and at no other time, which is what lets
the pipeline stay as non-linear as hiring really is. It is no column of this schema and never
will be: it is computed from `applications.status` and the Telling wherever it is read, so there
is no second copy of the truth to keep in step, and a status added to the pipeline has to answer
what it reads as before the code will start. It answers to time as well as to status: a rejection
reads as In review until its Telling.
_Avoid_: Status (the Tenant's word, and it has eight values), step, progress.

**Telling**:
The moment a decision reaches the Candidate, three days after the Tenant took it
(`applications.told_at`). Deciding and telling are two moments rather than one: the Recruiter's
list clears at the click, and for three days the Candidate's Stage still reads In review, the bell
is silent and the email waits. One column holds all three to the same day — the Stage projection
reads it, `notifications.visible_at` holds the bell to it, and `communications.available_at` holds
the email. Only a rejection has one; a hire and a withdrawal are told at once. Three days is one
platform-wide number rather than a Tenant's to set, because a Candidate hears from several Tenants
through Sync, and a wait that varied by employer would read as arbitrary to the person waiting.
What falls out of it is the point: a decision taken back before its Telling was never a decision
the Candidate saw, so the queued rejection is cancelled and there is nothing to apologise for.
_Avoid_: Reveal, Publish, Release, Send (that is the email, one channel of three), Grace period
(that names the gap rather than the moment).

**Hire claim**:
What a Tenant says happened when it moves an Application to `hired`: the day the work started,
and the move it was claimed by (`hire_claims`, one row per Application). Its Recruiter and its
Application are held to one Tenant by a composite key, like every other row a Tenant owns. The
Candidate answers it once — yes, no, or not yet — and a trigger refuses a second answer for the
service role like anybody else, because an answer that can be taken back is a claim about today
rather than a record of what was said. A denied claim moves nothing: what happened is the
Recruiter's to record, and whether it is true is the Candidate's to say.
_Avoid_: Hire, Offer (that is a status), Start date (that is one of its columns).

**Placement**:
A hire the Candidate confirmed — the `placements` view over the Hire claims they said yes to.
The view *is* the definition rather than a report of one: there is no column a backend could set
to make a hire count without the Candidate having said so. A claim nobody confirmed stays a
claim, and nothing counts it.
_Avoid_: Hire, Hired (that is a status), Success, Conversion.

### Search

**Searchable**:
A Candidate's explicit opt-in (`is_searchable`) to be found by any Tenant — through Global
search and through the Candidate directory alike; it is one opt-in, not two. Opting in needs a Complete profile and a current CV that was actually
*read*: a document that failed to parse, or a profile with too little in it to match on, would
otherwise leave somebody told they could be found and appearing nowhere. Being found is not the same as being contacted: no list of
Candidates ever carries a phone or an email, and a Tenant reads either only by opening one
Candidate's profile, one at a time.
_Avoid_: Public, Listed, Visible.

**Global search**:
Cross-tenant search over Searchable Candidates for what a Recruiter *means* — ranked by
what a query is about rather than the words in it, so a profile that never uses the
Recruiter's words can still be the closest answer. Filters narrow it but never reorder it.
It reaches a bounded **depth** of Candidates and pages by offset inside it, saying when that
depth is reached: closeness is not a cursor, because a cursor would have to re-enter the index
traversal it came out of. Its counterpart is the Candidate directory, and the two never merge:
a ranking cannot be paged to the end, and a filter cannot rank.
_Avoid_: Talent search, Discovery.

**Candidate directory**:
The same Searchable Candidates, asked for by fact rather than by meaning — a Location, a
Canonical role, skills, years of work. It answers without a query written in words, orders
newest first, and can be paged to the end, because every answer it gives is a yes or a no
rather than a degree of closeness.
_Avoid_: Browse, Listing, Filtered search.

**Total experience**:
How long a Candidate has worked, in whole years, derived from their experience entries and
never typed: two jobs held at once count once, not twice, and a stretch of six months or
more rounds up to a year. Derived when they save their profile — so it is as current as
they have kept it — and frozen into a Snapshot as it stood the day they applied.
_Avoid_: Seniority, Tenure, Years of experience (that phrase belongs to one skill).

**Profile chunk**:
A slice of a Candidate's *current* profile, embedded as a vector for Global search and carrying
the text that keyword filters read — which is why a keyword finds a skill or a line of a job
description rather than only a headline. Regenerated by delete-and-re-embed whenever the profile
changes; chunks are never patched in place, though a chunk whose text did not change keeps the
vector it had. Every chunk has a vector, and every vector on the platform came out of the one
model `embedding_models` holds, because a distance computed across two models is meaningless and
says so nowhere.
_Avoid_: Embedding record, Fragment.

### Tenant CRM

**Note**:
A Recruiter's free text about one Application or one Candidate, private to the Tenant that
wrote it and stamped with its author. Anyone in that Tenant may rewrite or delete one; the
author it records never changes. Notes about a Candidate and notes on an Application of
theirs are separate records and never merge.
_Avoid_: Comment, Annotation, Memo.

**Tag**:
A Tenant's own label, unique per scope by name, that files Candidates and Applications.
One name is one Tag however it is capitalised — two spellings would be two piles where the
Recruiter meant one, and nothing on screen would say why. A Tag's **scope** — `candidate` or
`application` — fixes what it may be put on and never changes; the database refuses a Tag on the
wrong kind of thing. Deleting a Tag unfiles it from everything it was on.
_Avoid_: Label, Category, Keyword.

**Talent pool**:
The one set of Candidates a Tenant has saved to keep warm. Membership is a set — saving the
same Candidate twice is one entry, keeping the day it was first made — and one Tenant's pool
says nothing about another's.
_Avoid_: Shortlist, Bench, Saved list, Favourites.

**Reach**:
Which Candidates a Tenant may keep a record on: one who has applied to one of its Jobs, one
who is Searchable, or one it has already filed. Any other Candidate reads as absent, so ids
cannot be probed. The last clause is what keeps a record the Tenant made its own to read and
undo — a Candidate who opts back out of Global search cannot strand it.
_Avoid_: Visibility, Access.

### Access

**Trusted operation**:
An action the Python backend performs with the service role, bypassing RLS — application
submission, screening verdict writes, sending communications, the global-search
projection. Clients never perform these directly.
_Avoid_: Admin action, Privileged call.

### Communications

**Communication**:
An outbound message (email for now) to a Candidate, recorded once and auditable forever.
Candidate-facing email is deliberately scarce: an application confirmation, a rejection decided
by a human Recruiter, and what a Recruiter writes an applicant from a Message template. A
Screening verdict never messages anyone by itself.
_Avoid_: Email (the channel), Notification.

**Notification**:
An in-app message to one Profile, carrying a typed payload and a read/unread state — how
Candidates learn about Stage changes and about a CV read, or given up on. Never delivered
externally; distinct from a Communication. One about a Stage change names the Application it is
about, which is what every reader of the table joins on; one about a CV parse names none, because
it is about a CV. Both parse outcomes are written in the transaction that settles the parse, so a
CV nobody was left to tell — deleted while it was being read — is told to nobody.
_Avoid_: Alert, Push, Message.

**Message template**:
A Tenant's reusable, named subject/body with placeholders, rendered into a concrete
Communication when a Recruiter messages an applicant. Saving a reusable draft _is_
creating a Message template. Its name is unique per Tenant however it is capitalised, for the
reason a Tag's is: a Recruiter picks one out of a list by its name.
_Avoid_: Draft, Canned response.

### Jobs & screening

**Job**:
A Tenant's open role that Candidates apply to. Carries the deterministic screening
criteria — required skills, skill-years, required languages, minimum total experience, and
yes/no knockout questions — which lock once the Job has its first Application. It is drafted,
published, closed while it is being decided, republished, and **archived** for good: archived is
the one state nothing leads out of, and two status changes arriving at once cannot talk their way
past that, because each takes the Job's row before reading the status it is about to write.
_Avoid_: Posting, Vacancy, Listing.

**Tracked link**:
A named, unguessable link to one published Job, so a Tenant can tell which channel brought a
view and, later, an Application. Turning one off or letting it expire makes it unresolvable
without touching the traffic it already brought.
_Avoid_: Campaign, UTM, Short link.

**Job view event**:
One anonymous reading of a Job, attributed to the Tracked link that brought it when there was
one and to nothing when the visitor arrived on their own. It records a session the platform
issued and a salted hash — never an address, an agent string, or a person. One session reading
one Job through one channel is one event per half hour: a refresh is the same interest, and the
window is per channel so a browser that reads a Job and then follows a Tracked link gives that
link its own event.
_Avoid_: Impression, Hit, Visit.

**Canonical skill**:
A platform-global entry in the skill taxonomy (one spelling, one id). Everything Screening
compares — a Candidate's skills, a Job's requirements — is expressed in Canonical skills.
CV parsing maps free-text skills onto Canonical skills in-model; what cannot be mapped is
surfaced to the Candidate at review and never influences Screening.
_Avoid_: Skill string, Keyword.

**Canonical role**:
A platform-global entry in the role taxonomy (one key, one spelling) saying what kind of
practitioner a Candidate is — frontend, backend, ui/ux design. One per Candidate, chosen from
the list or left unset — never typed — which is what makes filtering by it an equality on the
key. Unlike a Canonical skill, it is a judgement rather than a reading: CV parsing *proposes*
one and the Candidate confirms or changes it at review, so an unset role means nobody has
claimed one, not that the CV was silent. Named "Canonical" for the same reason a skill is —
to keep it clear of a Recruiter's **role** inside their Tenant, and of a **Job**, which is the
open role a Tenant is hiring for.
_Avoid_: Role, Title, Job title, Discipline, Position.

**Location**:
A platform-global entry in the place taxonomy (one key, one spelling), which a Job and a
Candidate each reference by key. Syria is resolved to the **governorate** and no further;
everywhere else is a **country**, so somebody outside Syria has an answer that is true rather
than a governorate they are not in. A place is chosen from the list or left unset — never
typed — which is what makes filtering by it an equality on the key: Damascus no longer
answers for Rif Dimashq. Full-text search reaches the name through the relation, so a Job is
still found by the word a person would type. An onsite or hybrid Job always names one, because a
place somebody has to travel to is the whole point; a remote Job names the place a Candidate must
be *based*, and leaving it unset means **Anywhere**.
_Avoid_: City, Place string, Region, Address.

**Employment type**:
What the contract on a Job is, from a fixed set — `full_time`, `part_time`, `contract`,
`temporary`, `internship`, `volunteer`. An enum rather than a table: the set changes
approximately never, and as an enum it reaches both portals through the generated client,
so no list is written into a portal by hand. It was prose, and two Recruiters writing "Full
time" and "Full-time" made two kinds of job that no single filter could ask for. Unset says
nothing about the contract; it is not a value.
_Avoid_: Contract type, Job type, Employment status.

**Work mode**:
How much of a Job's work happens where its team is — `onsite`, `hybrid`, `remote`. An enum,
for the same reasons as Employment type, and answered by every published Job, because a listing
that will not say is one nobody can judge. It answers a different question from **Location** and
never stands in for one: remote is not a place, which is what stops "Remote" being typed into the
place taxonomy. One of the hard filters over Browse, so looking for remote work is asking the
platform rather than reading every listing to find out.
_Avoid_: Remote, Location type, Arrangement, Workplace.

**CV**:
A candidate document, parsed once by AI into immutable `parsed_cv_data`. The Candidate
reviews the parse before it updates a profile or feeds an Application; the raw parse is
never itself the authoritative profile. A Candidate keeps up to five **active** CVs — ones
they have not deleted — and deleting is soft: it leaves the Applications made with the CV,
and the file itself, whole for the Tenants reviewing them. Its two settled states say what they
settled on: `ready` carries the parse it was read from, `failed` carries the reason it could not
be, and the language it was written in is one of the platform's own language codes or nothing —
never a word the model chose.
_Avoid_: Resume, Document.

**Current CV**:
The one CV a Candidate applies and is found with (`candidates.current_cv_id`). Only a CV
that has been read (`ready`) can be it; the first one to be read becomes it by itself, and
after that only the Candidate moves it. It is the one CV they cannot delete — they make
another current first — so a deleted CV is never anybody's current CV.
_Avoid_: Default CV, Primary CV, Main CV.

**Screening**:
The deterministic verdict — `qualified` / `disqualified` / `review_required` — computed
from an Application's Snapshot against its Job's criteria. There is no match score; AI
match assessments are advisory only and never override it. A verdict that refuses an applicant
says which criteria refused them, on the Application and in its history alike: the schema will
not hold a `disqualified` with nothing to show a Recruiter or explain to a Candidate. The
criteria it measured are read under the Job row's lock, so a Recruiter replacing them cannot
leave a verdict citing requirements the Job no longer has.
_Avoid_: Scoring, Ranking, Matching.

**AI match assessment**:
A model's reading of one Application: a percentage and an explanation, from the same Snapshot and
Job criteria Screening measured. Written for every Application as it arrives, and written again
whenever a Recruiter doubts it. The automatic one is enqueued by the Application's own arrival, in
the transaction that created it, and run by the worker rather than inline: a Candidate does not
wait on a model, and a provider that is down cannot refuse an Application. Advisory — none of it
touches the Screening verdict.
An Application carries **one** reading, which a unique constraint holds it to: asking again
replaces it where it stands rather than writing a second beside it, and nothing removes one. A
Recruiter who distrusts a number gets a better number, never an empty column. The reading keeps
the model and the prompt version that wrote *it* — overwritten with the rest, because they
describe what is there now rather than what used to be. Its percentage is carried onto
`applications.current_match_score`, because an order can only be indexed on a column of the table
it orders and a Job's list sorts hundreds of rows by it; a trigger moves it, so no writer can
leave the two disagreeing. Null until the Application has been read at all, which is either a few
seconds after it arrived or a provider that stayed down.
_Avoid_: AI screening, Ranking, Verdict (that word is Screening's), History (there is one reading,
not a list).
