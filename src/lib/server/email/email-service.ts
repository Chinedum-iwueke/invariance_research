import { logger } from "@/lib/server/ops/logger";

export type EmailKind = "email_verification" | "password_reset" | "research_desk_request" | "research_desk_status" | "research_desk_addendum";

export interface TransactionalEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  devLink?: string;
  kind: EmailKind;
}

function getEmailFrom() {
  return process.env.EMAIL_FROM || "Invariance Research <no-reply@invarianceresearch.com>";
}

export async function sendTransactionalEmail(input: TransactionalEmail) {
  const provider = (process.env.EMAIL_PROVIDER ?? "").trim().toLowerCase();

  if (provider === "resend") {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("resend_api_key_required");
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getEmailFrom(),
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
    });
    if (!response.ok) {
      logger.error("email.send_failed", { provider, kind: input.kind, status: response.status });
      throw new Error("email_send_failed");
    }
    logger.info("email.sent", { provider, kind: input.kind });
    return;
  }

  if (process.env.NODE_ENV !== "production" && input.devLink) {
    logger.info("email.dev_link", { kind: input.kind, to: input.to, link: input.devLink });
    return;
  }

  logger.error("email.provider_missing", { kind: input.kind });
  throw new Error("email_provider_not_configured");
}
