
import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../Security/AuthContext";

const PupilAttendanceLogs = () => {
  const { user } = useAuth();

  const currentSchoolId = user?.schoolId || "";

  const [logs, setLogs] = useState([]);
  const [classPupils, setClassPupils] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);

  const [availableAcademicYears, setAvailableAcademicYears] = useState([]);
const [selectedAcademicYear, setSelectedAcademicYear] = useState("");

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // No "All"
  const [filterClass, setFilterClass] = useState("");

  // ==========================================================
  // STATUS EDIT
  // ==========================================================
  const [editingLogId, setEditingLogId] = useState(null);
  const [editStatus, setEditStatus] = useState("Present");
  const [editNote, setEditNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // ==========================================================
  // SCHOOL CLOSING TIME
  // ==========================================================
  const SCHOOL_CLOSING_HOUR = 14;
  const SCHOOL_CLOSING_MINUTE = 0;

  const CLOSING_TIME_MINUTES =
    SCHOOL_CLOSING_HOUR * 60 +
    SCHOOL_CLOSING_MINUTE;

  // ==========================================================
  // GET CURRENT LOGGED-IN USER
  // ==========================================================
  const getLoggedInUser = () => {
    try {
      const savedUser = JSON.parse(
        localStorage.getItem("schoolUser")
      );

      if (!savedUser) {
        return {
          id: "",
          name: "Unknown User",
          role: "Unknown",
        };
      }

      const userData = savedUser.data || {};

      return {
        id:
          userData.adminID ||
          userData.teacherID ||
          userData.ceoID ||
          userData.classId ||
          savedUser.userID ||
          "",

        name:
          userData.adminName ||
          userData.teacherName ||
          userData.ceoName ||
          userData.className ||
          "Unknown User",

        role: savedUser.role || "Unknown",
      };
    } catch (error) {
      console.error(
        "Failed to read logged-in user:",
        error
      );

      return {
        id: "",
        name: "Unknown User",
        role: "Unknown",
      };
    }
  };

  // ==========================================================
  // FORMAT ROLE
  // ==========================================================
  const formatRole = (role) => {
    if (!role) return "Unknown";

    switch (role.toLowerCase()) {
      case "admin":
        return "Admin";

      case "teacher":
        return "Teacher";

      case "ceo":
        return "CEO";

      default:
        return role;
    }
  };

  // ==========================================================
  // 1. LOAD CLASS NAMES
  //
  // IMPORTANT:
  // We only use this to populate the class dropdown.
  //
  // We DO NOT load all pupils into allPupils anymore.
  // ==========================================================
  // ==========================================================
// 1. LOAD CLASS NAMES AND ACADEMIC YEARS
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
      const classes = Array.from(
        new Set(
          snapshot.docs
            .map((doc) => {
              const data = doc.data();

              return (
                data.class ||
                data.className ||
                ""
              );
            })
            .filter(Boolean)
        )
      ).sort();

      const academicYears = Array.from(
        new Set(
          snapshot.docs
            .map((doc) => {
              const data = doc.data();

              return (
                data.academicYear ||
                data.academic_year ||
                ""
              );
            })
            .filter(Boolean)
        )
      ).sort();

      setAvailableClasses(classes);
      setAvailableAcademicYears(academicYears);

      // Clear class if it no longer exists
      setFilterClass((currentClass) => {
        if (
          currentClass &&
          !classes.includes(currentClass)
        ) {
          return "";
        }

        return currentClass;
      });

      // Clear academic year if it no longer exists
      setSelectedAcademicYear((currentYear) => {
        if (
          currentYear &&
          !academicYears.includes(currentYear)
        ) {
          return "";
        }

        return currentYear;
      });
    },
    (error) => {
      console.error(
        "Error fetching classes and academic years:",
        error
      );
    }
  );

  return () => unsubscribe();
}, [currentSchoolId]);

  // ==========================================================
  // 2. LOAD ONLY PUPILS FROM SELECTED CLASS
  //
  // This is the important part for schools with 1000+
  // pupils.
  //
  // We DO NOT load every pupil into memory.
  // ==========================================================
  // ==========================================================
