import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    collection,
    onSnapshot,
    query,
    where,
    limit,updateDoc
} from "firebase/firestore";
// 🚨 IMPORTANT: Replace with your actual Firebase DB config
// Example: import { db } from "../firebaseConfig"; 
import { schooldb } from "../Database/SchoolsResults"; // Assuming this is your Firestore instance
import { toast } from 'react-toastify';


// Utility function to convert image URL to Base64 (Required for jsPDF)
const getBase64Image = (url) => {
    // 🚨 NOTE: In a real app, this function needs to fetch the image 
    // and convert it to Base64 synchronously or handle the promise 
    // within the handleDownloadPDF function. 
    // For simplicity in this example, we'll keep the placeholder URLs 
    // in the PDF handler, but this is the function you'd use 
    // for dynamic images if you resolve the CORS/async issue.

    // A simple placeholder for now:
    return url;
};

// Define the expected structure for the subject data
const initialResultData = {
    studentName: " ......................................................................",
    indexNumber: " ................................................................",
    date: "N/A",
    schoolName: "ZADET PREPARATORY & INTERNATIONAL SECONDARY SCHOOL",
    schoolAddress: "30 Parsonage Street Kissy Freetown. Tel +23276 619002 / +23276817801",
    pupilImgUrl: "/images/me.jpg", // Default placeholder
    schoolLogoUrl: "/images/Zadet.jpg", // Default placeholder
    core: {
        mathematics: { grade: "", remark: "" },
        languageArts: { grade: "", remark: "" },
        integratedScience: { grade: "", remark: "" },
        socialStudies: { grade: "", remark: "" },
    },
    optionalCore: {
        french: { grade: "", remark: "" },
        agricScience: { grade: "", remark: "" },
        phEducation: { grade: "", remark: "" },
        relMoralEdu: { grade: "", remark: "" },
    },
    prevocational: {
        businessStudies: { grade: "", remark: "" },
        homeEconomics: { grade: "", remark: "" },
        introductoryTech: { grade: "", remark: "" },
    },
    numPasses: "N/A",
    aggregate: "N/A",
};


/**
 * Renders the Basic Education Certificate Examination (BECE) Statement of Result.
 */
const BECEStatementOfResult = () => {

    // --- 1. STATE & SEARCH INPUT ---
    const [searchName, setSearchName] = useState('');
    const [resultData, setResultData] = useState(null); // The fetched result
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const data = { ...initialResultData, ...(resultData || {}) };

    // --- 2. DATA FETCHING LOGIC ---
    const handleSearch = useCallback(async (e) => {
        e.preventDefault();

        const nameToSearch = searchName.trim();
        if (!nameToSearch) {
            toast.warn("Please enter a student name to search.");
            return;
        }

        setLoading(true);
        setResultData(null);
        setError(null);

        try {
            // 🚨 Note: Firestore 'where' clause for string equality is case-sensitive.
            // For a robust search, you'd typically use a separate search index (like Algolia)
            // or save a lowercase version of the name to the DB.
            const resultsRef = collection(schooldb, "BECE_Results");
            const q = query(
                resultsRef,
                where("studentName", "==", nameToSearch), // Case-sensitive exact match
                limit(1) // We only need the first result
            );

            // Using onSnapshot for real-time fetch (or getDocs for one-time fetch)
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    const fetchedData = { id: doc.id, ...doc.data() };
                    setResultData(fetchedData);
                    toast.success(`Result found for ${nameToSearch}!`);
                } else {
                    setResultData(null);
                    toast.error(`No result found for "${nameToSearch}".`);
                }
                setLoading(false);
             
                unsubscribe();
            }, (err) => {
                console.error("Firestore Search Error:", err);
                setError("Failed to fetch data.");
                setLoading(false);
                unsubscribe();
            });

        } catch (err) {
            console.error("Search Error:", err);
            setError("An unexpected error occurred during search.");
            setLoading(false);
        }
    }, [searchName]);


    // Helper function to render a subject row (kept for JSX)
    const SubjectRow = ({ subjectName, result }) => (
        <div className="flex justify-between border-b border-gray-300 py-1">
            <span className="w-1/2 font-medium">{subjectName}</span>
            <span className="w-1/4 text-center border-l border-r border-gray-300">
                {result?.grade || '—'}
            </span>
            <span className="w-1/4 text-center">{result?.remark || '—'}</span>
        </div>
    );

    // 🔹 Handler for standard browser printing
    const handlePrint = () => {
        window.print();
    };


    // --- 3. PDF GENERATION LOGIC ---
    /**
     * Draws a unique custom border on the PDF page. (Unchanged)
     */
    const drawUniqueBorder = (doc) => {
        const margin = 10;
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight() - margin;

        // 1. Outer Border (Thick Blue Line)
        const outerMargin = 5;
        doc.setDrawColor(0, 51, 102);
        doc.setLineWidth(1.5);
        doc.rect(outerMargin, outerMargin, pageW - 2 * outerMargin, pageH - 2 * outerMargin, 'S');

        // 2. Inner Border (Thinner Gray/Silver Line)
        const innerMargin = 10;
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.5);
        doc.rect(innerMargin, innerMargin, pageW - 2 * innerMargin, pageH - 2 * innerMargin, 'S');
    };

    const handleDownloadPDF = async () => {
     if (!resultData) {
            toast.error("Please search and load a result before downloading.");
            return;
        }
        // we'll use placeholder data/images here.
        const SCHOOL_LOGO_BASE64 = getBase64Image(data.schoolLogoUrl);
        const PUPIL_IMG_BASE64 = getBase64Image(data.pupilImgUrl);
        const WATERMARK_BASE64 = SCHOOL_LOGO_BASE64;

        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        const marginX = 15;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const tableWidth = pageWidth - (2 * marginX);

        let y = 25;

        // -----------------------------------------------------------
        // 🌟 ADD WATERMARK (faded)
        // -----------------------------------------------------------
        const wmWidth = 80;
        const wmHeight = 80;
        const wmX = (pageWidth / 2) - (wmWidth / 2);
        const wmY = (pageHeight / 2) - (wmHeight / 2) + 40;

        const gState = new doc.GState({ opacity: 0.15 });
        doc.setGState(gState);
        doc.addImage(WATERMARK_BASE64, 'JPEG', wmX, wmY, wmWidth, wmHeight);
        doc.setGState(new doc.GState({ opacity: 1.0 }));

        // -----------------------------------------------------------
        // 🌟 PDF Header
        // -----------------------------------------------------------
        // 🚨 1. School Name in Blue
        doc.setTextColor(0, 51, 102); // Set color to Dark Blue
        doc.setFontSize(16).setFont('helvetica', 'bold');
        doc.text(data.schoolName, pageWidth / 2, y, null, null, "center");
        y += 7;
        doc.setTextColor(0, 0, 0); // Reset color to Black

        doc.setFontSize(10).setFont('helvetica', 'normal');
        doc.text(data.schoolAddress, pageWidth / 2, y, null, null, "center");
        y += 5;

        doc.line(marginX, y, pageWidth - marginX, y);
        y += 5;

        // School Logo
        const logoWidth = 24;
        const logoHeight = 24;
        const logoX = pageWidth / 2 - (logoWidth / 2);
        doc.addImage(SCHOOL_LOGO_BASE64, 'JPEG', logoX, y, logoWidth, logoHeight);
        y += logoHeight + 5;

        // Title
        // 🚨 2. BASIC EDUCATION CERTIFICATE EXAMINATION (BECE) in Blue
        doc.setTextColor(0, 51, 102); // Set color to Dark Blue
        doc.setFontSize(18).setFont('helvetica', 'bold');
        doc.text("BASIC EDUCATION CERTIFICATE EXAMINATION (BECE)", pageWidth / 2, y + 5, null, null, "center");
        doc.setFontSize(14);
        
        // 🚨 3. STATEMENT OF RESULT in Blue
        doc.text("STATEMENT OF RESULT", pageWidth / 2, y + 12, null, null, "center");
        doc.setTextColor(0, 0, 0); // Reset color to Black
        
        doc.line(pageWidth / 2 - 35, y + 13, pageWidth / 2 + 35, y + 13);
        y += 24;
        // -----------------------------------------------------------
        // 🌟 Certification Text + Pupil Image
        // -----------------------------------------------------------
        doc.setFontSize(10).setFont('helvetica', 'normal');
        const pupilImgWidth = 24;
        const pupilImgHeight = 24;
        const pupilImgX = pageWidth - marginX - pupilImgWidth;
        const textYStart = y;

        doc.text(`Date: ${data.date || '………………………..'}`, marginX, y);
        y += 7;

        doc.addImage(PUPIL_IMG_BASE64, 'JPEG', pupilImgX, textYStart + 2, pupilImgWidth, pupilImgHeight);

        // Certification text with line padding
        const certLines = [
            `THIS IS TO CERTIFY THAT: ${data.studentName.toUpperCase() || '……………………………………………………………………………………………'}`,
            `Index Number: ${data.indexNumber || '………………………………...'}`,
            `Took the above examination and obtained the following results:`
        ];

        const textLineHeight = 5;
        const linePadding = 2;

        certLines.forEach((line, index) => {
            doc.text(line, marginX, y + (index * (textLineHeight + linePadding)));
        });

        y += certLines.length * (textLineHeight + linePadding) + 5;

        // -----------------------------------------------------------
        // 🌟 Results Table
        // -----------------------------------------------------------
        const tableData = [];

        const addSection = (title, subjects) => {
            tableData.push([{
                content: title,
                colSpan: 3,
                styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } // Light gray background for section headers
            }]);

            const subjectMap = {
                mathematics: "1. MATHEMATICS", languageArts: "2. LANGUAGE ARTS",
                integratedScience: "3. INTEGRATED SCIENCE", socialStudies: "4. SOCIAL STUDIES",
                french: "5. FRENCH", agricScience: "6. AGRIC. SCIENCE", phEducation: "7. PH. EDUCATION",
                relMoralEdu: "REL. AND MORAL EDU.", businessStudies: "8. BUSINESS STUDIES",
                homeEconomics: "9. HOME ECONOMICS", introductoryTech: "10. INTRODUCTORY TECH."
            };

            Object.keys(subjects).forEach(key => {
                const subject = subjects[key];
                tableData.push([
                    subjectMap[key] || key.toUpperCase(),
                    subject?.grade || '—',
                    subject?.remark || '—'
                ]);
            });
        };
