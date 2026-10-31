'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCurrentUser } from '@/features/auth/hooks';
import { useMockStore } from '@/lib/mock/store';
import { DeletePatientModal } from '@/components/modals/DeletePatientModal';
import { Patient } from '@/types';

interface DoctorDetailViewProps {
  doctorId: string;
}

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

function getConditionBadge(condition: string, status: string) {
  const norm = `${status} ${condition}`.toLowerCase();
  if (norm.includes('crit') || norm.includes('infarction') || norm.includes('cardiomyopathy')) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-rose-50 text-rose-700 ring-rose-600/20">
        <span className="size-1.5 rounded-full bg-rose-500" aria-hidden="true" />
        Critical
      </span>
    );
  }
  if (norm.includes('observ') || norm.includes('unstable') || norm.includes('angina') || norm.includes('evaluation')) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-amber-50 text-amber-800 ring-amber-600/25">
        <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        Under observation
      </span>
    );
  }
  if (norm.includes('recov') || norm.includes('repair') || norm.includes('pericarditis')) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-sky-50 text-sky-800 ring-sky-600/20">
        <span className="size-1.5 rounded-full bg-sky-500" aria-hidden="true" />
        Recovering
      </span>
    );
  }
  if (norm.includes('discharg') || norm.includes('failure')) {
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

export function DoctorDetailView({ doctorId }: DoctorDetailViewProps) {
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === 'admin';
  const doctors = useMockStore((state) => state.doctors);
  const patients = useMockStore((state) => state.patients);

  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientCondition, setPatientCondition] = useState('');
  const [patientDateFilter, setPatientDateFilter] = useState('all');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const doctor = useMemo(() => doctors.find((d) => d.id === doctorId), [doctors, doctorId]);
  const assignedPatients = useMemo(
    () => patients.filter((p) => p.doctorId === doctorId),
    [patients, doctorId]
  );

  const initials = useMemo(() => (doctor ? getInitials(doctor.name) : 'DR'), [doctor]);

  // Filter assigned patients
  const filteredPatients = useMemo(() => {
    return assignedPatients.filter((pat) => {
      if (patientSearch) {
        const q = patientSearch.toLowerCase();
        const matchName = pat.name.toLowerCase().includes(q);
        const matchCond = pat.condition ? pat.condition.toLowerCase().includes(q) : false;
        const matchDiag = pat.diagnosis ? pat.diagnosis.toLowerCase().includes(q) : false;
        if (!matchName && !matchCond && !matchDiag) return false;
      }
      if (patientCondition) {
        const statusMatch = pat.status.toLowerCase() === patientCondition.toLowerCase();
        const condMatch = pat.condition ? pat.condition.toLowerCase().includes(patientCondition.toLowerCase()) : false;
        if (!statusMatch && !condMatch) return false;
      }
      return true;
    });
  }, [assignedPatients, patientSearch, patientCondition]);

  const criticalCount = useMemo(
    () =>
      assignedPatients.filter((p) =>
        (p.status || '').toLowerCase().includes('crit')
      ).length,
    [assignedPatients]
  );

  if (!doctor) {
    return (
      <div className="space-y-4 py-12 text-center">
        <h2 className="text-xl font-semibold text-ink">Doctor Not Found</h2>
        <p className="text-sm text-muted">The requested physician profile could not be located.</p>
        <div>
          <Link
            href="/doctors"
            className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white hover:bg-brand-700"
          >
            &larr; Return to Doctors Directory
          </Link>
        </div>
      </div>
    );
  }

  const totalPatients = filteredPatients.length;
  const totalPages = Math.max(1, Math.ceil(totalPatients / rowsPerPage));
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * rowsPerPage;
  const paginatedPatients = filteredPatients.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      {/* Doctor Header Card */}
      <section
        aria-labelledby="doctor-name"
        className="rounded-xl border border-line bg-white overflow-hidden min-w-0 max-w-full"
      >
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="grid size-14 text-base shrink-0 place-items-center rounded-full bg-brand-50 font-semibold text-brand-700 ring-1 ring-inset ring-brand-100"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <h1
                id="doctor-name"
                data-testid="doctor-name-heading"
                className="text-2xl font-semibold tracking-tight text-ink"
              >
                {doctor.name}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span className="inline-flex whitespace-nowrap rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-ink ring-1 ring-inset ring-line">
                  {doctor.specialty}
                </span>
                <span data-testid="doctor-caseload-count" className="text-sm text-muted">
                  {assignedPatients.length} active patients
                </span>
              </div>
            </div>
          </div>
          {isAdmin && (
            <Link
              href={`/doctors/${doctor.id}/edit`}
              data-testid="btn-edit-doctor"
              className="inline-flex h-10 px-4 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm transition-colors border border-line bg-white font-medium text-ink hover:bg-canvas self-start sm:self-auto cursor-pointer"
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
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
              Edit doctor
            </Link>
          )}
        </div>

        {/* 1px Dividing Border Metadata Grid */}
        <dl className="grid gap-px border-t border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 bg-white px-5 py-4 sm:px-6">
            <dt className="flex items-center gap-2 text-xs text-muted">
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
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Phone
            </dt>
            <dd className="mt-1 truncate text-sm font-medium text-ink">
              <a href={`tel:${doctor.phone}`} className="text-brand-700 hover:underline">
                {doctor.phone}
              </a>
            </dd>
          </div>
          <div className="min-w-0 bg-white px-5 py-4 sm:px-6">
            <dt className="flex items-center gap-2 text-xs text-muted">
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
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              Email
            </dt>
            <dd className="mt-1 truncate text-sm font-medium text-ink">
              <a href={`mailto:${doctor.email}`} className="text-brand-700 hover:underline">
                {doctor.email}
              </a>
            </dd>
          </div>
          <div className="min-w-0 bg-white px-5 py-4 sm:px-6">
            <dt className="flex items-center gap-2 text-xs text-muted">
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
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
                <path d="M10 6h4" />
                <path d="M10 10h4" />
                <path d="M10 14h4" />
                <path d="M10 18h4" />
              </svg>
              Hospital
            </dt>
            <dd className="mt-1 truncate text-sm font-medium text-ink">
              {doctor.hospital || 'Square Hospital'}
            </dd>
          </div>
          <div className="min-w-0 bg-white px-5 py-4 sm:px-6">
            <dt className="flex items-center gap-2 text-xs text-muted">
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
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M16 2v4" />
                <path d="M8 2v4" />
                <path d="M3 10h18" />
              </svg>
              Added
            </dt>
            <dd className="mt-1 truncate text-sm font-medium text-ink">
              {formatDate(doctor.createdAt)}
            </dd>
          </div>
        </dl>
      </section>

      {/* Assigned Patients Section */}
      <section
        aria-labelledby="patients-title"
        className="rounded-xl border border-line bg-white mt-6 overflow-hidden [contain:paint] min-w-0 max-w-full"
      >
        {/* Section Header */}
        <div className="flex flex-col gap-4 px-4 pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div>
            <h2 id="patients-title" className="text-base font-semibold text-ink">
              Patients
            </h2>
            <p className="mt-1 text-sm text-muted">
              {assignedPatients.length} patients. {criticalCount} critical, {assignedPatients.length} registered.
            </p>
          </div>
          {isAdmin && (
            <Link
              href={`/doctors/${doctor.id}/patients/new`}
              data-testid="btn-assign-patient"
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
              Add patient
            </Link>
          )}
        </div>

        {/* Filter Toolbar */}
        <div className="border-y border-line p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="w-full md:max-w-xs">
              <div className="relative w-full">
                <label htmlFor="pq" className="sr-only">Search this doctor&apos;s patients</label>
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
                  id="pq"
                  type="search"
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search name or diagnosis"
                  className="block h-10 w-full rounded-lg border bg-white px-3 text-sm text-ink placeholder:text-muted/80 focus:outline-none focus:ring-4 border-line focus:border-brand-500 focus:ring-brand-500/15 pl-9"
                />
              </div>
            </div>

            <div className="hidden shrink-0 items-center gap-2 md:ml-auto md:flex">
              <div className="w-48">
                <label htmlFor="p-cond" className="sr-only">Condition</label>
                <div className="relative">
                  <select
                    id="p-cond"
                    value={patientCondition}
                    onChange={(e) => {
                      setPatientCondition(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block h-10 w-full appearance-none rounded-lg border border-line bg-white text-ink pl-3 pr-9 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                  >
                    <option value="">All conditions</option>
                    <option value="Stable">Stable</option>
                    <option value="Under observation">Under observation</option>
                    <option value="Critical">Critical</option>
                    <option value="Recovering">Recovering</option>
                    <option value="Discharged">Discharged</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
                    <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </div>
              </div>

              <div className="w-48">
                <label htmlFor="p-adm" className="sr-only">Admitted</label>
                <div className="relative">
                  <select
                    id="p-adm"
                    value={patientDateFilter}
                    onChange={(e) => {
                      setPatientDateFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="block h-10 w-full appearance-none rounded-lg border border-line bg-white text-ink pl-3 pr-9 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15"
                  >
                    <option value="all">Admitted any time</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
                    <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
              className="inline-flex h-10 px-4 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm transition-colors border border-line bg-white font-medium text-ink hover:bg-canvas w-full md:hidden cursor-pointer"
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

          {/* Mobile Filter Dropdowns */}
          {isMobileFiltersOpen && (
            <div className="flex flex-col gap-2 pt-3 md:hidden">
              <select
                value={patientCondition}
                onChange={(e) => {
                  setPatientCondition(e.target.value);
                  setCurrentPage(1);
                }}
                className="block h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-brand-500 focus:outline-none"
              >
                <option value="">All conditions</option>
                <option value="Stable">Stable</option>
                <option value="Under observation">Under observation</option>
                <option value="Critical">Critical</option>
                <option value="Recovering">Recovering</option>
                <option value="Discharged">Discharged</option>
              </select>
              <select
                value={patientDateFilter}
                onChange={(e) => {
                  setPatientDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="block h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-brand-500 focus:outline-none"
              >
                <option value="all">Admitted any time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>
          )}
        </div>

        {/* Patients Table View */}
        <div className="overflow-x-auto w-full min-w-0">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Patients of {doctor.name}, newest admission first
            </caption>
            <thead className="border-b border-line bg-canvas/60">
              <tr>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted pl-4">
                  Patient
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted">
                  Gender and age
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted">
                  Condition
                </th>
                <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-muted hidden xl:table-cell">
                  Diagnosis
                </th>
                <th scope="col" aria-sort="descending" className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium">
                  <span className="inline-flex items-center gap-1 text-ink">
                    Admitted
                    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 5v14" />
                      <path d="m19 12-7 7-7-7" />
                    </svg>
                  </span>
                </th>
                {isAdmin && (
                  <th scope="col" className="w-12">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line" data-testid="assigned-patients-body">
              {paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-8 text-center text-muted">
                    No patients currently assigned to this doctor matching criteria.
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((pat) => (
                  <tr key={pat.id} className="transition-colors hover:bg-canvas/70">
                    <td className="whitespace-nowrap py-3 pl-4 pr-3">
                      <span className="block font-medium text-ink">{pat.name}</span>
                      <span className="block text-xs text-muted xl:hidden">
                        {pat.condition || 'Observation'}
                      </span>
                      <span className="hidden text-xs tabular-nums text-muted xl:block">
                        {pat.phone || '+880 1712-000000'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">
                      {pat.gender ? pat.gender.charAt(0).toUpperCase() + pat.gender.slice(1) : 'Male'}, {pat.age}
                    </td>
                    <td className="px-3 py-3">
                      {getConditionBadge(pat.condition, pat.status)}
                    </td>
                    <td className="hidden px-3 py-3 text-muted xl:table-cell">
                      {pat.condition || 'General follow-up'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">
                      {formatDate(pat.admitted || pat.admissionDate)}
                    </td>
                    {isAdmin && (
                      <td className="py-2 pl-3 pr-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/patients/${pat.id}/edit`}
                            role="button"
                            data-testid={`btn-edit-patient-${pat.id}`}
                            aria-label={`Edit ${pat.name}`}
                            className="inline-grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink cursor-pointer"
                          >
                            <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeletingPatient(pat)}
                            aria-label={`Delete ${pat.name}`}
                            className="inline-grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
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

        {/* Pagination Bar */}
        <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="whitespace-nowrap text-sm text-muted">
            Showing{' '}
            <span className="font-medium tabular-nums text-ink">
              {totalPatients === 0 ? 0 : startIndex + 1}–
              {Math.min(startIndex + rowsPerPage, totalPatients)}
            </span>{' '}
            of <span className="font-medium tabular-nums text-ink">{totalPatients}</span> patients
          </p>
          <div className="flex items-center justify-between gap-6 sm:justify-end">
            <div className="hidden items-center gap-2 whitespace-nowrap text-sm text-muted xl:flex">
              <span>Rows per page</span>
              <div className="w-20">
                <label htmlFor="prows" className="sr-only">Rows per page</label>
                <div className="relative">
                  <select
                    id="prows"
                    value={rowsPerPage}
                    onChange={(e) => {
                      setRowsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
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
                disabled={page <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
                className={`inline-grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink ${
                  page <= 1 ? 'pointer-events-none opacity-40' : ''
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
                  onClick={() => setCurrentPage(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={`grid size-9 place-items-center rounded-lg text-sm transition-colors ${
                    p === page
                      ? 'bg-brand-50 font-semibold text-brand-800 ring-1 ring-inset ring-brand-200'
                      : 'text-muted hover:bg-canvas hover:text-ink'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
                className={`inline-grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-ink ${
                  page >= totalPages ? 'pointer-events-none opacity-40' : ''
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

      {/* Delete Patient Modal */}
      <DeletePatientModal
        isOpen={!!deletingPatient}
        onClose={() => setDeletingPatient(null)}
        patient={deletingPatient}
      />
    </div>
  );
}
