import "server-only";
import { Resend } from "resend";

function getClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendPasswordChangedEmail(to: string) {
  try {
    const { error } = await getClient().emails.send({
      from: "LuceEdge <onboarding@resend.dev>",
      to,
      subject: "Your LuceEdge password was changed",
      text: "Your password was just changed. If this wasn't you, reset your password immediately and contact support.",
    });
    if (error) {
      // Resend's SDK returns { data, error } rather than throwing on
      // rejected sends (e.g. sandbox sender restrictions) — log it so a
      // silently-failed notification is at least visible server-side.
      console.error("sendPasswordChangedEmail failed:", error);
    }
  } catch (err) {
    console.error("sendPasswordChangedEmail threw:", err);
  }
}
