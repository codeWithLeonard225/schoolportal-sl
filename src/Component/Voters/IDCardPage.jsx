import React, { useState, useEffect } from "react";
import { FaPrint, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { useLocation } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase";

const CARD_WIDTH = "3.650in";
const CARD_HEIGHT = "2.320in";
const GAP_BETWEEN_CARDS = "0.4in";
const CARDS_PER_ROW = 2;
const ROWS_PER_PAGE = 4;
const CARDS_PER_BROWSER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE;

  const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};


const PupilIDCard = ({ studentData, schoolInfo }) => (
  
  <div
    className="relative bg-white shadow-lg border rounded-lg flex flex-col justify-between print:shadow-none"
    style={{
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      padding: "0.15in",
      boxSizing: "border-box",
      overflow: "hidden",
    }}
  >
    {schoolInfo.schoolLogoUrl && (
      <img
        src={schoolInfo.schoolLogoUrl}
        alt="School Logo Background"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-10"
        style={{ width: "80%", height: "auto", objectFit: "contain" }}
      />
    )}

    <div className="flex items-center border-b border-gray-300 pb-[2px] relative z-10 bg-blue-50">
      <img
        src={schoolInfo.schoolLogoUrl}
        alt="Logo"
        className="w-8 h-8 object-cover rounded-full border"
      />
      <div className="text-center flex-1">
        <h2 className="text-[10pt] font-bold leading-tight text-gray-900">
          {schoolInfo.schoolName}
        </h2>
        <p className="text-[7pt] italic text-gray-600 -mt-[1px]">
          {schoolInfo.schoolMotto}
        </p>
      </div>
    </div>

    <div className="flex mt-[4px] gap-[8px] flex-1 items-center relative z-10">
      <img
        src={studentData.userPhotoUrl}
        alt="Student"
        className="w-[1.1in] h-[1.3in] object-cover border rounded-sm"
      />
      <div className="text-[8.5pt] leading-[1.9] flex flex-col justify-center space-y-[2px]">
         <p><strong>ID:</strong> {studentData.studentID}</p>
        <p><strong>Name:</strong> {studentData.studentName}</p>
      <p>
  <strong>Class:</strong>{" "}
  {studentData.class ? studentData.class.slice(0, 3).toUpperCase() : "N/A"}
</p>

        <p><strong>DOB:</strong> {formatDate(studentData.dob)}</p>
   
        <p><strong>Address:</strong> {studentData.addressLine1}</p>
      </div>
    </div>

    <div className="border-t border-gray-300 mt-[2px] pt-[2px] text-[7pt] text-gray-700 flex justify-between relative z-10">
      <span className="truncate">{schoolInfo.schoolAddress}</span>
      <span>{schoolInfo.schoolContact}</span>
    </div>
  </div>
);


const IDCardPage = () => {
  const location = useLocation();
  const {
    schoolId,
    schoolName,
    schoolLogoUrl,
    schoolAddress,
    schoolMotto,
    schoolContact,
    email,
  } = location.state || {};

  const [students, setStudents] = useState([]);
  const [filterClass, setFilterClass] = useState("All");
  const [filterYear, setFilterYear] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  // 🧠 Load pupils from Firestore
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        if (!schoolId) return;
        const pupilsQuery = query(collection(db, "PupilsReg"), where("schoolId", "==", schoolId));
        const snapshot = await getDocs(pupilsQuery);
        const pupils = snapshot.docs.map((doc) => doc.data());
        setStudents(pupils);
      } catch (error) {
        console.error("Error fetching pupils:", error);
      }
    };
    fetchStudents();
  }, [schoolId]);

  const filteredStudents = students.filter((s) => {
    const classMatch = filterClass === "All" || s.class === filterClass;
    const yearMatch = filterYear === "All" || s.academicYear === filterYear;
    return classMatch && yearMatch;
  });

  const classOptions = ["All", ...new Set(students.map((s) => s.class))];
  const yearOptions = ["All", ...new Set(students.map((s) => s.academicYear))];
  const totalPages = Math.ceil(filteredStudents.length / CARDS_PER_BROWSER_PAGE);
  const startIndex = (currentPage - 1) * CARDS_PER_BROWSER_PAGE;
  const visibleStudents = filteredStudents.slice(startIndex, startIndex + CARDS_PER_BROWSER_PAGE);

  const handleNext = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
  const handlePrevious = () => currentPage > 1 && setCurrentPage(currentPage - 1);

  const schoolInfo = {
    schoolName,
    schoolLogoUrl,
    schoolAddress,
    schoolMotto,
    schoolContact,
    email,
  };




  return (
    <div className="p-6 bg-gray-100 min-h-screen overflow-x-hidden">
      <div className="print:hidden">
        <h1 className="text-xl font-bold mb-4 text-center">
          {schoolName ? `${schoolName} - Pupil ID Cards` : "Pupil ID Cards"}
        </h1>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
          <select
            value={filterClass}
            onChange={(e) => { setFilterClass(e.target.value); setCurrentPage(1); }}
            className="p-2 border rounded-lg"
          >
            {classOptions.map((cls) => (
              <option key={cls}>{cls}</option>
            ))}
          </select>

          <select
            value={filterYear}
            onChange={(e) => { setFilterYear(e.target.value); setCurrentPage(1); }}
            className="p-2 border rounded-lg"
          >
            {yearOptions.map((yr) => (
              <option key={yr}>{yr}</option>
            ))}
          </select>

          {/* <button
            onClick={() => window.print()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center space-x-2"
          >
            <FaPrint />
            <span>Print Current Page ({currentPage})</span>
          </button> */}
        </div>

        {totalPages > 0 && (
          <div className="flex justify-center items-center gap-4 mb-6">
            <button
              onClick={handlePrevious}
              disabled={currentPage === 1}
              className="bg-gray-300 text-gray-800 px-3 py-1 rounded-lg disabled:opacity-50 flex items-center gap-1"
            >
              <FaArrowLeft size={12} /> Previous
            </button>
            <span className="text-sm font-semibold">
              Page {currentPage} of {totalPages} (Total: {filteredStudents.length})
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

      {/* Cards Grid */}
      <div
        className="grid gap-[0.1in] justify-center"
        style={{
          gridTemplateColumns: `repeat(${CARDS_PER_ROW}, ${CARD_WIDTH})`,
          margin: "0 auto",
        }}
      >
        {visibleStudents.length > 0 ? (
          visibleStudents.map((student) => (
            <PupilIDCard key={student.studentID} studentData={student} schoolInfo={schoolInfo} />
          ))
        ) : (
          <div className="col-span-2 text-center text-gray-500 p-8">
            No students found.
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style>
        {`
          @media print {
            .print\\:hidden { display: none !important; }
            .grid {
              display: grid !important;
              grid-template-columns: repeat(${CARDS_PER_ROW}, ${CARD_WIDTH}) !important;
              gap: ${GAP_BETWEEN_CARDS} !important;
              justify-items: center;
              margin: 0 auto !important;
            }
            @page { size: A4; margin: 0; }
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default IDCardPage;
