-- Part of the schema contract, so it ships as a migration and is applied to every
-- environment. Throwaway local fixtures belong in supabase/seed.sql instead.

insert into languages (code, name) values
  ('en', 'English'), ('ar', 'Arabic'),  ('fr', 'French'),   ('es', 'Spanish'),
  ('de', 'German'),  ('pt', 'Portuguese'), ('it', 'Italian'), ('nl', 'Dutch'),
  ('ru', 'Russian'), ('zh', 'Chinese'),  ('ja', 'Japanese'), ('ko', 'Korean'),
  ('hi', 'Hindi'),   ('tr', 'Turkish'),  ('pl', 'Polish')
on conflict (code) do nothing;

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
