import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../../firebase"; 
import { pupilLoginFetch } from "../Database/PupilLogin";
import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { useAuth } from "../Security/AuthContext";

const BulkRegistration = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const schoolId = user?.schoolId || "N/A";
    const registeredBy = user?.data?.adminID || user?.data?.teacherID || "";

    // ✅ List updated: All students set to "New" feesCategory


// ✅ Updated students list: All set to (Continue)
// ✅ Updated students list: All set to (Continue)
// ✅ Updated students list: All set to (Continue)
const [students, setStudents] = useState([
    { name: "ABU MARIAMA ZOE", gender: "Female", feesCategory: "Continue" },
    { name: "BAH SULAIMAN", gender: "Male", feesCategory: "Continue" },
    { name: "BEAH JAMESTINA", gender: "Female", feesCategory: "Continue" },
    { name: "CLARKE NATASHA EDWINA", gender: "Female", feesCategory: "Continue" },
    { name: "HAMID ABDUL RAHMAN", gender: "Male", feesCategory: "Continue" },
    { name: "HASSAN OLUWATOBI", gender: "Male", feesCategory: "Continue" },
    { name: "JAH MARY MELROSE", gender: "Female", feesCategory: "Continue" },
    { name: "KALOKOH NAOMI", gender: "Female", feesCategory: "Continue" },
    { name: "KARGBO MARIAN", gender: "Female", feesCategory: "Continue" },
    { name: "KOROMA ABDUL RAZAK IMRAN", gender: "Male", feesCategory: "Continue" },
    { name: "MACAVOREY JESSIE DENISHA", gender: "Female", feesCategory: "Continue" },
    { name: "MAC-SHAW SUZETTE", gender: "Female", feesCategory: "Continue" },
    { name: "MANSARAY IBRAHIM", gender: "Male", feesCategory: "Continue" },
    { name: "MANSARAY KADIJAH", gender: "Female", feesCategory: "Continue" },
    { name: "MASON VICTORIA", gender: "Female", feesCategory: "Continue" },
    { name: "NEVILIE TIMALYN", gender: "Female", feesCategory: "Continue" },
    { name: "QUEE GRACE R. M", gender: "Female", feesCategory: "Continue" },
    { name: "ROY-MACAULAY CHERISE", gender: "Female", feesCategory: "Continue" },
    { name: "SACCOH LYNOD", gender: "Male", feesCategory: "Continue" },
    { name: "SANKOH ADAMA ZARA", gender: "Female", feesCategory: "Continue" },
    { name: "SENESIE KADIJAH SIA", gender: "Female", feesCategory: "Continue" },
    { name: "SESAY MEMROSE", gender: "Female", feesCategory: "Continue" },
    { name: "SESAY WUZAINATU ALHASSAN", gender: "Female", feesCategory: "Continue" },
    { name: "SIERRA MAMIE", gender: "Female", feesCategory: "Continue" },
    { name: "SPAINE DESMONDA JOSEPHINE LAURA", gender: "Female", feesCategory: "Continue" },
    { name: "TAYLOR-KAMARA UMARI KING", gender: "Male", feesCategory: "Continue" },
    { name: "THORPE MOYIN WINIFRED", gender: "Female", feesCategory: "Continue" }
]);
    const [commonData, setCommonData] = useState({
        class: "FORM IV EDEXCEL", 
        academicYear: "2025/2026", 
        pupilType: "Private", 
        registrationDate: new Date().toISOString().slice(0, 10),
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleGender = (index) => {
        const updatedStudents = [...students];
        updatedStudents[index].gender = updatedStudents[index].gender === "Male" ? "Female" : "Male";
        setStudents(updatedStudents);
    };

    const handleBulkSubmit = async () => {
        if (schoolId === "N/A") return toast.error("User Auth Error: School ID not detected.");
        if (!window.confirm(`Register all ${students.length} students as NEW to ${commonData.class}?`)) return;
        
        setIsSubmitting(true);
        toast.info(`Uploading batch for ${commonData.class}...`);

        try {
            for (const student of students) {
                const newId = uuidv4().slice(0, 8);
                const studentData = {
                    studentID: newId,
                    studentName: student.name.toUpperCase().trim(),
                    gender: student.gender,
                    feesCategory: "New", 
                    class: commonData.class,
                    academicYear: commonData.academicYear,
                    pupilType: commonData.pupilType,
                    registrationDate: commonData.registrationDate,
                    schoolId: schoolId,
                    registeredBy: registeredBy,
                    timestamp: new Date(),
                    dob: "", age: "", addressLine1: "", parentName: "", parentPhone: "",
                    userPhotoUrl: null, userPublicId: null
                };

                // Save to primary Firestore
                const docRef = await addDoc(collection(db, "PupilsReg"), studentData);
                // Sync to secondary login database
                await setDoc(doc(pupilLoginFetch, "PupilsReg", docRef.id), studentData);
            }
            
            toast.success(`🎉 SUCCESS: ${students.length} new students registered!`);
            navigate(-1);
        } catch (error) {
            console.error(error);
            toast.error("Upload failed. Check your network.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4">
            <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden border-t-4 border-indigo-900">
                <div className="bg-indigo-900 p-6 text-white flex justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">Bulk Upload: {commonData.class}</h2>
                        <p className="text-sm opacity-80 font-semibold text-yellow-400">CATEGORY: ALL NEW STUDENTS</p>
                    </div>
                    <button onClick={() => navigate(-1)} className="text-sm underline">Back</button>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="text-xs text-gray-400 font-bold uppercase">Target Class</label>
                            <input type="text" value={commonData.class} readOnly className="w-full border p-2 rounded bg-gray-50 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400 font-bold uppercase">Academic Year</label>
                            <input type="text" value={commonData.academicYear} readOnly className="w-full border p-2 rounded bg-gray-50 text-sm" />
                        </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto border rounded divide-y">
                        {students.map((student, index) => (
                            <div key={index} className="flex justify-between items-center p-3 hover:bg-indigo-50 transition-all">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-700">{index + 1}. {student.name}</span>
                                    <span className="text-[10px] text-green-600 uppercase font-black tracking-wider">★ {student.feesCategory}</span>
                                </div>
                                <button 
                                    onClick={() => toggleGender(index)}
                                    className={`text-xs px-4 py-1 rounded-full font-bold shadow-sm transition-all ${
                                        student.gender === "Male" 
                                        ? "bg-blue-600 text-white" 
                                        : "bg-pink-500 text-white"
                                    }`}
                                >
                                    {student.gender}
                                </button>
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={handleBulkSubmit}
                        disabled={isSubmitting}
                        className="w-full mt-6 bg-indigo-800 text-white py-4 rounded-xl font-black text-lg hover:bg-indigo-900 disabled:bg-gray-400 shadow-xl active:scale-[0.98] transition-all"
                    >
                        {isSubmitting ? "Syncing 13 New Records..." : `Register 13 New Students`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkRegistration;