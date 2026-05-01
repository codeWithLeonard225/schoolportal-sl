import React, { useState, useEffect, useMemo, useCallback } from "react";
import { schooldb } from "../../Database/SchoolsResults";
import { pupilLoginFetch } from "../../Database/PupilLogin";
import { db } from "../../../../firebase"; // Ensure this import is active
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
import localforage from "localforage";
import { useAuth } from "../../Security/AuthContext";

const matrixStore = localforage.createInstance({
    name: "SubMatrixCache",
    storeName: "classGrades",
});

const GradeSheet = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";
    const { user } = useAuth();

    // 1. STATE MANAGEMENT
    const [liveTeacherInfo, setLiveTeacherInfo] = useState(null); // Live teacher data
    const [academicYear, setAcademicYear] = useState("");
    const [academicYears, setAcademicYears] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [availableClasses, setAvailableClasses] = useState([]);
    const [pupils, setPupils] = useState([]);
    const [classGradesData, setClassGradesData] = useState([]);
    const [selectedTerm, setSelectedTerm] = useState("Term 1");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [subjectOptions, setSubjectOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const tableRef = React.useRef(null);

    // Derived values for the UI
    const isFormTeacher = liveTeacherInfo?.isFormTeacher ?? user?.data?.isFormTeacher;
    const assignedClass = liveTeacherInfo?.assignClass ?? user?.data?.assignClass;

    const termTests = {
        "Term 1": ["Term 1 T1", "Term 1 T2"],
        "Term 2": ["Term 2 T1", "Term 2 T2"],
        "Term 3": ["Term 3 T1", "Term 3 T2"],
    };

    const tests = termTests[selectedTerm];
    const test1Name = tests[0];
    const test2Name = tests[1];

    // --- 2. DATA FETCHING HOOKS ---

    // 2A. Real-time Teacher Info Listener
    useEffect(() => {
        if (!user?.data?.teacherID || !schoolId) return;

        const q = query(
            collection(db, "Teachers"),
            where("teacherID", "==", user.data.teacherID),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                setLiveTeacherInfo({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
            } else {
                setLiveTeacherInfo(null);
            }
        });

        return () => unsubscribe();
    }, [user, schoolId]);

    // 2B. Fetch academic years and classes (Updated with real-time lock logic)
    useEffect(() => {
        if (!schoolId) return;

        const q = query(collection(schooldb, "PupilGrades"), where("schoolId", "==", schoolId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => doc.data());
            const years = [...new Set(data.map((d) => d.academicYear))].sort().reverse();
            const classes = [...new Set(data.map((d) => d.className))].sort();
            const subjects = [...new Set(data.map((d) => d.subject))].sort();

            setAcademicYears(years);
            setSubjectOptions(subjects);

            if (years.length > 0 && !academicYear) setAcademicYear(years[0]);
            if (subjects.length > 0 && !selectedSubject) setSelectedSubject(subjects[0]);

            // 🔥 REAL-TIME CLASS LOCK LOGIC
            if (isFormTeacher && assignedClass) {
                setSelectedClass(assignedClass);
                setAvailableClasses([assignedClass]);
            } else {
                setAvailableClasses(classes);
                if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]);
            }
        });

        return () => unsubscribe();
    }, [schoolId, isFormTeacher, assignedClass]); // Re-run if teacher assignment changes

    // 2C. Fetch Pupils & Grades (Remains largely the same, optimized for context)
    useEffect(() => {
        if (!academicYear || !selectedClass || !schoolId) {
            setPupils([]);
            setClassGradesData([]);
            return;
        }

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

        fetchClassGrades(academicYear, selectedClass, schoolId);

        return () => pupilsUnsub();
    }, [academicYear, selectedClass, schoolId]);

    const fetchClassGrades = useCallback(async (year, className, sId) => {
        setLoading(true);
        const cacheKey = `${sId}_${year}_${className}_GRADES`;
        
        try {
            const cachedData = await matrixStore.getItem(cacheKey);
            const now = new Date().getTime();
            const CACHE_LIFETIME = 10000; // 10 seconds for testing

            if (cachedData && (now - cachedData.timestamp < CACHE_LIFETIME)) {
                setClassGradesData(cachedData.grades);
                setLoading(false);
                return;
            }

            const gradesQuery = query(
                collection(schooldb, "PupilGrades"),
                where("academicYear", "==", year),
                where("schoolId", "==", sId),
                where("className", "==", className)
            );
            
            const gradesSnapshot = await getDocs(gradesQuery);
            const gradesData = gradesSnapshot.docs.map((doc) => doc.data());

            setClassGradesData(gradesData);
            await matrixStore.setItem(cacheKey, { grades: gradesData, timestamp: now });
        } catch (err) {
            console.error("Error fetching grades:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // 3. MATRIX LOGIC (Pivoting data)
    const { pupilMatrix } = useMemo(() => {
        if (classGradesData.length === 0 || pupils.length === 0 || !selectedSubject) {
            return { pupilMatrix: [] };
        }

        const relevantGrades = classGradesData.filter(
            (g) => g.subject === selectedSubject && (g.test === test1Name || g.test === test2Name)
        );

        const matrix = pupils.map((pupil) => {
            const pupilGrades = relevantGrades.filter((g) => g.pupilID === pupil.studentID);
            const t1 = pupilGrades.find((g) => g.test === test1Name)?.grade || "—";
            const t2 = pupilGrades.find((g) => g.test === test2Name)?.grade || "—";

            let total = 0, count = 0;
            if (t1 !== "—") { total += Number(t1); count++; }
            if (t2 !== "—") { total += Number(t2); count++; }

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

        const rankablePupils = matrix
            .filter((p) => p.rawMean !== -1)
            .sort((a, b) => b.rawMean - a.rawMean);

        let currentRank = 1, rankCount = 0;
        rankablePupils.forEach((item, index) => {
            rankCount++;
            if (index > 0 && item.rawMean < rankablePupils[index - 1].rawMean) {
                currentRank = rankCount;
            }
            item.rank = currentRank;
        });

        return {
            pupilMatrix: matrix.map(p => ({
                ...p,
                rank: rankablePupils.find(r => r.studentID === p.studentID)?.rank || "—"
            }))
        };
    }, [classGradesData, pupils, selectedSubject, selectedTerm]);

    const getGradeColor = (val) => {
        const grade = Number(val);
        if (isNaN(grade) || val === "—") return "text-gray-500";
        return grade >= 50 ? "text-blue-600 font-bold" : "text-red-600 font-bold";
    };

    const handlePrintPDF = () => {
        const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "A4" });
        doc.setFontSize(16).text(`Grade Matrix: ${selectedClass} (${academicYear})`, 40, 30);
        doc.setFontSize(12).text(`Subject: ${selectedSubject} - ${selectedTerm}`, 40, 50);

        const tableData = pupilMatrix.map((p) => [p.studentName, p.test1, p.test2, p.mean, p.rank]);
        autoTable(doc, {
            startY: 70,
            head: [["Pupil Name", test1Name.split(' ').pop(), test2Name.split(' ').pop(), "Mean", "Rank"]],
            body: tableData,
            theme: "striped",
            headStyles: { fillColor: [63, 81, 181] },
        });
        doc.save(`${selectedClass}_Matrix.pdf`);
    };

    return (
        <div className="max-w-6xl mx-auto p-6 bg-white shadow-xl rounded-2xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-indigo-700">Class Grade Matrix</h2>
                {isFormTeacher && (
                    <span className="bg-green-100 text-green-700 px-4 py-1 rounded-full text-xs font-bold border border-green-200">
                        🔒 LOCKED TO: {assignedClass}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg bg-indigo-50">
                <div>
                    <label className="font-semibold text-gray-700 block mb-1 text-xs">YEAR</label>
                    <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                        {academicYears.map((y) => <option key={y}>{y}</option>)}
                    </select>
                </div>

                <div>
                    <label className="font-semibold text-gray-700 block mb-1 text-xs">CLASS</label>
                    <select 
                        value={selectedClass} 
                        onChange={(e) => setSelectedClass(e.target.value)} 
                        disabled={isFormTeacher}
                        className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
                    >
                        {availableClasses.map((c) => <option key={c}>{c}</option>)}
                    </select>
                </div>

                <div>
                    <label className="font-semibold text-gray-700 block mb-1 text-xs">TERM</label>
                    <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                        {Object.keys(termTests).map((term) => <option key={term}>{term}</option>)}
                    </select>
                </div>

                <div>
                    <label className="font-semibold text-gray-700 block mb-1 text-xs">SUBJECT</label>
                    <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                        {subjectOptions.map((s) => <option key={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex justify-end mb-6">
                <button
                    onClick={handlePrintPDF}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-md disabled:bg-gray-400 flex items-center transition"
                    disabled={loading || pupilMatrix.length === 0}
                >
                    PDF Export
                </button>
            </div>

            {loading ? (
                <div className="text-center text-indigo-600 font-medium p-8">Loading Records...</div>
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
                                    <td className="text-left px-4 py-2 font-semibold text-gray-800">{pupil.studentName}</td>
                                    <td className={`px-4 py-2 ${getGradeColor(pupil.test1)}`}>{pupil.test1}</td>
                                    <td className={`px-4 py-2 ${getGradeColor(pupil.test2)}`}>{pupil.test2}</td>
                                    <td className={`px-4 py-2 font-bold ${getGradeColor(pupil.mean)}`}>{pupil.mean}</td>
                                    <td className="px-4 py-2 font-bold text-red-600">{pupil.rank}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center p-8 bg-yellow-50 text-yellow-800 border border-yellow-300 rounded-lg">
                    No grade data found for the selection.
                </div>
            )}
        </div>
    );
};

export default GradeSheet;