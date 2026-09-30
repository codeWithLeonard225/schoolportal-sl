import React, { useState, useEffect, useCallback, useMemo } from "react";
import Cropper from "react-easy-crop";
import { toast } from "react-toastify";
import { db } from "../../../firebase"; // Adjust path to match your firebase config
import {
  collection,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { useLocation } from "react-router-dom";
import localforage from "localforage";

// Cloudinary Configurations
const CLOUD_NAME = "dxcrlpike";
const UPLOAD_PRESET = "LeoTechSl Projects";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Cache Store
const teacherStore = localforage.createInstance({
  name: "TeacherRegistrationCache",
  storeName: "teachersData",
});

/**
 * Utility function to generate cropped canvas image and return Blob/File
 */
const getCroppedImg = async (imageSrc, pixelCrop, rotation = 0) => {
  const image = new Image();
  image.src = imageSrc;
  image.crossOrigin = "anonymous"; // Handle cross-origin images from Cloudinary

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const rotRad = (rotation * Math.PI) / 180;

  // Calculate bounding box size
  const bBoxWidth =
    Math.abs(Math.cos(rotRad) * image.width) +
    Math.abs(Math.sin(rotRad) * image.height);
  const bBoxHeight =
    Math.abs(Math.sin(rotRad) * image.width) +
    Math.abs(Math.cos(rotRad) * image.height);

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);

  ctx.drawImage(image, 0, 0);

  // Set final cropped canvas size
  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    croppedCanvas.toBlob((file) => {
      resolve(file);
    }, "image/jpeg", 0.95);
  });
};

const TeacherPhotoManager = () => {
  const location = useLocation();
  const schoolId = location.state?.schoolId || "N/A";
  const CACHE_KEY = `teachers_list_${schoolId}`;

  const [teachers, setTeachers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // Modal & Cropper State
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load teachers from cache / Firestore
  useEffect(() => {
    if (schoolId === "N/A") {
      setLoading(false);
      return;
    }

    const loadAndListen = async () => {
      setLoading(true);

      // Cache load
      try {
        const cachedItem = await teacherStore.getItem(CACHE_KEY);
        if (cachedItem && cachedItem.data && cachedItem.data.length > 0) {
          setTeachers(cachedItem.data);
          setLoading(false);
        }
      } catch (e) {
        console.error("Cache load error:", e);
      }

      // Firestore Listener
      const q = query(
        collection(db, "Teachers"),
        where("schoolId", "==", schoolId)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetched = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setTeachers(fetched);
          teacherStore.setItem(CACHE_KEY, {
            timestamp: Date.now(),
            data: fetched,
          });
          setLoading(false);
        },
        (err) => {
          console.error("Firestore error:", err);
          toast.error("Failed to load teachers");
          setLoading(false);
        }
      );

      return () => unsubscribe();
    };

    loadAndListen();
  }, [schoolId, CACHE_KEY]);

  const filteredTeachers = useMemo(() => {
    if (!searchTerm.trim()) return teachers;
    const lower = searchTerm.toLowerCase();
    return teachers.filter(
      (t) =>
        t.teacherName?.toLowerCase().includes(lower) ||
        t.teacherID?.toLowerCase().includes(lower)
    );
  }, [teachers, searchTerm]);

  // Open modal to crop existing or newly selected photo
  const handleOpenEditor = (teacher) => {
    if (!teacher.userPhotoUrl) {
      toast.warning("This teacher has no photo. Please select a new file to upload.");
    }
    setSelectedTeacher(teacher);
    setImageSrc(teacher.userPhotoUrl || null);
    setZoom(1);
    setRotation(0);
  };

  // Select local file from device
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > MAX_FILE_SIZE) {
        toast.error("File size exceeds 5MB limit.");
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImageSrc(reader.result);
      });
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Crop, upload to Cloudinary, and save URL back to Firestore
  const handleSaveCroppedPhoto = async () => {
    if (!selectedTeacher || !imageSrc || !croppedAreaPixels) return;

    setIsSaving(true);
    try {
      // 1. Generate Cropped Image Blob
      const croppedBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation
      );

      // 2. Prepare Cloudinary Upload
      const formData = new FormData();
      formData.append("file", croppedBlob, `teacher_${selectedTeacher.id}.jpg`);
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", "SchoolApp/Teachers");

      // 3. Upload to Cloudinary
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!data.secure_url) {
        throw new Error("Failed to upload cropped photo to Cloudinary.");
      }

      // 4. Update Firestore Doc
      const teacherRef = doc(db, "Teachers", selectedTeacher.id);
      await updateDoc(teacherRef, {
        userPhotoUrl: data.secure_url,
        userPublicId: data.public_id,
      });

      toast.success(`Photo updated for ${selectedTeacher.teacherName}!`);
      setSelectedTeacher(null);
      setImageSrc(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to crop and save photo.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading && teachers.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-xl font-medium text-gray-700">Loading photos...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-6 space-y-6">
      <div className="bg-white shadow-lg rounded-2xl p-6 w-full max-w-5xl">
        <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">
          Teacher Photo Manager 📸
        </h2>
        <p className="text-center text-sm text-gray-500 mb-6">
          Crop, zoom, rotate, and update profile photos for registered teachers.
        </p>

        {/* Search Filter */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search teacher by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Teachers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTeachers.map((teacher) => (
            <div
              key={teacher.id}
              className="border rounded-2xl p-4 flex flex-col items-center bg-gray-50 shadow-sm hover:shadow-md transition"
            >
              <div className="w-28 h-28 mb-3 rounded-full overflow-hidden border-2 border-blue-500 bg-gray-200 flex items-center justify-center">
                {teacher.userPhotoUrl ? (
                  <img
                    src={teacher.userPhotoUrl}
                    alt={teacher.teacherName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl text-gray-400">👤</span>
                )}
              </div>

              <h3 className="font-semibold text-gray-800 text-center line-clamp-1">
                {teacher.teacherName}
              </h3>
              <p className="text-xs text-gray-500 mb-3">ID: {teacher.teacherID}</p>

              <button
                onClick={() => handleOpenEditor(teacher)}
                className="mt-auto w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition"
              >
                Edit / Crop Photo
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ================= CROP & EDIT MODAL ================= */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl flex flex-col space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-lg text-gray-800">
                Crop & Zoom Photo for {selectedTeacher.teacherName}
              </h3>
              <button
                onClick={() => setSelectedTeacher(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Select Local File alternative */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Select New Image from Device (Optional):
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {/* Crop Viewport */}
            {imageSrc ? (
              <div className="relative w-full h-64 bg-gray-900 rounded-xl overflow-hidden">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1} // 1:1 Aspect ratio for profile avatars
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                />
              </div>
            ) : (
              <div className="w-full h-64 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">
                No photo selected. Choose a file above.
              </div>
            )}

            {/* Controls */}
            {imageSrc && (
              <div className="space-y-3 bg-gray-50 p-3 rounded-xl">
                <div>
                  <label className="text-xs font-medium text-gray-600 flex justify-between">
                    <span>Zoom</span>
                    <span>{zoom.toFixed(1)}x</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 flex justify-between">
                    <span>Rotate</span>
                    <span>{rotation}°</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={1}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-2 border-t">
              <button
                type="button"
                onClick={() => setSelectedTeacher(null)}
                className="px-4 py-2 border rounded-xl text-gray-600 text-sm hover:bg-gray-100 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCroppedPhoto}
                disabled={!imageSrc || isSaving}
                className={`px-5 py-2 rounded-xl text-white text-sm font-semibold transition ${
                  isSaving || !imageSrc
                    ? "bg-blue-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isSaving ? "Saving & Uploading..." : "Crop & Save Photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherPhotoManager;