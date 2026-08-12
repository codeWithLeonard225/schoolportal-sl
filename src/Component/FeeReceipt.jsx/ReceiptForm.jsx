import React from "react";
import CloudinaryImageUploader from "../CaptureCamera/CloudinaryImageUploader";

const ReceiptForm = ({
    onSubmit,
    editingReceiptId,
    receiptData,
    selectedStudent,
    schoolId,
    searchTerm,
    setSearchTerm,
    students,
    onStudentSelect,
    feesCost,
    latestAcademicYear,
    feeTypes,
    handleReceiptChange,
    remainingBalance,
    projectedBalance,
    handleUploadSuccess,
    setIsUploading,
    setUploadProgress,
    isUploading,
    uploadProgress,
    setShowCamera,
    isSubmitting,
    onCancelEdit
}) => {
    return (
        <form onSubmit={onSubmit} className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-2xl">
            <h2 className="text-2xl font-bold text-center mb-6 text-indigo-700">
                {editingReceiptId ? "Update Fee Receipt" : "New Fee Payment Receipt"} 💰
            </h2>
            
            {selectedStudent && (
                <p className="mt-2 text-sm font-bold text-gray-700">
                    Fees Category:
                    <span className="ml-2 text-indigo-600">{receiptData.feesCategory}</span>
                </p>
            )}

            <div className="flex justify-between flex-wrap mb-4 text-sm text-gray-600 border-b pb-2">
                <p><strong>Receipt ID:</strong> <span className="font-bold text-indigo-500">{receiptData.receiptId}</span></p>
                <p><strong>Academic Year:</strong> <span className="font-bold text-purple-700">{receiptData.academicYear}</span></p>
                <p><strong>Class:</strong> <span className="font-bold text-gray-800">{receiptData.class || 'N/A'}</span></p>
            </div>

            <div className="mb-4">
                <label className="block mb-2 font-medium text-sm text-gray-700">School ID</label>
                <input
                    type="text"
                    value={schoolId}
                    readOnly
                    className="w-full p-2 border rounded-lg bg-gray-100 text-gray-600"
                />
            </div>

            {/* Student Search Section */}
            <div className="mb-6 border p-4 rounded-lg bg-blue-50">
                <label className="block mb-2 font-medium text-sm text-blue-700">Student Name / ID Search</label>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Start typing student name or ID..."
                    className="w-full p-2 mb-2 border rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    disabled={!!editingReceiptId}
                />

                {selectedStudent ? (
                    <div className="p-3 mt-2 bg-green-100 border border-green-300 rounded-lg">
                        <p className="font-semibold text-green-800">
                            Selected Student: {selectedStudent.studentName} (ID: {selectedStudent.studentID})
                        </p>
                    </div>
                ) : (
                    <ul className="max-h-48 overflow-y-auto border-t border-gray-300 mt-2">
                        {students.map(student => (
                            <li
                                key={student.id}
                                onClick={() => onStudentSelect(student)}
                                className="p-2 cursor-pointer hover:bg-blue-100 border-b text-sm"
                            >
                                {student.studentName} (Class: {student.class || 'N/A'})
                            </li>
                        ))}
                        {searchTerm.length > 0 && students.length === 0 && (
                            <li className="p-2 text-gray-500 text-sm">No students found.</li>
                        )}
                    </ul>
                )}
            </div>

            {/* Academic Year and Fee Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block mb-2 font-medium text-sm">Academic Year</label>
                    <select
                        name="academicYear"
                        value={receiptData.academicYear}
                        onChange={handleReceiptChange}
                        className="w-full p-2 border rounded-lg bg-purple-50"
                        required
                    >
                        {[...new Set([...feesCost.map(fee => fee.academicYear), latestAcademicYear])].sort().reverse().map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block mb-2 font-medium text-sm">Fee Type</label>
                    <select
                        name="feeType"
                        value={receiptData.feeType}
                        onChange={handleReceiptChange}
                        className="w-full p-2 border rounded-lg"
                        required
                    >
                        {feeTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Amount Section */}
            <div className="mt-4">
                <div className="flex justify-between items-end mb-2">
                    <label className="block font-medium text-sm">Amount Paid (NLE)</label>
                    {receiptData.classTotal && !editingReceiptId && (
                        <span className="text-sm text-blue-600 font-semibold bg-blue-100 px-2 py-1 rounded">
                            Total Class Fee ({receiptData.feesCategory}): NLE {receiptData.classTotal.toFixed(2)}
                        </span>
                    )}
                </div>

                <input
                    type="number"
                    name="amount"
                    value={receiptData.amount}
                    onChange={handleReceiptChange}
                    placeholder={selectedStudent && remainingBalance <= 0 ? "Fully Paid" : "e.g. 500.00"}
                    step="0.01"
                    min="0.01"
                    max={remainingBalance}
                    disabled={!selectedStudent || remainingBalance <= 0}
                    className={`w-full p-3 border rounded-lg font-bold text-xl ${
                        !selectedStudent || remainingBalance <= 0 ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "text-red-600"
                    }`}
                    required
                />

                {selectedStudent && (
                    <>
                        <p className="mt-2 text-sm font-bold text-green-700">
                            Total Paid So Far ({receiptData.academicYear}):
                            <span className="ml-2 bg-green-100 px-2 py-0.5 rounded">
                                NLE {receiptData.totalPaid?.toFixed(2) || "0.00"}
                            </span>
                        </p>
                        <p className={`mt-1 text-sm font-bold ${remainingBalance <= 0 ? "text-green-600" : "text-red-600"}`}>
                            Remaining Balance:
                            <span className="ml-2 bg-red-100 px-2 py-0.5 rounded">
                                NLE {projectedBalance.toFixed(2)}
                            </span>
                        </p>
                    </>
                )}
            </div>

            {/* Date and Method */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                    <label className="block mb-2 font-medium text-sm">Payment Date</label>
                    <input
                        type="date"
                        name="paymentDate"
                        value={receiptData.paymentDate}
                        onChange={handleReceiptChange}
                        className="w-full p-2 border rounded-lg"
                        required
                    />
                </div>

                <div>
                    <label className="block mb-2 font-medium text-sm">Payment Method</label>
                    <select
                        name="paymentMethod"
                        value={receiptData.paymentMethod}
                        onChange={handleReceiptChange}
                        className="w-full p-2 border rounded-lg"
                        required
                    >
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Mobile Money">Mobile Money</option>
                        <option value="Cheque">Cheque</option>
                    </select>
                </div>
            </div>

            {/* Upload Area */}
            <div className="flex flex-col items-center mb-4 border-t pt-4 mt-4">
                <label className="mb-2 font-medium text-sm">Receipt Photo (Optional)</label>
                <div className="border-4 border-dashed w-36 h-28 flex items-center justify-center bg-white/30 mb-2">
                    {receiptData.receiptPhotoUrl ? (
                        <img src={receiptData.receiptPhotoUrl} alt="Receipt Proof" className="w-full h-full object-cover" />
                    ) : (
                        "Upload Proof"
                    )}
                </div>

                <div className="flex space-x-2 w-full max-w-xs justify-center">
                    <CloudinaryImageUploader
                        onUploadSuccess={handleUploadSuccess}
                        onUploadStart={() => { setIsUploading(true); setUploadProgress(0); }}
                        onUploadProgress={setUploadProgress}
                        onUploadComplete={() => setIsUploading(false)}
                        folder="Receipt_Photos"
                    />
                    <button 
                        type="button" 
                        onClick={() => setShowCamera(true)} 
                        className="flex-1 bg-green-600 text-white py-2 px-3 rounded-md text-sm font-semibold hover:bg-green-700" 
                        disabled={isUploading}
                    >
                        Use Camera
                    </button>
                </div>

                {isUploading && (
                    <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mt-2">
                        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4 mt-6">
                <button
                    type="submit"
                    disabled={isSubmitting || isUploading || !selectedStudent}
                    className={`flex-1 text-white p-3 rounded-lg transition disabled:bg-gray-400 font-semibold ${
                        editingReceiptId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                >
                    {isSubmitting
                        ? (isUploading ? "Uploading & Saving..." : "Saving...")
                        : editingReceiptId ? "Update Receipt" : "Generate & Save Receipt"}
                </button>

                {editingReceiptId && (
                    <button
                        type="button"
                        onClick={onCancelEdit}
                        className="w-1/3 bg-gray-500 text-white p-3 rounded-lg hover:bg-gray-600 transition font-semibold"
                    >
                        Cancel Edit
                    </button>
                )}
            </div>
        </form>
    );
};

export default ReceiptForm;