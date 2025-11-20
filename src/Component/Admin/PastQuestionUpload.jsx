import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { db } from "../../../firebase";
// ⭐️ IMPORT schoollpq for storing Past Questions (School Local Past Questions)
import { schoollpq } from "../Database/schoollibAndPastquestion";
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    where,
} from "firebase/firestore";

import CameraCapture from "../CaptureCamera/CameraCapture";
import CloudinaryImageUploader from "../CaptureCamera/CloudinaryImageUploader";


// 🎯 The new collection name in schoollpq database
const COLLECTION_NAME = "SchoolPastQuestions";

// ⭐️ Use the school test types provided
const TESTS = ["Term 1 T1", "Term 1 T2", "Term 2 T1", "Term 2 T2", "Term 3 T1", "Term 3 T2"];

// ... (Rest of the helper functions: validateField, ErrorMessage, CLOUD_NAME, UPLOAD_PRESET, base64ToFile, uploadToCloudinary)
const validateField = (name, value) => {
    switch (name) {
        case "schoolName":
            if (!value) return "School context is missing.";
            break;
        case "className":
            if (!value) return "Class selection is required.";
            break;
        case "subject":
            if (!value) return "Subject selection is required.";
            break;
        case "testType":
            if (!value) return "Test/Term selection is required.";
            break;
        case "academicYear":
            if (!value) return "Academic Year selection is required.";
            break;
        default:
            return "";
    }
    return "";
};

const ErrorMessage = ({ message }) => (
    <p className="text-red-500 text-xs mt-1 font-medium">{message}</p>
);

const CLOUD_NAME = "dxcrlpike";
const UPLOAD_PRESET = "LeoTechSl Projects";

// Helper: convert base64 → File
const base64ToFile = (base64String, filename) => {
    const arr = base64String.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
};

// Upload to Cloudinary
const uploadToCloudinary = async (base64Image, schoolId) => {
    const file = base64ToFile(base64Image, `pq_page_${Date.now()}.jpg`);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    // ⭐️ New folder structure: SchoolID/PastQuestions
    formData.append("folder", `${schoolId}/PastQuestions`); 

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Upload failed");

    return { url: data.secure_url, publicId: data.public_id };
};


const PastQuestionUpload = () => {
    // Get logged-in user and school context
    const location = useLocation();
    const adminUser = location.state?.user || {};
    // ⭐️ Retrieve school ID and Name from state
    const schoolId = location.state?.schoolId || adminUser.schoolId || "";
    const schoolName = location.state?.schoolName || "Unknown School";

    const [formData, setFormData] = useState({
        // ⭐️ New fields relevant to school PQs
        schoolId: schoolId,
        schoolName: schoolName,
        className: "", // Corresponds to University Level/Course
        subject: "",   // Corresponds to University Module
        testType: "",  // Corresponds to University Semester
        academicYear: "",
         
        // Metadata
        uploadedBy: adminUser.studentName || "Admin",
        uploadDate: new Date().toISOString().slice(0, 10),
        pages: [], // store multiple page images
    });


    const [records, setRecords] = useState([]);
    const [validationErrors, setValidationErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showCamera, setShowCamera] = useState(false);

    // ⭐️ Dynamic Lookups
    const [classes, setClasses] = useState([]);
    // The subjects state is now an array of strings (subject names)
    const [subjects, setSubjects] = useState([]); 
    const [academicYears, setAcademicYears] = useState([]);


    // 1. Fetch PQ records from schoollpq in realtime
    useEffect(() => {
        if (!schoolId) return;

        const q = query(
            collection(schoollpq, COLLECTION_NAME), 
            where("schoolId", "==", schoolId), // ⭐️ Filter by schoolId
            // orderBy("uploadDate", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setRecords(data);
        }, (err) => {
             console.error("Error fetching PQ records:", err);
             toast.error("Failed to fetch past question records.");
        });
        return () => unsubscribe();
    }, [schoolId]);


    // 2. 🔽 Fetch Classes and Academic Years dynamically from 'db'
    useEffect(() => {
        if (!schoolId) return;
         
        // Classes (Class Name)
        const qClasses = query(collection(db, "Classes"), where("schoolId", "==", schoolId));
        const unsubscribeClasses = onSnapshot(qClasses, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().className }));
            setClasses(data);
        }, (err) => {
            console.error(err);
            toast.error("Failed to fetch Classes");
        });

        // Academic Years (Assuming AcademicYears collection is not school-specific)
        const unsubscribeAcademicYears = onSnapshot(collection(db, "AcademicYears"), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().yearName }));
            setAcademicYears(data);
        }, (err) => {
            console.error(err);
            toast.error("Failed to fetch Academic Years");
        });

        // Cleanup subscriptions on unmount
        return () => {
            unsubscribeClasses();
            unsubscribeAcademicYears();
        };
    }, [schoolId]);

    // ⭐️ NEW EFFECT: Fetch Subjects based on selected className
    useEffect(() => {
        // Only run if a class is selected AND we have a school ID
        if (!schoolId || !formData.className) {
            setSubjects([]);
            // Clear selected subject if the class changes
            if (formData.subject) {
                setFormData(prev => ({ ...prev, subject: "" }));
            }
            return;
        }

        const subjectsRef = collection(db, "ClassesAndSubjects");
        const qSubjects = query(
            subjectsRef, 
            where("schoolId", "==", schoolId),
            where("className", "==", formData.className) // Filter by selected Class
        );

        const unsubscribeSubjects = onSnapshot(qSubjects, (snapshot) => {
            // The SubjectPage component saves subjects as an array on the document, 
            // so we extract that array if the document exists.
            if (snapshot.docs.length > 0) {
                const subjectsArray = snapshot.docs[0].data().subjects || [];
                setSubjects(subjectsArray.map(subj => ({ id: subj, name: subj }))); // Map array of strings to {id, name}
            } else {
                setSubjects([]);
            }
        }, (err) => {
            console.error("Error fetching Subjects for class:", err);
            toast.error("Failed to fetch subjects for the selected class.");
        });

        return () => unsubscribeSubjects();
    }, [schoolId, formData.className]); // Dependency on schoolId and className


    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let newData = { ...formData, [name]: value };

        // ⭐️ LOGIC: When className changes, reset subject to force re-selection
        if (name === "className" && value !== formData.className) {
            newData.subject = "";
        }

        setFormData(newData);
        setValidationErrors({
            ...validationErrors,
            [name]: validateField(name, value),
        });
    };

    const handleUploadSuccess = (url, publicId) => {
        setFormData((prev) => ({
            ...prev,
            pages: [...(prev.pages || []), { url, publicId }],
        }));
        setIsUploading(false);
        toast.success("Page uploaded successfully!");
    };


    const handleCameraCapture = async (base64Image) => {
        if (!schoolId) {
             toast.error("Cannot upload: School ID is missing.");
             setShowCamera(false);
             return;
        }
        try {
            setIsUploading(true);
            // ⭐️ Pass schoolId for structured Cloudinary folder
            const { url, publicId } = await uploadToCloudinary(base64Image, schoolId); 

            setFormData((prev) => ({
                ...prev,
                pages: [...(prev.pages || []), { url, publicId }],
            }));

            toast.success("Page uploaded successfully!");
        } catch (err) {
            console.error("Camera upload error:", err);
            toast.error("Upload failed. Check console for details.");
        } finally {
            setIsUploading(false);
            setShowCamera(false);
        }
    };


    const validateForm = () => {
        const errors = {};
        let valid = true;
         
        if (!formData.schoolId) {
             errors.schoolName = "School context is missing. Re-login.";
             valid = false;
        }
        if (!formData.className) {
            errors.className = "Class is required.";
            valid = false;
        }
        if (!formData.subject) {
            errors.subject = "Subject is required.";
            valid = false;
        }
        if (!formData.testType) {
            errors.testType = "Test/Term is required.";
            valid = false;
        }
        if (!formData.academicYear) {
            errors.academicYear = "Academic Year is required.";
            valid = false;
        }
        if (!formData.pages || formData.pages.length === 0) {
            errors.pages = "At least one exam page must be uploaded.";
            valid = false;
        }


        setValidationErrors(errors);
        return valid;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;
        setIsSubmitting(true);

        try {
            const dataToSave = {
                ...formData,
                schoolId: schoolId,
                schoolName: schoolName,
                pages: formData.pages || [],
                // Ensure correct data types for storage
                timestamp: new Date(), 
            };

            // Determine target database based on action
            const dbRef = collection(schoollpq, COLLECTION_NAME);

            if (formData.id) {
                // Update 
                const docRef = doc(schoollpq, COLLECTION_NAME, formData.id);
                await updateDoc(docRef, dataToSave);
                toast.success("Past Question updated successfully! 🎉");
            } else {
                // Add new 
                await addDoc(dbRef, dataToSave);
                toast.success("Past Question uploaded successfully! 🎉");
            }

            // Reset form for new entry, keeping admin metadata
            setFormData({
                schoolId: schoolId,
                schoolName: schoolName,
                uploadedBy: adminUser.studentName || "Admin",
                uploadDate: new Date().toISOString().slice(0, 10),
                className: "", // Reset core fields
                subject: "",
                testType: "",
                academicYear: "",
                pages: [],
            });
            setValidationErrors({});

        } catch (err) {
            console.error(err);
            toast.error("Failed to submit form. Try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (record) => {
        setFormData({
            ...record,
            // Ensure pages is set correctly for editing
            pages: record.pages || [],
        });
        toast.info(`Editing record for ${record.className} - ${record.subject}`);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this past question record?")) return;
        try {
            // Delete from schoollpq database
            await deleteDoc(doc(schoollpq, COLLECTION_NAME, id));
            toast.success("Record deleted successfully!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete record.");
        }
    };

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6">
            <h2 className="text-3xl font-bold text-center mb-6 text-purple-700">
                {schoolName} - Past Question Upload
            </h2>
             
            {/* Form */}
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-2xl mb-6">
                <p className="text-gray-600 mb-4 border-b pb-3">
                    <span className="font-semibold">Uploader:</span> {formData.uploadedBy} | 
                    <span className="ml-2 font-semibold">School ID:</span> {schoolId}
                </p>

                {/* Class Name + Subject */}
                <div className="flex flex-col md:flex-row md:space-x-4 mb-4">
                    <div className="flex-1 mb-4 md:mb-0">
                        <label className="block mb-1 font-medium">Class *</label>
                        <select
                            name="className"
                            value={formData.className}
                            onChange={handleInputChange}
                            className={`w-full p-2 border rounded ${validationErrors.className ? "border-red-500" : "border-gray-300"}`}
                        >
                            <option value="">Select Class</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                        {validationErrors.className && <ErrorMessage message={validationErrors.className} />}
                    </div>
                    <div className="flex-1">
                        <label className="block mb-1 font-medium">Subject *</label>
                        <select
                            name="subject"
                            value={formData.subject}
                            onChange={handleInputChange}
                            // Disable if no subjects are available for the selected class
                            disabled={subjects.length === 0} 
                            className={`w-full p-2 border rounded ${validationErrors.subject ? "border-red-500" : "border-gray-300"} ${subjects.length === 0 ? "bg-gray-100" : "bg-white"}`}
                        >
                            <option value="">
                                {formData.className ? 
                                    (subjects.length > 0 ? "Select Subject" : "No Subjects set for this Class") 
                                    : "Select Class first"
                                }
                            </option>
                            {/* Map over the dynamically fetched subjects */}
                            {subjects.map(s => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                        </select>
                        {validationErrors.subject && <ErrorMessage message={validationErrors.subject} />}
                    </div>
                </div>

                {/* Test Type (Term) + Academic Year */}
                <div className="flex flex-col md:flex-row md:space-x-4 mb-4">
                    <div className="flex-1 mb-4 md:mb-0">
                        <label className="block mb-1 font-medium">Test/Term *</label>
                        <select
                            name="testType"
                            value={formData.testType}
                            onChange={handleInputChange}
                            className={`w-full p-2 border rounded ${validationErrors.testType ? "border-red-500" : "border-gray-300"}`}
                        >
                            <option value="">Select Test Type</option>
                            {TESTS.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        {validationErrors.testType && <ErrorMessage message={validationErrors.testType} />}
                    </div>
                  <div className="flex-1">
    <label className="block mb-1 font-medium">Academic Year *</label>
    <select
        name="academicYear"
        value={formData.academicYear}
        onChange={handleInputChange}
        className={`w-full p-2 border rounded-lg ${validationErrors.academicYear ? "border-red-500" : "border-gray-300"}`}
        required
    >
        <option value="">Select Year</option>
        <option value="2025/2026">2025/2026</option>
        <option value="2024/2025">2024/2025</option>
        <option value="2023/2024">2023/2024</option>
        {/* Add more years as needed */}
    </select>
    {validationErrors.academicYear && <ErrorMessage message={validationErrors.academicYear} />}
</div>

                </div>

                {/* Pages Upload Section (Rest of the component remains the same) */}
                <div className="mb-6 border-t pt-4">
                    <label className="block mb-3 font-semibold text-lg text-gray-700">
                        Upload Past Question Paper Pages ({formData.pages.length} Pages) *
                    </label>
                    <div className="flex flex-col items-center w-full">

                        {/* Large Preview */}
                        <div className="w-full max-w-2xl aspect-[2/3] border-4 border-dashed border-gray-300 flex items-center justify-center mb-4 overflow-hidden bg-gray-50">
                            {isUploading ? (
                                <div className="text-indigo-600 font-medium p-4">Uploading...</div>
                            ) : formData.pages && formData.pages.length > 0 ? (
                                <img
                                    src={formData.pages[0].url} 
                                    alt="First Page Preview"
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <p className="text-gray-400">Upload a page using the camera or file upload.</p>
                            )}
                        </div>

                        {/* Thumbnails */}
                        {formData.pages && formData.pages.length > 0 && (
                            <div className="mt-4 grid grid-cols-4 gap-3 w-full">
                                {formData.pages.map((page, index) => (
                                    <div
                                        key={index}
                                        className="border rounded p-1 text-center relative cursor-pointer hover:shadow-md transition-shadow bg-white"
                                        onClick={() => {
                                            // Move clicked page to first position (for preview)
                                            setFormData((prev) => {
                                                const pages = [...prev.pages];
                                                const [clicked] = pages.splice(index, 1);
                                                return { ...prev, pages: [clicked, ...pages] };
                                            });
                                        }}
                                    >
                                        <img
                                            src={page.url}
                                            alt={`Page ${index + 1}`}
                                            className="h-20 w-full object-contain mb-1 rounded"
                                        />
                                        <p className="text-xs font-medium text-gray-600">Page {index + 1}</p>

                                        {/* Delete */}
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    pages: prev.pages.filter((_, i) => i !== index),
                                                }));
                                                toast.info(`Page ${index + 1} removed`);
                                            }}
                                            className="absolute top-0 right-0 bg-red-600 text-white text-xs px-1 rounded-bl-lg hover:bg-red-700"
                                            title="Remove Page"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {validationErrors.pages && <ErrorMessage message={validationErrors.pages} />}

                        {/* Upload Controls */}
                        <div className="flex space-x-4 mt-4 w-full justify-center">
                            <CloudinaryImageUploader onUploadSuccess={handleUploadSuccess} />

                            <button
                                onClick={() => setShowCamera(true)}
                                type="button"
                                disabled={isUploading}
                                className="px-4 py-2 bg-purple-600 text-white rounded font-semibold transition hover:bg-purple-700 disabled:bg-gray-400"
                            >
                                {isUploading ? "Uploading..." : "Use Camera"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || isUploading || formData.pages.length === 0}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-400 transition mt-6"
                >
                    {isSubmitting ? "Submitting..." : formData.id ? "Update Past Question" : "Submit New Question Paper"}
                </button>
            </div>

            {/* Camera Modal */}
            {showCamera && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full">
                        <CameraCapture
                            onCapture={handleCameraCapture}
                            onClose={() => setShowCamera(false)}
                            isUploading={isUploading}
                        />
                    </div>
                </div>
            )}


            {/* Table of Records */}
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-4xl">
                <h2 className="text-xl font-bold text-purple-700 mb-4">Uploaded Past Questions ({schoolName})</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full table-auto border border-gray-300">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="px-4 py-2 border">Class</th>
                                <th className="px-4 py-2 border">Subject</th>
                                <th className="px-4 py-2 border">Test Type</th>
                                <th className="px-4 py-2 border">Year</th>
                                <th className="px-4 py-2 border">Pages</th>
                                <th className="px-4 py-2 border">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-4 text-gray-500">
                                        No past question papers uploaded yet for this school.
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr key={record.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 border">{record.className}</td>
                                        <td className="px-4 py-2 border">{record.subject}</td>
                                        <td className="px-4 py-2 border">{record.testType}</td>
                                        <td className="px-4 py-2 border">{record.academicYear}</td>
                                        <td className="px-4 py-2 border">{record.pages?.length || 0}</td>
                                        <td className="px-4 py-2 border space-x-2">
                                            <button 
                                                onClick={() => handleEdit(record)}
                                                className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                                            >
                                                Edit
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(record.id)}
                                                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PastQuestionUpload;