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

const [students, setStudents] = useState([
  {
    name: "Destiny Bangura",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Bangura Fauza",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Brima Emme Suma",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Dainkeh Kadija Marie",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Faulkner Valeria",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Hindowa Momoh",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Hughes Ryan",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Jalloh Haja Isata",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Jason Sam-Sheku",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Kallon Hafiz",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Kanu Deborah",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Kargbo Victoria",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "King Charang",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "King Daniel",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Macauley Hawa",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Mansaray Jane",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Mansaray Neriah",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Mohamed Godswill",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Munu Joshua",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Samuels Harolda",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Sankoh Daness",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Seray-Wurie Naomi",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Sesay Fatu",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Sesay Isaac",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Sesay Joy Marian",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Sharka Janet",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Valcarcel Valdelle",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Williams Andrew",
    gender: "Male",
    feesCategory: "Continue",
  },
]);

    const [commonData, setCommonData] = useState({
        class: "JSS 1 BLUE", 
        academicYear: "2026/2027", 
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
        if (!window.confirm(`Register all ${students.length} students to ${commonData.class}?`)) return;
        
        setIsSubmitting(true);
        toast.info(`Uploading batch for ${commonData.class}...`);

        try {
            for (const student of students) {
                const newId = uuidv4().slice(0, 8);
                const studentData = {
                    studentID: newId,
                    studentName: student.name.toUpperCase().trim(),
                    gender: student.gender,
                    feesCategory: student.feesCategory, 
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
            
            toast.success(`🎉 SUCCESS: ${students.length} students registered!`);
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
                        <p className="text-sm opacity-80 font-semibold text-yellow-400">TOTAL STUDENTS: {students.length}</p>
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
                        {isSubmitting ? `Syncing ${students.length} Records...` : `Register ${students.length} Students`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkRegistration;