import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { useLocation } from "react-router-dom";

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

    return (
        <div className="p-6 min-h-screen bg-gray-100 flex flex-col items-center">
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-4xl">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h1 className="text-2xl font-bold">Daily Attendance Records 📊</h1>
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

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teacher ID</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-green-600 uppercase">Clock-In Time</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-red-600 uppercase">Clock-Out Time</th>
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
                                </tr>
                            ))}
                            {attendanceList.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500">
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