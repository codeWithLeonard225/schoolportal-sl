import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../Security/AuthContext";

const AttendanceDashboard = () => {
  const { user } = useAuth();
  const currentSchoolId = user?.schoolId || "";

  // Filter States
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  // Data States
  const [academicYears, setAcademicYears] = useState([]);
  const [classes, setClasses] = useState([]);
  const [allSchoolPupils, setAllSchoolPupils] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);

  // Search filter for right side panel
  const [pupilSearchQuery, setPupilSearchQuery] = useState("");

  // ==========================================================
  // 1. FETCH PUPILS, CLASSES, AND ACADEMIC YEARS
  // ==========================================================
  useEffect(() => {
    if (!currentSchoolId) return;

    const pupilsQuery = query(
      collection(db, "PupilsReg"),
      where("schoolId", "==", currentSchoolId)
    );

    const unsubscribe = onSnapshot(
      pupilsQuery,
      (snapshot) => {
        const pupilsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setAllSchoolPupils(pupilsData);

        // Extract Unique Classes
        const extractedClasses = Array.from(
          new Set(
            pupilsData
              .map((p) => p.class || p.className || "")
              .filter(Boolean)
          )
        ).sort();

        // Extract Unique Academic Years
        const extractedYears = Array.from(
          new Set(
            pupilsData
              .map((p) => p.academicYear || p.academic_year || "")
              .filter(Boolean)
          )
        ).sort();

        setClasses(extractedClasses);
        setAcademicYears(extractedYears);

        // Auto-select latest Academic Year if not selected
        if (extractedYears.length > 0 && !selectedAcademicYear) {
          setSelectedAcademicYear(extractedYears[extractedYears.length - 1]);
        }

        // Auto-select first Class if not selected
        if (extractedClasses.length > 0 && !selectedClass) {
          setSelectedClass(extractedClasses[0]);
        }
      },
      (error) => {
        console.error("Error loading pupil data:", error);
      }
    );

    return () => unsubscribe();
  }, [currentSchoolId]);

  // ==========================================================
  // 2. FETCH ATTENDANCE LOGS FOR SELECTED DATE & SCHOOL
  // ==========================================================
  useEffect(() => {
    if (!currentSchoolId || !selectedDate) {
      setAttendanceLogs([]);
      return;
    }

    const attendanceQuery = query(
      collection(db, "AttendanceLogs"),
      where("schoolId", "==", currentSchoolId),
      where("date", "==", selectedDate)
    );

    const unsubscribe = onSnapshot(
      attendanceQuery,
      (snapshot) => {
        const logs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAttendanceLogs(logs);
      },
      (error) => {
        console.error("Error fetching attendance logs:", error);
      }
    );

    return () => unsubscribe();
  }, [currentSchoolId, selectedDate]);

  // ==========================================================
  // 3. COMPUTED: CLASS MATRIX SUMMARY (LEFT SIDE)
  // ==========================================================
  const classMatrixSummary = useMemo(() => {
    if (!selectedAcademicYear) return [];

    // Filter pupils enrolled in the selected academic year
    const activePupils = allSchoolPupils.filter((p) => {
      const year = p.academicYear || p.academic_year || "";
      return year === selectedAcademicYear;
    });

    return classes.map((className) => {
      const pupilsInClass = activePupils.filter(
        (p) => (p.class || p.className || "") === className
      );

      const totalPupils = pupilsInClass.length;

      // Match logs for this class
      const classLogs = attendanceLogs.filter(
        (l) => (l.class || l.className || "") === className
      );

      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let excuseCount = 0;

      // Map pupil IDs to check for records
      const pupilLoggedIds = new Set();

      classLogs.forEach((log) => {
        const studentId = String(
          log.studentID || log.pupilID || log.studentId || ""
        );

        if (studentId) pupilLoggedIds.add(studentId);

        const status = String(log.status || "").trim().toLowerCase();

        if (status === "present") presentCount++;
        else if (status === "late") lateCount++;
        else if (status === "excused" || status === "excuse") excuseCount++;
        else if (status === "absent") absentCount++;
      });

      // Pupils without an attendance record are automatically considered Absent
      const unrecordedPupils = totalPupils - pupilLoggedIds.size;
      const totalAbsent = absentCount + (unrecordedPupils > 0 ? unrecordedPupils : 0);

      return {
        className,
        totalPupils,
        presentCount,
        lateCount,
        absentCount: totalAbsent,
        excuseCount,
        hasActivity: classLogs.length > 0,
      };
    });
  }, [allSchoolPupils, attendanceLogs, classes, selectedAcademicYear]);

  // ==========================================================
  // 4. COMPUTED: DETAILED PUPILS BREAKDOWN (RIGHT SIDE)
  // ==========================================================
  const rightPanelPupilBreakdown = useMemo(() => {
    if (!selectedClass || !selectedAcademicYear) {
      return { present: [], late: [], absent: [] };
    }

    // 1. Get all pupils registered under selected Class and Academic Year
    const classPupils = allSchoolPupils.filter((p) => {
      const matchClass = (p.class || p.className || "") === selectedClass;
      const matchYear =
        (p.academicYear || p.academic_year || "") === selectedAcademicYear;
      return matchClass && matchYear;
    });

    // 2. Map existing attendance logs for this class
    const attendanceMap = new Map();
    attendanceLogs.forEach((log) => {
      const logClass = log.class || log.className || "";
      if (logClass === selectedClass) {
        const studentId = String(
          log.studentID || log.pupilID || log.studentId || ""
        );
        if (studentId) {
          attendanceMap.set(studentId, log);
        }
      }
    });

    // 3. Categorize pupils
    const present = [];
    const late = [];
    const absent = [];

    classPupils.forEach((pupil) => {
      const pupilId = String(
        pupil.studentID || pupil.pupilID || pupil.studentId || pupil.id || ""
      );

      const log = attendanceMap.get(pupilId);
      const nameMatch = (pupil.studentName || pupil.pupilName || pupil.name || "")
        .toLowerCase()
        .includes(pupilSearchQuery.toLowerCase());

      if (!nameMatch) return;

      const basePupilObj = {
        id: pupilId,
        name: pupil.studentName || pupil.pupilName || pupil.name || "Unnamed Pupil",
        photoUrl: pupil.userPhotoUrl || pupil.photoUrl || pupil.photo || "",
        studentID: pupil.studentID || pupilId,
        clockInTime: log?.clockInTime || null,
        status: log?.status || "Absent",
        note: log?.note || "",
      };

      if (log) {
        const status = String(log.status || "").toLowerCase();
        if (status === "present") {
          present.push(basePupilObj);
        } else if (status === "late") {
          late.push(basePupilObj);
        } else {
          absent.push(basePupilObj);
        }
      } else {
        // Automatic absence
        absent.push(basePupilObj);
      }
    });

    return { present, late, absent };
  }, [
    allSchoolPupils,
    attendanceLogs,
    selectedClass,
    selectedAcademicYear,
    pupilSearchQuery,
  ]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 font-sans">
      {/* HEADER SECTION */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Attendance Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time tracking and class breakdown for your institution
          </p>
        </div>

        {/* TOP GLOBAL FILTERS */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker (Defaults to Today) */}
          <div className="flex items-center bg-slate-100/80 px-3 py-2 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 mr-2 uppercase tracking-wider">
              Date:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer"
            />
          </div>

          {/* Academic Year Dropdown */}
          <div className="flex items-center bg-slate-100/80 px-3 py-2 rounded-xl border border-slate-200">
            <span className="text-xs font-semibold text-slate-500 mr-2 uppercase tracking-wider">
              Year:
            </span>
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="" disabled>
                Select Year
              </option>
              {academicYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* MAIN SPLIT LAYOUT (LEFT & RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ======================================================== */}
        {/* LEFT SIDE: CLASS LEVEL MATRIX TABLE                      */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200/80 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Class Summary Matrix
              </h2>
              <p className="text-xs text-slate-500">
                Attendance breakdown by class for {selectedDate}
              </p>
            </div>
            <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
              {classMatrixSummary.length} Active Classes
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200/60 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Class Name</th>
                  <th className="py-3.5 px-3 text-center">Total Pupils</th>
                  <th className="py-3.5 px-3 text-center text-emerald-700">Present</th>
                  <th className="py-3.5 px-3 text-center text-amber-700">Late</th>
                  <th className="py-3.5 px-3 text-center text-rose-700">Absent</th>
                  <th className="py-3.5 px-3 text-center text-blue-700">Excused</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classMatrixSummary.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-400">
                      No active classes found for the selected Academic Year.
                    </td>
                  </tr>
                ) : (
                  classMatrixSummary.map((item) => {
                    const isSelected = selectedClass === item.className;
                    return (
                      <tr
                        key={item.className}
                        onClick={() => setSelectedClass(item.className)}
                        className={`cursor-pointer transition-colors hover:bg-indigo-50/40 ${
                          isSelected ? "bg-indigo-50/80 font-medium" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? "bg-indigo-600" : "bg-slate-300"
                            }`}
                          ></span>
                          <span className="font-semibold text-slate-800">
                            {item.className}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-slate-700">
                          {item.totalPupils}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            {item.presentCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            {item.lateCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                            {item.absentCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            {item.excuseCount}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT SIDE: DETAILED PUPIL BREAKDOWN PANEL               */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200/80 flex flex-col overflow-hidden">
          {/* PANEL HEADER WITH FILTERS */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Pupil Live Status
                </h2>
                <p className="text-xs text-slate-500">
                  Detailed status for selected class
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-slate-200 text-slate-700 rounded-lg">
                {selectedClass || "No Class Selected"}
              </span>
            </div>

            {/* CLASS AND ACADEMIC YEAR SELECTOR */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Class Name
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-sm font-semibold rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Select Class
                  </option>
                  {classes.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Academic Year
                </label>
                <select
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-sm font-semibold rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Select Year
                  </option>
                  {academicYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* SEARCH PUPIL NAME */}
            <div className="mt-1">
              <input
                type="text"
                placeholder="Search pupil by name..."
                value={pupilSearchQuery}
                onChange={(e) => setPupilSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* PUPIL LISTS CONTAINER */}
          <div className="p-5 overflow-y-auto max-h-[650px] space-y-6">
            {/* 1. PRESENT & CLOCKED IN */}
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-emerald-100 pb-2">
                <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Present & Clocked In
                </h3>
                <span className="text-xs font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  {rightPanelPupilBreakdown.present.length}
                </span>
              </div>

              {rightPanelPupilBreakdown.present.length === 0 ? (
                <p className="text-xs text-slate-400 italic pl-4">
                  No pupils clocked in as Present yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {rightPanelPupilBreakdown.present.map((pupil) => (
                    <PupilCard
                      key={pupil.id}
                      pupil={pupil}
                      badgeBg="bg-emerald-50 text-emerald-700 border-emerald-200"
                      showClockIn={true}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 2. LATE PUPILS */}
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-amber-100 pb-2">
                <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Late Arrival
                </h3>
                <span className="text-xs font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  {rightPanelPupilBreakdown.late.length}
                </span>
              </div>

              {rightPanelPupilBreakdown.late.length === 0 ? (
                <p className="text-xs text-slate-400 italic pl-4">
                  No late arrivals recorded.
                </p>
              ) : (
                <div className="space-y-2">
                  {rightPanelPupilBreakdown.late.map((pupil) => (
                    <PupilCard
                      key={pupil.id}
                      pupil={pupil}
                      badgeBg="bg-amber-50 text-amber-700 border-amber-200"
                      showClockIn={true}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 3. ABSENT PUPILS */}
            <div>
              <div className="flex items-center justify-between mb-3 border-b border-rose-100 pb-2">
                <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Absent / Unrecorded
                </h3>
                <span className="text-xs font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                  {rightPanelPupilBreakdown.absent.length}
                </span>
              </div>

              {rightPanelPupilBreakdown.absent.length === 0 ? (
                <p className="text-xs text-slate-400 italic pl-4">
                  All pupils in this class are present.
                </p>
              ) : (
                <div className="space-y-2">
                  {rightPanelPupilBreakdown.absent.map((pupil) => (
                    <PupilCard
                      key={pupil.id}
                      pupil={pupil}
                      badgeBg="bg-rose-50 text-rose-700 border-rose-200"
                      showClockIn={false}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================================
// SUB-COMPONENT: HELPER CARD FOR PUPIL ITEM IN RIGHT PANEL
// ==========================================================
const PupilCard = ({ pupil, badgeBg, showClockIn }) => {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-100/80 transition-colors">
      <div className="flex items-center gap-3">
        {/* PUPIL AVATAR */}
        <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {pupil.photoUrl ? (
            <img
              src={pupil.photoUrl}
              alt={pupil.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-xs font-bold text-slate-500">
              {pupil.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* NAME AND ID */}
        <div>
          <p className="text-xs font-bold text-slate-800 leading-tight">
            {pupil.name}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            ID: {pupil.studentID}
          </p>
        </div>
      </div>

      {/* CLOCK IN TIME / BADGE */}
      <div className="text-right">
        {showClockIn && pupil.clockInTime ? (
          <span
            className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded-lg border ${badgeBg}`}
          >
            Clocked In: {pupil.clockInTime}
          </span>
        ) : (
          <span
            className={`inline-block px-2.5 py-1 text-[10px] font-semibold rounded-lg border ${badgeBg}`}
          >
            {pupil.status || "Absent"}
          </span>
        )}
      </div>
    </div>
  );
};

export default AttendanceDashboard;