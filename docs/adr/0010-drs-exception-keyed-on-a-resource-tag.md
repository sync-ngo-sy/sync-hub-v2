# The domain-sharing exception is keyed on a resource tag, not a project override

Domain Restricted Sharing forbids `allUsers`, which Cloud Run needs to serve the public API
anonymously. The exception is expressed inside the organisation policy as a rule conditioned
on the tag `drs-exception=public-cloud-run`, with the Workspace-only rule kept as the
unconditional default. Granting a project the exception is therefore a tag binding.

The obvious alternative — a project-scoped policy that stops enforcing the constraint — was
rejected because `roles/orgpolicy.policyAdmin` is grantable only at organisation scope, so
anything able to apply it holds authority over every constraint in the organisation,
including the key-creation ban that makes federated identity mandatory. Tag bindings need
only `roles/resourcemanager.tagUser`, which is grantable per project.

## Consequences

- The shape of the exception is defined once by a person; adding a project to it is a tag
  binding an automated job can safely hold permission to make.
- The exception is per-project, not per-service, so the projects carrying it should host the
  public API and little else.
