import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults";
import {
  collection,
  onSnapshot,
  query,
  where,
  setDoc,
  doc,
  serverTimestamp,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "../Security/AuthContext";
import { useLocation } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import localforage from "localforage";

const TeacherGradesPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const schoolId = location.state?.schoolId || "N/A";

  const [assignments, setAssignments] = useState([]);
  const [pupils, setPupils] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [grades, setGrades] = useState({});
  const [selectedTest, setSelectedTest] = useState("Term 1 T1");
  const [academicYear, setAcademicYear] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [gradeSummary, setGradeSummary] = useState({ filled: 0, empty: 0 });
  const [submitting, setSubmitting] = useState(false);

  const [submittedGradesMap, setSubmittedGradesMap] = useState({});
  const [gradesToDownload, setGradesToDownload] = useState(null);
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
const [pendingCount, setPendingCount] = useState(0);
const [syncing, setSyncing] = useState(false);


  const tests = ["Term 1 T1", "Term 1 T2", "Term 2 T1", "Term 2 T2", "Term 3 T1", "Term 3 T2"];
  const teacherName = user?.data?.teacherName;


const handleSync = async () => {
      setSyncing(true); // disable button
  const pending = JSON.parse(localStorage.getItem("pendingGrades")) || [];
  if (pending.length === 0) return;

  let successCount = 0;

  for (const { gradeData } of pending) {
    try {
      await setDoc(doc(collection(schooldb, "PupilGrades")), {
        ...gradeData,
        timestamp: serverTimestamp(),
      });
      successCount++;
    } catch (error) {
      console.error("Sync error:", error);
    }
  }

  if (successCount > 0) {
    localStorage.removeItem("pendingGrades");
    alert(`✅ Synced ${successCount} pending grades successfully!`);
    setPendingCount(0);
  }
};




useEffect(() => {
  const updateStatus = () => {
    setIsOffline(!navigator.onLine);
    const pending = JSON.parse(localStorage.getItem("pendingGrades")) || [];
    setPendingCount(pending.length);
    if (navigator.onLine && pending.length > 0) {
      handleSync();
    }
  };

  window.addEventListener("online", updateStatus);
  window.addEventListener("offline", updateStatus);

  updateStatus(); // Initial check

  return () => {
    window.removeEventListener("online", updateStatus);
    window.removeEventListener("offline", updateStatus);
  };
}, []);


  // --- Fetch latest academic year (unchanged - fast, small read) ---
  useEffect(() => {
    const q = query(collection(db, "PupilsReg"), orderBy("academicYear", "desc"), limit(1));
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setAcademicYear(snapshot.docs[0].data().academicYear);
      }
    });
    return () => unsub();
  }, []);

  // 1. Fetch Teacher Assignments (from Firebase or localStorage)
  useEffect(() => {
    if (!teacherName) return;

    const assignmentsKey = `assignments_${teacherName}_${schoolId}`;

    const fetchAssignments = async () => {
      // 1. Check Local Storage first
      const cachedAssignments = localStorage.getItem(assignmentsKey);
      let data = [];

      if (cachedAssignments) {
        data = JSON.parse(cachedAssignments);
      } else {
        // 2. Fetch from Firebase (getDocs, not onSnapshot)
        const q = query(
          collection(db, "TeacherAssignments"),
          where("teacher", "==", teacherName),
          where("schoolId", "==", schoolId)
        );

        const snap = await getDocs(q);
        data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 3. Update Local Storage
        localStorage.setItem(assignmentsKey, JSON.stringify(data));
      }

      setAssignments(data);

      if (data.length > 0 && !selectedClass) {
        setSelectedClass(data[0].className);
        setSelectedSubject(data[0].subjects[0]);
      }
    };

    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherName, schoolId]); // Note: selectedClass is NOT a dependency here

  // 2. Bulk Fetch and Cache ALL Teacher's Pupils (Uses localforage)
 useEffect(() => {
  if (!academicYear || assignments.length === 0) return;

  const teacherClasses = assignments.map(a => a.className);
  const q = query(
    collection(db, "PupilsReg"),
    where("class", "in", teacherClasses),
    where("academicYear", "==", academicYear),
    where("schoolId", "==", schoolId)
  );

  const unsub = onSnapshot(q, async (snapshot) => {
    const pupilsData = snapshot.docs.map(d => ({ id: d.id, studentID: d.id, ...d.data() }));
    
    // Update localforage cache
    await localforage.setItem(`pupils_${schoolId}_${academicYear}`, pupilsData);

    // Update current class pupils
    if (selectedClass) {
      const classPupils = pupilsData.filter(p => p.class === selectedClass)
        .sort((a, b) => a.studentName?.localeCompare(b.studentName));
      setPupils(classPupils);

      const initialGrades = { ...grades };
      classPupils.forEach(p => {
        if (!(p.studentID in initialGrades)) initialGrades[p.studentID] = "";
      });
      setGrades(initialGrades);
    }
  });

  return () => unsub();
}, [assignments, academicYear, schoolId, selectedClass]);


  // 3. Load Pupils for Selected Class (READS ONLY FROM CACHE)
  useEffect(() => {
    if (!selectedClass || !academicYear) {
      setPupils([]);
      return;
    }

    const pupilCacheKey = `pupils_${schoolId}_${academicYear}`;

    const loadPupilsFromCache = async () => {
      // Get all pupils from localforage
      const allPupils = await localforage.getItem(pupilCacheKey);

      if (allPupils) {
        // Filter the master list LOCALLY
        const classPupils = allPupils.filter(p => p.class === selectedClass);

        const sortedPupils = classPupils
          .sort((a, b) => a.studentName?.localeCompare(b.studentName));

        setPupils(sortedPupils);

        // Reset working grades for the new class
        const initialGrades = {};
        sortedPupils.forEach((pupil) => (initialGrades[pupil.studentID] = ""));
        setGrades(initialGrades);
      } else {
        // If cache is missing (e.g., first load), this will be empty, 
        // the user will see "No pupils found", and the bulk fetch will run on the previous effect.
        setPupils([]);
      }
    };

    loadPupilsFromCache();

    // CRITICAL: NO FIREBASE onSnapshot QUERY HERE. Reads are local.
  }, [selectedClass, academicYear, schoolId]);


  // --- Check for existing grades (UNAVOIDABLE FIREBASE READ) ---
  // This must query Firebase live to ensure the submission status is current.
  useEffect(() => {
    const checkExistingGrades = async () => {
      if (!selectedClass || !selectedSubject || !selectedTest || !academicYear || !schoolId) {
        setAlreadySubmitted(false);
        setSubmittedGradesMap({});
        return;
      }

      const q = query(
        collection(schooldb, "PupilGrades"),
        where("className", "==", selectedClass),
        where("subject", "==", selectedSubject),
        where("test", "==", selectedTest),
        where("academicYear", "==", academicYear),
        where("schoolId", "==", schoolId)
      );

      // This query results in ~120 reads per class/subject/test change
      const snapshot = await getDocs(q); 
      const isSubmitted = !snapshot.empty;
      setAlreadySubmitted(isSubmitted);

      if (isSubmitted) {
        const gradesMap = {};
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          gradesMap[data.pupilID] = data.grade;
        });
        setSubmittedGradesMap(gradesMap);
      } else {
        setSubmittedGradesMap({});
      }
    };

    checkExistingGrades();
  }, [selectedClass, selectedSubject, selectedTest, academicYear, schoolId]);

  const handleGradeChange = (pupilID, value) => {
    setGrades({ ...grades, [pupilID]: value });
  };

  const handleShowPopup = () => {
    const total = pupils.length;
    const filled = Object.values(grades).filter((v) => v !== "").length;
    const empty = total - filled;
    setGradeSummary({ filled, empty });
    setShowPopup(true);
  };

  const handleSubmitGrades = async () => {
  if (!teacherName || !selectedClass || !selectedSubject || !selectedTest) {
    alert("Please select class, subject, and test.");
    return;
  }

  const currentGrades = { ...grades };
  const filledGrades = Object.entries(currentGrades).filter(([_, v]) => v !== "");

  if (filledGrades.length === 0) {
    alert("No grades entered to submit.");
    return;
  }

  setSubmitting(true);
  setShowPopup(false);

  try {
    // 🔹 If offline → Save to local storage
    if (!navigator.onLine) {
      const pending = JSON.parse(localStorage.getItem("pendingGrades")) || [];

      filledGrades.forEach(([pupilID, gradeValue]) => {
        const gradeData = {
          pupilID,
          className: selectedClass,
          subject: selectedSubject,
          teacher: teacherName,
          grade: parseFloat(gradeValue),
          test: selectedTest,
          academicYear,
          schoolId,
          timestamp: new Date().toISOString(),
        };
        pending.push({ gradeData });
      });

      localStorage.setItem("pendingGrades", JSON.stringify(pending));
      alert(`📡 You're offline. ${filledGrades.length} grades saved locally. They’ll sync later.`);
      setPendingCount(pending.length);
      return;
    }

    // 🔹 If online → Upload immediately
    let submittedCount = 0;
    for (const [pupilID, gradeValue] of filledGrades) {
      const docRef = doc(collection(schooldb, "PupilGrades"));
      await setDoc(docRef, {
        pupilID,
        className: selectedClass,
        subject: selectedSubject,
        teacher: teacherName,
        grade: parseFloat(gradeValue),
        test: selectedTest,
        academicYear,
        schoolId,
        timestamp: serverTimestamp(),
      });
      submittedCount++;
    }

    if (submittedCount > 0) {
      setGradesToDownload(currentGrades);
      setShowDownloadPopup(true);
      setAlreadySubmitted(true);
    }
  } catch (err) {
    console.error(err);
    alert("❌ Error submitting grades.");
  } finally {
    setSubmitting(false);
  }
};


  const handleDownloadPDF = (gradesMap) => {
    if (pupils.length === 0 || !gradesMap) {
      alert("No data available to generate PDF.");
      setShowDownloadPopup(false);
      return;
    }

    setShowDownloadPopup(false);

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "A4" });
    let startY = 30;

    doc.setFontSize(16).setFont(doc.getFont().fontName, "bold");
    doc.text(`Submitted Grades Record`, 40, startY);
    startY += 20;

    doc.setFontSize(11).setFont(doc.getFont().fontName, "normal");
    doc.text(`Teacher: ${teacherName}`, 40, startY);
    doc.text(`Class: ${selectedClass}`, 200, startY);
    doc.text(`Subject: ${selectedSubject}`, 350, startY);
    startY += 15;
    doc.text(`Test: ${selectedTest}`, 40, startY);
    doc.text(`Academic Year: ${academicYear}`, 200, startY);
    startY += 25;

    const tableData = pupils.map((pupil, index) => {
      const grade = gradesMap[pupil.studentID] || "N/A";
      return [index + 1, pupil.studentName, pupil.studentID, pupil.class, grade];
    }).filter(row => row[4] !== "N/A");

    const head = [['#', 'Student Name', 'Student ID', 'Class', 'Grade']];

    autoTable(doc, {
      startY,
      head,
      body: tableData,
      theme: "striped",
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 30, halign: 'center' },
        1: { cellWidth: 150, halign: 'left' },
        2: { cellWidth: 70, halign: 'center' },
        3: { cellWidth: 70, halign: 'center' },
        4: { cellWidth: 60, halign: 'center', fontStyle: 'bold' },
      }
    });

    doc.save(`${selectedClass}_${selectedSubject}_${selectedTest}_Submitted_Grades.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-2xl shadow-md relative">
      <h2 className="text-2xl font-semibold mb-6 text-center text-gray-800">
        Submit Pupils' Grades ({academicYear || "Loading..."})
      </h2>

      <p className="mb-4 text-gray-700 font-medium">
        Logged in as: <span className="font-semibold">{teacherName}</span>
      </p>

      {/* Test Selector */}
      <div className="mb-4">
        <label className="font-medium text-gray-700">Select Test:</label>
        <select
          value={selectedTest}
          onChange={(e) => setSelectedTest(e.target.value)}
          className="w-full border rounded-md px-3 py-2 mt-1 focus:ring focus:ring-green-300 bg-white"
        >
          {tests.map((test, i) => (
            <option key={i} value={test}>{test}</option>
          ))}
        </select>
      </div>

      {/* Class Tabs */}
      {assignments.length > 0 && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {assignments.map((a) => (
            <button
              key={a.id}
              className={`px-4 py-2 rounded-md ${
                selectedClass === a.className ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
              }`}
              onClick={() => {
                setSelectedClass(a.className);
                setSelectedSubject(a.subjects[0]);
              }}
            >
              {a.className}
            </button>
          ))}
        </div>
      )}

      {/* Subject Tabs */}
      {assignments.length > 0 && selectedClass && (
        <div className="mb-4 flex gap-2 flex-wrap">
          {assignments.find((a) => a.className === selectedClass)
            ?.subjects.map((subject, i) => (
              <button
                key={i}
                className={`px-4 py-2 rounded-md ${
                  selectedSubject === subject ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
                }`}
                onClick={() => setSelectedSubject(subject)}
              >
                {subject}
              </button>
            ))}
        </div>
      )}

      {/* Pupils Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 rounded-md text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="border px-3 py-2 text-left">#</th>
              <th className="border px-3 py-2 text-left">Student Name</th>
              <th className="border px-3 py-2 text-left">Class</th>
              <th className="border px-3 py-2 text-left">Grade</th>
            </tr>
          </thead>
          <tbody>
            {pupils.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-4 text-gray-500">
                  No pupils found for this class. (Check cache or Firebase)
                </td>
              </tr>
            ) : (
              pupils.map((pupil, index) => (
                <tr key={pupil.id} className="hover:bg-gray-50">
                  <td className="border px-3 py-2">{index + 1}</td>
                  <td className="border px-3 py-2">{pupil.studentName}</td>
                  <td className="border px-3 py-2">{pupil.class}</td>
                  <td className="border px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={grades[pupil.studentID] || ""}
                      onChange={(e) => handleGradeChange(pupil.studentID, e.target.value)}
                      className="w-20 border px-2 py-1 rounded-md text-center"
                      disabled={alreadySubmitted || submitting}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Submit Button */}
     <div className="mt-4 flex gap-3">
  <button
    onClick={handleShowPopup}
    className={`w-full py-2 rounded-md transition-colors ${
      alreadySubmitted || submitting
        ? "bg-gray-400 cursor-not-allowed"
        : isOffline
        ? "bg-yellow-500 hover:bg-yellow-600 text-white"
        : "bg-green-600 hover:bg-green-700 text-white"
    }`}
    disabled={alreadySubmitted || submitting}
  >
    {alreadySubmitted
      ? "Grades Already Submitted"
      : submitting
      ? "Submitting..."
      : isOffline
      ? `📡 Save Offline (${pendingCount} pending)`
      : pendingCount > 0
      ? `Sync ${pendingCount} Pending Grades`
      : "Submit Grades"}
  </button>
</div>


      {/* Confirm Submission Popup */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-10">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full text-center">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Confirm Submission</h3>
            <p className="text-gray-700 mb-3">
              Total Pupils: <b>{pupils.length}</b>
            </p>
            <p className="text-green-700 mb-2">
              ✅ Grades Entered: <b>{gradeSummary.filled}</b>
            </p>
            <p className="text-red-600 mb-4">
              ⚠️ Grades Missing: <b>{gradeSummary.empty}</b>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Once submitted, grades for this test and academic year cannot be changed.
            </p>

            <div className="flex justify-center gap-3">
              <button
                onClick={handleSubmitGrades}
                disabled={submitting}
                className={`px-4 py-2 rounded-md ${
                  submitting
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {submitting ? "Submitting..." : "Proceed & Submit"}
              </button>
              <button
                onClick={() => setShowPopup(false)}
                disabled={submitting}
                className="bg-gray-300 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Enforcement Popup */}
      {showDownloadPopup && gradesToDownload && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-20">
          <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full text-center border-4 border-red-500">
            <h3 className="text-xl font-bold mb-4 text-red-700">SUBMISSION COMPLETE</h3>
            <p className="text-lg font-semibold text-gray-700 mb-6">
              You **MUST** download the audit PDF now.
            </p>
            <p className="text-sm text-gray-500 mb-4">
              This document is your record of the grades sent to the server.
            </p>

            <button
              onClick={() => handleDownloadPDF(gradesToDownload)}
              className="w-full py-3 rounded-md bg-red-600 hover:bg-red-700 text-white font-bold transition-colors shadow-lg"
            >
              ⬇️ DOWNLOAD REQUIRED AUDIT PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherGradesPage;