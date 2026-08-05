resource "google_cloud_run_v2_service" "this" {
  name     = var.name
  project  = var.project
  location = var.region
  ingress  = var.ingress

  iap_enabled = var.iap

  deletion_protection = false

  template {
    service_account = var.service_account

    # Both null for the API and the static site, so Cloud Run's defaults stand.
    max_instance_request_concurrency = var.concurrency
    timeout                          = var.request_timeout

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }

      dynamic "ports" {
        for_each = var.container_port == null ? [] : [var.container_port]
        content {
          container_port = ports.value
        }
      }

      dynamic "env" {
        for_each = var.env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      # Cloud Run's default is a TCP connect, which a Python process satisfies before it can
      # answer anything. A path means a revision that cannot reach its dependencies never
      # takes traffic, and the previous one keeps serving.
      dynamic "startup_probe" {
        for_each = var.startup_probe_path == null ? [] : [var.startup_probe_path]
        content {
          # Generous: a cold start builds the database pool and the model clients.
          initial_delay_seconds = 10
          period_seconds        = 5
          timeout_seconds       = 3
          failure_threshold     = 6

          http_get {
            path = startup_probe.value
          }
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  count = var.public ? 1 : 0

  project  = google_cloud_run_v2_service.this.project
  location = google_cloud_run_v2_service.this.location
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# With IAP in front, the request that reaches Cloud Run comes from IAP's own service agent, so
# without this the gate opens onto a 403. It is not the user's identity that needs run.invoker.
resource "google_cloud_run_v2_service_iam_member" "iap_agent" {
  count = var.iap ? 1 : 0

  project  = google_cloud_run_v2_service.this.project
  location = google_cloud_run_v2_service.this.location
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:service-${var.project_number}@gcp-sa-iap.iam.gserviceaccount.com"
}

# Who the gate lets through. In-organisation principals use Google's managed OAuth client, which
# is why no brand or client of our own has to exist.
resource "google_iap_web_cloud_run_service_iam_member" "access" {
  for_each = var.iap ? toset(var.iap_members) : toset([])

  project                = google_cloud_run_v2_service.this.project
  location               = google_cloud_run_v2_service.this.location
  cloud_run_service_name = google_cloud_run_v2_service.this.name
  role                   = "roles/iap.httpsResourceAccessor"
  member                 = each.value
}

# A mapping, not a load balancer: the forwarding-rule charge is the thing ADR-0012 exists to
# avoid. Google issues and renews the certificate. The DNS record it needs is added by hand (#86).
resource "google_cloud_run_domain_mapping" "this" {
  count = var.domain == null ? 0 : 1

  name     = var.domain
  project  = var.project
  location = var.region

  metadata {
    namespace = var.project
  }

  spec {
    route_name = google_cloud_run_v2_service.this.name
  }
}
