// server/routes/proposalRoutes.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const { body, validationResult } = require("express-validator");

const router = express.Router();
router.use(helmet());

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: "Too many requests, please try again later." },
});
router.use(limiter);

// Configure transporter using env vars
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
transporter.verify().then(() => console.log("Mailer ready")).catch((e) => console.warn("Mailer verify warning:", e.message));

// Helpers
function ensureArray(maybe) {
  if (!maybe) return [];
  if (Array.isArray(maybe)) return maybe;
  if (typeof maybe === "string") return maybe.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

function fileExistsInServerFiles(filename) {
  if (!filename) return false;
  const p = path.join(__dirname, "..", "files", filename);
  return fs.existsSync(p);
}

// Validation chain:
// - to: required (string or array)
// - subject: optional but recommended
// - fromEmail (optional) must be email if provided
const validate = [
  body("to").notEmpty().withMessage("Recipient (to) is required"),
  body("fromEmail").optional().isEmail().withMessage("fromEmail must be a valid email"),
  body("cc").optional(),
  body("subject").optional().trim().escape(),
  body("recipientName").optional().trim().escape(),
  body("fromName").optional().trim().escape(),
  body("intro").optional().trim().escape(),
  body("quickIntro").optional().trim().escape(),
  body("scope").optional().trim().escape(),
  body("message").optional().trim().escape(),
  body("highlights").optional(), // can be array or string
  body("attachments").optional(), // can be array of filenames or strings (URLs)
];

router.post("/send-proposal", validate, async (req, res) => {
  try {
    // validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const {
      fromName,
      fromEmail,
      to,
      cc,
      subject,
      recipientName,
      intro,
      quickIntro,
      highlights,
      scope,
      message,
      attachments, // array of filenames (in server/files/) or URLs
    } = req.body;

    // Prepare sender: prefer values from request, otherwise fallback to env
    const senderEmail = (fromEmail && fromEmail.trim()) || process.env.FROM_EMAIL || process.env.SMTP_USER;
    const senderName = (fromName && fromName.trim()) || "";

    const fromHeader = senderName ? `"${senderName}" <${senderEmail}>` : senderEmail;

    // Normalize recipients
    const toList = ensureArray(to);
    const ccList = ensureArray(cc);

    if (toList.length === 0) return res.status(400).json({ error: "At least one recipient in `to` is required" });

    // Prepare highlights as HTML list if provided
    let highlightsHtml = "";
    const highlightArray = Array.isArray(highlights) ? highlights : (typeof highlights === "string" ? ensureArray(highlights) : []);
    if (highlightArray.length > 0) {
      highlightsHtml = "<ul>";
      highlightArray.forEach(h => highlightsHtml += `<li>${h}</li>`);
      highlightsHtml += "</ul>";
    }

    // Build dynamic HTML body
    const displayName = recipientName ? recipientName : "there";
    const htmlBody = `
      <p>Moshi Moshi ${displayName}, <em>Well, that’s how we say hello.</em></p>

      ${intro ? `<p>${intro}</p>` : ""}
      ${quickIntro ? `<h3>Quick Intro:</h3><p>${quickIntro}</p>` : ""}

      ${highlightArray.length ? `<h4>✨ Moshi Moshi in action</h4>${highlightsHtml}` : ""}

      ${scope ? `<h4>Scope of work</h4><p>${scope}</p>` : ""}

      ${message ? `<p>${message.replace(/\n/g, "<br/>")}</p>` : ""}

      <p>Please find the attached document(s) for commercials / portfolio.</p>

      <p>Regards,<br/>
      <strong>${senderName || senderEmail}</strong><br/>
      ${process.env.COMPANY_NAME ? `${process.env.COMPANY_NAME}<br/>` : ""}
      ${process.env.COMPANY_WEBSITE ? `<a href="${process.env.COMPANY_WEBSITE}">${process.env.COMPANY_WEBSITE}</a><br/>` : ""}
      ${process.env.COMPANY_PHONE ? `${process.env.COMPANY_PHONE}<br/>` : ""}
      </p>
    `;

    // Plain text fallback (simple)
    const textBody = `
Moshi Moshi ${displayName}, Well, that's how we say hello.

${intro || ""}

${quickIntro ? "Quick Intro:\n" + quickIntro + "\n" : ""}

${highlightArray.length ? "Highlights:\n" + highlightArray.join("\n") + "\n" : ""}

${scope ? "Scope of work:\n" + scope + "\n" : ""}

${message || ""}

Please find the attached document(s).

Regards,
${senderName || senderEmail}
${process.env.COMPANY_NAME || ""}
${process.env.COMPANY_WEBSITE || ""}
`.trim();

    // Prepare attachments array for nodemailer
    const mailAttachments = [];
    const attachList = Array.isArray(attachments) ? attachments : (attachments ? [attachments] : []);
    for (const a of attachList) {
      if (!a) continue;
      // If value looks like a URL (starts with http), attach by URL/path
      if (typeof a === "string" && /^https?:\/\//i.test(a)) {
        mailAttachments.push({ filename: path.basename(a), path: a });
        continue;
      }
      // Otherwise treat as a filename inside server/files/
      if (fileExistsInServerFiles(a)) {
        const full = path.join(__dirname, "..", "files", a);
        mailAttachments.push({ filename: a, path: full, contentType: "application/pdf" });
        continue;
      }
      // If file not found, ignore or you may log a warning
      console.warn("Attachment not found or unsupported:", a);
    }

    const mailOptions = {
      from: fromHeader,
      to: toList,
      cc: ccList.length ? ccList : undefined,
      subject: subject || "Moshi Moshi <> Bright Layer <> Proposal",
      text: textBody,
      html: htmlBody,
      attachments: mailAttachments,
    };

    await transporter.sendMail(mailOptions);

    return res.json({ success: true, message: "Dynamic proposal email sent." });
  } catch (err) {
    console.error("Error in /send-proposal:", err);
    return res.status(500).json({ error: "Failed to send email" });
  }
});

module.exports = router;
