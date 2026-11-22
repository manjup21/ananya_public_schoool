import { createElement, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Activity, Bell, CalendarCheck, ClipboardList, ChevronLeft, ChevronRight, GraduationCap, School, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { fetchAdminDashboardThunk } from '../features/dashboard/dashboardSlice';
import { statusBadge } from './examinationManagement/examinationHelpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/common/PageHeader';
import { Skeleton } from '../components/ui/skeleton';
import { lastDaysRange } from '../utils/dateOnly';

/** Tight margins and a narrow Y axis so the plot uses the full card width on phones. */
const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };
const AXIS_TICK = { fontSize: 12, fill: '#6b7280' };
const PIE_COLORS = ['#2563eb', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#64748b'];

export function AdminDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const data = useSelector((s) => s.dashboard.admin);
  const status = useSelector((s) => s.dashboard.adminStatus);
  const error = useSelector((s) => s.dashboard.adminError);

  useEffect(() => {
    const r = lastDaysRange(30);
    dispatch(fetchAdminDashboardThunk(r)).unwrap().catch((e) => toast.error(String(e || 'Failed to load dashboard')));
  }, [dispatch]);

  const totals = data?.totals ?? {};
  const attendance = data?.attendance ?? {};
  const exams = data?.exams ?? {};

  const studentsByClass = useMemo(() => {
    const rows = Array.isArray(data?.students_by_class) ? data.students_by_class : [];
    return rows.map((r) => ({ name: r.class_name ?? '—', students: Number(r.students ?? 0) }));
  }, [data]);

  const absencesByDay = useMemo(() => {
    const rows = Array.isArray(attendance?.absences_by_day) ? attendance.absences_by_day : [];
    return rows.map((r) => ({
      date: String(r.date ?? '').slice(5),
      absent: Number(r.students_absent ?? 0),
    }));
  }, [attendance]);

  const absencesByDayCompact = useMemo(() => {
    // Use last 14 points for cleaner axes
    const rows = absencesByDay ?? [];
    return rows.slice(Math.max(0, rows.length - 14));
  }, [absencesByDay]);

  const upcomingExams = Array.isArray(exams?.upcoming_exams) ? exams.upcoming_exams : [];
  const [examPage, setExamPage] = useState(1);
  const examPageSize = 5;
  const examTotalPages = Math.max(1, Math.ceil(upcomingExams.length / examPageSize));
  const pagedExams = upcomingExams.slice((examPage - 1) * examPageSize, examPage * examPageSize);

  const loading = status === 'loading' || status === 'idle';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Last 30 days"
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        {[
          { label: 'Notifications', icon: Bell, color: 'text-blue-600', to: '/admin/notifications' },
          { label: 'Examinations', icon: ClipboardList, color: 'text-green-600', to: '/admin/examinations' },
        ].map((a) => (
          <Button
            key={a.to}
            type="button"
            variant="outline"
            className="h-auto min-w-0 flex-col gap-1.5 whitespace-normal bg-white px-2 py-3 sm:gap-2 sm:py-5"
            onClick={() => navigate(a.to)}
          >
            {createElement(a.icon, { className: `h-6 w-6 sm:h-8 sm:w-8 ${a.color}`, 'aria-hidden': true })}
            <span className="text-xs font-semibold leading-tight sm:text-sm">{a.label}</span>
          </Button>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{String(error)}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        {[
          { label: 'Total Students', icon: <Users className="h-5 w-5 text-blue-600" />, value: totals.students ?? 0, sub: 'Enrolled students' },
          { label: 'Total Staff', icon: <GraduationCap className="h-5 w-5 text-green-600" />, value: totals.lecturers ?? 0, sub: 'Active faculty' },
          { label: 'Classes / Sections', icon: <School className="h-5 w-5 text-purple-600" />, value: `${totals.classes ?? 0} / ${totals.sections ?? 0}`, sub: 'Configured structure' },
          { label: 'Attendance rate', icon: <TrendingUp className="h-5 w-5 text-orange-600" />, value: `${Number(attendance.attendance_rate ?? 0).toFixed(1)}%`, sub: 'Across active students' },
        ].map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-4 pb-2 sm:p-6 sm:pb-2 [&>svg]:shrink-0">
              <CardTitle className="min-h-10 text-sm font-medium leading-5 text-gray-600 sm:min-h-0">{card.label}</CardTitle>
              {card.icon}
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              {loading ? (
                <>
                  <Skeleton className="h-8 w-24 mb-1" />
                  <Skeleton className="h-3 w-32" />
                </>
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900">{card.value}</div>
                  <p className="text-xs text-gray-600 mt-1">{card.sub}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Students per class</CardTitle>          </CardHeader>
          <CardContent>
            <div className="h-56 sm:h-64 md:h-72">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Skeleton className="h-40 w-40 rounded-full" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Legend />
                    <Pie
                      data={studentsByClass.filter((x) => (x.students ?? 0) > 0)}
                      dataKey="students"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="85%"
                      paddingAngle={2}
                      stroke="#fff"
                    >
                      {studentsByClass.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Absences by day</span>
            </CardTitle>
            <CardDescription>Distinct students absent per day</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="h-56 sm:h-64 md:h-72 min-w-0">
              {loading ? (
                <div className="flex h-full flex-col justify-end gap-2 pb-4">
                  <div className="flex items-end gap-2 h-full">
                    {Array.from({ length: 14 }, (_, i) => (
                      <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${20 + ((i * 17 + 11) % 60)}%` }} />
                    ))}
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={absencesByDayCompact} margin={CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={AXIS_TICK} tickMargin={6} minTickGap={8} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} width={32} />
                    <Tooltip />
                    <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-gray-700" />
            Upcoming exams (next 7 days)
          </CardTitle>
          <CardDescription>
            Average exam performance (last 30 days):{' '}
            <span className="font-medium text-gray-900">
              {loading ? <Skeleton className="inline-block h-4 w-12 align-middle" /> : `${Number(exams.avg_exam_percentage_overall ?? 0).toFixed(1)}%`}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-3 w-56" />
                </div>
              ))}
            </div>
          ) : upcomingExams.length === 0 ? (
            <div className="text-sm text-gray-600">No upcoming exams.</div>
          ) : (
            <>
              <div className="space-y-3">
                {pagedExams.map((e) => (
                  <div key={String(e.id)} className="flex flex-col gap-1 rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium text-gray-900">{e.test_name ?? '—'}</div>
                      <Badge
                        variant={statusBadge(e.exam_status).variant}
                        className={statusBadge(e.exam_status).className || 'bg-gray-100 text-gray-800'}
                      >
                        {statusBadge(e.exam_status).label}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-600">
                      {String(e.class_name ?? '—')}
                      {e.section_code ? ` · Section ${e.section_code}` : ''} · {String(e.exam_date ?? '—')} ·{' '}
                      {String(e.start_time ?? '')}–{String(e.end_time ?? '')}
                    </div>
                  </div>
                ))}
              </div>
              {examTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {(examPage - 1) * examPageSize + 1}–{Math.min(examPage * examPageSize, upcomingExams.length)} of {upcomingExams.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" disabled={examPage <= 1} onClick={() => setExamPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 text-xs text-gray-600">{examPage} / {examTotalPages}</span>
                    <Button variant="outline" size="sm" disabled={examPage >= examTotalPages} onClick={() => setExamPage((p) => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
