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
import ClassRegistration from "../Admin/ClassRegistration";
import FeeReceipt from "../FeeReceipt.jsx/FeeReceipt";
import FeesCostPage from "../FeeReceipt.jsx/FeesCostPage";
import FeesDashboard from "../Dashboard/FeesDsahboard";
import SubjectPage from "../SubjectPage/SubjectPage";
import TeacherAssignmentPage from "../TeacherAssignment/TeacherAssignmentPage";
import TeacherRegistration from "../Voters/TeacherRegistration";
import TeacherPupilsPage from "../TeacherAssignment/TeacherPupilsPage";
import GradeSheetPage from "../TeacherAssignment/GradeSheetPage";
import GeneralReportCard from "../PupilsPage/GeneralReportCard";
import SchoolRegistration from "./SchoolRegistration"
import AdminForm from "./AdminForm"
import UpdateNamesToUppercase from "./UpdateNamesToUppercase"
import RegDashboard from "../Dashboard/RegDashboard"
import NationalResultPage from "./NationalResultPage";
import BECEStatementOfResult from "./BECEStatementOfResult";
import SubjectData from "./SubjectData";


// --- Navigation Items ---
const NAV_ITEMS = [
  {
    key: "forms",
    label: "Registeration",
    icon: <MdEdit />,
    children: [
      { key: "Form", label: " Pupils", icon: <MdPerson /> },
      { key: "class", label: " Class", icon: <MdPerson /> },
    ],
  },
  {
    key: "fees",
    label: "Fees",
    icon: <MdEdit />,
    children: [
      { key: "fees", label: " PupilsFees", icon: <MdPerson /> },
      { key: "feesCost", label: " feesUpdate", icon: <MdPerson /> },
    ],
  },
  {
    key: "Staff",
    label: "staff",
    icon: <MdBarChart />,
    children: [
    { key: "TeacherRegistration", label: "Teacher Regis", icon: <MdPerson /> },
     { key: "SubjectData", label: "SubjectData", icon: <MdPerson /> },
    { key: "subjects", label: "Subjects", icon: <MdPerson /> },
    { key: "TeacherAssignment", label: "Teacher Assignment", icon: <MdPerson /> },
    { key: "GradeSheetPage", label: "Grade Sheet", icon: <MdPerson /> },
    { key: "GeneralReportCard", label: "ReportCard", icon: <MdPerson /> },
     
    ],
  },
   {
    key: "ceo",
    label: "CEO",
    icon: <MdEdit />,
    children: [
      { key: "schoolreg", label: " School Reg", icon: <MdPerson /> },
      { key: "AdminForm", label: " Admin Form", icon: <MdPerson /> },
      { key: "UpdateNamesToUppercase", label: " UpdateNamesToUppercase", icon: <MdPerson /> },
      { key: "NationalResultPage", label: " NationalResultPage", icon: <MdPerson /> },
      { key: "BECEStatementOfResult", label: " BECEStatementOfResult", icon: <MdPerson /> },
    ],
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
function CeoPanel() {
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
      case "fees": return <FeeReceipt />;
      case "feesCost": return <FeesCostPage />;
      case "TeacherRegistration": return <TeacherRegistration />;
      case "subjects": return <SubjectPage />;
      case "SubjectData": return <SubjectData />;
      case "TeacherAssignment": return <TeacherAssignmentPage />;
      case "TeacherPupilsPage": return <TeacherPupilsPage />;
      case "GradeSheetPage": return <GradeSheetPage />;
      case "GeneralReportCard": return <GeneralReportCard />;
      case "AdminForm": return <AdminForm />;
      case "UpdateNamesToUppercase": return <UpdateNamesToUppercase />;
      case "NationalResultPage": return <NationalResultPage />;
      case "BECEStatementOfResult": return <BECEStatementOfResult />;
    
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

export default CeoPanel;
