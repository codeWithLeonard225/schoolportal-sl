import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
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

const PupilIDCard = () => {
    const location = useLocation();
    const {
        schoolId,
        schoolName,
        schoolLogoUrl,
        schoolAddress,
        schoolMotto,
        schoolContact,
    } = location.state || {};

    const { user } = useAuth();
    const currentSchoolId = schoolId || user?.schoolId || "";
    const [pupils, setPupils] = useState([]);
    const [selectedClass, setSelectedClass] = useState("All");
    const [selectedAcademicYear, setSelectedAcademicYear] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);

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

    // Extract unique classes and academic years for dropdown filters
    const classOptions = ["All", ...new Set(pupils.map(p => p.class).filter(Boolean))];
    const academicYearOptions = ["All", ...new Set(pupils.map(p => p.academicYear).filter(Boolean))];

    // Filter pupils by both class and academicYear
    const filteredPupils = pupils.filter(p => {
        const matchesClass = selectedClass === "All" || p.class === selectedClass;
        const matchesYear = selectedAcademicYear === "All" || p.academicYear === selectedAcademicYear;
        return matchesClass && matchesYear;
    });

    const totalPages = Math.ceil(filteredPupils.length / CARDS_PER_BROWSER_PAGE) || 1;
    const startIndex = (currentPage - 1) * CARDS_PER_BROWSER_PAGE;
    const visiblePupils = filteredPupils.slice(startIndex, startIndex + CARDS_PER_BROWSER_PAGE);

    const handleNext = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
    const handlePrevious = () => currentPage > 1 && setCurrentPage(currentPage - 1);

    return (
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "#f3f4f6" }}>
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

            {/* Action Bar (Hidden when printing) */}
            <div className="print:hidden" style={{ width: "100%", maxWidth: "800px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
                <h2 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>Pupil & Staff ID Cards</h2>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    {/* Class Filter Dropdown */}
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <label style={{ fontSize: "14px", fontWeight: "600" }}>Class:</label>
                        <select 
                            value={selectedClass} 
                            onChange={(e) => {
                                setSelectedClass(e.target.value);
                                setCurrentPage(1);
                            }}
                            style={{ padding: "6px 12px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff" }}
                        >
                            {classOptions.map((cls) => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>

                    {/* Academic Year Filter Dropdown */}
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <label style={{ fontSize: "14px", fontWeight: "600" }}>Year:</label>
                        <select 
                            value={selectedAcademicYear} 
                            onChange={(e) => {
                                setSelectedAcademicYear(e.target.value);
                                setCurrentPage(1);
                            }}
                            style={{ padding: "6px 12px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff" }}
                        >
                            {academicYearOptions.map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    <button 
                        onClick={() => window.print()} 
                        style={{ padding: "8px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: "600" }}
                    >
                        <FaPrint /> Print Page ({currentPage})
                    </button>
                </div>
            </div>

            {/* Pagination controls (Hidden when printing) */}
            {totalPages > 1 && (
                <div className="print:hidden" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
                    <button
                        onClick={handlePrevious}
                        disabled={currentPage === 1}
                        style={{ padding: "6px 12px", background: "#d1d5db", color: "#1f2937", border: "none", borderRadius: "6px", cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.5 : 1, display: "flex", alignItems: "center", gap: "5px" }}
                    >
                        <FaArrowLeft size={12} /> Previous
                    </button>
                    <span style={{ fontSize: "14px", fontWeight: "600" }}>
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={handleNext}
                        disabled={currentPage === totalPages}
                        style={{ padding: "6px 12px", background: "#d1d5db", color: "#1f2937", border: "none", borderRadius: "6px", cursor: currentPage === totalPages ? "not-allowed" : "pointer", opacity: currentPage === totalPages ? 0.5 : 1, display: "flex", alignItems: "center", gap: "5px" }}
                    >
                        Next <FaArrowRight size={12} />
                    </button>
                </div>
            )}

            {/* ID Cards Grid */}
            <div 
                className="grid" 
                style={{ 
                    display: "grid", 
                    gridTemplateColumns: `repeat(${CARDS_PER_ROW}, ${CARD_WIDTH})`, 
                    gap: GAP_BETWEEN_CARDS, 
                    justifyContent: "center",
                    width: "100%",
                    maxWidth: "800px"
                }}
            >
                {visiblePupils.length > 0 ? (
                    visiblePupils.map((pupil) => (
                        <div 
                            key={pupil.id} 
                            style={{
                                width: CARD_WIDTH,
                                height: CARD_HEIGHT,
                                border: "1px solid #1a252f",
                                borderRadius: "8px",
                                padding: "8px 10px",
                                boxSizing: "border-box",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                backgroundColor: "#ffffff",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                                pageBreakInside: "avoid"
                            }}
                        >
                            {/* Header: School Logo, Name & Address */}
                            <div style={{ borderBottom: "1px solid #007bff", paddingBottom: "3px", display: "flex", alignItems: "center", gap: "6px" }}>
                                {schoolLogoUrl && (
                                    <img 
                                        src={schoolLogoUrl} 
                                        alt="School Logo" 
                                        style={{ width: "26px", height: "26px", objectFit: "contain", borderRadius: "3px" }} 
                                    />
                                )}
                                <div style={{ flex: 1, overflow: "hidden", lineHeight: "1.1" }}>
                                    <div style={{ fontWeight: "bold", fontSize: "10px", color: "#007bff", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {schoolName || "STUDENT ID CARD"}
                                    </div>
                                    {schoolAddress && (
                                        <div style={{ fontSize: "7px", color: "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {schoolAddress}
                                        </div>
                                    )}
                                </div>
                                <span style={{ fontSize: "9px", fontWeight: "600", color: "#444", whiteSpace: "nowrap" }}>
                                    {pupil.academicYear || ""}
                                </span>
                            </div>

                            {/* Card Body */}
                            <div style={{ display: "flex", gap: "8px", alignItems: "center", margin: "4px 0" }}>
                                <img 
                                    src={pupil.userPhotoUrl || "https://via.placeholder.com/80"} 
                                    alt={pupil.studentName} 
                                    style={{ width: "65px", height: "65px", borderRadius: "5px", objectFit: "cover", border: "1px solid #ccc" }}
                                />
                                <div style={{ fontSize: "10px", lineHeight: "1.3", flex: 1, overflow: "hidden" }}>
                                    <div style={{ fontWeight: "bold", fontSize: "11px", color: "#2c3e50", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {pupil.studentName}
                                    </div>
                                    <div><strong>ID:</strong> {pupil.studentID}</div>
                                    <div><strong>Class:</strong> {pupil.class}</div>
                                    <div><strong>Type:</strong> {pupil.pupilType || "Pupil"}</div>
                                </div>
                            </div>

                            {/* Card Footer: Motto, Contact & Unchanged QRCodeSVG */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "1px solid #eee", paddingTop: "3px" }}>
                                <div style={{ fontSize: "7px", color: "#666", lineHeight: "1.1", maxWidth: "68%", overflow: "hidden" }}>
                                    {schoolMotto && <div style={{ fontStyle: "italic", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>"{schoolMotto}"</div>}
                                    {schoolContact && <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Tel: {schoolContact}</div>}
                                    {!schoolMotto && !schoolContact && <div>Official School Pass</div>}
                                </div>
                                <div style={{ background: "#fff", padding: "1px" }}>
                                    <QRCodeSVG 
                                        value={pupil.studentID} 
                                        size={52}
                                        level="M"
                                        includeMargin={false}
                                    />
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#6b7280", padding: "40px" }}>
                        No pupils found for the selected filters.
                    </div>
                )}
            </div>
        </div>
    );
};

export default PupilIDCard;