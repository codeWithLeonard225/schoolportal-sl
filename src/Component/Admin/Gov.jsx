// AdminPanel.jsx
import React, { useState, useEffect } from "react";
import {
  MdDashboard,
  MdBook,
  MdPeople,
  MdAssignment,
  MdEdit,
  MdKeyboardArrowDown,
  MdPerson,
  MdAttachMoney,
  MdAssignmentTurnedIn,
  MdBarChart,
  MdFormatListBulleted,
  MdDescription,
  MdTrendingUp,
  MdWarning,
  MdCheckCircle,
  MdRemoveCircle,
} from "react-icons/md";
import Registration from "../Voters/Registration";
import ClassRegistration from "./ClassRegistration";
import Testing from "./Testing";
import FeeReceipt from "../FeeReceipt.jsx/FeeReceipt";
import FeesCostPage from "../FeeReceipt.jsx/FeesCostPage";
import FeesDashboard from "../Dashboard/FeesDsahboard";
import SubjectPage from "../SubjectPage/SubjectPage";
import TeacherAssignmentPage from "../TeacherAssignment/TeacherAssignmentPage";
import TeacherRegistration from "../Voters/TeacherRegistration";
import TeacherPupilsPageAdmin from "../TeacherAssignment/TeacherPupilsPageAdmin";
import GradeSheetPage from "../TeacherAssignment/GradeSheetPage";
import SubGradeMatrixPage from "../TeacherAssignment/SubGradeMatrixPage";
import ClassFullTermMatrixPage from "../TeacherAssignment/ClassFullTermMatrixPage";
import GeneralReportCard from "../PupilsPage/GeneralReportCard";
import SchoolRegistration from "../CeoPanel/SchoolRegistration"
import AdminForm from "../CeoPanel/AdminForm"
import RegDashboard from "../Dashboard/RegDashboard"
import StudentFilterPage from "../Voters/StudentFilterPage";
import TeacherAssignmentReport from "../TeacherAssignment/TeacherAssignmentReport";
import PastQuestions from "../Admin/PastQuestionUpload";
import PupilIDCard from "../Voters/PupilIDCard";
import IDCardPage from "../Voters/IDCardPage";
import LogoutPage from "../Admin/LogoutPage"
import AttendancePage from "../Voters/AttendancePage";
import AttendancePageClass from "../TeacherAssignment/AttendancePageClass";
import StaffAttendanceSimple from "../TeacherAssignment/StaffAttendance";



// --- Navigation Items ---
const NAV_ITEMS = [
  {
    key: "forms",
    label: "Registeration",
    icon: <MdEdit />,
    children: [
      { key: "Form", label: " Pupils", icon: <MdPerson /> },
      { key: "class", label: " Class", icon: <MdPerson /> },
      { key: "classList", label: "Class List", icon: <MdPerson /> },
    ],
  },

  {
    key: "Staff",
    label: "staff",
    icon: <MdBarChart />,
    children: [
      { key: "TeacherRegistration", label: "Teacher Regis", icon: <MdPerson /> },
      { key: "subjects", label: "Subjects", icon: <MdPerson /> },
      { key: "TeacherAssignment", label: "Teacher Assignment", icon: <MdPerson /> },
      { key: "TeacherAssignmentReport", label: "Teacher Assignment Report ", icon: <MdPerson /> },
      { key: "PastQuestions", label: "Upload Past Questions ", icon: <MdPerson /> },



    ],
  },
  {
    key: "results",
    label: "Pupils Results",
    icon: <MdBarChart />,
    children: [
      // { key: "GradeSheetPage", label: "Test Grade Sheet", icon: <MdPerson /> },
      { key: "TeacherPupilsPageAdmin", label: "TeacherPupilsGrade", icon: <MdPerson /> },
      { key: "SubGradeMatrixPage", label: "Sub Grade Sheet", icon: <MdPerson /> },
      { key: "ClassFullTermMatrixPage", label: "Term Grade Sheet", icon: <MdPerson /> },
      { key: "GeneralReportCard", label: "ReportCard", icon: <MdPerson /> },
      // { key: "Testing", label: "Testing", icon: <MdPerson /> },

    ],
  },
  {
    key: "idcards",
    label: "Pupils ID Cards",
    icon: <MdBarChart />,
    children: [
      { key: "PupilIDCard", label: "PupilIDCard", icon: <MdPerson /> },
      { key: "IDCardPage", label: "IDCardPage", icon: <MdPerson /> },

      // { key: "Testing", label: "Testing", icon: <MdPerson /> },

    ],
  },
  {
    key: "pupilAttendance",
    label: "Pupil Attendance",
    icon: <MdWarning />, // 📖
  },
  {
    key: "staffAttendance",
    label: "Staff Attendance",
    icon: <MdWarning />, // 📖
  },

  {
    key: "LogoutPage",
    label: "Logout",
    icon: <MdWarning />, // 📖
  },

];

// --- Button component ---
const Button = ({ variant = "default", onClick, className = "", children }) => {
  let baseStyles =
    "inline-flex items-center justify-start whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-950 disabled:pointer-events-none disabled:opacity-50";
  let variantStyles =
    variant === "default"
      ? "bg-indigo-600 text-white shadow hover:bg-indigo-700"
      : "hover:bg-indigo-100 hover:text-indigo-700 text-gray-700";

  return (
    <button onClick={onClick} className={`${baseStyles} ${variantStyles} ${className} h-9 px-4 py-2`}>
      {children}
    </button>
  );
};

// --- Placeholder Dashboard ---
const Dashboard = () => (
  <div className="p-6 bg-white rounded-xl shadow-md">
    <h2 className="text-2xl font-semibold text-gray-800">Welcome to Admin Dashboard!</h2>
    <p className="mt-2 text-gray-600">Select an item from the sidebar to get started.</p>
  </div>
);

// --- Main Admin Panel ---
function Gov() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [openNestedDropdowns, setOpenNestedDropdowns] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleNestedDropdown = (key) => {
    setOpenNestedDropdowns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderNavItems = (items, level = 0) =>
    items.map((item) => (
      <div key={item.key} className={level > 0 ? `pl-${level * 4} pt-1` : ""}>
        {item.children ? (
          <>
            <Button
              variant={openNestedDropdowns[item.key] ? "default" : "ghost"}
              onClick={() => toggleNestedDropdown(item.key)}
              className={`w-full justify-start flex items-center gap-2 py-2 ${level === 0 ? "text-base" : "text-sm"}`}
            >
              {item.icon} {item.label}
              <MdKeyboardArrowDown
                size={16}
                className={`ml-auto transition-transform ${openNestedDropdowns[item.key] ? "rotate-180" : ""}`}
              />
            </Button>
            {openNestedDropdowns[item.key] && <div className="space-y-1">{renderNavItems(item.children, level + 1)}</div>}
          </>
        ) : (
          <Button
            variant={activeTab === item.key ? "default" : "ghost"}
            onClick={() => setActiveTab(item.key)}
            className={`w-full justify-start flex items-center gap-2 py-1 ${level === 0 ? "text-base" : "text-sm"}`}
          >
            {item.icon} {item.label}
          </Button>
        )}
      </div>
    ));

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard": return <RegDashboard />;
      case "Form": return <Registration />;
      case "class": return <ClassRegistration />;
      case "classList": return <StudentFilterPage />;
      case "fees": return <FeeReceipt />;
      case "feesCost": return <FeesCostPage />;
      case "TeacherRegistration": return <TeacherRegistration />;
      case "subjects": return <SubjectPage />;
      case "TeacherAssignment": return <TeacherAssignmentPage />;
      case "GradeSheetPage": return <GradeSheetPage />;
      case "GeneralReportCard": return <GeneralReportCard />;
      case "SubGradeMatrixPage": return <SubGradeMatrixPage />;
      case "ClassFullTermMatrixPage": return <ClassFullTermMatrixPage />;
      case "Testing": return <Testing />;
      case "AdminForm": return <AdminForm />;
      case "TeacherAssignmentReport": return <TeacherAssignmentReport />;
      case "TeacherPupilsPageAdmin": return <TeacherPupilsPageAdmin />;
      case "PastQuestions": return <PastQuestions />;
      case "PupilIDCard": return <PupilIDCard />;
      case "IDCardPage": return <IDCardPage />;
      case "LogoutPage": return <LogoutPage />;
      case "staffAttendance": return <StaffAttendanceSimple />;
      case "pupilAttendance": return <AttendancePage />;




      case "schoolreg": return <SchoolRegistration />;

      default: return <Placeholder title={activeTab} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white p-4 border-r border-gray-200 shadow-lg transform transition-transform duration-300 
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static md:block`}
      >
        <h2 className="text-3xl font-bold text-indigo-700 mb-6">Admin Panel</h2>
        <div className="space-y-2 flex-grow">
          <Button
            variant={activeTab === "dashboard" ? "default" : "ghost"}
            onClick={() => setActiveTab("dashboard")}
            className="w-full justify-start flex items-center gap-2 text-base py-2 mb-2"
          >
            <MdDashboard /> Dashboard
          </Button>
          {renderNavItems(NAV_ITEMS)}
        </div>
      </div>

      {/* Overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main Content */}
      <div className="flex-1 p-2 overflow-y-auto bg-gray-100">
        {/* Toggle Button (mobile only) */}
        <div className="flex items-center justify-between mb-6 md:hidden">
          <Button variant="default" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? "Close Menu" : "Open Menu"}
          </Button>
        </div>

        {renderContent()}
      </div>
    </div>
  );
}

export default Gov;
