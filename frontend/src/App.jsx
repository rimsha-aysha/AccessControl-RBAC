import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import { RequireAccess, RequireAuth } from './components/RouteGuards.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import RolesPage from './pages/RolesPage.jsx';
import RoleDetailsPage from './pages/RoleDetailsPage.jsx';
import RoleFormPage from './pages/RoleFormPage.jsx';
import PermissionMatrixPage from './pages/PermissionMatrixPage.jsx';
import ApprovalLevelsPage from './pages/ApprovalLevelsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import AuditLogsPage from './pages/AuditLogsPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import ModulePage from './pages/ModulePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

const admin = (element) => <RequireAccess admin>{element}</RequireAccess>;

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="modules/:moduleKey" element={<ModulePage />} />
              <Route path="reports" element={<RequireAccess permission="reports.view"><ReportsPage /></RequireAccess>} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/access-control" element={<Navigate to="/settings/access-control/roles" replace />} />
              <Route path="settings/access-control/roles" element={admin(<RolesPage />)} />
              <Route path="settings/access-control/roles/new" element={admin(<RoleFormPage key="create" mode="create" />)} />
              <Route path="settings/access-control/roles/:id" element={admin(<RoleDetailsPage />)} />
              <Route path="settings/access-control/roles/:id/edit" element={admin(<RoleFormPage key="edit" mode="edit" />)} />
              <Route path="settings/access-control/roles/:id/clone" element={admin(<RoleFormPage key="clone" mode="clone" />)} />
              <Route path="settings/access-control/permissions" element={admin(<PermissionMatrixPage />)} />
              <Route path="settings/access-control/approval-levels" element={admin(<ApprovalLevelsPage />)} />
              <Route path="settings/access-control/users" element={admin(<UsersPage />)} />
              <Route path="settings/access-control/audit-logs" element={admin(<AuditLogsPage />)} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
