import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../../firebase"; 
import { collection, addDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-toastify";
import { useAuth } from "../Security/AuthContext";

const BulkTeacherRegistration = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const schoolId = user?.schoolId || "N/A";
    const registeredBy = user?.data?.adminID || user?.data?.teacherID || "Admin";

    const [searchTerm, setSearchTerm] = useState("");
    
    // ✅ Updated with your newest list of 23 teachers
    const [teachersList, setTeachersList] = useState([
        { name: "D. Sankoh", gender: "Male" },
        { name: "El-Kudi", gender: "Female" },
    ]);

    const [commonData, setCommonData] = useState({
        registrationDate: new Date().toISOString().slice(0, 10),
        address: "School Campus", 
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const toggleGender = (index) => {
        const updated = [...teachersList];
        updated[index].gender = updated[index].gender === "Male" ? "Female" : "Male";
        setTeachersList(updated);
    };

    const handleBulkSubmit = async () => {
        if (schoolId === "N/A") return toast.error("User Auth Error: School ID not detected.");
        if (!window.confirm(`Register all ${teachersList.length} staff members?`)) return;
        
        setIsSubmitting(true);
        const loadToast = toast.loading("Processing Bulk Registration...");

        try {
            for (const t of teachersList) {
                const teacherData = {
                    teacherID: uuidv4().slice(0, 8),
                    teacherName: t.name.toUpperCase().trim(),
                    gender: t.gender,
                    phone: "",
                    email: "",
                    address: commonData.address,
                    registrationDate: commonData.registrationDate,
                    registeredBy: registeredBy,
                    schoolId: schoolId,
                    userPhotoUrl: null,
                    userPublicId: null,
                    timestamp: new Date(),
                };

                await addDoc(collection(db, "Teachers"), teacherData);
            }
            
            toast.update(loadToast, { render: `✅ Success! ${teachersList.length} teachers added.`, type: "success", isLoading: false, autoClose: 3000 });
            navigate(-1);
        } catch (error) {
            console.error(error);
            toast.update(loadToast, { render: "Error during upload.", type: "error", isLoading: false, autoClose: 3000 });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter list based on search term
    const filteredList = teachersList.filter(t => 
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 p-4">
            <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
                <div className="bg-slate-900 p-8 text-white">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-black tracking-tight">Staff Onboarding</h2>
                            <p className="text-slate-400 text-sm mt-1">Bulk upload for {schoolId}</p>
                        </div>
                        <button onClick={() => navigate(-1)} className="text-xs uppercase font-bold tracking-widest opacity-50 hover:opacity-100">Close</button>
                    </div>
                </div>

                <div className="p-8">
                    {/* Controls */}
                    <div className="space-y-4 mb-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">Date</label>
                                <input type="date" value={commonData.registrationDate} onChange={(e) => setCommonData({...commonData, registrationDate: e.target.value})} className="border-slate-200 border p-3 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 outline-none" />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">Search List</label>
                                <input type="text" placeholder="Find name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border-slate-200 border p-3 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 outline-none" />
                            </div>
                        </div>
                    </div>

                    {/* Teacher List */}
                    <div className="max-h-[400px] overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/50 p-2">
                        {filteredList.map((t, index) => {
                            // Find actual index in original list to keep toggle working
                            const originalIndex = teachersList.findIndex(item => item.name === t.name);
                            return (
                                <div key={index} className="flex justify-between items-center p-4 bg-white rounded-xl mb-2 shadow-sm border border-slate-100">
                                    <div className="flex items-center gap-4">
                                        <span className="text-slate-300 font-mono text-xs">{originalIndex + 1}</span>
                                        <span className="text-sm font-bold text-slate-700">{t.name}</span>
                                    </div>
                                    <button 
                                        onClick={() => toggleGender(originalIndex)}
                                        className={`text-[10px] px-5 py-1.5 rounded-full font-black transition-all ${
                                            t.gender === "Male" ? "bg-cyan-100 text-cyan-700" : "bg-rose-100 text-rose-700"
                                        }`}
                                    >
                                        {t.gender}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <button 
                        onClick={handleBulkSubmit}
                        disabled={isSubmitting}
                        className="w-full mt-8 bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 disabled:bg-slate-300 transition-all active:scale-[0.98] shadow-xl"
                    >
                        {isSubmitting ? "Syncing with Cloud..." : `Finalize ${teachersList.length} Registrations`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkTeacherRegistration;