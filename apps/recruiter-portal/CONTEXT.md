# Recruiter Portal

The tenant-facing web app: publishing Jobs, reviewing Applications, working the tenant
CRM (talent pool, notes, tags), and managing the team. Domain vocabulary (Tenant,
Recruiter, Job, Application, Screening, Tracked link…) is inherited from the
[Database context](../../supabase/CONTEXT.md) and never redefined here.

## Language

**Landing page**:
The public page at the portal's root that explains the platform to companies and offers
contact (WhatsApp, email) and a way to ask for access. It offers no workspace sign-up: Sync Hub is
sold, not self-served, so every call to action points at the Access-request page. One of the two
surfaces where animation is decorative — motion for its own sake — the other being the Candidate
Portal's landing page. Inside the Workspace motion is only ever a thing arriving or leaving and
says which way it went: a deleted Match assessment goes out to the right.
_Avoid_: Home page, marketing site.

**Access-request page**:
The public page at `/request-access` where a visitor leaves their company, their name and their
address, and is told the request was received. The one unauthenticated write this portal makes.
`/signup` is kept as a redirect to it, because that address was published. Creating an account
here is impossible — a Platform admin converts the request, and the founding admin arrives by
invitation.
_Avoid_: Sign-up page, contact form, waitlist.

**Workspace**:
Everything behind the sign-in guard — the Tenant's own Sync Hub, reached through the
sidebar. Routes live under the `_workspace` layout, whose guard is the single place a
Profile is checked before any of its loaders run.
_Avoid_: App, dashboard area, admin.

**Reading**:
Which slice of a list somebody is looking at — the filters, the narrowing and the order, as one
value. `features/applications/reading.ts` holds the Applications Reading and the narrower one a
Job's Applications tab can answer, and both are defined once as a schema the URL is parsed with;
the filter types are inferred from that schema rather than written beside it, so the two cannot
drift. A Reading travels into a detail page's address so a Trail can hand the list back exactly as
it was left, which is the same reason the Candidate record carries its search.
_Avoid_: Query state, filter bag (a Reading is what the reader chose, not how it is stored).

**Address**:
The other direction of a Reading: what it looks like in the URL, with defaults left out so a plain
list has a plain address. `applicationsAddress` and `jobApplicationsAddress` are the only writers,
and their return type names every key of the Reading, so adding a filter to the schema fails the
build until that filter is mapped. That is deliberate — a filter that compiles but never reaches
the address would be a filter that silently forgets itself on reload. Adding one means: the schema,
the Address it fails on, the query that sends it, and the control that sets it.
_Avoid_: Serialise, to-params (name the thing produced, not the act of producing it).

**Origin**:
The place a reader came through to reach a page, carried in that page's address as `from`. An
Application is reachable from the Triage list, a Job and the Dashboard; a Candidate record from
Candidate search, the Talent pool and an Application — so the section that owns an address cannot
say which way the reader came, and the page it opens must be told. Whichever list holds the link
names its own Origin, so no page has to guess. It is a closed vocabulary of places, not a stored
return address: `talent-pool`, `job`, `application.<id>`. Because it lives in the address, a
pasted link retraces what the Recruiter who copied it saw, and an Origin the Workspace does not
recognise is ignored rather than obeyed.
_Avoid_: Referrer, history, back-stack (none of those survive a paste or a refresh).

**Trail**:
The row of crumbs above a page title, built from the Origin rather than written into the page. A
crumb is a claim about the way the reader came, so a page with more than one way in cannot state
one in its own markup; `PageBreadcrumbs` renders what the Origin implies and the trail functions in
`features/shell/origin.ts` decide the shape. Absent an Origin, a Trail falls back to the section
that owns the address, which is what a deep link honestly deserves. A fact that holds however the
reader arrived belongs in the fact grid, not in the Trail.
_Avoid_: Breadcrumb hierarchy, route ancestry (the destinations form a graph, not a tree).

**Dashboard**:
The signed-in Recruiter's home: an overview of the Tenant's hiring activity. One
destination inside the Workspace, not a name for the Workspace itself. Every number on it is the
platform's own answer, read whole from the tenant stats endpoint — the page counts nothing, and
so has nothing to qualify. Three reads carry four panels: the stat cards and the Sources chart
share the counts, the recent Applications and the Jobs overview have their own. Each panel is an
Independent widget, so one refusal is spoken by the panel it leaves blank, in that panel, with
that panel's own Retry. Each of its four stats is a Dashboard deep-link.
_Avoid_: Home, overview page.

