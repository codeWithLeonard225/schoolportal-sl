// src/utils/loginTracker.js
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase";

const parseDeviceDetails = () => {
  const ua = navigator.userAgent;
  let deviceType = "Desktop";
  if (/Mobi|Android/i.test(ua)) deviceType = "Mobile";
  else if (/Tablet|iPad/i.test(ua)) deviceType = "Tablet";

  let os = "Unknown OS";
  if (/Windows NT 10.0/i.test(ua)) os = "Windows 10/11";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Unknown Browser";
  if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";

  return {
    deviceType,
    os,
    browser,
    userAgent: ua,
  };
};

const fetchLocationDetails = async () => {
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) throw new Error("Location fetch failed");
    const data = await response.json();
    return {
      ip: data.ip || "Unknown IP",
      city: data.city || "Unknown City",
      region: data.region || "Unknown Region",
      country: data.country_name || "Unknown Country",
      countryCode: data.country_code || "",
      isp: data.org || "Unknown ISP",
    };
  } catch (error) {
    console.warn("Could not fetch geolocation:", error);
    return {
      ip: "Unavailable",
      city: "Unknown",
      region: "Unknown",
      country: "Unknown",
      countryCode: "",
      isp: "Unknown",
    };
  }
};

export const logLoginAttempt = async ({
  userID,
  userName,
  role = "unknown",
  schoolId = "unknown",
  status = "success", // "success" or "failed"
}) => {
  try {
    const device = parseDeviceDetails();
    const location = await fetchLocationDetails();

    await addDoc(collection(db, "LoginLogs"), {
      userID,
      userName,
      role,
      schoolId,
      status,
      device: `${device.deviceType} (${device.os} - ${device.browser})`,
      deviceDetails: device,
      location: `${location.city}, ${location.region}`,
      country: location.country,
      countryCode: location.countryCode,
      ip: location.ip,
      isp: location.isp,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to record login log:", err);
  }
};