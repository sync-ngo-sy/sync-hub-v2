# Runbook: bringing an environment up

The order that works, and why each step is where it is. ADR-0016 is the design this executes.

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

The billing account has no default and is not in the repository, which is public. Supply it here:

```bash
export TF_VAR_billing_account=...   # gcloud billing accounts list
cd infra/terraform/projects && tofu init && tofu apply
```

CI never applies this root -- doing so would hand a deploy token billing and project-creation
authority, which nothing else in this design has. What CI does instead is *notice*: the
`Projects root applied` check plans with `-refresh=false` on every pull request and fails when
this root has changes nobody has run. So a merged change here still does nothing until you run
the command above, but you find out from a red check rather than from a `404` in an unrelated
deploy step (#282).

Production is adopted rather than created, so on a fresh state it needs importing first:

```bash
tofu import google_project.production sync-ngo-prod
```

The workload identity pool, its provider and the applier service account were created by hand
before this configuration existed and have since been imported, so a plan leaves them alone. The
domain-sharing exception tag is still outside Terraform on purpose — see 1a.

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

Targeted, and this is the one step where that matters. The root module holds the three Cloud Run
services as well as the secrets, and their images do not exist until step 4 — an untargeted apply
here creates the containers and then fails on the services, which reads like something is wrong
when nothing is:

```bash
cd infra/terraform/envs/staging && tofu init
tofu apply -target=google_secret_manager_secret.this
```

The containers come from `secret_ids` in `terraform.tfvars`. The versions holding values do not, and
a service referencing a secret with no version has revisions that fail to start — so write all six
before the first deploy:

```bash
printf '%s' "$VALUE" | gcloud secrets versions add SYNC_DATABASE_URL --project sync-ngo-staging --data-file=-
```

| Secret | Where the value comes from |
| --- | --- |
| `SYNC_DATABASE_URL` | The **transaction pooler** connection string with its scheme rewritten to `postgresql+asyncpg://`. Copy it from the dashboard's transaction-pooler entry rather than assembling it — the username is `postgres.<project-ref>`, not `postgres`, and the port is the pooler's. Not the direct connection: many short-lived Cloud Run instances against a direct connection is how the connection limit gets exhausted. Prepared statements are already disabled for this in `sync_core/db.py`, which is what a transaction-mode pooler requires. |
| `SYNC_SUPABASE_SERVICE_ROLE_KEY` | Database project API settings. |
| `SYNC_SUPABASE_ANON_KEY` | Database project API settings. |
| `SYNC_WORKER_SHARED_SECRET` | Generated here: `openssl rand -hex 32`. Read by the enqueue trigger, which needs it in the database Vault too — see 8. The schedule does not use it. |
| `SYNC_RESEND_API_KEY` | Resend. The worker refuses to start without it. |
| `SYNC_OPENAI_API_KEY` | OpenAI. Without it the worker logs parses it cannot do and the API answers 503 on search and assessment. |

## 2a. Repository secrets — **out of band**

Google needs none: the pipeline federates. Supabase has no federated identity, so three repository
secrets exist and reach nothing in Google.

```bash
gh secret set SUPABASE_ACCESS_TOKEN
gh secret set SUPABASE_STAGING_DB_PASSWORD
gh secret set SUPABASE_PRODUCTION_DB_PASSWORD
```

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

## 4a. Domain ownership — **out of band**

The Platform Portal's hostname is a Cloud Run domain mapping, and Google refuses to create one for
a domain the caller has not proved it owns. Check first, because an unverified domain fails the
apply halfway — the service is created and the mapping is not:

```bash
gcloud domains list-user-verified --project sync-ngo-staging
```

Empty output means nothing is verified yet. Verifying is a Search Console step: add the TXT record
it gives you for `sync.ngo` at the registrar, alongside the records in
`docs/deploy/dns-records.md`.

Then the part that is easy to miss: **the identity doing the apply has to be a verified owner**,
not just the person who verified. The pipeline applies as `deployer@…`, so that service account
has to be added as an owner of the verified property in Search Console. Otherwise this works from a
workstation and fails in CI, which is the worst shape a failure can take.

Firebase Hosting's custom domains are unaffected — Hosting does its own verification per site.

## 5. Services

```bash
cd infra/terraform/envs/staging
tofu apply -var='images={api="…/api:'$SHA'",worker="…/worker:'$SHA'",admin-portal="…/admin-portal-staging:'$SHA'"}'
```

Production is not applied by hand. It is promoted by tagging a commit that staging has already
built and deployed:

```bash
git tag v1.0.0 <sha-on-main>   # a commit staging deployed, not one only on a branch
git push origin v1.0.0
```

The tag points at that commit, so the SHA being released is the SHA its images carry — nothing to
reconstruct, and nothing a merge strategy can discard. The `production` environment's required
reviewer is the gate. A rollback is deploying the previous tag.

Three services: the API, the worker, and the Platform Portal's static server. The first two are in
Frankfurt next to the database; the third is in `europe-west1` because it needs a mapped hostname and
mappings do not exist in Frankfurt (ADR-0016).

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

## 8. Telling the worker there is something to do — **out of band**

Both callers are in code now. The schedule is a `google_cloud_scheduler_job` in each environment
root and arrives with step 5, authenticating with an OIDC token (#278). The enqueue notification is
a trigger, and arrives with the migrations in step 3 — not a webhook built in the dashboard, which
writes into a `supabase_functions` schema that exists only once somebody has pressed its button.

What is left out of band is the pair of values the trigger reads, because a migration is committed
and a secret is not. Once per environment, in the database:

```sql
select vault.create_secret('https://<worker-host>/drain',  'worker_drain_url');
select vault.create_secret('<SYNC_WORKER_SHARED_SECRET>',  'worker_shared_secret');
```

Until both exist the trigger does nothing and enqueues still succeed — the schedule collects the
rows on its next pass. That is deliberate: a notification is latency, an insert is a CV.

The worker refuses to serve when neither caller is configured, so a missing secret is a 503 rather
than an open endpoint. An unauthenticated drain is a free way to make our OpenAI calls.

## 8a. The first Platform admin — **out of band**

A migration cannot make one: the auth user and its password belong to the identity provider, not to
the schema. Nor can an endpoint — the first Platform admin has nobody to authorise them. **The seed
is not the answer either; it refuses production outright, by design.**

```bash
cd services/api
SYNC_ENVIRONMENT=production \
SYNC_SUPABASE_URL=https://<ref>.supabase.co \
SYNC_DATABASE_URL="$(gcloud secrets versions access latest --secret=SYNC_DATABASE_URL --project sync-ngo-prod)" \
SYNC_SUPABASE_SERVICE_ROLE_KEY="$(gcloud secrets versions access latest --secret=SYNC_SUPABASE_SERVICE_ROLE_KEY --project sync-ngo-prod)" \
SYNC_SUPABASE_ANON_KEY="$(gcloud secrets versions access latest --secret=SYNC_SUPABASE_ANON_KEY --project sync-ngo-prod)" \
SYNC_RECRUITER_PORTAL_URL=https://app.sync.ngo \
SYNC_ADMIN_PORTAL_URL=https://admin.sync.ngo \
uv run python scripts/create_platform_admin.py --email you@sync.ngo --full-name "Your Name"
```

The password is read from the terminal, never from an argument — arguments are in the history of
every shell that ran them. It must meet the same policy the portals enforce.

Production carries exactly this one account and nothing else. Every other person and tenant arrives
through the product: an access request, converted, which invites its admin.

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
