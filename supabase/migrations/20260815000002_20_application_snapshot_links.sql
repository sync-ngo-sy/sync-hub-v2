-- The Links travel with the Application, like every other thing the Candidate was reviewed on.
--
-- Frozen as the addresses they were the day the Application arrived, not as a pointer at the
-- profile: a Candidate who changes their LinkedIn afterwards does not rewrite what a Recruiter
-- read. The same shape the live columns hold, because a Snapshot cannot contain something a
-- profile could not.

alter table application_profile_snapshots
  add column linkedin_url  text,
  add column github_url    text,
  add column portfolio_url text;

alter table application_profile_snapshots
  add constraint asnap_linkedin_url_shape check (
    linkedin_url is null
    or (linkedin_url like 'https://www.linkedin.com/in/%' and length(linkedin_url) <= 2000)
  ),
  add constraint asnap_github_url_shape check (
    github_url is null
    or (github_url like 'https://github.com/%' and length(github_url) <= 2000)
  ),
  add constraint asnap_portfolio_url_shape check (
    portfolio_url is null
    or ((portfolio_url like 'http://%' or portfolio_url like 'https://%')
        and length(portfolio_url) <= 2000)
  );
