-- Part of the schema contract, so it ships as a migration and is applied to every
-- environment. Throwaway local fixtures belong in supabase/seed.sql instead.

insert into languages (code, name) values
  ('en', 'English'), ('ar', 'Arabic'),  ('fr', 'French'),   ('es', 'Spanish'),
  ('de', 'German'),  ('pt', 'Portuguese'), ('it', 'Italian'), ('nl', 'Dutch'),
  ('ru', 'Russian'), ('zh', 'Chinese'),  ('ja', 'Japanese'), ('ko', 'Korean'),
  ('hi', 'Hindi'),   ('tr', 'Turkish'),  ('pl', 'Polish')
on conflict (code) do nothing;

-- Syria's fourteen governorates. A place is resolved this far and no further: a Job in Manbij
-- is a Job in Aleppo, which is the answer a filter can actually be held to.
insert into locations (key, name, kind) values
  ('sy-damascus',    'Damascus',     'governorate'),
  ('sy-rif-dimashq', 'Rif Dimashq',  'governorate'),
  ('sy-aleppo',      'Aleppo',       'governorate'),
  ('sy-homs',        'Homs',         'governorate'),
  ('sy-hama',        'Hama',         'governorate'),
  ('sy-latakia',     'Latakia',      'governorate'),
  ('sy-tartus',      'Tartus',       'governorate'),
  ('sy-idlib',       'Idlib',        'governorate'),
  ('sy-deir-ez-zor', 'Deir ez-Zor',  'governorate'),
  ('sy-al-hasakah',  'Al-Hasakah',   'governorate'),
  ('sy-raqqa',       'Raqqa',        'governorate'),
  ('sy-daraa',       'Daraa',        'governorate'),
  ('sy-as-suwayda',  'As-Suwayda',   'governorate'),
  ('sy-quneitra',    'Quneitra',     'governorate')
on conflict (key) do nothing;

-- Somewhere correct for a Candidate who is not in Syria, keyed by ISO 3166-1 alpha-2. Not
-- every country on earth: the ones the platform's people are actually in. A country that is
-- missing is added here, in this list, rather than typed into a profile.
insert into locations (key, name, kind)
select v.key, v.name, 'country'
from (values
  ('af', 'Afghanistan'),  ('al', 'Albania'),    ('dz', 'Algeria'),    ('ar', 'Argentina'),
  ('am', 'Armenia'),      ('au', 'Australia'),  ('at', 'Austria'),    ('az', 'Azerbaijan'),
  ('bh', 'Bahrain'),      ('bd', 'Bangladesh'), ('be', 'Belgium'),    ('br', 'Brazil'),
  ('bg', 'Bulgaria'),     ('ca', 'Canada'),     ('cl', 'Chile'),      ('cn', 'China'),
  ('hr', 'Croatia'),      ('cy', 'Cyprus'),     ('cz', 'Czechia'),    ('dk', 'Denmark'),
  ('eg', 'Egypt'),        ('ee', 'Estonia'),    ('et', 'Ethiopia'),   ('fi', 'Finland'),
  ('fr', 'France'),       ('ge', 'Georgia'),    ('de', 'Germany'),    ('gh', 'Ghana'),
  ('gr', 'Greece'),       ('hu', 'Hungary'),    ('in', 'India'),      ('id', 'Indonesia'),
  ('ir', 'Iran'),         ('iq', 'Iraq'),       ('ie', 'Ireland'),    ('it', 'Italy'),
  ('jp', 'Japan'),        ('jo', 'Jordan'),     ('kz', 'Kazakhstan'), ('ke', 'Kenya'),
  ('kw', 'Kuwait'),       ('lv', 'Latvia'),     ('lb', 'Lebanon'),    ('ly', 'Libya'),
  ('lt', 'Lithuania'),    ('my', 'Malaysia'),   ('mt', 'Malta'),      ('mr', 'Mauritania'),
  ('mx', 'Mexico'),       ('ma', 'Morocco'),    ('nl', 'Netherlands'),('nz', 'New Zealand'),
  ('ng', 'Nigeria'),      ('no', 'Norway'),     ('om', 'Oman'),       ('pk', 'Pakistan'),
  ('ps', 'Palestine'),    ('ph', 'Philippines'),('pl', 'Poland'),     ('pt', 'Portugal'),
  ('qa', 'Qatar'),        ('ro', 'Romania'),    ('ru', 'Russia'),     ('sa', 'Saudi Arabia'),
  ('sn', 'Senegal'),      ('rs', 'Serbia'),     ('sg', 'Singapore'),  ('sk', 'Slovakia'),
  ('si', 'Slovenia'),     ('so', 'Somalia'),    ('za', 'South Africa'),
  ('kr', 'South Korea'),  ('es', 'Spain'),      ('sd', 'Sudan'),      ('se', 'Sweden'),
  ('ch', 'Switzerland'),  ('tn', 'Tunisia'),    ('tr', 'Türkiye'),    ('ua', 'Ukraine'),
  ('ae', 'United Arab Emirates'),               ('gb', 'United Kingdom'),
  ('us', 'United States'),('uz', 'Uzbekistan'), ('vn', 'Vietnam'),    ('ye', 'Yemen')
) as v(key, name)
on conflict (key) do nothing;

