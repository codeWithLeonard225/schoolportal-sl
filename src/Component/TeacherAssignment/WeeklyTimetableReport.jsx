import React, { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../firebase";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import { useAuth } from "../Security/AuthContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import localforage from "localforage";

const timetableCache = localforage.createInstance({
  name: "TimeTableTeacherCache",
  storeName: "TimetableWeekly",
});

const WeeklyTimetableReport = () => {
    const { user } = useAuth();
    const schoolId = user?.schoolId || "N/A";

    const [timetable, setTimetable] = useState([]);
    const [availableClasses, setAvailableClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const periods = ["1", "2", "3", "4", "Lunch", "5", "6", "7", "8"];

    useEffect(() => {
        if (schoolId === "N/A") return;

        const unsubC = onSnapshot(
            query(collection(db, "ClassesAndSubjects"), where("schoolId", "==", schoolId)),
            (snapshot) => setAvailableClasses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
        );

        timetableCache.getItem(schoolId).then((cached) => {
            if (cached) setTimetable(cached);
        }).catch(console.error);

        const unsubT = onSnapshot(
            query(collection(schoollpq, "Timetables"), where("schoolId", "==", schoolId)),
            (snapshot) => {
                const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                setTimetable(data);
                timetableCache.setItem(schoolId, data).catch(console.error);
            }
        );

        return () => { unsubC(); unsubT(); };
    }, [schoolId]);

    // ---------------- DOWNLOAD FUNCTIONS ----------------

    const handleDownloadPDF = (className, classData) => {
    const doc = new jsPDF();
    
    // Helper to add header to each page
    const addHeader = (pageNum) => {
        doc.setFontSize(16);
        doc.setTextColor(40);
        doc.text(`${className} - Weekly Timetable (Page ${pageNum})`, 14, 15);
    };

    addHeader(1);
    let finalY = 20;

    days.forEach((day, index) => {
        // Check if we need to move to a new page (Thursday is index 3)
        if (day === "Thursday") {
            doc.addPage();
            addHeader(2);
            finalY = 20; // Reset Y position for the new page
        }

        const dayData = classData
            .filter(t => t.day === day)
            .sort((a, b) => periods.indexOf(a.period) - periods.indexOf(b.period));

        // Day Title
        doc.setFontSize(12);
        doc.setTextColor(13, 148, 136);
        doc.setFont("helvetica", "bold");
        doc.text(day.toUpperCase(), 14, finalY + 10);

        autoTable(doc, {
            startY: finalY + 12,
            head: [["Period", "Subject", "Teacher", "Time"]],
            body: dayData.map(p => [
                p.period === "Lunch" ? "LUNCH" : `P${p.period}`,
                p.subject || "-",
                p.teacher || "N/A",
                p.time || ""
            ]),
            theme: 'striped',
            headStyles: { fillColor: [13, 148, 136] },
            margin: { left: 14 },
            // Ensure table doesn't overflow page if there are many periods
            pageBreak: 'auto', 
        });

        finalY = doc.lastAutoTable.finalY;
    });

    doc.save(`${className}_Vertical_Report.pdf`);
};

const handleDownloadLandscapePDF = (className, classData) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ---------- HEADER ----------
  doc.setFontSize(22);
  doc.setTextColor(13, 148, 136);
  doc.setFont("helvetica", "bold");
  doc.text(`${className} – WEEKLY TIMETABLE`, pageWidth / 2, 18, {
    align: "center",
  });

  // ---------- DATA PREPARATION ----------
  const tableColumn = [
    "DAY",
    ...periods.map((p) => (p === "Lunch" ? "LUNCH" : `P${p}`)),
  ];

  const tableRows = days.map((day) => {
    const row = [day.toUpperCase()];
    periods.forEach((p) => {
      const entry = classData.find(
        (item) => item.day === day && item.period === p
      );

      if (p === "Lunch") {
        // Explicitly adding the time for Lunch Break
        row.push(`BREAK\n15:40 - 16:10`); 
      } else if (entry) {
        // Adding Subject, Teacher, and Time
        row.push(`${entry.subject}\n${entry.teacher}\n${entry.time || ""}`);
      } else {
        row.push("");
      }
    });
    return row;
  });

  // ---------- GENERATE TABLE ----------
  autoTable(doc, {
    startY: 28,
    head: [tableColumn],
    body: tableRows,
    theme: "grid",
    
    // Stretch to fill width
    margin: { left: 10, right: 10, bottom: 10 },
    
    styles: {
      fontSize: 9,
      cellPadding: 3,
      halign: "center",
      valign: "middle",
      textColor: [40, 40, 40],
      overflow: 'linebreak',
      // 🔥 STRETCH VERTICALLY: 
      // pageHeight (210) - startY (28) - margins / (5 days + header)
      minCellHeight: 32, 
    },

    headStyles: {
      fillColor: [13, 148, 136],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 11,
      minCellHeight: 12,
    },

    columnStyles: {
      0: {
        fontStyle: "bold",
        fillColor: [245, 245, 245],
        cellWidth: 25,
      },
    },

    didParseCell: (data) => {
      // Style the Lunch/Break specifically
      if (data.cell.text.some(t => t.includes("BREAK"))) {
        data.cell.styles.fillColor = [255, 247, 237];
        data.cell.styles.textColor = [234, 88, 12];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  doc.save(`${className}_Full_Landscape_Timetable.pdf`);
};


    // ---------------- RENDER ----------------

    const renderTimetableForClass = (className) => {
        const classTimetable = timetable.filter(t => t.className === className);

        return (
            <div key={`class-${className}`} className="mb-8 p-6 border rounded-xl shadow-md bg-white">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tight">
                        {className} Schedule
                    </h2>
                    <div className="flex gap-2">
                        <button
                            className="bg-gray-100 text-gray-700 text-[10px] font-black uppercase px-4 py-2 rounded-lg hover:bg-gray-200 transition"
                            onClick={() => handleDownloadPDF(className, classTimetable)}
                        >
                            Vertical PDF
                        </button>
                        <button
                            className="bg-teal-600 text-white text-[10px] font-black uppercase px-4 py-2 rounded-lg hover:bg-teal-700 transition shadow-sm"
                            onClick={() => handleDownloadLandscapePDF(className, classTimetable)}
                        >
                            Landscape Grid
                        </button>
                    </div>
                </div>

                {days.map((day, dayIdx) => {
                    const dayPeriods = classTimetable
                        .filter(t => t.day === day)
                        .sort((a, b) => periods.indexOf(a.period) - periods.indexOf(b.period));

                    return (
                        <div key={`day-${className}-${dayIdx}`} className="mb-6 last:mb-0">
                            <h3 className="font-black text-teal-600 text-xs uppercase mb-2 tracking-widest">{day}</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-400 uppercase text-[10px]">
                                            <th className="border p-2 text-left">Period</th>
                                            <th className="border p-2 text-left">Subject</th>
                                            <th className="border p-2 text-left">Teacher</th>
                                            <th className="border p-2 text-left">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dayPeriods.length > 0 ? dayPeriods.map((p, idx) => (
                                            <tr key={idx} className={p.period === "Lunch" ? "bg-orange-50" : ""}>
                                                <td className="border p-2 font-bold text-gray-700">
                                                    {p.period === "Lunch" ? "🍱 LUNCH" : `P${p.period}`}
                                                </td>
                                                <td className="border p-2 font-black text-teal-700">{p.subject || "-"}</td>
                                                <td className="border p-2 text-gray-500 font-medium">{p.teacher}</td>
                                                <td className="border p-2 text-gray-400">{p.time}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="4" className="border p-4 text-center text-gray-300 italic">No periods scheduled</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const classesToDisplay = selectedClass
        ? availableClasses.filter(c => c.className === selectedClass)
        : availableClasses;

    return (
        <div className="p-6 min-h-screen bg-gray-50 font-sans">
            <div className="max-w-5xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-black text-gray-900 uppercase">Class Reports</h1>
                    <p className="text-gray-400 text-sm font-bold uppercase tracking-tighter">Weekly Timetable Generation</p>
                </header>

                <div className="mb-8 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2">Filter by Class</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full md:w-64 border-2 border-gray-100 p-2 rounded-lg bg-gray-50 text-sm font-bold focus:border-teal-500 outline-none transition"
                    >
                        <option value="">📚 All Classes</option>
                        {availableClasses.map((c, idx) => (
                            <option key={idx} value={c.className}>{c.className}</option>
                        ))}
                    </select>
                </div>

                {classesToDisplay.length > 0 ? (
                    classesToDisplay.map(c => renderTimetableForClass(c.className))
                ) : (
                    <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed">
                        <p className="text-gray-300 font-bold uppercase">No data available for display</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WeeklyTimetableReport;