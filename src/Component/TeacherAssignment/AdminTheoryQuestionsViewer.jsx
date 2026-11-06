import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { db } from "../../../firebase";
import { schoollpq } from "../Database/schoollibAndPastquestion";

import { 
    collection, 
    onSnapshot,
    query, 
    where,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    getDoc
} from "firebase/firestore";
import { toast } from "react-toastify";

const AdminTheoryQuestionsViewer = () => {
    const location = useLocation();
    
    // Retrieve schoolId from router location state with LocalStorage/SessionStorage fallbacks
    const schoolId = location.state?.schoolId || localStorage.getItem("schoolId") || sessionStorage.getItem("schoolId") || "";

    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [filterClass, setFilterClass] = useState("ALL");
    const [filterSubject, setFilterSubject] = useState("ALL");
    const [filterTerm, setFilterTerm] = useState("ALL");
    const [filterTopic, setFilterTopic] = useState("ALL");
    const [searchTerm, setSearchTerm] = useState("");

    // Inline edit states (for Editing an individual question inside a document record)
    const [editingState, setEditingState] = useState(null); // { docId, questionIndex, questionText, topicText }
    const [saving, setSaving] = useState(false);

    const termsList = ["Term 1 T1", "Term 1 Exam", "Term 2 T1", "Term 2 Exam", "Term 3 T1", "Term 3 Exam"];

    // 1. Realtime listener for all Theory Question docs in the active school
    useEffect(() => {
        if (!schoolId) {
            console.warn("AdminTheoryQuestionsViewer: Missing schoolId in state or storage.");
            setLoading(false);
            return;
        }

        const targetDb = schoollpq || db;

        const q = query(
            collection(targetDb, "TheoryQuestionsBank"),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docsData = snapshot.docs.map((docItem) => ({
                id: docItem.id,
                ...docItem.data()
            }));

            // Client-side sort by newest upload timestamp
            docsData.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

            setDocuments(docsData);
            setLoading(false);
        }, (error) => {
            console.error("Firestore Listen Error:", error);
            toast.error("Failed to load theory questions.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [schoolId]);

    // 2. Flatten all individual questions into a single table-friendly array
    const flattenedQuestions = useMemo(() => {
        const list = [];
        documents.forEach((docItem) => {
            const questionsArr = docItem.questions || [];
            questionsArr.forEach((q, idx) => {
                list.push({
                    docId: docItem.id,
                    questionIndex: idx,
                    className: docItem.className,
                    subject: docItem.subject,
                    term: docItem.term,
                    academicYear: docItem.academicYear,
                    teacher: docItem.teacher || "N/A",
                    topic: q.topic || "General",
                    question: q.question || ""
                });
            });
        });
        return list;
    }, [documents]);

    // 3. Dynamic filter dropdown options
    const uniqueClasses = useMemo(() => {
        return Array.from(new Set(flattenedQuestions.map(q => q.className).filter(Boolean)));
    }, [flattenedQuestions]);

    const uniqueSubjects = useMemo(() => {
        const filtered = filterClass === "ALL" 
            ? flattenedQuestions 
            : flattenedQuestions.filter(q => q.className === filterClass);
        return Array.from(new Set(filtered.map(q => q.subject).filter(Boolean)));
    }, [flattenedQuestions, filterClass]);

    const uniqueTopics = useMemo(() => {
        const filtered = flattenedQuestions.filter(q => {
            const matchClass = filterClass === "ALL" || q.className === filterClass;
            const matchSubj = filterSubject === "ALL" || q.subject === filterSubject;
            return matchClass && matchSubj;
        });
        return Array.from(new Set(filtered.map(q => q.topic).filter(Boolean)));
    }, [flattenedQuestions, filterClass, filterSubject]);

    // 4. Multi-column filtering & Search
    const filteredQuestions = useMemo(() => {
        return flattenedQuestions.filter((item) => {
            const matchesClass = filterClass === "ALL" || item.className === filterClass;
            const matchesSubject = filterSubject === "ALL" || item.subject === filterSubject;
            const matchesTerm = filterTerm === "ALL" || item.term === filterTerm;
            const matchesTopic = filterTopic === "ALL" || item.topic === filterTopic;

            const matchesSearch = !searchTerm.trim() || 
                item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.teacher.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesClass && matchesSubject && matchesTerm && matchesTopic && matchesSearch;
        });
    }, [flattenedQuestions, filterClass, filterSubject, filterTerm, filterTopic, searchTerm]);

    // 5. Handle Start Editing
    const handleStartEdit = (item) => {
        setEditingState({
            docId: item.docId,
            questionIndex: item.questionIndex,
            questionText: item.question,
            topicText: item.topic
        });
    };

    // 6. Handle Save Edited Question
    const handleSaveEdit = async () => {
        if (!editingState || !editingState.questionText.trim()) {
            return toast.error("Question text cannot be empty.");
        }

        setSaving(true);
        try {
            const targetDb = schoollpq || db;
            const docRef = doc(targetDb, "TheoryQuestionsBank", editingState.docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const currentQuestions = docSnap.data().questions || [];
                if (currentQuestions[editingState.questionIndex]) {
                    currentQuestions[editingState.questionIndex] = {
                        ...currentQuestions[editingState.questionIndex],
                        question: editingState.questionText.trim(),
                        topic: editingState.topicText.trim()
                    };

                    await updateDoc(docRef, {
                        questions: currentQuestions,
                        updatedAt: serverTimestamp()
                    });

                    toast.success("Theory question updated!");
                }
            }
            setEditingState(null);
        } catch (error) {
            console.error("Save Error:", error);
            toast.error("Failed to update question.");
        } finally {
            setSaving(false);
        }
    };

    // 7. Handle Delete Question
    const handleDeleteQuestion = async (item) => {
        if (!window.confirm("Are you sure you want to delete this question?")) return;

        try {
            const targetDb = schoollpq || db;
            const docRef = doc(targetDb, "TheoryQuestionsBank", item.docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const currentQuestions = docSnap.data().questions || [];
                const updatedQuestions = currentQuestions.filter((_, idx) => idx !== item.questionIndex);

                if (updatedQuestions.length === 0) {
                    // If no questions remain in the document, remove the whole document record
                    await deleteDoc(docRef);
                } else {
                    // Otherwise update the array
                    await updateDoc(docRef, {
                        questions: updatedQuestions,
                        updatedAt: serverTimestamp()
                    });
                }
                toast.success("Question deleted successfully.");
            }
        } catch (error) {
            console.error("Delete Error:", error);
            toast.error("Failed to delete question.");
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-2xl shadow-lg text-gray-800">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 pb-4 border-b">
                <div>
                    <h1 className="text-2xl font-black text-red-700 uppercase tracking-tight">
                        Theory Questions Repository
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Viewing all theory questions for School ID: <span className="font-bold text-gray-800">{schoolId || "MISSING_SCHOOL_ID"}</span>
                    </p>
                </div>
                <div className="mt-3 md:mt-0 bg-red-50 px-4 py-2 rounded-xl text-xs font-bold text-red-700 border border-red-200">
                    Total Questions: {flattenedQuestions.length}
                </div>
            </div>

            {/* Warning Alert if School ID missing */}
            {!schoolId && (
                <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-600 text-red-700 text-xs rounded-r-xl">
                    <strong>Warning:</strong> No <code>schoolId</code> found in state or storage. Ensure <code>schoolId</code> is present.
                </div>
            )}

            {/* Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6 p-4 border rounded-2xl bg-red-50/50">
                {/* Search */}
                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Search Question / Teacher</label>
                    <input
                        type="text"
                        placeholder="Search text or teacher..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full border rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                </div>

                {/* Filter Class */}
                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Filter Class</label>
                    <select
                        value={filterClass}
                        onChange={(e) => { setFilterClass(e.target.value); setFilterSubject("ALL"); setFilterTopic("ALL"); }}
                        className="w-full border rounded-xl px-3 py-2 text-xs font-bold bg-white"
                    >
                        <option value="ALL">All Classes ({uniqueClasses.length})</option>
                        {uniqueClasses.map((cls, i) => (
                            <option key={i} value={cls}>{cls}</option>
                        ))}
                    </select>
                </div>

                {/* Filter Subject */}
                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Filter Subject</label>
                    <select
                        value={filterSubject}
                        onChange={(e) => { setFilterSubject(e.target.value); setFilterTopic("ALL"); }}
                        className="w-full border rounded-xl px-3 py-2 text-xs font-bold bg-white"
                    >
                        <option value="ALL">All Subjects</option>
                        {uniqueSubjects.map((sbj, i) => (
                            <option key={i} value={sbj}>{sbj}</option>
                        ))}
                    </select>
                </div>

                {/* Filter Topic */}
                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Filter Topic</label>
                    <select
                        value={filterTopic}
                        onChange={(e) => setFilterTopic(e.target.value)}
                        className="w-full border rounded-xl px-3 py-2 text-xs font-bold bg-white"
                    >
                        <option value="ALL">All Topics</option>
                        {uniqueTopics.map((top, i) => (
                            <option key={i} value={top}>{top}</option>
                        ))}
                    </select>
                </div>

                {/* Filter Term */}
                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Filter Term / Exam</label>
                    <select
                        value={filterTerm}
                        onChange={(e) => setFilterTerm(e.target.value)}
                        className="w-full border rounded-xl px-3 py-2 text-xs font-bold bg-white"
                    >
                        <option value="ALL">All Terms & Tests</option>
                        {termsList.map((t, i) => (
                            <option key={i} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Questions Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-sm">
                <table className="w-full text-left text-xs min-w-[750px]">
                    <thead className="bg-red-700 text-white uppercase text-[10px] tracking-wider">
                        <tr>
                            <th className="p-4 w-12">#</th>
                            <th className="p-4 w-32">Topic</th>
                            <th className="p-4">Question</th>
                            <th className="p-4 w-28">Class / Subj</th>
                            <th className="p-4 w-28">Term</th>
                            <th className="p-4 w-28">Teacher</th>
                            <th className="p-4 text-center w-28">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan="7" className="p-10 text-center text-red-600 font-bold">
                                    Loading theory questions...
                                </td>
                            </tr>
                        ) : filteredQuestions.map((item, i) => {
                            const isEditing = editingState?.docId === item.docId && editingState?.questionIndex === item.questionIndex;

                            return (
                                <tr key={`${item.docId}_${item.questionIndex}`} className="hover:bg-red-50/30 transition-colors">
                                    <td className="p-4 font-bold text-gray-400">{i + 1}</td>

                                    {/* Topic Column */}
                                    <td className="p-4">
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editingState.topicText}
                                                onChange={(e) => setEditingState({ ...editingState, topicText: e.target.value })}
                                                className="border rounded px-2 py-1 text-xs w-full bg-white font-normal"
                                            />
                                        ) : (
                                            <span className="bg-red-50 border border-red-200 px-2 py-1 rounded-md text-[10px] font-black uppercase text-red-700">
                                                {item.topic}
                                            </span>
                                        )}
                                    </td>

                                    {/* Question Text Column */}
                                    <td className="p-4 font-medium text-gray-800">
                                        {isEditing ? (
                                            <textarea
                                                rows="3"
                                                value={editingState.questionText}
                                                onChange={(e) => setEditingState({ ...editingState, questionText: e.target.value })}
                                                className="border rounded px-2 py-1 text-xs w-full bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                                            />
                                        ) : (
                                            <span className="whitespace-pre-wrap">{item.question}</span>
                                        )}
                                    </td>

                                    {/* Class & Subject Column */}
                                    <td className="p-4">
                                        <div className="font-bold text-gray-800">{item.className}</div>
                                        <div className="text-[10px] text-gray-500">{item.subject}</div>
                                    </td>

                                    {/* Term Column */}
                                    <td className="p-4 text-gray-600 font-medium">{item.term}</td>

                                    {/* Teacher Column */}
                                    <td className="p-4 text-gray-600 font-medium">{item.teacher}</td>

                                    {/* Actions Column */}
                                    <td className="p-4">
                                        <div className="flex justify-center items-center gap-2">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        onClick={handleSaveEdit}
                                                        disabled={saving}
                                                        className="text-green-600 font-bold uppercase text-[10px] hover:underline"
                                                    >
                                                        {saving ? "Saving" : "Save"}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingState(null)}
                                                        className="text-gray-500 font-bold uppercase text-[10px] hover:underline"
                                                    >
                                                        Cancel
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleStartEdit(item)}
                                                        className="text-orange-500 font-bold uppercase text-[10px] hover:underline"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteQuestion(item)}
                                                        className="text-red-500 font-bold uppercase text-[10px] hover:underline"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}

                        {!loading && filteredQuestions.length === 0 && (
                            <tr>
                                <td colSpan="7" className="p-10 text-center text-gray-400 font-medium italic">
                                    No theory questions found matching the selected criteria.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminTheoryQuestionsViewer;