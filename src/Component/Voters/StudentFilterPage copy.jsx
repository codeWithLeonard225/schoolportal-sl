import localforage from "localforage";
import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { pupilLoginFetch } from "../Database/PupilLogin";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "../Security/AuthContext";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Initialize localforage store for student registration data
const studentsStore = localforage.createInstance({
    name: "StudentRegData",
    storeName: "pupilRegistration",
});

const LOCALFORAGE_KEY = "allStudentsData";

const StudentFilterPage = () => {
  const { user } = useAuth();
  const currentSchoolId = user?.schoolId || "N/A";

  const [students, setStudents] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [yearOptions, setYearOptions] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // --- Utility Functions ---
  const extractAndSetOptions = (data) => {
    const classes = [...new Set(data.map((s) => s.class).filter(Boolean))].sort();
    const years = [...new Set(data.map((s) => s.academicYear).filter(Boolean))].sort().reverse();
    setClassOptions(classes);
    setYearOptions(years);
  };

  const processAndSetStudents = (data) => {
    const sortedData = data.sort((a, b) => a.studentName?.localeCompare(b.studentName));
    setStudents(sortedData);
    extractAndSetOptions(sortedData);
  };

  // 1. Initial Load from Cache and Real-Time Subscription
  useEffect(() => {
    if (!currentSchoolId || currentSchoolId === "N/A") {
      setLoading(false);
      return;
    }

    const loadAndListen = async () => {
      try {
        const cachedData = await studentsStore.getItem(LOCALFORAGE_KEY);
        if (cachedData && cachedData.data && cachedData.data.length > 0) {
          processAndSetStudents(cachedData.data);
          setLoading(false);
        } else {
          setLoading(true);
        }
      } catch (e) {
        console.error("Failed to retrieve cached data:", e);
        setLoading(true);
      }

      const q = query(
        collection(pupilLoginFetch, "PupilsReg"),
        where("schoolId", "==", currentSchoolId)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          processAndSetStudents(fetchedData);
          
          const dataToStore = {
            timestamp: Date.now(),
            data: fetchedData,
          };
          studentsStore.setItem(LOCALFORAGE_KEY, dataToStore)
            .catch(e => console.error("Failed to save to localforage:", e));
          
          setLoading(false);
        },
        (error) => {
          console.error("Failed to fetch students from Firestore:", error);
          toast.error("Failed to load students.");
          setLoading(false);
        }
      );

      return () => unsubscribe();
    };

    loadAndListen();
  }, [currentSchoolId]);

  // Filter students by class, academic year, and search query (Name, ID, or Form No)
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchesClass = !selectedClass || s.class === selectedClass;
      const matchesYear = !selectedYear || s.academicYear === selectedYear;
      
      const queryText = searchQuery.toLowerCase().trim();
      const matchesSearch = !queryText || 
        s.studentName?.toLowerCase().includes(queryText) ||
        s.studentID?.toLowerCase().includes(queryText) ||
        s.registrationFormNo?.toLowerCase().includes(queryText);

      return matchesClass && matchesYear && matchesSearch;
    });
  }, [students, selectedClass, selectedYear, searchQuery]);

  // Download PDF showing Reg Form No if available, otherwise Student ID
  const downloadPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); 
    doc.text("Student List - Filtered", 14, 10);
    doc.setFontSize(10);
    doc.text(`School ID: ${currentSchoolId}`, 14, 15);
    doc.text(`Filter: Class=${selectedClass || 'All'}, Year=${selectedYear || 'All'}`, 14, 20);

    const tableHeaders = [
      "#", "Reg No / ID", "Name", "Class", "Year", "DOB", "Age", "Gender", "Parent Name", "Parent Phone"
    ];

    const tableData = filteredStudents.map((student, index) => [
      index + 1,
      student.registrationFormNo || student.studentID || 'N/A', // 👈 Fallback logic
      student.studentName,
      student.class,
      student.academicYear,
      student.dob,
      student.age,
      student.gender,
      student.parentName,
      student.parentPhone,
    ]);

    autoTable(doc, {
      startY: 25, 
      head: [tableHeaders],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2, overflow: 'ellipsize' },
      headStyles: { fillColor: [22, 163, 74] },
    });

    doc.save("Filtered_Student_List_Landscape.pdf");
  };

  // Print Preview configuration
  const printPreview = () => {
    const printContent = document.getElementById("printableArea");
    const WinPrint = window.open("", "", "width=1200,height=800"); 
    WinPrint.document.write(`
      <html>
        <head>
          <title>Print Preview</title>
          <style>
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { 
              border: 1px solid #000; 
              padding: 6px; 
              text-align: left; 
              font-size: 10px; 
              word-wrap: break-word;
            }
            th { background-color: #f0f0f0; }
            body { font-family: Arial, sans-serif; padding: 20px; }
            @page { size: landscape; margin: 10mm; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <h2>Pupils List - ${selectedClass || 'All'} / ${selectedYear || 'All'}</h2>
          ${printContent.innerHTML}
          <script>
            window.onload = () => {
              setTimeout(() => { window.print(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    WinPrint.document.close();
  };

  // UI Table Headers & Data Row Mapping
  const tableHeaders = [
    "#", "Reg No / ID", "Name", "Class", "Year", "DOB", "Age", "Gender", "Parent Name", "Parent Phone", "Reg Date"
  ];

  if (loading && students.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-xl font-medium text-gray-700">Loading student data...</p>
        <p className="text-sm text-gray-500 mt-2">Attempting to load from local storage or fetching live from database.</p>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-gray-100">
      <h1 className="text-3xl font-extrabold mb-6 text-center text-gray-800">
        Filter & Export Student Data 📊
      </h1>

      {/* Filters & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-lg shadow-md mb-6">
        <div>
          <label className="block mb-2 font-semibold text-gray-700">Filter by Class</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Classes ({classOptions.length})</option>
            {classOptions.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-2 font-semibold text-gray-700">Filter by Academic Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Years ({yearOptions.length})</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-2 font-semibold text-gray-700">Search Name, ID, or Form No</label>
          <input
            type="text"
            placeholder="Type to search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex space-x-4 mb-4">
        <button
          onClick={downloadPDF}
          className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition shadow-lg"
        >
          ⬇️ Download Landscape PDF
        </button>
        <button
          onClick={printPreview}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition shadow-lg"
        >
          🖨️ Print Preview
        </button>
      </div>

      {/* Table Display Area */}
      <div id="printableArea" className="overflow-x-auto bg-white p-4 rounded-lg shadow-xl">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {tableHeaders.map((header) => (
                <th key={header} className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredStudents.map((student, index) => (
              <tr key={student.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-sm text-gray-700">{index + 1}</td>
                {/* 👈 Dynamic display: Registration Form No if available, otherwise Student ID */}
                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap font-medium">
                  {student.registrationFormNo || student.studentID || '-'}
                </td>
                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{student.studentName || '-'}</td>
                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{student.class || '-'}</td>
                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{student.academicYear || '-'}</td>
                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{student.dob || '-'}</td>
                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{student.age || '-'}</td>
                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{student.gender || '-'}</td>
                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{student.parentName || '-'}</td>
                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{student.parentPhone || '-'}</td>
                <td className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{student.registrationDate || '-'}</td>
              </tr>
            ))}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={tableHeaders.length} className="px-4 py-4 text-center text-gray-500">
                  No students found matching the criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentFilterPage;