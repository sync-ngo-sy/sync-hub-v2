# Every failure this system has actually had was silent.
#
# A trigger that never fired looked exactly like one that worked, because the handler fails soft.
# Five CVs died of an expired OpenAI balance and sat there for two days. Production ran without a
# drain schedule at all and served every request correctly the whole time.
#
# None of those raise an error rate. So the first alert here watches for *absence* -- the signal
# that stops arriving -- and the rest count events that should be rare rather than measuring a
# rate that should be low.

resource "google_monitoring_notification_channel" "email" {
  project      = var.project
  display_name = "Sync alerts (${var.environment})"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }
}

# `/scheduled` runs on every tick whether or not there is work; `/drain` only runs when something
# was enqueued. Only the first is a heartbeat -- watching the second would report an idle system
# as a dead one.
resource "google_logging_metric" "worker_heartbeat" {
  project = var.project
  name    = "worker_heartbeat"
  filter  = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name="worker"
    jsonPayload.event="worker.scheduled"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_logging_metric" "worker_job_failed" {
  project = var.project
  name    = "worker_job_failed"
  filter  = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name="worker"
    jsonPayload.event="worker.job_failed"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

resource "google_logging_metric" "worker_jobs_swept" {
  project = var.project
  name    = "worker_jobs_swept"
  filter  = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name="worker"
    jsonPayload.event="worker.jobs_swept"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

# The drain endpoint is publicly invocable, so a rejected caller is somebody who found it.
resource "google_logging_metric" "worker_caller_refused" {
  project = var.project
  name    = "worker_caller_refused"
  filter  = <<-EOT
    resource.type="cloud_run_revision"
    resource.labels.service_name="worker"
    (jsonPayload.event="worker.token_rejected" OR jsonPayload.event="worker.no_caller_configured")
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
  }
}

# The one that matters. An absence condition only fires for a series that has reported before, so
# this depends on the schedule having run at least once -- which it has, every 3 minutes, since
# the environment came up.
resource "google_monitoring_alert_policy" "worker_silent" {
  project      = var.project
  display_name = "[${var.environment}] Worker has stopped running"
  combiner     = "OR"

  conditions {
    display_name = "No scheduled drain for ${var.worker_silent_after_seconds}s"

    condition_absent {
      filter   = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.worker_heartbeat.name}\" AND resource.type=\"cloud_run_revision\""
      duration = "${var.worker_silent_after_seconds}s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  documentation {
    content   = <<-EOT
      Nothing has called the worker's `/scheduled` endpoint for ${var.worker_silent_after_seconds} seconds.

      Uploads are not lost -- they queue -- but nothing is parsing CVs, building embeddings or
      sending email, and no other alert will tell you, because a queue that stops draining raises
      no errors.

      Look at, in order: the Cloud Scheduler job still exists and is ENABLED; its last attempt
      succeeded rather than 403-ing; the worker's latest revision started; the `scheduler` service
      account can still mint an OIDC token the worker accepts.
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
  depends_on            = [google_logging_metric.worker_heartbeat]
}

resource "google_monitoring_alert_policy" "worker_job_failed" {
  project      = var.project
  display_name = "[${var.environment}] Background jobs are failing"
  combiner     = "OR"

  conditions {
    display_name = "A job attempt failed"

    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.worker_job_failed.name}\" AND resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"

      aggregations {
        alignment_period   = "900s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  documentation {
    content   = <<-EOT
      At least one job attempt failed in the last 15 minutes.

      This fires on the *first* failure rather than on a rate, because the failure that matters
      is not noisy: an expired vendor balance kills every CV parse identically and quietly.

      Ingestion gives up after three attempts and stays `failed` forever -- re-embedding does not,
      it retries indefinitely. So a burst here means CV parses need requeueing by hand once the
      cause is fixed. See issue #310.
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}

resource "google_monitoring_alert_policy" "worker_jobs_swept" {
  project      = var.project
  display_name = "[${var.environment}] A worker died holding a job"
  combiner     = "OR"

  conditions {
    display_name = "Jobs were swept back into the queue"

    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.worker_jobs_swept.name}\" AND resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"

      aggregations {
        alignment_period   = "900s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  documentation {
    content   = <<-EOT
      A job was claimed, the worker holding it stopped responding, and the sweeper returned it to
      the queue.

      The work is not lost -- that is what the sweep is for. It is worth knowing because it means
      an instance died mid-job: an OOM, a timeout longer than the request deadline, or a revision
      replaced while working. Rare on a healthy system; repeated means something is killing the
      worker.
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}

resource "google_monitoring_alert_policy" "worker_caller_refused" {
  project      = var.project
  display_name = "[${var.environment}] Worker refused a caller"
  combiner     = "OR"

  conditions {
    display_name = "A drain request was rejected"

    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.worker_caller_refused.name}\" AND resource.type=\"cloud_run_revision\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"

      aggregations {
        alignment_period   = "600s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  documentation {
    content   = <<-EOT
      Something called the worker and was turned away.

      Two very different causes share this alert. `worker.token_rejected` means a caller presented
      a credential the worker would not accept -- our own scheduler after a key or audience
      change, or somebody who found a public endpoint. `worker.no_caller_configured` means the
      worker started with neither an OIDC audience nor a shared secret and is refusing everything;
      that one is a misconfiguration and nothing will drain until it is fixed.

      Check the log entry itself -- the event name separates them.
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}

resource "google_monitoring_alert_policy" "api_server_errors" {
  project      = var.project
  display_name = "[${var.environment}] API is returning 5xx"
  combiner     = "OR"

  conditions {
    display_name = "5xx responses from the API"

    condition_threshold {
      filter          = <<-EOT
        metric.type="run.googleapis.com/request_count"
        resource.type="cloud_run_revision"
        resource.label."service_name"="api"
        metric.label."response_code_class"="5xx"
      EOT
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "300s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }

  documentation {
    content   = <<-EOT
      More than five server errors in five minutes.

      A threshold rather than any-error, because a single 5xx is a bad request hitting an
      unhandled path and a sustained stream is the database, a secret, or a bad revision.
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}

resource "google_monitoring_uptime_check_config" "this" {
  for_each = var.uptime_targets

  project      = var.project
  display_name = "[${var.environment}] ${each.value.host}"
  timeout      = "10s"
  period       = "300s"

  http_check {
    path           = each.value.path
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"

    accepted_response_status_codes {
      status_value = each.value.accepted_status
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project
      host       = each.value.host
    }
  }
}

# `validate_ssl` above is half the value of these checks: a managed certificate that fails to
# renew takes a hostname down without any request ever reaching our code, so nothing else here
# would notice.
resource "google_monitoring_alert_policy" "uptime" {
  for_each = var.uptime_targets

  project      = var.project
  display_name = "[${var.environment}] ${each.value.host} is unreachable"
  combiner     = "OR"

  conditions {
    display_name = "Uptime check failing"

    condition_threshold {
      filter          = <<-EOT
        metric.type="monitoring.googleapis.com/uptime_check/check_passed"
        resource.type="uptime_url"
        metric.label."check_id"="${google_monitoring_uptime_check_config.this[each.key].uptime_check_id}"
      EOT
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "600s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_TRUE"
        group_by_fields      = ["resource.label.host"]
      }

      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = <<-EOT
      `${each.value.host}` has failed its check from every probe location for ten minutes.

      Checked from several regions, so a single failing location does not page anyone. All of them
      failing is DNS, an expired or unrenewed certificate, or the service being genuinely down.

      A `302` is healthy for the Platform Portal -- that is IAP sending the visitor to Google.
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}
