import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send an email using the best available provider:
 * 1. Resend (if AUTH_RESEND_KEY is set)
 * 2. SMTP (if SMTP_HOST is set)
 * 3. Console fallback (dev mode — prints to server logs)
 */
export async function sendEmail({ to, subject, html, from }: SendEmailOptions): Promise<void> {
  const defaultFrom = process.env.EMAIL_FROM ?? "KLLAPP <noreply@localhost>";

  // Option 1: Resend
  if (process.env.AUTH_RESEND_KEY) {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.AUTH_RESEND_KEY);
    await resend.emails.send({
      from: from ?? defaultFrom,
      to,
      subject,
      html,
    });
    return;
  }

  // Option 2: SMTP
  if (process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS ?? "",
          }
        : undefined,
    });

    await transport.sendMail({
      from: from ?? defaultFrom,
      to,
      subject,
      html,
    });
    return;
  }

  // Option 3: Console fallback (dev)
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║           EMAIL (console fallback)           ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║ To:      ${to}`);
  console.log(`║ Subject: ${subject}`);
  console.log("║ Body:    (see HTML below)");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200));
  console.log("");
}
