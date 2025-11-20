import React, { useState, useEffect, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "../../../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";

const ClassFullTermMatrixPage = () => {
  const location = useLocation();
  const schoolId = location.state?.schoolId || "N/A";

  // 1. STATE MANAGEMENT
  const [academicYear, setAcademicYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("Term 1"); 
  const [availableClasses, setAvailableClasses] = useState([]);
  const [pupils, setPupils] = useState([]);
  const [classGradesData, setClassGradesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classesCache, setClassesCache] = useState([]);

  const termTests = {
    "Term 1": ["Term 1 T1", "Term 1 T2"],
    "Term 2": ["Term 2 T1", "Term 2 T2"],
    "Term 3": ["Term 3 T1", "Term 3 T2"],
  };
  const tests = termTests[selectedTerm];


  // 2. DATA FETCHING (No changes needed here)

  // 🔹 Fetch Classes Cache (for subjectPercentage)
  useEffect(() => {
    if (!schoolId) return;
    const fetchClasses = async () => {
      const snapshot = await getDocs(query(collection(db, "Classes"), where("schoolId", "==", schoolId)));
      const data = snapshot.docs.map(doc => doc.data());
      setClassesCache(data);
    };
    fetchClasses();
  }, [schoolId]);

  // 🔹 Fetch academic years and classes from grades
  useEffect(() => {
    if (!schoolId || schoolId === "N/A") return;

    const q = query(collection(db, "PupilGrades"), where("schoolId", "==", schoolId));
    const unsub = onSnapshot(q, (snapshot) => {
      const years = [...new Set(snapshot.docs.map(doc => doc.data().academicYear).filter(Boolean))];
      const classes = [...new Set(snapshot.docs.map(doc => doc.data().className).filter(Boolean))];

      setAcademicYears(years.sort().reverse());
      setAvailableClasses(classes.sort());

      if (years.length > 0 && !academicYear) setAcademicYear(years[0]);
      if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]);
    });

    return () => unsub();
  }, [schoolId]);

  // 🔹 Fetch pupils
  useEffect(() => {
    if (!selectedClass || !academicYear || !schoolId) return;

    const pupilsQuery = query(
      collection(db, "PupilsReg"),
      where("schoolId", "==", schoolId),
      where("class", "==", selectedClass),
      where("academicYear", "==", academicYear)
    );

    const unsub = onSnapshot(pupilsQuery, (snapshot) => {
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data(), studentID: doc.data().studentID, studentName: doc.data().studentName }))
        .sort((a, b) => a.studentName.localeCompare(b.studentName)); 
      setPupils(data);
    });

    return () => unsub();
  }, [selectedClass, academicYear, schoolId]);

  // 🔹 Fetch all relevant grades for the class/year
  useEffect(() => {
    if (!selectedClass || !academicYear || !schoolId) return;

    setLoading(true);
    const gradesQuery = query(
      collection(db, "PupilGrades"),
      where("schoolId", "==", schoolId),
      where("academicYear", "==", academicYear),
      where("className", "==", selectedClass)
    );

    const fetchGrades = onSnapshot(gradesQuery, (snapshot) => {
      setClassGradesData(snapshot.docs.map(doc => doc.data()));
      setLoading(false);
    }, (error) => {
        console.error("Error fetching class grades:", error);
        setLoading(false);
    });

    return () => fetchGrades();
  }, [selectedClass, academicYear, schoolId]);


  // 3. DATA TRANSFORMATION (UPDATED MEAN CALCULATION)
const { subjects, pupilPerformanceMap, overallRankMap } = useMemo(() => {
    if (!classGradesData.length || !pupils.length) {
      return { subjects: [], pupilPerformanceMap: {}, overallRankMap: {} };
    }

    const pupilIDs = pupils.map(p => p.studentID);
    const uniqueSubjects = [...new Set(classGradesData.map(g => g.subject))].sort();

    // 1. Calculate Subject Mean and Rank for every pupil
    const classMeansBySubject = {};
    for (const subject of uniqueSubjects) {
      const subjectScores = pupilIDs.map(id => {
        const g = classGradesData.filter(x => x.pupilID === id && x.subject === subject);
        // Combine T1 and T2 scores for the selected term
        const t1 = g.find(x => x.test === tests[0])?.grade || 0;
        const t2 = g.find(x => x.test === tests[1])?.grade || 0;
        
        // YOUR PREFERRED MEAN CALCULATION: Sum T1 and T2, always divide by 2.
        const mean = (Number(t1) + Number(t2)) / 2;
        
        return { id, mean: mean, t1: Number(t1), t2: Number(t2) };
      });

      // Rank by Mean (only ranking those with mean > 0)
      const rankedScores = subjectScores.filter(x => x.mean > 0).sort((a, b) => b.mean - a.mean);
      
      let rank = 1;
      rankedScores.forEach((x, i) => {
        // Standard competition ranking (handle ties)
        if (i > 0 && x.mean < rankedScores[i - 1].mean) rank = i + 1;
        x.rank = rank;
      });
      
      // Merge back all scores, including ranks or "—" for 0 means
      classMeansBySubject[subject] = subjectScores.map(score => {
        const rankedItem = rankedScores.find(r => r.id === score.id);
        return { ...score, rank: rankedItem ? rankedItem.rank : (score.mean > 0 ? "—" : "—") };
      });
    }

    // 2. Aggregate Subject Data into Pupil-Centric Map
    const performanceMap = {};
    let classOverallTotals = [];

    pupilIDs.forEach(pupilID => {
      let pupilTotalSum = 0;
      performanceMap[pupilID] = {};
      
      uniqueSubjects.forEach(subject => {
        const data = classMeansBySubject[subject].find(x => x.id === pupilID);
        if (data) {
          performanceMap[pupilID][subject] = {
            // Display "—" if the raw score for T1/T2 was 0
            t1: data.t1 === 0 ? "—" : data.t1,
            t2: data.t2 === 0 ? "—" : data.t2,
            mean: data.mean === 0 ? "—" : Math.round(data.mean), // Display "—" if mean is 0
            rank: data.rank,
          };
          pupilTotalSum += data.mean; // Sum of raw means
        }
      });
      classOverallTotals.push({ id: pupilID, totalMean: pupilTotalSum });
    });

    // 3. Calculate Overall Class Rank and Percentage
    const classInfo = classesCache.find(c => c.schoolId === schoolId && c.className === selectedClass);
    // Max score is the sum of the means, so we use the subjectPercentage value.
    const maxPossibleTotalMean = Number(classInfo?.subjectPercentage) || (uniqueSubjects.length * 100); 

    // Rank only pupils with a total mean greater than 0
    const rankedOverallTotals = classOverallTotals.filter(p => p.totalMean > 0).sort((a, b) => b.totalMean - a.totalMean);
    
    const overallRanks = {};
    
    classOverallTotals.forEach((p) => {
      let overallRank = "—";

      if (p.totalMean > 0) {
        // Find the rank using the ranked array's index + 1 (competition ranking)
        const index = rankedOverallTotals.findIndex(r => r.id === p.id);
        
        if (index >= 0) {
          let currentRank = index + 1;
          // Adjust for ties: backtrack to assign the same rank
          while (currentRank > 1 && rankedOverallTotals[currentRank - 2].totalMean === p.totalMean) {
            currentRank--;
          }
          overallRank = currentRank;
        }
      }

      const percentage = maxPossibleTotalMean > 0 
        ? (p.totalMean / maxPossibleTotalMean * 100).toFixed(1)
        : 0;

      overallRanks[p.id] = {
        totalMean: Math.round(p.totalMean),
        percentage: percentage,
        rank: overallRank, // Use the calculated rank or "—"
      };
    });

    return { subjects: uniqueSubjects, pupilPerformanceMap: performanceMap, overallRankMap: overallRanks };
  }, [classGradesData, pupils, selectedTerm, selectedClass, schoolId, classesCache, tests]);

  // 4. HANDLERS & HELPERS (No changes needed here)

  // 🔹 Helper for mean color
  const getMeanColor = (mean) => {
    if (mean == null || mean === "—") return "text-gray-400";
    const meanValue = Number(mean);
    if (isNaN(meanValue)) return "text-gray-400";
    if (meanValue >= 50) return "text-blue-600 font-bold";
    return "text-red-600 font-bold";
  };
  
  // 🔹 Download PDF (Updated for complex header)
 // ... (Previous code remains the same up to the handleDownloadPDF function)

const handleDownloadPDF = () => {
    if (pupils.length === 0 || subjects.length === 0) {
        alert("No data to generate PDF.");
        return;
    }

    // Configuration
    const subjectsPerPage = 6; 
    const requiresMultiplePages = subjects.length > subjectsPerPage;
    
    // Use landscape for wide table
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "A4" });
    let startY = 30;

    // Split subjects into chunks for multi-page rendering
    const subjectChunks = [];
    for (let i = 0; i < subjects.length; i += subjectsPerPage) {
        subjectChunks.push(subjects.slice(i, i + subjectsPerPage));
    }

    subjectChunks.forEach((chunk, chunkIndex) => {
        const isLastChunk = chunkIndex === subjectChunks.length - 1;

        if (chunkIndex > 0) {
            doc.addPage();
            startY = 30; // Reset Y position for new page
        }
        
        // --- Title and Page Info ---
        doc.setFontSize(16).setFont(doc.getFont().fontName, "bold");
        doc.text(`Full Term Grade Matrix: ${selectedClass} (${academicYear})`, 40, startY);
        startY += 18;
        doc.setFontSize(14).setFont(doc.getFont().fontName, "normal");
        doc.text(`Term: ${selectedTerm} (Subjects ${chunkIndex * subjectsPerPage + 1}-${chunkIndex * subjectsPerPage + chunk.length})`, 40, startY);
        startY += 15;


        // --- AutoTable Header Structure ---
        const chunkSubjectHeaders = chunk.map(s => ({ 
            content: s, 
            colSpan: 4, 
            styles: { halign: 'center', fillColor: [63, 81, 181], fontSize: 10 } 
        }));
        
        const overallHeader = { 
            content: 'Overall Term Summary', 
            colSpan: 3, 
            styles: { halign: 'center', fillColor: [20, 140, 80], fontSize: 10 } 
        };

        const headRow1 = [
            { content: 'Pupil Name', rowSpan: 2, styles: { halign: 'left', fillColor: [63, 81, 181], fontSize: 10 } }, 
            ...chunkSubjectHeaders,
            ...((!requiresMultiplePages || isLastChunk) ? [overallHeader] : []) 
        ];
        
        const metrics = ["T1", "T2", "Mn", "Rnk"];
        const overallMetrics = ["Total Mn", "Overall %", "Rank"];
        
        const headRow2 = [
            ...chunk.flatMap(() => metrics.map(m => ({ content: m, styles: { fontSize: 8 } }))),
            ...((!requiresMultiplePages || isLastChunk) ? overallMetrics.map(m => ({ content: m, styles: { fontSize: 8 } })) : [])
        ];
        
        const head = [headRow1, headRow2];


        // 3. Body Data
        const tableRows = pupils.map((p) => {
            const row = [p.studentName]; 
            const pupilID = p.studentID;
            
            for (const subject of chunk) {
                const data = pupilPerformanceMap[pupilID]?.[subject] || {};
                row.push(data.t1 || "—");
                row.push(data.t2 || "—");
                row.push(data.mean || "—");
                row.push(data.rank || "—");
            }
            
            if (!requiresMultiplePages || isLastChunk) {
                const overall = overallRankMap[pupilID] || {};
                row.push(overall.totalMean || "—");
                row.push(overall.percentage ? `${overall.percentage}%` : "—");
                row.push(overall.rank || "—");
            }

            return row;
        });
        
        // Calculate column styles for the current chunk
        const subjectColumnsCount = chunk.length * 4;
        const overallColumnStart = 1 + subjectColumnsCount; 
        
        const gradeColumnStyles = {};
        // Reduce grade font size for all T1, T2, Mean, Rank columns to 11
        for (let i = 1; i < overallColumnStart; i++) {
            gradeColumnStyles[i] = { fontSize: 11, fontStyle: 'bold' }; 
        }
        
        const columnStyles = { 
            // ⭐️ CHANGE: Increased cellWidth for Pupil Name to 140
            0: { halign: "left", cellWidth: 150, fontSize: 11, overflow: 'ellipsize' }, 
            ...gradeColumnStyles,
        };
        
        if (!requiresMultiplePages || isLastChunk) {
            columnStyles[overallColumnStart] = { fillColor: [220, 240, 220], fontSize: 13, fontStyle: 'bold' }; 
            columnStyles[overallColumnStart + 1] = { fillColor: [220, 240, 220], fontSize: 13, fontStyle: 'bold' }; 
            columnStyles[overallColumnStart + 2] = { fillColor: [200, 240, 200], fontSize: 15, fontStyle: 'bold' }; 
        }

        autoTable(doc, {
            startY: startY + 10,
            head: head,
            body: tableRows,
            theme: "striped",
            // Reduced base font size to 11 and cell padding to 3 for density
            styles: { halign: "center", fontSize: 11, cellPadding: 3, overflow: 'hidden' }, 
            headStyles: { textColor: 255 },
            margin: { left: 20, right: 20 }, 
            columnStyles: columnStyles,
            tableWidth: 'wrap',
            
            didParseCell: (data) => {
                const colIndex = data.column.index;
                
                // 1. Conditional Coloring for T1 and T2 (Body only)
                if (data.section === 'body') {
                    const isT1orT2 = (colIndex > 0) && (colIndex - 1) % 4 <= 1;

                    if (isT1orT2) {
                        const grade = parseFloat(data.cell.text[0]); 

                        if (!isNaN(grade) && grade !== 0) {
                            if (grade >= 50) {
                                data.cell.styles.textColor = [0, 0, 200]; // Dark Blue
                            } else {
                                data.cell.styles.textColor = [200, 0, 0]; // Dark Red
                            }
                            data.cell.styles.fontStyle = 'bold'; 
                        }
                    }
                }

                // 2. Vertical Border after Subject Rank (Rnk)
                if (data.section === 'head' || data.section === 'body') {
                    const isRankColumn = colIndex > 0 && colIndex % 4 === 0;

                    if (isRankColumn && colIndex < overallColumnStart) {
                        data.cell.styles.lineWidth = { right: 1 };
                        data.cell.styles.lineColor = [0, 0, 0]; // Black line
                        
                        // Adjust padding to account for the new smaller global padding
                        data.cell.styles.cellPadding = { right: 6, left: 3, top: 3, bottom: 3 }; 
                    } else {
                        // Ensure other columns use the smaller default settings
                        data.cell.styles.lineWidth = { right: 0.1 }; 
                        data.cell.styles.lineColor = [200, 200, 200]; 
                        data.cell.styles.cellPadding = 3;
                    }
                }
            }
        });
    });

    doc.save(`${selectedClass}_${selectedTerm}_FullMatrix.pdf`);
};

  // 5. RENDER LOGIC
  
  // Calculate total required columns for the dynamic table
  const totalColumns = 1 + (subjects.length * 4) + 3; 

  return (
    <div className="max-w-full mx-auto p-6 bg-white shadow-xl rounded-2xl">
      <h2 className="text-3xl font-bold text-center text-indigo-700 mb-8">
        Class Full Term Grade Matrix Report
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
        
        <div className="flex items-end">
            <p className="text-sm text-gray-600 font-semibold">
                Max Possible Total Mean: {classesCache.find(c => c.schoolId === schoolId && c.className === selectedClass)?.subjectPercentage || 'N/A'}
            </p>
        </div>
      </div>
      
      {/* Action Button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={handleDownloadPDF}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-md disabled:bg-gray-400 flex items-center transition"
          disabled={loading || pupils.length === 0 || subjects.length === 0}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2v-3a2 2 0 012-2h10a2 2 0 012 2v3a2 2 0 01-2 2z"></path></svg>
          Download PDF Matrix
        </button>
      </div>

      {/* Table Display */}
      {loading ? (
        <div className="text-center text-indigo-600 font-medium p-8 border rounded-lg">
          Loading pupils and grades...
        </div>
      ) : subjects.length > 0 && pupils.length > 0 ? (
        <div className="overflow-x-auto border rounded-lg shadow-lg">
          <table 
            className="min-w-full text-sm text-center border-collapse"
            style={{ minWidth: totalColumns * 65 }} 
          >
            {/* --- Dynamic Header --- */}
            <thead className="bg-indigo-600 text-white sticky top-0">
              <tr>
                {/* Pupil Name Column (spans two rows) */}
                <th rowSpan="2" className="px-4 py-3 text-left w-48 sticky left-0 bg-indigo-700 z-10">
                  Pupil Name
                </th>
                {/* Subject Columns (span four metric columns) */}
                {subjects.map((subject) => (
                  <th key={subject} colSpan="4" className="px-4 py-2 border-l border-r border-indigo-700">
                    {subject}
                  </th>
                ))}
                
                {/* NEW: Overall Summary Column */}
                <th colSpan="3" className="px-4 py-2 border-l-4 border-green-700 bg-green-600 z-10">
                    OVERALL
                </th>

              </tr>
              <tr className="bg-indigo-500">
                {/* Metric Columns (repeated for each subject) */}
                {subjects.flatMap((subject) => [
                  <th key={`${subject}_T1`} className="px-1 py-2 font-light text-xs border-r border-indigo-700">T1</th>,
                  <th key={`${subject}_T2`} className="px-1 py-2 font-light text-xs border-r border-indigo-700">T2</th>,
                  <th key={`${subject}_Mn`} className="px-1 py-2 font-light text-xs border-r border-indigo-700">Mn</th>,
                  <th key={`${subject}_Rnk`} className="px-1 py-2 font-light text-xs border-r border-indigo-300">Rnk</th>
                ])}
                
                {/* NEW: Overall Metrics */}
                <th className="px-2 py-2 font-bold text-xs bg-green-500 border-l border-green-700">Total Mn</th>
                <th className="px-2 py-2 font-bold text-xs bg-green-500 border-l border-green-700">Overall %</th>
                <th className="px-2 py-2 font-bold text-xs bg-green-500">Rank</th>
              </tr>
            </thead>
            
            {/* --- Body Data --- */}
            <tbody>
              {pupils.map((p, pIndex) => {
                const isEven = pIndex % 2 === 0;
                return (
                <tr key={p.studentID} className={`border-b hover:bg-gray-50 transition ${isEven ? 'bg-white' : 'bg-gray-50'}`}>
                  {/* Sticky Pupil Name */}
                  <td className={`text-left px-4 py-3 font-semibold text-gray-800 sticky left-0 border-r z-10 ${isEven ? 'bg-white' : 'bg-gray-50'}`}>
                    {p.studentName}
                  </td>
                  
                  {/* Subject Grades */}
                  {subjects.flatMap((subject, subIndex) => {
                    const data = pupilPerformanceMap[p.studentID]?.[subject] || {};
                    
                    return [
                      <td key={`${subject}_T1`} className={`px-1 py-3 text-center text-xs border-r border-gray-200 ${data.t1 === "—" ? 'text-gray-400' : ''}`}>
                        {data.t1 || "—"}
                      </td>,
                      <td key={`${subject}_T2`} className={`px-1 py-3 text-center text-xs border-r border-gray-200 ${data.t2 === "—" ? 'text-gray-400' : ''}`}>
                        {data.t2 || "—"}
                      </td>,
                      <td key={`${subject}_Mn`} className={`px-1 py-3 text-center text-xs font-bold border-r border-gray-200 ${getMeanColor(data.mean)}`}>
                        {data.mean || "—"}
                      </td>,
                      <td key={`${subject}_Rnk`} className={`px-1 py-3 text-center text-xs font-bold text-red-600 border-r border-gray-700`}>
                        {data.rank || "—"}
                      </td>,
                    ];
                  })}
                  
                  {/* Overall Data */}
                  <td className="px-2 py-3 text-center font-bold text-base border-l-4 border-green-400 bg-green-100">
                    {overallRankMap[p.studentID]?.totalMean || "—"}
                  </td>
                  <td className="px-2 py-3 text-center font-bold text-base border-r border-green-400 bg-green-50">
                    {overallRankMap[p.studentID]?.percentage ? `${overallRankMap[p.studentID].percentage}%` : "—"}
                  </td>
                  <td className="px-2 py-3 text-center font-bold text-lg text-red-700 bg-green-100">
                    {overallRankMap[p.studentID]?.rank || "—"}
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center p-8 bg-yellow-50 text-yellow-800 border border-yellow-300 rounded-lg">
          No grade data found for the selected class and term.
        </div>
      )}
    </div>
  );
};

export default ClassFullTermMatrixPage;