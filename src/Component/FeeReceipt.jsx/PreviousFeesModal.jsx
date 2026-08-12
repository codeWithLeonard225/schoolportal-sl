import React from "react";
import { useNavigate } from "react-router-dom";

const PreviousFeesModal = ({ data, onResetAndClose }) => {
    const navigate = useNavigate();
    if (!data) return null;

    const isBalanced = data.balance <= 0;
    const balanceColor = isBalanced ? 'text-green-600' : 'text-red-600';
    const balanceText = isBalanced ? 'Cleared' : `NLE ${data.balance.toFixed(2)} DUE`;
    const balanceClass = isBalanced ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300';

    const handleViewHistory = () => {
        navigate(`/student-history/${data.studentID}`);
        onResetAndClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg transform transition-all duration-300 scale-100">
                <h3 className="text-2xl font-bold text-center mb-4 text-indigo-700">
                    Previous Academic Year Status 🧾
                </h3>

                <div className="grid grid-cols-2 gap-4 text-lg font-medium text-gray-700 mb-6">
                    <div>
                        <p>Total Fee (Expected):</p>
                        <p className="font-bold text-blue-600">NLE {data.totalFee.toFixed(2)}</p>
                    </div>
                    <div>
                        <p>Total Paid:</p>
                        <p className="font-bold text-green-700">NLE {data.totalPaid.toFixed(2)}</p>
                    </div>
                </div>

                <div className={`p-4 text-center rounded-lg border-2 ${balanceClass}`}>
                    <p className="text-lg font-semibold">Outstanding Balance</p>
                    <p className={`text-4xl font-extrabold ${balanceColor} mt-1`}>{balanceText}</p>
                </div>

                <p className="mt-4 text-sm text-center text-gray-500">
                    This is the final status for the {data.academicYear} academic year.
                </p>

                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={handleViewHistory}
                        className="bg-indigo-500 text-white py-2 px-4 rounded-lg hover:bg-indigo-600 transition text-sm font-semibold disabled:opacity-50"
                        disabled={isBalanced}
                    >
                        View Full History 🔗
                    </button>
                    <button
                        onClick={onResetAndClose}
                        className="bg-gray-300 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-400 transition text-sm font-semibold"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PreviousFeesModal;