// 2. LOAD ONLY PUPILS FROM SELECTED CLASS + ACADEMIC YEAR
// ==========================================================

useEffect(() => {
  setClassPupils([]);

  // Do nothing until class and academic year are selected
  if (
    !currentSchoolId ||
    !filterClass ||
    !selectedAcademicYear
  ) {
    return;
  }

  const pupilsQuery = query(
    collection(db, "PupilsReg"),
    where("schoolId", "==", currentSchoolId),
    where("class", "==", filterClass),
    where("academicYear", "==", selectedAcademicYear)
  );

  const unsubscribe = onSnapshot(
    pupilsQuery,
    (snapshot) => {
      const pupils = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setClassPupils(pupils);
    },
    (error) => {
      console.error(
        "Error fetching pupils for selected class and academic year:",
        error
      );
    }
  );

  return () => unsubscribe();
}, [
  currentSchoolId,
  filterClass,
  selectedAcademicYear,
]);

  // ==========================================================
  // 3. FETCH ATTENDANCE LOGS
  //
  // We only fetch attendance when a specific class
  // has been selected.
  // ==========================================================
  useEffect(() => {
    setLogs([]);

    if (
      !currentSchoolId ||
      !filterClass ||
      !selectedDate
    ) {
      return;
    }

    const collectionRef = collection(
      db,
      "AttendanceLogs"
    );

    const q = query(
      collectionRef,
      where(
        "schoolId",
        "==",
        currentSchoolId
      ),
      where(
        "date",
        "==",
        selectedDate
      ),
      where(
        "class",
        "==",
        filterClass
      )
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedLogs =
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

        setLogs(fetchedLogs);
      },
      (error) => {
        console.error(
          "Error fetching class attendance logs:",
          error
        );
      }
    );

    return () => unsubscribe();
  }, [
    currentSchoolId,
    selectedDate,
    filterClass,
  ]);

  // ==========================================================
  // 4. CHECK EARLY DEPARTURE
  // ==========================================================
  const checkEarlyDepartureNotice = (
    clockOutTimeString
  ) => {
    if (!clockOutTimeString) return null;

    const match =
      clockOutTimeString.match(
        /(\d+):(\d+)\s*(AM|PM)?/i
      );

    if (!match) return null;

    let hours = parseInt(
      match[1],
      10
    );

    const minutes = parseInt(
      match[2],
      10
    );

    const period = match[3];

    if (period) {
      if (
        period.toUpperCase() === "PM" &&
        hours < 12
      ) {
        hours += 12;
      }

      if (
        period.toUpperCase() === "AM" &&
        hours === 12
      ) {
        hours = 0;
      }
    }

    const clockOutInMinutes =
      hours * 60 + minutes;

    const windowStartMinutes =
      CLOSING_TIME_MINUTES - 30;

    if (
      clockOutInMinutes >=
        windowStartMinutes &&
      clockOutInMinutes <
        CLOSING_TIME_MINUTES
    ) {
      return "Closing Window (Within 30m of Close)";
    }

    if (
      clockOutInMinutes <
      windowStartMinutes
    ) {
      return "Early Departure";
    }

    return "Normal Departure";
  };

  // ==========================================================
  // 5. QUICK CLOCK IN / CLOCK OUT
  // ==========================================================
  const handleQuickClockAction = async (log) => {
    if (log.isAutomaticallyAbsent) {
      return;
    }

    const now = new Date();

    const nowTime =
      now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

    const logRef = doc(
      db,
      "AttendanceLogs",
      log.id
    );

    const loggedInUser =
      getLoggedInUser();

    setActionLoading(true);

    try {
      // ==========================================
      // MANUAL CLOCK IN
      // ==========================================
      if (!log.clockInTime) {
        await updateDoc(logRef, {
          clockInTime: nowTime,
          status: "Present",

          loggedById: loggedInUser.id,
          loggedByName: loggedInUser.name,
          loggedByRole: loggedInUser.role,

          updatedAt: serverTimestamp(),
        });

        alert(
          `${log.studentName} clocked in at ${nowTime}`
        );
      }

      // ==========================================
      // MANUAL CLOCK OUT
      // ==========================================
      else if (!log.clockOutTime) {
        await updateDoc(logRef, {
          clockOutTime: nowTime,

          clockOutById: loggedInUser.id,
          clockOutByName: loggedInUser.name,
          clockOutByRole: loggedInUser.role,

          updatedAt: serverTimestamp(),
        });

        alert(
          `${log.studentName} clocked out at ${nowTime}`
        );
      }
    } catch (err) {
      console.error(
        "Action error:",
        err
      );

      alert(
        "Failed to update clock time."
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================================
  // 6. SAVE STATUS OVERRIDE
  // ==========================================================
  const handleSaveStatusOverride = async (
    logId
  ) => {
    const logRef = doc(
      db,
      "AttendanceLogs",
      logId
    );

    setActionLoading(true);

    const loggedInUser =
      getLoggedInUser();

    try {
      await updateDoc(logRef, {
        status: editStatus,

        note:
          editNote.trim() ||
          `Status updated to ${editStatus} by ${loggedInUser.name}`,

        loggedById: loggedInUser.id,
        loggedByName: loggedInUser.name,
        loggedByRole: loggedInUser.role,

        updatedAt:
          serverTimestamp(),
      });

      setEditingLogId(null);
      setEditNote("");
    } catch (err) {
      console.error(
        "Error updating status:",
        err
      );

      alert(
        "Failed to update attendance record."
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================================
  // 7. DELETE ATTENDANCE LOG
  // ==========================================================
  const handleDeleteLog = async (
    logId,
    studentName
  ) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the attendance log for ${studentName}?`
      )
    ) {
      return;
    }

    setActionLoading(true);

    try {
      await deleteDoc(
        doc(
          db,
          "AttendanceLogs",
          logId
        )
      );
    } catch (err) {
      console.error(
        "Error deleting log:",
        err
      );

      alert(
        "Failed to delete record."
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================================
  // 8. BUILD DISPLAY ATTENDANCE
  //
  // IMPORTANT:
  //
  // Nothing is displayed until a specific class
  // is selected.
  //
  // If the selected class has no attendance activity:
  //     → show []
  //
  // If the selected class has attendance activity:
  //     → show pupils in that class
  //
  // Pupils without a real attendance record:
  //     → automatically display as Absent
  //
  // Automatic absences are NOT saved to Firestore.
  // ==========================================================
 // ==========================================================
// 8. BUILD DISPLAY ATTENDANCE
//
// TOTAL PUPILS comes from:
//    PupilsReg → schoolId + class + academicYear
//
// ATTENDANCE comes from:
//    AttendanceLogs → schoolId + class + selectedDate
//
// If attendance has started for the selected class/date,
// pupils without an attendance record are displayed as Absent.
//
// Automatic absences are NOT saved to Firestore.
// ==========================================================

const getDisplayAttendance = () => {
  // Require both class and academic year
  if (
    !filterClass ||
    !selectedAcademicYear
  ) {
    return [];
  }

  // ========================================================
  // CREATE MAP OF EXISTING ATTENDANCE
  // ========================================================

  const attendanceMap = new Map();

  logs.forEach((log) => {
    const studentId =
      log.studentID ||
      log.pupilID ||
      log.studentId;

    if (studentId) {
      attendanceMap.set(
        String(studentId),
        log
      );
    }
  });

  // ========================================================
  // IMPORTANT:
  // If there are NO attendance records for this date,
  // don't automatically display everyone as absent.
  // ========================================================

  if (logs.length === 0) {
    return [];
  }

  // ========================================================
  // BUILD DISPLAY FROM SELECTED ACADEMIC YEAR PUPILS
  // ========================================================

  return classPupils.map((pupil) => {
    const studentID =
      pupil.studentID ||
      pupil.pupilID ||
      pupil.studentId ||
      pupil.id ||
      "";

    const existingRecord =
      attendanceMap.get(
        String(studentID)
      );

    // ======================================================
    // REAL ATTENDANCE RECORD
    // ======================================================

    if (existingRecord) {
      return {
        ...existingRecord,
        isAutomaticallyAbsent: false,
      };
    }

    // ======================================================
    // AUTOMATIC ABSENCE
    // ======================================================

    return {
      id: `absent-${pupil.id}`,

      studentID:
        pupil.studentID ||
        pupil.pupilID ||
        pupil.studentId ||
        pupil.id ||
        "---",

      studentName:
        pupil.studentName ||
        pupil.pupilName ||
        pupil.name ||
        "Unnamed Pupil",

      class:
        pupil.class ||
        pupil.className ||
        filterClass,

      academicYear:
        pupil.academicYear ||
        selectedAcademicYear,

      userPhotoUrl:
        pupil.userPhotoUrl ||
        pupil.photoUrl ||
        pupil.photo ||
        "",

      date: selectedDate,

      clockInTime: null,
      clockOutTime: null,

      status: "Absent",

      note: "",

      isAutomaticallyAbsent: true,

      isManual: false,
    };
  });
};

const displayAttendance =
  getDisplayAttendance();

const filteredLogs =
  displayAttendance;
    // ==========================================================
// ATTENDANCE SUMMARY
// ==========================================================
const totalPupils = classPupils.length;

const totalPresent = filteredLogs.filter(
  (log) =>
    String(log.status || "")
      .trim()
      .toLowerCase() === "present"
).length;

const totalLate = filteredLogs.filter(
  (log) =>
    String(log.status || "")
      .trim()
      .toLowerCase() === "late"
).length;

const totalAbsent = filteredLogs.filter(
  (log) =>
    String(log.status || "")
      .trim()
      .toLowerCase() === "absent"
).length;

  // ==========================================================
  // STATUS STYLE
  // ==========================================================
  const getStatusStyle = (
    status
  ) => {
    switch (
      String(status || "")
        .trim()
        .toLowerCase()
    ) {
      case "present":
        return {
          backgroundColor: "#d1fae5",
          color: "#065f46",
        };

      case "late":
        return {
          backgroundColor: "#fef3c7",
          color: "#92400e",
        };

      case "absent":
        return {
          backgroundColor: "#fee2e2",
          color: "#991b1b",
        };

      case "excuse":
      case "excused":
        return {
          backgroundColor: "#dbeafe",
          color: "#1e40af",
        };

      case "leave":
      case "on leave":
        return {
          backgroundColor: "#ede9fe",
          color: "#6d28d9",
        };

      default:
        return {
          backgroundColor: "#f3f4f6",
          color: "#374151",
        };
    }
  };

  // ==========================================================
  // RENDER
  // ==========================================================
  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "1450px",
        margin: "0 auto",
        fontFamily: "sans-serif",
      }}
    >
      {/* ====================================================
          PAGE TITLE
      ==================================================== */}

      <h2
        style={{
          fontSize: "20px",
          fontWeight: "bold",
          marginBottom: "16px",
          color: "#1f2937",
        }}
      >
        📋 Daily Student Attendance Logs
      </h2>

      {/* ====================================================
          CONTROLS
      ==================================================== */}

      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "20px",
          alignItems: "center",
          flexWrap: "wrap",
          backgroundColor: "#f9fafb",
          padding: "16px",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
        }}
      >
        {/* DATE */}
        

        <div>
          <label
            style={{
              marginRight: "8px",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            Select Date:
          </label>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) =>
              setSelectedDate(
                e.target.value
              )
            }
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border:
                "1px solid #d1d5db",
              fontSize: "14px",
            }}
          />
        </div>

        {/* CLASS */}

        <div>
          <label
            style={{
              marginRight: "8px",
              fontWeight: "600",
              fontSize: "14px",
            }}
          >
            Select Class:
          </label>

          <select
            value={filterClass}
            onChange={(e) =>
              setFilterClass(
                e.target.value
              )
            }
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border:
                "1px solid #d1d5db",
              fontSize: "14px",
              backgroundColor: "#fff",
              minWidth: "180px",
            }}
          >
            <option value="">
              -- Select a Class --
            </option>

            {availableClasses.map(
              (cls) => (
                <option
                  key={cls}
                  value={cls}
                >
                  {cls}
                </option>
              )
            )}
          </select>
        </div>

        {/* ACADEMIC YEAR */}

<div>
  <label
    style={{
      marginRight: "8px",
      fontWeight: "600",
      fontSize: "14px",
    }}
  >
    Academic Year:
  </label>

  <select
    value={selectedAcademicYear}
    onChange={(e) =>
      setSelectedAcademicYear(e.target.value)
    }
    style={{
      padding: "8px 12px",
      borderRadius: "6px",
      border: "1px solid #d1d5db",
      fontSize: "14px",
      backgroundColor: "#fff",
      minWidth: "180px",
    }}
  >
    <option value="">
      -- Select Academic Year --
    </option>

    {availableAcademicYears.map((year) => (
      <option
        key={year}
        value={year}
      >
        {year}
      </option>
    ))}
  </select>
</div>
      </div>

      {/* ====================================================
    ATTENDANCE SUMMARY
==================================================== */}

{filterClass && (
  <div
    style={{
      display: "grid",
      gridTemplateColumns:
        "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "14px",
      marginBottom: "20px",
    }}
  >
    {/* TOTAL PUPILS */}
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "10px",
        padding: "18px",
        boxShadow:
          "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#6b7280",
          fontWeight: "600",
          marginBottom: "8px",
        }}
      >
        TOTAL PUPILS
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          color: "#111827",
        }}
      >
        {totalPupils}
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#6b7280",
          marginTop: "4px",
        }}
      >
        {filterClass}
      </div>
    </div>

    {/* PRESENT */}
    <div
      style={{
        backgroundColor: "#ecfdf5",
        border: "1px solid #a7f3d0",
        borderRadius: "10px",
        padding: "18px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#047857",
          fontWeight: "600",
          marginBottom: "8px",
        }}
      >
        PRESENT
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          color: "#065f46",
        }}
      >
        {totalPresent}
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#047857",
          marginTop: "4px",
        }}
      >
        Present pupils
      </div>
    </div>

    {/* LATE */}
    <div
      style={{
        backgroundColor: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: "10px",
        padding: "18px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#b45309",
          fontWeight: "600",
          marginBottom: "8px",
        }}
      >
        LATE
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          color: "#92400e",
        }}
      >
        {totalLate}
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#b45309",
          marginTop: "4px",
        }}
      >
        Late pupils
      </div>
    </div>

    {/* ABSENT */}
    <div
      style={{
        backgroundColor: "#fef2f2",
        border: "1px solid #fecaca",
        borderRadius: "10px",
        padding: "18px",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#dc2626",
          fontWeight: "600",
          marginBottom: "8px",
        }}
      >
        ABSENT
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: "bold",
          color: "#991b1b",
        }}
      >
        {totalAbsent}
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#dc2626",
          marginTop: "4px",
        }}
      >
        Absent pupils
      </div>
    </div>
  </div>
)}

      {/* ====================================================
          NO CLASS SELECTED
      ==================================================== */}

      {filterClass && selectedAcademicYear &&(
        <div
          style={{
            marginBottom: "16px",
            padding: "14px 16px",
            backgroundColor: "#eff6ff",
            color: "#1d4ed8",
            border:
              "1px solid #bfdbfe",
            borderRadius: "8px",
            fontSize: "13px",
          }}
        >
          ℹ️ Please select a specific class
          to view student attendance.
        </div>
      )}

      {/* ====================================================
          NO ATTENDANCE FOR SELECTED CLASS
      ==================================================== */}

      {filterClass &&
        logs.length === 0 && (
          <div
            style={{
              marginBottom: "16px",
              padding: "12px 16px",
              backgroundColor: "#eff6ff",
              color: "#1d4ed8",
              border:
                "1px solid #bfdbfe",
              borderRadius: "8px",
              fontSize: "13px",
            }}
          >
            ℹ️ No pupil attendance has
            been recorded for{" "}
            <strong>
              {filterClass}
            </strong>{" "}
            on{" "}
            <strong>
              {selectedDate}
            </strong>
            . Pupils are not marked absent
            until at least one attendance
            record is recorded for this class
            on this day.
          </div>
        )}

      {/* ====================================================
          LOGS TABLE
      ==================================================== */}

      <div
        style={{
          overflowX: "auto",
          border:
            "1px solid #e5e7eb",
          borderRadius: "8px",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse:
              "collapse",
            textAlign: "left",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr
              style={{
                background:
                  "#f3f4f6",
                borderBottom:
                  "2px solid #e5e7eb",
              }}
            >
              <th style={{ padding: "12px" }}>
                Student
              </th>

              <th style={{ padding: "12px" }}>
                Student ID
              </th>

              <th style={{ padding: "12px" }}>
                Class
              </th>

              <th style={{ padding: "12px" }}>
                Status
              </th>

              <th style={{ padding: "12px" }}>
                Arrival (Clock In)
              </th>

              <th style={{ padding: "12px" }}>
                Departure (Clock Out)
              </th>

              <th style={{ padding: "12px" }}>
                Recorded By
              </th>

              <th style={{ padding: "12px" }}>
                Notes / Remarks
              </th>

              <th
                style={{
                  padding: "12px",
                  textAlign: "center",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td
                  colSpan="9"
                  style={{
                    padding: "24px",
                    textAlign:
                      "center",
                    color: "#6b7280",
                  }}
                >
                  {!filterClass
                    ? "Select a class to view attendance."
                    : logs.length === 0
                    ? "No attendance logs found for the selected class and date."
                    : "No attendance records found."}
                </td>
              </tr>
            ) : (
              filteredLogs.map(
                (log) => {
                  const departureTiming =
                    checkEarlyDepartureNotice(
                      log.clockOutTime
                    );

                  const isEditing =
                    editingLogId ===
                    log.id;

                  const isAutomaticallyAbsent =
                    log.isAutomaticallyAbsent;

                  const studentClass =
                    log.class ||
                    log.className ||
                    filterClass ||
                    "—";

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom:
                          "1px solid #e5e7eb",
                        backgroundColor:
                          isAutomaticallyAbsent
                            ? "#fff7f7"
                            : "transparent",
                      }}
                    >
                      {/* STUDENT */}

                      <td
                        style={{
                          padding: "12px",
                          display: "flex",
                          alignItems:
                            "center",
                          gap: "10px",
                        }}
                      >
                        <img
                          src={
                            log.userPhotoUrl ||
                            "https://via.placeholder.com/40"
                          }
                          alt={
                            log.studentName
                          }
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius:
                              "50%",
                            objectFit:
                              "cover",
                          }}
                        />

                        <div>
                          <span
                            style={{
                              fontWeight:
                                "600",
                              color:
                                "#111827",
                            }}
                          >
                            {log.studentName ||
                              "—"}
                          </span>

                          {isAutomaticallyAbsent && (
                            <div
                              style={{
                                marginTop:
                                  "3px",
                                display:
                                  "inline-block",
                                fontSize:
                                  "10px",
                                padding:
                                  "2px 6px",
                                borderRadius:
                                  "4px",
                                backgroundColor:
                                  "#fee2e2",
                                color:
                                  "#991b1b",
                                border:
                                  "1px solid #fecaca",
                                fontWeight:
                                  "600",
                              }}
                            >
                              Automatically
                              marked absent
                            </div>
                          )}
                        </div>
                      </td>

                      {/* STUDENT ID */}

                      <td
                        style={{
                          padding: "12px",
                          fontFamily:
                            "monospace",
                          color:
                            "#4b5563",
                        }}
                      >
                        {log.studentID ||
                          "—"}
                      </td>

                      {/* CLASS */}

                      <td
                        style={{
                          padding: "12px",
                        }}
                      >
                        {studentClass}
                      </td>

                      {/* STATUS */}

                      <td
                        style={{
                          padding: "12px",
                        }}
                      >
                        <span
                          style={{
                            padding:
                              "4px 8px",
                            borderRadius:
                              "12px",
                            fontSize:
                              "12px",
                            fontWeight:
                              "bold",
                            ...getStatusStyle(
                              log.status
                            ),
                          }}
                        >
                          {log.status ||
                            "N/A"}
                        </span>
                      </td>

                      {/* CLOCK IN */}

                      <td
                        style={{
                          padding: "12px",
                          color:
                            "#047857",
                          fontWeight:
                            "600",
                        }}
                      >
                        {log.clockInTime
                          ? `📥 ${log.clockInTime}`
                          : "—"}
                      </td>

                      {/* CLOCK OUT */}

                      <td
                        style={{
                          padding: "12px",
                          color:
                            "#1d4ed8",
                          fontWeight:
                            "600",
                        }}
                      >
                        {log.clockOutTime ? (
                          <div>
                            <span>
                              📤{" "}
                              {
                                log.clockOutTime
                              }
                            </span>

                            {departureTiming ===
                              "Closing Window (Within 30m of Close)" && (
                              <div
                                style={{
                                  fontSize:
                                    "10px",
                                  color:
                                    "#d97706",
                                  marginTop:
                                    "2px",
                                }}
                              >
                                ⏱️ Closing
                                Window
                              </div>
                            )}

                            {log.clockOutByName && (
                              <div
                                style={{
                                  fontSize:
                                    "10px",
                                  color:
                                    "#6b7280",
                                  marginTop:
                                    "3px",
                                  fontWeight:
                                    "normal",
                                }}
                              >
                                By:{" "}
                                {
                                  log.clockOutByName
                                }

                                {log.clockOutByRole && (
                                  <>
                                    {" "}
                                    (
                                    {formatRole(
                                      log.clockOutByRole
                                    )}
                                    )
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span
                            style={{
                              color:
                                "#9ca3af",
                              fontStyle:
                                "italic",
                              fontWeight:
                                "normal",
                            }}
                          >
                            {isAutomaticallyAbsent
                              ? "—"
                              : "Still On Campus"}
                          </span>
                        )}
                      </td>

                      {/* RECORDED BY */}

                      <td
                        style={{
                          padding: "12px",
                          minWidth:
                            "150px",
                        }}
                      >
                        {log.loggedByName ? (
                          <div>
                            <div
                              style={{
                                fontWeight:
                                  "600",
                                color:
                                  "#111827",
                              }}
                            >
                              👤{" "}
                              {
                                log.loggedByName
                              }
                            </div>

                            <div
                              style={{
                                fontSize:
                                  "11px",
                                color:
                                  "#6b7280",
                                marginTop:
                                  "2px",
                              }}
                            >
                              {formatRole(
                                log.loggedByRole
                              )}
                            </div>
                          </div>
                        ) : (
                          <span
                            style={{
                              color:
                                "#9ca3af",
                              fontSize:
                                "12px",
                              fontStyle:
                                "italic",
                            }}
                          >
                            Not recorded
                          </span>
                        )}
                      </td>

                      {/* NOTES */}

                      <td
                        style={{
                          padding: "12px",
                          color:
                            "#6b7280",
                          fontSize:
                            "13px",
                        }}
                      >
                        {log.note ||
                          "—"}
                      </td>

                      {/* ACTIONS */}

                      <td
                        style={{
                          padding: "12px",
                          textAlign:
                            "center",
                        }}
                      >
                        {isAutomaticallyAbsent ? (
                          <span
                            style={{
                              fontSize:
                                "11px",
                              color:
                                "#9f1239",
                              fontStyle:
                                "italic",
                            }}
                          >
                            No record
                          </span>
                        ) : isEditing ? (
                          <div
                            style={{
                              display:
                                "flex",
                              flexDirection:
                                "column",
                              gap: "6px",
                              alignItems:
                                "center",
                            }}
                          >
                            <select
                              value={
                                editStatus
                              }
                              onChange={(
                                e
                              ) =>
                                setEditStatus(
                                  e.target
                                    .value
                                )
                              }
                              style={{
                                padding:
                                  "4px 8px",
                                fontSize:
                                  "12px",
                                borderRadius:
                                  "4px",
                                border:
                                  "1px solid #ccc",
                              }}
                            >
                              <option value="Present">
                                Present
                              </option>

                              <option value="Late">
                                Late
                              </option>

                              <option value="Excuse">
                                Excuse
                              </option>

                              <option value="Leave">
                                Leave
                              </option>

                              <option value="Absent">
                                Absent
                              </option>
                            </select>

                            <input
                              type="text"
                              placeholder="Add reason note..."
                              value={
                                editNote
                              }
                              onChange={(
                                e
                              ) =>
                                setEditNote(
                                  e.target
                                    .value
                                )
                              }
                              style={{
                                padding:
                                  "4px 8px",
                                fontSize:
                                  "11px",
                                borderRadius:
                                  "4px",
                                border:
                                  "1px solid #ccc",
                              }}
                            />

                            <div
                              style={{
                                display:
                                  "flex",
                                gap: "4px",
                              }}
                            >
                              <button
                                onClick={() =>
                                  handleSaveStatusOverride(
                                    log.id
                                  )
                                }
                                disabled={
                                  actionLoading
                                }
                                style={{
                                  padding:
                                    "4px 8px",
                                  backgroundColor:
                                    "#16a34a",
                                  color:
                                    "#fff",
                                  border:
                                    "none",
                                  borderRadius:
                                    "4px",
                                  fontSize:
                                    "11px",
                                  cursor:
                                    "pointer",
                                }}
                              >
                                Save
                              </button>

                              <button
                                onClick={() =>
                                  setEditingLogId(
                                    null
                                  )
                                }
                                style={{
                                  padding:
                                    "4px 8px",
                                  backgroundColor:
                                    "#9ca3af",
                                  color:
                                    "#fff",
                                  border:
                                    "none",
                                  borderRadius:
                                    "4px",
                                  fontSize:
                                    "11px",
                                  cursor:
                                    "pointer",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "center",
                              gap: "6px",
                              flexWrap:
                                "wrap",
                            }}
                          >
                            {/* QUICK CLOCK */}

                            {!log.clockOutTime && (
                              <button
                                onClick={() =>
                                  handleQuickClockAction(
                                    log
                                  )
                                }
                                disabled={
                                  actionLoading
                                }
                                title={
                                  !log.clockInTime
                                    ? "Force Clock In"
                                    : "Force Clock Out"
                                }
                                style={{
                                  padding:
                                    "5px 10px",
                                  backgroundColor:
                                    !log.clockInTime
                                      ? "#059669"
                                      : "#2563eb",
                                  color:
                                    "#fff",
                                  border:
                                    "none",
                                  borderRadius:
                                    "6px",
                                  fontSize:
                                    "12px",
                                  fontWeight:
                                    "600",
                                  cursor:
                                    "pointer",
                                }}
                              >
                                {!log.clockInTime
                                  ? "📥 Clock In"
                                  : "📤 Clock Out"}
                              </button>
                            )}

                            {/* DELETE */}

                            {/*
                            <button
                              onClick={() =>
                                handleDeleteLog(
                                  log.id,
                                  log.studentName
                                )
                              }
                              disabled={
                                actionLoading
                              }
                              title="Delete Record"
                              style={{
                                padding:
                                  "5px 10px",
                                backgroundColor:
                                  "#dc2626",
                                color:
                                  "#fff",
                                border:
                                  "none",
                                borderRadius:
                                  "6px",
                                fontSize:
                                  "12px",
                                fontWeight:
                                  "600",
                                cursor:
                                  "pointer",
                              }}
                            >
                              🗑️
                            </button>
                            */}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                }
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PupilAttendanceLogs;