**Source**:
A named channel Job views arrived through, and the Applications those views turned into. Every
surface that reports one — the Dashboard card, a Job's Tracked links tab, the Tracked links page —
says views, Applications and the rate between them, because a channel that delivers crowds and no
applicants is the thing worth knowing and a view count alone hides it. Ranking stays on views: a
link with two views and one Application would otherwise lead the card on a rate made of noise. On
the Dashboard it is tenant-wide: equal Tracked-link
names are added across Jobs. On a Job's Tracked links tab it belongs to that Job and each link stays
distinct. `Direct` is the Source for visitors who reached a Job with no link at all; the Dashboard
omits it at zero views, while a Job report keeps it visible at zero so every share is explicit.
The Dashboard card ranks Sources and shows the six that fit, saying in its own
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
other. Pipeline tabs are its primary navigation and Screening remains a secondary filter; both
live in the address bar, so a reload keeps them and a pasted link reproduces the list it was copied
from. Each one counts through the other: the numbers beside a verdict describe the Job as the
selected Pipeline tab leaves it, and the other way round. The list is paged by cursor and never
sorted in the browser: the API decides the order.
_Avoid_: Applicants list, candidate list (a Candidate is a person; a row here is an Application).

**Pipeline tabs**:
An Applications list's primary navigation through the Pipeline: `All` followed by each of the
eight statuses in Pipeline order. Each tab carries the API's count as the other filters leave it;
the count is Tenant-wide on the Applications page and scoped to one Job on a Triage list. One
status may be viewed at a time; `All` includes terminal Applications as well as active ones and
leaves Pipeline out of the address bar. A selected status is written into the address bar, so
Dashboard deep-links and shared views land on the same tab and list.
_Avoid_: Status filter, pipeline picker, stage filter.

**Verdict filter**:
The Screening filter over a list of Applications: a checkbox dropdown over all four verdicts, any
combination of which narrows the list, summarised on the trigger, written into the address bar as
an array, each verdict carrying
how many Applications it decided that way, and the last checked one impossible to uncheck. An
untouched list checks all four. On the Triage list the counts are the Job's as the selected
Pipeline tab leaves it; on both Applications lists it sits below the Pipeline tabs as a
right-aligned secondary filter. Its counts are the Job's on a Triage list and the whole Tenant's
on the Applications page, as the selected tab and any other filters leave them.
_Avoid_: Qualification filter, screening dropdown, verdict picker.

**Applications page**:
The Workspace destination that lists every Application the Tenant has received, across every Job,
newest first — the one place a Recruiter sees everything, where a Triage list sees one Job. It
renders through the same table as the Triage list, with Pipeline tabs in the header and Screening
kept as a secondary filter. It adds the two things a list spanning Jobs needs: a Job column, whose
link leads to the Job rather than to the Application its row is, and the Time-range filter. A
verdict is reached against the Job that asked for those skills, so the Job column is what a reader
checks one against here — the filter answers "who passed screening anywhere", which is the question
the Dashboard's own count asks. The Received column turns around on a click, which is the two orders
the API offers; every filter and the order live in the address bar, so a reload keeps the view and a
pasted link reproduces it — which is what lets the Dashboard's numbers lead here. Paged by cursor
and never sorted in the browser, like every other list the API orders.
_Avoid_: All applications, inbox, applicants page (a Candidate is a person; a row here is an
Application).

**Time-range filter**:
The Applications page's picker of how far back the list reaches — the last 24 hours, 7 days or 30
days, or All time, which is what an untouched page shows and the one choice the address bar leaves
unwritten. It is labelled `Received` on the page, after the column it narrows rather than after the
kind of thing it is, and each choice is named for the hours it counts rather than for a calendar
word. The windows are rolling, the way the Dashboard's own counts are: a Tenant has no timezone, so
a calendar day would have to be computed in one, and the wrong one turns a Recruiter's morning into
yesterday — which is also why the choices do not say "today" or "this month" over a window that
reaches into yesterday or into last month. `Last 7 days` is the same 168 hours the Dashboard counts
as "Applications this week", which is what lets that number and this list be the same Applications.
The API narrows on the window, and both the Pipeline tabs' and the Verdict filter's counts narrow
with it, so the numbers beside either describe the window on screen.
_Avoid_: Date filter, period picker, since (a calendar range is exactly what this is not); Today,
This week, This month as choice labels (they claim a boundary a rolling window does not have).

