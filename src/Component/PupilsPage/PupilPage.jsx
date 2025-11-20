import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
// Import Firestore functions needed for real-time listener
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../Security/AuthContext";

const PupilPage = () => {
     const { user } = useAuth();
    

       if (!user) return <p>Loading...</p>;

    const location = useLocation();
    const navigate = useNavigate();

    // Get pupil data from location state
   const pupil = user?.role === "pupil" ? user.data : null;
   if (!pupil) return <p>Loading...</p>;

    // New state to hold ALL fee data, fetched in real-time
    const [fees, setFees] = useState([]);

    // Local state to hold the list of unique years
    const [uniqueYears, setUniqueYears] = useState([]);
    // Local state for the selected year
    const [selectedYear, setSelectedYear] = useState("");
    // Local state for the filtered fees to be displayed
    const [filteredFees, setFilteredFees] = useState([]);

    // --- 1. HANDLE INITIAL LOAD AND REAL-TIME DATA FETCH (onSnapshot) ---
    useEffect(() => {
        // 1. Safety Check and Redirect
        if (!pupil || !pupil.studentID) {
            navigate("/", { replace: true });
            return;
        }

        // 2. Set up the Real-Time Listener (onSnapshot)
        const q = query(
            collection(db, "Receipts"),
            where("studentID", "==", pupil.studentID)
        );

        // This listener fetches the data initially AND listens for all future changes
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const liveFees = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Update the main fees state
            setFees(liveFees);

            // Re-calculate unique years and update selectedYear
            if (liveFees.length > 0) {
                const years = [...new Set(liveFees.map((fee) => fee.academicYear))]
                    .sort()
                    .reverse();

                setUniqueYears(years);
                // Set the default selected year if it hasn't been set yet
                if (!selectedYear) {
                    setSelectedYear(years[0] || "");
                }
            } else {
                setUniqueYears([]);
                setSelectedYear("");
            }
        },
            (error) => {
                console.error("Error fetching real-time fee data:", error);
                // Handle error gracefully
            });

        // 3. Cleanup: Unsubscribe when the component unmounts
        return () => unsubscribe();

    }, [pupil, navigate, selectedYear]); // Dependency on selectedYear ensures it updates if necessary

    // --- 2. FILTER FEES (Runs when selectedYear or fees changes) ---
    useEffect(() => {
        if (selectedYear) {
            const newFilteredFees = fees.filter(
                (fee) => fee.academicYear === selectedYear
            );
            setFilteredFees(newFilteredFees);
        } else {
            // If no year is selected (i.e., on initial load with no fees), show nothing
            setFilteredFees([]);
        }
    }, [selectedYear, fees]);


    // Calculate Totals (Runs whenever filteredFees changes)
    const totalCharged = filteredFees.reduce(
        (sum, fee) => sum + (parseFloat(fee.amount || 0) + parseFloat(fee.balance || 0)),
        0
    );

    const totalPaid = filteredFees.reduce(
        (sum, fee) => sum + (parseFloat(fee.amount || 0)),
        0
    );

    const totalBalance = filteredFees.reduce(
        (sum, fee) => sum + (parseFloat(fee.balance || 0)),
        0
    );

    // Early exit while data is loading or if redirecting
    if (!pupil) {
        return null;
    }

    // =========================================================
    // RENDER LOGIC (mostly unchanged)
    // =========================================================

    const FeeRowMobile = ({ fee }) => (
        // ... (Your FeeRowMobile component logic is unchanged)
        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 space-y-2 mb-4">
            <div className="flex justify-between items-center border-b pb-2">
                <span className="text-lg font-bold text-indigo-700">{fee.feeType}</span>
                <span className="text-sm font-medium text-gray-500">{fee.class}</span>
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <div className="font-medium text-gray-700">Fees:</div>
                <div className="text-right font-semibold">
                    NLE {((fee.amount || 0) + (fee.balance || 0)).toFixed(2)}
                </div>

                <div className="font-medium text-gray-700">Amount Paid:</div>
                <div className="text-right font-semibold text-green-600">
                    NLE {(fee.amount || 0).toFixed(2)}
                </div>

                <div className="font-medium text-gray-700">Balance:</div>
                <div className="text-right font-semibold text-red-600">
                    NLE {(fee.balance || 0).toFixed(2)}
                </div>

                <div className="font-medium text-gray-700">Date:</div>
                <div className="text-right text-gray-600">{fee.paymentDate}</div>

                <div className="font-medium text-gray-700">Method:</div>
                <div className="text-right text-gray-600">{fee.paymentMethod}</div>

                <div className="col-span-2 text-xs text-gray-500 border-t pt-2 mt-2">
                    Receipt ID: <span className="font-mono ml-1">{fee.receiptId}</span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-['Inter']">
            <h1 className="text-3xl font-extrabold text-indigo-700 sm:text-4xl text-center mb-6">
                Pupil Fee Account
            </h1>
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Pupil Info Card */}
                <div className="bg-white shadow-xl rounded-2xl p-6 flex flex-col sm:flex-row items-center sm:items-start gap-6 border-t-4 border-indigo-500">
                    {/* ... (Pupil info display using the 'pupil' variable) ... */}
                    <img
                        src={pupil.userPhotoUrl}
                        alt={pupil.studentName}
                        className="w-28 h-28 rounded-full border-4 border-indigo-200 object-cover shadow-lg"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://placehold.co/100x100/5057A6/ffffff?text=${pupil.studentName.charAt(0)}`;
                        }}
                    />
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">{pupil.studentName}</h2>
                        <p className="text-gray-600">
                            ID: <span className="font-medium">{pupil.studentID}</span>
                        </p>
                        <p className="text-gray-600 text-lg font-semibold mt-1">
                            Class: {pupil.class} | Year: {pupil.academicYear}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                            Parent: {pupil.parentName} | Phone: {pupil.parentPhone}
                        </p>
                    </div>
                </div>

                {/* Academic Year Selection */}
                {fees.length > 0 && ( // Check against the real-time 'fees' state
                    <div className="bg-white p-4 rounded-xl shadow-md flex justify-between items-center">
                        <label className="text-lg font-semibold text-gray-700">Academic Year:</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="border border-gray-300 p-2 rounded-lg w-1/2 md:w-1/4 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        >
                            {uniqueYears.map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Fee History */}
                <div className="mt-6 bg-white shadow-xl rounded-2xl p-6 border border-gray-200">
                    <h3 className="text-xl font-bold mb-4 text-gray-700">Fee Line Items</h3>

                    {/* Mobile View */}
                    <div className="sm:hidden">
                        {filteredFees.length > 0 ? (
                            <>
                                {filteredFees.map((fee, idx) => <FeeRowMobile key={idx} fee={fee} />)}

                                {/* Mobile Footer showing only the first fee */}
                                <div className="bg-indigo-50 p-4 rounded-xl shadow-inner border border-indigo-200 mt-4 text-sm">
                                    <p className="font-semibold text-blue-700">
                                        Fee Charged: NLE {((filteredFees[0].amount || 0) + (filteredFees[0].balance || 0)).toFixed(2)}
                                    </p>
                                    <p className="font-semibold text-green-700">
                                        Amount Paid: NLE {(filteredFees[0].amount || 0).toFixed(2)}
                                    </p>
                                    <p className={`font-bold text-base ${filteredFees[0].balance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                        Balance Due: {filteredFees[0].balance > 0 ? `NLE ${filteredFees[0].balance.toFixed(2)}` : "CLEARED"}
                                    </p>
                                    <p className="text-gray-600 text-sm">

                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">

                                    </p>
                                </div>
                            </>
                        ) : (
                            <p className="p-4 text-center text-gray-500">
                                {fees.length > 0
                                    ? `No fee records found for ${selectedYear}.`
                                    : `No fee records found for ${pupil.studentName}.`}
                            </p>
                        )}
                    </div>


                    {/* Desktop Table */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full min-w-[700px] border-collapse">
                            <thead>
                                <tr className="bg-indigo-50 text-indigo-700 text-sm font-semibold border-b-2 border-indigo-200">
                                    <th className="p-3 border-r text-left">Class</th>
                                    <th className="p-3 border-r text-left">Fee Type</th>
                                    <th className="p-3 border-r text-right">Fees (NLE)</th>
                                    <th className="p-3 border-r text-right">Amount Paid (NLE)</th>
                                    <th className="p-3 border-r text-right">Balance (NLE)</th>
                                    <th className="p-3 border-r text-left">Payment Date</th>
                                    <th className="p-3 border-r text-left">Method</th>
                                    <th className="p-3 text-left">Receipt ID</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFees.length > 0 ? (
                                    filteredFees.map((fee, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 text-sm border-b">
                                            <td className="p-3 border-r">{fee.class}</td>
                                            <td className="p-3 border-r font-medium">{fee.feeType}</td>
                                            {/* Fees Charged */}
                                            <td className="p-3 border-r text-right">{((fee.amount || 0) + (fee.balance || 0)).toFixed(2)}</td>
                                            {/* Amount Paid */}
                                            <td className="p-3 border-r text-right text-green-600 font-semibold">{(fee.amount || 0).toFixed(2)}</td>
                                            {/* Balance */}
                                            <td className={`p-3 border-r text-right font-bold ${fee.balance > 0 ? 'text-red-600' : 'text-gray-500'}`}>{parseFloat(fee.balance || 0).toFixed(2)}</td>
                                            <td className="p-3 border-r text-gray-600">{fee.paymentDate}</td>
                                            <td className="p-3 border-r">{fee.paymentMethod}</td>
                                            <td className="p-3 text-gray-500 text-xs">{fee.receiptId}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td className="p-4 text-center text-gray-500" colSpan="8">
                                            {fees.length > 0
                                                ? `No fee records found for ${selectedYear}.`
                                                : `No fee records found for ${pupil.studentName}.`}
                                        </td>
                                    </tr>
                                )}
                            </tbody>

                            {/* === SUMMARY FOOTER (TFOOT) === */}
                            {filteredFees.length > 0 && (
                                <tfoot>
                                    <tr className="bg-indigo-100 font-extrabold text-sm border-t-2 border-indigo-500">
                                        <td className="p-3 border-r text-left" colSpan="2">
                                            FEE DETAILS FOR {selectedYear}:
                                        </td>
                                        <td className="p-3 border-r text-right text-blue-800">
                                            {((filteredFees[0].amount || 0) + (filteredFees[0].balance || 0)).toFixed(2)}
                                        </td>
                                        <td className="p-3 border-r text-right text-green-700">
                                            {(filteredFees[0].amount || 0).toFixed(2)}
                                        </td>
                                        <td
                                            className={`p-3 border-r text-right ${filteredFees[0].balance > 0 ? 'text-red-700' : 'text-green-700'
                                                }`}
                                        >
                                            {(filteredFees[0].balance || 0).toFixed(2)}
                                        </td>
                                        <td className="p-3 border-r"></td>
                                        <td className="p-3 border-r"></td>
                                        <td className="p-3 text-gray-500 text-xs"></td>
                                    </tr>
                                </tfoot>
                            )}

                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PupilPage;