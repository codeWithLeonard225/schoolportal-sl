import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

/**
 * PrintableStudentForm Component
 * Renders the student details in a clean, print-optimized format.
 * Automatically triggers the browser's print dialog upon loading.
 */
const PrintableStudentForm = () => {
    // Hooks to access router state and navigation
    const location = useLocation();
    const navigate = useNavigate();

    // Safely retrieve the student data passed via state from the Registration component
    const studentData = location.state?.studentData;

    useEffect(() => {
        // --- Data Validation and Fallback ---
        if (!studentData) {
            console.error("No student data found in router state. Redirecting...");
            toast.error("Error: Could not load student data for printing.");
            // Optionally redirect the user back if data is missing
            // navigate('/registration'); 
            return;
        }

        // --- Auto-Print Logic ---
        // We use a small timeout to ensure the DOM is fully rendered before printing
        const printTimer = setTimeout(() => {
            window.print();
        }, 500); // 500ms delay to ensure styles and content load

        // Cleanup function for the effect
        return () => clearTimeout(printTimer);

    }, [studentData, navigate]);

    // Show a message if data hasn't been loaded yet (e.g., if navigated directly)
    if (!studentData) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <p className="text-xl text-gray-700">Loading student record for printing...</p>
            </div>
        );
    }

    // --- RENDER PRINT-FRIENDLY STRUCTURE ---
    return (
        <div className="p-8 max-w-4xl mx-auto bg-white shadow-xl print:shadow-none print:p-0" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* The Back button and Print button should only be visible on screen, not in print mode */}
            <div className="flex justify-between items-center mb-6 print:hidden">
                <button
                    onClick={() => navigate(-1)} // Go back to the previous page
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

            <header className="text-center border-b-2 border-gray-900 pb-3 mb-6">
                <h1 className="text-2xl font-bold text-gray-900 uppercase">Student Registration Record</h1>
                <p className="text-sm text-gray-600 mt-1">Pupil ID: **{studentData.studentID}**</p>
            </header>

            {/* Photo and Core Info Header */}
            <div className="flex justify-between items-start mb-6 border-b pb-4">
                <div className="space-y-1">
                    <p className="text-md">**Student Name:** {studentData.studentName.toUpperCase()}</p>
                    <p className="text-sm">**Date of Birth:** {studentData.dob}</p>
                    <p className="text-sm">**Age:** {studentData.age} years</p>
                    <p className="text-sm">**Gender:** {studentData.gender}</p>
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
                    <p><strong>Class:</strong> {studentData.class}</p>
                    <p><strong>Academic Year:</strong> {studentData.academicYear}</p>
                    <p><strong>Pupil Type:</strong> {studentData.pupilType}</p>
                    <p><strong>Registration Date:</strong> {studentData.registrationDate}</p>
                </div>

                <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 text-gray-800 pt-4">Parent/Guardian & Contact</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <p><strong>Parent/Guardian Name:</strong> {studentData.parentName || 'N/A'}</p>
                    <p><strong>Phone:</strong> {studentData.parentPhone || 'N/A'}</p>
                    <p className="col-span-2"><strong>Address Line 1:</strong> {studentData.addressLine1 || 'N/A'}</p>
                    <p className="col-span-2"><strong>Address Line 2:</strong> {studentData.addressLine2 || 'N/A'}</p>
                </div>

                <h2 className="text-lg font-semibold border-b border-gray-300 pb-1 text-gray-800 pt-4">System Information</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <p><strong>School ID:</strong> {studentData.schoolId}</p>
                    <p><strong>Registered By:</strong> {studentData.registeredBy || 'N/A'}</p>
                </div>
            </section>

            <footer className="mt-12 pt-6 border-t border-gray-400 text-sm text-gray-600">
                <p>Guardian Signature: _________________________</p>
                <p className="mt-4">Registrar Signature: _________________________</p>
            </footer>
        </div>
    );
};

export default PrintableStudentForm;