import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LangProvider } from './context/LangContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingSpinner from './components/common/LoadingSpinner';

import Login          from './pages/Login';
import Dashboard      from './pages/Dashboard';
import Students       from './pages/Students';
import StudentProfile from './pages/StudentProfile';
import Groups         from './pages/Groups';
import Teachers       from './pages/Teachers';
import Payments       from './pages/Payments';
import Attendance     from './pages/Attendance';
import Analytics      from './pages/Analytics';
import Schedule       from './pages/Schedule';
import Settings       from './pages/Settings';
import SalaryAdmin    from './pages/SalaryAdmin';
import StudentArchive from './pages/StudentArchive';
import Leads          from './pages/Leads';
import TeacherEarnings  from './pages/TeacherEarnings';
import AdminEarnings    from './pages/AdminEarnings';
import LessonsPage      from './pages/LessonsPage';
import CeoFinances      from './pages/CeoFinances';
import TeacherDashboard from './pages/TeacherDashboard';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return (
    <Layout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </Layout>
  );
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>;
  if (user) return <Navigate to="/" replace />;
  return children;
};

// Role-based root dispatcher — teachers get their own dashboard
const RootPage = () => {
  const { user } = useAuth();
  if (user?.role === 'teacher') return <TeacherDashboard />;
  return <Dashboard />;
};

const App = () => (
  <ThemeProvider>
    <LangProvider>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

            <Route path="/"               element={<ProtectedRoute><RootPage /></ProtectedRoute>} />
            <Route path="/students"       element={<ProtectedRoute><Students /></ProtectedRoute>} />
            <Route path="/students/:id"   element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />
            <Route path="/groups"         element={<ProtectedRoute><Groups /></ProtectedRoute>} />
            <Route path="/attendance"     element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/schedule"       element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
            <Route path="/settings"       element={<ProtectedRoute><Settings /></ProtectedRoute>} />

            <Route path="/teachers"       element={<ProtectedRoute roles={['superadmin', 'admin']}><Teachers /></ProtectedRoute>} />
            <Route path="/payments"       element={<ProtectedRoute roles={['superadmin', 'admin']}><Payments /></ProtectedRoute>} />
            <Route path="/analytics"      element={<ProtectedRoute roles={['superadmin', 'admin']}><Analytics /></ProtectedRoute>} />
            <Route path="/salary-admin"   element={<ProtectedRoute roles={['superadmin']}><SalaryAdmin /></ProtectedRoute>} />
            <Route path="/archive"        element={<ProtectedRoute roles={['superadmin', 'admin']}><StudentArchive /></ProtectedRoute>} />
            <Route path="/leads"          element={<ProtectedRoute roles={['superadmin', 'admin']}><Leads /></ProtectedRoute>} />
            <Route path="/admin-earnings" element={<ProtectedRoute roles={['superadmin']}><AdminEarnings /></ProtectedRoute>} />
            <Route path="/finances"       element={<ProtectedRoute roles={['superadmin', 'admin']}><CeoFinances /></ProtectedRoute>} />
            <Route path="/lessons"        element={<ProtectedRoute roles={['superadmin', 'admin', 'teacher']}><LessonsPage /></ProtectedRoute>} />

            <Route path="/salary"         element={<ProtectedRoute roles={['teacher']}><Navigate to="/earnings" replace /></ProtectedRoute>} />
            <Route path="/earnings"       element={<ProtectedRoute roles={['teacher']}><TeacherEarnings /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </LangProvider>
  </ThemeProvider>
);

export default App;
