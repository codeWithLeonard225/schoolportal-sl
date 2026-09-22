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
import ClassMasterDashboard from "./Component/TeacherAssignment/ClassMasterDashboard";
import StaffAttDashboard from "./Component/Dashboard/StaffAttDashboard";
import SupervisorOneDashboard from "./Component/Dashboard/SupervisorOneDashboard";
import SupervisorThreeDashboard from "./Component/Dashboard/SupervisorThreeDashboard";
import SupervisorTwoDashboard from "./Component/Dashboard/SupervisorTwoDashboard";
import HipsaIndianDashboard from "./Component/Dashboard/HipsaIndianDashboard";
import HipsaDijaDashboard from "./Component/Dashboard/HipsaDijaDashboard";
import InternationalReg from "./Component/Dashboard/InternationalReg";
import RegisteraPannel from "./Component/Admin/RegisteraPannel";
import FinancePannel from "./Component/Admin/FinancePannel";
import FinanceJuniorPannel from "./Component/Admin/FinanceJuniorPannel";
import FinanceSeniorPannel from "./Component/Admin/FinanceSeniorPannel";
import ExamsPannel from "./Component/Admin/ExamsDashboard";
import HODPannel from "./Component/Admin/HODPannel";
import HaffizeenSecondary from "./Component/Admin/HaffizeenSecondary";
import HaffizeenPrimary from "./Component/Admin/HaffizeenPrimary";
import Yahweh from "./Component/Admin/Yahweh";
import SheikTais from "./Component/Admin/SheikTais";
import PreviousFees from "./Component/FeeReceipt.jsx/PreviousFees";




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
                <Gov />
              </ProtectedRoute>
            }
          />
          <Route
            path="/PupilAttendance"
            element={
              <ProtectedRoute role="admin">
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/StaffAttDashboard"
            element={
              <ProtectedRoute role="admin">
                <StaffAttDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/SupervisorTwoDashboard"
            element={
              <ProtectedRoute role="admin">
                <SupervisorTwoDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/SupervisorOneDashboard"
            element={
              <ProtectedRoute role="admin">
                <SupervisorOneDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/SupervisorThreeDashboard"
            element={
              <ProtectedRoute role="admin">
                <SupervisorThreeDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/HipsaIndianDashboard"
            element={
              <ProtectedRoute role="admin">
                <HipsaIndianDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/HipsaDijaDashboard"
            element={
              <ProtectedRoute role="admin">
                <HipsaDijaDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/RegisteraPannel"
            element={
              <ProtectedRoute role="admin">
                <RegisteraPannel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/FinancePannel"
            element={
              <ProtectedRoute role="admin">
                <FinancePannel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/FinanceJuniorPannel"
            element={
              <ProtectedRoute role="admin">
                <FinanceJuniorPannel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/FinanceSeniorPannel"
            element={
              <ProtectedRoute role="admin">
                <FinanceSeniorPannel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ExamsPannel"
            element={
              <ProtectedRoute role="admin">
                <ExamsPannel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/HODPannel"
            element={
              <ProtectedRoute role="admin">
                <HODPannel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/InternationalReg"
            element={
              <ProtectedRoute role="admin">
                <InternationalReg />
              </ProtectedRoute>
            }
          />
          <Route
            path="/HaffizeenSecondary"
            element={
              <ProtectedRoute role="admin">
                <HaffizeenSecondary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/HaffizeenPrimary"
            element={
              <ProtectedRoute role="admin">
                <HaffizeenPrimary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Yahweh"
            element={
              <ProtectedRoute role="admin">
                <Yahweh />
              </ProtectedRoute>
            }
          />
          <Route
            path="/SheikTais"
            element={
              <ProtectedRoute role="admin">
                <SheikTais />
              </ProtectedRoute>
            }
          />
          <Route
            path="/class"
            element={
              <ProtectedRoute role="teacher">
                <ClassMasterDashboard />
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
            element={
              <CeoPanel />
            }
          />
          <Route
            path="/previous-fees/:studentID"
            element={<PreviousFees />}
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
