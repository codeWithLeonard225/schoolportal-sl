import React, { useEffect, useState, useMemo } from "react";
import { db } from "../../../firebase"; 
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import localforage from "localforage";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// 1. Initialize Cache
const classReportStore = localforage.createInstance({
  name: "ClassAssignmentCache",
  storeName: "classData",
});

const TeacherClassReport = () => {
  const location = useLocation();
  const schoolId = location.state?.schoolId || "N/A";

  const [assignments, setAssignments] = useState([]);
  const [selectedClass, setSelectedClass] = useState("All Classes");
  const [loading, setLoading] = useState(true);

  const CACHE_KEY = `class_report_${schoolId}`;

  // 2. Real-time Firestore Sync & Cache Fallback
  useEffect(() => {
    if (schoolId === "N/A") {
      setLoading(false);
      return;
    }

    const init = async () => {
      // Load from cache for speed
      try {
        const cached = await classReportStore.getItem(CACHE_KEY);
        if (cached?.data) {
          setAssignments(cached.data);
          setLoading(false);
        }
      } catch (e) {
        console.error("Cache retrieval failed:", e);
      }

      // Live Listener for instant updates
      const q = query(
        collection(db, "TeacherAssignments"),
        where("schoolId", "==", schoolId)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAssignments(data);
        setLoading(false);
        // Update Cache
        classReportStore.setItem(CACHE_KEY, { data, ts: Date.now() });
      }, (error) => {
        console.error("Firestore error:", error);
        setLoading(false);
      });

      return () => unsub();
    };

    init();
  }, [schoolId]);

  // 3. Extract Unique Class Names for Dropdown
  const classList = useMemo(() => {
    const uniqueClasses = [...new Set(assignments.map(a => a.className).filter(Boolean))];
    return ["All Classes", ...uniqueClasses.sort()];
  }, [assignments]);

  // 4. Group Data by Class
  const groupedByClass = useMemo(() => {
    const grouped = {};
    assignments.forEach((item) => {
      const cls = item.className || "Unassigned Class";
      if (!grouped[cls]) grouped[cls] = [];
      grouped[cls].push({
        teacher: item.teacher || "Unknown Teacher",
        subjects: item.subjects || [],
      });
    });

    return Object.keys(grouped)
      .sort()
      .map((key) => ({
        className: key,
        teachers: grouped[key].sort((a, b) => a.teacher.localeCompare(b.teacher)),
      }));
  }, [assignments]);

  // 5. Filter for UI Display
  const filteredData = useMemo(() => {
    if (selectedClass === "All Classes") return groupedByClass;
    return groupedByClass.filter((item) => item.className === selectedClass);
  }, [groupedByClass, selectedClass]);

  // 6. PDF Generation Handler
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55);
    doc.text("teacher Class Report", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 33);

    let currentY = 40;

    filteredData.forEach((cls) => {
      // Header for each Class
      doc.setFont(undefined, 'bold');
      doc.setFillColor(243, 244, 246);
      doc.rect(14, currentY, 182, 8, 'F');
      doc.setTextColor(30, 58, 138);
      doc.text(`CLASS: ${cls.className}`, 16, currentY + 6);
      
      const tableRows = cls.teachers.map(t => [t.teacher, t.subjects.join(", ")]);
      
      autoTable(doc, {
        startY: currentY + 10,
        head: [['Teacher Name', 'Assigned Subjects']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [31, 41, 55], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        margin: { left: 14 },
      });

      currentY = doc.lastAutoTable.finalY + 12;

      // Page overflow check
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
      }
    });

    doc.save(`${schoolId}_Class_Matrix.pdf`);
  };

  if (loading && assignments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-gray-500 animate-pulse">Syncing Assignment Database...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Section */}
        <div className="bg-white rounded-3xl p-6 mb-8 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Class Matrix</h1>
            <p className="text-gray-500 font-medium">Manage teacher allocations per class</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Custom Dropdown */}
            <div className="relative group">
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full sm:w-64 appearance-none bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3 font-bold text-gray-700 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all cursor-pointer"
              >
                {classList.map((cls, i) => (
                  <option key={i} value={cls}>{cls}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <button
              onClick={handleDownloadPDF}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-200 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export PDF
            </button>
          </div>
        </div>

        {/* Assignments List */}
        <div className="grid gap-6">
          {filteredData.length > 0 ? (
            filteredData.map((cls, idx) => (
              <div key={idx} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-gray-900 px-8 py-5 flex justify-between items-center">
                  <h2 className="text-xl font-black text-white uppercase tracking-widest">{cls.className}</h2>
                  <span className="bg-white/10 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase">
                    {cls.teachers.length} Staff Members
                  </span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Assigned Teacher</th>
                        <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Subject Load</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {cls.teachers.map((t, i) => (
                        <tr key={i} className="hover:bg-blue-50/30 transition-colors group">
                          <td className="px-8 py-5">
                            <span className="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">{t.teacher}</span>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex flex-wrap gap-2">
                              {t.subjects.map((sub, si) => (
                                <span key={si} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-[11px] font-black border border-blue-100">
                                  {sub}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-3xl p-20 text-center border-2 border-dashed border-gray-200">
              <p className="text-gray-400 font-bold text-lg">No assignments found for your selection.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherClassReport;