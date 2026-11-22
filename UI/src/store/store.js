import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import lecturersReducer from '../features/lecturers/lecturersSlice';
import classesReducer from '../features/classes/classesSlice';
import subjectsReducer from '../features/subjects/subjectsSlice';
import examTypesReducer from '../features/examTypes/examTypesSlice';
import studentsReducer from '../features/students/studentsSlice';
import examinationsReducer from '../features/examinations/examinationsSlice';
import attendancePatternsReducer from '../features/attendancePatterns/attendancePatternsSlice';
import examResultsReducer from '../features/examResults/examResultsSlice';
import lecturerAttendanceReducer from '../features/attendance/lecturerAttendanceSlice';
import lecturerStudentsReducer from '../features/lecturerStudents/lecturerStudentsSlice';
import dashboardReducer from '../features/dashboard/dashboardSlice';
import lecturerAccountReducer from '../features/lecturerAccount/lecturerAccountSlice';
import schoolHolidaysReducer from '../features/schoolHolidays/schoolHolidaysSlice';
import feesReducer from '../features/fees/feesSlice';
import notificationsReducer from '../features/notifications/notificationsSlice';
export const store = configureStore({
  reducer: {
    auth: authReducer,
    lecturers: lecturersReducer,
    classes: classesReducer,
    subjects: subjectsReducer,
    examTypes: examTypesReducer,
    students: studentsReducer,
    examinations: examinationsReducer,
    examResults: examResultsReducer,
    attendancePatterns: attendancePatternsReducer,
    lecturerAttendance: lecturerAttendanceReducer,
    lecturerStudents: lecturerStudentsReducer,
    dashboard: dashboardReducer,
    lecturerAccount: lecturerAccountReducer,
    schoolHolidays: schoolHolidaysReducer,
    fees: feesReducer,
    notifications: notificationsReducer,
  },
});

