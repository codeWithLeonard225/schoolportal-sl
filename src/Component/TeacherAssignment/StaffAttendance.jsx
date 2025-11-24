import React, { useState, useEffect, useMemo, useCallback } from "react"; // ✅ FIX 1: Import useCallback
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
} from "firebase/firestore";
import { useAuth } from "../Security/AuthContext";
import localforage from "localforage";

const STORE_NAME = "StaffSimpleCache";
const ATT_COLLECTION = "StaffAttendanceSimple";
const STAFF_COLLECTION = "Teachers";
const LOCK_DURATION_HOURS = 2; // ✅ FIX 1: Define Lock Duration

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
  const [attendanceRecords, setAttendanceRecords] = useState({}); // { staffID: { status, docId, time (Date object) } }

  // Cache key per school
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

      // Assuming Teachers collection is in 'db'
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

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
          // ✅ FIX 3: Retrieve and store the Firestore timestamp as a JS Date object
          map[data.staffID] = { 
            status: data.status, 
            docId: d.id,
            time: data.time?.toDate()
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

  // Sort staff list by name
  const filtered = useMemo(() => staffList.sort((a,b) => (a.teacherName||"").localeCompare(b.teacherName || "")), [staffList]);

  const handleMark = (staffID, type) => {
    setUnsaved((p) => ({ ...p, [staffID]: type }));
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
      const now = new Date(); // Use one timestamp for all new/updated records
      
      for (const [staffID, status] of Object.entries(unsaved)) {
        const staff = staffList.find(s => s.teacherID === staffID || s.id === staffID);
        const staffIDToUse = staff?.teacherID || staffID;
        
        const newRec = {
          schoolId,
          staffID: staffIDToUse,
          staffName: staff?.teacherName || "Unknown",
          date: attendanceDate,
          time: now, // Will be a Firestore Timestamp
          status,
          registeredBy,
        };

        const existing = attendanceRecords[staffIDToUse];
        if (existing && existing.docId) {
          // Update existing record
          const ref = doc(schoollpq, ATT_COLLECTION, existing.docId);
          saves.push(updateDoc(ref, { status, time: now }).catch(e => { throw e; }));
        } else {
          // Add new record
          saves.push(addDoc(collection(schoollpq, ATT_COLLECTION), newRec));
        }
      }
      await Promise.all(saves);
      toast.success("✅ Attendance saved successfully!");
      
      // Manually refresh attendance records to reflect saved data
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
        // ✅ FIX 3: Include time (timestamp) here as well
        time: d.data().time?.toDate()
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
  
  // ⭐ NEW: Logic to check if a specific staff member's record should be locked (Past date OR 2 hours passed)
  const isAttendanceLocked = useCallback((staffID) => { // ✅ FIX 1: Wrap in useCallback
    const today = getTodayDate();
    
    // 1. Check for old dates: Lock immediately if the selected date is not today
    if (attendanceDate !== today) {
        return true;
    }

    // Find the actual staff ID key to check in the attendance records
    const staff = staffList.find(s => s.teacherID === staffID || s.id === staffID);
    const staffIDToUse = staff?.teacherID || staffID;

    // 2. Check the 2-hour window (only for records that have been saved)
    const record = attendanceRecords[staffIDToUse];
    
    // If the record exists AND it has a timestamp (meaning it was saved)
    if (record && record.time instanceof Date) { // ✅ FIX 3: Check for the 'time' property being a Date object
        const recordTime = record.time.getTime(); 
        const currentTime = new Date().getTime();
        
        // Calculate the difference in milliseconds and check against 2 hours
        const timeDifferenceMs = currentTime - recordTime;
        const lockDurationMs = LOCK_DURATION_HOURS * 60 * 60 * 1000;

        return timeDifferenceMs > lockDurationMs;
    }
    
    // If the record doesn't exist yet (Unmarked), or it's within the 2-hour window, don't lock.
    return false;
  }, [attendanceDate, attendanceRecords, staffList]); // ✅ FIX 1: Correct dependencies


// --- Handler Functions ---

const handleAttendanceChange = (staffID, status) => { // Renamed from studentID to staffID for clarity
    // Prevent changes if the record is locked
    if (isAttendanceLocked(staffID)) {
         toast.warn(`Attendance for ${attendanceDate} is locked (${LOCK_DURATION_HOURS}-hour limit passed or old date).`, { autoClose: 2000 });
         return;
    }
    
    // Update the local unsaved changes state
    setUnsaved(prev => ({ // ✅ FIX 2: Changed setUnsavedChanges to setUnsaved
        ...prev,
        [staffID]: status
    }));
};


    // Helper function for UI status display (This was fine)
    const getStatusDisplay = (status) => {
        switch (status) {
            case "Present":
                return <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 border border-green-300">Present</span>;
            case "Absent":
                return <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-300">Absent</span>;
            case "Unmarked":
                return <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-300">Unmarked</span>;
            default:
                return <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-300">Error</span>;
        }
    }
    
    const isPresent = (status) => status === "Present";
    const isAbsent = (status) => status === "Absent";
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
    <div className="max-w-5xl mx-auto p-6 bg-gray-50 min-h-screen">
      
        <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-3xl font-extrabold mb-6 text-center text-indigo-700">
                Staff Daily Attendance 🗓️
            </h2>

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

            {/* --- Staff List / Loading State --- */}
            {loading ? (
                <div className="text-center p-8 text-indigo-600 bg-indigo-50 rounded-lg shadow-inner">
                    <p className="font-medium text-lg">Loading staff records...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center p-8 text-gray-600 bg-gray-100 rounded-lg shadow-inner">
                    <p className="font-medium text-lg">No staff members found in the system for this school.</p>
                </div>
            ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-md">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-4/12">Staff Name</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-3/12 hidden sm:table-cell">Staff ID</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-2/12">Status</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-3/12">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {filtered.map((s) => {
                                const idKey = s.teacherID || s.id;
                                const saved = attendanceRecords[idKey]?.status;
                                const uns = unsaved[idKey];
                                const status = uns || saved || "Unmarked";
                                
                                // Determine if this row has an unsaved change
                                const rowHasUnsaved = !!uns;
                                const isLocked = isAttendanceLocked(idKey); // Check lock status

                                return (
                                    <tr 
                                        key={s.id} 
                                        className={`hover:bg-gray-50 ${rowHasUnsaved ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''} ${isLocked ? 'bg-gray-100 opacity-60' : ''}`} // Add lock styling
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {s.teacherName} {isLocked && '🔒'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                                            {s.teacherID || "N/A"}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {getStatusDisplay(status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex justify-center space-x-2">
                                                <button 
                                                    onClick={() => handleAttendanceChange(idKey, "Present")} // Use new handler
                                                    disabled={isPresent(status) || isSaving || isLocked} // Disable when locked
                                                    className={`px-3 py-1 text-xs font-medium rounded-full transition ${isPresent(status) ? 'bg-green-500 text-white cursor-default' : 'bg-green-100 text-green-700 hover:bg-green-200'} disabled:opacity-50`}
                                                >
                                                    Present
                                                </button>
                                                <button 
                                                    onClick={() => handleAttendanceChange(idKey, "Absent")} // Use new handler
                                                    disabled={isAbsent(status) || isSaving || isLocked} // Disable when locked
                                                    className={`px-3 py-1 text-xs font-medium rounded-full transition ${isAbsent(status) ? 'bg-red-500 text-white cursor-default' : 'bg-red-100 text-red-700 hover:bg-red-200'} disabled:opacity-50`}
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