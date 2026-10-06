import React, { useEffect, useMemo, useState } from "react";
import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults";
import {
  collection,
  query,
  where,
  onSnapshot
} from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation } from "react-router-dom";

import {
  getTermScores,
  calculateAnnualMean
} from "../Utilis/ResultCalculators";

const PASS_MARK = 50;

const ResultDashboard = () => {
  const location = useLocation();
  const { schoolId, schoolName } = location.state || {};

  const [academicYear, setAcademicYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [availableClasses, setAvailableClasses] = useState([]);

  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [selectedSubject, setSelectedSubject] = useState("All Subjects");

  const [pupils, setPupils] = useState([]);
  const [allGrades, setAllGrades] = useState([]);

  const [loading, setLoading] = useState(false);
  const [passMark, setPassMark] = useState(PASS_MARK);

  const [activeSection, setActiveSection] = useState("overview");

  const terms = ["Term 1", "Term 2", "Term 3"];

  // =========================================================
  // 1. LOAD YEARS AND CLASSES
  // =========================================================

  useEffect(() => {
    if (!schoolId) return;

    const q = query(
      collection(schooldb, "PupilGrades"),
      where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));

        const years = [
          ...new Set(
            data
              .map((item) => item.academicYear)
              .filter(Boolean)
          )
        ].sort().reverse();

        const classes = [
          ...new Set(
            data
              .map((item) => item.className)
              .filter(Boolean)
          )
        ].sort();

        setAcademicYears(years);
        setAvailableClasses(classes);

        if (years.length > 0 && !academicYear) {
          setAcademicYear(years[0]);
        }

        if (classes.length > 0 && !selectedClass) {
          setSelectedClass(classes[0]);
        }
      },
      (error) => {
        console.error(
          "Error loading academic years/classes:",
          error
        );
      }
    );

    return () => unsubscribe();
  }, [schoolId]);

  // =========================================================
  // 2. LOAD PUPILS + GRADES
  // =========================================================

  useEffect(() => {
    if (!schoolId || !academicYear || !selectedClass) {
      return;
    }

    setLoading(true);

    const pupilQuery = query(
      collection(db, "PupilsReg"),
      where("schoolId", "==", schoolId),
      where("academicYear", "==", academicYear),
      where("class", "==", selectedClass)
    );

    const gradeQuery = query(
      collection(schooldb, "PupilGrades"),
      where("schoolId", "==", schoolId),
      where("academicYear", "==", academicYear),
      where("className", "==", selectedClass)
    );

    const unsubscribePupils = onSnapshot(
      pupilQuery,
      (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data()
          }))
          .sort((a, b) =>
            String(
              a.studentName || ""
            ).localeCompare(
              String(
                b.studentName || ""
              )
            )
          );

        setPupils(data);
      },
      (error) => {
        console.error(
          "Error loading pupils:",
          error
        );

        setPupils([]);
      }
    );

    const unsubscribeGrades = onSnapshot(
      gradeQuery,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));

        setAllGrades(data);
        setLoading(false);
      },
      (error) => {
        console.error(
          "Error loading grades:",
          error
        );

        setAllGrades([]);
        setLoading(false);
      }
    );

    return () => {
      unsubscribePupils();
      unsubscribeGrades();
    };
  }, [
    schoolId,
    academicYear,
    selectedClass
  ]);

  // =========================================================
  // 3. SUBJECT LIST
  // =========================================================

  const subjects = useMemo(() => {
    return [
      ...new Set(
        allGrades
          .map((item) => item.subject)
          .filter(Boolean)
      )
    ].sort();
  }, [allGrades]);

  // =========================================================
  // 4. NORMALIZE STUDENT ID
  // =========================================================

  const getStudentId = (item) => {
    return (
      item?.studentID ||
      item?.studentId ||
      item?.pupilID ||
      item?.pupilId ||
      item?.id ||
      ""
    );
  };

  // =========================================================
  // 5. GET PUPIL NAME
  // =========================================================

  const getPupilName = (studentID) => {
    const pupil = pupils.find(
      (p) =>
        String(p.studentID) ===
          String(studentID) ||
        String(p.studentId) ===
          String(studentID) ||
        String(p.id) ===
          String(studentID)
    );

    return (
      pupil?.studentName ||
      pupil?.name ||
      "Unknown Pupil"
    );
  };

  // =========================================================
  // 6. GET SUBJECT SCORE FOR TERM
  // =========================================================

  const getSubjectTermMean = (
    studentID,
    subject,
    term
  ) => {
    try {
      const result = getTermScores(
        allGrades,
        studentID,
        subject,
        term
      );

      const mean = Number(
        result?.mean
      );

      return Number.isFinite(mean)
        ? mean
        : 0;
    } catch (error) {
      console.error(
        "Error getting term score:",
        error
      );

      return 0;
    }
  };

  // =========================================================
  // 7. GET ASSESSMENT VALUE
  // =========================================================

  const getAssessmentValue = (
    grade,
    type
  ) => {
    if (!grade) return null;

    const keys = Object.keys(grade);

    const normalized = (value) =>
      String(value)
        .toLowerCase()
        .replace(/[\s_-]/g, "");

    const aliases = {
      test1: [
        "test1",
        "test01",
        "testone",
        "ca1",
        "assessment1"
      ],

      test2: [
        "test2",
        "test02",
        "testtwo",
        "ca2",
        "assessment2"
      ],

      test3: [
        "test3",
        "test03",
        "testthree",
        "ca3",
        "assessment3"
      ],

      exam: [
        "exam",
        "examination",
        "finalexam",
        "exammark",
        "examscore"
      ]
    };

    const matchingKey = keys.find(
      (key) =>
        aliases[type]?.includes(
          normalized(key)
        )
    );

    if (!matchingKey) return null;

    const value = Number(
      grade[matchingKey]
    );

    return Number.isFinite(value)
      ? value
      : null;
  };

  // =========================================================
  // 8. DETECT AVAILABLE ASSESSMENTS
  // =========================================================

  const assessmentTypes = useMemo(() => {
    const types = [];

    [
      "test1",
      "test2",
      "test3",
      "exam"
    ].forEach((type) => {
      const exists = allGrades.some(
        (grade) =>
          getAssessmentValue(
            grade,
            type
          ) !== null
      );

      if (exists) {
        types.push(type);
      }
    });

    return types;
  }, [allGrades]);

  // =========================================================
  // 9. TERM SUBJECT DATA
  // =========================================================

  const termSubjectData = useMemo(() => {
    const result = {};

    subjects.forEach((subject) => {
      result[subject] = {
        pass: 0,
        fail: 0,
        total: 0,
        average: 0
      };

      let totalScore = 0;

      pupils.forEach((pupil) => {
        const studentID =
          getStudentId(pupil);

        const score =
          getSubjectTermMean(
            studentID,
            subject,
            selectedTerm
          );

        if (score <= 0) return;

        result[subject].total += 1;

        totalScore += score;

        if (
          score >=
          Number(passMark)
        ) {
          result[subject].pass += 1;
        } else {
          result[subject].fail += 1;
        }
      });

      result[subject].average =
        result[subject].total > 0
          ? Number(
              (
                totalScore /
                result[subject].total
              ).toFixed(2)
            )
          : 0;
    });

    return result;
  }, [
    subjects,
    pupils,
    allGrades,
    selectedTerm,
    passMark
  ]);

  // =========================================================
  // 10. OVERALL TERM RESULTS
  // =========================================================

  const termOverallResults = useMemo(() => {
    const studentResults = [];

    pupils.forEach((pupil) => {
      const studentID =
        getStudentId(pupil);

      const subjectResults =
        subjects
          .map((subject) => {
            const score =
              getSubjectTermMean(
                studentID,
                subject,
                selectedTerm
              );

            return {
              subject,
              score
            };
          })
          .filter(
            (item) =>
              item.score > 0
          );

      if (
        subjectResults.length === 0
      ) {
        return;
      }

      const total =
        subjectResults.reduce(
          (sum, item) =>
            sum + item.score,
          0
        );

      const average =
        total /
        subjectResults.length;

      const passedSubjects =
        subjectResults.filter(
          (item) =>
            item.score >=
            Number(passMark)
        ).length;

      const failedSubjects =
        subjectResults.length -
        passedSubjects;

      studentResults.push({
        studentID,
        studentName:
          pupil.studentName ||
          pupil.name ||
          "Unknown Pupil",
        total,
        average,
        passedSubjects,
        failedSubjects,
        subjectCount:
          subjectResults.length,
        percentage: average
      });
    });

    return studentResults;
  }, [
    pupils,
    subjects,
    allGrades,
    selectedTerm,
    passMark
  ]);

  // =========================================================
  // 11. TERM PASS / FAIL
  // =========================================================

  const termSummary = useMemo(() => {
    let pass = 0;
    let fail = 0;

    termOverallResults.forEach(
      (student) => {
        if (
          student.average >=
          Number(passMark)
        ) {
          pass++;
        } else {
          fail++;
        }
      }
    );

    const total =
      pass + fail;

    return {
      pass,
      fail,
      total,
      passPercentage:
        total > 0
          ? (
              (pass / total) *
              100
            ).toFixed(1)
          : "0.0",
      failPercentage:
        total > 0
          ? (
              (fail / total) *
              100
            ).toFixed(1)
          : "0.0"
    };
  }, [
    termOverallResults,
    passMark
  ]);

  // =========================================================
  // 12. TERM RANKING
  // =========================================================

  const termRanking = useMemo(() => {
    return [...termOverallResults]
      .sort((a, b) => {
        if (
          b.average !==
          a.average
        ) {
          return (
            b.average -
            a.average
          );
        }

        return (
          b.total -
          a.total
        );
      })
      .map(
        (student, index) => ({
          ...student,
          rank: index + 1
        })
      );
  }, [termOverallResults]);

  // =========================================================
  // 13. TOP 10 TERM
  // =========================================================

  const top10Term = useMemo(() => {
    return termRanking.slice(
      0,
      10
    );
  }, [termRanking]);

  // =========================================================
  // 14. YEARLY RESULTS
  //
  // IMPORTANT:
  // This now uses the EXACT same calculation method
  // as your working ResultDashboard.
  // =========================================================

  const yearlyStudentResults =
    useMemo(() => {
      const results = [];

      pupils.forEach((pupil) => {
        const studentID =
          getStudentId(pupil);

        const subjectResults = [];

        subjects.forEach(
          (subject) => {
            // TERM 1
            const t1 =
              getTermScores(
                allGrades,
                studentID,
                subject,
                "Term 1"
              );

            // TERM 2
            const t2 =
              getTermScores(
                allGrades,
                studentID,
                subject,
                "Term 2"
              );

            // TERM 3
            const t3 =
              getTermScores(
                allGrades,
                studentID,
                subject,
                "Term 3"
              );

            // IMPORTANT:
            // Use the same signature that works
            // in your existing ResultDashboard.
            const yearlyMean =
              calculateAnnualMean(
                t1?.mean || 0,
                t2?.mean || 0,
                t3?.mean || 0,
                "auto"
              );

            const numericMean =
              Number(
                yearlyMean
              );

            if (
              Number.isFinite(
                numericMean
              ) &&
              numericMean > 0
            ) {
              subjectResults.push({
                subject,
                yearlyMean:
                  numericMean
              });
            }
          }
        );

        if (
          subjectResults.length === 0
        ) {
          return;
        }

        const total =
          subjectResults.reduce(
            (sum, item) =>
              sum +
              item.yearlyMean,
            0
          );

        const average =
          total /
          subjectResults.length;

        const passedSubjects =
          subjectResults.filter(
            (item) =>
              item.yearlyMean >=
              Number(passMark)
          ).length;

        const failedSubjects =
          subjectResults.length -
          passedSubjects;

        results.push({
          studentID,
          studentName:
            pupil.studentName ||
            pupil.name ||
            getPupilName(
              studentID
            ),
          total,
          average,
          percentage: average,
          passedSubjects,
          failedSubjects,
          subjectCount:
            subjectResults.length,
          subjects:
            subjectResults
        });
      });

      return results;
    }, [
      pupils,
      subjects,
      allGrades,
      passMark
    ]);

  // =========================================================
  // 15. YEARLY RANKING
  // =========================================================

  const yearlyRanking = useMemo(() => {
    return [...yearlyStudentResults]
      .sort((a, b) => {
        if (
          b.average !==
          a.average
        ) {
          return (
            b.average -
            a.average
          );
        }

        return (
          b.total -
          a.total
        );
      })
      .map(
        (student, index) => ({
          ...student,
          rank: index + 1
        })
      );
  }, [
    yearlyStudentResults
  ]);

  // =========================================================
  // 16. TOP 10 YEARLY
  // =========================================================

  const top10Yearly = useMemo(() => {
    return yearlyRanking.slice(
      0,
      10
    );
  }, [yearlyRanking]);

  // =========================================================
  // 17. SELECTED SUBJECT TERM RANKING
  // =========================================================

  const selectedSubjectTermRanking =
    useMemo(() => {
      if (
        !selectedSubject ||
        selectedSubject ===
          "All Subjects"
      ) {
        return [];
      }

      return pupils
        .map((pupil) => {
          const studentID =
            getStudentId(
              pupil
            );

          const score =
            getSubjectTermMean(
              studentID,
              selectedSubject,
              selectedTerm
            );

          return {
            studentID,
            studentName:
              pupil.studentName ||
              pupil.name ||
              "Unknown Pupil",
            score
          };
        })
        .filter(
          (item) =>
            item.score > 0
        )
        .sort(
          (a, b) =>
            b.score -
            a.score
        )
        .map(
          (item, index) => ({
            ...item,
            rank: index + 1
          })
        );
    }, [
      pupils,
      allGrades,
      selectedSubject,
      selectedTerm
    ]);

  // =========================================================
  // 18. SELECTED SUBJECT YEARLY RANKING
  //
  // ALSO UPDATED TO USE THE WORKING
  // calculateAnnualMean() SIGNATURE.
  // =========================================================

  const selectedSubjectYearlyRanking =
    useMemo(() => {
      if (
        !selectedSubject ||
        selectedSubject ===
          "All Subjects"
      ) {
        return [];
      }

      const results = [];

      pupils.forEach((pupil) => {
        const studentID =
          getStudentId(
            pupil
          );

        const t1 =
          getTermScores(
            allGrades,
            studentID,
            selectedSubject,
            "Term 1"
          );

        const t2 =
          getTermScores(
            allGrades,
            studentID,
            selectedSubject,
            "Term 2"
          );

        const t3 =
          getTermScores(
            allGrades,
            studentID,
            selectedSubject,
            "Term 3"
          );

        const yearlyMean =
          calculateAnnualMean(
            t1?.mean || 0,
            t2?.mean || 0,
            t3?.mean || 0,
            "auto"
          );

        const score =
          Number(yearlyMean);

        if (
          Number.isFinite(score) &&
          score > 0
        ) {
          results.push({
            studentID,
            studentName:
              pupil.studentName ||
              pupil.name ||
              "Unknown Pupil",
            score
          });
        }
      });

      return results
        .sort(
          (a, b) =>
            b.score -
            a.score
        )
        .map(
          (item, index) => ({
            ...item,
            rank: index + 1
          })
        );
    }, [
      pupils,
      allGrades,
      selectedSubject
    ]);

  // =========================================================
  // 19. SUBJECT DETAILED ANALYSIS
  // =========================================================

  const subjectAnalysis = useMemo(() => {
    return subjects.map(
      (subject) => {
        const pupilScores =
          pupils
            .map((pupil) => {
              const studentID =
                getStudentId(
                  pupil
                );

              const score =
                getSubjectTermMean(
                  studentID,
                  subject,
                  selectedTerm
                );

              return {
                studentID,
                studentName:
                  pupil.studentName ||
                  pupil.name ||
                  "Unknown Pupil",
                score:
                  Number(score) ||
                  0
              };
            })
            .filter(
              (item) =>
                item.score > 0
            );

        const sortedScores = [
          ...pupilScores
        ].sort(
          (a, b) =>
            b.score -
            a.score
        );

        const total =
          pupilScores.length;

        const pass =
          pupilScores.filter(
            (item) =>
              item.score >=
              Number(passMark)
          ).length;

        const fail =
          total - pass;

        const average =
          total > 0
            ? pupilScores.reduce(
                (sum, item) =>
                  sum +
                  item.score,
                0
              ) / total
            : 0;

        const highest =
          sortedScores.length > 0
            ? sortedScores[0]
                .score
            : 0;

        const lowest =
          sortedScores.length > 0
            ? sortedScores[
                sortedScores.length -
                  1
              ].score
            : 0;

        return {
          subject,
          total,
          pass,
          fail,
          average,
          highest,
          lowest,
          passRate:
            total > 0
              ? (
                  (pass /
                    total) *
                  100
                ).toFixed(1)
              : "0.0",
          top5:
            sortedScores.slice(
              0,
              5
            )
        };
      }
    );
  }, [
    subjects,
    pupils,
    selectedTerm,
    passMark,
    allGrades
  ]);

  // =========================================================
  // 20. SELECTED SUBJECT DETAILS
  // =========================================================

  const selectedSubjectDetails =
    useMemo(() => {
      if (
        selectedSubject ===
        "All Subjects"
      ) {
        return null;
      }

      return (
        subjectAnalysis.find(
          (item) =>
            item.subject ===
            selectedSubject
        ) || null
      );
    }, [
      subjectAnalysis,
      selectedSubject
    ]);

  // =========================================================
  // 21. ASSESSMENT SUMMARY
  // =========================================================

  const assessmentSummary =
    useMemo(() => {
      const output = {};

      subjects.forEach(
        (subject) => {
          output[subject] = {};

          assessmentTypes.forEach(
            (type) => {
              let pass = 0;
              let fail = 0;
              let total = 0;
              let scoreTotal = 0;

              pupils.forEach(
                (pupil) => {
                  const studentID =
                    getStudentId(
                      pupil
                    );

                  const grade =
                    allGrades.find(
                      (item) =>
                        String(
                          getStudentId(
                            item
                          )
                        ) ===
                          String(
                            studentID
                          ) &&
                        item.subject ===
                          subject &&
                        item.term ===
                          selectedTerm
                    );

                  const score =
                    getAssessmentValue(
                      grade,
                      type
                    );

                  if (
                    score ===
                    null
                  ) {
                    return;
                  }

                  total++;
                  scoreTotal +=
                    score;

                  if (
                    score >=
                    Number(
                      passMark
                    )
                  ) {
                    pass++;
                  } else {
                    fail++;
                  }
                }
              );

              output[subject][
                type
              ] = {
                pass,
                fail,
                total,
                average:
                  total > 0
                    ? Number(
                        (
                          scoreTotal /
                          total
                        ).toFixed(
                          2
                        )
                      )
                    : 0
              };
            }
          );
        }
      );

      return output;
    }, [
      subjects,
      assessmentTypes,
      pupils,
      allGrades,
      selectedTerm,
      passMark
    ]);

  // =========================================================
  // 22. SELECTED SUBJECT ASSESSMENTS
  // =========================================================

  const selectedSubjectAssessments =
    useMemo(() => {
      if (
        selectedSubject ===
        "All Subjects"
      ) {
        return [];
      }

      return assessmentTypes.map(
        (type) => {
          const data =
            assessmentSummary[
              selectedSubject
            ]?.[type] || {
              pass: 0,
              fail: 0,
              total: 0,
              average: 0
            };

          return {
            type,
            ...data
          };
        }
      );
    }, [
      selectedSubject,
      assessmentTypes,
      assessmentSummary
    ]);

  // =========================================================
  // 23. SUBJECT TABLE
  // =========================================================

  const subjectTable = useMemo(() => {
    return subjects.map(
      (subject) => {
        const data =
          termSubjectData[
            subject
          ] || {};

        return {
          subject,
          total:
            data.total || 0,
          pass:
            data.pass || 0,
          fail:
            data.fail || 0,
          average:
            data.average || 0,
          passRate:
            data.total > 0
              ? (
                  (data.pass /
                    data.total) *
                  100
                ).toFixed(1)
              : "0.0"
        };
      }
    );
  }, [
    subjects,
    termSubjectData
  ]);

  // =========================================================
  // 24. PDF EXPORT
  // =========================================================

  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: "a4"
    });

    const width =
      doc.internal.pageSize.getWidth();

    doc.setFontSize(20);
    doc.setFont(undefined, "bold");

    doc.text(
      String(
        schoolName ||
          "SCHOOL"
      ).toUpperCase(),
      width / 2,
      40,
      {
        align: "center"
      }
    );

    doc.setFontSize(14);
    doc.setFont(undefined, "normal");

    doc.text(
      `RESULT DASHBOARD - ${selectedClass} - ${academicYear}`,
      width / 2,
      63,
      {
        align: "center"
      }
    );

    doc.setFontSize(11);

    doc.text(
      `${selectedTerm} | Pass Mark: ${passMark}%`,
      width / 2,
      82,
      {
        align: "center"
      }
    );

    autoTable(doc, {
      startY: 105,
      head: [
        [
          "TOTAL PUPILS",
          "PASSED",
          "FAILED",
          "PASS RATE",
          "FAIL RATE"
        ]
      ],
      body: [
        [
          termSummary.total,
          termSummary.pass,
          termSummary.fail,
          `${termSummary.passPercentage}%`,
          `${termSummary.failPercentage}%`
        ]
      ],
      theme: "grid",
      styles: {
        halign: "center",
        fontSize: 11
      }
    });

    let y =
      doc.lastAutoTable.finalY +
      25;

    doc.setFontSize(13);
    doc.setFont(undefined, "bold");

    doc.text(
      "SUBJECT PASS / FAIL SUMMARY",
      40,
      y
    );

    autoTable(doc, {
      startY: y + 10,
      head: [
        [
          "SUBJECT",
          "TOTAL",
          "PASS",
          "FAIL",
          "PASS RATE",
          "AVERAGE"
        ]
      ],
      body: subjectTable.map(
        (item) => [
          item.subject,
          item.total,
          item.pass,
          item.fail,
          `${item.passRate}%`,
          item.average
        ]
      ),
      theme: "grid",
      styles: {
        fontSize: 9,
        halign: "center"
      }
    });

    doc.addPage();

    doc.setFontSize(15);
    doc.setFont(undefined, "bold");

    doc.text(
      `TOP 10 PUPILS - ${selectedTerm}`,
      40,
      40
    );

    autoTable(doc, {
      startY: 55,
      head: [
        [
          "RANK",
          "PUPIL",
          "AVERAGE",
          "PASSED SUBJECTS",
          "FAILED SUBJECTS"
        ]
      ],
      body: top10Term.map(
        (item) => [
          item.rank,
          item.studentName,
          item.average.toFixed(2),
          item.passedSubjects,
          item.failedSubjects
        ]
      ),
      theme: "grid"
    });

    let nextY =
      doc.lastAutoTable.finalY +
      30;

    doc.text(
      "TOP 10 PUPILS - YEARLY",
      40,
      nextY
    );

    autoTable(doc, {
      startY: nextY + 15,
      head: [
        [
          "RANK",
          "PUPIL",
          "YEARLY AVERAGE",
          "PASSED SUBJECTS",
          "FAILED SUBJECTS"
        ]
      ],
      body: top10Yearly.map(
        (item) => [
          item.rank,
          item.studentName,
          item.average.toFixed(2),
          item.passedSubjects,
          item.failedSubjects
        ]
      ),
      theme: "grid"
    });

    if (
      selectedSubject !==
      "All Subjects"
    ) {
      doc.addPage();

      doc.setFontSize(15);

      doc.text(
        `TOP 5 - ${selectedSubject} - ${selectedTerm}`,
        40,
        40
      );

      autoTable(doc, {
        startY: 55,
        head: [
          [
            "RANK",
            "PUPIL",
            "SCORE"
          ]
        ],
        body:
          selectedSubjectTermRanking
            .slice(0, 5)
            .map(
              (item) => [
                item.rank,
                item.studentName,
                item.score.toFixed(
                  2
                )
              ]
            ),
        theme: "grid"
      });

      let subjectY =
        doc.lastAutoTable.finalY +
        30;

      doc.text(
        `TOP 5 - ${selectedSubject} - YEARLY`,
        40,
        subjectY
      );

      autoTable(doc, {
        startY:
          subjectY + 15,
        head: [
          [
            "RANK",
            "PUPIL",
            "YEARLY SCORE"
          ]
        ],
        body:
          selectedSubjectYearlyRanking
            .slice(0, 5)
            .map(
              (item) => [
                item.rank,
                item.studentName,
                item.score.toFixed(
                  2
                )
              ]
            ),
        theme: "grid"
      });
    }

    doc.save(
      `${selectedClass}_Result_Dashboard_${academicYear}.pdf`
    );
  };

  // =========================================================
  // 25. ASSESSMENT LABEL
  // =========================================================

  const assessmentLabel = (
    type
  ) => {
    const labels = {
      test1: "Test 1",
      test2: "Test 2",
      test3: "Test 3",
      exam: "Exam"
    };

    return (
      labels[type] || type
    );
  };

  // =========================================================
  // 26. LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="min-h-[500px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">
            📊
          </div>

          <h2 className="text-xl font-bold text-gray-800">
            Preparing Result Dashboard...
          </h2>

          <p className="text-gray-500 mt-2">
            Loading pupils and results
          </p>
        </div>
      </div>
    );
  }

  // =========================================================
  // 27. UI
  // =========================================================

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 bg-gray-50 min-h-screen">

      {/* HEADER */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
              Results Management
            </p>

            <h1 className="text-3xl md:text-4xl font-black text-gray-900 mt-1">
              Result Dashboard
            </h1>

            <p className="text-gray-500 mt-1">
              {schoolName ||
                "School"}{" "}
              • Performance Analytics
            </p>
          </div>

          <button
            onClick={
              handleExportPDF
            }
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition"
          >
            📄 Export Dashboard PDF
          </button>

        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 mb-6">

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">

          {/* YEAR */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">
              Academic Year
            </label>

            <select
              value={academicYear}
              onChange={(e) =>
                setAcademicYear(
                  e.target.value
                )
              }
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold bg-white"
            >
              {academicYears.map(
                (year) => (
                  <option
                    key={year}
                    value={year}
                  >
                    {year}
                  </option>
                )
              )}
            </select>
          </div>

          {/* CLASS */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">
              Class
            </label>

            <select
              value={selectedClass}
              onChange={(e) =>
                setSelectedClass(
                  e.target.value
                )
              }
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold bg-white"
            >
              {availableClasses.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>
          </div>

          {/* TERM */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">
              Term
            </label>

            <select
              value={selectedTerm}
              onChange={(e) =>
                setSelectedTerm(
                  e.target.value
                )
              }
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold bg-white"
            >
              {terms.map(
                (term) => (
                  <option
                    key={term}
                    value={term}
                  >
                    {term}
                  </option>
                )
              )}
            </select>
          </div>

          {/* SUBJECT */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">
              Subject
            </label>

            <select
              value={selectedSubject}
              onChange={(e) =>
                setSelectedSubject(
                  e.target.value
                )
              }
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-semibold bg-white"
            >
              <option value="All Subjects">
                All Subjects
              </option>

              {subjects.map(
                (subject) => (
                  <option
                    key={subject}
                    value={subject}
                  >
                    {subject}
                  </option>
                )
              )}
            </select>
          </div>

          {/* PASS MARK */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-500 mb-2">
              Pass Mark
            </label>

            <input
              type="number"
              min="0"
              max="100"
              value={passMark}
              onChange={(e) =>
                setPassMark(
                  Number(
                    e.target.value
                  )
                )
              }
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-bold bg-white"
            />
          </div>

        </div>
      </div>

      {/* NAVIGATION */}
      <div className="bg-white border border-gray-200 rounded-2xl p-2 mb-6 flex flex-wrap gap-2">

        {[
          [
            "overview",
            "📊 Overview"
          ],
          [
            "subjects",
            "📚 Subjects"
          ],
          [
            "top",
            "🏆 Top Pupils"
          ],
          [
            "assessments",
            "📝 Tests"
          ]
        ].map(
          ([key, label]) => (
            <button
              key={key}
              onClick={() =>
                setActiveSection(
                  key
                )
              }
              className={`px-5 py-3 rounded-xl font-bold text-sm transition ${
                activeSection ===
                key
                  ? "bg-indigo-600 text-white shadow"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {label}
            </button>
          )
        )}

      </div>

      {/* =====================================================
          OVERVIEW
      ===================================================== */}

      {activeSection ===
        "overview" && (
        <div className="space-y-6">

          {/* STAT CARDS */}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
              <p className="text-xs font-bold uppercase text-gray-500">
                Total Pupils
              </p>

              <p className="text-4xl font-black text-gray-900 mt-3">
                {
                  termSummary.total
                }
              </p>

              <p className="text-sm text-gray-500 mt-2">
                {selectedTerm} Evaluated
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-emerald-200 p-6 shadow-sm">
              <p className="text-xs font-bold uppercase text-emerald-600">
                Passed
              </p>

              <p className="text-4xl font-black text-emerald-600 mt-3">
                {
                  termSummary.pass
                }
              </p>

              <p className="text-sm text-emerald-700 font-semibold mt-2">
                {
                  termSummary.passPercentage
                }
                % Pass Rate
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-rose-200 p-6 shadow-sm">
              <p className="text-xs font-bold uppercase text-rose-600">
                Failed
              </p>

              <p className="text-4xl font-black text-rose-600 mt-3">
                {
                  termSummary.fail
                }
              </p>

              <p className="text-sm text-rose-700 font-semibold mt-2">
                {
                  termSummary.failPercentage
                }
                % Fail Rate
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-indigo-200 p-6 shadow-sm">
              <p className="text-xs font-bold uppercase text-indigo-600">
                Active Subjects
              </p>

              <p className="text-4xl font-black text-indigo-600 mt-3">
                {
                  subjects.length
                }
              </p>

              <p className="text-sm text-gray-500 mt-2">
                Registered in System
              </p>
            </div>

          </div>

          {/* OVERALL RESULTS */}

          <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">

            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Term Overall Pupil Results (
              {selectedTerm})
            </h2>

            <div className="overflow-x-auto">

              <table className="w-full text-left border-collapse">

                <thead>
                  <tr className="border-b border-gray-200 text-xs font-bold uppercase text-gray-500">

                    <th className="py-3 px-4">
                      Pupil Name
                    </th>

                    <th className="py-3 px-4 text-center">
                      Subjects
                    </th>

                    <th className="py-3 px-4 text-center">
                      Total Score
                    </th>

                    <th className="py-3 px-4 text-center">
                      Average
                    </th>

                    <th className="py-3 px-4 text-center">
                      Passed
                    </th>

                    <th className="py-3 px-4 text-center">
                      Failed
                    </th>

                    <th className="py-3 px-4 text-center">
                      Status
                    </th>

                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 font-semibold text-sm text-gray-700">

                  {termOverallResults.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="py-8 text-center text-gray-400"
                      >
                        No results calculated for this selection.
                      </td>
                    </tr>
                  ) : (
                    termOverallResults.map(
                      (item) => {
                        const isPass =
                          item.average >=
                          Number(
                            passMark
                          );

                        return (
                          <tr
                            key={
                              item.studentID
                            }
                            className="hover:bg-gray-50"
                          >
                            <td className="py-3 px-4 font-bold text-gray-900">
                              {
                                item.studentName
                              }
                            </td>

                            <td className="py-3 px-4 text-center">
                              {
                                item.subjectCount
                              }
                            </td>

                            <td className="py-3 px-4 text-center">
                              {item.total.toFixed(
                                2
                              )}
                            </td>

                            <td className="py-3 px-4 text-center font-bold text-indigo-600">
                              {item.average.toFixed(
                                2
                              )}
                              %
                            </td>

                            <td className="py-3 px-4 text-center text-emerald-600">
                              {
                                item.passedSubjects
                              }
                            </td>

                            <td className="py-3 px-4 text-center text-rose-600">
                              {
                                item.failedSubjects
                              }
                            </td>

                            <td className="py-3 px-4 text-center">

                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                                  isPass
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {isPass
                                  ? "PASS"
                                  : "FAIL"}
                              </span>

                            </td>

                          </tr>
                        );
                      }
                    )
                  )}

                </tbody>

              </table>

            </div>
          </div>

        </div>
      )}

      {/* =====================================================
          SUBJECTS
      ===================================================== */}

      {activeSection ===
        "subjects" && (
        <div className="space-y-6">

          <div>
            <h2 className="text-xl font-bold text-gray-800">
              Detailed Subject Analysis
            </h2>

            <p className="text-sm text-gray-500">
              Detailed subject performance for{" "}
              {selectedTerm}
            </p>
          </div>

          {/* DETAILED SUBJECT TABLE */}

          <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead>
                  <tr className="bg-gray-100">

                    <th className="p-3 text-left">
                      Subject
                    </th>

                    <th className="p-3 text-center">
                      Pupils
                    </th>

                    <th className="p-3 text-center">
                      Passed
                    </th>

                    <th className="p-3 text-center">
                      Failed
                    </th>

                    <th className="p-3 text-center">
                      Pass Rate
                    </th>

                    <th className="p-3 text-center">
                      Average
                    </th>

                    <th className="p-3 text-center">
                      Highest
                    </th>

                    <th className="p-3 text-center">
                      Lowest
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {subjectAnalysis.map(
                    (item) => (
                      <tr
                        key={
                          item.subject
                        }
                        className="border-b hover:bg-gray-50"
                      >

                        <td className="p-3 font-bold">
                          {
                            item.subject
                          }
                        </td>

                        <td className="p-3 text-center">
                          {
                            item.total
                          }
                        </td>

                        <td className="p-3 text-center text-emerald-600 font-bold">
                          {
                            item.pass
                          }
                        </td>

                        <td className="p-3 text-center text-rose-600 font-bold">
                          {
                            item.fail
                          }
                        </td>

                        <td className="p-3 text-center font-bold">
                          {
                            item.passRate
                          }
                          %
                        </td>

                        <td className="p-3 text-center">
                          {Number(
                            item.average
                          ).toFixed(
                            2
                          )}
                        </td>

                        <td className="p-3 text-center text-emerald-600 font-bold">
                          {Number(
                            item.highest
                          ).toFixed(
                            2
                          )}
                        </td>

                        <td className="p-3 text-center text-rose-600 font-bold">
                          {Number(
                            item.lowest
                          ).toFixed(
                            2
                          )}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>

          </div>

          {/* TOP 5 PER SUBJECT */}

          <div>

            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Top 5 Pupils Per Subject
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {subjectAnalysis.map(
                (item) => (
                  <div
                    key={
                      item.subject
                    }
                    className="bg-white rounded-3xl shadow-sm border overflow-hidden"
                  >

                    <div className="bg-gradient-to-r from-[#800000] to-[#4a0000] text-white p-4">

                      <div className="flex items-center justify-between">

                        <h4 className="font-bold">
                          {
                            item.subject
                          }
                        </h4>

                        <span className="text-xs bg-white/20 px-2 py-1 rounded">
                          Top 5
                        </span>

                      </div>

                    </div>

                    <div className="p-4">

                      <div className="grid grid-cols-3 gap-2 mb-4">

                        <div className="bg-gray-50 rounded-lg p-3 text-center">

                          <p className="text-xs text-gray-500">
                            Average
                          </p>

                          <p className="font-bold">
                            {Number(
                              item.average
                            ).toFixed(
                              2
                            )}
                          </p>

                        </div>

                        <div className="bg-green-50 rounded-lg p-3 text-center">

                          <p className="text-xs text-green-600">
                            Pass
                          </p>

                          <p className="font-bold text-green-700">
                            {
                              item.pass
                            }
                          </p>

                        </div>

                        <div className="bg-red-50 rounded-lg p-3 text-center">

                          <p className="text-xs text-red-600">
                            Fail
                          </p>

                          <p className="font-bold text-red-700">
                            {
                              item.fail
                            }
                          </p>

                        </div>

                      </div>

                      <div className="overflow-x-auto">

                        <table className="w-full text-sm">

                          <thead>
                            <tr className="bg-gray-100">

                              <th className="p-3 text-left">
                                Rank
                              </th>

                              <th className="p-3 text-left">
                                Pupil
                              </th>

                              <th className="p-3 text-right">
                                Score
                              </th>

                            </tr>
                          </thead>

                          <tbody>

                            {item.top5.map(
                              (
                                pupil,
                                index
                              ) => (
                                <tr
                                  key={`${pupil.studentID}-${index}`}
                                  className="border-b"
                                >

                                  <td className="p-3 font-bold">
                                    #
                                    {index +
                                      1}
                                  </td>

                                  <td className="p-3 font-medium">
                                    {
                                      pupil.studentName
                                    }
                                  </td>

                                  <td className="p-3 text-right font-bold">
                                    {Number(
                                      pupil.score
                                    ).toFixed(
                                      2
                                    )}
                                  </td>

                                </tr>
                              )
                            )}

                          </tbody>

                        </table>

                      </div>

                    </div>

                  </div>
                )
              )}

            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          TOP PUPILS
      ===================================================== */}

      {activeSection === "top" && (
        <div className="space-y-6">

          {/* SELECTED SUBJECT */}

          {selectedSubject !==
            "All Subjects" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* TERM */}

              <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">

                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Top Rankings:{" "}
                  {
                    selectedSubject
                  }{" "}
                  ({selectedTerm})
                </h2>

                <div className="space-y-3">

                  {selectedSubjectTermRanking
                    .slice(0, 10)
                    .map(
                      (p) => (
                        <div
                          key={
                            p.studentID
                          }
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                        >

                          <div className="flex items-center gap-3">

                            <span className="w-7 h-7 flex items-center justify-center font-black text-xs bg-indigo-100 text-indigo-700 rounded-full">
                              #
                              {
                                p.rank
                              }
                            </span>

                            <span className="font-bold text-gray-800">
                              {
                                p.studentName
                              }
                            </span>

                          </div>

                          <span className="font-extrabold text-indigo-600">
                            {Number(
                              p.score
                            ).toFixed(
                              2
                            )}
                          </span>

                        </div>
                      )
                    )}

                </div>

              </div>

              {/* YEARLY SUBJECT */}

              <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">

                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Top Rankings:{" "}
                  {
                    selectedSubject
                  }{" "}
                  (Annual)
                </h2>

                <div className="space-y-3">

                  {selectedSubjectYearlyRanking
                    .slice(0, 10)
                    .map(
                      (p) => (
                        <div
                          key={
                            p.studentID
                          }
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                        >

                          <div className="flex items-center gap-3">

                            <span className="w-7 h-7 flex items-center justify-center font-black text-xs bg-amber-100 text-amber-800 rounded-full">
                              #
                              {
                                p.rank
                              }
                            </span>

                            <span className="font-bold text-gray-800">
                              {
                                p.studentName
                              }
                            </span>

                          </div>

                          <span className="font-extrabold text-amber-600">
                            {Number(
                              p.score
                            ).toFixed(
                              2
                            )}
                          </span>

                        </div>
                      )
                    )}

                </div>

              </div>

            </div>
          )}

          {/* OVERALL TOP 10 */}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* TOP 10 TERM */}

            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">

              <h2 className="text-lg font-bold text-gray-900 mb-4">
                🏆 Top 10 Overall (
                {selectedTerm})
              </h2>

              <div className="overflow-x-auto">

                <table className="w-full text-left">

                  <thead>
                    <tr className="border-b border-gray-200 text-xs font-bold uppercase text-gray-500">

                      <th className="py-2 px-2">
                        Rank
                      </th>

                      <th className="py-2 px-2">
                        Pupil
                      </th>

                      <th className="py-2 px-2 text-center">
                        Average
                      </th>

                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 text-sm font-semibold">

                    {top10Term.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan="3"
                          className="py-8 text-center text-gray-400"
                        >
                          No term ranking available.
                        </td>
                      </tr>
                    ) : (
                      top10Term.map(
                        (p) => (
                          <tr
                            key={
                              p.studentID
                            }
                          >

                            <td className="py-3 px-2 font-bold text-indigo-600">
                              #
                              {
                                p.rank
                              }
                            </td>

                            <td className="py-3 px-2 text-gray-800">
                              {
                                p.studentName
                              }
                            </td>

                            <td className="py-3 px-2 text-center font-bold text-gray-900">
                              {Number(
                                p.average
                              ).toFixed(
                                2
                              )}
                              %
                            </td>

                          </tr>
                        )
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>

            {/* TOP 10 YEARLY */}

            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">

              <div className="flex items-center justify-between mb-4">

                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    👑 Top 10 Overall (Annual)
                  </h2>

                  <p className="text-xs text-gray-500 mt-1">
                    Based on Term 1 + Term 2 + Term 3
                  </p>
                </div>

                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
                  YEARLY
                </span>

              </div>

              <div className="overflow-x-auto">

                <table className="w-full text-left">

                  <thead>
                    <tr className="border-b border-gray-200 text-xs font-bold uppercase text-gray-500">

                      <th className="py-2 px-2">
                        Rank
                      </th>

                      <th className="py-2 px-2">
                        Pupil
                      </th>

                      <th className="py-2 px-2 text-center">
                        Annual Avg
                      </th>

                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 text-sm font-semibold">

                    {top10Yearly.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan="3"
                          className="py-8 text-center text-gray-400"
                        >
                          No yearly ranking available.
                        </td>
                      </tr>
                    ) : (
                      top10Yearly.map(
                        (p) => (
                          <tr
                            key={
                              p.studentID
                            }
                          >

                            <td className="py-3 px-2 font-bold text-amber-600">
                              #
                              {
                                p.rank
                              }
                            </td>

                            <td className="py-3 px-2 text-gray-800">
                              {
                                p.studentName
                              }
                            </td>

                            <td className="py-3 px-2 text-center font-bold text-gray-900">
                              {Number(
                                p.average
                              ).toFixed(
                                2
                              )}
                              %
                            </td>

                          </tr>
                        )
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          ASSESSMENTS
      ===================================================== */}

      {activeSection ===
        "assessments" && (
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm space-y-6">

          <h2 className="text-xl font-bold text-gray-900">
            Assessment & Test Breakdown (
            {selectedTerm})
          </h2>

          {selectedSubject !==
          "All Subjects" ? (
            <div>

              <h3 className="text-lg font-bold text-indigo-600 mb-3">
                Subject:{" "}
                {
                  selectedSubject
                }
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                {selectedSubjectAssessments.map(
                  (a) => (
                    <div
                      key={a.type}
                      className="p-4 rounded-2xl border border-gray-200 bg-gray-50"
                    >

                      <p className="text-xs font-bold uppercase text-gray-500">
                        {assessmentLabel(
                          a.type
                        )}
                      </p>

                      <p className="text-2xl font-black text-gray-900 mt-2">
                        {
                          a.average
                        }{" "}
                        <span className="text-xs font-normal text-gray-500">
                          avg mark
                        </span>
                      </p>

                      <div className="mt-3 flex justify-between text-xs font-bold border-t border-gray-200 pt-2">

                        <span className="text-emerald-600">
                          Pass:{" "}
                          {
                            a.pass
                          }
                        </span>

                        <span className="text-rose-600">
                          Fail:{" "}
                          {
                            a.fail
                          }
                        </span>

                        <span className="text-gray-500">
                          Total:{" "}
                          {
                            a.total
                          }
                        </span>

                      </div>

                    </div>
                  )
                )}

              </div>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full text-left border-collapse">

                <thead>
                  <tr className="border-b border-gray-200 text-xs font-bold uppercase text-gray-500">

                    <th className="py-3 px-4">
                      Subject
                    </th>

                    {assessmentTypes.map(
                      (type) => (
                        <th
                          key={type}
                          className="py-3 px-4 text-center"
                        >
                          {
                            assessmentLabel(
                              type
                            )
                          }{" "}
                          Avg
                        </th>
                      )
                    )}

                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 font-semibold text-sm text-gray-700">

                  {subjects.map(
                    (subject) => (
                      <tr
                        key={
                          subject
                        }
                        className="hover:bg-gray-50"
                      >

                        <td className="py-3 px-4 font-bold text-gray-900">
                          {
                            subject
                          }
                        </td>

                        {assessmentTypes.map(
                          (type) => {
                            const score =
                              assessmentSummary[
                                subject
                              ]?.[
                                type
                              ]?.average ||
                              0;

                            return (
                              <td
                                key={
                                  type
                                }
                                className="py-3 px-4 text-center font-bold text-indigo-600"
                              >
                                {
                                  score
                                }
                              </td>
                            );
                          }
                        )}

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default ResultDashboard;