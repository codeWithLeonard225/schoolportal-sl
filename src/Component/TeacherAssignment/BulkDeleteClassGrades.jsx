import React, { useState, useEffect } from "react";
import localforage from "localforage";
import { schooldb } from "../Database/SchoolsResults";
import {
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    doc,
    onSnapshot
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";

// Initialize localforage store for cache clearing
const gradeStore = localforage.createInstance({
    name: "TeacherDataCache",
    storeName: "teacher_grades",
});

const BulkDeleteClassGrades = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [academicYear, setAcademicYear] = useState("");
    const [academicYears, setAcademicYears] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [availableClasses, setAvailableClasses] = useState([]);
    const [selectedTest, setSelectedTest] = useState("All Tests");
    const [gradesCount, setGradesCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const tests = ["All Tests", "Term 1 T1", "Term 1 T2", "Term 2 T1", "Term 2 T2", "Term 3 T1", "Term 3 T2"];

    // 1. Fetch available Academic Years and Classes for this School
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

    // 2. Count existing grade records matching selected filters
    useEffect(() => {
        if (!schoolId || !academicYear || !selectedClass) {
            setGradesCount(0);
            return;
        }

        const fetchGradesCount = async () => {
            setLoading(true);
            try {
                let qConstraints = [
                    where("schoolId", "==", schoolId),
                    where("academicYear", "==", academicYear),
                    where("className", "==", selectedClass),
                ];

                if (selectedTest !== "All Tests") {
                    qConstraints.push(where("test", "==", selectedTest));
                }

                const gradesQuery = query(collection(schooldb, "PupilGrades"), ...qConstraints);
                const snapshot = await getDocs(gradesQuery);
                setGradesCount(snapshot.size);
            } catch (error) {
                console.error("Error checking grades count:", error);
                toast.error("Failed to load grades summary.");
            } finally {
                setLoading(false);
            }
        };

        fetchGradesCount();
    }, [schoolId, academicYear, selectedClass, selectedTest]);

    // 3. Bulk Delete Functionality (Batched Deletes)
    const handleBulkDelete = async () => {
        if (!schoolId || !academicYear || !selectedClass) {
            toast.error("Please select a valid school, class, and academic year.");
            return;
        }

        if (gradesCount === 0) {
            toast.warn("No grades found matching the selected criteria to delete.");
            return;
        }

        const confirmMsg = selectedTest === "All Tests"
            ? `⚠️ WARNING: You are about to DELETE ALL ${gradesCount} GRADES for Class '${selectedClass}' across the entire academic year (${academicYear}).\n\nThis action cannot be undone. Are you sure?`
            : `⚠️ WARNING: You are about to DELETE ${gradesCount} grade records for Class '${selectedClass}' in '${selectedTest}' (${academicYear}).\n\nAre you sure you want to proceed?`;

        if (!window.confirm(confirmMsg)) return;

        setDeleting(true);

        try {
            // Build Query
            let qConstraints = [
                where("schoolId", "==", schoolId),
                where("academicYear", "==", academicYear),
                where("className", "==", selectedClass),
            ];

            if (selectedTest !== "All Tests") {
                qConstraints.push(where("test", "==", selectedTest));
            }

            const gradesQuery = query(collection(schooldb, "PupilGrades"), ...qConstraints);
            const snapshot = await getDocs(gradesQuery);

            if (snapshot.empty) {
                toast.warn("No records found to delete.");
                setDeleting(false);
                return;
            }

            // Firestore batches allow maximum 500 operations per batch
            const BATCH_LIMIT = 500;
            let currentBatch = writeBatch(schooldb);
            let operationCount = 0;

            for (const docSnap of snapshot.docs) {
                currentBatch.delete(doc(schooldb, "PupilGrades", docSnap.id));
                operationCount++;

                // Commit batch when reaching limit
                if (operationCount === BATCH_LIMIT) {
                    await currentBatch.commit();
                    currentBatch = writeBatch(schooldb);
                    operationCount = 0;
                }
            }

            // Commit any remaining operations
            if (operationCount > 0) {
                await currentBatch.commit();
            }

            // Clear local cache for this combination
            if (selectedTest === "All Tests") {
                tests.forEach(async (t) => {
                    const cacheKey = `${schoolId}-${academicYear}-${selectedClass}-${t}-grades`;
                    await gradeStore.removeItem(cacheKey);
                });
            } else {
                const cacheKey = `${schoolId}-${academicYear}-${selectedClass}-${selectedTest}-grades`;
                await gradeStore.removeItem(cacheKey);
            }

            toast.success(`🗑️ Successfully deleted ${snapshot.size} grade records for ${selectedClass}!`);
            setGradesCount(0);

        } catch (error) {
            console.error("Error bulk deleting grades:", error);
            toast.error("❌ Failed to perform bulk delete. Please try again.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-xl border border-gray-100 mt-8">
            <h2 className="text-3xl font-bold mb-2 text-center text-red-600">
                Bulk Delete Class Grades
            </h2>
            <p className="text-gray-500 text-center mb-6">
                Remove all student grades for an entire class or specific test assessment in bulk.
            </p>

            <hr className="mb-6" />

            {/* Selection Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-4 border rounded-xl bg-red-50/40">
                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Academic Year:</label>
                    <select
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white shadow-sm focus:ring-2 focus:ring-red-400 outline-none"
                    >
                        {academicYears.map((year, i) => (
                            <option key={i} value={year}>{year}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Class:</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white shadow-sm focus:ring-2 focus:ring-red-400 outline-none"
                    >
                        {availableClasses.map((c, i) => (
                            <option key={i} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="font-semibold text-gray-700 block mb-1">Assessment Target:</label>
                    <select
                        value={selectedTest}
                        onChange={(e) => setSelectedTest(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 bg-white shadow-sm focus:ring-2 focus:ring-red-400 outline-none"
                    >
                        {tests.map((t, i) => (
                            <option key={i} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Impact Summary & Delete Action */}
            <div className="bg-gray-50 border rounded-xl p-6 text-center shadow-inner">
                {loading ? (
                    <div className="text-gray-600 font-medium">Checking matching grades in database...</div>
                ) : (
                    <div>
                        <p className="text-lg text-gray-700 mb-2">
                            Found <span className="font-bold text-red-600 text-xl">{gradesCount}</span> grade record(s) for{" "}
                            <span className="font-semibold text-gray-900">{selectedClass}</span> (
                            <span className="font-semibold text-gray-900">{selectedTest}</span> - {academicYear}).
                        </p>

                        <button
                            onClick={handleBulkDelete}
                            disabled={deleting || gradesCount === 0}
                            className={`mt-4 px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 mx-auto ${
                                deleting || gradesCount === 0
                                    ? "bg-gray-400 cursor-not-allowed opacity-60"
                                    : "bg-red-600 hover:bg-red-700 active:scale-95 hover:shadow-xl"
                            }`}
                        >
                            {deleting ? (
                                <>
                                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                                    Deleting Grades...
                                </>
                            ) : (
                                <>🗑️ Bulk Delete {gradesCount} Grades</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkDeleteClassGrades;