import React, { useState, useCallback, useRef } from "react";
// Using react-icons/fa for the print icon
import { FaPrint } from "react-icons/fa"; 

// --- MOCK DATA ---
const MOCK_SCHOOL_NAME = "ACME High School";
// Mock school logo used for the header and watermark
const MOCK_LOGO_URL = "https://placehold.co/150x150/ffffff/4f46e5?text=LOGO"; 

const MOCK_STUDENTS = [
    {
        id: "s1",
        studentID: "2024001",
        studentName: "Alex Johnson",
        class: "Year 10",
        academicYear: "2024/2025",
        dob: "15/05/2008",
        pupilType: "Day Student",
        parentName: "Sarah Johnson",
        parentPhone: "555-1234",
        userPublicId: "general/PupilPhotos/alex_photo", // Mock Cloudinary ID
    },
    {
        id: "s2",
        studentID: "2024002",
        studentName: "Maria Garcia",
        class: "Year 12",
        academicYear: "2024/2025",
        dob: "01/10/2006",
        pupilType: "Boarding",
        parentName: "Robert Garcia",
        parentPhone: "555-5678",
        userPublicId: null, // Student with no photo
    },
    {
        id: "s3",
        studentID: "2024003",
        studentName: "Ben K. Lee",
        class: "Year 9",
        academicYear: "2023/2024",
        dob: "22/11/2009",
        pupilType: "Day Student",
        parentName: "Mr. Lee",
        parentPhone: "555-9012",
        userPublicId: "general/PupilPhotos/ben_photo",
    },
];

