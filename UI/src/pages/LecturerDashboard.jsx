import { createElement, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { PageHeader } from '../components/common/PageHeader';
import { Skeleton } from '../components/ui/skeleton';
import { ClipboardCheck, FileText, TrendingUp, Users } from 'lucide-react';
import { fetchLecturerDashboardThunk } from '../features/dashboard/dashboardSlice';
import { statusBadge } from './examinationManagement/examinationHelpers';
import { lastDaysRange } from '../utils/dateOnly';

/** Tight margins and a narrow Y axis so the plot uses the full card width on phones. */
const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };
const AXIS_TICK = { fontSize: 12, fill: '#6b7280' };
const STATUS_COLORS = {
  scheduled: '#2563eb',
  completed: '#10b981',
  cancelled: '#ef4444',
  other: '#64748b',
};

export function LecturerDashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const data = useSelector((s) => s.dashboard.lecturer);
  const status = useSelector((s) => s.dashboard.lecturerStatus);
  const error = useSelector((s) => s.dashboard.lecturerError);

  useEffect(() => {
    const r = lastDaysRange(30);
    dispatch(fetchLecturerDashboardThunk(r)).unwrap().catch((e) => toast.error(String(e || 'Failed to load dashboard')));
  }, [dispatch]);

  const totals = data?.totals ?? {};
  const attendance = data?.attendance ?? {};
  const exams = data?.exams ?? {};

  const absencesByDay = useMemo(() => {
    const rows = Array.isArray(attendance?.absences_by_day) ? attendance.absences_by_day : [];
    return rows.map((r) => ({
      date: String(r.date ?? '').slice(5),
      absent: Number(r.students_absent ?? 0),
    }));
  }, [attendance]);

  const upcomingExams = Array.isArray(exams?.upcoming_exams) ? exams.upcoming_exams : [];

  const absencesByDayCompact = useMemo(() => {
    const rows = absencesByDay ?? [];
    return rows.slice(Math.max(0, rows.length - 14));
  }, [absencesByDay]);

  const examsByStatus = useMemo(() => {
    const rows = Array.isArray(exams?.exams_by_status) ? exams.exams_by_status : [];
    return rows
      .map((r) => {
        const raw = String(r.exam_status ?? 'other').toLowerCase();
        return {
          status: statusBadge(raw).label,
          statusKey: raw,
          count: Number(r.count ?? 0),
        };
      })
      .filter((x) => x.count > 0);
  }, [exams]);

  const loading = status === 'loading' || status === 'idle';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Welcome Back!"
        description="Last 30 days"
      />

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: 'Mark Attendance', icon: ClipboardCheck, color: 'text-blue-600', to: '/staff/attendance' },
          { label: 'Enter Marks', icon: FileText, color: 'text-green-600', to: '/staff/marks/results' },
          { label: 'View Students', icon: Users, color: 'text-purple-600', to: '/staff/students' },
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
          { label: 'Total Students', icon: <Users className="h-5 w-5 text-blue-600" />, value: totals.students ?? 0, sub: 'Across all classes' },
          { label: 'Attendance rate', icon: <ClipboardCheck className="h-5 w-5 text-green-600" />, value: `${Number(attendance.attendance_rate ?? 0).toFixed(1)}%`, sub: 'Across active students' },
          { label: 'Absences recorded', icon: <FileText className="h-5 w-5 text-purple-600" />, value: Number(attendance.absent_sessions_total ?? attendance.absent_days_total ?? 0), sub: 'Absent sessions' },
          { label: 'Avg. performance', icon: <TrendingUp className="h-5 w-5 text-orange-600" />, value: `${Number(exams.avg_exam_percentage_overall ?? 0).toFixed(1)}%`, sub: 'From published results' },
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
            <CardTitle>Absences by day</CardTitle>
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
                  <BarChart data={absencesByDayCompact} margin={CHART_MARGIN}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={AXIS_TICK} tickMargin={6} minTickGap={8} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} width={32} />
                    <Tooltip />
                    <Bar dataKey="absent" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exams by status</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
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
                    data={examsByStatus}
                    dataKey="count"
                    nameKey="status"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    stroke="#fff"
                  >
                    {examsByStatus.map((x) => (
                      <Cell
                        key={x.statusKey}
                        fill={STATUS_COLORS[x.statusKey] ?? STATUS_COLORS.other}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              )}
            </div>

            {upcomingExams.length ? (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Upcoming exams</div>
                {upcomingExams.slice(0, 3).map((e) => (
                  <div key={String(e.id)} className="rounded-md border border-gray-100 bg-white px-3 py-2 text-sm">
                    <div className="font-medium text-gray-900">{e.test_name ?? '—'}</div>
                    <div className="text-gray-600">
                      {e.class_name ?? '—'}
                      {e.section_code ? ` · Section ${e.section_code}` : ''} · {String(e.exam_date ?? '—')}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
