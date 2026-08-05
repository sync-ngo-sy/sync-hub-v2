# `legacy` Hosting site

Serves nothing. Every path is a 301 to the same path on `jobs.sync.ngo`, and the only reason this
site exists is to have somewhere to attach the old public jobs hostname (#90).

The old hostname resolves today and is publicly reachable, so anything pointing at it — a shared
job posting, a bookmark, a search result — breaks if it simply stops answering. That cannot be
fixed retroactively once the links have rotted, which is why a redirect nobody will ever look at
is worth a committed configuration file.

Attaching the hostname is a custom-domain step on this site plus a DNS record; both are in
`docs/deploy/dns-records.md`, which is also where the hostname itself is written down.
