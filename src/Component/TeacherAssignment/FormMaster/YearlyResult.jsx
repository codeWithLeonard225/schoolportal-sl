import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../../firebase";
import { schooldb } from "../../Database/SchoolsResults";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation } from "react-router-dom";
// 1. Import Auth Context
import { useAuth } from "../../Security/AuthContext"; 

const YearlyResult = () => {
  const { user } = useAuth(); // 2. Access logged-in user
  const [liveTeacherInfo, setLiveTeacherInfo] = useState(null);
  
  const [academicYear, setAcademicYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  // availableClasses is kept for logic but won't be used in a dropdown for locked users
  const [availableClasses, setAvailableClasses] = useState([]); 
  const [pupils, setPupils] = useState([]);
  const [allYearGrades, setAllYearGrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const location = useLocation();

  const { schoolId, schoolName } = location.state || {};

  // Derived Logic for Class Locking
  const isFormTeacher = liveTeacherInfo?.isFormTeacher ?? user?.data?.isFormTeacher;
  const assignClass = liveTeacherInfo?.assignClass ?? user?.data?.assignClass;

  // 3. Live Teacher Info Listener (to catch real-time class assignment changes)
  useEffect(() => {
    if (!user?.data?.teacherID || !schoolId) return;

    const q = query(
      collection(db, "Teachers"),
      where("teacherID", "==", user.data.teacherID),
      where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setLiveTeacherInfo({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
    });

    return () => unsubscribe();
  }, [user, schoolId]);

  // 4. Initial Metadata Fetch with Class Lock
  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(schooldb, "PupilGrades"), where("schoolId", "==", schoolId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      const years = [...new Set(data.map((d) => d.academicYear))].sort().reverse();
      const classes = [...new Set(data.map((d) => d.className))].sort();
      
      setAcademicYears(years);
      setAvailableClasses(classes);
      
      if (years.length > 0 && !academicYear) setAcademicYear(years[0]);

      // 🔥 APPLY CLASS LOCK: Force select the assignClass
      if (isFormTeacher && assignClass) {
        setSelectedClass(assignClass);
      } else if (classes.length > 0 && !selectedClass) {
        setSelectedClass(classes[0]);
      }
    });
    return () => unsubscribe();
  }, [schoolId, isFormTeacher, assignClass]);

  // 5. Fetch Pupils and Grades
  useEffect(() => {
    // If we are a form teacher but assignClass isn't loaded yet, wait.
    if (!academicYear || !selectedClass || !schoolId) return;
    setLoading(true);

    const pQuery = query(collection(db, "PupilsReg"), 
      where("schoolId", "==", schoolId), 
      where("academicYear", "==", academicYear), 
      where("class", "==", selectedClass)
    );

    const gQuery = query(collection(schooldb, "PupilGrades"), 
      where("academicYear", "==", academicYear), 
      where("schoolId", "==", schoolId), 
      where("className", "==", selectedClass)
    );

    const unsubPupils = onSnapshot(pQuery, (snapshot) => {
      setPupils(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.studentName.localeCompare(b.studentName)));
    });

    const unsubGrades = onSnapshot(gQuery, (snapshot) => {
      setAllYearGrades(snapshot.docs.map(doc => doc.data()));
      setLoading(false);
    });

    return () => { unsubPupils(); unsubGrades(); };
  }, [academicYear, selectedClass, schoolId]);

  // Yearly Logic Engine (remains the same)
  const yearlyData = useMemo(() => {
    if (allYearGrades.length === 0 || pupils.length === 0) return { subjects: [], studentMap: {}, summaries: {} };
    // ... calculations ...
    const subjects = [...new Set(allYearGrades.map(d => d.subject))].sort();
    const studentMap = {};
    const summaries = {};

    const calculateTermMean = (pId, sub, term) => {
      const t1Key = `${term} T1`;
      const t2Key = `${term} T2`;
      const tests = allYearGrades.filter(g => g.pupilID === pId && g.subject === sub && (g.test === t1Key || g.test === t2Key));
      if (tests.length === 0) return 0;
      const t1 = Number(tests.find(t => t.test === t1Key)?.grade || 0);
      const t2 = Number(tests.find(t => t.test === t2Key)?.grade || 0);
      return Math.round((t1 + t2) / 2);
    };

    const subjectStandings = {};
    subjects.forEach(sub => {
      const scores = pupils.map(p => {
        const m1 = calculateTermMean(p.studentID, sub, "Term 1");
        const m2 = calculateTermMean(p.studentID, sub, "Term 2");
        const m3 = calculateTermMean(p.studentID, sub, "Term 3");
        return { id: p.studentID, avg: Math.round((m1 + m2 + m3) / 3), m1, m2, m3 };
      });
      scores.sort((a, b) => b.avg - a.avg);
      scores.forEach((s, i) => {
        if (i > 0 && s.avg === scores[i - 1].avg) s.rank = scores[i - 1].rank;
        else s.rank = i + 1;
      });
      subjectStandings[sub] = scores;
    });

    const overallScores = pupils.map(pupil => {
      const pId = pupil.studentID;
      const results = {};
      let totalYearlySum = 0;

      subjects.forEach(sub => {
        const data = subjectStandings[sub].find(s => s.id === pId);
        results[sub] = { m1: data.m1, m2: data.m2, m3: data.m3, yearlyMean: data.avg, subRank: data.rank };
        totalYearlySum += data.avg;
      });

      studentMap[pId] = results;
      const percentage = subjects.length > 0 ? ((totalYearlySum / (subjects.length * 100)) * 100).toFixed(1) : 0;
      return { id: pId, total: totalYearlySum, percentage };
    });

    overallScores.sort((a, b) => b.total - a.total);
    overallScores.forEach((s, i) => {
      const rank = i > 0 && s.total === overallScores[i - 1].total ? summaries[overallScores[i - 1].id].rank : i + 1;
      summaries[s.id] = { total: s.total, percentage: s.percentage, rank };
    });

    return { subjects, studentMap, summaries };
  }, [allYearGrades, pupils]);

  return (
    <div className="max-w-full mx-auto p-6 bg-white shadow-2xl rounded-3xl border border-gray-100">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #printable-sheet, #printable-sheet * { visibility: visible; }
          #printable-sheet { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          @page { size: A3 landscape; margin: 1cm; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd !important; padding: 4px !important; font-size: 8px !important; }
        }
      `}</style>

      <div className="no-print flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900">Annual Broad Sheet</h2>
          <p className="text-gray-500 font-medium">{schoolName} • {selectedClass}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg font-bold transition-all">
            Print Preview
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="no-print grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-200">
        <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Academic Year</label>
            <select className="border-2 border-gray-200 rounded-xl px-4 py-3 bg-white" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>

        <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-1">Assigned Class</label>
            {/* 🔥 DROPDOWN REMOVED: Replaced with a read-only display box */}
            <div className="border-2 border-gray-100 bg-gray-200 text-gray-600 rounded-xl px-4 py-3 font-bold">
                {selectedClass || "Loading Class..."}
            </div>
            {isFormTeacher && <p className="text-[10px] text-blue-600 mt-1 ml-1 font-medium italic">Your view is locked to your assigned class.</p>}
        </div>
      </div>

      {loading ? (
        <div className="text-center p-20 text-emerald-700 font-bold">Compiling Annual Broad Sheet...</div>
      ) : (
        <div id="printable-sheet" className="overflow-x-auto border border-gray-200 rounded-2xl">
          <table className="w-full text-center border-collapse">
            {/* Table remains the same as your broad sheet structure */}
            <thead className="bg-gray-900 text-white text-[11px] uppercase">
              <tr>
                <th className="p-4 border-r sticky left-0 bg-gray-900 z-30" rowSpan="2">Subject</th>
                {pupils.map(p => (
                  <th key={p.studentID} colSpan="5" className="px-4 py-3 border-b border-r min-w-[180px]">
                    {p.studentName}
                  </th>
                ))}
              </tr>
              <tr className="bg-gray-800 text-[9px]">
                {pupils.map(p => (
                  <React.Fragment key={`subh-${p.studentID}`}>
                    <th className="p-1 border-r">TM 1</th>
                    <th className="p-1 border-r">TM 2</th>
                    <th className="p-1 border-r">TM 3</th>
                    <th className="p-1 border-r bg-emerald-900">AVG</th>
                    <th className="p-1 border-r text-amber-400 font-bold">POS</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="text-[10px] font-medium text-gray-700">
              {yearlyData.subjects.map((sub) => (
                <tr key={sub} className="border-b hover:bg-gray-50">
                  <td className="text-left px-4 py-3 font-bold border-r sticky left-0 bg-white shadow-md">{sub}</td>
                  {pupils.map(p => {
                    const res = yearlyData.studentMap[p.studentID]?.[sub] || {};
                    return (
                      <React.Fragment key={`${p.studentID}-${sub}`}>
                        <td className="p-1 border-r">{res.m1 || 0}</td>
                        <td className="p-1 border-r">{res.m2 || 0}</td>
                        <td className="p-1 border-r">{res.m3 || 0}</td>
                        <td className="p-1 border-r font-black bg-emerald-50 text-emerald-700">{res.yearlyMean || 0}</td>
                        <td className="p-1 border-r font-bold text-rose-600">{res.subRank || "-"}</td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
              
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <td className="sticky left-0 bg-gray-100 px-4 py-3 border-r text-gray-900">Total Sum</td>
                {pupils.map(p => (
                  <td key={`tot-${p.studentID}`} colSpan="5" className="border-r text-sm text-emerald-700">
                    {yearlyData.summaries[p.studentID]?.total}
                  </td>
                ))}
              </tr>
              <tr className="bg-gray-100 font-bold border-t">
                <td className="sticky left-0 bg-gray-100 px-4 py-3 border-r text-gray-900">Percentage (%)</td>
                {pupils.map(p => (
                  <td key={`per-${p.studentID}`} colSpan="5" className="border-r text-sm text-emerald-700">
                    {yearlyData.summaries[p.studentID]?.percentage}%
                  </td>
                ))}
              </tr>
              <tr className="bg-amber-50 font-black border-t-2 border-amber-200">
                <td className="sticky left-0 bg-amber-100 px-4 py-5 border-r text-amber-900">Annual Rank</td>
                {pupils.map(p => (
                  <td key={`rankf-${p.studentID}`} colSpan="5" className="border-r text-xl text-rose-600 italic">
                    #{yearlyData.summaries[p.studentID]?.rank}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default YearlyResult;