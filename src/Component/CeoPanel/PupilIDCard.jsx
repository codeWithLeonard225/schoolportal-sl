import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FaArrowLeft, FaArrowRight, FaPrint } from "react-icons/fa";

const CARD_WIDTH = "3.55in";
const CARD_HEIGHT = "2.25in";
const GAP_BETWEEN_CARDS = "0.35in";
const CARDS_PER_ROW = 2;
const ROWS_PER_PAGE = 4;
const CARDS_PER_BROWSER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE;

const PupilIDCard = ({ studentData, schoolInfo }) => (
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
      className="flex items-center justify-center border-b"
      style={{
        background: "linear-gradient(90deg, #002147, #004080)",
        color: "white",
        padding: "3px 0",
      }}
    >
      <img
        src={schoolInfo.schoolLogoUrl}
        alt="Logo"
        className="w-8 h-8 rounded-full border bg-white mr-2"
      />
      <div className="text-center">
        <h2 className="text-[9pt] font-bold leading-tight">
          {schoolInfo.schoolName}
        </h2>
        <p className="text-[7pt] italic opacity-90 -mt-[1px]">
          {schoolInfo.schoolMotto}
        </p>
      </div>
    </div>

    {/* Body */}
    <div
      className="flex gap-[6px] items-center flex-1"
      style={{
        background: "linear-gradient(180deg, #fdfdfd, #eef2f7)",
        padding: "0.05in 0.1in",
      }}
    >
      <img
        src={studentData.userPhotoUrl}
        alt="Student"
        className="w-[1in] h-[1.25in] object-cover border rounded-sm"
      />
      <div className="flex flex-col justify-center text-[8.8pt] font-medium leading-[1.9] text-gray-800">
        <p>
          <strong>Name:</strong> {studentData.studentName}
        </p>
        <p>
          <strong>Class:</strong> {studentData.class}
        </p>
        <p>
          <strong>DOB:</strong> {studentData.dob}
        </p>
        <p>
          <strong>Year:</strong> {studentData.academicYear}
        </p>
        <p>
          <strong>Reg:</strong> {studentData.registrationDate}
        </p>
      </div>
    </div>

    {/* Footer */}
    <div
      className="flex justify-between items-center border-t"
      style={{
        background: "#002147",
        color: "white",
        fontSize: "6.8pt",
        padding: "2px 5px",
      }}
    >
      <span>{schoolInfo.schoolAddress}</span>
      <span>{schoolInfo.schoolContact}</span>
    </div>
  </div>
);

const PupilIDCardsPage = () => {
  const location = useLocation();
  const {
    schoolId,
    schoolName,
    schoolLogoUrl,
    schoolAddress,
    schoolMotto,
    schoolContact,
  } = location.state || {};

  const [students, setStudents] = useState([]);
  const [filterClass, setFilterClass] = useState("All");
  const [filterYear, setFilterYear] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const schoolInfo = {
    schoolName,
    schoolLogoUrl,
    schoolAddress,
    schoolMotto,
    schoolContact,
  };

  // 🔹 Load pupil data from Firestore
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        if (!schoolId) return;
        const pupilsQuery = query(
          collection(db, "PupilsReg"),
          where("schoolId", "==", schoolId)
        );
        const snapshot = await getDocs(pupilsQuery);
        const pupilList = snapshot.docs.map((doc) => doc.data());
        setStudents(pupilList);
      } catch (error) {
        console.error("Error fetching pupils:", error);
      }
    };

    fetchStudents();
  }, [schoolId]);

  // 🔹 Filter and paginate pupils
  const filteredStudents = students.filter((s) => {
    const classMatch = filterClass === "All" || s.class === filterClass;
    const yearMatch = filterYear === "All" || s.academicYear === filterYear;
    return classMatch && yearMatch;
  });

  const classOptions = ["All", ...new Set(students.map((s) => s.class))];
  const yearOptions = ["All", ...new Set(students.map((s) => s.academicYear))];

  const totalPages = Math.ceil(filteredStudents.length / CARDS_PER_BROWSER_PAGE);
  const startIndex = (currentPage - 1) * CARDS_PER_BROWSER_PAGE;
  const visibleStudents = filteredStudents.slice(
    startIndex,
    startIndex + CARDS_PER_BROWSER_PAGE
  );

  const handleNext = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
  const handlePrevious = () =>
    currentPage > 1 && setCurrentPage(currentPage - 1);

  return (
    <div className="p-6 bg-gray-100 min-h-screen overflow-x-hidden">
      {/* Controls */}
      <div className="print:hidden">
        <h1 className="text-xl font-bold mb-4 text-center">
          {schoolName ? `${schoolName} - ID Cards` : "Pupil ID Cards"}
        </h1>
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
          <select
            value={filterClass}
            onChange={(e) => {
              setFilterClass(e.target.value);
              setCurrentPage(1);
            }}
            className="p-2 border rounded-lg"
          >
            {classOptions.map((cls) => (
              <option key={cls}>{cls}</option>
            ))}
          </select>

          <select
            value={filterYear}
            onChange={(e) => {
              setFilterYear(e.target.value);
              setCurrentPage(1);
            }}
            className="p-2 border rounded-lg"
          >
            {yearOptions.map((yr) => (
              <option key={yr}>{yr}</option>
            ))}
          </select>

          <button
            onClick={() => window.print()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <FaPrint /> Print Current Page ({currentPage})
          </button>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mb-6">
            <button
              onClick={handlePrevious}
              disabled={currentPage === 1}
              className="bg-gray-300 text-gray-800 px-3 py-1 rounded-lg disabled:opacity-50 flex items-center gap-1"
            >
              <FaArrowLeft size={12} /> Previous
            </button>
            <span className="text-sm font-semibold">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className="bg-gray-300 text-gray-800 px-3 py-1 rounded-lg disabled:opacity-50 flex items-center gap-1"
            >
              Next <FaArrowRight size={12} />
            </button>
          </div>
        )}
      </div>

      {/* ID Cards Grid */}
      <div
        className="grid gap-[0.35in] justify-center"
        style={{
          gridTemplateColumns: `repeat(${CARDS_PER_ROW}, ${CARD_WIDTH})`,
        }}
      >
        {visibleStudents.length > 0 ? (
          visibleStudents.map((student) => (
            <PupilIDCard
              key={student.studentID}
              studentData={student}
              schoolInfo={schoolInfo}
            />
          ))
        ) : (
          <p className="col-span-full text-center text-gray-500">
            No pupils found.
          </p>
        )}
      </div>

      {/* Print Style */}
      <style>
        {`
          @media print {
            .print\\:hidden { display: none !important; }
            @page { size: A4 portrait; margin: 0.4in; }
            .grid {
              display: grid !important;
              grid-template-columns: repeat(${CARDS_PER_ROW}, ${CARD_WIDTH}) !important;
              gap: ${GAP_BETWEEN_CARDS} !important;
              justify-content: center;
            }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              margin: 0 !important;
              overflow: hidden !important;
              background: white !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default PupilIDCardsPage;
