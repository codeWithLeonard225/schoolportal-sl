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
  {
    name: "Haja Bunduba Amadu Jalloh",
    registrationFormNo: "211",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Fatima Ibrahim Kamara",
    registrationFormNo: "1303",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Hassanatu Mohamed Bah",
    registrationFormNo: "546",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Ishmiatu Precious Kargbo",
    registrationFormNo: "1266",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Ramatulai M. Koroma",
    registrationFormNo: "2125",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Khadija Sulaiman Kayaat",
    registrationFormNo: "1320",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Hawanatu Samad Jalloh",
    registrationFormNo: "2130",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Haja Fatima Sumah",
    registrationFormNo: "2134",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Ramatulai Mariama Koroma",
    registrationFormNo: "2125",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Sallaymatu Koroma",
    registrationFormNo: "2117",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Mariama M. Sankoh",
    registrationFormNo: "2124",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Aminata M. Koroma",
    registrationFormNo: "1274",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Fatmata Wendy Kargbo",
    registrationFormNo: "2119",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Isatu Samad Jalloh",
    registrationFormNo: "2129",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Hawa Alima Conteh",
    registrationFormNo: "248",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Isha Bangura",
    registrationFormNo: "1082",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Fatu Sesay",
    registrationFormNo: "2135",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Khadija Hassan Jalloh",
    registrationFormNo: "503",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "N'mah Daboh",
    registrationFormNo: "2116",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Mariama Bashiru Jabbie",
    registrationFormNo: "1667",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Adama Bundu",
    registrationFormNo: "841",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Masarah Fofanah",
    registrationFormNo: "1355",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Hawa Kalokoh",
    registrationFormNo: "2133",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Mariatu Bakarr Kamara",
    registrationFormNo: "1571",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Emma Saidu Kamara",
    registrationFormNo: "2136",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Maryam Koroma",
    registrationFormNo: "553",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Aminata Mansaray",
    registrationFormNo: "2123",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Kadijatu Abubakarr Barrie",
    registrationFormNo: "1273",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Olaymatu king",
    registrationFormNo: "1679",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Patrick B. Bangura",
    registrationFormNo: "2121",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Aftab Coker",
    registrationFormNo: "2120",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Fadi Koroma",
    registrationFormNo: "1379",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Momoh M. Sandi",
    registrationFormNo: "218",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Mohamed K. Bayoh",
    registrationFormNo: "898",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Abubakarr Jabbie",
    registrationFormNo: "2118",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Ibrahim Sorie Bangura",
    registrationFormNo: "2131",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Ibrahim Afiz Fofanah",
    registrationFormNo: "651",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Mohamed Fofanah",
    registrationFormNo: "1356",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Ibrahim G. Turay",
    registrationFormNo: "1605",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Hassanatu Bah",
    registrationFormNo: "1298",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Abubakarr Rahman Thoronka",
    registrationFormNo: "2122",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Al-Ameen Lawal",
    registrationFormNo: "2138",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Mohamed Samuel Alie Foyoh",
    registrationFormNo: "1396",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Abdulrahman M. Bangura",
    registrationFormNo: "",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Abubakarr Junior Swaray",
    registrationFormNo: "1361",
    gender: "",
    feesCategory: "Continue",
  },
  {
    name: "Kadija Abubakarr Barrie",
    registrationFormNo: "1273",
    gender: "",
    feesCategory: "Continue",
  },
]);
    const [commonData, setCommonData] = useState({
        class: "SSS 3 ARTS", 
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
        if (!window.confirm(`Register all ${students.length} students as NEW to ${commonData.class}?`)) return;
        
        setIsSubmitting(true);
        toast.info(`Uploading batch for ${commonData.class}...`);

        try {
            for (const student of students) {
                const newId = uuidv4().slice(0, 8);
                const studentData = {
                    studentID: newId,
                    studentName: student.name.toUpperCase().trim(),
                    registrationFormNo: student.registrationFormNo,
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
                                    <span className="text-[10px] text-green-600 uppercase font-black tracking-wider">★ {student.registrationFormNo}</span>
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