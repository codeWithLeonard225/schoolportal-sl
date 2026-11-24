import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs
} from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults";

const PUPILS_PER_PRINT_PAGE = 20;
const SUBJECTS_PER_PRINT_PAGE = 10;

const getMaxScore = () => 100;

const toPercentage = (score, maxScore = 100) => {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return null;
  }
  const safeMax = maxScore > 0 ? maxScore : 100;
  return (Number(score) / safeMax) * 100;
};

const getGradeFromScore = (score, maxScore = 100) => {
  if (score === null || score === undefined || score === "") return "-";
  const num = Number(score);
  if (!Number.isFinite(num)) return "-";

  const pct = (num / (maxScore > 0 ? maxScore : 100)) * 100;
  if (pct >= 85) return "A+";
  if (pct >= 75) return "A";
  if (pct >= 65) return "B";
  if (pct >= 50) return "C";
  if (pct >= 30) return "D";
  if (pct >= 15) return "E";
  return "F";
};

const getGradeClass = (grade) => {
  if (!grade || grade === "-") {
    return "text-slate-400 font-normal";
  }
  if (grade === "A+" || grade === "A" || grade === "B" || grade === "C") {
    return "text-blue-700 font-bold";
  }
  return "text-rose-600 font-bold";
};

const getPdfGradeColors = (grade) => {
  if (!grade || grade === "-") {
    return { textColor: [148, 163, 184], fontStyle: "normal" };
  }
  if (grade === "A+" || grade === "A" || grade === "B" || grade === "C") {
    return { textColor: [29, 78, 216], fontStyle: "bold" };
  }
  return { textColor: [225, 29, 72], fontStyle: "bold" };
};

const getRemarkFromPercentage = (percentage, recordedSubjects) => {
  if (recordedSubjects <= 0 || percentage === null) return "No Result";
  if (percentage >= 70) return "Excellent";
  if (percentage >= 60) return "Very Good";
  if (percentage >= 50) return "Credit";
  if (percentage >= 40) return "Pass";
  return "Fail";
};

const getScoreClass = (score, maxScore = 100) => {
  const pct = toPercentage(score, maxScore);
  if (pct === null) {
    return "text-slate-400";
  }
  return pct >= 50
    ? "text-blue-700 font-semibold"
    : "text-rose-600 font-semibold";
};

const getRemarkBadgeClass = (remark) => {
  if (remark === "Excellent" || remark === "Very Good") {
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  }
  if (remark === "Credit" || remark === "Pass") {
    return "bg-blue-50 text-blue-700 border border-blue-200";
  }
  if (remark === "Fail") {
    return "bg-rose-50 text-rose-700 border border-rose-200";
  }
  return "bg-slate-100 text-slate-500 border border-slate-200";
};

const getPdfRemarkColors = (remark) => {
  if (remark === "Excellent" || remark === "Very Good") {
    return {
      fillColor: [236, 253, 245],
      textColor: [4, 120, 87],
      fontStyle: "bold"
    };
  }
  if (remark === "Credit" || remark === "Pass") {
    return {
      fillColor: [239, 246, 255],
      textColor: [29, 78, 216],
      fontStyle: "bold"
    };
  }
  if (remark === "Fail") {
    return {
      fillColor: [255, 241, 242],
      textColor: [190, 18, 60],
      fontStyle: "bold"
    };
  }
  return {
    fillColor: [241, 245, 249],
    textColor: [100, 116, 139],
    fontStyle: "normal"
  };
};

const matchesSelectedTest = (gradeDoc, selectedTerm, selectedTest) => {
  const combined = `${selectedTerm} ${selectedTest}`.trim().toLowerCase();
  const docTest = String(gradeDoc.test || "").trim().toLowerCase();
  const docTerm = String(gradeDoc.term || "").trim().toLowerCase();

  if (docTest === combined) return true;
  if (
    docTest === selectedTest.trim().toLowerCase() &&
    (!docTerm || docTerm === selectedTerm.trim().toLowerCase())
  ) {
    return true;
  }
  return false;
};

