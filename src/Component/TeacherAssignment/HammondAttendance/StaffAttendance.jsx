import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { db } from "../../../../firebase"; 
import { schoollpq } from "../../Database/schoollibAndPastquestion";
import { className } from "../HammondAttendance/ClassNAmeData"; // 👈 Import className object

import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "../../Security/AuthContext";
import localforage from "localforage";

const STORE_NAME = "StaffSimpleCache";
const ATT_COLLECTION = "StaffAttendanceSimple";
const STAFF_COLLECTION = "Teachers";

const staffStore = localforage.createInstance({
  name: STORE_NAME,
  storeName: "staff_simple",
});

const getTodayDate = () => new Date().toISOString().slice(0, 10);

export default function StaffAttendanceSimple() {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "N/A";
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
  const [unsaved, setUnsaved] = useState({});
  const [attendanceRecords, setAttendanceRecords] = useState({}); 

  // ✅ New State: Active Section Filter ('All' | 'Primary' | 'Secondary')
  const [activeCategory, setActiveCategory] = useState("All");

  const CACHE_KEY = `staff_list_${schoolId}`;

  // Load staff list (cache-first) and realtime sync
  useEffect(() => {
    if (!schoolId || schoolId === "N/A") return;
    setLoading(true);

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
      const unsub = onSnapshot(
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

      return () => unsub();
    })();
  }, [schoolId, CACHE_KEY]);

  // Fetch attendance records for the date
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
            status: data.status, 
            docId: d.id,
            time: data.time?.toDate ? data.time.toDate() : null
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

  // ✅ Filter staff by section category and sort alphabetically
  const filtered = useMemo(() => {
    return staffList
      .filter((s) => {
        if (activeCategory === "All") return true;

        // Check if teacher is assigned to a class in the active category array
        if (activeCategory === "Primary") {
          return className.Primary.includes(s.assignClass);
        }
        if (activeCategory === "Secondary") {
          return className.Secondary.includes(s.assignClass);
        }

        return true;
      })
      .sort((a, b) => (a.teacherName || "").localeCompare(b.teacherName || ""));
  }, [staffList, activeCategory]);

  // Checks if record is saved or for a past date
  const isAttendanceLocked = useCallback((staffID) => {
    const today = getTodayDate();
    
    // Lock past dates
    if (attendanceDate !== today) {
      return true;
    }

    const staff = staffList.find(s => s.teacherID === staffID || s.id === staffID);
    const staffIDToUse = staff?.teacherID || staffID;
    const record = attendanceRecords[staffIDToUse];
    
    // Lock once a record exists in Firestore for this day
    if (record && record.docId) {
      return true;
    }
    
    return false;
  }, [attendanceDate, attendanceRecords, staffList]);

  const handleAttendanceChange = (staffID, status) => {
    if (isAttendanceLocked(staffID)) {
      toast.warn(`Attendance for this staff member is already saved and cannot be changed for ${attendanceDate}.`, { autoClose: 2500 });
      return;
    }
    setUnsaved(prev => ({
      ...prev,
      [staffID]: status
    }));
  };

  const handleSave = async () => {
    if (Object.keys(unsaved).length === 0) {
      toast.info("No changes to save");
      return;
    }
    
    setIsSaving(true);
    
    try {
      const registeredBy = user?.data?.adminID || user?.data?.teacherID || "System";
      const saves = [];
      const now = new Date();
      
      for (const [staffID, status] of Object.entries(unsaved)) {
        const staff = staffList.find(s => s.teacherID === staffID || s.id === staffID);
        const staffIDToUse = staff?.teacherID || staffID;
        
        const newRec = {
          schoolId,
          staffID: staffIDToUse,
          staffName: staff?.teacherName || "Unknown",
          date: attendanceDate,
          time: now,
          status,
          registeredBy,
        };

        const existing = attendanceRecords[staffIDToUse];
        if (existing && existing.docId) {
          const ref = doc(schoollpq, ATT_COLLECTION, existing.docId);
          saves.push(updateDoc(ref, { status, time: now }));
        } else {
          saves.push(addDoc(collection(schoollpq, ATT_COLLECTION), newRec));
        }
      }
      await Promise.all(saves);
      toast.success("✅ Attendance saved successfully!");
      
      // Refresh to commit locked state locally
      const q = query(
        collection(schoollpq, ATT_COLLECTION), 
        where("schoolId", "==", schoolId),
        where("date", "==", attendanceDate)
      );
      const snap = await getDocs(q);
      const map = {};
      snap.docs.forEach((d) => map[d.data().staffID] = { 
        status: d.data().status, 
        docId: d.id, 
        time: d.data().time?.toDate ? d.data().time.toDate() : null
      });
      setAttendanceRecords(map);
      setUnsaved({});
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to save attendance");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusDisplay = (status) => {
    switch (status) {
      case "Present":
        return <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-300">Present</span>;
      case "Absent":
        return <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-300">Absent</span>;
      case "Late":
        return <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-300">Late</span>;
      case "Unmarked":
        return <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-300">Unmarked</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">Error</span>;
    }
  };
    
  const isPresent = (status) => status === "Present";
  const isAbsent = (status) => status === "Absent";
  const isLate = (status) => status === "Late";
  const hasUnsavedChanges = Object.keys(unsaved).length > 0;
    
  if (schoolId === "N/A") {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-red-100 text-red-800 border border-red-300 rounded shadow">
        <p className="font-bold">Access Error:</p>
        <p>School ID not found. Please log in again or check user context.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-4 text-center text-indigo-700">
          Staff Daily Attendance 🗓️
        </h2>

        {/* --- Category Filter Buttons --- */}
        <div className="flex justify-center items-center gap-2 mb-6">
          {["All", "Primary", "Secondary"].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 text-sm font-bold rounded-lg transition-all shadow-sm ${
                activeCategory === cat
                  ? "bg-indigo-600 text-white shadow-md scale-105"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
              }`}
            >
              {cat === "All" ? "All Staff" : `${cat} Section`}
            </button>
          ))}
        </div>

        {/* --- Filter & Action Bar --- */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="w-full sm:w-auto">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Attendance Date:</label>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              max={getTodayDate()}
              className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2 bg-white"
              disabled={loading || isSaving}
            />
          </div>
          
          <div className="flex flex-col items-center sm:items-end w-full sm:w-auto">
            <p className={`text-sm font-medium ${hasUnsavedChanges ? 'text-orange-600' : 'text-gray-500'} mb-2`}>
              {hasUnsavedChanges ? `${Object.keys(unsaved).length} unsaved change(s)` : "No pending changes"}
            </p>
            <button 
              onClick={handleSave} 
              disabled={!hasUnsavedChanges || isSaving || loading}
              className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold shadow-md hover:bg-indigo-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "💾 Save Attendance"}
            </button>
          </div>
        </div>

        {/* --- Staff List --- */}
        {loading ? (
          <div className="text-center p-8 text-indigo-600 bg-indigo-50 rounded-lg shadow-inner">
            <p className="font-medium text-lg">Loading staff records...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center p-8 text-gray-600 bg-gray-100 rounded-lg shadow-inner">
            <p className="font-medium text-lg">
              No staff members found {activeCategory !== "All" ? `for ${activeCategory} Section` : "in the system"}.
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg shadow-md overflow-hidden">
            <table className="w-full table-auto divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Staff Member
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider hidden sm:table-cell">
                    Current Status
                  </th>
                  <th className="px-3 sm:px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Mark Attendance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filtered.map((s) => {
                  const idKey = s.teacherID || s.id;
                  const saved = attendanceRecords[idKey]?.status;
                  const uns = unsaved[idKey];
                  const status = uns || saved || "Unmarked";
                  
                  const rowHasUnsaved = !!uns;
                  const isLocked = isAttendanceLocked(idKey);

                  return (
                    <tr 
                      key={s.id} 
                      className={`hover:bg-gray-50 ${rowHasUnsaved ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''} ${isLocked ? 'bg-gray-100 opacity-60' : ''}`}
                    >
                      {/* Name & ID & Class Column */}
                      <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium text-gray-900">
                        <div className="flex flex-col">
                          <span>{s.teacherName} {isLocked && '🔒'}</span>
                          <span className="text-xs text-gray-500 font-normal">
                            Assigned Class: <strong className="text-indigo-600">{s.assignClass || "None"}</strong>
                          </span>
                          <span className="text-xs text-gray-400 font-normal sm:hidden">
                            ID: {s.teacherID || "N/A"}
                          </span>
                        </div>
                      </td>

                      {/* Current Status */}
                      <td className="px-3 py-3 sm:py-4 whitespace-nowrap text-center hidden sm:table-cell">
                        {getStatusDisplay(status)}
                      </td>

                      {/* Actions Column */}
                      <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-center">
                        
                        {/* SMALL SCREENS: Dropdown Select */}
                        <div className="block sm:hidden">
                          <select
                            value={status}
                            onChange={(e) => handleAttendanceChange(idKey, e.target.value)}
                            disabled={isSaving || isLocked}
                            className={`w-full text-xs font-bold rounded-lg border-gray-300 py-1.5 px-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:cursor-not-allowed ${
                              status === "Present" ? "bg-green-50 text-green-800 border-green-300" :
                              status === "Late" ? "bg-amber-50 text-amber-800 border-amber-300" :
                              status === "Absent" ? "bg-red-50 text-red-800 border-red-300" :
                              "bg-gray-50 text-gray-700"
                            }`}
                          >
                            <option value="Unmarked" disabled>-- Select --</option>
                            <option value="Present">Present</option>
                            <option value="Late">Late</option>
                            <option value="Absent">Absent</option>
                          </select>
                        </div>

                        {/* MEDIUM & LARGER SCREENS: Button Group */}
                        <div className="hidden sm:flex justify-center space-x-1.5">
                          <button 
                            onClick={() => handleAttendanceChange(idKey, "Present")} 
                            disabled={isPresent(status) || isSaving || isLocked}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition ${isPresent(status) ? 'bg-green-600 text-white cursor-default' : 'bg-green-100 text-green-700 hover:bg-green-200'} disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            Present
                          </button>
                          
                          <button 
                            onClick={() => handleAttendanceChange(idKey, "Late")} 
                            disabled={isLate(status) || isSaving || isLocked}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition ${isLate(status) ? 'bg-amber-500 text-white cursor-default' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'} disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            Late
                          </button>

                          <button 
                            onClick={() => handleAttendanceChange(idKey, "Absent")} 
                            disabled={isAbsent(status) || isSaving || isLocked}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition ${isAbsent(status) ? 'bg-red-600 text-white cursor-default' : 'bg-red-100 text-red-700 hover:bg-red-200'} disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            Absent
                          </button>
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