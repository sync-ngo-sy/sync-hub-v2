# Recruiter Portal

The tenant-facing web app: publishing Jobs, reviewing Applications, working the tenant
CRM (talent pool, notes, tags), and managing the team. Domain vocabulary (Tenant,
Recruiter, Job, Application, Screening, Tracked link…) is inherited from the
[Database context](../../supabase/CONTEXT.md) and never redefined here.

## Language

**Landing page**:
The public page at the portal's root that explains the platform to companies and offers
contact (WhatsApp, email) and a way to ask for access. It offers no workspace sign-up: Sync is
sold, not self-served, so every call to action points at the Access-request page. One of the two
surfaces where animation is allowed (the other is the Candidate Portal's landing page).
_Avoid_: Home page, marketing site.

**Access-request page**:
The public page at `/request-access` where a visitor leaves their company, their name and their
address, and is told the request was received. The one unauthenticated write this portal makes.
`/signup` is kept as a redirect to it, because that address was published. Creating an account
here is impossible — a Platform admin converts the request, and the founding admin arrives by
invitation.
_Avoid_: Sign-up page, contact form, waitlist.

**Workspace**:
Everything behind the sign-in guard — the Tenant's own Sync, reached through the
sidebar. Routes live under the `_workspace` layout, whose guard is the single place a
Profile is checked before any of its loaders run.
_Avoid_: App, dashboard area, admin.

**Dashboard**:
The signed-in Recruiter's home: an overview of the Tenant's hiring activity. One
destination inside the Workspace, not a name for the Workspace itself. Every number on it is the
platform's own answer, read whole from the tenant stats endpoint — the page counts nothing, and
so has nothing to qualify. Three reads carry four panels: the stat cards and the Sources chart
share the counts, the recent Applications and the Jobs overview have their own. Each panel is an
Independent widget, so one refusal is spoken by the panel it leaves blank, in that panel, with
that panel's own Retry.
_Avoid_: Home, overview page.

**Source**:
A named channel a tenant's Job views arrived through, added up across every Job. A Tracked link's
name is unique per Job rather than per Tenant, so the same campaign run on nine Jobs is nine
Tracked links and one Source. `Direct` is the Source for visitors who reached a Job with no link
at all; it appears only when such traffic exists, where a Tracked link somebody made is a Source
even at zero views. The Dashboard card ranks Sources and shows the six that fit, saying in its own
subtitle how many there were rather than letting six look like all of them — the count sits there
and not on the link beside it, because that link leads to the Tracked links page and a count of
Sources would be describing something other than where it goes.
_Avoid_: Channel as a separate term, campaign, referrer, UTM.

**Pipeline**:
The ordered application statuses a Recruiter moves an Application through while
reviewing it. Distinct from Screening, which is the automated verdict.
_Avoid_: Funnel, workflow, stages.

**Triage list**:
A Job's Applications, newest first, under the Job's Applications tab — the surface a Recruiter
works from before opening anything. Each row carries the Screening verdict and the Pipeline
status side by side, because the two answer different questions and neither substitutes for the
other. Both are filters, they combine, and they live in the address bar rather than in the page,
so a reload keeps them and a pasted link reproduces the list it was copied from. The list is
paged by cursor and never sorted in the browser: the API decides the order.
_Avoid_: Applicants list, candidate list (a Candidate is a person; a row here is an Application).

**Application review**:
The page one Application is read on, reached from the Triage list or from its own address —
what the Application says on the left (the Snapshot, the answers, and the Match assessments read
of them), and on the right the things a Recruiter acts on or against: the Pipeline, the Applicant
message, the Screening verdict, the CV, and the history. It reads the Snapshot
rather than the Candidate's live profile, and says so on the page, because the two can differ
and only one of them is what was reviewed. The Candidate Card on top is the one exception, and
only for the two facts a Snapshot cannot freeze: a confirmed email lives in the authentication
store alone, and an avatar is a file that moves rather than a value that was once true.
Everything else on that card — the name, the headline, the Canonical role, the phone, the years,
the languages — is the frozen one, so nothing a Recruiter reads beside the verdict can drift out
from under it. The card says as much on itself rather than leaving the Snapshot panel below to
say it: it is marked `Snapshot` beside the name and names the two live facts underneath, because
a card that looks identical to the Candidate view's would otherwise read as today's person. The
CV's link is short-lived and never stored: the page re-reads the Application instead of holding
on to it.
_Avoid_: Application detail, candidate page, applicant profile.

**Pipeline move**:
One named action on the Application review, offered only where the platform allows it from
where the Application stands — so the buttons on screen are the moves that exist, and the
current status sits above them. A move forward or back is named for its stage, a decision for
the decision ("Mark as hired", "Reject"), and each says in its outcome toast that the candidate
was told, because every move notifies them and a rejection also emails them. Withdrawing is
never offered: that is the Candidate's alone.
_Avoid_: Status change, transition, stage update.

**Refused move**:
A Pipeline move the API answers with a 409, rendered where the buttons are rather than as a
toast or a page-wide banner — the reason belongs beside the thing that caused it, and the
Application has not moved, so the rest of the page is still true. The wording is the server's:
it owns the rule, and the portal's own sentence is only the fallback for a refusal that
explains nothing.
_Avoid_: Invalid transition error, move failure.

**Notes widget**:
The Application review's team memory: a box to write in, and under it what the team has already
written, newest first. Each note carries the Recruiter who wrote it and how long ago, and says
"edited" and re-dates itself when somebody rewrites it — a note belongs to the Tenant, so any
Recruiter may rewrite or delete any of them, and the byline stays whoever wrote it first. Nothing
is patched in the browser after a write: the author and both timestamps are the server's to write,
so the widget re-reads what it has just changed. Older notes arrive only when they are asked for.
Deleting asks first, because the words are the only copy.
_Avoid_: Comments, activity feed, internal messages (a Message goes to the Candidate; a note never
leaves the Tenant).

**Tag picker**:
The one control on the Application review that does both halves of filing: it lists the Tenant's
application-scoped vocabulary to toggle a Tag on or off, and offers to mint the word the Tenant
does not have yet from whatever has been typed. Creating reads as one act although it is two on
the wire, and the two are told apart when only the first lands: a Tag that was minted stays in the
vocabulary even if the Application could not then be filed under it, so the picker offers the word
rather than offering to create it a second time — which the API would refuse as a name already
taken. Only application-scoped Tags are ever offered, because a candidate-scoped one is a refusal
the picker should not be able to ask for, and a part-match is still a new word: "Arab" is not
"Arabic", and only the Recruiter knows which they meant. The Tags already on show as removable
soft pills beside it, so taking one off never needs the picker opened.
_Avoid_: Labels, categories, keywords.

**Independent widget**:
A card on a page that reads its own endpoint, and fails and retries without the page failing —
the notes, the Tags, the Match assessment and the Applicant message on the Application review are
all this. The refusal lands inside the card, with its own Retry, while the Snapshot, the Pipeline
and the CV stay on screen and true; the page-wide route error is kept for the read the page cannot
do without. A write refused inside a widget is shown against the control that caused it, in the
server's words, and changes nothing.
_Avoid_: Sub-page, partial, fragment.

**Match assessment**:
An AI's reading of how much of what a Job asks for one Application evidences — a percentage, an
explanation, the strengths and the gaps — asked for on the Application review and read there,
newest first. Advice, and the page says so: it carries no Status Mark and no colour, because the
surface already has a Screening verdict and a second marked state would read as a second verdict.
The percentage is spelled out as what it measures rather than shown bare. Asking again appends rather
than replaces, so every past reading stays with the model and prompt version that wrote it, and
the wait is shown as a wait — the model is slow, nothing is put in the list optimistically, and
the finished reading arrives only when the API has it. A refusal (asked too often, the model
failed, no model configured) lands beside the button in the server's own words.
A reading is thrown away one at a time and nothing is asked first — a stale reading is not a
decision, and the Recruiter can always ask for another. The one going leaves to the right while
the API is told, so the list is seen shortening rather than found shorter; the readings left
behind are untouched, each still with the model and prompt version that wrote it. A deletion the
server refuses lands beside that reading, in the server's own words, and the reading stays.
_Avoid_: AI score, match score, rating, fit verdict (a verdict is Screening's).

**Applicant message**:
One email a Recruiter sends an applicant from a Message template, opened as an editable draft on
the Application review. Picking a template fills a Subject and a Message field with the Placeholder
vocabulary already resolved against this Application, this Job and this Tenant — the portal resolves
them itself, because the API resolves them only at send and there would be nothing to open from.
Reading the Tenant's own name is what that costs, and this is the only place the portal asks for it.
The draft is the Recruiter's to rewrite for this one applicant and nothing more: the send carries
the edited words, the saved template is never written to, and picking another template throws the
edit away. An untouched draft sends the template itself, which is why the note beneath it says the
greeting will come from the profile at send while the draft shows the Snapshot's name; edit
anything and the note says instead that these exact words are what goes. What cannot be introduced
here is a new Placeholder: an unfillable name is refused beside the field before anything is asked
of the API, and growing the vocabulary stays the template editor's business. Each send is its own
decision: the picker empties afterwards so the same words don't go twice by accident, and a refused
send keeps the draft so the Recruiter can try the same message again.
_Avoid_: Outreach campaign, bulk email, notification (the Pipeline's own emails are not this).

**Jobs page**:
The Workspace destination that lists the Tenant's Jobs, filtered by state on tabs and ordered by
a picker beside them: newest, oldest, or most applications. Both live in the URL, so a view is
shareable and a reload lands where the Recruiter was. Each row carries the views and the
applications the Job has drawn, side by side, because reach and conversion are only worth
anything read against each other. Views are all views, whatever brought them — the Tracked links
tab is where they are broken down by Source.
_Avoid_: Postings list, vacancies page.

**Tracked links tab**:
The Job's third tab, where a Recruiter mints a named link for a channel, copies its address,
renames it, turns it off, and reads what each one brought. Minting hands the address straight back
to copy, because a link nobody can share is worth nothing. A link that is off keeps its row and its
count: turning it off ends the traffic, not the history — and so a rename leaves both the address
and the views alone. Each row also carries its share of the Job's whole total, so a link is read
against everything the Job drew rather than against the other links; a Job nobody has read yet
shows a dash rather than a percentage of nothing. The comparison is a bar chart of views per
Source on the teal chart ramp, loaded in a chunk of its own so the charting library only travels
for a Recruiter who opens this tab, and `Direct` stands in it as the total less what the links
brought — a bar where such traffic exists and no bar where it does not. The address is built on
the Candidate Portal's origin, since that is the portal that counts the view.
_Avoid_: Campaigns tab, UTM builder, analytics tab.

**Tracked links page**:
The Workspace destination that reports every Tracked link the Tenant has, across every Job, with
what each brought and the state it is in — searchable by name. One row per link and never merged:
a link has a state and a Job of its own, and the same name on two Jobs is two links with two of
each. That is the deliberate opposite of a Source, which merges them to answer which channel
works. It reports and does not manage: renaming, minting and turning a link off stay on the
Tracked links tab of the Job that owns it, which is where a row leads. Live, Expired and Off are
one vocabulary with that tab — the API narrows on the switch, and the date that separates Live
from Expired is read from the row.
_Avoid_: Campaigns page, analytics page, link manager.

**Workspace settings**:
The three things a Tenant administers about itself, under one address with the open tab in it: the
Team, the Tag vocabulary, and the Tenant. The page itself reads nothing — each tab is an
Independent widget that asks for what it needs when it is opened, so a Recruiter who came for the
Tags never waits on the roster.
_Avoid_: Admin panel, preferences, account settings (a Profile is not what is administered here).

**Team tab**:
The Tenant's roster: everyone on it with their role and whether they can still sign in, colleagues
without access included. An admin invites a teammate from here and changes what a colleague may do;
a Recruiter reads the same list and is told plainly that the changes are an admin's. The caller's
own role is read off the roster rather than out of their Profile, because that is where it is
written — which also means a demotion arrives on the next read.
_Avoid_: Users page, members list, seats.

**Teammate invitation**:
One address, one name and one role, sent by the API as an email the invitee sets their own password
from. The roster gains them at once, pending that password, so an admin sees the invitation rather
than having to remember it. An address that already has a Sync account is refused, and the refusal
lands under the email field, because the address is what was wrong rather than the asking.
_Avoid_: Sign-up, adding a user, provisioning.

**Member change**:
One named move an admin makes against a colleague — promote, demote, revoke access, give it back —
each confirmed first, because every one of them is felt by somebody else. The moves offered are the
ones that exist from where the colleague stands: a colleague with no access has only their access to
get back. Your own row offers stepping down and nothing else — an admin may hand over, and the API's
last-active-admin refusal is what stops the last one doing it, but revoking your own access is never
offered because it would lock you out on the spot. A refusal is shown in the server's words, in the
confirmation, and the roster is re-read whatever the answer — a caller who has just stepped down, or
who was demoted while reading, learns it from the same read.
_Avoid_: Permissions editor, seat management.

**Tag vocabulary**:
The whole of the Tenant's filing words on one tab, each with what it may be put on and when it was
added — the counterpart to the Tag picker, which mints into the same vocabulary from an Application.
The picker's scoped read and this tab's whole one are two cache entries of one path, so a word minted
in either shows up in both. A word is unique per scope, so a duplicate is refused beside the field
from the list already on screen, naming the Tag the Tenant actually has rather than the spelling that
was typed; the API's 409 stays the backstop for a word a colleague minted meanwhile. A rename keeps
everything filed under it and cannot change its scope; deleting unfiles it from every Candidate or
Application it was on, which is what the confirmation says — and a Tag a colleague has already
deleted counts as deleted, since that is what was asked for.
_Avoid_: Tag settings, taxonomy, label manager.
**Candidates page**:
The Workspace's one way past its own applicants, over every Candidate on the platform who has
opted into being found. It is two sub-tabs and not one page with a switch, because the backend
answers two different questions and neither is the other's setting: the Filter tab and the AI
Search tab. Which one is open lives in the address bar with everything else, so a reload keeps it
and a pasted link opens the tab it was copied from — and a link written before the tabs existed
opens on AI Search when it carries words, because that is the search it was copied from. Both tabs
offer the same five hard filters — skills, a Canonical role, whole years of work, a Location, the
languages spoken — and a filter is absolute on either, so a Candidate failing any of it is not a
result. The language filter takes several at once and each carries the least proficiency that will
do, so naming two asks for a Candidate who speaks both, each that well or better — read off the
languages a Candidate claims rather than off a single preference. Filters are asked on submit
rather than as a Recruiter types, because half a question is a different question.
_Avoid_: Sourcing, candidate database, global search (that is the backend's name for the index).

**Filter tab**:
The Candidates page's directory: the platform's Searchable Candidates as a sortable table, with no
box to write words in, because nothing here is ranked and there is nothing for words to mean. Its
columns say who somebody is — name, role, years, languages, Location, whether they are already
saved — and Name and Experience can be sorted either way. The order is the API's answer and never
the browser's: sorting asks the directory again, so what is on screen is a page of the whole result
rather than a rearrangement of the twenty already fetched. Newest first is what it opens on, and
that is the one order the address does not bother to name.
_Avoid_: Browse tab, directory search, the table (which is how it renders, not what it is).

**AI Search tab**:
The Candidates page's ranked search: words describing who is wanted, read for what they mean, with
the same filters narrowing what the ranking may reach and a `keywords` box for words that must
appear literally. Closeness is the order and the only order — no column sorts, because re-sorting a
ranking would throw away the one thing it knows. It carries a standing note that the results are
ranked by AI relevance and may be imperfect, pointing at the Filter tab for exact matching; the
note is on the tab rather than on the results, so it is read before the first search and not after
it. The API answers one page and offers no cursor, so a full page is a ceiling rather than a count
— it reads as "the closest twenty" and points at narrowing, because there is no next page to offer
and calling it a total would be a lie.
_Avoid_: Semantic search, smart search, vector search (that is the backend's mechanism, not the
tab).

**Candidate view**:
One person as this Tenant knows them: their whole profile with their email and phone, the fragment
that matched if a search led here, the Tenant's notes and Tags on them, and whether they are in the
Talent pool. The profile is read by id from the directory, so how you arrived changes nothing about
what you see — a pasted link shows the same person a click from the Talent pool does, and no search
is re-run to reconstruct them. The matched fragment is the one thing arriving does decide: it is
read from the search already in hand, and a link opened cold simply has none. When the directory
answers that no Candidate this Tenant can reach has that id, the page says exactly that rather than
inventing a profile. The profile itself is the shared full-profile component, Candidate Card on top,
the same one the Application review renders its Snapshot through. The notes and the Tags are the
Application review's own interactions, naming a Candidate instead of an Application; a Tag offered
here is candidate-scoped, which is the other half of the same vocabulary.
_Avoid_: Candidate profile, candidate detail (a Profile is the Candidate's own; this is the
Tenant's reading of it).

**Talent pool state**:
Whether one Candidate is saved, which the API will only answer by listing the whole pool — so the
portal reads it whole, once, and both the search results and the Candidate view say who is in it
from that one copy. A button that cannot say yet says nothing yet: the card shows its own skeleton
while the pool is arriving and its own refusal when it will not, rather than offering a save whose
state would be a guess. Saving and dropping from the card are idempotent and reversible, and the
card's own button already names what it is about to do, so neither asks first; both re-read the
pool rather than patching it in the browser.
_Avoid_: Bookmarks, favourites, shortlist (a shortlist is a Pipeline status).

**Talent pool page**:
The saved Candidates as a list rather than as an answer about one of them — most recently saved
first, paged by cursor the way the API pages it, because a page is what the list shows and only
the membership question ever needs the pool whole. The two readings are two cache entries of one
endpoint, so a save or a drop made anywhere re-reads both, the copy nobody is watching included:
that copy is what a route loader reads next, and it hands back what it has rather than waiting.
A row opens the Candidate view, which reads the person by id like every other way in.
Dropping asks first here although the card does not: the action is one line in a row menu rather
than a button that has just told you the state. What it costs is what the asking says — the
Tenant's notes and Tags on them survive, but nothing points at that Candidate any more until a
search finds them again, which is the sense in which a drop is reversible rather than destructive.
The empty pool points at candidate search, since search is the only way to fill it.
_Avoid_: Saved list, shortlist page.

**Reference data**:
The platform's fixed lists — Canonical skills with their categories, languages with their
names and codes, and Locations under their heading — read from endpoints of their own and
held for the session. A Job's screening criteria pick skills and languages from these
rather than taking typed answers, so a Recruiter states a requirement in the same words a
Candidate states a skill, which is what makes the two comparable; a Job's Location is
picked the same way, from the list a Candidate picks theirs from. Each list is small
enough to fetch whole and filter in the browser; nothing is searched server-side, and a
picker shows a language's name while the criteria store its code — the same for a
Location, which reads as its name and is stored as its key.
_Avoid_: Lookups, master data, enums (an enum reaches the portals through the generated
client; these are rows).

**Placeholder vocabulary**:
The `{{ … }}` names a Message template may use — `candidate_name`, `job_title`,
`tenant_name` — which one send fills with this Candidate, this Job and this Tenant. The
backend owns the set and refuses an unfillable name wherever one is written — saving a
template, or sending an edited Applicant message — but it publishes no list of them, so this
portal carries its own copy: the template editor has to name the three in its help text
before a Recruiter can use them, and once the list is here, refusing a bad one beside the
field costs nothing, in the editor and in the draft alike. The draft only refuses; it never
advertises the three, because growing the vocabulary is the editor's business and a resolved
draft has no braces left in it. Unlike Reference data, this is a mirrored constant
rather than rows — if the platform ever adds a placeholder, this copy is the one thing that
does not learn about it, and the API's refusal is the backstop that still lands under the
right field.
_Avoid_: Merge fields, variables, tokens.

**Wrong-portal screen**:
The full-page notice shown when a signed-in Profile this portal does not serve opens it. It
names the account type they are signed in with, and the portal they should be in — a Candidate
is pointed at the Candidate Portal and a Platform admin at the Platform Portal.
_Avoid_: 403 page, forbidden page.
