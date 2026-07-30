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
    prefix = "envs/staging"
  }
}
