import React, { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../../../firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs, limit } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";

const FeesCostPage = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [feesList, setFeesList] = useState([]);
    const [editingFeeId, setEditingFeeId] = useState(null);
    const [classes, setClasses] = useState([]);
    const [searchClass, setSearchClass] = useState("");
    const [selectedClass, setSelectedClass] = useState(null);
    const [formError, setFormError] = useState(""); // State for on-screen error

    const initialFeeState = useMemo(() => ({
        feeId: uuidv4().slice(0, 10).toUpperCase(),
        className: "",
        academicYear: "",
        schoolId: schoolId,
        new_term1: "", new_term2: "", new_term3: "",
        cont_term1: "", cont_term2: "", cont_term3: "",
    }), [schoolId]);

    const [feeData, setFeeData] = useState(initialFeeState);

    const resetForm = useCallback(() => {
        setFeeData(initialFeeState);
        setSelectedClass(null);
        setEditingFeeId(null);
        setSearchClass("");
        setFormError("");
    }, [initialFeeState]);

    const totals = useMemo(() => {
        const sum = (t1, t2, t3) => (parseFloat(t1 || 0) + parseFloat(t2 || 0) + parseFloat(t3 || 0)).toFixed(2);
        return {
            newTotal: sum(feeData.new_term1, feeData.new_term2, feeData.new_term3),
            contTotal: sum(feeData.cont_term1, feeData.cont_term2, feeData.cont_term3)
        };
    }, [feeData]);

    useEffect(() => {
        if (!schoolId || schoolId === "N/A") return;
        const q = query(collection(db, "FeesCost"), where("schoolId", "==", schoolId), limit(50));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setFeesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [schoolId]);

    useEffect(() => {
        const fetchClasses = async () => {
            if (!searchClass.trim() || selectedClass?.className === searchClass) return;
            const classesRef = collection(db, "Classes");
            const snapshot = await getDocs(classesRef);
            const filtered = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(cls =>
                    cls.schoolId === schoolId &&
                    cls.className.toLowerCase().includes(searchClass.toLowerCase())
                );
            setClasses(filtered.slice(0, 5));
        };
        fetchClasses();
    }, [searchClass, schoolId, selectedClass]);

    const handleClassSelect = (cls) => {
        setSelectedClass(cls);
        setSearchClass(cls.className);
        setFeeData(prev => ({ ...prev, className: cls.className }));
        setClasses([]);
        setFormError(""); // Clear error when user fixes selection
    };

    const handleFeeChange = (e) => {
        const { name, value } = e.target;
        setFeeData(prev => ({ ...prev, [name]: value }));
        if (formError) setFormError(""); // Clear error on typing
    };

    const handleEdit = (fee) => {
        setEditingFeeId(fee.id);
        setFeeData({ ...fee });
        setSelectedClass({ className: fee.className });
        setSearchClass(fee.className);
        setFormError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError("");

        if (!feeData.className || !feeData.academicYear) {
            return setFormError("Class and Year are required!");
        }

        const duplicateQuery = query(
            collection(db, "FeesCost"),
            where("className", "==", feeData.className),
            where("academicYear", "==", feeData.academicYear),
            where("schoolId", "==", schoolId)
        );

        const snapshot = await getDocs(duplicateQuery);
        const isDuplicate = snapshot.docs.some(doc => doc.id !== editingFeeId);

        if (isDuplicate) {
            const msg = `Duplicate: A fee structure for ${feeData.className} (${feeData.academicYear}) already exists.`;
            setFormError(msg);
            return toast.error(msg);
        }

        try {
            const dataToSave = {
                ...feeData,
                new_term1: parseFloat(feeData.new_term1) || 0,
                new_term2: parseFloat(feeData.new_term2) || 0,
                new_term3: parseFloat(feeData.new_term3) || 0,
                cont_term1: parseFloat(feeData.cont_term1) || 0,
                cont_term2: parseFloat(feeData.cont_term2) || 0,
                cont_term3: parseFloat(feeData.cont_term3) || 0,
                new_total: parseFloat(totals.newTotal),
                cont_total: parseFloat(totals.contTotal),
                schoolId
            };
            delete dataToSave.id;

            if (editingFeeId) {
                await updateDoc(doc(db, "FeesCost", editingFeeId), dataToSave);
                toast.success("Structure Updated!");
            } else {
                await addDoc(collection(db, "FeesCost"), dataToSave);
                toast.success("Structure Added!");
            }
            resetForm();
        } catch (err) {
            toast.error("Error saving data");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure?")) return;
        try {
            await deleteDoc(doc(db, "FeesCost", id));
            toast.success("Deleted!");
        } catch (err) {
            toast.error("Error deleting");
        }
    };

    return (
        <div className="p-6 bg-gray-100 min-h-screen">
            <h2 className="text-2xl font-bold mb-6 text-indigo-700">Fees Cost Management</h2>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md mb-8 max-w-4xl mx-auto border-t-4 border-indigo-600">
                {/* On-Screen Error Message */}
                {formError && (
                    <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 text-sm font-bold">
                        {formError}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="relative">
                        <label className="block text-sm font-medium mb-1">Search Class</label>
                        <input
                            type="text"
                            value={searchClass}
                            onChange={(e) => setSearchClass(e.target.value)}
                            className="w-full p-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                            placeholder="Type class name..."
                        />
                        {classes.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border mt-1 rounded shadow-lg">
                                {classes.map(cls => (
                                    <li key={cls.id} onClick={() => handleClassSelect(cls)} className="p-2 hover:bg-indigo-50 cursor-pointer text-sm">
                                        {cls.className}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Academic Year</label>
                        <input
                            type="text"
                            name="academicYear"
                            value={feeData.academicYear}
                            onChange={handleFeeChange}
                            placeholder="e.g. 2025/2026"
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-300 outline-none"
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* NEW STUDENTS SECTION */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h3 className="font-bold text-blue-700 mb-3 border-b border-blue-200">New Students</h3>
                        {["1", "2", "3"].map(num => (
                            <div key={num} className="mb-2">
                                <label className="text-xs font-semibold">Term {num} (NLE)</label>
                                <input
                                    type="number"
                                    name={`new_term${num}`}
                                    value={feeData[`new_term${num}`]}
                                    onChange={handleFeeChange}
                                    className="w-full p-2 border rounded"
                                    placeholder="0.00"
                                />
                            </div>
                        ))}
                        <p className="mt-2 font-bold text-blue-800">Total: NLE {totals.newTotal}</p>
                    </div>

                    {/* CONTINUING STUDENTS SECTION */}
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h3 className="font-bold text-green-700 mb-3 border-b border-green-200">Continuing Students</h3>
                        {["1", "2", "3"].map(num => (
                            <div key={num} className="mb-2">
                                <label className="text-xs font-semibold">Term {num} (NLE)</label>
                                <input
                                    type="number"
                                    name={`cont_term${num}`}
                                    value={feeData[`cont_term${num}`]}
                                    onChange={handleFeeChange}
                                    className="w-full p-2 border rounded"
                                    placeholder="0.00"
                                />
                            </div>
                        ))}
                        <p className="mt-2 font-bold text-green-800">Total: NLE {totals.contTotal}</p>
                    </div>
                </div>

                <button type="submit" className="w-full mt-6 bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 transition">
                    {editingFeeId ? "Update Structure" : "Save Structure"}
                </button>
            </form>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-100 border-b">
                        <tr>
                            <th className="p-4 text-sm font-bold">Class</th>
                            <th className="p-4 text-sm font-bold">Year</th> {/* New Column */}
                            <th className="p-4 text-sm font-bold text-blue-600 text-center">New Total</th>
                            <th className="p-4 text-sm font-bold text-green-600 text-center">Continue Total</th>
                            <th className="p-4 text-sm font-bold">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {feesList.map(fee => (
                            <tr key={fee.id} className="border-b hover:bg-gray-50 transition">
                                <td className="p-4 text-sm font-medium">{fee.className}</td>
                                <td className="p-4 text-sm text-gray-600">{fee.academicYear}</td> {/* Data for column */}
                                <td className="p-4 text-sm text-center font-bold">NLE {fee.new_total?.toFixed(2)}</td>
                                <td className="p-4 text-sm text-center font-bold">NLE {fee.cont_total?.toFixed(2)}</td>
                                <td className="p-4 text-sm space-x-4">
                                    <button onClick={() => handleEdit(fee)} className="text-orange-500 hover:underline font-semibold">Edit</button>
                                    <button onClick={() => handleDelete(fee.id)} className="text-red-500 hover:underline font-semibold">Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FeesCostPage;