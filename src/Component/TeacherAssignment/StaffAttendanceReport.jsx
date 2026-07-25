import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { schoollpq } from "../Database/schoollibAndPastquestion"; 
import { useAuth } from "../Security/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const getTodayDate = () => new Date().toISOString().slice(0, 10);

const StaffSelfAttendanceReport = () => {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "N/A";
  const teacherID = user?.data?.teacherID || user?.id;
  const teacherName = user?.data?.teacherName || "Teacher";

  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter Modes: 'single' (By Day) or 'range' (Between Dates)
  const [filterMode, setFilterMode] = useState("single"); 
  const [singleDate, setSingleDate] = useState(getTodayDate());
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());

  // ---------------- FETCH ATTENDANCE HISTORY ----------------
  useEffect(() => {
    const fetchMyAttendance = async () => {
      if (!teacherID || schoolId === "N/A") return;
      setLoading(true);
      try {
        const q = query(
          collection(schoollpq, "StaffAttendanceSimple"),
          where("schoolId", "==", schoolId),
          where("staffID", "==", teacherID)
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

  // ---------------- FILTER RECORDS BY DATE RANGE OR SINGLE DAY ----------------
  const filteredRecords = useMemo(() => {
    return attendanceHistory.filter(r => {
      if (!r.date) return false;

      if (filterMode === "single") {
        return r.date === singleDate;
      } else {
        // Range mode comparison (YYYY-MM-DD string comparisons work naturally)
        if (startDate && endDate) {
          return r.date >= startDate && r.date <= endDate;
        } else if (startDate) {
          return r.date >= startDate;
        } else if (endDate) {
          return r.date <= endDate;
        }
        return true;
      }
    }).sort((a, b) => b.date.localeCompare(a.date)); // Sort latest first
  }, [attendanceHistory, filterMode, singleDate, startDate, endDate]);

  // ---------------- EXPORT PDF ----------------
  const exportPDF = () => {
    const doc = new jsPDF();
    const dateRangeLabel = filterMode === "single" 
      ? `Date: ${singleDate}` 
      : `Range: ${startDate} to ${endDate}`;

    doc.setFontSize(16);
    doc.text("Staff Attendance Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Name: ${teacherName}`, 14, 22);
    doc.text(dateRangeLabel, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [["Date", "Status", "Time"]],
      body: filteredRecords.map(r => [
        r.date,
        r.status,
        r.time?.toDate ? r.time.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A"
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`Attendance_${teacherName}_${filterMode === "single" ? singleDate : `${startDate}_to_${endDate}`}.pdf`);
  };

  // ---------------- CALENDAR MAP ----------------
  const calendarMap = useMemo(() => {
    const map = {};
    filteredRecords.forEach(r => {
      map[r.date] = r.status;
    });
    return map;
  }, [filteredRecords]);

  // Derive calendar base month from the primary selected date
  const activeMonthStr = filterMode === "single" ? singleDate.slice(0, 7) : startDate.slice(0, 7);

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

        {/* FILTER CONTROL CARD */}
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-3">
            <label className="text-xs font-black uppercase text-gray-500 tracking-wider">
              Filter Mode:
            </label>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setFilterMode("single")}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterMode === "single"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                📅 By Specific Day
              </button>
              <button
                onClick={() => setFilterMode("range")}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterMode === "range"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                📆 Between Dates
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-end gap-4">
            {/* DATE INPUTS */}
            {filterMode === "single" ? (
              <div className="w-full sm:w-auto">
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Select Day:</label>
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                  className="border rounded-xl px-4 py-2 text-sm font-bold bg-gray-50 shadow-sm w-full sm:w-64 focus:bg-white transition"
                />
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <div className="w-full sm:w-auto">
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">From Date:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border rounded-xl px-4 py-2 text-sm font-bold bg-gray-50 shadow-sm w-full sm:w-48 focus:bg-white transition"
                  />
                </div>
                <div className="w-full sm:w-auto">
                  <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">To Date:</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border rounded-xl px-4 py-2 text-sm font-bold bg-gray-50 shadow-sm w-full sm:w-48 focus:bg-white transition"
                  />
                </div>
              </div>
            )}

            {/* EXPORT BUTTON */}
            <button
              onClick={exportPDF}
              disabled={filteredRecords.length === 0}
              className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow hover:bg-indigo-700 w-full sm:w-auto transition disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              📄 Export PDF
            </button>
          </div>
        </div>

        {/* STATS SUMMARY */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm text-center">
            <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase">Days Present</p>
            <p className="text-xl sm:text-2xl font-black text-green-600">
              {filteredRecords.filter(r => r.status === "Present").length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm text-center">
            <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase">Days Late</p>
            <p className="text-xl sm:text-2xl font-black text-amber-500">
              {filteredRecords.filter(r => r.status === "Late").length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm text-center">
            <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase">Days Absent</p>
            <p className="text-xl sm:text-2xl font-black text-red-600">
              {filteredRecords.filter(r => r.status === "Absent").length}
            </p>
          </div>
        </div>

        {/* ATTENDANCE RECORDS LIST */}
        <div className="space-y-3 overflow-x-auto">
          {loading ? (
            <div className="text-center py-6 font-bold text-gray-400 animate-pulse uppercase text-sm">Syncing Records...</div>
          ) : filteredRecords.length > 0 ? (
            filteredRecords.map((record) => (
              <div key={record.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                  <div className="bg-gray-100 h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex flex-col items-center justify-center text-gray-500">
                    <span className="text-[7px] sm:text-[8px] font-black uppercase">Date</span>
                    <span className="text-xs sm:text-sm font-bold">{record.date.split('-')[2]}</span>
                  </div>
                  <div>
                    <p className="text-[9px] sm:text-xs font-black text-gray-400 uppercase">
                      {new Date(record.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <h3 className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wide">
                      Recorded at: {record.time?.toDate ? record.time.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'N/A'}
                    </h3>
                  </div>
                </div>
                <div className={`px-3 sm:px-5 py-1 sm:py-2 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${
                  record.status === 'Present' ? 'bg-green-100 text-green-700 border border-green-200' :
                  record.status === 'Late' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                  'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {record.status}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 text-center">
              <p className="text-gray-400 font-bold uppercase text-sm">No attendance records found for this date selection.</p>
            </div>
          )}
        </div>

        {/* MONTHLY CALENDAR VIEW */}
        {activeMonthStr && (
          <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border mt-2">
            <h3 className="font-black text-gray-700 mb-3 uppercase text-sm sm:text-base">
              Monthly Visual Overview ({activeMonthStr})
            </h3>
            <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-[8px] sm:text-xs font-bold">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                <div key={d} className="text-gray-400">{d}</div>
              ))}
              {Array.from({ length: new Date(activeMonthStr.split("-")[0], activeMonthStr.split("-")[1], 0).getDate() }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${activeMonthStr}-${String(day).padStart(2,"0")}`;
                const status = calendarMap[dateStr];
                return (
                  <div
                    key={dateStr}
                    className={`h-8 sm:h-10 flex items-center justify-center rounded-xl border text-[8px] sm:text-xs font-bold
                      ${status === "Present" ? "bg-green-100 text-green-700 border-green-200" :
                        status === "Late" ? "bg-amber-100 text-amber-700 border-amber-200" :
                        status === "Absent" ? "bg-red-100 text-red-700 border-red-200" :
                        "bg-gray-50 text-gray-400 border-gray-100"}`}
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default StaffSelfAttendanceReport;