output "project_numbers" {
  value = {
    production = google_project.production.number
    staging    = google_project.staging.number
  }
}

output "deployer_service_accounts" {
  value = { for env, sa in google_service_account.deployer : env => sa.email }
}

output "runtime_service_accounts" {
  value = { for env, sa in google_service_account.runtime : env => sa.email }
}

output "builder_service_account" {
  value = google_service_account.builder.email
}

output "registry" {
  value = "${var.region}-docker.pkg.dev/${google_project.production.project_id}/${google_artifact_registry_repository.images.repository_id}"
}
