import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import { collection, query, where, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";

const StaffAttendanceRecords = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [attendanceList, setAttendanceList] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (schoolId === "N/A") {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "StaffAttendance"),
            where("schoolId", "==", schoolId),
            where("date", "==", selectedDate)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAttendanceList(records);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [schoolId, selectedDate]);

    // 🗑️ Delete single record
    const handleDeleteRecord = async (id, teacherName) => {
        if (window.confirm(`Delete attendance record for ${teacherName}?`)) {
            try {
                await deleteDoc(doc(db, "StaffAttendance", id));
                toast.success(`Deleted record for ${teacherName}`);
            } catch (err) {
                console.error("Delete failed:", err);
                toast.error("Failed to delete record.");
            }
        }
    };

    // 🧹 Delete all records for the selected date (Testing Utility)
    const handleClearAllForDate = async () => {
        if (attendanceList.length === 0) return;

        if (window.confirm(`Are you sure you want to delete ALL ${attendanceList.length} logs for ${selectedDate}?`)) {
            try {
                const deletePromises = attendanceList.map((record) =>
                    deleteDoc(doc(db, "StaffAttendance", record.id))
                );
                await Promise.all(deletePromises);
                toast.success(`Cleared all attendance logs for ${selectedDate}`);
            } catch (err) {
                console.error("Bulk delete failed:", err);
                toast.error("Failed to clear attendance logs.");
            }
        }
    };

    return (
        <div className="p-6 min-h-screen bg-gray-100 flex flex-col items-center">
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-4xl">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Daily Attendance Records 📊</h1>
                        <p className="text-xs text-gray-500">School ID: {schoolId}</p>
                    </div>

                    <div className="flex items-center space-x-3">
                        {/* Clear All for Date (Testing feature) */}
                        {attendanceList.length > 0 && (
                            <button
                                onClick={handleClearAllForDate}
                                className="bg-red-100 text-red-600 hover:bg-red-200 text-xs font-semibold px-3 py-2 rounded-lg transition"
                            >
                                Clear All ({attendanceList.length}) 🗑️
                            </button>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Filter by Date</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="p-2 border rounded-lg text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher ID</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-green-600 uppercase">Clock-In Time</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-red-600 uppercase">Clock-Out Time</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {attendanceList.map((record) => (
                                <tr key={record.id}>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{record.teacherID}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{record.teacherName}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{record.date}</td>
                                    <td className="px-4 py-3 text-sm font-semibold text-green-600">{record.clockInTime || "---"}</td>
                                    <td className="px-4 py-3 text-sm font-semibold text-red-600">{record.clockOutTime || "Not Yet"}</td>
                                    <td className="px-4 py-3 text-sm text-center">
                                        <button
                                            onClick={() => handleDeleteRecord(record.id, record.teacherName)}
                                            className="text-red-600 hover:text-red-900 font-medium text-xs bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {attendanceList.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-sm text-gray-500">
                                        No attendance logs found for {selectedDate}.
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