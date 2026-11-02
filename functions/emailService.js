const {defineSecret} = require("firebase-functions/params");
const {Resend} = require("resend");

const resendApiKey = defineSecret("RESEND_API_KEY");

// text, headers and tags are optional and only sent when given, so existing
// callers (sendChromeExtensionWelcomeEmail) send exactly what they did before.
async function sendEmail({to, subject, html, text, headers, tags}) {
  if (!to) {
    throw new Error("sendEmail requires a recipient");
  }

  const resend = new Resend(resendApiKey.value());
  const {data, error} = await resend.emails.send({
    from: "Lucid <raman@lucid-app.io>",
    to,
    subject,
    html,
    ...(text ? {text} : {}),
    ...(headers ? {headers} : {}),
    ...(tags ? {tags} : {}),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return data;
}

module.exports = {
  resendApiKey,
  sendEmail,
};