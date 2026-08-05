# Runbook: bringing an environment up

The order that works, and why each step is where it is. ADR-0012 is the design this executes.

Everything here is Terraform except the steps marked **out of band**, which are out of band for one
reason: they carry secret values, and Terraform state is stored in plaintext.

## 0. Credentials

```bash
gcloud auth login
gcloud auth application-default login
```

Two logins, not one. The `gcs` backend authenticates with application default credentials, which are
separate from the `gcloud` login and expire independently — an expired ADC token is what a `tofu`
command failing with `invalid_grant` on the state bucket actually means.

## 1. Projects, APIs, registry, identities

```bash
cd infra/terraform/projects && tofu init && tofu apply
```

Production is adopted rather than created, so on a fresh state it needs importing first:

```bash
tofu import google_project.production sync-ngo-prod
```

The workload identity pool, its provider, the applier service account and the domain-sharing
exception tag were all created by hand before this configuration existed. They are not in state and
need `terraform import` when the stack that owns them is written — until then, do not let a plan talk
you into recreating them.

## 1a. The domain-sharing exception

The API and the worker are publicly invocable, which Domain Restricted Sharing forbids unless the
project carries the exception tag. Production has carried it since #76; a new environment does not.

```bash
./scripts/attach-drs-exception.sh --check sync-ngo-staging   # guards only, no cloud calls
./scripts/attach-drs-exception.sh sync-ngo-staging
```

The script refuses any project not listed in `infra/org-policies/exception-projects.txt`, in every
mode, so granting the exception means a reviewed commit rather than a command someone ran. If the
`--check` run refuses, that is the gate working: add the project there first.

Skipping this produces a confusing failure much later — the service creates fine and the `allUsers`
invoker binding is refused on its own.

## 2. Secret containers, then secret values — **out of band**

```bash
cd infra/terraform/envs/staging && tofu init && tofu apply
```

The containers come from `secret_ids` in `terraform.tfvars`. The versions holding values do not, and
a service referencing a secret with no version has revisions that fail to start — so write all six
before the first deploy:

```bash
printf '%s' "$VALUE" | gcloud secrets versions add SYNC_DATABASE_URL --project sync-ngo-staging --data-file=-
```

| Secret | Where the value comes from |
| --- | --- |
| `SYNC_DATABASE_URL` | The **transaction pooler** connection string, as `postgresql+asyncpg://…`. Not the direct connection: many short-lived Cloud Run instances against a direct connection is how the connection limit gets exhausted. |
| `SYNC_SUPABASE_SERVICE_ROLE_KEY` | Database project API settings. |
| `SYNC_SUPABASE_ANON_KEY` | Database project API settings. |
| `SYNC_WORKER_SHARED_SECRET` | Generated here: `openssl rand -hex 32`. Shared with the schedule and the database webhook below. |
| `SYNC_RESEND_API_KEY` | Resend. The worker refuses to start without it. |
| `SYNC_OPENAI_API_KEY` | OpenAI. Without it the worker logs parses it cannot do and the API answers 503 on search and assessment. |

## 3. Database

Migrations apply from a standing start, per environment (#85). `scripts/reset-staging-db.sh` replays
them against staging and refuses to run against production.

Then, in each environment's auth settings, set the site URL and the redirect allowlist to that
environment's own hostnames:

- Site URL — the Candidate Portal, which owns the confirmation and reset landing pages.
- Additional redirect URLs — the Recruiter **and** Platform Portals. A portal missing from this list
  does not error; GoTrue silently falls back to the site URL and sends the invite or reset email to
  the wrong portal.

## 4. Images

One build per commit, tagged by commit, pushed to the single registry in the production project.
Staging pulls the identical API and worker image rather than rebuilding it, which is what makes
promotion by digest meaningful later (#91).

```bash
docker build -f services/api/Dockerfile --target api   -t $REGISTRY/api:$SHA    services/api
docker build -f services/api/Dockerfile --target worker -t $REGISTRY/worker:$SHA services/api
```

The portals are the exception: `VITE_*` values are compiled into the bundle, so a portal image or
bundle is per-environment and cannot be promoted.

```bash
docker build -f apps/admin-portal/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api-staging.sync.ngo \
  -t $REGISTRY/admin-portal-staging:$SHA .
```

## 5. Services

```bash
cd infra/terraform/envs/staging
tofu apply -var='images={api="…/api:'$SHA'",worker="…/worker:'$SHA'",admin-portal="…/admin-portal-staging:'$SHA'"}'
```

Three services: the API, the worker, and the Platform Portal's static server. The first two are in
Frankfurt next to the database; the third is in `europe-west1` because it needs a mapped hostname and
mappings do not exist in Frankfurt (ADR-0012).

## 6. Static portals

Hosting sites are created once, by hand, because a site id is globally unique across all of Firebase
and a name collision is not something a pipeline should be resolving:

```bash
npx firebase-tools@latest hosting:sites:create sync-ngo-jobs-staging --project sync-ngo-staging
```

Then deploy per target — `firebase.json` carries the rewrites, headers and the legacy redirect:

```bash
pnpm --filter @sync/candidate-portal build   # with VITE_* set for the environment
npx firebase-tools@latest deploy --only hosting:candidate-staging --project staging
```

## 7. Hostnames

Attach the custom domains and add the records. `docs/deploy/dns-records.md` is the table to fill in;
`tofu output dns_records` prints what the Platform Portal's mapping needs.

## 8. The schedule and the webhook — **out of band**

Both carry `SYNC_WORKER_SHARED_SECRET` in a header, which is why neither is in Terraform.

The schedule is what guarantees nothing is stranded — not the notification. A notification can be
missed; a job that runs every few minutes cannot miss the same row forever.

```bash
gcloud scheduler jobs create http worker-drain \
  --project sync-ngo-staging --location europe-west3 \
  --schedule '*/3 * * * *' \
  --uri "$WORKER_URL/scheduled" --http-method POST \
  --headers "X-Worker-Secret=$SECRET" \
  --attempt-deadline 900s
```

The database webhook on enqueue points at `$WORKER_URL/drain` with the same header. The worker is
publicly invocable precisely because this caller is Postgres, which cannot mint a Google identity
token — the shared secret is what stands in for IAM, and the endpoints answer 503 rather than
running when it is unset.

## 9. Verify

- `GET https://api-staging.sync.ngo/v1/health/ready` answers anonymously.
- The public careers site loads with no sign-in prompt.
- `admin-staging.sync.ngo` prompts for a Workspace account and refuses anything else.
- Upload a CV and watch the worker start within seconds — that is the webhook path.
- Disable the webhook, queue another, and confirm the next scheduled run drains it — that is the
  guarantee the webhook is not.
- Staging responds with `X-Robots-Tag: noindex` and a disallowing `robots.txt`.

## Rolling back

A failed deploy leaves the previous revision serving; Cloud Run does not shift traffic to a revision
that never turned healthy, which is what the startup probes are for. To go back deliberately, point
traffic at the previous revision — no rebuild, and the artifact is still in the registry.

Migrations are the exception, and the rule is expand-then-contract: traffic shifts gradually, so the
previous revision runs against the new schema for the duration of a rollout. A migration that drops
or renames a column breaks production for that window. Anything that destroys or rewrites data takes
a manual backup immediately beforehand — backups are daily with about a week of retention, and
point-in-time recovery was rejected on cost, so the accepted worst case is losing about a day (#91).
