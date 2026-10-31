'use client';

import { useState, useTransition, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCurrentUser } from '@/features/auth/hooks';
import { useMockStore, classifyPatientCondition } from '@/lib/mock/store';
import { parsePatientFilters, buildQueryString, getDatePresetRange } from '@/lib/url/filters';
import { EditPatientModal } from '@/components/modals/EditPatientModal';
import { DeletePatientModal } from '@/components/modals/DeletePatientModal';
import { Patient } from '@/types';

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function renderConditionBadge(patient: Patient) {
  const norm = (patient.condition || '').toLowerCase();
  const statusNorm = (patient.status || '').toLowerCase();

  if (statusNorm === 'critical' || norm.includes('critical')) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-rose-50 text-rose-700 ring-rose-600/20">
        <span className="size-1.5 rounded-full bg-rose-500" aria-hidden="true" />
        Critical
      </span>
    );
  }
  if (
    norm.includes('observ') ||
    norm.includes('unstable') ||
    norm.includes('angina') ||
    norm.includes('severe') ||
    norm.includes('heart') ||
    norm.includes('arrhythmia') ||
    norm.includes('migraine')
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-amber-50 text-amber-800 ring-amber-600/25">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        Under observation
      </span>
    );
  }
  if (
    norm.includes('recov') ||
    norm.includes('repair') ||
    norm.includes('pericarditis') ||
    norm.includes('neoplasm') ||
    norm.includes('ligament') ||
    norm.includes('neuro') ||
    norm.includes('bronchitis')
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-sky-50 text-sky-800 ring-sky-600/20">
        <span className="size-1.5 rounded-full bg-sky-500" aria-hidden="true" />
        Recovering
      </span>
    );
  }
  if (statusNorm === 'recovered' || norm.includes('discharg') || norm.includes('failure')) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-slate-100 text-slate-600 ring-slate-500/20">
        <span className="size-1.5 rounded-full bg-slate-400" aria-hidden="true" />
        Discharged
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-emerald-50 text-emerald-800 ring-emerald-600/20">
      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
      Stable
    </span>
  );
}

function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, '...', totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, '...', totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, '...', currentPage, '...', totalPages];
}

