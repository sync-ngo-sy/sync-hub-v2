terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.42"
    }
  }

  backend "gcs" {
    bucket = "sync-ngo-tfstate"
    prefix = "projects"
  }
}

provider "google" {
  region = var.region
  # No default project: this root creates projects rather than living inside one. The
  # billing budget and quota calls need somewhere to bill API usage, hence the explicit
  # quota project.
  billing_project       = var.production_project
  user_project_override = true
}
