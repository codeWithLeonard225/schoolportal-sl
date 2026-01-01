// StaffAttendanceSimple.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { db } from "../../../firebase";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../Security/AuthContext";
import localforage from "localforage";

// --- CONFIG ---
const STORE_NAME = "StaffSimpleCache";
const ATT_COLLECTION = "StaffAttendanceSimple";
const STAFF_COLLECTION = "Teachers";
const CACHE_PREFIX = "staff_list_";
const LOCK_DURATION_HOURS = 2; // 2-hour editing window
const LATE_THRESHOLD = "08:30"; // hh:mm (use option A default)
const ADMIN_PASSWORD = "superadmin"; // change to your actual admin password

const staffStore = localforage.createInstance({
  name: STORE_NAME,
  storeName: "staff_simple",
});

const getTodayDate = () => new Date().toISOString().slice(0, 10);

// helpers
const parseTimeToTodayDate = (timeStr) => {
  // timeStr "HH:MM" => Date for today at that time in local timezone
  const [hh, mm] = timeStr.split(":").map((s) => parseInt(s, 10));
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
};

const isLateByThreshold = (dateObj) => {
  if (!dateObj) return false;
  const threshold = parseTimeToTodayDate(LATE_THRESHOLD);
  // compare time-of-day only if same date
  return dateObj.getTime() > threshold.getTime();
};

