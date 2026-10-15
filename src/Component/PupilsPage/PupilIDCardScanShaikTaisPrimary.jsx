import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../Security/AuthContext";
import { FaPrint, FaCheckSquare, FaSquare, FaSearch, FaTimes, FaCheck } from "react-icons/fa";

// ---- CARD DIMENSIONS ----
const CARD_WIDTH = "3.55in";
const CARD_HEIGHT = "2.25in";
const GAP_BETWEEN_CARDS = "0.35in";
const CARDS_PER_ROW = 2;

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
    const [searchQuery, setSearchQuery] = useState("");
    
    // Track selected pupil IDs (Deselected by default)
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
        });
        return () => unsubscribe();
    }, [currentSchoolId]);

    // Reset selected pupils ONLY when class changes
    const handleClassChange = (e) => {
        setSelectedClass(e.target.value);
        setSelectedPupilIds([]);
    };

    const classOptions = ["All", ...new Set(pupils.map(p => p.class).filter(Boolean))];
    const academicYearOptions = ["All", ...new Set(pupils.map(p => p.academicYear).filter(Boolean))];

    // Filter pupils by Class, Academic Year, and Name Search
    const filteredPupils = pupils.filter(p => {
        const matchesClass = selectedClass === "All" || p.class === selectedClass;
        const matchesYear = selectedAcademicYear === "All" || p.academicYear === selectedAcademicYear;
        const matchesName = !searchQuery.trim() || 
            (p.studentName && p.studentName.toLowerCase().includes(searchQuery.toLowerCase().trim()));
        
        return matchesClass && matchesYear && matchesName;
    });

    // Toggle individual selection
    const toggleSelectPupil = (id) => {
        setSelectedPupilIds((prev) =>
            prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
        );
    };

    // Select visible cards without losing existing selections from other queries
    const handleSelectAllVisible = () => {
        const visibleIds = filteredPupils.map(p => p.id);
        setSelectedPupilIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    };

    // Deselect only currently visible cards
    const handleDeselectAllVisible = () => {
        const visibleIds = filteredPupils.map(p => p.id);
        setSelectedPupilIds(prev => prev.filter(id => !visibleIds.includes(id)));
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
                            visibility: hidden !important;
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
            <div className="print:hidden" style={{ width: "100%", maxWidth: "850px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
                <h2 style={{ fontSize: "24px", fontWeight: "bold", margin: 0, color: "#1f2937" }}>Pupil & Staff ID Cards</h2>
                
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    {/* Student Name Search Input */}
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <FaSearch style={{ position: "absolute", left: "10px", color: "#9ca3af", fontSize: "12px" }} />
                        <input 
                            type="text"
                            placeholder="Search name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                padding: "6px 28px 6px 30px",
                                borderRadius: "4px",
                                border: "1px solid #ccc",
                                background: "#fff",
                                fontSize: "14px",
                                outline: "none",
                                width: "160px"
                            }}
                        />
                        {searchQuery && (
                            <FaTimes 
                                onClick={() => setSearchQuery("")}
                                style={{ position: "absolute", right: "10px", color: "#9ca3af", cursor: "pointer", fontSize: "12px" }} 
                            />
                        )}
                    </div>

                    {/* Class Filter Dropdown */}
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Class:</label>
                        <select 
                            value={selectedClass} 
                            onChange={handleClassChange}
                            style={{ padding: "6px 12px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff" }}
                        >
                            {classOptions.map((cls) => (
                                <option key={cls} value={cls}>{cls}</option>
                            ))}
                        </select>
                    </div>

                    {/* Academic Year Filter Dropdown */}
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <label style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>Year:</label>
                        <select 
                            value={selectedAcademicYear} 
                            onChange={(e) => setSelectedAcademicYear(e.target.value)}
                            style={{ padding: "6px 12px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff" }}
                        >
                            {academicYearOptions.map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>

                    {/* Print Button */}
                    <button 
                        onClick={() => window.print()} 
                        disabled={selectedPupilIds.length === 0}
                        style={{ 
                            padding: "8px 16px", 
                            background: selectedPupilIds.length > 0 ? "#800000" : "#9ca3af", 
                            color: "#fff", 
                            border: "none", 
                            borderRadius: "6px", 
                            cursor: selectedPupilIds.length > 0 ? "pointer" : "not-allowed", 
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

            {/* Quick Selection Toolbar */}
            <div className="print:hidden" style={{ width: "100%", maxWidth: "850px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", background: "#fff", padding: "10px 15px", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#4b5563" }}>
                    Showing {filteredPupils.length} pupils | <strong style={{ color: "#800000" }}>{selectedPupilIds.length} Total Selected</strong>
                </span>
                <div style={{ display: "flex", gap: "12px" }}>
                    <button 
                        onClick={handleSelectAllVisible}
                        style={{ background: "none", border: "none", color: "#800000", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}
                    >
                        <FaCheckSquare /> Select Visible
                    </button>
                    <button 
                        onClick={handleDeselectAllVisible}
                        style={{ background: "none", border: "none", color: "#6b7280", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}
                    >
                        <FaSquare /> Deselect Visible
                    </button>
                </div>
            </div>

            {/* ID Cards Grid */}
            <div 
                className="grid" 
                style={{ 
                    display: "grid", 
                    gridTemplateColumns: `repeat(${CARDS_PER_ROW}, ${CARD_WIDTH})`, 
                    gap: GAP_BETWEEN_CARDS, 
                    justifyContent: "center",
                    width: "100%",
                    maxWidth: "850px"
                }}
            >
                {filteredPupils.length > 0 ? (
                    filteredPupils.map((pupil) => {
                        const isSelected = selectedPupilIds.includes(pupil.id);

                        return (
                            <div 
                                key={pupil.id} 
                                className={!isSelected ? "print:hidden" : ""}
                                onClick={() => toggleSelectPupil(pupil.id)}
                                style={{
                                    width: CARD_WIDTH,
                                    height: CARD_HEIGHT,
                                    border: isSelected ? "3px solid #800000" : "1px dashed #9ca3af",
                                    borderRadius: "8px",
                                    overflow: "hidden",
                                    boxSizing: "border-box",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    background: isSelected 
                                        ? "linear-gradient(135deg, #fffde7 0%, #fff9c4 100%)" 
                                        : "#ffffff",
                                    boxShadow: isSelected ? "0 4px 12px rgba(128, 0, 0, 0.25)" : "none",
                                    opacity: isSelected ? 1 : 0.55,
                                    pageBreakInside: "avoid",
                                    position: "relative",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease"
                                }}
                            >
                                {/* Selection Badge / Tag */}
                                <div 
                                    className="print:hidden"
                                    style={{
                                        position: "absolute",
                                        top: "4px",
                                        right: "4px",
                                        zIndex: 10,
                                        background: isSelected ? "#16a34a" : "#e5e7eb",
                                        color: isSelected ? "#ffffff" : "#4b5563",
                                        borderRadius: "4px",
                                        padding: "3px 6px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        fontSize: "10px",
                                        fontWeight: "bold",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
                                    }}
                                >
                                    {isSelected ? <><FaCheck size={10} /> Selected</> : "Click to Select"}
                                </div>

                                {/* Header */}
                                <div style={{ 
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
                                        <div style={{ fontSize: "15px" }}><strong>ID:</strong> {pupil.registrationFormNo}</div>
                                        <div style={{ fontSize: "15px" }}><strong>Level:</strong> {formatClassName(pupil.class)}</div>
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
                                    background: "linear-gradient(90deg, #800000 0%, #4a0000 100%)", 
                                    padding: "4px 8px",
                                    minHeight: "36px",
                                    paddingRight: "60px"
                                }}>
                                    <div style={{ fontSize: "10px", color: "#ffd700", lineHeight: "1.1", overflow: "hidden" }}>
                                        {schoolAddress && <div style={{ fontStyle: "italic", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>"{schoolAddress}"</div>}
                                        {schoolContact && <div style={{ whiteSpace: "nowrap", overflow: "hidden", fontWeight: "500", textOverflow: "ellipsis" }}>Tel: {schoolContact}</div>}
                                        {!schoolAddress && !schoolContact && <div>Official School Pass</div>}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "#6b7280", padding: "40px" }}>
                        No pupils found matching your search and filter criteria.
                    </div>
                )}
            </div>
        </div>
    );
};

export default PupilIDCard;