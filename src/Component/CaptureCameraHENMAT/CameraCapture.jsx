import React, { useRef, useEffect, useState } from "react";

// Use the SAME Cloudinary configuration as CloudinaryImageUploader.js
const CLOUD_NAME = "dyt1xzrcv";  // leonardskargbo@gmail.com
const UPLOAD_PRESET = "firstTime";
const UPLOAD_FOLDER = "HENMAT/Uploads";

const CameraCapture = ({
  setPhoto,
  onClose,
  initialFacingMode = "environment",
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [facingMode, setFacingMode] = useState(initialFacingMode);
  const [cameraError, setCameraError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Stop camera when closing or changing cameras
  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      try {
        setCameraError(null);

        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
          });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access error:", err);

        if (!cancelled) {
          setCameraError(
            "Camera access denied or no camera found."
          );
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;
      }
    };
  }, [facingMode]);

  // Capture photo and upload directly to Cloudinary
  const capturePhoto = async () => {
    if (uploading) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth) {
      setCameraError("Camera is not ready. Please try again.");
      return;
    }

    setUploading(true);
    setProgress(0);
    setCameraError(null);

    try {
      const context = canvas.getContext("2d");

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      context.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // Convert captured image into a PNG file
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error("Could not process captured photo."));
          }
        }, "image/png");
      });

      const imageFile = new File(
        [blob],
        `pupil-${Date.now()}.png`,
        { type: "image/png" }
      );

      // Prepare Cloudinary upload
      const formData = new FormData();

      formData.append("file", imageFile);
      formData.append("upload_preset", UPLOAD_PRESET);
      formData.append("folder", UPLOAD_FOLDER);

      // Upload and track progress
      const imageUrl = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open(
          "POST",
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
        );

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setProgress(
              Math.round((event.loaded / event.total) * 100)
            );
          }
        };

        xhr.onload = () => {
          let result;

          try {
            result = JSON.parse(xhr.responseText);
          } catch {
            reject(new Error("Invalid response from Cloudinary."));
            return;
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            if (!result.secure_url) {
              reject(new Error("Cloudinary returned no image URL."));
              return;
            }

            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          } else {
            reject(
              new Error(
                result?.error?.message ||
                  `Cloudinary upload failed (${xhr.status}).`
              )
            );
          }
        };

        xhr.onerror = () => {
          reject(
            new Error("Network error. Check your internet connection.")
          );
        };

        xhr.onabort = () => {
          reject(new Error("Photo upload was cancelled."));
        };

        xhr.send(formData);
      });

      setProgress(100);

      // IMPORTANT: pass the URL, NOT Base64 image data
      setPhoto(imageUrl.url, imageUrl.publicId);

      // Close camera after successful upload
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;
      }

      onClose();
    } catch (err) {
      console.error("Photo capture/upload failed:", err);

      setCameraError(
        err.message || "Unable to upload photo. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const toggleCamera = () => {
    if (!uploading) {
      setFacingMode((previous) =>
        previous === "user" ? "environment" : "user"
      );
    }
  };

  const handleClose = () => {
    if (uploading) return;

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }

    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          padding: "1rem",
          borderRadius: "0.5rem",
          maxWidth: "24rem",
          width: "100%",
          margin: "0 1rem",
        }}
      >
        <h3
          style={{
            textAlign: "center",
            fontWeight: "bold",
            marginBottom: "0.75rem",
          }}
        >
          {facingMode === "user" ? "Front Camera" : "Back Camera"}
        </h3>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: "100%",
            borderRadius: "0.375rem",
            marginBottom: "1rem",
          }}
        />

        <canvas ref={canvasRef} hidden />

        {cameraError && (
          <p
            role="alert"
            style={{
              color: "#b91c1c",
              backgroundColor: "#fee2e2",
              padding: "0.75rem",
              borderRadius: "0.375rem",
              marginBottom: "1rem",
              overflowWrap: "anywhere",
            }}
          >
            {cameraError}
          </p>
        )}

        {uploading && (
          <div style={{ marginBottom: "1rem" }}>
            <p style={{ fontSize: "13px", marginBottom: "5px" }}>
              Uploading photo to Cloudinary: {progress}%
            </p>

            <div
              style={{
                background: "#e5e7eb",
                height: "8px",
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: "#16a34a",
                  width: `${progress}%`,
                  height: "100%",
                  transition: "width 0.2s",
                }}
              />
            </div>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={capturePhoto}
            disabled={uploading}
            style={{
              background: "#16a34a",
              color: "white",
              padding: "0.6rem 0.8rem",
              borderRadius: "0.375rem",
              fontWeight: "600",
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? "Uploading..." : "Capture & Save"}
          </button>

          <button
            onClick={toggleCamera}
            disabled={uploading}
            style={{
              background: "#eab308",
              color: "black",
              padding: "0.6rem 0.8rem",
              borderRadius: "0.375rem",
              fontWeight: "600",
            }}
          >
            Switch Camera
          </button>

          <button
            onClick={handleClose}
            disabled={uploading}
            style={{
              background: "#dc2626",
              color: "white",
              padding: "0.6rem 0.8rem",
              borderRadius: "0.375rem",
              fontWeight: "600",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;