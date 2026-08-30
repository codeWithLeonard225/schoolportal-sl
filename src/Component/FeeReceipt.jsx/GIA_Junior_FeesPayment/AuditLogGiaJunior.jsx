import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { db } from "../../../../firebase";
import { useAuth } from "../../Security/AuthContext";
import { useNavigate } from "react-router-dom";
import { 
    FaShieldAlt, 
    FaHistory, 
    FaSearch, 
    FaFilter, 
    FaArrowLeft, 
    FaTrash, 
    FaEdit, 
    FaPlusCircle, 
    FaTimes,
    FaUserCheck
} from "react-icons/fa";

const AuditLogViewer = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // 🔍 1. Fallback to localStorage if user is not in AuthContext state yet
    const savedUser = JSON.parse(localStorage.getItem("schoolUser") || "{}");
    const activeUser = user || savedUser;

    const schoolId = activeUser?.schoolId || "N/A";

    // Dynamic Admin details for logged-in user header
    const currentAdminId = activeUser?.data?.adminID || activeUser?.data?.ceoID || activeUser?.data?.teacherID || "N/A";
    const currentAdminName = activeUser?.data?.adminName || activeUser?.data?.ceoName || activeUser?.data?.teacherName || "Unknown Admin";

    // Component States
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [feeTypeFilter, setFeeTypeFilter] = useState("ALL");
    const [actionFilter, setActionFilter] = useState("ALL");
    const [selectedLog, setSelectedLog] = useState(null); // State for inspecting details modal

    // Helper for Timestamp Formatting
    const formatAuditTime = (timestamp, fallbackDate) => {
        if (timestamp?.toDate) {
            return timestamp.toDate().toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short'
            });
        }
        return fallbackDate || "N/A";
    };

    // Helper to safely resolve who performed the action across different record schemas
    const resolveActorInfo = (data, fallbackActor = "System Admin") => {
        const name = data.performedByName || data.adminName || data.recordedBy || data.deletedBy || fallbackActor;
        const id = data.performedById || data.adminID || data.recordedById || data.deletedById || "";
        const role = data.performedByRole || data.userRole || "";

        return { name, id, role };
    };

    // 📋 2. Real-time Multi-Collection Listener
    useEffect(() => {
        if (!schoolId || schoolId === "N/A") {
            setLoading(false);
            return;
        }

        setLoading(true);
        let liveReceipts = [];
        let updateLogs = [];
        let deleteLogs = [];

        const mergeAndSetLogs = () => {
            const combined = [...liveReceipts, ...updateLogs, ...deleteLogs];
            
            // Sort by most recent timestamp
            combined.sort((a, b) => (b.rawTimestamp || 0) - (a.rawTimestamp || 0));
            setAuditLogs(combined);
            setLoading(false);
        };

        // Query 1: Active Receipts (CREATED)
        const qReceipts = query(
            collection(db, "Receipts"), 
            where("schoolId", "==", schoolId), 
            limit(100)
        );
        const unsubReceipts = onSnapshot(qReceipts, (snapshot) => {
            liveReceipts = snapshot.docs.map(doc => {
                const data = doc.data();
                const rawTs = data.createdAt?.seconds || 0;
                const actor = resolveActorInfo(data, "System Admin");

                return {
                    id: doc.id,
                    auditType: "CREATED",
                    receiptId: data.receiptId || doc.id,
                    studentName: data.studentName || "N/A",
                    studentID: data.studentID || "",
                    feeType: data.feeType || "N/A",
                    academicYear: data.academicYear || "",
                    amount: data.amount,
                    paymentMethod: data.paymentMethod || "Cash",
                    recordedBy: actor.name,
                    actorDetails: actor,
                    formattedTime: formatAuditTime(data.createdAt, data.paymentDate),
                    rawTimestamp: rawTs,
                    fullData: data
                };
            });
            mergeAndSetLogs();
        });

        // Query 2: Updated Receipts (UPDATED)
        const qHistory = query(
            collection(db, "ReceiptsHistory"), 
            where("schoolId", "==", schoolId), 
            limit(100)
        );
        const unsubHistory = onSnapshot(qHistory, (snapshot) => {
            updateLogs = snapshot.docs.map(doc => {
                const data = doc.data();
                const rawTs = data.timestamp?.seconds || 0;
                const newData = data.newData || {};
                const actor = resolveActorInfo(data, newData.recordedBy || "System Admin");

                return {
                    id: doc.id,
                    auditType: "UPDATED",
                    receiptId: data.receiptId || newData.receiptId || "N/A",
                    studentName: newData.studentName || data.previousData?.studentName || "N/A",
                    studentID: newData.studentID || data.previousData?.studentID || "",
                    feeType: newData.feeType || "N/A",
                    academicYear: newData.academicYear || "",
                    amount: newData.amount,
                    paymentMethod: newData.paymentMethod || "Cash",
                    recordedBy: actor.name,
                    actorDetails: actor,
                    formattedTime: formatAuditTime(data.timestamp),
                    rawTimestamp: rawTs,
                    previousData: data.previousData,
                    newData: data.newData
                };
            });
            mergeAndSetLogs();
        });

        // Query 3: Deleted Receipts (DELETED)
        const qDeleted = query(
            collection(db, "DeletedReceipts"), 
            where("schoolId", "==", schoolId), 
            limit(100)
        );
        const unsubDeleted = onSnapshot(qDeleted, (snapshot) => {
            deleteLogs = snapshot.docs.map(doc => {
                const data = doc.data();
                const rawTs = data.deletedAt?.seconds || 0;
                const orig = data.receiptData || {};
                const actor = resolveActorInfo(data, "Admin");

                return {
                    id: doc.id,
                    auditType: "DELETED",
                    receiptId: data.receiptId || orig.receiptId || "N/A",
                    studentName: data.studentName || orig.studentName || "N/A",
                    studentID: orig.studentID || "",
                    feeType: orig.feeType || "N/A",
                    academicYear: orig.academicYear || "",
                    amount: orig.amount,
                    paymentMethod: orig.paymentMethod || "Cash",
                    recordedBy: actor.name,
                    actorDetails: actor,
                    formattedTime: formatAuditTime(data.deletedAt),
                    rawTimestamp: rawTs,
                    fullData: orig
                };
            });
            mergeAndSetLogs();
        });

        return () => {
            unsubReceipts();
            unsubHistory();
            unsubDeleted();
        };
    }, [schoolId]);

    // 🎯 3. Filter Audit Logs
    const filteredLogs = auditLogs.filter(item => {
        const matchesAction = actionFilter === "ALL" || item.auditType === actionFilter;
        const matchesFeeType = feeTypeFilter === "ALL" || item.feeType === feeTypeFilter;

        const searchLower = searchTerm.toLowerCase();
        const recordedBy = (item.recordedBy || "").toLowerCase();
        const actorId = (item.actorDetails?.id || "").toLowerCase();
        const receiptId = (item.receiptId || "").toLowerCase();
        const studentName = (item.studentName || "").toLowerCase();
        const studentID = (item.studentID || "").toLowerCase();

        const matchesSearch = 
            recordedBy.includes(searchLower) ||
            actorId.includes(searchLower) ||
            receiptId.includes(searchLower) ||
            studentName.includes(searchLower) ||
            studentID.includes(searchLower);

        return matchesAction && matchesFeeType && matchesSearch;
    });

    const availableFeeTypes = Array.from(new Set(auditLogs.map(r => r.feeType).filter(Boolean)));

    // Badge styling helper
    const renderActionBadge = (type) => {
        switch (type) {
            case "UPDATED":
                return (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 w-fit">
                        <FaEdit className="text-amber-500" /> UPDATED
                    </span>
                );
            case "DELETED":
                return (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 w-fit">
                        <FaTrash className="text-rose-500" /> DELETED
                    </span>
                );
            default:
                return (
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                        <FaPlusCircle className="text-emerald-500" /> CREATED
                    </span>
                );
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
            {/* Header Section */}
            <div className="w-full max-w-6xl flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm mb-6 border border-gray-200 gap-4">
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
                        title="Go Back"
                    >
                        <FaArrowLeft />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            <FaShieldAlt className="text-indigo-600" /> Receipt Audit Log
                        </h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Real-time database audit trail tracking created, updated, and deleted receipts.
                        </p>
                    </div>
                </div>

                {/* Logged-in Admin Card */}
                <div className="bg-indigo-50 border border-indigo-100 px-4 py-2.5 rounded-xl text-right">
                    <p className="text-xs text-indigo-500 font-medium uppercase tracking-wider">Active Admin</p>
                    <p className="font-bold text-indigo-950">{currentAdminName} <span className="text-xs text-indigo-600 font-semibold">({currentAdminId})</span></p>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="w-full max-w-6xl bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-col lg:flex-row gap-4 items-center justify-between">
                
                {/* Search Input */}
                <div className="relative w-full lg:w-80">
                    <FaSearch className="absolute left-3 top-3.5 text-gray-400 text-sm" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search Admin Name/ID, Student, or Receipt ID..."
                        className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-gray-50 focus:bg-white transition"
                    />
                </div>

                {/* Filters Group */}
                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                    {/* Action Type Filter */}
                    <div className="flex items-center space-x-2">
                        <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Action:</label>
                        <select
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                            className="p-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-700"
                        >
                            <option value="ALL">All Actions</option>
                            <option value="CREATED">Created</option>
                            <option value="UPDATED">Updated</option>
                            <option value="DELETED">Deleted</option>
                        </select>
                    </div>

                    {/* Fee Type Filter */}
                    <div className="flex items-center space-x-2">
                        <FaFilter className="text-gray-400 text-sm" />
                        <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Fee Type:</label>
                        <select
                            value={feeTypeFilter}
                            onChange={(e) => setFeeTypeFilter(e.target.value)}
                            className="p-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-700"
                        >
                            <option value="ALL">All Fee Types</option>
                            {availableFeeTypes.map((type, idx) => (
                                <option key={idx} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="w-full max-w-6xl bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-600 font-semibold uppercase text-xs tracking-wider">
                                <th className="p-4">Action</th>
                                <th className="p-4">Date / Time</th>
                                <th className="p-4">Recorded / Action By</th>
                                <th className="p-4">Receipt Details</th>
                                <th className="p-4">Amount</th>
                                <th className="p-4 text-center">Inspect</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">
                                        Fetching audit log entries...
                                    </td>
                                </tr>
                            ) : filteredLogs.length > 0 ? (
                                filteredLogs.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/80 transition">
                                        {/* Action Badge */}
                                        <td className="p-4 whitespace-nowrap">
                                            {renderActionBadge(item.auditType)}
                                        </td>

                                        {/* Date/Time */}
                                        <td className="p-4 whitespace-nowrap text-gray-600 font-medium">
                                            {item.formattedTime}
                                        </td>

                                        {/* Admin / Recorded By */}
                                        <td className="p-4 whitespace-nowrap">
                                            <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                                                <FaUserCheck className="text-indigo-500 text-xs" />
                                                {item.recordedBy}
                                            </div>
                                            {item.actorDetails?.id && (
                                                <div className="text-xs text-gray-500 font-mono mt-0.5">
                                                    ID: {item.actorDetails.id}
                                                </div>
                                            )}
                                            {item.actorDetails?.role && (
                                                <span className="inline-block mt-0.5 text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                                                    {item.actorDetails.role}
                                                </span>
                                            )}
                                        </td>

                                        {/* Receipt & Student Details */}
                                        <td className="p-4">
                                            <div className="font-medium text-indigo-600">
                                                ID: <span className="font-bold">{item.receiptId}</span>
                                            </div>
                                            <div className="text-xs text-gray-600 mt-0.5">
                                                Student: <span className="font-semibold text-gray-800">{item.studentName}</span> 
                                                {item.studentID && ` (${item.studentID})`}
                                            </div>
                                            <div className="text-xs text-purple-600 font-medium">
                                                {item.feeType} {item.academicYear ? `(${item.academicYear})` : ""}
                                            </div>
                                        </td>

                                        {/* Amount */}
                                        <td className="p-4 whitespace-nowrap font-bold text-gray-800">
                                            {item.amount !== undefined && item.amount !== null
                                                ? `NLE ${parseFloat(item.amount).toFixed(2)}`
                                                : "—"
                                            }
                                        </td>

                                        {/* Details Inspector Button */}
                                        <td className="p-4 whitespace-nowrap text-center">
                                            {(item.auditType === "UPDATED" || item.auditType === "DELETED") ? (
                                                <button
                                                    onClick={() => setSelectedLog(item)}
                                                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition border border-indigo-200"
                                                >
                                                    View Details
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="p-10 text-center text-gray-400">
                                        <FaHistory className="mx-auto text-3xl mb-2 text-gray-300" />
                                        No audit records found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Count */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
                    <span>Showing {filteredLogs.length} of {auditLogs.length} audit entries</span>
                    <span>School ID: {schoolId}</span>
                </div>
            </div>

            {/* 🔍 Details Inspection Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl overflow-hidden">
                        <div className="p-5 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <FaShieldAlt className="text-indigo-600" />
                                Audit Entry Details ({selectedLog.auditType})
                            </h3>
                            <button 
                                onClick={() => setSelectedLog(null)} 
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition"
                            >
                                <FaTimes />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Actor Details Header inside Modal */}
                            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
                                <div>
                                    <span className="text-gray-500">Performed By: </span>
                                    <span className="font-bold text-indigo-950">{selectedLog.recordedBy}</span>
                                    {selectedLog.actorDetails?.id && (
                                        <span className="text-indigo-600 font-semibold ml-1">({selectedLog.actorDetails.id})</span>
                                    )}
                                </div>
                                {selectedLog.actorDetails?.role && (
                                    <span className="bg-indigo-200/60 text-indigo-800 px-2 py-0.5 rounded font-semibold text-[11px]">
                                        {selectedLog.actorDetails.role}
                                    </span>
                                )}
                            </div>

                            {selectedLog.auditType === "UPDATED" && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-100 text-xs space-y-1">
                                        <h4 className="font-bold text-rose-800 uppercase tracking-wider mb-2">Previous State</h4>
                                        <p><strong>Amount:</strong> NLE {selectedLog.previousData?.amount || "N/A"}</p>
                                        <p><strong>Fee Type:</strong> {selectedLog.previousData?.feeType || "N/A"}</p>
                                        <p><strong>Academic Year:</strong> {selectedLog.previousData?.academicYear || "N/A"}</p>
                                        <p><strong>Payment Method:</strong> {selectedLog.previousData?.paymentMethod || "N/A"}</p>
                                    </div>
                                    <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs space-y-1">
                                        <h4 className="font-bold text-emerald-800 uppercase tracking-wider mb-2">New State</h4>
                                        <p><strong>Amount:</strong> NLE {selectedLog.newData?.amount || "N/A"}</p>
                                        <p><strong>Fee Type:</strong> {selectedLog.newData?.feeType || "N/A"}</p>
                                        <p><strong>Academic Year:</strong> {selectedLog.newData?.academicYear || "N/A"}</p>
                                        <p><strong>Payment Method:</strong> {selectedLog.newData?.paymentMethod || "N/A"}</p>
                                    </div>
                                </div>
                            )}

                            {selectedLog.auditType === "DELETED" && (
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-2">
                                    <h4 className="font-bold text-gray-700 uppercase tracking-wider">Archived Deleted Data</h4>
                                    <pre className="bg-white p-3 rounded-lg border border-gray-200 overflow-x-auto text-gray-800 font-mono text-xs">
                                        {JSON.stringify(selectedLog.fullData, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-200 text-right">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogViewer;