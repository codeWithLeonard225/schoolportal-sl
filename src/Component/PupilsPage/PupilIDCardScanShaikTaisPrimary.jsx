import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../Security/AuthContext";
import { FaArrowLeft, FaArrowRight, FaPrint, FaCheckSquare, FaSquare } from "react-icons/fa";

// ---- CARD DIMENSIONS ----
const CARD_WIDTH = "3.55in";
const CARD_HEIGHT = "2.25in";
const GAP_BETWEEN_CARDS = "0.35in";
const CARDS_PER_ROW = 2;
const ROWS_PER_PAGE = 4;
const CARDS_PER_BROWSER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE;

const formatClassName = (className) => {
    if (!className) return "";
    return className.trim().slice(0, 5);
};

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
    
    // Track selected pupil IDs for selective printing
    const [selectedPupilIds, setSelectedPupilIds] = useState([]);

    useEffect(() => {
        if (!currentSchoolId) return;
        const q = query(
            collection(db, "PupilsReg"),
            where("schoolId", "==", currentSchoolId)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPupils(data);
            // Default selection: select all loaded pupils
            setSelectedPupilIds(data.map(p => p.id));
        });
        return () => unsubscribe();
    }, [currentSchoolId]);

    const classOptions = ["All", ...new Set(pupils.map(p => p.class).filter(Boolean))];
    const academicYearOptions = ["All", ...new Set(pupils.map(p => p.academicYear).filter(Boolean))];

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

    // Toggle individual selection
    const toggleSelectPupil = (id) => {
        setSelectedPupilIds((prev) =>
            prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
        );
    };

    // Toggle all visible pupils on current view
    const isAllVisibleSelected = visiblePupils.length > 0 && visiblePupils.every(p => selectedPupilIds.includes(p.id));
    
    const toggleSelectAllVisible = () => {
        const visibleIds = visiblePupils.map(p => p.id);
        if (isAllVisibleSelected) {
            setSelectedPupilIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedPupilIds(prev => [...new Set([...prev, ...visibleIds])]);
        }
    };

    return (
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh", background: "#f3f4f6" }}>
            {/* STRICT PRINT CSS TO HIDE UNSELECTED CARDS AND INTERFACE */}
            <style>
                {`
                    @media print {
                        body * {
                            visibility: hidden !important;
                        }
                        .printable-card, .printable-card * {
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
                        .unselected-card {
                            display: none !important;
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

            {/* Action Bar */}
            <div className="print:hidden" style={{ width: "100%", maxWidth: "800px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
                <h2 style={{ fontSize: "24px", fontWeight: "bold", margin: 0, color: "#1f2937" }}>Pupil & Staff ID Cards</h2>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    
                    <button
                        onClick={toggleSelectAllVisible}
                        style={{ padding: "6px 12px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: "600" }}
                    >
                        {isAllVisibleSelected ? <FaCheckSquare /> : <FaSquare />}
                        {isAllVisibleSelected ? "Deselect Page" : "Select Page"}
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Class:</label>
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

                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Year:</label>
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
                        disabled={selectedPupilIds.length === 0}
                        style={{ 
                            padding: "8px 16px", 
                            background: selectedPupilIds.length === 0 ? "#9ca3af" : "#800000", 
                            color: "#fff", 
                            border: "none", 
                            borderRadius: "6px", 
                            cursor: selectedPupilIds.length === 0 ? "not-allowed" : "pointer", 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "6px", 
                            fontWeight: "600" 
                        }}
                    >
                        <FaPrint /> Print Selected ({selectedPupilIds.length})
                    </button>
                </div>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
                <div className="print:hidden" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
                    <button
                        onClick={handlePrevious}
                        disabled={currentPage === 1}
                        style={{ padding: "6px 12px", background: "#d1d5db", color: "#1f2937", border: "none", borderRadius: "6px", cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.5 : 1, display: "flex", alignItems: "center", gap: "5px" }}
                    >
                        <FaArrowLeft size={12} /> Previous
                    </button>
                    <span style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>
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
                    visiblePupils.map((pupil) => {
                        const isSelected = selectedPupilIds.includes(pupil.id);
                        return (
                            <div 
                                key={pupil.id} 
                                className={isSelected ? "printable-card" : "unselected-card"}
                                style={{
                                    width: CARD_WIDTH,
                                    height: CARD_HEIGHT,
                                    border: isSelected ? "2px solid #800000" : "1px dashed #9ca3af",
                                    borderRadius: "8px",
                                    overflow: "hidden",
                                    boxSizing: "border-box",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    background: isSelected ? "linear-gradient(135deg, #fffde7 0%, #fff9c4 100%)" : "#f9fafb",
                                    boxShadow: isSelected ? "0 2px 6px rgba(0,0,0,0.12)" : "none",
                                    pageBreakInside: "avoid",
                                    position: "relative",
                                    opacity: isSelected ? 1 : 0.6
                                }}
                            >
                                {/* Checkbox Selector (Hidden on print) */}
                                <div 
                                    className="print:hidden"
                                    onClick={() => toggleSelectPupil(pupil.id)}
                                    style={{
                                        position: "absolute",
                                        top: "4px",
                                        right: "4px",
                                        zIndex: 10,
                                        background: "rgba(255, 255, 255, 0.9)",
                                        borderRadius: "4px",
                                        padding: "2px 4px",
                                        cursor: "pointer",
                                        display: "flex",
                                        alignItems: "center",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                                    }}
                                >
                                    <input 
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {}} // Handled by parent div click
                                        style={{ cursor: "pointer" }}
                                    />
                                </div>

                                {/* Header */}
                                <div style={{ 
                                //   background: "linear-gradient(135deg, #00562d 0%, #007a41 100%)", green
                                   background: "linear-gradient(90deg, #800000 0%, #4a0000 100%)", 
                                    padding: "4px 8px", 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: "6px",
                                    minHeight: "36px"
                                }}>
                                    {schoolLogoUrl && (
                                        <img 
                                            src={schoolLogoUrl} 
                                            alt="School Logo" 
                                            style={{ width: "26px", height: "26px", objectFit: "contain", borderRadius: "3px", background: "#fff", padding: "1px", flexShrink: 0 }} 
                                        />
                                    )}
                                    <div style={{ flex: 1, overflow: "hidden", lineHeight: "1.1" }}>
                                        <div style={{ 
                                            fontWeight: "bold", 
                                            fontSize: "10.5px", 
                                            color: "#ffd700", 
                                            textTransform: "uppercase", 
                                            wordBreak: "break-word",
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden"
                                        }}>
                                            {/* {schoolName || "STUDENT ID CARD"} */}
                                            {"SHEIKH TAIS ACADEMY PRIMARY"}
                                        </div>
                                        {schoolMotto && (
                                            <div style={{ fontSize: "10.5px", color: "#fff59d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {schoolMotto}
                                            </div>
                                        )}
                                    
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "0 8px", margin: "2px 0" }}>
                                    <img 
                                        src={pupil.userPhotoUrl || "https://via.placeholder.com/80"} 
                                        alt={pupil.studentName} 
                                        style={{ width: "100px", height: "100px", borderRadius: "5px", objectFit: "cover", border: "1px solid #800000", flexShrink: 0 }}
                                    />
                                    <div style={{ fontSize: "10px", lineHeight: "1.3", flex: 1, overflow: "hidden", color: "#4a0000" }}>
                                        <div style={{ fontWeight: "bold", fontSize: "15px", color: "#800000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {pupil.studentName}
                                        </div>
                                        <div style={{fontSize: "15px"}}><strong>ID:</strong> {pupil.studentID}</div>
                                        <div style={{fontSize:"15px"}}><strong>Level:</strong> {formatClassName(pupil.class)}</div>
                                    </div>
                                </div>

                                {/* Floating QR Code */}
                                <div style={{ 
                                    position: "absolute",
                                    bottom: "30px",
                                    right: "35px",
                                    background: "#fff", 
                                    padding: "2px", 
                                    borderRadius: "4px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                                    zIndex: 2
                                }}>
                                    <QRCodeSVG 
                                        value={pupil.studentID} 
                                        size={42}
                                        level="M"
                                        includeMargin={false}
                                    />
                                </div>

                                {/* Card Footer */}
                                <div style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    // background: "linear-gradient(135deg, #00562d 0%, #007a41 100%)", green
                                     background: "linear-gradient(90deg, #800000 0%, #4a0000 100%)", 
                                    padding: "4px 8px",
                                    minHeight: "36px",
                                    paddingRight: "60px"
                                }}>
                                    <div style={{ fontSize: "10px", color: "#ffd700", lineHeight: "1.1", overflow: "hidden" }}>
                                        {schoolAddress && <div style={{ fontStyle: "italic", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>"{schoolAddress}"</div>}
                                        {/* {schoolMotto && <div style={{ fontStyle: "italic", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>"{schoolMotto}"</div>} */}
                                        {schoolContact && <div style={{ whiteSpace: "nowrap", overflow: "hidden",fontWeight: "500", textOverflow: "ellipsis" }}>Tel: {schoolContact}</div>}
                                        {!schoolAddress && !schoolContact && <div>Official School Pass</div>}
                                    </div>
                                </div>
                            </div>
                        );
                    })
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