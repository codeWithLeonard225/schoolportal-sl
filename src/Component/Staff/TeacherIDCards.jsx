import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "react-toastify";

// Print Layout Constants
const CARDS_PER_ROW = 2;
const CARD_WIDTH = "3.375in"; // Standard CR80 ID Card Width
const GAP_BETWEEN_CARDS = "0.25in";

const TeacherIDCards = () => {
    const location = useLocation();
    const {
        schoolId: passedSchoolId,
        schoolName = "LeoTech Academy",
        schoolLogoUrl,
        schoolAddress = "123 Education Way, Academic District",
        schoolMotto = "Excellence in Education",
        schoolContact = "contact@school.edu",
    } = location.state || {};

    const schoolId = passedSchoolId || "N/A";
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (schoolId === "N/A") {
            setLoading(false);
            return;
        }

        const fetchTeachers = async () => {
            try {
                const q = query(collection(db, "Teachers"), where("schoolId", "==", schoolId));
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTeachers(list);
            } catch (err) {
                console.error("Error fetching teachers for IDs:", err);
                toast.error("Failed to load staff list.");
            } finally {
                setLoading(false);
            }
        };

        fetchTeachers();
    }, [schoolId]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return <div className="p-6 text-center font-medium text-gray-600">Loading Staff ID Cards...</div>;
    }

    return (
        <div className="p-6 min-h-screen bg-gray-100 flex flex-col items-center">
            {/* PRINT CSS OVERRIDES */}
            <style>
                {`
                    @media print {
                        body * {
                            visibility: hidden !important;
                        }

                        .cards-container, .cards-container * {
                            visibility: visible !important;
                        }

                        .cards-container {
                            position: absolute !important;
                            left: 0 !important;
                            top: 0 !important;
                            margin: 0 !important;
                            width: 100% !important;
                            display: grid !important;
                            grid-template-columns: repeat(${CARDS_PER_ROW}, ${CARD_WIDTH}) !important;
                            gap: ${GAP_BETWEEN_CARDS} !important;
                            justify-content: center !important;
                        }

                        @page {
                            size: A4 portrait;
                            margin: 0.4in;
                        }

                        body {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            margin: 0 !important;
                            background: white !important;
                            overflow: visible !important;
                        }
                    }
                `}
            </style>

            {/* Action Bar */}
            <div className="w-full max-w-4xl flex justify-between items-center mb-6 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Staff ID Cards Generator</h1>
                    <p className="text-xs text-gray-500">{schoolName} ({teachers.length} Members Found)</p>
                </div>
                <button
                    onClick={handlePrint}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm transition flex items-center gap-2"
                >
                    <span>Print All ID Cards</span> 🖨️
                </button>
            </div>

            {/* ID Cards Container */}
            <div className="cards-container grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
                {teachers.map((teacher) => {
                    // Preserved original QR Code payload
                    // const qrPayload = JSON.stringify({
                    //     teacherID: teacher.teacherID,
                    //     teacherName: teacher.teacherName,
                    //     schoolId: teacher.schoolId
                    // });
                    const qrPayload = teacher.teacherID || "";

                    return (
                        <div
                            key={teacher.id}
                            className="w-[3.375in] h-[2.125in] bg-white border border-gray-300 rounded-xl shadow-md overflow-hidden flex flex-col justify-between relative print:shadow-none print:border-gray-400 mx-auto"
                            style={{ pageBreakInside: "avoid" }}
                        >
                            {/* Card Top Banner (School Branded) */}
                            <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between border-b-2 border-indigo-500">
                                <div className="flex items-center gap-2 max-w-[70%]">
                                    {schoolLogoUrl ? (
                                        <img src={schoolLogoUrl} alt="Logo" className="w-6 h-6 object-contain rounded" />
                                    ) : (
                                        <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-[10px] font-bold">
                                            {schoolName.charAt(0)}
                                        </div>
                                    )}
                                    <div className="overflow-hidden">
                                        <h2 className="text-[11px] font-bold tracking-tight truncate leading-tight uppercase">
                                            {schoolName}
                                        </h2>
                                        <p className="text-[8px] text-gray-300 truncate leading-tight italic">
                                            {schoolMotto}
                                        </p>
                                    </div>
                                </div>
                                <span className="bg-indigo-600 text-[8px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider text-white">
                                    STAFF
                                </span>
                            </div>

                            {/* Main Body */}
                            <div className="p-2.5 flex gap-3 items-center flex-1">
                                {/* Staff Photo */}
                                <div className="w-[1in] h-[1.2in] bg-gray-100 rounded-md overflow-hidden border border-gray-300 flex-shrink-0 shadow-inner">
                                    {teacher.userPhotoUrl ? (
                                        <img
                                            src={teacher.userPhotoUrl}
                                            alt={teacher.teacherName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-[9px] text-gray-400 text-center p-1">
                                            No Photo
                                        </div>
                                    )}
                                </div>

                                {/* Details & Role */}
                                <div className="flex-1 min-w-0 flex flex-col justify-between h-[1.2in]">
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-900 leading-tight truncate">
                                            {teacher.teacherName}
                                        </h3>
                                        <p className="text-[9px] text-indigo-600 font-semibold mt-0.5">
                                            {teacher.isFormTeacher ? `Form Teacher (${teacher.assignClass || "N/A"})` : "Academic Staff"}
                                        </p>
                                    </div>

                                    <div className="text-[8.5px] text-gray-600 space-y-0.5 border-t pt-1 border-gray-100">
                                        <p className="truncate"><span className="font-medium text-gray-700">ID:</span> {teacher.teacherID || "N/A"}</p>
                                        <p className="truncate"><span className="font-medium text-gray-700">Gender:</span> {teacher.gender || "N/A"}</p>
                                        <p className="truncate"><span className="font-medium text-gray-700">Phone:</span> {teacher.phone || "N/A"}</p>
                                    </div>
                                </div>

                                {/* Preserved QR Code */}
                                <div className="flex flex-col items-center justify-center bg-gray-50 p-1 rounded border border-gray-200 flex-shrink-0">
                                    {/* <QRCodeSVG value={qrPayload} size={54} /> */}
                                    <QRCodeSVG
                                        value={qrPayload}
                                        size={54}
                                        level="M"
                                    />
                                    <span className="text-[7px] font-bold text-gray-500 mt-0.5 uppercase tracking-wider">
                                        VERIFY
                                    </span>
                                </div>
                            </div>

                            {/* Card Footer */}
                            <div className="bg-gray-100 px-3 py-1 flex justify-between items-center text-[7.5px] text-gray-500 border-t border-gray-200">
                                <span className="truncate max-w-[60%]">{schoolAddress}</span>
                                <span className="font-semibold text-gray-700">Code: {schoolId}</span>
                            </div>
                        </div>
                    );
                })}

                {teachers.length === 0 && (
                    <div className="col-span-2 text-center text-gray-500 py-10 bg-white rounded-lg border border-dashed border-gray-300">
                        No staff members found matching school code: <span className="font-semibold">{schoolId}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeacherIDCards;