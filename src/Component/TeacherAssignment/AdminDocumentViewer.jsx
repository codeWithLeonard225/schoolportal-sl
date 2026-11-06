
import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { schoollpq } from "../Database/schoollibAndPastquestion";

import {
    collection,
    onSnapshot,
    query,
    where,
    doc,
    deleteDoc
} from "firebase/firestore";

import { toast } from "react-toastify";

const AdminDocumentViewer = () => {
    const location = useLocation();

    const schoolId = location.state?.schoolId ||
        localStorage.getItem("schoolId") ||
        sessionStorage.getItem("schoolId") || "";

    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter states
    const [filterClass, setFilterClass] = useState("ALL");
    const [filterSubject, setFilterSubject] = useState("ALL");
    const [filterTerm, setFilterTerm] = useState("ALL");
    const [searchTerm, setSearchTerm] = useState("");

    const termsList = [
        "Term 1 T1",
        "Term 1 Exam",
        "Term 2 T1",
        "Term 2 Exam",
        "Term 3 T1",
        "Term 3 Exam"
    ];

    // 1. Realtime Firestore Listener
    useEffect(() => {
        if (!schoolId) {
            console.warn("Missing School ID.");
            setDocuments([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const q = query(
            collection(schoollpq, "TeacherUploadedDocuments"),
            where("schoolId", "==", schoolId)
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const docsData = snapshot.docs.map((docItem) => ({
                    id: docItem.id,
                    ...docItem.data()
                }));

                docsData.sort((a, b) =>
                    (b.timestamp?.seconds || 0) -
                    (a.timestamp?.seconds || 0)
                );

                setDocuments(docsData);
                setLoading(false);
            },
            (error) => {
                console.error("Firestore Error:", error);
                toast.error("Failed to load school documents.");
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [schoolId]);

    // 2. Dynamic Class Options
    const uniqueClasses = useMemo(() => {
        return Array.from(
            new Set(documents.map(d => d.className).filter(Boolean))
        );
    }, [documents]);

    // 3. Dynamic Subject Options
    const uniqueSubjects = useMemo(() => {
        const filteredByClass = filterClass === "ALL"
            ? documents
            : documents.filter(d => d.className === filterClass);

        return Array.from(
            new Set(filteredByClass.map(d => d.subject).filter(Boolean))
        );
    }, [documents, filterClass]);

    // 4. Search and Filters
    const filteredDocuments = useMemo(() => {
        return documents.filter((docItem) => {
            const matchesClass =
                filterClass === "ALL" || docItem.className === filterClass;

            const matchesSubject =
                filterSubject === "ALL" || docItem.subject === filterSubject;

            const matchesTerm =
                filterTerm === "ALL" || docItem.term === filterTerm;

            const matchesSearch =
                !searchTerm.trim() ||
                docItem.fileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                docItem.teacher?.toLowerCase().includes(searchTerm.toLowerCase());

            return matchesClass && matchesSubject && matchesTerm && matchesSearch;
        });
    }, [documents, filterClass, filterSubject, filterTerm, searchTerm]);

    // 5. View Document
    const handleViewDocument = (docItem) => {
        const fileUrl = docItem.fileUrl;

        if (!fileUrl) {
            toast.error("Document URL not found.");
            return;
        }

        const ext = docItem.fileFormat?.toLowerCase() ||
            fileUrl.split("?")[0].split(".").pop().toLowerCase();

        if (["pdf", "txt", "png", "jpg", "jpeg"].includes(ext)) {
            window.open(fileUrl, "_blank", "noopener,noreferrer");
        } else {
            const officeViewerUrl =
                `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;

            window.open(officeViewerUrl, "_blank", "noopener,noreferrer");
        }
    };

    // 6. Download Document
    const handleDownloadDocument = async (docItem) => {
        try {
            const response = await fetch(docItem.fileUrl);

            if (!response.ok) {
                throw new Error("Download failed");
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = docItem.fileName || "document";

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.URL.revokeObjectURL(downloadUrl);

            toast.success("Download started!");
        } catch (error) {
            console.error("Download Error:", error);
            window.open(docItem.fileUrl, "_blank");
        }
    };

    // 7. Delete Document
    const handleDelete = async (docId) => {
        if (!window.confirm("Are you sure you want to delete this document record?")) {
            return;
        }

        try {
            await deleteDoc(
                doc(schoollpq, "TeacherUploadedDocuments", docId)
            );

            toast.success("Document deleted successfully.");
        } catch (error) {
            console.error("Delete Error:", error);
            toast.error("Failed to delete document.");
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 bg-white rounded-2xl shadow-lg text-gray-800">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 pb-4 border-b">
                <div>
                    <h1 className="text-2xl font-black text-indigo-700 uppercase tracking-tight">
                        School Documents & Question Papers Repository
                    </h1>

                    <p className="text-xs text-gray-500 mt-1">
                        School ID: <span className="font-bold text-gray-800">
                            {schoolId || "MISSING_SCHOOL_ID"}
                        </span>
                    </p>
                </div>

                <div className="mt-3 md:mt-0 bg-indigo-50 px-4 py-2 rounded-xl text-xs font-bold text-indigo-700 border border-indigo-200">
                    Total Uploads: {documents.length}
                </div>
            </div>

            {/* Missing School ID */}
            {!schoolId && (
                <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-600 text-red-700 text-xs rounded-r-xl">
                    <strong>Warning:</strong> No School ID found.
                </div>
            )}

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 border rounded-2xl bg-indigo-50">

                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                        Search File or Teacher
                    </label>

                    <input
                        type="text"
                        placeholder="Type file or teacher name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full border rounded-xl px-3 py-2 text-xs font-medium bg-white"
                    />
                </div>

                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                        Filter Class
                    </label>

                    <select
                        value={filterClass}
                        onChange={(e) => {
                            setFilterClass(e.target.value);
                            setFilterSubject("ALL");
                        }}
                        className="w-full border rounded-xl px-3 py-2 text-xs font-bold bg-white"
                    >
                        <option value="ALL">
                            All Classes ({uniqueClasses.length})
                        </option>

                        {uniqueClasses.map((cls, i) => (
                            <option key={i} value={cls}>{cls}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                        Filter Subject
                    </label>

                    <select
                        value={filterSubject}
                        onChange={(e) => setFilterSubject(e.target.value)}
                        className="w-full border rounded-xl px-3 py-2 text-xs font-bold bg-white"
                    >
                        <option value="ALL">All Subjects</option>

                        {uniqueSubjects.map((sbj, i) => (
                            <option key={i} value={sbj}>{sbj}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
                        Filter Term / Exam
                    </label>

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

            {/* Documents Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-sm">

                <table className="w-full text-left text-xs min-w-[700px]">

                    <thead className="bg-indigo-700 text-white uppercase text-[10px] tracking-wider">
                        <tr>
                            <th className="p-4">#</th>
                            <th className="p-4">File Name</th>
                            <th className="p-4">Class</th>
                            <th className="p-4">Subject</th>
                            <th className="p-4">Term / Test</th>
                            <th className="p-4">Uploaded By</th>
                            <th className="p-4 text-center">Actions</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">

                        {loading ? (
                            <tr>
                                <td colSpan="7" className="p-10 text-center text-indigo-600 font-bold">
                                    Loading school documents...
                                </td>
                            </tr>
                        ) : filteredDocuments.map((docItem, i) => (
                            <tr key={docItem.id} className="hover:bg-indigo-50/40 transition-colors">

                                <td className="p-4 font-bold text-gray-400">
                                    {i + 1}
                                </td>

                                <td className="p-4 font-bold text-indigo-700 max-w-xs truncate">
                                    <span title={docItem.fileName}>
                                        {docItem.fileName}
                                    </span>
                                </td>

                                <td className="p-4 font-semibold text-gray-800">
                                    <span className="bg-gray-100 px-2 py-1 rounded-md text-[11px]">
                                        {docItem.className}
                                    </span>
                                </td>

                                <td className="p-4 font-semibold text-gray-800">
                                    {docItem.subject}
                                </td>

                                <td className="p-4 text-gray-700">
                                    {docItem.term}
                                </td>

                                <td className="p-4 text-gray-700 font-medium">
                                    {docItem.teacher || "N/A"}
                                </td>

                                <td className="p-4">
                                    <div className="flex justify-center items-center gap-3 flex-wrap">

                                        <button
                                            onClick={() => handleViewDocument(docItem)}
                                            className="text-blue-600 font-bold uppercase text-[10px] hover:underline"
                                        >
                                            View
                                        </button>

                                        <button
                                            onClick={() => handleDownloadDocument(docItem)}
                                            className="text-emerald-600 font-bold uppercase text-[10px] hover:underline"
                                        >
                                            Download
                                        </button>

                                        <button
                                            onClick={() => handleDelete(docItem.id)}
                                            className="text-red-500 font-bold uppercase text-[10px] hover:underline"
                                        >
                                            Delete
                                        </button>

                                    </div>
                                </td>
                            </tr>
                        ))}

                        {!loading && filteredDocuments.length === 0 && (
                            <tr>
                                <td colSpan="7" className="p-10 text-center text-gray-400 font-medium italic">
                                    No documents found for this school ID.
                                </td>
                            </tr>
                        )}

                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminDocumentViewer;
