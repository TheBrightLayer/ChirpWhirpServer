// routes/sendMailSMTP.js
const express = require("express");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const router = express.Router();

// --- Transporter (SendGrid / SMTP) ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
  logger: true,
  debug: false,
});

transporter.verify((err) => {
  if (err) {
    console.error(
      "Mailer verify error:",
      err && err.message ? err.message : err
    );
  } else {
    console.log("📧 Mailer connected and ready to send!");
  }
});

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

// POST /api/sendMail/send-proposal
router.post("/send-proposal", async (req, res) => {
  try {
    const payload = req.body || {};

    // log incoming payload for debugging (filenames only for attachments)
    try {
      const safePayload = { ...payload };
      if (Array.isArray(safePayload.attachments))
        safePayload.attachments = safePayload.attachments.slice(0, 20);
      console.log("📥 Incoming payload:", JSON.stringify(safePayload));
    } catch (e) {
      console.warn("Could not stringify payload for logging:", e);
    }

    const {
      fromName,
      fromEmail,
      company,
      to,
      cc,
      subject,
      recipientName,
      intro,
      quickIntro,
      highlights,
      scope,
      message,
      attachments,
    } = payload;

    if (!fromEmail || !String(fromEmail).includes("@")) {
      return res
        .status(400)
        .json({
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
    const envInternal = process.env.INTERNAL_NOTIFY_EMAIL;
    const payloadTo = ensureArray(to);
    const internalRecipients = envInternal
      ? ensureArray(envInternal)
      : payloadTo.length
      ? payloadTo
      : ["contact@thebrightlayer.com"];

    // prepare attachments (server/files/<filename>)
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
        console.warn("Attachment file missing (skipped):", filePath);
      }
    }

    // --- USER-FACING EMAIL: use the exact template provided by user ---
    // Replace placeholders:
    // [Client’s First Name] -> first word of fromName
    // [Your Name], [Phone Number], [Email ID], [Website URL] -> from environment variables
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

        <p>Thank you for reaching out through our Request a Quote form. We’re thrilled to hear that you’re interested in collaborating with us.</p>

        <p><strong>Here’s a quick intro about who we are and what we do:</strong></p>

        <p>At ${companyName}, we’re not just another creative or tech agency — we’re a team of storytellers, designers, strategists, and developers passionate about building experiences that connect and convert.</p>

        <p>From crafting your brand identity 🧩, to designing websites and apps 🌐, to scaling your digital presence through marketing 📈 — we’ve got every phase of your brand journey covered.</p>

        <p>We’ve had the privilege to collaborate with brands of all sizes — startups, innovators, and industry giants alike — helping them transform ideas into bold, impactful realities.</p>

        <h4>✨ What’s next?</h4>
        <p>Our team will review your requirements and get back to you shortly with a customized proposal tailored to your goals.</p>

        <p>In the meantime, you can explore more about us:<br/>
        🌐 <a href="${bizWebsite}" target="_blank" rel="noopener noreferrer">${bizWebsite}</a></p>

        <p>If you’d like to jump on a quick call to discuss your vision, feel free to reply to this email or use the contact details below — we’d love to connect!</p>

        <p>Warm regards,<br/>
        <strong>${bizContactName}</strong><br/>
        Business Development Manager<br/>
        ${bizPhone ? `📞 ${bizPhone}` : ""} ${
      bizPhone && bizEmail ? " | " : ""
    } ${bizEmail ? `✉️ ${bizEmail}` : ""}<br/>
        🌐 ${bizWebsite}
        </p>
      </div>
    `;

    const textForUser = `
Hi ${firstName(fromName) || "there"},

Thank you for reaching out through our Request a Quote form. We’re thrilled to hear that you’re interested in collaborating with us.

At ${companyName}, we’re a team of storytellers, designers, strategists, and developers passionate about building experiences that connect and convert.

We’ll review your requirements and get back to you shortly with a customized proposal tailored to your goals.

Explore more: ${bizWebsite}

Warm regards,
${bizContactName}
Business Development Manager
${bizPhone ? "Phone: " + bizPhone + "\n" : ""}${
      bizEmail ? "Email: " + bizEmail + "\n" : ""
    }${bizWebsite ? "Website: " + bizWebsite : ""}
`.trim();

    // DEBUG: log snippet so you can verify server-side composition
    console.log("📝 userSubject:", userSubject);
    console.log("📝 htmlForUser (snippet):", htmlForUser.substring(0, 1000));

    const mailToUser = {
      from: `"${process.env.COMPANY_NAME || "BrightLayer"}" <${verifiedFrom}>`,
      to: userRecipient,
      cc: undefined, // do not cc internal addresses onto the user email
      replyTo: internalRecipients.length
        ? internalRecipients.join(",")
        : undefined,
      subject: userSubject,
      text: textForUser,
      html: htmlForUser,
      attachments: attachFiles.length ? attachFiles : undefined,
    };

    // send to user
    let sendResultUser;
    try {
      sendResultUser = await transporter.sendMail(mailToUser);
      console.log(
        "✅ Sent user email to:",
        userRecipient,
        sendResultUser && (sendResultUser.messageId || sendResultUser.response)
      );
    } catch (err) {
      console.error("❌ Error sending mail TO user:", err);
      const details =
        err && err.response && err.response.body
          ? err.response.body
          : err.message || String(err);
      return res
        .status(500)
        .json({ error: "Failed to send email to user", details });
    }

    // --- internal notification (keeps attachments) ---
    if (internalRecipients.length) {
      const textInternal = `
New inquiry received from website form:

Name: ${fromName || "—"}
Email: ${fromEmail || "—"}
Company: ${company || "—"}
Subject: ${subject || "—"}

Message:
${message || "—"}
      `.trim();

      const htmlInternal = `
        <div style="font-family: Arial, Helvetica, sans-serif; color:#111;">
          <h3>New website inquiry</h3>
          <p><strong>Name:</strong> ${escapeHtml(fromName || "—")}</p>
          <p><strong>Email:</strong> ${escapeHtml(fromEmail || "—")}</p>
          <p><strong>Company:</strong> ${escapeHtml(company || "—")}</p>
          <p><strong>Subject:</strong> ${escapeHtml(subject || "—")}</p>
          <h4>Message</h4>
          <pre style="white-space:pre-wrap; background:#f7f7f7; padding:10px;">${escapeHtml(
            message || "—"
          )}</pre>
        </div>
      `;

      const mailInternal = {
        from: `"${
          fromName || process.env.COMPANY_NAME || "Website Visitor"
        }" <${verifiedFrom}>`,
        to: internalRecipients.join(","),
        subject: `New inquiry: ${fromName || fromEmail}`,
        text: textInternal,
        html: htmlInternal,
        replyTo: userRecipient,
        attachments: attachFiles.length ? attachFiles : undefined,
      };

      try {
        const info = await transporter.sendMail(mailInternal);
        console.log(
          "✅ Internal notification sent:",
          info && (info.messageId || info.response)
        );
      } catch (err) {
        console.warn(
          "⚠️ Failed to send internal notification:",
          err && (err.response?.body || err.message || err)
        );
      }
    }

    return res.json({
      success: true,
      message: "Email sent to user and internal team notified.",
      info: sendResultUser,
    });
  } catch (err) {
    console.error("Unexpected error in /send-proposal:", err);
    return res
      .status(500)
      .json({ error: "Server error", details: err.message || String(err) });
  }
});

module.exports = router;
