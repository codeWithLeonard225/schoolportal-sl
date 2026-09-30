import React, { useState, useEffect } from "react";
import { db } from "../../../firebase"; // Main Firestore db instance
import { pupilLoginFetch } from "../Database/PupilLogin"; // Secondary Pupil Login db instance
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    writeBatch
} from "firebase/firestore";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
import { useAuth } from "../Security/AuthContext";

const ClassReconciler = () => {
    const location = useLocation();
    const { user } = useAuth();

    // Consolidated School ID
    const currentSchoolId = location.state?.schoolId || user?.schoolId || "N/A";

    // Dropdown Data
    const [currentClassOptions, setCurrentClassOptions] = useState([]); // From PupilsReg
    const [newClassOptions, setNewClassOptions] = useState([]);         // From Classes collection
    const [academicYears, setAcademicYears] = useState([]);             // From PupilsReg

    // Selection Filters & Inputs
    const [selectedOldClass, setSelectedOldClass] = useState("");
    const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
    const [selectedNewClass, setSelectedNewClass] = useState("");

    // Pupil List State
    const [pupils, setPupils] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // 1. Fetch CURRENT class options & Academic Years directly from 'PupilsReg'
    useEffect(() => {
        if (!currentSchoolId || currentSchoolId === "N/A") return;

        const pupilsRef = collection(pupilLoginFetch, "PupilsReg");
        const q = query(pupilsRef, where("schoolId", "==", currentSchoolId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const classesSet = new Set();
            const yearsSet = new Set();

            snapshot.docs.forEach((doc) => {
                const data = doc.data();
                if (data.class) classesSet.add(data.class);
                if (data.academicYear) yearsSet.add(data.academicYear);
            });

            setCurrentClassOptions(Array.from(classesSet).sort((a, b) => a.localeCompare(b)));
            setAcademicYears(Array.from(yearsSet).sort());
        }, (err) => console.error("Error fetching PupilsReg options:", err));

        return () => unsubscribe();
    }, [currentSchoolId]);

    // 2. Fetch NEW class options directly from 'Classes' collection
    useEffect(() => {
        if (!currentSchoolId || currentSchoolId === "N/A") return;

        const classesRef = collection(db, "Classes");
        const q = query(classesRef, where("schoolId", "==", currentSchoolId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const options = snapshot.docs
                .map((doc) => doc.data().className)
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));
                
            setNewClassOptions(options);
        }, (err) => console.error("Error fetching Classes collection:", err));

        return () => unsubscribe();
    }, [currentSchoolId]);

    // 3. Query affected pupils when Current Class & Academic Year are chosen
    useEffect(() => {
        if (!selectedOldClass || !selectedAcademicYear || currentSchoolId === "N/A") {
            setPupils([]);
            return;
        }

        setLoading(true);
        const pupilsRef = collection(pupilLoginFetch, "PupilsReg");
        const q = query(
            pupilsRef,
            where("schoolId", "==", currentSchoolId),
            where("class", "==", selectedOldClass),
            where("academicYear", "==", selectedAcademicYear)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPupils = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort alphabetically by student name
            fetchedPupils.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));

            setPupils(fetchedPupils);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching matching pupils:", err);
            toast.error("Failed to load pupils for reconciliation.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentSchoolId, selectedOldClass, selectedAcademicYear]);

    // 4. Batch update selected pupils to the new class name
    const handleBatchClassUpdate = async (e) => {
        e.preventDefault();

        if (!selectedOldClass) return toast.error("Please select the current class.");
        if (!selectedAcademicYear) return toast.error("Please select an academic year.");
        if (!selectedNewClass) return toast.error("Please select the new class name.");

        if (selectedOldClass === selectedNewClass) {
            return toast.warn("The new class name is identical to the current class name.");
        }
        if (pupils.length === 0) {
            return toast.warn("No pupils found matching the selected criteria.");
        }

        if (
            !window.confirm(
                `Are you sure you want to update ${pupils.length} pupil(s) from "${selectedOldClass}" to "${selectedNewClass}" for Academic Year ${selectedAcademicYear}?`
            )
        ) {
            return;
        }

        setIsUpdating(true);

        try {
            // Process in chunks of 250 (since 2 operations per pupil = 500 max batch size)
            const CHUNK_SIZE = 250;

            for (let i = 0; i < pupils.length; i += CHUNK_SIZE) {
                const chunk = pupils.slice(i, i + CHUNK_SIZE);

                const mainBatch = writeBatch(db);
                const loginBatch = writeBatch(pupilLoginFetch);

                chunk.forEach((pupil) => {
                    const mainRef = doc(db, "PupilsReg", pupil.id);
                    const loginRef = doc(pupilLoginFetch, "PupilsReg", pupil.id);

                    mainBatch.update(mainRef, { class: selectedNewClass });
                    loginBatch.update(loginRef, { class: selectedNewClass });
                });

                await mainBatch.commit();
                await loginBatch.commit();
            }

            toast.success(`Successfully updated ${pupils.length} pupil(s) to "${selectedNewClass}"!`);

            // Reset inputs & switch selected class to reflect change
            setSelectedOldClass(selectedNewClass);
            setSelectedNewClass("");
        } catch (error) {
            console.error("Batch update error:", error);
            toast.error("Failed to batch update class names. Check console for details.");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6 space-y-6">
            {/* Control Panel */}
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-4xl">
                <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
                    Bulk Class Reconciler & Renamer
                </h2>

                <form onSubmit={handleBatchClassUpdate} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 1. Current Class (Fetched from PupilsReg) */}
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700">
                                Select Current Class (from Pupils)
                            </label>
                            <select
                                value={selectedOldClass}
                                onChange={(e) => setSelectedOldClass(e.target.value)}
                                className="w-full p-2.5 border rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                required
                            >
                                <option value="">-- Choose Existing Class --</option>
                                {currentClassOptions.map((cls, idx) => (
                                    <option key={idx} value={cls}>
                                        {cls}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Academic Year (Fetched from PupilsReg) */}
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700">
                                Select Academic Year
                            </label>
                            <select
                                value={selectedAcademicYear}
                                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                                className="w-full p-2.5 border rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                required
                            >
                                <option value="">-- Choose Academic Year --</option>
                                {academicYears.map((year, idx) => (
                                    <option key={idx} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 3. New Class Name (Fetched from Classes Collection) */}
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-700">
                                Select New Class Name (from Classes)
                            </label>
                            <select
                                value={selectedNewClass}
                                onChange={(e) => setSelectedNewClass(e.target.value)}
                                className="w-full p-2.5 border rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white"
                                required
                            >
                                <option value="">-- Choose Target Class --</option>
                                {newClassOptions.map((cls, idx) => (
                                    <option key={idx} value={cls}>
                                        {cls}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isUpdating || pupils.length === 0 || !selectedNewClass}
                        className="w-full bg-indigo-600 text-white font-medium p-3 rounded-lg hover:bg-indigo-700 transition disabled:bg-gray-400 mt-4"
                    >
                        {isUpdating
                            ? "Updating Pupils..."
                            : `Update ${pupils.length} Pupil(s) to "${selectedNewClass || '...'}"`}
                    </button>
                </form>
            </div>

            {/* Live Pupil Preview Table */}
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-4xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-800">
                        Affected Pupils ({pupils.length})
                    </h3>
                    {selectedOldClass && selectedAcademicYear && (
                        <span className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                            {selectedOldClass} | {selectedAcademicYear}
                        </span>
                    )}
                </div>

                {loading ? (
                    <p className="text-center text-gray-500 py-6">Loading pupils...</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        #
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Student ID
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Student Name
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Current Class
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Academic Year
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {pupils.map((pupil, index) => (
                                    <tr key={pupil.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {index + 1}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                            {pupil.studentID}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700 font-semibold">
                                            {pupil.studentName}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {pupil.class}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {pupil.academicYear}
                                        </td>
                                    </tr>
                                ))}
                                {pupils.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan="5"
                                            className="px-6 py-6 text-center text-sm text-gray-500"
                                        >
                                            {selectedOldClass && selectedAcademicYear
                                                ? "No pupils found matching this Class and Academic Year."
                                                : "Select both a Current Class and an Academic Year to preview affected pupils."}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClassReconciler;