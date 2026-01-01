import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import { useAuth } from "../Security/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import localforage from "localforage";

// ---------- LOCALFORAGE CACHE ----------
const timetableCache = localforage.createInstance({
  name: "TimeTableTeacherCache",
  storeName: "TimetableWeekly",
});

const WeeklyTimetableReport = () => {
    const { user } = useAuth();
    const schoolId = user?.schoolId || "N/A";

    const [timetable, setTimetable] = useState([]);
    const [availableClasses, setAvailableClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState(""); // Class filter

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const periods = ["1", "2", "3", "4", "Lunch", "5", "6", "7", "8"];

    useEffect(() => {
        if (schoolId === "N/A") return;

        // Fetch Classes
        const unsubC = onSnapshot(
            query(collection(db, "ClassesAndSubjects"), where("schoolId", "==", schoolId)),
            (snapshot) => setAvailableClasses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        // Load cached timetable first
        timetableCache.getItem(schoolId)
            .then((cached) => {
                if (cached) setTimetable(cached);
            })
            .catch(console.error);

        // Fetch Timetable from Firestore
        const unsubT = onSnapshot(
            query(collection(schoollpq, "Timetables"), where("schoolId", "==", schoolId)),
            (snapshot) => {
                const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                setTimetable(data);

                // Save to cache
                timetableCache.setItem(schoolId, data).catch(console.error);
            }
        );

        return () => { unsubC(); unsubT(); };
    }, [schoolId]);

    const renderTimetableForClass = (className) => {
        const classTimetable = timetable
            .filter(t => t.className === className)
            .sort((a, b) => periods.indexOf(a.period) - periods.indexOf(b.period));

        return (
            <div key={`class-${className}`} className="mb-8 p-4 border rounded-lg shadow-sm bg-white">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold">{className} - Weekly Timetable</h2>
                    <button
                        className="bg-teal-600 text-white text-xs font-bold px-3 py-1 rounded hover:bg-teal-700"
                        onClick={() => handleDownloadPDF(className, classTimetable)}
                    >
                        📄 Download PDF
                    </button>
                    <button
                        className="bg-teal-600 text-white text-xs font-bold px-3 py-1 rounded hover:bg-teal-700"
                        onClick={() => handleDownloadLandscapePDF(className, classTimetable)}
                    >
                        📄 Download PDF landscape
                    </button>
                </div>

                {days.map((day, dayIdx) => {
                    const dayPeriods = classTimetable.filter(t => t.day === day);

                    return (
                        <div key={`day-${className}-${dayIdx}`} className="mb-4">
                            <h3 className="font-semibold text-teal-600">{day}</h3>
                            <table className="w-full text-sm border mt-2">
                                <thead>
                                    <tr className="bg-gray-200">
                                        <th className="border px-2 py-1">Period</th>
                                        <th className="border px-2 py-1">Subject</th>
                                        <th className="border px-2 py-1">Teacher</th>
                                        <th className="border px-2 py-1">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dayPeriods.map((p, idx) => (
                                        <tr key={`${p.id}-${p.day}-${p.period}-${idx}`}>
                                            <td className="border px-2 py-1 text-center">
                                                {p.period === "Lunch" ? "LUNCH" : `P${p.period}`}
                                            </td>
                                            <td className="border px-2 py-1 text-center">{p.subject || "-"}</td>
                                            <td className="border px-2 py-1 text-center">{p.teacher}</td>
                                            <td className="border px-2 py-1 text-center">{p.time}</td>
                                        </tr>
                                    ))}
                                    {dayPeriods.length === 0 && (
                                        <tr key={`empty-${dayIdx}`}>
                                            <td colSpan="4" className="text-center py-2 text-gray-400 italic">
                                                No periods scheduled
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    );
                })}
            </div>
        );
    };

    // ... handleDownloadPDF and handleDownloadLandscapePDF remain unchanged

    const classesToDisplay = selectedClass
        ? availableClasses.filter(c => c.className === selectedClass)
        : availableClasses;

    return (
        <div className="p-4 min-h-screen bg-gray-50">
            <h1 className="text-2xl font-bold mb-6">Weekly Timetable Report</h1>

            {/* Class Filter */}
            <div className="mb-6">
                <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="border p-2 rounded-lg bg-white text-sm font-bold"
                >
                    <option value="">📚 All Classes</option>
                    {availableClasses.map((c, idx) => (
                        <option key={`${c.id}-${idx}`} value={c.className}>{c.className}</option>
                    ))}
                </select>
            </div>

            {classesToDisplay.length > 0 ? (
                classesToDisplay.map(c => renderTimetableForClass(c.className))
            ) : (
                <p className="text-gray-400 italic">No classes found</p>
            )}
        </div>
    );
};

export default WeeklyTimetableReport;
