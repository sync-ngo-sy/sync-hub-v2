from __future__ import annotations

#: Not stack-derived, and has to match `additional_redirect_urls` in supabase/config.toml.
RECRUITER_PORTAL_URL = "http://127.0.0.1:5174"

#: Not stack-derived, and has to match `additional_redirect_urls` in supabase/config.toml.
ADMIN_PORTAL_URL = "http://127.0.0.1:5175"

#: The local Auth `site_url`, used when an auth email carries no explicit redirect.
CANDIDATE_PORTAL_URL = "http://127.0.0.1:5173"
