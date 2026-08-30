import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { useLocation } from "react-router-dom";

const StaffIdCards = () => {
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";
    const [teachers, setTeachers] = useState([]);

    useEffect(() => {
        if (schoolId === "N/A") return;
        const q = query(collection(db, "Teachers"), where("schoolId", "==", schoolId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [schoolId]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-6 bg-gray-100 min-h-screen">
            <div className="flex justify-between items-center mb-6 print:hidden">
                <h1 className="text-2xl font-bold text-gray-800">Staff ID Cards Generator</h1>
                <button
                    onClick={handlePrint}
                    className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    🖨️ Print ID Cards
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4">
                {teachers.map((teacher) => {
                    // Embed payload with relevant parameters
                    const qrPayload = JSON.stringify({
                        teacherID: teacher.teacherID,
                        schoolId: teacher.schoolId,
                    });

                    return (
                        <div
                            key={teacher.id}
                            className="bg-white border-2 border-indigo-600 rounded-2xl shadow-md p-4 flex flex-col items-center w-full max-w-sm mx-auto print:break-inside-avoid print:shadow-none"
                        >
                            {/* Card Header */}
                            <div className="w-full text-center border-b pb-2 mb-3">
                                <h3 className="text-lg font-bold text-indigo-900 uppercase tracking-wide">
                                    STAFF IDENTIFICATION
                                </h3>
                                <p className="text-xs text-gray-500 font-semibold">LEOTECH ACADEMY</p>
                            </div>

                            {/* Staff Details & Photo */}
                            <div className="flex w-full space-x-4 items-center mb-3">
                                <div className="w-24 h-28 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0 border border-gray-300">
                                    {teacher.userPhotoUrl ? (
                                        <img
                                            src={teacher.userPhotoUrl}
                                            alt={teacher.teacherName}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-xs text-gray-400">
                                            No Photo
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 text-left space-y-1">
                                    <h4 className="font-bold text-gray-800 text-base leading-tight">
                                        {teacher.teacherName}
                                    </h4>
                                    <p className="text-xs text-indigo-600 font-semibold">
                                        ID: {teacher.teacherID}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        {teacher.isFormTeacher ? `Form Teacher (${teacher.assignClass})` : "Teaching Staff"}
                                    </p>
                                    <p className="text-xs text-gray-500">Ph: {teacher.phone || "N/A"}</p>
                                </div>
                            </div>

                            {/* QR Code Section */}
                            <div className="bg-gray-50 p-2 rounded-xl border border-gray-200 flex flex-col items-center mt-auto w-full">
                                <QRCodeSVG value={qrPayload} size={110} level="H" />
                                <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-mono">
                                    Scan to Clock-In / Out
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default StaffIdCards;