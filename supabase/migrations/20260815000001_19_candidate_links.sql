-- The three professional addresses a Candidate may claim. Three columns rather than a list,
-- because each answers a different question a Recruiter asks and a list would have to carry
-- what every entry is.
--
-- Stored in the single form the API normalises them to, which is what the CHECKs hold: a handle
-- that never became an address is not something a card can render as a link, and a scheme a
-- browser will not open is not something the platform should put behind one.

alter table candidates
  add column linkedin_url  text,
  add column github_url    text,
  add column portfolio_url text;

alter table candidates
  add constraint candidates_linkedin_url_shape check (
    linkedin_url is null
    or (linkedin_url like 'https://www.linkedin.com/in/%' and length(linkedin_url) <= 2000)
  ),
  add constraint candidates_github_url_shape check (
    github_url is null
    or (github_url like 'https://github.com/%' and length(github_url) <= 2000)
  ),
  add constraint candidates_portfolio_url_shape check (
    portfolio_url is null
    or ((portfolio_url like 'http://%' or portfolio_url like 'https://%')
        and length(portfolio_url) <= 2000)
  );
