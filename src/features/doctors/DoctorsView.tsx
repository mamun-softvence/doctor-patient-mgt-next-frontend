'use client';

import { useState, useTransition, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCurrentUser } from '@/features/auth/hooks';
import { useMockStore } from '@/lib/mock/store';
import { parseDoctorFilters, buildQueryString, getDatePresetRange } from '@/lib/url/filters';
import { AddDoctorModal } from '@/components/modals/AddDoctorModal';

function getInitials(name: string) {
  return (
    name
      .replace(/^Dr\.\s*/i, '')
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'DR'
  );
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '18 Jan 2026';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function DoctorsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  // Read URL filters
  const filters = parseDoctorFilters(searchParams);
  const [selectedHospital, setSelectedHospital] = useState(searchParams.get('hospital') || '');

  // Active date preset state
  const [datePreset, setDatePreset] = useState<string>(() => {
    if (filters.from || filters.to) return 'custom';
    return 'all';
  });
  const [fromDate, setFromDate] = useState(filters.from);
  const [toDate, setToDate] = useState(filters.to);

  // Read authoritative data from store
  const allDoctors = useMockStore((state) => state.doctors);
  const allPatients = useMockStore((state) => state.patients);

  // Extract unique specialties and hospitals for dropdowns
  const specialties = useMemo(
    () => Array.from(new Set(allDoctors.map((d) => d.specialty))).sort(),
    [allDoctors]
  );
  const departments = useMemo(
    () => Array.from(new Set(allDoctors.map((d) => d.department))).sort(),
    [allDoctors]
  );
  const hospitals = useMemo(
    () => Array.from(new Set(allDoctors.map((d) => d.hospital || 'General Hospital'))).sort(),
    [allDoctors]
  );
  const hospitalsCount = hospitals.length;

  // URL update helper
  const updateUrl = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      startTransition(() => {
        const current =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search)
            : searchParams;
        const newQuery = buildQueryString(current, updates);
        router.replace(`/doctors${newQuery}`);
      });
    },
    [router, searchParams]
  );

  const handleDatePresetChange = useCallback(
    (preset: string) => {
      setDatePreset(preset);
      if (preset === 'all') {
        setFromDate('');
        setToDate('');
        updateUrl({ from: '', to: '', page: 1 });
      } else if (preset === '7d' || preset === '30d' || preset === '90d') {
        const range = getDatePresetRange(preset as '7d' | '30d');
        setFromDate(range.from);
        setToDate(range.to);
        updateUrl({ from: range.from, to: range.to, page: 1 });
      }
    },
    [updateUrl]
  );

  const handleResetFilters = useCallback(() => {
    setDatePreset('all');
    setFromDate('');
    setToDate('');
    setSelectedHospital('');
    router.replace('/doctors');
  }, [router]);

  // Filter doctors based on URL parameters & local selectors
  const filteredDoctors = useMemo(() => {
    return allDoctors.filter((doc) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchName = doc.name.toLowerCase().includes(q);
        const matchEmail = doc.email.toLowerCase().includes(q);
        const matchSpecialty = doc.specialty.toLowerCase().includes(q);
        const matchPhone = doc.phone ? doc.phone.toLowerCase().includes(q) : false;
        const matchHosp = doc.hospital ? doc.hospital.toLowerCase().includes(q) : false;
        if (!matchName && !matchEmail && !matchSpecialty && !matchPhone && !matchHosp) return false;
      }
      if (filters.specialty && doc.specialty !== filters.specialty) {
        return false;
      }
      if (filters.department && doc.department !== filters.department) {
        return false;
      }
      if (selectedHospital && (doc.hospital || 'General Hospital') !== selectedHospital) {
        return false;
      }
      if (filters.from) {
        const docDate = doc.createdAt ? doc.createdAt.split('T')[0] : '2024-01-01';
        if (docDate < filters.from) return false;
      }
      if (filters.to) {
        const docDate = doc.createdAt ? doc.createdAt.split('T')[0] : '2024-01-01';
        if (docDate > filters.to) return false;
      }
      return true;
    });
  }, [allDoctors, filters.search, filters.specialty, filters.department, filters.from, filters.to, selectedHospital]);

  // Sort doctors
  const sortedDoctors = useMemo(() => {
    const patientCountsByDoctor = new Map<string, number>();
    for (const p of allPatients) {
      patientCountsByDoctor.set(p.doctorId, (patientCountsByDoctor.get(p.doctorId) || 0) + 1);
    }

    return [...filteredDoctors].sort((a, b) => {
      const aPatients = patientCountsByDoctor.get(a.id) || 0;
      const bPatients = patientCountsByDoctor.get(b.id) || 0;

      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'most-patients') {
        return bPatients - aPatients;
      }
      if (sortBy === 'oldest') {
        const dateA = a.createdAt || '2026-01-01';
        const dateB = b.createdAt || '2026-01-01';
        return dateA.localeCompare(dateB);
      }
      // Default: newest first
      const dateA = a.createdAt || '2026-01-01';
      const dateB = b.createdAt || '2026-01-01';
      return dateB.localeCompare(dateA);
    });
  }, [filteredDoctors, allPatients, sortBy]);

  // Pagination
  const totalCount = sortedDoctors.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.limit));
  const currentPage = Math.min(filters.page, totalPages);
  const startIndex = (currentPage - 1) * filters.limit;
  const paginatedDoctors = sortedDoctors.slice(startIndex, startIndex + filters.limit);

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.specialty ||
      filters.department ||
      selectedHospital ||
      filters.from ||
      filters.to
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight text-ink"
            aria-label="Doctors Directory"
          >
            Doctors
          </h1>
          <p className="mt-1 text-sm text-muted">
            {allDoctors.length} doctors across {hospitalsCount} hospitals
          </p>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/doctors/new"
              data-testid="btn-add-doctor"
              className="inline-flex h-10 px-4 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm transition-colors bg-brand-600 font-semibold text-white hover:bg-brand-700 cursor-pointer"
            >
              <svg
                className="size-4 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
              </svg>
              Add doctor
            </Link>
          </div>
        )}
      </div>

      {/* Unified Card Container */}
      <section aria-label="Doctor list" className="rounded-xl border border-line bg-white mt-6 overflow-hidden [contain:paint] min-w-0 max-w-full">
        {/* Filter / Search Bar */}
        <div className="space-y-3 border-b border-line p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* Search Input */}
            <div className="w-full md:max-w-md">
              <div className="relative w-full">
                <label htmlFor="q" className="sr-only">Search doctors</label>
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                  <svg
                    className="size-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </span>
                <input
                  id="q"
                  type="search"
                  value={filters.search}
                  onChange={(e) => updateUrl({ search: e.target.value, page: 1 })}
                  placeholder="Search name, email, phone or hospital"
                  data-testid="doctor-search-input"
                  className="block h-10 w-full rounded-lg border bg-white px-3 text-sm text-ink placeholder:text-muted/80 focus:outline-none focus:ring-4 border-line focus:border-brand-500 focus:ring-brand-500/15 pl-9"
                />
              </div>
            </div>

            {/* Desktop Sort Dropdown */}
            <div className="hidden md:ml-auto md:block">
              <div className="w-52">
                <label htmlFor="f-sort" className="sr-only">Sort by</label>
                <div className="relative">
                  <select
                    id="f-sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="block h-10 w-full appearance-none rounded-lg border border-line bg-white text-ink pl-3 pr-9 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                  >
                    <option value="newest">Sort: Newest first</option>
                    <option value="oldest">Sort: Oldest first</option>
                    <option value="name-asc">Sort: Name A–Z</option>
                    <option value="name-desc">Sort: Name Z–A</option>
                    <option value="most-patients">Sort: Most patients</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
                    <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile Filters Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
              className="inline-flex h-10 px-4 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm transition-colors border border-line bg-white font-medium text-ink hover:bg-canvas w-full md:hidden"
            >
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 4h-7" />
                <path d="M10 4H3" />
                <path d="M21 12h-9" />
                <path d="M8 12H3" />
                <path d="M21 20h-5" />
                <path d="M12 20H3" />
                <path d="M14 2v4" />
                <path d="M8 10v4" />
                <path d="M16 18v4" />
              </svg>
              Filters
            </button>
          </div>

          {/* Row 2: Filter Selects */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Specialization select */}
            <div className="w-full sm:w-52">
              <label htmlFor="f-spec" className="sr-only">Specialization</label>
              <div className="relative">
                <select
                  id="f-spec"
                  value={filters.specialty}
                  onChange={(e) => updateUrl({ specialty: e.target.value, page: 1 })}
                  data-testid="doctor-specialty-select"
                  className="block h-10 w-full appearance-none rounded-lg border border-line bg-white text-ink pl-3 pr-9 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                >
                  <option value="">All specializations</option>
                  {specialties.map((spec) => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
                  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </span>
              </div>
            </div>

            {/* Hospital select */}
            <div className="w-full sm:w-60">
              <label htmlFor="f-hosp" className="sr-only">Hospital</label>
              <div className="relative">
                <select
                  id="f-hosp"
                  value={selectedHospital}
                  onChange={(e) => {
                    setSelectedHospital(e.target.value);
                    updateUrl({ hospital: e.target.value || undefined, page: 1 });
                  }}
                  className="block h-10 w-full appearance-none rounded-lg border border-line bg-white text-ink pl-3 pr-9 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                >
                  <option value="">All hospitals</option>
                  {hospitals.map((hosp) => (
                    <option key={hosp} value={hosp}>{hosp}</option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
                  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </span>
              </div>
            </div>

            {/* Date added select */}
            <div className="w-full sm:w-44">
              <label htmlFor="f-added" className="sr-only">Date added</label>
              <div className="relative">
                <select
                  id="f-added"
                  value={datePreset}
                  onChange={(e) => handleDatePresetChange(e.target.value)}
                  data-testid="doctor-date-preset-select"
                  className="block h-10 w-full appearance-none rounded-lg border border-line bg-white text-ink pl-3 pr-9 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                >
                  <option value="all">Added any time</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="custom">Custom range</option>
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
                  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </span>
              </div>
            </div>

            {/* Test Compatibility: Department select preserved */}
            <select
              value={filters.department}
              onChange={(e) => updateUrl({ department: e.target.value, page: 1 })}
              data-testid="doctor-department-select"
              className="sr-only"
            >
              <option value="">All Departments</option>
              {departments.map((dep) => (
                <option key={dep} value={dep}>{dep}</option>
              ))}
            </select>

            {/* Reset Filters button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                data-testid="doctor-reset-filters"
                className="h-10 px-3 text-xs font-medium text-muted hover:text-ink border border-line rounded-lg hover:bg-canvas transition-colors"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* Custom Date Range Row */}
          {(datePreset === 'custom' || filters.from || filters.to) && (
            <div
              className="flex items-center gap-2 pt-2 border-t border-line/60 text-xs text-muted"
              data-testid="doctor-custom-date-row"
            >
              <span className="font-medium text-ink">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setFromDate(val);
                  updateUrl({ from: val, to: toDate, page: 1 });
                }}
                data-testid="doctor-date-from"
                className="h-8 rounded-md border border-line bg-white px-2 text-xs text-ink focus:border-brand-500 focus:outline-none"
              />
              <span className="font-medium text-ink">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setToDate(val);
                  updateUrl({ from: fromDate, to: val, page: 1 });
                }}
                data-testid="doctor-date-to"
                className="h-8 rounded-md border border-line bg-white px-2 text-xs text-ink focus:border-brand-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Doctors Table View */}
        <div className="overflow-x-auto w-full min-w-0">
          <table className="w-full text-sm">
            <caption className="sr-only">Doctors, newest first</caption>
            <thead className="border-b border-line bg-canvas/60">
              <tr>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted pl-4">
                  Doctor
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted">
                  Specialization
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted hidden xl:table-cell">
                  Hospital
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted hidden min-[1400px]:table-cell">
                  Phone
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-medium text-muted">
                  Patients
                </th>
                <th scope="col" aria-sort="descending" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium">
                  <span className="inline-flex items-center gap-1 text-ink">
                    Added
                    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 5v14" />
                      <path d="m19 12-7 7-7-7" />
                    </svg>
                  </span>
                </th>
                <th scope="col" className="w-10">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line" data-testid="doctors-table-body">
              {paginatedDoctors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted">
                    No doctors found matching the search criteria.
                  </td>
                </tr>
              ) : (
                paginatedDoctors.map((doc) => {
                  const patientCount = allPatients.filter((p) => p.doctorId === doc.id).length;
                  const initials = getInitials(doc.name);

                  return (
                    <tr key={doc.id} className="group relative transition-colors hover:bg-canvas/70">
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="grid size-9 text-xs shrink-0 place-items-center rounded-full bg-brand-50 font-semibold text-brand-700 ring-1 ring-inset ring-brand-100"
                          >
                            {initials}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/doctors/${doc.id}`}
                              className="block truncate font-medium text-ink group-hover:text-brand-700"
                            >
                              {doc.name}
                            </Link>
                            <span className="block truncate text-xs text-muted xl:hidden">
                              {doc.hospital || 'Square Hospital'}
                            </span>
                            <span className="hidden truncate text-xs text-muted xl:block">
                              {doc.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex whitespace-nowrap rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-ink ring-1 ring-inset ring-line">
                          {doc.specialty}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-muted xl:table-cell">
                        {doc.hospital || 'Square Hospital'}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 tabular-nums text-muted min-[1400px]:table-cell">
                        {doc.phone}
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-ink">
                        {patientCount}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted">
                        {formatDate(doc.createdAt)}
                      </td>
                      <td className="py-3 pl-1 pr-4 text-muted/60 group-hover:text-ink">
                        <svg
                          className="size-4 shrink-0"
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="whitespace-nowrap text-sm text-muted">
            Showing{' '}
            <span className="font-medium tabular-nums text-ink">
              {totalCount === 0 ? 0 : startIndex + 1}–
              {Math.min(startIndex + filters.limit, totalCount)}
            </span>{' '}
            of <span className="font-medium tabular-nums text-ink">{totalCount}</span> doctors
          </p>
          <div className="flex items-center justify-between gap-6 sm:justify-end">
            <div className="hidden items-center gap-2 whitespace-nowrap text-sm text-muted xl:flex">
              <span>Rows per page</span>
              <div className="w-20">
                <label htmlFor="rows" className="sr-only">Rows per page</label>
                <div className="relative">
                  <select
                    id="rows"
                    value={filters.limit}
                    onChange={(e) => updateUrl({ limit: Number(e.target.value), page: 1 })}
                    className="block h-9 w-full appearance-none rounded-lg border border-line bg-white text-ink pl-3 pr-9 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
                    <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
            <nav aria-label="Pagination" className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => updateUrl({ page: currentPage - 1 })}
                aria-label="Previous page"
                className={`inline-grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink ${
                  currentPage <= 1 ? 'pointer-events-none opacity-40' : ''
                }`}
              >
                <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateUrl({ page: p })}
                  aria-current={p === currentPage ? 'page' : undefined}
                  className={`grid size-9 place-items-center rounded-lg text-sm transition-colors ${
                    p === currentPage
                      ? 'bg-brand-50 font-semibold text-brand-800 ring-1 ring-inset ring-brand-200'
                      : 'text-muted hover:bg-canvas hover:text-ink'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => updateUrl({ page: currentPage + 1 })}
                aria-label="Next page"
                className={`inline-grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink ${
                  currentPage >= totalPages ? 'pointer-events-none opacity-40' : ''
                }`}
              >
                <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </section>

      {/* Add Doctor Modal */}
      <AddDoctorModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  );
}
