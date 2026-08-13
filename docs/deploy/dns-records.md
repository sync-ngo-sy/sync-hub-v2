# DNS records

DNS is the one part of the hosting design that is not infrastructure-as-code (ADR-0016, #86). The
nameservers stay at the existing provider — this was going to be a migration to Cloudflare and no
longer is, because reachability probing found no user-facing reason to move and moving would put
Workspace mail at risk. **No nameserver change. Nothing about mail is touched.**

Because the records are added by hand, they are written down here. A record that exists in the zone
and not in this table is a record nobody will remember the purpose of.

## Hostnames

Four per environment. Flat `-staging` suffixes rather than `*.staging.sync.ngo`, so one level of
wildcard certificate is enough — the second level is not free.

| Hostname | Serves | Hosting target | Record |
| --- | --- | --- | --- |
| `jobs.sync.ngo` | Candidate Portal | Firebase Hosting site `sync-ngo-jobs` | A/AAAA from the Hosting console |
| `app.sync.ngo` | Recruiter Portal | Firebase Hosting site `sync-ngo-app` | A/AAAA from the Hosting console |
| `admin.sync.ngo` | Platform Portal | Cloud Run `admin-portal` (europe-west1, IAP) | CNAME from `tofu output dns_records` |
| `api.sync.ngo` | API | Firebase Hosting site `sync-ngo-api` → Cloud Run `api` | A/AAAA from the Hosting console |
| `jobs-staging.sync.ngo` | Candidate Portal | Firebase Hosting site `sync-ngo-jobs-staging` | A/AAAA from the Hosting console |
| `app-staging.sync.ngo` | Recruiter Portal | Firebase Hosting site `sync-ngo-app-staging` | A/AAAA from the Hosting console |
| `admin-staging.sync.ngo` | Platform Portal | Cloud Run `admin-portal` (europe-west1, IAP) | CNAME from `tofu output dns_records` |
| `api-staging.sync.ngo` | API | Firebase Hosting site `sync-ngo-api-staging` → Cloud Run `api` | A/AAAA from the Hosting console |

Plus one legacy hostname:

| Hostname | Serves | Hosting target | Record |
| --- | --- | --- | --- |
| _(fill in: the old public jobs hostname)_ | 301 to `jobs.sync.ngo` | Firebase Hosting site `sync-ngo-legacy-jobs` | A/AAAA from the Hosting console |

The old hostname resolves today and is publicly reachable, so it redirects rather than disappears —
shared postings, bookmarks and search results all point at it (#90). The stale staging hostname
pointing at unrelated third-party infrastructure is removed from the zone in the same pass.

## Actual values

Read back from the zone on 2026-08-13, so this file and the zone agree. DNS is the one part of the
design outside Terraform, which makes this table the only place the zone is written down.

The eight hostnames, all `CNAME`, all at the registrar:

| Hostname | Type | Value |
| --- | --- | --- |
| `jobs.sync.ngo` | CNAME | `sync-ngo-jobs.web.app.` |
| `app.sync.ngo` | CNAME | `sync-ngo-app.web.app.` |
| `api.sync.ngo` | CNAME | `sync-ngo-api.web.app.` |
| `admin.sync.ngo` | CNAME | `ghs.googlehosted.com.` |
| `jobs-staging.sync.ngo` | CNAME | `sync-ngo-jobs-staging.web.app.` |
| `app-staging.sync.ngo` | CNAME | `sync-ngo-app-staging.web.app.` |
| `api-staging.sync.ngo` | CNAME | `sync-ngo-api-staging.web.app.` |
| `admin-staging.sync.ngo` | CNAME | `ghs.googlehosted.com.` |

Mail, for the platform's own sending. All under `send.sync.ngo` — the root domain's SPF, which
carries Workspace mail, is untouched:

| Hostname | Type | Value |
| --- | --- | --- |
| `send.sync.ngo` | TXT | `v=spf1 include:amazonses.com ~all` |
| `send.sync.ngo` | MX (10) | `feedback-smtp.us-east-1.amazonses.com.` |
| `resend._domainkey.send.sync.ngo` | TXT | the DKIM public key — read it from the sending provider |
| `send.send.sync.ngo` | TXT | `v=spf1 include:amazonses.com ~all` |
| `send.send.sync.ngo` | MX (10) | `feedback-smtp.eu-west-1.amazonses.com.` |

**Two sending regions are present and only one can be current.** `send.sync.ngo` answers with
`us-east-1` and `send.send.sync.ngo` with `eu-west-1`, which is what a domain configured twice
looks like — once in each region. Everything else in this platform is in Europe deliberately, and
outbound mail carries candidate names and addresses, so the US pair is the one to question rather
than the one to keep. Whichever is retired, its records should be removed here and at the
registrar rather than left to be rediscovered. See #86.

## Order of operations

1. The hosting target has to exist first — a Firebase Hosting site or a Cloud Run domain mapping.
   Nothing can point at what has not been created.
2. Attaching a custom domain produces a TXT record for ownership verification. Add it, wait for
   verification, and only then add the A/AAAA or CNAME records.
3. Certificates are issued by Google after the records resolve. Firebase Hosting is usually minutes;
   a Cloud Run mapping is documented as up to 24 hours.
4. Verify from outside the network — not from a machine whose resolver may be caching the old
   answer, and for the public careers site, from a Syrian connection with no VPN (#92).

## Mail

Untouched, deliberately. After any DNS work, verify delivery in both directions before calling the
change done: the whole reason DNS stayed where it is was to avoid risking mail.

The platform's own outbound mail is the one thing that comes close, so it is kept at arm's length.
Production sends as `noreply@send.sync.ngo`, and `send.sync.ngo` gets its own DKIM and SPF records
for the sending provider. The alternative — sending as `@sync.ngo` — means editing the SPF record
that carries Workspace mail, on the root domain, which is exactly the risk this whole design
declined to take. Staging does not send from the domain at all; it uses the provider's sandbox
sender, which needs no records.

| Hostname | Type | Purpose |
| --- | --- | --- |
| `send.sync.ngo` | TXT (SPF), CNAME (DKIM) | Outbound platform mail. Values come from Resend. Root domain untouched. |
