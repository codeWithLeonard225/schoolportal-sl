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
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [filterClass, setFilterClass] = useState("All");

  // State for active inline status edit modal/dropdown
  const [editingLogId, setEditingLogId] = useState(null);
  const [editStatus, setEditStatus] = useState("Present");
  const [editNote, setEditNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // School closing configuration (e.g., 2:00 PM = 14:00 = 840 minutes)
  const SCHOOL_CLOSING_HOUR = 14;
  const SCHOOL_CLOSING_MINUTE = 0;
  const CLOSING_TIME_MINUTES = SCHOOL_CLOSING_HOUR * 60 + SCHOOL_CLOSING_MINUTE;

  useEffect(() => {
    if (!currentSchoolId) return;

    const collectionRef = collection(db, "AttendanceLogs");
    const q = query(
      collectionRef,
      where("schoolId", "==", currentSchoolId),
      where("date", "==", selectedDate)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedLogs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLogs(fetchedLogs);
      },
      (error) => {
        console.error("Error fetching attendance logs:", error);
      }
    );

    return () => unsubscribe();
  }, [currentSchoolId, selectedDate]);

  // Helper to check if clock-out happened within 30 minutes before school close
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

    if (clockOutInMinutes >= windowStartMinutes && clockOutInMinutes < CLOSING_TIME_MINUTES) {
      return "Closing Window (Within 30m of Close)";
    } else if (clockOutInMinutes < windowStartMinutes) {
      return "Early Departure";
    }
    return "Normal Departure";
  };

  // --- ACTION HANDLERS ---

  // 1. Action: Force Manual Clock-Out or Clock-In
  const handleQuickClockAction = async (log) => {
    const nowTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const logRef = doc(db, "AttendanceLogs", log.id);
    setActionLoading(true);

    try {
      if (!log.clockInTime) {
        // Clock In if missing
        await updateDoc(logRef, {
          clockInTime: nowTime,
          status: "Present",
          updatedAt: serverTimestamp(),
        });
      } else if (!log.clockOutTime) {
        // Clock Out if missing
        await updateDoc(logRef, {
          clockOutTime: nowTime,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("Action error:", err);
      alert("Failed to update clock time.");
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Action: Save Status Override
  const handleSaveStatusOverride = async (logId) => {
    const logRef = doc(db, "AttendanceLogs", logId);
    setActionLoading(true);

    try {
      await updateDoc(logRef, {
        status: editStatus,
        note: editNote.trim() || `Status updated to ${editStatus} by Admin`,
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

  // 3. Action: Delete Log Record
  const handleDeleteLog = async (logId, studentName) => {
    if (!window.confirm(`Are you sure you want to delete the attendance log for ${studentName}?`)) {
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

  // Extract unique classes dynamically
  const availableClasses = [
    "All",
    ...Array.from(new Set(logs.map((log) => log.class).filter(Boolean))),
  ];

  // Filter logs based on selected class
  const filteredLogs =
    filterClass === "All"
      ? logs
      : logs.filter((log) => log.class === filterClass);

  // Status Badge Styling Helper
  const getStatusStyle = (status) => {
    switch (status) {
      case "Present":
        return { backgroundColor: "#d1fae5", color: "#065f46" };
      case "Late":
        return { backgroundColor: "#fef3c7", color: "#92400e" };
      case "Absent":
        return { backgroundColor: "#fee2e2", color: "#991b1b" };
      case "Excuse":
      case "Leave":
        return { backgroundColor: "#dbeafe", color: "#1e40af" };
      default:
        return { backgroundColor: "#f3f4f6", color: "#374151" };
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1280px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "16px", color: "#1f2937" }}>
        📋 Daily Student Attendance Logs
      </h2>

      {/* Controls */}
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
        <div>
          <label style={{ marginRight: "8px", fontWeight: "600", fontSize: "14px" }}>
            Select Date:
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
            }}
          />
        </div>

        <div>
          <label style={{ marginRight: "8px", fontWeight: "600", fontSize: "14px" }}>
            Filter Class:
          </label>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              backgroundColor: "#fff",
            }}
          >
            {availableClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr style={{ background: "#f3f4f6", borderBottom: "2px solid #e5e7eb" }}>
              <th style={{ padding: "12px" }}>Student</th>
              <th style={{ padding: "12px" }}>Student ID</th>
              <th style={{ padding: "12px" }}>Class</th>
              <th style={{ padding: "12px" }}>Status</th>
              <th style={{ padding: "12px" }}>Arrival (Clock In)</th>
              <th style={{ padding: "12px" }}>Departure (Clock Out)</th>
              <th style={{ padding: "12px" }}>Notes / Remarks</th>
              <th style={{ padding: "12px", textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td
                  colSpan="8"
                  style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}
                >
                  No attendance logs found for the selected criteria.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const departureTiming = checkEarlyDepartureNotice(log.clockOutTime);
                const isEditing = editingLogId === log.id;

                return (
                  <tr key={log.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    {/* Student Info */}
                    <td style={{ padding: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
                      <img
                        src={log.userPhotoUrl || "https://via.placeholder.com/40"}
                        alt={log.studentName}
                        style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                      />
                      <span style={{ fontWeight: "600", color: "#111827" }}>
                        {log.studentName || "—"}
                      </span>
                    </td>

                    {/* Student ID */}
                    <td style={{ padding: "12px", fontFamily: "monospace", color: "#4b5563" }}>
                      {log.studentID || "—"}
                    </td>

                    {/* Class */}
                    <td style={{ padding: "12px" }}>{log.class || "—"}</td>

                    {/* Status Badge */}
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "bold",
                          ...getStatusStyle(log.status),
                        }}
                      >
                        {log.status || "N/A"}
                      </span>
                    </td>

                    {/* Arrival Time */}
                    <td style={{ padding: "12px", color: "#047857", fontWeight: "600" }}>
                      {log.clockInTime ? `📥 ${log.clockInTime}` : "—"}
                    </td>

                    {/* Departure Time */}
                    <td style={{ padding: "12px", color: "#1d4ed8", fontWeight: "600" }}>
                      {log.clockOutTime ? (
                        <div>
                          <span>📤 {log.clockOutTime}</span>
                          {departureTiming === "Closing Window (Within 30m of Close)" && (
                            <div style={{ fontSize: "10px", color: "#d97706", marginTop: "2px" }}>
                              ⏱️ Closing Window
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#9ca3af", fontStyle: "italic", fontWeight: "normal" }}>
                          Still On Campus
                        </span>
                      )}
                    </td>

                    {/* Notes */}
                    <td style={{ padding: "12px", color: "#6b7280", fontSize: "13px" }}>
                      {log.note || "—"}
                    </td>

                    {/* Action Column Buttons */}
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      {isEditing ? (
                        /* Inline Status Edit Mode */
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "center" }}>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "4px", border: "1px solid #ccc" }}
                          >
                            <option value="Present">Present</option>
                            <option value="Late">Late</option>
                            <option value="Excuse">Excuse</option>
                            <option value="Leave">Leave</option>
                            <option value="Absent">Absent</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Add reason note..."
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            style={{ padding: "4px 8px", fontSize: "11px", borderRadius: "4px", border: "1px solid #ccc" }}
                          />
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button
                              onClick={() => handleSaveStatusOverride(log.id)}
                              disabled={actionLoading}
                              style={{
                                padding: "4px 8px",
                                backgroundColor: "#16a34a",
                                color: "#fff",
                                border: "none",
                                borderRadius: "4px",
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingLogId(null)}
                              style={{
                                padding: "4px 8px",
                                backgroundColor: "#9ca3af",
                                color: "#fff",
                                border: "none",
                                borderRadius: "4px",
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Standard Action Buttons */
                        <div style={{ display: "flex", justifyContent: "center", gap: "6px", flexWrap: "wrap" }}>
                          {/* Quick Clock-Out / Clock-In Button */}
                          {!log.clockOutTime && (
                            <button
                              onClick={() => handleQuickClockAction(log)}
                              disabled={actionLoading}
                              title={!log.clockInTime ? "Force Clock In" : "Force Clock Out"}
                              style={{
                                padding: "5px 10px",
                                backgroundColor: !log.clockInTime ? "#059669" : "#2563eb",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "600",
                                cursor: "pointer",
                              }}
                            >
                              {!log.clockInTime ? "📥 Clock In" : "📤 Clock Out"}
                            </button>
                          )}

                          {/* Edit / Override Status Button */}
                          <button
                            onClick={() => {
                              setEditingLogId(log.id);
                              setEditStatus(log.status || "Present");
                              setEditNote(log.note || "");
                            }}
                            title="Edit Status or Add Note"
                            style={{
                              padding: "5px 10px",
                              backgroundColor: "#f59e0b",
                              color: "#fff",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            ✏️ Edit
                          </button>

                          {/* Delete Log Button */}
                          <button
                            onClick={() => handleDeleteLog(log.id, log.studentName)}
                            disabled={actionLoading}
                            title="Delete Record"
                            style={{
                              padding: "5px 10px",
                              backgroundColor: "#dc2626",
                              color: "#fff",
                              border: "none",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            🗑️
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
    </div>
  );
};

export default PupilAttendanceLogs;