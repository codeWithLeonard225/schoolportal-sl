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
    name: "Aminata Sallay Kamara",
    registrationFormNo: "2433",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Khadija Turay",
    registrationFormNo: "2439",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Amisha Bakarr Conteh",
    registrationFormNo: "2534",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Festina Isatu Kanu",
    registrationFormNo: "2545",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Ibrahim Kargbo",
    registrationFormNo: "2583",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Mohamed Muctarr Koroma",
    registrationFormNo: "2582",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Fanta Marrah",
    registrationFormNo: "2618",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Yayah Abubakarr Bassie",
    registrationFormNo: "1014",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Mohamed Saeed Bah",
    registrationFormNo: "1136",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Mohamed Anis Abraham",
    registrationFormNo: "906",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Tallu Bassoum Lee",
    registrationFormNo: "1897",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Abubakarr Maruff Jalloh",
    registrationFormNo: "2084",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Mustapha Ramadan Kortu",
    registrationFormNo: "111",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Amidu Kamara",
    registrationFormNo: "110",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Sheikh Fomba Sulaiman Konneh",
    registrationFormNo: "676",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Umunatu K. Jalloh",
    registrationFormNo: "2153",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Kadiatu Ibrahim Conteh",
    registrationFormNo: "1520",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Isha Giba Barrie",
    registrationFormNo: "2276",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Mohamed Billoh Koroma",
    registrationFormNo: "1065",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Abdul.G.M Sesay",
    registrationFormNo: "1587",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Sallieu Sahid Kamara",
    registrationFormNo: "1781",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Alimamy .S. Tholley",
    registrationFormNo: "1556",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Alhaji Amadu Bah",
    registrationFormNo: "1074",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Ibrahim Sorie.B. Marrah",
    registrationFormNo: "1454",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Mustapha Alhaji Feika",
    registrationFormNo: "981",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Ahmad Ibrahim Vandi",
    registrationFormNo: "914",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Alpha Musa Korjie",
    registrationFormNo: "1063",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Nabie Noah Dau Zan Samura",
    registrationFormNo: "1334",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Ramadan Idrissa Foyoh",
    registrationFormNo: "2152",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Mohamed Kamara",
    registrationFormNo: "1046",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Ibrahim Jakitay",
    registrationFormNo: "1901",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Madieu Chernor Turay",
    registrationFormNo: "1903",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Mustapha Dauda Gassama",
    registrationFormNo: "1291",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Abdulai Ramadan Sesay",
    registrationFormNo: "1077",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Mohamed Lamin Sillah",
    registrationFormNo: "1374",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Alieu Kamara",
    registrationFormNo: "1668",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Saio Sidibay",
    registrationFormNo: "Male", // Note: Saio can be unisex in Sierra Leone, typically male
    feesCategory: "Continue",
  },
  {
    name: "Abubakarr S. Sesay",
    registrationFormNo: "1782",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Sulaiman Kargbo",
    registrationFormNo: "2281",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Mohamed Adams Maddie",
    registrationFormNo: "1423",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Fatmata Yusuf Kamara",
    registrationFormNo: "1333",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Joyce Gibson Bangura",
    registrationFormNo: "2279",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Ridwan Khalil Kamara",
    registrationFormNo: "2355",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Ramatu Isatu Sesay",
    registrationFormNo: "1269",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Saio Sannoh",
    registrationFormNo: "1904",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Hafsatu Charley",
    registrationFormNo: "1241",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Isha Marrah",
    registrationFormNo: "2090",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Isatu Barrie",
    registrationFormNo: "2277",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Binta Jalloh",
    registrationFormNo: "2280",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Fatmata Yarie Suma",
    registrationFormNo: "1026",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Mariatu Ibrahim Kamara",
    registrationFormNo: "1286",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Fanta Saio Kamara",
    registrationFormNo: "2270",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Sarah M Samura",
    registrationFormNo: "1018",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Swadu Sillah",
    registrationFormNo: "1351",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Fatmata Barrie",
    registrationFormNo: "2278",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Haja Narray Sidibay",
    registrationFormNo: "1246",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Haja Bintu Mansaray",
    registrationFormNo: "1367",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Fulamatu Bashiru Jabbie",
    registrationFormNo: "1665",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Mariama Alieu Lolleh",
    registrationFormNo: "1412",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Blessing Isatu Sesay",
    registrationFormNo: "2155",
    gender: "Female",
    feesCategory: "Continue",
  },
  {
    name: "Ousmane Boie Jalloh",
    registrationFormNo: "1467",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Sheikh Abdul Afiz Mansaray",
    registrationFormNo: "1245",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Ibrahim Kuda Conteh",
    registrationFormNo: "894",
    gender: "Male",
    feesCategory: "Continue",
  },
  {
    name: "Mohamed .S. Jalloh",
    registrationFormNo: "1524",
    gender: "Male",
    feesCategory: "Continue",
  },
]);
    const [commonData, setCommonData] = useState({
        class: "CLASS 6", 
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