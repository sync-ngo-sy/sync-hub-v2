project = "sync-ngo-staging"
region  = "europe-west3"

# Every three minutes. This, not the database webhook, is what guarantees nothing is
# stranded -- a notification can be missed, a schedule cannot miss the same row forever.
worker_schedule           = "*/3 * * * *"
scheduler_service_account = "scheduler@sync-ngo-staging.iam.gserviceaccount.com"

# Every one of these needs a version written out of band before the first deploy: a service
# referencing a secret with no version has revisions that fail to start. See infra/terraform/README.md.
secret_ids = [
  "SYNC_DATABASE_URL",
  "SYNC_SUPABASE_SERVICE_ROLE_KEY",
  "SYNC_SUPABASE_ANON_KEY",
  "SYNC_WORKER_SHARED_SECRET",
  "SYNC_RESEND_API_KEY",
  "SYNC_OPENAI_API_KEY",
]

# Tags, not digests: staging deploys whatever the integration branch just built, and the pipeline
# passes the commit-tagged image with -var. Production pins digests instead (#91).
#
# `protect_from_deletion = false` throughout, and only here. The module defaults it on so that
# production cannot be replaced by a plan nobody read; staging is the environment that exists to be
# torn down and rebuilt, so it opts out explicitly rather than inheriting the guard by accident.
services = {
  api = {
    image                 = "europe-west3-docker.pkg.dev/sync-ngo-prod/sync/api:latest"
    service_account       = "runtime@sync-ngo-staging.iam.gserviceaccount.com"
    protect_from_deletion = false
    public                = true
    max_instances         = 4
    # The API hardcodes 8000 and ignores Cloud Run's PORT.
    container_port     = 8000
    startup_probe_path = "/v1/health/ready"

    env = {
      SYNC_ENVIRONMENT  = "staging"
      SYNC_SUPABASE_URL = "https://qjsqmtemyhvtnurohckb.supabase.co"
      # Named explicitly, never a wildcard, and all three portals are needed: each is its own
      # origin and every authenticated request from them is cross-origin (ADR-0005).
      SYNC_CORS_ALLOWED_ORIGINS = "https://jobs-staging.sync.ngo,https://app-staging.sync.ngo,https://admin-staging.sync.ngo"
      SYNC_RECRUITER_PORTAL_URL = "https://app-staging.sync.ngo"
      SYNC_ADMIN_PORTAL_URL     = "https://admin-staging.sync.ngo"
      # Both environments send from send.sync.ngo, because a second verified domain costs money
      # the project does not have. The local part and the display name carry the distinction
      # instead, so a recipient can always tell which environment wrote to them -- which is the
      # failure that actually reaches a person. What sharing a domain does not solve is sending
      # reputation: a staging mistake is spent on production's sender. See #275.
      SYNC_EMAIL_FROM = "Sync Hub Staging <staging@send.sync.ngo>"
    }

    secret_env = {
      SYNC_DATABASE_URL              = "SYNC_DATABASE_URL"
      SYNC_SUPABASE_SERVICE_ROLE_KEY = "SYNC_SUPABASE_SERVICE_ROLE_KEY"
      SYNC_SUPABASE_ANON_KEY         = "SYNC_SUPABASE_ANON_KEY"
      SYNC_OPENAI_API_KEY            = "SYNC_OPENAI_API_KEY"
      SYNC_RESEND_API_KEY            = "SYNC_RESEND_API_KEY"
    }
  }

  worker = {
    image                 = "europe-west3-docker.pkg.dev/sync-ngo-prod/sync/worker:latest"
    service_account       = "runtime@sync-ngo-staging.iam.gserviceaccount.com"
    protect_from_deletion = false
    # Public, and not by oversight: the database webhook that announces an enqueue is Postgres
    # calling out, and Postgres cannot mint a Google identity token. X-Worker-Secret is what
    # stands in for IAM, and the endpoints fail closed when it is unset.
    public = true
    # Two instances, forty requests each: a burst of notifications coalesces instead of fanning
    # out into one instance per event, which is how the database's connection limit gets used up.
    max_instances      = 2
    concurrency        = 40
    request_timeout    = "900s"
    memory             = "1Gi"
    startup_probe_path = "/health"

    env = {
      SYNC_ENVIRONMENT  = "staging"
      SYNC_SUPABASE_URL = "https://qjsqmtemyhvtnurohckb.supabase.co"
      # What the schedule's token has to say for the worker to believe it. Neither is secret:
      # the token is signed by Google and scoped to this audience, so knowing the pair proves
      # nothing without Google's signature. See #278.
      SYNC_WORKER_SCHEDULER_SERVICE_ACCOUNT = "scheduler@sync-ngo-staging.iam.gserviceaccount.com"
      SYNC_WORKER_SCHEDULER_AUDIENCE        = "https://sync-hub-worker/sync-ngo-staging"
      # The sender is the worker's business, not the API's — see the note above it.
      SYNC_EMAIL_FROM = "Sync Hub Staging <staging@send.sync.ngo>"
      # Required by Settings, which both services build in full. The worker needs them for real:
      # the emails it sends carry links into the portals. Without them the container exits at
      # import, which is how the first staging revision died.
      SYNC_RECRUITER_PORTAL_URL = "https://app-staging.sync.ngo"
      SYNC_ADMIN_PORTAL_URL     = "https://admin-staging.sync.ngo"
    }

    secret_env = {
      SYNC_DATABASE_URL              = "SYNC_DATABASE_URL"
      SYNC_SUPABASE_SERVICE_ROLE_KEY = "SYNC_SUPABASE_SERVICE_ROLE_KEY"
      SYNC_SUPABASE_ANON_KEY         = "SYNC_SUPABASE_ANON_KEY"
      SYNC_OPENAI_API_KEY            = "SYNC_OPENAI_API_KEY"
      SYNC_RESEND_API_KEY            = "SYNC_RESEND_API_KEY"
      SYNC_WORKER_SHARED_SECRET      = "SYNC_WORKER_SHARED_SECRET"
    }
  }

  # The Platform Portal: static files, and the only service behind the gate. In europe-west1
  # rather than Frankfurt because it needs a sync.ngo hostname for the session cookie to attach
  # at all, and domain mappings do not exist in europe-west3 — the whole chain is in ADR-0016.
  #
  # Gated in staging too. Serving it from Cloud Run in both environments is what makes that
  # possible — everyone who tests staging has a sync.ngo Workspace account, and a gate that only
  # exists in production is a gate nobody has ever seen fail.
  admin-portal = {
    image                 = "europe-west3-docker.pkg.dev/sync-ngo-prod/sync/admin-portal-staging:latest"
    service_account       = "runtime@sync-ngo-staging.iam.gserviceaccount.com"
    protect_from_deletion = false
    region                = "europe-west1"
    max_instances         = 2
    memory                = "256Mi"
    domain                = "admin-staging.sync.ngo"
    iap                   = true
    iap_members           = ["domain:sync.ngo"]
  }
}
