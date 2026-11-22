import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { UnauthorizedHandler } from './auth/UnauthorizedHandler';
import { PageLoader } from './components/PageLoader';
import { AppVersionGuard } from './components/AppVersionGuard';
import { lazyPage } from './utils/lazyPage';

const LoginPage = lazyPage(() => import('./pages/LoginPage'), 'LoginPage');
const SetPasswordPage = lazyPage(() => import('./pages/SetPasswordPage'), 'SetPasswordPage');
const LecturerDashboard = lazyPage(() => import('./pages/LecturerDashboard'), 'LecturerDashboard');
const LecturerStudentsList = lazyPage(() => import('./pages/LecturerStudentsList'), 'LecturerStudentsList');
const StudentProfile = lazyPage(() => import('./pages/StudentProfile'), 'StudentProfile');
const AttendanceManagement = lazyPage(() => import('./pages/AttendanceManagement'), 'AttendanceManagement');
const ExamTemplateSheet = lazyPage(() => import('./pages/ExamTemplateSheet'), 'ExamTemplateSheet');
const EnterResults = lazyPage(() => import('./pages/EnterResults'), 'EnterResults');
const MarksViewExport = lazyPage(() => import('./pages/MarksViewExport'), 'MarksViewExport');
const ConsolidatedResults = lazyPage(() => import('./pages/ConsolidatedResults'), 'ConsolidatedResults');
const AdminDashboard = lazyPage(() => import('./pages/AdminDashboard'), 'AdminDashboard');
const ClassSectionManagement = lazyPage(() => import('./pages/ClassSectionManagement'), 'ClassSectionManagement');
const StudentManagement = lazyPage(() => import('./pages/StudentManagement'), 'StudentManagement');
const DownloadsPage = lazyPage(() => import('./pages/DownloadsPage'), 'DownloadsPage');
const LecturerManagement = lazyPage(() => import('./pages/LecturerManagement'), 'LecturerManagement');
const ExaminationManagement = lazyPage(() => import('./pages/ExaminationManagement'), 'ExaminationManagement');
const StudentReportsPage = lazyPage(() => import('./pages/StudentReportsPage'), 'StudentReportsPage');
const FeeManagement = lazyPage(() => import('./pages/FeeManagement'), 'FeeManagement');
const AttendanceConfig = lazyPage(() => import('./pages/AttendanceConfig'), 'AttendanceConfig');
const AttendanceConfigLayout = lazyPage(
  () => import('./pages/attendanceConfig/AttendanceConfigLayout'),
  'AttendanceConfigLayout'
);
const ManageHolidaysPage = lazyPage(
  () => import('./pages/attendanceConfig/ManageHolidaysPage'),
  'ManageHolidaysPage'
);
const LecturerAccountPage = lazyPage(() => import('./pages/LecturerAccountPage'), 'LecturerAccountPage');
const AdminAccountPage = lazyPage(() => import('./pages/AdminAccountPage'), 'AdminAccountPage');
const NotificationsLayout = lazyPage(() => import('./pages/notifications/NotificationsLayout'), 'NotificationsLayout');
const AttendanceNotifications = lazyPage(
  () => import('./pages/notifications/AttendanceNotifications'),
  'AttendanceNotifications'
);
const AttendanceSectionDetail = lazyPage(
  () => import('./pages/notifications/AttendanceSectionDetail'),
  'AttendanceSectionDetail'
);
const ExamNotifications = lazyPage(() => import('./pages/notifications/ExamNotifications'), 'ExamNotifications');
const ExamNotificationDetail = lazyPage(
  () => import('./pages/notifications/ExamNotificationDetail'),
  'ExamNotificationDetail'
);
const FeeDueNotifications = lazyPage(
  () => import('./pages/notifications/FeeDueNotifications'),
  'FeeDueNotifications'
);
const FeeDueNotificationDetail = lazyPage(
  () => import('./pages/notifications/FeeDueNotificationDetail'),
  'FeeDueNotificationDetail'
);

