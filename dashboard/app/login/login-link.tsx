'use client';

import type { ComponentProps, MouseEvent } from 'react';

/** Links to the OAuth login, passing along the browser's timezone. */
export function LoginLink({
  onClick,
  ...props
}: Omit<ComponentProps<'a'>, 'href'>) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      e.currentTarget.href = `/auth/login?tz=${encodeURIComponent(tz)}`;
    }
    onClick?.(e);
  }

  return <a {...props} href="/auth/login" onClick={handleClick} />;
}
