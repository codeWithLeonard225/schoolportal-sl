import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AdminPanel from "./Component/Admin/AdminPanel";
import LoginPage from "./Component/Admin/LoginPage";
import Gov from "./Component/Admin/Gov";
import FeesDashboard from "./Component/Dashboard/FeesDsahboard";
import { AuthProvider } from "./Component/Security/AuthContext";
import ProtectedRoute from "./Component/Security/ProtectedRoute";
import TeacherGradesPage from "./Component/TeacherAssignment/TeacherPupilsPage";

import FeesPanel from "./Component/Admin/FeesPanel";
import CeoPanel from "./Component/CeoPanel/CeoPanel";
import PrivatePupilsDashboard from "./Component/PupilsPage/PrivatePupilsDashboard";
import GovPupilDashboard from "./Component/PupilsPage/GovPupilDashboard";
import PupilUpdate from "./Component/TeacherAssignment/PupilUpdate";
import PrintableStudentForm from "./Component/Voters/PrintableStudentForm";
import TeachersDashboard from "./Component/TeacherAssignment/TeachersDashboard";
import AttendancePage from "./Component/Voters/AttendancePage";




function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route
            path="/PrivatePupilsDashboard"
            element={
              <ProtectedRoute role="pupil">
                <PrivatePupilsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/GovPupilDashboard"
            element={
              <ProtectedRoute role="pupil">
                <GovPupilDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/registra"
            element={
              <ProtectedRoute role="admin">
                <FeesPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/gov"
            element={
              <ProtectedRoute role="admin">
                <Gov/>
              </ProtectedRoute>
            }
          />
          <Route
            path="/PupilAttendance"
            element={
              <ProtectedRoute role="admin">
                <AttendancePage/>
              </ProtectedRoute>
            }
          />
          <Route
            path="/class"
            element={
              <ProtectedRoute role="teacher">
                <PupilUpdate/>
              </ProtectedRoute>
            }
          />
          <Route
            path="/subjectTeacher"
            element={
              <ProtectedRoute role="teacher">
                <TeachersDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/special"
            element={
              <ProtectedRoute role="admin">
                <CeoPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/print-student/:studentID"
            element={
              <ProtectedRoute role="admin">
                <PrintableStudentForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/developer"
            element={<CeoPanel />}
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
