import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    onSnapshot,
    getDoc,
    getDocs,
    writeBatch,
    where
} from "firebase/firestore";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import { useLocation } from "react-router-dom";

const ADMIN_PASSWORD = "1234";

const ClassRegistration = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [classData, setClassData] = useState({
        id: null,
        classId: uuidv4().slice(0, 8),
        className: "",
        numberOfSubjects: "",
        subjectPercentage: "",
        schoolId: schoolId,
    });

    const [classes, setClasses] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 🧩 Fetch classes by school
    useEffect(() => {
        if (!schoolId || schoolId === "N/A") return;
        const collectionRef = collection(db, "Classes");
        const q = query(collectionRef, where("schoolId", "==", schoolId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const classList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasses(classList);
        });
        return () => unsubscribe();
    }, [schoolId]);

    // 🧩 Generate unique ID
    const generateUniqueId = () => {
        let newId;
        do {
            newId = uuidv4().slice(0, 8);
        } while (classes.find(c => c.classId === newId));
        return newId;
    };

    useEffect(() => {
        if (!classData.id) {
            setClassData(prev => ({ ...prev, classId: generateUniqueId() }));
        }
    }, [classes, classData.id]);

    // 🧩 Handle input change
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // Automatically calculate subjectPercentage when numberOfSubjects changes
        if (name === "numberOfSubjects") {
            const numSubjects = parseInt(value) || 0;
            const subjectPercentage = numSubjects * 100;
            setClassData(prev => ({
                ...prev,
                numberOfSubjects: value,
                subjectPercentage: subjectPercentage,
            }));
        } else {
            setClassData(prev => ({ ...prev, [name]: value }));
        }
    };

    // 🧩 Handle submit (add or update)
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!classData.className) return toast.error("Please enter class name");
        if (!classData.numberOfSubjects) return toast.error("Please enter number of subjects");

        setIsSubmitting(true);
        try {
            if (classData.id) {
                // --- UPDATE ---
                const classRef = doc(db, "Classes", classData.id);
                const currentClassDoc = await getDoc(classRef);
                const oldClassName = currentClassDoc.data().className;
                const newClassName = classData.className;

                await updateDoc(classRef, {
                    classId: classData.classId,
                    schoolId: schoolId,
                    className: newClassName,
                    numberOfSubjects: classData.numberOfSubjects,
                    subjectPercentage: classData.subjectPercentage,
                });

                if (oldClassName !== newClassName) {
                    const votersCollectionRef = collection(db, "Voters");
                    const studentsQuery = query(votersCollectionRef, where("class", "==", oldClassName));
                    const studentSnapshot = await getDocs(studentsQuery);

                    if (!studentSnapshot.empty) {
                        const batch = writeBatch(db);
                        studentSnapshot.docs.forEach((studentDoc) => {
                            const studentRef = doc(db, "Voters", studentDoc.id);
                            batch.update(studentRef, { class: newClassName });
                        });
                        await batch.commit();
                        toast.success(`Class updated and ${studentSnapshot.size} student(s) reconciled.`);
                    } else {
                        toast.success("Class updated successfully!");
                    }
                } else {
                    toast.success("Class updated successfully!");
                }
            } else {
                // --- ADD ---
                const newId = generateUniqueId();
                await addDoc(collection(db, "Classes"), {
                    classId: newId,
                    className: classData.className,
                    schoolId: schoolId,
                    numberOfSubjects: classData.numberOfSubjects,
                    subjectPercentage: classData.subjectPercentage,
                    timestamp: new Date(),
                });
                toast.success("Class added successfully!");
            }

            // Reset form
            setClassData({
                id: null,
                classId: generateUniqueId(),
                className: "",
                numberOfSubjects: "",
                subjectPercentage: "",
                schoolId: schoolId,
            });
        } catch (err) {
            console.error("Error:", err);
            toast.error("Failed to save class.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = (cls) => {
        setClassData({
            id: cls.id,
            classId: cls.classId,
            className: cls.className,
            numberOfSubjects: cls.numberOfSubjects || "",
            subjectPercentage: cls.subjectPercentage || "",
        });
        toast.info(`Editing class: ${cls.className}`);
    };

    const handleDelete = async (id, className) => {
        const password = window.prompt("Enter password to delete this class:");
        if (password === ADMIN_PASSWORD) {
            if (window.confirm(`Are you sure you want to delete ${className}?`)) {
                try {
                    await deleteDoc(doc(db, "Classes", id));
                    toast.success("Class deleted successfully!");
                } catch (err) {
                    console.error(err);
                    toast.error("Failed to delete class");
                }
            }
        } else if (password !== null) {
            toast.error("Incorrect password");
        }
    };

    const filteredClasses = useMemo(() => {
        if (!searchTerm.trim()) return classes;
        const term = searchTerm.toLowerCase();
        return classes.filter(c => c.className.toLowerCase().includes(term) || c.classId.toLowerCase().includes(term));
    }, [classes, searchTerm]);

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6 space-y-6">
            <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-2xl">
                <h2 className="text-2xl font-bold text-center mb-4">{classData.id ? "Update Class" : "Register Class"}</h2>

                <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Class ID</label>
                        <input
                            type="text"
                            name="classId"
                            value={classData.classId}
                            readOnly
                            disabled
                            className="w-full p-2 mb-4 border rounded-lg bg-gray-100"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Class Name</label>
                        <input
                            type="text"
                            name="className"
                            value={classData.className}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"
                            placeholder="Enter class name"
                            required
                        />
                    </div>
                </div>

                {/* 🧮 Number of Subjects and Subject Percentage */}
                <div className="flex flex-col md:flex-row md:space-x-4">
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Number of Subjects</label>
                        <input
                            type="number"
                            name="numberOfSubjects"
                            value={classData.numberOfSubjects}
                            onChange={handleInputChange}
                            className="w-full p-2 mb-4 border rounded-lg"
                            placeholder="Enter number of subjects"
                            required
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block mb-2 font-medium text-sm">Subject Percentage</label>
                        <input
                            type="number"
                            name="subjectPercentage"
                            value={classData.subjectPercentage}
                            readOnly
                            className="w-full p-2 mb-4 border rounded-lg bg-gray-100 text-gray-600"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
                >
                    {isSubmitting ? "Submitting..." : classData.id ? "Update Class" : "Add Class"}
                </button>
            </form>

            {/* TABLE */}
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-full lg:max-w-5xl">
                <h2 className="text-2xl font-bold text-center mb-4">Registered Classes ({filteredClasses.length} of {classes.length})</h2>

                <input
                    type="text"
                    placeholder="Search by Class Name or ID"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-2 mb-4 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                />

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class ID</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class Name</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subjects</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredClasses.map(cls => (
                                <tr key={cls.id}>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">{cls.classId}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{cls.className}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{cls.numberOfSubjects || "-"}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{cls.subjectPercentage || "-"}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                                        <button onClick={() => handleUpdate(cls)} className="text-indigo-600 hover:text-indigo-900 mr-2">
                                            Update
                                        </button>
                                        <button onClick={() => handleDelete(cls.id, cls.className)} className="text-red-600 hover:text-red-900">
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredClasses.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                                        No classes found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ClassRegistration;
