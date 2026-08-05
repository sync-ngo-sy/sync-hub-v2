# DNS records

DNS is the one part of the hosting design that is not infrastructure-as-code (ADR-0012, #86). The
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

Fill these in as each domain is attached, so the zone can be reconstructed from this file.

| Hostname | Type | Value | Added |
| --- | --- | --- | --- |
| | | | |

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
