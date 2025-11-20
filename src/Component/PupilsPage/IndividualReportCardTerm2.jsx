import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
// Assuming you have a separate Firestore instance for grades/results as 'schooldb'
import { schooldb } from "../Database/SchoolsResults"; 
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { useAuth } from "../Security/AuthContext"; 

// --- Configuration ---
// Define the term-to-test mapping outside the component
const termTests = {
    "Term 1": ["Term 1 T1", "Term 1 T2"],
    "Term 2": ["Term 2 T1", "Term 2 T2"], // Defaults to these tests
    "Term 3": ["Term 3 T1", "Term 3 T2"],
};

const IndividualReportCardTerm2 = () => {
    // 1. Core Data Extraction (from Auth Context & Location State)
    const { user } = useAuth();
    const location = useLocation();

    // Determine the target pupil data
    const authPupilData = user?.role === "pupil" ? user.data : null;
    const navPupilData = location.state?.user || {};
    const pupilData = authPupilData || navPupilData; 
    
    // Determine school context
    const schoolId = pupilData?.schoolId || location.state?.schoolId || user?.schoolId || "N/A";
    const schoolName = location.state?.schoolName || user?.schoolName || "Unknown School";

    const studentID = pupilData.studentID; 
    
    // --- State Management ---
    const [loading, setLoading] = useState(true);
    const [classesCache, setClassesCache] = useState([]);
    const [pupilGradesData, setPupilGradesData] = useState([]);
    const [classGradesData, setClassGradesData] = useState([]);
    
    // Auto-determined info based on pupil's current registration
    const [latestInfo, setLatestInfo] = useState({ class: "", academicYear: "" });
    const [totalPupilsInClass, setTotalPupilsInClass] = useState(0);

    // ⭐ Report Card UI State: CHANGE DEFAULT TERM TO "Term 2"
    const [selectedTerm, setSelectedTerm] = useState("Term 2"); 

    // Variables for useMemo dependency:
    const selectedPupil = studentID; // The pupil being viewed
    const selectedClass = latestInfo.class; 
    const academicYear = latestInfo.academicYear;
    const tests = termTests[selectedTerm];


    // --- 2. Data Fetching Hooks (Unchanged) ---

    // A. Fetch Classes Configuration Cache (for subjectPercentage)
    useEffect(() => {
        if (!schoolId || schoolId === "N/A") return;
        const fetchClasses = async () => {
            const snapshot = await getDocs(query(collection(db, "Classes"), where("schoolId", "==", schoolId)));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), className: doc.data().class })); // Ensure 'className' is present
            setClassesCache(data);
        };
        fetchClasses();
    }, [schoolId]);

    // B. Fetch pupil’s current class & academic year (from PupilsReg)
    useEffect(() => {
        if (!studentID || schoolId === "N/A") {
            setLoading(false);
            return;
        }

        const pupilRegRef = query(
            collection(db, "PupilsReg"),
            where("studentID", "==", studentID),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(pupilRegRef, (snapshot) => {
            if (!snapshot.empty) {
                const d = snapshot.docs[0].data();
                setLatestInfo({
                    class: d.class,
                    academicYear: d.academicYear,
                });
            } else {
                 setLoading(false); 
            }
        }, (error) => {
            console.error("Error fetching pupil registration:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [studentID, schoolId]);

    // C. Count total pupils in the pupil's class
    useEffect(() => {
        if (!academicYear || !selectedClass || schoolId === "N/A") return;

        const pupilsRef = query(
            collection(db, "PupilsReg"),
            where("academicYear", "==", academicYear),
            where("class", "==", selectedClass),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(pupilsRef, (snapshot) => {
            setTotalPupilsInClass(snapshot.size);
        });

        return () => unsubscribe();
    }, [academicYear, selectedClass, schoolId]);

    // D. Fetch Pupil's and Class's Grades (from PupilGrades)
    useEffect(() => {
        if (!academicYear || !selectedClass || !studentID || schoolId === "N/A") return;

        setLoading(true);

        const classGradesRef = query(
            collection(schooldb, "PupilGrades"), 
            where("academicYear", "==", academicYear),
            where("className", "==", selectedClass),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(classGradesRef, (snapshot) => {
            const allGrades = snapshot.docs.map((doc) => doc.data());
            
            // Filter grades for the current pupil
            setPupilGradesData(allGrades.filter(g => g.pupilID === studentID)); 
            
            // Keep all grades for the class for ranking calculation
            setClassGradesData(allGrades); 
            setLoading(false);
        }, (error) => {
             console.error("Error fetching grades:", error);
             setLoading(false);
        });

        return () => unsubscribe();
    }, [academicYear, selectedClass, studentID, schoolId]);


    // --- 3. Calculation Logic (useMemo - Unchanged) ---
    const { subjects, reportRows, totalMarks, overallPercentage, overallRank } = useMemo(() => {
        if (pupilGradesData.length === 0)
            return { subjects: [], reportRows: [], totalMarks: 0, overallPercentage: 0, overallRank: "—" };

        const pupilIDs = [...new Set(classGradesData.map((d) => d.pupilID))];

        // Subjects list
        const uniqueSubjects = [...new Set(pupilGradesData.map((d) => d.subject))].sort();

        // Fetch subjectPercentage for selected class
        const classInfo = classesCache.find(c => c.schoolId === schoolId && c.className === selectedClass);
        const totalSubjectPercentage = classInfo?.subjectPercentage || (uniqueSubjects.length * 100); 

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
            return { subject, test1: Number(t1), test2: Number(t2), mean, rank };
        });

        // Compute overall rank & percentage
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
    }, [pupilGradesData, classGradesData, selectedPupil, selectedTerm, selectedClass, classesCache, schoolId, tests]);


    // --- 4. Helper Function (Unchanged) ---
    const getGradeColor = (val) => {
        const grade = Number(val);
        if (grade >= 50) {
            return "text-blue-600 font-bold";
        } else if (grade <= 49) {
            return "text-red-600 font-bold";
        }
        return "text-gray-900";
    };

    // --- 5. Render Logic (Unchanged) ---
    
    // Initial check for mandatory ID
    if (!studentID) {
        return (
            <div className="text-center p-8 bg-white shadow-xl rounded-2xl max-w-3xl mx-auto">
                <h2 className="text-xl text-red-600 font-bold">Error</h2>
                <p className="text-gray-600 mt-2">Pupil ID not found. Please ensure you are logged in or navigated correctly.</p>
            </div>
        );
    }
    
    // Loading State
    if (loading) {
        return (
            <div className="text-center p-8">
                <p className="text-indigo-600 font-medium">Loading pupil registration and grades...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white shadow-xl rounded-2xl">
            <h2 className="text-2xl font-bold text-center text-indigo-700 mb-6">
                {schoolName} - Report Card
            </h2>
            
            {/* 🧑‍🎓 Pupil Info & Term Selector */}
            <div className="flex justify-between items-center gap-4 mb-6 border p-4 rounded-lg bg-gray-50 shadow-sm">
                <div className="flex items-center gap-4">
                    {pupilData.userPhotoUrl ? (
                        <img
                            src={pupilData.userPhotoUrl}
                            alt="Pupil"
                            className="w-20 h-20 object-cover rounded-full border-2 border-indigo-500"
                            onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/80"; }}
                        />
                    ) : (
                        <div className="w-20 h-20 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 font-bold">No Photo</div>
                    )}
                    <div>
                        <p className="text-lg font-semibold text-indigo-800">
                            {pupilData.studentName || "Name N/A"}
                        </p>
                        <p className="text-gray-600 text-sm">
                            <span className="font-medium">Class:</span> {selectedClass || "N/A"} ({totalPupilsInClass} pupils)
                        </p>
                        <p className="text-gray-600 text-sm">
                            <span className="font-medium">Academic Year:</span> {academicYear || "N/A"}
                        </p>
                    </div>
                </div>

                {/* Term Selector */}
                <div className="flex flex-col items-end space-y-2">
                    <label className="text-sm font-medium text-gray-700">Select Term:</label>
                    <select
                        value={selectedTerm}
                        onChange={(e) => setSelectedTerm(e.target.value)}
                        className="p-2 border border-indigo-300 rounded-lg bg-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        {Object.keys(termTests).map(term => (
                            <option key={term} value={term}>{term}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* --- Report Card Table --- */}
            {subjects.length > 0 ? (
                <div className="overflow-x-auto border rounded-lg shadow-md">
                    <table className="min-w-full text-sm text-center border-collapse">
                        <thead className="bg-indigo-600 text-white">
                            <tr>
                                <th className="px-4 py-2 text-left">Subject</th>
                                {/* Use the last part of the test name for cleaner UI headers */}
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

                            {/* Footer rows (Summary) */}
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
                                <td className="text-left px-4 py-3 text-lg">Position</td>
                                <td colSpan="3"></td>
                                <td className="px-4 py-3 text-xl">{overallRank} / {totalPupilsInClass}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center p-6 text-gray-500 border rounded-lg">
                    No grades found for **{pupilData.studentName}** in **{selectedTerm}** ({academicYear}).
                </div>
            )}
        </div>
    );
};

export default IndividualReportCardTerm2;