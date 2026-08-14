# One screen that answers "is it working right now", in the order you would ask.
#
# The heartbeat first, because a flat line there invalidates everything below it: no drains means
# the queue counters are stale rather than zero, and zero failures means nothing was attempted.
# Charts are stacked in that dependency order rather than grouped by service.

locals {
  heartbeat_metric = "logging.googleapis.com/user/${google_logging_metric.worker_heartbeat.name}"
  failed_metric    = "logging.googleapis.com/user/${google_logging_metric.worker_job_failed.name}"
  swept_metric     = "logging.googleapis.com/user/${google_logging_metric.worker_jobs_swept.name}"
  refused_metric   = "logging.googleapis.com/user/${google_logging_metric.worker_caller_refused.name}"

  dashboard = {
    displayName      = "Sync Hub — ${var.environment}"
    dashboardFilters = []

    mosaicLayout = {
      columns = 12
      tiles = [
        {
          xPos = 0, yPos = 0, width = 12, height = 4
          widget = {
            title = "Worker heartbeat — scheduled runs (flat means nothing below is current)"
            xyChart = {
              chartOptions = { mode = "COLOR" }
              dataSets = [{
                plotType   = "LINE"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"${local.heartbeat_metric}\" resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod    = "300s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
              }]
              thresholds = [{ value = 1, color = "RED", direction = "BELOW", label = "no drain in 5 min" }]
              yAxis      = { label = "runs / 5 min", scale = "LINEAR" }
            }
          }
        },
        {
          xPos = 0, yPos = 4, width = 6, height = 4
          widget = {
            title = "Job failures — every one is a CV or an email that did not happen"
            xyChart = {
              chartOptions = { mode = "COLOR" }
              dataSets = [{
                plotType   = "STACKED_BAR"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"${local.failed_metric}\" resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod    = "900s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
              }]
              yAxis = { label = "failures / 15 min", scale = "LINEAR" }
            }
          }
        },
        {
          xPos = 6, yPos = 4, width = 6, height = 4
          widget = {
            title = "Jobs swept back — an instance died holding one"
            xyChart = {
              chartOptions = { mode = "COLOR" }
              dataSets = [{
                plotType   = "STACKED_BAR"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"${local.swept_metric}\" resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod    = "900s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
              }]
              yAxis = { label = "swept / 15 min", scale = "LINEAR" }
            }
          }
        },
        {
          xPos = 0, yPos = 8, width = 6, height = 4
          widget = {
            title = "API responses by class — 5xx is the only one worth waking for"
            xyChart = {
              chartOptions = { mode = "COLOR" }
              dataSets = [{
                plotType   = "STACKED_AREA"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"api\""
                    aggregation = {
                      alignmentPeriod    = "300s"
                      perSeriesAligner   = "ALIGN_RATE"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["metric.label.\"response_code_class\""]
                    }
                  }
                }
              }]
              yAxis = { label = "requests / s", scale = "LINEAR" }
            }
          }
        },
        {
          xPos = 6, yPos = 8, width = 6, height = 4
          widget = {
            title = "API latency, 95th percentile"
            xyChart = {
              chartOptions = { mode = "COLOR" }
              dataSets = [{
                plotType   = "LINE"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_latencies\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"api\""
                    aggregation = {
                      alignmentPeriod    = "300s"
                      perSeriesAligner   = "ALIGN_PERCENTILE_95"
                      crossSeriesReducer = "REDUCE_MEAN"
                    }
                  }
                }
              }]
              yAxis = { label = "ms", scale = "LINEAR" }
            }
          }
        },
        {
          xPos = 0, yPos = 12, width = 6, height = 4
          widget = {
            title = "Hostnames reachable — a dip here can be a certificate, not the service"
            xyChart = {
              chartOptions = { mode = "COLOR" }
              dataSets = [{
                plotType   = "LINE"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" resource.type=\"uptime_url\""
                    aggregation = {
                      alignmentPeriod    = "300s"
                      perSeriesAligner   = "ALIGN_FRACTION_TRUE"
                      crossSeriesReducer = "REDUCE_MEAN"
                      groupByFields      = ["resource.label.\"host\""]
                    }
                  }
                }
              }]
              yAxis = { label = "fraction passing", scale = "LINEAR" }
            }
          }
        },
        {
          xPos = 6, yPos = 12, width = 6, height = 4
          widget = {
            title = "Callers refused — the drain endpoint is public"
            xyChart = {
              chartOptions = { mode = "COLOR" }
              dataSets = [{
                plotType   = "STACKED_BAR"
                targetAxis = "Y1"
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"${local.refused_metric}\" resource.type=\"cloud_run_revision\""
                    aggregation = {
                      alignmentPeriod    = "600s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
              }]
              yAxis = { label = "refusals / 10 min", scale = "LINEAR" }
            }
          }
        },
      ]
    }
  }
}

resource "google_monitoring_dashboard" "this" {
  project        = var.project
  dashboard_json = jsonencode(local.dashboard)
}