**Dashboard deep-link**:
A stat on the Dashboard that is a link to the evidence behind it, and every one of the four is one.
Awaiting review leads to the Applications page's New tab, because New is what that stat
counts; Applications this week leads to the week's window on the All tab, because the stat counts
what arrived, Rejected and Withdrawn included. Qualified by screening leads to the Qualified
verdict on the All tab for the same reason: Screening judged the Application before anybody moved
it, so a verdict outlives the rejection that may have followed it. Open jobs is the one that leaves
the Applications page entirely, for the Jobs page on its Published tab. The rule each of them keeps
is that the list it opens counts what the stat says: a link landing on a different number would be
worse than no link, which is why a stat gets its link only once the page it leads to can be narrowed
to exactly what it counted. Every filter is in the URL, so what the link opens is also what a
Recruiter can paste to somebody else.
_Avoid_: Drill-down, stat link (name what it does for the reader, not the mechanism).

**Application review**:
The page one Application is read on, reached from the Triage list, a Job, the Dashboard or from its
own address — headed by an ordinary page header that names the applicant and holds the actions,
nothing more. Who they are is read below it, in this portal's Candidate Card leading the reading
column where the Pipeline used to start: the card integrates the Candidate's live avatar with the
Snapshot name, headline, Canonical role, contact details and Links, and the page hands it the Job
applied for, Location, experience and dates as its facts. The Links are the Snapshot's, frozen
with everything else it holds: an address changed after applying does not rewrite what was read.
Facts live with the person they are true of, in one place, rather than being split between a
header and a card.
The Job is a fact rather than a Trail crumb because it is true of the Application however
the reader arrived, while a crumb is only true of the way they came. The header marks the
live/frozen distinction with a quiet `Snapshot` badge, beside the name it qualifies. The confirmed
email and avatar are the two live facts because neither can be frozen with an Application. `Open
CV` and `Live candidate profile` are distinct bordered actions in the header; the CV's link is
short-lived and never stored, so the page re-reads the Application rather than holding on to it.
`Live candidate profile` names this Application as the Origin it hands on, so the Candidate record
can lead back to the reading it was opened from.

The Pipeline spans the page beneath the identity band, combining the current status, allowed moves
and the six-step progress line in one card. There is no static warning beneath it: move outcomes
already say the Candidate was notified, while a refused move still explains itself inside the
Pipeline. A Hire claim reads there too — the day it names, and whether the Candidate has
confirmed it — so an unconfirmed claim is visible rather than silently uncounted. The current
segment keeps strong contrast in either theme and a small static dot beside `now` carries the
accent colour. Screening and Tags lead the two-column review below; the Snapshot,
answers, Match
assessments and notes follow on the wider reading side, while the Applicant message and history
follow Tags on the action side.
_Avoid_: Application detail, candidate page, applicant profile.

**Pipeline move**:
One named action on the Application review, offered only where the platform allows it from
where the Application stands — so the buttons on screen are the moves that exist, and the
current status sits above the action row. Adjacent backward and onward moves remain centred while
`More moves` sits at the right edge. A move forward or back is named
for its stage, a decision for the decision ("Mark as hired", "Reject"). A move says in its outcome
toast whether the candidate was told, which is not every move: they read a Stage, not a status, so
a move inside one Stage reaches nobody, and only a move that changes the Stage notifies. A
rejection also emails them. `Mark as hired` is the one move that asks something first: it opens a
dialog for the day the work started, because a hire is a claim about a particular day and the
Candidate is asked to confirm that day. A refusal of that move stays inside the dialog that asked;
every other refusal reports on the Pipeline card. Each move carries one
icon: a left arrow for a backward move, a right arrow for an onward move, and a rejection mark for
Reject. The compact actions wrap at the edge of the card. Only the adjacent move back and the
adjacent move onward are primary buttons;
non-adjacent jumps and rejection live under `More moves`, so the common path reads immediately
without removing deliberate shortcuts. Reject takes the destructive colour inside that menu,
because it is the one move a Recruiter would regret making by accident.
Withdrawing is never offered: that is the Candidate's alone.
_Avoid_: Stage number, pipeline position, progress percentage.
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
explanation, the strengths and the gaps — written for every Application as it arrives, asked for
again whenever a Recruiter doubts one, and read on the Application review, newest first. Advice, and the page says so: it carries no Status Mark and no colour, because the
surface already has a Screening verdict and a second marked state would read as a second verdict.
The percentage is spelled out as what it measures rather than shown bare. Asking again appends rather
than replaces, so every past reading stays with the model and prompt version that wrote it, and
the wait is shown as a wait — the model is slow, nothing is put in the list optimistically, and
the finished reading arrives only when the API has it. A refusal (asked too often, the model
failed, no model configured) lands beside the button in the server's own words.
A reading is thrown away one at a time and nothing is asked first — a stale reading is not a
decision, and the Recruiter can always ask for another. The one going leaves to the right while
the API is told, so the list is seen shortening rather than found shorter; the readings left
behind are untouched, each still with the model and prompt version that wrote it. A refusal lands
beside the reading it could not delete, in the server's own words, and that reading stays.
_Avoid_: AI score, rating, fit verdict (a verdict is Screening's).

**Match score**:
The Current assessment's percentage, used to sort Applications while keeping its explanation
available to the Recruiter. It never changes or reorders a Screening verdict, which remains the
only result that refuses anybody. On a list it is plain text rather than a Status Mark, for the
same reason the reading on the review page carries no colour: the row already shows a verdict,
and a second marked state beside it would read as a second one. Pointing at the number or tabbing
to it opens what the model said — both, because a Recruiter working the list by keyboard is not a
worse-served Recruiter — and the whole reading stays on the Application review, which is where a
touch screen reads it. An Application nobody has read yet says so in words rather than showing a
zero, and sorts below every one that has been read: last when the best come first, first when the
weakest do, since an absence belongs beside the weakest readings rather than hidden past them.
Asking for the column sorts it best-first, which is the only direction a fresh score column reads.
_Avoid_: Rank, fit, rating, AI verdict.

**Placement**:
A hire this Tenant claimed and the Candidate confirmed. Marking an Application hired asks for the
day it starts; until the Candidate answers, the hire remains unconfirmed and is not a Placement.
_Avoid_: Hire, filled, closed won.

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

**Job wizard**:
The Workspace destination where a Job is written, a page of its own rather than a dialog, walked in
three steps: Details, Screening, Review. The step lives in the URL like every other view here, so a
reload lands where the Recruiter was. Nothing reaches the backend until the Review step's Publish or
Save as draft, so a wizard walked away from leaves no half-made Job behind; what was typed is held
in the browser instead and comes back after a refresh, whether or not it is finished enough to be
valid. A Recruiter cannot stand on a step whose earlier steps are unfinished — asking for one, by
button or by link, lands on the first step still wanting an answer. Screening criteria and
application questions are entered here, not afterwards, and are saved by the same press that
creates the Job; the Tracked links tab stays a post-creation surface, since a link needs a Job to
point at.
_Avoid_: Create-job modal, new-job form, job builder.

**Tracked links tab**:
The Job's third tab, where a Recruiter mints a named link for a channel, copies its address,
renames it, turns it off, and reads what each one brought. Minting hands the address straight back
to copy, because a link nobody can share is worth nothing. A link that is off keeps its row and its
count: turning it off ends the traffic, not the history — and so a rename leaves both the address
and the views alone. Each row also carries its share of the Job's whole total, so a link is read
against everything the Job drew rather than against the other links; a Job nobody has read yet
shows a dash rather than a percentage of nothing. The comparison is a bar chart of views per
Source on the teal chart ramp, loaded in a chunk of its own so the charting library only travels
for a Recruiter who opens this tab. Its API report reads the link counts, `Direct`, and the Job total
together; the portal does not subtract independently cached reads. Whole percentages are allocated
across every Source so they total 100, with `Direct` present even when its share is zero. The address is built on
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
than having to remember it. An address that already has a Sync Hub account is refused, and the refusal
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

**Tag list**:
The Tenant's Tags on one thing, read rather than changed, where a row has one line to say them in.
The first two show; the rest collapse behind a count that opens a card on hover, on focus, and on
a click — hover alone would hide them from a keyboard and from a touch screen, and a row that grew
to fit a long list would cost every other row its scannability. Opening the card is not a click on
the row it sits in, so reading who somebody is filed under never navigates away from the list.
_Avoid_: Chips, pills (a soft pill is the Tag picker's removable one; this list removes nothing).

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
One person as this Tenant knows them: their whole profile with their email, phone and Links, the
fragment that matched if a search led here, the Tenant's notes and Tags on them, and whether they
are in the Talent pool. The Links here are the live ones; the Application review shows the ones
frozen with that Application. The
profile is read by id from the directory, so how you arrived changes nothing about who you see
— a pasted link shows the same person a click from the Talent pool does, and the Origin changes
only the Trail that leads back. Opened from an Application, the Trail names this page the
live profile instead of repeating the Candidate's name, which is the same live/frozen distinction
the `Snapshot` badge makes on the other page. Search is
read only to recover the matched fragment named in the URL; it never reconstructs or replaces the
by-id record. This also lets a cold shared link show its evidence. When the directory
answers that no Candidate this Tenant can reach has that id, the page says exactly that rather than
inventing a profile. The full profile is the shared component that renders the professional
sections. `CandidatePageHeader` is the shell above it on both this page and the Application review:
a Trail, the name, and whatever actions the page offers. This portal's own Candidate Card then
leads the reading column on both, each page handing it its own facts. The card is this portal's
and not the Design System's: a Recruiter reads a candidate to judge them, a Candidate reads
themselves to correct themselves, and one component serving both meant neither could move. The
card renders the Links itself, so no page here can show a person without them. Only the
Application review carries the `Snapshot` badge.
The notes and the Tags are the Application review's own interactions, naming a Candidate instead of
an Application; a Tag offered here is candidate-scoped, which is the other half of the same
vocabulary.
_Avoid_: Candidate detail (a Profile is the Candidate's own; this is the Tenant's reading of it).

**Candidate Card**:
The one block that says who a Candidate is — avatar, name, Canonical role, headline, the two ways
to reach them, and the Links. It leads the reading column on the Application review and on the
Candidate view, and this portal owns it: the Candidate Portal owns its own, because a Recruiter
reads a candidate to judge them and a Candidate reads themselves to correct themselves. It owns
the name heading, at level two, because a page header already names the person above it. Email,
phone and the Links are the card's own, rendered from the profile it is given rather than passed
in as facts, so no page here can show a person and leave one out. Everything else is a fact the
page supplies, because what is worth saying differs by page — the Application review names the
Job and the dates it moved, the Candidate view names the Location and the experience. Facts sit
under a hairline rule with no fill of their own, so the card never reads as a box inside a box.
It holds no actions: anything a reader can do to a Candidate belongs to the page header, not to
the block that describes them.
_Avoid_: Profile header, summary card, identity band.

**Full profile**:
The portal value that puts a live Candidate record and a frozen Application Snapshot into the
same rendering shape. `FullProfile` is rendered by `CandidateProfile`; the conversion functions
are the boundary that keeps live and frozen source fields out of the shared components.

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
The saved Candidates as a list rather than as an answer about one of them — paged by cursor the
way the API pages it, because a page is what the list shows and only the membership question ever
needs the pool whole. The two readings are two cache entries of one endpoint, so a save or a drop
made anywhere re-reads both, the copy nobody is watching included: that copy is what a route loader
reads next, and it hands back what it has rather than waiting. A row says who the person is today:
their photo, their headline, the Canonical role they put themselves under, their whole years of
work, where they are, and the Tenant's own Tags on them. Only the day they were saved is history.
Nothing on a row is worked out in the browser — a fact the API does not send is not shown, and a
fact it sends as null reads as a dash rather than as a guess.
_Avoid_: Saved list, shortlist page.

**Narrowing and ordering the pool**:
A pool that has grown is worked by two controls, and both are answered by the API rather than by
sieving a page in the browser — the list is paged, so a browser could only ever narrow or reorder
the rows that happen to have arrived. The search box matches words against names and headlines and
never reaches outside the pool; the Candidate and Saved columns each turn around on a click, which
is the four orders the API offers. Both live in the address, and the default of either — no words,
most recently saved first — is written as silence, so a plain `/talent-pool` and a shared link mean
the same page. Each narrowing is a cache entry of its own, which is why a drop re-reads rather than
patches: the row has to leave every reading, not only the one on screen. A search that reaches
nobody says so in the words that were searched for and offers the whole pool back, which is a
different dead end from a pool with nobody in it, and says so.
_Avoid_: Filters (the pool takes words, not the Candidates page's yes-or-no facts).

**Talent pool row actions**:
A row opens the Candidate view, which reads the person by id like every other way in.
Dropping asks first here although the Talent pool card does not: the action is one line in a row
menu rather than a button that has just told you the state. What it costs is what the asking says —
the Tenant's notes and Tags on them survive, but nothing points at that Candidate any more until a
search finds them again, which is the sense in which a drop is reversible rather than destructive.
The empty pool points at candidate search, since search is the only way to fill it.
_Avoid_: Row menu, kebab (name what it does, not what it looks like).

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
