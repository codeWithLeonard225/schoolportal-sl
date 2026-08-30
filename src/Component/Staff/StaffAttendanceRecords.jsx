import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import { collection, query, where, onSnapshot, doc, deleteDoc, writeBatch } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";

const StaffAttendanceRecords = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [attendanceList, setAttendanceList] = useState([]);
    const [selectedDate, setSelectedDate] = useState(() => {
        const today = new Date();
        return today.toLocaleDateString("en-CA");
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!schoolId || schoolId === "N/A") {
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = query(
            collection(db, "StaffAttendance"),
            where("schoolId", "==", schoolId),
            where("date", "==", selectedDate)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const records = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setAttendanceList(records);
                setLoading(false);
            },
            (err) => {
                console.error("Error loading attendance logs:", err);
                toast.error("Failed to fetch attendance logs.");
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [schoolId, selectedDate]);

    const handleDeleteRecord = async (id, teacherName) => {
        if (!window.confirm(`Delete attendance record for ${teacherName || "this staff member"}?`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, "StaffAttendance", id));
            toast.success(`Deleted record for ${teacherName || "staff member"}`);
        } catch (err) {
            console.error("Delete failed:", err);
            toast.error("Failed to delete record.");
        }
    };

    const handleClearAllForDate = async () => {
        if (attendanceList.length === 0) return;

        if (
            window.confirm(
                `Are you sure you want to delete ALL ${attendanceList.length} logs for ${selectedDate}?`
            )
        ) {
            try {
                const batch = writeBatch(db);
                attendanceList.forEach((record) => {
                    batch.delete(doc(db, "StaffAttendance", record.id));
                });

                await batch.commit();
                toast.success(`Cleared all ${attendanceList.length} attendance logs for ${selectedDate}`);
            } catch (err) {
                console.error("Bulk delete failed:", err);
                toast.error("Failed to clear attendance logs.");
            }
        }
    };

    // Helper to determine status dynamically with Leave and Excused support
    const getAttendanceStatus = (record) => {
        if (record.status) {
            const normalized = record.status.trim().toLowerCase();
            if (normalized === "leave" || normalized === "on leave") return "Leave";
            if (normalized === "excused" || normalized === "excuse") return "Excused";
            if (normalized === "present") return "Present";
            if (normalized === "absent") return "Absent";
            if (normalized === "clocked out") return "Clocked Out";
            return record.status; // Return exact custom string if unhandled
        }

        if (record.clockInTime && record.clockOutTime) return "Clocked Out";
        if (record.clockInTime && !record.clockOutTime) return "Present";
        return "Absent";
    };

    return (
        <div className="p-6 min-h-screen bg-gray-100 flex flex-col items-center">
            <div className="bg-white shadow-md rounded-2xl p-6 w-full max-w-5xl">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b pb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            Daily Attendance Records 📊
                        </h1>
                        <p className="text-xs text-gray-500 font-medium mt-1">
                            School ID: <span className="text-gray-700 font-semibold">{schoolId}</span>
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {attendanceList.length > 0 && (
                            <button
                                onClick={handleClearAllForDate}
                                className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
                            >
                                🗑️ Clear All ({attendanceList.length})
                            </button>
                        )}

                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                                Filter Date:
                            </label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="p-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Teacher ID
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Staff Details
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Date
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">
                                    Clock-In Time
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase tracking-wider">
                                    Clock-Out Time
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-6 py-12 text-center text-sm text-gray-500">
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                            Loading logs...
                                        </div>
                                    </td>
                                </tr>
                            ) : attendanceList.length > 0 ? (
                                attendanceList.map((record) => {
                                    const status = getAttendanceStatus(record);
                                    const isManual = record.isManual || record.entryType === "manual";
                                    const noteText = record.note || record.excuseNote || record.reason;

                                    return (
                                        <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                {record.teacherID || "---"}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="font-medium text-gray-800">
                                                    {record.teacherName || "Unnamed Staff"}
                                                </div>
                                                
                                                {/* Manual Entry Indicator */}
                                                {isManual && (
                                                    <span className="inline-block mt-0.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 font-medium">
                                                        ✏️ Manual Entry
                                                    </span>
                                                )}

                                                {/* Optional Note Display */}
                                                {noteText && (
                                                    <div className="mt-1 text-xs text-amber-700 bg-amber-50 p-1.5 rounded-md border border-amber-200 italic max-w-xs">
                                                        <span className="font-semibold not-italic">Note:</span> {noteText}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500">
                                                {record.date}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-green-600">
                                                {record.clockInTime ? (
                                                    <span className="bg-green-50 text-green-700 px-2 py-1 rounded-md text-xs border border-green-200">
                                                        {record.clockInTime}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">---</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm font-semibold text-red-600">
                                                {record.clockOutTime ? (
                                                    <span className="bg-red-50 text-red-700 px-2 py-1 rounded-md text-xs border border-red-200">
                                                        {record.clockOutTime}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">
                                                        Not Clocked Out
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-center">
                                                {status === "Present" && (
                                                    <span className="bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-full text-xs">
                                                        ● Present
                                                    </span>
                                                )}
                                                {status === "Clocked Out" && (
                                                    <span className="bg-blue-100 text-blue-800 font-semibold px-2.5 py-1 rounded-full text-xs">
                                                        ✓ Clocked Out
                                                    </span>
                                                )}
                                                {status === "Absent" && (
                                                    <span className="bg-rose-100 text-rose-800 font-semibold px-2.5 py-1 rounded-full text-xs">
                                                        ✕ Absent
                                                    </span>
                                                )}
                                                {status === "Leave" && (
                                                    <span className="bg-purple-100 text-purple-800 font-semibold px-2.5 py-1 rounded-full text-xs">
                                                        ✈️ On Leave
                                                    </span>
                                                )}
                                                {status === "Excused" && (
                                                    <span className="bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full text-xs">
                                                        📝 Excused
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-center">
                                                <button
                                                    onClick={() => handleDeleteRecord(record.id, record.teacherName)}
                                                    className="text-red-600 hover:text-red-900 font-medium text-xs bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded transition"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="7" className="px-6 py-10 text-center text-sm text-gray-500">
                                        No attendance records found for <span className="font-semibold text-gray-700">{selectedDate}</span>.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StaffAttendanceRecords;