'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useMockStore, computeDashboardStats } from '@/lib/mock/store';
import { useDashboardSummary, useBreakdown, useAdmissions, useTopDoctors } from './hooks';
import { CustomDatePopover } from './CustomDatePopover';

type TrendRange = '7d' | '30d' | '90d' | '12m';

export function DashboardView() {
  const [trendRange, setTrendRange] = useState<TrendRange>('30d');
  const [customRange, setCustomRange] = useState<{ from: string; to: string } | null>(null);
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  // Memoize API range params to maintain stable query key & options identity
  const apiRange = trendRange === '12m' ? '90d' : trendRange;
  const rangeParams = useMemo(
    () => ({
      range: apiRange,
      from: customRange?.from,
      to: customRange?.to,
    }),
    [apiRange, customRange?.from, customRange?.to]
  );

  // TanStack Query API hooks (active when backend is connected)
  const { data: summaryData } = useDashboardSummary(rangeParams);
  const { data: breakdownData } = useBreakdown();
  const { data: admissionsData } = useAdmissions(rangeParams);
  const { data: topDoctorsData } = useTopDoctors(10);

  // Authoritative fallback mock store (Rule 7)
  const doctors = useMockStore((state) => state.doctors);
  const patients = useMockStore((state) => state.patients);
  const localStats = useMemo(() => computeDashboardStats(doctors, patients), [doctors, patients]);

  // Unified metrics: API data preferred when populated, mock store as fallback
  const totalDoctors = summaryData?.totalDoctors ?? localStats.totalDoctors;
  const totalPatients = summaryData?.totalPatients ?? localStats.totalPatients;
  const criticalPatients = summaryData?.criticalPatients ?? localStats.criticalPatients;
  const dischargedPatients = summaryData?.dischargedPatients ?? localStats.dischargedPatients;
  const avgPatientsPerDoctor = summaryData?.avgPatientsPerDoctor ?? localStats.avgPatientsPerDoctor;
  const hospitalsCount = localStats.hospitalsCount;
  const highestCaseload = localStats.highestCaseload;
  const newPatients = summaryData?.newPatients ?? localStats.newPatients;
  const newPatientsPrevPeriod = summaryData?.newPatientsPrevPeriod ?? localStats.newPatientsPrevPeriod;
  const changePct = summaryData?.changePct ?? localStats.changePct;

  // Condition Breakdown
  const conditionBreakdown = useMemo(() => {
    if (breakdownData?.byCondition && breakdownData.byCondition.length > 0) {
      const configMap: Record<string, { label: string; color: string; bgClass: string }> = {
        critical: { label: 'Critical', color: '#F43F5E', bgClass: 'bg-rose-500' },
        under_observation: { label: 'Under observation', color: '#FBBF24', bgClass: 'bg-amber-400' },
        recovering: { label: 'Recovering', color: '#0EA5E9', bgClass: 'bg-sky-500' },
        stable: { label: 'Stable', color: '#10B981', bgClass: 'bg-emerald-500' },
        discharged: { label: 'Discharged', color: '#CBD5E1', bgClass: 'bg-slate-300' },
      };

      return breakdownData.byCondition.map((item) => {
        const cfg = configMap[item.condition] || {
          label: item.condition,
          color: '#10B981',
          bgClass: 'bg-emerald-500',
        };
        const percentage = totalPatients > 0 ? Math.round((item.count / totalPatients) * 1000) / 10 : 0;
        return {
          condition: cfg.label,
          key: item.condition,
          count: item.count,
          percentage,
          color: cfg.color,
          bgClass: cfg.bgClass,
        };
      });
    }
    return localStats.conditionBreakdown;
  }, [breakdownData, localStats.conditionBreakdown, totalPatients]);

  // Top Doctors List
  const topDoctors = useMemo(() => {
    if (topDoctorsData && topDoctorsData.length > 0) {
      const maxCount = Math.max(1, ...topDoctorsData.map((d) => d.count));
      return topDoctorsData.slice(0, 10).map((d) => ({
        doctorId: d.doctorId,
        name: d.name,
        specialization: d.specialization,
        count: d.count,
        percentage: Math.round((d.count / maxCount) * 1000) / 10,
      }));
    }
    return localStats.topDoctors;
  }, [topDoctorsData, localStats.topDoctors]);

  // Specializations Table
  const specializationTable = useMemo(() => {
    if (breakdownData?.bySpecialization && breakdownData.bySpecialization.length > 0) {
      const maxPatients = Math.max(1, ...breakdownData.bySpecialization.map((s) => s.patients));
      return breakdownData.bySpecialization.map((s) => ({
        specialization: s.specialization,
        doctors: s.doctors,
        patients: s.patients,
        perDoctor: s.doctors > 0 ? (s.patients / s.doctors).toFixed(1) : '0.0',
        percentage: Math.round((s.patients / maxPatients) * 1000) / 10,
      }));
    }
    return localStats.specializationTable;
  }, [breakdownData, localStats.specializationTable]);

  // Format Admissions Trend Chart Data (dual series)
  const currentAdmissions = admissionsData?.current;
  const previousAdmissions = admissionsData?.previous;
  const admissionsTrend = localStats.admissionsTrend;

  const chartData = useMemo(() => {
    if (currentAdmissions && currentAdmissions.length > 0) {
      return currentAdmissions.map((item, idx) => ({
        date: item.date.slice(5),
        admissions: item.count,
        previous: previousAdmissions?.[idx]?.count ?? 0,
      }));
    }

    const sliceCount =
      trendRange === '7d' ? 7 : trendRange === '30d' ? 30 : trendRange === '90d' ? 90 : 120;

    // Provide robust sample trend if local dataset is small
    const days = Math.min(sliceCount, Math.max(admissionsTrend.length, 14));
    const result = [];
    const baseDate = new Date('2026-10-30T00:00:00Z');

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(baseDate.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      const matching = admissionsTrend.find((t) => t.date.endsWith(dateKey));
      const admissions = matching ? matching.count : Math.max(1, Math.round(((i * 7 + 13) % 17) + 2));
      const previous = Math.max(0, Math.round(((i * 5 + 9) % 14) + 1));
      result.push({
        date: dateKey,
        admissions,
        previous,
      });
    }

    return result;
  }, [currentAdmissions, previousAdmissions, admissionsTrend, trendRange]);

  const handleApplyCustom = useCallback((from: string, to: string) => {
    if (from || to) {
      setCustomRange({ from, to });
    } else {
      setCustomRange(null);
    }
  }, []);

  const handleCloseCustom = useCallback(() => setIsCustomOpen(false), []);

  return (
    <div className="space-y-6">
      {/* 1. Header & Date Range Controls */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {newPatients} patients were admitted across the selected period ({trendRange.toUpperCase()}),{' '}
            {changePct}% more than the period before. {criticalPatients} patients are in critical condition
            today.
          </p>
        </div>

        <div className="relative flex w-full items-center gap-2 sm:w-auto">
          {/* Preset Buttons Group */}
          <div
            role="group"
            aria-label="Date range"
            className="flex flex-1 rounded-lg border border-line bg-white p-0.5 sm:flex-none"
          >
            {(
              [
                { label: '7 days', value: '7d' },
                { label: '30 days', value: '30d' },
                { label: '90 days', value: '90d' },
                { label: '12 months', value: '12m' },
              ] as const
            ).map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={trendRange === item.value && !customRange}
                onClick={() => {
                  setTrendRange(item.value);
                  setCustomRange(null);
                }}
                data-testid={`btn-trend-range-${item.value}`}
                className={`h-8 flex-1 whitespace-nowrap rounded-md px-2 text-sm transition-colors sm:flex-none sm:px-3 ${
                  trendRange === item.value && !customRange
                    ? 'bg-brand-50 font-semibold text-brand-800'
                    : 'font-medium text-muted hover:text-ink'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Button & Popover */}
          <button
            type="button"
            aria-label="Custom date range"
            onClick={() => setIsCustomOpen((prev) => !prev)}
            className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-line px-3 text-sm font-medium transition-colors hover:bg-canvas ${
              customRange ? 'bg-brand-50 font-semibold text-brand-800' : 'bg-white text-ink'
            }`}
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
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <path d="M16 2v4" />
              <path d="M8 2v4" />
              <path d="M3 10h18" />
            </svg>
            <span className="hidden sm:inline">
              {customRange ? `${customRange.from || 'Start'} – ${customRange.to || 'End'}` : 'Custom'}
            </span>
          </button>

          {isCustomOpen && (
            <CustomDatePopover
              onClose={handleCloseCustom}
              onApply={handleApplyCustom}
              initialFrom={customRange?.from || ''}
              initialTo={customRange?.to || ''}
            />
          )}
        </div>
      </div>

      {/* 2. 5-Card Unified Segmented KPI Grid */}
      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5">
        {/* Total Doctors */}
        <div className="bg-white p-4 sm:p-5">
          <dt className="flex items-center gap-2 text-sm text-muted">Total doctors</dt>
          <dd
            className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink"
            data-testid="kpi-total-doctors"
          >
            {totalDoctors}
          </dd>
          <dd className="mt-2 text-xs text-muted">Across {hospitalsCount} hospitals</dd>
        </div>

        {/* Total Patients */}
        <div className="bg-white p-4 sm:p-5">
          <dt className="flex items-center gap-2 text-sm text-muted">Total patients</dt>
          <dd
            className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink"
            data-testid="kpi-total-patients"
          >
            {totalPatients}
          </dd>
          <dd className="mt-2 text-xs text-muted">{dischargedPatients} discharged</dd>
        </div>

        {/* New Patients */}
        <div className="bg-white p-4 sm:p-5">
          <dt className="flex items-center gap-2 text-sm text-muted">New patients</dt>
          <dd className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink">
            {newPatients}
          </dd>
          <dd className="mt-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
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
                <path d="m22 7-8.5 8.5-5-5L2 17" />
                <path d="M16 7h6v6" />
              </svg>
              {changePct}%
            </span>{' '}
            vs previous {trendRange === '7d' ? '7' : trendRange === '30d' ? '30' : trendRange === '90d' ? '90' : '365'} days
          </dd>
        </div>

        {/* Patients Per Doctor */}
        <div className="bg-white p-4 sm:p-5">
          <dt className="flex items-center gap-2 text-sm text-muted">Patients per doctor</dt>
          <dd className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink">
            {avgPatientsPerDoctor}
          </dd>
          <dd className="mt-2 text-xs text-muted">Highest is {highestCaseload}</dd>
        </div>

        {/* Critical Now */}
        <div className="bg-white p-4 sm:p-5 col-span-2 md:col-span-1">
          <dt className="flex items-center gap-2 text-sm text-muted">
            <span aria-hidden="true" className="size-2 rounded-full bg-rose-500" />
            Critical now
          </dt>
          <dd
            className="mt-2 text-[28px] font-semibold leading-none tracking-tight tabular-nums text-ink"
            data-testid="kpi-critical-patients"
          >
            {criticalPatients}
          </dd>
          <dd className="mt-2 text-xs text-muted">
            {totalPatients > 0 ? ((criticalPatients / totalPatients) * 100).toFixed(1) : '0.0'}% of all patients
          </dd>
        </div>
      </dl>

      {/* 3. Patient Condition Breakdown */}
      <section aria-labelledby="condition-title" className="mt-6 rounded-xl border border-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6 sm:pt-6">
          <div>
            <h2 id="condition-title" className="text-base font-semibold text-ink">
              Patient condition
            </h2>
            <p className="mt-1 text-sm text-muted">All {totalPatients} patients, as of today</p>
          </div>
        </div>

        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          {/* Stacked Horizontal Progress Bar */}
          <div
            role="img"
            aria-label={`Condition mix: ${conditionBreakdown.map((c) => `${c.count} ${c.condition.toLowerCase()}`).join(', ')}`}
            className="mt-5 flex h-8 gap-0.5"
          >
            {conditionBreakdown.map((item, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === conditionBreakdown.length - 1;
              const widthPct = totalPatients > 0 ? (item.count / totalPatients) * 100 : 0;
              return (
                <div
                  key={item.condition}
                  className={`${item.bgClass} h-full transition-all duration-300 ${
                    isFirst ? 'rounded-l-lg' : ''
                  } ${isLast ? 'rounded-r-lg' : ''}`}
                  style={{
                    width: `${Math.max(widthPct > 0 ? 1 : 0, widthPct)}%`,
                    minWidth: item.count > 0 ? '6px' : '0px',
                  }}
                  title={`${item.condition}: ${item.count}`}
                />
              );
            })}
          </div>

          {/* Condition Cards Grid */}
          <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
            {conditionBreakdown.map((item) => (
              <li key={item.condition}>
                <Link
                  href={`/patients?condition=${encodeURIComponent(item.key)}`}
                  className="group -m-2 block rounded-lg p-2 transition-colors hover:bg-canvas"
                >
                  <span className="flex items-center gap-2 text-sm text-muted group-hover:text-ink">
                    <span aria-hidden="true" className={`size-2.5 rounded-full ${item.bgClass}`} />
                    {item.condition}
                  </span>
                  <span className="mt-1 block text-xl font-semibold tabular-nums text-ink">
                    {item.count}
                  </span>
                  <span className="block text-xs tabular-nums text-muted">
                    {item.percentage}% of patients
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Middle Grid: Admissions Per Day & Patients Per Doctor */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Admissions per Day Chart */}
        <section
          aria-labelledby="admissions-title"
          className="flex flex-col rounded-xl border border-line bg-white lg:col-span-2"
        >
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6 sm:pt-6">
            <div>
              <h2 id="admissions-title" className="text-base font-semibold text-ink">
                Admissions per day
              </h2>
              <p className="mt-1 text-sm text-muted">
                {newPatients} this period, {newPatientsPrevPeriod} in the{' '}
                {trendRange === '7d' ? '7' : trendRange === '30d' ? '30' : trendRange === '90d' ? '90' : '365'}{' '}
                days before
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-0.5 w-4 rounded bg-brand-600" />
                Current
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-slate-400" />
                Previous
              </span>
            </div>
          </div>

          <figure className="flex flex-1 flex-col px-5 pb-5 sm:px-6 sm:pb-6">
            <figcaption className="sr-only">
              Daily admissions from the selected period compared with the previous period.
            </figcaption>
            <div className="relative mt-8 h-60 sm:h-64 lg:h-auto lg:min-h-64 lg:flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="admissionsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0E7369" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#0E7369" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E1E7E4" />
                  <XAxis dataKey="date" stroke="#5E6C67" fontSize={11} tickLine={false} />
                  <YAxis stroke="#5E6C67" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#E1E7E4',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    }}
                  />
                  {/* Previous period: dashed line */}
                  <Area
                    type="monotone"
                    dataKey="previous"
                    stroke="#94A3A0"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    fill="none"
                    isAnimationActive={false}
                  />
                  {/* Current period: solid area with subtle gradient fill */}
                  <Area
                    type="monotone"
                    dataKey="admissions"
                    stroke="#0E7369"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#admissionsGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </figure>
        </section>

        {/* Patients Per Doctor (Top 10) */}
        <section aria-labelledby="top-title" className="rounded-xl border border-line bg-white">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6 sm:pt-6">
            <div>
              <h2 id="top-title" className="text-base font-semibold text-ink">
                Patients per doctor
              </h2>
              <p className="mt-1 text-sm text-muted">Top 10 by current patients</p>
            </div>
            <Link href="/doctors" className="text-sm font-medium text-brand-700 hover:underline">
              All doctors
            </Link>
          </div>

          <ol className="mt-3 space-y-0.5 px-3 pb-4 sm:px-4">
            {topDoctors.map((doc) => (
              <li key={doc.doctorId}>
                <Link
                  href={`/doctors/${doc.doctorId}`}
                  className="group block rounded-lg px-2 py-2 transition-colors hover:bg-canvas"
                >
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-ink group-hover:text-brand-700">{doc.name}</span>{' '}
                      <span className="text-muted">{doc.specialization}</span>
                    </span>
                    <span className="font-medium tabular-nums text-ink">{doc.count}</span>
                  </span>
                  <span aria-hidden="true" className="mt-1.5 block h-1.5 rounded-full bg-line/70">
                    <span
                      className="block h-full rounded-full bg-brand-600 transition-all duration-300"
                      style={{ width: `${Math.max(4, doc.percentage)}%` }}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* 5. Specializations Table */}
      <section aria-labelledby="spec-title" className="mt-6 overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6 sm:pt-6">
          <div>
            <h2 id="spec-title" className="text-base font-semibold text-ink">
              Specializations
            </h2>
            <p className="mt-1 text-sm text-muted">Doctors and patients in each, most patients first</p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Doctors and patients per specialization</caption>
            <thead className="border-y border-line bg-canvas/60">
              <tr>
                <th
                  scope="col"
                  className="py-2.5 pl-5 pr-3 text-left text-xs font-medium text-muted sm:pl-6"
                >
                  Specialization
                </th>
                <th scope="col" className="px-3 py-2.5 text-right text-xs font-medium text-muted">
                  Doctors
                </th>
                <th
                  scope="col"
                  className="w-1/2 py-2.5 pl-3 pr-5 text-left text-xs font-medium text-muted sm:pr-3"
                >
                  Patients
                </th>
                <th
                  scope="col"
                  className="hidden py-2.5 pl-3 pr-5 text-right text-xs font-medium text-muted sm:table-cell sm:pr-6"
                >
                  Per doctor
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {specializationTable.map((row) => (
                <tr key={row.specialization} className="transition-colors hover:bg-canvas/40">
                  <td className="py-3 pl-5 pr-3 font-medium text-ink sm:pl-6">{row.specialization}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted">{row.doctors}</td>
                  <td className="py-3 pl-3 pr-5 sm:pr-3">
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="block h-1.5 flex-1 rounded-full bg-line/70">
                        <span
                          className="block h-full rounded-full bg-brand-600 transition-all duration-300"
                          style={{ width: `${Math.max(4, row.percentage)}%` }}
                        />
                      </span>
                      <span className="w-9 text-right tabular-nums text-ink">{row.patients}</span>
                    </div>
                  </td>
                  <td className="hidden py-3 pl-3 pr-5 text-right tabular-nums text-muted sm:table-cell sm:pr-6">
                    {row.perDoctor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
