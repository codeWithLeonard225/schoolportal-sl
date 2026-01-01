import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { schoollpq } from "../Database/schoollibAndPastquestion"; 
import { useAuth } from "../Security/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const StaffSelfAttendanceReport = () => {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "N/A";
  const teacherID = user?.data?.teacherID || user?.id;
  const teacherName = user?.data?.teacherName || "Teacher";

  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // ---------------- FETCH ATTENDANCE HISTORY ----------------
  useEffect(() => {
    const fetchMyAttendance = async () => {
      if (!teacherID || schoolId === "N/A") return;
      setLoading(true);
      try {
        const q = query(
          collection(schoollpq, "StaffAttendanceSimple"),
          where("schoolId", "==", schoolId),
          where("staffID", "==", teacherID),
          orderBy("date", "desc")
        );
        const querySnapshot = await getDocs(q);
        const records = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAttendanceHistory(records);
      } catch (error) {
        console.error("Error fetching staff attendance:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMyAttendance();
  }, [schoolId, teacherID]);

  // ---------------- FILTER FOR SELECTED MONTH ----------------
  const monthlyRecords = useMemo(() => {
    return attendanceHistory.filter(r => r.date.startsWith(selectedMonth));
  }, [attendanceHistory, selectedMonth]);

  // ---------------- EXPORT PDF ----------------
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Staff Attendance Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Name: ${teacherName}`, 14, 22);
    doc.text(`Month: ${selectedMonth}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [["Date", "Status", "Time"]],
      body: monthlyRecords.map(r => [
        r.date,
        r.status,
        r.time?.toDate ? r.time.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A"
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] }
    });
    doc.save(`Attendance_${teacherName}_${selectedMonth}.pdf`);
  };

  // ---------------- CALENDAR VIEW ----------------
  const calendarMap = useMemo(() => {
    const map = {};
    monthlyRecords.forEach(r => {
      map[r.date] = r.status;
    });
    return map;
  }, [monthlyRecords]);

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">

        {/* HEADER */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-800 uppercase tracking-tight">Daily Attendance Log</h1>
            <p className="text-indigo-600 font-bold text-[10px] sm:text-xs uppercase tracking-widest">General Staff Record</p>
          </div>
          <div className="bg-indigo-50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl border border-indigo-100 text-center">
            <p className="text-[9px] sm:text-[10px] font-black text-indigo-400 uppercase">Staff Name</p>
            <p className="text-xs sm:text-sm font-bold text-indigo-900">{teacherName}</p>
          </div>
        </div>

        {/* FILTER & EXPORT */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border rounded-xl px-4 py-2 text-sm font-bold bg-white shadow-sm w-full sm:w-auto"
          />
          <button
            onClick={exportPDF}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow hover:bg-indigo-700 w-full sm:w-auto"
          >
            📄 Export PDF
          </button>
        </div>

        {/* STATS SUMMARY */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm text-center">
            <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase">Days Present</p>
            <p className="text-2xl font-black text-green-600">
              {monthlyRecords.filter(r => r.status === "Present").length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm text-center">
            <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase">Days Absent</p>
            <p className="text-2xl font-black text-red-600">
              {monthlyRecords.filter(r => r.status === "Absent").length}
            </p>
          </div>
        </div>

        {/* LIST */}
        <div className="space-y-3 overflow-x-auto">
          {loading ? (
            <div className="text-center py-6 font-bold text-gray-400 animate-pulse uppercase">Syncing Records...</div>
          ) : monthlyRecords.length > 0 ? (
            monthlyRecords.map((record) => (
              <div key={record.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                  <div className="bg-gray-100 h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex flex-col items-center justify-center text-gray-500">
                    <span className="text-[7px] sm:text-[8px] font-black uppercase">Date</span>
                    <span className="text-xs sm:text-sm font-bold">{record.date.split('-')[2]}</span>
                  </div>
                  <div>
                    <p className="text-[9px] sm:text-xs font-black text-gray-400 uppercase">{new Date(record.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
                    <h3 className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                      Recorded at: {record.time?.toDate ? record.time.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'N/A'}
                    </h3>
                  </div>
                </div>
                <div className={`px-3 sm:px-5 py-1 sm:py-2 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${
                  record.status === 'Present' ? 'bg-green-100 text-green-700 border border-green-200' :
                  'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {record.status}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 text-center">
              <p className="text-gray-400 font-bold uppercase text-sm">No attendance records found.</p>
            </div>
          )}
        </div>

        {/* CALENDAR VIEW */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border mt-6">
          <h3 className="font-black text-gray-700 mb-3 uppercase text-sm sm:text-base">Monthly Calendar</h3>
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[8px] sm:text-xs font-bold">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} className="text-gray-400">{d}</div>
            ))}
            {Array.from({ length: new Date(selectedMonth.split("-")[0], selectedMonth.split("-")[1], 0).getDate() }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${selectedMonth}-${String(day).padStart(2,"0")}`;
              const status = calendarMap[dateStr];
              return (
                <div
                  key={dateStr}
                  className={`h-8 sm:h-10 flex items-center justify-center rounded-xl border text-[8px] sm:text-xs
                    ${status === "Present" ? "bg-green-100 text-green-700" :
                      status === "Absent" ? "bg-red-100 text-red-700" :
                      "bg-gray-50 text-gray-400"}`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default StaffSelfAttendanceReport;