const App = () => (
  <>
    <AppVersionGuard />
    <UnauthorizedHandler />
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute roles={['admin', 'lecturer']} allowPasswordSetup />}>
          <Route path="/set-password" element={<SetPasswordPage />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route element={<ProtectedRoute roles={['lecturer']} />}>
          <Route path="/staff" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/staff/dashboard" replace />} />
            <Route element={<ProtectedRoute roles={['lecturer']} blockFeeOnlyStaff />}>
              <Route path="dashboard" element={<LecturerDashboard />} />
              <Route path="students" element={<LecturerStudentsList />} />
              <Route path="students/:id" element={<StudentProfile />} />
              <Route path="attendance" element={<AttendanceManagement />} />
              <Route path="marks" element={<Navigate to="/staff/marks/exam-sheet" replace />} />
              <Route path="marks/exam-sheet" element={<ExamTemplateSheet />} />
              <Route path="marks/results" element={<EnterResults />} />
              <Route path="marks/results/:examId" element={<EnterResults />} />
              <Route path="marks/view" element={<MarksViewExport />} />
              <Route path="marks/view/:examId" element={<MarksViewExport />} />
              <Route path="marks/consolidated" element={<ConsolidatedResults />} />
            </Route>
            <Route path="account" element={<LecturerAccountPage />} />
            <Route element={<ProtectedRoute roles={['lecturer']} requireCanManageFees />}>
              <Route path="fees" element={<FeeManagement />} />
            </Route>
          </Route>
          <Route path="/lecturer/*" element={<Navigate to="/staff" replace />} />
        </Route>

        <Route element={<ProtectedRoute roles={['admin']} requireAdminPortal />}>
          <Route path="/admin" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route element={<ProtectedRoute roles={['admin']} requireOperationalAdmin />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="students" element={<StudentManagement />} />
              <Route path="downloads" element={<DownloadsPage />} />
              <Route path="examinations" element={<ExaminationManagement />} />
              <Route path="student-reports" element={<StudentReportsPage />} />
              <Route path="attendance-config" element={<AttendanceConfigLayout />}>
                <Route index element={<AttendanceConfig />} />
                <Route path="manage-holidays" element={<ManageHolidaysPage />} />
              </Route>
              <Route path="notifications" element={<NotificationsLayout />}>
                <Route index element={<Navigate to="/admin/notifications/attendance" replace />} />
                <Route path="attendance" element={<AttendanceNotifications />} />
                <Route path="attendance/:classId" element={<AttendanceSectionDetail />} />
                <Route path="attendance/:classId/:sectionId" element={<AttendanceSectionDetail />} />
                <Route path="exams" element={<ExamNotifications />} />
                <Route path="exams/:examId" element={<ExamNotificationDetail />} />
                <Route path="fees" element={<FeeDueNotifications />} />
                <Route path="fees/:classId" element={<FeeDueNotificationDetail />} />
                <Route path="fees/:classId/:sectionId" element={<FeeDueNotificationDetail />} />
              </Route>
              <Route path="classes" element={<ClassSectionManagement />} />
              <Route element={<ProtectedRoute roles={['admin']} requireCanManageFees requireOperationalAdmin />}>
                <Route path="fees" element={<FeeManagement />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute roles={['admin']} requireSuperAdmin />}>
              <Route path="staff" element={<LecturerManagement />} />
            </Route>
            <Route path="account" element={<AdminAccountPage />} />
            <Route path="sections" element={<Navigate to="/admin/classes" replace />} />
            <Route path="lecturers" element={<Navigate to="/admin/staff" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
    <Toaster
      position="top-right"
      richColors
      toastOptions={{
        style: { maxWidth: 'min(calc(100vw - 2rem), 24rem)' },
        classNames: { toast: 'break-words' },
      }}
    />
  </>
);

export default App;
