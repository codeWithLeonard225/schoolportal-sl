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
    onSnapshot,
    where,
    getDocs,
} from "firebase/firestore";
import { useAuth } from "../Security/AuthContext";
import localforage from "localforage";

// 💾 Initialize localforage store for caching all pupil registration data
const pupilStore = localforage.createInstance({
    name: "PupilDataCache",
    storeName: "pupil_reg",
});

// Helper to get today's date in YYYY-MM-DD format
const getTodayDate = () => new Date().toISOString().slice(0, 10);

// ⭐ NEW: Define the lock duration (2 hours)
const LOCK_DURATION_HOURS = 2;

const AttendancePage = () => {
    const { user } = useAuth();
    // Use the authenticated user's schoolId
    const currentSchoolId = user?.schoolId || "N/A";

    // --- State Management ---
    const [academicYear, setAcademicYear] = useState("");
    const [selectedClass, setSelectedClass] = useState("");
    const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
    const [academicYears, setAcademicYears] = useState([]);
    const [availableClasses, setAvailableClasses] = useState([]);
    
    // Store ALL pupils fetched (for deriving options and then filtering)
    const [allPupilsData, setAllPupilsData] = useState([]); 
    
    // Start as loading until initial data is set by cache or Firestore
    const [loading, setLoading] = useState(true); 
    
    // State to store current attendance status for the selected day/class
    // Format: { studentID: { status: 'Present' | 'Absent', docId: 'firestore_doc_id', timestamp: Date | null } }
    const [attendanceRecords, setAttendanceRecords] = useState({});
    
    // State to track unsaved changes
    const [unsavedChanges, setUnsavedChanges] = useState({}); 

    // --- Data Fetching and Caching (Consolidated Logic) ---

    // 1. Fetch ALL Pupils and Filter Options (with Cache-First Strategy)
    useEffect(() => {
        if (!currentSchoolId || currentSchoolId === "N/A") return;

        const CACHE_KEY = `all_pupils_data_${currentSchoolId}`;
        let cacheLoaded = false; 

        // Helper function to process data and set state
        const processPupils = (pupilsList) => {
            const years = [...new Set(pupilsList.map(p => p.academicYear).filter(Boolean))].sort().reverse();
            const classes = [...new Set(pupilsList.map(p => p.class).filter(Boolean))].sort();

            setAllPupilsData(pupilsList);
            setAcademicYears(years);
            setAvailableClasses(classes);
            
            if (years.length > 0 && !academicYear) setAcademicYear(years[0]);
            if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]);

            return { pupilsList, years, classes };
        };

        // A) Load from cache first
        setLoading(true);
        pupilStore.getItem(CACHE_KEY).then(cachedData => {
            if (cachedData && cachedData.pupilsList.length > 0) {
                processPupils(cachedData.pupilsList);
                cacheLoaded = true; 
                toast.info("Pupil data loaded from cache.", { autoClose: 1500 });
            }
        }).catch(err => console.error("Cache load failed:", err));


        // B) Fetch fresh data from Firestore
        const pupilsQuery = query(
            collection(db, "PupilsReg"),
            where("schoolId", "==", currentSchoolId)
        );

        const unsub = onSnapshot(pupilsQuery, async (snapshot) => {
            const liveData = snapshot.docs
                .map((doc) => ({
                    id: doc.id,
                    studentID: doc.data().studentID,
                    studentName: doc.data().studentName,
                    academicYear: doc.data().academicYear, 
                    class: doc.data().class, 
                }));

            const { pupilsList, years, classes } = processPupils(liveData);
            
            // C) Update localforage cache
            await pupilStore.setItem(CACHE_KEY, { pupilsList, years, classes, timestamp: new Date() }).catch(err => {
                console.error("Failed to save pupils to cache", err);
            });
            
            setLoading(false);
            
            if (!cacheLoaded && liveData.length > 0) { 
                 toast.success("Pupil list synced from server.", { autoClose: 1500 });
            }

        }, (error) => {
            console.error("Error fetching pupils:", error);
            if (allPupilsData.length === 0) { 
                toast.error("Failed to load pupil list from database.");
            }
            setLoading(false); 
        });

        return () => unsub();
    }, [currentSchoolId, academicYear, selectedClass]);
    
    // 2. Filter Pupils using useMemo 
    const filteredPupils = useMemo(() => {
        if (!academicYear || !selectedClass) return [];
        
        return allPupilsData
            .filter(p => 
                p.academicYear === academicYear &&
                p.class === selectedClass
            )
            .sort((a, b) => a.studentName.localeCompare(b.studentName));
    }, [allPupilsData, academicYear, selectedClass]);


    // 3. Fetch Existing Attendance for the selected date/class (Updated to fetch timestamp)
    const fetchAttendance = useCallback(async () => {
        if (!currentSchoolId || !academicYear || !selectedClass || !attendanceDate) {
            setAttendanceRecords({});
            return;
        }

        const attendanceQuery = query(
            collection(schoollpq, "PupilAttendance"),
            where("schoolId", "==", currentSchoolId),
            where("academicYear", "==", academicYear),
            where("className", "==", selectedClass),
            where("date", "==", attendanceDate)
        );

        try {
            const snapshot = await getDocs(attendanceQuery);
            const records = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                records[data.studentID] = {
                    status: data.status,
                    docId: doc.id,
                    // ⭐ IMPORTANT: Convert Firestore Timestamp to Date object for calculation
                    timestamp: data.timestamp ? data.timestamp.toDate() : null 
                };
            });
            setAttendanceRecords(records);
            setUnsavedChanges({}); 
        } catch (error) {
            console.error("Error fetching attendance:", error);
            toast.error("Failed to fetch existing attendance records.");
        }
    }, [currentSchoolId, academicYear, selectedClass, attendanceDate]);

    // Re-run fetchAttendance whenever filters change
    useEffect(() => {
        fetchAttendance();
    }, [fetchAttendance]);

    // ⭐ NEW: Logic to check if a specific student's record should be locked (Past date OR 2 hours passed)
    const isAttendanceLocked = useCallback((studentID) => {
        const today = getTodayDate();
        
        // 1. Check for old dates: Lock immediately if the selected date is not today
        if (attendanceDate !== today) {
            return true;
        }

        // 2. Check the 2-hour window (only for records that have been saved)
        const record = attendanceRecords[studentID];
        
        // If the record exists AND it has a timestamp (meaning it was saved)
        if (record && record.timestamp) {
            const recordTime = record.timestamp.getTime();
            const currentTime = new Date().getTime();
            
            // Calculate the difference in milliseconds and check against 2 hours
            const timeDifferenceMs = currentTime - recordTime;
            const lockDurationMs = LOCK_DURATION_HOURS * 60 * 60 * 1000;

            return timeDifferenceMs > lockDurationMs;
        }
        
        // If the record doesn't exist yet (Unmarked), or it's within the 2-hour window, don't lock.
        return false;
    }, [attendanceDate, attendanceRecords]);


    // --- Handler Functions ---

    const handleAttendanceChange = (studentID, status) => {
        // Prevent changes if the record is locked
        if (isAttendanceLocked(studentID)) {
             toast.warn(`Attendance for ${attendanceDate} is locked (2-hour limit passed or old date).`, { autoClose: 2000 });
             return;
        }
        
        // Update the local unsaved changes state
        setUnsavedChanges(prev => ({
            ...prev,
            [studentID]: status
        }));
    };

    const handleSaveAttendance = async () => {
        if (Object.keys(unsavedChanges).length === 0) {
            toast.info("No changes to save.");
            return;
        }

        setLoading(true);
        const batchUpdates = [];
        const registeredBy = user?.data?.adminID || user?.data?.teacherID || "System";
        
        try {
            for (const [studentID, status] of Object.entries(unsavedChanges)) {
                // Perform a final check before saving (in case time passed while editing)
                if (attendanceRecords[studentID] && isAttendanceLocked(studentID)) {
                    toast.warn(`Change for ${studentID} was skipped; lock time expired.`);
                    continue; // Skip this record in the batch
                }

                const existingRecord = attendanceRecords[studentID];
                const pupilData = allPupilsData.find(p => p.studentID === studentID); 
                const studentName = pupilData ? pupilData.studentName : 'Unknown Pupil';
                
                // ⭐ The new Date() will be stored as a Firestore Timestamp
                const currentTimestamp = new Date(); 

                const newRecord = {
                    schoolId: currentSchoolId,
                    academicYear,
                    className: selectedClass,
                    studentID,
                    studentName,
                    date: attendanceDate,
                    status, 
                    registeredBy,
                    timestamp: currentTimestamp, // ⭐ IMPORTANT: Save the timestamp!
                };

                if (existingRecord) {
                    // UPDATE existing record
                    const docRef = doc(schoollpq, "PupilAttendance", existingRecord.docId);
                    batchUpdates.push(updateDoc(docRef, { status, timestamp: currentTimestamp })); // Update status and timestamp
                } else {
                    // ADD new record
                    batchUpdates.push(addDoc(collection(schoollpq, "PupilAttendance"), newRecord));
                }
            }

            // Only proceed if there are updates left after the lock checks
            if (batchUpdates.length > 0) {
                await Promise.all(batchUpdates);
            }
            
            // Re-fetch to synchronize UI with database and clear unsaved changes
            await fetchAttendance(); 

            toast.success(`✅ Attendance for ${batchUpdates.length} pupils saved successfully!`);
            
        } catch (error) {
            console.error("Error saving attendance:", error);
            toast.error("❌ Failed to save attendance changes.");
        } finally {
            setLoading(false);
        }
    };

    // --- Helper for UI state ---
    const getStatus = (studentID) => {
        // Prioritize unsaved changes
        if (unsavedChanges[studentID]) {
            return unsavedChanges[studentID];
        }
        // Fallback to existing saved record
        return attendanceRecords[studentID]?.status || "Unmarked";
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "Present": return "bg-green-100 border-green-500 text-green-700";
            case "Absent": return "bg-red-100 border-red-500 text-red-700";
            case "Unmarked": return "bg-gray-100 border-gray-400 text-gray-700";
            default: return "bg-gray-100 border-gray-400 text-gray-700";
        }
    };


    // --- RENDER BLOCK ---
    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-xl">
            <h2 className="text-3xl font-bold mb-6 text-center text-indigo-700">
                Pupil Daily Attendance 📅
            </h2>
            <hr className="mb-6" />

            {/* --- Filter Section --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 p-4 border rounded-lg bg-indigo-50">
                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Academic Year:</label>
                    <select
                        value={academicYear}
                        onChange={(e) => {
                            setAcademicYear(e.target.value);
                            setUnsavedChanges({});
                        }}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                        disabled={loading}
                    >
                        <option value="">Select Year</option>
                        {academicYears.map((year, i) => <option key={i} value={year}>{year}</option>)}
                    </select>
                </div>

                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Class:</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => {
                            setSelectedClass(e.target.value);
                            setUnsavedChanges({});
                        }}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                        disabled={loading}
                    >
                        <option value="">Select Class</option>
                        {availableClasses.map((c, i) => <option key={i} value={c}>{c}</option>)}
                    </select>
                </div>

                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Attendance Date:</label>
                    <input
                        type="date"
                        value={attendanceDate}
                        onChange={(e) => {
                            setAttendanceDate(e.target.value);
                            setUnsavedChanges({});
                        }}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                        max={getTodayDate()} 
                        disabled={loading}
                    />
                </div>
            </div>

            {/* --- Attendance Action Bar --- */}
            <div className="flex justify-between items-center mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-gray-700">
                    {Object.keys(unsavedChanges).length} unsaved changes.
                </p>
                <button
                    onClick={handleSaveAttendance}
                    disabled={loading || Object.keys(unsavedChanges).length === 0 || !academicYear || !selectedClass} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold shadow transition disabled:bg-gray-400"
                >
                    {loading ? "Saving..." : "💾 Save Attendance"}
                </button>
            </div>


            {/* --- Pupil Table --- */}
            {(loading && filteredPupils.length === 0) ? (
                <div className="text-center text-indigo-600 p-6 bg-indigo-50 border rounded-lg">
                    Loading pupil records and options...
                </div>
            ) : academicYear && selectedClass ? (
                <div className="overflow-x-auto border rounded-lg shadow-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider w-4/12">Student Name</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider w-3/12">Current Status</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider w-4/12">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredPupils.map((pupil) => {
                                const status = getStatus(pupil.studentID);
                                // ⭐ NEW: Check if the attendance buttons should be locked
                                const isLocked = isAttendanceLocked(pupil.studentID); 

                                return (
                                    <tr key={pupil.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{pupil.studentName}</td>
                                        
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(status)}`}>
                                                {status}
                                                {isLocked && <span className="ml-1 text-xs">🔒</span>}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                                            <div className="flex space-x-2 justify-center">
                                                <button
                                                    onClick={() => handleAttendanceChange(pupil.studentID, "Present")}
                                                    // ⭐ Disabled if loading, status is already 'Present', OR the record is locked
                                                    disabled={loading || status === "Present" || isLocked}
                                                    className="px-3 py-1 text-sm rounded-lg border border-green-600 text-green-600 hover:bg-green-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    Present
                                                </button>
                                                <button
                                                    onClick={() => handleAttendanceChange(pupil.studentID, "Absent")}
                                                    // ⭐ Disabled if loading, status is already 'Absent', OR the record is locked
                                                    disabled={loading || status === "Absent" || isLocked}
                                                    className="px-3 py-1 text-sm rounded-lg border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
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
            ) : (
                <div className="text-center text-yellow-700 p-6 bg-yellow-50 border rounded">
                    Please select an **Academic Year** and a **Class** to mark attendance.
                </div>
            )}
            {!loading && academicYear && selectedClass && filteredPupils.length === 0 && (
                 <div className="text-center text-gray-700 p-6 mt-4 bg-gray-100 border rounded">
                    No pupils found in the system for the selected class and academic year.
                </div>
            )}
        </div>
    );
};

export default AttendancePage;