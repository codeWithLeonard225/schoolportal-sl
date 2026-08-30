import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../../firebase"; // Ensure path matches your project structure
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";

const generateUniqueReceiptId = () => uuidv4().slice(0, 10).toUpperCase();

const PreviousFees = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const initialData = location.state || {};
    
    // State to track paid amounts and balance dynamically
    const [studentData, setStudentData] = useState({
        studentID: initialData.studentID || "",
        studentName: initialData.studentName || "",
        academicYear: initialData.academicYear || "",
        className: initialData.className || "",
        totalFee: Number(initialData.totalFee || 0),
        totalPaid: Number(initialData.totalPaid || 0),
        balance: Number(initialData.balance || 0),
        schoolId: initialData.schoolId || "N/A",
    });

    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("Cash");
    const [feeType, setFeeType] = useState("Term 3");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!studentData.studentID) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="bg-white p-6 rounded-xl shadow-lg text-center max-w-sm">
                    <h2 className="text-xl font-bold text-red-600 mb-2">
                        No Previous Fee Record Found
                    </h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Navigation state is missing. Please select a student from the fee receipts page.
                    </p>
                    <button
                        onClick={() => navigate(-1)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

   // In PreviousFees.jsx
const handlePayPreviousFee = async (e) => {
    e.preventDefault();

    const amountToPay = parseFloat(paymentAmount);
    if (isNaN(amountToPay) || amountToPay <= 0) {
        return toast.error("Please enter a valid amount greater than 0.");
    }

    if (amountToPay > studentData.balance) {
        return toast.error(`Payment cannot exceed the outstanding balance of GHS ${studentData.balance.toFixed(2)}`);
    }

    setIsSubmitting(true);

    try {
        const receiptId = generateUniqueReceiptId();
        const newTotalPaid = studentData.totalPaid + amountToPay;
        const newBalance = studentData.totalFee - newTotalPaid;

        // Save receipt with matching field structures
        await addDoc(collection(db, "Receipts"), {
            receiptId: receiptId,
            studentID: studentData.studentID,
            studentDocId: initialData.studentDocId || "", // ✅ Pass/Store doc ID if needed
            studentName: studentData.studentName,
            class: studentData.className,
            academicYear: studentData.academicYear,
            feeType: feeType,
            amount: amountToPay,
            totalFee: studentData.totalFee,
            balance: newBalance,
            paymentMethod: paymentMethod,
            paymentDate: new Date().toISOString().slice(0, 10),
            createdAt: new Date(),
            schoolId: studentData.schoolId, // ✅ Properly linked schoolId
            note: `Arrears payment for ${studentData.academicYear}`,
        });

        setStudentData((prev) => ({
            ...prev,
            totalPaid: newTotalPaid,
            balance: newBalance,
        }));

        toast.success(`Payment recorded! Receipt: ${receiptId}`);
        setPaymentAmount("");

    } catch (error) {
        console.error("Error paying previous fee:", error);
        toast.error("Failed to process payment. Please try again.");
    } finally {
        setIsSubmitting(false);
    }
};

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h1 className="text-2xl font-bold text-center text-indigo-700 mb-6">
                        Previous Fees Payment 🧾
                    </h1>

                    {/* Student Information */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                        <h2 className="text-lg font-bold text-blue-800 mb-3">
                            Student Information
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-gray-700">
                            <p><strong>Name:</strong> {studentData.studentName}</p>
                            <p><strong>Student ID:</strong> {studentData.studentID}</p>
                            <p><strong>Class:</strong> {studentData.className}</p>
                            <p><strong>Academic Year:</strong> {studentData.academicYear}</p>
                        </div>
                    </div>

                    {/* Fee Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-blue-50 border rounded-xl p-5 text-center">
                            <p className="text-sm text-gray-600">Total Fee</p>
                            <p className="text-2xl font-bold text-blue-600">
                                NLE {studentData.totalFee.toFixed(2)}
                            </p>
                        </div>

                        <div className="bg-green-50 border rounded-xl p-5 text-center">
                            <p className="text-sm text-gray-600">Total Paid</p>
                            <p className="text-2xl font-bold text-green-600">
                                GHS {studentData.totalPaid.toFixed(2)}
                            </p>
                        </div>

                        <div className={`border rounded-xl p-5 text-center ${studentData.balance > 0 ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
                            <p className="text-sm text-gray-600">Outstanding Balance</p>
                            <p className={`text-2xl font-bold ${studentData.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                GHS {studentData.balance.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* Payment Form (Only shown if balance > 0) */}
                    {studentData.balance > 0 ? (
                        <form onSubmit={handlePayPreviousFee} className="bg-gray-50 border p-5 rounded-xl mb-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">
                                Pay Arrears for {studentData.academicYear} 💰
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Amount to Pay (GHS)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max={studentData.balance}
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        placeholder={`Max ${studentData.balance.toFixed(2)}`}
                                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Payment Method
                                    </label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full p-2.5 border rounded-lg bg-white"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Mobile Money">Mobile Money</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Cheque">Cheque</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Fee Type / Label
                                    </label>
                                    <input
                                        type="text"
                                        value={feeType}
                                        onChange={(e) => setFeeType(e.target.value)}
                                        className="w-full p-2.5 border rounded-lg bg-white"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                            >
                                {isSubmitting ? "Processing Payment..." : "Submit Payment 🎉"}
                            </button>
                        </form>
                    ) : (
                        <div className="bg-green-100 border border-green-300 rounded-xl p-4 text-center mb-6">
                            <p className="font-bold text-green-800">
                                🎉 This student has fully cleared all fees for {studentData.academicYear}!
                            </p>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            onClick={() => navigate(-1)}
                            className="bg-gray-600 text-white px-5 py-2 rounded-lg hover:bg-gray-700 transition"
                        >
                            ← Back
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PreviousFees;