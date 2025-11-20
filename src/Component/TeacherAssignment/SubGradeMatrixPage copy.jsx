import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Define the component
const SubGradeMatrixPage = () => {
  const location = useLocation();
  const schoolId = location.state?.schoolId || "N/A";

  // 1. STATE MANAGEMENT
  const [academicYear, setAcademicYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [availableClasses, setAvailableClasses] = useState([]);
  const [pupils, setPupils] = useState([]); // All pupils in the selected class/year
  const [classGradesData, setClassGradesData] = useState([]); // All grades for the selected class/year
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const tableRef = React.useRef(null);
  
  // 🧮 Define term-test mapping (Same as ReportCard)
  const termTests = {
    "Term 1": ["Term 1 T1", "Term 1 T2"],
    "Term 2": ["Term 2 T1", "Term 2 T2"],
    "Term 3": ["Term 3 T1", "Term 3 T2"],
  };

  // Determine the tests for the selected term
  const tests = termTests[selectedTerm];
  const test1Name = tests[0];
  const test2Name = tests[1];


  // 2. DATA FETCHING HOOKS (Modified from your previous component)

  // Fetch academic years and classes
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
      const subjects = [...new Set(data.map((d) => d.subject))].sort();

      setAcademicYears(years);
      setAvailableClasses(classes);
      
      if (years.length > 0 && !academicYear) setAcademicYear(years[0]);
      if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]);
      if (subjects.length > 0 && !selectedSubject) setSelectedSubject(subjects[0]);
    });

    return () => unsubscribe();
  }, [schoolId]);

  // Fetch pupils in class/year and all grades for the class
  useEffect(() => {
    if (!academicYear || !selectedClass || !schoolId) {
      setPupils([]);
      setClassGradesData([]);
      return;
    }
    
    setLoading(true);

    // 1. Fetch Pupils
    const pupilsQuery = query(
      collection(db, "PupilsReg"),
      where("schoolId", "==", schoolId),
      where("academicYear", "==", academicYear),
      where("class", "==", selectedClass)
    );
    const pupilsUnsub = onSnapshot(pupilsQuery, (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => a.studentName.localeCompare(b.studentName));
      setPupils(data);
    });

    // 2. Fetch Class Grades
    const gradesQuery = query(
      collection(schooldb, "PupilGrades"),
      where("academicYear", "==", academicYear),
      where("schoolId", "==", schoolId),
      where("className", "==", selectedClass)
    );
    const gradesUnsub = onSnapshot(gradesQuery, (snapshot) => {
      setClassGradesData(snapshot.docs.map((doc) => doc.data()));
      setLoading(false);
    });

    return () => {
      pupilsUnsub();
      gradesUnsub();
    };
  }, [academicYear, selectedClass, schoolId]);


  // 3. DATA TRANSFORMATION (Pivot Matrix Logic)
  const { pupilMatrix, subjectOptions } = useMemo(() => {
    if (classGradesData.length === 0 || pupils.length === 0) {
      return { pupilMatrix: [], subjectOptions: [] };
    }
    
    const uniqueSubjects = [
        ...new Set(classGradesData.map((d) => d.subject))
    ].sort();
    
    // Ensure the selected subject is available
    if (selectedSubject && !uniqueSubjects.includes(selectedSubject)) {
        setSelectedSubject(uniqueSubjects[0] || "");
    }
    
    if (!selectedSubject) {
        return { pupilMatrix: [], subjectOptions: uniqueSubjects };
    }

    // 1. Filter grades for the selected subject and term
    const relevantGrades = classGradesData.filter(
      (g) =>
        g.subject === selectedSubject &&
        (g.test === test1Name || g.test === test2Name)
    );

    // 2. Map pupil data to grades
    const matrix = pupils.map((pupil) => {
      const pupilGrades = relevantGrades.filter(
        (g) => g.pupilID === pupil.studentID
      );

      const t1 = pupilGrades.find((g) => g.test === test1Name)?.grade || "—";
      const t2 = pupilGrades.find((g) => g.test === test2Name)?.grade || "—";

      let mean = "—";
      let total = 0;
      let count = 0;

      if (t1 !== "—") {
        total += Number(t1);
        count++;
      }
      if (t2 !== "—") {
        total += Number(t2);
        count++;
      }

      if (count > 0) {
        mean = Math.round(total / count);
      }

      return {
        studentID: pupil.studentID,
        studentName: pupil.studentName,
        test1: t1,
        test2: t2,
        mean: mean,
        rawMean: mean === "—" ? -1 : mean, // Use for ranking
        rank: "—",
      };
    });

    // 3. Calculate Rank (Standard Competition Ranking)
    // Filter out pupils with no valid mean score for ranking
    const rankablePupils = matrix
      .filter((p) => p.rawMean !== -1)
      .sort((a, b) => b.rawMean - a.rawMean);

    let currentRank = 1;
    let rankCount = 0;
    
    rankablePupils.forEach((item, index) => {
      rankCount++;
      if (index > 0 && item.rawMean < rankablePupils[index - 1].rawMean) {
        currentRank = rankCount;
      } else if (index === 0) {
        currentRank = 1;
      }
      item.rank = currentRank;
    });

    // Merge ranks back into the main matrix (which already contains unrankable pupils)
    const finalMatrix = matrix.map(p => {
        const ranked = rankablePupils.find(r => r.studentID === p.studentID);
        return {
            ...p,
            rank: ranked ? ranked.rank : "—"
        };
    });


    return { pupilMatrix: finalMatrix, subjectOptions: uniqueSubjects };
  }, [classGradesData, pupils, selectedSubject, selectedTerm, test1Name, test2Name]);

  // 4. HANDLERS & HELPERS
  
  // Helper to color the grade
  const getGradeColor = (val) => {
    const grade = Number(val);
    if (isNaN(grade) || val === "—") return "text-gray-500";
    if (grade >= 50) return "text-blue-600 font-bold";
    return "text-red-600 font-bold";
  };
  
  const handlePrintPDF = () => {
    if (pupilMatrix.length === 0) {
      alert("No data to generate PDF.");
      return;
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "A4" });
    
    let y = 30;

    // Title
    doc.setFontSize(16).setFont(doc.getFont().fontName, "bold");
    doc.text(`Grade Matrix: ${selectedClass} (${academicYear})`, 40, y);
    y += 18;
    
    doc.setFontSize(14).setFont(doc.getFont().fontName, "normal");
    doc.text(`Subject: ${selectedSubject} - ${selectedTerm}`, 40, y);
    y += 15;
    
    const tableData = pupilMatrix.map((p) => [
      p.studentName,
      p.test1,
      p.test2,
      p.mean,
      p.rank,
    ]);

    const pdfHeaders = ["Pupil Name", test1Name.split(' ')[2], test2Name.split(' ')[2], "Mean", "Rank"];

    autoTable(doc, {
      startY: y + 10,
      head: [pdfHeaders],
      body: tableData,
      theme: "striped",
      styles: { halign: "center", fontSize: 10 },
      headStyles: { fillColor: [63, 81, 181], textColor: 255 },
      margin: { left: 40, right: 40 },
      columnStyles: { 0: { halign: "left", cellWidth: 150 } },
    });

    doc.save(`${selectedClass}_${selectedSubject}_${selectedTerm}_Matrix.pdf`);
  };

  
  // 5. RENDER LOGIC
  
  if (!schoolId) {
    return (
      <div className="text-center p-6 text-red-600 font-medium">
        Error: School ID not provided.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white shadow-xl rounded-2xl">
      <h2 className="text-3xl font-bold text-center text-indigo-700 mb-8">
        Class Grade Matrix Report
      </h2>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg bg-indigo-50">
        
        {/* Academic Year */}
        <div>
          <label className="font-semibold text-gray-700 block mb-1">Year:</label>
          <select 
            value={academicYear} 
            onChange={(e) => setAcademicYear(e.target.value)} 
            className="w-full border rounded-lg px-3 py-2"
          >
            {academicYears.map((y) => (<option key={y}>{y}</option>))}
          </select>
        </div>

        {/* Class */}
        <div>
          <label className="font-semibold text-gray-700 block mb-1">Class:</label>
          <select 
            value={selectedClass} 
            onChange={(e) => setSelectedClass(e.target.value)} 
            className="w-full border rounded-lg px-3 py-2"
          >
            {availableClasses.map((c) => (<option key={c}>{c}</option>))}
          </select>
        </div>

        {/* Term */}
        <div>
          <label className="font-semibold text-gray-700 block mb-1">Term:</label>
          <select 
            value={selectedTerm} 
            onChange={(e) => setSelectedTerm(e.target.value)} 
            className="w-full border rounded-lg px-3 py-2"
          >
            {Object.keys(termTests).map((term) => (<option key={term}>{term}</option>))}
          </select>
        </div>
        
        {/* Subject */}
        <div>
          <label className="font-semibold text-gray-700 block mb-1">Subject:</label>
          <select 
            value={selectedSubject} 
            onChange={(e) => setSelectedSubject(e.target.value)} 
            className="w-full border rounded-lg px-3 py-2"
            disabled={subjectOptions.length === 0}
          >
             {subjectOptions.map((s) => (<option key={s}>{s}</option>))}
          </select>
        </div>
      </div>
      
      {/* Action Button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={handlePrintPDF}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-md disabled:bg-gray-400 flex items-center transition"
          disabled={loading || pupilMatrix.length === 0}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2v-3a2 2 0 012-2h10a2 2 0 012 2v3a2 2 0 01-2 2z"></path></svg>
          Download PDF Matrix
        </button>
      </div>

      {/* Report Summary */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-medium text-gray-800">
          **{selectedSubject}** Scores for **{selectedClass}** - **{selectedTerm}**
        </h3>
      </div>

      {/* Table Display */}
      {loading ? (
        <div className="text-center text-indigo-600 font-medium p-8 border rounded-lg">
          Loading pupils and grades...
        </div>
      ) : pupilMatrix.length > 0 ? (
        <div ref={tableRef} className="overflow-x-auto border rounded-lg shadow-lg">
          <table className="min-w-full text-sm text-center border-collapse">
            <thead className="bg-indigo-600 text-white sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left w-64">Pupil Name</th>
                <th className="px-4 py-3">{test1Name.split(' ').pop()}</th>
                <th className="px-4 py-3">{test2Name.split(' ').pop()}</th>
                <th className="px-4 py-3">Mn</th>
                <th className="px-4 py-3">Rnk</th>
              </tr>
            </thead>
            <tbody>
              {pupilMatrix.map((pupil) => (
                <tr key={pupil.studentID} className="border-b hover:bg-gray-50 transition">
                  <td className="text-left px-4 py-2 font-semibold text-gray-800">
                    {pupil.studentName}
                  </td>
                  <td className={`px-4 py-2 ${getGradeColor(pupil.test1)}`}>
                    {pupil.test1}
                  </td>
                  <td className={`px-4 py-2 ${getGradeColor(pupil.test2)}`}>
                    {pupil.test2}
                  </td>
                  <td className={`px-4 py-2 font-bold ${getGradeColor(pupil.mean)}`}>
                    {pupil.mean}
                  </td>
                  <td className="px-4 py-2 font-bold text-red-600">
                    {pupil.rank}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center p-8 bg-yellow-50 text-yellow-800 border border-yellow-300 rounded-lg">
          No grade data found for the selected subject and term.
        </div>
      )}
    </div>
  );
};

export default SubGradeMatrixPage;