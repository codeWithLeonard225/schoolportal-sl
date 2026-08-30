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
const [students, setStudents] = useState([
  { name: "SALMA KOBIA", gender: "Female", feesCategory: "Continue" },
  { name: "FATMATA J TURAY", gender: "Female", feesCategory: "Continue" },
  { name: "ADMIRE A CONTEH", gender: "Female", feesCategory: "Continue" },
  { name: "IDRISSATU P KANU", gender: "Female", feesCategory: "Continue" },
  { name: "FAVOUR C. EZENWAMMA", gender: "Female", feesCategory: "Continue" },
  { name: "CHRISTIANA O. J. SESAY", gender: "Female", feesCategory: "Continue" },
  { name: "PHEBEAN ISHA JAJUA", gender: "Female", feesCategory: "Continue" },
  { name: "DAYANNA KARAMA", gender: "Female", feesCategory: "Continue" },
  { name: "RACHEL MAX KANU", gender: "Female", feesCategory: "Continue" },
  { name: "MARY A. L. FARMAH", gender: "Female", feesCategory: "Continue" },
  { name: "ZAINAB A JALLOH", gender: "Female", feesCategory: "Continue" },
  { name: "MARIE CONTEH", gender: "Female", feesCategory: "Continue" },
  { name: "ESTHER ELEANOR B. SPENCER", gender: "Female", feesCategory: "Continue" },
  { name: "POSSELLAH M KAMARA", gender: "Female", feesCategory: "Continue" },
  { name: "MARIAMA SAMURA KAMARA", gender: "Female", feesCategory: "Continue" },
  { name: "MANJULA K. O. TARAWALLY", gender: "Female", feesCategory: "Continue" },
  { name: "AMINATA KOROMA", gender: "Female", feesCategory: "Continue" },
  { name: "ISATA M TURAY", gender: "Female", feesCategory: "Continue" },
  { name: "MOIJAMA MISBELTU JALLOH", gender: "Female", feesCategory: "Continue" },
  { name: "RICHELLE ELE", gender: "Female", feesCategory: "Continue" },
  { name: "SARAH M. VINCENT", gender: "Female", feesCategory: "Continue" },
  { name: "MABEL C. STEVENS", gender: "Female", feesCategory: "Continue" },
  { name: "SURAIA I SESAY", gender: "Female", feesCategory: "Continue" },
  { name: "BALU B. MURIE", gender: "Female", feesCategory: "Continue" },
  { name: "KADIYATU Z BANGURA", gender: "Female", feesCategory: "Continue" },
  { name: "RAMATULAI SANKOH", gender: "Female", feesCategory: "Continue" },
  { name: "THALESHA KAMARA", gender: "Female", feesCategory: "Continue" },
  { name: "HAJA TENNEH SHERIFF", gender: "Female", feesCategory: "Continue" },
  { name: "HAJA SAFFIATU WILLIAMS", gender: "Female", feesCategory: "Continue" },
  { name: "FATMATA A. CONTEH", gender: "Female", feesCategory: "Continue" },
  { name: "HAJA MARIAMA MANSARAY", gender: "Female", feesCategory: "Continue" },
  { name: "ELEANOR ADAMA SESAY", gender: "Female", feesCategory: "Continue" },
  { name: "MOHAMED J BAH", gender: "Male", feesCategory: "Continue" },
  { name: "THOMAS DAVID BANGURA", gender: "Male", feesCategory: "Continue" },
  { name: "NURU DEEN", gender: "Male", feesCategory: "Continue" },
  { name: "CLOE FREEMAN", gender: "Female", feesCategory: "Continue" },
  { name: "EPHRAIM CONTEH", gender: "Male", feesCategory: "Continue" },
  { name: "JAMES G HAFFER", gender: "Male", feesCategory: "Continue" },
  { name: "CHRISTIAN KANU", gender: "Male", feesCategory: "Continue" },
  { name: "OSMAN J KOROMA", gender: "Male", feesCategory: "Continue" },
  { name: "PAPISS I KAMARA", gender: "Male", feesCategory: "Continue" },
  { name: "ERRY RAHIM KABBA", gender: "Male", feesCategory: "Continue" },
  { name: "FAISAL L I KAMARA", gender: "Male", feesCategory: "Continue" },
  { name: "VICTOR NASRALLA", gender: "Male", feesCategory: "Continue" },
  { name: "FAVOUR C. NGENE", gender: "Female", feesCategory: "Continue" },
  { name: "IBRAHIM O. LOGAN", gender: "Male", feesCategory: "Continue" },
  { name: "PRINCE M SERRY", gender: "Male", feesCategory: "Continue" },
  { name: "ABDULAI A SESAY", gender: "Male", feesCategory: "Continue" },
  { name: "ABDUL A. G. SESAY", gender: "Male", feesCategory: "Continue" },
  { name: "MOHAMED TARAWALLY", gender: "Male", feesCategory: "Continue" },
  { name: "AHMED H THOMPSON", gender: "Male", feesCategory: "Continue" },
  { name: "MUSU R. SESAY", gender: "Female", feesCategory: "Continue" },
  { name: "MILLY C. ISMAIL", gender: "Female", feesCategory: "Continue" },
  { name: "MACE H BANGURA", gender: "Male", feesCategory: "Continue" }
]);
    const [commonData, setCommonData] = useState({
        class: "JSS 2", 
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