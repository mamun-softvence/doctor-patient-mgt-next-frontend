'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLogout } from '@/features/auth/hooks';
import { useMockStore } from '@/lib/mock/store';
import { clearSessionCookie } from '@/lib/auth/cookies';
import { Breadcrumbs } from './Breadcrumbs';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { MobileNavDrawer } from './MobileNavDrawer';

export function Sidebar() {
  const pathname = usePathname();
  const doctors = useMockStore((state) => state.doctors);
  const patients = useMockStore((state) => state.patients);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const totalDoctors = doctors.length;
  const totalPatients = patients.length;

  const navItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg
          className="size-[18px] shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect width="7" height="9" x="3" y="3" rx="1" />
          <rect width="7" height="5" x="14" y="3" rx="1" />
          <rect width="7" height="9" x="14" y="12" rx="1" />
          <rect width="7" height="5" x="3" y="16" rx="1" />
        </svg>
      ),
    },
    {
      name: 'Doctors',
      href: '/doctors',
      count: totalDoctors,
      icon: (
        <svg
          className="size-[18px] shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M11 2v2" />
          <path d="M5 2v2" />
          <path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" />
          <path d="M8 15a6 6 0 0 0 12 0v-3" />
          <circle cx="20" cy="10" r="2" />
        </svg>
      ),
    },
    {
      name: 'Patients',
      href: '/patients',
      count: totalPatients,
      icon: (
        <svg
          className="size-[18px] shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  ];

  return (
    <aside
      className={`relative sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-white transition-all duration-200 lg:flex ${
        isCollapsed ? 'w-[72px]' : 'w-[248px]'
      }`}
    >
      {/* Floating expand button straddling the border line when collapsed */}
      {isCollapsed && (
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className="absolute -right-3 top-5 z-20 grid size-6 place-items-center rounded-full border border-line bg-white shadow-xs text-muted transition-all hover:border-brand-300 hover:text-ink hover:scale-110 cursor-pointer"
        >
          <svg
            className="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Header */}
      <div
        className={`flex h-16 items-center border-b border-line ${
          isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
        }`}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 rounded-lg">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white shrink-0">
            <svg
              className="size-[18px] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </span>
          {!isCollapsed && (
            <span className="text-[15px] font-semibold tracking-tight text-ink truncate">
              Doctor Tracker
            </span>
          )}
        </Link>

        {!isCollapsed && (
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-canvas hover:text-ink cursor-pointer"
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
      </div>

      <nav aria-label="Main" className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                isActive
                  ? 'bg-brand-50 font-semibold text-brand-800'
                  : 'font-medium text-muted hover:bg-canvas hover:text-ink'
              }`}
            >
              {item.icon}
              {!isCollapsed && (
                <>
                  <span>{item.name}</span>
                  {item.count !== undefined && (
                    <span
                      className={`ml-auto text-xs tabular-nums ${
                        isActive ? 'text-brand-800 font-semibold' : 'text-muted'
                      }`}
                    >
                      {item.count.toLocaleString()}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function Header() {
  const router = useRouter();
  const logout = useLogout();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const handleCloseMobileNav = useCallback(() => {
    setIsMobileNavOpen(false);
  }, []);

  const handleSignOut = async () => {
    clearSessionCookie();
    try {
      await logout.mutateAsync();
    } catch {
      router.push('/login');
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-2 px-4 sm:px-6 lg:px-8">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setIsMobileNavOpen(true)}
          className="inline-grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink -ml-2 lg:hidden cursor-pointer"
        >
          <svg
            className="size-5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6h16" />
            <path d="M4 12h16" />
            <path d="M4 18h16" />
          </svg>
        </button>

        {/* Dynamic Breadcrumbs */}
        <Breadcrumbs />

        {/* Theme Switcher Button */}
        <ThemeToggle />

        {/* Vertical Divider */}
        <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-line sm:block" />

        {/* User Menu Dropdown */}
        <UserMenu onSignOut={handleSignOut} isSigningOut={logout.isPending} />

        {/* Mobile Navigation Drawer */}
        <MobileNavDrawer
          isOpen={isMobileNavOpen}
          onClose={handleCloseMobileNav}
          onSignOut={handleSignOut}
        />
      </div>
    </header>
  );
}
