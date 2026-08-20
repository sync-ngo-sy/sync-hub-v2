# Hosting is Cloud Run and Firebase Hosting, in Frankfurt, with no load balancer

Status: accepted

Two environments — production and staging — each a separate Google Cloud project, each serving
four hostnames: the Candidate Portal, the Recruiter Portal, the Platform Portal, and the API.
Compute is Cloud Run. Static hosting is Firebase Hosting. DNS stays at the registrar it is
already at. No Google load balancer exists anywhere in the design, and that single constraint
explains most of what follows.

Cost figures below are approximations from **August 2026** and are quoted to show the shape of
the reasoning, not as current prices. Re-check them before treating any of them as a fact.

## No load balancer, and therefore Cloud Run

A global external Application Load Balancer charges for its forwarding rule whether or not it
serves a request — roughly $18/month, before traffic. That is a floor under the whole platform's
bill, and this platform's expected traffic does not justify a floor. Everything below is
downstream of refusing it.

Compute is Cloud Run, scaling to zero. Managed Kubernetes was rejected twice over: the control
plane alone runs to roughly $72/month, which dwarfs the entire budget, and nothing in it scales
the worker to zero, so an idle queue would bill for a node continuously. An always-on worker
container was rejected for the same reason — the queue is empty most of the day.

## Static files on Firebase Hosting, and the API's hostname too

The Candidate and Recruiter Portals are static bundles on Firebase Hosting: free tier, CDN,
Google-managed certificates, custom domains, and a configuration file that lives in this
repository rather than in console state. A bucket behind a load balancer was rejected on the
forwarding-rule charge again.

The API's public hostname is also served by Firebase Hosting, rewriting to the Cloud Run service.
The obvious alternative — a Cloud Run custom domain mapping — **does not exist in Frankfurt**:
mappings are offered in ten regions and `europe-west3` is not among them, and Google labels the
feature preview-stage and not production-ready regardless. Firebase Hosting rewrites to Cloud
Run *are* supported in `europe-west3`. So the free path to `api.sync.ngo` is a Hosting rewrite,
and the design gets a CDN in front of the API as a side effect.

That side effect has a cost: every authenticated response must carry cache headers that forbid
storing it. Firebase Hosting does not cache dynamic responses without a `Cache-Control` header
inviting it, so the default is safe — but "safe by default" is not the same as "enforced", and
an endpoint that one day sets a cache header would be publishing one user's data to the next.

## Three portals, one gate, and it is the Platform Portal

There are three applications, not two, and only one of them is ours to lock.

The Platform Portal is staff-only, so it is served from a small static-serving Cloud Run service
with Identity-Aware Proxy enabled, restricted to the `sync.ngo` Workspace domain. IAP now runs
directly on Cloud Run — generally available, no load balancer, no added charge — which is the
only reason this is affordable. It still scales to zero.

IAP on the Recruiter Portal was rejected, and this is the correction that matters most here.
Recruiters are external Tenant users, not Workspace accounts; gating their portal on our domain
would refuse every customer at the door and turn each invite into a manual IAP grant. The
Recruiter Portal is therefore public static hosting like the Candidate Portal, and its authority
boundary is the one it always was: the API's session authentication and row-level security.

Be exact about what the gate buys. The protected hostname serves static files, and nobody
attacks static files. IAP hides the staff sign-in from the internet and removes probing noise,
which is worth having when it is free. It must never become an argument for relaxing anything on
the API, which is where every real check lives.

The gate is on in **both** environments, and serving the Platform Portal from Cloud Run rather
than Firebase Hosting is what makes that possible. An earlier version of this design had staging's
staff portal on Hosting and therefore ungated, recorded as an accepted gap; that gap is gone. A
gate that exists only in production is a gate nobody has ever watched fail, and everyone who tests
staging has a Workspace account already.

## The Platform Portal's service sits in Belgium, and the reason is a cookie

The Platform Portal's Cloud Run service is deployed in `europe-west1`, not `europe-west3` with
everything else. It serves static files, so its region costs nothing in latency, and the chain
that forces the move is worth writing down because it looks arbitrary otherwise:

- Sessions are host-only cookies with `SameSite=Lax`. That works across
  `admin.sync.ngo` → `api.sync.ngo` because they share one registrable domain.
- Served instead from its `run.app` URL, the portal would be cross-*site* to the API —
  `run.app` is a public suffix — and `SameSite=Lax` would not attach the session cookie at all.
  Sign-in would simply not work. So the Platform Portal needs a `sync.ngo` hostname.
- Firebase Hosting cannot supply that hostname here: a Hosting rewrite proxies server-side with
  no user identity and requires the service to accept unauthenticated invocation, which is the
  opposite of an IAP-protected service.
- Which leaves a Cloud Run domain mapping, which exists in `europe-west1` and not in
  `europe-west3`.

The documented fallback, if the preview-stage mapping proves unreliable: move the Platform Portal
onto Firebase Hosting alongside the other two and drop IAP, keeping the no-index directive and
relying on application authentication. That is a smaller loss than it sounds, per the paragraph
above, and it is the same posture staging already runs in.

## Frankfurt, both environments

`europe-west3` and the database's `eu-central-1` are the same city. Traffic from the Levant
transits Europe whatever we do, and the database provider has no Middle East region, so Frankfurt
is the closest available point to the people using this. A US region was rejected on latency for
no compensating benefit. Staging is co-located with production so its latency profile stays a
useful signal rather than a flattering one.

## Two projects, and a scoped policy exception

Two Google Cloud projects are the only hard blast-radius boundary in the design: separate IAM,
separate quotas, separate budgets, and nothing in staging able to authenticate as anything in
production. Deploy identities are per project and per environment.

Serving the API anonymously needs `allUsers` as invoker, which Domain Restricted Sharing forbids.
The exception is a tag binding rather than a blanket removal of the constraint: turning the
constraint off requires organisation-scoped authority over every other constraint, including the
key-creation ban that makes federated identity mandatory.

## Flat staging hostnames

```
production            staging
jobs.sync.ngo         jobs-staging.sync.ngo         Candidate Portal
app.sync.ngo          app-staging.sync.ngo          Recruiter Portal
admin.sync.ngo        admin-staging.sync.ngo        Platform Portal
api.sync.ngo          api-staging.sync.ngo          API
```

Flat suffixes, not nested subdomains like `jobs.staging.sync.ngo`. A wildcard certificate covers
one level for free; covering `*.staging.sync.ngo` as well means a second level, which is not
free. The naming is uglier and cheaper.

Session isolation between the two environments is the host-only cookie and nothing else. Setting
a cookie domain of `.sync.ngo` would send staging's session cookie to production's API — a leak
neither environment's tests would detect — so the API refuses a cookie domain in a deployed
environment by configuration rather than by convention.

## DNS stays where it is

