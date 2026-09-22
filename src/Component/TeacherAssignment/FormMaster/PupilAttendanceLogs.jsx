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
import { db } from "../../../../firebase";
import { useAuth } from "../../Security/AuthContext";

const PupilAttendanceLogs = () => {
  const { user } = useAuth();
  const currentSchoolId = user?.schoolId || "";

  // ==========================================================
  // TEACHER INFORMATION
  // ==========================================================
  const [liveTeacherInfo, setLiveTeacherInfo] = useState(null);

  const isFormTeacher =
    liveTeacherInfo?.isFormTeacher ??
    user?.data?.isFormTeacher ??
    false;

  const assignedClass =
    liveTeacherInfo?.assignClass ??
    user?.data?.assignClass ??
    null;

  const isClassRestricted = !!(isFormTeacher && assignedClass);

  // ==========================================================
  // STATE MANAGEMENT
  // ==========================================================
  const [logs, setLogs] = useState([]);
  const [classPupils, setClassPupils] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableAcademicYears, setAvailableAcademicYears] = useState([]);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [filterClass, setFilterClass] = useState("");

  // Editing state
  const [editingLogId, setEditingLogId] = useState(null);
  const [editStatus, setEditStatus] = useState("Present");
  const [editNote, setEditNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const SCHOOL_CLOSING_HOUR = 14;
  const SCHOOL_CLOSING_MINUTE = 0;
  const CLOSING_TIME_MINUTES =
    SCHOOL_CLOSING_HOUR * 60 + SCHOOL_CLOSING_MINUTE;

  // Fallback image for missing/broken avatars
  const DEFAULT_AVATAR = "https://via.placeholder.com/40";

  // ==========================================================
  // HELPER FUNCTIONS
  // ==========================================================
  const getLoggedInUser = () => {
    try {
      const savedUser = JSON.parse(localStorage.getItem("schoolUser"));
      if (!savedUser) {
        return { id: "", name: "Unknown User", role: "Unknown" };
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
      console.error("Failed to read logged-in user:", error);
      return { id: "", name: "Unknown User", role: "Unknown" };
    }
  };

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
  // FIRESTORE EFFECTS
  // ==========================================================
  useEffect(() => {
    if (!user?.data?.teacherID || !currentSchoolId) {
      setLiveTeacherInfo(null);
      return;
    }

    const teacherQuery = query(
      collection(db, "Teachers"),
      where("teacherID", "==", user.data.teacherID),
      where("schoolId", "==", currentSchoolId)
    );

    const unsubscribe = onSnapshot(
      teacherQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const teacherDoc = snapshot.docs[0];
          setLiveTeacherInfo({
            id: teacherDoc.id,
            ...teacherDoc.data(),
          });
        } else {
          setLiveTeacherInfo(null);
        }
      },
      (error) => {
        console.error("Error fetching logged-in teacher:", error);
        setLiveTeacherInfo(null);
      }
    );

    return () => unsubscribe();
  }, [user?.data?.teacherID, currentSchoolId]);

  useEffect(() => {
    if (!currentSchoolId) return;

    const pupilsQuery = query(
      collection(db, "PupilsReg"),
      where("schoolId", "==", currentSchoolId)
    );

    const unsubscribe = onSnapshot(
      pupilsQuery,
      (snapshot) => {
        const allPupils = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));

        const academicYears = Array.from(
          new Set(
            allPupils
              .map((p) => p.academicYear || p.academic_year || "")
              .filter(Boolean)
          )
        )
          .sort()
          .reverse();

        setAvailableAcademicYears(academicYears);

        let classes;
        if (isClassRestricted && assignedClass) {
          classes = [assignedClass];
        } else {
          classes = Array.from(
            new Set(
              allPupils
                .map((p) => p.class || p.className || "")
                .filter(Boolean)
            )
          ).sort();
        }

        setAvailableClasses(classes);

        if (isClassRestricted && assignedClass) {
          setFilterClass(assignedClass);
        } else {
          setFilterClass((curr) => (classes.includes(curr) ? curr : ""));
        }

        setSelectedAcademicYear((curr) =>
          academicYears.includes(curr) ? curr : academicYears[0] || ""
        );
      },
      (error) => {
        console.error("Error fetching metadata:", error);
      }
    );

    return () => unsubscribe();
  }, [currentSchoolId, isClassRestricted, assignedClass]);

  useEffect(() => {
    setClassPupils([]);
    if (!currentSchoolId || !filterClass || !selectedAcademicYear) return;

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
        console.error("Error fetching pupils:", error);
      }
    );

    return () => unsubscribe();
  }, [currentSchoolId, filterClass, selectedAcademicYear]);

  useEffect(() => {
    setLogs([]);
    if (
      !currentSchoolId ||
      !filterClass ||
      !selectedAcademicYear ||
      !selectedDate
    )
      return;

    const attendanceQuery = query(
      collection(db, "AttendanceLogs"),
      where("schoolId", "==", currentSchoolId),
      where("date", "==", selectedDate),
      where("class", "==", filterClass),
      where("academicYear", "==", selectedAcademicYear)
    );

    const unsubscribe = onSnapshot(
      attendanceQuery,
      (snapshot) => {
        const fetchedLogs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLogs(fetchedLogs);
      },
      (error) => {
        console.error("Error fetching logs:", error);
      }
    );

    return () => unsubscribe();
  }, [currentSchoolId, selectedDate, filterClass, selectedAcademicYear]);

  // ==========================================================
  // ACTIONS
  // ==========================================================
  const checkEarlyDepartureNotice = (clockOutTimeString) => {
    if (!clockOutTimeString) return null;
    const match = clockOutTimeString.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3];

    if (period) {
      if (period.toUpperCase() === "PM" && hours < 12) hours += 12;
      if (period.toUpperCase() === "AM" && hours === 12) hours = 0;
    }

    const clockOutInMinutes = hours * 60 + minutes;
    const windowStartMinutes = CLOSING_TIME_MINUTES - 30;

    if (
      clockOutInMinutes >= windowStartMinutes &&
      clockOutInMinutes < CLOSING_TIME_MINUTES
    ) {
      return "Closing Window (Within 30m)";
    }
    if (clockOutInMinutes < windowStartMinutes) {
      return "Early Departure";
    }
    return "Normal Departure";
  };

  const handleSaveStatusOverride = async (logId) => {
    const logRef = doc(db, "AttendanceLogs", logId);
    setActionLoading(true);
    const loggedInUser = getLoggedInUser();

    try {
      await updateDoc(logRef, {
        status: editStatus,
        note:
          editNote.trim() ||
          `Status updated to ${editStatus} by ${loggedInUser.name}`,
        loggedById: loggedInUser.id,
        loggedByName: loggedInUser.name,
        loggedByRole: loggedInUser.role,
        updatedAt: serverTimestamp(),
      });
      setEditingLogId(null);
      setEditNote("");
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update attendance record.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLog = async (logId, studentName) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the log for ${studentName}?`
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, "AttendanceLogs", logId));
    } catch (err) {
      console.error("Error deleting log:", err);
      alert("Failed to delete record.");
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================================
  // DATA COMPUTATION
  // ==========================================================
  const getDisplayAttendance = () => {
    if (!filterClass || !selectedAcademicYear) return [];
    const attendanceMap = new Map();

    logs.forEach((log) => {
      const studentId = log.studentID || log.pupilID || log.studentId;
      if (studentId) attendanceMap.set(String(studentId), log);
    });

    if (logs.length === 0) return [];

    return classPupils.map((pupil) => {
      const studentID =
        pupil.studentID || pupil.pupilID || pupil.studentId || pupil.id || "";
      const existingRecord = attendanceMap.get(String(studentID));

      if (existingRecord) {
        return { ...existingRecord, isAutomaticallyAbsent: false };
      }

      return {
        id: `absent-${pupil.id}`,
        studentID: studentID || "---",
        studentName:
          pupil.studentName || pupil.pupilName || pupil.name || "Unnamed Pupil",
        class: pupil.class || pupil.className || filterClass,
        academicYear: pupil.academicYear || selectedAcademicYear,
        userPhotoUrl: pupil.userPhotoUrl || pupil.photoUrl || pupil.photo || "",
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

  const displayAttendance = getDisplayAttendance();

  const totalPupils = classPupils.length;
  const totalPresent = displayAttendance.filter(
    (l) => String(l.status || "").toLowerCase() === "present"
  ).length;
  const totalLate = displayAttendance.filter(
    (l) => String(l.status || "").toLowerCase() === "late"
  ).length;
  const totalAbsent = displayAttendance.filter(
    (l) => String(l.status || "").toLowerCase() === "absent"
  ).length;

  const getStatusStyle = (status) => {
    switch (String(status || "").toLowerCase()) {
      case "present":
        return { backgroundColor: "#d1fae5", color: "#065f46" };
      case "late":
        return { backgroundColor: "#fef3c7", color: "#92400e" };
      case "absent":
        return { backgroundColor: "#fee2e2", color: "#991b1b" };
      case "excuse":
      case "excused":
        return { backgroundColor: "#dbeafe", color: "#1e40af" };
      case "leave":
      case "on leave":
        return { backgroundColor: "#ede9fe", color: "#6d28d9" };
      default:
        return { backgroundColor: "#f3f4f6", color: "#374151" };
    }
  };

  // ==========================================================
  // RENDER
  // ==========================================================
  return (
    <div className="attendance-container">
      <style>{`
        .attendance-container {
          padding: 16px;
          max-width: 1400px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #1f2937;
        }

        .controls-card {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          background-color: #f9fafb;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          margin-bottom: 20px;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1 1 200px;
        }

        .control-group label {
          font-weight: 600;
          font-size: 13px;
          color: #374151;
        }

        .control-input {
          padding: 10px 12px;
          border-radius: 6px;
          border: 1px solid #d1d5db;
          font-size: 14px;
          width: 100%;
          box-sizing: border-box;
          background-color: #fff;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .summary-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 14px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .summary-card-title {
          font-size: 11px;
          color: #6b7280;
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        .summary-card-value {
          font-size: 24px;
          font-weight: 700;
        }

        .desktop-table-container {
          display: block;
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
        }

        .attendance-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 14px;
        }

        .attendance-table th, .attendance-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: middle;
        }

        .attendance-table th {
          background-color: #f9fafb;
          font-weight: 600;
          color: #4b5563;
        }

        .mobile-cards-container {
          display: none;
          flex-direction: column;
          gap: 12px;
        }

        .mobile-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 14px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .btn {
          padding: 8px 12px;
          border-radius: 6px;
          border: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .btn-primary {
          background-color: #2563eb;
          color: #fff;
        }

        .btn-danger {
          background-color: #ef4444;
          color: #fff;
        }

        .btn-secondary {
          background-color: #e5e7eb;
          color: #374151;
        }

        @media (max-width: 768px) {
          .attendance-container {
            padding: 12px;
          }
          .desktop-table-container {
            display: none;
          }
          .mobile-cards-container {
            display: flex;
          }
        }
      `}</style>

      {/* PAGE TITLE */}
      <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "16px" }}>
        📋 Daily Student Attendance Logs
      </h2>

      {/* FORM TEACHER NOTIFICATION */}
      {isFormTeacher && assignedClass && (
        <div
          style={{
            marginBottom: "16px",
            padding: "10px 14px",
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "6px",
            color: "#1e40af",
            fontSize: "13px",
          }}
        >
          <strong>Form Teacher Class:</strong> {assignedClass}
        </div>
      )}

      {/* CONTROLS */}
      <div className="controls-card">
        <div className="control-group">
          <label>Select Date:</label>
          <input
            type="date"
            className="control-input"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="control-group">
          <label>Select Class:</label>
          <select
            className="control-input"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            disabled={isClassRestricted}
            style={{
              backgroundColor: isClassRestricted ? "#f3f4f6" : "#fff",
            }}
          >
            <option value="">-- Select Class --</option>
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Academic Year:</label>
          <select
            className="control-input"
            value={selectedAcademicYear}
            onChange={(e) => setSelectedAcademicYear(e.target.value)}
          >
            <option value="">-- Select Year --</option>
            {availableAcademicYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ATTENDANCE SUMMARY */}
      {filterClass && selectedAcademicYear && (
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-card-title">TOTAL PUPILS</div>
            <div className="summary-card-value">{totalPupils}</div>
          </div>
          <div className="summary-card" style={{ backgroundColor: "#ecfdf5" }}>
            <div className="summary-card-title" style={{ color: "#065f46" }}>
              PRESENT
            </div>
            <div className="summary-card-value" style={{ color: "#047857" }}>
              {totalPresent}
            </div>
          </div>
          <div className="summary-card" style={{ backgroundColor: "#fffbeb" }}>
            <div className="summary-card-title" style={{ color: "#92400e" }}>
              LATE
            </div>
            <div className="summary-card-value" style={{ color: "#b45309" }}>
              {totalLate}
            </div>
          </div>
          <div className="summary-card" style={{ backgroundColor: "#fef2f2" }}>
            <div className="summary-card-title" style={{ color: "#991b1b" }}>
              ABSENT
            </div>
            <div className="summary-card-value" style={{ color: "#b91c1c" }}>
              {totalAbsent}
            </div>
          </div>
        </div>
      )}

      {/* ATTENDANCE LIST (DESKTOP) */}
      {filterClass && selectedAcademicYear && (
        <>
          <div className="desktop-table-container">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Pupil</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Status</th>
                  <th>Logged By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayAttendance.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", color: "#6b7280" }}>
                      No attendance data recorded for this date.
                    </td>
                  </tr>
                ) : (
                  displayAttendance.map((log) => {
                    const earlyNotice = checkEarlyDepartureNotice(log.clockOutTime);
                    return (
                      <tr key={log.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <img
                              src={log.userPhotoUrl || DEFAULT_AVATAR}
                              alt={log.studentName}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = DEFAULT_AVATAR;
                              }}
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "50%",
                                objectFit: "cover",
                                flexShrink: 0,
                              }}
                            />
                            <div>
                              <div style={{ fontWeight: 600 }}>{log.studentName}</div>
                              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                                ID: {log.studentID}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{log.clockInTime || "---"}</td>
                        <td>
                          {log.clockOutTime || "---"}
                          {earlyNotice && (
                            <div style={{ fontSize: "10px", color: "#d97706" }}>
                              {earlyNotice}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className="badge"
                            style={getStatusStyle(log.status)}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: "13px" }}>
                            {log.loggedByName || "System"}
                          </div>
                          <div style={{ fontSize: "11px", color: "#6b7280" }}>
                            {formatRole(log.loggedByRole)}
                          </div>
                        </td>
                        <td>
                          {!log.isAutomaticallyAbsent && (
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                className="btn btn-secondary"
                                onClick={() => {
                                  setEditingLogId(log.id);
                                  setEditStatus(log.status || "Present");
                                  setEditNote(log.note || "");
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-danger"
                                onClick={() =>
                                  handleDeleteLog(log.id, log.studentName)
                                }
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ATTENDANCE LIST (MOBILE CARDS) */}
          <div className="mobile-cards-container">
            {displayAttendance.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "#6b7280",
                  background: "#fff",
                  borderRadius: "8px",
                }}
              >
                No attendance data recorded for this date.
              </div>
            ) : (
              displayAttendance.map((log) => {
                const earlyNotice = checkEarlyDepartureNotice(log.clockOutTime);
                return (
                  <div key={log.id} className="mobile-card">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <img
                          src={log.userPhotoUrl || DEFAULT_AVATAR}
                          alt={log.studentName}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = DEFAULT_AVATAR;
                          }}
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            objectFit: "cover",
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "15px" }}>
                            {log.studentName}
                          </div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            ID: {log.studentID}
                          </div>
                        </div>
                      </div>
                      <span className="badge" style={getStatusStyle(log.status)}>
                        {log.status}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "8px",
                        fontSize: "13px",
                        margin: "10px 0",
                        padding: "8px 0",
                        borderTop: "1px solid #f3f4f6",
                        borderBottom: "1px solid #f3f4f6",
                      }}
                    >
                      <div>
                        <span style={{ color: "#6b7280", fontSize: "11px" }}>
                          CLOCK IN:
                        </span>
                        <div>{log.clockInTime || "---"}</div>
                      </div>
                      <div>
                        <span style={{ color: "#6b7280", fontSize: "11px" }}>
                          CLOCK OUT:
                        </span>
                        <div>{log.clockOutTime || "---"}</div>
                        {earlyNotice && (
                          <div style={{ fontSize: "10px", color: "#d97706" }}>
                            {earlyNotice}
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        By: {log.loggedByName || "System"} (
                        {formatRole(log.loggedByRole)})
                      </div>
                      {!log.isAutomaticallyAbsent && (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setEditingLogId(log.id);
                              setEditStatus(log.status || "Present");
                              setEditNote(log.note || "");
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() =>
                              handleDeleteLog(log.id, log.studentName)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* EDIT MODAL / INLINE EDITOR */}
      {editingLogId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              padding: "20px",
              width: "100%",
              maxWidth: "400px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "12px" }}>
              Update Attendance Status
            </h3>
            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", marginBottom: "4px" }}>
                Status:
              </label>
              <select
                className="control-input"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              >
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Absent">Absent</option>
                <option value="Excused">Excused</option>
                <option value="On Leave">On Leave</option>
              </select>
            </div>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "4px" }}>
                Note:
              </label>
              <textarea
                className="control-input"
                rows="3"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Optional reason or note..."
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={() => setEditingLogId(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleSaveStatusOverride(editingLogId)}
                disabled={actionLoading}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PupilAttendanceLogs;