export default function StaffAttendanceSimpleAdvanced() {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "N/A";

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
  // unsaved local marks: { staffID: { action: 'in'|'out' } }
  const [unsaved, setUnsaved] = useState({});
  // attendanceRecords: { staffID: { status, docId, clockIn: Date|null, clockOut: Date|null, manualOverride?, reason? } }
  const [attendanceRecords, setAttendanceRecords] = useState({});

  const CACHE_KEY = `${CACHE_PREFIX}${schoolId}`;

  // ------- Load staff list (cache-first + realtime)
  useEffect(() => {
    if (!schoolId || schoolId === "N/A") {
      setLoading(false);
      return;
    }
    setLoading(true);
    let unsub = () => {};

    (async () => {
      try {
        const cached = await staffStore.getItem(CACHE_KEY);
        if (cached && cached.length) {
          setStaffList(cached);
          setLoading(false);
        }
      } catch (e) {
        console.error("staff cache load failed", e);
      }

      const q = query(collection(db, STAFF_COLLECTION), where("schoolId", "==", schoolId));
      unsub = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setStaffList(list);
          staffStore.setItem(CACHE_KEY, list).catch(() => {});
          setLoading(false);
        },
        (err) => {
          console.error("Staff list onSnapshot failed", err);
          setLoading(false);
          toast.error("Failed to load staff list.");
        }
      );
    })();

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  // ------- Fetch attendance for selected date
  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      try {
        const q = query(
          collection(schoollpq, ATT_COLLECTION),
          where("schoolId", "==", schoolId),
          where("date", "==", attendanceDate)
        );
        const snap = await getDocs(q);
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[data.staffID] = {
            status: data.status || (data.clockIn ? "Present" : "Unmarked"),
            docId: d.id,
            // convert Firestore timestamp fields to Date if present
            clockIn: data.clockIn ? data.clockIn.toDate() : null,
            clockOut: data.clockOut ? data.clockOut.toDate() : null,
            manualOverride: !!data.manualOverride,
            reason: data.reason || "",
          };
        });
        setAttendanceRecords(map);
        setUnsaved({});
      } catch (err) {
        console.error("fetch simple attendance failed", err);
        toast.error("Failed to load attendance records.");
      }
    })();
  }, [schoolId, attendanceDate]);

  // sorted staff
  const filtered = useMemo(
    () => staffList.slice().sort((a, b) => (a.teacherName || "").localeCompare(b.teacherName || "")),
    [staffList]
  );

  // ---------- Locking logic: only allow edits for today's date and within LOCK_DURATION_HOURS after saved clock-in
  const isAttendanceLocked = useCallback(
    (staffID) => {
      const today = getTodayDate();
      if (attendanceDate !== today) return true; // lock if not today

      const rec = attendanceRecords[staffID];
      if (rec && rec.clockIn instanceof Date) {
        const now = Date.now();
        const recordTime = rec.clockIn.getTime();
        const diffMs = now - recordTime;
        return diffMs > LOCK_DURATION_HOURS * 60 * 60 * 1000;
      }
      return false; // not locked if no saved record (allows marking)
    },
    [attendanceDate, attendanceRecords]
  );

  // ---------- Individual actions (normal user)
  const handleClockIn = async (staffID) => {
    // local mark then save on Save action, or we can directly save per action — we will set local unsaved to 'in'
    if (isAttendanceLocked(staffID)) {
      toast.warn("This record is locked. You can only mark today's attendance within the editing window.");
      return;
    }
    setUnsaved((p) => ({ ...p, [staffID]: { action: "in" } }));
  };

  const handleClockOut = async (staffID) => {
    if (isAttendanceLocked(staffID)) {
      toast.warn("This record is locked. You can only mark today's attendance within the editing window.");
      return;
    }
    setUnsaved((p) => ({ ...p, [staffID]: { action: "out" } }));
  };

  // ---------- Admin override helpers (prompt for password + reason)
  const requestAdminPassword = () => {
    const pw = window.prompt("Enter admin password to confirm override:");
    if (pw === null) return false; // canceled
    if (pw !== ADMIN_PASSWORD) {
      toast.error("Incorrect admin password.");
      return false;
    }
    return true;
  };
  const requestReason = () => {
    const reason = window.prompt("Enter reason for manual override (required):", "");
    if (!reason || reason.trim() === "") {
      toast.error("Reason is required for override.");
      return null;
    }
    return reason.trim();
  };

  // ---------- Bulk operations (admin override)
  const handleBulkClockIn = async () => {
    if (!requestAdminPassword()) return;
    const reason = requestReason();
    if (!reason) return;

    setIsSaving(true);
    try {
      const now = new Date();
      const ops = [];
      for (const s of filtered) {
        const idKey = s.teacherID || s.id;
        const existing = attendanceRecords[idKey];

        // If already clocked in, skip unless you want to override - we'll skip to avoid duplicate
        if (existing && existing.clockIn) continue;

        const docData = {
          schoolId,
          staffID: idKey,
          staffName: s.teacherName || "Unknown",
          date: attendanceDate,
          clockIn: now,
          clockOut: null,
          status: "Present",
          manualOverride: true,
          reason,
          registeredBy: user?.data?.adminID || user?.data?.teacherID || "System",
          updatedAt: serverTimestamp(),
        };

        ops.push(addDoc(collection(schoollpq, ATT_COLLECTION), docData));
      }
      if (ops.length === 0) {
        toast.info("No staff needed clock-in (everyone already clocked in).");
      } else {
        await Promise.all(ops);
        toast.success(`Bulk clock-in saved for ${ops.length} staff.`);
      }
      // refresh
      const q = query(collection(schoollpq, ATT_COLLECTION), where("schoolId", "==", schoolId), where("date", "==", attendanceDate));
      const snap = await getDocs(q);
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        map[data.staffID] = {
          status: data.status || (data.clockIn ? "Present" : "Unmarked"),
          docId: d.id,
          clockIn: data.clockIn ? data.clockIn.toDate() : null,
          clockOut: data.clockOut ? data.clockOut.toDate() : null,
          manualOverride: !!data.manualOverride,
          reason: data.reason || "",
        };
      });
      setAttendanceRecords(map);
      setUnsaved({});
    } catch (err) {
      console.error(err);
      toast.error("Bulk clock-in failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkClockOut = async () => {
    if (!requestAdminPassword()) return;
    const reason = requestReason();
    if (!reason) return;

    setIsSaving(true);
    try {
      const now = new Date();
      // find attendance docs for date and staff that have clockIn but no clockOut
      const q = query(collection(schoollpq, ATT_COLLECTION), where("schoolId", "==", schoolId), where("date", "==", attendanceDate));
      const snap = await getDocs(q);
      const updates = [];
      let count = 0;
      snap.docs.forEach((d) => {
        const data = d.data();
        const idKey = data.staffID;
        // only update records with clockIn but no clockOut
        if (data.clockIn && !data.clockOut) {
          const ref = doc(schoollpq, ATT_COLLECTION, d.id);
          updates.push(updateDoc(ref, {
            clockOut: now,
            status: "Present", // still present for the day, but clockOut recorded
            manualOverride: true,
            reason,
            updatedAt: serverTimestamp(),
          }));
          count++;
        }
      });
      if (updates.length === 0) {
        toast.info("No staff to clock-out (none without clock-out found).");
      } else {
        await Promise.all(updates);
        toast.success(`Bulk clock-out completed for ${count} staff.`);
      }

      // refresh
      const snap2 = await getDocs(q);
      const map = {};
      snap2.docs.forEach((d) => {
        const data = d.data();
        map[data.staffID] = {
          status: data.status || (data.clockIn ? "Present" : "Unmarked"),
          docId: d.id,
          clockIn: data.clockIn ? data.clockIn.toDate() : null,
          clockOut: data.clockOut ? data.clockOut.toDate() : null,
          manualOverride: !!data.manualOverride,
          reason: data.reason || "",
        };
      });
      setAttendanceRecords(map);
      setUnsaved({});
    } catch (err) {
      console.error(err);
      toast.error("Bulk clock-out failed.");
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- Save function (saves unsaved individual marks)
  const handleSave = async () => {
    if (!Object.keys(unsaved).length) {
      toast.info("No changes to save.");
      return;
    }
    setIsSaving(true);
    try {
      const now = new Date();
      const regs = [];
      for (const [staffID, { action }] of Object.entries(unsaved)) {
        const s = staffList.find((x) => x.teacherID === staffID || x.id === staffID);
        const staffIDToUse = s?.teacherID || staffID;
        const existing = attendanceRecords[staffIDToUse];

        if (action === "in") {
          if (existing && existing.clockIn) {
            // skip or offer to update? we'll skip
            continue;
          }
          const docData = {
            schoolId,
            staffID: staffIDToUse,
            staffName: s?.teacherName || "Unknown",
            date: attendanceDate,
            clockIn: now,
            clockOut: null,
            status: "Present",
            manualOverride: false,
            reason: "",
            registeredBy: user?.data?.adminID || user?.data?.teacherID || "System",
            updatedAt: serverTimestamp(),
          };
          regs.push(addDoc(collection(schoollpq, ATT_COLLECTION), docData));
        } else if (action === "out") {
          if (existing && existing.docId) {
            const ref = doc(schoollpq, ATT_COLLECTION, existing.docId);
            regs.push(updateDoc(ref, { clockOut: now, updatedAt: serverTimestamp() }));
          } else {
            // if no existing record but user marked Out, create a record with empty clockIn and clockOut now
            const docData = {
              schoolId,
              staffID: staffIDToUse,
              staffName: s?.teacherName || "Unknown",
              date: attendanceDate,
              clockIn: null,
              clockOut: now,
              status: "Present",
              manualOverride: false,
              reason: "",
              registeredBy: user?.data?.adminID || user?.data?.teacherID || "System",
              updatedAt: serverTimestamp(),
            };
            regs.push(addDoc(collection(schoollpq, ATT_COLLECTION), docData));
          }
        }
      }
      if (regs.length > 0) await Promise.all(regs);
      toast.success("Changes saved.");
      // refresh
      const q = query(collection(schoollpq, ATT_COLLECTION), where("schoolId", "==", schoolId), where("date", "==", attendanceDate));
      const snap = await getDocs(q);
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        map[data.staffID] = {
          status: data.status || (data.clockIn ? "Present" : "Unmarked"),
          docId: d.id,
          clockIn: data.clockIn ? data.clockIn.toDate() : null,
          clockOut: data.clockOut ? data.clockOut.toDate() : null,
          manualOverride: !!data.manualOverride,
          reason: data.reason || "",
        };
      });
      setAttendanceRecords(map);
      setUnsaved({});
    } catch (err) {
      console.error(err);
      toast.error("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  // -------- UI helpers
  const getStatusDisplay = (rec, uns) => {
    const status = uns || (rec && rec.status) || "Unmarked";
    if (status === "Present") {
      return <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-300">Present</span>;
    }
    if (status === "Unmarked") {
      return <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-300">Unmarked</span>;
    }
    return <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-300">Absent</span>;
  };

  const isPresent = (status) => status === "Present";
  const isAbsent = (status) => status === "Absent";

  if (schoolId === "N/A") {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-red-100 text-red-800 border border-red-300 rounded shadow">
        <p className="font-bold">Access Error:</p>
        <p>School ID not found. Please log in again or check user context.</p>
      </div>
    );
  }

  const hasUnsavedChanges = Object.keys(unsaved).length > 0;

  return (
    <div className="max-w-5xl mx-auto p-4 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-lg p-4">
        <h2 className="text-2xl font-extrabold mb-3 text-center text-indigo-700">Staff Attendance</h2>

        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between mb-3">
          <div className="flex gap-2 items-center">
            <label className="text-sm font-medium">Date:</label>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              max={getTodayDate()}
              className="border px-2 py-1 rounded"
              disabled={loading || isSaving}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleBulkClockIn}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
              disabled={loading || isSaving}
              title="Admin bulk clock-in (requires password and reason)"
            >
              Bulk Clock-In
            </button>

            <button
              onClick={handleBulkClockOut}
              className="bg-orange-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50"
              disabled={loading || isSaving}
              title="Admin bulk clock-out (requires password and reason)"
            >
              Bulk Clock-Out
            </button>

            <button
              onClick={handleSave}
              className={`bg-indigo-600 text-white px-3 py-1 rounded text-sm ${!hasUnsavedChanges ? "opacity-60 cursor-not-allowed" : ""}`}
              disabled={!hasUnsavedChanges || isSaving || loading}
              title="Save individual marks"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center p-6">Loading staff...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center p-6">No staff found.</div>
        ) : (
          <div className="overflow-x-auto border rounded">
            <table className="min-w-full">
              <thead className="bg-gray-100 text-xs text-gray-600">
                <tr>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 hidden sm:table-cell">ID</th>
                  <th className="p-2 text-center">Status</th>
                  <th className="p-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const idKey = s.teacherID || s.id;
                  const rec = attendanceRecords[idKey];
                  const unsRec = unsaved[idKey];
                  const displayStatus = unsRec ? (unsRec.action === "in" ? "Present" : "Present") : rec?.status || "Unmarked";
                  const savedClockIn = rec?.clockIn || null;
                  const savedClockOut = rec?.clockOut || null;
                  const locked = isAttendanceLocked(idKey);
                  const late = savedClockIn && isLateByThreshold(savedClockIn);

                  return (
                    <tr key={s.id} className={`border-b ${locked ? "opacity-80 bg-gray-50" : ""}`}>
                      <td className="p-2 text-sm font-medium">
                        {s.teacherName} {late && <span className="ml-2 text-yellow-600 text-sm">⚠️ Late</span>}
                        {rec?.manualOverride && <span className="ml-2 text-xs text-blue-600">(override)</span>}
                      </td>
                      <td className="p-2 text-sm hidden sm:table-cell">{s.teacherID || "N/A"}</td>
                      <td className="p-2 text-center">{getStatusDisplay(rec, unsRec ? (unsRec.action === "in" ? "Present" : "Present") : null)}</td>
                      <td className="p-2 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleClockIn(idKey)}
                            disabled={isSaving || locked || (rec && rec.clockIn)}
                            className={`px-2 py-1 text-xs rounded ${rec && rec.clockIn ? "bg-green-500 text-white" : "bg-green-100 text-green-800"}`}
                          >
                            In
                          </button>

                          <button
                            onClick={() => handleClockOut(idKey)}
                            disabled={isSaving || locked || (!rec && !unsRec)}
                            className={`px-2 py-1 text-xs rounded ${rec && rec.clockOut ? "bg-gray-400 text-white" : "bg-red-100 text-red-800"}`}
                          >
                            Out
                          </button>

                          {/* Admin single override: prompt for password & reason, then set clockIn or clockOut immediately */}
                          <button
                            onClick={async () => {
                              const ok = requestAdminPassword();
                              if (!ok) return;
                              const reason = requestReason();
                              if (!reason) return;
                              setIsSaving(true);
                              try {
                                const now = new Date();
                                // decide: if no clockIn -> set clockIn, else set clockOut if not set
                                if (!rec || !rec.clockIn) {
                                  const docData = {
                                    schoolId,
                                    staffID: idKey,
                                    staffName: s.teacherName || "Unknown",
                                    date: attendanceDate,
                                    clockIn: now,
                                    clockOut: rec?.clockOut || null,
                                    status: "Present",
                                    manualOverride: true,
                                    reason,
                                    registeredBy: user?.data?.adminID || user?.data?.teacherID || "System",
                                    updatedAt: serverTimestamp(),
                                  };
                                  if (rec && rec.docId) {
                                    await updateDoc(doc(schoollpq, ATT_COLLECTION, rec.docId), docData);
                                  } else {
                                    await addDoc(collection(schoollpq, ATT_COLLECTION), docData);
                                  }
                                  toast.success("Override clock-in saved.");
                                } else if (rec && !rec.clockOut) {
                                  // set clockOut
                                  const now2 = new Date();
                                  if (rec.docId) {
                                    await updateDoc(doc(schoollpq, ATT_COLLECTION, rec.docId), {
                                      clockOut: now2,
                                      manualOverride: true,
                                      reason,
                                      updatedAt: serverTimestamp(),
                                    });
                                    toast.success("Override clock-out saved.");
                                  } else {
                                    await addDoc(collection(schoollpq, ATT_COLLECTION), {
                                      schoolId,
                                      staffID: idKey,
                                      staffName: s.teacherName || "Unknown",
                                      date: attendanceDate,
                                      clockIn: rec.clockIn || null,
                                      clockOut: now2,
                                      status: "Present",
                                      manualOverride: true,
                                      reason,
                                      registeredBy: user?.data?.adminID || user?.data?.teacherID || "System",
                                      updatedAt: serverTimestamp(),
                                    });
                                    toast.success("Override clock-out created.");
                                  }
                                } else {
                                  toast.info("Already clocked in and out.");
                                }
                                // refresh
                                const q2 = query(collection(schoollpq, ATT_COLLECTION), where("schoolId", "==", schoolId), where("date", "==", attendanceDate));
                                const snap = await getDocs(q2);
                                const map = {};
                                snap.docs.forEach((d) => {
                                  const data = d.data();
                                  map[data.staffID] = {
                                    status: data.status || (data.clockIn ? "Present" : "Unmarked"),
                                    docId: d.id,
                                    clockIn: data.clockIn ? data.clockIn.toDate() : null,
                                    clockOut: data.clockOut ? data.clockOut.toDate() : null,
                                    manualOverride: !!data.manualOverride,
                                    reason: data.reason || "",
                                  };
                                });
                                setAttendanceRecords(map);
                                setUnsaved({});
                              } catch (err) {
                                console.error(err);
                                toast.error("Override failed.");
                              } finally {
                                setIsSaving(false);
                              }
                            }}
                            className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800"
                            title="Admin override (password required)"
                          >
                            Override
                          </button>
                        </div>
                        {/* small meta */}
                        <div className="text-xs text-gray-500 mt-1">
                          {rec?.clockIn ? `In: ${rec.clockIn.toLocaleTimeString()}` : ""}
                          {rec?.clockOut ? ` • Out: ${rec.clockOut.toLocaleTimeString()}` : ""}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
