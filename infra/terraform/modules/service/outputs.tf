output "uri" {
  value = google_cloud_run_v2_service.this.uri
}

output "name" {
  value = google_cloud_run_v2_service.this.name
}

output "dns_records" {
  description = <<-EOT
    What has to be added by hand at the registrar for a mapped hostname, and the reason this is an
    output at all: DNS is the one part of the design outside Terraform (#86).
  EOT
  value       = var.domain == null ? [] : google_cloud_run_domain_mapping.this[0].status[0].resource_records
}
