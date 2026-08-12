import React from "react";

const ReceiptsTable = ({ receipts, editingReceiptId, onEdit, onDelete, isSubmitting }) => {
    return (
        <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-6xl">
            <h2 className="text-xl font-bold text-center mb-4 text-gray-700">Recent Fee Receipts (Last 15)</h2>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Acad. Year</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (NLE)</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Type</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Date</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Method</th>
                            <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {receipts.map((receipt) => (
                            <tr key={receipt.id} className={editingReceiptId === receipt.id ? 'bg-yellow-100' : ''}>
                                <td className="px-3 py-4 whitespace-nowrap text-xs font-medium text-gray-900">{receipt.receiptId}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{receipt.studentName}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-xs text-purple-700 font-medium hidden sm:table-cell">{receipt.academicYear || 'N/A'}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-green-600">NLE {receipt.amount?.toFixed(2) || '0.00'}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">{receipt.feeType}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-xs text-gray-500 hidden md:table-cell">{receipt.paymentDate}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">{receipt.paymentMethod}</td>
                                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                                    <button
                                        onClick={() => onEdit(receipt)}
                                        className="text-orange-600 hover:text-orange-800 mr-3 text-sm disabled:opacity-50"
                                        disabled={isSubmitting}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => onDelete(receipt.id, receipt.receiptId, receipt.studentName)}
                                        className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                                        disabled={isSubmitting}
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {receipts.length === 0 && (
                            <tr>
                                <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500">
                                    No recent receipts found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ReceiptsTable;