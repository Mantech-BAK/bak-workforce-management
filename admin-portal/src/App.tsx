import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import EnrollmentLogPage from './pages/EnrollmentLogPage';
import AttendancePage from './pages/AttendancePage';
import PlaceholderPage from './pages/PlaceholderPage';
import type { PageId } from './navigation';

function Portal() {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState<PageId>('dashboard');

  if (!isAuthenticated) return <LoginPage />;

  let content: React.ReactNode;
  switch (page) {
    case 'dashboard':
      content = <DashboardPage />;
      break;
    case 'employees':
      content = <EmployeesPage />;
      break;
    case 'attendance':
      content = <AttendancePage />;
      break;
    case 'tasks':
      content = <PlaceholderPage icon="tasks" title="Tasks" description="Assign, monitor, and complete field tasks. Track progress and completion rates by team or individual." />;
      break;
    case 'exceptions':
      content = <PlaceholderPage icon="exceptions" title="Exceptions" description="Review and resolve workforce exceptions including geofence violations, GPS anomalies, and missing punches." />;
      break;
    case 'enrollment':
      content = <EnrollmentLogPage />;
      break;
    case 'reports':
      content = <PlaceholderPage icon="reports" title="Reports" description="Generate and export workforce analytics reports covering attendance, compliance, geofence activity, and enrollment trends." />;
      break;
    default:
      content = <DashboardPage />;
  }

  return (
    <Layout current={page} onNavigate={setPage}>
      {content}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Portal />
    </AuthProvider>
  );
}
