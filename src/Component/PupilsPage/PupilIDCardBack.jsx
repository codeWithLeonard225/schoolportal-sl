import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../Security/AuthContext";
import { FaArrowLeft, FaArrowRight, FaPrint } from "react-icons/fa";

// =====================================================
// CARD DIMENSIONS - SAME AS FRONT
// =====================================================
const CARD_WIDTH = "3.55in";
const CARD_HEIGHT = "2.25in";
const GAP_BETWEEN_CARDS = "0.35in";

const CARDS_PER_ROW = 2;
const ROWS_PER_PAGE = 4;

const CARDS_PER_BROWSER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE; // 8

const PupilIDCardBack = () => {
  const location = useLocation();

  const {
    schoolName,
    schoolLogoUrl,
    schoolAddress,
    schoolMotto,
    schoolContact,
  } = location.state || {};

  const { user } = useAuth();

  const currentSchoolId = location.state?.schoolId || user?.schoolId || "";

  const [pupils, setPupils] = useState([]);
  const [selectedClass, setSelectedClass] = useState("All");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  // =====================================================
  // FETCH PUPILS
  // =====================================================
  useEffect(() => {
    if (!currentSchoolId) return;

    const q = query(
      collection(db, "PupilsReg"),
      where("schoolId", "==", currentSchoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPupils(data);
    });

    return () => unsubscribe();
  }, [currentSchoolId]);

  // =====================================================
  // FILTER OPTIONS
  // =====================================================
  const classOptions = [
    "All",
    ...new Set(pupils.map((p) => p.class).filter(Boolean)),
  ];

  const academicYearOptions = [
    "All",
    ...new Set(pupils.map((p) => p.academicYear).filter(Boolean)),
  ];

  // =====================================================
  // FILTER PUPILS
  // =====================================================
  const filteredPupils = pupils.filter((pupil) => {
    const matchesClass =
      selectedClass === "All" || pupil.class === selectedClass;
    const matchesYear =
      selectedAcademicYear === "All" ||
      pupil.academicYear === selectedAcademicYear;

    return matchesClass && matchesYear;
  });

  // =====================================================
  // PAGINATION
  // =====================================================
  const totalPages =
    Math.ceil(filteredPupils.length / CARDS_PER_BROWSER_PAGE) || 1;

  const startIndex = (currentPage - 1) * CARDS_PER_BROWSER_PAGE;

  const visiblePupils = filteredPupils.slice(
    startIndex,
    startIndex + CARDS_PER_BROWSER_PAGE
  );

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // =====================================================
  // PRINT
  // =====================================================
  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100vh",
        background: "#f3f4f6",
      }}
    >
      {/* =================================================
          PRINT CSS
      ================================================= */}
      <style>
        {`
        @media print {
            body * {
                visibility: hidden !important;
            }

            .id-card-back-grid,
            .id-card-back-grid * {
                visibility: visible !important;
            }

            .id-card-back-grid {
                position: absolute !important;
                left: 4.5px !important;
                top: 0 !important;
                display: grid !important;
                grid-template-columns: repeat(${CARDS_PER_ROW}, ${CARD_WIDTH}) !important;
                gap: ${GAP_BETWEEN_CARDS} !important;
                justify-content: center !important;
                margin: 0 !important;
                padding: 0 !important;
                width: auto !important;
                max-width: none !important;
            }

            .print-hidden {
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

      {/* =================================================
          ACTION BAR
      ================================================= */}
      <div
        className="print-hidden"
        style={{
          width: "100%",
          maxWidth: "800px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "15px",
        }}
      >
        <h2
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            margin: 0,
          }}
        >
          Pupil & Staff ID Cards - Back
        </h2>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          {/* CLASS */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <label style={{ fontSize: "14px", fontWeight: "600" }}>
              Class:
            </label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                background: "#fff",
              }}
            >
              {classOptions.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          {/* ACADEMIC YEAR */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <label style={{ fontSize: "14px", fontWeight: "600" }}>
              Year:
            </label>
            <select
              value={selectedAcademicYear}
              onChange={(e) => {
                setSelectedAcademicYear(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                background: "#fff",
              }}
            >
              {academicYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* PRINT */}
          <button
            onClick={handlePrint}
            style={{
              padding: "8px 16px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: "600",
            }}
          >
            <FaPrint />
            Print Back Page ({currentPage})
          </button>
        </div>
      </div>

      {/* =================================================
          PAGINATION
      ================================================= */}
      {totalPages > 1 && (
        <div
          className="print-hidden"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "15px",
            marginBottom: "20px",
          }}
        >
          <button
            onClick={handlePrevious}
            disabled={currentPage === 1}
            style={{
              padding: "6px 12px",
              background: "#d1d5db",
              color: "#1f2937",
              border: "none",
              borderRadius: "6px",
              cursor: currentPage === 1 ? "not-allowed" : "pointer",
              opacity: currentPage === 1 ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <FaArrowLeft size={12} />
            Previous
          </button>

          <span style={{ fontSize: "14px", fontWeight: "600" }}>
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={handleNext}
            disabled={currentPage === totalPages}
            style={{
              padding: "6px 12px",
              background: "#d1d5db",
              color: "#1f2937",
              border: "none",
              borderRadius: "6px",
              cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              opacity: currentPage === totalPages ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            Next
            <FaArrowRight size={12} />
          </button>
        </div>
      )}

      {/* =================================================
          BACK ID CARDS GRID
      ================================================= */}
      <div
        className="id-card-back-grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${CARDS_PER_ROW}, ${CARD_WIDTH})`,
          gap: GAP_BETWEEN_CARDS,
          justifyContent: "center",
        }}
      >
        {visiblePupils.map((pupil) => (
          <div
            key={pupil.id}
            style={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              border: "1px solid #0D47A1",
              borderRadius: "8px",
              boxSizing: "border-box",
              position: "relative",
              overflow: "hidden",
              background: "linear-gradient(135deg, #ffffff 0%, #b7e3f7 100%)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "center",
              textAlign: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
              pageBreakInside: "avoid",
            }}
          >
            <img
              src="/images/climaxPrint.png"
              alt="ID Card Background"
              style={{
                position: "absolute",
                top: "130px",
                left: "45px",
                width: "80%",
                height: "20%",
                objectFit: "cover",
                zIndex: 0,
                opacity: 0.15,
              }}
            />

            {/* SCHOOL HEADER */}
            <div
              style={{
                width: "90%",
                display: "flex",
                position: "relative",
                zIndex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                paddingTop: "6px",
                paddingBottom: "4px",
                borderBottom: "2px solid #1E88E5",
              }}
            >
              {schoolLogoUrl && (
                <img
                  src={schoolLogoUrl}
                  alt="School Logo"
                  style={{
                    width: "22px",
                    height: "22px",
                    objectFit: "contain",
                  }}
                />
              )}

              <div
                style={{
                  fontWeight: "bold",
                  fontSize: "10px",
                  color: "#0D47A1",
                  textTransform: "uppercase",
                  lineHeight: "1.1",
                }}
              >
                {schoolName || "CHRIST STANDARDS SECONDARY SCHOOL"}
              </div>
            </div>

            {/* MAIN MESSAGE */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: "4px 12px",
                position: "relative",
                zIndex: 1,
              }}
            >
              <div
                style={{
                  fontSize: "8.5px",
                  fontWeight: "bold",
                  color: "#1E88E5",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                IMPORTANT NOTICE
              </div>

              <div
                style={{
                  fontSize: "9.5px",
                  fontWeight: "600",
                  lineHeight: "1.3",
                  color: "#1A237E",
                }}
              >
                THIS CARD REMAINS THE PROPERTY OF
              </div>

              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: "#0D47A1",
                  marginTop: "2px",
                  lineHeight: "1.2",
                }}
              >
                {schoolName || "CHRIST STANDARDS SECONDARY SCHOOL"}
              </div>

              <div
                style={{
                  marginTop: "4px",
                  fontSize: "8.5px",
                  fontWeight: "600",
                  lineHeight: "1.2",
                  color: "#374151",
                }}
              >
                IF FOUND, PLEASE RETURN IT TO THE SCHOOL OFFICE OR THE NEAREST POLICE STATION.
              </div>
            </div>

            {/* CONTACT / FOOTER BANNER */}
            <div
              style={{
                width: "100%",
                background: "linear-gradient(90deg, #9E9E9E 0%, #424242 100%)",
                padding: "4px 8px",
                fontSize: "7.5px",
                color: "#fff9c4",
                lineHeight: "1.2",
                position: "relative",
                zIndex: 1,
              }}
            >
              {schoolAddress && (
                <div
                  style={{
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  {schoolAddress}
                </div>
              )}
              {schoolContact && <div>Tel: {schoolContact}</div>}
              {schoolMotto && (
                <div
                  style={{
                    fontStyle: "italic",
                    marginTop: "1px",
                    color: "#ffffff",
                  }}
                >
                  "{schoolMotto}"
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PupilIDCardBack;