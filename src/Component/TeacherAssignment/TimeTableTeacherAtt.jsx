import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
    collection, onSnapshot, query, where, addDoc, serverTimestamp, getDocs
} from "firebase/firestore";
import { schoollpq } from "../Database/schoollibAndPastquestion"; 
import { useAuth } from "../Security/AuthContext";

const TimeTableTeacherAtt = () => {
    const { user } = useAuth();
    const schoolId = user?.schoolId || "N/A";

    // ---------------- STATE ----------------
    const [timetableToday, setTimetableToday] = useState([]);
    const [attendanceLog, setAttendanceLog] = useState({});
    const [loading, setLoading] = useState(true);
    const [filterClass, setFilterClass] = useState("");

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    // --- WEEK LOGIC ---
    const getMonday = (d) => {
        d = new Date(d);
        const day = d.getDay(),
              diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    };

    const [currentMonday, setCurrentMonday] = useState(getMonday(new Date()));
    const [activeDay, setActiveDay] = useState(days[new Date().getDay() - 1] || "Monday");

    // --- Helper: Get Friday of current week ---
    const getFriday = (monday) => {
        const friday = new Date(monday);
        friday.setDate(friday.getDate() + 4);
        return friday;
    };

    // --- Helper: Week number in the month ---
    const getWeekOfMonth = (date) => {
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const firstMonday = new Date(firstDayOfMonth);
        while (firstMonday.getDay() !== 1) {
            firstMonday.setDate(firstMonday.getDate() + 1);
        }
        const diffInDays = Math.floor((date - firstMonday) / (1000 * 60 * 60 * 24));
        return Math.floor(diffInDays / 7) + 1;
    };

    const activeCalendarDate = (() => {
        const target = new Date(currentMonday);
        target.setDate(target.getDate() + days.indexOf(activeDay));
        return target.toISOString().split('T')[0];
    })();

    const weekLabel = (() => {
        const friday = getFriday(currentMonday);
        const weekNumber = getWeekOfMonth(currentMonday);
        const monthName = currentMonday.toLocaleString("en-US", { month: "long" });
        return `${monthName.toUpperCase()} – WEEK ${weekNumber} (Mon ${currentMonday.getDate()} – Fri ${friday.getDate()})`;
    })();

    // 1. FETCH TIMETABLE
    useEffect(() => {
        if (schoolId === "N/A") return;
        setLoading(true);

        const q = query(
            collection(schoollpq, "Timetables"), 
            where("schoolId", "==", schoolId),
            where("day", "==", activeDay)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const sorted = data.sort((a, b) => {
                const pA = a.period === "Lunch" ? 4.5 : parseFloat(a.period);
                const pB = b.period === "Lunch" ? 4.5 : parseFloat(b.period);
                return pA - pB;
            });
            setTimetableToday(sorted);
            setLoading(false);
        });

        return () => unsub();
    }, [schoolId, activeDay]);

    // 2. FETCH ATTENDANCE FOR THE SPECIFIC DATE
    useEffect(() => {
        const fetchExistingAttendance = async () => {
            const q = query(
                collection(schoollpq, "TeacherAttendance"),
                where("schoolId", "==", schoolId),
                where("date", "==", activeCalendarDate)
            );
            const querySnapshot = await getDocs(q);
            const marks = {};
            querySnapshot.forEach((doc) => {
                marks[doc.data().timetableId] = doc.data().status;
            });
            setAttendanceLog(marks);
        };
        if(schoolId !== "N/A") fetchExistingAttendance();
    }, [schoolId, activeCalendarDate]);

    const handleMarkStatus = async (item, status) => {
        try {
            await addDoc(collection(schoollpq, "TeacherAttendance"), {
                schoolId,
                timetableId: item.id,
                teacherName: item.teacher,
                subject: item.subject,
                className: item.className,
                period: item.period,
                time: item.time,
                date: activeCalendarDate,
                day: activeDay, 
                status: status,
                markedAt: serverTimestamp(),
                markedBy: user?.fullName || "Admin"
            });

            setAttendanceLog(prev => ({ ...prev, [item.id]: status }));
            toast.success(`Marked ${status}`);
        } catch (err) {
            toast.error("Error saving");
        }
    };

    // Week Navigation
    const changeWeek = (direction) => {
        const newMonday = new Date(currentMonday);
        newMonday.setDate(newMonday.getDate() + (direction * 7));
        setCurrentMonday(newMonday);
    };

    const classes = [...new Set(timetableToday.map(t => t.className))];
    const filteredList = timetableToday.filter(t => filterClass === "" || t.className === filterClass);

    return (
        <div className="p-4 bg-gray-50 min-h-screen">
            <div className="max-w-5xl mx-auto">
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                    
                    {/* WEEK NAVIGATION */}
                    <div className="flex justify-between items-center mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-white rounded-lg transition text-gray-400 font-bold text-sm">← Previous Week</button>
                        <div className="text-center">
                            <span className="text-xs font-black text-teal-600 uppercase block">Current Week</span>
                            <span className="text-sm font-bold text-gray-700">{weekLabel}</span>
                        </div>
                        <button onClick={() => changeWeek(1)} className="p-2 hover:bg-white rounded-lg transition text-gray-400 font-bold text-sm">Next Week →</button>
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div>
                            <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tight italic">Roll Call</h1>
                            <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">{activeDay}, {activeCalendarDate}</p>
                        </div>
                        <select 
                            className="bg-white border-2 border-gray-100 p-2 rounded-xl font-bold text-xs"
                            value={filterClass}
                            onChange={(e) => setFilterClass(e.target.value)}
                        >
                            <option value="">Filter Class</option>
                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* DAY SELECTOR */}
                    <div className="flex flex-wrap gap-2 justify-center mb-8">
                        {days.map((day) => (
                            <button
                                key={day}
                                onClick={() => setActiveDay(day)}
                                className={`px-5 py-2 rounded-xl text-[11px] font-black transition-all
                                    ${activeDay === day ? "bg-teal-600 text-white shadow-lg shadow-teal-100" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                            >
                                {day.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* LIST */}
                    {loading ? (
                        <div className="text-center py-10 font-bold text-gray-200 animate-pulse">Loading Schedule...</div>
                    ) : (
                        <div className="space-y-3">
                            {filteredList.map((item) => {
                                if (item.period === "Lunch") return null;
                                const currentStatus = attendanceLog[item.id];

                                return (
                                    <div key={item.id} className={`flex flex-col md:flex-row items-center justify-between p-4 rounded-2xl border-2 transition-all ${currentStatus ? 'bg-gray-50 border-transparent' : 'bg-white border-gray-50'}`}>
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className="h-10 w-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-black text-sm">{item.period}</div>
                                            <div>
                                                <h3 className="font-black text-gray-800 text-sm uppercase">{item.teacher}</h3>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase">{item.subject} • {item.className}</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 mt-4 md:mt-0">
                                            {!currentStatus ? (
                                                <>
                                                    <button onClick={() => handleMarkStatus(item, "Present")} className="px-3 py-1.5 bg-green-500 text-white text-[9px] font-black rounded-lg">PRESENT</button>
                                                    <button onClick={() => handleMarkStatus(item, "Late")} className="px-3 py-1.5 bg-yellow-500 text-white text-[9px] font-black rounded-lg">LATE</button>
                                                    <button onClick={() => handleMarkStatus(item, "Absent")} className="px-3 py-1.5 bg-red-500 text-white text-[9px] font-black rounded-lg">ABSENT</button>
                                                </>
                                            ) : (
                                                <span className={`px-4 py-1.5 rounded-lg font-black text-[9px] ${currentStatus === "Present" ? "text-green-600 bg-green-50" : currentStatus === "Late" ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50"}`}>
                                                    {currentStatus}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TimeTableTeacherAtt;
