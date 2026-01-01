import React, { useState, useEffect, useMemo } from "react";
import { 
  collection, 
  onSnapshot, 
  query, 
  where 
} from "firebase/firestore";
import { schoollpq } from "../Database/schoollibAndPastquestion"; 
import { useAuth } from "../Security/AuthContext";
import localforage from "localforage";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ---------- LOCALFORAGE CACHE ----------
const teacherCache = localforage.createInstance({
  name: "TeacherReportCache",
  storeName: "MyTimetable",
});

const TeacherTimetableReport = () => {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "N/A";
  
  // Matches your Teacher Auth example: user.data.teacherName
  const teacherName = user?.data?.teacherName; 

  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(true);

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const periodsOrder = ["1", "2", "3", "4", "Lunch", "5", "6", "7", "8"];

  // ---------------- OFFLINE-FIRST FETCH LOGIC ----------------
  useEffect(() => {
    if (!teacherName || schoolId === "N/A") return;

    // 1. Try to load from local cache immediately
    const loadCache = async () => {
      const cacheKey = `my_tt_${schoolId}_${teacherName}`;
      const cachedData = await teacherCache.getItem(cacheKey);
      if (cachedData) {
        setTimetable(cachedData);
        setLoading(false);
      }
    };
    loadCache();

    // 2. Setup Real-time listener to Firebase
    const q = query(
      collection(schoollpq, "Timetables"),
      where("teacher", "==", teacherName),
      where("schoolId", "==", schoolId)
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      // --- FIX FOR DUPLICATE KEYS ---
      // Using a Map ensures that if Firebase returns two docs with the same ID, 
      // they are merged into one entry.
      const uniqueDocsMap = new Map();
      
      snapshot.docs.forEach((doc) => {
        uniqueDocsMap.set(doc.id, { id: doc.id, ...doc.data() });
      });

      const data = Array.from(uniqueDocsMap.values());
      
      // Sort data by period order defined in periodsOrder array
      const sortedData = data.sort((a, b) => 
        periodsOrder.indexOf(a.period) - periodsOrder.indexOf(b.period)
      );

      setTimetable(sortedData);
      
      // Update cache for next offline use
      await teacherCache.setItem(`my_tt_${schoolId}_${teacherName}`, sortedData);
      setLoading(false);
    }, (error) => {
      console.error("Timetable fetch error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [teacherName, schoolId]);

  // ---------------- PDF GENERATION ----------------
  const handleDownloadPDF = () => {
    if (timetable.length === 0) return;

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    
    doc.setFontSize(18).setFont(undefined, 'bold');
    doc.text(`Teaching Schedule: ${teacherName}`, 40, 45);
    
    doc.setFontSize(10).setFont(undefined, 'normal').setTextColor(100);
    doc.text(`School ID: ${schoolId} | Academic Year Record`, 40, 65);

    let currentY = 90;

    days.forEach((day) => {
      const dayClasses = timetable.filter(t => t.day === day);
      if (dayClasses.length === 0) return;

      doc.setFontSize(12).setTextColor(13, 148, 136).setFont(undefined, 'bold');
      doc.text(day.toUpperCase(), 40, currentY);
      
      autoTable(doc, {
        startY: currentY + 10,
        head: [['Period', 'Class', 'Subject', 'Time']],
        body: dayClasses.map(p => [
          p.period === "Lunch" ? "LUNCH" : `P${p.period}`,
          p.className,
          p.subject,
          p.time
        ]),
        theme: 'grid',
        headStyles: { fillColor: [13, 148, 136], halign: 'center' },
        columnStyles: { 0: { halign: 'center' }, 3: { halign: 'center' } },
        styles: { fontSize: 9 },
        margin: { left: 40, right: 40 }
      });

      currentY = doc.lastAutoTable.finalY + 35;
      
      // Page management
      if (currentY > 750) {
        doc.addPage();
        currentY = 50;
      }
    });

    doc.save(`${teacherName}_Schedule.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER SECTION */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-black text-gray-800 tracking-tighter italic uppercase">
              My Schedule
            </h1>
            <p className="text-sm font-bold text-teal-600 mt-1 uppercase tracking-widest">
              Teacher: {teacherName || "Checking Auth..."}
            </p>
          </div>
          
          <button
            onClick={handleDownloadPDF}
            disabled={timetable.length === 0}
            className="w-full md:w-auto bg-teal-600 hover:bg-teal-700 text-white font-black text-[11px] px-8 py-3 rounded-2xl shadow-lg transition-all disabled:bg-gray-300 uppercase tracking-widest"
          >
            Download PDF Report
          </button>
        </div>

        {/* LOADING STATE */}
        {loading && timetable.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200">
             <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
             <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">Syncing your timetable...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {days.map((day) => {
              const dayPeriods = timetable.filter(t => t.day === day);
              return (
                <div key={`day-card-${day}`} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm transition-hover hover:shadow-md">
                  <div className="flex justify-between items-center mb-5 border-b border-gray-50 pb-3">
                    <h3 className="text-sm font-black text-teal-600 uppercase tracking-widest">
                      {day}
                    </h3>
                    <span className="bg-teal-50 text-teal-700 text-[9px] font-black px-2 py-1 rounded-lg">
                      {dayPeriods.length} PERIODS
                    </span>
                  </div>
                  
                  {dayPeriods.length === 0 ? (
                    <div className="py-10 text-center">
                        <p className="text-gray-300 italic text-xs font-medium">No classes today</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {dayPeriods.map((p) => (
                        <div 
                          // Combined key prevents the "Unique Key" error
                          key={`${p.id}-${p.day}-${p.period}`} 
                          className={`group p-4 rounded-2xl border transition-all ${
                            p.period === 'Lunch' 
                              ? 'bg-orange-50 border-orange-100' 
                              : 'bg-gray-50 border-gray-100 hover:border-teal-200 hover:bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <span className={`text-[9px] font-black px-2 py-1 rounded-md ${
                              p.period === 'Lunch' ? 'bg-orange-200 text-orange-800' : 'bg-white text-gray-400'
                            }`}>
                              {p.period === 'Lunch' ? 'BREAK' : `P${p.period}`}
                            </span>
                            <span className="text-[20px] font-bold text-gray-400">{p.time}</span>
                          </div>
                          
                          <h4 className="text-xs font-black text-gray-800 uppercase tracking-tight">
                            {p.subject || "No Subject"}
                          </h4>
                          <p className="text-[10px] font-bold text-teal-600 mt-1 uppercase">
                            Class: {p.className}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && timetable.length === 0 && (
          <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-100">
            <p className="text-gray-400 font-bold italic text-sm">You haven't been assigned any lessons in the master timetable yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherTimetableReport;