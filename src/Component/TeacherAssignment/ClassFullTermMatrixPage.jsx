import React, { useState, useEffect, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "../../../firebase";
import { pupilLoginFetch } from "../Database/PupilLogin";
import { schooldb } from "../Database/SchoolsResults";
import {
    collection,
    onSnapshot,
    query,
    where,
    getDocs,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";

const ClassPerformanceSummary = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [academicYear, setAcademicYear] = useState("");
    const [academicYears, setAcademicYears] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedTerm, setSelectedTerm] = useState("Term 1"); // Filter by Term
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

        const q = query(collection(schooldb, "PupilGrades"), where("schoolId", "==", schoolId));
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
            collection(pupilLoginFetch, "PupilsReg"),
            where("schoolId", "==", schoolId),
            where("class", "==", selectedClass),
            where("academicYear", "==", academicYear)
        );

        const unsub = onSnapshot(pupilsQuery, (snapshot) => {
            const data = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data(), studentID: doc.data().studentID }))
                .sort((a, b) => a.studentName.localeCompare(b.studentName)); // Sort alphabetically
            setPupils(data);
        });

        return () => unsub();
    }, [selectedClass, academicYear, schoolId]);

    // 🔹 Fetch all relevant grades for the class/year
    useEffect(() => {
        if (!selectedClass || !academicYear || !schoolId) return;

        setLoading(true);
        const gradesQuery = query(
            collection(schooldb, "PupilGrades"),
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


    // 🔹 Calculate data for the table
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
                return { id, mean: (Number(t1) + Number(t2)) / 2, t1, t2 };
            });

            // Rank by Mean
            subjectScores.sort((a, b) => b.mean - a.mean);
            let rank = 1;
            subjectScores.forEach((x, i) => {
                if (i > 0 && x.mean < subjectScores[i - 1].mean) rank = i + 1;
                x.rank = x.mean === 0 ? "—" : rank; // Use "—" for N/A or 0 mean
            });
            classMeansBySubject[subject] = subjectScores;
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
                        t1: data.t1,
                        t2: data.t2,
                        mean: Math.round(data.mean),
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

        // Rank by Total Mean
        classOverallTotals.sort((a, b) => b.totalMean - a.totalMean);
        const overallRanks = {};
        let rank = 1;
        classOverallTotals.forEach((p, i) => {
            if (i > 0 && p.totalMean < classOverallTotals[i - 1].totalMean) rank = i + 1;

            const percentage = maxPossibleTotalMean > 0
                ? (p.totalMean / maxPossibleTotalMean * 100).toFixed(1)
                : 0;

            overallRanks[p.id] = {
                totalMean: Math.round(p.totalMean),
                percentage: percentage,
                rank: p.totalMean === 0 ? "—" : rank, // Use "—" for N/A or 0 total mean
            };
        });

        return { subjects: uniqueSubjects, pupilPerformanceMap: performanceMap, overallRankMap: overallRanks };
    }, [classGradesData, pupils, selectedTerm, selectedClass, schoolId, classesCache, tests]);

    // 🔹 Helper for mean color
    const getMeanColor = (mean) => {
        if (mean == null || mean === "—") return "text-gray-400";
        if (mean >= 50) return "text-blue-600 font-bold";
        return "text-red-600 font-bold";
    };

    // 🔹 Calculate total number of columns for width calculation
    // 1 (Pupil Name) + (Subjects * 4 metrics) + 3 (Overall Metrics)
    const totalColumns = 1 + (subjects.length * 4) + 3;



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
        for (let i = 1; i < overallColumnStart; i++) {
            gradeColumnStyles[i] = { fontSize: 11, fontStyle: 'bold' }; 
        }
        
        const columnStyles = { 
            0: { 
                halign: "left", 
                cellWidth: 170, 
                fontSize: 11, 
                overflow: 'ellipsize', 
                // Set custom padding for Pupil Name (left:5, top/bottom:3, right:15 for margin)
                cellPadding: { right: 15, left: 5, top: 3, bottom: 3 } 
            }, 
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

                // 2. Metric Spacing and Borders
                if (data.section === 'head' || data.section === 'body') {
                    const basePadding = { right: 3, left: 3, top: 3, bottom: 3 }; 
                    const increasedRightPadding = 10; 
                    const thickLineWeight = 1; // For Rnk and T1
                    const thickLineColor = [0, 0, 0];
                    const thinLineWeight = 0.1;
                    const thinLineColor = [200, 200, 200];


                    // ⭐️ NEW LOGIC: T1 Column Left Border (Index 1, 5, 9, ...)
                    const isT1Column = colIndex > 0 && (colIndex - 1) % 4 === 0;

                    if (isT1Column) {
                         // Apply thick left border
                        data.cell.styles.lineWidth = { left: thickLineWeight };
                        data.cell.styles.lineColor = thickLineColor;
                        
                        // Ensure T1 has standard internal spacing on the right
                        data.cell.styles.cellPadding = { ...basePadding, right: increasedRightPadding }; 
                    }


                    // T2 and Mn Column Spacing (Index 2, 3, 6, 7, ...)
                    const isT2orMn = colIndex > 0 && ((colIndex - 2) % 4 === 0 || (colIndex - 3) % 4 === 0);
                    
                    if (isT2orMn) {
                        // Apply right spacing to T2 and Mn
                        data.cell.styles.cellPadding = { ...basePadding, right: increasedRightPadding };
                        
                        // Ensure T2 and Mn use thin borders
                        data.cell.styles.lineWidth = { right: thinLineWeight };
                        data.cell.styles.lineColor = thinLineColor;
                    }


                    // Rnk Column Border (Index 4, 8, 12...)
                    const isRankColumn = colIndex > 0 && colIndex % 4 === 0;

                    if (isRankColumn && colIndex < overallColumnStart) {
                        // This handles the thick black line after Rnk
                        data.cell.styles.lineWidth = { right: thickLineWeight };
                        data.cell.styles.lineColor = thickLineColor;
                        
                        // Use a smaller right padding for Rnk as the line is thick
                        data.cell.styles.cellPadding = { right: 6, left: 3, top: 3, bottom: 3 }; 
                    } 
                    
                    
                    // Pupil Name Column (Index 0)
                    if (colIndex === 0) {
                         // Ensure Pupil Name has NO right border (as T1 now has a left border)
                         data.cell.styles.lineWidth = { right: 0 }; 
                         // Explicitly set column 0 padding again to maintain the large right margin
                         data.cell.styles.cellPadding = { right: 15, left: 5, top: 3, bottom: 3 };
                    } 
                    
                    
                    // Cleanup for all other columns (e.g., Overall metrics)
                    else if (!isT1Column && !isT2orMn && !isRankColumn) {
                         data.cell.styles.lineWidth = { right: thinLineWeight }; 
                         data.cell.styles.lineColor = thinLineColor; 
                         data.cell.styles.cellPadding = 3;
                    }
                }
            }
        });
    });

    doc.save(`${selectedClass}_${selectedTerm}_FullMatrix.pdf`);
};
    return (
        <div className="max-w-7xl mx-auto p-6 bg-white rounded-2xl shadow-xl">
            <h2 className="text-3xl font-bold mb-8 text-center text-indigo-700">
                Class Performance Summary ({selectedTerm})
            </h2>

            {/* Buttons */}
            <div className="flex justify-center gap-4 mb-6 no-print">
                <button
                    onClick={handleDownloadPDF}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold shadow"
                >
                    📄 Download PDF
                </button>
            </div>

            {/* Filter Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 p-4 border rounded-lg bg-indigo-50 no-print">
                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Academic Year:</label>
                    <select
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                    >
                        {academicYears.map((year, i) => <option key={i} value={year}>{year}</option>)}
                    </select>
                </div>

                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Class:</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                    >
                        {availableClasses.map((c, i) => <option key={i} value={c}>{c}</option>)}
                    </select>
                </div>

                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Term:</label>
                    <select
                        value={selectedTerm}
                        onChange={(e) => setSelectedTerm(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white"
                    >
                        {Object.keys(termTests).map((t, i) => <option key={i} value={t}>{t}</option>)}
                    </select>
                </div>

                <div className="flex items-end">
                    <p className="text-sm text-gray-600 font-semibold">
                        Max Possible Score (Term Mean): {classesCache.find(c => c.schoolId === schoolId && c.className === selectedClass)?.subjectPercentage || 'N/A'}
                    </p>
                </div>
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
                        // Set min-width to ensure the table doesn't compress too much
                        style={{ minWidth: totalColumns * 65 }}
                    >
                        {/* --- Dynamic Header --- */}
                        <thead className="bg-indigo-600 text-white sticky top-0 z-20">
                            <tr>
                                {/* Pupil Name Column (spans two rows) */}
                                <th rowSpan="2" className="px-4 py-3 text-left w-48 sticky left-0 bg-indigo-700 z-10 border-r border-indigo-500">
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
                                            // Determine if the cell is the Rnk cell to apply a heavier border
                                            const isRankCell = (subIndex * 4) + 3 === (subjects.length * 4) - 1;

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
                                                <td key={`${subject}_Rnk`} className={`px-1 py-3 text-center text-xs font-bold text-red-600 ${isRankCell ? 'border-r border-gray-700' : 'border-r border-gray-700'}`}>
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
                                );
                            })}
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

export default ClassPerformanceSummary;