addSection('A. COMPULSORY CORE', data.core);
        addSection('B. OPTIONAL CORE', data.optionalCore);
        addSection('C. PRE-VOCATIONAL', data.prevocational);

        autoTable(doc, {
            startY: y,
            head: [['SUBJECT', 'GRADE', 'INTERPRETATION']],
            body: tableData,
            theme: 'grid',
            margin: { left: marginX, right: marginX },
            tableWidth: tableWidth,
            headStyles: {
                fillColor: [0, 51, 102], // Dark Blue
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 10,
                halign: 'center'
            },
            styles: { fontSize: 9, cellPadding: 2, fillColor: null },
            columnStyles: {
                0: { cellWidth: tableWidth * 0.55, halign: 'left' },
                // 🛑 CHANGE: Apply bold style to Grade column (Index 1)
                1: { cellWidth: tableWidth * 0.15, halign: 'center', fontStyle: 'bold' }, 
                // 🛑 CHANGE: Apply bold style to Interpretation column (Index 2)
                2: { cellWidth: tableWidth * 0.30, halign: 'center', fontStyle: 'bold' }, 
            },
            didDrawPage: (hookData) => { y = hookData.cursor.y; }
        });


        y += 10;

        // -----------------------------------------------------------
        // 🌟 Summary & Signature
        // -----------------------------------------------------------
        doc.setFontSize(10).setFont('helvetica', 'bold');
        doc.text(`NUMBER OF PASSES: ${data.numPasses || '………………………..'}`, marginX, y);
        doc.text(`AGGREGATE: ${data.aggregate || '……………………..'}`, pageWidth - marginX, y, null, null, "right");
        y += 10;

       // --- Signature Row (Principal and Proprietor separated horizontally) ---
    const principalSignX = marginX; // Left alignment
    const proprietorSignX = pageWidth / 2 + 10; // Right side alignment (adjusted to fit on the page)

    doc.text("Sign of Principal: _________________________", principalSignX, y);
    doc.text("Sign of Proprietor: _________________________", proprietorSignX, y);
    y += 10; // New line for the date

    // --- Date of Issue Row (Centered/Aligned) ---
    const dateOfIssueX = principalSignX; // Align with the left edge for simplicity

    doc.text("Date of Issue: _________________________             ", dateOfIssueX, y); 
    
       

        doc.setFontSize(9).setFont('helvetica', 'bold'); // Make it slightly smaller and bold for emphasis
        doc.setTextColor(200, 0, 0); // Red text for attention
        doc.text("Any Alteration will render this Certificate Invalid", pageWidth - marginX, y, null, null, "right");
        doc.setTextColor(0, 0, 0); // Reset color to black
        y += 1;
        // -----------------------------------------------------------
        // 🌟 Draw the Unique Border Last
        // -----------------------------------------------------------
        drawUniqueBorder(doc);

        // Save PDF
        doc.save(`BECE_Result_${data.indexNumber}_${data.studentName.replace(/\s/g, '_')}.pdf`);
    };


    // ------------------- RENDERED JSX -------------------

    return (
        <div className="max-w-4xl mx-auto p-8 bg-white shadow-xl border-4 border-gray-800 my-10 font-sans relative border-page">

            {/* 🛑 SEARCH BLOCK 🛑 */}
            <form onSubmit={handleSearch} className="no-print mb-6 p-4 bg-gray-50 rounded-lg shadow-inner flex space-x-3 items-center">
                <input
                    type="text"
                    placeholder="Enter Student Name (Exact Match)"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={loading}
                />
                <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-semibold shadow disabled:opacity-50"
                    disabled={loading}
                >
                    {loading ? 'Searching...' : '🔍 Search Result'}
                </button>
            </form>

            {/* ERROR/LOADING DISPLAY */}
            {loading && <p className="text-center text-indigo-600 mb-4">Loading result...</p>}
            {error && <p className="text-center text-red-600 mb-4">Error: {error}</p>}

            {/* RENDER REPORT ONLY IF DATA IS FOUND */}
            {resultData ? (
                <>
                    {/* Action Buttons (Hidden during browser print) */}
                    <div className="flex justify-center gap-4 mb-6 no-print z-10 relative">
                        <button
                            onClick={handleDownloadPDF}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold shadow"
                        >
                            📄 Download PDF (A4)
                        </button>
                        {/* <button
                            onClick={handlePrint}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold shadow"
                        >
                            🖨️ Print
                        </button> */}
                    </div>

                    {/* ⭐️ WATERMARK (Faded Logo) - Uses JSX for browser view */}
                    <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-0 opacity-10">
                        <img src={data.schoolLogoUrl} alt="Watermark Logo" className='w-80 h-80 object-contain' />
                    </div>

                    <div className='relative z-10'> {/* Wrapper to keep content above watermark */}

                        {/* School Header */}
                        <div className="text-center mb-4">
                            <h1 className="text-xl font-extrabold tracking-wider mb-1">
                                {data.schoolName}
                            </h1>
                            <h2 className="text-md font-bold uppercase border-b-2 border-gray-800 pb-1 inline-block">
                                {data.schoolAddress}
                            </h2>
                        </div>

                        {/* 1. ⭐️ School Logo Center */}
                        <div className="flex justify-center mb-6">
                            <img src={data.schoolLogoUrl} alt="School Logo" id='schoollogo' className='w-24 h-24 object-contain border p-1' />
                        </div>

                        {/* BECE Title Block */}
                        <div className="text-center mb-8">
                            <h1 className="text-2xl font-extrabold tracking-wider mb-1">
                                BASIC EDUCATION CERTIFICATE EXAMINATION (BECE)
                            </h1>
                            <h2 className="text-lg font-bold uppercase border-b-2 border-gray-800 pb-1 inline-block">
                                STATEMENT OF RESULT
                            </h2>
                        </div>

                        {/* 2. ⭐️ Pupil Image and Date Below Title Block */}
                        <div className="flex justify-between items-start mb-1">

                            {/* Certification Text (Now takes up 65% of the space) */}
                            <div className="w-8/12 text-lg">
                                <p className="leading-relaxed">
                                    THIS IS TO CERTIFY THAT <span className="font-bold underline">
                                        {data.studentName.toUpperCase()}
                                    </span>
                                    <br />
                                    Index Number: <span className="font-bold underline">{data.indexNumber || '………………………………...'}</span>
                                    &nbsp;Took the above examination and obtained the following results:
                                </p>
                            </div>

                            {/* Pupil Image & Date (Now takes up 30% of the space, aligned right) */}
                            <div className="w-auto flex flex-col items-end space-y-2">
                                <img src={data.pupilImgUrl} alt="Pupil Photo" id='pupil-img' className='w-24 h-24 object-cover border-2 border-gray-500' />
                                <div className="text-sm">
                                    Date: <span className="underline">{data.date || '………………………..'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Results Table */}
                        <div className="border border-gray-800 p-4">
                            <div className="flex justify-between font-bold text-gray-700 bg-gray-100 p-1 mb-2">
                                <span className="w-1/2">SUBJECT</span>
                                <span className="w-1/4 text-center border-l border-r border-gray-300">GRADE</span>
                                <span className="w-1/4 text-center">INTERPRETATION</span>
                            </div>

                            {/* A. COMPULSORY CORE */}
                            <h3 className="text-md font-bold mt-2 mb-2">A. COMPULSORY CORE:</h3>
                            <div className="ml-4">
                                <SubjectRow subjectName="1. MATHEMATICS" result={data.core.mathematics} />
                                <SubjectRow subjectName="2. LANGUAGE ARTS" result={data.core.languageArts} />
                                <SubjectRow subjectName="3. INTEGRATED SCIENCE" result={data.core.integratedScience} />
                                <SubjectRow subjectName="4. SOCIAL STUDIES" result={data.core.socialStudies} />
                            </div>

                            {/* B. OPTIONAL CORE */}
                            <h3 className="text-md font-bold mt-4 mb-2">B. OPTIONAL CORE:</h3>
                            <div className="ml-4">
                                <SubjectRow subjectName="5. FRENCH" result={data.optionalCore.french} />
                                <SubjectRow subjectName="6. AGRIC. SCIENCE" result={data.optionalCore.agricScience} />
                                <SubjectRow subjectName="7. PH. EDUCATION" result={data.optionalCore.phEducation} />
                                <SubjectRow subjectName="REL. AND MORAL EDU." result={data.optionalCore.relMoralEdu} />
                            </div>

                            {/* C. PRE-VOCATIONAL */}
                            <h3 className="text-md font-bold mt-4 mb-2">C. PRE-VOCATIONAL:</h3>
                            <div className="ml-4">
                                <SubjectRow subjectName="8. BUSINESS STUDIES" result={data.prevocational.businessStudies} />
                                <SubjectRow subjectName="9. HOME ECONOMICS" result={data.prevocational.homeEconomics} />
                                <SubjectRow subjectName="10. INTRODUCTORY TECH." result={data.prevocational.introductoryTech} />
                            </div>

                        </div>

                        {/* Summary */}
                        <div className="flex justify-between mt-6 text-lg font-bold">
                            <p>
                                NUMBER OF PASSES: <span className="underline">{data.numPasses || '………………………..'}</span>
                            </p>
                            <p>
                                AGGREGATE: <span className="underline">{data.aggregate || '……………………..'}</span>
                            </p>
                        </div>

                        <div className="mt-12 text-center text-sm">
                            <p>Signature of Principal/Head Teacher: _________________________</p>
                            <p className='mt-4'>Date of Issue: _________________________</p>
                        </div>
                    </div>
                </>
            ) : (
                <p className="text-center text-gray-500 mt-10">
                    Enter a **Student Name** in the search bar above to load the BECE Statement of Result.
                </p>
            )}

            {/* Print CSS (no-print, A4, etc.) remains the same) */}
            <style jsx="true">{`
            /* 🌟 Page Border Style (For Browser View) */
            .border-page {
              position: relative;
              border: 10px double #003366; /* Blue outer double line */
              padding: 25px;
              box-shadow: 0 0 15px rgba(0,0,0,0.2);
              background: white;
            }

            .border-page::before {
              content: "";
              position: absolute;
              top: 10px;
              bottom: 10px;
              left: 10px;
              right: 10px;
              border: 3px solid #999;
              pointer-events: none;
            }

            /* Print Setup */
            @media print {
              .no-print {
                display: none;
              }
              @page {
                size: A4 portrait;
                margin: 10mm;
              }
              body {
                background: #fff;
                color: #000;
              }
              .border-page {
                border: 8px double #000;
                box-shadow: none;
              }
              .border-page::before {
                border-color: #555;
              }
            }
          `}</style>
        </div>
    );
};

export default BECEStatementOfResult;