import React, { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../../../firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs, limit } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";

const FeesCostPage = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A"; // fallback if missing

    const [feesList, setFeesList] = useState([]);
    const [editingFeeId, setEditingFeeId] = useState(null);
    const [classes, setClasses] = useState([]);
    const [searchClass, setSearchClass] = useState("");
    const [selectedClass, setSelectedClass] = useState(null);

    const initialFeeState = useMemo(() => ({
        feeId: uuidv4().slice(0, 10).toUpperCase(),
        className: "",
        term1: "",
        term2: "",
        term3: "",
        totalAmount: "",
        academicYear: "",
        schoolId: schoolId, // ✅ Add this
    }), []);

    // Use useCallback for proper memoization and dependency setup
    const resetForm = useCallback(() => {
        setFeeData(initialFeeState);
        setSelectedClass(null);
        setEditingFeeId(null);
        setSearchClass("");
    }, [initialFeeState]);

    const [feeData, setFeeData] = useState(initialFeeState);

    const calculatedTotalAmount = useMemo(() => {
        // Use unary plus operator for quick conversion, defaults to 0
        const t1 = +feeData.term1 || 0;
        const t2 = +feeData.term2 || 0;
        const t3 = +feeData.term3 || 0;
        return (t1 + t2 + t3).toFixed(2);
    }, [feeData.term1, feeData.term2, feeData.term3]);


    // ... (Fetch FeesCost List and Fetch Classes remains the same)

    useEffect(() => {
        if (!schoolId || schoolId === "N/A") return;

        const feesCollectionRef = collection(db, "FeesCost");
        const q = query(
            feesCollectionRef,
            where("schoolId", "==", schoolId), // ✅ only fetch this school's fees
         
            limit(50)
        );

        const unsubscribe = onSnapshot(q, snapshot => {
            setFeesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [schoolId]);


 useEffect(() => {
    const fetchClasses = async () => {
        if (!searchClass.trim()) return;

        const classesRef = collection(db, "Classes");
        const snapshot = await getDocs(classesRef);
        const filtered = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(cls =>
                cls.schoolId === schoolId &&
                cls.className.toLowerCase().includes(searchClass.toLowerCase())
            );
        setClasses(filtered.slice(0, 10));
    };

    fetchClasses();
}, [searchClass]);


    const handleClassSelect = (cls) => {
        setSelectedClass(cls);
        setSearchClass(cls.className);
        setFeeData(prev => ({ ...prev, className: cls.className }));
        setClasses([]);
    };

    const handleFeeChange = (e) => {
        const { name, value } = e.target;

        if (["term1", "term2", "term3"].includes(name)) {
            setFeeData(prev => ({ ...prev, [name]: value }));
        } else {
            setFeeData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleEdit = (fee) => {
        setEditingFeeId(fee.id);

        setFeeData({
            ...fee,
            // Convert to string for form inputs, defaulting to "" if null/undefined
            term1: fee.term1?.toString() || "",
            term2: fee.term2?.toString() || "",
            term3: fee.term3?.toString() || "",
            totalAmount: fee.totalAmount?.toString() || "",
        });
        setSelectedClass({ className: fee.className });
        setSearchClass(fee.className);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const totalAmount = parseFloat(calculatedTotalAmount);

        // EXTRA VALIDATION CHECK: Ensure all required fields have some input, not just the calculated total.
        if (!feeData.className || !feeData.academicYear ||
            feeData.term1 === "" || feeData.term2 === "" || feeData.term3 === "" ||
            totalAmount <= 0
        ) {
            return toast.error("Please ensure a Class, Academic Year, and all three Term amounts are filled. Total fee must be greater than zero.");
        }

        try {
            // Prepare data for Firestore. term values are converted to actual numbers.
            const feeDataToSave = {
                ...feeData,
                term1: parseFloat(feeData.term1), // Will be a valid number because of validation
                term2: parseFloat(feeData.term2), // Will be a valid number because of validation
                term3: parseFloat(feeData.term3), // Will be a valid number because of validation
                totalAmount: totalAmount,
                schoolId: schoolId, // ✅ ensure schoolId is saved
            };

            // Remove the ID field for a clean add/update operation
            delete feeDataToSave.id;

            if (editingFeeId) {
                await updateDoc(doc(db, "FeesCost", editingFeeId), feeDataToSave);
                toast.success("Fee updated successfully!");
            } else {
                await addDoc(collection(db, "FeesCost"), feeDataToSave);
                toast.success("Fee added successfully!");
            }

            // Reset form
            resetForm();
        } catch (err) {
            console.error("Failed to save fee data:", err);
            toast.error("Failed to save fee data. Check console for details.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this fee?")) {
            await deleteDoc(doc(db, "FeesCost", id));
            toast.success("Fee deleted successfully!");
        }
    };


    return (
        <div className="p-6 min-h-screen bg-gray-100">
            <h2 className="text-2xl font-bold mb-4 text-indigo-700">Fees Cost Management</h2>

            {/* Form */}
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-lg mb-6 max-w-xl">
                {/* 🏫 School ID (read-only field) */}
                <div className="mb-4">
                    <label className="block mb-2 font-medium text-sm text-gray-700">School ID</label>
                    <input
                        type="text"
                        value={schoolId}
                        readOnly
                        className="w-full p-2 border rounded-lg bg-gray-100 text-gray-600"
                    />
                </div>
                {/* ... (Class Name Input remains the same) ... */}
                <div className="mb-4">
                    <label className="block mb-1 font-medium text-sm">Class Name</label>
                    <input
                        type="text"
                        value={searchClass}
                        onChange={e => setSearchClass(e.target.value)}
                        placeholder="Search class..."
                        className="w-full p-2 border rounded-lg mb-2"
                    />
                    {selectedClass ? (
                        <p className="bg-yellow-100 p-2 rounded text-sm font-semibold">{selectedClass.className}</p>
                    ) : (
                        <ul className="max-h-32 overflow-y-auto border-t border-gray-300 mt-2">
                            {classes.map(cls => (
                                <li key={cls.id} onClick={() => handleClassSelect(cls)} className="p-2 cursor-pointer hover:bg-yellow-100 border-b text-sm">
                                    {cls.className}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* --- TERM AMOUNT INPUTS --- */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                        <label className="block mb-1 font-medium text-sm">Term 1 (NLE)</label>
                        <input
                            type="number"
                            name="term1"
                            value={feeData.term1}
                            onChange={handleFeeChange}
                            className="w-full p-2 border rounded-lg"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-1 font-medium text-sm">Term 2 (NLE)</label>
                        <input
                            type="number"
                            name="term2"
                            value={feeData.term2}
                            onChange={handleFeeChange}
                            className="w-full p-2 border rounded-lg"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-1 font-medium text-sm">Term 3 (NLE)</label>
                        <input
                            type="number"
                            name="term3"
                            value={feeData.term3}
                            onChange={handleFeeChange}
                            className="w-full p-2 border rounded-lg"
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                            required
                        />
                    </div>
                </div>
                {/* --- END TERM AMOUNT INPUTS --- */}

                {/* CALCULATED TOTAL */}
                <div className="mb-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="font-bold text-lg text-indigo-700">
                        Total Fee: NLE **{calculatedTotalAmount}**
                    </p>
                </div>


                <div className="mb-4">
                    <label className="block mb-1 font-medium text-sm">Academic Year</label>
                    <input
                        type="text"
                        name="academicYear"
                        value={feeData.academicYear}
                        onChange={handleFeeChange}
                        placeholder="e.g., 2025/2026"
                        className="w-full p-2 border rounded-lg"
                        required
                    />
                </div>

                <button type="submit" className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg font-semibold`}>
                    {editingFeeId ? "Update Fee" : "Add Fee"}
                </button>
            </form>

            {/* Fees Table */}
            {/* ... (Table display remains the same) ... */}
            <div className="bg-white p-6 rounded-xl shadow-lg max-w-full overflow-x-auto">
                <h3 className="text-lg font-bold mb-4">Existing Fees</h3>
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Class</th>
                            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Term 1 (NLE)</th>
                            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Term 2 (NLE)</th>
                            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Term 3 (NLE)</th>
                            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Total (NLE)</th>
                            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Academic Year</th>
                            <th className="px-3 py-2 text-left text-sm font-medium text-gray-500">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {feesList.map(fee => (
                            <tr key={fee.id}>
                                <td className="px-3 py-2 text-sm text-gray-700 font-semibold">{fee.className}</td>
                                <td className="px-3 py-2 text-sm text-gray-700">{(parseFloat(fee.term1) || 0).toFixed(2)}</td>
                                <td className="px-3 py-2 text-sm text-gray-700">{(parseFloat(fee.term2) || 0).toFixed(2)}</td>
                                <td className="px-3 py-2 text-sm text-gray-700">{(parseFloat(fee.term3) || 0).toFixed(2)}</td>
                                <td className="px-3 py-2 text-sm text-indigo-600 font-bold">NLE {(parseFloat(fee.totalAmount) || 0).toFixed(2)}</td>
                                <td className="px-3 py-2 text-sm text-gray-700">{fee.academicYear}</td>
                                <td className="px-3 py-2 text-sm text-gray-700 space-x-2">
                                    <button type="button" onClick={() => handleEdit(fee)} className="text-orange-600 hover:text-orange-800">Edit</button>
                                    <button type="button" onClick={() => handleDelete(fee.id)} className="text-red-600 hover:text-red-800">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {feesList.length === 0 && (
                            <tr>
                                <td colSpan="7" className="text-center p-4 text-gray-500">No fees added yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FeesCostPage;