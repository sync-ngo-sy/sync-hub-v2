# Demo accounts

Every account the local seed creates, and the one password they all share.

Made by `services/api/scripts/seed_demo.py` — see
[the local-dev runbook](./runbook-local-dev.md#5-seed-the-stack-with-demo-data) for how to run it.
The script prints this same list on every run, so it cannot go stale.

These are local fixtures for a stack on your own machine. The seed refuses to run against
anything but a local Supabase, and none of these people exist.

## Password

```text
sync-demo-2026
```

The same for all 17 accounts, on all three portals.

## Platform Portal — `http://127.0.0.1:5175`

| Address            | Who                        |
| ------------------ | -------------------------- |
| `ops@sync.example` | Nour Sabbagh, the operator |

## Recruiter Portal — `http://127.0.0.1:5174`

| Address                                 | Tenant                       | Role                     |
| --------------------------------------- | ---------------------------- | ------------------------ |
| `rana.khalil@northbridge.example`        | Northbridge Talent (pro)     | admin                    |
| `yusuf.nasser@northbridge.example`       | Northbridge Talent           | recruiter                |
| `lina.haddad@northbridge.example`        | Northbridge Talent           | recruiter                |
| `omar.zeid@northbridge.example`          | Northbridge Talent           | recruiter, **deactivated** |
| `maya.sarkis@cedar-health.example`       | Cedar Health Group (free)    | admin                    |
| `tarek.aboud@cedar-health.example`       | Cedar Health Group           | recruiter                |
| `samir.daoud@palmyra-logistics.example`  | Palmyra Logistics (**suspended**) | admin               |

Northbridge is the busy one: seven Jobs, sixteen Applications, campaign links, notes, Tags, a
Talent pool and Message templates. Cedar Health proves tenant isolation — it shares Candidates
with Northbridge and can see none of its records. Palmyra is suspended, so signing in as Samir
is how you reach the "this tenant is suspended" screen.

## Candidate Portal — `http://127.0.0.1:5173`

| Address                     | State worth testing                                         |
| --------------------------- | ----------------------------------------------------------- |
| `amina.haddad@example.com`  | 3 CVs (one soft-deleted), hired once, withdrew once, searchable |
| `bashir.nassar@example.com` | uploaded a `.docx`, holds an offer, disqualified elsewhere   |
| `karim.sabbagh@example.com` | two live shortlists at once                                 |
| `layla.kassem@example.com`  | applied to two different Tenants                            |
| `nadia.rahal@example.com`   | outside Syria (Lebanon); rejected, un-rejected, rejected again |
| `fadi.chalhoub@example.com` | junior, with undated work — the honest route to `review_required` |
| `hiba.othman@example.com`   | **opted out** of Global search, reachable only by her Applications |
| `ziad.merhi@example.com`    | CV parse **failed**: no current CV, cannot apply, unread notification |
| `rami.talhouk@example.com`  | confirmed their address and stopped: no CV, no profile, nothing |

## What the seed does not do

- **Sends nothing to a real address.** The invitations it genuinely does send land in Mailpit
  (`http://127.0.0.1:54324`), like every other local email.
- **Delivers no queued Communication.** Messages older than two days are marked delivered by the
  seed itself, which is why `communications.provider` reads `seed` and never `resend` — no
  provider ever saw them. Four are left queued and one failed, so both paths have a row.
- **Invents no timestamps in place.** Every row is written by the product's own services, which
  stamp `now()` correctly; a second pass moves them into the past so the Dashboard's rolling
  windows have something to measure.
