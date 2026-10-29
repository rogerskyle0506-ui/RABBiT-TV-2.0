// src/lib/report.ts

// Full email base64 encoded: "rogerskyle0506@gmail.com"
const ENCODED_ALERT_DESTINATION = "cm9nZXJza3lsZTA1MDZAZ21haWwuY29t";

/**
 * Decodes the base64-protected destination email at runtime
 */
function getAlertEmailAddress(): string {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    try {
      return window.atob(ENCODED_ALERT_DESTINATION);
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * Captures clean device and browser OS metadata without external dependencies
 */
export function getDeviceDetails() {
  if (typeof window === "undefined") return { model: "Unknown Device", os: "Unknown OS" };

  const ua = navigator.userAgent;
  let model = "Unknown Device";
  let os = "Android";

  // Parse OS Version
  if (ua.includes("Android")) {
    const match = ua.match(/Android\s([0-9.]+)/);
    if (match) os = `Android ${match[1]}`;
  }

  // Parse Device Model
  if (ua.includes("Silk/") || ua.includes("FireTV") || ua.includes("SmartTV")) {
    model = "Amazon Fire TV Stick / Smart TV Stick";
  } else {
    const match = ua.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      const parts = match[1].split(";");
      model = parts[parts.length - 1]?.trim() || navigator.platform;
    }
  }

  return { model, os };
}

/**
 * Dispatches activation alert containing user input and captured device details
 */
export async function sendPermanentActivationAlert(profileName: string, userAge?: string | number) {
  try {
    const destinationEmail = getAlertEmailAddress();
    const device = getDeviceDetails();
    const timestamp = new Date().toLocaleString();

    // Safely resolve age from parameter or localStorage fallback
    const resolvedAge = userAge || (typeof window !== "undefined" ? localStorage.getItem("rabtv_user_age") || "Not Provided" : "Not Provided");

    console.log(`[RABBIT TV SECURITY] Permanent activation alert triggered for: ${profileName}`);

    // Verification check for runtime execution
    if (!destinationEmail) {
      console.warn("Destination alert address could not be resolved.");
      return;
    }

    // Payload prepared with base64 decoded email
    const alertPayload = {
      to_email: destinationEmail,
      user_name: profileName,
      user_age: resolvedAge,
      device_model: device.model,
      device_os: device.os,
      activation_time: timestamp,
      message: `SECURITY ALERT: Permanent code entered!\n\nUser Name: ${profileName}\nAge: ${resolvedAge}\nDevice Model: ${device.model}\nOS: ${device.os}\nTime: ${timestamp}`,
    };

    // Ready for integration with your existing transport mechanism
    return alertPayload;
  } catch (err) {
    console.error("Failed to prepare activation report:", err);
  }
}
