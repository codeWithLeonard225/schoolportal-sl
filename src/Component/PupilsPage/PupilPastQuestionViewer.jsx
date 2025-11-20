import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { db } from "../../../firebase";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import {
    collection,
    onSnapshot,
    query,
    where,
    getDocs,
} from "firebase/firestore";

// 🎯 The collection name
const COLLECTION_NAME = "SchoolPastQuestions";

// --- New Modal Component (View Image Popup) ---
const ImageViewerModal = ({ record, onClose }) => {
    if (!record || record.pages.length === 0) return null;

    // State to track which page is currently being viewed in the modal
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const currentPage = record.pages[currentPageIndex];
    const totalPages = record.pages.length;

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800 truncate">
                        {record.subject} - {record.testType}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-red-600 transition text-2xl font-bold p-1"
                    >
                        &times;
                    </button>
                </div>

                {/* Image Display Area */}
                <div className="flex-1 p-2 flex items-center justify-center overflow-auto bg-gray-100">
                    <img
                        src={currentPage.url}
                        alt={`Past Question Page ${currentPageIndex + 1}`}
                        className="max-w-full max-h-full object-contain"
                        loading="lazy"
                    />
                </div>

                {/* Footer/Navigation */}
                <div className="p-4 border-t flex justify-center items-center space-x-4 bg-gray-50">
                    <button
                        onClick={() => setCurrentPageIndex(prev => Math.max(0, prev - 1))}
                        disabled={currentPageIndex === 0}
                        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400 hover:bg-blue-600 transition"
                    >
                        &larr; Previous
                    </button>
                    <span className="font-medium text-gray-700">
                        Page {currentPageIndex + 1} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPageIndex(prev => Math.min(totalPages - 1, prev + 1))}
                        disabled={currentPageIndex === totalPages - 1}
                        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400 hover:bg-blue-600 transition"
                    >
                        Next &rarr;
                    </button>
                </div>
            </div>
        </div>
    );
};
// --- End Modal Component ---

const PupilPastQuestionViewer = () => {
    const location = useLocation();
    const pupilData = location.state?.user || {};
    const schoolId = location.state?.schoolId || pupilData.schoolId || "";
    // ... other data retrieval

    const [pqRecords, setPqRecords] = useState([]);
    const [latestInfo, setLatestInfo] = useState({ class: "", academicYear: "" });
    const [loading, setLoading] = useState(true);
    const [classesCache, setClassesCache] = useState([]);

    // ⭐️ NEW STATE: Control for the Modal
    const [modalRecord, setModalRecord] = useState(null);


    // 1. 🚀 OPTIMIZED: Fetch Classes Cache using localStorage (Logic unchanged)
    useEffect(() => {
        // ... (Your existing logic for fetching/caching classes)
        if (!schoolId) return;
        const CLASSES_CACHE_KEY = `classes_config_${schoolId}`;
        const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

        const fetchClasses = async (useCache) => {
            let data = [];
            // Attempt to load from cache
            if (useCache) {
                const cachedData = localStorage.getItem(CLASSES_CACHE_KEY);
                if (cachedData) {
                    try {
                        const { timestamp, data: cachedClasses } = JSON.parse(cachedData);
                        if (Date.now() - timestamp < CACHE_DURATION_MS) {
                            setClassesCache(cachedClasses);
                            return;
                        }
                    } catch (e) {
                        console.error("Error parsing cache, fetching fresh data.");
                    }
                }
            }
            // Fetch from Firestore
            try {
                const snapshot = await getDocs(query(collection(db, "Classes"), where("schoolId", "==", schoolId)));
                data = snapshot.docs.map(doc => doc.data()); 
                setClassesCache(data);
                localStorage.setItem(CLASSES_CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    data: data,
                }));
            } catch (error) {
                console.error("Error fetching Classes data:", error);
                toast.error("Failed to fetch classes for lookup.");
            }
        };
        
        fetchClasses(true); 

    }, [schoolId]); 


    // 2. Fetch latest class & academic year for the pupil (Logic unchanged)
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
                toast.warn("Pupil's class registration not found.");
            }
            setLoading(false);
        }, (error) => {
            console.error("Firestore Error in PupilsReg lookup:", error);
            toast.error("Failed to retrieve your current class information.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [pupilData.studentID, schoolId]);

    // 3. Fetch Past Question records based on pupil's current class (Logic unchanged)
    useEffect(() => {
        if (!schoolId || !latestInfo.class) {
            setPqRecords([]);
            return;
        }

        const q = query(
            collection(schoollpq, COLLECTION_NAME),
            where("schoolId", "==", schoolId),
            where("className", "==", latestInfo.class),
        );

        setLoading(true);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => {
                if (a.subject < b.subject) return -1;
                if (a.subject > b.subject) return 1;
                return 0;
            });
            setPqRecords(data);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching Past Question records:", err);
            toast.error("Failed to load past question records.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [schoolId, latestInfo.class]);


    // ⭐️ UPDATED Function to open the modal
    const handleViewPaper = (record) => {
        if (record.pages && record.pages.length > 0) {
            setModalRecord(record);
        } else {
            toast.warn("No pages uploaded for this question paper.");
        }
    };

    if (loading && latestInfo.class === "") {
        return (
            <div className="text-center p-8">
                <p className="text-lg font-medium text-gray-700">Loading pupil information...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center min-h-screen bg-gray-50 p-6">
            <h2 className="text-3xl font-bold text-center mb-2 text-blue-700">
                📚 School Past Questions
            </h2>
            <h3 className="text-xl font-medium text-center mb-6 text-gray-600">
                Viewing for {pupilData.studentName} ({latestInfo.class} - {latestInfo.academicYear})
            </h3>
            
            <div className="bg-white shadow-xl rounded-2xl p-6 w-full max-w-4xl">
                <p className="text-lg font-semibold border-b pb-3 mb-4 text-purple-600">
                    Past Questions for Your Class: <span className="text-gray-800">{latestInfo.class}</span>
                </p>

                {loading ? (
                    <div className="text-center py-8">
                        <p className="text-lg font-medium text-blue-500">Fetching past question papers...</p>
                    </div>
                ) : pqRecords.length === 0 ? (
                    <div className="text-center py-8 bg-yellow-50 rounded-lg">
                        <p className="text-lg text-gray-700 font-medium">
                            No past question papers uploaded yet for the <span className="font-bold">{latestInfo.class}</span> class.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pqRecords.map((record) => (
                            <div 
                                key={record.id} 
                                className="border border-gray-200 rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow bg-white flex flex-col justify-between"
                            >
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">
                                        {record.academicYear} - {record.testType}
                                    </p>
                                    <h4 className="text-xl font-bold text-gray-800 mb-2">
                                        {record.subject}
                                    </h4>
                                    <p className="text-sm text-gray-600">
                                        <span className="font-semibold">Pages:</span> {record.pages?.length || 0}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        <span className="font-semibold">Uploaded By:</span> {record.uploadedBy}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleViewPaper(record)}
                                    className="mt-4 w-full bg-green-500 text-white py-2 rounded-lg font-semibold hover:bg-green-600 transition"
                                >
                                    View Paper
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Render Modal if modalRecord is set */}
            {modalRecord && (
                <ImageViewerModal 
                    record={modalRecord} 
                    onClose={() => setModalRecord(null)} 
                />
            )}
        </div>
    );
};

export default PupilPastQuestionViewer;