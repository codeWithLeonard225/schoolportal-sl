import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { useLocation } from "react-router-dom";

const AttendanceLogs = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [logs, setLogs] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (schoolId === "N/A") return;

        const q = query(
            collection(db, "StaffAttendance"),
            where("schoolId", "==", schoolId),
            where("date", "==", selectedDate)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setLogs(data);
        });

        return () => unsubscribe();
    }, [schoolId, selectedDate]);

    const filteredLogs = useMemo(() => {
        if (!searchTerm.trim()) return logs;
        const lower = searchTerm.toLowerCase();
        return logs.filter(
            (log) =>
                log.teacherName?.toLowerCase().includes(lower) ||
                log.teacherID?.toLowerCase().includes(lower)
        );
    }, [logs, searchTerm]);

    return (
        <div className="p-6 bg-gray-100 min-h-screen">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                    <h1 className="text-2xl font-bold text-gray-800">Daily Staff Attendance Logs 📋</h1>
                    <div className="flex space-x-4 items-center">
                        <label className="text-sm font-semibold text-gray-600">Select Date:</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="p-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="bg-white p-4 rounded-xl shadow-sm">
                    <input
                        type="text"
                        placeholder="Search logs by staff name or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                    />
                </div>

                {/* Log Table */}
                <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                    Teacher ID
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                    Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                    Clock In
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                    Clock Out
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white text-sm">
                            {filteredLogs.map((log) => (
                                <tr key={log.id}>
                                    <td className="px-6 py-4 font-mono font-medium text-gray-900">
                                        {log.teacherID}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-800">
                                        {log.teacherName}
                                    </td>
                                    <td className="px-6 py-4 text-green-600 font-semibold">
                                        {log.clockIn || "--"}
                                    </td>
                                    <td className="px-6 py-4 text-blue-600 font-semibold">
                                        {log.clockOut || "Active"}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-3 py-1 text-xs rounded-full font-semibold bg-green-100 text-green-700">
                                            {log.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="text-center py-6 text-gray-400">
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

export default AttendanceLogs;