This was going to be a nameserver migration to Cloudflare, with the API proxied through it so
that Cloudflare was the only vendor needing to be reachable from Syria. Reachability probing from
an actual Syrian connection — `scripts/syria-reachability-test.sh`, issue #75 — found that both
vendors' edges answer well from Syrian networks. That removed the user-facing reason to move, and
moving nameservers would have put the organisation's Workspace mail at risk for no measured
benefit. DNS stays at the existing provider, mail is untouched, and records are added by hand and
documented in this repository (#86) because they are the one part of this design not under
infrastructure-as-code.

## Secret values never enter infrastructure state

Terraform creates the `google_secret_manager_secret` container. The version holding the value is
written out of band. State is stored in plaintext in a bucket, and a state file containing the
database password and the service-role key would make that bucket the most sensitive object in
the organisation.

## Recovery

Backups are the database provider's daily snapshots with roughly a week of retention.
Point-in-time recovery was rejected at roughly $100/month, which is the largest single line item
the platform could have and larger than everything else in this design put together. The accepted
worst case is losing about a day of data. Two consequences are standing rules rather than
suggestions: migrations are expand-then-contract, because traffic shifts gradually and the
previous revision keeps serving against the new schema during a rollout; and any migration that
destroys or rewrites data takes a manual backup immediately beforehand (#91).

## Alerting is on the signal that stops arriving

A service that scales to zero has no error rate to watch when it breaks. The worker's normal state
is *not running*, so "the worker is throwing exceptions" is a condition it can reach only by first
being alive — and the failure that actually strands a CV is the schedule that quietly stopped
calling it. Nothing throws. Nothing 500s. The queue simply stops draining.

So the first alert is an absence, not a threshold: **no scheduled drain for 900 seconds**, on a
job that runs every three minutes. Five missed ticks and it fires. That one alert covers the
scheduler being deleted, the worker refusing every caller, the service failing to start, and the
drain hanging — none of which any error-rate alert would see.

The rest are thresholds on things that only happen when something is wrong: a job attempt failed,
jobs were swept back into the queue (a worker died holding one), a drain request was refused, and
the API returned a 5xx.

Uptime checks probe the hostnames from Google's edge rather than from inside the project, because
a service that is healthy and unreachable is still down. `admin` accepts **302**: it is behind
IAP, so a redirect to Google's sign-in is the healthy answer and a 200 would mean the gate had
stopped working.

The dashboard is a single mosaic showing the drain rate against that same 900-second line, so the
alert and the picture cannot disagree about what "healthy" means.

Two things this deliberately does not have. There is no paging: alerts reach a group address, and
nothing wakes anybody, which is honest for a platform with no on-call rota. And there is no
synthetic transaction — nothing signs in and applies for a job on a schedule — so a break that
only shows up mid-flow reaches a user before it reaches us.

## What runs out first

The design scales by autoscaling, and the ceilings are not where they look.

Firebase Hosting absorbs the portals: fingerprinted assets are immutable for a year, so repeat
visits never reach an origin. That is not the constraint at any traffic this platform will see.

The API caps at six instances with Cloud Run's default concurrency of eighty, so roughly **480
concurrent requests**. Registered users are not concurrent users; for a jobs platform, peak
concurrency runs at a low single-digit percentage of the base. Ten thousand accounts is
comfortable.

The real ceiling is the database, and it is compute rather than connections. Six instances at ten
pooled connections each is sixty against a transaction pooler sized for far more. But the instance
behind it is **Micro — two shared vCPU and 1GB** — serving a workload with vector search in it.
That is the first thing to raise, and it is a slider in a dashboard rather than a change here.

Beyond the platform, the parser and the embedder are bounded by the AI provider's rate limits, not
by anything in this design. A burst of uploads queues at OpenAI long before Cloud Run notices. The
schedule guarantees the queue drains eventually; it does not make it fast.

The instance caps are deliberately conservative. Raising them is one line, and doing it before the
database can carry the connections would trade a slow platform for an unavailable one.

## Known unknowns

- **Syrian reachability of Google's edge is measured, not guaranteed.** The probe was one
  network, on one day. Cutover verification has to be repeated from a real Syrian connection
  with no VPN (#92), and #96 tracks whether vendor terms permit serving the country at all.
- **Staging's public portals are internet-reachable**, as they must be, and are defended only by
  application authentication. They carry a no-index directive and are excluded by robots rules,
  which keeps them out of search results but is not a security control.
- **Cloud Run domain mappings are preview-stage**, and the Platform Portal's hostname depends on
  one. The fallback is written above.
- **Firebase Hosting in front of the API has limits we have not hit yet** — request timeout and
  body-size ceilings — and CV upload is the endpoint most likely to find them.
- **First-month spend is an estimate.** #92 records the actual figure against this design's
  reasoning, and this ADR gets corrected if they disagree.

## Consequences

- Four hostnames per environment, eight in total, each needing a verification record and a
  managed certificate (#86) — not the six this design had before the Platform Portal existed.
- The API's CORS allowlist is three origins per environment, named explicitly, never a wildcard.
- Each environment's identity provider needs its own site URL and redirect-URL list covering all
  three portal hostnames; a portal missing from the list silently sends invite and reset emails
  to the wrong place (#85).
- `SYNC_ENVIRONMENT` needs a `staging` value, and the deployed-environment rules — the cookie
  domain ban in particular — apply to it exactly as they do to production.
- Two hosting mechanisms rather than one, and a static-serving container image that exists only
  so that IAP has something to protect.
- Promotion is by image digest and production never rebuilds, because a rebuild from identical
  source produces different bytes as base images move (#91).
