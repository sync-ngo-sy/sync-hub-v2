import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TenantLogo } from './tenant-logo';

const A_LOGO = 'https://sync.test/storage/v1/object/public/tenant-logos/acme/logo.webp';

describe('a Tenant logo', () => {
  it('shows the picture the Tenant uploaded', () => {
    render(<TenantLogo name="Aman Relief" logoUrl={A_LOGO} />);

    expect(screen.getByRole('presentation')).toHaveAttribute('src', A_LOGO);
  });

  it('falls back to the first letters of the name until one is uploaded', () => {
    render(<TenantLogo name="Aman Relief" logoUrl={null} />);

    expect(screen.getByText('AR')).toBeInTheDocument();
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  });

  it('reads the name of a one-word Tenant as one letter', () => {
    render(<TenantLogo name="Syriatel" />);

    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('says nothing to a screen reader, because the name is beside it', () => {
    render(<TenantLogo name="Aman Relief" logoUrl={A_LOGO} />);

    expect(screen.getByRole('presentation')).toHaveAttribute('alt', '');
  });
});