// ----------------------------------------------------------------------
// Mock Image URL Generator 
// ----------------------------------------------------------------------
const getImageUrl = (publicId, transformation = "c_fill,h_150,w_150") => {
    if (!publicId) return null;
    const CLOUDINARY_CLOUD_NAME = "YOUR_CLOUDINARY_CLOUD_NAME"; 
    // If the mock name is still present, return a placeholder for simulation
    if (CLOUDINARY_CLOUD_NAME === "YOUR_CLOUDINARY_CLOUD_NAME") {
        return "https://placehold.co/96x96/6366f1/ffffff?text=STUDENT+IMAGE";
    }

    const CLOUDINARY_BASE_URL = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/`;
    return `${CLOUDINARY_BASE_URL}${transformation}/${publicId}`;
};

// Helper for detail rows
const DetailRow = ({ label, value }) => (
    <div className="flex justify-between border-b border-gray-200 pb-1">
        <span className="text-xs font-medium text-gray-500">{label}:</span>
        <span className="text-sm font-semibold truncate">{value || 'N/A'}</span>
    </div>
);

// ----------------------------------------------------------------------
// ID Card Component (Design) 
// ----------------------------------------------------------------------
const StudentIDCard = React.forwardRef(({ student, schoolName }, ref) => {
    if (!student.studentID) {
        return (
            <div className="text-center p-8 text-gray-500">
                Please select a student to generate the ID card.
            </div>
        );
    }

    const photoUrl = student.userPublicId 
        ? getImageUrl(student.userPublicId) 
        : null;

    return (
        <div ref={ref} className="relative w-[300px] h-[480px] bg-white rounded-xl shadow-2xl overflow-hidden transform transition-all duration-300 hover:scale-[1.02] border-4 border-indigo-600 print:shadow-none print:border-0 print:m-0 print:p-0 print:w-[85mm] print:h-[54mm]">
            
            {/* Faded Background Logo Watermark */}
            <div 
                className="absolute inset-0 z-0 opacity-10 flex items-center justify-center"
                style={{
                    backgroundImage: `url(${MOCK_LOGO_URL})`,
                    backgroundSize: '80%',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                }}
            ></div>

            {/* Content Container (z-index 10 to ensure it sits above the watermark) */}
            <div className="relative z-10 w-full h-full flex flex-col justify-between">
                
                {/* Card Header (Now includes the logo) */}
                <div className="bg-indigo-600 text-white p-3 flex flex-col items-center">
                    
                    {/* Container for Logo and School Name */}
                    <div className="flex items-center space-x-2 w-full justify-center">
                        <img 
                            src={MOCK_LOGO_URL} 
                            alt="School Logo" 
                            className="w-8 h-8 rounded-full bg-white p-1"
                        />
                        <h3 className="text-lg font-extrabold tracking-wide uppercase truncate max-w-[200px]">
                            {schoolName || "School Name"}
                        </h3>
                    </div>

                    <p className="text-xs mt-1 border-t border-indigo-400 pt-1 w-full text-center">STUDENT IDENTIFICATION CARD</p>
                </div>

                {/* Photo Section */}
                <div className="p-4 flex flex-col items-center">
                    <div className="w-24 h-24 bg-gray-200 rounded-full border-4 border-white shadow-lg overflow-hidden relative">
                        {photoUrl ? (
                            <img 
                                src={photoUrl} 
                                alt={student.studentName} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.target.onerror = null; 
                                    e.target.src = "https://placehold.co/96x96/6366f1/ffffff?text=STUDENT";
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-indigo-600 text-xs font-bold bg-indigo-100">
                                No Photo
                            </div>
                        )}
                    </div>
                </div>

                {/* Student Details */}
                <div className="p-4 pt-0 text-gray-800 space-y-2 flex-grow">
                    <div className="text-center mb-4">
                        <h4 className="text-xl font-bold uppercase truncate">{student.studentName}</h4>
                        <p className="text-sm font-medium text-indigo-700">ID: {student.studentID}</p>
                    </div>

                    <DetailRow label="Class" value={student.class} />
                    <DetailRow label="Year" value={student.academicYear} />
                    <DetailRow label="DOB" value={student.dob} />
                    <DetailRow label="Pupil Type" value={student.pupilType} />
                </div>
                
                {/* Footer / Contact */}
                <div className="p-2 bg-gray-100 text-xs text-center text-gray-600">
                    <p className="font-semibold">Parent: {student.parentName}</p>
                    <p>Tel: {student.parentPhone}</p>
                </div>
            </div>
        </div>
    );
});


// ----------------------------------------------------------------------
// Main App Component (Demo Setup)
// ----------------------------------------------------------------------
const StudentIDCards3 = () => {
    // Mocked values for the demo
    const schoolName = MOCK_SCHOOL_NAME; 
    const students = MOCK_STUDENTS;

    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [selectedStudent, setSelectedStudent] = useState({});

    const cardRef = useRef(null);

    // --- Update Selected Student on Dropdown Change ---
    const handleStudentChange = useCallback((e) => {
        const studentId = e.target.value;
        setSelectedStudentId(studentId);
        
        const student = students.find(s => s.id === studentId) || {};
        setSelectedStudent(student);
    }, [students]);

    // --- Print Function ---
    const handlePrint = () => {
        if (!selectedStudent.studentID) {
            // Using a custom message box or alert for simplicity in this demo function, though toast is preferred
            alert("Please select a student before printing."); 
            return;
        }
        
        // This targets only the ID card div for printing
        const cardElement = cardRef.current;
        if (cardElement) {
            const printContent = cardElement.outerHTML;

            // Prepare temporary print styles to ensure only the card prints correctly
            const printWindow = window.open('', '', 'width=85mm,height=54mm');
            printWindow.document.write(`
                <html>
                <head>
                    <title>${selectedStudent.studentName} ID Card</title>
                    <style>
                        /* Set page size to credit card size (85.6mm x 53.98mm) */
                        @page { 
                            size: 85mm 54mm; 
                            margin: 0;
                        }
                        body { 
                            margin: 0; 
                            padding: 0; 
                            width: 100%; 
                            height: 100%; 
                            display: flex;
                            justify-content: center;
                            align-items: center;
                        }
                        /* Ensure the card element fills the print area */
                        .print-card-container {
                            width: 85mm;
                            height: 54mm;
                            overflow: hidden;
                        }
                        /* Mimic necessary Tailwind layout/colors for print */
                        .bg-indigo-600 { background-color: #4f46e5 !important; }
                        .text-white { color: #ffffff !important; }
                        .p-3 { padding: 0.75rem !important; }
                        .flex { display: flex !important; }
                        .flex-col { flex-direction: column !important; }
                        .items-center { align-items: center !important; }
                        .text-lg { font-size: 1.125rem !important; }
                        .font-extrabold { font-weight: 800 !important; }
                        /* Custom styles for the ID Card's internal structure (ensures small print size) */
                        .w-\\[300px\\] { width: 85mm !important; }
                        .h-\\[480px\\] { height: 54mm !important; }

                        /* Ensure watermark shows in print */
                        @media print {
                            .absolute { position: absolute; }
                            .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
                            .z-0 { z-index: 0; }
                            .z-10 { z-index: 10; }
                            .opacity-10 { opacity: 0.1; }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-card-container">
                        ${printContent}
                    </div>
                    <script>
                        // window.print(); // Commented out to prevent automatic print dialog in demo
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        }
    };


    return (
        <div className="p-6 min-h-screen bg-gray-100 flex flex-col items-center">
            <h1 className="text-3xl font-bold mb-8 text-center text-indigo-700">
                Student ID Card Generator Demo
            </h1>

            {/* Controls */}
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-xl mb-8">
                <label htmlFor="student-select" className="block mb-2 text-lg font-semibold text-gray-700">
                    Select Student:
                </label>
                <select
                    id="student-select"
                    value={selectedStudentId}
                    onChange={handleStudentChange}
                    className="w-full p-3 border border-gray-300 rounded-lg text-lg focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                    disabled={students.length === 0}
                >
                    <option value="">--- Select a Student ---</option>
                    {students.map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.studentName} (ID: {s.studentID})
                        </option>
                    ))}
                </select>

                <button
                    onClick={handlePrint}
                    className="mt-6 w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:bg-gray-400"
                    disabled={!selectedStudent.studentID}
                >
                    <FaPrint size={20} />
                    <span>Generate & Print ID Card</span>
                </button>
                <p className="mt-3 text-sm text-gray-500 text-center">
                    (This demo uses **mock data** and a **mock logo**.)
                </p>
            </div>

            {/* ID Card Preview */}
            <div className="mt-8">
                <StudentIDCard 
                    ref={cardRef} 
                    student={selectedStudent} 
                    schoolName={schoolName}
                />
            </div>
        </div>
    );
};

export default StudentIDCards3;