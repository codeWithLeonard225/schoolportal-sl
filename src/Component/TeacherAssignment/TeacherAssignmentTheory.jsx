import React, { useState, useEffect } from "react";
import { db } from "../../../firebase";
import { schoollpq } from "../Database/schoollibAndPastquestion";
import { 
    collection, 
    setDoc, 
    doc, 
    serverTimestamp, 
    onSnapshot,
    query, 
    where,
    getDoc,
    updateDoc
} from "firebase/firestore";
import { useAuth } from "../Security/AuthContext";
import { useLocation } from "react-router-dom";
import localforage from "localforage";
import { toast } from "react-toastify";

// 💾 Initialize localforage stores (using the same instances for consistency)
const assignmentStore = localforage.createInstance({ 
    name: "TeacherAssigDataCache",
    storeName: "teacher_assig_theory",
});

const topicStore = localforage.createInstance({ 
    name: "TopicDataCache",
    storeName: "topics_list",
});

// We are defining the question structure without 'options' field
const initialTheoryQuestion = { number: 1, question: "", topic: "", answer: "" }; // 'answer' field holds the correct theory/structured answer

const TeacherAssignmentTheory = () => {
    const { user } = useAuth();
    const location = useLocation();
    const schoolId = location.state?.schoolId || "N/A";

    // State Variables
    const [academicYear] = useState("2025/2026");
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [selectedTopic, setSelectedTopic] = useState(""); 
    const [newTopicName, setNewTopicName] = useState("");  
    const [topics, setTopics] = useState([]); 

    const [selectedTest, setSelectedTest] = useState("Term 1 T1");
    // This state will hold the teacher's *assigned* classes and subjects.
    const [teacherAssignments, setTeacherAssignments] = useState([]); 

    // State for the single question being edited or created
    const [currentQuestion, setCurrentQuestion] = useState(initialTheoryQuestion); 

    const [fetchedQuestions, setFetchedQuestions] = useState([]);
    const [existingDocId, setExistingDocId] = useState(null);

    const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    
    const teacherName = user?.data?.teacherName;
    const tests = ["Term 1 T1", "Term 1 Exam", "Term 2 T1", "Term 2 Exam", "Term 3 T1", "Term 3 Exam"];
    const questionType = "Theory"; // New variable to distinguish the question type in Firestore

    /* --- EFFECT HOOKS --- */

    // 1. 📋 LOAD TEACHER ASSIGNMENTS (Cache-First) - **Updated Collection Name**
    // Query a general 'TeacherAssignments' collection to get the teacher's teaching load.
    useEffect(() => {
        if (!teacherName || !schoolId) return;
        // NOTE: Changed cache key to reflect general assignments, not Theory collection data
        const ASSIGNMENTS_CACHE_KEY = `teacher_assignments_${schoolId}_${teacherName}`;

        const loadAndListenAssignments = async () => {
            // Load from cache 
            try {
                const cachedData = await assignmentStore.getItem(ASSIGNMENTS_CACHE_KEY);
                if (cachedData && cachedData.data) {
                    setTeacherAssignments(cachedData.data);
                    if (cachedData.data.length > 0 && !selectedClass) {
                        setSelectedClass(cachedData.data[0].className);
                        setSelectedSubject(cachedData.data[0].subjects[0]);
                    }
                }
            } catch (e) {
                console.error("Failed to retrieve cached assignments:", e);
            }

            // Set up Firestore Listener to a more appropriate collection for teacher assignments
            // ASSUMPTION: Teacher's class/subject assignments are stored in "TeacherAssignments"
            const q = query(
                collection(db, "TeacherAssignments"),
                where("teacher", "==", teacherName),
                where("schoolId", "==", schoolId)
            );

            const unsub = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
                setTeacherAssignments(data);
                if (data.length > 0 && !selectedClass) {
                    setSelectedClass(data[0].className);
                    setSelectedSubject(data[0].subjects[0]);
                }
                // Save fresh data to localforage
                assignmentStore.setItem(ASSIGNMENTS_CACHE_KEY, { timestamp: Date.now(), data: data })
                    .catch(e => console.error("Failed to save assignments to IndexDB:", e));

            }, (error) => {
                console.error("Firestore 'TeacherAssignments' onSnapshot failed:", error);
                toast.error("Failed to stream teacher assignments.");
            });

            return () => unsub();
        };

        loadAndListenAssignments();
    }, [teacherName, schoolId, selectedClass]);


    // 2. 📚 LOAD TOPICS BASED ON CLASS + SUBJECT (Cache-First) - (No change needed)
    useEffect(() => {
        if (!selectedClass || !selectedSubject || !schoolId) {
            setTopics([]);
            setSelectedTopic(""); 
            return;
        }

        const topicId = `${schoolId}_${selectedClass}_${selectedSubject}`;
        const TOPIC_CACHE_KEY = `topics_${topicId}`;
        const topicRef = doc(schoollpq, "Topics", topicId);

        const loadAndListenTopics = async () => {
            // Load from cache
            try {
                const cachedData = await topicStore.getItem(TOPIC_CACHE_KEY);
                if (cachedData && cachedData.data) {
                    setTopics(cachedData.data.topics || []);
                }
            } catch (e) {
                console.error("Failed to retrieve cached topics:", e);
            }

            // Set up Firestore Listener
            const unsub = onSnapshot(topicRef, (snapshot) => {
                const currentTopics = snapshot.exists() ? snapshot.data().topics || [] : [];
                setTopics(currentTopics);

                // Save fresh data to localforage
                if (snapshot.exists()) {
                    topicStore.setItem(TOPIC_CACHE_KEY, { timestamp: Date.now(), data: { topics: currentTopics } })
                        .catch(e => console.error("Failed to save topics to IndexDB:", e));
                }
            }, (error) => {
                console.error("Firestore 'Topics' onSnapshot failed:", error);
                toast.error("Failed to stream topic data.");
            });

            return () => unsub();
        };

        loadAndListenTopics();
    }, [selectedClass, selectedSubject, schoolId]);


    // 3. 📝 LOAD QUESTIONS (FILTERED BY questionType: 'Theory') - (No change needed)
    useEffect(() => {
        if (!selectedClass || !selectedSubject || !selectedTest || !schoolId) {
            setFetchedQuestions([]);
            setExistingDocId(null);
            return;
        }
        
        // Query the main document based on Class/Subject/Term/Year AND questionType
        const q = query(
            collection(schoollpq, "AssignQuestionsBank"),
            where("schoolId", "==", schoolId),
            where("className", "==", selectedClass),
            where("subject", "==", selectedSubject),
            where("term", "==", selectedTest),
            where("academicYear", "==", academicYear),
            where("type", "==", questionType) // <--- CRITICAL FILTER FOR THEORY
        );

        const unsub = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const docSnapshot = snapshot.docs[0];
                const docData = docSnapshot.data();
                setExistingDocId(docSnapshot.id);

                // Load all questions from the array
                const loadedQuestions = docData.questions.map((q, index) => ({
                    ...q,
                    tempId: index, 
                    number: index + 1,
                }));

                // Apply client-side filtering based on selectedTopic
                const filteredQuestions = selectedTopic 
                    ? loadedQuestions.filter(q => q.topic === selectedTopic) 
                    : loadedQuestions;
                
                setFetchedQuestions(filteredQuestions);

            } else {
                setFetchedQuestions([]);
                setExistingDocId(null);
            }
        });

        return () => unsub();
    }, [selectedClass, selectedSubject, selectedTest, schoolId, academicYear, selectedTopic]); 


    /* --- HELPER FUNCTIONS --- */

    // ADD NEW TOPIC (No change needed)
    const handleAddTopic = async () => {
        const newTopic = newTopicName.trim();
        if (newTopic === "") {
            toast.error("Enter a topic name.");
            return;
        }
        // Case-insensitive check for duplicates
        if (topics.map(t => t.toLowerCase()).includes(newTopic.toLowerCase())) {
             toast.info(`Topic "${newTopic}" already exists.`);
             setNewTopicName("");
             return;
        }

        const topicId = `${schoolId}_${selectedClass}_${selectedSubject}`;
        const topicRef = doc(schoollpq, "Topics", topicId);
        
        const newTopicsList = [...topics, newTopic].sort((a, b) => a.localeCompare(b));

        try {
            await setDoc(topicRef, {
                schoolId,
                className: selectedClass,
                subject: selectedSubject,
                topics: newTopicsList,
                timestamp: serverTimestamp(),
            }, { merge: true });

            setNewTopicName("");
            setSelectedTopic(newTopic); 

            toast.success(`Topic "${newTopic}" added successfully!`);
        } catch (err) {
            console.error(err);
            toast.error("Error saving topic.");
        }
    };


    // RESET FORM (Updated to use single object state)
    const resetForm = () => {
        setCurrentQuestion(initialTheoryQuestion);
        setEditingQuestionIndex(null);
    };


    // UPDATE FORM (Updated to use single object state)
    const updateQuestion = (field, value) => {
        setCurrentQuestion(prev => ({
            ...prev,
            [field]: value
        }));
    };


    // EDIT (Updated to use single object state)
    const handleEditQuestion = (questionToEdit, index) => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        // Use the questionToEdit object directly
        setCurrentQuestion(questionToEdit);
        setSelectedTopic(questionToEdit.topic);
        setEditingQuestionIndex(index);
    };


    // DELETE (No change needed)
    const handleDeleteQuestion = async (questionToDelete, index) => {
        if (!existingDocId) return;

        if (!window.confirm("Are you sure you want to permanently delete this question?")) return;

        try {
            const docRef = doc(schoollpq, "AssignQuestionsBank", existingDocId);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                toast.error("Question bank document not found. Cannot delete.");
                return;
            }

            const allQuestions = docSnap.data().questions || [];

            // Identify the question to delete based on its content (question text and topic)
            const indexToDelete = allQuestions.findIndex(q => 
                q.question === questionToDelete.question && 
                q.topic === questionToDelete.topic &&
                q.answer === questionToDelete.answer
            );

            if (indexToDelete === -1) {
                toast.error("Question not found in the master list. Cannot delete.");
                return;
            }

            // Remove the question at the identified index
            const updatedAllQuestions = allQuestions.filter((_, idx) => idx !== indexToDelete);

            await updateDoc(docRef, {
                questions: updatedAllQuestions,
                timestamp: serverTimestamp(),
            });

            if (editingQuestionIndex === index) resetForm();

            toast.success("Question Deleted!");
        } catch (error) {
            console.error("Deletion Error:", error);
            toast.error("Error deleting question.");
        }
    };


    // SUBMIT 
    const handleSubmitQuestions = async () => {
        const q = currentQuestion;

        if (!selectedTopic) {
            toast.error("Please select a topic for the question.");
            return;
        }
        if (!q.question.trim()) {
            toast.error("Please enter a question.");
            return;
        }
        if (!q.answer.trim()) {
            toast.error("Please enter the correct answer/solution.");
            return;
        }

        setSubmitting(true);

        try {
            // 1. Assign topic to the question object being saved
            const questionToSave = {
                question: q.question,
                topic: selectedTopic,
                answer: q.answer,
            };

            // 2. Fetch the current complete list of questions from Firestore
            let allQuestions = [];
            if (existingDocId) {
                const docRef = doc(schoollpq, "AssignQuestionsBank", existingDocId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    allQuestions = docSnap.data().questions || [];
                }
            }

            let finalList = [...allQuestions];

            if (editingQuestionIndex !== null) {
                // Find the old question in the full list and replace it
                const questionToFind = fetchedQuestions[editingQuestionIndex]; 
                
                const indexInAllQuestions = allQuestions.findIndex(item => 
                    item.question === questionToFind.question && 
                    item.topic === questionToFind.topic &&
                    item.answer === questionToFind.answer
                );
                
                if (indexInAllQuestions !== -1) {
                    finalList[indexInAllQuestions] = questionToSave;
                } else {
                    // Fallback to adding new if update failed
                    finalList.push(questionToSave);
                }

            } else {
                // NEW: Append to the full question list
                finalList.push(questionToSave);
            }


            // 3. Determine the document reference (existing or new)
            const docRef = existingDocId
                ? doc(schoollpq, "AssignQuestionsBank", existingDocId)
                : doc(collection(schoollpq, "AssignQuestionsBank"));

            // 4. Save the updated list and metadata to Firestore
            await setDoc(docRef, {
                schoolId,
                className: selectedClass,
                subject: selectedSubject,
                term: selectedTest,
                academicYear,
                teacher: teacherName,
                type: questionType, // <--- CRITICAL FIELD FOR THEORY
                questions: finalList, 
                timestamp: serverTimestamp(),
            }, { merge: true });

            resetForm();
            toast.success(`Question ${editingQuestionIndex !== null ? 'Updated' : 'Submitted'} Successfully!`);
        } catch (error) {
            console.error("Submission Error:", error);
            toast.error("Error saving question.");
        } finally {
            setSubmitting(false);
        }
    };


    /* --- UI BELOW (Modified for Theory) --- */

    return (
        <div className="max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-lg">

            <h2 className="text-2xl font-bold mb-6 text-center text-red-700">
                Submit **Theory/Structured** Questions ({academicYear})
            </h2>

            <hr />
            
            {/* -------------------- 1. CLASS/SUBJECT/TERM SELECTION -------------------- */}
            <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-lg bg-gray-100">
                
                {/* Class Selection JSX */}
                <div>
                    <label className="font-medium text-gray-700 block">Class:</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => {
                            setSelectedClass(e.target.value); 
                            setSelectedTopic("");
                            setSelectedSubject(""); // Reset subject when class changes
                        }}
                        className="border px-3 py-2 rounded-md w-40"
                    >
                        <option value="">Select Class</option>
                        {teacherAssignments.map((a) => ( // Use teacherAssignments
                            <option key={a.id} value={a.className}>
                                {a.className}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Subject Selection JSX */}
                <div>
                    <label className="font-medium text-gray-700 block">Subject:</label>
                    <select
                        value={selectedSubject}
                        onChange={(e) => {
                            setSelectedSubject(e.target.value); 
                            setSelectedTopic("");
                        }}
                        className="border px-3 py-2 rounded-md w-40"
                        disabled={!selectedClass}
                    >
                        <option value="">Select Subject</option>
                        {teacherAssignments
                            .find((a) => a.className === selectedClass) // Use teacherAssignments
                            ?.subjects.map((subject, i) => (
                                <option key={i} value={subject}>
                                    {subject}
                                </option>
                            ))}
                    </select>
                </div>

                {/* Term Selection JSX */}
                <div>
                    <label className="font-medium text-gray-700 block">Term/Test:</label>
                    <select
                        value={selectedTest}
                        onChange={(e) => setSelectedTest(e.target.value)}
                        className="border px-3 py-2 rounded-md w-40"
                    >
                        {tests.map((t, i) => (
                            <option key={i} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            
            <hr className="my-6" />
            
            {/* -------------------- 2. TOPIC MANAGER -------------------- */}
            <div className="p-4 bg-blue-50 border rounded-lg my-6">
                <h3 className="font-semibold text-lg mb-2 text-blue-700">📚 Manage Topics for **{selectedClass} - {selectedSubject}**</h3>

                <div className="flex gap-3 mb-3 items-end">
                    <input
                        className="border p-2 rounded flex-grow"
                        placeholder="Enter new topic"
                        value={newTopicName}
                        onChange={(e) => setNewTopicName(e.target.value)}
                        disabled={!selectedSubject}
                    />
                    <button
                        onClick={handleAddTopic}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
                        disabled={!selectedSubject || newTopicName.trim() === ""}
                    >
                        Add Topic
                    </button>
                </div>

                {topics.length > 0 ? (
                    <>
                        <p className="font-medium text-gray-700 mb-1">Available Topics:</p>
                        <div className="flex flex-wrap gap-2 border p-2 bg-white rounded-md">
                            {topics.map((t, i) => (
                                <span key={i} className="px-3 py-1 bg-blue-200 text-blue-800 rounded-full text-sm">
                                    {t}
                                </span>
                            ))}
                        </div>
                    </>
                ) : (
                    selectedSubject && <p className="text-sm text-gray-500">No topics added for this Subject yet. Add one above.</p>
                )}
            </div>

            <hr className="my-6" />

            {/* -------------------- 3. TOPIC SELECTION DROPDOWN -------------------- */}
            <div className="mb-4 p-4 border rounded-lg bg-yellow-50">
                <label className="font-bold text-gray-800">Select Topic for the Question:</label>
                <select
                    className="border p-2 ml-4 rounded w-64 font-medium"
                    value={selectedTopic}
                    onChange={(e) => setSelectedTopic(e.target.value)}
                    disabled={topics.length === 0}
                >
                    <option value="">-- Choose Topic --</option>
                    {topics.map((t, i) => (
                        <option key={i} value={t}>{t}</option>
                    ))}
                </select>
                {selectedSubject && topics.length > 0 && !selectedTopic && (
                    <p className="text-red-500 text-sm mt-2">⚠️ **Please select a Topic** to ensure the question is correctly categorized before submitting.</p>
                )}
            </div>

            <hr className="my-6" />

            {/* -------------------- 4. QUESTION ENTRY FORM (Simplified) -------------------- */}
            <h3 className="text-xl font-semibold mb-4">
                {editingQuestionIndex !== null ? `✏️ Edit Question #${editingQuestionIndex + 1}` : `📝 Enter New Theory Question`}
            </h3>

            {/* Question Text Area */}
            <label className="font-medium text-gray-700 block mt-4">Question:</label>
            <textarea
                className="w-full border rounded p-2 mb-3"
                rows="3"
                value={currentQuestion.question} // Use currentQuestion
                placeholder="Enter question text (e.g., 'What is photosynthesis?')"
                onChange={(e) => updateQuestion("question", e.target.value)}
            />

            {/* Answer/Solution Text Area (Replaces Options) */}
            <label className="font-medium text-gray-700 block mt-4">Correct Answer / Model Solution:</label>
            <textarea
                className="w-full border rounded p-2 mb-3 bg-green-50"
                rows="5"
                value={currentQuestion.answer} // Use currentQuestion
                placeholder="Enter the comprehensive correct answer or model solution for marking."
                onChange={(e) => updateQuestion("answer", e.target.value)}
            />

            <div className="mt-4 flex justify-between items-center border-t pt-3">
                {editingQuestionIndex !== null && (
                    <button
                        onClick={resetForm}
                        className="bg-gray-400 text-white px-3 py-1 rounded-md hover:bg-gray-500 text-sm"
                    >
                        Cancel Edit
                    </button>
                )}
            </div>

            <button
                onClick={handleSubmitQuestions}
                disabled={submitting || !selectedTopic || !currentQuestion.question.trim() || !currentQuestion.answer.trim()} // Use currentQuestion
                className={`mt-4 px-4 py-2 rounded font-semibold ${
                    (submitting || !selectedTopic || !currentQuestion.question.trim() || !currentQuestion.answer.trim()) 
                        ? "bg-gray-400 cursor-not-allowed" 
                        : editingQuestionIndex !== null 
                            ? "bg-orange-600 text-white hover:bg-orange-700"
                            : "bg-green-600 text-white hover:bg-green-700"
                }`}
            >
                {submitting 
                    ? "Saving..." 
                    : editingQuestionIndex !== null 
                        ? "Update Question" 
                        : "Submit Theory Question"
                }
            </button>

            <hr className="my-6" />

            {/* -------------------- 5. QUESTIONS TABLE -------------------- */}
            <h3 className="text-xl font-bold mb-4">Theory Questions Bank: {selectedTopic ? `(Topic: ${selectedTopic})` : '(All Topics)'}</h3>

            {fetchedQuestions.length === 0 ? (
                <p className="p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
                    No **Theory** questions found for the current filter criteria: **{selectedClass} - {selectedSubject} - {selectedTest}**
                </p>
            ) : (
                <div className="overflow-x-auto border rounded-lg shadow-md">
                    <table className="min-w-full border text-sm">
                        <thead className="bg-red-500 text-white">
                            <tr>
                                <th className="p-2 w-10">#</th>
                                <th className="p-2 w-40">Topic</th>
                                <th className="p-2">Question</th>
                                <th className="p-2 w-40">Model Answer (Preview)</th> 
                                <th className="p-2 w-32">Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {fetchedQuestions.map((q, i) => (
                                <tr key={q.tempId} className={editingQuestionIndex === i ? "bg-yellow-50 border-yellow-300 border-2" : "border-b hover:bg-red-50"}>
                                    <td className="p-2 text-center font-bold">{i + 1}</td>
                                    <td className="p-2 font-medium text-red-700">{q.topic || 'N/A'}</td>
                                    <td className="p-2">{q.question}</td>
                                    <td className="p-2 text-sm text-gray-700 truncate max-w-xs">{q.answer}</td> 
                                    <td className="p-2 text-center">
                                        <button
                                            onClick={() => handleEditQuestion(q, i)}
                                            className="bg-orange-500 text-white px-2 py-1 rounded text-xs mr-2 hover:bg-orange-600"
                                            disabled={editingQuestionIndex !== null}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteQuestion(q, i)}
                                            className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                                            disabled={editingQuestionIndex !== null}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default TeacherAssignmentTheory;