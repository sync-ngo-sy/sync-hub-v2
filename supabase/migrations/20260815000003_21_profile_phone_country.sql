-- The country a number belongs to, held beside the number itself. Two columns rather than one
-- string, because `+1` is twenty-odd countries: which one somebody picked is not recoverable from
-- the digits they typed, and a flag that changes on reload reads as the platform losing their
-- answer.
--
-- The number is stored in E.164 and nothing else, which is what lets the browser and the API agree
-- on one shape; and neither column stands alone, because a number nobody can place is not a Phone
-- and a country with nothing to dial is not an answer.
--
-- The two CHECKs the number could already break are added `not valid`: a number stored before today
-- has no country to put beside it and no shape the platform ever promised, and clearing one would
-- throw away a contact the Candidate gave us. Every write from here on is held to both, so a
-- profile saved through the picker corrects itself; `validate constraint` finishes the job once
-- nothing old is left. The country's own shape is validated, the column being new and empty.

alter table profiles
  add column phone_country text;

alter table profiles
  add constraint profiles_phone_is_e164
    check (phone ~ '^\+[1-9][0-9]{1,14}$') not valid,
  add constraint profiles_phone_has_a_country
    check (num_nonnulls(phone, phone_country) <> 1) not valid,
  add constraint profiles_phone_country_is_iso
    check (phone_country ~ '^[A-Z]{2}$');
