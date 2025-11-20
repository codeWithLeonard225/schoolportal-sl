import React, { useState, useEffect, useMemo } from "react";
import CameraCapture from "../CaptureCamera/CameraCapture";
import CloudinaryImageUploader from "../CaptureCamera/CloudinaryImageUploader";
import { toast } from "react-toastify";
import { db } from "../../../firebase";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    onSnapshot,
    where,
    limit,
    orderBy,
    getDocs,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

// Cloudinary config (Kept from your template)
const CLOUD_NAME = "doucdnzij";
const UPLOAD_PRESET = "Nardone";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const FEE_TYPES = ["Admission Fee", "Tuition Fee", "Exam Fee", "Other"];
const ADMIN_PASSWORD = "1234"; // Define your admin password

// Helper function to generate a new unique receipt ID
const generateUniqueReceiptId = () => uuidv4().slice(0, 10).toUpperCase();

// Helper to get the academic year based on date
const getCurrentAcademicYear = () => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0 = Jan, 8 = Sep, 11 = Dec
    
    if (currentMonth >= 8) {
        const startYear = now.getFullYear();
        const endYear = startYear + 1;
        return `${startYear}-${endYear}`;
    } else {
        const endYear = now.getFullYear();
        const startYear = endYear - 1;
        return `${startYear}-${endYear}`;
    }
};

const FeesReceipt = () => {
    // --- State Management ---
    const [searchTerm, setSearchTerm] = useState("");
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [editingReceiptId, setEditingReceiptId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [showCamera, setShowCamera] = useState(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [recentReceipts, setRecentReceipts] = useState([]);
    
    // RE-ADDED STATE: To store fee structures
    const [feesCost, setFeesCost] = useState([]); 
    
    // NEW STATE: To hold the total amount paid by the selected student
    const [totalPaid, setTotalPaid] = useState(0); 

    const defaultAcademicYear = getCurrentAcademicYear();

    const initialReceiptState = useMemo(() => ({
        receiptId: generateUniqueReceiptId(),
        studentDocId: "",
        studentID: "",
        studentName: "",
        class: "",
        academicYear: defaultAcademicYear, 
        feeType: FEE_TYPES[0],
        amount: "",
        suggestedAmount: "",
        paymentMethod: "Cash",
        paymentDate: new Date().toISOString().slice(0, 10),
        receiptPhotoUrl: null,
        receiptPublicId: null,
        recordedBy: "Current User ID",
    }), [defaultAcademicYear]);

    const [receiptData, setReceiptData] = useState(initialReceiptState);

    // Derived State: Find the latest academic year from feesCost
    const latestAcademicYear = useMemo(() => {
        if (feesCost.length === 0) return defaultAcademicYear;
        const allYears = feesCost.map(fee => fee.academicYear);
        return [...new Set(allYears)].sort().reverse()[0] || defaultAcademicYear; 
    }, [feesCost, defaultAcademicYear]);

    // Effect to update receiptData with the latest academic year when feesCost loads (if not editing)
    useEffect(() => {
        if (!editingReceiptId && receiptData.academicYear !== latestAcademicYear) {
            setReceiptData(prev => ({
                ...prev,
                academicYear: latestAcademicYear,
            }));
        }
    }, [latestAcademicYear, editingReceiptId]);


    // --- Data Listeners ---

    // 1. REAL-TIME FEES COST LISTENER
    useEffect(() => {
        const feesCollectionRef = collection(db, "FeesCost");
        const q = query(feesCollectionRef);

        const unsubscribeFees = onSnapshot(q, (snapshot) => {
            const feeList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setFeesCost(feeList);
        }, (error) => {
            console.error("Error fetching fees cost:", error);
            toast.error("Failed to load fee structures.");
        });

        return () => unsubscribeFees();
    }, []);

    // 2. REAL-TIME STUDENT LISTENER
    useEffect(() => {
        if (!searchTerm.trim()) {
            setStudents([]);
            return;
        }
        
        const votersCollectionRef = collection(db, "Voters");
        const q = query(
            votersCollectionRef,
            where("studentName", ">=", searchTerm),
            where("studentName", "<=", searchTerm + "\uf8ff"),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const studentList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setStudents(studentList);
        }, (error) => {
            console.error("Error fetching students:", error);
        });

        return () => unsubscribe();
    }, [searchTerm]);

    // 3. REAL-TIME RECEIPTS LISTENER (for the table)
    useEffect(() => {
        const receiptsCollectionRef = collection(db, "Receipts");
        const q = query(
            receiptsCollectionRef,
            orderBy("createdAt", "desc"),
            limit(15)
        );

        const unsubscribeReceipts = onSnapshot(q, (snapshot) => {
            const receiptsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate().toLocaleTimeString('en-US') || 'N/A',
                paymentDate: doc.data().paymentDate,
            }));
            setRecentReceipts(receiptsList);
        }, (error) => {
            console.error("Error fetching recent receipts:", error);
            toast.error("Failed to load recent receipts.");
        });

        return () => unsubscribeReceipts();
    }, []);

    // 4. NEW: REAL-TIME TOTAL PAID LISTENER FOR SELECTED STUDENT
    useEffect(() => {
        if (!selectedStudent || !receiptData.academicYear) {
            setTotalPaid(0);
            return;
        }

        const receiptsCollectionRef = collection(db, "Receipts");
        // Query receipts for the selected student and the active academic year
        const q = query(
            receiptsCollectionRef,
            where("studentDocId", "==", selectedStudent.id),
            where("academicYear", "==", receiptData.academicYear)
        );

        const unsubscribeTotal = onSnapshot(q, (snapshot) => {
            let sum = 0;
            snapshot.forEach(doc => {
                // Ensure 'amount' is treated as a number
                sum += parseFloat(doc.data().amount) || 0; 
            });
            setTotalPaid(sum);
        }, (error) => {
            console.error("Error calculating total paid:", error);
            toast.error("Failed to calculate total paid amount.");
            setTotalPaid(0);
        });

        return () => unsubscribeTotal();
    }, [selectedStudent, receiptData.academicYear]); // Recalculates when student or academic year changes

    // --- Handlers ---

    const handleReceiptChange = (e) => {
        const { name, value } = e.target;
        setReceiptData(prev => ({ ...prev, [name]: value }));
    };

 
 
