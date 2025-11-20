import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { db } from "../../../firebase"; // Assuming the general db instance
import { schoollpq } from "../Database/schoollibAndPastquestion"; // Separate Firestore instance for PQ/Library
import {
    collection,
    onSnapshot,
    query,
    where,
    getDocs,
}
 from "firebase/firestore";

// Collection name for the Library
const COLLECTION_NAME = "SchoolLibrary";


// --- 🚀 File Viewer Modal Component (Optimized for PDF/DOCX using Google Viewer) ---
const FileViewerModal = ({ record, onClose }) => {
    // We display the first file in the 'files' array
    const file = record?.files?.[0]; 

    if (!file) return null;

    // Original public file URL
    const fileUrl = file.url;
    
    // Check if the file is likely an image (will display directly)
    const isImage = /\.(jpe?g|png|gif|webp)$/i.test(fileUrl);

    // Determine the URL to use in the iframe/img tag
    let displayUrl = fileUrl;

    if (!isImage) {
        // For non-image files (PDFs, DOCX), use the Google Docs Viewer service.
        // This is the most reliable cross-browser method to embed documents.
        displayUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
    }

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800 truncate">
                        Preview: {record.subject}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-red-600 transition text-2xl font-bold p-1"
                    >
                        &times;
                    </button>
                </div>

                {/* Content Display Area */}
                <div className="flex-1 p-2 flex items-center justify-center overflow-auto bg-gray-100">
                    {isImage ? (
                        <img
                            src={fileUrl} // Direct URL for images
                            alt={`Preview of ${record.subject}`}
                            className="max-w-full max-h-full object-contain"
                            loading="lazy"
                        />
                    ) : (
                        // Use iframe with the Google Docs Viewer URL for documents
                        <iframe
                            src={displayUrl} 
                            title={`Document Preview of ${record.subject}`}
                            className="w-full h-full border-none"
                            style={{ minHeight: '100%' }}
                            // The sandbox attribute is removed as Google Docs Viewer already handles security
                        >
                            <p className="p-4 text-center text-gray-600">
                                Document preview failed. 
                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-1">
                                    Click here to open the file directly in a new tab.
                                </a>
                            </p>
                        </iframe>
                    )}
                </div>

                {/* Footer/Direct Link */}
                <div className="p-3 border-t bg-gray-50 flex justify-center">
                    <a 
                        href={fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                        Open Original File in New Tab
                    </a>
                </div>
            </div>
        </div>
    );
};
// --- End File Viewer Modal Component ---


const SchoolLibraryViewer = () => {
    const location = useLocation();
    const pupilData = location.state?.user || {};
    const schoolId = location.state?.schoolId || pupilData.schoolId || "";

    const [libraryRecords, setLibraryRecords] = useState([]);
    const [latestInfo, setLatestInfo] = useState({ academicYear: "" });
    const [loading, setLoading] = useState(true);
    
    // ⭐️ State for the Modal
    const [previewRecord, setPreviewRecord] = useState(null);


    // 1. Fetch latest class & academic year for the pupil
    useEffect(() => {
        if (!pupilData.studentID || !schoolId) return;

        const pupilRegRef = query(
            collection(db, "PupilsReg"),
            where("studentID", "==", pupilData.studentID),
            where("schoolId", "==", schoolId),
        );

        const unsubscribe = onSnapshot(pupilRegRef, (snapshot) => {
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                setLatestInfo({
                    class: data.class,
                    academicYear: data.academicYear,
                });
            } else {
                setLatestInfo({ class: "", academicYear: "" });
            }
        }, (error) => {
            console.error("Firestore Error in PupilsReg lookup:", error);
            toast.error("Failed to retrieve your current class information.");
        });

        return () => unsubscribe();
    }, [pupilData.studentID, schoolId]);


    // 2. Fetch ALL Library records for the school
    useEffect(() => {
        if (!schoolId) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(schoollpq, COLLECTION_NAME),
            where("schoolId", "==", schoolId),
        );

        setLoading(true);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => {
                if (a.subject < b.subject) return -1;
                if (a.subject > b.subject) return 1;
                return 0;
            });
            setLibraryRecords(data);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching Library records:", err);
            toast.error("Failed to load library records.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [schoolId]);


    // Function to handle viewing the file (opens the modal)
    const handleViewFile = (record) => {
        if (record.files && record.files.length > 0) {
            setPreviewRecord(record);
        } else {
            toast.warn("No file content uploaded for this resource.");
        }
    };


    if (loading && libraryRecords.length === 0) {
        return (
            <div className="text-center p-8">
                <p className="text-lg font-medium text-gray-700">Loading school library...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-50 p-6">
            <h2 className="text-3xl font-bold text-center mb-2 text-green-700">
                📚 School Digital Library
            </h2>
            <h3 className="text-xl font-medium text-center mb-6 text-gray-600">
                Welcome, {pupilData.studentName} ({latestInfo.class || 'Class Unknown'})
            </h3>
            
            <div className="bg-white shadow-xl rounded-2xl p-6 w-full max-w-4xl">
                <p className="text-lg font-semibold border-b pb-3 mb-4 text-green-600">
                    Available Resources ({libraryRecords.length})
                </p>

                {libraryRecords.length === 0 ? (
                    <div className="text-center py-8 bg-yellow-50 rounded-lg">
                        <p className="text-lg text-gray-700 font-medium">
                            The school library is currently empty.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {libraryRecords.map((record) => (
                            <div 
                                key={record.id} 
                                className="border border-gray-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow bg-white flex flex-col justify-between"
                            >
                                <div>
                                    <h4 className="text-xl font-bold text-gray-800 mb-2 truncate">
                                        {record.subject}
                                    </h4>
                                    <p className="text-sm text-gray-600 mb-1">
                                        <span className="font-semibold">Author:</span> {record.author || 'N/A'}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        <span className="font-semibold">Files:</span> {record.files?.length || 0}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-2">
                                        Uploaded: {record.uploadDate}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleViewFile(record)}
                                    disabled={!record.files || record.files.length === 0}
                                    className="mt-4 w-full bg-blue-500 text-white py-2 rounded-lg font-semibold hover:bg-blue-600 transition disabled:bg-gray-400"
                                >
                                    View Resource
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Render Modal if previewRecord is set */}
            {previewRecord && (
                <FileViewerModal 
                    record={previewRecord} 
                    onClose={() => setPreviewRecord(null)} 
                />
            )}
        </div>
    );
};

export default SchoolLibraryViewer;