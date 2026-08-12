import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
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
    getDocs,
} from "firebase/firestore";

import { db } from "../../../firebase";
import { pupilLoginFetch } from "../Database/PupilLogin";
import CameraCapture from "../CaptureCamera/CameraCapture";

// Subcomponents
import PreviousFeesModal from "./PreviousFeesModal";
import ReceiptForm from "./ReceiptForm";
import ReceiptsTable from "./ReceiptsTable";

const CLOUD_NAME = "dxcrlpike";
const UPLOAD_PRESET = "LeoTechSl Projects";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const FEE_TYPES = ["Term 1", "Term 2", "Term 3"];
const ADMIN_PASSWORD = "1234";

const generateUniqueReceiptId = () => uuidv4().slice(0, 10).toUpperCase();

const getCurrentAcademicYear = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    if (currentMonth >= 8) {
        return `${now.getFullYear()}-${now.getFullYear() + 1}`;
    } else {
        return `${now.getFullYear() - 1}-${now.getFullYear()}`;
    }
};

const FeesReceipt = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    // Form states
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

    // Modal and structural metadata states
    const [showPreviousFeesModal, setShowPreviousFeesModal] = useState(false);
    const [previousFeesData, setPreviousFeesData] = useState(null);
    const [feesCost, setFeesCost] = useState([]);
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
        schoolId: schoolId,
    }), [defaultAcademicYear, schoolId]);

    const [receiptData, setReceiptData] = useState(initialReceiptState);

    const latestAcademicYear = useMemo(() => {
        if (feesCost.length === 0) return defaultAcademicYear;
        const allYears = feesCost.map(fee => fee.academicYear);
        return [...new Set(allYears)].sort().reverse()[0] || defaultAcademicYear;
    }, [feesCost, defaultAcademicYear]);

    useEffect(() => {
        if (!editingReceiptId && receiptData.academicYear !== latestAcademicYear) {
            setReceiptData(prev => ({ ...prev, academicYear: latestAcademicYear }));
        }
    }, [latestAcademicYear, editingReceiptId]);

    // Firestore Listeners
    useEffect(() => {
        if (!schoolId || schoolId === "N/A") return;
        const q = query(collection(db, "FeesCost"), where("schoolId", "==", schoolId));
        return onSnapshot(q, (snapshot) => {
            setFeesCost(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }, () => toast.error("Failed to load fee structures."));
    }, [schoolId]);

    useEffect(() => {
        if (!searchTerm.trim()) { setStudents([]); return; }
        const q = query(collection(pupilLoginFetch, "PupilsReg"), where("schoolId", "==", schoolId));
        return onSnapshot(q, (snapshot) => {
            const filtered = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(s => s.studentName.toLowerCase().includes(searchTerm.toLowerCase()))
                .slice(0, 10);
            setStudents(filtered);
        });
    }, [searchTerm, schoolId]);

    useEffect(() => {
        const q = query(collection(db, "Receipts"), where("schoolId", "==", schoolId), limit(15));
        return onSnapshot(q, (snapshot) => {
            setRecentReceipts(snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
                createdAt: d.data().createdAt?.toDate().toLocaleTimeString('en-US') || 'N/A'
            })));
        }, () => toast.error("Failed to load recent receipts."));
    }, [schoolId]);

    useEffect(() => {
        if (!selectedStudent || !receiptData.academicYear) { setTotalPaid(0); return; }
        const q = query(
            collection(db, "Receipts"),
            where("studentDocId", "==", selectedStudent.id),
            where("academicYear", "==", receiptData.academicYear)
        );
        return onSnapshot(q, (snapshot) => {
            let sum = 0;
            snapshot.forEach(d => { sum += parseFloat(d.data().amount) || 0; });
            setTotalPaid(sum);
        }, () => setTotalPaid(0));
    }, [selectedStudent, receiptData.academicYear]);

    // Financial calculations
    const remainingBalance = useMemo(() => {
        return (receiptData.classTotal || 0) - (receiptData.totalPaid || 0);
    }, [receiptData.classTotal, receiptData.totalPaid]);

    const projectedBalance = useMemo(() => {
        return remainingBalance - (parseFloat(receiptData.amount) || 0);
    }, [remainingBalance, receiptData.amount]);

    // Actions & Event Handlers
    const handleReceiptChange = (e) => {
        const { name, value } = e.target;
        if (name === "amount" && (parseFloat(value) || 0) > remainingBalance) {
            toast.error("Payment exceeds remaining balance!");
            return;
        }
        setReceiptData(prev => ({ ...prev, [name]: value }));
    };

    const handleStudentSelect = async (student) => {
        setSelectedStudent(student);
        setSearchTerm(student.studentName);
        setStudents([]);

        try {
            const classFees = feesCost.find(f => f.className === student.class && f.academicYear === latestAcademicYear);
            if (!classFees) throw new Error("No fees found for this class");

            const q = query(
                collection(db, "Receipts"),
                where("studentID", "==", student.studentID),
                where("academicYear", "==", latestAcademicYear)
            );
            const snapshot = await getDocs(q);
            let totalPaidSoFar = 0;
            snapshot.forEach(d => { totalPaidSoFar += parseFloat(d.data().amount) || 0; });

            const feesCategory = student.feesCategory || "New";
            const classTotal = feesCategory === "New" ? parseFloat(classFees.new_total) || 0 : parseFloat(classFees.cont_total) || 0;

            setReceiptData(prev => ({
                ...prev,
                studentID: student.studentID,
                studentName: student.studentName,
                class: student.class,
                feesCategory,
                classTotal,
                totalPaid: totalPaidSoFar,
                amount: "",
                academicYear: latestAcademicYear,
            }));
        } catch (err) {
            toast.error("Failed to determine student fees.");
        }
    };

    const handleUploadSuccess = (url, publicId) => {
        setReceiptData(prev => ({ ...prev, receiptPhotoUrl: url, receiptPublicId: publicId }));
        toast.success("Receipt image uploaded successfully!");
    };

    const handleUpdateReceipt = (receipt) => {
        setSelectedStudent({ id: receipt.studentDocId, studentID: receipt.studentID, studentName: receipt.studentName, class: receipt.class });
        setSearchTerm(receipt.studentName);
        setEditingReceiptId(receipt.id);
        setReceiptData({ ...receipt, amount: receipt.amount.toString() });
        toast.info(`Editing receipt: ${receipt.receiptId}`);
    };

    const handleDeleteReceipt = async (id, receiptId, studentName) => {
        const password = window.prompt("Enter the password to delete this receipt:");
        if (password === ADMIN_PASSWORD) {
            if (window.confirm(`Are you sure you want to delete receipt ${receiptId}?`)) {
                try {
                    await deleteDoc(doc(db, "Receipts", id));
                    toast.success("Receipt deleted successfully!");
                } catch {
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
        setTotalPaid(0);
        setShowPreviousFeesModal(false);
    };

    useEffect(() => {
        if (searchTerm === "") resetForm();
    }, [searchTerm]);

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
                if (e.lengthComputable) setUploadProgress(Math.round((e.loaded * 100) / e.total));
            });

            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    setIsUploading(false);
                    setShowCamera(false);
                    if (xhr.status === 200) {
                        const data = JSON.parse(xhr.responseText);
                        handleUploadSuccess(data.secure_url, data.public_id);
                    } else {
                        toast.error("Camera upload failed.");
                    }
                }
            };

            const formDataObj = new FormData();
            formDataObj.append("file", blob);
            formDataObj.append("upload_preset", UPLOAD_PRESET);
            formDataObj.append("folder", `Receipt_Photos/${schoolId || "UnknownSchool"}`);

            xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);
            xhr.send(formDataObj);
        } catch {
            toast.error("Failed to upload image from camera.");
            setIsUploading(false);
            setShowCamera(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setShowSuccessMessage(false);
        if (!selectedStudent) return toast.error("Please select a student first.");
        const paidAmount = parseFloat(receiptData.amount);
        if (paidAmount <= 0 || isNaN(paidAmount)) return toast.error("Please enter a valid amount.");

        setIsSubmitting(true);
        try {
            const classFeeRecord = feesCost.find(f => f.className === receiptData.class && f.academicYear === receiptData.academicYear);
            const totalFee = classFeeRecord ? parseFloat(classFeeRecord.totalAmount) : 0;
            const balance = totalFee - paidAmount;

            const finalReceiptData = {
                ...receiptData,
                amount: paidAmount,
                totalFee,
                balance,
                schoolId
            };

            if (editingReceiptId) {
                await updateDoc(doc(db, "Receipts", editingReceiptId), finalReceiptData);
                toast.success("Receipt updated successfully!");
            } else {
                await addDoc(collection(db, "Receipts"), { ...finalReceiptData, createdAt: new Date() });
                toast.success("Receipt recorded successfully!");
                setShowSuccessMessage(true);
            }
            setTimeout(() => resetForm(), 3000);
        } catch {
            toast.error("Failed to save fee receipt.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6 space-y-6">
            {showPreviousFeesModal && (
                <PreviousFeesModal data={previousFeesData} onResetAndClose={resetForm} />
            )}

            {showSuccessMessage && (
                <div className="bg-green-500 text-white p-6 rounded-xl shadow-2xl text-center mb-6 max-w-sm w-full">
                    <h3 className="text-xl font-bold">Transaction Successful! 🎉</h3>
                    <p className="mt-2">Receipt Saved: {receiptData.receiptId}</p>
                </div>
            )}

            <ReceiptForm
                onSubmit={handleSubmit}
                editingReceiptId={editingReceiptId}
                receiptData={receiptData}
                selectedStudent={selectedStudent}
                schoolId={schoolId}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                students={students}
                onStudentSelect={handleStudentSelect}
                feesCost={feesCost}
                latestAcademicYear={latestAcademicYear}
                feeTypes={FEE_TYPES}
                handleReceiptChange={handleReceiptChange}
                remainingBalance={remainingBalance}
                projectedBalance={projectedBalance}
                handleUploadSuccess={handleUploadSuccess}
                setIsUploading={setIsUploading}
                setUploadProgress={setUploadProgress}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                setShowCamera={setShowCamera}
                isSubmitting={isSubmitting}
                onCancelEdit={resetForm}
            />

            {showCamera && (
                <CameraCapture setPhoto={handleCameraCapture} onClose={() => setShowCamera(false)} initialFacingMode="environment" />
            )}

            <ReceiptsTable
                receipts={recentReceipts}
                editingReceiptId={editingReceiptId}
                onEdit={handleUpdateReceipt}
                onDelete={handleDeleteReceipt}
                isSubmitting={isSubmitting}
            />
        </div>
    );
};

export default FeesReceipt;