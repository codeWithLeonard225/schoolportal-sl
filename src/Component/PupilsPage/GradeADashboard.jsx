import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults";
import { getDocs, collection, query, where, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation } from "react-router-dom";
import { calculateOverallMetrics } from "../Utilis/ResultCalculators";

const GradeADashboard = () => {
  const [academicYear, setAcademicYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedClass, setSelectedClass] = useState("All Classes");
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [classGradesData, setClassGradesData] = useState([]);
  const [pupilsMap, setPupilsMap] = useState({});
  const [classesCache, setClassesCache] = useState([]);
  const [gradeAPupils, setGradeAPupils] = useState([]);
  const [loading, setLoading] = useState(false);

  const location = useLocation();
  const { schoolId, schoolName } = location.state || {};

  const terms = ["Term 1", "Term 2", "Term 3"];
  const GRADE_A_THRESHOLD = 75;

  // 1. Fetch Academic Years and Classes
  useEffect(() => {
    if (!schoolId) return;

    const q = query(
      collection(schooldb, "PupilGrades"),
      where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => doc.data());
      const years = [...new Set(data.map((d) => d.academicYear))].sort().reverse();
      const classes = [...new Set(data.map((d) => d.className?.trim()))].filter(Boolean).sort();

      setAcademicYears(years);
      setAvailableClasses(classes);

      if (years.length > 0 && !academicYear) setAcademicYear(years[0]);
    });

    return () => unsubscribe();
  }, [schoolId]);

  // 2. Fetch Classes Cache once
  useEffect(() => {
    if (!schoolId) return;
    const fetchClasses = async () => {
      const snapshot = await getDocs(
        query(collection(db, "Classes"), where("schoolId", "==", schoolId))
      );
      setClassesCache(snapshot.docs.map((doc) => doc.data()));
    };
    fetchClasses();
  }, [schoolId]);

  // 3. Fetch Pupil Profiles once
  useEffect(() => {
    if (!schoolId) return;
    const fetchPupils = async () => {
      const snapshot = await getDocs(
        query(collection(db, "PupilsReg"), where("schoolId", "==", schoolId))
      );
      const map = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.studentID) map[data.studentID] = data;
      });
      setPupilsMap(map);
    };
    fetchPupils();
  }, [schoolId]);

  // 4. Fetch Grades Data
  useEffect(() => {
    if (!academicYear || !schoolId) return;
    setLoading(true);

    let qConstraints = [
      where("schoolId", "==", schoolId),
      where("academicYear", "==", academicYear),
    ];

    if (selectedClass !== "All Classes") {
      qConstraints.push(where("className", "==", selectedClass));
    }

    const q = query(collection(schooldb, "PupilGrades"), ...qConstraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setClassGradesData(snapshot.docs.map((doc) => doc.data()));
      },
      (error) => {
        console.error("Error fetching grades:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [academicYear, selectedClass, schoolId]);

  // 5. Asynchronous Calculation of Grade A Performers (Prevents UI Thread Lock)
  useEffect(() => {
    if (classGradesData.length === 0) {
      setGradeAPupils([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Timeout allows React to render the loading state first without freezing
    const timer = setTimeout(() => {
      const gradesByClass = classGradesData.reduce((acc, curr) => {
        const cls = curr.className?.trim() || "Unassigned";
        if (!acc[cls]) acc[cls] = [];
        acc[cls].push(curr);
        return acc;
      }, {});

      const topPerformers = [];

      Object.entries(gradesByClass).forEach(([className, classRecords]) => {
        const pupilIDs = [...new Set(classRecords.map((d) => d.pupilID))].filter(Boolean);
        const uniqueSubjects = [...new Set(classRecords.map((d) => d.subject))].filter(Boolean);

        const classInfo = classesCache.find(
          (c) => c.className === className
        );

        const totalSubjectPercentage =
          classInfo?.subjectPercentage || uniqueSubjects.length * 100;

        pupilIDs.forEach((studentID) => {
          const metrics = calculateOverallMetrics(
            classRecords,
            pupilIDs,
            uniqueSubjects,
            studentID,
            totalSubjectPercentage
          );

          const termSummary = metrics.termSummaries?.[selectedTerm];
          const percentage = termSummary ? parseFloat(termSummary.percentage) : 0;

          if (percentage >= GRADE_A_THRESHOLD) {
            const profile = pupilsMap[studentID] || {};
            topPerformers.push({
              studentID,
              studentName: profile.studentName || `Pupil ${studentID}`,
              userPhotoUrl: profile.userPhotoUrl || null,
              className,
              totalMarks: termSummary?.total || 0,
              percentage,
              rank: termSummary?.rank || "—",
            });
          }
        });
      });

      setGradeAPupils(topPerformers.sort((a, b) => b.percentage - a.percentage));
      setLoading(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [classGradesData, selectedTerm, classesCache, pupilsMap]);

  // PDF Export
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "A4" });
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text(schoolName || "Academic Honors Report", pageWidth / 2, 40, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Grade A Students Registry (>= ${GRADE_A_THRESHOLD}%) — ${selectedTerm} (${academicYear})`,
      pageWidth / 2,
      58,
      { align: "center" }
    );

    const tableData = gradeAPupils.map((p, idx) => [
      idx + 1,
      p.studentName,
      p.studentID,
      p.className,
      p.totalMarks,
      `${p.percentage}%`,
      p.rank,
    ]);

    autoTable(doc, {
      startY: 85,
      head: [["#", "Student Name", "Student ID", "Class", "Total Marks", "Average", "Class Rank"]],
      body: tableData,
      theme: "striped",
      styles: { halign: "center", fontSize: 9.5 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        1: { halign: "left", fontStyle: "bold" },
        5: { fontStyle: "bold", textColor: [16, 185, 129] },
      },
    });

    doc.save(`Grade_A_Students_${selectedTerm}_${academicYear}.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen">
      {/* Control Panel */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <span className="h-6 w-1.5 bg-emerald-500 rounded-full inline-block"></span>
              Grade A Excellence Dashboard
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Displaying high achievers scoring over {GRADE_A_THRESHOLD}% overall.
            </p>
          </div>

          <button
            onClick={handleExportPDF}
            disabled={gradeAPupils.length === 0 || loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition disabled:bg-slate-300"
          >
            Export Grade A List (PDF)
          </button>
        </div>

        {/* Term Tabs */}
        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl max-w-md mb-6">
          {terms.map((term) => (
            <button
              key={term}
              onClick={() => setSelectedTerm(term)}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                selectedTerm === term
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {term}
            </button>
          ))}
        </div>

        {/* Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
              Academic Year
            </label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-emerald-500"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            >
              {academicYears.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">
              Filter by Class
            </label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm focus:ring-2 focus:ring-emerald-500"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="All Classes">All Classes</option>
              {availableClasses.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Metrics Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 p-5 rounded-xl">
          <span className="text-xs font-bold text-slate-400 uppercase">Grade A Cohort</span>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">
            {gradeAPupils.length} <span className="text-sm font-normal text-slate-500">Pupils</span>
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-xl">
          <span className="text-xs font-bold text-slate-400 uppercase">Target Threshold</span>
          <p className="text-2xl font-extrabold text-indigo-600 mt-1">≥ {GRADE_A_THRESHOLD}%</p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-xl">
          <span className="text-xs font-bold text-slate-400 uppercase">Top Cohort Average</span>
          <p className="text-2xl font-extrabold text-purple-600 mt-1">
            {gradeAPupils.length > 0
              ? (
                  gradeAPupils.reduce((sum, p) => sum + p.percentage, 0) / gradeAPupils.length
                ).toFixed(1)
              : "0.0"}
            %
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="text-center text-emerald-600 font-medium py-12">
            Aggregating performance metrics...
          </div>
        ) : gradeAPupils.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-center border-collapse">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Pupil Details</th>
                  <th className="px-6 py-3 font-medium">Class Stream</th>
                  <th className="px-6 py-3 font-medium">Total Marks</th>
                  <th className="px-6 py-3 font-medium">Term Percentage</th>
                  <th className="px-6 py-3 font-medium">Class Standing</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {gradeAPupils.map((pupil) => (
                  <tr key={pupil.studentID} className="hover:bg-slate-50/50 transition">
                    <td className="text-left px-6 py-3.5 flex items-center gap-3">
                      {pupil.userPhotoUrl ? (
                        <img
                          src={pupil.userPhotoUrl}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">
                          {pupil.studentName[0]}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-slate-800">{pupil.studentName}</div>
                        <div className="text-xs text-slate-400">ID: {pupil.studentID}</div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 font-medium text-slate-600">{pupil.className}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-700">{pupil.totalMarks}</td>
                    <td className="px-6 py-3.5 font-extrabold text-emerald-600 text-base">
                      {pupil.percentage}%
                    </td>
                    <td className="px-6 py-3.5 font-bold text-indigo-600">{pupil.rank}</td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Grade A
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-slate-400 py-12">
            No pupils reached above {GRADE_A_THRESHOLD}% in {selectedTerm} for the selected filter.
          </div>
        )}
      </div>
    </div>
  );
};

export default GradeADashboard;