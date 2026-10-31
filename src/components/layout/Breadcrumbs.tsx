'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMockStore } from '@/lib/mock/store';

export function Breadcrumbs() {
  const pathname = usePathname();
  const doctors = useMockStore((state) => state.doctors);

  const getBreadcrumbs = () => {
    // 1. Dashboard
    if (pathname === '/dashboard') {
      return [{ label: 'Dashboard', href: null }];
    }

    // 2. Doctors
    if (pathname === '/doctors') {
      return [{ label: 'Doctors', href: null }];
    }

    if (pathname === '/doctors/new') {
      return [
        { label: 'Doctors', href: '/doctors' },
        { label: 'New Doctor', href: null },
      ];
    }

    const doctorMatch = pathname.match(/^\/doctors\/([^/]+)$/);
    if (doctorMatch) {
      const doctorId = doctorMatch[1];
      const doc = doctors.find((d) => d.id === doctorId);
      return [
        { label: 'Doctors', href: '/doctors' },
        { label: doc?.name || 'Doctor Profile', href: null },
      ];
    }

    const doctorAddPatientMatch = pathname.match(/^\/doctors\/([^/]+)\/patients\/new$/);
    if (doctorAddPatientMatch) {
      const doctorId = doctorAddPatientMatch[1];
      const doc = doctors.find((d) => d.id === doctorId);
      return [
        { label: 'Doctors', href: '/doctors' },
        { label: doc?.name || 'Doctor', href: `/doctors/${doctorId}` },
        { label: 'Add Patient', href: null },
      ];
    }

    // 3. Patients
    if (pathname === '/patients') {
      return [{ label: 'Patients', href: null }];
    }

    if (pathname.startsWith('/patients/') && pathname.endsWith('/edit')) {
      return [
        { label: 'Patients', href: '/patients' },
        { label: 'Edit Patient', href: null },
      ];
    }

    if (pathname === '/set-password') {
      return [{ label: 'Set Password', href: null }];
    }

    // Fallback: capitalize route segment
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return [{ label: 'Dashboard', href: null }];

    return segments.map((seg, idx) => ({
      label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
      href: idx < segments.length - 1 ? `/${segments.slice(0, idx + 1).join('/')}` : null,
    }));
  };

  const crumbs = getBreadcrumbs();

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;

          if (isLast) {
            return (
              <li
                key={crumb.label}
                aria-current="page"
                className="truncate font-medium text-ink"
              >
                {crumb.label}
              </li>
            );
          }

          return (
            <span key={crumb.label} className="hidden sm:inline-flex items-center gap-1.5">
              <li>
                <Link
                  href={crumb.href || '#'}
                  prefetch={false}
                  className="text-muted transition-colors hover:text-ink"
                >
                  {crumb.label}
                </Link>
              </li>
              <li aria-hidden="true" className="text-muted/60">
                <svg
                  className="size-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </li>
            </span>
          );
        })}
      </ol>
    </nav>
  );
}

