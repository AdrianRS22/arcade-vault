"use server";

import { render } from "@react-email/components";
import { createElement } from "react";
import { Resend } from "resend";

import ContactEmail from "@/emails/contact-email";

import {
  validateContact,
  type ContactField,
  type ContactFormState,
} from "./contact-schema";

function readField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function sendContactMessage(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values: Record<ContactField, string> = {
    name: readField(formData, "name").trim(),
    email: readField(formData, "email").trim(),
    message: readField(formData, "message").trim(),
  };

  // Honeypot: bots fill the hidden field. Pretend success, send nothing.
  if (readField(formData, "company") !== "") {
    return { status: "sent", name: values.name };
  }

  const errors = validateContact(values);
  if (Object.keys(errors).length > 0) {
    return { status: "invalid", errors, values };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !to || !from) {
    const missing = [
      !apiKey && "RESEND_API_KEY",
      !to && "CONTACT_TO_EMAIL",
      !from && "CONTACT_FROM_EMAIL",
    ].filter(Boolean);
    console.error(
      `[contact] Missing environment variables: ${missing.join(", ")}`,
    );
    return { status: "error", values };
  }

  try {
    const resend = new Resend(apiKey);
    // Render here instead of passing `react:` to Resend: its dynamic import of
    // @react-email/render does not survive the Next.js server bundle.
    const html = await render(createElement(ContactEmail, values));
    const { error } = await resend.emails.send({
      from,
      to,
      replyTo: values.email,
      subject: `[Arcade Vault] New message from ${values.name}`,
      html,
      text: [
        `New message from ${values.name}`,
        "",
        `Name: ${values.name}`,
        `Email: ${values.email}`,
        "",
        "Message:",
        values.message,
      ].join("\n"),
    });

    if (error) {
      console.error("[contact] Resend returned an error:", error);
      return { status: "error", values };
    }
  } catch (err) {
    console.error("[contact] Failed to send email:", err);
    return { status: "error", values };
  }

  return { status: "sent", name: values.name };
}