const handleStudentSelect = async (student) => {
    setSelectedStudent(student);
    setSearchTerm(student.studentName);
    setStudents([]);

    try {
        // =========================
        // PART 1: Console logging for previous academic year
        // =========================

        // 1️⃣ Determine previous academic year
        const allYears = [...new Set(feesCost.map(fee => fee.academicYear))].sort(); // ascending
        const latestIndex = allYears.indexOf(latestAcademicYear);
        const previousAcademicYear = latestIndex > 0 ? allYears[latestIndex - 1] : latestAcademicYear;

        // 2️⃣ Fetch all receipts for this student
        const receiptsCollectionRef = collection(db, "Receipts");
        const q = query(receiptsCollectionRef, where("studentID", "==", student.studentID));
        const snapshot = await getDocs(q);

        // 3️⃣ Process receipts to find previous year's total paid and class
        let totalPaidPrevious = 0;
        let previousClass = null;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.academicYear === previousAcademicYear) {
                totalPaidPrevious += parseFloat(data.amount) || 0;
                if (!previousClass) {
                    previousClass = data.class;
                }
            }
        });

        // 4️⃣ Get total fee for previous year's class
        const classToLookup = previousClass || student.class;
        const classFeeRecord = feesCost.find(
            fee => fee.className === classToLookup && fee.academicYear === previousAcademicYear
        );
        const totalFeePrevious = classFeeRecord ? parseFloat(classFeeRecord.totalAmount) : 0;

        if (!classFeeRecord && classToLookup) {
            toast.warn(`No default fee found for Class: ${classToLookup} in Academic Year: ${previousAcademicYear}.`);
        }

        const balancePrevious = totalFeePrevious - totalPaidPrevious;

        // ✅ Console logging (unchanged)
        console.log(`\n====================================================================`);
        console.log(`PREVIOUS YEAR FEE STATUS FOR ${student.studentName} (${student.studentID})`);
        console.log(`Academic Year: ${previousAcademicYear}`);
        console.log(`Class in that year: ${classToLookup}`);
        console.log(`Total Fee (Expected): GHS ${totalFeePrevious.toFixed(2)}`);
        console.log(`Total Paid: GHS ${totalPaidPrevious.toFixed(2)}`);
        console.log(`Balance: GHS ${balancePrevious.toFixed(2)}`);
        console.log(`====================================================================\n`);

        // =========================
        // PART 2: Grouping and updating UI for latest academic year
        // =========================

        // 1️⃣ Get total fee for student's class & latest academic year
        const latestClassFee = feesCost.find(
            fee => fee.className === student.class && fee.academicYear === latestAcademicYear
        );
        const totalFeeLatest = latestClassFee ? parseFloat(latestClassFee.totalAmount) : 0;

        if (!latestClassFee && student.class) {
            toast.warn(`No default fee found for Class: ${student.class} in Academic Year: ${latestAcademicYear}.`);
        }

        // 2️⃣ Group receipts by studentID, studentName, class, academicYear
        const grouped = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const key = `${data.studentID}-${data.studentName}-${data.class}-${data.academicYear}`;

            if (!grouped[key]) {
                grouped[key] = {
                    studentID: data.studentID,
                    studentName: data.studentName,
                    class: data.class,
                    academicYear: data.academicYear,
                    totalPaid: 0,
                    totalFee: 0,
                    balance: 0
                };
            }

            grouped[key].totalPaid += parseFloat(data.amount) || 0;

            // Only set totalFee and balance for latest academic year
            if (data.academicYear === latestAcademicYear) {
                grouped[key].totalFee = totalFeeLatest;
                grouped[key].balance = totalFeeLatest - grouped[key].totalPaid;
            }
        });

        // If no receipts yet, include current student
        const currentKey = `${student.studentID}-${student.studentName}-${student.class}-${latestAcademicYear}`;
        if (!grouped[currentKey]) {
            grouped[currentKey] = {
                studentID: student.studentID,
                studentName: student.studentName,
                class: student.class || 'N/A',
                academicYear: latestAcademicYear,
                totalPaid: 0,
                totalFee: totalFeeLatest,
                balance: totalFeeLatest
            };
        }

        const groupedArray = Object.values(grouped);
        console.log("Grouped Receipts with Balance (Latest Academic Year):", groupedArray);

        // 3️⃣ Update receiptData state for the form
        setReceiptData(prev => ({
            ...prev,
            studentDocId: student.id,
            studentID: student.studentID,
            studentName: student.studentName,
            class: student.class || 'N/A',
            amount: "", // user input
            suggestedAmount: totalFeeLatest,
            academicYear: latestAcademicYear,
            balance: totalFeeLatest // display in form
        }));

    } catch (err) {
        console.error("Failed to compute balance:", err);
        toast.error("Failed to calculate student balance.");
    }
};



    


    const handleUploadSuccess = (url, publicId) => {
        setReceiptData(prev => ({
            ...prev,
            receiptPhotoUrl: url,
            receiptPublicId: publicId,
        }));
        toast.success("Receipt image uploaded successfully!");
    };
    
    const handleUpdateReceipt = (receipt) => {
        setSelectedStudent({
            id: receipt.studentDocId,
            studentID: receipt.studentID,
            studentName: receipt.studentName,
            class: receipt.class,
        });
        setSearchTerm(receipt.studentName);

        setEditingReceiptId(receipt.id);
        
        // Populate form with receipt data
        setReceiptData({
            receiptId: receipt.receiptId,
            studentDocId: receipt.studentDocId,
            studentID: receipt.studentID,
            studentName: receipt.studentName,
            class: receipt.class,
            academicYear: receipt.academicYear || latestAcademicYear, 
            feeType: receipt.feeType,
            amount: receipt.amount.toString(),
            suggestedAmount: "",
            paymentMethod: receipt.paymentMethod,
            paymentDate: receipt.paymentDate,
            receiptPhotoUrl: receipt.receiptPhotoUrl,
            receiptPublicId: receipt.receiptPublicId,
            recordedBy: receipt.recordedBy,
        });

        toast.info(`Editing receipt: ${receipt.receiptId}`);
    };

    const handleDeleteReceipt = async (id, receiptId, studentName) => {
        const password = window.prompt("Enter the password to delete this receipt:");
        if (password === ADMIN_PASSWORD) {
            if (window.confirm(`Are you sure you want to delete receipt ${receiptId} for ${studentName}?`)) {
                try {
                    await deleteDoc(doc(db, "Receipts", id));
                    toast.success(`Receipt ${receiptId} deleted successfully!`);
                } catch (err) {
                    console.error("Failed to delete receipt:", err);
                    toast.error("Failed to delete receipt.");
                }
            }
        } else if (password !== null) {
            toast.error("Incorrect password.");
        }
    };
    
    const resetForm = () => {
        setReceiptData(initialReceiptState);
        setSelectedStudent(null);
        setSearchTerm("");
        setEditingReceiptId(null);
        setShowSuccessMessage(false);
        setTotalPaid(0); // Reset total paid amount
    };

    const handleCameraCapture = async (base64Data) => { 
        setIsUploading(true);
        setUploadProgress(0);
        try {
            const res = await fetch(base64Data);
            const blob = await res.blob();
            if (blob.size > MAX_FILE_SIZE) {
                toast.error("Image is too large. Max size is 5MB.");
                setIsUploading(false);
                return;
            }

            const xhr = new XMLHttpRequest();
            xhr.upload.addEventListener("progress", (e) => {
                if (e.lengthComputable) {
                    setUploadProgress(Math.round((e.loaded * 100) / e.total));
                }
            });

            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    setIsUploading(false);
                    setShowCamera(false);
                    if (xhr.status === 200) {
                        const data = JSON.parse(xhr.responseText);
                        handleUploadSuccess(data.secure_url, data.public_id);
                    } else {
                        toast.error("Camera upload failed. Please try again.");
                    }
                }
            };

            const formDataObj = new FormData();
            formDataObj.append("file", blob);
            formDataObj.append("upload_preset", UPLOAD_PRESET);
            formDataObj.append("folder", "Receipt_Photos");

            xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);
            xhr.send(formDataObj);
        } catch (err) {
            console.error("Camera upload failed:", err);
            toast.error("Failed to upload image from camera.");
            setIsUploading(false);
            setShowCamera(false);
        }
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        setShowSuccessMessage(false);

        if (!selectedStudent) return toast.error("Please select a student first.");
        if (parseFloat(receiptData.amount) <= 0 || isNaN(parseFloat(receiptData.amount))) {
            return toast.error("Please enter a valid amount greater than zero.");
        }
        
        setIsSubmitting(true);

        try {
            const { suggestedAmount, ...finalReceiptData } = {
                ...receiptData,
                amount: parseFloat(receiptData.amount),
                academicYear: receiptData.academicYear || defaultAcademicYear, 
            };
            
            if (editingReceiptId) {
                const receiptRef = doc(db, "Receipts", editingReceiptId);
                await updateDoc(receiptRef, finalReceiptData);
                toast.success(`Receipt ${finalReceiptData.receiptId} updated successfully!`);
            } else {
                await addDoc(collection(db, "Receipts"), {
                    ...finalReceiptData,
                    createdAt: new Date(),
                });
                toast.success(`Receipt ${finalReceiptData.receiptId} recorded successfully!`);
                setShowSuccessMessage(true);
            }
            
            setTimeout(() => {
                resetForm();
            }, 3000);

        } catch (err) {
            console.error("Receipt saving failed:", err);
            toast.error(`Failed to ${editingReceiptId ? 'update' : 'record'} fee receipt.`);
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6 space-y-6">
            
            {showSuccessMessage && (
                <div className="bg-green-500 text-white p-6 rounded-xl shadow-2xl text-center mb-6 max-w-sm w-full">
                    <h3 className="text-xl font-bold">Transaction Successful! 🎉</h3>
                    <p className="mt-2">Receipt Saved: {receiptData.receiptId}</p>
                    
                </div>
            )}

            {/* --- 1. FEE RECEIPT FORM (ADD/EDIT) --- */}
            <form onSubmit={handleSubmit} className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-2xl">
                <h2 className="text-2xl font-bold text-center mb-6 text-indigo-700">
                    {editingReceiptId ? "Update Fee Receipt" : "New Fee Payment Receipt"} 💰
                </h2>

                {/* Receipt ID, Academic Year, and Class (Read-Only) */}
                <div className="flex justify-between flex-wrap mb-4 text-sm text-gray-600 border-b pb-2">
                    <p><strong>Receipt ID:</strong> <span className="font-bold text-indigo-500">{receiptData.receiptId}</span></p>
                    {/* Display Academic Year */}
                    <p><strong>Academic Year:</strong> <span className="font-bold text-purple-700">
                        {receiptData.academicYear}
                    </span></p>
                    <p><strong>Class:</strong> <span className="font-bold text-gray-800">{receiptData.class || 'N/A'}</span></p>
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
                            <p className="font-semibold text-green-800">Selected Student: {selectedStudent.studentName} (ID: {selectedStudent.studentID})</p>
                        </div>
                    ) : (
                        <ul className="max-h-48 overflow-y-auto border-t border-gray-300 mt-2">
                            {students.map(student => (
                                <li 
                                    key={student.id} 
                                    onClick={() => handleStudentSelect(student)}
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

                {/* Academic Year Input and Payment Details Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Academic Year Select Input */}
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
                            {FEE_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    {/* --- AMOUNT INPUT WITH SUGGESTED FEE & TOTAL PAID DISPLAY --- */}
                    <div className="md:col-span-2">
                        <div className="flex justify-between items-end mb-2">
                             <label className="block font-medium text-sm">Amount Paid (GHS)</label>

                            {/* Display Suggested Fee (if available and not editing) */}
                            {receiptData.suggestedAmount && !editingReceiptId && (
                                <span className="text-sm text-blue-600 font-semibold bg-blue-100 px-2 py-1 rounded">
                                    Class Fee: GHS {parseFloat(receiptData.suggestedAmount).toFixed(2)}
                                </span>
                            )}
                        </div>

                        <input
                            type="number"
                            name="amount"
                            value={receiptData.amount}
                            onChange={handleReceiptChange}
                            placeholder="e.g. 500.00" 
                            step="0.01"
                            min="0.01"
                            className="w-full p-3 border rounded-lg font-bold text-xl text-red-600"
                            required
                        />
                        
                        {/* NEW: Display Total Paid So Far (if student is selected) */}
                        {selectedStudent && (
                            <p className="mt-2 text-sm font-bold text-green-700">
                                Total Paid So Far ({receiptData.academicYear}): 
                                <span className="ml-2 bg-green-100 px-2 py-0.5 rounded">
                                    GHS {totalPaid.toFixed(2)} 
                                </span>
                            </p>
                        )}

                    </div>
                    {/* --- END AMOUNT INPUT --- */}

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

                {/* Receipt Photo Upload */}
                <div className="flex flex-col items-center mb-4 border-t pt-4 mt-4">
                    <label className="mb-2 font-medium text-sm">Receipt Photo (Optional)</label>
                    <div className="border-4 border-dashed w-36 h-28 flex items-center justify-center bg-white/30 mb-2">
                        {receiptData.receiptPhotoUrl ?
                            <img src={receiptData.receiptPhotoUrl} alt="Receipt Proof" className="w-full h-full object-cover" />
                            :
                            "Upload Proof"
                        }
                    </div>
                    
                    <div className="flex space-x-2 w-full max-w-xs justify-center">
                        <CloudinaryImageUploader
                            onUploadSuccess={handleUploadSuccess}
                            onUploadStart={() => { setIsUploading(true); setUploadProgress(0); }}
                            onUploadProgress={setUploadProgress}
                            onUploadComplete={() => setIsUploading(false)}
                            folder="Receipt_Photos"
                        />
                        <button type="button" onClick={() => setShowCamera(true)} className="flex-1 bg-green-600 text-white py-2 px-3 rounded-md text-sm font-semibold hover:bg-green-700" disabled={isUploading}>
                            Use Camera
                        </button>
                    </div>
                    
                    {isUploading && (
                        <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mt-2">
                            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                    )}
                </div>

                <div className="flex space-x-4 mt-6">
                    <button
                        type="submit"
                        disabled={isSubmitting || isUploading || !selectedStudent}
                        className={`flex-1 text-white p-3 rounded-lg transition disabled:bg-gray-400 font-semibold ${editingReceiptId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isSubmitting
                            ? (isUploading ? "Uploading & Saving..." : "Saving...")
                            : editingReceiptId ? "Update Receipt" : "Generate & Save Receipt"}
                    </button>
                    
                    {editingReceiptId && (
                        <button 
                            type="button"
                            onClick={resetForm}
                            className="w-1/3 bg-gray-500 text-white p-3 rounded-lg hover:bg-gray-600 transition disabled:bg-gray-400 font-semibold"
                        >
                            Cancel Edit
                        </button>
                    )}
                </div>
            </form>

            {showCamera && <CameraCapture setPhoto={handleCameraCapture} onClose={() => setShowCamera(false)} initialFacingMode="environment" />}

            {/* -------------------------------------------------------------------------------------------------------------------------------- */}
            {/* --- 2. RECENT RECEIPTS TABLE (with Actions) --- */}
            {/* -------------------------------------------------------------------------------------------------------------------------------- */}
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-6xl">
                <h2 className="text-xl font-bold text-center mb-4 text-gray-700">Recent Fee Receipts (Last 15)</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Acad. Year</th> 
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (GHS)</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Type</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Date</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Method</th>
                                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {recentReceipts.map((receipt) => (
                                <tr key={receipt.id} className={editingReceiptId === receipt.id ? 'bg-yellow-100' : ''}>
                                    <td className="px-3 py-4 whitespace-nowrap text-xs font-medium text-gray-900">{receipt.receiptId}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{receipt.studentName}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-xs text-purple-700 font-medium hidden sm:table-cell">{receipt.academicYear || 'N/A'}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm font-bold text-green-600">GHS {receipt.amount?.toFixed(2) || '0.00'}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">{receipt.feeType}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-xs text-gray-500 hidden md:table-cell">{receipt.paymentDate}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">{receipt.paymentMethod}</td>
                                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                                        <button 
                                            onClick={() => handleUpdateReceipt(receipt)} 
                                            className="text-orange-600 hover:text-orange-800 mr-3 text-sm"
                                            disabled={isSubmitting}
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteReceipt(receipt.id, receipt.receiptId, receipt.studentName)} 
                                            className="text-red-600 hover:text-red-800 text-sm"
                                            disabled={isSubmitting}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {recentReceipts.length === 0 && (
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
        </div>
    );
};

export default FeesReceipt;