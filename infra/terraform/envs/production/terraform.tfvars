project = "sync-ngo-prod"
region  = "europe-west3"

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

# Digests, not tags. Production promotes the artifact staging validated and never rebuilds: the
# same source rebuilt produces different bytes as base images move underneath the lockfile (#91).
# The placeholders below are replaced by the promotion pipeline, which passes the digest it found
# on the integration commit; a `latest` here would quietly reintroduce the rebuild.
services = {
  api = {
    image              = "europe-west3-docker.pkg.dev/sync-ngo-prod/sync/api@sha256:0000000000000000000000000000000000000000000000000000000000000000"
    service_account    = "runtime@sync-ngo-prod.iam.gserviceaccount.com"
    public             = true
    max_instances      = 6
    container_port     = 8000
    startup_probe_path = "/v1/health/ready"

    env = {
      SYNC_ENVIRONMENT          = "production"
      SYNC_SUPABASE_URL         = "https://skmsobeqyljduzkjmokr.supabase.co"
      SYNC_CORS_ALLOWED_ORIGINS = "https://jobs.sync.ngo,https://app.sync.ngo,https://admin.sync.ngo"
      SYNC_RECRUITER_PORTAL_URL = "https://app.sync.ngo"
      SYNC_ADMIN_PORTAL_URL     = "https://admin.sync.ngo"
      # A subdomain, not the root domain, and this is a mail-safety decision rather than a
      # cosmetic one. Verifying a sender in Resend means DKIM and SPF records; putting them on
      # sync.ngo itself means editing the SPF record that carries the organisation's Workspace
      # mail, which #86 forbids touching. A subdomain gets its own records and cannot affect it.
      # Nothing sends from here until send.sync.ngo is verified — until then this address bounces.
      SYNC_EMAIL_FROM = "Sync <noreply@send.sync.ngo>"
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
    image           = "europe-west3-docker.pkg.dev/sync-ngo-prod/sync/worker@sha256:0000000000000000000000000000000000000000000000000000000000000000"
    service_account = "runtime@sync-ngo-prod.iam.gserviceaccount.com"
    # Public, and not by oversight: the database webhook that announces an enqueue is Postgres
    # calling out, and Postgres cannot mint a Google identity token. X-Worker-Secret is what
    # stands in for IAM, and the endpoints fail closed when it is unset.
    public             = true
    max_instances      = 3
    concurrency        = 40
    request_timeout    = "900s"
    memory             = "1Gi"
    startup_probe_path = "/health"

    env = {
      SYNC_ENVIRONMENT  = "production"
      SYNC_SUPABASE_URL = "https://skmsobeqyljduzkjmokr.supabase.co"
      # The sender is the worker's business, not the API's — see the note above it.
      SYNC_EMAIL_FROM = "Sync <noreply@send.sync.ngo>"
      # Required by Settings, which both services build in full. The worker needs them for real:
      # the emails it sends carry links into the portals. Without them the container exits at
      # import, which is how the first staging revision died.
      SYNC_RECRUITER_PORTAL_URL = "https://app.sync.ngo"
      SYNC_ADMIN_PORTAL_URL     = "https://admin.sync.ngo"
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
  admin-portal = {
    image           = "europe-west3-docker.pkg.dev/sync-ngo-prod/sync/admin-portal@sha256:0000000000000000000000000000000000000000000000000000000000000000"
    service_account = "runtime@sync-ngo-prod.iam.gserviceaccount.com"
    region          = "europe-west1"
    max_instances   = 2
    memory          = "256Mi"
    domain          = "admin.sync.ngo"
    iap             = true
    iap_members     = ["domain:sync.ngo"]
  }
}
