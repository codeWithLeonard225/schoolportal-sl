import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../../firebase";
import { schooldb } from "../Database/SchoolsResults";
import { pupilLoginFetch } from "../Database/PupilLogin";
import { getDocs, doc, collection, query, where, onSnapshot } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLocation } from "react-router-dom";
import {
    getTermScores,
    calculateAnnualMean,
    calculateSubjectRanks,
    calculateSubjectAnnualRanks,
    calculateOverallMetrics
} from "../Utilis/ResultCalculators";



const getGradeColor = (score) => {
    const num = parseFloat(score);
    if (isNaN(num)) return "text-slate-600";
    return num < 50 ? "text-rose-600 font-bold" : "text-blue-600 font-bold";
};

// Helper to determine Remarks based on the Annual Overall Mean
const getRemark = (average) => {
    const val = parseFloat(average);
    if (isNaN(val)) return "N/A";
    if (val >= 70) return "Excellent";
    if (val >= 60) return "Very Good";
    if (val >= 50) return "Credit";
    if (val >= 40) return "Pass";
    return "Fail";
};

const GeneralReportCard = () => {
    const [academicYear, setAcademicYear] = useState("");
    const [academicYears, setAcademicYears] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [availableClasses, setAvailableClasses] = useState([]);
    const [selectedPupil, setSelectedPupil] = useState("");
    const [pupils, setPupils] = useState([]);
    const [classGradesData, setClassGradesData] = useState([]);
    const [pupilGradesData, setPupilGradesData] = useState([]);
    const [loading, setLoading] = useState(false);
    const location = useLocation();
    const [totalPupilsInClass, setTotalPupilsInClass] = useState(0);
    const [calculationMode, setCalculationMode] = useState("auto");
    const [classInfo, setClassInfo] = useState(null);
    const {
        schoolId,
        schoolName,
        schoolLogoUrl,
        schoolAddress,
        schoolMotto,
        schoolContact,
        email,
    } = location.state || {};

    // 🔹 Fetch Academic Years & Classes
    useEffect(() => {
        if (!schoolId) return;

        const q = query(
            collection(schooldb, "PupilGrades"),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => doc.data());

            const years = [...new Set(data.map((d) => d.academicYear))].sort().reverse();
            const classes = [...new Set(data.map((d) => d.className.trim()))].sort();

            setAcademicYears(years);
            setAvailableClasses(classes);

            if (years.length > 0) setAcademicYear(years[0]);
            if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0]);
        });

        return () => unsubscribe();
    }, [schoolId, selectedClass]);

    // 🔹 Fetch Class Settings (numberOfSubjects)
useEffect(() => {
    if (!selectedClass || !schoolId) return;

    const q = query(
        collection(pupilLoginFetch, "Classes"),
        where("className", "==", selectedClass),
        where("schoolId", "==", schoolId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            setClassInfo(snapshot.docs[0].data());
        } else {
            setClassInfo(null);
        }
    });

    return () => unsubscribe();

}, [selectedClass, schoolId]);

    // 🔹 Count total pupils in class
    useEffect(() => {
        const trimmedClass = selectedClass;
        if (!academicYear || !trimmedClass || !schoolId) {
            setTotalPupilsInClass(0);
            return;
        }

        const pupilsRef = query(
            collection(pupilLoginFetch, "PupilsReg"),
            where("academicYear", "==", academicYear),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(pupilsRef, (snapshot) => {
            const total = snapshot.docs
                .filter(doc => doc.data().class && doc.data().class.trim() === trimmedClass)
                .length;

            setTotalPupilsInClass(total);
        });

        return () => unsubscribe();
    }, [academicYear, selectedClass, schoolId]);

    // 🔹 Fetch Pupils
    useEffect(() => {
        const trimmedClass = selectedClass;
        if (!academicYear || !trimmedClass || !schoolId) {
            setPupils([]);
            return;
        }
        setSelectedPupil("");

        const q = query(
            collection(pupilLoginFetch, "PupilsReg"),
            where("schoolId", "==", schoolId),
            where("academicYear", "==", academicYear),
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allPupilData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            const filteredPupils = allPupilData
                .filter(pupil => pupil.class && pupil.class.trim() === trimmedClass)
                .sort((a, b) => a.studentName.localeCompare(b.studentName));

            setPupils(filteredPupils);
            if (filteredPupils.length > 0) setSelectedPupil(filteredPupils[0].studentID);
        });
        return () => unsubscribe();
    }, [academicYear, selectedClass, schoolId]);

    // 🔹 Fetch ALL grades for the class to dynamically generate ranks
    useEffect(() => {
        if (!academicYear || !selectedClass) return;
        const q = query(
            collection(schooldb, "PupilGrades"),
            where("academicYear", "==", academicYear),
            where("schoolId", "==", schoolId),
            where("className", "==", selectedClass)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setClassGradesData(snapshot.docs.map((doc) => doc.data()));
        });
        return () => unsubscribe();
    }, [academicYear, selectedClass]);

    // 🔹 Fetch grades for selected pupil
    useEffect(() => {
        if (!academicYear || !selectedClass || !selectedPupil) return;
        setLoading(true);
        const q = query(
            collection(schooldb, "PupilGrades"),
            where("academicYear", "==", academicYear),
            where("schoolId", "==", schoolId),
            where("className", "==", selectedClass),
            where("pupilID", "==", selectedPupil)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setPupilGradesData(snapshot.docs.map((doc) => doc.data()));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [academicYear, selectedClass, selectedPupil]);

    const pupilInfo = pupils.find((p) => p.studentID === selectedPupil);

    // 🧮 Process All Three Terms with Subject Ranks and Dynamic Term Summary Metrics
    const reportCardData = useMemo(() => {
        if (pupilGradesData.length === 0) {
            return {
                reportRows: [],
                termSummaries: { "Term 1": null, "Term 2": null, "Term 3": null },
                annualSummary: { avg: "0.0", rank: "—" }
            };
        }

        const uniqueSubjects = [...new Set(classGradesData.map((d) => d.subject))].sort();
        const pupilIDs = [...new Set(classGradesData.map((d) => d.pupilID))];

        // Compute ranks using shared utils engine
        const subjectTermRanks = calculateSubjectRanks(classGradesData, pupilIDs, uniqueSubjects);
        const subjectAnnualRanks = calculateSubjectAnnualRanks(classGradesData, pupilIDs, uniqueSubjects, calculationMode);

        // Compute total metrics using shared utils engine
       const totalNumberOfSubjects = Number(
    classInfo?.numberOfSubjects || uniqueSubjects.length
);


const { termSummaries, annualSummary } = calculateOverallMetrics(
    classGradesData,
    pupilIDs,
    uniqueSubjects,
    selectedPupil,
    totalNumberOfSubjects * 100,
    calculationMode
);

        const reportRows = uniqueSubjects.map((subj) => {
            const t1Data = getTermScores(pupilGradesData, selectedPupil, subj, "Term 1");
            const t2Data = getTermScores(pupilGradesData, selectedPupil, subj, "Term 2");
            const t3Data = getTermScores(pupilGradesData, selectedPupil, subj, "Term 3");

            const t1Rank = subjectTermRanks[`${subj}_Term 1`]?.[selectedPupil] || "—";
            const t2Rank = subjectTermRanks[`${subj}_Term 2`]?.[selectedPupil] || "—";
            const t3Rank = subjectTermRanks[`${subj}_Term 3`]?.[selectedPupil] || "—";

            const subjectAnnualAverage = calculateAnnualMean(
                t1Data.rawMean,
                t2Data.rawMean,
                t3Data.rawMean,
                calculationMode
            );

            const annualRank = subjectAnnualRanks[subj]?.[selectedPupil] || "—";

            return {
                subject: subj,
                t1: {
                    t1: t1Data.t1 !== null ? t1Data.t1 : "—",
                    t2: t1Data.t2 !== null ? t1Data.t2 : "—",
                    mean: t1Data.mean !== null ? t1Data.mean : "—",
                    rank: t1Rank
                },
                t2: {
                    t1: t2Data.t1 !== null ? t2Data.t1 : "—",
                    t2: t2Data.t2 !== null ? t2Data.t2 : "—",
                    mean: t2Data.mean !== null ? t2Data.mean : "—",
                    rank: t2Rank
                },
                t3: {
                    t1: t3Data.t1 !== null ? t3Data.t1 : "—",
                    t2: t3Data.t2 !== null ? t3Data.t2 : "—",
                    mean: t3Data.mean !== null ? t3Data.mean : "—",
                    rank: t3Rank
                },
                annualAverage:
                    subjectAnnualAverage !== null
                        ? Math.round(subjectAnnualAverage)
                        : "—",
                annualRank: annualRank
            };
        }).filter(row =>
            row.t1.mean !== "—" || row.t2.mean !== "—" || row.t3.mean !== "—"
        );

        return { reportRows, termSummaries, annualSummary };
    }, [pupilGradesData, classGradesData, selectedPupil, calculationMode]);

    // Rest of your file component (handlePrintPDF, render code, etc.) is unchanged
    // 🧾 Generate Professional Three-Term PDF with Custom Prints
    const handlePrintPDF = () => {
        if (!pupilInfo) return;

        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "A4" });
        const pupilPhotoUrl = pupilInfo.userPhotoUrl || "https://via.placeholder.com/96";

        const loadImage = (url) =>
            new Promise((resolve) => {
                const img = new Image();
                img.src = url;
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
            });

        Promise.all([loadImage(schoolLogoUrl), loadImage(pupilPhotoUrl)]).then(([logo, pupilPhoto]) => {
            let y = 30;
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // 🌟 Professional Addition 1: CENTRAL SCHOOL LOGO WATERMARK (Replaces plain text)
            if (logo) {
                doc.saveGraphicsState();
                // Set opacity to a super soft 5% so it sits beautifully in the background
                doc.setGState(new doc.GState({ opacity: 0.05 }));

                const watermarkWidth = 240;
                const watermarkHeight = 240;
                const watermarkX = (pageWidth - watermarkWidth) / 2;
                const watermarkY = (pageHeight - watermarkHeight) / 2 + 10;

                doc.addImage(logo, "PNG", watermarkX, watermarkY, watermarkWidth, watermarkHeight);
                doc.restoreGraphicsState();
            } else {
                // Fallback textual watermark if school logo is not available
                doc.saveGraphicsState();
                doc.setGState(new doc.GState({ opacity: 0.04 }));
                doc.setFont("Helvetica", "bold");
                doc.setFontSize(45);
                doc.setTextColor(15, 23, 42);
                doc.text("OFFICIAL ACADEMIC RECORD", pageWidth / 2, pageHeight / 2 + 30, {
                    align: "center",
                    angle: 28,
                });
                doc.restoreGraphicsState();
            }

            // Elegant Header Border Line
            doc.setFillColor(79, 70, 229);
            doc.rect(40, y - 5, pageWidth - 80, 4, "F");
            y += 15;

            // School Name
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(30, 41, 59);
            doc.text(schoolName || "Academic Center", pageWidth / 2, y, { align: "center" });
            y += 15;

            // Logo Image in Top-Left Header
            if (logo) doc.addImage(logo, "PNG", 45, y - 20, 55, 55);

            // School Meta Details
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);

            const details = [
                schoolAddress || "Address not found",
                schoolMotto ? `"${schoolMotto}"` : null,
                schoolContact ? `Contact: ${schoolContact}` : null
            ].filter(Boolean);

            details.forEach((line, index) => {
                doc.text(line, pageWidth / 2, y + (index * 11), { align: "center" });
            });

            // Student Photo Frame
            const rightX = pageWidth - 95;
            if (pupilPhoto) {
                doc.setFillColor(241, 245, 249);
                doc.rect(rightX - 2, y - 22, 59, 59, "F");
                doc.addImage(pupilPhoto, "JPEG", rightX, y - 20, 55, 55);
            }

            y += 40;

            // Divider line
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(1);
            doc.line(40, y, pageWidth - 40, y);
            y += 12;

            // Profile Block
            doc.setFillColor(248, 250, 252);
            doc.rect(40, y, pageWidth - 80, 42, "F");
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.5);
            doc.rect(40, y, pageWidth - 80, 42, "S");

            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.setFont("Helvetica", "bold");

            doc.text("PUPIL NAME:", 55, y + 16);
            doc.text("STUDENT ID:", 55, y + 30);

            doc.setFont("Helvetica", "normal");
            doc.setTextColor(30, 41, 59);
            doc.text(pupilInfo.studentName.toUpperCase(), 130, y + 16);
            doc.text(pupilInfo.studentID, 130, y + 30);

            doc.setFont("Helvetica", "bold");
            doc.setTextColor(100, 116, 139);
            doc.text("CLASS / YEAR:", pageWidth / 2 - 30, y + 16);
            doc.text("REPORT CARD TYPE:", pageWidth / 2 - 30, y + 30);

            doc.setFont("Helvetica", "normal");
            doc.setTextColor(30, 41, 59);
            doc.text(`${pupilInfo.class || "N/A"} (${totalPupilsInClass} pupils) | ${academicYear}`, pageWidth / 2 + 70, y + 16);
            doc.text("Three-Term Complete Comprehensive Report Card", pageWidth / 2 + 70, y + 30);

            y += 55;

            // Landscape Table Double-Headers
            const multiHeaders = [
                [
                    { content: "Subject", rowSpan: 2, styles: { halign: "left", valign: "middle" } },
                    { content: "Term 1", colSpan: 4, styles: { halign: "center" } },
                    { content: "Term 2", colSpan: 4, styles: { halign: "center" } },
                    { content: "Term 3", colSpan: 4, styles: { halign: "center" } },
                    { content: "Annual Overall", colSpan: 3, styles: { halign: "center" } }
                ],
                [
                    "T1", "T2", "Mean", "Rnk",
                    "T1", "T2", "Mean", "Rnk",
                    "T1", "T2", "Mean", "Rnk",
                    "Avg", "Rnk", "Remark"
                ]
            ];

            const tableRows = reportCardData.reportRows.map((r) => [
                r.subject,
                r.t1.t1, r.t1.t2, r.t1.mean, r.t1.rank,
                r.t2.t1, r.t2.t2, r.t2.mean, r.t2.rank,
                r.t3.t1, r.t3.t2, r.t3.mean, r.t3.rank,
                r.annualAverage, r.annualRank, getRemark(r.annualAverage)
            ]);

            const summaryT1 = reportCardData.termSummaries["Term 1"];
            const summaryT2 = reportCardData.termSummaries["Term 2"];
            const summaryT3 = reportCardData.termSummaries["Term 3"];

            const totalsRow = [
                "TOTAL",
                "", "", summaryT1?.total || "—", "",
                "", "", summaryT2?.total || "—", "",
                "", "", summaryT3?.total || "—", "",
                "", "", ""
            ];

            const percentRow = [
                "PERCENTAGE",
                "", "", `${summaryT1?.percentage || "—"}%`, "",
                "", "", `${summaryT2?.percentage || "—"}%`, "",
                "", "", `${summaryT3?.percentage || "—"}%`, "",
                `${reportCardData.annualSummary.avg}%`, "", getRemark(reportCardData.annualSummary.avg)
            ];

            const rankRow = [
                "RANK",
                "", "", `${summaryT1?.rank || "—"} / ${totalPupilsInClass}`, "",
                "", "", `${summaryT2?.rank || "—"} / ${totalPupilsInClass}`, "",
                "", "", `${summaryT3?.rank || "—"} / ${totalPupilsInClass}`, "",
                "",
                `${reportCardData.annualSummary.rank} / ${totalPupilsInClass}`,
                ""
            ];

            tableRows.push(totalsRow, percentRow, rankRow);

            autoTable(doc, {
                startY: y,
                head: multiHeaders,
                body: tableRows,
                theme: "grid",
                styles: { halign: "center", fontSize: 7.5, font: "Helvetica", cellPadding: 3.5 },
                headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
                margin: { left: 40, right: 40 },
                columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 120 } },
                didParseCell: (data) => {
                    const totalRowsStartIndex = tableRows.length - 3;
                    if (data.cell.section === "body" && data.row.index >= totalRowsStartIndex) {
                        data.cell.styles.fillColor = [241, 245, 249];
                        data.cell.styles.fontStyle = "bold";
                        if (data.column.index === 0) {
                            data.cell.styles.textColor = [79, 70, 229];
                        }
                    }

                    // Performance Dynamic Color-coding
                    if (data.cell.section === "body" && data.row.index < totalRowsStartIndex && data.column.index > 0) {
                        const index = data.column.index;
                        const scoreIndexes = [1, 2, 3, 5, 6, 7, 9, 10, 11, 13];
                        if (scoreIndexes.includes(index)) {
                            const valStr = data.cell.text[0];
                            if (valStr !== "—") {
                                const score = Number(valStr);
                                if (score >= 50) {
                                    data.cell.styles.textColor = [37, 99, 235]; // Clean Emerald Green
                                } else {
                                    data.cell.styles.textColor = [244, 63, 94];  // Clean Crimson Red
                                }
                                data.cell.styles.fontStyle = "bold";
                            }
                        }
                    }
                }
            });

            let currentY = doc.lastAutoTable.finalY + 12;

            // Left Panel: Annual Metrics
            doc.setFillColor(248, 250, 252);
            const leftBoxHeight = 75;

            doc.setFillColor(248, 250, 252);
            doc.rect(40, currentY, pageWidth / 2 - 50, leftBoxHeight, "F");
            doc.rect(40, currentY, pageWidth / 2 - 50, leftBoxHeight, "S");

            doc.setTextColor(79, 70, 229);
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(8);
            doc.text("ANNUAL PERFORMANCE METRICS", 50, currentY + 13);

            doc.setFont("Helvetica", "normal");
            doc.setTextColor(30, 41, 59);

            doc.text("Annual Weighted Average Score:", 50, currentY + 28);
            doc.text("Final Position in Class:", 50, currentY + 43);
            doc.text("Promoted To / Repeat:", 50, currentY + 70);

            doc.setFont("Helvetica", "bold");
            doc.setTextColor(79, 70, 229);

            doc.text(
                `${reportCardData.annualSummary.avg}%`,
                pageWidth / 2 - 55,
                currentY + 28,
                { align: "right" }
            );

            doc.text(
                `${reportCardData.annualSummary.rank} / ${totalPupilsInClass}`,
                pageWidth / 2 - 55,
                currentY + 43,
                { align: "right" }
            );

            // Blank line for promotion class
            doc.setTextColor(30, 41, 59);
            doc.setFont("Helvetica", "normal");
            doc.text(
                ".........................................................",
                165,
                currentY + 70
            );
            // ===============================
            // RIGHT PANEL: ATTENDANCE TRACKER
            // ===============================
            const rightBoxX = pageWidth / 2 + 10;
            const boxWidth = pageWidth / 2 - 50;
            const boxHeight = 72;

            doc.setFillColor(248, 250, 252);
            doc.rect(rightBoxX, currentY, boxWidth, boxHeight, "F");
            doc.rect(rightBoxX, currentY, boxWidth, boxHeight, "S");

            doc.setFont("Helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(79, 70, 229);
            doc.text("INSTITUTIONAL ATTENDANCE TRACKER", rightBoxX + 12, currentY + 13);

            // Table Header
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(7.5);
            doc.setTextColor(30, 41, 59);

            doc.text("", rightBoxX + 15, currentY + 28);
            doc.text("Term 1", rightBoxX + 120, currentY + 28);
            doc.text("Term 2", rightBoxX + 190, currentY + 28);
            doc.text("Term 3", rightBoxX + 260, currentY + 28);

            // Row 1
            doc.setFont("Helvetica", "normal");
            doc.text("Days Present", rightBoxX + 15, currentY + 43);
            doc.text("______", rightBoxX + 120, currentY + 43);
            doc.text("______", rightBoxX + 190, currentY + 43);
            doc.text("______", rightBoxX + 260, currentY + 43);

            // Row 2
            doc.text("Days Absent", rightBoxX + 15, currentY + 57);
            doc.text("______", rightBoxX + 120, currentY + 57);
            doc.text("______", rightBoxX + 190, currentY + 57);
            doc.text("______", rightBoxX + 260, currentY + 57);

            // Row 3
            doc.text("Days Late", rightBoxX + 15, currentY + 71);
            doc.text("______", rightBoxX + 120, currentY + 71);
            doc.text("______", rightBoxX + 190, currentY + 71);
            doc.text("______", rightBoxX + 260, currentY + 71);

            currentY += 92;

            // ======================================
            // PRINCIPAL'S COMMENTS
            // ======================================
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(8);
            doc.setTextColor(79, 70, 229);

            doc.text("PRINCIPAL'S COMMENTS:", 40, currentY);

            doc.setDrawColor(80);
            doc.line(160, currentY + 1, pageWidth - 40, currentY + 1);

            currentY += 15;


            // ======================================
            // GRADING SCALE
            // ======================================
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);

            doc.text(
                "GRADING SCALE:  [Excellent: 80-100]   [Very Good: 70-79]   [Credit: 50-69]   [Pass: 40-49]   [Fail: Under 40]",
                40,
                currentY
            );

            currentY += 28;


            // ======================================
            // SIGNATURES
            // ======================================
            doc.setFont("Helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);

            // Class Teacher
            doc.line(40, currentY, 180, currentY);
            doc.text("Class Teacher's Signature & Date", 40, currentY + 12);

            // Principal
            doc.line(pageWidth / 2 - 70, currentY, pageWidth / 2 + 70, currentY);
            doc.text(
                "Principal's Signature & Date",
                pageWidth / 2 - 70,
                currentY + 12
            );

            // School Stamp
            doc.line(pageWidth - 220, currentY, pageWidth - 80, currentY);
            doc.text(
                "Official School Stamp",
                pageWidth - 220,
                currentY + 12
            );


            // Save PDF
            doc.save(`${pupilInfo.studentName}_Comprehensive_Annual_Report.pdf`);
        });
    };



    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 bg-slate-50 min-h-screen">
            {/* Settings Panel */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="h-6 w-1.5 bg-indigo-600 rounded-full inline-block"></span>
                    Annual Multi-Term Report Card System ({schoolName || "Administrative Center"})
                </h2>

                {/* Dropdowns */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Academic Year</label>
                        <select className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                            {academicYears.map((y) => (
                                <option key={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Selected Class</label>
                        <select className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                            {availableClasses.map((c) => (
                                <option key={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Pupil Profile</label>
                        <select className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={selectedPupil} onChange={(e) => setSelectedPupil(e.target.value)}>
                            {pupils.map((p) => (
                                <option key={p.studentID} value={p.studentID}>
                                    {p.studentName}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Calculation Mode Selector */}
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                            Annual Calculation
                        </label>

                        <select
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={calculationMode}
                            onChange={(e) => setCalculationMode(e.target.value)}
                        >
                            <option value="auto">
                                Auto (Available Terms)
                            </option>

                            <option value="term1_2">
                                Term 1 + Term 2
                            </option>

                            <option value="term2_3">
                                Term 2 + Term 3
                            </option>

                            <option value="3">
                                Divide by 3 Terms
                            </option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end mt-6 border-t border-slate-100 pt-4">
                    <button
                        onClick={handlePrintPDF}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:bg-slate-300"
                        disabled={loading || reportCardData.reportRows.length === 0}
                    >
                        Export Comprehensive PDF
                    </button>
                </div>
            </div>

            {/* Report Card Screen Layout */}
            {pupilInfo && (
                <div className="bg-white rounded-2xl shadow-md border border-slate-200/80 p-6 md:p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600"></div>

                    {/* School Banner */}
                    <div className="flex flex-col md:flex-row justify-between items-center md:items-start border-b border-slate-100 pb-6 mb-6 gap-6">
                        <div className="flex items-center gap-4">
                            {schoolLogoUrl ? (
                                <img src={schoolLogoUrl} alt="Logo" className="w-16 h-16 object-contain" />
                            ) : (
                                <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs">No Logo</div>
                            )}
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{schoolName || "Unknown Institution"}</h3>
                                <p className="text-xs text-slate-500 mt-0.5">{schoolAddress || "Academic Address"}</p>
                                {schoolMotto && <p className="text-[11px] italic text-slate-400 mt-1">"{schoolMotto}"</p>}
                            </div>
                        </div>

                        {/* Profile Frame */}
                        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            {pupilInfo.userPhotoUrl ? (
                                <img
                                    src={pupilInfo.userPhotoUrl}
                                    alt="Pupil Portrait"
                                    className="w-14 h-14 object-cover rounded-lg border border-slate-200"
                                />
                            ) : (
                                <div className="w-14 h-14 bg-slate-200 rounded-lg flex items-center justify-center text-slate-500 font-bold text-[10px]">Photo</div>
                            )}
                            <div>
                                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Cardholder</p>
                                <p className="text-sm font-bold text-slate-800">{pupilInfo.studentName}</p>
                                <p className="text-xs text-slate-500">ID: {pupilInfo.studentID}</p>
                            </div>
                        </div>
                    </div>

                    {/* Academic Profiles Info Block */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 mb-6 text-xs">
                        <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Class Stream</span>
                            <span className="font-semibold text-slate-700">{pupilInfo.class || "N/A"}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Demographics</span>
                            <span className="font-semibold text-slate-700">{totalPupilsInClass} Pupils</span>
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Calendar Block</span>
                            <span className="font-semibold text-slate-700">{academicYear}</span>
                        </div>
                        <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Record Status</span>
                            <span className="font-semibold text-indigo-600">Full Academic Year</span>
                        </div>
                    </div>

                    {/* Matrix Grid with Nesting Columns */}
                    {loading ? (
                        <div className="text-center text-indigo-600 font-medium py-12">Fetching cumulative year records...</div>
                    ) : reportCardData.reportRows.length > 0 ? (
                        <div>
                            <div className="overflow-x-auto border border-slate-200 rounded-xl mb-6 shadow-sm">
                                <table className="min-w-full text-xs text-center border-collapse">
                                    <thead className="bg-indigo-900 text-white divide-y divide-indigo-800">
                                        {/* Top Tier Header */}
                                        <tr>
                                            <th rowSpan="2" className="px-4 py-3 text-left font-semibold tracking-wider border-r border-indigo-800">Subject Detail</th>
                                            <th colSpan="4" className="py-2 border-r border-indigo-800 tracking-wider">Term 1</th>
                                            <th colSpan="4" className="py-2 border-r border-indigo-800 tracking-wider">Term 2</th>
                                            <th colSpan="4" className="py-2 border-r border-indigo-800 tracking-wider">Term 3</th>
                                            <th colSpan="3" className="py-2 bg-indigo-950 tracking-wider">Annual Overall</th>
                                        </tr>
                                        {/* Sub Tier Header */}
                                        <tr>
                                            <th className="py-2 bg-indigo-800/40 w-12 border-r border-indigo-800">T1</th>
                                            <th className="py-2 bg-indigo-800/40 w-12 border-r border-indigo-800">T2</th>
                                            <th className="py-2 bg-indigo-800/60 w-14 border-r border-indigo-800 font-bold">Mean</th>
                                            <th className="py-2 bg-indigo-800/30 w-12 border-r border-indigo-800 italic">Rnk</th>

                                            <th className="py-2 bg-indigo-800/40 w-12 border-r border-indigo-800">T1</th>
                                            <th className="py-2 bg-indigo-800/40 w-12 border-r border-indigo-800">T2</th>
                                            <th className="py-2 bg-indigo-800/60 w-14 border-r border-indigo-800 font-bold">Mean</th>
                                            <th className="py-2 bg-indigo-800/30 w-12 border-r border-indigo-800 italic">Rnk</th>

                                            <th className="py-2 bg-indigo-800/40 w-12 border-r border-indigo-800">T1</th>
                                            <th className="py-2 bg-indigo-800/40 w-12 border-r border-indigo-800">T2</th>
                                            <th className="py-2 bg-indigo-800/60 w-14 border-r border-indigo-800 font-bold">Mean</th>
                                            <th className="py-2 bg-indigo-800/30 w-12 border-r border-indigo-800 italic">Rnk</th>

                                            <th className="py-2 bg-indigo-950 w-16 border-r border-indigo-950 font-bold">Avg</th>
                                            <th className="py-2 bg-indigo-950/80 w-12 border-r border-indigo-950/60 italic">Rnk</th>
                                            <th className="py-2 bg-indigo-950/70 w-24 font-bold italic">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {/* Grade Rows */}
                                        {reportCardData.reportRows.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition">
                                                <td className="text-left px-4 py-3 font-bold text-slate-700 border-r border-slate-200 bg-slate-50/30">{row.subject}</td>

                                                {/* Term 1 */}
                                                <td className={`py-3 border-r border-slate-200 ${getGradeColor(row.t1.t1)}`}>{row.t1.t1}</td>
                                                <td className={`py-3 border-r border-slate-200 ${getGradeColor(row.t1.t2)}`}>{row.t1.t2}</td>
                                                <td className={`py-3 font-semibold border-r border-slate-200 bg-slate-50/40 ${getGradeColor(row.t1.mean)}`}>{row.t1.mean}</td>
                                                <td className="py-3 border-r border-slate-200 text-slate-500 font-medium">{row.t1.rank}</td>

                                                {/* Term 2 */}
                                                <td className={`py-3 border-r border-slate-200 ${getGradeColor(row.t2.t1)}`}>{row.t2.t1}</td>
                                                <td className={`py-3 border-r border-slate-200 ${getGradeColor(row.t2.t2)}`}>{row.t2.t2}</td>
                                                <td className={`py-3 font-semibold border-r border-slate-200 bg-slate-50/40 ${getGradeColor(row.t2.mean)}`}>{row.t2.mean}</td>
                                                <td className="py-3 border-r border-slate-200 text-slate-500 font-medium">{row.t2.rank}</td>

                                                {/* Term 3 */}
                                                <td className={`py-3 border-r border-slate-200 ${getGradeColor(row.t3.t1)}`}>{row.t3.t1}</td>
                                                <td className={`py-3 border-r border-slate-200 ${getGradeColor(row.t3.t2)}`}>{row.t3.t2}</td>
                                                <td className={`py-3 font-semibold border-r border-slate-200 bg-slate-50/40 ${getGradeColor(row.t3.mean)}`}>{row.t3.mean}</td>
                                                <td className="py-3 border-r border-slate-200 text-slate-500 font-medium">{row.t3.rank}</td>

                                                {/* Annual Summary */}
                                                <td className={`py-3 font-bold border-r border-slate-200 bg-indigo-50/30 ${getGradeColor(row.annualAverage)}`}>{row.annualAverage}</td>
                                                <td className="py-3 font-bold text-indigo-700 bg-indigo-50/20 border-r border-slate-200">{row.annualRank}</td>
                                                <td className={`py-3 font-semibold bg-indigo-50/10 text-slate-700`}>{getRemark(row.annualAverage)}</td>
                                            </tr>
                                        ))}

                                        {/* Dynamic Total Metrics Row */}
                                        <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                                            <td className="text-left px-4 py-2.5 text-indigo-700 border-r border-slate-200">TOTAL</td>
                                            <td colSpan="2" className="border-r border-slate-200"></td>
                                            <td className="py-2.5 border-r border-slate-200 text-slate-800">{reportCardData.termSummaries["Term 1"]?.total}</td>
                                            <td className="border-r border-slate-200"></td>
                                            <td colSpan="2" className="border-r border-slate-200"></td>
                                            <td className="py-2.5 border-r border-slate-200 text-slate-800">{reportCardData.termSummaries["Term 2"]?.total}</td>
                                            <td className="border-r border-slate-200"></td>
                                            <td colSpan="2" className="border-r border-slate-200"></td>
                                            <td className="py-2.5 border-r border-slate-200 text-slate-800">{reportCardData.termSummaries["Term 3"]?.total}</td>
                                            <td className="border-r border-slate-200"></td>
                                            <td className="py-2.5 border-r border-slate-200"></td>
                                            <td className="border-r border-slate-200"></td>
                                            <td></td>
                                        </tr>

                                        {/* Dynamic Percentage Metrics Row */}
                                        <tr className="bg-slate-50 font-bold">
                                            <td className="text-left px-4 py-2.5 text-indigo-700 border-r border-slate-200">PERCENTAGE</td>
                                            <td colSpan="2" className="border-r border-slate-200"></td>
                                            <td className="py-2.5 border-r border-slate-200 text-indigo-700">{reportCardData.termSummaries["Term 1"]?.percentage}%</td>
                                            <td className="border-r border-slate-200"></td>
                                            <td colSpan="2" className="border-r border-slate-200"></td>
                                            <td className="py-2.5 border-r border-slate-200 text-indigo-700">{reportCardData.termSummaries["Term 2"]?.percentage}%</td>
                                            <td className="border-r border-slate-200"></td>
                                            <td colSpan="2" className="border-r border-slate-200"></td>
                                            <td className="py-2.5 border-r border-slate-200 text-indigo-700">{reportCardData.termSummaries["Term 3"]?.percentage}%</td>
                                            <td className="border-r border-slate-200"></td>
                                            <td className="py-2.5 border-r border-slate-200 text-indigo-800 bg-indigo-50/50">{reportCardData.annualSummary.avg}%</td>
                                            <td className="border-r border-slate-200"></td>
                                            <td></td>
                                        </tr>

                                        {/* Dynamic Rank Metrics Row */}
                                        <tr className="bg-slate-50 font-bold">
                                            <td className="text-left px-4 py-2.5 text-indigo-700 border-r border-slate-200">RANK</td>
                                            <td colSpan="2" className="border-r border-slate-200"></td>
                                            <td className="py-2.5 border-r border-slate-200 text-indigo-700">{reportCardData.termSummaries["Term 1"]?.rank} / {totalPupilsInClass}</td>
                                            <td className="border-r border-slate-200"></td>
                                            <td colSpan="2" className="border-r border-slate-200"></td>
                                            <td className="py-2.5 border-r border-slate-200 text-indigo-700">{reportCardData.termSummaries["Term 2"]?.rank} / {totalPupilsInClass}</td>
                                            <td className="border-r border-slate-200"></td>
                                            <td colSpan="2" className="border-r border-slate-200"></td>
                                            <td className="py-2.5 border-r border-slate-200 text-indigo-700">{reportCardData.termSummaries["Term 3"]?.rank} / {totalPupilsInClass}</td>
                                            <td className="border-r border-slate-200"></td>
                                            <td className="border-r border-slate-200"></td>
                                            <td className="py-2.5 border-r border-slate-200 text-indigo-700 bg-indigo-50/50">{reportCardData.annualSummary.rank} / {totalPupilsInClass}</td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Attendance & Analytics Footer Panel */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                                {/* Academic Metrics */}
                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-5">
                                    <h4 className="text-xs font-bold text-indigo-700 tracking-wider uppercase mb-3">Year-End Analytics Summary</h4>
                                    <div className="space-y-2.5">
                                        <div className="flex justify-between items-center text-sm border-b border-indigo-100 pb-2">
                                            <span className="text-slate-600">Weighted Year-End Average:</span>
                                            <span className="font-extrabold text-indigo-900 text-base">{reportCardData.annualSummary.avg}%</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600">Final Cumulative Positioning:</span>
                                            <span className="font-extrabold text-indigo-700 text-base">
                                                {reportCardData.annualSummary.rank} <span className="text-xs font-medium text-slate-400">/ {totalPupilsInClass}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Updated Attendance Matrix */}
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                    <h4 className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-3">Institutional Attendance Tracker</h4>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Present</span>
                                            <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">[Manual]</span>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Absent</span>
                                            <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">[Manual]</span>
                                        </div>
                                        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                            <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Late</span>
                                            <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">[Manual]</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl text-xs">
                            No cumulative grade database records resolved under this pupil profile.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GeneralReportCard;