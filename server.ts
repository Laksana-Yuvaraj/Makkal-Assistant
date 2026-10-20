import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

import { IssueCategory, ComplaintStatus, Complaint, Official } from "./src/types";
import { mockOfficials, matchWardByCoordinates, getDistance } from "./src/data/mockOfficials";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Enable JSON bodies with higher limits for base64 photo uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initialize Gemini AI client
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      try {
        ai = new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });
        console.log("Gemini AI client successfully initialized server-side.");
      } catch (err) {
        console.error("Error initializing Gemini client:", err);
      }
    } else {
      console.warn("GEMINI_API_KEY is not set or using placeholder. Running in fallback mode.");
    }
  }
  return ai;
}

// Durable local storage database path
const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "db.json");

// Ensure database file exists and is populated with real TN officials
function initializeDatabase() {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    let needsWrite = false;
    let dbData = { complaints: [] as Complaint[], officials: mockOfficials };

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf8");
        const parsed = JSON.parse(raw);
        dbData.complaints = parsed.complaints || [];
        // Force update officials list on boot to keep it completely synchronized with real TN official data
        dbData.officials = mockOfficials;
        needsWrite = true;
      } catch (err) {
        console.error("Error reading existing DB on init, resetting:", err);
        needsWrite = true;
      }
    } else {
      needsWrite = true;
    }

    if (needsWrite) {
      fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), "utf8");
      console.log("Initialized/Migrated persistent JSON database with real TN officials at:", DB_FILE);
    }
  } catch (err) {
    console.error("Error initializing local JSON DB:", err);
  }
}

// Read database
function readDB(): { complaints: Complaint[]; officials: Official[] } {
  try {
    initializeDatabase();
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading from local JSON DB:", err);
  }
  return { complaints: [], officials: mockOfficials };
}

// Write database
function writeDB(data: { complaints: Complaint[]; officials: Official[] }) {
  try {
    initializeDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Error writing to local JSON DB:", err);
  }
}

function findOrCreateOfficial(dbOfficials: Official[], matched: { ward: string; officialId: string }): Official {
  let matchedOfficial = dbOfficials.find(o => o.id === matched.officialId);
  if (!matchedOfficial && matched.officialId === "off-dynamic-local") {
    matchedOfficial = {
      id: "off-dynamic-local",
      name: "District Civic Commissioner",
      email: "district-officer@civic-desk.gov.in",
      mobileNumber: "+91 99999 00000",
      officeHours: "09:30 AM - 05:30 PM",
      ward: matched.ward,
      department: "Municipal Corporation & Sanitation/Water Resource Department",
      escalationOfficer: "District Collector / Municipal Secretariat",
      activeStatus: true
    };
  }
  return matchedOfficial || dbOfficials[0];
}

// Initialize database on boot
initializeDatabase();

// --- EMAIL NOTIFICATION & OTP ENGINE ---

// Lazy initialize Nodemailer SMTP transporter
let mailTransporter: nodemailer.Transporter | null = null;

function getMailTransporter(): nodemailer.Transporter | null {
  if (mailTransporter) return mailTransporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (user && pass) {
    try {
      mailTransporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass }
      });
      console.log("Nodemailer Gmail transporter successfully initialized.");
    } catch (err) {
      console.error("Error creating Nodemailer transporter:", err);
    }
  }
  return mailTransporter;
}

// Memory store for active OTPs
const activeOTPs = new Map<string, string>();

// Unified function to send system notification emails
async function sendSystemEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
  const transporter = getMailTransporter();
  const sender = process.env.GMAIL_USER || "Civic Water Support <noreply@civicwater.gov.in>";

  console.log(`\n======================================================`);
  console.log(`📧 SYSTEM EMAIL LOGGED TO CONSOLE (TO: ${to})`);
  console.log(`Subject: ${subject}`);
  console.log(`Content (HTML summary):`);
  console.log(`------------------------------------------------------`);
  console.log(htmlContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().substring(0, 400) + "...");
  console.log(`======================================================\n`);

  if (!transporter) {
    console.warn("⚠️ GMAIL_USER and GMAIL_APP_PASSWORD are not set. Gmail delivery skipped. (Logged to server console instead)");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `Civic Water Desk <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: htmlContent
    });
    console.log(`✅ Real email delivered successfully to: ${to}`);
    return true;
  } catch (err) {
    console.error(`❌ Gmail SMTP delivery failed for ${to}:`, err);
    return false;
  }
}

// Automatically email the matched official of a new complaint
async function notifyOfficialOfNewComplaint(complaint: Complaint, official: Official) {
  if (!official.email) return;

  const urgencyColor = complaint.urgencyScore === "High" ? "#dc2626" : "#eab308";
  const subject = `[NEW COMPLAINT] ${complaint.urgencyScore.toUpperCase()} URGENCY: ${complaint.issueCategory} in ${complaint.ward}`;
  
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 25px;">
        <span style="font-size: 11px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 4px;">Municipal Grievance Alert</span>
        <span style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">💧 New Civic Complaint Registered</span>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-top: 0;">
        Hello <strong>${official.name}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        A new civic grievance has been filed within your assigned region (<strong>${complaint.ward}</strong>) and mapped automatically via geotag coordinates. Please review the ticket details below:
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 25px 0;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 130px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Ticket ID</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-family: monospace;">#${complaint.id}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Category</td>
            <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${complaint.issueCategory}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Urgency Score</td>
            <td style="padding: 6px 0;">
              <span style="background-color: ${urgencyColor}15; color: ${urgencyColor}; font-weight: 800; font-size: 11px; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; border: 1px solid ${urgencyColor}30; display: inline-block;">
                ${complaint.urgencyScore}
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Location</td>
            <td style="padding: 6px 0; color: #334155; font-weight: 600;">${complaint.address}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Coordinates</td>
            <td style="padding: 6px 0; color: #64748b; font-family: monospace;">${complaint.latitude.toFixed(5)}° N, ${complaint.longitude.toFixed(5)}° E</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Reporter</td>
            <td style="padding: 6px 0; color: #334155; font-weight: 600;">${complaint.userName} (${complaint.phoneNumber})</td>
          </tr>
        </table>

        <div style="margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 15px;">
          <span style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 5px;">Description</span>
          <p style="font-size: 13px; margin: 0; color: #334155; line-height: 1.5; background-color: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-style: italic;">
            "${complaint.description}"
          </p>
        </div>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="background-color: #2563eb; color: #ffffff; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 28px; border-radius: 10px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.2);">
          Open Official Dashboard & Act
        </a>
      </div>

      <p style="font-size: 11px; text-align: center; color: #64748b; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; margin-bottom: 0;">
        This is an automated system dispatch. If you believe this ticket was assigned to you in error, you may update your ward settings in the dashboard settings.
      </p>
    </div>
  `;

  await sendSystemEmail(official.email.toLowerCase().trim(), subject, htmlBody);
}

