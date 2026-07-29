# `@sync/ui` never fetches, and there is no shared features package

The design system package renders purely from props — it imports neither React Query nor
`@sync/api-client`. Features that appear in both portals (notifications, auth forms) get
their presentational components from `@sync/ui`, while each app duplicates the thin
data-wiring hook. We considered a third `@sync/features` package holding shared
feature logic and rejected it: it would couple the two apps' release cadence and drag
data concerns into shared code, to save duplicating hooks of a few lines whose types the
generated client already guarantees. Components move from an app into `@sync/ui` only
when a second consumer appears. The data-free rule is also what keeps every shared
component renderable in isolation (Storybook-ready) by construction.
