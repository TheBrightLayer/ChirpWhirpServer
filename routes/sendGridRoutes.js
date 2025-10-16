// routes/sendMailSMTP.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const sgMail = require("@sendgrid/mail");
const router = express.Router();

// --- SendGrid Transporter (Web API, NOT SMTP) ---
if (!process.env.SENDGRID_API_KEY) {
  console.error("❌ SENDGRID_API_KEY not set in environment");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log("📧 SendGrid mailer initialized successfully (API mode)");
}

// helper wrapper to mimic nodemailer-like interface
const transporter = {
  async sendMail({ from, to, cc, subject, text, html, attachments }) {
    const msg = {
      from,
      to,
      subject,
      text,
      html,
    };

    if (cc && (Array.isArray(cc) ? cc.length : String(cc).trim())) {
      msg.cc = cc;
    }

    if (attachments?.length) {
      msg.attachments = attachments.map((a) => ({
        content: fs.readFileSync(a.path).toString("base64"),
        filename: a.filename,
        type: a.contentType || "application/octet-stream",
        disposition: "attachment",
      }));
    }

    const [res] = await sgMail.send(msg);
    return {
      messageId: res.headers?.["x-message-id"] || "sendgrid-api",
      statusCode: res.statusCode,
    };
  },
};

// --- Utility helpers ---
const ensureArray = (maybe) => {
  if (!maybe) return [];
  if (Array.isArray(maybe)) return maybe;
  return String(maybe)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const escapeHtml = (unsafe) => {
  if (unsafe === undefined || unsafe === null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const firstName = (fullName) => {
  if (!fullName) return "";
  return String(fullName).trim().split(/\s+/)[0];
};

// --- Main Route: POST /api/sendMail/send-proposal ---
router.post("/send-proposal", async (req, res) => {
  try {
    const payload = req.body || {};

    // Log payload (safe)
    try {
      const safePayload = { ...payload };
      if (Array.isArray(safePayload.attachments))
        safePayload.attachments = safePayload.attachments.slice(0, 20);
      console.log("📥 Incoming payload:", JSON.stringify(safePayload));
    } catch (e) {
      console.warn("⚠️ Could not stringify payload:", e);
    }

    const {
      fromName,
      fromEmail,
      company,
      to,
      subject,
      message,
      attachments,
    } = payload;

    if (!fromEmail || !String(fromEmail).includes("@")) {
      return res.status(400).json({
        error: "User email (fromEmail) is required and must be valid.",
      });
    }

    const verifiedFrom = process.env.FROM_EMAIL;
    if (!verifiedFrom) {
      console.error("FROM_EMAIL missing in .env");
      return res
        .status(500)
        .json({ error: "Server misconfiguration: FROM_EMAIL not set" });
    }

    const userRecipient = String(fromEmail).trim();
    const internalRecipients = ensureArray(
      process.env.INTERNAL_NOTIFY_EMAIL || "contact@thebrightlayer.com"
    );

    // prepare attachments
    const attachFiles = [];
    const files = ensureArray(attachments);
    for (const filename of files) {
      const filePath = path.join(__dirname, "..", "files", filename);
      if (fs.existsSync(filePath)) {
        attachFiles.push({
          filename,
          path: filePath,
          contentType: "application/pdf",
        });
      } else {
        console.warn("⚠️ Attachment missing:", filePath);
      }
    }

    // prepare content
    const clientFirst = escapeHtml(firstName(fromName) || "there");
    const companyName = escapeHtml(process.env.COMPANY_NAME || "BrightLayer");
    const bizContactName = escapeHtml(
      process.env.BIZ_CONTACT_NAME ||
        process.env.COMPANY_NAME ||
        "Business Development"
    );
    const bizPhone = escapeHtml(process.env.BIZ_PHONE || "");
    const bizEmail = escapeHtml(
      process.env.BIZ_EMAIL || process.env.FROM_EMAIL || ""
    );
    const bizWebsite = escapeHtml(
      process.env.BIZ_WEBSITE ||
        process.env.COMPANY_SITE ||
        "https://thebrightlayer.com"
    );

    const userSubject =
      subject || `Thanks for reaching out! Let’s bring your vision to life 🚀`;

    const htmlForUser = `
      <div style="font-family: Arial, Helvetica, sans-serif; color:#111; line-height:1.45;">
        <p>💌 <strong>“Request a Quote” Reply</strong></p>
        <h2 style="margin:0 0 8px 0">${escapeHtml(userSubject)}</h2>
        <p>Hi ${clientFirst},</p>
        <p>Hope you’re doing great! 👋</p>
        <p>Thank you for reaching out through our Request a Quote form.</p>
        <p>At ${companyName}, we’re a team of storytellers, designers, strategists, and developers passionate about building experiences that connect and convert.</p>
        <p>Our team will review your requirements and get back to you shortly with a customized proposal.</p>
        <p>🌐 <a href="${bizWebsite}" target="_blank">${bizWebsite}</a></p>
        <p>Warm regards,<br/>
        <strong>${bizContactName}</strong><br/>
        Business Development Manager<br/>
        ${bizPhone ? `📞 ${bizPhone}` : ""} ${bizEmail ? `✉️ ${bizEmail}` : ""}<br/>
        🌐 ${bizWebsite}</p>
      </div>
    `;

    const textForUser = `
Hi ${firstName(fromName) || "there"},

Thank you for reaching out through our Request a Quote form.

At ${companyName}, we’re a team of storytellers, designers, strategists, and developers passionate about building experiences that connect and convert.

We'll review your requirements and get back to you soon.

Warm regards,
${bizContactName}
${bizWebsite}
`.trim();

    // send email to user
    try {
      const sendResultUser = await transporter.sendMail({
        from: `"${companyName}" <${verifiedFrom}>`,
        to: userRecipient,
        subject: userSubject,
        text: textForUser,
        html: htmlForUser,
        attachments: attachFiles.length ? attachFiles : undefined,
      });

      console.log("✅ Sent user email:", sendResultUser);
    } catch (err) {
      console.error("❌ Error sending mail TO user:", err?.response?.body || err);
      return res.status(500).json({
        error: "Failed to send email to user",
        details: err?.response?.body?.errors || err.message || String(err),
      });
    }

    // internal notification
    try {
      await transporter.sendMail({
        from: `"Website Inquiry" <${verifiedFrom}>`,
        to: internalRecipients.join(","),
        subject: `New inquiry: ${fromName || fromEmail}`,
        text: `Name: ${fromName}\nEmail: ${fromEmail}\nCompany: ${company}\n\nMessage:\n${message}`,
        html: `<p><strong>Name:</strong> ${fromName}</p><p><strong>Email:</strong> ${fromEmail}</p><p><strong>Company:</strong> ${company}</p><p><strong>Message:</strong><br/>${escapeHtml(
          message
        )}</p>`,
      });
      console.log("✅ Internal notification sent.");
    } catch (err) {
      console.warn("⚠️ Failed to send internal notification:", err?.message || err);
    }

    res.json({
      success: true,
      message: "Email sent to user and internal team notified.",
    });
  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    res
      .status(500)
      .json({ error: "Server error", details: err.message || String(err) });
  }
});

module.exports = router;