export function PatientsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';

  const [sortBy, setSortBy] = useState('newest');
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);

  // Read URL filters
  const filters = parsePatientFilters(searchParams);
  const [genderFilter, setGenderFilter] = useState(() => searchParams.get('gender') || '');

  // Active date preset state
  const [datePreset, setDatePreset] = useState<string>(() => {
    if (filters.from || filters.to) return 'custom';
    return 'all';
  });
  const [fromDate, setFromDate] = useState(filters.from);
  const [toDate, setToDate] = useState(filters.to);

  // Authoritative data from store
  const allPatients = useMockStore((state) => state.patients);
  const allDoctors = useMockStore((state) => state.doctors);

  // URL update helper
  const updateUrl = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      startTransition(() => {
        const current = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : searchParams;
        const newQuery = buildQueryString(current, updates);
        router.replace(`/patients${newQuery}`);
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
        updateUrl({ from: '', to: '' });
      } else if (preset === '7d' || preset === '30d') {
        const range = getDatePresetRange(preset);
        setFromDate(range.from);
        setToDate(range.to);
        updateUrl({ from: range.from, to: range.to });
      }
    },
    [updateUrl]
  );

  const handleResetFilters = useCallback(() => {
    setDatePreset('all');
    setFromDate('');
    setToDate('');
    setGenderFilter('');
    router.replace('/patients');
  }, [router]);

  // Filter patients based on URL search params & controls
  const filteredPatients = useMemo(() => {
    return allPatients.filter((pat) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchName = pat.name.toLowerCase().includes(q);
        const matchCondition = pat.condition.toLowerCase().includes(q);
        const matchDoctor = pat.doctorName.toLowerCase().includes(q);
        const matchPhone = pat.phone ? pat.phone.toLowerCase().includes(q) : false;
        const matchDiagnosis = pat.diagnosis ? pat.diagnosis.toLowerCase().includes(q) : false;
        if (!matchName && !matchCondition && !matchDoctor && !matchPhone && !matchDiagnosis) return false;
      }

      if (filters.status) {
        const s = filters.status.toLowerCase();
        const classified = classifyPatientCondition(pat).toLowerCase();
        const patStatus = (pat.status || '').toLowerCase();
        const patCond = (pat.condition || '').toLowerCase();
        const matchStatus =
          patStatus === s ||
          (s === 'recovered' && (patStatus === 'recovered' || classified === 'recovering' || classified === 'discharged')) ||
          (s === 'recovering' && (classified === 'recovering' || patStatus === 'recovered'));
        const matchClassified = classified === s;
        const matchCond = patCond.includes(s);
        if (!matchStatus && !matchClassified && !matchCond) return false;
      }

      if (genderFilter) {
        if (pat.gender?.toLowerCase() !== genderFilter.toLowerCase()) return false;
      }

      if (filters.doctorId && pat.doctorId !== filters.doctorId) {
        return false;
      }

      if (filters.condition && !pat.condition.toLowerCase().includes(filters.condition.toLowerCase())) {
        return false;
      }

      // Dual Match date filtering: matches either admissionDate OR createdAt within range
      const admittedDate = pat.admitted ? pat.admitted.split('T')[0] : '';
      const createdDate = pat.createdAt ? pat.createdAt.split('T')[0] : '';

      if (filters.from) {
        const matchFrom = (admittedDate && admittedDate >= filters.from) || (createdDate && createdDate >= filters.from);
        if (!matchFrom) return false;
      }
      if (filters.to) {
        const matchTo = (admittedDate && admittedDate <= filters.to) || (createdDate && createdDate <= filters.to);
        if (!matchTo) return false;
      }

      return true;
    });
  }, [allPatients, filters.search, filters.status, filters.doctorId, filters.condition, filters.from, filters.to, genderFilter]);

  // Apply Sorting
  const sortedPatients = useMemo(() => {
    return [...filteredPatients].sort((a, b) => {
      if (sortBy === 'newest') {
        const dateA = a.admitted || a.admissionDate || a.createdAt || '';
        const dateB = b.admitted || b.admissionDate || b.createdAt || '';
        return dateB.localeCompare(dateA);
      }
      if (sortBy === 'oldest') {
        const dateA = a.admitted || a.admissionDate || a.createdAt || '';
        const dateB = b.admitted || b.admissionDate || b.createdAt || '';
        return dateA.localeCompare(dateB);
      }
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'age-desc') {
        return b.age - a.age;
      }
      if (sortBy === 'age-asc') {
        return a.age - b.age;
      }
      return 0;
    });
  }, [filteredPatients, sortBy]);

  // Pagination
  const totalCount = sortedPatients.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.limit));
  const currentPage = Math.min(filters.page, totalPages);
  const startIndex = (currentPage - 1) * filters.limit;
  const paginatedPatients = sortedPatients.slice(startIndex, startIndex + filters.limit);

  const selectedDoctorObj = allDoctors.find((d) => d.id === filters.doctorId);

  const hasActiveFilters = Boolean(
    filters.search || filters.status || filters.doctorId || filters.condition || genderFilter || filters.from || filters.to
  );

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Patients</h1>
          <p className="mt-1 text-sm text-muted">
            {allPatients.length.toLocaleString()} patients. To add one, open their doctor&apos;s page.
          </p>
        </div>
      </div>

      {/* Unified Section: Patient List */}
      <section aria-label="Patient list" className="rounded-xl border border-line bg-white mt-6 overflow-hidden [contain:paint] min-w-0 max-w-full">
        {/* Filter Toolbar */}
        <div className="space-y-3 border-b border-line p-4">
          {/* Row 1: Search & Desktop Sort */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* Search Input */}
            <div className="w-full md:max-w-md">
              <div className="relative w-full">
                <label htmlFor="q" className="sr-only">
                  Search patients
                </label>
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
                  onChange={(e) => updateUrl({ search: e.target.value })}
                  placeholder="Search name, phone or diagnosis"
                  data-testid="patient-search-input"
                  className="block h-10 w-full rounded-lg border border-line bg-white px-3 pl-9 text-sm text-ink placeholder:text-muted/80 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                />
              </div>
            </div>

            {/* Desktop Sort Dropdown */}
            <div className="hidden md:ml-auto md:block">
              <div className="w-60">
                <label htmlFor="f-sort" className="sr-only">
                  Sort by
                </label>
                <div className="relative">
                  <select
                    id="f-sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="block h-10 w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-9 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                  >
                    <option value="newest">Sort: Newest admission</option>
                    <option value="oldest">Sort: Oldest admission</option>
                    <option value="name-asc">Sort: Name A–Z</option>
                    <option value="age-desc">Sort: Age, oldest first</option>
                    <option value="age-asc">Sort: Age, youngest first</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
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
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Condition, Gender, Doctor, Date Range */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Condition Select */}
            <div className="w-full sm:w-48">
              <label htmlFor="f-cond" className="sr-only">
                Condition
              </label>
              <div className="relative">
                <select
                  id="f-cond"
                  value={filters.status || ''}
                  onChange={(e) => updateUrl({ status: e.target.value })}
                  data-testid="patient-status-select"
                  className="block h-10 w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-9 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                >
                  <option value="">All conditions</option>
                  <option value="Stable">Stable</option>
                  <option value="Under observation">Under observation</option>
                  <option value="Critical">Critical</option>
                  <option value="Recovering">Recovering</option>
                  <option value="Recovered" className="hidden">Recovered</option>
                  <option value="Discharged">Discharged</option>
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
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
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </div>
            </div>

            {/* Gender Select */}
            <div className="w-full sm:w-36">
              <label htmlFor="f-gender" className="sr-only">
                Gender
              </label>
              <div className="relative">
                <select
                  id="f-gender"
                  value={genderFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setGenderFilter(val);
                    updateUrl({ gender: val || null });
                  }}
                  className="block h-10 w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-9 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                >
                  <option value="">Any gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
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
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </div>
            </div>

            {/* Doctor Select */}
            <div className="w-full sm:w-56">
              <label htmlFor="f-doc" className="sr-only">
                Doctor
              </label>
              <div className="relative">
                <select
                  id="f-doc"
                  value={filters.doctorId || ''}
                  onChange={(e) => updateUrl({ doctorId: e.target.value })}
                  data-testid="patient-doctor-select"
                  className="block h-10 w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-9 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                >
                  <option value="">All doctors</option>
                  {allDoctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
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
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </div>
            </div>

            {/* Date Preset Select */}
            <div className="w-full sm:w-44">
              <label htmlFor="f-admitted" className="sr-only">
                Admitted
              </label>
              <div className="relative">
                <select
                  id="f-admitted"
                  value={datePreset}
                  onChange={(e) => handleDatePresetChange(e.target.value)}
                  data-testid="patient-date-preset-select"
                  className="block h-10 w-full appearance-none rounded-lg border border-line bg-white text-ink pl-3 pr-9 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                >
                  <option value="all">Admitted any time</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="custom">Custom range</option>
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
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
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </div>
            </div>

            {/* Reset Filters button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                data-testid="patient-reset-filters"
                aria-label="Reset Filters"
                className="h-10 px-3 text-xs font-medium text-muted hover:text-ink border border-line rounded-lg hover:bg-canvas transition-colors cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Custom Date Range Row */}
          {(datePreset === 'custom' || filters.from || filters.to) && (
            <div
              className="flex items-center gap-2 pt-2 border-t border-line/60 text-xs text-muted"
              data-testid="patient-custom-date-row"
            >
              <span className="font-medium text-ink">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setFromDate(val);
                  updateUrl({ from: val, to: toDate });
                }}
                data-testid="patient-date-from"
                className="h-8 rounded-md border border-line bg-white px-2 text-xs text-ink focus:border-brand-500 focus:outline-none"
              />
              <span className="font-medium text-ink">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setToDate(val);
                  updateUrl({ from: fromDate, to: val });
                }}
                data-testid="patient-date-to"
                className="h-8 rounded-md border border-line bg-white px-2 text-xs text-ink focus:border-brand-500 focus:outline-none"
              />
            </div>
          )}

          {/* Row 3: Active Filter Badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {filters.search && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-brand-800 ring-1 ring-inset ring-brand-200">
                  Search: {filters.search}
                  <button
                    type="button"
                    onClick={() => updateUrl({ search: '' })}
                    aria-label="Remove filter: search"
                    className="grid size-6 place-items-center rounded-full hover:bg-brand-100"
                  >
                    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {filters.status && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-brand-800 ring-1 ring-inset ring-brand-200">
                  Condition: {filters.status}
                  <button
                    type="button"
                    onClick={() => updateUrl({ status: '' })}
                    aria-label="Remove filter: condition"
                    className="grid size-6 place-items-center rounded-full hover:bg-brand-100"
                  >
                    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {genderFilter && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-brand-800 ring-1 ring-inset ring-brand-200 capitalize">
                  Gender: {genderFilter}
                  <button
                    type="button"
                    onClick={() => {
                      setGenderFilter('');
                      updateUrl({ gender: null });
                    }}
                    aria-label="Remove filter: gender"
                    className="grid size-6 place-items-center rounded-full hover:bg-brand-100"
                  >
                    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {selectedDoctorObj && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-brand-800 ring-1 ring-inset ring-brand-200">
                  Doctor: {selectedDoctorObj.name}
                  <button
                    type="button"
                    onClick={() => updateUrl({ doctorId: '' })}
                    aria-label="Remove filter: doctor"
                    className="grid size-6 place-items-center rounded-full hover:bg-brand-100"
                  >
                    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </span>
              )}
              {(filters.from || filters.to) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-brand-800 ring-1 ring-inset ring-brand-200">
                  Admitted {formatDate(filters.from)} – {formatDate(filters.to)}
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset('all');
                      setFromDate('');
                      setToDate('');
                      updateUrl({ from: '', to: '' });
                    }}
                    aria-label="Remove filter: date range"
                    className="grid size-6 place-items-center rounded-full hover:bg-brand-100"
                  >
                    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Patients Table View */}
        <div className="overflow-x-auto w-full min-w-0">
          <table className="w-full text-sm">
            <caption className="sr-only">Patients list</caption>
            <thead className="border-b border-line bg-canvas/60">
              <tr>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted pl-4">
                  Patient
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted hidden sm:table-cell">
                  Gender and age
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted">
                  Condition
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted">
                  Doctor
                </th>
                <th scope="col" aria-sort="descending" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium hidden md:table-cell">
                  <span className="inline-flex items-center gap-1 text-ink">
                    Admitted
                    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 5v14" />
                      <path d="m19 12-7 7-7-7" />
                    </svg>
                  </span>
                </th>
                {isAdmin && (
                  <th scope="col" className="w-24">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line" data-testid="patients-table-body">
              {paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-8 text-center text-muted">
                    No patients found matching the search criteria.
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((pat) => (
                  <tr key={pat.id} className="transition-colors hover:bg-canvas/70" data-testid={`patient-row-${pat.id}`}>
                    <td className="whitespace-nowrap py-3 pl-4 pr-3">
                      <span className="block font-medium text-ink">{pat.name}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted capitalize hidden sm:table-cell">
                      {pat.gender}, {pat.age}
                    </td>
                    <td className="px-3 py-3">
                      {renderConditionBadge(pat)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <Link href={`/doctors/${pat.doctorId}`} className="text-ink hover:text-brand-700 hover:underline">
                        {pat.doctorName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted hidden md:table-cell">
                      {formatDate(pat.admitted || pat.admissionDate)}
                    </td>
                    {isAdmin && (
                      <td className="py-2 pl-3 pr-3">
                        <div className="flex justify-end gap-0.5">
                          <Link
                            href={`/patients/${pat.id}/edit`}
                            role="button"
                            aria-label={`Edit ${pat.name}`}
                            data-testid={`btn-edit-patient-${pat.id}`}
                            className="inline-grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink cursor-pointer"
                          >
                            <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeletingPatient(pat)}
                            aria-label={`Delete ${pat.name}`}
                            data-testid={`btn-delete-patient-${pat.id}`}
                            className="inline-grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                          >
                            <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="whitespace-nowrap text-sm text-muted">
            Showing <span className="font-medium tabular-nums text-ink">{totalCount === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + filters.limit, totalCount)}</span> of{' '}
            <span className="font-medium tabular-nums text-ink">{totalCount}</span> patients
          </p>
          <div className="flex items-center justify-between gap-6 sm:justify-end">
            {/* Rows Per Page */}
            <div className="hidden items-center gap-2 whitespace-nowrap text-sm text-muted xl:flex">
              <span>Rows per page</span>
              <div className="w-20">
                <label htmlFor="rows" className="sr-only">
                  Rows per page
                </label>
                <div className="relative">
                  <select
                    id="rows"
                    value={filters.limit}
                    onChange={(e) => updateUrl({ limit: Number(e.target.value), page: 1 })}
                    className="block h-9 w-full appearance-none rounded-lg border border-line bg-white pl-3 pr-9 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
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

            {/* Pagination Navigation */}
            <nav aria-label="Pagination" className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => updateUrl({ page: currentPage - 1 })}
                className={`inline-grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink ${
                  currentPage <= 1 ? 'pointer-events-none opacity-40' : ''
                }`}
              >
                <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              {getPageNumbers(currentPage, totalPages).map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="grid size-9 place-items-center text-sm text-muted" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <button
                    key={`page-${p}`}
                    type="button"
                    aria-current={currentPage === p ? 'page' : undefined}
                    onClick={() => updateUrl({ page: p as number })}
                    className={`grid size-9 place-items-center rounded-lg text-sm font-medium transition-colors ${
                      currentPage === p
                        ? 'bg-brand-50 font-semibold text-brand-800 ring-1 ring-inset ring-brand-200'
                        : 'text-muted hover:bg-canvas hover:text-ink'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                aria-label="Next page"
                disabled={currentPage >= totalPages}
                onClick={() => updateUrl({ page: currentPage + 1 })}
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

      {/* Edit & Delete Modals */}
      <EditPatientModal
        isOpen={!!editingPatient}
        onClose={() => setEditingPatient(null)}
        patient={editingPatient}
      />
      <DeletePatientModal
        isOpen={!!deletingPatient}
        onClose={() => setDeletingPatient(null)}
        patient={deletingPatient}
      />
    </div>
  );
}
