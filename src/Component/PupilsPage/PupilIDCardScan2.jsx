import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../Security/AuthContext";
import { FaArrowLeft, FaArrowRight, FaPrint } from "react-icons/fa";

// ---- CARD DIMENSIONS ----
const CARD_WIDTH = "3.55in";
const CARD_HEIGHT = "2.25in";
const GAP_BETWEEN_CARDS = "0.35in";
const CARDS_PER_ROW = 2;
const ROWS_PER_PAGE = 4;
const CARDS_PER_BROWSER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE;

// ---- PUPIL ID CARD COMPONENT ----
const SinglePupilIDCard = ({ pupil, schoolInfo }) => {
    const qrPayload = JSON.stringify({
        studentID: pupil.studentID,
        studentName: pupil.studentName,
        schoolId: pupil.schoolId
    });

    return (
        <div
            className="shadow-md border rounded-lg flex flex-col justify-between overflow-hidden"
            style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                background: "white",
                boxSizing: "border-box",
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between border-b px-2"
                style={{
                    background: "linear-gradient(90deg, #007bff, #0056b3)",
                    color: "white",
                    padding: "4px 8px",
                }}
            >
                <span className="text-[8.5pt] font-bold uppercase tracking-wider">
                    Official Student ID Card
                </span>
                <span className="text-[7.5pt] opacity-90">
                    ID: {pupil.studentID || "N/A"}
                </span>
            </div>

            {/* Body */}
            <div
                className="flex gap-[8px] items-center flex-1 px-[10px] py-[4px]"
                style={{
                    background: "linear-gradient(180deg, #F8FAFC, #EFF6FF)",
                    color: "#1e293b",
                }}
            >
                <div className="w-[0.9in] h-[1.15in] bg-gray-200 rounded-sm overflow-hidden border flex-shrink-0">
                    {pupil.userPhotoUrl ? (
                        <img
                            src={pupil.userPhotoUrl}
                            alt={pupil.studentName}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-[7pt] text-gray-400">
                            No Photo
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col justify-center text-[7.8pt] font-medium leading-[1.4]">
                    <h3 className="text-[9.5pt] font-bold text-gray-900 truncate mb-[2px]">
                        {pupil.studentName}
                    </h3>
                    <p className="text-gray-600">
                        <strong className="text-blue-900">Class:</strong> {pupil.class || "N/A"}
                    </p>
                    <p className="text-gray-600 truncate">
                        <strong className="text-blue-900">Type:</strong> {pupil.pupilType || "Pupil"}
                    </p>
                    <p className="text-blue-600 font-semibold mt-[2px] truncate">
                        Year: {pupil.academicYear || "N/A"}
                    </p>
                </div>

                <div className="flex flex-col items-center justify-center bg-white p-1 rounded border shadow-2xs flex-shrink-0">
                    <QRCodeSVG value={qrPayload} size={55} />
                    <span className="text-[6pt] text-gray-500 mt-[1px]">Scan</span>
                </div>
            </div>

            {/* Footer */}
            <div
                className="flex justify-between items-center border-t px-2"
                style={{
                    background: "#0056b3",
                    color: "white",
                    fontSize: "6.5pt",
                    padding: "2px 8px",
                }}
            >
                <span>Contact: {schoolInfo.schoolContact || "N/A"}</span>
                <span className="font-semibold">{schoolInfo.schoolName || "School Pass"}</span>
            </div>
        </div>
    );
};

// ---- MAIN PAGE COMPONENT ----
const PupilIDCard = () => {
    const { user } = useAuth();
    const currentSchoolId = user?.schoolId || "";
    
    const [pupils, setPupils] = useState([]);
    const [selectedClass, setSelectedClass] = useState("All");
    const [selectedYear, setSelectedYear] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);

    const schoolInfo = {
        schoolName: user?.schoolName || "School System",
        schoolContact: user?.schoolContact || "",
    };

    useEffect(() => {
        if (!currentSchoolId) return;
        const q = query(
            collection(db, "PupilsReg"),
            where("schoolId", "==", currentSchoolId)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPupils(data);
        });
        return () => unsubscribe();
    }, [currentSchoolId]);

    // ---- FILTERS ----
    const filteredPupils = pupils.filter((p) => {
        const classMatch = selectedClass === "All" || p.class === selectedClass;
        const yearMatch = selectedYear === "All" || p.academicYear === selectedYear;
        return classMatch && yearMatch;
    });

    const classOptions = ["All", ...new Set(pupils.map((p) => p.class).filter(Boolean))];
    const yearOptions = ["All", ...new Set(pupils.map((p) => p.academicYear).filter(Boolean))];

    const totalPages = Math.ceil(filteredPupils.length / CARDS_PER_BROWSER_PAGE) || 1;
    const startIndex = (currentPage - 1) * CARDS_PER_BROWSER_PAGE;
    const visiblePupils = filteredPupils.slice(startIndex, startIndex + CARDS_PER_BROWSER_PAGE);

    const handleNext = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
    const handlePrevious = () => currentPage > 1 && setCurrentPage(currentPage - 1);

    return (
        <div className="p-6 bg-gray-100 min-h-screen overflow-x-hidden flex flex-col items-center">
            {/* Controls */}
            <div className="w-full max-w-4xl print:hidden mb-6">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <h1 className="text-xl font-bold">Pupil ID Cards & QR Codes</h1>
                    <button
                        onClick={() => window.print()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-semibold"
                    >
                        <FaPrint /> Print Current Page ({currentPage})
                    </button>
                </div>

                {/* Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-4 mb-4 justify-center">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold">Class:</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => {
                                setSelectedClass(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="p-2 border rounded-lg bg-white"
                        >
                            {classOptions.map((cls) => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold">Academic Year:</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => {
                                setSelectedYear(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="p-2 border rounded-lg bg-white"
                        >
                            {yearOptions.map((yr) => (
                                <option key={yr} value={yr}>{yr}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-4">
                        <button
                            onClick={handlePrevious}
                            disabled={currentPage === 1}
                            className="bg-gray-300 text-gray-800 px-3 py-1 rounded-lg disabled:opacity-50 flex items-center gap-1 text-sm font-semibold"
                        >
                            <FaArrowLeft size={12} /> Previous
                        </button>
                        <span className="text-sm font-semibold">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button
                            onClick={handleNext}
                            disabled={currentPage === totalPages}
                            className="bg-gray-300 text-gray-800 px-3 py-1 rounded-lg disabled:opacity-50 flex items-center gap-1 text-sm font-semibold"
                        >
                            Next <FaArrowRight size={12} />
                        </button>
                    </div>
                )}
            </div>

            {/* CARDS GRID */}
            <div
                className="grid gap-[0.35in] justify-center w-full max-w-4xl"
                style={{
                    gridTemplateColumns: `repeat(${CARDS_PER_ROW}, ${CARD_WIDTH})`,
                }}
            >
                {visiblePupils.length > 0 ? (
                    visiblePupils.map((pupil) => (
                        <SinglePupilIDCard
                            key={pupil.id}
                            pupil={pupil}
                            schoolInfo={schoolInfo}
                        />
                    ))
                ) : (
                    <div className="col-span-full text-center text-gray-500 py-10">
                        No pupils found matching the selected filters.
                    </div>
                )}
            </div>

            {/* STRICT PRINT CSS TO HIDE LAYOUT/SIDEBAR ELEMENTS */}
            <style>
                {`
                    @media print {
                        body * {
                            visibility: hidden !important;
                        }

                        .grid, .grid * {
                            visibility: visible !important;
                        }

                        .grid {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            display: grid !important;
                            grid-template-columns: repeat(${CARDS_PER_ROW}, ${CARD_WIDTH}) !important;
                            gap: ${GAP_BETWEEN_CARDS} !important;
                            justify-content: center !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }

                        .print\\:hidden { 
                            display: none !important; 
                        }

                        @page { 
                            size: A4 portrait; 
                            margin: 0.4in; 
                        }

                        body {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            margin: 0 !important;
                            background: white !important;
                            overflow: visible !important;
                        }
                    }
                `}
            </style>
        </div>
    );
};

export default PupilIDCard;