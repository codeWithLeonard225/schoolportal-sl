import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
// Since this is a single file demo, we use mock data instead of Firestore imports.

// --- MOCK DATA & CONFIGURATION ---
const MOCK_SCHOOL_ID = "SCHOOL_001";
const MOCK_SCHOOL_NAME = "Apex International Academy";
const MOCK_SCHOOL_LOGO = "https://placehold.co/200x200/ffffff/4F46E5?text=LOGO"; // School Logo URL Mock

const MOCK_STUDENTS = [
    { studentID: "AID001", studentName: "Aisha Mohammed", class: "JSS 1", academicYear: "2024/2025", dob: "2010-05-15", age: 15, gender: "Female", parentPhone: "555-1234", userPhoto: "https://placehold.co/100x120/10B981/ffffff?text=AISHA" },
    { studentID: "BID002", studentName: "Blessing Adebayo", class: "Primary 5", academicYear: "2023/2024", dob: "2012-03-20", age: 13, gender: "Female", parentPhone: "555-9012", userPhoto: "https://placehold.co/100x120/6366F1/ffffff?text=BLES" },
    { studentID: "JID003", studentName: "John Okafor", class: "SSS 3", academicYear: "2024/2025", dob: "2008-11-01", age: 17, gender: "Male", parentPhone: "555-5678", userPhoto: "https://placehold.co/100x120/3B82F6/ffffff?text=JOHN" },
    { studentID: "CID004", studentName: "Chinedu Eze", class: "JSS 3", academicYear: "2024/2025", dob: "2009-08-22", age: 16, gender: "Male", parentPhone: "555-3333" },
];
// --- MOCK HOOKS ---
const useAuth = () => ({ 
    user: { 
        schoolId: MOCK_SCHOOL_ID,
        schoolName: MOCK_SCHOOL_NAME 
    } 
});

const toast = {
    warn: (msg) => console.warn(`Toast: ${msg}`),
    error: (msg) => console.error(`Toast: ${msg}`),
    info: (msg) => console.log(`Toast: ${msg}`),
};
// --------------------


// --- ID Card Dimensions (Standard CR80 size ratio, scaled for display) ---
const CARD_WIDTH = '4in'; // Approx 336px in standard Tailwind scale
const CARD_HEIGHT = '2.125in'; // Approx 180px

// --- ID Card Component ---
const IDCard = React.forwardRef(({ student, schoolName }, ref) => {
    if (!student) return (
        <div className="text-center p-8 text-gray-500 bg-white rounded-xl shadow-inner border border-dashed border-gray-300">
            <p className="font-semibold">ID Card Preview Area</p>
            <p className="text-sm mt-1">Select a student above to generate the card.</p>
        </div>
    );

    const photoUrl = student.userPhoto || "https://placehold.co/100x120/9CA3AF/ffffff?text=PHOTO";

    const issueDate = new Date().toISOString().slice(0, 10);
    const expiryDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10);

    return (
        <div 
            ref={ref} 
            className="flex flex-col space-y-4 print:space-y-0 print:block"
        >
            {/* 1. FRONT SIDE of ID Card */}
            <div 
                className="bg-gradient-to-br from-indigo-600 to-purple-800 text-white rounded-xl shadow-2xl p-3 flex print:shadow-none relative overflow-hidden" // Added relative and overflow-hidden
                style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
                data-testid="id-card-front"
            >
                {/* ⭐️ NEW: Faded School Logo Watermark (Absolute position, low opacity) */}
                <div 
                    className="absolute inset-0 flex items-center justify-center opacity-10" 
                >
                    <img 
                        src={MOCK_SCHOOL_LOGO} 
                        alt="School Logo Watermark" 
                        // Ensures the logo is centered and scales within the card
                        className="w-4/5 h-4/5 object-contain" 
                    />
                </div>
                
                {/* Content Layer (z-10 needed to ensure content is above the watermark) */}
                <div className="flex w-full relative z-10">
                    {/* Photo Column */}
                    <div className="w-1/3 flex flex-col items-center justify-center p-1">
                        <img
                            src={photoUrl}
                            alt={`${student.studentName} photo`}
                            className="w-20 h-24 object-cover border-2 border-white rounded-lg shadow-md"
                        />
                    </div>

                    {/* Details Column */}
                    <div className="w-2/3 pl-3">
                        <h2 className="text-sm font-bold truncate mb-1">
                            {schoolName.toUpperCase()}
                        </h2>
                        <div className="border-b border-white opacity-50 mb-1"></div>

                        <div className="text-xs space-y-0.5">
                            <p className="font-extrabold text-lg leading-tight truncate">{student.studentName}</p>
                            
                            <p className="font-semibold mt-1">
                                ID: <span className="font-normal">{student.studentID}</span>
                            </p>
                            <p className="font-semibold">
                                Class: <span className="font-normal">{student.class}</span>
                            </p>
                            <p className="font-semibold">
                                DOB: <span className="font-normal">{student.dob || 'N/A'}</span>
                            </p>
                        </div>

                        <div className="text-xxs mt-2 pt-1 border-t border-white opacity-30">
                            <p>Issued: {issueDate}</p>
                            <p>Expires: {expiryDate}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. BACK SIDE of ID Card (For Print) */}
            <div 
                className="bg-gray-100 text-gray-800 rounded-xl shadow-2xl p-3 flex flex-col justify-between mt-4 print:mt-0 print:shadow-none"
                style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
                data-testid="id-card-back"
            >
                <div className="text-center">
                    <p className="font-bold text-sm mb-1">{schoolName}</p>
                    <p className="text-xs">
                        If found, please return to the school administration office.
                    </p>
                    <p className="text-xs font-semibold mt-1">
                        Parent Contact: {student.parentPhone || 'N/A'}
                    </p>
                </div>
                
                <div className="flex justify-between items-end text-xs pt-2 border-t border-gray-300">
                    <div>
                        <div className="w-24 h-1 border-b border-gray-600 mb-1"></div>
                        <p className="text-xs">Principal's Signature</p>
                    </div>
                    <div>
                        <div className="w-24 h-1 border-b border-gray-600 mb-1"></div>
                        <p className="text-xs">Student's Signature</p>
                    </div>
                </div>
            </div>
        </div>
    );
});


