import React, { useState, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import {
  collection,
  onSnapshot,
  query,
  where,
  addDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { schoollpq } from "../Database/schoollibAndPastquestion"; 
import { useAuth } from "../Security/AuthContext";
import localforage from "localforage";

// ---------- LOCALFORAGE CACHE ----------
const timetableCache = localforage.createInstance({
  name: "TimeTableTeacherCache",
  storeName: "TimetableToday",
});

const attendanceCache = localforage.createInstance({
  name: "TimeTableTeacherCache",
  storeName: "AttendanceLog",
});

const TimeTableTeacherAtt = () => {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "N/A";

  // ---------------- STATE ----------------
  const [timetableToday, setTimetableToday] = useState([]);
  const [attendanceLog, setAttendanceLog] = useState({});
  const [topicLog, setTopicLog] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState("");

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  const getMonday = (d) => {
    d = new Date(d);
    const day = d.getDay(),
      diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const [currentMonday, setCurrentMonday] = useState(getMonday(new Date()));
  const [activeDay, setActiveDay] = useState(
    days[new Date().getDay() - 1] || "Monday"
  );

  const getFriday = (monday) => {
    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);
    return friday;
  };

  const getWeekOfMonth = (date) => {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstMonday = new Date(firstDayOfMonth);
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1);
    }
    const diffInDays = Math.floor((date - firstMonday) / (1000 * 60 * 60 * 24));
    return Math.floor(diffInDays / 7) + 1;
  };

  const activeCalendarDate = useMemo(() => {
    const target = new Date(currentMonday);
    target.setDate(target.getDate() + days.indexOf(activeDay));
    return target.toISOString().split("T")[0];
  }, [currentMonday, activeDay]);

  const weekLabel = useMemo(() => {
    const friday = getFriday(currentMonday);
    const weekNumber = getWeekOfMonth(currentMonday);
    const monthName = currentMonday.toLocaleString("en-US", { month: "long" });
    return `${monthName.toUpperCase()} – WEEK ${weekNumber} (Mon ${currentMonday.getDate()} – Fri ${friday.getDate()})`;
  }, [currentMonday]);

  // ---------------- OFFLINE-FIRST FETCH TIMETABLE ----------------
  useEffect(() => {
    if (schoolId === "N/A") return;
    setLoading(true);

    timetableCache
      .getItem(`${schoolId}-${activeDay}`)
      .then((cachedData) => { if (cachedData) setTimetableToday(cachedData); })
      .catch(console.error);

    const q = query(
      collection(schoollpq, "Timetables"),
      where("schoolId", "==", schoolId),
      where("day", "==", activeDay)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const uniqueMap = new Map();
      snapshot.docs.forEach((doc) => {
        uniqueMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
      const data = Array.from(uniqueMap.values());
      const sorted = data.sort((a, b) => {
        const pA = a.period === "Lunch" ? 4.5 : parseFloat(a.period);
        const pB = b.period === "Lunch" ? 4.5 : parseFloat(b.period);
        return pA - pB;
      });
      setTimetableToday(sorted);
      timetableCache.setItem(`${schoolId}-${activeDay}`, sorted).catch(console.error);
      setLoading(false);
    }, console.error);

    return () => unsub();
  }, [schoolId, activeDay]);

  // ---------------- OFFLINE-FIRST FETCH ATTENDANCE ----------------
  useEffect(() => {
    const fetchExistingAttendance = async () => {
      attendanceCache.getItem(`${schoolId}-${activeCalendarDate}`)
        .then((cached) => { if (cached) setAttendanceLog(cached); })
        .catch(console.error);

      const q = query(
        collection(schoollpq, "TeacherAttendance"),
        where("schoolId", "==", schoolId),
        where("date", "==", activeCalendarDate)
      );

      try {
        const querySnapshot = await getDocs(q);
        const marks = {};
        const topics = {};
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          marks[data.timetableId] = data.status;
          if (data.topic) topics[data.timetableId] = data.topic;
        });
        setAttendanceLog(marks);
        setTopicLog(topics);

        attendanceCache.setItem(`${schoolId}-${activeCalendarDate}`, marks).catch(console.error);
      } catch (err) { console.error(err); }
    };
    if (schoolId !== "N/A") fetchExistingAttendance();
  }, [schoolId, activeCalendarDate]);

  // ---------------- FILTERED LIST ----------------
  const availableClasses = useMemo(() => {
    return [...new Set(timetableToday.map((t) => t.className).filter(Boolean))];
  }, [timetableToday]);

  const filteredList = useMemo(() => {
    return timetableToday.filter(
      (t) => (filterClass === "" || t.className === filterClass) && t.period !== "Lunch"
    );
  }, [timetableToday, filterClass]);

  // ---------------- MARK ATTENDANCE ----------------
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
        status,
        topic: topicLog[item.id] || "",
        markedAt: serverTimestamp(),
        markedBy: user?.fullName || "Admin",
      });

      const updated = { ...attendanceLog, [item.id]: status };
      setAttendanceLog(updated);
      attendanceCache.setItem(`${schoolId}-${activeCalendarDate}`, updated).catch(console.error);
      toast.success(`Marked ${status}`);
    } catch (err) {
      console.error(err);
      toast.error("Error saving attendance");
    }
  };

  const changeWeek = (direction) => {
    const newMonday = new Date(currentMonday);
    newMonday.setDate(newMonday.getDate() + direction * 7);
    setCurrentMonday(newMonday);
  };

  // ---------------- JSX ----------------
  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          {/* WEEK NAVIGATION */}
          <div className="flex justify-between items-center mb-6 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <button onClick={() => changeWeek(-1)} className="p-2 hover:bg-white rounded-lg transition text-gray-400 font-bold text-sm">← Prev Week</button>
            <div className="text-center">
              <span className="text-xs font-black text-teal-600 uppercase block">Academic Calendar</span>
              <span className="text-sm font-bold text-gray-700">{weekLabel}</span>
            </div>
            <button onClick={() => changeWeek(1)} className="p-2 hover:bg-white rounded-lg transition text-gray-400 font-bold text-sm">Next Week →</button>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-800 uppercase tracking-tight italic">Attendance Roll</h1>
              <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">{activeDay}, {activeCalendarDate}</p>
            </div>
            <select 
              className="bg-white border-2 border-gray-100 p-2 rounded-xl font-bold text-xs outline-teal-500"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
            >
              <option value="">All Classes</option>
              {availableClasses.map(c => <option key={`class-opt-${c}`} value={c}>{c}</option>)}
            </select>
          </div>

          {/* DAY SELECTOR */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {days.map((day) => (
              <button
                key={`day-btn-${day}`}
                onClick={() => setActiveDay(day)}
                className={`px-5 py-2 rounded-xl text-[11px] font-black transition-all
                  ${activeDay === day ? "bg-teal-600 text-white shadow-lg" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
              >
                {day.toUpperCase()}
              </button>
            ))}
          </div>

          {/* ATTENDANCE LIST */}
          {loading ? (
            <div className="text-center py-20 font-bold text-gray-300 animate-pulse uppercase tracking-widest">Updating Schedule...</div>
          ) : (
            <div className="space-y-3">
              {filteredList.length === 0 ? (
                <div className="text-center py-10 text-gray-300 italic">No periods scheduled for this filter.</div>
              ) : (
                filteredList.map((item) => {
                  const currentStatus = attendanceLog[item.id];
                  return (
                    <div key={`period-${item.id}`} className={`flex flex-col md:flex-row items-center justify-between p-4 rounded-2xl border-2 transition-all ${currentStatus ? 'bg-gray-50 border-transparent shadow-none' : 'bg-white border-gray-50 shadow-sm'}`}>
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="h-10 w-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-black text-sm">
                          {item.period}
                        </div>
                        <div>
                          <h3 className="font-black text-gray-800 text-sm uppercase">{item.teacher}</h3>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">{item.subject} • {item.className} • {item.time}</p>
                          <input
                            type="text"
                            placeholder="Enter Topic"
                            value={topicLog[item.id] || ""}
                            onChange={(e) => setTopicLog((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className="mt-1 w-full border px-2 py-1 rounded-lg text-[10px] outline-teal-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4 md:mt-0">
                        {!currentStatus ? (
                          <>
                            <button onClick={() => handleMarkStatus(item, "Present")} className="px-3 py-1.5 bg-green-500 text-white text-[9px] font-black rounded-lg hover:bg-green-600 transition">PRESENT</button>
                            <button onClick={() => handleMarkStatus(item, "Late")} className="px-3 py-1.5 bg-yellow-500 text-white text-[9px] font-black rounded-lg hover:bg-yellow-600 transition">LATE</button>
                            <button onClick={() => handleMarkStatus(item, "Absent")} className="px-3 py-1.5 bg-red-500 text-white text-[9px] font-black rounded-lg hover:bg-red-600 transition">ABSENT</button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`px-4 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-wider ${
                              currentStatus === "Present" ? "text-green-600 bg-green-100" : 
                              currentStatus === "Late" ? "text-yellow-600 bg-yellow-100" : 
                              "text-red-600 bg-red-100"
                            }`}>
                              ● {currentStatus}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeTableTeacherAtt;
