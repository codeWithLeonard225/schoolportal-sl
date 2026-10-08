import React, { useEffect, useMemo, useState } from "react";
import { schooldb } from "../Database/SchoolsResults";
import { db } from "../../../firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
} from "firebase/firestore";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation } from "react-router-dom";

import {
  getTermScores,
  calculateAnnualMean
} from "../Utilis/ResultCalculators";

const PASS_MARK = 50;

const formatPercentage = (value) => {
  const number = Number(value);

  return `${(Number.isFinite(number) ? number : 0).toFixed(1)}%`;
};

const ResultDashboard = () => {
  const location = useLocation();

  const schoolId = location.state?.schoolId || "";
  const schoolName =
    location.state?.schoolName ||
    "Government Model Senior Secondary School";

  const [academicYear, setAcademicYear] = useState("");
  const [academicYears, setAcademicYears] = useState([]);

  const [selectedClass, setSelectedClass] = useState("");
  const [availableClasses, setAvailableClasses] = useState([]);

  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [selectedSubject, setSelectedSubject] =
    useState("All Subjects");

  const [pupils, setPupils] = useState([]);
  const [allGrades, setAllGrades] = useState([]);

  const [loading, setLoading] = useState(true);

  const [passMark, setPassMark] = useState(PASS_MARK);

  const [activeSection, setActiveSection] =
    useState("overview");

    const [registeredPupils, setRegisteredPupils] = useState([]);

    useEffect(() => {
  const fetchRegisteredPupils = async () => {
    try {
      const snapshot = await getDocs(
        collection(db, "PupilsReg")
      );

      const records = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));

      setRegisteredPupils(records);
    } catch (error) {
      console.error(
        "Error fetching registered pupils:",
        error
      );
    }
  };

  fetchRegisteredPupils();
}, []);



  const terms = ["Term 1", "Term 2", "Term 3"];

  /* =========================================================
     LOAD AVAILABLE ACADEMIC YEARS AND CLASSES
  ========================================================= */

  useEffect(() => {
    if (!schoolId) return;

    const gradesQuery = query(
      collection(schooldb, "PupilGrades"),
      where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(
      gradesQuery,
      (snapshot) => {
        const grades = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));

        setAllGrades(grades);

        const years = [
          ...new Set(
            grades
              .map(
                (item) =>
                  item.academicYear ||
                  item.academic_year ||
                  item.year ||
                  ""
              )
              .filter(Boolean)
          )
        ];

        const classes = [
          ...new Set(
            grades
              .map(
                (item) =>
                  item.className ||
                  item.class ||
                  item.studentClass ||
                  ""
              )
              .filter(Boolean)
          )
        ];

        setAcademicYears(years.sort().reverse());
        setAvailableClasses(classes.sort());

        if (!academicYear && years.length > 0) {
          setAcademicYear(years[0]);
        }

        if (!selectedClass && classes.length > 0) {
          setSelectedClass(classes[0]);
        }
      },
      (error) => {
        console.error("Error loading grades:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [schoolId]);

  /* =========================================================
     LOAD PUPILS
  ========================================================= */

  useEffect(() => {
  if (!schoolId || !academicYear || !selectedClass) {
    setPupils([]);
    return;
  }

  setLoading(true);

  const filtered = allGrades.filter((grade) => {
    const gradeYear =
      grade.academicYear ||
      grade.academic_year ||
      grade.year ||
      "";

    const gradeClass =
      grade.className ||
      grade.class ||
      grade.studentClass ||
      "";

    return (
      grade.schoolId === schoolId &&
      gradeYear === academicYear &&
      gradeClass.trim() === selectedClass.trim()
    );
  });

  const pupilMap = new Map();

  filtered.forEach((grade) => {
    const studentID =
      grade.studentID ||
      grade.studentId ||
      grade.pupilID ||
      grade.pupilId;

    if (!studentID) return;

    if (!pupilMap.has(studentID)) {
     const pupilID = String(
  grade.pupilID ||
  grade.pupilId ||
  grade.studentID ||
  grade.studentId ||
  ""
);

const registeredPupil = registeredPupils.find(
  (pupil) =>
    String(pupil.id) === pupilID ||
    String(pupil.studentID || "") === pupilID ||
    String(pupil.studentId || "") === pupilID
);

const registeredName = registeredPupil
  ? [
      registeredPupil.studentName,
      registeredPupil.pupilName,
      registeredPupil.name,
      [
        registeredPupil.firstName,
        registeredPupil.middleName,
        registeredPupil.lastName,
      ]
        .filter(Boolean)
        .join(" "),
    ].find((name) => name && name.trim())
  : "";

const studentName =
  registeredName ||
  grade.studentName ||
  grade.pupilName ||
  grade.name ||
  [
    grade.firstName,
    grade.middleName,
    grade.lastName,
  ]
    .filter(Boolean)
    .join(" ") ||
  `Pupil ${studentID}`;

      pupilMap.set(studentID, {
        studentID,
        studentName,
        className:
          grade.className ||
          grade.class ||
          grade.studentClass ||
          selectedClass,
        academicYear:
          grade.academicYear ||
          grade.academic_year ||
          grade.year ||
          academicYear
      });
    }
  });

  const pupilData = Array.from(pupilMap.values()).sort(
    (a, b) =>
      (a.studentName || "").localeCompare(
        b.studentName || ""
      )
  );

  setPupils(pupilData);

  setLoading(false);
}, [
  allGrades,
  schoolId,
  academicYear,
  selectedClass,
  registeredPupils,
]);

  /* =========================================================
     FILTER GRADES
  ========================================================= */

  const filteredGrades = useMemo(() => {
    if (!schoolId || !academicYear || !selectedClass) {
      return [];
    }

    return allGrades.filter((grade) => {
      const gradeYear =
        grade.academicYear ||
        grade.academic_year ||
        grade.year ||
        "";

      const gradeClass =
        grade.className ||
        grade.class ||
        grade.studentClass ||
        "";

      return (
        grade.schoolId === schoolId &&
        gradeYear === academicYear &&
        gradeClass === selectedClass
      );
    });
  }, [
    allGrades,
    schoolId,
    academicYear,
    selectedClass
  ]);

  /* =========================================================
     SUBJECTS
  ========================================================= */

  const subjects = useMemo(() => {
    return [
      ...new Set(
        filteredGrades
          .map((item) => item.subject)
          .filter(Boolean)
      )
    ].sort();
  }, [filteredGrades]);

  /* =========================================================
     HELPERS
  ========================================================= */

  const getStudentId = (pupil) => {
    return (
      pupil?.studentID ||
      pupil?.studentId ||
      pupil?.pupilID ||
      pupil?.pupilId ||
      pupil?.id ||
      ""
    );
  };

  const getStudentName = (pupil) => {
    return (
      pupil?.studentName ||
      pupil?.pupilName ||
      pupil?.name ||
      `${pupil?.firstName || ""} ${
        pupil?.middleName || ""
      } ${pupil?.lastName || ""}`.trim() ||
      "Unknown Pupil"
    );
  };

  /* =========================================================
     ASSESSMENT HELPER

     Assessment scores are stored as:

     {
       test: "Term 1 T1",
       grade: 45
     }

     This helper reads the actual grade field.
  ========================================================= */

  const getAssessmentValue = (grade) => {
    if (!grade) return null;

    if (
      grade.grade === undefined ||
      grade.grade === null ||
      grade.grade === ""
    ) {
      return null;
    }

    const value = Number(grade.grade);

    if (Number.isNaN(value)) {
      return null;
    }

    return value;
  };

  const getSubjectTermMean = (
    studentID,
    subject,
    term
  ) => {
    try {
      const result = getTermScores(
        filteredGrades,
        studentID,
        subject,
        term
      );

      if (
        result === null ||
        result === undefined
      ) {
        return 0;
      }

      if (typeof result === "number") {
        return result;
      }

      if (typeof result === "object") {
        const possibleValues = [
          result.mean,
          result.average,
          result.termMean,
          result.score,
          result.total
        ];

        for (const value of possibleValues) {
          if (
            value !== undefined &&
            value !== null &&
            !Number.isNaN(Number(value))
          ) {
            return Number(value);
          }
        }
      }

      return 0;
    } catch (error) {
      console.error(
        "Error calculating term mean:",
        error
      );

      return 0;
    }
  };

  /* =========================================================
     ASSESSMENT TYPES

     UPDATED ONLY FOR ASSESSMENT

     Term 1:
       Term 1 T1
       Term 1 T2

     Term 2:
       Term 2 T1
       Term 2 T2

     Term 3:
       Term 3 T1
       Term 3 T2
  ========================================================= */

  const termTests = {
    "Term 1": [
      "Term 1 T1",
      "Term 1 T2"
    ],
    "Term 2": [
      "Term 2 T1",
      "Term 2 T2"
    ],
    "Term 3": [
      "Term 3 T1",
      "Term 3 T2"
    ]
  };

  const assessmentTypes = useMemo(() => {
    const testsForTerm =
      termTests[selectedTerm] || [];

    return testsForTerm.map(
      (testName, index) => ({
        key: testName,
        label: `Test ${index + 1}`,
        databaseTest: testName
      })
    );
  }, [selectedTerm]);

  /* =========================================================
     TERM SUBJECT SUMMARY

     UNCHANGED
  ========================================================= */

  const termSubjectData = useMemo(() => {
    const result = {};

    subjects.forEach((subject) => {
      const scores = [];

      pupils.forEach((pupil) => {
        const studentID = getStudentId(pupil);

        if (!studentID) return;

        const score = getSubjectTermMean(
          studentID,
          subject,
          selectedTerm
        );

        if (
          score !== null &&
          score !== undefined &&
          !Number.isNaN(Number(score)) &&
          Number(score) > 0
        ) {
          scores.push(Number(score));
        }
      });

      const total = scores.length;

      const pass = scores.filter(
        (score) =>
          score >= Number(passMark)
      ).length;

      const fail = total - pass;

      const average =
        total > 0
          ? scores.reduce(
              (sum, score) =>
                sum + score,
              0
            ) / total
          : 0;

      result[subject] = {
        total,
        pass,
        fail,
        average
      };
    });

    return result;
  }, [
    subjects,
    pupils,
    filteredGrades,
    selectedTerm,
    passMark
  ]);

  /* =========================================================
     OVERVIEW SUBJECT SNAPSHOT

     UNCHANGED
  ========================================================= */

  const subjectTable = useMemo(() => {
    return subjects.map((subject) => {
      const data =
        termSubjectData[subject] || {};

      return {
        subject,
        total: data.total || 0,
        pass: data.pass || 0,
        fail: data.fail || 0,
        average: data.average || 0,
        passRate:
          data.total > 0
            ? (
                (data.pass /
                  data.total) *
                100
              ).toFixed(1)
            : "0.0"
      };
    });
  }, [subjects, termSubjectData]);

  /* =========================================================
     TERM OVERALL RESULTS

     UNCHANGED
  ========================================================= */

  const termOverallResults = useMemo(() => {
    return pupils
      .map((pupil) => {
        const studentID = getStudentId(pupil);

        const subjectScores = subjects
          .map((subject) =>
            getSubjectTermMean(
              studentID,
              subject,
              selectedTerm
            )
          )
          .filter(
            (score) =>
              score !== null &&
              score !== undefined &&
              !Number.isNaN(Number(score)) &&
              Number(score) > 0
          )
          .map(Number);

        const totalSubjects =
          subjectScores.length;

        const average =
          totalSubjects > 0
            ? subjectScores.reduce(
                (sum, score) =>
                  sum + score,
                0
              ) / totalSubjects
            : 0;

        return {
          studentID,
          studentName:
            getStudentName(pupil),
          average,
          totalSubjects,
          pass:
            totalSubjects > 0 &&
            average >=
              Number(passMark)
        };
      })
      .filter(
        (item) =>
          item.totalSubjects > 0
      );
  }, [
    pupils,
    subjects,
    selectedTerm,
    passMark,
    filteredGrades
  ]);

  /* =========================================================
     TERM SUMMARY

     UNCHANGED
  ========================================================= */

  const termSummary = useMemo(() => {
    const total =
      termOverallResults.length;

    const pass =
      termOverallResults.filter(
        (item) => item.pass
      ).length;

    const fail = total - pass;

    const average =
      total > 0
        ? termOverallResults.reduce(
            (sum, item) =>
              sum + item.average,
            0
          ) / total
        : 0;

    return {
      total,
      pass,
      fail,
      average
    };
  }, [termOverallResults]);

  /* =========================================================
     TERM RANKING
  ========================================================= */

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
          b.totalSubjects -
          a.totalSubjects
        );
      })
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));
  }, [termOverallResults]);

  const top10Term = useMemo(() => {
    return termRanking.slice(0, 10);
  }, [termRanking]);

  /* =========================================================
     YEARLY RESULTS

     UNCHANGED
  ========================================================= */

  const yearlyStudentResults = useMemo(() => {
    const results = [];

    pupils.forEach((pupil) => {
      const studentID =
        getStudentId(pupil);

      const subjectResults = [];

      subjects.forEach((subject) => {
        const t1 =
          getTermScores(
            filteredGrades,
            studentID,
            subject,
            "Term 1"
          );

        const t2 =
          getTermScores(
            filteredGrades,
            studentID,
            subject,
            "Term 2"
          );

        const t3 =
          getTermScores(
            filteredGrades,
            studentID,
            subject,
            "Term 3"
          );

        const yearlyMean =
          calculateAnnualMean(
            t1?.mean || 0,
            t2?.mean || 0,
            t3?.mean || 0,
            "auto"
          );

        if (
          Number.isFinite(
            Number(yearlyMean)
          ) &&
          Number(yearlyMean) > 0
        ) {
          subjectResults.push({
            subject,
            yearlyMean:
              Number(yearlyMean)
          });
        }
      });

      if (
        subjectResults.length === 0
      ) {
        return;
      }

      const total =
        subjectResults.reduce(
          (sum, item) =>
            sum + item.yearlyMean,
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

      results.push({
        studentID,
        studentName:
          getStudentName(pupil),
        total,
        average,
        percentage: average,
        passedSubjects,
        failedSubjects:
          subjectResults.length -
          passedSubjects,
        totalSubjects:
          subjectResults.length,
        subjects:
          subjectResults,
        pass:
          average >=
          Number(passMark)
      });
    });

    return results;
  }, [
    pupils,
    subjects,
    filteredGrades,
    passMark
  ]);

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

        return b.total - a.total;
      })
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));
  }, [yearlyStudentResults]);

  const top10Yearly = useMemo(() => {
    return yearlyRanking.slice(0, 10);
  }, [yearlyRanking]);

  /* =========================================================
     SELECTED SUBJECT TERM TOP 5
  ========================================================= */

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
            getStudentId(pupil);

          const score =
            getSubjectTermMean(
              studentID,
              selectedSubject,
              selectedTerm
            );

          return {
            studentID,
            studentName:
              getStudentName(pupil),
            score:
              Number(score) || 0
          };
        })
        .filter(
          (item) =>
            item.score > 0
        )
        .sort(
          (a, b) =>
            b.score - a.score
        )
        .map((item, index) => ({
          ...item,
          rank: index + 1
        }));
    }, [
      pupils,
      selectedSubject,
      selectedTerm,
      filteredGrades
    ]);

  /* =========================================================
     SELECTED SUBJECT YEARLY TOP 5
  ========================================================= */

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
          getStudentId(pupil);

        const t1 =
          getTermScores(
            filteredGrades,
            studentID,
            selectedSubject,
            "Term 1"
          );

        const t2 =
          getTermScores(
            filteredGrades,
            studentID,
            selectedSubject,
            "Term 2"
          );

        const t3 =
          getTermScores(
            filteredGrades,
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

        if (
          Number.isFinite(
            Number(yearlyMean)
          ) &&
          Number(yearlyMean) > 0
        ) {
          results.push({
            studentID,
            studentName:
              getStudentName(pupil),
            score:
              Number(yearlyMean)
          });
        }
      });

      return results
        .sort(
          (a, b) =>
            b.score - a.score
        )
        .map((item, index) => ({
          ...item,
          rank: index + 1
        }));
    }, [
      pupils,
      selectedSubject,
      filteredGrades
    ]);

  /* =========================================================
     DETAILED SUBJECT ANALYSIS

     UNCHANGED
  ========================================================= */

  const subjectAnalysis = useMemo(() => {
    return subjects.map((subject) => {
      const pupilScores = pupils
        .map((pupil) => {
          const studentID =
            getStudentId(pupil);

          const score =
            getSubjectTermMean(
              studentID,
              subject,
              selectedTerm
            );

          return {
            studentID,
            studentName:
              getStudentName(pupil),
            score:
              Number(score) || 0
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
          b.score - a.score
      );

      const total =
        pupilScores.length;

      const pass =
        pupilScores.filter(
          (item) =>
            item.score >=
            Number(passMark)
        ).length;

      const fail = total - pass;

      const average =
        total > 0
          ? pupilScores.reduce(
              (sum, item) =>
                sum + item.score,
              0
            ) / total
          : 0;

      const highest =
        sortedScores.length > 0
          ? sortedScores[0].score
          : 0;

      const lowest =
        sortedScores.length > 0
          ? sortedScores[
              sortedScores.length - 1
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
                (pass / total) *
                100
              ).toFixed(1)
            : "0.0",
        top5:
          sortedScores.slice(0, 5)
      };
    });
  }, [
    subjects,
    pupils,
    selectedTerm,
    passMark,
    filteredGrades
  ]);

  /* =========================================================
     SELECTED SUBJECT DETAILS

     UNCHANGED
  ========================================================= */

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

  /* =========================================================
     ASSESSMENT SUMMARY

     UPDATED ONLY FOR ASSESSMENT

     Reads:

       grade.test
       grade.grade

     Example:

       test: "Term 1 T1"
       grade: 45
  ========================================================= */

  const assessmentSummary =
    useMemo(() => {
      const result = {};

      subjects.forEach((subject) => {
        result[subject] = {};

        assessmentTypes.forEach(
          (assessment) => {
            const scores =
              filteredGrades
                .filter(
                  (grade) =>
                    grade.subject ===
                      subject &&
                    grade.test ===
                      assessment.databaseTest
                )
                .map((grade) =>
                  getAssessmentValue(
                    grade
                  )
                )
                .filter(
                  (value) =>
                    value !== null &&
                    !Number.isNaN(
                      Number(value)
                    )
                )
                .map(Number);

            const total =
              scores.length;

            const pass =
              scores.filter(
                (score) =>
                  score >=
                  Number(passMark)
              ).length;

            const fail =
              total - pass;

            const average =
              total > 0
                ? scores.reduce(
                    (
                      sum,
                      score
                    ) =>
                      sum + score,
                    0
                  ) / total
                : 0;

            const highest =
              total > 0
                ? Math.max(
                    ...scores
                  )
                : 0;

            const lowest =
              total > 0
                ? Math.min(
                    ...scores
                  )
                : 0;

            result[subject][
              assessment.key
            ] = {
              total,
              pass,
              fail,
              average,
              highest,
              lowest,
              scores
            };
          }
        );
      });

      return result;
    }, [
      subjects,
      assessmentTypes,
      filteredGrades,
      passMark
    ]);

  /* =========================================================
     ASSESSMENT OVERALL ANALYSIS

     UPDATED ONLY FOR ASSESSMENT
  ========================================================= */

  const assessmentOverall =
    useMemo(() => {
      return assessmentTypes.map(
        (assessment) => {
          const scores =
            filteredGrades
              .filter(
                (grade) =>
                  grade.test ===
                  assessment.databaseTest
              )
              .map((grade) =>
                getAssessmentValue(
                  grade
                )
              )
              .filter(
                (value) =>
                  value !== null &&
                  !Number.isNaN(
                    Number(value)
                  )
              )
              .map(Number);

          const total =
            scores.length;

          const pass =
            scores.filter(
              (score) =>
                score >=
                Number(passMark)
            ).length;

          const fail =
            total - pass;

          const average =
            total > 0
              ? scores.reduce(
                  (
                    sum,
                    score
                  ) =>
                    sum + score,
                  0
                ) / total
              : 0;

          const highest =
            total > 0
              ? Math.max(
                  ...scores
                )
              : 0;

          const lowest =
            total > 0
              ? Math.min(
                  ...scores
                )
              : 0;

          return {
            key:
              assessment.key,
            label:
              assessment.label,
            databaseTest:
              assessment.databaseTest,
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
                : "0.0"
          };
        }
      );
    }, [
      assessmentTypes,
      filteredGrades,
      passMark
    ]);

  /* =========================================================
     STRONGEST / WEAKEST ASSESSMENT
  ========================================================= */

  const strongestAssessment =
    useMemo(() => {
      const available =
        assessmentOverall.filter(
          (item) =>
            item.total > 0
        );

      if (available.length === 0) {
        return null;
      }

      return [...available].sort(
        (a, b) =>
          b.average - a.average
      )[0];
    }, [assessmentOverall]);

  const weakestAssessment =
    useMemo(() => {
      const available =
        assessmentOverall.filter(
          (item) =>
            item.total > 0
        );

      if (available.length === 0) {
        return null;
      }

      return [...available].sort(
        (a, b) =>
          a.average - b.average
      )[0];
    }, [assessmentOverall]);

  /* =========================================================
     OVERALL ASSESSMENT AVERAGE
  ========================================================= */

  const overallAssessmentAverage =
    useMemo(() => {
      const valid =
        assessmentOverall.filter(
          (item) =>
            item.total > 0
        );

      if (valid.length === 0) {
        return 0;
      }

      const totalScores =
        valid.reduce(
          (sum, item) =>
            sum + item.average,
          0
        );

      return (
        totalScores /
        valid.length
      );
    }, [assessmentOverall]);

  /* =========================================================
     TOTAL RECORDED ASSESSMENT SCORES
  ========================================================= */

  const totalAssessmentScores =
    useMemo(() => {
      return assessmentOverall.reduce(
        (sum, item) =>
          sum + item.total,
        0
      );
    }, [assessmentOverall]);

  /* =========================================================
     SUBJECT ASSESSMENT PERFORMANCE

     UPDATED ONLY FOR ASSESSMENT
  ========================================================= */

  const subjectAssessmentPerformance =
    useMemo(() => {
      return subjects.map(
        (subject) => {
          const subjectData =
            assessmentSummary[
              subject
            ] || {};

          const assessments =
            assessmentTypes.map(
              (assessment) => {
                return (
                  subjectData[
                    assessment.key
                  ] || {
                    total: 0,
                    pass: 0,
                    fail: 0,
                    average: 0,
                    highest: 0,
                    lowest: 0
                  }
                );
              }
            );

          const totalScores =
            assessments.reduce(
              (sum, item) =>
                sum + item.total,
              0
            );

          const totalPass =
            assessments.reduce(
              (sum, item) =>
                sum + item.pass,
              0
            );

          const weightedAverage =
            assessments.reduce(
              (
                sum,
                item
              ) =>
                sum +
                item.average *
                  item.total,
              0
            );

          const average =
            totalScores > 0
              ? weightedAverage /
                totalScores
              : 0;

          const passRate =
            totalScores > 0
              ? (
                  (totalPass /
                    totalScores) *
                  100
                ).toFixed(1)
              : "0.0";

          return {
            subject,
            average,
            passRate,
            totalScores,
            assessments
          };
        }
      );
    }, [
      subjects,
      assessmentTypes,
      assessmentSummary
    ]);

  /* =========================================================
     PUPILS NEEDING ATTENTION IN ASSESSMENTS

     UPDATED ONLY FOR ASSESSMENT
  ========================================================= */

  const assessmentAtRiskPupils =
    useMemo(() => {
      const results = pupils
        .map((pupil) => {
          const studentID =
            getStudentId(pupil);

          if (!studentID) {
            return null;
          }

          const assessmentScores =
            [];

          filteredGrades.forEach(
            (grade) => {
              const gradeStudentID =
                grade.pupilID ||
                grade.studentID ||
                grade.pupilId ||
                grade.studentId;

              if (
                String(
                  gradeStudentID
                ) !==
                String(studentID)
              ) {
                return;
              }

              const currentTermTest =
                termTests[
                  selectedTerm
                ]?.includes(
                  grade.test
                );

              if (
                !currentTermTest
              ) {
                return;
              }

              const value =
                getAssessmentValue(
                  grade
                );

              if (
                value !== null &&
                !Number.isNaN(
                  Number(value)
                )
              ) {
                assessmentScores.push(
                  Number(value)
                );
              }
            }
          );

          if (
            assessmentScores.length ===
            0
          ) {
            return null;
          }

          const average =
            assessmentScores.reduce(
              (sum, score) =>
                sum + score,
              0
            ) /
            assessmentScores.length;

          const belowPass =
            assessmentScores.filter(
              (score) =>
                score <
                Number(passMark)
            ).length;

          return {
            studentID,
            studentName:
              getStudentName(pupil),
            average,
            belowPass,
            total:
              assessmentScores.length
          };
        })
        .filter(Boolean)
        .sort(
          (a, b) =>
            a.average - b.average
        );

      return results.slice(0, 10);
    }, [
      pupils,
      filteredGrades,
      selectedTerm,
      passMark
    ]);

  /* =========================================================
     SELECTED SUBJECT ASSESSMENTS

     UPDATED ONLY FOR ASSESSMENT
  ========================================================= */

  const selectedSubjectAssessments =
    useMemo(() => {
      if (
        selectedSubject ===
        "All Subjects"
      ) {
        return [];
      }

      return assessmentTypes.map(
        (assessment) => {
          const data =
            assessmentSummary[
              selectedSubject
            ]?.[
              assessment.key
            ] || {};

          return {
            assessment:
              assessment.label,
            total:
              data.total || 0,
            pass:
              data.pass || 0,
            fail:
              data.fail || 0,
            average:
              data.average || 0,
            highest:
              data.highest || 0,
            lowest:
              data.lowest || 0,
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
      selectedSubject,
      assessmentTypes,
      assessmentSummary
    ]);

  /* =========================================================
     PDF EXPORT
  ========================================================= */

  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text(
      schoolName,
      14,
      15
    );

    doc.setFontSize(11);
    doc.text(
      "Result Performance Dashboard",
      14,
      23
    );

    doc.text(
      `Academic Year: ${academicYear}`,
      14,
      31
    );

    doc.text(
      `Class: ${selectedClass}`,
      14,
      38
    );

    doc.text(
      `Term: ${selectedTerm}`,
      14,
      45
    );

    doc.text(
      `Pass Mark: ${passMark}`,
      14,
      52
    );

    /* SUMMARY */

    doc.setFontSize(13);
    doc.text(
      "Overall Performance",
      14,
      63
    );

    autoTable(doc, {
      startY: 68,
      head: [
        [
          "Total Pupils",
          "Passed",
          "Failed",
          "Pass Rate",
          "Class Average"
        ]
      ],
      body: [
        [
          termSummary.total,
          termSummary.pass,
          termSummary.fail,
          termSummary.total > 0
            ? (
                (termSummary.pass /
                  termSummary.total) *
                100
              ).toFixed(1) + "%"
            : "0.0%",
          termSummary.average.toFixed(
            2
          )
        ]
      ],
      theme: "grid"
    });

    /* SUBJECT SNAPSHOT */

    let currentY =
      doc.lastAutoTable.finalY +
      12;

    doc.setFontSize(13);
    doc.text(
      "Subject Performance Snapshot",
      14,
      currentY
    );

    autoTable(doc, {
      startY: currentY + 5,
      head: [
        [
          "Subject",
          "Pupils",
          "Pass",
          "Fail",
          "Pass Rate",
          "Average"
        ]
      ],
      body: subjectTable.map(
        (item) => [
          item.subject,
          item.total,
          item.pass,
          item.fail,
          `${formatPercentage(item.passRate)}%`,
          Number(item.average).toFixed(1)
        ]
      ),
      theme: "grid"
    });

    /* TOP 10 TERM */

    currentY =
      doc.lastAutoTable.finalY +
      12;

    doc.setFontSize(13);
    doc.text(
      `Top 10 Pupils - ${selectedTerm}`,
      14,
      currentY
    );

    autoTable(doc, {
      startY: currentY + 5,
      head: [
        [
          "Rank",
          "Student ID",
          "Pupil",
          "Average"
        ]
      ],
      body: top10Term.map(
        (item) => [
          item.rank,
          item.studentID,
          item.studentName,
          Number(
            item.average
          ).toFixed(1)
        ]
      ),
      theme: "grid"
    });

    /* TOP 10 YEARLY */

    currentY =
      doc.lastAutoTable.finalY +
      12;

    doc.setFontSize(13);
    doc.text(
      "Top 10 Pupils - Yearly",
      14,
      currentY
    );

    autoTable(doc, {
      startY: currentY + 5,
      head: [
        [
          "Rank",
          "Student ID",
          "Pupil",
          "Annual Average"
        ]
      ],
      body: top10Yearly.map(
        (item) => [
          item.rank,
          item.studentID,
          item.studentName,
          Number(
            item.average
          ).toFixed(1)
        ]
      ),
      theme: "grid"
    });

    /* ASSESSMENT SUMMARY */

    doc.addPage();

    doc.setFontSize(14);
    doc.text(
      "Assessment Performance Summary",
      14,
      15
    );

    autoTable(doc, {
      startY: 22,
      head: [
        [
          "Assessment",
          "Pupils",
          "Passed",
          "Failed",
          "Pass Rate",
          "Average"
        ]
      ],
      body:
        assessmentOverall.map(
          (item) => [
            item.label,
            item.total,
            item.pass,
            item.fail,
            `${item.passRate}%`,
            Number(
              item.average
            ).toFixed(1)
          ]
        ),
      theme: "grid"
    });

    if (
      selectedSubject !==
      "All Subjects"
    ) {
      doc.addPage();

      doc.setFontSize(14);
      doc.text(
        `Detailed Subject Analysis: ${selectedSubject}`,
        14,
        15
      );

      doc.setFontSize(10);

      if (
        selectedSubjectDetails
      ) {
        doc.text(
          `Pupils: ${selectedSubjectDetails.total}`,
          14,
          25
        );

        doc.text(
          `Passed: ${selectedSubjectDetails.pass}`,
          14,
          31
        );

        doc.text(
          `Failed: ${selectedSubjectDetails.fail}`,
          14,
          37
        );

        doc.text(
          `Pass Rate: ${selectedSubjectDetails.passRate}%`,
          14,
          43
        );

        doc.text(
          `Average: ${Number(
            selectedSubjectDetails.average
          ).toFixed(1)}`,
          14,
          49
        );

        doc.text(
          `Highest: ${Number(
            selectedSubjectDetails.highest
          ).toFixed(1)}`,
          14,
          55
        );

        doc.text(
          `Lowest: ${Number(
            selectedSubjectDetails.lowest
          ).toFixed(1)}`,
          14,
          61
        );
      }

      doc.setFontSize(12);

      doc.text(
        `Top 5 - ${selectedTerm}`,
        14,
        72
      );

      autoTable(doc, {
        startY: 77,
        head: [
          [
            "Rank",
            "Student ID",
            "Pupil",
            "Score"
          ]
        ],
        body:
          selectedSubjectTermRanking
            .slice(0, 5)
            .map(
              (item) => [
                item.rank,
                item.studentID,
                item.studentName,
                Number(
                  item.score
                ).toFixed(1)
              ]
            ),
        theme: "grid"
      });

      currentY =
        doc.lastAutoTable.finalY +
        12;

      doc.text(
        "Top 5 - Yearly",
        14,
        currentY
      );

      autoTable(doc, {
        startY:
          currentY + 5,
        head: [
          [
            "Rank",
            "Student ID",
            "Pupil",
            "Annual Score"
          ]
        ],
        body:
          selectedSubjectYearlyRanking
            .slice(0, 5)
            .map(
              (item) => [
                item.rank,
                item.studentID,
                item.studentName,
                Number(
                  item.score
                ).toFixed(1)
              ]
            ),
        theme: "grid"
      });
    }

    doc.save(
      `Result-Dashboard-${selectedClass}-${selectedTerm}.pdf`
    );
  };

  /* =========================================================
     UI COMPONENTS
  ========================================================= */

  const StatCard = ({
    title,
    value,
    subtitle
  }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <h3 className="text-2xl font-bold text-gray-800 mt-1">
        {value}
      </h3>

      {subtitle && (
        <p className="text-xs text-gray-500 mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );

  const TopPupilTable = ({
    data,
    yearly = false
  }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-3">
              Rank
            </th>

            <th className="p-3">
              Student ID
            </th>

            <th className="p-3">
              Pupil
            </th>

            <th className="p-3 text-center">
              Subjects
            </th>

            <th className="p-3 text-right">
              {yearly
                ? "Annual Average"
                : "Average"}
            </th>
          </tr>
        </thead>

        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan="5"
                className="p-6 text-center text-gray-500"
              >
                No results available.
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={`${item.studentID}-${item.rank}`}
                className="border-b hover:bg-gray-50"
              >
                <td className="p-3 font-bold">
                  {item.rank}
                </td>

                <td className="p-3">
                  {item.studentID}
                </td>

                <td className="p-3 font-medium">
                  {item.studentName}
                </td>

                <td className="p-3 text-center">
                  {item.totalSubjects}
                </td>

                <td className="p-3 text-right font-bold">
                  {Number(
                    item.average
                  ).toFixed(1)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const SubjectTopTable = ({
    data
  }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-3">
              Rank
            </th>

            <th className="p-3">
              Student ID
            </th>

            <th className="p-3">
              Pupil
            </th>

            <th className="p-3 text-right">
              Score
            </th>
          </tr>
        </thead>

        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan="4"
                className="p-6 text-center text-gray-500"
              >
                No results available.
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={`${item.studentID}-${index}`}
                className="border-b hover:bg-gray-50"
              >
                <td className="p-3 font-bold">
                  {item.rank ||
                    index + 1}
                </td>

                <td className="p-3">
                  {item.studentID}
                </td>

                <td className="p-3 font-medium">
                  {item.studentName}
                </td>

                <td className="p-3 text-right font-bold">
                  {Number(
                    item.score
                  ).toFixed(1)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  /* =========================================================
     MAIN UI
  ========================================================= */

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}

        <div className="bg-gradient-to-r from-[#800000] to-[#4a0000] text-white rounded-2xl p-6 mb-6 shadow">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Result Dashboard
              </h1>

              <p className="text-sm mt-1 opacity-90">
                {schoolName}
              </p>
            </div>

            <button
              onClick={exportPDF}
              className="bg-white text-[#800000] px-5 py-2.5 rounded-lg font-semibold hover:bg-yellow-50"
            >
              Print / Export PDF
            </button>
          </div>
        </div>

        {/* FILTERS */}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Academic Year
              </label>

              <select
                value={academicYear}
                onChange={(e) =>
                  setAcademicYear(
                    e.target.value
                  )
                }
                className="w-full border rounded-lg px-3 py-2"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class
              </label>

              <select
                value={selectedClass}
                onChange={(e) =>
                  setSelectedClass(
                    e.target.value
                  )
                }
                className="w-full border rounded-lg px-3 py-2"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Term
              </label>

              <select
                value={selectedTerm}
                onChange={(e) =>
                  setSelectedTerm(
                    e.target.value
                  )
                }
                className="w-full border rounded-lg px-3 py-2"
              >
                {terms.map((term) => (
                  <option
                    key={term}
                    value={term}
                  >
                    {term}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>

              <select
                value={selectedSubject}
                onChange={(e) =>
                  setSelectedSubject(
                    e.target.value
                  )
                }
                className="w-full border rounded-lg px-3 py-2"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pass Mark
              </label>

              <input
                type="number"
                value={passMark}
                onChange={(e) =>
                  setPassMark(
                    Number(e.target.value)
                  )
                }
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

          </div>
        </div>

        {/* NAVIGATION */}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-x-auto">
          <div className="flex min-w-max">

            {[
              ["overview", "Overview"],
              [
                "subjects",
                "Subject Analysis"
              ],
              ["top", "Top Pupils"],
              [
                "assessments",
                "Assessments"
              ]
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() =>
                  setActiveSection(key)
                }
                className={`px-5 py-3 font-medium border-b-2 ${
                  activeSection === key
                    ? "border-[#800000] text-[#800000]"
                    : "border-transparent text-gray-500"
                }`}
              >
                {label}
              </button>
            ))}

          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-10 text-center">
            <div className="animate-pulse text-gray-500">
              Loading result data...
            </div>
          </div>
        ) : (
          <>

            {/* =====================================================
                OVERVIEW
                UNCHANGED
            ===================================================== */}

            {activeSection ===
              "overview" && (
              <div className="space-y-6">

                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {selectedTerm} Overview
                  </h2>

                  <p className="text-sm text-gray-500">
                    Quick performance summary for{" "}
                    {selectedClass}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                  <StatCard
                    title="Total Pupils"
                    value={
                      termSummary.total
                    }
                    subtitle="Pupils with results"
                  />

                  <StatCard
                    title="Passed"
                    value={
                      termSummary.pass
                    }
                    subtitle={`At least ${passMark}%`}
                  />

                  <StatCard
                    title="Failed"
                    value={
                      termSummary.fail
                    }
                    subtitle={`Below ${passMark}%`}
                  />

                  <StatCard
                    title="Class Average"
                    value={`${formatPercentage(termSummary.average)}%`}
                    subtitle={selectedTerm}
                  />

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="font-bold text-lg mb-4">
                      Pass / Fail Distribution
                    </h3>

                    <div className="grid grid-cols-2 gap-4">

                      <div className="bg-green-50 rounded-xl p-5 text-center">
                        <p className="text-sm text-green-700">
                          Passed
                        </p>

                        <p className="text-3xl font-bold text-green-700">
                          {
                            termSummary.pass
                          }
                        </p>

                        <p className="text-sm text-green-600">
                          {termSummary.total >
                          0
                            ? (
                                (termSummary.pass /
                                  termSummary.total) *
                                100
                              ).toFixed(
                                1
                              )
                            : "0.0"}
                          %
                        </p>
                      </div>

                      <div className="bg-red-50 rounded-xl p-5 text-center">
                        <p className="text-sm text-red-700">
                          Failed
                        </p>

                        <p className="text-3xl font-bold text-red-700">
                          {
                            termSummary.fail
                          }
                        </p>

                        <p className="text-sm text-red-600">
                          {termSummary.total >
                          0
                            ? (
                                (termSummary.fail /
                                  termSummary.total) *
                                100
                              ).toFixed(
                                1
                              )
                            : "0.0"}
                          %
                        </p>
                      </div>

                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg">
                          Top 10 Pupils
                        </h3>

                        <p className="text-xs text-gray-500">
                          {selectedTerm}
                        </p>
                      </div>

                      <button
                        onClick={() =>
                          setActiveSection(
                            "top"
                          )
                        }
                        className="text-sm text-[#800000] font-semibold"
                      >
                        View All
                      </button>
                    </div>

                    <div className="space-y-2">
                      {top10Term
                        .slice(0, 5)
                        .map(
                          (item) => (
                            <div
                              key={
                                item.studentID
                              }
                              className="flex items-center justify-between border-b pb-2"
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-7 h-7 rounded-full bg-[#800000] text-white flex items-center justify-center text-xs font-bold">
                                  {
                                    item.rank
                                  }
                                </span>

                                <span className="text-sm font-medium">
                                  {
                                    item.studentName
                                  }
                                </span>
                              </div>

                              <span className="font-bold text-sm">
                                {Number(
                                  item.average
                                ).toFixed(
                                  1
                                )}
                              </span>
                            </div>
                          )
                        )}
                    </div>
                  </div>

                </div>

                <div className="bg-white rounded-xl shadow-sm border p-6">

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold">
                        Subject Snapshot
                      </h3>

                      <p className="text-sm text-gray-500">
                        Quick comparison of subjects
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        setActiveSection(
                          "subjects"
                        )
                      }
                      className="text-sm text-[#800000] font-semibold"
                    >
                      Detailed Analysis →
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-3 text-left">
                            Subject
                          </th>

                          <th className="p-3 text-center">
                            Pass
                          </th>

                          <th className="p-3 text-center">
                            Fail
                          </th>

                          <th className="p-3 text-center">
                            Pass Rate
                          </th>

                          <th className="p-3 text-center">
                            Average
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {subjectTable.map(
                          (item) => (
                            <tr
                              key={
                                item.subject
                              }
                              className="border-b"
                            >
                              <td className="p-3 font-medium">
                                {
                                  item.subject
                                }
                              </td>

                              <td className="p-3 text-center text-green-700 font-semibold">
                                {
                                  item.pass
                                }
                              </td>

                              <td className="p-3 text-center text-red-700 font-semibold">
                                {
                                  item.fail
                                }
                              </td>

                              <td className="p-3 text-center font-semibold">
                                {
                                  item.passRate
                                }
                                %
                              </td>

                              <td className="p-3 text-center font-semibold">
                                {Number(
                                  item.average
                                ).toFixed(
                                  1
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
            )}

            {/* =====================================================
                SUBJECT ANALYSIS
                UNCHANGED
            ===================================================== */}

            {activeSection ===
              "subjects" && (
              <div className="space-y-6">

                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Detailed Subject Analysis
                  </h2>

                  <p className="text-sm text-gray-500">
                    Detailed performance by subject for{" "}
                    {selectedTerm}
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border p-6">

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
                              <td className="p-3 font-semibold">
                                {
                                  item.subject
                                }
                              </td>

                              <td className="p-3 text-center">
                                {
                                  item.total
                                }
                              </td>

                              <td className="p-3 text-center text-green-700 font-bold">
                                {
                                  item.pass
                                }
                              </td>

                              <td className="p-3 text-center text-red-700 font-bold">
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
                                  1
                                )}
                              </td>

                              <td className="p-3 text-center text-green-700 font-semibold">
                                {Number(
                                  item.highest
                                ).toFixed(
                                  1
                                )}
                              </td>

                              <td className="p-3 text-center text-red-700 font-semibold">
                                {Number(
                                  item.lowest
                                ).toFixed(
                                  1
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>

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
                          className="bg-white rounded-xl shadow-sm border overflow-hidden"
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

                            <SubjectTopTable
                              data={
                                item.top5
                              }
                            />
                          </div>

                        </div>
                      )
                    )}

                  </div>
                </div>

                {selectedSubject !==
                  "All Subjects" &&
                  selectedSubjectDetails && (
                    <div className="bg-white rounded-xl shadow-sm border p-6">

                      <div className="mb-5">
                        <h3 className="text-xl font-bold">
                          {
                            selectedSubject
                          }
                        </h3>

                        <p className="text-sm text-gray-500">
                          Selected subject detailed report
                        </p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">

                        <StatCard
                          title="Pupils"
                          value={
                            selectedSubjectDetails.total
                          }
                        />

                        <StatCard
                          title="Passed"
                          value={
                            selectedSubjectDetails.pass
                          }
                        />

                        <StatCard
                          title="Failed"
                          value={
                            selectedSubjectDetails.fail
                          }
                        />

                        <StatCard
                          title="Pass Rate"
                          value={`${selectedSubjectDetails.passRate}%`}
                        />

                        <StatCard
                          title="Average"
                          value={Number(
                            selectedSubjectDetails.average
                          ).toFixed(
                            2
                          )}
                        />

                        <StatCard
                          title="Highest"
                          value={Number(
                            selectedSubjectDetails.highest
                          ).toFixed(
                            2
                          )}
                        />

                        <StatCard
                          title="Lowest"
                          value={Number(
                            selectedSubjectDetails.lowest
                          ).toFixed(
                            2
                          )}
                        />

                      </div>

                    </div>
                  )}

              </div>
            )}

            {/* =====================================================
                TOP PUPILS
                UNCHANGED
            ===================================================== */}

            {activeSection ===
              "top" && (
              <div className="space-y-6">

                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Top Pupils
                  </h2>

                  <p className="text-sm text-gray-500">
                    Overall ranking and academic excellence for{" "}
                    {selectedClass}
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border p-6">

                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-6">
                    <div>
                      <h3 className="text-lg font-bold">
                        Top Performers -{" "}
                        {selectedTerm}
                      </h3>

                      <p className="text-sm text-gray-500">
                        Highest overall averages for the selected term
                      </p>
                    </div>

                    <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">
                      {selectedClass}
                    </span>
                  </div>

                  {top10Term.length ===
                  0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No term ranking available.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

                      {top10Term
                        .slice(0, 3)
                        .map(
                          (item) => (
                            <div
                              key={
                                item.studentID
                              }
                              className={`rounded-2xl p-6 text-center border ${
                                item.rank ===
                                1
                                  ? "bg-yellow-50 border-yellow-300"
                                  : item.rank ===
                                    2
                                  ? "bg-gray-50 border-gray-300"
                                  : "bg-orange-50 border-orange-300"
                              }`}
                            >

                              <div className="text-4xl mb-3">
                                {item.rank ===
                                1
                                  ? "🥇"
                                  : item.rank ===
                                    2
                                  ? "🥈"
                                  : "🥉"}
                              </div>

                              <p className="text-xs font-bold text-gray-500 uppercase">
                                Position{" "}
                                {
                                  item.rank
                                }
                              </p>

                              <h4 className="font-bold text-lg mt-1">
                                {
                                  item.studentName
                                }
                              </h4>

                              <p className="text-xs text-gray-500 mt-1">
                                {
                                  item.studentID
                                }
                              </p>

                              <div className="mt-4">
                                <p className="text-3xl font-bold text-[#800000]">
                                  {Number(
                                    item.average
                                  ).toFixed(
                                    2
                                  )}
                                  %
                                </p>

                                <p className="text-xs text-gray-500">
                                  Overall Average
                                </p>
                              </div>

                              <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <p className="text-gray-500">
                                    Subjects
                                  </p>

                                  <p className="font-bold">
                                    {
                                      item.totalSubjects
                                    }
                                  </p>
                                </div>

                                <div>
                                  <p className="text-gray-500">
                                    Status
                                  </p>

                                  <p className="font-bold text-green-700">
                                    Passed
                                  </p>
                                </div>
                              </div>

                            </div>
                          )
                        )}

                    </div>
                  )}

                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                  <div className="bg-white rounded-xl shadow-sm border p-6">

                    <div className="mb-4">
                      <h3 className="text-lg font-bold">
                        Top 10 -{" "}
                        {selectedTerm}
                      </h3>

                      <p className="text-sm text-gray-500">
                        Termly overall ranking
                      </p>
                    </div>

                    <TopPupilTable
                      data={
                        top10Term
                      }
                    />

                  </div>

                  <div className="bg-white rounded-xl shadow-sm border p-6">

                    <div className="mb-4">
                      <h3 className="text-lg font-bold">
                        Top 10 - Yearly
                      </h3>

                      <p className="text-sm text-gray-500">
                        Annual overall ranking
                      </p>
                    </div>

                    <TopPupilTable
                      data={
                        top10Yearly
                      }
                      yearly
                    />

                  </div>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                  <StatCard
                    title="Yearly Top Pupil"
                    value={
                      top10Yearly.length >
                      0
                        ? top10Yearly[0]
                            .studentName
                        : "N/A"
                    }
                    subtitle={
                      top10Yearly.length >
                      0
                        ? `${Number(
                            top10Yearly[0]
                              .average
                          ).toFixed(
                            2
                          )}% annual average`
                        : "No yearly results"
                    }
                  />

                  <StatCard
                    title="Yearly Average"
                    value={
                      top10Yearly.length >
                      0
                        ? `${(
                            top10Yearly.reduce(
                              (
                                sum,
                                item
                              ) =>
                                sum +
                                item.average,
                              0
                            ) /
                            top10Yearly.length
                          ).toFixed(
                            2
                          )}%`
                        : "0.00%"
                    }
                    subtitle="Average of Top 10"
                  />

                  <StatCard
                    title="Yearly Results"
                    value={
                      yearlyRanking.length
                    }
                    subtitle="Pupils with annual results"
                  />

                </div>

                {selectedSubject !==
                  "All Subjects" && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                    <div className="bg-white rounded-xl shadow-sm border p-6">

                      <div className="mb-4">
                        <h3 className="text-lg font-bold">
                          Top 5 -{" "}
                          {
                            selectedSubject
                          }
                        </h3>

                        <p className="text-sm text-gray-500">
                          {
                            selectedTerm
                          }
                        </p>
                      </div>

                      <SubjectTopTable
                        data={selectedSubjectTermRanking.slice(
                          0,
                          5
                        )}
                      />

                    </div>

                    <div className="bg-white rounded-xl shadow-sm border p-6">

                      <div className="mb-4">
                        <h3 className="text-lg font-bold">
                          Top 5 -{" "}
                          {
                            selectedSubject
                          }
                        </h3>

                        <p className="text-sm text-gray-500">
                          Yearly
                        </p>
                      </div>

                      <SubjectTopTable
                        data={selectedSubjectYearlyRanking.slice(
                          0,
                          5
                        )}
                      />

                    </div>

                  </div>
                )}

              </div>
            )}

            {/* =====================================================
                ASSESSMENTS
                UPDATED ONLY
            ===================================================== */}

            {activeSection ===
              "assessments" && (
              <div className="space-y-6">

                {/* HEADER */}

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      {selectedTerm} Assessment Analysis
                    </h2>

                    <p className="text-sm text-gray-500">
                      Detailed analysis of Test 1 and Test 2
                      for {selectedClass}.
                    </p>
                  </div>

                  <div className="bg-[#800000] text-white px-4 py-2 rounded-lg text-sm font-semibold">
                    Pass Mark: {formatPercentage(passMark)}%
                  </div>

                </div>

                {/* ASSESSMENT SUMMARY CARDS */}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                  <StatCard
                    title="Recorded Scores"
                    value={
                      totalAssessmentScores
                    }
                    subtitle={`${selectedTerm} assessments`}
                  />

                  <StatCard
                    title="Assessment Average"
                    value={`${Number(
                      overallAssessmentAverage
                    ).toFixed(2)}%`}
                    subtitle="Overall assessment average"
                  />

                  <StatCard
                    title="Strongest Assessment"
                    value={
                      strongestAssessment
                        ? strongestAssessment.label
                        : "N/A"
                    }
                    subtitle={
                      strongestAssessment
                        ? `${Number(
                            strongestAssessment.average
                          ).toFixed(
                            2
                          )}% average`
                        : "No recorded scores"
                    }
                  />

                  <StatCard
                    title="Weakest Assessment"
                    value={
                      weakestAssessment
                        ? weakestAssessment.label
                        : "N/A"
                    }
                    subtitle={
                      weakestAssessment
                        ? `${Number(
                            weakestAssessment.average
                          ).toFixed(
                            2
                          )}% average`
                        : "No recorded scores"
                    }
                  />

                </div>

                {/* TEST PERFORMANCE CARDS */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {assessmentOverall.map(
                    (item) => (
                      <div
                        key={
                          item.key
                        }
                        className="bg-white rounded-xl shadow-sm border p-6"
                      >

                        <div className="flex items-start justify-between gap-4">

                          <div>
                            <p className="text-sm text-gray-500">
                              {
                                item.label
                              }
                            </p>

                            <h3 className="text-3xl font-bold text-[#800000] mt-1">
                              {Number(
                                item.average
                              ).toFixed(
                                2
                              )}
                              %
                            </h3>

                            <p className="text-xs text-gray-500 mt-1">
                              Average score
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-bold">
                              {
                                item.total
                              }
                            </p>

                            <p className="text-xs text-gray-500">
                              Recorded
                            </p>
                          </div>

                        </div>

                        <div className="grid grid-cols-3 gap-3 mt-5">

                          <div className="bg-green-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-green-600">
                              Passed
                            </p>

                            <p className="text-xl font-bold text-green-700">
                              {
                                item.pass
                              }
                            </p>
                          </div>

                          <div className="bg-red-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-red-600">
                              Failed
                            </p>

                            <p className="text-xl font-bold text-red-700">
                              {
                                item.fail
                              }
                            </p>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-3 text-center">
                            <p className="text-xs text-gray-500">
                              Pass Rate
                            </p>

                            <p className="text-xl font-bold text-gray-800">
                              {
                                item.passRate
                              }%
                            </p>
                          </div>

                        </div>

                        <div className="mt-5">

                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">
                              Pass Rate
                            </span>

                            <span className="font-semibold">
                              {
                                item.passRate
                              }%
                            </span>
                          </div>

                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">

                            <div
                              className="bg-green-600 h-2.5 rounded-full"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    Number(
                                      item.passRate
                                    )
                                  )
                                )}%`
                              }}
                            />

                          </div>

                        </div>

                      </div>
                    )
                  )}

                </div>

                {/* ASSESSMENT PERFORMANCE TABLE */}

                <div className="bg-white rounded-xl shadow-sm border p-6">

                  <div className="mb-5">
                    <h3 className="text-lg font-bold">
                      Assessment Performance
                    </h3>

                    <p className="text-sm text-gray-500">
                      Complete performance summary for each
                      assessment in {selectedTerm}.
                    </p>
                  </div>

                  {assessmentOverall.length ===
                  0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No assessment data available for this
                      className.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">

                      <table className="w-full text-sm">

                        <thead>
                          <tr className="bg-gray-100">

                            <th className="p-3 text-left">
                              Assessment
                            </th>

                            <th className="p-3 text-center">
                              Recorded
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

                          {assessmentOverall.map(
                            (item) => (
                              <tr
                                key={
                                  item.key
                                }
                                className="border-b hover:bg-gray-50"
                              >

                                <td className="p-3 font-semibold">
                                  {
                                    item.label
                                  }
                                </td>

                                <td className="p-3 text-center">
                                  {
                                    item.total
                                  }
                                </td>

                                <td className="p-3 text-center text-green-700 font-bold">
                                  {
                                    item.pass
                                  }
                                </td>

                                <td className="p-3 text-center text-red-700 font-bold">
                                  {
                                    item.fail
                                  }
                                </td>

                                <td className="p-3 text-center font-bold">
                                  {
                                    item.passRate
                                  }%
                                </td>

                                <td className="p-3 text-center font-bold text-[#800000]">
                                  {Number(
                                    item.average
                                  ).toFixed(
                                    2
                                  )}
                                </td>

                                <td className="p-3 text-center text-green-700 font-semibold">
                                  {Number(
                                    item.highest
                                  ).toFixed(
                                    2
                                  )}
                                </td>

                                <td className="p-3 text-center text-red-700 font-semibold">
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
                  )}

                </div>

                {/* SUBJECT ASSESSMENT PERFORMANCE */}

                <div className="bg-white rounded-xl shadow-sm border p-6">

                  <div className="mb-5">
                    <h3 className="text-lg font-bold">
                      Subject Assessment Performance
                    </h3>

                    <p className="text-sm text-gray-500">
                      Compare Test 1 and Test 2 performance
                      across all subjects.
                    </p>
                  </div>

                  {subjectAssessmentPerformance.length ===
                  0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No subject assessment data available.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">

                      <table className="w-full text-sm">

                        <thead>
                          <tr className="bg-gray-100">

                            <th className="p-3 text-left">
                              Subject
                            </th>

                            {assessmentTypes.map(
                              (assessment) => (
                                <th
                                  key={
                                    assessment.key
                                  }
                                  className="p-3 text-center"
                                >
                                  {
                                    assessment.label
                                  }
                                </th>
                              )
                            )}

                            <th className="p-3 text-center">
                              Overall
                            </th>

                            <th className="p-3 text-center">
                              Pass Rate
                            </th>

                          </tr>
                        </thead>

                        <tbody>

                          {subjectAssessmentPerformance.map(
                            (item) => (
                              <tr
                                key={
                                  item.subject
                                }
                                className="border-b hover:bg-gray-50"
                              >

                                <td className="p-3 font-semibold">
                                  {
                                    item.subject
                                  }
                                </td>

                                {item.assessments.map(
                                  (
                                    assessment,
                                    index
                                  ) => (
                                    <td
                                      key={`${item.subject}-${index}`}
                                      className="p-3 text-center"
                                    >

                                      {assessment.total >
                                      0 ? (
                                        <div>
                                          <p className="font-bold">
                                            {Number(
                                              assessment.average
                                            ).toFixed(
                                              2
                                            )}
                                          </p>

                                          <p className="text-xs text-gray-500">
                                            {
                                              assessment.total
                                            }{" "}
                                            scores
                                          </p>
                                        </div>
                                      ) : (
                                        <span className="text-gray-400">
                                          —
                                        </span>
                                      )}

                                    </td>
                                  )
                                )}

                                <td className="p-3 text-center font-bold text-[#800000]">
                                  {Number(
                                    item.average
                                  ).toFixed(
                                    2
                                  )}
                                </td>

                                <td className="p-3 text-center font-bold">
                                  {
                                    item.passRate
                                  }%
                                </td>

                              </tr>
                            )
                          )}

                        </tbody>

                      </table>

                    </div>
                  )}

                </div>

                {/* PUPILS REQUIRING ATTENTION */}

                <div className="bg-white rounded-xl shadow-sm border p-6">

                  <div className="mb-5">

                    <h3 className="text-lg font-bold">
                      Pupils Requiring Attention
                    </h3>

                    <p className="text-sm text-gray-500">
                      Pupils with the lowest assessment
                      averages for {selectedTerm}.
                    </p>

                  </div>

                  {assessmentAtRiskPupils.length ===
                  0 ? (
                    <div className="p-8 text-center">

                      <div className="text-4xl mb-3">
                        ✓
                      </div>

                      <p className="font-semibold text-green-700">
                        No assessment concerns identified.
                      </p>

                      <p className="text-sm text-gray-500 mt-1">
                        There are no pupils with recorded
                        assessment scores below the pass mark.
                      </p>

                    </div>
                  ) : (
                    <div className="overflow-x-auto">

                      <table className="w-full text-sm">

                        <thead>
                          <tr className="bg-gray-100">

                            <th className="p-3 text-left">
                              Pupil
                            </th>

                            <th className="p-3 text-left">
                              Student ID
                            </th>

                            <th className="p-3 text-center">
                              Recorded
                            </th>

                            <th className="p-3 text-center">
                              Below Pass
                            </th>

                            <th className="p-3 text-center">
                              Average
                            </th>

                            <th className="p-3 text-center">
                              Status
                            </th>

                          </tr>
                        </thead>

                        <tbody>

                          {assessmentAtRiskPupils.map(
                            (item) => (
                              <tr
                                key={
                                  item.studentID
                                }
                                className="border-b hover:bg-gray-50"
                              >

                                <td className="p-3 font-medium">
                                  {
                                    item.studentName
                                  }
                                </td>

                                <td className="p-3">
                                  {
                                    item.studentID
                                  }
                                </td>

                                <td className="p-3 text-center">
                                  {
                                    item.total
                                  }
                                </td>

                                <td className="p-3 text-center text-red-700 font-bold">
                                  {
                                    item.belowPass
                                  }
                                </td>

                                <td className="p-3 text-center font-bold">
                                  {Number(
                                    item.average
                                  ).toFixed(
                                    2
                                  )}
                                  %
                                </td>

                                <td className="p-3 text-center">

                                  <span className="inline-flex px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold">
                                    Needs Attention
                                  </span>

                                </td>

                              </tr>
                            )
                          )}

                        </tbody>

                      </table>

                    </div>
                  )}

                </div>

                {/* SELECTED SUBJECT ASSESSMENT REPORT */}

                {selectedSubject !==
                  "All Subjects" && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">

                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">

                      <div>

                        <h3 className="text-xl font-bold">
                          {
                            selectedSubject
                          }{" "}
                          Assessment Report
                        </h3>

                        <p className="text-sm text-gray-500">
                          Detailed assessment performance
                          for {selectedSubject} in{" "}
                          {selectedTerm}.
                        </p>

                      </div>

                      <span className="bg-[#800000] text-white px-3 py-1.5 rounded-lg text-sm font-semibold">
                        {
                          selectedTerm
                        }
                      </span>

                    </div>

                    <div className="overflow-x-auto">

                      <table className="w-full text-sm">

                        <thead>
                          <tr className="bg-gray-100">

                            <th className="p-3 text-left">
                              Assessment
                            </th>

                            <th className="p-3 text-center">
                              Recorded
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

                          {selectedSubjectAssessments.map(
                            (item) => (
                              <tr
                                key={
                                  item.assessment
                                }
                                className="border-b hover:bg-gray-50"
                              >

                                <td className="p-3 font-semibold">
                                  {
                                    item.assessment
                                  }
                                </td>

                                <td className="p-3 text-center">
                                  {
                                    item.total
                                  }
                                </td>

                                <td className="p-3 text-center text-green-700 font-bold">
                                  {
                                    item.pass
                                  }
                                </td>

                                <td className="p-3 text-center text-red-700 font-bold">
                                  {
                                    item.fail
                                  }
                                </td>

                                <td className="p-3 text-center font-bold">
                                  {
                                    item.passRate
                                  }%
                                </td>

                                <td className="p-3 text-center font-bold text-[#800000]">
                                  {Number(
                                    item.average
                                  ).toFixed(
                                    2
                                  )}
                                </td>

                                <td className="p-3 text-center text-green-700 font-semibold">
                                  {Number(
                                    item.highest
                                  ).toFixed(
                                    2
                                  )}
                                </td>

                                <td className="p-3 text-center text-red-700 font-semibold">
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
                )}

              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
};

export default ResultDashboard;