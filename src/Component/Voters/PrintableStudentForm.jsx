import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
// ⭐ IMPORT FIREBASE FUNCTIONS FOR FETCHING SCHOOL INFO ⭐
import { db } from "../../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

/**
 * PrintableStudentForm Component
 * Renders the student details with a professional school header,
 * and automatically triggers the browser's print dialog.
 */
const PrintableStudentForm = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Safely retrieve the student data passed via state
    const studentData = location.state?.studentData;

    // ⭐ NEW STATE: To hold the school's information ⭐
    const [schoolInfo, setSchoolInfo] = useState(null);
    const [isLoadingSchool, setIsLoadingSchool] = useState(true);

    // Effect to fetch school data
    useEffect(() => {
        if (!studentData?.schoolId) {
            setIsLoadingSchool(false);
            return;
        }

        const fetchSchoolInfo = async () => {
            try {
                // Query the 'Schools' collection where 'schoolID' matches the student's ID
                const schoolsRef = collection(db, "Schools");
                const q = query(schoolsRef, where("schoolID", "==", studentData.schoolId));

                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    // Assuming schoolID is unique, take the first document found
                    setSchoolInfo(querySnapshot.docs[0].data());
                } else {
                    console.warn(`No school found with ID: ${studentData.schoolId}`);
                }
            } catch (error) {
                console.error("Error fetching school information:", error);
                toast.error("Failed to load school header information.");
            } finally {
                setIsLoadingSchool(false);
            }
        };

        fetchSchoolInfo();
    }, [studentData?.schoolId]);

    // Effect to auto-trigger the print dialog
    useEffect(() => {
        if (!studentData) {
            console.error("No student data found in router state.");
            toast.error("Error: Could not load student data for printing.");
            return;
        }

        // Wait for the school info to load and then trigger print
        if (!isLoadingSchool) {
            const printTimer = setTimeout(() => {
                window.print();
            }, 300);

            return () => clearTimeout(printTimer);
        }

    }, [studentData, isLoadingSchool]);

    // Show loading or error message if student data is missing
    if (!studentData) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <p className="text-xl text-gray-700">Loading student record for printing...</p>
            </div>
        );
    }

    // Converts a date string (YYYY-MM-DD or ISO) to "DD Month YYYY"
const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};


    // --- RENDER PRINT-FRIENDLY STRUCTURE ---
    return (
        <div className="p-8 max-w-4xl mx-auto bg-white shadow-xl print:shadow-none print:p-0" style={{ fontFamily: 'Arial, sans-serif' }}>

            {/* Print/Back Buttons (Hidden when printing) */}
            <div className="flex justify-between items-center mb-6 print:hidden">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                >
                    &larr; Back to Registration
                </button>
                <button
                    onClick={() => window.print()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                >
                    Print Document Now
                </button>
            </div>

            {/* ⭐ PROFESSIONAL HEADER SECTION ⭐ */}
            <header className="border-b-4 border-gray-900 pb-3 mb-6">
                {isLoadingSchool ? (
                    <div className="text-center py-4"><p className="text-gray-500">Loading School Information...</p></div>
                ) : schoolInfo ? (
                    <div className="flex items-center justify-between p-2">
                        {/* School Logo (Left) */}
                        <div className="w-1/5 flex justify-start">
                            {schoolInfo.schoolLogoUrl && (
                                <img
                                    src={schoolInfo.schoolLogoUrl}
                                    alt="School Logo"
                                    className="w-28 h-36 object-contain"
                                />
                            )}
                        </div>

                        {/* School Info (Center) */}
                        <div className="w-3/5 text-center">
                            <h1 className="text-2xl font-extrabold text-gray-900 uppercase print:text-xl">{schoolInfo.schoolName}</h1>
                            <p className="text-sm text-gray-700">{schoolInfo.schoolAddress} | {schoolInfo.schoolContact}</p>
                            <p className="text-xs text-gray-600 italic">Email: {schoolInfo.email}</p>
                            <p className="text-sm font-semibold mt-1 italic">{schoolInfo.schoolMotto}</p>
                        </div>

                        {/* Empty spacer (Right) */}
                        <div className="w-1/5"></div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <h1 className="text-2xl font-bold text-gray-900">Student Registration Record</h1>
                    </div>
                )}

                {/* Student Specific Header Details */}
                <div className="mt-4 pt-2 border-t border-gray-200 text-center">
                    <h2 className="text-xl font-bold text-gray-800 print:text-lg">REGISTRATION FORM FOR: {studentData.studentName.toUpperCase()}</h2>

                </div>
            </header>

            {/* Photo and Core Info Header */}
            <div className="flex justify-between items-start mb-6 border-b pb-4">
                <div className="space-y-1">
                    <p><strong>Pupil ID:</strong> {studentData.studentID}</p>
                    <p><strong>Student Name:</strong> {studentData.studentName}</p>
                    <p><strong>Date of Birth:</strong> {formatDate(studentData.dob)} (Age: {studentData.age})</p>
                    <p><strong>Gender:</strong> {studentData.gender}</p>
                    <p><strong>Address:</strong> {studentData.addressLine1 || 'N/A'}</p>
                
                </div>
                {studentData.userPhotoUrl && (
                    <div className="p-1 border border-gray-400">
                        <img
                            src={studentData.userPhotoUrl}
                            alt={`Photo of ${studentData.studentName}`}
                            className="w-28 h-36 object-cover"
                        />
                    </div>
                )}
            </div>

            {/* Details Grid */}
            <section className="space-y-6">
                
                <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 text-gray-800">Academic Information</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <p><strong>Registration Date:</strong> {formatDate(studentData.registrationDate)}</p>
                    <p><strong>Class:</strong> {studentData.class}</p>
                    <p><strong>Academic Year:</strong> {studentData.academicYear}</p>
               
                </div>

                <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 text-gray-800 pt-4">Parent/Guardian & Contact</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <p><strong>Parent/Guardian Name:</strong> {studentData.parentName || 'N/A'}</p>
                    <p><strong>Phone:</strong> {studentData.parentPhone || 'N/A'}</p>
                    <p className="col-span-2"><strong>Parent's Address:</strong> {studentData.addressLine2 || 'N/A'}</p>
                </div>

    
            </section>

            <footer className="mt-12 pt-20 border-t border-gray-400 text-sm text-gray-600 print:mt-10">
                <div className="grid grid-cols-2 gap-8">
                    {/* <p>Guardian Signature: _________________________</p> */}
                    <p>Registrar Signature: _________________________</p>
                </div>
            </footer>
        </div>
    );
};

export default PrintableStudentForm;