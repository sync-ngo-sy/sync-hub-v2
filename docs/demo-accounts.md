# Demo accounts

Every account the local seed creates, and the one password they all share.

Made by `services/api/scripts/seed_demo.py` — see
[the local-dev runbook](./runbook-local-dev.md#5-seed-the-stack-with-demo-data) for how to run it.
The script prints this same list on every run, so it cannot go stale.

These are fixtures. The seed runs against a local stack or against staging, and refuses
production outright.

The six `@sync.ngo` addresses are real colleagues, chosen so that an invite which escapes reaches
one of us rather than a stranger. Everything else is invented and undeliverable.

## Password

**Generated on every run and printed once, when the seed finishes.** It is not written down here
and never has a fixed value.

It used to be a constant in `cast.py`. That was safe while the seed refused to run anywhere but a
laptop, and stopped being safe the moment it could seed a deployed environment: a password in a
public repository is a live credential on any internet-facing environment it has been used
against. If you missed it, run the seed again -- it is cheaper than recovering one.

The same password for every account, on all three portals.

## Platform Portal — `http://127.0.0.1:5175`

| Address            | Who                        |
| ------------------ | -------------------------- |
| `anton@sync.ngo`   | Anton Najjar, the operator |

## Recruiter Portal — `http://127.0.0.1:5174`

| Address                                 | Tenant                       | Role                     |
| --------------------------------------- | ---------------------------- | ------------------------ |
| `lama@sync.ngo`                          | Northbridge Talent (pro)     | admin                    |
| `kamal@sync.ngo`                         | Northbridge Talent           | recruiter                |
| `lina.haddad@northbridge.example`        | Northbridge Talent           | recruiter                |
| `omar.zeid@northbridge.example`          | Northbridge Talent           | recruiter, **deactivated** |
| `syriatel-recruiter@sync.ngo`            | Syriatel Engineering (free)  | admin                    |
| `tarek.aboud@syriatel-engineering.example` | Syriatel Engineering       | recruiter                |
| `samir.daoud@palmyra-cloud.example`      | Palmyra Cloud (**suspended**) | admin                   |

Northbridge is the busy one: seven Jobs, sixteen Applications, campaign links, notes, Tags, a
Talent pool and Message templates. Syriatel proves tenant isolation — it shares Candidates
with Northbridge and can see none of its records. Palmyra is suspended, so signing in as Samir
is how you reach the "this tenant is suspended" screen.

## Candidate Portal — `http://127.0.0.1:5173`

| Address                     | State worth testing                                         |
| --------------------------- | ----------------------------------------------------------- |
| `abdulqader@sync.ngo`       | 3 CVs (one soft-deleted), hired once, withdrew once, searchable |
| `mowafak@sync.ngo`          | uploaded a `.docx`, holds an offer, disqualified elsewhere   |
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
