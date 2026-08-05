# The Platform Portal as a container, which exists for one reason: Identity-Aware Proxy protects
# Cloud Run and cannot protect Firebase Hosting, so the one portal we gate has to be a service.
# The other two are static sites on Hosting. See ADR-0012.
#
# Build context is the repository root, not this directory — the app depends on workspace packages:
#   docker build -f apps/admin-portal/Dockerfile \
#     --build-arg VITE_API_BASE_URL=https://api-staging.sync.ngo .
#
# VITE_* values are compiled into the bundle, so the image is per-environment. That is why the
# portal images are tagged per environment while the API and worker are promoted by digest (#91).

FROM node:24.12.0-slim AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=1
RUN corepack enable
WORKDIR /repo

# Manifests first, so editing a component does not re-resolve the dependency tree.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/admin-portal/package.json apps/admin-portal/
COPY packages/api-client/package.json packages/api-client/
COPY packages/db-types/package.json packages/db-types/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --filter '@sync/admin-portal...'

COPY tsconfig.base.json biome.json turbo.json ./
COPY packages packages
COPY apps/admin-portal apps/admin-portal

ARG VITE_API_BASE_URL
RUN pnpm --filter @sync/admin-portal build


# Non-root and listening on 8080 already, which is what Cloud Run expects.
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
COPY --from=build /repo/apps/admin-portal/dist /usr/share/nginx/html
# The image's entrypoint runs envsubst over templates/, which is how a config gets Cloud Run's
# $PORT. Nothing else in the template is substituted, hence the explicit variable list.
ENV NGINX_ENVSUBST_FILTER=PORT PORT=8080
COPY apps/admin-portal/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 8080
