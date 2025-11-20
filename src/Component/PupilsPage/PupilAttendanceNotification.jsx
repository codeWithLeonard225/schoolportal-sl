import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import { schooldb } from "../Database/SchoolsResults";
import { pupilLoginFetch } from "../Database/PupilLogin";
import { getDocs, collection, query, where, onSnapshot } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { useAuth } from "../Security/AuthContext";
import localforage from "localforage";

// 📦 Localforage instances
const gradesStore = localforage.createInstance({ name: "GradesCache", storeName: "pupil_grades" });
const classesStore = localforage.createInstance({ name: "ClassesCache", storeName: "school_classes" });
const attendanceStore = localforage.createInstance({ name: "AttendanceCache", storeName: "pupil_attendance" });

// Helper for attendance color
const getAttendanceColor = (status) => {
  switch (status) {
    case "Present": return "bg-green-100 border-green-500 text-green-700";
    case "Absent": return "bg-red-100 border-red-500 text-red-700";
    default: return "bg-gray-100 border-gray-400 text-gray-700";
  }
};

const termTests = { "Term 1": ["Term 1 T1", "Term 1 T2"], "Term 2": ["Term 2 T1", "Term 2 T2"], "Term 3": ["Term 3 T1", "Term 3 T2"] };

const IndividualReportCardTerm1 = () => {
  const { user } = useAuth();
  const authPupilData = user?.role === "pupil" ? user.data : null;
  const location = useLocation();
  const navPupilData = location.state?.user || {};
  const pupilData = authPupilData || navPupilData;

  const schoolId = pupilData?.schoolId || location.state?.schoolId || "N/A";
  const schoolName = location.state?.schoolName || "Unknown School";

  const [latestInfo, setLatestInfo] = useState({ class: "", academicYear: "" });
  const [totalPupilsInClass, setTotalPupilsInClass] = useState(0);
  const [loadingReg, setLoadingReg] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState("Term 1");

  const [pupilGradesData, setPupilGradesData] = useState([]);
  const [classGradesData, setClassGradesData] = useState([]);
  const [classesCache, setClassesCache] = useState([]);
  const [loadingGrades, setLoadingGrades] = useState(false);

  // ⭐ Attendance
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [currentDateAttendance, setCurrentDateAttendance] = useState(null);

  const academicYear = latestInfo.academicYear;
  const selectedClass = latestInfo.class;
  const selectedPupil = pupilData.studentID;
  const tests = termTests[selectedTerm];

  // -----------------------------
  // 1. FETCH PUPIL REGISTRATION
  // -----------------------------
  useEffect(() => {
    if (!selectedPupil || schoolId === "N/A") {
      setLoadingReg(false);
      return;
    }
    const pupilRegRef = query(collection(pupilLoginFetch, "PupilsReg"), where("studentID", "==", selectedPupil), where("schoolId", "==", schoolId));
    const unsubscribe = onSnapshot(pupilRegRef, (snapshot) => {
      if (!snapshot.empty) {
        const d = snapshot.docs[0].data();
        setLatestInfo({ class: d.class, academicYear: d.academicYear });
      }
      setLoadingReg(false);
    }, (error) => {
      console.error("Error fetching pupil registration:", error);
      setLoadingReg(false);
    });
    return () => unsubscribe();
  }, [selectedPupil, schoolId]);

  useEffect(() => {
    if (!academicYear || !selectedClass || schoolId === "N/A") return;
    const pupilsRef = query(collection(pupilLoginFetch, "PupilsReg"), where("academicYear", "==", academicYear), where("class", "==", selectedClass), where("schoolId", "==", schoolId));
    const unsubscribe = onSnapshot(pupilsRef, (snapshot) => {
      setTotalPupilsInClass(snapshot.size);
    });
    return () => unsubscribe();
  }, [academicYear, selectedClass, schoolId]);

  // -----------------------------
  // 2. FETCH CLASSES (CACHE-FIRST)
  // -----------------------------
  useEffect(() => {
    if (!schoolId) return;
    const CLASSES_CACHE_KEY = `classes_${schoolId}`;
    const loadAndListenClasses = async () => {
      try {
        const cachedData = await classesStore.getItem(CLASSES_CACHE_KEY);
        if (cachedData?.data) setClassesCache(cachedData.data);
      } catch (e) { console.error("Failed to retrieve cached classes:", e); }

      const q = query(collection(db, "Classes"), where("schoolId", "==", schoolId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => doc.data());
        setClassesCache(data);
        classesStore.setItem(CLASSES_CACHE_KEY, { timestamp: Date.now(), data }).catch(e => console.error("Failed to save classes:", e));
      });
      return () => unsubscribe();
    };
    loadAndListenClasses();
  }, [schoolId]);

  // -----------------------------
  // 3. FETCH GRADES (CACHE-FIRST)
  // -----------------------------
  useEffect(() => {
    if (!academicYear || !selectedClass || !schoolId || !selectedPupil) return;
    setLoadingGrades(true);
    const GRADES_CACHE_KEY = `grades_${schoolId}_${academicYear}_${selectedClass}`;
    const loadAndListenGrades = async () => {
      try {
        const cachedData = await gradesStore.getItem(GRADES_CACHE_KEY);
        if (cachedData?.data) {
          setClassGradesData(cachedData.data);
          setPupilGradesData(cachedData.data.filter(g => g.pupilID === selectedPupil));
          setLoadingGrades(false);
        }
      } catch (e) { console.error("Failed to retrieve cached grades:", e); }

      const q = query(collection(schooldb, "PupilGrades"), where("academicYear", "==", academicYear), where("schoolId", "==", schoolId), where("className", "==", selectedClass));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const freshGrades = snapshot.docs.map(doc => doc.data());
        setClassGradesData(freshGrades);
        setPupilGradesData(freshGrades.filter(g => g.pupilID === selectedPupil));
        gradesStore.setItem(GRADES_CACHE_KEY, { timestamp: Date.now(), data: freshGrades }).catch(e => console.error("Failed to save grades:", e));
        setLoadingGrades(false);
      }, (error) => { console.error(error); setLoadingGrades(false); });
      return () => unsubscribe();
    };
    loadAndListenGrades();
  }, [academicYear, selectedClass, selectedPupil, schoolId]);

  // -----------------------------
  // 4. FETCH ATTENDANCE (CACHE-FIRST)
  // -----------------------------
  useEffect(() => {
    if (!academicYear || !selectedPupil || schoolId === "N/A") return;
    setLoadingAttendance(true);
    const ATT_CACHE_KEY = `attendance_${schoolId}_${academicYear}_${selectedPupil}`;
    const loadAttendance = async () => {
      try {
        const cachedData = await attendanceStore.getItem(ATT_CACHE_KEY);
        if (cachedData?.data) {
          const sortedRecords = [...cachedData.data].sort((a, b) => b.date.localeCompare(a.date));
          setAttendanceRecords(sortedRecords);
          setCurrentDateAttendance(sortedRecords[0] || null);
        }
      } catch (e) { console.error("Failed to load cached attendance:", e); }

      const q = query(collection(schoollpq, "PupilAttendance"), where("studentID", "==", selectedPupil), where("schoolId", "==", schoolId), where("academicYear", "==", academicYear));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => doc.data());
        const sortedRecords = records.sort((a, b) => b.date.localeCompare(a.date));
        setAttendanceRecords(sortedRecords);
        setCurrentDateAttendance(sortedRecords[0] || null);
        attendanceStore.setItem(ATT_CACHE_KEY, { timestamp: Date.now(), data: sortedRecords }).catch(e => console.error("Failed to cache attendance:", e));
        setLoadingAttendance(false);
      }, (error) => { console.error(error); setLoadingAttendance(false); });

      return () => unsubscribe();
    };
    loadAttendance();
  }, [academicYear, selectedPupil, schoolId]);

  // -----------------------------


  // 6. RENDER
  // -----------------------------
  if (loadingReg) return <div className="text-center p-8 text-indigo-600 font-medium">Loading pupil registration...</div>;
  if (!pupilData.studentID) return (
    <div className="text-center p-8 bg-white shadow-xl rounded-2xl max-w-3xl mx-auto">
      <h2 className="text-xl text-red-600 font-bold">Error</h2>
      <p className="text-gray-600 mt-2">Pupil ID not found. Please ensure you are logged in or navigated correctly.</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white shadow-xl rounded-2xl">
      {/* Pupil Info */}
      <div className="flex items-center gap-4 mb-6 border p-4 rounded-lg bg-gray-50 shadow-sm">
        <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center text-gray-700 font-bold">
          <img src={pupilData.userPhotoUrl} alt="Pupil" className="w-24 h-24 object-cover rounded-full border-2 border-indigo-500"
            onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/96"; }} />
        </div>
        <div>
          {/* <p className="text-lg font-semibold text-indigo-800">{pupilData.studentName || "Name N/A"}</p> */}
          <p className="text-gray-600"><span className="font-medium">Class:</span> {selectedClass || "N/A"} </p>
          {/* <p className="text-gray-600"><span className="font-medium">Academic Year:</span> {academicYear || "N/A"}</p> */}
          {/* <p className="text-gray-600"><span className="font-medium">Student ID:</span> {selectedPupil || "N/A"}</p> */}
        </div>
      </div>

      {/* Latest Attendance Notification */}
      <div className="mb-6 p-4 border rounded-lg shadow-md bg-white">
        <h3 className="text-xl font-bold text-center text-blue-600 mb-3 border-b pb-2">Daily Attendance Status 🔔</h3>
        {loadingAttendance ? <p className="text-center text-blue-500">Fetching latest attendance...</p> :
          currentDateAttendance ? <>
            <div className="flex justify-between items-center">
              <p className="text-lg text-gray-700 font-medium">Attendance for {currentDateAttendance.date}:</p>
              <span className={`inline-flex items-center px-4 py-2 rounded-full text-base font-bold border ${getAttendanceColor(currentDateAttendance.status)}`}>
                {currentDateAttendance.status}
              </span>
            </div>
            {currentDateAttendance.status === "Absent" && <p className="mt-3 text-red-700 text-sm italic text-center font-semibold bg-red-50 p-2 rounded-md">
              ⚠️ The pupil was marked **Absent**. Please contact the school if this is incorrect.
            </p>}
          </> :
          <p className="text-center text-yellow-700">No recent attendance record found for this pupil in **{academicYear}**.</p>
        }
      </div>

      {/* Full Attendance History Table */}
      {attendanceRecords.length > 0 && (
        <div className="mb-6 p-4 border rounded-lg shadow-md bg-white">
          <h3 className="text-xl font-bold text-center text-indigo-700 mb-3 border-b pb-2">Attendance History 📅</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Date</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceRecords.map((record, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-700">{record.date}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getAttendanceColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default IndividualReportCardTerm1;
