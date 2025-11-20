import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { pupilLoginFetch } from "../Database/PupilLogin";
import { schooldb } from "../Database/SchoolsResults";
import { getDocs, doc, collection, query, where, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation } from "react-router-dom";


// Ensure you have installed these packages:
// npm install jspdf jspdf-autotable

const GeneralReportCard = () => {
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


  // 🧮 Define term-test mapping (CORRECTED)
  // This must match the grade identifiers used in PupilGrades by the TeacherGradesPage
  const termTests = {
    "Term 1": ["Term 1 T1", "Term 1 T2"],
    "Term 2": ["Term 2 T1", "Term 2 T2"],
    "Term 3": ["Term 3 T1", "Term 3 T2"],
  };

  // 🔹 Fetch academic years and classes (unchanged logic)
  useEffect(() => {
    if (!schoolId) return;

    const q = query(
      collection(schooldb, "PupilGrades"),
      where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());

      const years = [...new Set(data.map((d) => d.academicYear))].sort().reverse();
      const classes = [...new Set(data.map((d) => d.className))].sort();

      setAcademicYears(years);
      setAvailableClasses(classes);

      if (years.length > 0) setAcademicYear(years[0]);
      // Only set class if it hasn't been set or if the previously selected class is no longer available
      if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]);
    });

    return () => unsubscribe();
  }, [schoolId]);

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
    if (!academicYear || !selectedClass || !schoolId) return;

    const pupilsRef = query(
      collection(pupilLoginFetch, "PupilsReg"),
      where("academicYear", "==", academicYear),
      where("class", "==", selectedClass),
      where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(pupilsRef, (snapshot) => {
      setTotalPupilsInClass(snapshot.size);
    });

    return () => unsubscribe();
  }, [academicYear, selectedClass, schoolId]);


  // 🔹 Fetch pupils in class/year
  useEffect(() => {
    if (!academicYear || !selectedClass) return;
    
    // 💥 FIX: Reset selected pupil when class changes to prevent looking up old pupil in new class
    setSelectedPupil("");

    const q = query(
      collection(pupilLoginFetch, "PupilsReg"),
      where("schoolId", "==", schoolId),
      where("academicYear", "==", academicYear),
      where("class", "==", selectedClass)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => a.studentName.localeCompare(b.studentName)); // 🔹 Sort alphabetically
    
      setPupils(data);
      
    // Set the first pupil of the new list as the default
      if (data.length > 0) setSelectedPupil(data[0].studentID);
    });
    return () => unsubscribe();
  }, [academicYear, selectedClass, schoolId]);


  // 🔹 Fetch grades for class (unchanged)
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

  // 🔹 Fetch pupil grades (unchanged)
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

  // Use the new test identifiers based on the selected term
  const tests = termTests[selectedTerm];


  // 🔹 Updated useMemo for percentage calculation
  const { subjects, reportRows, totalMarks, overallPercentage, overallRank } = useMemo(() => {
    if (pupilGradesData.length === 0)
      return { subjects: [], reportRows: [], totalMarks: 0, overallPercentage: 0, overallRank: "—" };

    const pupilIDs = [...new Set(classGradesData.map((d) => d.pupilID))];

    // Subjects list
    const uniqueSubjects = [...new Set(pupilGradesData.map((d) => d.subject))].sort();

    // Fetch subjectPercentage for selected class
    const classInfo = classesCache.find(c => c.schoolId === schoolId && c.className === selectedClass);
    const totalSubjectPercentage = classInfo?.subjectPercentage || (uniqueSubjects.length * 100); // fallback

    // Compute mean per subject and rank
    const classMeansBySubject = {};
    for (const subject of uniqueSubjects) {
      const subjectScores = pupilIDs.map((id) => {
        const g = classGradesData.filter(x => x.pupilID === id && x.subject === subject);
        const t1 = g.find(x => x.test === tests[0])?.grade || 0;
        const t2 = g.find(x => x.test === tests[1])?.grade || 0;
        return { id, mean: (Number(t1) + Number(t2)) / 2 };
      });
      subjectScores.sort((a, b) => b.mean - a.mean);
      subjectScores.forEach((x, i) => {
        if (i > 0 && x.mean === subjectScores[i - 1].mean) x.rank = subjectScores[i - 1].rank;
        else x.rank = i + 1;
      });
      classMeansBySubject[subject] = subjectScores;
    }

    // Compute pupil reportRows
    let totalSum = 0;
    const subjectData = uniqueSubjects.map(subject => {
      const t1 = pupilGradesData.find(g => g.subject === subject && g.test === tests[0])?.grade || 0;
      const t2 = pupilGradesData.find(g => g.subject === subject && g.test === tests[1])?.grade || 0;
      const rawMean = (Number(t1) + Number(t2)) / 2;
      totalSum += rawMean;
      const mean = Math.round(rawMean);
      const rank = classMeansBySubject[subject]?.find(s => s.id === selectedPupil)?.rank || "—";
      return { subject, test1: t1, test2: t2, mean, rank };
    });

    // Compute overall rank & percentage using totalSubjectPercentage
    const overallScores = pupilIDs.map(id => {
      const pupilData = classGradesData.filter(x => x.pupilID === id);
      const totalMean = [...new Set(pupilData.map(d => d.subject))].reduce((acc, subject) => {
        const t1 = pupilData.find(x => x.subject === subject && x.test === tests[0])?.grade || 0;
        const t2 = pupilData.find(x => x.subject === subject && x.test === tests[1])?.grade || 0;
        return acc + (Number(t1) + Number(t2)) / 2;
      }, 0);
      return { id, totalMean };
    });

    overallScores.sort((a, b) => b.totalMean - a.totalMean);
    overallScores.forEach((x, i) => {
      if (i > 0 && x.totalMean === overallScores[i - 1].totalMean) x.rank = overallScores[i - 1].rank;
      else x.rank = i + 1;
    });

    const overallRank = overallScores.find(x => x.id === selectedPupil)?.rank || "—";
    const totalMarks = Math.round(totalSum);
    const overallPercentage = totalSubjectPercentage > 0 ? ((totalSum / totalSubjectPercentage) * 100).toFixed(1) : 0;

    return { subjects: uniqueSubjects, reportRows: subjectData, totalMarks, overallPercentage, overallRank };
  }, [pupilGradesData, classGradesData, selectedPupil, selectedTerm, selectedClass, classesCache]);


  const pupilInfo = pupils.find((p) => p.studentID === selectedPupil);

  // GRADE COLOR LOGIC (unchanged)
  const getGradeColor = (val) => {
    const grade = Number(val);
    if (grade >= 50) {
      return "text-blue-600 font-bold";
    } else if (grade <= 49) {
      return "text-red-600 font-bold";
    }
    return "text-gray-900";
  };

  // 🧾 Handle PDF Printing (UNCHANGED logic, but dynamically uses the 'tests' array)
 const handlePrintPDF = () => {
    if (!pupilInfo) return;

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "A4" });

    // Pupil photo
    const pupilPhotoUrl = pupilInfo.userPhotoUrl || "https://via.placeholder.com/96";

    // Helper to load images (unchanged)
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

      // 1. School Name (Centered) (unchanged)
      doc.setFontSize(18).setFont(doc.getFont().fontName, "bold");
      doc.text(schoolName || "Unknown School", doc.internal.pageSize.getWidth() / 2, y, { align: "center" });
      y += 5;

      doc.setDrawColor(63, 81, 181);
      doc.line(40, y, doc.internal.pageSize.getWidth() - 40, y);
      y += 15;

      // 2. School Info & Logos (unchanged)
      if (logo) doc.addImage(logo, "PNG", 40, y, 50, 50);

      doc.setFontSize(10).setFont(doc.getFont().fontName, "normal");
      doc.text(schoolAddress || "Address not found", doc.internal.pageSize.getWidth() / 2, y + 5, { align: "center" });
      doc.text(schoolMotto || "No motto", doc.internal.pageSize.getWidth() / 2, y + 20, { align: "center" });
      doc.text(schoolContact || "No contact info", doc.internal.pageSize.getWidth() / 2, y + 35, { align: "center" });
      if (email) doc.text(email, doc.internal.pageSize.getWidth() / 2, y + 50, { align: "center" });

      const rightX = doc.internal.pageSize.getWidth() - 90;
      if (pupilPhoto) doc.addImage(pupilPhoto, "JPEG", rightX, y, 50, 50);
      else if (logo) doc.addImage(logo, "PNG", rightX, y, 50, 50);

      y += 75;
      
      // ⭐️ CHANGE 2: Add extra vertical space before pupil info starts
      y += 10; 

      // 3. Pupil & Class Info (UPDATED)
      doc.setFontSize(12).setFont(doc.getFont().fontName, "bold");
      
      // First row: Pupil ID and Class with total pupils
      doc.text(`Pupil ID: ${pupilInfo.studentID}`, 40, y);
      
      // ⭐️ CHANGE 1: Combine Class and Total Pupils into one line
      const classText = `Class: ${pupilInfo.class || "N/A"} (${totalPupilsInClass} pupils)`;
      doc.text(classText, doc.internal.pageSize.getWidth() / 2 + 10, y);
      y += 20;

      // Second row: Pupil Name and Academic Year
      doc.text(`Pupil Name: ${pupilInfo.studentName}`, 40, y);
      doc.text(`Academic Year: ${academicYear}`, doc.internal.pageSize.getWidth() / 2 + 10, y);
      y += 25;
      
      // 4. Term Header (unchanged)
      doc.setFontSize(16).setFont(doc.getFont().fontName, "bold");
      doc.text(selectedTerm, doc.internal.pageSize.getWidth() / 2, y, { align: "center" });
      y += 20;

      // 5. Grades Table (unchanged)
      const tableData = reportRows.map((r) => [r.subject, r.test1, r.test2, r.mean, r.rank]);
      
      const pdfHeaders = ["Subject", tests[0].split(' ')[2] || 'T1', tests[1].split(' ')[2] || 'T2', "Mean", "Rank"];

      autoTable(doc, {
        startY: y,
        head: [pdfHeaders],
        body: tableData,
        theme: "striped",
        styles: { halign: "center", fontSize: 10 },
        headStyles: { fillColor: [63, 81, 181], textColor: 255 },
        margin: { left: 40, right: 40 },
        columnStyles: { 0: { halign: "left", cellWidth: 150 } },
        didParseCell: (data) => {
          const gradeColumns = [1, 2, 3];
          const rankColumn = 4;

          if (gradeColumns.includes(data.column.index)) {
            const grade = Number(data.cell.text[0]);
            if (grade >= 50) data.cell.styles.textColor = [0, 0, 255];
            else if (grade <= 49) data.cell.styles.textColor = [255, 0, 0];
            data.cell.styles.fontStyle = "bold";
          }

          if (data.column.index === rankColumn) {
            data.cell.styles.textColor = [255, 0, 0];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      // 6. Footer Summary (unchanged)
      const finalY = doc.lastAutoTable.finalY + 20;
      doc.setFontSize(12).setFont(doc.getFont().fontName, "bold");
      doc.text(`Total Marks: ${totalMarks}`, 40, finalY);
      doc.text(`Percentage: ${overallPercentage}%`, 40, finalY + 15);
      doc.text(`Overall Position: ${overallRank} / ${totalPupilsInClass}`, 40, finalY + 30);

      // Signature (unchanged)
      doc.setFontSize(10).setFont(doc.getFont().fontName, "normal");
      doc.text("________________________", 400, finalY + 20);
      doc.text("Principal's Signature", 400, finalY + 35);

      // Save PDF (unchanged)
      doc.save(`${pupilInfo.studentName}_${selectedTerm}_Report.pdf`);
    });
  };



  // 🧾 UI
  return (
    <div className="max-w-5xl mx-auto p-6 bg-white shadow-xl rounded-2xl">
      <h2 className="text-2xl font-bold text-center text-indigo-700 mb-6">{schoolName}</h2>

      {/* Term selector (unchanged) */}
      <div className="flex justify-center gap-4 mb-6">
        {Object.keys(termTests).map((term) => (
          <button
            key={term}
            onClick={() => setSelectedTerm(term)}
            className={`px-4 py-2 rounded-lg border ${selectedTerm === term ? "bg-indigo-600 text-white" : "bg-gray-100 hover:bg-indigo-100"
              }`}
          >
            {term}
          </button>
        ))}
      </div>

      {/* Filters (unchanged) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-4 border rounded-lg bg-indigo-50">
        <div>
          <label className="font-semibold">Academic Year:</label>
          <select className="w-full border rounded-lg px-3 py-2" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
            {academicYears.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-semibold">Class:</label>
          <select className="w-full border rounded-lg px-3 py-2" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            {availableClasses.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-semibold">Pupil:</label>
          <select className="w-full border rounded-lg px-3 py-2" value={selectedPupil} onChange={(e) => setSelectedPupil(e.target.value)}>
            {pupils.map((p) => (
              <option key={p.studentID} value={p.studentID}>
                {p.studentName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Print Button (unchanged) */}
      <div className="flex justify-end mb-4">
        <button
          onClick={handlePrintPDF}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow disabled:bg-gray-400"
          disabled={loading || reportRows.length === 0}
        >
          Generate PDF Report
        </button>
      </div>

      {/* 🧑‍🎓 Pupil Info (On-screen display) (unchanged) */}
      {pupilInfo && (
        <div className="flex items-center gap-4 mb-6 border p-4 rounded-lg bg-gray-50 shadow-sm">
          {pupilInfo.userPhotoUrl ? (
            <img
              src={pupilInfo.userPhotoUrl}
              alt="Pupil"
              className="w-24 h-24 object-cover rounded-full border-2 border-indigo-500"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "https://via.placeholder.com/96";
              }}
            />
          ) : (
            <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 font-bold">
              No Photo
            </div>
          )}

          <div>
            <p className="text-lg font-semibold text-indigo-800">{pupilInfo.studentName}</p>
            <p className="text-gray-600">
              <span className="font-medium">Class:</span> {pupilInfo.class || "N/A"}{" "}
              <span className="ml-2 text-sm text-gray-500">
                ({totalPupilsInClass} pupils)
              </span>
            </p>

            <p className="text-gray-600">
              <span className="font-medium">Academic Year:</span> {pupilInfo.academicYear || "N/A"}
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Student ID:</span> {pupilInfo.studentID}
            </p>
          </div>
        </div>
      )}

      {/* Table (On-screen display) */}
      {loading ? (
        <div className="text-center text-indigo-600 font-medium p-8 border rounded-lg">Loading report...</div>
      ) : subjects.length > 0 ? (
        <div className="overflow-x-auto border rounded-lg shadow-md">
          <table className="min-w-full text-sm text-center border-collapse">
            <thead className="bg-indigo-600 text-white">
              <tr>
                <th className="px-4 py-2 text-left">Subject</th>
                {/* 💥 UPDATED: Use the last part of the test name for cleaner UI headers */}
                {tests.map((t) => (
                  <th key={t} className="px-4 py-2">
                    {t.split(' ').pop()}
                  </th>
                ))}
                <th className="px-4 py-2">Mn</th>
                <th className="px-4 py-2">Rnk</th>
              </tr>
            </thead>
            <tbody>
              {reportRows.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50 transition">
                  <td className="text-left px-4 py-2 font-semibold">{row.subject}</td>
                  <td className={`px-4 py-2 ${getGradeColor(row.test1)}`}>{row.test1}</td>
                  <td className={`px-4 py-2 ${getGradeColor(row.test2)}`}>{row.test2}</td>
                  <td className={`px-4 py-2 font-bold ${getGradeColor(row.mean)}`}>{row.mean}</td>
                  <td className="px-4 py-2 font-bold text-red-600">{row.rank}</td>
                </tr>
              ))}

              {/* Footer rows (unchanged) */}
              <tr className="bg-indigo-100 font-bold text-indigo-800 border-t-2 border-indigo-600">
                <td className="text-left px-4 py-2 text-base">Combined Scores</td>
                <td colSpan="2"></td>
                <td className="px-4 py-2 text-base">{totalMarks}</td>
                <td>—</td>
              </tr>
              <tr className="bg-indigo-100/70 font-bold text-indigo-800">
                <td className="text-left px-4 py-2 text-base">Percentage</td>
                <td colSpan="2"></td>
                <td className="px-4 py-2 text-base">{overallPercentage}%</td>
                <td>—</td>
              </tr>
              <tr className="bg-indigo-200 font-bold text-indigo-900 border-b-2 border-indigo-600">
                <td className="text-left px-4 py-2 text-base">Position</td>
                <td colSpan="3"></td>
                <td className="text-lg">{overallRank}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center p-6 text-gray-500 border rounded-lg">No grades found for this pupil.</div>
      )}
    </div>

  );
};

export default GeneralReportCard;