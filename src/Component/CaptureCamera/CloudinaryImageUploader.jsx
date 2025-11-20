// src/components/CloudinaryImageUploader.js
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import imageCompression from 'browser-image-compression';

const CLOUD_NAME = "dxcrlpike"; // Cloudinary Cloud Name
const UPLOAD_PRESET = "LeoTechSl Projects"; // Cloudinary Upload Preset
const MAX_FILE_SIZE_MB = 2;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif"];

const CloudinaryImageUploader = ({ onUploadSuccess, schoolId }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  // Validate file type & size
  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Invalid file type. Allowed: JPG, PNG, GIF.");
      return false;
    }
    if (file.size / 1024 / 1024 > MAX_FILE_SIZE_MB) {
      toast.error(`File too large. Max size is ${MAX_FILE_SIZE_MB} MB.`);
      return false;
    }
    return true;
  };

  // Compress image
  const compressImage = async (file) => {
    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (err) {
      console.error("Compression failed:", err);
      return file;
    }
  };

  // Convert base64 to Blob
  const base64ToBlob = (base64Data, contentType = "image/jpeg") => {
    const sliceSize = 1024;
    const byteCharacters = atob(base64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: contentType });
  };

  // Unified upload function
  const uploadFile = async (fileOrBlob) => {
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", fileOrBlob);
      formData.append("upload_preset", UPLOAD_PRESET);
      const folderName = `SchoolApp/${schoolId || "UnknownSchool"}`;
formData.append("folder", folderName);


      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded * 100) / e.total);
          setProgress(percent);
        }
      });

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          setUploading(false);
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            onUploadSuccess(data.secure_url, data.public_id);
            setFile(null);
            toast.success("Image uploaded successfully!");
          } else {
            let errorMsg = "Image upload failed.";
            try {
              const errData = JSON.parse(xhr.responseText);
              if (errData?.error?.message) errorMsg = errData.error.message;
            } catch {}
            setError(errorMsg);
            toast.error(errorMsg);
          }
        }
      };

      xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);
      xhr.send(formData);
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Upload failed. Please try again.");
      setUploading(false);
    }
  };

  // Handle file selection
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile || !validateFile(selectedFile)) return;

    const compressed = await compressImage(selectedFile);
    setFile(compressed);
    uploadFile(compressed);
  };

  // Handle camera uploads (base64)
  const handleCameraUpload = async (base64Data) => {
    try {
      const cleanBase64 = base64Data.split(",").pop(); // remove prefix
      const blob = base64ToBlob(cleanBase64);

      // Compress camera image
      const compressedBlob = await compressImage(blob);

      uploadFile(compressedBlob);
    } catch (err) {
      console.error("Camera upload failed:", err);
      toast.error("Camera upload failed. Please try again.");
    }
  };

  return (
    <div className="border border-dashed border-gray-300 rounded-md p-4 text-center">
      <label htmlFor="image-upload-input" className="cursor-pointer text-indigo-600 hover:text-indigo-800 font-medium">
        {file ? `Uploading ${file.name || "photo"}...` : "Click to select image"}
        <input
          id="image-upload-input"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
      </label>

      {uploading && (
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      {!uploading && file && !error && <p className="text-green-600 text-sm mt-2">Upload complete!</p>}
    </div>
  );
};

export default CloudinaryImageUploader;
