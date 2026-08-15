import type { components } from '@sync/api-client';
import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { signedInAs } from '@/features/auth/testing/handlers';
import { listsCvs } from '@/features/cvs/testing/handlers';
import {
  calculatesExperience,
  failsToLoadProfile,
  faultsOnSave,
  hasProfile,
  refusesProfile,
  refusesSearchable,
  savesProfile,
} from '@/features/profile/testing/handlers';
import { failsToLoadCanonicalSkills } from '@/features/reference/testing/handlers';
import {
  CANDIDATE,
  CANDIDATE_PROFILE,
  CURRENT_CV,
  MALFORMED_REQUEST,
  SEARCHABLE_NEEDS_A_COMPLETE_PROFILE,
  SERVER_FAULT,
  UNKNOWN_SKILL,
} from '@/testing/fixtures';
import { renderApp } from '@/testing/render-app';
import { server } from '@/testing/server';

type CandidateProfile = components['schemas']['CandidateProfile'];

function entry(label: string) {
  return within(screen.getByRole('group', { name: label }));
}

function links() {
  return within(screen.getByRole('region', { name: 'Links' }));
}

async function editHeadline(user: UserEvent, headline: string) {
  await user.clear(screen.getByLabelText('Headline'));
  await user.type(screen.getByLabelText('Headline'), headline);
}

function save(user: UserEvent) {
  return user.click(screen.getByRole('button', { name: 'Save profile' }));
}

async function openProfile() {
  server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
  return renderApp('/profile');
}

async function openProfileThatSaves(saved: CandidateProfile = CANDIDATE_PROFILE) {
  const sent: { body?: CandidateProfile } = {};
  server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
  server.use(
    ...savesProfile(saved, (body) => {
      sent.body = body;
    }),
  );
  return { ...(await renderApp('/profile')), sent };
}

