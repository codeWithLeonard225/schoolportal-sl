import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import CloudinaryImageUploader from "../CaptureCamera/CloudinaryImageUploader";
import { collection, query, where, onSnapshot, limit, doc, setDoc, deleteDoc } from "firebase/firestore";
import { pupilLoginFetch } from "../Database/PupilLogin"; // Firestore instance for Pupils
import { db } from "../../../firebase"; // Firestore instance for FeesCost

// Helper function to generate a clean UUID / Unique Receipt ID if missing
const generateUUID = () => {
    return 'REC-' + Math.random().toString(36).substring(2, 9).toUpperCase();
};

const AncillaryReceiptForm = ({
    onSubmit = (payload) => console.log("Receipt submitted:", payload), 
    editingReceiptId: propEditingReceiptId = null,
    receiptData = {},
    selectedStudent: propSelectedStudent,
    schoolId: propSchoolId,
    handleUploadSuccess,
    setIsUploading = () => {},
    setUploadProgress = () => {},
    isUploading = false,
    uploadProgress = 0,
    setShowCamera = () => {},
    onCancelEdit = () => {}
}) => {
    const location = useLocation();
    const effectiveSchoolId = 
        location.state?.schoolId || 
        propSchoolId || 
        propSelectedStudent?.schoolID || 
        receiptData?.schoolID || 
        "";

    // Local Management States
    const [editingReceiptId, setEditingReceiptId] = useState(propEditingReceiptId);
    const [receiptsList, setReceiptsList] = useState([]); 
    const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);

    // --- Table Filtering States ---
    const [filterType, setFilterType] = useState("today"); // 'today', 'all', 'class'
    const [filterClass, setFilterClass] = useState("");

    // --- Student Search & Selection Local States ---
    const [searchTerm, setSearchTerm] = useState("");
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(propSelectedStudent || null);

    // Dynamic Ancillary Items
    const [fetchedAncillaryItems, setFetchedAncillaryItems] = useState([]);
    const [isFetchingItems, setIsFetchingItems] = useState(false);

    // Form Field States
    const [selectedItems, setSelectedItems] = useState(receiptData?.items || []);
    const [paymentDate, setPaymentDate] = useState(receiptData?.paymentDate || new Date().toISOString().split("T")[0]);
    const [paymentMethod, setPaymentMethod] = useState(receiptData?.paymentMethod || "Cash");

    // --- Active Receipt ID & Academic Year ---
    const activeReceiptId = useMemo(() => {
        return editingReceiptId || receiptData?.receiptId || generateUUID();
    }, [editingReceiptId, receiptData?.receiptId]);

    const activeAcademicYear = useMemo(() => {
        return receiptData?.academicYear || location.state?.academicYear || "2026/2027";
    }, [receiptData?.academicYear, location.state?.academicYear]);

    // --- NEW: Real-time Fetch Issued Receipts from Firestore ---
    useEffect(() => {
        if (!effectiveSchoolId || effectiveSchoolId === "N/A") return;

        const receiptsRef = collection(db, "AncillaryReceipts"); // Create/Use this collection in Firebase
        const q = query(receiptsRef, where("schoolID", "==", effectiveSchoolId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedReceipts = snapshot.docs.map(doc => ({ ...doc.data() }));
            // Sort locally by date descending
            fetchedReceipts.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
            setReceiptsList(fetchedReceipts);
        }, (error) => {
            console.error("Error fetching receipts:", error);
        });

        return () => unsubscribe();
    }, [effectiveSchoolId]);

    // --- Filter the Receipts List Dynamically ---
    const filteredReceipts = useMemo(() => {
        let filtered = [...receiptsList];

        if (filterType === "today") {
            const todayStr = new Date().toISOString().split("T")[0];
            filtered = filtered.filter(r => r.paymentDate === todayStr);
        } else if (filterType === "class" && filterClass.trim() !== "") {
            filtered = filtered.filter(r => 
                r.class?.toLowerCase().includes(filterClass.toLowerCase())
            );
        }
        
        return filtered; // 'all' returns the unfiltered list
    }, [receiptsList, filterType, filterClass]);


    // Sync props to state
    useEffect(() => {
        setEditingReceiptId(propEditingReceiptId);
    }, [propEditingReceiptId]);

    useEffect(() => {
        if (propSelectedStudent) {
            setSelectedStudent(propSelectedStudent);
            setSearchTerm(propSelectedStudent.studentName || "");
        }
    }, [propSelectedStudent]);

    // --- Real-time Student Listener ---
    useEffect(() => {
        if (!searchTerm.trim()) {
            setStudents([]);
            return;
        }
        if (!effectiveSchoolId || effectiveSchoolId === "N/A") return;

        const pupilsRef = collection(pupilLoginFetch, "PupilsReg");
        const q = query(pupilsRef, where("schoolId", "==", effectiveSchoolId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const filtered = allStudents
                .filter(s => s.studentName?.toLowerCase().includes(searchTerm.toLowerCase()))
                .slice(0, 10);
            setStudents(filtered);
        });

        return () => unsubscribe();
    }, [searchTerm, effectiveSchoolId]);

    // --- Fetch Ancillary Charges ---
    useEffect(() => {
        const studentClass = selectedStudent?.class || receiptData?.class;
        if (!effectiveSchoolId || !studentClass || !activeAcademicYear) {
            setFetchedAncillaryItems([]);
            return;
        }

        setIsFetchingItems(true);
        const feesCostRef = collection(db, "FeesCost");
        const q = query(
            feesCostRef,
            where("schoolId", "==", effectiveSchoolId),
            where("className", "==", studentClass),
            where("academicYear", "==", activeAcademicYear),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setIsFetchingItems(false);
            if (!snapshot.empty) {
                setFetchedAncillaryItems(snapshot.docs[0].data().ancillaryCharges || []);
            } else {
                setFetchedAncillaryItems([]);
            }
        });

        return () => unsubscribe();
    }, [effectiveSchoolId, selectedStudent?.class, receiptData?.class, activeAcademicYear]);


    const handleStudentSelect = (student) => {
        setSelectedStudent(student);
        setSearchTerm(student ? student.studentName : "");
        setStudents([]);
    };

    const handleItemToggle = (item) => {
        setSelectedItems(prev => {
            const exists = prev.find(i => i.type === item.type);
            if (exists) return prev.filter(i => i.type !== item.type);
            return [...prev, { type: item.type, amount: item.amount, quantity: 1 }];
        });
    };

    const handleQuantityChange = (type, qty) => {
        const parsedQty = parseInt(qty, 10) || 1;
        setSelectedItems(prev =>
            prev.map(item => item.type === type ? { ...item, quantity: Math.max(1, parsedQty) } : item)
        );
    };

    const grandTotal = useMemo(() => {
        return selectedItems.reduce((acc, curr) => acc + (curr.amount * curr.quantity), 0);
    }, [selectedItems]);

    const resetForm = () => {
        setSelectedItems([]);
        setSelectedStudent(null);
        setSearchTerm("");
        setEditingReceiptId(null);
    };

    // --- Save to Firestore ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedStudent || selectedItems.length === 0) {
            alert("Please select a student and at least one charge item.");
            return;
        }

        setIsSubmittingLocal(true);

        const payload = {
            ...receiptData,
            receiptId: activeReceiptId,
            academicYear: activeAcademicYear,
            schoolID: effectiveSchoolId,
            studentDocId: selectedStudent.id,
            studentID: selectedStudent.studentID,
            studentName: selectedStudent.studentName,
            class: selectedStudent.class,
            items: selectedItems,
            totalAmount: grandTotal,
            paymentDate,
            paymentMethod,
            receiptType: "Ancillary & Addons",
            timestamp: new Date().toISOString()
        };

        try {
            // Write to Firestore Database
            const receiptDocRef = doc(db, "AncillaryReceipts", payload.receiptId);
            await setDoc(receiptDocRef, payload);

            onSubmit(payload); // Optional: call parent if it needs to know
            resetForm();
            alert("Receipt saved successfully!");
        } catch (error) {
            console.error("Error saving receipt:", error);
            alert("Failed to save receipt. Please check your connection.");
        } finally {
            setIsSubmittingLocal(false);
        }
    };

    const handleEditReceipt = (receipt) => {
        setEditingReceiptId(receipt.receiptId);
        setSelectedStudent({
            id: receipt.studentDocId,
            studentID: receipt.studentID,
            studentName: receipt.studentName,
            class: receipt.class
        });
        setSearchTerm(receipt.studentName);
        setSelectedItems(receipt.items || []);
        setPaymentDate(receipt.paymentDate);
        setPaymentMethod(receipt.paymentMethod);
        window.scrollTo({ top: 0, behavior: "smooth" }); // Scroll to top for easy editing
    };

    // --- Delete from Firestore ---
    const handleDeleteReceipt = async (receiptId) => {
        if (window.confirm(`Are you sure you want to delete receipt #${receiptId}?`)) {
            try {
                await deleteDoc(doc(db, "AncillaryReceipts", receiptId));
                if (editingReceiptId === receiptId) resetForm();
                alert("Receipt deleted successfully!");
            } catch (error) {
                console.error("Error deleting receipt:", error);
                alert("Failed to delete receipt.");
            }
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-8">
            {/* --- Receipt Form --- */}
            <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-2xl p-6 w-full border-t-4 border-purple-600">
                <h2 className="text-2xl font-bold text-center mb-6 text-purple-700">
                    {editingReceiptId ? "Update Ancillary Receipt" : "Ancillary & Addons Receipt"} 🛍️
                </h2>

                <div className="flex justify-between flex-wrap mb-4 text-sm text-gray-600 border-b pb-2">
                    <p><strong>Receipt ID:</strong> <span className="font-bold text-purple-600">{activeReceiptId}</span></p>
                    <p><strong>Academic Year:</strong> <span className="font-bold text-indigo-700">{activeAcademicYear}</span></p>
                    <p><strong>Class:</strong> <span className="font-bold text-gray-800">{selectedStudent?.class || receiptData?.class || 'N/A'}</span></p>
                </div>

                <div className="mb-4">
                    <label className="block mb-1 font-medium text-xs text-gray-500 uppercase">School ID</label>
                    <input
                        type="text"
                        value={effectiveSchoolId}
                        readOnly
                        placeholder="N/A"
                        className="w-full p-2 border rounded-lg bg-gray-100 text-gray-600 text-sm font-semibold"
                    />
                </div>

                <div className="mb-6 border p-4 rounded-lg bg-purple-50/50 border-purple-100">
                    <label className="block mb-2 font-medium text-sm text-purple-800">Select Student</label>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => {
                            setSearchTerm(e.target.value);
                            if (selectedStudent) setSelectedStudent(null);
                        }}
                        placeholder="Start typing student name..."
                        className="w-full p-2.5 mb-2 border rounded-lg focus:ring-purple-500 focus:border-purple-500 text-sm"
                        disabled={!!editingReceiptId}
                    />

                    {selectedStudent ? (
                        <div className="p-3 mt-2 bg-purple-100 border border-purple-300 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="font-bold text-purple-900 text-sm">{selectedStudent.studentName}</p>
                                <p className="text-xs text-purple-700">ID: {selectedStudent.studentID} | Class: {selectedStudent.class || 'N/A'}</p>
                            </div>
                            {!editingReceiptId && (
                                <button type="button" onClick={() => handleStudentSelect(null)} className="text-xs text-red-600 font-bold hover:underline">
                                    Change
                                </button>
                            )}
                        </div>
                    ) : (
                        searchTerm.trim() && (
                            <ul className="max-h-40 overflow-y-auto border-t border-gray-200 mt-2 bg-white rounded-md shadow-inner divide-y">
                                {students.map(student => (
                                    <li
                                        key={student.id || student.studentID}
                                        onClick={() => handleStudentSelect(student)}
                                        className="p-2.5 cursor-pointer hover:bg-purple-50 text-sm flex justify-between items-center"
                                    >
                                        <span className="font-medium text-gray-800">{student.studentName}</span>
                                        <span className="text-xs text-gray-500">Class: {student.class || 'N/A'}</span>
                                    </li>
                                ))}
                                {students.length === 0 && <li className="p-3 text-gray-500 text-sm text-center">No students found.</li>}
                            </ul>
                        )
                    )}
                </div>

                <div className="mb-6">
                    <label className="block mb-2 font-bold text-sm text-gray-700">Select Addons / Ancillary Charges</label>
                    {isFetchingItems ? (
                        <p className="text-sm text-purple-600 italic p-3 border rounded-lg bg-purple-50">Loading charge structure...</p>
                    ) : fetchedAncillaryItems.length > 0 ? (
                        <div className="border rounded-xl p-3 bg-gray-50 max-h-56 overflow-y-auto space-y-2">
                            {fetchedAncillaryItems.map((item, idx) => {
                                const isChecked = selectedItems.some(i => i.type === item.type);
                                const selectedItem = selectedItems.find(i => i.type === item.type);

                                return (
                                    <div key={idx} className={`flex items-center justify-between p-2.5 rounded-lg border transition ${isChecked ? "bg-purple-50 border-purple-300" : "bg-white border-gray-200"}`}>
                                        <label className="flex items-center space-x-3 cursor-pointer flex-1">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleItemToggle(item)}
                                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 rounded border-gray-300"
                                            />
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800">{item.type}</p>
                                                <p className="text-xs text-purple-600 font-bold">NLE {(item.amount || 0).toFixed(2)} / unit</p>
                                            </div>
                                        </label>
                                        {isChecked && (
                                            <div className="flex items-center space-x-2">
                                                <span className="text-xs text-gray-500 font-medium">Qty:</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={selectedItem?.quantity || 1}
                                                    onChange={(e) => handleQuantityChange(item.type, e.target.value)}
                                                    className="w-16 p-1 border rounded text-center text-sm font-bold bg-white focus:ring-purple-500"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic p-3 border rounded-lg bg-gray-50">
                            {!selectedStudent && !receiptData?.class ? "Please select a student to load ancillary charges." : `No ancillary items configured for ${selectedStudent?.class || receiptData?.class} (${activeAcademicYear}).`}
                        </p>
                    )}
                </div>

                <div className="mb-6 p-4 bg-purple-900 text-white rounded-xl flex justify-between items-center shadow-md">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-purple-200 font-bold">Total Ancillary Amount</p>
                        <p className="text-xs text-purple-300">{selectedItems.length} item(s) selected</p>
                    </div>
                    <div className="text-2xl font-black text-yellow-300">NLE {grandTotal.toFixed(2)}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block mb-1 font-medium text-xs text-gray-600">Payment Date</label>
                        <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full p-2.5 border rounded-lg text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-1 font-medium text-xs text-gray-600">Payment Method</label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="w-full p-2.5 border rounded-lg text-sm bg-white"
                            required
                        >
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Mobile Money">Mobile Money</option>
                            <option value="Cheque">Cheque</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-col items-center mb-4 border-t pt-4">
                    <label className="mb-2 font-medium text-xs text-gray-600 uppercase">Receipt Photo (Optional)</label>
                    <div className="border-2 border-dashed w-36 h-24 flex items-center justify-center bg-gray-50 rounded-lg mb-2 overflow-hidden">
                        {receiptData?.receiptPhotoUrl ? (
                            <img src={receiptData.receiptPhotoUrl} alt="Receipt Proof" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-xs text-gray-400">Upload Proof</span>
                        )}
                    </div>
                    <div className="flex space-x-2 w-full max-w-xs justify-center">
                        <CloudinaryImageUploader
                            onUploadSuccess={handleUploadSuccess}
                            onUploadStart={() => { setIsUploading(true); setUploadProgress(0); }}
                            onUploadProgress={setUploadProgress}
                            onUploadComplete={() => setIsUploading(false)}
                            folder="Ancillary_Receipt_Photos"
                        />
                        <button type="button" onClick={() => setShowCamera(true)} className="flex-1 bg-green-600 text-white py-2 px-3 rounded-md text-xs font-semibold hover:bg-green-700" disabled={isUploading}>
                            Camera
                        </button>
                    </div>
                    {isUploading && (
                        <div className="w-full max-w-xs bg-gray-200 rounded-full h-1.5 mt-2">
                            <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                    )}
                </div>

                <div className="flex space-x-3 mt-6">
                    <button
                        type="submit"
                        disabled={isSubmittingLocal || isUploading || !selectedStudent || selectedItems.length === 0}
                        className="flex-1 bg-purple-600 text-white p-3 rounded-xl font-bold hover:bg-purple-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed shadow"
                    >
                        {isSubmittingLocal ? "Processing..." : editingReceiptId ? "Update Ancillary Receipt" : "Issue Ancillary Receipt"}
                    </button>
                    {editingReceiptId && (
                        <button type="button" onClick={() => { resetForm(); onCancelEdit(); }} className="w-1/3 bg-gray-400 text-white p-3 rounded-xl font-bold hover:bg-gray-500 transition">
                            Cancel
                        </button>
                    )}
                </div>
            </form>

            {/* --- Issued Receipts Action Table & Filters --- */}
            <div className="bg-white shadow-lg rounded-2xl p-6 border-t-4 border-indigo-600">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4 md:mb-0">
                        Issued Ancillary Receipts
                        <span className="text-xs bg-purple-100 text-purple-800 font-semibold px-2.5 py-1 rounded-full">
                            {filteredReceipts.length} shown
                        </span>
                    </h3>

                    {/* Table Controls (Today, All, By Class) */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <select 
                            value={filterType} 
                            onChange={(e) => {
                                setFilterType(e.target.value);
                                if(e.target.value !== "class") setFilterClass("");
                            }}
                            className="p-2 border rounded-lg text-sm bg-gray-50 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="today">Today's Transactions</option>
                            <option value="all">All Transactions</option>
                            <option value="class">Filter by Class</option>
                        </select>
                        
                        {filterType === "class" && (
                            <input 
                                type="text"
                                placeholder="Enter Class Name (e.g. JSS 1)"
                                value={filterClass}
                                onChange={(e) => setFilterClass(e.target.value)}
                                className="p-2 border rounded-lg text-sm bg-gray-50 focus:ring-indigo-500 focus:border-indigo-500 w-full sm:w-48"
                            />
                        )}
                    </div>
                </div>

                {filteredReceipts.length === 0 ? (
                    <p className="text-sm text-gray-500 italic text-center py-6 border rounded-xl bg-gray-50">
                        {filterType === "today" 
                            ? "No transactions found for today." 
                            : filterType === "class" && filterClass 
                            ? `No transactions found for class: ${filterClass}` 
                            : "No receipts issued yet."}
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-600">
                            <thead className="text-xs text-gray-700 uppercase bg-purple-50">
                                <tr>
                                    <th className="py-3 px-4">Receipt ID</th>
                                    <th className="py-3 px-4">Student</th>
                                    <th className="py-3 px-4">Class</th>
                                    <th className="py-3 px-4">Items</th>
                                    <th className="py-3 px-4">Total</th>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredReceipts.map((receipt) => (
                                    <tr key={receipt.receiptId} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 font-bold text-purple-700">{receipt.receiptId}</td>
                                        <td className="py-3 px-4 font-medium text-gray-900">{receipt.studentName}</td>
                                        <td className="py-3 px-4">{receipt.class || 'N/A'}</td>
                                        <td className="py-3 px-4 text-xs">
                                            {receipt.items?.map(i => `${i.type} (${i.quantity})`).join(", ")}
                                        </td>
                                        <td className="py-3 px-4 font-bold text-green-700">
                                            NLE {receipt.totalAmount?.toFixed(2)}
                                        </td>
                                        <td className="py-3 px-4">{receipt.paymentDate}</td>
                                        <td className="py-3 px-4 text-center space-x-2">
                                            <button type="button" onClick={() => handleEditReceipt(receipt)} className="px-3 py-1 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition shadow-sm">
                                                Edit
                                            </button>
                                            <button type="button" onClick={() => handleDeleteReceipt(receipt.receiptId)} className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition shadow-sm">
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AncillaryReceiptForm;