const StudentIDCardPage = () => {
    const { user } = useAuth();
    const currentSchoolId = user?.schoolId || "N/A";
    const schoolName = user?.schoolName || "School Administration";

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStudentId, setSelectedStudentId] = useState("");

    const cardRef = useRef(null);

    // 🚨 MOCK FETCH: Simulate fetching students from the database
    useEffect(() => {
        if (!currentSchoolId || currentSchoolId === "N/A") {
            setLoading(false);
            return;
        }

        // Simulate a network delay
        setTimeout(() => {
            const data = MOCK_STUDENTS.sort((a, b) => a.studentName?.localeCompare(b.studentName));
            setStudents(data);
            setLoading(false);
        }, 800);

    }, [currentSchoolId]);

    // Derived state for the currently selected student object
    const selectedStudent = useMemo(() => {
        return students.find(s => s.studentID === selectedStudentId);
    }, [students, selectedStudentId]);


    // Print function
    const handlePrint = useCallback(() => {
        if (!selectedStudent || !cardRef.current) {
            toast.warn("Please select a student before printing.");
            return;
        }

        const printContent = cardRef.current;
        // Use window.open for a custom print window
        const WinPrint = window.open("", "", "width=800,height=600");
        
        // Write the HTML structure for printing
        WinPrint.document.write(`
            <html>
                <head>
                    <title>${selectedStudent.studentName} ID Card</title>
                    <style>
                        /* Only include necessary print styles */
                        @media print {
                            @page {
                                size: ${CARD_WIDTH} ${CARD_HEIGHT}; /* Set page size to card size */
                                margin: 0.2in;
                            }
                            body {
                                margin: 0;
                                padding: 0;
                                display: flex;
                                flex-direction: column;
                                align-items: flex-start;
                                justify-content: flex-start;
                                font-family: sans-serif;
                            }
                            /* Ensure card sections print correctly */
                            [data-testid="id-card-front"], [data-testid="id-card-back"] {
                                transform: scale(1); 
                                margin-bottom: 0.5in; 
                                box-shadow: none !important; 
                                page-break-after: avoid;
                            }
                        }
                    </style>
                     <script src="https://cdn.tailwindcss.com"></script>
                </head>
                <body>
                    ${printContent.innerHTML}
                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                            }, 500); 
                        }
                    </script>
                </body>
            </html>
        `);
        WinPrint.document.close();
    }, [selectedStudent]);


    return (
        <div className="p-6 min-h-screen bg-gray-100 flex flex-col items-center font-sans">
            <h1 className="text-3xl font-extrabold mb-8 text-center text-gray-800">
                Generate Student ID Card Demo 💳
            </h1>

            {/* Selector and Control Panel */}
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-2xl mb-8">
                <label className="block mb-2 font-semibold text-gray-700">
                    Select Student ({students.length} found)
                </label>
                <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    disabled={loading || students.length === 0}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 mb-4"
                >
                    <option value="">
                        {loading ? "Loading students..." : "--- Select a Student ---"}
                    </option>
                    {students.map((s) => (
                        <option key={s.studentID} value={s.studentID}>
                            {s.studentName} ({s.class})
                        </option>
                    ))}
                </select>

                <button
                    onClick={handlePrint}
                    disabled={!selectedStudent}
                    className={`w-full py-3 rounded-lg font-semibold transition shadow-md ${
                        selectedStudent
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    }`}
                >
                    🖨️ Print ID Card
                </button>
            </div>

            {/* ID Card Preview */}
            <div className="mt-4 p-8 bg-gray-200 rounded-2xl shadow-inner flex justify-center w-full max-w-4xl">
                <IDCard 
                    student={selectedStudent} 
                    schoolName={schoolName} 
                    ref={cardRef} 
                />
            </div>

            <p className="text-sm text-gray-500 mt-4">
                The print function will open a new window formatted for printing, showing both the front and back of the ID card.
            </p>
        </div>
    );
};

// Main App component to render the demo
// Main App component to render the demo
export default function App() {
    return <StudentIDCardPage />;
}