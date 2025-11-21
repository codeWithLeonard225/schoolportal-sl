import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import {
    collection,
    addDoc,
    onSnapshot,
    updateDoc,
    doc,
    query,
    where,
    deleteDoc,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
import localforage from "localforage"; // ⬅️ Import localforage

// Initialize localforage stores for different data types
const teacherStore = localforage.createInstance({
    name: "TeacherData",
    storeName: "teachers",
});
const classStore = localforage.createInstance({
    name: "ClassSubjectData",
    storeName: "classesAndSubjects",
});
const assignmentStore = localforage.createInstance({
    name: "AssignmentData",
    storeName: "teacherAssignments",
});

const TeacherAssignmentPage = () => {
    // --- Constants and State ---
    const DELETE_PASSWORD = "1234";
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    // --- Localforage Keys (scoped by schoolId) ---
    const TEACHERS_KEY = `teachers_${schoolId}`;
    const CLASSES_KEY = `classes_${schoolId}`;
    const ASSIGNMENTS_KEY = `assignments_${schoolId}`;
    // ---------------------------------------------

    const [teacher, setTeacher] = useState("");
    const [className, setClassName] = useState("");
    const [subjectList, setSubjectList] = useState([]);
    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [classesAndSubjects, setClassesAndSubjects] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true); // Added loading state

    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [deletePasswordInput, setDeletePasswordInput] = useState("");
    const [assignmentToDelete, setAssignmentToDelete] = useState(null);

    // --- Caching/Fetching Helper Function ---
    const setupDataListener = (
        collectionName,
        storeInstance,
        cacheKey,
        setStateFunction
    ) => {
        if (schoolId === "N/A") {
            setLoading(false);
            return () => {};
        }

        const loadAndListen = async () => {
            // 1. Load from cache
            try {
                const cachedItem = await storeInstance.getItem(cacheKey);
                if (cachedItem && cachedItem.data) {
                    setStateFunction(cachedItem.data);
                    console.log(`Loaded initial ${collectionName} from cache.`);
                }
            } catch (e) {
                console.error(`Failed to load cached ${collectionName}:`, e);
            }

            // 2. Set up real-time listener
            const q = query(collection(db, collectionName), where("schoolId", "==", schoolId));
            const unsub = onSnapshot(
                q,
                (snapshot) => {
                    const fetchedData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                    
                    // Update UI state
                    setStateFunction(fetchedData);
                    
                    // Cache fresh data
                    const dataToStore = { timestamp: Date.now(), data: fetchedData };
                    storeInstance.setItem(cacheKey, dataToStore)
                        .catch(e => console.error(`Failed to save ${collectionName} to cache:`, e));
                    
                    setLoading(false); // Only set loading to false after the first snapshot (or cache load)
                },
                (error) => {
                    console.error(`Firestore error for ${collectionName}:`, error);
                    setLoading(false);
                }
            );
            return unsub;
        };

        // Run the async load and listen function
        let cleanup;
        loadAndListen().then(unsub => cleanup = unsub);

        return () => {
             if(cleanup) cleanup();
        };
    };
    // ------------------------------------------


    // 🔹 Fetch teachers (now uses cache-first pattern)
    useEffect(() => {
        return setupDataListener(
            "Teachers",
            teacherStore,
            TEACHERS_KEY,
            setTeachers
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId]);

    // 🔹 Fetch classes & subjects (now uses cache-first pattern)
    useEffect(() => {
        return setupDataListener(
            "ClassesAndSubjects",
            classStore,
            CLASSES_KEY,
            setClassesAndSubjects
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId]);

    // 🔹 Fetch assignments (now uses cache-first pattern)
    useEffect(() => {
        return setupDataListener(
            "TeacherAssignments",
            assignmentStore,
            ASSIGNMENTS_KEY,
            setAssignments
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId]);

    // 🔹 Update subject list based on selected class (unchanged)
    useEffect(() => {
        if (!className) {
            setSubjectList([]);
            setSelectedSubjects([]);
            return;
        }
        const selectedClass = classesAndSubjects.find((cls) => cls.className === className);
        setSubjectList(selectedClass ? selectedClass.subjects : []);
        // Retain selected subjects that still exist in the new class
        setSelectedSubjects(prev =>
            prev.filter(subject => selectedClass?.subjects.includes(subject))
        );
    }, [className, classesAndSubjects]);

    // 🔹 Handle subject checkbox toggle (unchanged)
    const handleSubjectToggle = (subject) => {
        if (selectedSubjects.includes(subject)) {
            setSelectedSubjects(selectedSubjects.filter((s) => s !== subject));
        } else {
            setSelectedSubjects([...selectedSubjects, subject]);
        }
    };

    // 🔹 Assign or update teacher (unchanged)
    const handleAssign = async () => {
        if (!teacher || !className || selectedSubjects.length === 0) {
            alert("Please select a teacher, class, and at least one subject.");
            return;
        }

        try {
            if (editingId) {
                const assignmentRef = doc(db, "TeacherAssignments", editingId);
                await updateDoc(assignmentRef, {
                    teacher,
                    className,
                    subjects: selectedSubjects,
                });
                setEditingId(null);
                alert("Assignment updated successfully!");
            } else {
                await addDoc(collection(db, "TeacherAssignments"), {
                    teacher,
                    className,
                    subjects: selectedSubjects,
                    schoolId,
                    createdAt: new Date(),
                });
                alert("Teacher assigned successfully!");
            }

            setTeacher("");
            setClassName("");
            setSelectedSubjects([]);
        } catch (err) {
            console.error(err);
            alert("Error saving assignment.");
        }
    };

    // ⭐ Filter assignments based on searchTerm (unchanged)
    const filteredAssignments = useMemo(() => {
        if (!searchTerm) {
            return assignments;
        }
        const lowerCaseSearchTerm = searchTerm.toLowerCase();

        return assignments.filter(assign =>
            // Filter by Teacher name
            assign.teacher.toLowerCase().includes(lowerCaseSearchTerm) ||
            // Filter by Class name
            assign.className.toLowerCase().includes(lowerCaseSearchTerm) ||
            // Filter by subjects (if any subject includes the term)
            assign.subjects.some(subject => subject.toLowerCase().includes(lowerCaseSearchTerm))
        );
    }, [assignments, searchTerm]);

    // 🔹 Edit existing assignment (unchanged)
    const handleEdit = (assignment) => {
        setEditingId(assignment.id);
        setTeacher(assignment.teacher);
        setClassName(assignment.className);
        setSelectedSubjects(assignment.subjects);
    };

    // 🔹 Open Delete Confirmation Popup (unchanged)
    const handleOpenDelete = (assignment) => {
        setDeleteId(assignment.id);
        setAssignmentToDelete(assignment);
        setDeletePasswordInput("");
        setShowDeletePopup(true);
    };

    // 🔹 Execute Deletion (unchanged)
    const handleDeleteAssignment = async () => {
        if (deletePasswordInput !== DELETE_PASSWORD) {
            alert("Invalid password.");
            return;
        }

        if (!deleteId) return;

        try {
            await deleteDoc(doc(db, "TeacherAssignments", deleteId));
            alert(`Assignment for ${assignmentToDelete.teacher} (${assignmentToDelete.className}) deleted successfully!`);
            // Close popup and reset state
            handleCloseDeletePopup();
        } catch (err) {
            console.error("Error deleting assignment:", err);
            alert("Error deleting assignment. Please try again.");
        }
    };

    // 🔹 Close Delete Confirmation Popup (unchanged)
    const handleCloseDeletePopup = () => {
        setShowDeletePopup(false);
        setDeleteId(null);
        setAssignmentToDelete(null);
        setDeletePasswordInput("");
    };

    if (loading && assignments.length === 0 && teachers.length === 0 && classesAndSubjects.length === 0) {
        return (
            <div className="p-6 text-center">
                <p className="text-xl font-medium text-gray-700">Loading essential data...</p>
                <p className="text-sm text-gray-500 mt-2">Fetching Teachers, Classes, and Assignments from cache or database.</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto p-6 bg-white rounded-2xl shadow-md relative">
            <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
                Teacher Class & Subject Assignment 📝
            </h2>

            {/* School ID display */}
            <div className="text-center text-sm text-gray-500 mb-4">
                School ID: <span className="font-semibold">{schoolId}</span>
            </div>

            {/* Inputs (unchanged) */}
            <div className="space-y-4 mb-8">
                {/* Teacher Dropdown */}
                <div>
                    <label className="font-medium text-gray-700">Select Teacher:</label>
                    <select
                        value={teacher}
                        onChange={(e) => setTeacher(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 mt-1 focus:ring focus:ring-blue-300 bg-white"
                    >
                        <option value="">-- Select Teacher --</option>
                        {teachers.map((t) => (
                            <option key={t.id} value={t.fullName || t.teacherName}>
                                {t.fullName || t.teacherName}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Class Dropdown */}
                <div>
                    <label className="font-medium text-gray-700">Select Class:</label>
                    <select
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 mt-1 focus:ring focus:ring-blue-300 bg-white"
                    >
                        <option value="">-- Select Class --</option>
                        {classesAndSubjects.map((cls) => (
                            <option key={cls.id} value={cls.className}>
                                {cls.className}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Subjects */}
                {subjectList.length > 0 && (
                    <div>
                        <label className="font-medium text-gray-700">Select Subjects:</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                            {subjectList.map((subject, index) => (
                                <label
                                    key={index}
                                    className="flex items-center space-x-2 border rounded-md px-2 py-1 hover:bg-gray-50 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedSubjects.includes(subject)}
                                        onChange={() => handleSubjectToggle(subject)}
                                        className="form-checkbox"
                                    />
                                    <span>{subject}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    onClick={handleAssign}
                    className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
                >
                    {editingId ? "Update Assignment" : "Assign Teacher"}
                </button>
            </div>
            
            <hr className="my-6" />

            {/* Assigned Table */}
            <h3 className="text-xl font-semibold mt-8 mb-3 text-gray-800 text-center">
                Assigned Teachers
            </h3>

            {/* Search/Filter Input */}
            <div className="mb-4">
                <input
                    type="text"
                    placeholder="Filter by Teacher, Class, or Subject..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full border rounded-md px-4 py-2 focus:ring focus:ring-indigo-300"
                />
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300 rounded-md text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                        <tr>
                            <th className="border px-3 py-2 text-left">#</th>
                            <th className="border px-3 py-2 text-left">Teacher</th>
                            <th className="border px-3 py-2 text-left">Class</th>
                            <th className="border px-3 py-2 text-left">Subjects</th>
                            <th className="border px-3 py-2 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAssignments.length === 0 ? (
                            <tr>
                                <td colSpan="5" className="text-center py-4 text-gray-500">
                                    {searchTerm ? "No assignments match your search." : "No assignments yet."}
                                </td>
                            </tr>
                        ) : (
                            // RENDER filteredAssignments
                            filteredAssignments.map((assign, index) => (
                                <tr key={assign.id} className="hover:bg-gray-50">
                                    <td className="border px-3 py-2">{index + 1}</td>
                                    <td className="border px-3 py-2 font-semibold">{assign.teacher}</td>
                                    <td className="border px-3 py-2">{assign.className}</td>
                                    <td className="border px-3 py-2">{assign.subjects.join(", ")}</td>
                                    <td className="border px-3 py-2 flex gap-2">
                                        <button
                                            onClick={() => handleEdit(assign)}
                                            className="bg-yellow-400 text-white px-3 py-1 rounded-md hover:bg-yellow-500 text-xs"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleOpenDelete(assign)}
                                            className="bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 text-xs"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Delete Confirmation Popup (unchanged) */}
            {showDeletePopup && assignmentToDelete && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
                        <h3 className="text-lg font-bold mb-3 text-red-600">Confirm Deletion</h3>
                        <p className="text-gray-700 mb-4">
                            Are you sure you want to delete the assignment for:
                            <br />
                            Teacher: <strong>{assignmentToDelete.teacher}</strong>
                            <br />
                            Class: <strong>{assignmentToDelete.className}</strong>
                        </p>

                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Enter Password ({DELETE_PASSWORD}):
                        </label>
                        <input
                            type="password"
                            value={deletePasswordInput}
                            onChange={(e) => setDeletePasswordInput(e.target.value)}
                            className="w-full border rounded-md px-3 py-2 mb-4 focus:ring focus:ring-red-300"
                            placeholder={DELETE_PASSWORD}
                        />

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleCloseDeletePopup}
                                className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAssignment}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-400"
                                disabled={deletePasswordInput !== DELETE_PASSWORD}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherAssignmentPage;