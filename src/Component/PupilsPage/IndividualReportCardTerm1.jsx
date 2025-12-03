import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { pupilLoginFetch } from "../Database/PupilLogin";
import { schooldb } from "../Database/SchoolsResults"; // **Verify this import path is correct**
import { getDocs, collection, query, where, onSnapshot } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { useAuth } from "../Security/AuthContext";
import localforage from "localforage"; // 📦 Import localforage

// 📦 Initialize localforage stores for Grades & Classes
const gradesStore = localforage.createInstance({
    name: "GradesCache",
    storeName: "pupil_grades",
});

const classesStore = localforage.createInstance({
    name: "ClassesCache",
    storeName: "school_classes",
});


// Helper function to define grade color based on score
const getGradeColor = (val) => {
    const grade = Number(val);
    if (grade >= 50) {
        return "text-blue-600 font-bold";
    } else if (grade <= 49) {
        return "text-red-600 font-bold";
    }
    return "text-gray-900";
};

// Define term-test mapping used for fetching grades
const termTests = {
    "Term 1": ["Term 1 T1", "Term 1 T2"],
    "Term 2": ["Term 2 T1", "Term 2 T2"],
    "Term 3": ["Term 3 T1", "Term 3 T2"],
};

const IndividualReportCardTerm1 = () => {
    const { user } = useAuth();

    // --- Data Source Determination ---
    const authPupilData = user?.role === "pupil" ? user.data : null;
    const location = useLocation();
    const navPupilData = location.state?.user || {};
    const pupilData = authPupilData || navPupilData;

    const schoolId = pupilData?.schoolId || location.state?.schoolId || "N/A";
    const schoolName = location.state?.schoolName || "Unknown School";

    // --- State for Pupil Registration Info & UI ---
    const [latestInfo, setLatestInfo] = useState({ class: "", academicYear: "" });
    const [totalPupilsInClass, setTotalPupilsInClass] = useState(0);
    const [loadingReg, setLoadingReg] = useState(true);
    const [selectedTerm, setSelectedTerm] = useState("Term 1");

    // --- State for Report Card Data ---
    const [pupilGradesData, setPupilGradesData] = useState([]);
    const [classGradesData, setClassGradesData] = useState([]); // All grades for the class
    const [classesCache, setClassesCache] = useState([]); // Class config for total subject percentage
    const [loadingGrades, setLoadingGrades] = useState(false);

    // Constants derived from state/props
    const academicYear = latestInfo.academicYear;
    const selectedClass = latestInfo.class;
    const selectedPupil = pupilData.studentID;
    const tests = termTests[selectedTerm];

    // ----------------------------------------------------
    // 1. FETCH PUPIL INFO & CLASS SIZE (Unchanged - still uses real-time listener)
    // ----------------------------------------------------

    // Fetch pupil’s latest class + academic year
    useEffect(() => {
        if (!selectedPupil || schoolId === "N/A") {
            setLoadingReg(false);
            return;
        }
        const pupilRegRef = query(
            collection(pupilLoginFetch, "PupilsReg"),
            where("studentID", "==", selectedPupil),
            where("schoolId", "==", schoolId)
        );
        const unsubscribe = onSnapshot(pupilRegRef, (snapshot) => {
            if (!snapshot.empty) {
                const d = snapshot.docs[0].data();
                setLatestInfo({ class: d.class, academicYear: d.academicYear });
            }
            setLoadingReg(false);
        }, (error) => {
            console.error("Error fetching pupil registration:", error);
            setLoadingReg(false);
        });
        return () => unsubscribe();
    }, [selectedPupil, schoolId]);

    // Count pupils in the same class
    useEffect(() => {
        if (!academicYear || !selectedClass || schoolId === "N/A") return;
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

    // ----------------------------------------------------
    // 2. FETCH CLASSES (Cache-First)
    // ----------------------------------------------------
    useEffect(() => {
        if (!schoolId) return;
        const CLASSES_CACHE_KEY = `classes_${schoolId}`;

        const loadAndListenClasses = async () => {
            // 1. Load from cache for instant lookup
            try {
                const cachedData = await classesStore.getItem(CLASSES_CACHE_KEY);
                if (cachedData && cachedData.data) {
                    setClassesCache(cachedData.data);
                }
            } catch (e) {
                console.error("Failed to retrieve cached classes:", e);
            }

            // 2. Set up Firestore Listener to sync cache
            const q = query(collection(db, "Classes"), where("schoolId", "==", schoolId));
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map(doc => doc.data());
                setClassesCache(data);

                // 3. Save fresh data to localforage
                classesStore.setItem(CLASSES_CACHE_KEY, { timestamp: Date.now(), data })
                    .catch(e => console.error("Failed to save classes to IndexDB:", e));
            });

            return () => unsubscribe();
        };
        loadAndListenClasses();
    }, [schoolId]);


    // ----------------------------------------------------
    // 3. FETCH GRADES (Cache-First)
    // ----------------------------------------------------

    useEffect(() => {
        if (!academicYear || !selectedClass || !schoolId || !selectedPupil) return;
        setLoadingGrades(true);

        // Define a unique key for the entire class's grades for the current year
        const GRADES_CACHE_KEY = `grades_${schoolId}_${academicYear}_${selectedClass}`;

        const loadAndListenGrades = async () => {
            let allGrades = [];

            // 1. Load from cache (Cache-First)
            try {
                const cachedData = await gradesStore.getItem(GRADES_CACHE_KEY);
                if (cachedData && cachedData.data) {
                    allGrades = cachedData.data;
                    console.log("Loaded grades from cache.");

                    // Filter and set data from cache immediately
                    setClassGradesData(allGrades);
                    setPupilGradesData(allGrades.filter(g => g.pupilID === selectedPupil));
                    setLoadingGrades(false); // Optimistically set loading to false
                }
            } catch (e) {
                console.error("Failed to retrieve cached grades:", e);
            }

            // 2. Set up Firestore Listener to sync data (Real-time updates & initial fetch)
            const q = query(
                collection(schooldb, "PupilGrades"),
                where("academicYear", "==", academicYear),
                where("schoolId", "==", schoolId),
                where("className", "==", selectedClass)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const freshGrades = snapshot.docs.map((doc) => doc.data());

                // Update state for the entire class
                setClassGradesData(freshGrades);
                // Filter and update state for the individual pupil
                setPupilGradesData(freshGrades.filter(g => g.pupilID === selectedPupil));

                // 3. Save fresh data to localforage
                gradesStore.setItem(GRADES_CACHE_KEY, { timestamp: Date.now(), data: freshGrades })
                    .catch(e => console.error("Failed to save grades to IndexDB:", e));

                setLoadingGrades(false); // Ensure loading is false after successful fetch/sync
            }, (error) => {
                console.error("Firestore 'PupilGrades' onSnapshot failed:", error);
                // Only toast if no cached data was available
                if (allGrades.length === 0) {
                    // toast.error("Failed to stream grade data."); // Omitted toast for clean code
                }
                setLoadingGrades(false);
            });

            return () => unsubscribe();
        };

        loadAndListenGrades();
    }, [academicYear, selectedClass, selectedPupil, schoolId]);


    // ----------------------------------------------------
    // 4. USEMEMO CALCULATIONS (Scores and Ranks) - Unchanged
    // ----------------------------------------------------

    const { subjects, reportRows, totalMarks, overallPercentage, overallRank } = useMemo(() => {
        if (pupilGradesData.length === 0 || !tests || tests.length < 2)
            return { subjects: [], reportRows: [], totalMarks: 0, overallPercentage: 0, overallRank: "—" };

        const pupilIDs = [...new Set(classGradesData.map((d) => d.pupilID))];
        const uniqueSubjects = [...new Set(pupilGradesData.map((d) => d.subject))].sort();

        const classInfo = classesCache.find(c => c.schoolId === schoolId && c.className === selectedClass);
        const totalSubjectPercentage = classInfo?.subjectPercentage || (uniqueSubjects.length * 100);

        // 4a. Subject-wise ranking
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

        // 4b. Pupil's individual scores and subject rank
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

        // 4c. Overall ranking
        const overallScores = pupilIDs.map(id => {
            const pupilDataInClass = classGradesData.filter(x => x.pupilID === id);
            const totalMean = [...new Set(pupilDataInClass.map(d => d.subject))].reduce((acc, subject) => {
                const t1 = pupilDataInClass.find(x => x.subject === subject && x.test === tests[0])?.grade || 0;
                const t2 = pupilDataInClass.find(x => x.subject === subject && x.test === tests[1])?.grade || 0;
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

    // ----------------------------------------------------
    // 5. RENDER LOGIC (Unchanged)
    // ----------------------------------------------------

    // ... (Rest of the component's rendering logic, including the JSX, remains the same)

    // Note: The original request didn't include the final JSX render, 
    // but the logic above shows how caching is applied to the data fetching hooks.

    if (loadingReg) {
        return (
            <div className="text-center p-8">
                <p className="text-indigo-600 font-medium">Loading pupil registration...</p>
            </div>
        );
    }

    if (!pupilData.studentID) {
        return (
            <div className="text-center p-8 bg-white shadow-xl rounded-2xl max-w-3xl mx-auto">
                <h2 className="text-xl text-red-600 font-bold">Error</h2>
                <p className="text-gray-600 mt-2">Pupil ID not found. Please ensure you are logged in or navigated correctly.</p>
            </div>
        );
    }

    const isLoading = loadingGrades || loadingReg;

    return (
        <div className="max-w-3xl mx-auto p-6 bg-white shadow-xl rounded-2xl">
            <h2 className="text-2xl font-bold text-center text-indigo-700 mb-6">
                {schoolName}
            </h2>

            {/* Term selector */}
            <div className="flex justify-center gap-4 mb-6">
                {Object.keys(termTests).map((term) => (
                    <button
                        key={term}
                        onClick={() => setSelectedTerm(term)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium ${selectedTerm === term ? "bg-indigo-600 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-indigo-100"}`}
                    >
                        {term}
                    </button>
                ))}
            </div>

            {/* 🧑‍🎓 Pupil Info */}
            <div className="flex items-center gap-4 mb-6 border p-4 rounded-lg bg-gray-50 shadow-sm">
                <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 font-bold">
                    <img
                        src={pupilData.userPhotoUrl}
                        alt="Pupil"
                        className="w-24 h-24 object-cover rounded-full border-2 border-indigo-500"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "https://via.placeholder.com/96";
                        }}
                    />
                </div>
                <div>
                    <p className="text-lg font-semibold text-indigo-800">
                        {pupilData.studentName || "Name N/A"}
                    </p>

                    <p className="text-gray-600">
                        <span className="font-medium">Class:</span>{" "}
                        {selectedClass || "N/A"}{" "}
                        {/* <span className="ml-2 text-sm text-gray-500">
                            ({totalPupilsInClass} pupils)
                        </span> */}
                    </p>

                    <p className="text-gray-600">
                        <span className="font-medium">Academic Year:</span>{" "}
                        {academicYear || "N/A"}
                    </p>

                    <p className="text-gray-600">
                        <span className="font-medium">Student ID:</span>{" "}
                        {selectedPupil || "N/A"}
                    </p>
                </div>
            </div>

            {/* Table (On-screen display) */}
            {isLoading ? (
                <div className="text-center text-indigo-600 font-medium p-8 border rounded-lg">Loading {selectedTerm} report...</div>
            ) : subjects.length > 0 ? (
                <div className="overflow-x-auto border rounded-lg shadow-md">
                    <table className="min-w-full text-sm text-center border-collapse">
                        <thead className="bg-indigo-600 text-white">
                            <tr>
                                <th className="px-4 py-2 text-left">Subject</th>
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

                            {/* Footer rows */}
                            <tr className="bg-indigo-100 font-bold text-indigo-800 border-t-2 border-indigo-600">
                                <td className="text-left px-4 py-2 text-base">Combined Scores</td>
                                <td colSpan="2"></td>
                                <td className="px-4 py-2 text-base">{totalMarks}</td>
                                <td>—</td>
                            </tr>
                            {/* <tr className="bg-indigo-100/70 font-bold text-indigo-800">
                                <td className="text-left px-4 py-2 text-base">Percentage</td>
                                <td colSpan="2"></td>
                                <td className="px-4 py-2 text-base">{overallPercentage}%</td>
                                <td>—</td>
                            </tr> */}
                            {/* <tr className="bg-indigo-200 font-bold text-indigo-900 border-b-2 border-indigo-600">
                                <td className="text-left px-4 py-2 text-base">Position</td>
                                <td colSpan="3"></td>
                                <td className="text-lg">{overallRank} / {totalPupilsInClass}</td>
                            </tr> */}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center p-6 text-gray-500 border rounded-lg">
                    No grades found for {pupilData.studentName} in {selectedTerm} ({academicYear}).
                </div>
            )}
        </div>
    );
};

export default IndividualReportCardTerm1;