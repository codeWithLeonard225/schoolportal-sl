import React, { useState } from "react";
import { FaPrint, FaArrowLeft, FaArrowRight } from "react-icons/fa";

const CARD_WIDTH = "3.650in";
const CARD_HEIGHT = "2.320in";
const GAP_BETWEEN_CARDS = "0.4in";
const CARDS_PER_ROW = 2;
const ROWS_PER_PAGE = 4;
const CARDS_PER_BROWSER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE;

// 🏫 Demo School Info
const demoSchoolInfo = {
  schoolName: "Government Model Senior Secondary School",
  schoolLogoUrl:
    "https://res.cloudinary.com/doucdnzij/image/upload/v1760737746/Zadet/Uploads/blob_ltsm4j.jpg",
  schoolMotto: "Motto: Disce Prodece",
  schoolAddress: "Berry Street",
  schoolContact: "Tel: 078207460",
  principalName: "Mr Abass Macca Leigh",
  email: "governmentmodelsecondaryschool@gmail.com",
};

// 👩‍🎓 Demo Pupils
const demoStudents = [
  { studentID: "P001", studentName: "John Doe", class: "JSS 1", academicYear: "2025/2026", dob: "2014-03-15", registrationDate: "2025-10-17", userPhotoUrl: "https://randomuser.me/api/portraits/men/11.jpg" },
  { studentID: "P002", studentName: "Jane Smith", class: "JSS 2", academicYear: "2025/2026", dob: "2013-07-22", registrationDate: "2025-10-18", userPhotoUrl: "https://randomuser.me/api/portraits/women/44.jpg" },
  { studentID: "P003", studentName: "Michael Brown", class: "SSS 1", academicYear: "2024/2025", dob: "2012-09-10", registrationDate: "2025-10-20", userPhotoUrl: "https://randomuser.me/api/portraits/men/19.jpg" },
  { studentID: "P004", studentName: "Emily White", class: "JSS 1", academicYear: "2025/2026", dob: "2014-11-25", registrationDate: "2025-10-21", userPhotoUrl: "https://randomuser.me/api/portraits/women/20.jpg" },
  { studentID: "P005", studentName: "David Green", class: "JSS 2", academicYear: "2025/2026", dob: "2013-01-01", registrationDate: "2025-10-22", userPhotoUrl: "https://randomuser.me/api/portraits/men/33.jpg" },
  { studentID: "P006", studentName: "Sophia Lee", class: "SSS 1", academicYear: "2024/2025", dob: "2012-02-14", registrationDate: "2025-10-23", userPhotoUrl: "https://randomuser.me/api/portraits/women/30.jpg" },
  { studentID: "P007", studentName: "Ethan Chen", class: "JSS 1", academicYear: "2025/2026", dob: "2014-06-05", registrationDate: "2025-10-24", userPhotoUrl: "https://randomuser.me/api/portraits/men/45.jpg" },
  { studentID: "P008", studentName: "Olivia King", class: "JSS 2", academicYear: "2025/2026", dob: "2013-09-19", registrationDate: "2025-10-25", userPhotoUrl: "https://randomuser.me/api/portraits/women/55.jpg" },
  { studentID: "P009", studentName: "Noah Baker", class: "SSS 1", academicYear: "2024/2025", dob: "2012-04-12", registrationDate: "2025-10-26", userPhotoUrl: "https://randomuser.me/api/portraits/men/60.jpg" },
  { studentID: "P010", studentName: "Mia Thompson", class: "JSS 2", academicYear: "2025/2026", dob: "2013-08-01", registrationDate: "2025-10-27", userPhotoUrl: "https://randomuser.me/api/portraits/women/50.jpg" }, // End of Page 1
  { studentID: "P011", studentName: "Alex Turner", class: "SSS 1", academicYear: "2024/2025", dob: "2012-01-20", registrationDate: "2025-10-28", userPhotoUrl: "https://randomuser.me/api/portraits/men/51.jpg" },
  { studentID: "P012", studentName: "Chloe Harris", class: "JSS 1", academicYear: "2025/2026", dob: "2014-04-04", registrationDate: "2025-10-29", userPhotoUrl: "https://randomuser.me/api/portraits/women/52.jpg" },
  { studentID: "P013", studentName: "Liam Scott", class: "JSS 2", academicYear: "2025/2026", dob: "2013-05-18", registrationDate: "2025-10-30", userPhotoUrl: "https://randomuser.me/api/portraits/men/53.jpg" },
];

