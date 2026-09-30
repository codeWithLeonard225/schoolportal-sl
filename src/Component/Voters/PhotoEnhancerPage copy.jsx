import React, { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "react-toastify";
import { useNavigate, useLocation } from "react-router-dom";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import { useAuth } from "../Security/AuthContext";
import localforage from "localforage";

// Cloudinary Configuration
const CLOUD_NAME = "dxcrlpike";
const UPLOAD_PRESET = "LeoTechSl Projects";

const studentStore = localforage.createInstance({
  name: "StudentRegistrationCache",
  storeName: "pupilsData",
});

const PhotoEnhancerPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const currentSchoolId = location.state?.schoolId || user?.schoolId || "N/A";
  const CACHE_KEY = `pupils_list_${currentSchoolId}`;

  // Pupil Selection States
  const [pupils, setPupils] = useState([]);
  const [selectedPupilId, setSelectedPupilId] = useState(location.state?.pupilId || "");
  const [selectedPupil, setSelectedPupil] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingPupils, setIsLoadingPupils] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Photo States
  const [imageSrc, setImageSrc] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const canvasRef = useRef(null);

  // Default enhancement parameters (iPhone HD Processing)
  const [filters, setFilters] = useState({
    brightness: 105, // %
    contrast: 118,   // %
    saturate: 112,   // %
    sharpness: 1,    // Subtle pixel-edge sharpening level
    warmth: 0,       // Temperature shift
  });

  // 1. Fetch Pupils from Firestore Realtime Listener
  useEffect(() => {
    if (!currentSchoolId || currentSchoolId === "N/A") {
      setIsLoadingPupils(false);
      return;
    }

    const collectionRef = collection(db, "PupilsReg");
    const q = query(collectionRef, where("schoolId", "==", currentSchoolId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedPupils = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPupils(fetchedPupils);
        setIsLoadingPupils(false);

        // If pupilId was passed via location.state, automatically select it
        if (location.state?.pupilId) {
          const found = fetchedPupils.find((p) => p.id === location.state.pupilId);
          if (found) {
            setSelectedPupil(found);
            const photo = found.userPhotoUrl || found.userPhoto;
            if (photo) setImageSrc(photo);
          }
        }
      },
      (error) => {
        console.error("Firestore pupil listener error:", error);
        toast.error("Failed to fetch pupil list.");
        setIsLoadingPupils(false);
      }
    );

    return () => unsubscribe();
  }, [currentSchoolId, location.state?.pupilId]);

  // Filtered Pupil List for Search
  const filteredPupils = useMemo(() => {
    if (!searchTerm.trim()) return pupils;
    const term = searchTerm.toLowerCase();
    return pupils.filter(
      (p) =>
        (p.studentName && p.studentName.toLowerCase().includes(term)) ||
        (p.studentID && p.studentID.toLowerCase().includes(term)) ||
        (p.class && p.class.toLowerCase().includes(term))
    );
  }, [pupils, searchTerm]);

  // Handle Pupil Selection Change
  const handlePupilSelect = (e) => {
    const id = e.target.value;
    setSelectedPupilId(id);
    const pupil = pupils.find((p) => p.id === id);
    if (pupil) {
      setSelectedPupil(pupil);
      const photo = pupil.userPhotoUrl || pupil.userPhoto;
      if (photo) {
        setImageSrc(photo);
        toast.info(`Loaded photo for ${pupil.studentName}`);
      } else {
        setImageSrc(null);
        setProcessedImage(null);
        toast.warn("Selected pupil has no photo attached. Upload or capture one.");
      }
    } else {
      setSelectedPupil(null);
      setImageSrc(null);
      setProcessedImage(null);
    }
  };

  // Load local file
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImageSrc(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  // iPhone Presets
  const applyIPhonePreset = () => {
    setFilters({
      brightness: 106,
      contrast: 120,
      saturate: 115,
      sharpness: 2,
      warmth: 5,
    });
    toast.success("iPhone HD Preset Applied!");
  };

  const resetFilters = () => {
    setFilters({
      brightness: 100,
      contrast: 100,
      saturate: 100,
      sharpness: 0,
      warmth: 0,
    });
  };

  // Re-draw canvas whenever image or filter adjustments change
  useEffect(() => {
    if (!imageSrc) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;

      // Apply CSS Filter matrix directly to Canvas rendering pipeline
      ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) sepia(${filters.warmth}%)`;
      ctx.drawImage(img, 0, 0, img.width, img.height);

      // Perform sharpening
      if (filters.sharpness > 0) {
        applySharpenFilter(ctx, canvas.width, canvas.height, filters.sharpness);
      }

      // Convert final enhanced canvas output to Data URL
      setProcessedImage(canvas.toDataURL("image/jpeg", 0.95));
    };
  }, [imageSrc, filters]);

  // Sharpness Convolution Kernel Matrix
  const applySharpenFilter = (ctx, width, height, mix) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const weights = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    const side = Math.round(Math.sqrt(weights.length));
    const halfSide = Math.floor(side / 2);

    const src = data.slice(0);
    const w = width;
    const h = height;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sy = y;
        const sx = x;
        const dstOff = (y * w + x) * 4;

        let r = 0,
          g = 0,
          b = 0;

        for (let cy = 0; cy < side; cy++) {
          for (let cx = 0; cx < side; cx++) {
            const scy = sy + cy - halfSide;
            const scx = sx + cx - halfSide;

            if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
              const srcOff = (scy * w + scx) * 4;
              const wt = weights[cy * side + cx];
              r += src[srcOff] * wt;
              g += src[srcOff + 1] * wt;
              b += src[srcOff + 2] * wt;
            }
          }
        }

        const alpha = mix;
        data[dstOff] = r * alpha + src[dstOff] * (1 - alpha);
        data[dstOff + 1] = g * alpha + src[dstOff + 1] * (1 - alpha);
        data[dstOff + 2] = b * alpha + src[dstOff + 2] * (1 - alpha);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  };

  // Upload Base64 Image to Cloudinary
  const uploadToCloudinary = async (base64Image) => {
    const formData = new FormData();
    formData.append("file", base64Image);
    formData.append("upload_preset", UPLOAD_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Failed to upload enhanced image to Cloudinary");
    }

    const data = await res.json();
    return { url: data.secure_url, publicId: data.public_id };
  };

  // Save Enhanced Image to Firestore & Navigate Back
  const handleConfirmImage = async () => {
    if (!processedImage) {
      return toast.error("Please upload, select, or capture a photo first.");
    }

    // If pupil is selected, update database directly
    if (selectedPupil) {
      setIsSaving(true);
      try {
        const { url, publicId } = await uploadToCloudinary(processedImage);

        const updatePayload = {
          userPhotoUrl: url,
          userPhoto: url,
          userPublicId: publicId,
        };

        const mainRef = doc(db, "PupilsReg", selectedPupil.id);
        const loginRef = doc(db, "PupilsReg", selectedPupil.id);

        await updateDoc(mainRef, updatePayload);
        await updateDoc(loginRef, updatePayload);

        // Update local cache
        const updatedList = pupils.map((p) =>
          p.id === selectedPupil.id ? { ...p, ...updatePayload } : p
        );
        await studentStore.setItem(CACHE_KEY, {
          timestamp: Date.now(),
          data: updatedList,
        });

        toast.success(`Photo updated for ${selectedPupil.studentName}!`);
        navigate(-1, { state: { enhancedPhoto: url, pupilId: selectedPupil.id } });
      } catch (err) {
        console.error(err);
        toast.error("Failed to save enhanced photo.");
      } finally {
        setIsSaving(false);
      }
    } else {
      // Return processed base64 image back to calling page
      navigate(-1, { state: { enhancedPhoto: processedImage } });
      toast.success("Enhanced photo attached!");
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl w-full bg-gray-800 p-6 rounded-2xl shadow-2xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-center text-blue-400 mb-1">
            Pupil Photo Studio & Enhancer
          </h2>
          <p className="text-xs text-center text-gray-400">
            Select a pupil to edit their ID photo or optimize camera snapshots to studio quality.
          </p>
        </div>

        {/* 🔍 PUPIL SELECTOR SECTION */}
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 space-y-3">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            1. Select Pupil to Edit Photo
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <input
                type="text"
                placeholder="Search pupil by name, ID, or class..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded-lg text-xs text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <select
                value={selectedPupilId}
                onChange={handlePupilSelect}
                disabled={isLoadingPupils}
                className="w-full p-2 bg-gray-800 border border-gray-600 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Choose Pupil ({filteredPupils.length} available) --</option>
                {filteredPupils.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.studentName} ({p.class || "No Class"}) - ID: {p.studentID}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedPupil && (
            <div className="flex items-center gap-3 pt-2 text-xs text-blue-300 bg-gray-800/60 p-2 rounded-lg border border-blue-500/30">
              <span className="font-bold">Active Pupil:</span>
              <span>{selectedPupil.studentName}</span>
              <span className="text-gray-400">|</span>
              <span>Class: {selectedPupil.class || "N/A"}</span>
              <span className="text-gray-400">|</span>
              <span>ID: {selectedPupil.studentID}</span>
            </div>
          )}
        </div>

        {/* 🛠️ INPUT & ACTION BUTTONS */}
        <div className="flex flex-wrap justify-center gap-3">
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all">
            Upload Custom Image
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>

          <button
            onClick={applyIPhonePreset}
            disabled={!imageSrc}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all"
          >
            ✨ Apply HD Studio Preset
          </button>

          <button
            onClick={resetFilters}
            disabled={!imageSrc}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all"
          >
            Reset Adjustments
          </button>
        </div>

        {/* Hidden Canvas for Computation */}
        <canvas ref={canvasRef} className="hidden" />

        {/* 🖼️ IMAGE PREVIEW WINDOW */}
        {imageSrc ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold text-gray-400 mb-2">Original / Current Photo</span>
              <img
                src={imageSrc}
                alt="Original"
                className="w-56 h-72 object-cover rounded-xl border-2 border-gray-700 shadow-md"
              />
            </div>

            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold text-green-400 mb-2">Enhanced HD ID Photo</span>
              {processedImage && (
                <img
                  src={processedImage}
                  alt="Enhanced"
                  className="w-56 h-72 object-cover rounded-xl border-2 border-green-500 shadow-xl"
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-56 border-2 border-dashed border-gray-700 rounded-xl">
            <p className="text-gray-500 text-xs">
              Select a pupil from above or upload an image to begin enhancement.
            </p>
          </div>
        )}

        {/* 🎛️ ADJUSTMENT SLIDERS */}
        {imageSrc && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-900 p-4 rounded-xl border border-gray-700">
            <div>
              <label className="text-xs text-gray-300 block mb-1">
                Clarity / Brightness: {filters.brightness}%
              </label>
              <input
                type="range"
                min="80"
                max="140"
                value={filters.brightness}
                onChange={(e) => setFilters({ ...filters, brightness: Number(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-300 block mb-1">
                Contrast (Tone): {filters.contrast}%
              </label>
              <input
                type="range"
                min="80"
                max="150"
                value={filters.contrast}
                onChange={(e) => setFilters({ ...filters, contrast: Number(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-300 block mb-1">
                Color Vibrance: {filters.saturate}%
              </label>
              <input
                type="range"
                min="80"
                max="150"
                value={filters.saturate}
                onChange={(e) => setFilters({ ...filters, saturate: Number(e.target.value) })}
                className="w-full accent-blue-500"
              />
            </div>
          </div>
        )}

        {/* 💾 SAVE BUTTON */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleConfirmImage}
            disabled={!processedImage || isSaving}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl w-full md:w-auto text-sm transition-all shadow-lg flex items-center justify-center gap-2"
          >
            {isSaving
              ? "Uploading & Saving Photo..."
              : selectedPupil
              ? `Save Enhanced Photo for ${selectedPupil.studentName}`
              : "Use Enhanced Photo for Pupil ID"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoEnhancerPage;