# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## `in progress`

One more label, and it is not a sixth role. The five above answer "who acts next"; this one answers "has anyone started". They are separate questions, so the label composes with them rather than replacing one — an issue is normally `ready-for-agent` **and** `in progress`.

Note the space. The label is `in progress`, not `in-progress`.

Apply it when work has actually begun and stopped short of done, which on a long ticket is most of its life. Remove it when the issue closes, or if the work is abandoned — a stale `in progress` is worse than none, because it reads as someone else's problem.

Partial completion belongs in a comment against the acceptance criteria, not in the label. The label says only that the ticket is not untouched.
