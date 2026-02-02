import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { LoginPage } from './components/pages/LoginPage';
import { LandingPage } from './components/pages/LandingPage';
import { ForgotPasswordPage } from './components/pages/ForgotPasswordPage';
import { ResetPasswordPage } from './components/pages/ResetPasswordPage';
import { ThemeProvider } from './components/shared/context/ThemeContext';
import { supabase } from './lib/supabaseClient';
import LoadingFallback from './components/shared/LoadingFallback';

// Lazy load dashboard components to optimize initial load time
const ExecutiveDashboard = React.lazy(() => import('./components/pages/ExecutiveDashboard').then(module => ({ default: module.ExecutiveDashboard })));
const ManagerDashboard = React.lazy(() => import('./components/pages/ManagerDashboard').then(module => ({ default: module.ManagerDashboard })));
const TeamLeadDashboard = React.lazy(() => import('./components/pages/TeamLeadDashboard').then(module => ({ default: module.TeamLeadDashboard })));
const EmployeeDashboard = React.lazy(() => import('./components/pages/EmployeeDashboard').then(module => ({ default: module.EmployeeDashboard })));
// @ts-ignore
const FullRankingPage = React.lazy(() => import('./components/performance/FullRankingPage'));

function App() {
    useEffect(() => {
        const checkConnection = async () => {
            // ... existing check logic ...
        };
        checkConnection();
    }, []);

    return (
        <Router>
            <Suspense fallback={<LoadingFallback />}>
                <Routes>
                    <Route path="/" element={<LandingPage />} />

                    {/* Wrap application routes with ThemeProvider */}
                    <Route element={<ThemeProvider><Outlet /></ThemeProvider>}>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/executive-dashboard/*" element={<ExecutiveDashboard />} />
                        <Route path="/manager-dashboard/*" element={<ManagerDashboard />} />
                        <Route path="/teamlead-dashboard/*" element={<TeamLeadDashboard />} />
                        <Route path="/employee-dashboard/*" element={<EmployeeDashboard />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                    </Route>
                </Routes>
            </Suspense>
        </Router>
    );
}

export default App;
