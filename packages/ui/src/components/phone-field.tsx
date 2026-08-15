import { Combobox, type ComboboxOption } from '@sync/ui/components/combobox';
import { CountryFlag } from '@sync/ui/components/country-flag';
import { Input } from '@sync/ui/components/ui/input';
import { detect, isPhoneCountry, PHONE_COUNTRIES } from '@sync/ui/lib/phone';
import { cn } from '@sync/ui/lib/utils';

export interface PhoneValue {
  country: string;
  number: string;
}

interface PhoneFieldProps {
  id?: string;
  value: PhoneValue;
  onChange: (value: PhoneValue) => void;
  onBlur?: () => void;
  disabled?: boolean;
  countryLabel?: string;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

const COUNTRIES: ComboboxOption[] = PHONE_COUNTRIES.map((entry) => ({
  value: entry.code,
  label: `${entry.name} (+${entry.callingCode})`,
  icon: <CountryFlag country={entry.code} />,
}));

export function PhoneField({
  id,
  value,
  onChange,
  onBlur,
  disabled,
  countryLabel = 'Country',
  className,
  ...aria
}: PhoneFieldProps) {
  function wrote(raw: string) {
    const dialled = detect(raw);
    onChange(
      dialled ? { country: dialled.country, number: dialled.national } : { ...value, number: raw },
    );
  }

  return (
    <div className={cn('flex flex-wrap items-start gap-2', className)}>
      <Combobox
        className="w-full sm:w-56"
        aria-label={countryLabel}
        aria-invalid={aria['aria-invalid']}
        options={COUNTRIES}
        value={isPhoneCountry(value.country) ? value.country : null}
        onValueChange={(chosen) => onChange({ ...value, country: chosen ?? '' })}
        onBlur={onBlur}
        disabled={disabled}
        placeholder="Country"
        emptyMessage="No country by that name."
      />
      <Input
        id={id}
        type="tel"
        autoComplete="tel-national"
        className="min-w-0 flex-1"
        value={value.number}
        onChange={(event) => wrote(event.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        aria-describedby={aria['aria-describedby']}
        aria-invalid={aria['aria-invalid']}
      />
    </div>
  );
}
