import React, { useState, useEffect, useMemo, useCallback } from "react";
// import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults";
import { pupilLoginFetch } from "../Database/PupilLogin";
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
import localforage from "localforage"; // ⬅️ IMPORTED

// Initialize localforage store with a new name
const matrixStore = localforage.createInstance({
    name: "SubMatrixCache", // ⬅️ NEW NAME
    storeName: "classGrades",
});

// Define the component
const SubGradeMatrixPage = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    // 1. STATE MANAGEMENT
    const [academicYear, setAcademicYear] = useState("");
    const [academicYears, setAcademicYears] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [availableClasses, setAvailableClasses] = useState([]);
    const [pupils, setPupils] = useState([]); 
    // This state holds the raw grades for the selected class/year, sourced from DB or cache
    const [classGradesData, setClassGradesData] = useState([]); 
    const [selectedTerm, setSelectedTerm] = useState("Term 1");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [loading, setLoading] = useState(false);
    const tableRef = React.useRef(null);
    
    // 🧮 Define term-test mapping 
    const termTests = {
        "Term 1": ["Term 1 T1", "Term 1 T2"],
        "Term 2": ["Term 2 T1", "Term 2 T2"],
        "Term 3": ["Term 3 T1", "Term 3 T2"],
    };

    // Determine the tests for the selected term
    const tests = termTests[selectedTerm];
    const test1Name = tests[0];
    const test2Name = tests[1];


    // --- 2. DATA FETCHING HOOKS (Optimization applied here) ---

    // 2A. Fetch academic years and classes (STILL USES onSnapshot)
    // NOTE: This onSnapshot is used to derive the filter options (years, classes, subjects)
    // from all available grade documents. While expensive, if this data changes frequently
    // (e.g., new grades for new subjects/classes), the real-time update might be desired.
    // If you want to optimize this too, change onSnapshot to a one-time getDocs, like in the previous answer.
    const [subjectOptions, setSubjectOptions] = useState([]);

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
            setSubjectOptions(subjects); // Update subject options state
            
            if (years.length > 0 && !academicYear) setAcademicYear(years[0]);
            if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]);
            if (subjects.length > 0 && !selectedSubject) setSelectedSubject(subjects[0]);
        });

        return () => unsubscribe();
    }, [schoolId]);


    // 2B. Combined Data Fetcher (Pupils uses onSnapshot, Grades uses Caching)
    // NOTE: Pupils data (names/IDs) uses onSnapshot to ensure the list is always current.
    useEffect(() => {
        if (!academicYear || !selectedClass || !schoolId) {
            setPupils([]);
            setClassGradesData([]);
            return;
        }
        
        // 1. Fetch Pupils (Still using onSnapshot for real-time list accuracy)
        const pupilsQuery = query(
            collection(pupilLoginFetch, "PupilsReg"),
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

        // 2. Fetch Class Grades (Uses caching logic below)
        fetchClassGrades(academicYear, selectedClass, schoolId);

        return () => {
            pupilsUnsub();
            // No cleanup needed for fetchClassGrades since it uses getDocs/caching
        };
    }, [academicYear, selectedClass, schoolId]);


    // 2C. Fetch Class Grades with Localforage Cache Validation
    const CACHE_LIFETIME = 5 * 60 * 1000; // 5 minutes in milliseconds

    const fetchClassGrades = useCallback(async (year, className, sId) => {
        setLoading(true);
        const cacheKey = `${sId}_${year}_${className}_GRADES`;
        let shouldFetchFromDB = true;

        // 1. Check Cache
        try {
            const cachedData = await matrixStore.getItem(cacheKey);

            if (cachedData) {
                const { grades, timestamp } = cachedData;
                const now = new Date().getTime();

                if (now - timestamp < CACHE_LIFETIME) {
                    console.log("✅ Loaded grades from FRESH local cache (Skipping DB fetch)");
                    setClassGradesData(grades);
                    setLoading(false);
                    shouldFetchFromDB = false; // SKIP DB READ
                    return; 
                } else {
                    console.log("⚠️ Cached data is stale. Showing stale data while fetching...");
                    setClassGradesData(grades); // Show stale data immediately
                }
            }
        } catch (err) {
            console.error("❌ Error reading from cache", err);
        }
        
        // 2. Fetch from Database (Only if cache is stale or empty)
        if (shouldFetchFromDB) {
            try {
                const gradesQuery = query(
                    collection(schooldb, "PupilGrades"),
                    where("academicYear", "==", year),
                    where("schoolId", "==", sId),
                    where("className", "==", className)
                );
                
                const gradesSnapshot = await getDocs(gradesQuery); // ⬅️ ONE-TIME READ
                const gradesData = gradesSnapshot.docs.map((doc) => doc.data());

                setClassGradesData(gradesData);

                // 3. Update Cache with new data and timestamp
                await matrixStore.setItem(cacheKey, { grades: gradesData, timestamp: new Date().getTime() });

            } catch (err) {
                console.error("❌ Error fetching class grades from DB", err);
            } finally {
                setLoading(false);
            }
        } else {
            setLoading(false); // If we successfully served from a fresh cache
        }
    }, []);


    // 3. DATA TRANSFORMATION (Pivot Matrix Logic - remains the same structure)
    const { pupilMatrix } = useMemo(() => {
        if (classGradesData.length === 0 || pupils.length === 0) {
            return { pupilMatrix: [] };
        }
        
        // Subject fallback check
        if (!selectedSubject) {
            return { pupilMatrix: [] };
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

            const mean = count > 0 ? Math.round(total / count) : "—";

            return {
                studentID: pupil.studentID,
                studentName: pupil.studentName,
                test1: t1,
                test2: t2,
                mean: mean,
                rawMean: mean === "—" ? -1 : mean, 
                rank: "—",
            };
        });

        // 3. Calculate Rank
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

        const finalMatrix = matrix.map(p => {
            const ranked = rankablePupils.find(r => r.studentID === p.studentID);
            return {
                ...p,
                rank: ranked ? ranked.rank : "—"
            };
        });

        return { pupilMatrix: finalMatrix };
    }, [classGradesData, pupils, selectedSubject, selectedTerm, test1Name, test2Name]);

    // 4. HANDLERS & HELPERS (Unchanged)
    
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

    
    // 5. RENDER LOGIC (Unchanged)
    
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