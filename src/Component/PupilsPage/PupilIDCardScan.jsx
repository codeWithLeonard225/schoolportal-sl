import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { pupilLoginFetch } from "../Database/PupilLogin";
import { useAuth } from "../Security/AuthContext";

const PupilIDCard = () => {
    const { user } = useAuth();
    const currentSchoolId = user?.schoolId || "";
    const [pupils, setPupils] = useState([]);
    const [selectedClass, setSelectedClass] = useState("All");

    useEffect(() => {
        if (!currentSchoolId) return;
        const q = query(
            collection(pupilLoginFetch, "PupilsReg"),
            where("schoolId", "==", currentSchoolId)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPupils(data);
        });
        return () => unsubscribe();
    }, [currentSchoolId]);

    const filteredPupils = selectedClass === "All"
        ? pupils
        : pupils.filter(p => p.class === selectedClass);

    return (
        <div style={{ padding: "20px" }}>
            <style>
                {`
                @media print {
                    .no-print { display: none !important; }
                    .id-card-grid { display: flex !important; flex-wrap: wrap !important; gap: 12px !important; }
                    .id-card { page-break-inside: avoid; }
                }
                `}
            </style>

            <div className="no-print" style={{ marginBottom: "20px", display: "flex", gap: "10px", alignItems: "center" }}>
                <h2>Pupil & Staff ID Cards</h2>
                <button 
                    onClick={() => window.print()} 
                    style={{ padding: "8px 16px", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
                >
                    Print Cards
                </button>
            </div>

            <div className="id-card-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
                {filteredPupils.map((pupil) => (
                    <div 
                        key={pupil.id} 
                        className="id-card"
                        style={{
                            width: "330px",
                            height: "210px",
                            border: "1px solid #1a252f",
                            borderRadius: "8px",
                            padding: "12px",
                            boxSizing: "border-box",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            backgroundColor: "#ffffff",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.12)"
                        }}
                    >
                        {/* Card Header */}
                        <div style={{ borderBottom: "2px solid #007bff", paddingBottom: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: "bold", fontSize: "12px", color: "#007bff" }}>STUDENT / STAFF ID</span>
                            <span style={{ fontSize: "10px", color: "#666" }}>{pupil.academicYear || ""}</span>
                        </div>

                        {/* Card Body */}
                        <div style={{ display: "flex", gap: "12px", alignItems: "center", margin: "8px 0" }}>
                            <img 
                                src={pupil.userPhotoUrl || "https://via.placeholder.com/80"} 
                                alt={pupil.studentName} 
                                style={{ width: "75px", height: "75px", borderRadius: "6px", objectFit: "cover", border: "1px solid #ccc" }}
                            />
                            <div style={{ fontSize: "11px", lineHeight: "1.4", flex: 1 }}>
                                <div style={{ fontWeight: "bold", fontSize: "13px", color: "#2c3e50" }}>{pupil.studentName}</div>
                                <div><strong>ID:</strong> {pupil.studentID}</div>
                                <div><strong>Class:</strong> {pupil.class}</div>
                                <div><strong>Type:</strong> {pupil.pupilType || "Pupil"}</div>
                            </div>
                        </div>

                        {/* Card Footer with QRCodeSVG */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "1px solid #eee", paddingTop: "6px" }}>
                            <div style={{ fontSize: "9px", color: "#888" }}>Official School Pass</div>
                            <div style={{ background: "#fff", padding: "2px" }}>
                                <QRCodeSVG 
                                    value={pupil.studentID} 
                                    size={52}
                                    level="M"
                                    includeMargin={false}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PupilIDCard;