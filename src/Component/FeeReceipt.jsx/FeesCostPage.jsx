import React, { useState, useEffect, useMemo, useCallback } from "react";
import { db } from "../../../firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs, limit } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";

// Pre-defined structural ancillary charge types
const ANCILLARY_CHARGE_TYPES = [
    "Field Trip",
    "Field Trip T-Shirt",
    "School T-Shirt",
    "School ID Card",
    "Medication (Minor)",
    "Development Fees",
    "School Hijab",
    "School Necktie",
    "Computer"
];

const FeesCostPage = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    const [feesList, setFeesList] = useState([]);
    const [editingFeeId, setEditingFeeId] = useState(null);
    const [classes, setClasses] = useState([]);
    const [searchClass, setSearchClass] = useState("");
    const [selectedClass, setSelectedClass] = useState(null);
    const [formError, setFormError] = useState("");

    const [ancillaryCharges, setAncillaryCharges] = useState([]);
    const [selectedChargeType, setSelectedChargeType] = useState(ANCILLARY_CHARGE_TYPES[0]);
    const [chargeAmount, setChargeAmount] = useState("");

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
        setAncillaryCharges([]);
        setChargeAmount("");
    }, [initialFeeState]);

    const handleAddAncillaryCharge = () => {
        const amt = parseFloat(chargeAmount);
        if (!amt || amt <= 0 || isNaN(amt)) {
            toast.error("Please provide a valid item charge amount.");
            return;
        }
        
        if (ancillaryCharges.some(c => c.type === selectedChargeType)) {
            toast.error("This item type charge is already added!");
            return;
        }

        setAncillaryCharges(prev => [...prev, { type: selectedChargeType, amount: amt }]);
        setChargeAmount("");
    };

    const handleRemoveAncillaryCharge = (index) => {
        setAncillaryCharges(prev => prev.filter((_, i) => i !== index));
    };

    const totals = useMemo(() => {
        const termSum = (t1, t2, t3) => parseFloat(t1 || 0) + parseFloat(t2 || 0) + parseFloat(t3 || 0);
        const ancillarySum = ancillaryCharges.reduce((acc, current) => acc + (current.amount || 0), 0);

        const rawNewTotal = termSum(feeData.new_term1, feeData.new_term2, feeData.new_term3) + ancillarySum;
        const rawContTotal = termSum(feeData.cont_term1, feeData.cont_term2, feeData.cont_term3) + ancillarySum;

        return {
            ancillaryTotal: ancillarySum.toFixed(2),
            newTotal: rawNewTotal.toFixed(2),
            contTotal: rawContTotal.toFixed(2)
        };
    }, [feeData, ancillaryCharges]);

    useEffect(() => {
        if (!schoolId || schoolId === "N/A") return;
        const q = query(collection(db, "FeesCost"), where("schoolId", "==", schoolId), limit(50));
        return onSnapshot(q, (snapshot) => {
            setFeesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
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
        setFormError("");
    };

    const handleFeeChange = (e) => {
        const { name, value } = e.target;
        setFeeData(prev => ({ ...prev, [name]: value }));
        if (formError) setFormError("");
    };

    const handleEdit = (fee) => {
        setEditingFeeId(fee.id);
        setFeeData({ ...fee });
        setSelectedClass({ className: fee.className });
        setSearchClass(fee.className);
        setAncillaryCharges(fee.ancillaryCharges || []);
        setFormError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
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
                ancillaryCharges: ancillaryCharges,
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
            toast.error("Error saving structure data");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure?")) return;
        try {
            await deleteDoc(doc(db, "FeesCost", id));
            toast.success("Deleted successfully!");
        } catch (err) {
            toast.error("Error deleting item");
        }
    };

    return (
        <div className="p-3 sm:p-6 bg-gray-100 min-h-screen">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 text-indigo-700 text-center sm:text-left">
                Fees & Ancillary Charges Manager
            </h2>

            <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-6 rounded-xl shadow-md mb-8 max-w-4xl mx-auto border-t-4 border-indigo-600">
                {formError && (
                    <div className="mb-4 p-3 bg-red-100 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">
                        {formError}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div className="relative">
                        <label className="block text-sm font-medium mb-1">Search Class</label>
                        <input
                            type="text"
                            value={searchClass}
                            onChange={(e) => setSearchClass(e.target.value)}
                            className="w-full p-2.5 border rounded shadow-sm focus:ring-2 focus:ring-indigo-300 outline-none text-sm"
                            placeholder="Type class name..."
                        />
                        {classes.length > 0 && (
                            <ul className="absolute z-20 w-full bg-white border mt-1 rounded shadow-lg max-h-56 overflow-y-auto">
                                {classes.map(cls => (
                                    <li key={cls.id} onClick={() => handleClassSelect(cls)} className="p-2.5 hover:bg-indigo-50 cursor-pointer text-sm border-b last:border-0">
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
                            className="w-full p-2.5 border rounded focus:ring-2 focus:ring-indigo-300 outline-none text-sm"
                            required
                        />
                    </div>
                </div>

                {/* --- TERM BASE TUITION VALUES --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h3 className="font-bold text-blue-700 mb-3 border-b border-blue-200 pb-1 text-sm sm:text-base">New Students Base Tuition</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:block">
                            {["1", "2", "3"].map(num => (
                                <div key={num} className="mb-2">
                                    <label className="text-xs font-semibold text-gray-600 block sm:inline">Term {num} (NLE)</label>
                                    <input
                                        type="number"
                                        name={`new_term${num}`}
                                        value={feeData[`new_term${num}`]}
                                        onChange={handleFeeChange}
                                        className="w-full p-2 border rounded text-sm bg-white mt-0.5 sm:mt-0"
                                        placeholder="0.00"
                                        step="0.01"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h3 className="font-bold text-green-700 mb-3 border-b border-green-200 pb-1 text-sm sm:text-base">Continuing Students Base Tuition</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:block">
                            {["1", "2", "3"].map(num => (
                                <div key={num} className="mb-2">
                                    <label className="text-xs font-semibold text-gray-600 block sm:inline">Term {num} (NLE)</label>
                                    <input
                                        type="number"
                                        name={`cont_term${num}`}
                                        value={feeData[`cont_term${num}`]}
                                        onChange={handleFeeChange}
                                        className="w-full p-2 border rounded text-sm bg-white mt-0.5 sm:mt-0"
                                        placeholder="0.00"
                                        step="0.01"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- DYNAMIC ANCILLARY ADDONS PANEL --- */}
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200 mb-6">
                    <h3 className="font-bold text-purple-700 mb-3 border-b border-purple-200 pb-1 text-sm sm:text-base">Ancillary Charges & Mandatory School Addons</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 mb-4">
                        <div className="sm:col-span-6">
                            <select
                                value={selectedChargeType}
                                onChange={(e) => setSelectedChargeType(e.target.value)}
                                className="p-2.5 border rounded bg-white w-full text-sm"
                            >
                                {ANCILLARY_CHARGE_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                        <div className="sm:col-span-3">
                            <input
                                type="number"
                                value={chargeAmount}
                                onChange={(e) => setChargeAmount(e.target.value)}
                                placeholder="Amount (NLE)"
                                className="p-2.5 border rounded bg-white w-full text-sm font-semibold"
                                step="0.01"
                            />
                        </div>
                        <div className="sm:col-span-3">
                            <button
                                type="button"
                                onClick={handleAddAncillaryCharge}
                                className="bg-purple-600 text-white w-full py-2.5 rounded text-sm font-bold hover:bg-purple-700 transition active:scale-95"
                            >
                                + Add Item
                            </button>
                        </div>
                    </div>

                    {ancillaryCharges.length > 0 ? (
                        <div className="bg-white border rounded divide-y max-h-40 overflow-y-auto mb-2 shadow-inner">
                            {ancillaryCharges.map((item, idx) => (
                                <div key={idx} className="p-2.5 flex justify-between items-center text-sm">
                                    <span className="text-gray-700 font-medium truncate pr-2">{item.type}</span>
                                    <div className="flex items-center space-x-3 flex-shrink-0">
                                        <span className="font-bold text-purple-600">NLE {item.amount.toFixed(2)}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAncillaryCharge(idx)}
                                            className="text-red-500 hover:text-red-700 font-bold p-1 touch-manipulation"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-500 italic mb-2">No extra ancillary items configured for this setup yet.</p>
                    )}
                    <p className="text-sm font-bold text-purple-800 text-right mt-1">Ancillary Aggregated Total: NLE {totals.ancillaryTotal}</p>
                </div>

                {/* Aggregation Combined Metrics Footer */}
                <div className="grid grid-cols-2 gap-4 border-t pt-4 text-center">
                    <div className="bg-blue-50/50 p-2 rounded border border-blue-100">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Gross New Student</p>
                        <p className="text-base sm:text-xl font-black text-blue-600 mt-0.5">NLE {totals.newTotal}</p>
                    </div>
                    <div className="bg-green-50/50 p-2 rounded border border-green-100">
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Gross Continuing</p>
                        <p className="text-base sm:text-xl font-black text-green-600 mt-0.5">NLE {totals.contTotal}</p>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button type="submit" className="flex-1 bg-indigo-600 text-white p-3 rounded-lg font-bold hover:bg-indigo-700 transition shadow touch-manipulation">
                        {editingFeeId ? "Update Structure" : "Save Structure"}
                    </button>
                    {editingFeeId && (
                        <button type="button" onClick={resetForm} className="bg-gray-400 text-white px-4 rounded-lg font-bold hover:bg-gray-500 transition">
                            Cancel
                        </button>
                    )}
                </div>
            </form>

            {/* --- LISTING LOG ARCHITECTURE BLOCK --- */}
            <div className="max-w-5xl mx-auto">
                <h3 className="text-lg font-bold mb-3 text-gray-700 px-1">Configured Fee Matrices</h3>
                
                {/* Mobile Card Layout View (Visible on screens smaller than md) */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                    {feesList.map(fee => (
                        <div key={fee.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                            <div className="flex justify-between items-start border-b pb-2 mb-2">
                                <div>
                                    <h4 className="font-bold text-gray-900 text-base">{fee.className}</h4>
                                    <p className="text-xs text-gray-500 font-semibold mt-0.5">Year: {fee.academicYear}</p>
                                </div>
                                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                    {fee.ancillaryCharges?.length || 0} Addons
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 text-xs py-1.5 bg-gray-50 rounded px-2.5">
                                <div>
                                    <span className="text-gray-500 block">New Total:</span>
                                    <span className="font-bold text-blue-600 text-sm">NLE {fee.new_total?.toFixed(2)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 block">Continuing Total:</span>
                                    <span className="font-bold text-green-600 text-sm">NLE {fee.cont_total?.toFixed(2)}</span>
                                </div>
                            </div>
                            
                            <div className="flex justify-end space-x-4 mt-3 pt-2 border-t text-sm font-semibold">
                                <button onClick={() => handleEdit(fee)} className="text-orange-500 active:text-orange-700">
                                    Edit Structure
                                </button>
                                <button onClick={() => handleDelete(fee.id)} className="text-red-500 active:text-red-700">
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                    {feesList.length === 0 && (
                        <p className="text-center text-sm text-gray-500 bg-white p-6 rounded-xl border border-dashed">No configuration logs discovered.</p>
                    )}
                </div>

                {/* Desktop Grid Layout View (Hidden on mobile screens, renders on >= md screens) */}
                <div className="hidden md:block bg-white rounded-xl shadow-md overflow-hidden border">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-4 text-sm font-bold text-gray-700">Class</th>
                                <th className="p-4 text-sm font-bold text-gray-700">Year</th>
                                <th className="p-4 text-sm font-bold text-purple-600">Addons Count</th>
                                <th className="p-4 text-sm font-bold text-blue-600 text-center">New Total Gross</th>
                                <th className="p-4 text-sm font-bold text-green-600 text-center">Cont. Total Gross</th>
                                <th className="p-4 text-sm font-bold text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {feesList.map(fee => (
                                <tr key={fee.id} className="hover:bg-gray-50/70 transition">
                                    <td className="p-4 text-sm font-semibold text-gray-900">{fee.className}</td>
                                    <td className="p-4 text-sm text-gray-600">{fee.academicYear}</td>
                                    <td className="p-4 text-sm text-purple-600 font-semibold">
                                        {fee.ancillaryCharges?.length || 0} items
                                    </td>
                                    <td className="p-4 text-sm text-center font-bold text-blue-600">NLE {fee.new_total?.toFixed(2)}</td>
                                    <td className="p-4 text-sm text-center font-bold text-green-600">NLE {fee.cont_total?.toFixed(2)}</td>
                                    <td className="p-4 text-sm space-x-4 font-semibold">
                                        <button onClick={() => handleEdit(fee)} className="text-orange-500 hover:underline">Edit</button>
                                        <button onClick={() => handleDelete(fee.id)} className="text-red-500 hover:underline">Delete</button>
                                    </td>
                                </tr>
                            ))}
                            {feesList.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-6 text-center text-sm text-gray-500 italic">No configuration logs discovered.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FeesCostPage;