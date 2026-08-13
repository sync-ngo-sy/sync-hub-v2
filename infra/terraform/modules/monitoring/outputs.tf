output "dashboard_url" {
  description = "Where to look when an alert fires."
  value       = "https://console.cloud.google.com/monitoring/dashboards/builder/${basename(google_monitoring_dashboard.this.id)}?project=${var.project}"
}

output "notification_channel" {
  description = <<-EOT
    Check this is verified after the first apply. Google leaves an unverified email channel in
    place and it silently delivers nothing, which is a poor way for alerting to fail.
  EOT
  value       = google_monitoring_notification_channel.email.id
}