-- What kind of practitioner somebody is. Deliberately coarse: fourteen entries a Recruiter can
-- hold the platform to rather than a catalogue of job titles, because the finer distinctions
-- are already in the Canonical skills a Candidate lists. A role that is missing is added here,
-- in this list, rather than typed into a profile.
insert into canonical_roles (key, name) values
  ('frontend-engineer',  'Frontend Engineer'),
  ('backend-engineer',   'Backend Engineer'),
  ('fullstack-engineer', 'Full-stack Engineer'),
  ('mobile-engineer',    'Mobile Engineer'),
  ('devops-engineer',    'DevOps Engineer'),
  ('qa-engineer',        'QA Engineer'),
  ('data-engineer',      'Data Engineer'),
  ('data-scientist',     'Data Scientist'),
  ('ui-ux-designer',     'UI/UX Designer'),
  ('graphic-designer',   'Graphic Designer'),
  ('product-manager',    'Product Manager'),
  ('project-manager',    'Project Manager'),
  ('business-analyst',   'Business Analyst'),
  ('it-support',         'IT Support')
on conflict (key) do nothing;

insert into skill_categories (name) values
  ('Programming Languages'),
  ('Frameworks & Libraries'),
  ('Databases'),
  ('Cloud & DevOps'),
  ('Data & Machine Learning'),
  ('Design'),
  ('Tools & Platforms'),
  ('Soft Skills')
on conflict (name) do nothing;

insert into skill_taxonomy (category_id, canonical_name)
select c.id, v.name
from skill_categories c
join (values
  ('Programming Languages','Python'), ('Programming Languages','JavaScript'),
  ('Programming Languages','TypeScript'), ('Programming Languages','Java'),
  ('Programming Languages','C#'), ('Programming Languages','Go'),
  ('Programming Languages','Rust'), ('Programming Languages','Ruby'),
  ('Programming Languages','PHP'), ('Programming Languages','Swift'),
  ('Programming Languages','Kotlin'), ('Programming Languages','C++'),
  ('Programming Languages','SQL'),

  ('Frameworks & Libraries','React'), ('Frameworks & Libraries','Next.js'),
  ('Frameworks & Libraries','Vue'), ('Frameworks & Libraries','Angular'),
  ('Frameworks & Libraries','Node.js'), ('Frameworks & Libraries','Django'),
  ('Frameworks & Libraries','FastAPI'), ('Frameworks & Libraries','Flask'),
  ('Frameworks & Libraries','Spring Boot'), ('Frameworks & Libraries','Express'),
  ('Frameworks & Libraries','Ruby on Rails'), ('Frameworks & Libraries','.NET'),

  ('Databases','PostgreSQL'), ('Databases','MySQL'), ('Databases','MongoDB'),
  ('Databases','Redis'), ('Databases','Elasticsearch'), ('Databases','SQLite'),

  ('Cloud & DevOps','AWS'), ('Cloud & DevOps','Google Cloud'),
  ('Cloud & DevOps','Azure'), ('Cloud & DevOps','Docker'),
  ('Cloud & DevOps','Kubernetes'), ('Cloud & DevOps','Terraform'),
  ('Cloud & DevOps','CI/CD'), ('Cloud & DevOps','Linux'),

  ('Data & Machine Learning','Pandas'), ('Data & Machine Learning','NumPy'),
  ('Data & Machine Learning','TensorFlow'), ('Data & Machine Learning','PyTorch'),
  ('Data & Machine Learning','scikit-learn'), ('Data & Machine Learning','Machine Learning'),
  ('Data & Machine Learning','Data Analysis'),

  ('Design','Figma'), ('Design','UI/UX Design'), ('Design','Adobe Photoshop'),

  ('Tools & Platforms','Git'), ('Tools & Platforms','Jira'),
  ('Tools & Platforms','GraphQL'), ('Tools & Platforms','REST APIs'),

  ('Soft Skills','Communication'), ('Soft Skills','Leadership'),
  ('Soft Skills','Teamwork'), ('Soft Skills','Problem Solving')
) as v(category, name) on c.name = v.category
on conflict (canonical_name) do nothing;