describe('the profile editor', () => {
  it('loads the whole profile into the form', async () => {
    await openProfile();

    expect(screen.getByLabelText('Full name')).toHaveValue(CANDIDATE_PROFILE.full_name);
    expect(screen.getByLabelText('Headline')).toHaveValue('Field coordinator, 6 years');
    expect(screen.getByLabelText('Location')).toHaveValue('Aleppo');
    expect(screen.getByRole('switch', { name: 'Let recruiters find me' })).not.toBeChecked();

    const job = entry('Job 1');
    expect(job.getByLabelText('Job title')).toHaveValue('Field Coordinator');
    expect(job.getByLabelText('Employer')).toHaveValue('Aman Relief');
    expect(job.getByLabelText('Start year')).toHaveValue('2020');
    expect(job.getByLabelText('Start month')).toHaveValue('3');
    expect(job.getByLabelText('End year')).toHaveValue('');
    expect(job.getByRole('checkbox', { name: 'I still work here' })).toBeChecked();

    expect(entry('Qualification 1').getByLabelText('Institution')).toHaveValue(
      'University of Aleppo',
    );

    const skill = entry('Skill 1');
    expect(skill.getByLabelText('Skill')).toHaveValue('Python');
    expect(skill.getByLabelText('Years')).toHaveValue(3.5);
    expect(skill.getByLabelText('Years')).toHaveAttribute('type', 'number');
    expect(skill.getByLabelText('Years')).toHaveAttribute('step', '1');
    expect(
      within(screen.getByRole('region', { name: 'Other skills' })).getByText('Kobo Toolbox'),
    ).toBeVisible();

    const language = entry('Language 1');
    expect(language.getByLabelText('Language')).toHaveValue('Arabic');
    expect(language.getByLabelText('Proficiency')).toHaveTextContent('Native');

    expect(entry('Project 1').getByLabelText('Project name')).toHaveValue('Distribution tracker');

    expect(links().getByLabelText('LinkedIn')).toHaveValue(
      'https://www.linkedin.com/in/lina-khoury',
    );
    expect(links().getByLabelText('GitHub')).toHaveValue('');
    expect(links().getByLabelText('Portfolio or website')).toHaveValue('https://lina-khoury.dev');
  });

  it('says the profile is saved until something is changed', async () => {
    const { user } = await openProfile();

    expect(screen.getByText('Everything is saved.')).toBeVisible();
    await editHeadline(user, 'Coordinator and trainer');

    expect(screen.getByText('Unsaved changes.')).toBeVisible();
  });

  it('answers a field as soon as it is left, without waiting for Save', async () => {
    const { user } = await openProfile();

    await user.clear(entry('Job 1').getByLabelText('Start year'));
    await user.type(entry('Job 1').getByLabelText('Start year'), '1899');
    await user.tab();

    expect(await screen.findByText('Enter a year between 1900 and 2100.')).toBeVisible();
  });

  it('says what is wrong without asking the API', async () => {
    const unexpected = vi.fn();
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
    server.use(...savesProfile(CANDIDATE_PROFILE, unexpected));

    const { user } = await renderApp('/profile');
    await user.clear(screen.getByLabelText('Full name'));
    await user.clear(entry('Skill 1').getByLabelText('Years'));
    await save(user);

    expect(await screen.findByText('Enter your name.')).toBeVisible();
    expect(screen.getByText('Enter years of experience.')).toBeVisible();
    expect(unexpected).not.toHaveBeenCalled();
  });

  it('mirrors the API on a job that cannot have ended', async () => {
    const { user } = await openProfile();

    await user.type(entry('Job 1').getByLabelText('End year'), '2024');
    await save(user);

    expect(await screen.findByText('A current job has no end date.')).toBeVisible();
  });

  it('replaces the whole profile and confirms quietly', async () => {
    const headline = 'Coordinator and trainer';
    const saved: CandidateProfile = { ...CANDIDATE_PROFILE, headline };
    const { user, sent } = await openProfileThatSaves(saved);

    await editHeadline(user, headline);
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body).toEqual(saved);
    expect(screen.getByText('Everything is saved.')).toBeVisible();
  });

  it('sends a section the candidate emptied as an empty section', async () => {
    const { user, sent } = await openProfileThatSaves({ ...CANDIDATE_PROFILE, projects: [] });

    await user.click(screen.getByRole('button', { name: 'Remove Project 1' }));

    expect(
      screen.getByText('No projects listed yet — add something you built or ran.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add a project' })).toBeVisible();

    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body?.projects).toEqual([]);
  });

  it('adds an entry the candidate asked for, and takes it away again', async () => {
    const { user } = await openProfile();

    await user.click(screen.getByRole('button', { name: 'Add a job' }));
    expect(screen.getByRole('group', { name: 'Job 2' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Remove Job 2' }));
    expect(screen.queryByRole('group', { name: 'Job 2' })).toBeNull();
  });

  it('puts a rejected skill beside the skill the API named', async () => {
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
    server.use(...refusesProfile(UNKNOWN_SKILL));

    const { user } = await renderApp('/profile');
    await editHeadline(user, 'Coordinator and trainer');
    await save(user);

    expect(await screen.findByText('“Pythonn” is not a Canonical skill.')).toBeVisible();
    expect(entry('Skill 1').getByLabelText('Skill')).toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Full name')).not.toHaveAttribute('aria-invalid');
  });

  it('offers the platform’s skills by category, and saves the one chosen', async () => {
    const { user, sent } = await openProfileThatSaves();

    await user.click(screen.getByRole('button', { name: 'Add a skill' }));
    const added = entry('Skill 2');
    await user.click(added.getByLabelText('Skill'));

    expect(screen.getByRole('group', { name: 'Databases' })).toBeVisible();

    await user.keyboard('postgre');
    await user.click(screen.getByRole('option', { name: 'PostgreSQL' }));
    await user.type(added.getByLabelText('Years'), '2');
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body?.skills).toEqual([
      { name: 'Python', years_experience: 3.5 },
      { name: 'PostgreSQL', years_experience: 2 },
    ]);
  });

  it('leaves the skills already on the profile out of the picker', async () => {
    const { user } = await openProfile();

    await user.click(screen.getByRole('button', { name: 'Add a skill' }));
    await user.click(entry('Skill 2').getByLabelText('Skill'));

    expect(screen.getByRole('option', { name: 'PostgreSQL' })).toBeVisible();
    expect(screen.queryByRole('option', { name: 'Python' })).toBeNull();
  });

  it('will not let a skill the platform has no name for reach the API', async () => {
    const { user, sent } = await openProfileThatSaves();

    await user.type(entry('Skill 1').getByLabelText('Skill'), 'nn');
    await user.tab();
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body?.skills).toEqual([{ name: 'Python', years_experience: 3.5 }]);
  });

  it('saves a language chosen by its name as its code', async () => {
    const { user, sent } = await openProfileThatSaves();

    await user.click(screen.getByRole('button', { name: 'Add a language' }));
    await user.click(entry('Language 2').getByLabelText('Language'));

    expect(screen.queryByRole('option', { name: 'Arabic' })).toBeNull();

    await user.keyboard('Engl');
    await user.click(screen.getByRole('option', { name: 'English' }));
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body?.languages).toEqual([
      { code: 'ar', proficiency: 'native' },
      { code: 'en', proficiency: 'intermediate' },
    ]);
  });

  it('saves a location chosen by its name as its key, grouped by heading', async () => {
    const { user, sent } = await openProfileThatSaves();

    await user.click(screen.getByLabelText('Location'));

    expect(screen.getByRole('group', { name: 'Syria' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Outside Syria' })).toBeVisible();

    await user.click(screen.getByRole('option', { name: 'Rif Dimashq' }));
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body?.location_key).toBe('sy-rif-dimashq');
  });

  it('loads the phone as the country it belongs to beside the part that is typed', async () => {
    await openProfile();

    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveValue('Syria (+963)');
    expect(screen.getByLabelText('Phone')).toHaveValue('011 555 0100');
  });

  it('saves the number and the country as one answer in two fields', async () => {
    const { user, sent } = await openProfileThatSaves();

    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '011 555 0199');
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body?.phone).toBe('+963115550199');
    expect(sent.body?.phone_country).toBe('SY');
  });

  it('takes the country off a pasted international number and saves the rest of it', async () => {
    const { user, sent } = await openProfileThatSaves();

    await user.clear(screen.getByLabelText('Phone'));
    await user.click(screen.getByLabelText('Phone'));
    await user.paste('+961 1 555 042');

    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveValue('Lebanon (+961)');
    expect(screen.getByLabelText('Phone')).toHaveValue('1555042');

    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body?.phone).toBe('+9611555042');
    expect(sent.body?.phone_country).toBe('LB');
  });

  it('says a number is not one that country can dial, without asking the API', async () => {
    const { user, sent } = await openProfileThatSaves();

    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '11');
    await save(user);

    expect(await screen.findByText('Enter a number Syria can dial.')).toBeVisible();
    expect(sent.body).toBeUndefined();
  });

  it('saves the kind of work chosen by its name as its key', async () => {
    const { user, sent } = await openProfileThatSaves();

    await user.click(screen.getByLabelText('What you do'));
    await user.click(screen.getByRole('option', { name: 'Frontend Engineer' }));
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body?.canonical_role_key).toBe('frontend-engineer');
  });

  it('lets the candidate claim no kind of work at all', async () => {
    const { user, sent } = await openProfileThatSaves();

    await user.click(screen.getByLabelText('What you do'));
    await user.click(screen.getByRole('option', { name: 'Not saying' }));
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body?.canonical_role_key).toBeNull();
  });

  it('shows the total experience the API derived, with no way to type one', async () => {
    await openProfile();

    const experience = within(screen.getByRole('region', { name: 'Experience' }));
    expect(experience.getByText('6 years')).toBeVisible();
    expect(screen.queryByLabelText('Total experience')).toBeNull();
  });

  it('recalculates total experience after a date changes without saving', async () => {
    const calculated = vi.fn();
    const saved = vi.fn();
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
    server.use(...calculatesExperience(4, calculated), ...savesProfile(CANDIDATE_PROFILE, saved));

    const { user } = await renderApp('/profile');
    const startYear = entry('Job 1').getByLabelText('Start year');
    await user.clear(startYear);
    await user.type(startYear, '2022');

    await waitFor(() =>
      expect(calculated).toHaveBeenLastCalledWith([expect.objectContaining({ start_year: 2022 })]),
    );
    const experience = within(screen.getByRole('region', { name: 'Experience' }));
    expect(experience.getByText('4 years')).toBeVisible();
    expect(saved).not.toHaveBeenCalled();

    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(experience.getByText('6 years')).toBeVisible();
  });

  it('says the skill list is missing rather than that there are no skills', async () => {
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
    server.use(...failsToLoadCanonicalSkills(SERVER_FAULT));

    const { user } = await renderApp('/profile');
    await user.click(screen.getByRole('button', { name: 'Add a skill' }));
    await user.click(entry('Skill 2').getByLabelText('Skill'));

    expect(
      await screen.findByText("The skill list couldn't be loaded.", { exact: false }),
    ).toBeVisible();
  });

  it('keeps a place for skills the platform has no name for', async () => {
    const { user, sent } = await openProfileThatSaves();

    await user.click(screen.getByRole('button', { name: 'Add another skill' }));
    await user.type(entry('Other skill 2').getByLabelText('Skill'), 'Sphere Standards');
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body?.unmapped_skills).toEqual(['Kobo Toolbox', 'Sphere Standards']);
  });

  it('deletes an Other skill from its pill', async () => {
    const { user, sent } = await openProfileThatSaves();
    const otherSkills = within(screen.getByRole('region', { name: 'Other skills' }));

    await user.click(otherSkills.getByRole('button', { name: 'Remove Kobo Toolbox' }));
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body?.unmapped_skills).toEqual([]);
  });

  it('sends a handle typed on its own as the whole address', async () => {
    const { user, sent } = await openProfileThatSaves();

    await user.clear(links().getByLabelText('GitHub'));
    await user.type(links().getByLabelText('GitHub'), '@lina-khoury');
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body?.github_url).toBe('https://github.com/lina-khoury');
  });

  it('answers a link that is not that kind of address without asking the API', async () => {
    const unexpected = vi.fn();
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
    server.use(...savesProfile(CANDIDATE_PROFILE, unexpected));

    const { user } = await renderApp('/profile');
    await user.clear(links().getByLabelText('LinkedIn'));
    await user.type(links().getByLabelText('LinkedIn'), 'https://github.com/lina-khoury');
    await save(user);

    expect(
      await screen.findByText(
        'Enter a LinkedIn address, like linkedin.com/in/amina-haddad, or your handle on its own.',
      ),
    ).toBeVisible();
    expect(unexpected).not.toHaveBeenCalled();
  });

  it('takes the links off again when they are emptied', async () => {
    const { user, sent } = await openProfileThatSaves();

    await user.clear(links().getByLabelText('LinkedIn'));
    await user.clear(links().getByLabelText('Portfolio or website'));
    await save(user);

    expect(await screen.findByText('Profile saved.')).toBeVisible();
    expect(sent.body?.linkedin_url).toBeNull();
    expect(sent.body?.portfolio_url).toBeNull();
  });

  it('blames the searchable switch when Global search needs a complete profile', async () => {
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
    server.use(...refusesSearchable(SEARCHABLE_NEEDS_A_COMPLETE_PROFILE));

    const { user } = await renderApp('/profile');
    await user.click(screen.getByRole('switch', { name: 'Let recruiters find me' }));
    await save(user);

    expect(
      await screen.findByText(SEARCHABLE_NEEDS_A_COMPLETE_PROFILE.detail as string),
    ).toBeVisible();
    expect(screen.getByRole('switch', { name: 'Let recruiters find me' })).toHaveAttribute(
      'aria-invalid',
    );
  });

  it('speaks for the whole form when a rejection names no field it shows', async () => {
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
    server.use(...refusesProfile(MALFORMED_REQUEST));

    const { user } = await renderApp('/profile');
    await editHeadline(user, 'Coordinator and trainer');
    await save(user);

    expect(await screen.findByText('Your profile was not saved')).toBeVisible();
    expect(screen.getByText('The request did not match the expected shape.')).toBeVisible();
    expect(screen.getByLabelText('Full name')).not.toHaveAttribute('aria-invalid');
  });

  it('sends a server fault to a toast, not to a field', async () => {
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
    server.use(...faultsOnSave(SERVER_FAULT));

    const { router, user } = await renderApp('/profile');
    await editHeadline(user, 'Coordinator and trainer');
    await save(user);

    expect(await screen.findByText('Something went wrong on our side.')).toBeVisible();
    expect(screen.queryByText('Your profile was not saved')).toBeNull();
    expect(router.state.location.pathname).toBe('/profile');
  });

  it('offers a retry rather than a blank page when the profile will not load', async () => {
    server.use(...signedInAs(CANDIDATE), ...failsToLoadProfile(SERVER_FAULT));

    await renderApp('/profile');

    expect(await screen.findByText("This page didn't load")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

describe('the Candidate Card on the profile', () => {
  it('shows the candidate the way a recruiter will read them', async () => {
    await openProfile();

    const card = within(await screen.findByRole('article', { name: 'Lina Khoury' }));
    expect(card.getByText('Lina Khoury')).toBeVisible();
    expect(card.getByText('Project Manager')).toBeVisible();
    expect(card.getByText(CANDIDATE.email)).toBeVisible();
    expect(card.getByText('+963 11 555 0100')).toBeVisible();
    expect(card.getByText('6 years')).toBeVisible();
    expect(card.getByText('Arabic')).toBeVisible();
    expect(card.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/lina-khoury',
    );
    expect(card.getByRole('link', { name: 'lina-khoury.dev' })).toBeVisible();
    expect(card.queryByRole('link', { name: 'GitHub' })).toBeNull();
  });

  it('leaves out what the profile does not say, rather than labelling it empty', async () => {
    server.use(
      ...signedInAs(CANDIDATE),
      ...hasProfile({
        ...CANDIDATE_PROFILE,
        phone: null,
        canonical_role_key: null,
        languages: [],
        linkedin_url: null,
        portfolio_url: null,
      }),
    );
    await renderApp('/profile');

    const card = within(await screen.findByRole('article', { name: 'Lina Khoury' }));
    expect(card.getByText(CANDIDATE.email)).toBeVisible();
    expect(card.queryByText('Phone')).toBeNull();
    expect(card.queryByText('Languages')).toBeNull();
    expect(card.queryByText('Project Manager')).toBeNull();
    expect(card.queryByText('Links')).toBeNull();
  });
});

describe('leaving the profile editor', () => {
  async function leaveFor(user: UserEvent, destination: string) {
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    await user.click(within(nav).getByRole('link', { name: destination }));
  }

  it('warns first when there are unsaved changes, and stays put', async () => {
    const { router, user } = await openProfile();
    await editHeadline(user, 'Coordinator and trainer');

    await leaveFor(user, 'Jobs');

    expect(await screen.findByRole('heading', { name: 'Leave without saving?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));

    await waitFor(() => expect(screen.queryByText('Leave without saving?')).toBeNull());
    expect(router.state.location.pathname).toBe('/profile');
    expect(screen.getByLabelText('Headline')).toHaveValue('Coordinator and trainer');
  });

  it('lets the changes go when that is what the candidate meant', async () => {
    const { router, user } = await openProfile();
    await editHeadline(user, 'Coordinator and trainer');

    await leaveFor(user, 'Jobs');
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/jobs'));
  });

  it('does not warn when nothing was changed', async () => {
    const { router, user } = await openProfile();

    await leaveFor(user, 'Jobs');

    await waitFor(() => expect(router.state.location.pathname).toBe('/jobs'));
    expect(screen.queryByText('Leave without saving?')).toBeNull();
  });

  it('does not warn once the changes are saved', async () => {
    const headline = 'Coordinator and trainer';
    server.use(...signedInAs(CANDIDATE), ...hasProfile(CANDIDATE_PROFILE));
    server.use(...savesProfile({ ...CANDIDATE_PROFILE, headline }));

    const { router, user } = await renderApp('/profile');
    await editHeadline(user, headline);
    await save(user);
    await screen.findByText('Profile saved.');

    await leaveFor(user, 'Jobs');

    await waitFor(() => expect(router.state.location.pathname).toBe('/jobs'));
    expect(screen.queryByText('Leave without saving?')).toBeNull();
  });
});

describe('profile progress', () => {
  it('says how far along the profile is, and what is still missing', async () => {
    await openProfile();

    expect(await screen.findByText('Your profile is 91% complete')).toBeVisible();
    expect(screen.getByText('Upload a CV and wait for it to be read')).toBeVisible();
  });

  it('names every unfinished requirement at once', async () => {
    server.use(...signedInAs(CANDIDATE));
    server.use(
      ...hasProfile({
        ...CANDIDATE_PROFILE,
        summary: null,
        canonical_role_key: null,
        languages: [],
      }),
    );

    await renderApp('/profile');

    expect(await screen.findByText('Your profile is 64% complete')).toBeVisible();
    for (const action of [
      'Upload a CV and wait for it to be read',
      'Choose what you do',
      'Write a summary',
      'Add at least one language',
    ]) {
      expect(screen.getByText(action)).toBeVisible();
    }
  });

  it('leaves the optional sections out of the count', async () => {
    server.use(...signedInAs(CANDIDATE), ...listsCvs([CURRENT_CV]));
    server.use(
      ...hasProfile({
        ...CANDIDATE_PROFILE,
        projects: [],
        unmapped_skills: [],
        linkedin_url: null,
        github_url: null,
        portfolio_url: null,
      }),
    );

    await renderApp('/profile');

    expect(await screen.findByText('Your profile is complete')).toBeVisible();
  });
});
