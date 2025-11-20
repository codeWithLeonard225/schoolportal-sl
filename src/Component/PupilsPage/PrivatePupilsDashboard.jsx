// AdminPanel.jsx
import React, { useState } from "react";
import { MdDashboard, MdAttachMoney, MdAssignmentTurnedIn, MdKeyboardArrowDown, MdMenuBook, MdLibraryBooks } from "react-icons/md";
import PupilPage from "./PupilPage";
import IndividualReportCardTerm1 from "./IndividualReportCardTerm1";
import PupilPastQuestionViewer from "./PupilPastQuestionViewer";
import LogoutPage from "../Admin/LogoutPage"
import PupilAttendanceNotification from "./PupilAttendanceNotification";


// Navigation Items
const NAV_ITEMS = [
  {
    key: "fees",
    label: "Fees",
    icon: <MdAttachMoney />,
  },

  {
    key: "result",
    label: "Result",
    icon: <MdAssignmentTurnedIn />, // 📚
  },
  {
    key: "library",
    label: "Library",
    icon: <MdLibraryBooks />, // 📚
  },
  {
    key: "schoolPastQuestions",
    label: "School Past Questions",
    icon: <MdMenuBook />, // 📖
  },

  {
    key: "WaecPastQuestions",
    label: "SmartPikin Waec Past Ques.",
    icon: <MdMenuBook />,
    children: [
      { key: "npse", label: "NPSE" },
      { key: "bece", label: "BECE" },
      { key: "wassce", label: "WASSCE" },
      { key: "Quiz", label: "Test Yourself (Quiz)" },
      { key: "syllabus", label: "Study syllabus" },
    ],
  },
   {
    key: "assign",
    label: "Assignment",
    icon: <MdLibraryBooks />, // 📚
  },
  // {
  //   key: "LogoutPage",
  //   label: "Logout",
  //   icon: <MdMenuBook />, // 📖
  // },
];

// Button component
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

// Placeholder Dashboard
const Dashboard = () => (
  <div className="p-6 bg-white rounded-xl shadow-md">
    <h2 className="text-2xl font-semibold text-gray-800">Welcome to School Portal!</h2>
    <p className="mt-2 text-gray-600">Select an item from the sidebar to get started.</p>
  </div>
);

// Admin Panel
function PrivatePupilsDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleDropdown = (key) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const renderNavItems = (items) =>
    items.map((item) => (
      <div key={item.key} className="mb-1">
        {item.children ? (
          <>
            <Button
              variant={openDropdown === item.key ? "default" : "ghost"}
              onClick={() => toggleDropdown(item.key)}
              className="w-full justify-start flex items-center gap-2 text-base py-2"
            >
              {item.icon} {item.label}
              <MdKeyboardArrowDown
                size={16}
                className={`ml-auto transition-transform ${openDropdown === item.key ? "rotate-180" : ""}`}
              />
            </Button>
            {openDropdown === item.key && (
              <div className="pl-6 mt-1 space-y-1">
                {item.children.map((child) => (
                  <Button
                    key={child.key}
                    variant={activeTab === child.key ? "default" : "ghost"}
                    onClick={() => setActiveTab(child.key)}
                    className="w-full justify-start text-sm py-1"
                  >
                    {child.label}
                  </Button>
                ))}
              </div>
            )}
          </>
        ) : (
          <Button
            variant={activeTab === item.key ? "default" : "ghost"}
            onClick={() => setActiveTab(item.key)}
            className="w-full justify-start flex items-center gap-2 text-base py-2"
          >
            {item.icon} {item.label}
          </Button>
        )}
      </div>
    ));

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <PupilAttendanceNotification />;
      case "fees":
        return <PupilPage />;
      case "result":
        return <IndividualReportCardTerm1 />;
      case "schoolPastQuestions":
        return <PupilPastQuestionViewer />;
      case "LogoutPage":
        return <LogoutPage />;

      default:
        return <div className="p-6 bg-white rounded-xl shadow-md">No content found.</div>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white p-4 border-r border-gray-200 shadow-lg transform transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:static md:block`}
      >
        <h2 className="text-3xl font-bold text-indigo-700 mb-6">Pupil Panel</h2>
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

export default PrivatePupilsDashboard;
