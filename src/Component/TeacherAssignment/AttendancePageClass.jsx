// AttendancePageClass.jsx (Pupil Attendance) - Complete, corrected file
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { pupilLoginFetch } from "../Database/PupilLogin";
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

// ⭐ Define the lock duration (2 hours in milliseconds)
const LOCK_DURATION_MS = 2 * 60 * 60 * 1000;

const AttendancePageClass = () => {
    const { user } = useAuth();
    
    // --- AUTHENTICATION & ACCESS CONTROL ---
    const currentSchoolId = user?.schoolId || "N/A";
    const userClass = user?.data?.className || null; // The class the user is linked to
    
    // Determine if the user is restricted to a single class (e.g., a Teacher)
    const isClassRestricted = !!userClass;

    // --- State Management ---
    const [academicYear, setAcademicYear] = useState("");
    const [selectedClass, setSelectedClass] = useState(userClass || ""); 
    const [attendanceDate, setAttendanceDate] = useState(getTodayDate());
    const [academicYears, setAcademicYears] = useState([]);
    
    const [availableClasses, setAvailableClasses] = useState(isClassRestricted ? [userClass] : []); 
    
    const [allPupilsData, setAllPupilsData] = useState([]); 
    const [loading, setLoading] = useState(true); 
    const [isSaving, setIsSaving] = useState(false); // New state for saving status
    const [attendanceRecords, setAttendanceRecords] = useState({});
    const [unsavedChanges, setUnsavedChanges] = useState({}); 

    const isCurrentDate = useMemo(() => attendanceDate === getTodayDate(), [attendanceDate]);

    // --- Data Fetching and Caching (Pupils) ---
    useEffect(() => {
        if (!currentSchoolId || currentSchoolId === "N/A") return;

        const CACHE_KEY = `all_pupils_data_${currentSchoolId}_${userClass || 'all'}`;
        let cacheLoaded = false; 

        const processPupils = (pupilsList) => {
            const relevantPupils = isClassRestricted 
                ? pupilsList.filter(p => p.class === userClass)
                : pupilsList;

            const years = [...new Set(relevantPupils.map(p => p.academicYear).filter(Boolean))].sort().reverse();
            const classes = isClassRestricted 
                ? [userClass] 
                : [...new Set(relevantPupils.map(p => p.class).filter(Boolean))].sort();

            setAllPupilsData(pupilsList);
            setAcademicYears(years);
            setAvailableClasses(classes);
            
            if (years.length > 0 && !academicYear) setAcademicYear(years[0]);
            
            if (!isClassRestricted && classes.length > 0 && !selectedClass) setSelectedClass(classes[0]);

            return { pupilsList, years, classes };
        };

        setLoading(true);
        pupilStore.getItem(CACHE_KEY).then(cachedData => {
            if (cachedData && cachedData.pupilsList.length > 0) {
                processPupils(cachedData.pupilsList);
                cacheLoaded = true; 
                toast.info("Pupil data loaded from cache.", { autoClose: 1500 });
            }
        }).catch(err => console.error("Cache load failed:", err));

        const collectionRef = collection(pupilLoginFetch, "PupilsReg");
        
        let pupilsQuery = query(
            collectionRef,
            where("schoolId", "==", currentSchoolId)
        );
        
        if (isClassRestricted) {
            pupilsQuery = query(pupilsQuery, where("class", "==", userClass));
        }

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
            
            await pupilStore.setItem(CACHE_KEY, { pupilsList: liveData, years, classes, timestamp: new Date() }).catch(err => {
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
    }, [currentSchoolId, userClass, isClassRestricted, academicYear, selectedClass]);
    
    // Filter Pupils 
    const filteredPupils = useMemo(() => {
        if (!academicYear || !selectedClass) return [];
        
        return allPupilsData
            .filter(p => 
                p.academicYear === academicYear &&
                p.class === selectedClass
            )
            .sort((a, b) => a.studentName.localeCompare(b.studentName));
    }, [allPupilsData, academicYear, selectedClass]);

    // --- Attendance Logic ---
    
    // 3. Fetch Existing Attendance (Memoized)
    const fetchAttendance = useCallback(async () => {
        if (!currentSchoolId || !academicYear || !selectedClass || !attendanceDate) {
            setAttendanceRecords({});
            return;
        }

        const attendanceQuery = query(
            collection(pupilLoginFetch, "PupilAttendance"),
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

    useEffect(() => {
        fetchAttendance();
    }, [fetchAttendance]);

    // 💡 FIX: Centralized Locking Logic
    const isAttendanceLocked = useCallback((studentID) => {
        if (!isCurrentDate) {
            // Rule 1: Always lock if the date is not today
            return true;
        }

        const record = attendanceRecords[studentID];
        
        if (record && record.timestamp) {
            // Rule 2: Check 2-hour lock for TODAY's records
            const recordTime = record.timestamp.getTime();
            const currentTime = new Date().getTime();
            
            const timeDifferenceMs = currentTime - recordTime;

            return timeDifferenceMs > LOCK_DURATION_MS;
        }
        
        // No existing record for today, or it's today and the user is marking it for the first time
        return false; 
    }, [isCurrentDate, attendanceRecords]);


    const handleAttendanceChange = (studentID, status) => {
        if (isAttendanceLocked(studentID)) {
            // Provide specific toast messages
            if (!isCurrentDate) {
                toast.warn(`Attendance for ${attendanceDate} is locked. You can only mark today's attendance.`, { autoClose: 3000 });
            } else {
                toast.warn(`Attendance for this pupil is locked. 2-hour editing limit expired.`, { autoClose: 3000 });
            }
            return;
        }
        
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

        setIsSaving(true); // Use new isSaving state
        const batchUpdates = [];
        const registeredBy = user?.data?.adminID || user?.data?.teacherID || "System";
        
        try {
            for (const [studentID, status] of Object.entries(unsavedChanges)) {
                // IMPORTANT: Check lock one last time before saving
                if (isAttendanceLocked(studentID)) {
                    toast.warn(`Change for ${studentID} was skipped; lock time expired or date is old.`);
                    continue; 
                }

                const existingRecord = attendanceRecords[studentID];
                const pupilData = allPupilsData.find(p => p.studentID === studentID); 
                const studentName = pupilData ? pupilData.studentName : 'Unknown Pupil';
                
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
                    timestamp: currentTimestamp, 
                };

                if (existingRecord) {
                    const docRef = doc(pupilLoginFetch, "PupilAttendance", existingRecord.docId);
                    batchUpdates.push(updateDoc(docRef, { status, timestamp: currentTimestamp })); 
                } else {
                    batchUpdates.push(addDoc(collection(pupilLoginFetch, "PupilAttendance"), newRecord));
                }
            }

            if (batchUpdates.length > 0) {
                await Promise.all(batchUpdates);
                toast.success(`✅ Attendance for ${batchUpdates.length} pupils saved successfully!`);
            } else {
                toast.info("No valid changes to save.");
            }
            
            // Re-fetch to clear unsaved changes and update records
            await fetchAttendance(); 
            
        } catch (error) {
            console.error("Error saving attendance:", error);
            toast.error("❌ Failed to save attendance changes.");
        } finally {
            setIsSaving(false);
        }
    };
    
    // --- UI Helpers ---
    const getStatus = (studentID) => {
        if (unsavedChanges[studentID]) {
            return unsavedChanges[studentID];
        }
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

    const getLockDisplay = (isLocked) => {
        return isLocked 
            ? <span className="text-red-500 ml-2 text-sm">🔒 Locked</span>
            : null;
    }
    
    if (currentSchoolId === "N/A") {
        return (
            <div className="max-w-4xl mx-auto p-6 bg-red-100 text-red-800 border border-red-300 rounded shadow">
                <p className="font-bold">Access Error:</p>
                <p>School ID not found. Please log in again or check user context.</p>
            </div>
        );
    }
    
    const hasUnsavedChanges = Object.keys(unsavedChanges).length > 0;
    const isSaveDisabled = !hasUnsavedChanges || isSaving || loading;
    const isDatePickerLocked = !isCurrentDate;


    return (
        <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
            <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-3xl font-extrabold mb-6 text-center text-teal-700">
                    Pupil Daily Attendance 🏫
                </h2>

                {/* --- Filter & Action Bar --- */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                    {/* Date Picker */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Attendance Date:</label>
                        <input
                            type="date"
                            value={attendanceDate}
                            onChange={(e) => setAttendanceDate(e.target.value)}
                            max={getTodayDate()}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2 bg-white"
                            disabled={isDatePickerLocked || loading || isSaving}
                        />
                        {isDatePickerLocked && <p className="text-xs text-red-500 mt-1">Date is locked. Only today's attendance can be marked/edited.</p>}
                    </div>
                    
                    {/* Academic Year Selector */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Academic Year:</label>
                        <select
                            value={academicYear}
                            onChange={(e) => setAcademicYear(e.target.value)}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2 bg-white"
                            disabled={loading || isSaving}
                        >
                            <option value="">Select Year</option>
                            {academicYears.map(year => <option key={year} value={year}>{year}</option>)}
                        </select>
                    </div>

                    {/* Class Selector */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Select Class:</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 p-2 bg-white"
                            disabled={isClassRestricted || loading || isSaving}
                        >
                            <option value="">Select Class</option>
                            {availableClasses.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                        </select>
                        {isClassRestricted && <p className="text-xs text-gray-500 mt-1">Restricted to your class.</p>}
                    </div>

                    {/* Save Button */}
                    <div className="flex flex-col items-start justify-end">
                        <p className={`text-sm font-medium ${hasUnsavedChanges ? 'text-orange-600' : 'text-gray-500'} mb-2`}>
                            {hasUnsavedChanges ? `${Object.keys(unsavedChanges).length} unsaved change(s)` : "No pending changes"}
                        </p>
                        <button 
                            onClick={handleSaveAttendance} 
                            disabled={isSaveDisabled}
                            className="w-full bg-teal-600 text-white px-6 py-2 rounded-lg font-semibold shadow-md hover:bg-teal-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {isSaving ? "Saving..." : "💾 Save Attendance"}
                        </button>
                    </div>
                </div>

                {/* --- Pupil List / Loading State --- */}
                {loading && !isSaving ? (
                    <div className="text-center p-8 text-teal-600 bg-teal-50 rounded-lg shadow-inner">
                        <p className="font-medium text-lg">Loading pupil records...</p>
                    </div>
                ) : !academicYear || !selectedClass ? (
                     <div className="text-center p-8 text-gray-600 bg-gray-100 rounded-lg shadow-inner">
                        <p className="font-medium text-lg">Please select an Academic Year and Class to view pupils.</p>
                    </div>
                ) : filteredPupils.length === 0 ? (
                    <div className="text-center p-8 text-gray-600 bg-gray-100 rounded-lg shadow-inner">
                        <p className="font-medium text-lg">No pupils found for the selected year and class.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-md">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-4/12">Pupil Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-3/12 hidden sm:table-cell">ID</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-2/12">Status</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-3/12">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {filteredPupils.map((p) => {
                                    const status = getStatus(p.studentID);
                                    const isLocked = isAttendanceLocked(p.studentID); // Use locking logic
                                    const rowHasUnsaved = !!unsavedChanges[p.studentID];
                                    
                                    return (
                                        <tr 
                                            key={p.id} 
                                            className={`hover:bg-gray-50 ${rowHasUnsaved ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {p.studentName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                                                {p.studentID || "N/A"}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(status)}`}>
                                                    {status}
                                                </span>
                                                {getLockDisplay(isLocked && status !== "Unmarked" )} 
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <div className="flex justify-center space-x-2">
                                                    <button 
                                                        onClick={() => handleAttendanceChange(p.studentID, "Present")} 
                                                        disabled={status === "Present" || isSaving || isLocked}
                                                        className={`px-3 py-1 text-xs font-medium rounded-full transition ${status === "Present" ? 'bg-green-500 text-white cursor-default' : 'bg-green-100 text-green-700 hover:bg-green-200'} disabled:opacity-50`}
                                                    >
                                                        Present
                                                    </button>
                                                    <button 
                                                        onClick={() => handleAttendanceChange(p.studentID, "Absent")} 
                                                        disabled={status === "Absent" || isSaving || isLocked}
                                                        className={`px-3 py-1 text-xs font-medium rounded-full transition ${status === "Absent" ? 'bg-red-500 text-white cursor-default' : 'bg-red-100 text-red-700 hover:bg-red-200'} disabled:opacity-50`}
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

export default AttendancePageClass;