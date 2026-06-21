import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './pages/Login';
import AgentDashboard from './pages/AgentDashboard';
import AdminDashboardNew from './pages/AdminDashboardNew';
import AccountantDashboard from './pages/AccountantDashboard';
import ControllerDashboard from './pages/ControllerDashboard';
// [ERP FUTUR] import LogistiqueDashboard from './pages/LogistiqueDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/agent" element={<AgentDashboard />} />
          <Route path="/admin" element={<AdminDashboardNew />} />
          <Route path="/accountant" element={<AccountantDashboard />} />
          <Route path="/controller" element={<ControllerDashboard />} />
          {/* [ERP FUTUR] <Route path="/logistique" element={<LogistiqueDashboard />} /> */}
          <Route path="/super-admin" element={<SuperAdminDashboard />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