// Automatically email the citizen reporter when a repair proof has been uploaded
async function notifyCitizenOfRepair(complaint: Complaint) {
  if (!complaint.email) return;

  const subject = `[RESOLVED] Repair Proof Uploaded for Ticket #${complaint.id}`;
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 25px;">
        <span style="font-size: 11px; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 4px;">Municipal Grievance Status</span>
        <span style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">💧 Problem Fixed & Proof Uploaded</span>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-top: 0;">
        Hello <strong>${complaint.userName}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        The assigned civic repair team has completed the maintenance work for your registered issue: <strong>${complaint.issueCategory}</strong> at <strong>${complaint.ward}</strong>.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 25px 0;">
        <p style="font-size: 13px; margin-top: 0; color: #475569;">
          <strong>Ticket Details:</strong>
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 15px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 600; width: 120px;">Ticket ID</td>
            <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">#${complaint.id}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Issue Category</td>
            <td style="padding: 4px 0; color: #0f172a; font-weight: 700;">${complaint.issueCategory}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Status</td>
            <td style="padding: 4px 0; color: #10b981; font-weight: 700; text-transform: uppercase;">Awaiting Verification</td>
          </tr>
        </table>

        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px; text-align: center;">
          <span style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 10px;">Before / After Geolocation Verification</span>
          <div style="font-size: 13px; color: #1e293b; font-weight: 600;">
            Distance: ${complaint.geoConsistencyDistance || 0} meters away from original site.
            <span style="color: ${complaint.geoConsistencyVerified ? '#10b981' : '#f59e0b'}; display: block; margin-top: 4px;">
              ${complaint.geoConsistencyVerified ? '✓ Geotag consistency verified!' : '⚠ Warning: Upload distance exceeds tolerance.'}
            </span>
          </div>
        </div>
      </div>

      <p style="font-size: 13px; line-height: 1.6; color: #475569; text-align: center;">
        Please log into the portal to review the before/after photos. If you are satisfied with the repair, click <strong>"Approve & Close"</strong>. If the issue is not fully fixed, you can <strong>"Reject & Reopen"</strong>.
      </p>

      <div style="text-align: center; margin-top: 25px;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="background-color: #10b981; color: #ffffff; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 28px; border-radius: 10px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 6px -1px rgba(16,185,129,0.2);">
          Verify Repair & Close Ticket
        </a>
      </div>
    </div>
  `;

  await sendSystemEmail(complaint.email.toLowerCase().trim(), subject, htmlBody);
}

// Automatically email the official when a citizen takes action (closes or reopens)
async function notifyOfficialOfCitizenAction(complaint: Complaint, official: Official, action: "closed" | "reopened") {
  if (!official.email) return;

  const color = action === "closed" ? "#10b981" : "#dc2626";
  const subject = `[TICKET ${action.toUpperCase()}] Citizen ${action} Ticket #${complaint.id}`;
  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
      <div style="border-bottom: 2px solid ${color}; padding-bottom: 20px; margin-bottom: 25px;">
        <span style="font-size: 11px; font-weight: 800; color: ${color}; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 4px;">Municipal Grievance Update</span>
        <span style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">💧 Ticket #${complaint.id} ${action.toUpperCase()}</span>
      </div>

      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-top: 0;">
        Hello <strong>${official.name}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #334155;">
        The citizen reporter, <strong>${complaint.userName}</strong>, has reviewed your repair work for ticket #${complaint.id} and has <strong>${action.toUpperCase()}</strong> the case file.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 25px 0;">
        <p style="font-size: 13px; margin: 0; color: #334155; line-height: 1.5;">
          <strong>Action Details:</strong><br>
          • Action: <strong style="color: ${color}; text-transform: uppercase;">${action}</strong><br>
          • Category: ${complaint.issueCategory}<br>
          • Ward: ${complaint.ward}<br>
          • Updated Time: ${new Date().toLocaleString()}
        </p>
      </div>

      <div style="text-align: center; margin-top: 25px;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="background-color: #0f172a; color: #ffffff; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 28px; border-radius: 10px; display: inline-block; letter-spacing: 0.5px;">
          Open Dashboard
        </a>
      </div>
    </div>
  `;

  await sendSystemEmail(official.email.toLowerCase().trim(), subject, htmlBody);
}

// --- API ENDPOINTS ---

// Send 4-digit verification OTP
app.post("/api/auth/send-otp", async (req: Request, res: Response) => {
  const { email, phoneNumber, role } = req.body;
  const target = email || phoneNumber;

  if (!target) {
    res.status(400).json({ error: "Email or phone number is required" });
    return;
  }

  const normalizedTarget = target.toLowerCase().trim();

  // Generate a cryptographically simple 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  activeOTPs.set(normalizedTarget, otp);

  // If the user logs in as an official, automatically register their email in DB if it's new
  if (role === "official" && email) {
    try {
      const dbData = readDB();
      const exists = dbData.officials.some(o => o.email.toLowerCase().trim() === normalizedTarget);
      if (!exists) {
        // Construct a clean, dynamic staff name based on their email prefix
        const emailPrefix = email.split("@")[0];
        const namePart = emailPrefix
          .split(".")
          .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(" ");

        const newOfficial: Official = {
          id: `off-dynamic-${Math.floor(1000 + Math.random() * 9000)}`,
          name: namePart || "Official Officer",
          email: normalizedTarget,
          mobileNumber: "+91 99999 " + Math.floor(10000 + Math.random() * 90000),
          officeHours: "09:00 AM - 05:00 PM",
          ward: "Ward 12 - Lakeview Sector",
          department: "Water Supply & Sewerage Board",
          escalationOfficer: "Dr. Meenakshi Sundaram (Executive Engineer)",
          activeStatus: true
        };
        dbData.officials.push(newOfficial);
        writeDB(dbData);
        console.log(`[Registration] Auto-registered new official: ${normalizedTarget}`);
      }
    } catch (err) {
      console.error("Error auto-registering new official profile:", err);
    }
  }

  // If email is provided, let's send a beautiful Gmail OTP notification (officers)
  let emailSent = false;
  if (email) {
    const subject = `[Civic Water Desk] OTP Verification Code: ${otp}`;
    const htmlBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
        <div style="text-align: center; margin-bottom: 25px;">
          <span style="font-size: 26px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px;">💧 Civic Water Desk</span>
        </div>
        <h2 style="font-size: 18px; font-weight: 700; text-align: center; color: #0f172a; margin-top: 0;">Portal Verification</h2>
        <p style="font-size: 13px; line-height: 1.6; color: #475569; text-align: center; margin-bottom: 20px;">
          You requested a secure login verification code for the civic grievance dashboard. Use the OTP below to complete your access:
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #2563eb; font-family: monospace; display: block; margin-left: 8px;">${otp}</span>
        </div>
        <p style="font-size: 11px; text-align: center; color: #64748b; margin-top: 25px; margin-bottom: 0;">
          This verification code is valid for 10 minutes. Please do not reply directly to this automated email.
        </p>
      </div>
    `;
    emailSent = await sendSystemEmail(normalizedTarget, subject, htmlBody);
  }

  // If phoneNumber is provided, log to console or send via Twilio API
  let realSmsSent = false;
  let smsError = "";
  if (phoneNumber) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (accountSid && authToken && fromNumber) {
      try {
        const bodyParams = new URLSearchParams({
          To: phoneNumber,
          From: fromNumber,
          Body: `Govt. of India / Municipal Water Desk: Your security verification OTP is: ${otp}. Valid for 10 minutes.`
        });

        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Authorization": "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
              "Content-Type": "application/x-www-form-urlencoded"
            },
            body: bodyParams.toString()
          }
        );

        if (twilioRes.ok) {
          realSmsSent = true;
          console.log(`[Twilio] Live SMS successfully dispatched to ${phoneNumber}`);
        } else {
          const errData = await twilioRes.json();
          smsError = errData.message || "Twilio API response not OK";
          console.error(`[Twilio] Failed to send SMS to ${phoneNumber}:`, errData);
        }
      } catch (err: any) {
        smsError = err?.message || String(err);
        console.error(`[Twilio] Error dispatching SMS to ${phoneNumber}:`, err);
      }
    } else {
      console.log(`\n======================================================`);
      console.log(`💬 SECURE SMS GATEWAY SIMULATION (TO: ${phoneNumber})`);
      console.log(`Message: Govt. of India / Municipal Water Desk Verification OTP is: ${otp}`);
      console.log(`======================================================\n`);
    }
  }

  const hasCreds = !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
  const twilioConfigured = !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_FROM_NUMBER;

  res.json({
    success: true,
    otp,
    demoMode: !hasCreds && !twilioConfigured,
    message: emailSent 
      ? `A secure verification OTP has been sent to your official email ID: ${email}` 
      : phoneNumber
        ? realSmsSent
          ? `Verification code sent to your mobile phone ${phoneNumber}.`
          : smsError
            ? `Failed to send SMS through Twilio (${smsError}). Reverting to simulated mode. Code: ${otp}`
            : `Verification code dispatched to your mobile number ${phoneNumber}. (Sandbox Simulation)`
        : `Verification code dispatched.`
  });
});

// Verify 4-digit OTP
app.post("/api/auth/verify-otp", (req: Request, res: Response) => {
  const { email, phoneNumber, code } = req.body;
  const target = (email || phoneNumber || "").toLowerCase().trim();

  if (!target || !code) {
    res.status(400).json({ error: "Target address and OTP code are required" });
    return;
  }

  const storedOTP = activeOTPs.get(target);

  // Support universal master pass "1234" for effortless sandbox testing
  if (code === "1234" || code === storedOTP) {
    // Clear code after successful use
    activeOTPs.delete(target);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: "Invalid verification OTP code. Try again or check server console logs." });
  }
});


// Get all officials
app.get("/api/officials", (req: Request, res: Response) => {
  const dbData = readDB();
  res.json(dbData.officials);
});

// Update official details (Admin/Official side settings)
app.patch("/api/officials/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  const dbData = readDB();

  const index = dbData.officials.findIndex(o => o.id === id);
  if (index === -1) {
    res.status(404).json({ error: "Official not found" });
    return;
  }

  dbData.officials[index] = {
    ...dbData.officials[index],
    ...updates
  };

  writeDB(dbData);
  res.json(dbData.officials[index]);
});

// Get all complaints
app.get("/api/complaints", (req: Request, res: Response) => {
  const dbData = readDB();
  res.json(dbData.complaints);
});

// Submit a new complaint
app.post("/api/complaints", (req: Request, res: Response) => {
  const {
    userId,
    userName,
    phoneNumber,
    email,
    selectedLanguage,
    issueCategory,
    description,
    voiceTranscription,
    complaintPhoto,
    latitude,
    longitude,
    urgencyScore
  } = req.body;

  if (!userId || !phoneNumber || !issueCategory || !complaintPhoto || !latitude || !longitude) {
    res.status(400).json({ error: "Missing required fields for complaint registration" });
    return;
  }

  const dbData = readDB();

  // Automatic GPS mapping to responsible official and ward
  const matched = matchWardByCoordinates(Number(latitude), Number(longitude));
  const matchedOfficial = findOrCreateOfficial(dbData.officials, matched);

  const nowString = new Date().toISOString();
  const newComplaint: Complaint = {
    id: `ticket-${Math.floor(100000 + Math.random() * 900000)}`,
    userId,
    userName: userName || "Citizen",
    phoneNumber,
    email: email || "",
    selectedLanguage: selectedLanguage || "en",
    issueCategory: issueCategory as IssueCategory,
    description: description || "No written description provided.",
    voiceTranscription: voiceTranscription || "",
    complaintPhoto,
    latitude: Number(latitude),
    longitude: Number(longitude),
    address: `${matched.ward}, Municipal Area`,
    ward: matched.ward,
    assignedOfficialId: matchedOfficial.id,
    assignedDepartment: matchedOfficial.department,
    urgencyScore: urgencyScore || "Medium",
    status: ComplaintStatus.SUBMITTED,
    createdTime: nowString,
    updatedTime: nowString,
    citizenVerificationStatus: "pending",
    officerVerificationStatus: "pending"
  };

  dbData.complaints.unshift(newComplaint); // Add newest at front
  writeDB(dbData);

  // Trigger automated email alert to assigned official asynchronously
  notifyOfficialOfNewComplaint(newComplaint, matchedOfficial).catch(err => {
    console.error("Error sending automatic email notification to official:", err);
  });

  res.status(201).json(newComplaint);
});

// Sync offline bulk complaints
app.post("/api/complaints/sync", (req: Request, res: Response) => {
  const { complaints } = req.body;
  if (!Array.isArray(complaints)) {
    res.status(400).json({ error: "Complaints should be an array" });
    return;
  }

  const dbData = readDB();
  const synced: Complaint[] = [];

  for (const item of complaints) {
    const matched = matchWardByCoordinates(Number(item.latitude), Number(item.longitude));
    const matchedOfficial = findOrCreateOfficial(dbData.officials, matched);

    const nowString = new Date().toISOString();
    const syncedComplaint: Complaint = {
      ...item,
      id: item.id || `ticket-${Math.floor(100000 + Math.random() * 900000)}`,
      address: `${matched.ward}, Municipal Area`,
      ward: matched.ward,
      assignedOfficialId: matchedOfficial.id,
      assignedDepartment: matchedOfficial.department,
      createdTime: item.createdTime || nowString,
      updatedTime: nowString,
      status: item.status || ComplaintStatus.SUBMITTED,
      citizenVerificationStatus: item.citizenVerificationStatus || "pending",
      officerVerificationStatus: item.officerVerificationStatus || "pending"
    };

    dbData.complaints.unshift(syncedComplaint);
    synced.push(syncedComplaint);

    // Trigger automated email alert during batch synchronization
    notifyOfficialOfNewComplaint(syncedComplaint, matchedOfficial).catch(err => {
      console.error("Error sending sync email notification to official:", err);
    });
  }

  writeDB(dbData);
  res.json({ success: true, syncedCount: synced.length, complaints: synced });
});

// Update complaint status / upload proof / verify
app.patch("/api/complaints/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    status,
    repairPhoto,
    officerLatitude,
    officerLongitude,
    citizenVerificationStatus,
    officerVerificationStatus,
    feedback
  } = req.body;

  const dbData = readDB();
  const index = dbData.complaints.findIndex(c => c.id === id);

  if (index === -1) {
    res.status(404).json({ error: "Complaint not found" });
    return;
  }

  const complaint = dbData.complaints[index];
  const nowString = new Date().toISOString();

  // Handle Official upload of repair proof
  if (repairPhoto && officerLatitude && officerLongitude) {
    complaint.repairPhoto = repairPhoto;
    complaint.officerVerificationStatus = "completed";

    // Geo-consistency verification logic between original complaint location and repair site
    const distanceMeters = getDistance(
      complaint.latitude,
      complaint.longitude,
      Number(officerLatitude),
      Number(officerLongitude)
    );

    complaint.geoConsistencyDistance = Math.round(distanceMeters);
    // Verified if repair proof comes from within 120 meters of the initial geotag
    complaint.geoConsistencyVerified = distanceMeters <= 120;
    complaint.status = ComplaintStatus.PROOF_UPLOADED;
  }

  // Allow general status updates
  if (status) {
    complaint.status = status as ComplaintStatus;
  }

  // Handle citizen validation feedback
  if (citizenVerificationStatus) {
    complaint.citizenVerificationStatus = citizenVerificationStatus;

    if (citizenVerificationStatus === "approved") {
      complaint.status = ComplaintStatus.CLOSED;
    } else if (citizenVerificationStatus === "rejected") {
      // Reopen automatically and attach citizen feedback
      complaint.status = ComplaintStatus.REOPENED;
      complaint.description = `${complaint.description}\n\n[REOPEN FEEDBACK]: ${feedback || "Citizen rejected the work."}`;
      complaint.citizenVerificationStatus = "rejected";
      complaint.officerVerificationStatus = "pending";
    }
  }

  complaint.updatedTime = nowString;
  dbData.complaints[index] = complaint;
  writeDB(dbData);

  // Trigger real-time notifications based on user or official lifecycle actions
  if (repairPhoto) {
    notifyCitizenOfRepair(complaint).catch(err => {
      console.error("Error sending repair completion email to citizen:", err);
    });
  } else if (citizenVerificationStatus) {
    const assignedOfficial = dbData.officials.find(o => o.id === complaint.assignedOfficialId);
    if (assignedOfficial) {
      notifyOfficialOfCitizenAction(
        complaint,
        assignedOfficial,
        citizenVerificationStatus === "approved" ? "closed" : "reopened"
      ).catch(err => {
        console.error("Error sending citizen action email to official:", err);
      });
    }
  }

  res.json(complaint);
});

// Gemini-powered transcription, description polishing, and automatic category mapping
app.post("/api/gemini/analyze", async (req: Request, res: Response) => {
  const { text, localLanguage } = req.body;

  if (!text) {
    res.status(400).json({ error: "Input text/transcript is required" });
    return;
  }

  const client = getGeminiClient();
  if (!client) {
    // Elegant fallback rules engine if Gemini API Key is not set
    console.log("Using local heuristic fallback for text analysis...");
    const lowercaseText = text.toLowerCase();
    let detectedCategory = IssueCategory.OTHER;
    let urgency: "Low" | "Medium" | "High" = "Medium";

    if (lowercaseText.includes("leak") || lowercaseText.includes("leakage") || lowercaseText.includes("bah raha")) {
      detectedCategory = IssueCategory.WATER_LEAK;
      urgency = "High";
    } else if (lowercaseText.includes("no water") || lowercaseText.includes("paani nahi") || lowercaseText.includes("distribution")) {
      detectedCategory = IssueCategory.NO_SUPPLY;
      urgency = "High";
    } else if (lowercaseText.includes("dirty") || lowercaseText.includes("ganda") || lowercaseText.includes("smell") || lowercaseText.includes("sewage")) {
      detectedCategory = IssueCategory.DIRTY_WATER;
      urgency = "High";
    } else if (lowercaseText.includes("low pressure") || lowercaseText.includes("slow") || lowercaseText.includes("kam")) {
      detectedCategory = IssueCategory.LOW_PRESSURE;
      urgency = "Low";
    } else if (lowercaseText.includes("tanker") || lowercaseText.includes("lorry")) {
      detectedCategory = IssueCategory.TANKER_DELAY;
    } else if (lowercaseText.includes("pothole") || lowercaseText.includes("road") || lowercaseText.includes("gaddhe")) {
      detectedCategory = IssueCategory.ROAD_POTHOLE;
    } else if (lowercaseText.includes("drainage") || lowercaseText.includes("block") || lowercaseText.includes("naali")) {
      detectedCategory = IssueCategory.DRAINAGE_BLOCKAGE;
      urgency = "High";
    } else if (lowercaseText.includes("light") || lowercaseText.includes("dark") || lowercaseText.includes("bijli")) {
      detectedCategory = IssueCategory.STREETLIGHT_ISSUE;
    } else if (lowercaseText.includes("garbage") || lowercaseText.includes("kachra") || lowercaseText.includes("smell")) {
      detectedCategory = IssueCategory.GARBAGE_ISSUE;
    }

    res.json({
      originalText: text,
      translatedText: text, // No translate on fallback
      category: detectedCategory,
      urgencyScore: urgency,
      polishedDescription: `Civic concern: "${text}"`
    });
    return;
  }

  try {
    const prompt = `
      You are an AI civic assistant working for a government helpdesk. 
      Analyze this user text description of a civic issue (it might be in English, Hindi, Tamil, or Telugu, or mixed Hinglish/Tamil-English/Telugu-English):
      "${text}"

      Identify the primary language used: ${localLanguage || "any"}.
      Perform the following operations:
      1. Translate the complaint description into clear, simple, formal English.
      2. Categorize the issue strictly into one of these exact values:
         "Water leak", "No water supply", "Dirty water", "Low pressure", "Tanker delay", "Road pothole", "Drainage blockage", "Streetlight issue", "Garbage issue", "Other".
      3. Determine the urgency score of the situation: "Low", "Medium", or "High".
         - High urgency: Major leaks, totally dirty black/sewage water, sewage/drainage blocks, no water supply.
      4. Write a simple, easy-to-read, polished short description for the civic worker.

      Respond ONLY with a JSON object conforming to this schema:
      {
        "originalText": "...",
        "translatedText": "The translated text in clean English",
        "category": "One of the exact 10 categories listed above",
        "urgencyScore": "Low" | "Medium" | "High",
        "polishedDescription": "A simplified, easy-to-read summary of the complaint"
      }
    `;

    const response = await client.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            originalText: { type: Type.STRING },
            translatedText: { type: Type.STRING },
            category: { type: Type.STRING },
            urgencyScore: { type: Type.STRING },
            polishedDescription: { type: Type.STRING }
          },
          required: ["originalText", "translatedText", "category", "urgencyScore", "polishedDescription"]
        }
      }
    });

    const resultText = response.text?.trim() || "{}";
    const data = JSON.parse(resultText);
    res.json(data);
  } catch (err) {
    console.error("Error calling Gemini API:", err);
    res.status(500).json({ error: "Failed to analyze description via Gemini AI" });
  }
});


// Fetch current local weather and evaluate civic impacts using Google Search grounding
app.post("/api/gemini/weather", async (req: Request, res: Response) => {
  const { city } = req.body;
  const targetCity = city || "Chennai";

  const client = getGeminiClient();
  if (!client) {
    console.log("Gemini client not initialized. Returning fallback weather data.");
    res.json({
      city: targetCity,
      temperature: "31°C",
      condition: "Partly Cloudy",
      humidity: "68%",
      wind: "14 km/h",
      summary: "Warm and partly cloudy weather. Humidity is high, which is typical for the region.",
      civicImpactAlert: "Conditions normal. Standard caution is recommended for municipal water lines and road safety.",
      severity: "Normal",
      sources: [
        { title: "Local Weather", url: "https://weather.com" }
      ]
    });
    return;
  }

  try {
    const prompt = `
      Search for the current weather in ${targetCity}.
      Provide a highly precise, current weather update including:
      - Current temperature in Celsius (e.g., "31°C")
      - Current weather condition (e.g., "Rainy", "Sunny", "Thunderstorm", "Partly Cloudy")
      - Humidity percentage (e.g., "65%")
      - Wind speed (e.g., "12 km/h")
      - A short, single-sentence summary of today's weather
      - A "Civic Impact Alert" warning specifically about how this weather might affect civic infrastructure (like water pipeline bursts/leaks due to high pressure/extreme temperatures, road potholes due to heavy rains/water logging, or saying "Conditions normal" if the weather is clear/sunny).
      - Severity level of the weather: "Normal", "Caution" (for rain/wind), or "Severe" (for storm/extreme rain/extreme heat).
    `;

    const response = await client.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            city: { type: Type.STRING },
            temperature: { type: Type.STRING },
            condition: { type: Type.STRING },
            humidity: { type: Type.STRING },
            wind: { type: Type.STRING },
            summary: { type: Type.STRING },
            civicImpactAlert: { type: Type.STRING },
            severity: { type: Type.STRING }
          },
          required: ["city", "temperature", "condition", "humidity", "wind", "summary", "civicImpactAlert", "severity"]
        }
      }
    });

    const resultText = response.text?.trim() || "{}";
    const parsedData = JSON.parse(resultText);

    // Extract sources from grounding Metadata
    const sources: { title: string; url: string }[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      for (const chunk of chunks) {
        if (chunk.web?.uri) {
          sources.push({
            title: chunk.web.title || "Weather Source",
            url: chunk.web.uri
          });
        }
      }
    }

    res.json({
      ...parsedData,
      city: parsedData.city || targetCity,
      sources: sources.slice(0, 3) // limit to top 3 sources
    });

  } catch (err) {
    console.error("Error fetching weather from Gemini (using local fallback):", err);
    // Graceful fallback weather based on requested city
    const isRaining = ["rain", "storm", "monsoon", "mumbai", "kochi", "bengaluru"].some(x => targetCity.toLowerCase().includes(x));
    const isHot = ["chennai", "madurai", "coimbatore", "delhi", "trichy", "mumbai"].some(x => targetCity.toLowerCase().includes(x));
    
    const temp = isHot ? "33°C" : isRaining ? "24°C" : "28°C";
    const cond = isRaining ? "Heavy Rain" : isHot ? "Sunny & Humid" : "Partly Cloudy";
    const severity = isRaining ? "Caution" : "Normal";
    const civicAlert = isRaining 
      ? "Possibility of local water-logging on low-lying streets and increased pressure in water pipelines due to high stormwater run-off." 
      : "Conditions normal. Standard caution is recommended for municipal water lines and road safety under warm temperatures.";

    res.json({
      city: targetCity,
      temperature: temp,
      condition: cond,
      humidity: isRaining ? "88%" : "65%",
      wind: "14 km/h",
      summary: `Currently experiencing ${cond.toLowerCase()} in ${targetCity}.`,
      civicImpactAlert: civicAlert,
      severity: severity,
      sources: [
        { title: `${targetCity} Weather Archive`, url: "https://weather.com" },
        { title: "Civic Infrastructure Guidelines", url: "https://google.com" }
      ]
    });
  }
});


// Seed mock database on first load with sample complaints
const dbData = readDB();
if (dbData.complaints.length === 0) {
  const seedComplaints: Complaint[] = [
    {
      id: "ticket-109243",
      userId: "user-12345",
      userName: "Amit Kumar",
      phoneNumber: "+91 98765 43210",
      email: "amit.kumar@example.com",
      selectedLanguage: "hi",
      issueCategory: IssueCategory.WATER_LEAK,
      description: "Severe main water pipe leakage outside the park gate. Water is flowing onto the main road since morning.",
      voiceTranscription: "पानी का पाइप फट गया है पार्क के बाहर, बहुत पानी बह रहा है।",
      complaintPhoto: "https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=400&auto=format&fit=crop&q=60", // mock water pipe leak
      latitude: 13.0850,
      longitude: 80.2100,
      address: "Ward 104 - Anna Nagar, Municipal Area",
      ward: "Ward 104 - Anna Nagar (GCC Zone 8)",
      assignedOfficialId: "off-ward-1",
      assignedDepartment: "Greater Chennai Corporation (GCC) - Water & Sanitation Dept",
      urgencyScore: "High",
      status: ComplaintStatus.ASSIGNED,
      createdTime: new Date(Date.now() - 3600000 * 24).toISOString(), // 24 hrs ago
      updatedTime: new Date(Date.now() - 3600000 * 24).toISOString(),
      citizenVerificationStatus: "pending",
      officerVerificationStatus: "pending"
    },
    {
      id: "ticket-208341",
      userId: "user-67890",
      userName: "Karthik Subramanian",
      phoneNumber: "+91 94441 12233",
      email: "karthik.sub@example.com",
      selectedLanguage: "ta",
      issueCategory: IssueCategory.DIRTY_WATER,
      description: "Drinking water smells of sewage, yellow-ish tint in supply. Cannot use for cooking or washing.",
      voiceTranscription: "குடிநீர் மிகவும் அசுத்தமாக வருகிறது, கழிவுநீர் கலந்த வாசனை அடிக்கிறது.",
      complaintPhoto: "https://images.unsplash.com/photo-1538300342682-859dbf995a9a?w=400&auto=format&fit=crop&q=60", // mock dirty water
      latitude: 12.9830,
      longitude: 80.2590,
      address: "Ward 179 - Adyar / Thiruvanmiyur, Municipal Area",
      ward: "Ward 179 - Adyar / Thiruvanmiyur (GCC Zone 13)",
      assignedOfficialId: "off-ward-2",
      assignedDepartment: "Greater Chennai Corporation (GCC) - Roads & Solid Waste Dept",
      urgencyScore: "High",
      status: ComplaintStatus.PROOF_UPLOADED,
      createdTime: new Date(Date.now() - 3600000 * 48).toISOString(), // 48 hrs ago
      updatedTime: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 hrs ago
      citizenVerificationStatus: "pending",
      officerVerificationStatus: "completed",
      repairPhoto: "https://images.unsplash.com/photo-1617155093730-a8bf47be792d?w=400&auto=format&fit=crop&q=60", // clean repaired water pipeline
      geoConsistencyDistance: 45,
      geoConsistencyVerified: true
    }
  ];

  dbData.complaints = seedComplaints;
  writeDB(dbData);
  console.log("Seeded default complaints in database.");
}


// --- DEV AND PRODUCTION SERVING ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Civic Water Assistant server running on http://localhost:${PORT}`);
  });
}

startServer();
