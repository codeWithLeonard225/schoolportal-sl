import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import {
    collection,
    addDoc,
    onSnapshot,
    deleteDoc,
    doc,
    updateDoc,
    query,
    where,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
import localforage from "localforage";
import { toast } from "react-toastify";

// 💾 Initialize localforage stores
const classListStore = localforage.createInstance({
    name: "SchoolClassCache",
    storeName: "classesData",
});

const subjectCategoryStore = localforage.createInstance({
    name: "SubjectCategoryCache",
    storeName: "subjectCategories", // Renamed for better clarity
});

const classesAndSubjectsStore = localforage.createInstance({
    name: "ClassesAndSubjectsCache",
    storeName: "savedClassesAndSubjects", // Explicit store for the main list
});


const SubjectPage = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A"; // School ID passed via navigation

    const [className, setClassName] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [allClasses, setAllClasses] = useState([]); // Saved ClassesAndSubjects from Firestore
    const [classList, setClassList] = useState([]); // List of all class names from Classes collection
    const [categories, setCategories] = useState([]); // Subject categories list
    const [editingId, setEditingId] = useState(null);
    // ⏳ NEW state for loading indicators
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [loadingCategories, setLoadingCategories] = useState(true);


    // 1. 🚀 Fetch All Classes (classList) - Cache-First
    useEffect(() => {
        if (!schoolId || schoolId === "N/A") {
            setLoadingClasses(false);
            return;
        }
        const CLASSES_CACHE_KEY = `school_classes_${schoolId}`;

        const loadAndListenClasses = async () => {
            setLoadingClasses(true);

            // 1. Try to load from cache
            try {
                const cachedClasses = await classListStore.getItem(CLASSES_CACHE_KEY);
                if (cachedClasses && cachedClasses.data) {
                    setClassList(cachedClasses.data);
                    console.log("Loaded classes from cache.");
                }
            } catch (e) {
                console.error("Failed to retrieve cached classes:", e);
            }

            // 2. Set up Firestore Listener for real-time updates
            const classRef = collection(db, "Classes");
            const q = query(classRef, where("schoolId", "==", schoolId));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedClasses = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setClassList(fetchedClasses);

                // 3. Save fresh data to localforage
                classListStore.setItem(CLASSES_CACHE_KEY, { timestamp: Date.now(), data: fetchedClasses })
                    .catch(e => console.error("Failed to save classes to IndexDB:", e));

                setLoadingClasses(false); // Done loading once first snapshot arrives
                console.log("Classes list updated via real-time Firestore listener.");

            }, (error) => {
                console.error("Firestore 'Classes' onSnapshot failed:", error);
                toast.error("Failed to stream class data.");
                setLoadingClasses(false);
            });

            return () => unsubscribe();
        };

        loadAndListenClasses();
    }, [schoolId]);

    // 2. ✅ Fetch all categories from SubjectCategories - Cache-First
    useEffect(() => {
        const CATEGORIES_CACHE_KEY = 'subject_categories_all';

        const loadCategories = async () => {
            setLoadingCategories(true);

            // 1. Try to load from cache
            try {
                const cachedCats = await subjectCategoryStore.getItem(CATEGORIES_CACHE_KEY);
                if (cachedCats && cachedCats.data) {
                    setCategories(cachedCats.data);
                    console.log("Loaded categories from cache.");
                }
            } catch (e) {
                console.error("Failed to retrieve cached categories:", e);
            }

            // 2. Set up Firestore Listener
            const unsub = onSnapshot(collection(db, "SubjectCategories"), (snapshot) => {
                const fetched = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setCategories(fetched);

                // 3. Save fresh data to localforage
                subjectCategoryStore.setItem(CATEGORIES_CACHE_KEY, { timestamp: Date.now(), data: fetched })
                    .catch(e => console.error("Failed to save categories to IndexDB:", e));
                
                setLoadingCategories(false);

            }, (error) => {
                console.error("Firestore 'SubjectCategories' onSnapshot failed:", error);
                toast.error("Failed to fetch subject categories.");
                setLoadingCategories(false);
            });

            return () => unsub();
        }
        
        loadCategories();
    }, []);

    // 3. ✨ Calculate available subjects from in-memory categories state (OPTIMIZED)
    useEffect(() => {
        if (!selectedCategory || categories.length === 0) {
            setAvailableSubjects([]);
            return;
        }

        // Search the already loaded 'categories' state instead of querying Firestore again
        const selectedCat = categories.find(cat => cat.categoryName === selectedCategory);
        
        setAvailableSubjects(selectedCat?.subjects || []);
        
    }, [selectedCategory, categories]);

    // 4. 🚀 Fetch Existing ClassesAndSubjects (allClasses) - Cache-First
    useEffect(() => {
        if (!schoolId || schoolId === "N/A") {
            setLoadingSubjects(false);
            return;
        }
        const SUBJECTS_CACHE_KEY = `classes_and_subjects_${schoolId}`;

        const loadAndListenSubjects = async () => {
            setLoadingSubjects(true);

            // 1. Try to load from cache
            try {
                const cachedSubjects = await classesAndSubjectsStore.getItem(SUBJECTS_CACHE_KEY);
                if (cachedSubjects && cachedSubjects.data) {
                    setAllClasses(cachedSubjects.data);
                    console.log("Loaded saved subjects from cache.");
                }
            } catch (e) {
                console.error("Failed to retrieve cached subjects:", e);
            }

            // 2. Set up Firestore Listener
            const subjRef = collection(db, "ClassesAndSubjects");
            const q = query(subjRef, where("schoolId", "==", schoolId));

            const unsub = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setAllClasses(data);

                // 3. Save fresh data to localforage
                classesAndSubjectsStore.setItem(SUBJECTS_CACHE_KEY, { timestamp: Date.now(), data })
                    .catch(e => console.error("Failed to save saved subjects to IndexDB:", e));

                setLoadingSubjects(false); // Done loading once first snapshot arrives
                console.log("Saved classes and subjects updated via real-time Firestore listener.");

            }, (error) => {
                console.error("Firestore 'ClassesAndSubjects' onSnapshot failed:", error);
                toast.error("Failed to stream saved subjects.");
                setLoadingSubjects(false);
            });

            return () => unsub();
        };

        loadAndListenSubjects();
    }, [schoolId]);


    // --- Handlers (No change in logic, but using toast for better UX) ---

    // ✅ Add subject from available list
    const handleAddSubject = (subject) => {
        setSubjects((prev) => {
            if (prev.includes(subject)) {
                toast.warn("This subject is already added.");
                return prev;
            }
            return [...prev, subject];
        });
    };

    // 🆕 ✅ Remove subject from selected list
    const handleRemoveSubject = (subjectToRemove) => {
        setSubjects((prev) => prev.filter((subject) => subject !== subjectToRemove));
        toast.info(`Removed ${subjectToRemove}.`);
    };

    // ✅ Save or update class + subjects
    const handleSave = async () => {
        if (!className.trim() || subjects.length === 0) {
            toast.error("Please select a class and at least one subject.");
            return;
        }

        const isDuplicate = allClasses.some(
            cls => cls.className === className && cls.id !== editingId
        );

        if (isDuplicate) {
            toast.error(`A subject list for class "${className}" already exists.`);
            return;
        }

        if (!schoolId || schoolId === "N/A") {
            toast.error("Missing school ID. Please navigate from a valid school context.");
            return;
        }

        try {
            if (editingId) {
                // Update existing record
                await updateDoc(doc(db, "ClassesAndSubjects", editingId), {
                    className,
                    subjects,
                    schoolId,
                    updatedAt: new Date(),
                });
                setEditingId(null);
                toast.success("Class subjects updated successfully!");
            } else {
                // Add new record
                await addDoc(collection(db, "ClassesAndSubjects"), {
                    className,
                    subjects,
                    schoolId,
                    createdAt: new Date(),
                });
                toast.success("Class subjects saved successfully!");
            }

            setClassName("");
            setSubjects([]);
            setSelectedCategory("");

        } catch (error) {
            console.error("Error saving:", error);
            toast.error("Error saving class and subjects.");
        }
    };

    // ✅ Delete
    const handleDelete = async (id, name) => {
        if (window.confirm(`Are you sure you want to delete subjects for class: ${name}?`)) {
            try {
                await deleteDoc(doc(db, "ClassesAndSubjects", id));
                toast.success(`Subjects for ${name} deleted.`);
            } catch (error) {
                console.error("Error deleting:", error);
                toast.error("Failed to delete class subjects.");
            }
        }
    };

    // ✅ Edit
    const handleEdit = (cls) => {
        setClassName(cls.className);
        setSubjects(cls.subjects || []);
        setEditingId(cls.id);
        toast.info(`Editing subjects for class: ${cls.className}`);
    };

    const isLoading = loadingClasses || loadingSubjects || loadingCategories;

    // --- RENDER BLOCK ---
    return (
        <div className="max-w-5xl mx-auto p-6 bg-white rounded-2xl shadow-md">
            <h2 className="text-2xl font-semibold mb-4 text-center text-gray-800">
                Class and Subjects Setup 📝
            </h2>

            {/* Loading Indicator */}
            {isLoading && (
                <div className="text-center p-4 text-blue-600 font-medium">
                    Loading data from cache or server...
                </div>
            )}

            <div className="space-y-4">
                {/* Select Class */}
                <div>
                    <label className="font-medium text-gray-700">Class Name:</label>
                    <select
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 mt-1 focus:ring focus:ring-blue-300 bg-white"
                        disabled={loadingClasses}
                    >
                        <option value="">
                            {loadingClasses ? "-- Loading Classes --" : "-- Select Class --"}
                        </option>
                        {classList.map((cls) => (
                            <option key={cls.id} value={cls.className}>
                                {cls.className}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Select Category */}
                <div>
                    <label className="font-medium text-gray-700">Select Category:</label>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full border rounded-md px-3 py-2 mt-1 focus:ring focus:ring-blue-300 bg-white"
                        disabled={loadingCategories}
                    >
                        <option value="">
                            {loadingCategories ? "-- Loading Categories --" : "-- Select Subject Category --"}
                        </option>
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.categoryName}>
                                {cat.categoryName}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Available Subjects */}
                {availableSubjects.length > 0 && (
                    <div>
                        <label className="font-medium text-gray-700">Available Subjects (Click to Add):</label>
                        <div className="flex flex-wrap gap-2 mt-2 border p-3 rounded-md bg-gray-50 max-h-40 overflow-y-auto">
                            {availableSubjects.map((subj, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleAddSubject(subj)}
                                    className={`px-3 py-1 rounded-full border text-sm transition ${
                                        subjects.includes(subj)
                                            ? "bg-green-500 text-white border-green-500 cursor-not-allowed"
                                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-200"
                                    }`}
                                    disabled={subjects.includes(subj)}
                                >
                                    {subj}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Selected Subjects (Updated with Remove button) */}
                {subjects.length > 0 && (
                    <div>
                        <label className="font-medium text-gray-700">Selected Subjects (Click to Remove):</label>
                        <div className="mt-2 flex flex-wrap gap-2 border p-3 rounded-md bg-blue-50">
                            {subjects.map((subj, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleRemoveSubject(subj)}
                                    className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-1 hover:bg-blue-700 transition duration-150"
                                >
                                    <span>{subj}</span>
                                    <svg
                                        className="w-4 h-4 ml-1"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth="2"
                                            d="M6 18L18 6M6 6l12 12"
                                        ></path>
                                    </svg>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    onClick={handleSave}
                    className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                    disabled={isLoading || !className || subjects.length === 0}
                >
                    {editingId ? "Update Class & Subjects" : "Save Class & Subjects"}
                </button>
            </div>

            <hr className="my-6"/>

            {/* Table */}
            <h3 className="text-xl font-semibold mb-3 text-gray-800 text-center">
                Saved Classes & Subjects
            </h3>

            <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300 rounded-md text-sm">
                    <thead className="bg-gray-100 text-gray-700">
                        <tr>
                            <th className="border px-3 py-2 text-left">#</th>
                            <th className="border px-3 py-2 text-left">Class Name</th>
                            <th className="border px-3 py-2 text-left">Subjects</th>
                            <th className="border px-3 py-2 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loadingSubjects && allClasses.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="text-center py-4 text-blue-500 font-medium">
                                    Loading saved subjects...
                                </td>
                            </tr>
                        ) : allClasses.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="text-center py-4 text-gray-500">
                                    No classes added yet.
                                </td>
                            </tr>
                        ) : (
                            allClasses.map((cls, index) => (
                                <tr key={cls.id} className="hover:bg-gray-50">
                                    <td className="border px-3 py-2">{index + 1}</td>
                                    <td className="border px-3 py-2 font-semibold">{cls.className}</td>
                                    <td className="border px-3 py-2 text-wrap max-w-lg">
                                        {cls.subjects?.join(", ") || "—"}
                                    </td>
                                    <td className="border px-3 py-2 space-x-2 whitespace-nowrap">
                                        <button
                                            onClick={() => handleEdit(cls)}
                                            className="bg-yellow-400 text-white px-2 py-1 rounded hover:bg-yellow-500 transition"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cls.id, cls.className)}
                                            className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition"
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
        </div>
    );
};

export default SubjectPage;