"use client";

import React, { useState, useEffect } from "react";
import {
  MdDashboard,
  MdAttachMoney,
  MdAssignmentTurnedIn,
  MdKeyboardArrowDown,
  MdMenuBook,
  MdLibraryBooks,
  MdBarChart,
  MdPerson,
  MdWarning,
} from "react-icons/md";

import TeacherGradesPage from "./TeacherPupilsPage";
import TeacherQuestionsPageObjectives from "./TeacherQuestionsPageObjectives";
import TeacherQuestionsPageTheory from "./TeacherQuestionsPageTheory";
import TeacherAssignmentPage from "./TeacherAssignmentTheory";
import TeacherTimetableReport from "./TeacherTimetableReport";
import TeacherTimetableAtt from "./TeacherTimetableAtt";
import StaffAttendanceReport from "./StaffAttendanceReport";
import LogoutPage from "../Admin/LogoutPage";

import { useAuth } from "../Security/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import FormMasterGradeSheet from "./FormMaster/FormMasterGradeSheet";
import GradeSheet from "./FormMaster/GradeSheet";
import TermResult from "./FormMaster/TermResult";
import YearlyResult from "./FormMaster/YearlyResult";
import ReportCard from "./FormMaster/ReportCard";
import PupilAttendanceLogs from "./FormMaster/PupilAttendanceLogs";


// ✅ Dynamic Sidebar Items
const getNavItems = (teacherInfo) => {
  const baseItems = [
    {
      key: "grades",
      label: "Grades",
      icon: <MdAttachMoney />,
    },
    {
      key: "TeacherQuestionsPage",
      label: "Teacher Questions Page",
      icon: <MdAssignmentTurnedIn />,
      children: [
        { key: "objectives", label: "Objectives" },
        { key: "theory", label: "Theory" },
        { key: "assignment", label: "Assignment" },
      ],
    },
    {
      key: "Timetable",
      label: "Timetable",
      icon: <MdMenuBook />,
    },
    {
      key: "TimetableAttendance",
      label: "Timetable Attendance",
      icon: <MdMenuBook />,
    },
  ];
  

  // ✅ ONLY if Form Teacher
  if (teacherInfo?.isFormTeacher) {
    baseItems.push({
      key: "results",
      label: `Form Class: ${teacherInfo.assignClass || "N/A"}`,
      icon: <MdLibraryBooks />,
      children: [
        // { key: "FormMasterGradeSheet", label: "Submitted Grades" },
        // { key: "GradeSheet", label: "GradeSheet" },
        { key: "TermResult", label: "Term Sheet" },
        // { key: "YearlyResult", label: "Yearly Result" },
        { key: "ReportCard", label: "Report Card" },
        { key: "PupilAttendanceLogs", label: "Pupil AttendanceLogs" },
      ],
    });

  }

  // ✅ Always show logout
  baseItems.push({
    key: "LogoutPage",
    label: "Logout",
    icon: <MdMenuBook />,
  });

  return baseItems;
};


// ✅ Button Component
const Button = ({ variant = "default", onClick, className = "", children }) => {
  const baseStyles =
    "inline-flex items-center justify-start whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-950 disabled:pointer-events-none disabled:opacity-50";

  const variantStyles =
    variant === "default"
      ? "bg-indigo-600 text-white shadow hover:bg-indigo-700"
      : "hover:bg-indigo-100 hover:text-indigo-700 text-gray-700";

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${variantStyles} ${className} h-9 px-4 py-2`}
    >
      {children}
    </button>
  );
};


// ✅ Main Dashboard
function TeachersDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { user } = useAuth();
  const [teacherInfo, setTeacherInfo] = useState(null);




  // ✅ Fetch teacher info (REAL-TIME)
  useEffect(() => {
    if (!user || user.role !== "teacher") return;

    const q = query(
      collection(db, "Teachers"),
      where("teacherID", "==", user.data.teacherID),
      where("schoolId", "==", user.schoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setTeacherInfo({
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
        });
      } else {
        console.warn("Teacher not found");
        setTeacherInfo({});
      }
    });

    return () => unsubscribe();
  }, [user]);


  // ✅ Loading State
  if (!teacherInfo) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-lg text-gray-600">
          Loading teacher dashboard...
        </p>
      </div>
    );
  }


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
                className={`ml-auto transition-transform ${
                  openDropdown === item.key ? "rotate-180" : ""
                }`}
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


  // ✅ Content Switcher
  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <StaffAttendanceReport />;

      case "grades":
        return <TeacherGradesPage />;

      case "objectives":
        return <TeacherQuestionsPageObjectives />;

      case "theory":
        return <TeacherQuestionsPageTheory />;

      case "assignment":
        return <TeacherAssignmentPage />;

      case "Timetable":
        return <TeacherTimetableReport />;

      case "TimetableAttendance":
        return <TeacherTimetableAtt />;

      case "FormMasterGradeSheet":
        return <FormMasterGradeSheet />;
      case "GradeSheet":
        return <GradeSheet />;

      case "TermResult":
        return <TermResult />;


      case "ReportCard":
        return <ReportCard />;

      case "YearlyResult":
        return <YearlyResult />;
      case "PupilAttendanceLogs":
        return <PupilAttendanceLogs />;

      case "LogoutPage":
        return <LogoutPage />;

      default:
        return (
          <div className="p-6 bg-white rounded-xl shadow-md">
            No content found.
          </div>
        );
    }
  };


  return (
    <div className="flex h-screen bg-gray-50 font-sans">

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white p-4 border-r border-gray-200 shadow-lg transform transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        md:translate-x-0 md:static md:block`}
      >
        <h2 className="text-3xl font-bold text-indigo-700 mb-6">
          Teacher Panel
        </h2>

        <div className="space-y-2 flex-grow">
          <Button
            variant={activeTab === "dashboard" ? "default" : "ghost"}
            onClick={() => setActiveTab("dashboard")}
            className="w-full justify-start flex items-center gap-2 text-base py-2 mb-2"
          >
            <MdDashboard /> Dashboard
          </Button>

          {renderNavItems(getNavItems(teacherInfo))}
        </div>
      </div>


      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}


      {/* Main Content */}
      <div className="flex-1 p-2 overflow-y-auto bg-gray-100">
        <div className="flex items-center justify-between mb-6 md:hidden">
          <Button
            variant="default"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? "Close Menu" : "Open Menu"}
          </Button>
        </div>

        {renderContent()}
      </div>
    </div>
  );
}

export default TeachersDashboard;