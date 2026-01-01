import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit
} from "firebase/firestore";
import { useAuth } from "../Security/AuthContext";
import localforage from "localforage";

// ---------- LOCALFORAGE CACHE ----------
const reportCache = localforage.createInstance({
  name: "TeacherAttendanceHistory",
  storeName: "HistoryLogs",
});

const TeacherAttendanceReport = () => {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "N/A";
  const teacherName = user?.data?.teacherName; // e.g., "MBAYOH KAI"

  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacherName || schoolId === "N/A") return;

    setLoading(true);

    // Load from cache for instant offline view
    reportCache.getItem(`history_${teacherName}`).then((cached) => {
      if (cached) setAttendanceHistory(cached);
    });

    // 1. Fetch only this teacher's attendance from the database
    // This fetches: className, topic, period, date, status, etc.
    const q = query(
      collection(schoollpq, "TeacherAttendance"),
      where("schoolId", "==", schoolId),
      where("teacherName", "==", teacherName),
    //   orderBy("date", "desc"),
      limit(50) 
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAttendanceHistory(data);
      reportCache.setItem(`history_${teacherName}`, data);
      setLoading(false);
    }, (err) => {
        console.error("Firestore Error:", err);
        setLoading(false);
    });

    return () => unsub();
  }, [schoolId, teacherName]);

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Section */}
        <div className="mb-8 border-l-4 border-blue-600 pl-4">
          <h1 className="text-2xl font-black text-gray-800 uppercase italic">
            Attendance Timesheet Report
          </h1>
          <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">
            Teacher: <span className="text-blue-600">{teacherName}</span>
          </p>
        </div>

        {/* Attendance List */}
        <div className="space-y-4">
          {loading && attendanceHistory.length === 0 ? (
            <div className="text-center py-20 font-black text-gray-300 animate-pulse uppercase">
              Fetching Records...
            </div>
          ) : attendanceHistory.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400 font-bold italic">
              No attendance records found in the database.
            </div>
          ) : (
            attendanceHistory.map((log) => (
              <div
                key={log.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow"
              >
                {/* Left Side: Class & Subject */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-1 rounded-md uppercase">
                      Period {log.period}
                    </span>
                    <span className="text-gray-400 font-bold text-[10px] uppercase">
                      {log.time}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-gray-800 uppercase leading-tight">
                    {log.subject}
                  </h3>
                  <p className="text-[11px] font-bold text-gray-400 uppercase mt-1">
                    Class: {log.className}
                  </p>
                </div>

                {/* Middle: Topic Covered */}
                <div className="flex-[1.5] bg-gray-50 p-3 rounded-xl border border-gray-100 w-full md:w-auto">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter mb-1">
                    Topic Covered
                  </p>
                  <p className="text-xs font-bold text-gray-700 italic">
                    "{log.topic || "N/A"}"
                  </p>
                </div>

                {/* Right Side: Status & Date */}
                <div className="text-right flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-2">
                   <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      log.status === 'Present' ? 'bg-green-100 text-green-600' : 
                      log.status === 'Late' ? 'bg-yellow-100 text-yellow-600' : 
                      'bg-red-100 text-red-600'
                    }`}>
                      {log.status}
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-gray-800">{log.date}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">{log.day}</p>
                    </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-8 text-center">
            <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">
                Official Report • Verified by {attendanceHistory[0]?.markedBy || "Admin"}
            </p>
        </div>
      </div>
    </div>
  );
};

export default TeacherAttendanceReport;