const chunkArray = (items, size) => {
  if (!items || items.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const TestResult = () => {
  const location = useLocation();
  const mainTableRef = useRef(null);

  const {
    schoolId,
    schoolName,
    schoolLogoUrl,
    schoolAddress,
    schoolMotto,
    schoolContact
  } = location.state || {};

  const [academicYears, setAcademicYears] = useState([]);
  const [classes, setClasses] = useState([]);

  const [academicYear, setAcademicYear] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [selectedTest, setSelectedTest] = useState("T1");

  const [grades, setGrades] = useState([]);
  const [pupils, setPupils] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Popup modals & print orientation mode
  const [activePupil, setActivePupil] = useState(null);
  const [showClassPreview, setShowClassPreview] = useState(false);
  const [printMode, setPrintMode] = useState("class"); // "class" (landscape) | "pupil" (portrait)

  const maxScore = useMemo(() => getMaxScore(), []);

  // Fetch available academic years and classes
  useEffect(() => {
    if (!schoolId) return;

    const q = query(
      collection(schooldb, "PupilGrades"),
      where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => doc.data());

        const years = [
          ...new Set(data.map((d) => d.academicYear).filter(Boolean))
        ]
          .sort()
          .reverse();

        const classList = [
          ...new Set(data.map((d) => d.className).filter(Boolean))
        ].sort();

        setAcademicYears(years);
        setClasses(classList);

        setAcademicYear((prev) =>
          years.includes(prev) ? prev : years[0] || ""
        );

        setSelectedClass((prev) =>
          classList.includes(prev) ? prev : classList[0] || ""
        );
      },
      (err) => {
        console.error(err);
        setError("Unable to load academic years and classes.");
      }
    );

    return () => unsubscribe();
  }, [schoolId]);

  // Fetch results and pupil profiles for selected class and academic year
  useEffect(() => {
    if (!schoolId || !academicYear || !selectedClass) {
      setGrades([]);
      setPupils([]);
      return;
    }

    setLoading(true);
    setError("");

    const q = query(
      collection(schooldb, "PupilGrades"),
      where("schoolId", "==", schoolId),
      where("academicYear", "==", academicYear),
      where("className", "==", selectedClass)
    );

    let active = true;

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const gradeData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          }));

          const pupilIDs = [
            ...new Set(gradeData.map((g) => g.pupilID).filter(Boolean))
          ];

          const pupilSnap = await getDocs(
            query(collection(db, "PupilsReg"), where("schoolId", "==", schoolId))
          );

          const profileMap = new Map();
          pupilSnap.docs.forEach((d) => {
            const pData = d.data();
            if (pData.studentID) {
              profileMap.set(pData.studentID, pData);
            }
          });

          const profiles = pupilIDs.map((studentID) => {
            const matched = profileMap.get(studentID);
            return matched
              ? { ...matched, studentID }
              : { studentID, studentName: `Pupil ${studentID}` };
          });

          profiles.sort((a, b) =>
            (a.studentName || "").localeCompare(b.studentName || "", undefined, {
              sensitivity: "base"
            })
          );

          if (active) {
            setGrades(gradeData);
            setPupils(profiles);
            setLoading(false);
          }
        } catch (err) {
          console.error("Error loading test results:", err);
          if (active) {
            setError("Unable to load pupil information.");
            setLoading(false);
          }
        }
      },
      (err) => {
        console.error(err);
        if (active) {
          setError("Unable to load test results.");
          setLoading(false);
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [schoolId, academicYear, selectedClass]);

  const selectedAssessment = `${selectedTerm} ${selectedTest}`;

  const subjects = useMemo(() => {
    return [
      ...new Set(grades.filter((g) => g.subject).map((g) => g.subject))
    ].sort();
  }, [grades]);

  const results = useMemo(() => {
    const data = pupils.map((pupil) => {
      const subjectScores = {};
      let total = 0;
      let recordedSubjects = 0;

      subjects.forEach((subject) => {
        const record = grades.find(
          (g) =>
            g.pupilID === pupil.studentID &&
            g.subject === subject &&
            matchesSelectedTest(g, selectedTerm, selectedTest)
        );

        if (
          record &&
          record.grade !== undefined &&
          record.grade !== null &&
          record.grade !== ""
        ) {
          const score = Number(record.grade);
          if (Number.isFinite(score)) {
            subjectScores[subject] = score;
            total += score;
            recordedSubjects++;
          } else {
            subjectScores[subject] = null;
          }
        } else {
          subjectScores[subject] = null;
        }
      });

      const average = recordedSubjects > 0 ? total / recordedSubjects : 0;
      const percentage =
        recordedSubjects > 0 ? toPercentage(average, maxScore) : null;
      const remark = getRemarkFromPercentage(percentage, recordedSubjects);

      return {
        ...pupil,
        subjectScores,
        total,
        average,
        percentage,
        recordedSubjects,
        remark
      };
    });

    // 1. Sort highest average first to compute accurate competition positions
    data.sort((a, b) => b.average - a.average);

    let previousAverage = null;
    let previousPosition = 0;

    data.forEach((pupil, index) => {
      if (pupil.recordedSubjects === 0) {
        pupil.position = "—";
      } else if (pupil.average === previousAverage) {
        pupil.position = previousPosition;
      } else {
        pupil.position = index + 1;
        previousAverage = pupil.average;
        previousPosition = index + 1;
      }
    });

    // 2. Sort alphabetically by pupil name for display
    data.sort((a, b) =>
      (a.studentName || "").localeCompare(b.studentName || "", undefined, {
        sensitivity: "base"
      })
    );

    return data;
  }, [pupils, grades, subjects, selectedTerm, selectedTest, maxScore]);

  // Split pupils into groups of 20 and subjects into groups of 10
  const pupilChunks = useMemo(() => {
    return chunkArray(results, PUPILS_PER_PRINT_PAGE);
  }, [results]);

  const subjectChunks = useMemo(() => {
    return chunkArray(subjects, SUBJECTS_PER_PRINT_PAGE);
  }, [subjects]);

  // Combine into explicit landscape sheets: max 20 pupils x max 10 subjects per sheet
  const printSheets = useMemo(() => {
    const sheets = [];
    pupilChunks.forEach((chunkPupils, pIdx) => {
      subjectChunks.forEach((chunkSubjects, sIdx) => {
        const isLastSubjectChunk = sIdx === subjectChunks.length - 1;
        sheets.push({
          key: `p${pIdx}-s${sIdx}`,
          pIdx,
          sIdx,
          chunkPupils,
          chunkSubjects,
          isLastSubjectChunk,
          pupilStart: pIdx * PUPILS_PER_PRINT_PAGE + 1,
          pupilEnd: pIdx * PUPILS_PER_PRINT_PAGE + chunkPupils.length,
          subjectStart: sIdx * SUBJECTS_PER_PRINT_PAGE + 1,
          subjectEnd: sIdx * SUBJECTS_PER_PRINT_PAGE + chunkSubjects.length
        });
      });
    });
    return sheets;
  }, [pupilChunks, subjectChunks]);

  const currentModalPupil = useMemo(() => {
    if (!activePupil) return null;
    return (
      results.find((r) => r.studentID === activePupil.studentID) || activePupil
    );
  }, [activePupil, results]);

  const studentsWithResults = results.filter((p) => p.recordedSubjects > 0);

  const classAverage = studentsWithResults.length
    ? studentsWithResults.reduce((sum, p) => sum + p.average, 0) /
      studentsWithResults.length
    : 0;

  const scrollTableBy = (offset) => {
    if (mainTableRef.current) {
      mainTableRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const handleOpenClassPrintPreview = () => {
    setPrintMode("class");
    setShowClassPreview(true);
  };

  // Opens browser's native Print Preview in Landscape & Full Color
  const handleBrowserPrintLandscape = () => {
    setPrintMode("class");
    setTimeout(() => {
      window.print();
    }, 80);
  };

  // Downloads full-color Landscape A4 PDF (no ID, no Total, no Avg)
  const handleDownloadClassPDF = () => {
    if (printSheets.length === 0) return;

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4"
    });
    const pageWidth = doc.internal.pageSize.getWidth();

    printSheets.forEach((sheet, idx) => {
      if (idx > 0) doc.addPage("a4", "landscape");

      // Colored Banner Header
      doc.setFillColor(30, 58, 138);
      doc.rect(24, 18, pageWidth - 48, 34, "F");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(schoolName || "School", 34, 33);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(219, 234, 254);
      doc.text(
        `${selectedAssessment} Class Broadsheet — ${selectedClass} (${academicYear}) | Grades (85-100: A+, 75-84: A, 65-74: B, 50-64: C, 30-49: D, 15-29: E, 0-14: F)`,
        34,
        45
      );
      doc.text(
        `Sheet ${idx + 1} of ${printSheets.length} • Pupils ${sheet.pupilStart}–${sheet.pupilEnd} of ${results.length} • Subjects ${sheet.subjectStart}–${sheet.subjectEnd} of ${subjects.length}`,
        pageWidth - 34,
        39,
        { align: "right" }
      );

      // Columns: [0: Pos, 1: Pupil Name, 2..subjectEndCol: Subject Grades, optional Remark]
      const subjectStartCol = 2;
      const subjectEndCol = subjectStartCol + sheet.chunkSubjects.length - 1;
      const remarkColIndex = subjectEndCol + 1;

      const head = [
        [
          "Pos",
          "Pupil Name",
          ...sheet.chunkSubjects,
          ...(sheet.isLastSubjectChunk ? ["Remark"] : [])
        ]
      ];

      const body = sheet.chunkPupils.map((p) => [
        p.position,
        p.studentName || "Unnamed Pupil",
        ...sheet.chunkSubjects.map((subj) =>
          getGradeFromScore(p.subjectScores[subj], maxScore)
        ),
        ...(sheet.isLastSubjectChunk ? [p.remark] : [])
      ]);

      autoTable(doc, {
        startY: 60,
        head,
        body,
        theme: "grid",
        margin: { left: 24, right: 24, bottom: 24 },
        styles: {
          fontSize: 8,
          cellPadding: 3,
          halign: "center",
          valign: "middle",
          lineColor: [203, 213, 225],
          lineWidth: 0.5,
          overflow: "linebreak"
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        columnStyles: {
          0: { textColor: [67, 56, 202], fontStyle: "bold" },
          1: { halign: "left", cellWidth: 155, fontStyle: "bold" }
        },
        didParseCell: (data) => {
          if (data.section !== "body") return;

          const isSubjectCol =
            data.column.index >= subjectStartCol &&
            data.column.index <= subjectEndCol;

          if (isSubjectCol) {
            const gradeStyle = getPdfGradeColors(String(data.cell.raw));
            data.cell.styles.textColor = gradeStyle.textColor;
            data.cell.styles.fontStyle = gradeStyle.fontStyle;
          }

          if (
            sheet.isLastSubjectChunk &&
            data.column.index === remarkColIndex
          ) {
            const remarkStyle = getPdfRemarkColors(String(data.cell.raw));
            data.cell.styles.fillColor = remarkStyle.fillColor;
            data.cell.styles.textColor = remarkStyle.textColor;
            data.cell.styles.fontStyle = remarkStyle.fontStyle;
          }
        }
      });
    });

    doc.save(
      `${selectedClass}_${selectedAssessment.replace(/\s+/g, "_")}_Grades_Landscape_Broadsheet.pdf`
    );
  };

  const handlePrintPupilSheet = () => {
    setPrintMode("pupil");
    setTimeout(() => {
      window.print();
    }, 80);
  };

  if (!schoolId) {
    return (
      <div className="p-8 text-center text-red-600">
        School information is missing. Please open this page from the school dashboard.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6 print:bg-white print:p-0">
      <div className="max-w-full mx-auto print:hidden">
        {/* Page Header (Screen View) */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
          <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
            <div className="flex items-center gap-4">
              {schoolLogoUrl && (
                <img
                  src={schoolLogoUrl}
                  alt="School Logo"
                  className="w-16 h-16 object-contain"
                />
              )}

              <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                  {schoolName || "School"}
                </h1>
                {schoolAddress && (
                  <p className="text-sm text-slate-500">{schoolAddress}</p>
                )}
                {schoolContact && (
                  <p className="text-sm text-slate-500">{schoolContact}</p>
                )}
                {schoolMotto && (
                  <p className="text-sm italic text-slate-500">{schoolMotto}</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenClassPrintPreview}
              disabled={loading || results.length === 0}
              className="bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm"
            >
              Print Preview (Landscape)
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
          <h2 className="font-bold text-lg text-slate-800 mb-4">
            Test Result Selection
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Academic Year
              </label>
              <select
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full border rounded-lg p-3 bg-white"
              >
                {academicYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Class</label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full border rounded-lg p-3 bg-white"
              >
                {classes.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Term</label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full border rounded-lg p-3 bg-white"
              >
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                Assessment
              </label>
              <select
                value={selectedTest}
                onChange={(e) => setSelectedTest(e.target.value)}
                className="w-full border rounded-lg p-3 bg-white"
              >
                <option value="T1">T1</option>
                <option value="T2">T2</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm text-slate-500">Total Pupils</p>
            <h2 className="text-2xl font-bold text-slate-800">{pupils.length}</h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm text-slate-500">Pupils With Results</p>
            <h2 className="text-2xl font-bold text-green-700">
              {studentsWithResults.length}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-sm text-slate-500">
              Class Average (out of {maxScore}%)
            </p>
            <h2 className="text-2xl font-bold text-blue-700">
              {classAverage.toFixed(1)}%
            </h2>
          </div>
        </div>

        {/* Screen Result Table (Actual Numeric Scores + Smooth Horizontal Scroll) */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {selectedAssessment} Results
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {selectedClass} | {academicYear} | Max Score: {maxScore}% |{" "}
                <span className="text-indigo-600 font-medium">
                  Click any pupil name to view their individual sheet
                </span>
              </p>
            </div>

            {subjects.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollTableBy(-350)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200"
                >
                  ◀ Scroll Left
                </button>
                <button
                  type="button"
                  onClick={() => scrollTableBy(350)}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200"
                >
                  Scroll Right ▶
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-center py-12 text-blue-600">
              Loading test results...
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">{error}</div>
          ) : subjects.length === 0 || pupils.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No pupil or subject records found for this selection.
            </div>
          ) : (
            <div
              ref={mainTableRef}
              className="overflow-x-auto border border-slate-200 rounded-lg"
            >
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="border border-slate-700 p-3 sticky left-0 z-20 bg-slate-800 min-w-[65px]">
                      Position
                    </th>
                    <th className="border border-slate-700 p-3 text-left sticky left-[65px] z-20 bg-slate-800 min-w-[190px]">
                      Pupil Name
                    </th>
                    <th className="border border-slate-700 p-3 whitespace-nowrap">
                      Pupil ID
                    </th>

                    {subjects.map((subject) => (
                      <th
                        key={subject}
                        className="border border-slate-700 p-3 min-w-[105px] whitespace-nowrap"
                      >
                        {subject}
                      </th>
                    ))}

                    <th className="border border-slate-700 p-3 whitespace-nowrap">
                      Total
                    </th>
                    <th className="border border-slate-700 p-3 whitespace-nowrap">
                      Average
                    </th>
                    <th className="border border-slate-700 p-3 whitespace-nowrap">
                      Remark
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {results.map((pupil) => (
                    <tr key={pupil.studentID} className="hover:bg-slate-50">
                      <td className="border p-3 text-center font-bold text-indigo-700 bg-white sticky left-0 z-10">
                        {pupil.position}
                      </td>

                      <td className="border p-3 font-medium text-slate-800 whitespace-nowrap bg-white sticky left-[65px] z-10">
                        <button
                          type="button"
                          onClick={() => setActivePupil(pupil)}
                          className="text-left text-indigo-700 hover:text-indigo-900 hover:underline font-semibold focus:outline-none"
                          title="View individual test result sheet"
                        >
                          {pupil.studentName || "Unnamed Pupil"}
                        </button>
                      </td>

                      <td className="border p-3 text-center text-slate-600 whitespace-nowrap">
                        {pupil.studentID}
                      </td>

                      {subjects.map((subject) => {
                        const score = pupil.subjectScores[subject];
                        return (
                          <td
                            key={subject}
                            className={`border p-3 text-center whitespace-nowrap ${getScoreClass(
                              score,
                              maxScore
                            )}`}
                          >
                            {score === null ? "—" : score}
                          </td>
                        );
                      })}

                      <td className="border p-3 text-center font-bold text-slate-800 whitespace-nowrap">
                        {pupil.recordedSubjects > 0 ? pupil.total : "—"}
                      </td>

                      <td
                        className={`border p-3 text-center font-bold whitespace-nowrap ${getScoreClass(
                          pupil.recordedSubjects > 0 ? pupil.average : null,
                          maxScore
                        )}`}
                      >
                        {pupil.recordedSubjects > 0
                          ? pupil.average.toFixed(1)
                          : "—"}
                      </td>

                      <td className="border p-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-semibold ${getRemarkBadgeClass(
                            pupil.remark
                          )}`}
                        >
                          {pupil.remark}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 text-xs text-slate-500">
            Assessment: {selectedAssessment} | Academic Year: {academicYear} |
            Subjects: {subjects.length} | Max Score: {maxScore}%
          </div>
        </div>
      </div>

      {/* Landscape Color Print Preview Modal (No ID, No Total, No Avg) */}
      {showClassPreview && (
        <div
          className={`fixed inset-0 z-50 bg-black/60 flex flex-col p-3 md:p-6 ${
            printMode === "class" ? "print-class-modal" : "print:hidden"
          }`}
          onClick={() => setShowClassPreview(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full h-full flex flex-col overflow-hidden print-class-shell"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Toolbar (Hidden when printing) */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 bg-slate-50 print:hidden">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Landscape Color Print Preview ({printSheets.length}{" "}
                  {printSheets.length === 1 ? "Sheet" : "Sheets"} • Max{" "}
                  {PUPILS_PER_PRINT_PAGE} Pupils × {SUBJECTS_PER_PRINT_PAGE}{" "}
                  Subjects/Sheet)
                </h3>
                <p className="text-xs text-slate-500">
                  Subject cells display grades (85–100: A+, 75–84: A, 65–74: B,
                  50–64: C, 30–49: D, 15–29: E, 0–14: F; no grade: -)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleBrowserPrintLandscape}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm"
                >
                  Print Landscape (Color)
                </button>
                <button
                  type="button"
                  onClick={handleDownloadClassPDF}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm"
                >
                  Download Color PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowClassPreview(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold px-3.5 py-2 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Scrollable A4 Landscape Sheet Canvas */}
            <div className="flex-1 overflow-auto p-5 space-y-8 bg-slate-200/80 print-class-scroll">
              {printSheets.map((sheet, idx) => (
                <div
                  key={sheet.key}
                  className={`bg-white rounded-xl shadow-md border border-slate-300 p-5 mx-auto min-w-[960px] max-w-[1120px] print-landscape-sheet ${
                    idx > 0 ? "print-page-break" : ""
                  }`}
                >
                  {/* Colored School & Assessment Banner */}
                  <div className="flex items-center justify-between bg-blue-900 text-white rounded-lg px-4 py-3 mb-3 gap-6">
                    <div className="flex items-center gap-3">
                      {schoolLogoUrl && (
                        <img
                          src={schoolLogoUrl}
                          alt="School Logo"
                          className="w-11 h-11 object-contain bg-white rounded-md p-1"
                        />
                      )}
                      <div>
                        <h4 className="text-base font-bold text-white">
                          {schoolName || "School"}
                        </h4>
                        <p className="text-xs text-blue-100">
                          {selectedAssessment} Class Broadsheet — {selectedClass}{" "}
                          ({academicYear}) | Max Score: {maxScore}%
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-xs text-blue-100">
                      <p className="font-bold text-white">
                        Sheet {idx + 1} of {printSheets.length} (A4 Landscape)
                      </p>
                      <p>
                        Pupils {sheet.pupilStart}–{sheet.pupilEnd} of{" "}
                        {results.length} • Subjects {sheet.subjectStart}–
                        {sheet.subjectEnd} of {subjects.length}
                      </p>
                    </div>
                  </div>

                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-800 text-white">
                        <th className="border border-slate-600 p-2">Pos</th>
                        <th className="border border-slate-600 p-2 text-left min-w-[200px]">
                          Pupil Name
                        </th>

                        {sheet.chunkSubjects.map((subject) => (
                          <th
                            key={subject}
                            className="border border-slate-600 p-2 min-w-[85px]"
                          >
                            {subject}
                          </th>
                        ))}

                        {sheet.isLastSubjectChunk && (
                          <th className="border border-slate-600 p-2">
                            Remark
                          </th>
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      {sheet.chunkPupils.map((pupil, rowIdx) => (
                        <tr
                          key={pupil.studentID}
                          className={
                            rowIdx % 2 === 1 ? "bg-slate-50" : "bg-white"
                          }
                        >
                          <td className="border border-slate-300 p-1.5 text-center font-bold text-indigo-700">
                            {pupil.position}
                          </td>
                          <td className="border border-slate-300 p-1.5 font-semibold text-slate-800">
                            {pupil.studentName || "Unnamed Pupil"}
                          </td>

                          {sheet.chunkSubjects.map((subject) => {
                            const score = pupil.subjectScores[subject];
                            const gradeLetter = getGradeFromScore(
                              score,
                              maxScore
                            );
                            return (
                              <td
                                key={subject}
                                className={`border border-slate-300 p-1.5 text-center ${getGradeClass(
                                  gradeLetter
                                )}`}
                              >
                                {gradeLetter}
                              </td>
                            );
                          })}

                          {sheet.isLastSubjectChunk && (
                            <td className="border border-slate-300 p-1.5 text-center">
                              <span
                                className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold ${getRemarkBadgeClass(
                                  pupil.remark
                                )}`}
                              >
                                {pupil.remark}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Individual Pupil Result Popup Modal */}
      {currentModalPupil && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto ${
            printMode === "pupil" ? "print-pupil-modal" : "print:hidden"
          }`}
          onClick={() => setActivePupil(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 md:p-8 relative my-8 print-pupil-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Action Bar */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-4 mb-5 print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Individual Test Result Slip
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintPupilSheet}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg"
                >
                  Print Pupil Sheet (Color)
                </button>
                <button
                  type="button"
                  onClick={() => setActivePupil(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>

            {/* School Header inside Pupil Sheet */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-5">
              <div className="flex items-center gap-3">
                {schoolLogoUrl && (
                  <img
                    src={schoolLogoUrl}
                    alt="School Logo"
                    className="w-14 h-14 object-contain"
                  />
                )}
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {schoolName || "School"}
                  </h3>
                  {schoolAddress && (
                    <p className="text-xs text-slate-500">{schoolAddress}</p>
                  )}
                  {schoolMotto && (
                    <p className="text-xs italic text-slate-400">
                      "{schoolMotto}"
                    </p>
                  )}
                </div>
              </div>

              {currentModalPupil.userPhotoUrl && (
                <img
                  src={currentModalPupil.userPhotoUrl}
                  alt={currentModalPupil.studentName}
                  className="w-14 h-14 rounded-lg object-cover border border-slate-200"
                />
              )}
            </div>

            {/* Pupil Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200/80 rounded-xl p-4 mb-5 text-xs">
              <div>
                <span className="block text-slate-400 font-semibold uppercase">
                  Pupil Name
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {currentModalPupil.studentName}
                </span>
              </div>
              <div>
                <span className="block text-slate-400 font-semibold uppercase">
                  Student ID
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  {currentModalPupil.studentID}
                </span>
              </div>
              <div>
                <span className="block text-slate-400 font-semibold uppercase">
                  Class / Year
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  {selectedClass} ({academicYear})
                </span>
              </div>
              <div>
                <span className="block text-slate-400 font-semibold uppercase">
                  Assessment
                </span>
                <span className="text-sm font-bold text-indigo-600">
                  {selectedAssessment} (/{maxScore}%)
                </span>
              </div>
            </div>

            {/* Subject-by-Subject Scores Table */}
            <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-xl mb-5 print:max-h-none print:overflow-visible">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="p-2.5 text-left">Subject</th>
                    <th className="p-2.5 text-center">Score (/{maxScore}%)</th>
                    <th className="p-2.5 text-center">Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {subjects.map((subject) => {
                    const score = currentModalPupil.subjectScores[subject];
                    const pct = toPercentage(score, maxScore);
                    const subjRemark =
                      score === null
                        ? "—"
                        : getRemarkFromPercentage(pct, 1);

                    return (
                      <tr key={subject} className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium text-slate-800">
                          {subject}
                        </td>
                        <td
                          className={`p-2.5 text-center ${getScoreClass(
                            score,
                            maxScore
                          )}`}
                        >
                          {score === null ? "—" : score}
                        </td>
                        <td className="p-2.5 text-center">
                          {score === null ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span
                              className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${getRemarkBadgeClass(
                                subjRemark
                              )}`}
                            >
                              {subjRemark}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary Footer */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 text-center">
              <div>
                <span className="block text-[11px] uppercase font-semibold text-slate-500">
                  Total Marks
                </span>
                <span className="text-base font-bold text-slate-800">
                  {currentModalPupil.recordedSubjects > 0
                    ? currentModalPupil.total
                    : "—"}
                </span>
              </div>
              <div>
                <span className="block text-[11px] uppercase font-semibold text-slate-500">
                  Average (/{maxScore}%)
                </span>
                <span className="text-base font-bold text-blue-700">
                  {currentModalPupil.recordedSubjects > 0
                    ? currentModalPupil.average.toFixed(1)
                    : "—"}
                </span>
              </div>
              <div>
                <span className="block text-[11px] uppercase font-semibold text-slate-500">
                  Class Position
                </span>
                <span className="text-base font-extrabold text-indigo-700">
                  {currentModalPupil.position}
                </span>
              </div>
              <div>
                <span className="block text-[11px] uppercase font-semibold text-slate-500">
                  Overall Remark
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {currentModalPupil.remark}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Color Landscape & Portrait Print Styling */}
      <style>
        {`
          @media print {
            @page {
              size: ${printMode === "pupil" ? "A4 portrait" : "A4 landscape"};
              margin: 8mm;
            }

            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            body {
              background: white !important;
            }

            .print-page-break {
              page-break-before: always;
              break-before: page;
            }

            /* Class Broadsheet Landscape Print Mode */
            .print-class-modal {
              position: static !important;
              inset: auto !important;
              background: white !important;
              padding: 0 !important;
              display: block !important;
              overflow: visible !important;
            }

            .print-class-shell {
              box-shadow: none !important;
              border-radius: 0 !important;
              height: auto !important;
              overflow: visible !important;
            }

            .print-class-scroll {
              background: white !important;
              padding: 0 !important;
              overflow: visible !important;
            }

            .print-landscape-sheet {
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
              min-width: 100% !important;
              max-width: 100% !important;
              width: 100% !important;
            }

            /* Individual Pupil Sheet Portrait Print Mode */
            .print-pupil-modal {
              position: static !important;
              background: white !important;
              padding: 0 !important;
              display: block !important;
            }

            .print-pupil-card {
              box-shadow: none !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default TestResult;