import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults";
import { getDocs, doc, collection, query, where, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation } from "react-router-dom";

import { getTermScores, 
    calculateSubjectRanks, 
    calculateSubjectAnnualRanks, 
    calculateOverallMetrics } from "../Utilis/ResultCalculators";

// Ensure you have installed these packages:
// npm install jspdf jspdf-autotable

const ReportCardTermly = () => {
  const [academicYear, setAcademicYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedPupil, setSelectedPupil] = useState("");
  const [pupils, setPupils] = useState([]);
  const [classGradesData, setClassGradesData] = useState([]);
  const [pupilGradesData, setPupilGradesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState("Term 1"); // Start with 'Term 1' for display
  const location = useLocation();
  // 🔹 Fetch Classes Cache for subjectPercentage
  const [classesCache, setClassesCache] = useState([]);
  const [totalPupilsInClass, setTotalPupilsInClass] = useState(0);

  const {
    schoolId,
    schoolName,
    schoolLogoUrl,
    schoolAddress,
    schoolMotto,
    schoolContact,
    email,
  } = location.state || {};

  // 🧮 Define term-test mapping
  const termTests = {
    "Term 1": ["Term 1 T1", "Term 1 T2"],
    "Term 2": ["Term 2 T1", "Term 2 T2"],
    "Term 3": ["Term 3 T1", "Term 3 T2"],
  };

  // 📝 Dynamic Remarks Handler
  const getRemark = (average) => {
    const val = parseFloat(average);
    if (isNaN(val)) return "N/A";
    if (val >= 70) return "Excellent";
    if (val >= 60) return "Very Good";
    if (val >= 50) return "Credit";
    if (val >= 40) return "Pass";
    return "Fail";
  };

  // 🔹 Fetch academic years and classes
  useEffect(() => {
    if (!schoolId) return;

    const q = query(
      collection(schooldb, "PupilGrades"),
      where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());

      const years = [...new Set(data.map((d) => d.academicYear))].sort().reverse();
      const classes = [...new Set(data.map((d) => d.className.trim()))].sort();

      setAcademicYears(years);
      setAvailableClasses(classes);

      if (years.length > 0) setAcademicYear(years[0]);
      if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]);
    });

    return () => unsubscribe();
  }, [schoolId, selectedClass]);

  useEffect(() => {
    if (!schoolId) return;
    const fetchClasses = async () => {
      const snapshot = await getDocs(query(collection(db, "Classes"), where("schoolId", "==", schoolId)));
      const data = snapshot.docs.map(doc => doc.data());
      setClassesCache(data);
    };
    fetchClasses();
  }, [schoolId]);

  // ✅ Count total pupils in selected class and academic year
  useEffect(() => {
    const trimmedClass = selectedClass;

    if (!academicYear || !trimmedClass || !schoolId) {
        setTotalPupilsInClass(0);
        return;
    }

    const pupilsRef = query(
      collection(db, "PupilsReg"),
      where("academicYear", "==", academicYear),
      where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(pupilsRef, (snapshot) => {
      const total = snapshot.docs
        .filter(doc => doc.data().class && doc.data().class.trim() === trimmedClass)
        .length;
      
      setTotalPupilsInClass(total);
    });

    return () => unsubscribe();
  }, [academicYear, selectedClass, schoolId]);

  // 🔹 Fetch pupils in class/year
  useEffect(() => {
    const trimmedClass = selectedClass;

    if (!academicYear || !trimmedClass || !schoolId) {
        setPupils([]);
        return;
    }
    
    setSelectedPupil("");

    const q = query(
      collection(db, "PupilsReg"),
      where("schoolId", "==", schoolId),
      where("academicYear", "==", academicYear),
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allPupilData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const filteredPupils = allPupilData
        .filter(pupil => pupil.class && pupil.class.trim() === trimmedClass)
        .sort((a, b) => a.studentName.localeCompare(b.studentName));
    
      setPupils(filteredPupils);
      
      if (filteredPupils.length > 0) setSelectedPupil(filteredPupils[0].studentID);
    });
    return () => unsubscribe();
  }, [academicYear, selectedClass, schoolId]);

  // 🔹 Fetch grades for class
  useEffect(() => {
    if (!academicYear || !selectedClass) return;
    const q = query(
      collection(schooldb, "PupilGrades"),
      where("academicYear", "==", academicYear),
      where("schoolId", "==", schoolId),
      where("className", "==", selectedClass)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClassGradesData(snapshot.docs.map((doc) => doc.data()));
    });
    return () => unsubscribe();
  }, [academicYear, selectedClass]);

  // 🔹 Fetch pupil grades
  useEffect(() => {
    if (!academicYear || !selectedClass || !selectedPupil) return;
    setLoading(true);
    const q = query(
      collection(schooldb, "PupilGrades"),
      where("academicYear", "==", academicYear),
      where("schoolId", "==", schoolId),
      where("className", "==", selectedClass),
      where("pupilID", "==", selectedPupil)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPupilGradesData(snapshot.docs.map((doc) => doc.data()));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [academicYear, selectedClass, selectedPupil]);

  const tests = termTests[selectedTerm];

  // 🔹 Memoized score statistics
const {
  subjects,
  reportRows,
  totalMarks,
  overallPercentage,
  overallRank,
  annualAverage,
  annualRank,
} = useMemo(() => {
  if (pupilGradesData.length === 0) {
    return {
      subjects: [],
      reportRows: [],
      totalMarks: 0,
      overallPercentage: 0,
      overallRank: "—",
      annualAverage: "0.0",
      annualRank: "—",
    };
  }

  const pupilIDs = [...new Set(classGradesData.map((d) => d.pupilID))];
  const uniqueSubjects = [...new Set(classGradesData.map((d) => d.subject))].sort();

  const classInfo = classesCache.find(
    (c) => c.schoolId === schoolId && c.className === selectedClass
  );

  const totalSubjectPercentage =
    classInfo?.subjectPercentage || uniqueSubjects.length * 100;

  //-----------------------------------------
  // Subject Ranks
  //-----------------------------------------

  const subjectRanks = calculateSubjectRanks(
    classGradesData,
    pupilIDs,
    uniqueSubjects
  );

  //-----------------------------------------
  // Annual Subject Ranks
  //-----------------------------------------

  const annualSubjectRanks = calculateSubjectAnnualRanks(
    classGradesData,
    pupilIDs,
    uniqueSubjects
  );

  //-----------------------------------------
  // Overall Metrics
  //-----------------------------------------

  const metrics = calculateOverallMetrics(
    classGradesData,
    pupilIDs,
    uniqueSubjects,
    selectedPupil,
    totalSubjectPercentage
  );

  //-----------------------------------------
  // Build report rows
  //-----------------------------------------

  const reportRows = uniqueSubjects.map((subject) => {
    const scores = getTermScores(
      classGradesData,
      selectedPupil,
      subject,
      selectedTerm
    );

    return {
      subject,
      test1: scores.t1 ?? "",
      test2: scores.t2 ?? "",
      mean: scores.mean ?? "",
      rank:
        subjectRanks[`${subject}_${selectedTerm}`]?.[selectedPupil] ?? "—",

      annualRank:
        annualSubjectRanks[subject]?.[selectedPupil] ?? "—",
    };
  });

  return {
    subjects: uniqueSubjects,
    reportRows,

    totalMarks:
      metrics.termSummaries[selectedTerm]?.total || 0,

    overallPercentage:
      metrics.termSummaries[selectedTerm]?.percentage || 0,

    overallRank:
      metrics.termSummaries[selectedTerm]?.rank || "—",

    annualAverage: metrics.annualSummary.avg,

    annualRank: metrics.annualSummary.rank,
  };
}, [
  classGradesData,
  pupilGradesData,
  selectedPupil,
  selectedClass,
  selectedTerm,
  classesCache,
  schoolId,
]);

  const pupilInfo = pupils.find((p) => p.studentID === selectedPupil);

  // Grade styling classes
 const getGradeColor = (val) => {
  const grade = Number(val);

  if (isNaN(grade)) return "text-slate-700";

  if (grade >= 50) {
    return "text-blue-600 font-semibold";
  }

  if (grade <= 49) {
    return "text-red-600 font-semibold";
  }

  return "text-slate-700";
};

  // Dynamic label background color for structural matrix column
  const getRemarkBadgeColor = (remark) => {
    if (remark === "Excellent" || remark === "Very Good") return "bg-emerald-50 text-emerald-700";
    if (remark === "Fail") return "bg-rose-50 text-rose-700";
    return "bg-slate-100 text-slate-700";
  };

  // 🧾 Handle PDF Printing with layout corrections
  const handlePrintPDF = () => {
    if (!pupilInfo) return;

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "A4" });
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
      let y = 35;
      const pageWidth = doc.internal.pageSize.getWidth();

      // Top Primary Accents
      doc.setFillColor(79, 70, 229); // indigo-600
      doc.rect(40, y - 5, pageWidth - 80, 4, "F");
      y += 20;

      // School Name
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(schoolName || "Unknown School", pageWidth / 2, y, { align: "center" });
      y += 15;

      // Logo Left & Right
      if (logo) {
        doc.addImage(logo, "PNG", 45, y, 65, 65);
      }

      // School Info block
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-500
      
      const details = [
        schoolAddress || "Address not found",
        schoolMotto ? `"${schoolMotto}"` : null,
        schoolContact ? `Contact: ${schoolContact}` : null,
        email ? `Email: ${email}` : null
      ].filter(Boolean);

      details.forEach((line, index) => {
        doc.text(line, pageWidth / 2, y + (index * 14), { align: "center" });
      });

      // Photo Frame on Right
      const rightX = pageWidth - 110;
      if (pupilPhoto) {
        doc.setFillColor(241, 245, 249);
        doc.rect(rightX - 2, y - 2, 69, 69, "F");
        doc.addImage(pupilPhoto, "JPEG", rightX, y, 65, 65);
      }

      y += 80;

      // Divider line
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.setLineWidth(1);
      doc.line(40, y, pageWidth - 40, y);
      y += 20;

      // Academic Details Header Box
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(40, y, pageWidth - 80, 48, "F");
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.rect(40, y, pageWidth - 80, 48, "S");

      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "bold");
      
      // Box Left Column
      doc.text("PUPIL NAME:", 55, y + 18);
      doc.text("STUDENT ID:", 55, y + 36);
      
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(pupilInfo.studentName.toUpperCase(), 140, y + 18);
      doc.text(pupilInfo.studentID, 140, y + 36);

      // Box Right Column
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("CLASS / YEAR:", pageWidth / 2 + 30, y + 18);
      doc.text("TERM / CYCLE:", pageWidth / 2 + 30, y + 36);

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(`${pupilInfo.class || "N/A"} (${totalPupilsInClass} pupils) | ${academicYear}`, pageWidth / 2 + 130, y + 18);
      doc.text(selectedTerm, pageWidth / 2 + 130, y + 36);

      y += 75;

      // Grades Table Data Construction with additional Subject Remark column
      const tableData = reportRows.map((r) => [r.subject, r.test1, r.test2, r.mean, r.rank, getRemark(r.mean)]);
      const pdfHeaders = ["Subject Structure", tests[0].split(' ')[2] || 'T1', tests[1].split(' ')[2] || 'T2', "Mean", "Rank", "Remark"];

      autoTable(doc, {
        startY: y,
        head: [pdfHeaders],
        body: tableData,
        theme: "striped",
        styles: { halign: "center", fontSize: 9.5, font: "Helvetica" },
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
        margin: { left: 40, right: 40 },
        columnStyles: { 
          0: { halign: "left", fontStyle: "bold", cellWidth: 150 },
          5: { halign: "center", fontStyle: "bold", cellWidth: 80 }
        },
        didParseCell: (data) => {
          const gradeColumns = [1, 2, 3];
          const rankColumn = 4;
          const remarkColumn = 5;

          if (gradeColumns.includes(data.column.index) && data.cell.section === "body") {
            const grade = Number(data.cell.text[0]);
           if (grade >= 50) {
  data.cell.styles.textColor = [37, 99, 235]; // blue-600
} 
else if (grade <= 49) {
  data.cell.styles.textColor = [244, 63, 94]; // red/rose-500
}

data.cell.styles.fontStyle = "bold";
          }

          if (data.column.index === rankColumn && data.cell.section === "body") {
            data.cell.styles.textColor = [244, 63, 94];
            data.cell.styles.fontStyle = "bold";
          }

          if (data.column.index === remarkColumn && data.cell.section === "body") {
            const remarkText = data.cell.text[0];
            if (remarkText === "Excellent" || remarkText === "Very Good") {
              data.cell.styles.textColor = [16, 185, 129];
            } else if (remarkText === "Fail") {
              data.cell.styles.textColor = [244, 63, 94];
            } else {
              data.cell.styles.textColor = [71, 85, 105];
            }
          }
        },
      });

      let currentY = doc.lastAutoTable.finalY + 20;

      // Dual Column Layout for summary metrics & performance indices
      doc.setFillColor(248, 250, 252);
      doc.rect(40, currentY, pageWidth / 2 - 50, 95, "F");
      doc.rect(40, currentY, pageWidth / 2 - 50, 95, "S");

      // Left Box details (Academic Summary)
      doc.setTextColor(79, 70, 229);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.text("ACADEMIC PERFORMANCE SUMMARY", 50, currentY + 18);
      
      doc.setTextColor(30, 41, 59);
      doc.setFont("Helvetica", "normal");
      doc.text(`Total Aggregated Marks:`, 50, currentY + 38);
      doc.text(`Average Percentage:`, 50, currentY + 54);
      doc.text(`Overall Class Position:`, 50, currentY + 70);
      doc.text(`Academic Remark:`, 50, currentY + 86);

      doc.setFont("Helvetica", "bold");
      doc.setTextColor(79, 70, 229);
      doc.text(`${totalMarks}`, pageWidth / 2 - 45, currentY + 38, { align: "right" });
      doc.text(`${overallPercentage}%`, pageWidth / 2 - 45, currentY + 54, { align: "right" });
      doc.text(`${overallRank}`, pageWidth / 2 - 45, currentY + 70, { align: "right" });
      
      const printedRemark = getRemark(overallPercentage);
      if (printedRemark === "Excellent" || printedRemark === "Very Good") {
        doc.setTextColor(16, 185, 129);
      } else if (printedRemark === "Fail") {
        doc.setTextColor(244, 63, 94);
      } else {
        doc.setTextColor(30, 41, 59);
      }
      doc.text(printedRemark, pageWidth / 2 - 45, currentY + 86, { align: "right" });

      // Right Box details (Attendance summary fields)
      const rightBoxX = pageWidth / 2 + 10;
      doc.setFillColor(248, 250, 252);
      doc.rect(rightBoxX, currentY, pageWidth / 2 - 50, 95, "F");
      doc.rect(rightBoxX, currentY, pageWidth / 2 - 50, 95, "S");

      doc.setTextColor(79, 70, 229);
      doc.setFont("Helvetica", "bold");
      doc.text("ATTENDANCE METRICS", rightBoxX + 10, currentY + 18);

      doc.setTextColor(30, 41, 59);
      doc.setFont("Helvetica", "normal");
      doc.text("Scheduled Days:", rightBoxX + 10, currentY + 38);
      doc.text("Days Present:", rightBoxX + 10, currentY + 54);
      doc.text("Days Absent:", rightBoxX + 10, currentY + 70);
      doc.text("Days Late:", rightBoxX + 10, currentY + 86);

      // Drawing empty underscore placeholders for manual entry
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.line(pageWidth - 90, currentY + 38, pageWidth - 50, currentY + 38);
      doc.line(pageWidth - 90, currentY + 54, pageWidth - 50, currentY + 54);
      doc.line(pageWidth - 90, currentY + 70, pageWidth - 50, currentY + 70);
      doc.line(pageWidth - 90, currentY + 86, pageWidth - 50, currentY + 86);

      currentY += 120;

      // Mock Comments section
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(100, 116, 139);
      doc.text("TEACHER & PRINCIPAL REVIEWS", 40, currentY);
      currentY += 20;

      for (let i = 0; i < 2; i++) {
        doc.setLineWidth(0.5);
        doc.setDrawColor(203, 213, 225);
        doc.line(40, currentY + (i * 20), pageWidth - 40, currentY + (i * 20));
      }

      currentY += 55;

      // Principal's Signature space
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.setFont("Helvetica", "normal");
      doc.text("_________________________________", pageWidth - 190, currentY);
      doc.text("Class Teacher / Principal's Stamp", pageWidth - 190, currentY + 15);

      // Save PDF
      doc.save(`${pupilInfo.studentName}_${selectedTerm}_Report.pdf`);
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen">
      {/* Settings Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="h-6 w-1.5 bg-indigo-600 rounded-full inline-block"></span>
          Report Card Generator ({schoolName || "Administrative Center"})
        </h2>

        {/* Term Selectors */}
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl max-w-md mb-6">
          {Object.keys(termTests).map((term) => (
            <button
              key={term}
              onClick={() => setSelectedTerm(term)}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                selectedTerm === term
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {term}
            </button>
          ))}
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Academic Year</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
              {academicYears.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Selected Class</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              {availableClasses.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Pupil Profile</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={selectedPupil} onChange={(e) => setSelectedPupil(e.target.value)}>
              {pupils.map((p) => (
                <option key={p.studentID} value={p.studentID}>
                  {p.studentName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end mt-6 border-t border-slate-100 pt-4">
          <button
            onClick={handlePrintPDF}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:bg-slate-300"
            disabled={loading || reportRows.length === 0}
          >
            Export Mock Report Card (PDF)
          </button>
        </div>
      </div>

      {/* Actual Mock Report Card View Interface */}
      {pupilInfo && (
        <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 p-6 md:p-10 relative overflow-hidden">
          {/* Top colored aesthetic bar */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600"></div>

          {/* Report Card Brand Header */}
          <div className="flex flex-col md:flex-row justify-between items-center md:items-start border-b border-slate-100 pb-6 mb-6 gap-6">
            <div className="flex items-center gap-4">
              {schoolLogoUrl ? (
                <img src={schoolLogoUrl} alt="Logo" className="w-16 h-16 object-contain" />
              ) : (
                <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs">No Logo</div>
              )}
              <div>
                <h3 className="text-2xl font-bold text-slate-800">{schoolName || "Unknown Institution"}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{schoolAddress || "Academic Address"}</p>
                {schoolMotto && <p className="text-xs italic text-slate-400 mt-1">"{schoolMotto}"</p>}
              </div>
            </div>

            {/* Profile Frame */}
            <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
              {pupilInfo.userPhotoUrl ? (
                <img
                  src={pupilInfo.userPhotoUrl}
                  alt="Pupil Portrait"
                  className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "https://via.placeholder.com/96";
                  }}
                />
              ) : (
                <div className="w-16 h-16 bg-slate-200 rounded-lg flex items-center justify-center text-slate-500 font-bold text-xs">
                  Photo
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">Cardholder</p>
                <p className="text-sm font-bold text-slate-800">{pupilInfo.studentName}</p>
                <p className="text-xs text-slate-500">ID: {pupilInfo.studentID}</p>
              </div>
            </div>
          </div>

          {/* Academic Profile Board */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 mb-8">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Class Stream</span>
              <span className="text-sm font-semibold text-slate-700">{pupilInfo.class || "N/A"}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Class Demographics</span>
              <span className="text-sm font-semibold text-slate-700">{totalPupilsInClass} Pupils</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Calendar Block</span>
              <span className="text-sm font-semibold text-slate-700">{academicYear}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Assessment Term</span>
              <span className="text-sm font-semibold text-indigo-600">{selectedTerm}</span>
            </div>
          </div>

          {/* Main Grade Matrix */}
          {loading ? (
            <div className="text-center text-indigo-600 font-medium py-12">Fetching grade data registry...</div>
          ) : reportRows.length > 0 ? (
            <div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl mb-6 shadow-sm">
                <table className="min-w-full text-sm text-center border-collapse">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium tracking-wider">Subject Detail</th>
                      {tests.map((t) => (
                        <th key={t} className="px-6 py-3 font-medium tracking-wider">
                          {t.split(' ').pop()}
                        </th>
                      ))}
                      <th className="px-6 py-3 font-medium tracking-wider">Mean</th>
                      <th className="px-6 py-3 font-medium tracking-wider">Rank</th>
                      <th className="px-6 py-3 font-medium tracking-wider">Remark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {reportRows.map((row, idx) => {
                      const subjectRemark = getRemark(row.mean);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition">
                          <td className="text-left px-6 py-3.5 font-semibold text-slate-700">{row.subject}</td>
                          <td className={`px-6 py-3.5 ${getGradeColor(row.test1)}`}>{row.test1}</td>
                          <td className={`px-6 py-3.5 ${getGradeColor(row.test2)}`}>{row.test2}</td>
                          <td className={`px-6 py-3.5 font-bold ${getGradeColor(row.mean)}`}>{row.mean}</td>
                          <td className="px-6 py-3.5 font-bold text-rose-500">{row.rank}</td>
                          <td className="px-6 py-3.5 font-medium">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${getRemarkBadgeColor(subjectRemark)}`}>
                              {subjectRemark}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom statistics and placeholders in columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                {/* Academic Scores Summary Column */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <h4 className="text-xs font-bold text-indigo-600 tracking-wider uppercase mb-3">Academic Index Records</h4>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-sm border-b border-slate-200/60 pb-2">
                      <span className="text-slate-500">Cumulative Weighted Total:</span>
                      <span className="font-bold text-slate-800">{totalMarks} Marks</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-200/60 pb-2">
                      <span className="text-slate-500">Weighted Average Percentage:</span>
                      <span className="font-bold text-emerald-600">{overallPercentage}%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-200/60 pb-2">
                      <span className="text-slate-500">Class Standing Position:</span>
                      <span className="font-extrabold text-indigo-600 text-base">{overallRank}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-0.5">
                      <span className="text-slate-500">Academic Remark:</span>
                      <span className={`font-bold uppercase tracking-wide text-xs px-2.5 py-0.5 rounded-full ${getRemarkBadgeColor(getRemark(overallPercentage))}`}>
                        {getRemark(overallPercentage)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Simulated Attendance Fields */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <h4 className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-3">Institutional Attendance Tracker</h4>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center text-sm border-b border-slate-200/60 pb-2">
                      <span className="text-slate-500">Active Days Prescheduled:</span>
                      <span className="text-slate-400 italic font-mono text-xs">[Write-in Box]</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-200/60 pb-2">
                      <span className="text-slate-500">Days Present:</span>
                      <span className="text-slate-400 italic font-mono text-xs">[Write-in Box]</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Absences Marked:</span>
                      <span className="text-slate-400 italic font-mono text-xs">[Write-in Box]</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Late Marked:</span>
                      <span className="text-slate-400 italic font-mono text-xs">[Write-in Box]</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No grades registered under this pupil's identifier.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportCardTermly;