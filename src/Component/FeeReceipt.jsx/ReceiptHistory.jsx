import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, orderBy, doc, deleteDoc } from "firebase/firestore";
import { db } from "../../../firebase"; // Ensure path matches your project structure
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const ReceiptHistory = () => {
    const navigate = useNavigate();

    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    // Fetch all receipts from Firestore in real-time
    useEffect(() => {
        const q = query(
            collection(db, "Receipts"),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const fetchedReceipts = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                setReceipts(fetchedReceipts);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching receipts:", error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Delete receipt function
    const handleDeleteReceipt = async (id, receiptId) => {
        const confirmDelete = window.confirm(
            `Are you sure you want to delete receipt #${receiptId || id}? This action cannot be undone.`
        );

        if (!confirmDelete) return;

        setDeletingId(id);
        try {
            await deleteDoc(doc(db, "Receipts", id));
            toast.success("Receipt deleted successfully!");
            if (selectedReceipt?.id === id) {
                setSelectedReceipt(null);
            }
        } catch (error) {
            console.error("Error deleting receipt:", error);
            toast.error("Failed to delete receipt. Please try again.");
        } finally {
            setDeletingId(null);
        }
    };

    // Filter receipts by Student Name, ID, or Receipt ID
    const filteredReceipts = receipts.filter((item) => {
        const term = searchTerm.toLowerCase();
        return (
            item.studentName?.toLowerCase().includes(term) ||
            item.studentID?.toLowerCase().includes(term) ||
            item.receiptId?.toLowerCase().includes(term) ||
            item.academicYear?.toLowerCase().includes(term)
        );
    });

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* --- HEADER & CONTROLS --- */}
                <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            Fee Receipts & Payment Records 🧾
                        </h1>
                        <p className="text-sm text-gray-500">
                            View, manage, and delete payment receipts generated across academic years.
                        </p>
                    </div>

                    <div className="flex gap-3 w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="Search by Name, ID, or Receipt #..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="p-2.5 border rounded-lg w-full md:w-72 focus:ring-2 focus:ring-indigo-500"
                        />
                        <button
                            onClick={() => navigate(-1)}
                            className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition"
                        >
                            Back
                        </button>
                    </div>
                </div>

                {/* --- TABLE OF RECEIPTS --- */}
                <div className="bg-white rounded-2xl shadow-md p-6">
                    {loading ? (
                        <div className="text-center py-10 text-indigo-600 font-semibold">
                            Loading receipt records...
                        </div>
                    ) : filteredReceipts.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            No payment receipts found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase border-b">
                                        <th className="py-3 px-4">Receipt ID</th>
                                        <th className="py-3 px-4">Date</th>
                                        <th className="py-3 px-4">Student Name</th>
                                        <th className="py-3 px-4">Student ID</th>
                                        <th className="py-3 px-4">Academic Year</th>
                                        <th className="py-3 px-4">Fee Type</th>
                                        <th className="py-3 px-4 text-right">Amount Paid</th>
                                        <th className="py-3 px-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                                    {filteredReceipts.map((receipt) => (
                                        <tr key={receipt.id} className="hover:bg-gray-50 transition">
                                            <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                                                {receipt.receiptId || "N/A"}
                                            </td>
                                            <td className="py-3 px-4">{receipt.paymentDate}</td>
                                            <td className="py-3 px-4 font-semibold text-gray-900">
                                                {receipt.studentName}
                                            </td>
                                            <td className="py-3 px-4">{receipt.studentID}</td>
                                            <td className="py-3 px-4">{receipt.academicYear}</td>
                                            <td className="py-3 px-4">{receipt.feeType}</td>
                                            <td className="py-3 px-4 text-right font-bold text-green-600">
                                                GHS {Number(receipt.amount || 0).toFixed(2)}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setSelectedReceipt(receipt)}
                                                        className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-md text-xs font-bold hover:bg-indigo-100 transition"
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteReceipt(receipt.id, receipt.receiptId)}
                                                        disabled={deletingId === receipt.id}
                                                        className="bg-red-50 text-red-600 px-3 py-1 rounded-md text-xs font-bold hover:bg-red-100 transition disabled:opacity-50"
                                                    >
                                                        {deletingId === receipt.id ? "Deleting..." : "Delete"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* --- RECEIPT MODAL --- */}
            {selectedReceipt && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 print:w-full print:max-w-none print:p-0">
                        <div className="text-center border-b pb-4">
                            <h2 className="text-xl font-bold text-gray-800">PAYMENT RECEIPT</h2>
                            <p className="text-xs text-gray-500">Official Fee Receipt</p>
                        </div>

                        <div className="space-y-2 text-sm text-gray-700">
                            <div className="flex justify-between">
                                <span className="font-semibold text-gray-500">Receipt No:</span>
                                <span className="font-mono font-bold">{selectedReceipt.receiptId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold text-gray-500">Date:</span>
                                <span>{selectedReceipt.paymentDate}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold text-gray-500">Student Name:</span>
                                <span className="font-bold">{selectedReceipt.studentName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold text-gray-500">Student ID:</span>
                                <span>{selectedReceipt.studentID}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold text-gray-500">Class:</span>
                                <span>{selectedReceipt.class}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold text-gray-500">Academic Year:</span>
                                <span>{selectedReceipt.academicYear}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2">
                                <span className="font-semibold text-gray-500">Fee Label:</span>
                                <span>{selectedReceipt.feeType}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-semibold text-gray-500">Payment Method:</span>
                                <span>{selectedReceipt.paymentMethod}</span>
                            </div>
                            <div className="flex justify-between border-t pt-2 text-base font-bold">
                                <span>Amount Paid:</span>
                                <span className="text-green-600">
                                    GHS {Number(selectedReceipt.amount || 0).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs text-red-600 font-semibold">
                                <span>Remaining Balance:</span>
                                <span>
                                    GHS {Number(selectedReceipt.balance || 0).toFixed(2)}
                                </span>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex gap-2 border-t pt-4 print:hidden">
                            <button
                                onClick={handlePrint}
                                className="flex-1 bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 transition"
                            >
                                🖨️ Print
                            </button>
                            <button
                                onClick={() => handleDeleteReceipt(selectedReceipt.id, selectedReceipt.receiptId)}
                                disabled={deletingId === selectedReceipt.id}
                                className="bg-red-600 text-white font-bold px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                            >
                                Delete
                            </button>
                            <button
                                onClick={() => setSelectedReceipt(null)}
                                className="bg-gray-200 text-gray-700 font-bold px-4 py-2 rounded-lg hover:bg-gray-300 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReceiptHistory;