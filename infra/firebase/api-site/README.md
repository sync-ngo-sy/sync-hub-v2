# `api` Hosting site

Deliberately almost empty. Firebase Hosting requires a public directory even for a site whose only
job is a rewrite, and this site's rewrite sends every path to the API's Cloud Run service.

The rewrite is not a preference. Cloud Run custom domain mappings do not exist in `europe-west3`,
and a load balancer's fixed monthly charge is the thing the whole hosting design avoids — so a
Hosting rewrite is the free way for `api.sync.ngo` to reach a service in Frankfurt. ADR-0016.

The consequence to keep in mind: there is now a CDN in front of the API. Firebase Hosting does not
cache a dynamic response that does not ask to be cached, so the default is safe, but an endpoint
that ever sets a caching `Cache-Control` header would be publishing one user's data to the next.
