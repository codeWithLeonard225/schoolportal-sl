import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults";
import { getDocs, collection, query, where, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation } from "react-router-dom";

const AnnualBroadSheet = () => {
  const [academicYear, setAcademicYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedPupil, setSelectedPupil] = useState("");
  const [pupils, setPupils] = useState([]);
  const [classGradesData, setClassGradesData] = useState([]);
  const [loading, setLoading] = useState(false);

  const location = useLocation();
  const {
    schoolId,
    schoolName,
    schoolLogoUrl,
    schoolAddress,
    schoolMotto,
    schoolContact,
    email,
  } = location.state || {};

  // 1. Fetch Metadata
 // 1. Fetch Metadata
useEffect(() => {
  if (!schoolId) return;
  const q = query(collection(schooldb, "PupilGrades"), where("schoolId", "==", schoolId));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((doc) => doc.data());
    const years = [...new Set(data.map((d) => d.academicYear))].sort().reverse();
    const classes = [...new Set(data.map((d) => d.className?.trim()))].filter(Boolean).sort();
    
    setAcademicYears(years);
    setAvailableClasses(classes);

    // Reset selection if current selection is invalid
    if (years.length > 0 && (!academicYear || !years.includes(academicYear))) {
      setAcademicYear(years[0]);
    }
    if (classes.length > 0 && (!selectedClass || !classes.includes(selectedClass))) {
      setSelectedClass(classes[0]);
    }
  });
  return () => unsubscribe();
}, [schoolId]);

  // 2. Fetch Pupils
 useEffect(() => {
  if (!academicYear || !selectedClass || !schoolId) return;

  const q = query(
    collection(db, "PupilsReg"),
    where("schoolId", "==", schoolId),
    where("academicYear", "==", academicYear)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const filtered = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(p => p.class && p.class.trim() === selectedClass)
      .sort((a, b) => a.studentName.localeCompare(b.studentName));

    setPupils(filtered);

    // ✅ FIX: Always reset selected pupil when class changes
    if (filtered.length > 0) {
      setSelectedPupil(filtered[0].studentID);
    } else {
      setSelectedPupil(""); // important fallback
    }
  });

  return () => unsubscribe();
}, [academicYear, selectedClass, schoolId]);

  // 3. Fetch Grades
  useEffect(() => {
    if (!academicYear || !selectedClass) return;
    setLoading(true);
    const q = query(collection(schooldb, "PupilGrades"), where("academicYear", "==", academicYear), where("schoolId", "==", schoolId), where("className", "==", selectedClass));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClassGradesData(snapshot.docs.map(doc => doc.data()));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [academicYear, selectedClass]);

  // 4. Main Calculation Engine
  const annualData = useMemo(() => {
    if (classGradesData.length === 0 || pupils.length === 0) return { rows: [], footers: {} };

    const subjects = [...new Set(classGradesData.map(d => d.subject))].sort();
    const studentIDs = pupils.map(p => p.studentID);

    const getScore = (pId, sub, test) => 
      Number(classGradesData.find(g => g.pupilID === pId && g.subject === sub && g.test === test)?.grade || 0);

    const getSubjectTermRankMap = (sub, termPrefix) => {
      const scores = studentIDs.map(id => {
        const m = (getScore(id, sub, `${termPrefix} T1`) + getScore(id, sub, `${termPrefix} T2`)) / 2;
        return { id, mean: Math.round(m) };
      }).sort((a, b) => b.mean - a.mean);

      const ranks = {};
      scores.forEach((s, idx) => {
        if (idx > 0 && s.mean === scores[idx - 1].mean) ranks[s.id] = ranks[scores[idx - 1].id];
        else ranks[s.id] = idx + 1;
      });
      return ranks;
    };

    const termRanks = {
      t1: subjects.reduce((acc, sub) => ({ ...acc, [sub]: getSubjectTermRankMap(sub, "Term 1") }), {}),
      t2: subjects.reduce((acc, sub) => ({ ...acc, [sub]: getSubjectTermRankMap(sub, "Term 2") }), {}),
      t3: subjects.reduce((acc, sub) => ({ ...acc, [sub]: getSubjectTermRankMap(sub, "Term 3") }), {}),
    };

    const subjectYearlyRanks = {};
    subjects.forEach(sub => {
      const subjectScores = studentIDs.map(id => {
        const m1 = Math.round((getScore(id, sub, "Term 1 T1") + getScore(id, sub, "Term 1 T2")) / 2);
        const m2 = Math.round((getScore(id, sub, "Term 2 T1") + getScore(id, sub, "Term 2 T2")) / 2);
        const m3 = Math.round((getScore(id, sub, "Term 3 T1") + getScore(id, sub, "Term 3 T2")) / 2);
        return { id, yearlyMean: Math.round((m1 + m2 + m3) / 3) };
      }).sort((a, b) => b.yearlyMean - a.yearlyMean);

      subjectScores.forEach((s, idx) => {
        if (idx > 0 && s.yearlyMean === subjectScores[idx - 1].yearlyMean) s.pos = subjectScores[idx - 1].pos;
        else s.pos = idx + 1;
      });
      subjectYearlyRanks[sub] = subjectScores;
    });

    const allStudentsStats = studentIDs.map(id => {
      let t1 = 0, t2 = 0, t3 = 0;
      subjects.forEach(sub => {
        t1 += Math.round((getScore(id, sub, "Term 1 T1") + getScore(id, sub, "Term 1 T2")) / 2);
        t2 += Math.round((getScore(id, sub, "Term 2 T1") + getScore(id, sub, "Term 2 T2")) / 2);
        t3 += Math.round((getScore(id, sub, "Term 3 T1") + getScore(id, sub, "Term 3 T2")) / 2);
      });
      return { id, t1, t2, t3, annual: Math.round((t1 + t2 + t3) / 3) };
    });

    const activePupilStats = allStudentsStats.find(s => s.id === selectedPupil) || { t1: 0, t2: 0, t3: 0, annual: 0 };

    const footers = {
      totals: { t1: activePupilStats.t1, t2: activePupilStats.t2, t3: activePupilStats.t3, ann: activePupilStats.annual },
      percents: {
        t1: subjects.length ? Math.round(activePupilStats.t1 / subjects.length) : 0,
        t2: subjects.length ? Math.round(activePupilStats.t2 / subjects.length) : 0,
        t3: subjects.length ? Math.round(activePupilStats.t3 / subjects.length) : 0,
        ann: subjects.length ? Math.round(activePupilStats.annual / subjects.length) : 0
      },
      ranks: {
        t1: [...allStudentsStats].sort((a,b)=>b.t1-a.t1).findIndex(s=>s.id === selectedPupil)+1,
        t2: [...allStudentsStats].sort((a,b)=>b.t2-a.t2).findIndex(s=>s.id === selectedPupil)+1,
        t3: [...allStudentsStats].sort((a,b)=>b.t3-a.t3).findIndex(s=>s.id === selectedPupil)+1,
        ann: [...allStudentsStats].sort((a,b)=>b.annual-a.annual).findIndex(s=>s.id === selectedPupil)+1
      }
    };

    const rows = subjects.map(sub => {
      const g = (t) => getScore(selectedPupil, sub, t);
      const m1 = Math.round((g("Term 1 T1") + g("Term 1 T2")) / 2);
      const m2 = Math.round((g("Term 2 T1") + g("Term 2 T2")) / 2);
      const m3 = Math.round((g("Term 3 T1") + g("Term 3 T2")) / 2);
      
      return { 
        sub, 
        t1_1: g("Term 1 T1"), t1_2: g("Term 1 T2"), m1, r1: termRanks.t1[sub][selectedPupil],
        t2_1: g("Term 2 T1"), t2_2: g("Term 2 T2"), m2, r2: termRanks.t2[sub][selectedPupil],
        t3_1: g("Term 3 T1"), t3_2: g("Term 3 T2"), m3, r3: termRanks.t3[sub][selectedPupil],
        ann: Math.round((m1 + m2 + m3) / 3), 
        annRank: subjectYearlyRanks[sub].find(s => s.id === selectedPupil)?.pos || "-" 
      };
    });

    return { rows, footers };
  }, [classGradesData, selectedPupil, pupils]);

  const pupilInfo = pupils.find(p => p.studentID === selectedPupil);

// 5. PDF Generator Updated
// 5. PDF Generator Updated with Far-Left and Far-Right alignment
const handlePrintPDF = () => {
  if (!pupilInfo) return;

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "A4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40; // Consistent margin for both sides
  const rightBoundary = pageWidth - margin;

  const pupilPhotoUrl = pupilInfo.userPhotoUrl || "https://via.placeholder.com/96";

  const loadImage = (url) =>
    new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });

  Promise.all([loadImage(schoolLogoUrl), loadImage(pupilPhotoUrl)]).then(([logo, pupilPhoto]) => {
    let y = 30;

    // --- SCHOOL HEADER ---
    doc.setFontSize(18).setFont(undefined, "bold");
    doc.text(schoolName || "SCHOOL NAME", pageWidth / 2, y, { align: "center" });
    y += 5;

    doc.setDrawColor(63, 81, 181);
    doc.line(margin, y, rightBoundary, y);
    y += 15;

    if (logo) {
      doc.addImage(logo, "PNG", margin, y, 50, 50);
      // Removed the duplicate right logo to leave space for Pupil Photo
    }

    doc.setFontSize(10).setFont(undefined, "normal");
    doc.text(schoolAddress || "Address not found", pageWidth / 2, y + 5, { align: "center" });
    doc.text(schoolMotto || "No motto", pageWidth / 2, y + 20, { align: "center" });
    doc.text(schoolContact || "No contact", pageWidth / 2, y + 35, { align: "center" });
    if (email) doc.text(email, pageWidth / 2, y + 50, { align: "center" });

    if (pupilPhoto) {
      doc.addImage(pupilPhoto, "JPEG", rightBoundary - 50, y, 50, 50);
    }

    y += 85;

    // --- TITLE ---
    doc.setFontSize(14).setFont(undefined, "bold");
    doc.text("ANNUAL PROGRESS BROAD SHEET", pageWidth / 2, y, { align: "center" });
    y += 30;

    // --- PUPIL INFO (Far-Left & Far-Right Alignment) ---
    doc.setFontSize(11).setFont(undefined, "bold");
    
    // Line 1: ID on Left, Class on Right
    doc.text(`Pupil ID: ${pupilInfo.studentID}`, margin, y);
    doc.text(`Class: ${selectedClass}`, rightBoundary, y, { align: "right" });
    
    y += 20;
    
    // Line 2: Name on Left, Year on Right
    doc.text(`Pupil Name: ${pupilInfo.studentName}`, margin, y);
    doc.text(`Academic Year: ${academicYear}`, rightBoundary, y, { align: "right" });
    
    y += 25;

    // --- TABLE GENERATION ---
    const headGroup = [
      [
        { content: 'SUBJECTS', rowSpan: 2 },
        { content: 'TERM 1', colSpan: 4 },
        { content: 'TERM 2', colSpan: 4 },
        { content: 'TERM 3', colSpan: 4 },
        { content: 'YEARLY PROGRESS', colSpan: 2 }
      ],
      [
        "T1","T2","Mn","Rk",
        "T1","T2","Mn","Rk",
        "T1","T2","Mn","Rk",
        "Mean", "Rnk"
      ]
    ];

    const body = annualData.rows.map(r => [
      r.sub,
      r.t1_1, r.t1_2, r.m1, r.r1,
      r.t2_1, r.t2_2, r.m2, r.r2,
      r.t3_1, r.t3_2, r.m3, r.r3,
      r.ann, r.annRank
    ]);

    const foot = [
      [
        "TOTALS",
        { content: annualData.footers.totals.t1, colSpan: 4 },
        { content: annualData.footers.totals.t2, colSpan: 4 },
        { content: annualData.footers.totals.t3, colSpan: 4 },
        { content: annualData.footers.totals.ann, colSpan: 2 }
      ],
      [
        "PERCENTAGE",
        { content: `${annualData.footers.percents.t1}%`, colSpan: 4 },
        { content: `${annualData.footers.percents.t2}%`, colSpan: 4 },
        { content: `${annualData.footers.percents.t3}%`, colSpan: 4 },
        { content: `${annualData.footers.percents.ann}%`, colSpan: 2 }
      ],
      [
        "CLASS RANK",
        { content: annualData.footers.ranks.t1, colSpan: 4 },
        { content: annualData.footers.ranks.t2, colSpan: 4 },
        { content: annualData.footers.ranks.t3, colSpan: 4 },
        { content: annualData.footers.ranks.ann, colSpan: 2 }
      ]
    ];

     autoTable(doc, {
      startY: y,
      head: headGroup,
      body: body,
      foot: foot,
      theme: "grid",
      styles: { 
        fontSize: 8.5, // Increased from 7 for better readability
        halign: "center", 
        cellPadding: 4, // Added more padding for spacing
        fontStyle: 'bold' 
      },
      headStyles: { 
        fillColor: [30, 41, 59], 
        textColor: [255, 255, 255],
        fontSize: 9
      },
      footStyles: { 
        fillColor: [241, 245, 249], 
        textColor: [0, 0, 0], 
        fontSize: 9,
        fontStyle: 'bold' 
      },
      columnStyles: { 
        0: { halign: "left", cellWidth: 120 } // Wider subject column
      },
      didParseCell: function (data) {
        const scoreCols = [1, 2, 3, 5, 6, 7, 9, 10, 11, 13]; 
        const rankCols = [4, 8, 12, 14];

        if (data.section === 'body') {
          if (scoreCols.includes(data.column.index)) {
            const val = parseFloat(data.cell.raw);
            if (!isNaN(val)) {
              data.cell.styles.textColor = val < 50 ? [220, 38, 38] : [37, 99, 235];
            }
          }
          if (rankCols.includes(data.column.index)) {
            data.cell.styles.textColor = [220, 38, 38];
          }
        }
      }
    });

    // --- SIGNATURES ---
    let finalY = doc.lastAutoTable.finalY + 50;
    doc.setFontSize(10).setFont(undefined, "normal");
    
    // ================= TERM SUMMARY TABLE =================
    const termSummary = [
      ["No. of Sessions", "", "", ""],
      ["On Time", "", "", ""],
      ["Late", "", "", ""],
      ["Absent", "", "", ""],
      ["Term Comments", "", "", ""],
      ["Class Teacher Signature", "", "", ""],
      ["Principal Signature", "", "", ""],
    ];

    autoTable(doc, {
      startY: finalY,
      head: [["ITEM", "TERM 1", "TERM 2", "TERM 3"]],
      body: termSummary,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 4,
        valign: "middle"
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: 255,
        halign: "center"
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 180 },
        1: { halign: "center", cellWidth: 115 },
        2: { halign: "center", cellWidth: 115 },
        3: { halign: "center", cellWidth: 115 },
      },
    didParseCell: function (data) {

  // Make signature rows bold
  if (data.row.index >= 5) {
    data.cell.styles.fontStyle = "bold";
  }

//  const normalRows = [0, 1, 2, 3, 5, 6];

// if (normalRows.includes(data.row.index)) {
//   data.cell.styles.minCellHeight = 30;
// }
  // ✅ Increase height for "Term Comments" row (row index 4)
  if (data.row.index === 4) {
    data.cell.styles.minCellHeight = 30; // 🔥 increase height
  }

}
    });

    

    doc.save(`${pupilInfo.studentName}_Annual_Report.pdf`);
  });
};
  const ScoreCell = ({ val }) => (
    <td className={`p-1 border-r font-bold ${val < 50 ? 'text-red-600' : 'text-blue-600'}`}>
      {val}
    </td>
  );

  return (
    <div className="p-4 bg-slate-100 min-h-screen">
      <div className="max-w-[1550px] mx-auto bg-white shadow-2xl rounded-3xl p-6">
        
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-slate-900 p-6 rounded-2xl text-white">
          <h2 className="text-xl font-bold uppercase">Annual BroadSheet Portal</h2>
          <div className="flex gap-3">
            <select className="text-black p-2 rounded-lg text-sm" value={academicYear} onChange={e => setAcademicYear(e.target.value)}>{academicYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
            <select className="text-black p-2 rounded-lg text-sm" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>{availableClasses.map(c => <option key={c} value={c}>{c}</option>)}</select>
            <select className="text-black p-2 rounded-lg font-bold text-sm" value={selectedPupil} onChange={e => setSelectedPupil(e.target.value)}>{pupils.map(p => <option key={p.studentID} value={p.studentID}>{p.studentName}</option>)}</select>
          </div>
        </div>

        {loading ? (
          <div className="text-center p-20 text-indigo-600 font-bold animate-pulse">Ranking Students...</div>
        ) : annualData.rows.length > 0 ? (
          <div>
            <div className="flex justify-between items-center mb-6 px-2">
              <div>
                <h1 className="text-3xl font-black text-slate-800">{pupilInfo?.studentName}</h1>
                <p className="text-indigo-600 font-bold uppercase text-sm">{selectedClass} | {academicYear}</p>
              </div>
              <button onClick={handlePrintPDF} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all">GENERATE REPORT</button>
            </div>

            <div className="overflow-x-auto border-2 rounded-2xl shadow-sm">
              <table className="w-full text-center border-collapse text-xs">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th rowSpan="2" className="p-3 text-left border-r min-w-[160px]">SUBJECTS</th>
                    <th colSpan="4" className="p-2 border-b border-r bg-indigo-900/40">TERM 1</th>
                    <th colSpan="4" className="p-2 border-b border-r bg-blue-900/40">TERM 2</th>
                    <th colSpan="4" className="p-2 border-b border-r bg-cyan-900/40">TERM 3</th>
                    <th colSpan="2" className="p-2 bg-emerald-800">YEARLY PROGRESS</th>
                  </tr>
                  <tr className="bg-slate-700 text-[9px] uppercase tracking-tighter">
                    <th className="p-2 border-r">T1</th><th className="p-2 border-r">T2</th><th className="p-2 border-r">Mn</th><th className="p-2 border-r text-red-400">Rk</th>
                    <th className="p-2 border-r">T1</th><th className="p-2 border-r">T2</th><th className="p-2 border-r">Mn</th><th className="p-2 border-r text-red-400">Rk</th>
                    <th className="p-2 border-r">T1</th><th className="p-2 border-r">T2</th><th className="p-2 border-r">Mn</th><th className="p-2 border-r text-red-400">Rk</th>
                    <th className="p-2 border-r bg-emerald-700">Mean</th><th className="p-2 bg-emerald-900">Rnk</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium text-slate-600">
                  {annualData.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-indigo-50 transition-colors">
                      <td className="p-2 text-left font-bold border-r bg-slate-50 text-slate-900">{r.sub}</td>
                      <ScoreCell val={r.t1_1} /><ScoreCell val={r.t1_2} />
                      <td className="p-1 border-r font-bold bg-indigo-50/30">{r.m1}</td><td className="p-1 border-r text-red-600 font-bold">{r.r1}</td>
                      <ScoreCell val={r.t2_1} /><ScoreCell val={r.t2_2} />
                      <td className="p-1 border-r font-bold bg-blue-50/30">{r.m2}</td><td className="p-1 border-r text-red-600 font-bold">{r.r2}</td>
                      <ScoreCell val={r.t3_1} /><ScoreCell val={r.t3_2} />
                      <td className="p-1 border-r font-bold bg-cyan-50/30">{r.m3}</td><td className="p-1 border-r text-red-600 font-bold">{r.r3}</td>
                      <td className="p-2 bg-emerald-50 font-black text-emerald-800 text-sm border-r">{r.ann}</td>
                      <td className="p-2 bg-red-50 font-black text-red-600 text-sm">{r.annRank}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 border-t-4 border-slate-800 font-bold">
                  <tr>
                    <td className="p-3 text-right text-slate-500 uppercase">Totals</td>
                    <td colSpan="4" className="border-r text-indigo-800">{annualData.footers.totals.t1}</td>
                    <td colSpan="4" className="border-r text-blue-800">{annualData.footers.totals.t2}</td>
                    <td colSpan="4" className="border-r text-cyan-800">{annualData.footers.totals.t3}</td>
                    <td colSpan="2" className="bg-emerald-100 text-emerald-900 text-lg">{annualData.footers.totals.ann}</td>
                  </tr>
                  <tr>
                    <td className="p-3 text-right text-slate-500">PERCENTAGE:</td>
                    <td colSpan="4" className="border-r">{annualData.footers.percents.t1}%</td>
                    <td colSpan="4" className="border-r">{annualData.footers.percents.t2}%</td>
                    <td colSpan="4" className="border-r">{annualData.footers.percents.t3}%</td>
                    <td colSpan="2" className="bg-emerald-100">{annualData.footers.percents.ann}%</td>
                  </tr>
                  <tr className="bg-slate-900 text-white">
                    <td className="p-4 text-right text-indigo-300 tracking-widest uppercase">Class Rank</td>
                    <td colSpan="4" className="border-r text-xl text-yellow-400">{annualData.footers.ranks.t1}</td>
                    <td colSpan="4" className="border-r text-xl text-yellow-400">{annualData.footers.ranks.t2}</td>
                    <td colSpan="4" className="border-r text-xl text-yellow-400">{annualData.footers.ranks.t3}</td>
                    <td colSpan="2" className="bg-red-700 text-2xl font-black">Rank: {annualData.footers.ranks.ann}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-slate-400 font-bold border-4 border-dashed rounded-3xl uppercase tracking-widest">Select criteria to fetch data.</div>
        )}
      </div>
    </div>
  );
};

export default AnnualBroadSheet;