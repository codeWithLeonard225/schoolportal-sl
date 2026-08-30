import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../Security/AuthContext";

const PupilAttendanceLogs = () => {
    const { user } = useAuth();
    const currentSchoolId = user?.schoolId || "";
    const [logs, setLogs] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
    const [filterClass, setFilterClass] = useState("All");

    useEffect(() => {
        if (!currentSchoolId) return;

        const collectionRef = collection(db, "AttendanceLogs");
        const q = query(
            collectionRef,
            where("schoolId", "==", currentSchoolId),
            where("date", "==", selectedDate)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedLogs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setLogs(fetchedLogs);
        });

        return () => unsubscribe();
    }, [currentSchoolId, selectedDate]);

    const filteredLogs = filterClass === "All"
        ? logs
        : logs.filter(log => log.class === filterClass);

    return (
        <div style={{ padding: "20px" }}>
            <h2>Daily Attendance Logs</h2>

            {/* Controls */}
            <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
                <div>
                    <label>Select Date: </label>
                    <input 
                        type="date" 
                        value={selectedDate} 
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                    />
                </div>
            </div>

            {/* Logs Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", textAliign: "left" }}>
                <thead>
                    <tr style={{ background: "#f2f2f2", borderBottom: "2px solid #ddd" }}>
                        <th style={{ padding: "10px" }}>Student ID</th>
                        <th style={{ padding: "10px" }}>Name</th>
                        <th style={{ padding: "10px" }}>Class</th>
                        <th style={{ padding: "10px" }}>Action</th>
                        <th style={{ padding: "10px" }}>Time</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredLogs.length === 0 ? (
                        <tr>
                            <td colSpan="5" style={{ padding: "15px", textAlign: "center" }}>No logs found for selected date.</td>
                        </tr>
                    ) : (
                        filteredLogs.map(log => (
                            <tr key={log.id} style={{ borderBottom: "1px solid #ddd" }}>
                                <td style={{ padding: "10px" }}>{log.studentID}</td>
                                <td style={{ padding: "10px" }}>{log.studentName}</td>
                                <td style={{ padding: "10px" }}>{log.class}</td>
                                <td style={{ padding: "10px", fontWeight: "bold", color: log.type === "CLOCK_IN" ? "green" : "red" }}>
                                    {log.type}
                                </td>
                                <td style={{ padding: "10px" }}>
                                    {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString() : "Just now"}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default PupilAttendanceLogs;