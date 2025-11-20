import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { schoollpq } from "../Database/schoollibAndPastquestion"; // Separate Firestore instance for PQ/Library
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    where,
} from "firebase/firestore";

// Assuming you have a CameraCapture component, kept for context, but usually for images
import CameraCapture from "../CaptureCamera/CameraCapture"; 

// ⭐️ NEW: A generic file uploader component to handle PDF/other files
const CloudinaryFileUploader = ({ onUploadSuccess }) => {
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Optionally validate file type here (e.g., if you only want PDF)
        // if (file.type !== "application/pdf") {
        //     toast.error("Only PDF files are allowed.");
        //     event.target.value = null; // Clear input
        //     return;
        // }
        
        setIsUploading(true);
        
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", "LeoTechSl Projects"); // Use your constant
            formData.append("folder", `general/Library`); // Can adjust folder structure if needed

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/dxcrlpike/upload`, // Use your constant
                { method: "POST", body: formData }
            );

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || "Upload failed");
            
            onUploadSuccess(data.secure_url, data.public_id);
            event.target.value = null; // Clear input after successful upload
            
        } catch (err) {
            console.error(err);
            toast.error("File upload failed.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <label className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer text-sm font-semibold">
            {isUploading ? "Uploading..." : "Select File (PDF, etc.)"}
            <input
                type="file"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
                accept=".pdf, .doc, .docx, .txt" // Specify accepted file types
            />
        </label>
    );
};
// ⚠️ NOTE: The original `CloudinaryImageUploader` component has been replaced/mocked above.

// New collection for Library
const COLLECTION_NAME = "SchoolLibrary";

// ❌ REMOVED: base64ToFile and uploadToCloudinary functions are no longer needed 
// as file inputs directly provide a File object handled by CloudinaryFileUploader.


const SchoolLibraryUpload = () => {
    const location = useLocation();
    const adminUser = location.state?.user || {};
    const schoolId = location.state?.schoolId || adminUser.schoolId || "";
    const schoolName = location.state?.schoolName || "Unknown School";

    const [formData, setFormData] = useState({
        schoolId,
        schoolName,
        subject: "",
        author: "", 
        uploadedBy: adminUser.studentName || "Admin",
        uploadDate: new Date().toISOString().slice(0, 10),
        files: [],
    });

    const [records, setRecords] = useState([]);
    const [validationErrors, setValidationErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showCamera, setShowCamera] = useState(false); // Kept for the CameraCapture component

    // Fetch library records from schoollpq
    useEffect(() => {
        if (!schoolId) return;
        const q = query(
            collection(schoollpq, COLLECTION_NAME),
            where("schoolId", "==", schoolId)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            setRecords(data);
        });
        return () => unsubscribe();
    }, [schoolId]);


    const validateForm = () => {
        const errors = {};
        let valid = true;
        
        if (!formData.subject.trim()) {
            errors.subject = "Subject/Title is required.";
            valid = false;
        }
        
        if (!formData.author.trim()) {
            errors.author = "Author/Written By is required.";
            valid = false;
        }
        
        if (!formData.files || formData.files.length === 0) {
            errors.files = "At least one file must be uploaded.";
            valid = false;
        }
        setValidationErrors(errors);
        return valid;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setValidationErrors({ ...validationErrors, [name]: "" });
    };

    const handleUploadSuccess = (url, publicId) => {
        setFormData((prev) => ({ ...prev, files: [...prev.files, { url, publicId }] }));
        // Note: setIsUploading(false) is handled inside the uploader component
        toast.success("File uploaded successfully!");
    };

    // ⚠️ NOTE: This function still uses the old image-upload logic (base64 to Cloudinary API)
    // You would need to update your CameraCapture and related logic if you intended to capture 
    // documents and convert them to PDF or other non-image formats.
    // For now, it is kept as-is, assuming CameraCapture only handles images.
    const uploadBase64ToCloudinary = async (base64Image, schoolId) => {
        // Keeping original base64 to File conversion here for CameraCapture context
        const arr = base64Image.split(",");
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n); 
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        const file = new File([u8arr], `library_file_${Date.now()}.jpg`, { type: mime });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "LeoTechSl Projects");
        formData.append("folder", `${schoolId}/Library`);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/dxcrlpike/image/upload`,
            { method: "POST", body: formData }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Upload failed");
        return { url: data.secure_url, publicId: data.public_id };
    };

    const handleCameraCapture = async (base64Image) => {
        try {
            setIsUploading(true);
            const { url, publicId } = await uploadBase64ToCloudinary(base64Image, schoolId);
            setFormData((prev) => ({ ...prev, files: [...prev.files, { url, publicId }] }));
            toast.success("Image uploaded successfully!");
        } catch (err) {
            console.error(err);
            toast.error("Camera upload failed.");
        } finally {
            setIsUploading(false);
            setShowCamera(false);
        }
    };
    // -----------------------------------------------------------------------

    const handleSubmit = async () => {
        if (!validateForm()) return;
        setIsSubmitting(true);

        try {
            const dataToSave = {
                ...formData,
                subject: formData.subject.trim(), 
                author: formData.author.trim(),
            }
            
            const dbRef = collection(schoollpq, COLLECTION_NAME);
            if (formData.id) {
                await updateDoc(doc(schoollpq, COLLECTION_NAME, formData.id), dataToSave);
                toast.success("Library record updated!");
            } else {
                await addDoc(dbRef, dataToSave);
                toast.success("Library file uploaded!");
            }
            
            setFormData({
                schoolId,
                schoolName,
                subject: "",
                author: "", 
                uploadedBy: adminUser.studentName || "Admin",
                uploadDate: new Date().toISOString().slice(0, 10),
                files: [],
            });
            setValidationErrors({});
        } catch (err) {
            console.error(err);
            toast.error("Failed to submit.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (record) => setFormData(record);
    const handleDelete = async (id) => {
        if (!window.confirm("Delete this file?")) return;
        try {
            await deleteDoc(doc(schoollpq, COLLECTION_NAME, id));
            toast.success("Deleted successfully!");
        } catch (err) {
            console.error(err);
            toast.error("Delete failed!");
        }
    };

    return (
        <div className="p-6 min-h-screen bg-gray-100 flex flex-col items-center">
            <h2 className="text-3xl font-bold text-purple-700 mb-6">
                {schoolName} - Library Upload
            </h2>

            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-2xl mb-6">
                
                {/* Subject/Title Text Input */}
                <div className="mb-4">
                    <label className="block mb-1 font-medium">Subject/Title *</label>
                    <input
                        type="text"
                        name="subject"
                        value={formData.subject}
                        onChange={handleInputChange}
                        placeholder="e.g., Physics textbook, Maths notes, etc."
                        className={`w-full p-2 border rounded ${validationErrors.subject ? "border-red-500" : "border-gray-300"}`}
                    />
                    {validationErrors.subject && <p className="text-red-500 text-xs mt-1">{validationErrors.subject}</p>}
                </div>
                
                {/* Author/Written By Text Input */}
                <div className="mb-4">
                    <label className="block mb-1 font-medium">Author / Written By *</label>
                    <input
                        type="text"
                        name="author"
                        value={formData.author}
                        onChange={handleInputChange}
                        placeholder="e.g., John Doe, School Admin, Unknown"
                        className={`w-full p-2 border rounded ${validationErrors.author ? "border-red-500" : "border-gray-300"}`}
                    />
                    {validationErrors.author && <p className="text-red-500 text-xs mt-1">{validationErrors.author}</p>}
                </div>

                <div className="mt-4 flex flex-col items-center">
                    <p className="mb-2 font-medium">Upload Files ({formData.files.length} uploaded)</p>
                    <div className="flex space-x-4">
                        {/* ⭐️ CHANGED: Use the generic file uploader */}
                        <CloudinaryFileUploader onUploadSuccess={handleUploadSuccess} /> 
                        
                        <button
                            onClick={() => setShowCamera(true)}
                            type="button"
                            disabled={isUploading}
                            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                            {isUploading ? "Uploading..." : "Use Camera"}
                        </button>
                    </div>
                    {validationErrors.files && <p className="text-red-500 text-xs mt-1">{validationErrors.files}</p>}
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || isUploading || formData.files.length === 0}
                    className="w-full bg-blue-600 text-white py-3 mt-6 rounded-xl font-semibold hover:bg-blue-700"
                >
                    {isSubmitting ? "Submitting..." : formData.id ? "Update Record" : "Upload File"}
                </button>
            </div>

            {/* Camera Modal */}
            {showCamera && (
                <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full">
                        <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} isUploading={isUploading} />
                    </div>
                </div>
            )}

            {/* Records Table */}
            <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-4xl">
                <h2 className="text-xl font-bold text-purple-700 mb-4">Uploaded Library Files ({schoolName})</h2>
                <div className="overflow-x-auto">
                    {/* Using Option A (Tightly packed tags) to avoid hydration errors */}
                    <table className="min-w-full table-auto border border-gray-300">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="px-4 py-2 border">Subject/Title</th><th className="px-4 py-2 border">Author</th><th className="px-4 py-2 border">Files</th><th className="px-4 py-2 border">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="text-center py-4 text-gray-500">
                                        No library files uploaded yet.
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr key={record.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 border">{record.subject}</td><td className="px-4 py-2 border">{record.author || 'N/A'}</td><td className="px-4 py-2 border">{record.files?.length || 0}</td><td className="px-4 py-2 border space-x-2">
                                            <button onClick={() => handleEdit(record)} className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600">Edit</button>
                                            <button onClick={() => handleDelete(record.id)} className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">Delete</button>
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

export default SchoolLibraryUpload;