// 🪪 ID Card Component
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
    {/* Background Logo */}
    {schoolInfo.schoolLogoUrl && (
      <img
        src={schoolInfo.schoolLogoUrl}
        alt="School Logo Background"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-10"
        style={{ width: "80%", height: "auto", objectFit: "contain" }}
      />
    )}

    {/* Header with professional look */}
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

    {/* Body Section */}
    <div className="flex mt-[4px] gap-[8px] flex-1 items-center relative z-10">
      <img
        src={studentData.userPhotoUrl}
        alt="Student"
        className="w-[1.1in] h-[1.3in] object-cover border rounded-sm"
      />
      <div className="text-[8.5pt] leading-[1.9] flex flex-col justify-center space-y-[2px]">
        <p><strong>Name:</strong> {studentData.studentName}</p>
        <p><strong>Class:</strong> {studentData.class}</p>
        <p><strong>DOB:</strong> {studentData.dob}</p>
        <p><strong>Year:</strong> {studentData.academicYear}</p>
        <p><strong>Reg:</strong> {studentData.registrationDate}</p>
      </div>
    </div>

    {/* Footer */}
    <div className="border-t border-gray-300 mt-[2px] pt-[2px] text-[7pt] text-gray-700 flex justify-between relative z-10">
      <span className="truncate">{schoolInfo.schoolAddress}</span>
      <span>{schoolInfo.schoolContact}</span>
    </div>
  </div>
);

// 🧩 Page Component
const IDCardPage = () => {
  const [students] = useState(demoStudents);
  const [filterClass, setFilterClass] = useState("All");
  const [filterYear, setFilterYear] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredStudents = students.filter((s) => {
    const classMatch = filterClass === "All" || s.class === filterClass;
    const yearMatch = filterYear === "All" || s.academicYear === filterYear;
    return classMatch && yearMatch;
  });

  const classOptions = ["All", ...new Set(students.map((s) => s.class))];
  const yearOptions = ["All", ...new Set(students.map((s) => s.academicYear))];
  const totalPages = Math.ceil(filteredStudents.length / CARDS_PER_BROWSER_PAGE);
  const startIndex = (currentPage - 1) * CARDS_PER_BROWSER_PAGE;
  const endIndex = startIndex + CARDS_PER_BROWSER_PAGE;
  const visibleStudents = filteredStudents.slice(startIndex, endIndex);

  const handleNext = () => currentPage < totalPages && setCurrentPage(currentPage + 1);
  const handlePrevious = () => currentPage > 1 && setCurrentPage(currentPage - 1);
  const handleFilterChange = (setter, value) => {
    setter(value);
    setCurrentPage(1);
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="print:hidden">
        <h1 className="text-xl font-bold mb-4 text-center">Pupil ID Cards</h1>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
          <select
            value={filterClass}
            onChange={(e) => handleFilterChange(setFilterClass, e.target.value)}
            className="p-2 border rounded-lg"
          >
            {classOptions.map((cls) => (
              <option key={cls}>{cls}</option>
            ))}
          </select>

          <select
            value={filterYear}
            onChange={(e) => handleFilterChange(setFilterYear, e.target.value)}
            className="p-2 border rounded-lg"
          >
            {yearOptions.map((yr) => (
              <option key={yr}>{yr}</option>
            ))}
          </select>

          <button
            onClick={() => window.print()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center space-x-2"
          >
            <FaPrint />
            <span>Print Current Page ({currentPage})</span>
          </button>
        </div>

        {/* Pagination */}
        {totalPages > 0 && (
          <div className="flex justify-center items-center gap-4 mb-6">
            <button
              onClick={handlePrevious}
              disabled={currentPage === 1}
              className="bg-gray-300 text-gray-800 px-3 py-1 rounded-lg disabled:opacity-50 flex items-center gap-1 transition"
            >
              <FaArrowLeft size={12} /> Previous
            </button>
            <span className="text-sm font-semibold">
              Page {currentPage} of {totalPages} (Total: {filteredStudents.length})
            </span>
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className="bg-gray-300 text-gray-800 px-3 py-1 rounded-lg disabled:opacity-50 flex items-center gap-1 transition"
            >
              Next <FaArrowRight size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Cards */}
      <div
        className="grid gap-[0.1in] justify-center"
        style={{
          gridTemplateColumns: `repeat(${CARDS_PER_ROW}, ${CARD_WIDTH})`,
          marginBottom: GAP_BETWEEN_CARDS,
        }}
      >
        {visibleStudents.map((student) => (
          <PupilIDCard
            key={student.studentID}
            studentData={student}
            schoolInfo={demoSchoolInfo}
          />
        ))}
        {filteredStudents.length === 0 && (
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
              page-break-inside: avoid;
              margin: 0 auto;
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
