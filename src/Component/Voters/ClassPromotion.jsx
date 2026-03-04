import React, { useEffect, useState } from "react";
import { db } from "../../../firebase";
import { pupilLoginFetch } from "../Database/PupilLogin";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
} from "firebase/firestore";
import { toast } from "react-toastify";
import { useAuth } from "../Security/AuthContext";

const ClassPromotion = () => {
  const { user } = useAuth();
  const schoolId = user?.schoolId || "";

  // Academic years usually change annually, so we keep these as a preset
  const academicYears = ["2024/2025", "2025/2026", "2026/2027", "2027/2028"];

  const [classesInDb, setClassesInDb] = useState([]); 
  const [sourceClass, setSourceClass] = useState("");
  const [targetClass, setTargetClass] = useState("");
  const [newAcademicYear, setNewAcademicYear] = useState("2026/2027");
  
  const [pupils, setPupils] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);

  // 1. Fetch ALL unique class names currently existing in your DB
  useEffect(() => {
    const fetchClasses = async () => {
      if (!schoolId) return;
      try {
        const q = query(collection(db, "PupilsReg"), where("schoolId", "==", schoolId));
        const snapshot = await getDocs(q);
        const classSet = new Set();
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          // This captures "Class 1 A", "Class 2 B" exactly as they are typed in the DB
          if (data.class) classSet.add(data.class);
        });
        
        setClassesInDb([...classSet].sort());
      } catch (error) {
        toast.error("Failed to load classes from database");
      }
    };
    fetchClasses();
  }, [schoolId]);

  // 2. Fetch pupils when the Source Class is selected
  useEffect(() => {
    const fetchPupils = async () => {
      if (!sourceClass || !schoolId) {
        setPupils([]);
        setSelectedIds([]);
        return;
      }
      setIsLoading(true);
      try {
        const q = query(
          collection(db, "PupilsReg"),
          where("schoolId", "==", schoolId),
          where("class", "==", sourceClass)
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPupils(list);
        setSelectedIds(list.map(p => p.id)); // Default to selecting all
      } catch (error) {
        toast.error("Error loading pupils");
      } finally {
        setIsLoading(false);
      }
    };
    fetchPupils();
  }, [sourceClass, schoolId]);

  const toggleStudent = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handlePromotion = async () => {
    if (!targetClass) return toast.error("Please select a Target Class.");
    if (sourceClass === targetClass) return toast.warn("Source and Target classes are identical.");
    if (selectedIds.length === 0) return toast.error("No students selected.");

    const confirmPromote = window.confirm(`Move ${selectedIds.length} pupils to ${targetClass}?`);
    if (!confirmPromote) return;

    setIsPromoting(true);
    const toastId = toast.loading("Updating records...");

    try {
      const updatePromises = selectedIds.map(async (id) => {
        const updateData = {
          class: targetClass,
          academicYear: newAcademicYear,
          feesCategory: "Continue",
          promotionDate: new Date().toISOString()
        };

        // Update main DB and Login DB (Syncing)
        await updateDoc(doc(db, "PupilsReg", id), updateData);
        await updateDoc(doc(pupilLoginFetch, "PupilsReg", id), updateData);
      });

      await Promise.all(updatePromises);
      toast.update(toastId, { render: "Promotion Successful!", type: "success", isLoading: false, autoClose: 3000 });
      
      // Remove successfully promoted students from the current preview list
      setPupils(prev => prev.filter(p => !selectedIds.includes(p.id)));
      setSelectedIds([]);
    } catch (error) {
      toast.update(toastId, { render: "Error: " + error.message, type: "error", isLoading: false, autoClose: 3000 });
    } finally {
      setIsPromoting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-5xl mx-auto bg-white shadow-2xl rounded-3xl overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="p-8 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-black tracking-tight">CLASS PROMOTION</h2>
                <p className="text-slate-400 text-sm font-medium">Using existing database class architecture</p>
            </div>
            <div className="bg-emerald-500/20 px-4 py-2 rounded-2xl border border-emerald-500/30">
                <span className="text-emerald-400 font-bold">{selectedIds.length} Selected</span>
            </div>
        </div>

        <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Control Panel */}
            <div className="lg:col-span-4 space-y-6">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Class</label>
                    <select 
                        value={sourceClass} 
                        onChange={(e)=>setSourceClass(e.target.value)}
                        className="w-full mt-2 p-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                    >
                        <option value="">-- Choose Source --</option>
                        {classesInDb.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <div className="flex justify-center my-4">
                        <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 font-bold">↓</span>
                        </div>
                    </div>

                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Promote To</label>
                    <select 
                        value={targetClass} 
                        onChange={(e)=>setTargetClass(e.target.value)}
                        className="w-full mt-2 p-3 bg-indigo-50 border-2 border-indigo-200 rounded-xl font-bold text-indigo-700 outline-none focus:border-indigo-600 transition-all"
                    >
                        <option value="">-- Choose Target --</option>
                        {/* ✅ Uses the same list as the source class */}
                        {classesInDb.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Academic Year</label>
                    <select 
                        value={newAcademicYear} 
                        onChange={(e)=>setNewAcademicYear(e.target.value)}
                        className="w-full mt-2 p-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-indigo-500 transition-all"
                    >
                        {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                <button
                    onClick={handlePromotion}
                    disabled={isPromoting || selectedIds.length === 0 || !targetClass}
                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-black disabled:bg-slate-200 disabled:text-slate-400 transition-all transform active:scale-95"
                >
                    {isPromoting ? "Processing Updates..." : `Execute Promotion`}
                </button>
            </div>

            {/* Selection List */}
            <div className="lg:col-span-8 border border-slate-100 rounded-3xl bg-slate-50/50 overflow-hidden">
                <div className="px-6 py-4 bg-white border-b flex justify-between items-center">
                    <h3 className="text-xs font-black text-slate-400 uppercase">Class Roster: {sourceClass || 'Select Class'}</h3>
                    <div className="text-[10px] font-bold text-slate-400">{pupils.length} Total</div>
                </div>

                <div className="max-h-[500px] overflow-y-auto p-4 space-y-2">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                            <p className="font-bold text-sm">Searching Database...</p>
                        </div>
                    ) : pupils.length > 0 ? (
                        pupils.map(p => (
                            <div 
                                key={p.id} 
                                onClick={() => toggleStudent(p.id)}
                                className={`flex items-center p-4 rounded-2xl border-2 transition-all cursor-pointer group ${selectedIds.includes(p.id) ? 'bg-white border-indigo-500 shadow-sm' : 'bg-white/50 border-transparent hover:border-slate-200'}`}
                            >
                                <div className={`w-6 h-6 rounded-lg mr-4 flex items-center justify-center border-2 transition-all ${selectedIds.includes(p.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-transparent'}`}>
                                    <span className="text-[10px] font-black">✓</span>
                                </div>
                                <div className="flex-1">
                                    <div className={`text-sm font-bold ${selectedIds.includes(p.id) ? 'text-slate-900' : 'text-slate-500'}`}>{p.studentName}</div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{p.studentID} • {p.gender}</div>
                                </div>
                                {selectedIds.includes(p.id) && (
                                    <div className="animate-in fade-in slide-in-from-right-2">
                                        <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full uppercase">Move to {targetClass}</span>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-24">
                            <p className="text-slate-300 italic font-medium text-sm">Choose a source class to view the student list</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default ClassPromotion;