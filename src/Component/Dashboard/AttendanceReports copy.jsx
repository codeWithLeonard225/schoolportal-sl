import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../Security/AuthContext";

const AttendanceReports = () => {
  const { user } = useAuth();
  const currentSchoolId = user?.schoolId || "";

  const today = new Date().toISOString().slice(0, 10);

  // ==========================================================
  // FILTERS
  // ==========================================================
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [selectedAcademicYear, setSelectedAcademicYear] =
    useState("");
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // ==========================================================
  // DATA
  // ==========================================================
  const [allSchoolPupils, setAllSchoolPupils] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [classes, setClasses] = useState([]);

  const [loadingPupils, setLoadingPupils] = useState(true);
  const [loadingAttendance, setLoadingAttendance] =
    useState(true);

  // ==========================================================
  // SELECTED PUPIL FOR HISTORY
  // ==========================================================
  const [selectedPupil, setSelectedPupil] = useState(null);

  // ==========================================================
  // LOAD PUPILS
  // ==========================================================
  useEffect(() => {
    if (!currentSchoolId) {
      setAllSchoolPupils([]);
      setLoadingPupils(false);
      return;
    }

    setLoadingPupils(true);

    const pupilsQuery = query(
      collection(db, "PupilsReg"),
      where("schoolId", "==", currentSchoolId)
    );

    const unsubscribe = onSnapshot(
      pupilsQuery,
      (snapshot) => {
        const pupils = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setAllSchoolPupils(pupils);

        const years = Array.from(
          new Set(
            pupils
              .map(
                (pupil) =>
                  pupil.academicYear ||
                  pupil.academic_year ||
                  ""
              )
              .filter(Boolean)
          )
        ).sort();

        const extractedClasses = Array.from(
          new Set(
            pupils
              .map(
                (pupil) =>
                  pupil.class ||
                  pupil.className ||
                  ""
              )
              .filter(Boolean)
          )
        ).sort();

        setAcademicYears(years);
        setClasses(extractedClasses);

        if (!selectedAcademicYear && years.length > 0) {
          setSelectedAcademicYear(
            years[years.length - 1]
          );
        }

        setLoadingPupils(false);
      },
      (error) => {
        console.error(
          "Error loading pupils:",
          error
        );
        setLoadingPupils(false);
      }
    );

    return () => unsubscribe();
  }, [currentSchoolId]);

  // ==========================================================
  // LOAD ATTENDANCE LOGS
  // ==========================================================
  useEffect(() => {
    if (!currentSchoolId) {
      setAttendanceLogs([]);
      setLoadingAttendance(false);
      return;
    }

    setLoadingAttendance(true);

    const attendanceQuery = query(
      collection(db, "AttendanceLogs"),
      where("schoolId", "==", currentSchoolId)
    );

    const unsubscribe = onSnapshot(
      attendanceQuery,
      (snapshot) => {
        const logs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setAttendanceLogs(logs);
        setLoadingAttendance(false);
      },
      (error) => {
        console.error(
          "Error loading attendance:",
          error
        );
        setLoadingAttendance(false);
      }
    );

    return () => unsubscribe();
  }, [currentSchoolId]);

  // ==========================================================
  // HELPERS
  // ==========================================================
  const getPupilId = (pupil) =>
    String(
      pupil.studentID ||
        pupil.pupilID ||
        pupil.studentId ||
        pupil.id ||
        ""
    );

  const getPupilName = (pupil) =>
    pupil.studentName ||
    pupil.pupilName ||
    pupil.name ||
    "Unnamed Pupil";

  const getPupilClass = (pupil) =>
    pupil.class ||
    pupil.className ||
    "";

  const getPupilYear = (pupil) =>
    pupil.academicYear ||
    pupil.academic_year ||
    "";

  const formatDate = (dateString) => {
    if (!dateString) return "";

    const date = new Date(
      `${dateString}T00:00:00`
    );

    return date.toLocaleDateString(
      undefined,
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  // ==========================================================
  // DATE VALIDATION
  // ==========================================================
  const dateRangeIsValid =
    fromDate &&
    toDate &&
    fromDate <= toDate;

  // ==========================================================
  // FILTER PUPILS
  // ==========================================================
  const filteredPupils = useMemo(() => {
    return allSchoolPupils.filter((pupil) => {
      const pupilYear = getPupilYear(pupil);
      const pupilClass = getPupilClass(pupil);

      const matchesYear =
        !selectedAcademicYear ||
        pupilYear === selectedAcademicYear;

      const matchesClass =
        selectedClass === "ALL" ||
        pupilClass === selectedClass;

      return (
        matchesYear &&
        matchesClass
      );
    });
  }, [
    allSchoolPupils,
    selectedAcademicYear,
    selectedClass,
  ]);

  // ==========================================================
  // FILTER LOGS BY DATE
  // ==========================================================
  const filteredLogs = useMemo(() => {
    if (!dateRangeIsValid) return [];

    return attendanceLogs.filter((log) => {
      const date = log.date || "";

      return (
        date >= fromDate &&
        date <= toDate
      );
    });
  }, [
    attendanceLogs,
    fromDate,
    toDate,
    dateRangeIsValid,
  ]);

  // ==========================================================
  // ATTENDANCE ACTIVE DAYS
  // ==========================================================
  const activeAttendanceDays = useMemo(() => {
    const days = new Set();

    filteredLogs.forEach((log) => {
      if (log.date) {
        days.add(log.date);
      }
    });

    return Array.from(days).sort();
  }, [filteredLogs]);

  // ==========================================================
  // BUILD PUPIL REPORT
  // ==========================================================
  const pupilAttendanceReport = useMemo(() => {
    if (!dateRangeIsValid) return [];

    const reportMap = new Map();

    filteredPupils.forEach((pupil) => {
      const pupilId = getPupilId(pupil);

      if (!pupilId) return;

      reportMap.set(pupilId, {
        id: pupilId,
        name: getPupilName(pupil),
        className: getPupilClass(pupil),
        academicYear: getPupilYear(pupil),
        studentID:
          pupil.studentID || pupilId,
        photoUrl:
          pupil.userPhotoUrl ||
          pupil.photoUrl ||
          pupil.photo ||
          "",
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        attendanceDays: 0,
        totalRecorded: 0,
        attendancePercentage: 0,
      });
    });

    const logsMap = new Map();

    filteredLogs.forEach((log) => {
      const studentId = String(
        log.studentID ||
          log.pupilID ||
          log.studentId ||
          ""
      );

      if (!studentId) return;

      const pupil = reportMap.get(studentId);

      if (!pupil) return;

      const logClass =
        log.class ||
        log.className ||
        "";

      if (
        selectedClass !== "ALL" &&
        logClass !== selectedClass
      ) {
        return;
      }

      logsMap.set(
        `${log.date}_${studentId}`,
        log
      );
    });

    activeAttendanceDays.forEach((date) => {
      reportMap.forEach((pupil) => {
        const log = logsMap.get(
          `${date}_${pupil.id}`
        );

        pupil.attendanceDays += 1;

        if (!log) {
          pupil.absent += 1;
          return;
        }

        pupil.totalRecorded += 1;

        const status = String(
          log.status || ""
        )
          .trim()
          .toLowerCase();

        if (status === "present") {
          pupil.present += 1;
        } else if (status === "late") {
          pupil.late += 1;
        } else if (
          status === "excused" ||
          status === "excuse"
        ) {
          pupil.excused += 1;
        } else {
          pupil.absent += 1;
        }
      });
    });

    reportMap.forEach((pupil) => {
      if (pupil.attendanceDays > 0) {
        pupil.attendancePercentage =
          ((pupil.present + pupil.late) /
            pupil.attendanceDays) *
          100;
      }
    });

    return Array.from(reportMap.values());
  }, [
    filteredPupils,
    filteredLogs,
    activeAttendanceDays,
    selectedClass,
    dateRangeIsValid,
  ]);

  // ==========================================================
  // SEARCH
  // ==========================================================
  const displayedPupilReports = useMemo(() => {
    const search =
      searchQuery.trim().toLowerCase();

    if (!search) {
      return pupilAttendanceReport;
    }

    return pupilAttendanceReport.filter(
      (pupil) =>
        pupil.name
          .toLowerCase()
          .includes(search) ||
        String(pupil.studentID)
          .toLowerCase()
          .includes(search)
    );
  }, [
    pupilAttendanceReport,
    searchQuery,
  ]);

  // ==========================================================
  // OVERALL SUMMARY
  // ==========================================================
  const overallSummary = useMemo(() => {
    return pupilAttendanceReport.reduce(
      (total, pupil) => {
        total.present += pupil.present;
        total.late += pupil.late;
        total.absent += pupil.absent;
        total.excused += pupil.excused;
        total.attendanceDays +=
          pupil.attendanceDays;

        return total;
      },
      {
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        attendanceDays: 0,
      }
    );
  }, [pupilAttendanceReport]);

  const overallAttendancePercentage =
    overallSummary.attendanceDays > 0
      ? ((overallSummary.present +
          overallSummary.late) /
          overallSummary.attendanceDays) *
        100
      : 0;

  // ==========================================================
  // MOST PRESENT
  // ==========================================================
  const mostPresentPupils = useMemo(() => {
    return [...pupilAttendanceReport]
      .sort((a, b) => {
        if (b.present !== a.present) {
          return b.present - a.present;
        }

        return (
          b.attendancePercentage -
          a.attendancePercentage
        );
      })
      .slice(0, 10);
  }, [pupilAttendanceReport]);

  // ==========================================================
  // MOST ABSENT
  // ==========================================================
  const mostAbsentPupils = useMemo(() => {
    return [...pupilAttendanceReport]
      .sort((a, b) => {
        if (b.absent !== a.absent) {
          return b.absent - a.absent;
        }

        return b.late - a.late;
      })
      .slice(0, 10);
  }, [pupilAttendanceReport]);

  // ==========================================================
  // MOST LATE
  // ==========================================================
  const mostLatePupils = useMemo(() => {
    return [...pupilAttendanceReport]
      .sort((a, b) => {
        if (b.late !== a.late) {
          return b.late - a.late;
        }

        return b.present - a.present;
      })
      .slice(0, 10);
  }, [pupilAttendanceReport]);

  // ==========================================================
  // CLASS PERFORMANCE
  // ==========================================================
  const classPerformance = useMemo(() => {
    const map = new Map();

    filteredPupils.forEach((pupil) => {
      const className = getPupilClass(pupil);

      if (!className) return;

      if (!map.has(className)) {
        map.set(className, {
          className,
          pupils: 0,
          present: 0,
          late: 0,
          absent: 0,
          excused: 0,
          attendanceDays: 0,
        });
      }

      map.get(className).pupils += 1;
    });

    pupilAttendanceReport.forEach(
      (pupil) => {
        const item = map.get(
          pupil.className
        );

        if (!item) return;

        item.present += pupil.present;
        item.late += pupil.late;
        item.absent += pupil.absent;
        item.excused += pupil.excused;
        item.attendanceDays +=
          pupil.attendanceDays;
      }
    );

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        attendancePercentage:
          item.attendanceDays > 0
            ? ((item.present +
                item.late) /
                item.attendanceDays) *
              100
            : 0,
      }))
      .sort(
        (a, b) =>
          b.attendancePercentage -
          a.attendancePercentage
      );
  }, [
    filteredPupils,
    pupilAttendanceReport,
  ]);

  // ==========================================================
  // DAILY TREND
  // ==========================================================
  const dailyAttendanceTrend = useMemo(() => {
    return activeAttendanceDays.map(
      (date) => {
        let present = 0;
        let late = 0;
        let absent = 0;
        let excused = 0;

        pupilAttendanceReport.forEach(
          (pupil) => {
            const log =
              filteredLogs.find(
                (item) => {
                  const studentId =
                    String(
                      item.studentID ||
                        item.pupilID ||
                        item.studentId ||
                        ""
                    );

                  const logClass =
                    item.class ||
                    item.className ||
                    "";

                  return (
                    item.date === date &&
                    studentId ===
                      pupil.id &&
                    (selectedClass ===
                      "ALL" ||
                      logClass ===
                        selectedClass)
                  );
                }
              );

            if (!log) {
              absent += 1;
              return;
            }

            const status =
              String(
                log.status || ""
              )
                .trim()
                .toLowerCase();

            if (
              status === "present"
            ) {
              present += 1;
            } else if (
              status === "late"
            ) {
              late += 1;
            } else if (
              status ===
                "excused" ||
              status === "excuse"
            ) {
              excused += 1;
            } else {
              absent += 1;
            }
          }
        );

        const total =
          present +
          late +
          absent +
          excused;

        return {
          date,
          present,
          late,
          absent,
          excused,
          total,
          percentage:
            total > 0
              ? ((present + late) /
                  total) *
                100
              : 0,
        };
      }
    );
  }, [
    activeAttendanceDays,
    pupilAttendanceReport,
    filteredLogs,
    selectedClass,
  ]);

  // ==========================================================
  // RESET
  // ==========================================================
  const resetFilters = () => {
    setFromDate(today);
    setToDate(today);
    setSelectedClass("ALL");
    setSearchQuery("");
  };

  const isLoading =
    loadingPupils ||
    loadingAttendance;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6 font-sans">

      {/* PRINT CSS */}
      <style>
        {`
          @media print {
            body {
              background: white !important;
            }

            .no-print {
              display: none !important;
            }

            .print-card {
              box-shadow: none !important;
              border: 1px solid #ddd !important;
            }

            .print-break {
              page-break-before: always;
            }

            table {
              page-break-inside: auto;
            }

            tr {
              page-break-inside: avoid;
            }
          }
        `}
      </style>

      {/* ==================================================== */}
      {/* HEADER */}
      {/* ==================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div>
            <div className="flex items-center gap-3">

              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl">
                📊
              </div>

              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Attendance Reports
                </h1>

                <p className="text-sm text-slate-500 mt-1">
                  Attendance history, analysis and pupil performance
                </p>
              </div>

            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="no-print px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800"
          >
            🖨️ Print Report
          </button>

        </div>

        {/* ================================================= */}
        {/* FILTERS */}
        {/* ================================================= */}
        <div className="no-print mt-5 pt-5 border-t border-slate-100">

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">

            <FilterBox label="From Date">
              <input
                type="date"
                value={fromDate}
                onChange={(e) =>
                  setFromDate(e.target.value)
                }
                className="filter-input"
              />
            </FilterBox>

            <FilterBox label="To Date">
              <input
                type="date"
                value={toDate}
                onChange={(e) =>
                  setToDate(e.target.value)
                }
                className="filter-input"
              />
            </FilterBox>

            <FilterBox label="Academic Year">
              <select
                value={selectedAcademicYear}
                onChange={(e) =>
                  setSelectedAcademicYear(
                    e.target.value
                  )
                }
                className="filter-input"
              >
                <option value="">
                  All Academic Years
                </option>

                {academicYears.map(
                  (year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  )
                )}
              </select>
            </FilterBox>

            <FilterBox label="Class">
              <select
                value={selectedClass}
                onChange={(e) =>
                  setSelectedClass(
                    e.target.value
                  )
                }
                className="filter-input"
              >
                <option value="ALL">
                  All Classes
                </option>

                {classes.map((cls) => (
                  <option
                    key={cls}
                    value={cls}
                  >
                    {cls}
                  </option>
                ))}
              </select>
            </FilterBox>

            <FilterBox label="Search Pupil">
              <input
                type="text"
                placeholder="Name or ID..."
                value={searchQuery}
                onChange={(e) =>
                  setSearchQuery(
                    e.target.value
                  )
                }
                className="filter-input"
              />
            </FilterBox>

          </div>

          <div className="flex items-center justify-between mt-4">

            <p className="text-xs text-slate-500">
              Showing:
              <strong className="text-slate-700 ml-1">
                {formatDate(fromDate)}
              </strong>

              <span className="mx-2">
                →
              </span>

              <strong className="text-slate-700">
                {formatDate(toDate)}
              </strong>
            </p>

            <button
              onClick={resetFilters}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-100"
            >
              Reset
            </button>

          </div>

          {!dateRangeIsValid && (
            <div className="mt-3 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm font-semibold">
              Please make sure the From Date is not later than the To Date.
            </div>
          )}

        </div>
      </div>

      {/* ==================================================== */}
      {/* LOADING */}
      {/* ==================================================== */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">

          <div className="w-9 h-9 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>

          <p className="text-sm font-semibold text-slate-500">
            Loading attendance report...
          </p>

        </div>
      ) : (
        <>
          {/* ================================================= */}
          {/* SUMMARY CARDS                                    */}
          {/* ================================================= */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">

            <SummaryCard
              title="Pupils"
              value={
                pupilAttendanceReport.length
              }
              icon="👨‍🎓"
              bg="bg-indigo-50"
              text="text-indigo-700"
            />

            <SummaryCard
              title="Present"
              value={
                overallSummary.present
              }
              icon="✓"
              bg="bg-emerald-50"
              text="text-emerald-700"
            />

            <SummaryCard
              title="Late"
              value={
                overallSummary.late
              }
              icon="⏰"
              bg="bg-amber-50"
              text="text-amber-700"
            />

            <SummaryCard
              title="Absent"
              value={
                overallSummary.absent
              }
              icon="✕"
              bg="bg-rose-50"
              text="text-rose-700"
            />

            <SummaryCard
              title="Excused"
              value={
                overallSummary.excused
              }
              icon="✓"
              bg="bg-blue-50"
              text="text-blue-700"
            />

            <SummaryCard
              title="Attendance"
              value={`${overallAttendancePercentage.toFixed(
                1
              )}%`}
              icon="📈"
              bg="bg-purple-50"
              text="text-purple-700"
            />

          </div>

          {/* ================================================= */}
          {/* RANKINGS                                         */}
          {/* ================================================= */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">

            <RankingCard
              title="Most Present Pupils"
              subtitle="Highest number of present days"
              icon="🏆"
              iconBg="bg-emerald-100"
              iconText="text-emerald-700"
              pupils={mostPresentPupils}
              valueKey="present"
              valueLabel="Present"
              onPupilClick={setSelectedPupil}
            />

            <RankingCard
              title="Most Absent Pupils"
              subtitle="Highest number of absent days"
              icon="⚠️"
              iconBg="bg-rose-100"
              iconText="text-rose-700"
              pupils={mostAbsentPupils}
              valueKey="absent"
              valueLabel="Absent"
              onPupilClick={setSelectedPupil}
            />

            <RankingCard
              title="Frequently Late"
              subtitle="Highest number of late arrivals"
              icon="⏰"
              iconBg="bg-amber-100"
              iconText="text-amber-700"
              pupils={mostLatePupils}
              valueKey="late"
              valueLabel="Late"
              onPupilClick={setSelectedPupil}
            />

          </div>

          {/* ================================================= */}
          {/* CLASS PERFORMANCE                                 */}
          {/* ================================================= */}
          <div className="print-card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">

            <div className="p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold">
                Class Attendance Performance
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                Attendance comparison by class
              </p>
            </div>

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="bg-slate-100 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3">
                      #
                    </th>

                    <th className="text-left px-4 py-3">
                      Class
                    </th>

                    <th className="text-center px-3 py-3">
                      Pupils
                    </th>

                    <th className="text-center px-3 py-3 text-emerald-700">
                      Present
                    </th>

                    <th className="text-center px-3 py-3 text-amber-700">
                      Late
                    </th>

                    <th className="text-center px-3 py-3 text-rose-700">
                      Absent
                    </th>

                    <th className="text-center px-3 py-3 text-blue-700">
                      Excused
                    </th>

                    <th className="text-center px-3 py-3">
                      Attendance
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {classPerformance.length ===
                  0 ? (
                    <EmptyRow
                      colSpan="8"
                      text="No class attendance data found."
                    />
                  ) : (
                    classPerformance.map(
                      (item, index) => (
                        <tr
                          key={item.className}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 text-slate-400 font-bold">
                            {index + 1}
                          </td>

                          <td className="px-4 py-3 font-bold">
                            {item.className}
                          </td>

                          <td className="px-3 py-3 text-center">
                            {item.pupils}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-emerald-700">
                            {item.present}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-amber-700">
                            {item.late}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-rose-700">
                            {item.absent}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-blue-700">
                            {item.excused}
                          </td>

                          <td className="px-3 py-3 text-center">
                            <PercentageBadge
                              value={
                                item.attendancePercentage
                              }
                            />
                          </td>
                        </tr>
                      )
                    )
                  )}

                </tbody>

              </table>

            </div>
          </div>

          {/* ================================================= */}
          {/* DAILY TREND                                      */}
          {/* ================================================= */}
          <div className="print-card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">

            <div className="p-5 border-b border-slate-100">
              <h2 className="text-lg font-bold">
                Daily Attendance Trend
              </h2>

              <p className="text-xs text-slate-500 mt-1">
                Daily attendance performance
              </p>
            </div>

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="bg-slate-100 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3">
                      Date
                    </th>

                    <th className="text-center px-3 py-3 text-emerald-700">
                      Present
                    </th>

                    <th className="text-center px-3 py-3 text-amber-700">
                      Late
                    </th>

                    <th className="text-center px-3 py-3 text-rose-700">
                      Absent
                    </th>

                    <th className="text-center px-3 py-3 text-blue-700">
                      Excused
                    </th>

                    <th className="text-center px-3 py-3">
                      Attendance
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {dailyAttendanceTrend.length ===
                  0 ? (
                    <EmptyRow
                      colSpan="6"
                      text="No attendance days found."
                    />
                  ) : (
                    dailyAttendanceTrend.map(
                      (day) => (
                        <tr
                          key={day.date}
                          className="hover:bg-slate-50"
                        >
                          <td className="px-4 py-3 font-semibold">
                            {formatDate(
                              day.date
                            )}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-emerald-700">
                            {day.present}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-amber-700">
                            {day.late}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-rose-700">
                            {day.absent}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-blue-700">
                            {day.excused}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-indigo-700">
                            {day.percentage.toFixed(
                              1
                            )}
                            %
                          </td>
                        </tr>
                      )
                    )
                  )}

                </tbody>

              </table>

            </div>
          </div>

          {/* ================================================= */}
          {/* DETAILED PUPIL REPORT                            */}
          {/* ================================================= */}
          <div className="print-break print-card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            <div className="p-5 border-b border-slate-100">

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                <div>
                  <h2 className="text-lg font-bold">
                    Detailed Pupil Attendance
                  </h2>

                  <p className="text-xs text-slate-500 mt-1">
                    Click any pupil to view attendance history
                  </p>
                </div>

                <span className="text-xs font-bold bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg">
                  {displayedPupilReports.length} Pupils
                </span>

              </div>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="bg-slate-100 text-[11px] uppercase tracking-wider">
                  <tr>

                    <th className="text-left px-4 py-3">
                      #
                    </th>

                    <th className="text-left px-4 py-3">
                      Pupil
                    </th>

                    <th className="text-left px-4 py-3">
                      Class
                    </th>

                    <th className="text-center px-3 py-3 text-emerald-700">
                      Present
                    </th>

                    <th className="text-center px-3 py-3 text-amber-700">
                      Late
                    </th>

                    <th className="text-center px-3 py-3 text-rose-700">
                      Absent
                    </th>

                    <th className="text-center px-3 py-3 text-blue-700">
                      Excused
                    </th>

                    <th className="text-center px-3 py-3">
                      Attendance
                    </th>

                    <th className="no-print text-center px-3 py-3">
                      History
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">

                  {displayedPupilReports.length ===
                  0 ? (
                    <EmptyRow
                      colSpan="9"
                      text="No pupils found."
                    />
                  ) : (
                    displayedPupilReports.map(
                      (pupil, index) => (
                        <tr
                          key={pupil.id}
                          className="hover:bg-indigo-50/40"
                        >

                          <td className="px-4 py-3 font-bold text-slate-400">
                            {index + 1}
                          </td>

                          <td className="px-4 py-3">

                            <button
                              onClick={() =>
                                setSelectedPupil(
                                  pupil
                                )
                              }
                              className="flex items-center gap-3 text-left"
                            >

                              <PupilAvatar
                                pupil={pupil}
                              />

                              <div>
                                <p className="font-bold text-slate-800 hover:text-indigo-600">
                                  {pupil.name}
                                </p>

                                <p className="text-[10px] text-slate-400">
                                  ID:{" "}
                                  {
                                    pupil.studentID
                                  }
                                </p>
                              </div>

                            </button>

                          </td>

                          <td className="px-4 py-3 font-semibold">
                            {pupil.className}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-emerald-700">
                            {pupil.present}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-amber-700">
                            {pupil.late}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-rose-700">
                            {pupil.absent}
                          </td>

                          <td className="px-3 py-3 text-center font-bold text-blue-700">
                            {pupil.excused}
                          </td>

                          <td className="px-3 py-3 text-center">
                            <PercentageBadge
                              value={
                                pupil.attendancePercentage
                              }
                            />
                          </td>

                          <td className="no-print px-3 py-3 text-center">

                            <button
                              onClick={() =>
                                setSelectedPupil(
                                  pupil
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100"
                            >
                              View
                            </button>

                          </td>

                        </tr>
                      )
                    )
                  )}

                </tbody>

              </table>

            </div>
          </div>
        </>
      )}

      {/* ====================================================== */}
      {/* PUPIL HISTORY MODAL                                   */}
      {/* ====================================================== */}
      {selectedPupil && (
        <PupilHistoryModal
          pupil={selectedPupil}
          logs={filteredLogs}
          activeDays={activeAttendanceDays}
          fromDate={fromDate}
          toDate={toDate}
          onClose={() =>
            setSelectedPupil(null)
          }
        />
      )}

    </div>
  );
};

// ==========================================================
// FILTER BOX
// ==========================================================
const FilterBox = ({
  label,
  children,
}) => {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
        {label}
      </label>

      {children}
    </div>
  );
};

// ==========================================================
// SUMMARY CARD
// ==========================================================
const SummaryCard = ({
  title,
  value,
  icon,
  bg,
  text,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">

      <div className="flex items-center justify-between">

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {title}
          </p>

          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {value}
          </p>
        </div>

        <div
          className={`w-10 h-10 rounded-xl ${bg} ${text} flex items-center justify-center font-bold`}
        >
          {icon}
        </div>

      </div>
    </div>
  );
};

// ==========================================================
// RANKING CARD
// ==========================================================
const RankingCard = ({
  title,
  subtitle,
  icon,
  iconBg,
  iconText,
  pupils,
  valueKey,
  valueLabel,
  onPupilClick,
}) => {
  return (
    <div className="print-card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

      <div className="p-5 border-b border-slate-100">

        <div className="flex items-center gap-3">

          <div
            className={`w-10 h-10 rounded-xl ${iconBg} ${iconText} flex items-center justify-center`}
          >
            {icon}
          </div>

          <div>
            <h2 className="font-bold">
              {title}
            </h2>

            <p className="text-[11px] text-slate-400">
              {subtitle}
            </p>
          </div>

        </div>

      </div>

      <div className="p-4 space-y-2">

        {pupils.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-5">
            No attendance data available.
          </p>
        ) : (
          pupils.map(
            (pupil, index) => (
              <button
                key={pupil.id}
                onClick={() =>
                  onPupilClick(pupil)
                }
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-indigo-50 hover:border-indigo-100 transition text-left"
              >

                <div className="flex items-center gap-2.5">

                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-extrabold ${
                      index === 0
                        ? "bg-yellow-100 text-yellow-700"
                        : index === 1
                        ? "bg-slate-200 text-slate-600"
                        : index === 2
                        ? "bg-orange-100 text-orange-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {index + 1}
                  </div>

                  <div>

                    <p className="text-xs font-bold text-slate-800">
                      {pupil.name}
                    </p>

                    <p className="text-[10px] text-slate-400">
                      {pupil.className}
                    </p>

                  </div>

                </div>

                <div className="text-right">

                  <p className="text-sm font-extrabold">
                    {pupil[valueKey]}
                  </p>

                  <p className="text-[9px] text-slate-400 uppercase">
                    {valueLabel}
                  </p>

                </div>

              </button>
            )
          )
        )}

      </div>
    </div>
  );
};

// ==========================================================
// PUPIL AVATAR
// ==========================================================
const PupilAvatar = ({
  pupil,
}) => {
  return (
    <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center flex-shrink-0">

      {pupil.photoUrl ? (
        <img
          src={pupil.photoUrl}
          alt={pupil.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="font-bold text-slate-500">
          {pupil.name
            .charAt(0)
            .toUpperCase()}
        </span>
      )}

    </div>
  );
};

// ==========================================================
// PERCENTAGE BADGE
// ==========================================================
const PercentageBadge = ({
  value,
}) => {
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
        value >= 90
          ? "bg-emerald-100 text-emerald-700"
          : value >= 75
          ? "bg-amber-100 text-amber-700"
          : "bg-rose-100 text-rose-700"
      }`}
    >
      {value.toFixed(1)}%
    </span>
  );
};

// ==========================================================
// EMPTY TABLE ROW
// ==========================================================
const EmptyRow = ({
  colSpan,
  text,
}) => {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="py-10 text-center text-slate-400"
      >
        {text}
      </td>
    </tr>
  );
};

// ==========================================================
// PUPIL HISTORY MODAL
// ==========================================================
const PupilHistoryModal = ({
  pupil,
  logs,
  activeDays,
  fromDate,
  toDate,
  onClose,
}) => {
  const [historyFilter, setHistoryFilter] =
    useState("ALL");

  const getStatus = (log) => {
    if (!log) return "Absent";

    const status = String(
      log.status || ""
    )
      .trim()
      .toLowerCase();

    if (status === "present") {
      return "Present";
    }

    if (status === "late") {
      return "Late";
    }

    if (
      status === "excused" ||
      status === "excuse"
    ) {
      return "Excused";
    }

    return "Absent";
  };

  const getStudentId = (log) =>
    String(
      log.studentID ||
        log.pupilID ||
        log.studentId ||
        ""
    );

  // ----------------------------------------------------------
  // CREATE HISTORY
  // ----------------------------------------------------------
  const history = useMemo(() => {
    const pupilLogs = new Map();

    logs.forEach((log) => {
      const studentId =
        getStudentId(log);

      if (
        studentId ===
        String(pupil.id)
      ) {
        pupilLogs.set(
          log.date,
          log
        );
      }
    });

    return activeDays
      .map((date) => {
        const log =
          pupilLogs.get(date);

        return {
          date,
          log,
          status: getStatus(log),
          clockInTime:
            log?.clockInTime ||
            "",
          note:
            log?.note ||
            log?.remarks ||
            "",
        };
      })
      .filter((item) => {
        if (
          historyFilter ===
          "ALL"
        ) {
          return true;
        }

        return (
          item.status ===
          historyFilter
        );
      })
      .sort((a, b) =>
        b.date.localeCompare(
          a.date
        )
      );
  }, [
    logs,
    activeDays,
    pupil.id,
    historyFilter,
  ]);

  const counts = useMemo(() => {
    return history.reduce(
      (total, item) => {
        if (
          item.status ===
          "Present"
        ) {
          total.present += 1;
        } else if (
          item.status === "Late"
        ) {
          total.late += 1;
        } else if (
          item.status ===
          "Excused"
        ) {
          total.excused += 1;
        } else {
          total.absent += 1;
        }

        return total;
      },
      {
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
      }
    );
  }, [history]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">

      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">

        {/* ================================================= */}
        {/* MODAL HEADER                                     */}
        {/* ================================================= */}
        <div className="p-5 border-b border-slate-200">

          <div className="flex items-start justify-between gap-4">

            <div className="flex items-center gap-3">

              <PupilAvatar
                pupil={pupil}
              />

              <div>

                <h2 className="text-xl font-bold text-slate-900">
                  {pupil.name}
                </h2>

                <p className="text-xs text-slate-500 mt-1">
                  ID: {pupil.studentID}
                  {" • "}
                  Class: {pupil.className}
                </p>

                <p className="text-xs text-slate-400">
                  {formatModalDate(
                    fromDate
                  )}{" "}
                  →{" "}
                  {formatModalDate(
                    toDate
                  )}
                </p>

              </div>

            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 font-bold"
            >
              ✕
            </button>

          </div>

        </div>

        {/* ================================================= */}
        {/* STATISTICS                                       */}
        {/* ================================================= */}
        <div className="p-5 border-b border-slate-100">

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

            <HistoryStat
              label="Present"
              value={counts.present}
              bg="bg-emerald-50"
              text="text-emerald-700"
            />

            <HistoryStat
              label="Late"
              value={counts.late}
              bg="bg-amber-50"
              text="text-amber-700"
            />

            <HistoryStat
              label="Absent"
              value={counts.absent}
              bg="bg-rose-50"
              text="text-rose-700"
            />

            <HistoryStat
              label="Excused"
              value={counts.excused}
              bg="bg-blue-50"
              text="text-blue-700"
            />

          </div>

        </div>

        {/* ================================================= */}
        {/* FILTER BUTTONS                                   */}
        {/* ================================================= */}
        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap gap-2">

          {[
            "ALL",
            "Present",
            "Late",
            "Absent",
            "Excused",
          ].map((filter) => (
            <button
              key={filter}
              onClick={() =>
                setHistoryFilter(
                  filter
                )
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                historyFilter ===
                filter
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {filter}
            </button>
          ))}

        </div>

        {/* ================================================= */}
        {/* HISTORY TABLE                                    */}
        {/* ================================================= */}
        <div className="overflow-y-auto flex-1">

          <table className="w-full text-sm">

            <thead className="sticky top-0 bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">

              <tr>

                <th className="text-left px-5 py-3">
                  Date
                </th>

                <th className="text-center px-3 py-3">
                  Status
                </th>

                <th className="text-center px-3 py-3">
                  Clock In
                </th>

                <th className="text-left px-3 py-3">
                  Note
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-100">

              {history.length ===
              0 ? (
                <tr>
                  <td
                    colSpan="4"
                    className="py-12 text-center text-slate-400"
                  >
                    No attendance history found.
                  </td>
                </tr>
              ) : (
                history.map(
                  (item) => (
                    <tr
                      key={item.date}
                      className="hover:bg-slate-50"
                    >

                      <td className="px-5 py-3 font-semibold">
                        {formatModalDate(
                          item.date
                        )}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <StatusBadge
                          status={
                            item.status
                          }
                        />
                      </td>

                      <td className="px-3 py-3 text-center font-semibold text-slate-600">
                        {item.clockInTime ||
                          "—"}
                      </td>

                      <td className="px-3 py-3 text-slate-500">
                        {item.note ||
                          "—"}
                      </td>

                    </tr>
                  )
                )
              )}

            </tbody>

          </table>

        </div>

        {/* ================================================= */}
        {/* FOOTER                                           */}
        {/* ================================================= */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            Close
          </button>

        </div>

      </div>
    </div>
  );
};

// ==========================================================
// HISTORY STAT
// ==========================================================
const HistoryStat = ({
  label,
  value,
  bg,
  text,
}) => {
  return (
    <div
      className={`${bg} rounded-xl p-3`}
    >
      <p
        className={`text-[10px] uppercase font-bold ${text}`}
      >
        {label}
      </p>

      <p className="text-xl font-extrabold text-slate-800 mt-1">
        {value}
      </p>
    </div>
  );
};

// ==========================================================
// STATUS BADGE
// ==========================================================
const StatusBadge = ({
  status,
}) => {
  const styles = {
    Present:
      "bg-emerald-100 text-emerald-700",
    Late:
      "bg-amber-100 text-amber-700",
    Absent:
      "bg-rose-100 text-rose-700",
    Excused:
      "bg-blue-100 text-blue-700",
  };

  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
        styles[status] ||
        styles.Absent
      }`}
    >
      {status}
    </span>
  );
};

// ==========================================================
// MODAL DATE
// ==========================================================
const formatModalDate = (
  dateString
) => {
  if (!dateString) return "";

  const date = new Date(
    `${dateString}T00:00:00`
  );

  return date.toLocaleDateString(
    undefined,
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
};

export default AttendanceReports;