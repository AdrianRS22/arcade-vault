"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { sendContactMessage } from "@/app/about/actions";
import type {
  ContactField,
  ContactFormState,
} from "@/app/about/contact-schema";

const IDLE: ContactFormState = { status: "idle" };
const EMPTY_VALUES: Record<ContactField, string> = {
  name: "",
  email: "",
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="btn xl press"
      type="submit"
      disabled={pending}
      style={{ width: "100%" }}
    >
      {pending ? "TRANSMITTING…" : "▶  SEND MESSAGE"}
    </button>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error" role="alert">
      {message}
    </p>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState(sendContactMessage, IDLE);

  // `dismissed` hides a finished state (sent / error) so the form comes back.
  // `version` remounts the form after every result, which resets its fields
  // to the right defaults and replays the shake animation on each invalid try.
  const [dismissed, setDismissed] = useState<ContactFormState | null>(null);
  const [seen, setSeen] = useState(state);
  const [version, setVersion] = useState(0);
  if (state !== seen) {
    setSeen(state);
    setVersion((v) => v + 1);
  }

  const view = state === dismissed ? IDLE : state;
  // Values come from `state`, not `view`: after RETRY the form is shown again
  // with what the user typed, while "sent" has no values so it comes back empty.
  const values =
    state.status === "invalid" || state.status === "error"
      ? state.values
      : EMPTY_VALUES;
  const errors = view.status === "invalid" ? view.errors : {};

  function backToForm() {
    setDismissed(state);
    setVersion((v) => v + 1);
  }

  return (
    <form
      key={version}
      className={"contact-form" + (view.status === "invalid" ? " shake" : "")}
      action={formAction}
      noValidate
    >
      {view.status === "sent" ? (
        <div className="terminal-success" role="status">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message
              --to=team
            </div>
            <div className="line dim">[OK] Connecting to server…</div>
            <div className="line dim">[OK] Validating content…</div>
            <div className="line dim">[OK] Transmitting packet…</div>
            <div className="line success">
              &gt; MESSAGE RECEIVED. WE&apos;LL GET BACK TO YOU SOON. THANKS,{" "}
              {view.name.toUpperCase()}.<span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button
                className="btn ghost"
                type="button"
                onClick={backToForm}
              >
                SEND ANOTHER MESSAGE
              </button>
            </div>
          </div>
        </div>
      ) : view.status === "error" ? (
        <div className="terminal-success error" role="alert">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message
              --to=team
            </div>
            <div className="line dim">[OK] Connecting to server…</div>
            <div className="line dim">[ERR] Transmission interrupted.</div>
            <div className="line dim">[ERR] Packet was not delivered.</div>
            <div className="line success">
              &gt; TRANSMISSION FAILED. PLEASE TRY AGAIN LATER.
              <span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button
                className="btn ghost"
                type="button"
                onClick={backToForm}
              >
                RETRY
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="contact-name">NAME</label>
            <input
              id="contact-name"
              name="name"
              defaultValue={values.name}
              placeholder="px_kai"
              autoComplete="name"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "contact-name-error" : undefined}
            />
            <FieldError id="contact-name-error" message={errors.name} />
          </div>
          <div className="field">
            <label htmlFor="contact-email">EMAIL</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              defaultValue={values.email}
              placeholder="player@vault.gg"
              autoComplete="email"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "contact-email-error" : undefined}
            />
            <FieldError id="contact-email-error" message={errors.email} />
          </div>
          <div className="field">
            <label htmlFor="contact-message">MESSAGE</label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              defaultValue={values.message}
              placeholder="Tell us what's on your mind…"
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={
                errors.message ? "contact-message-error" : undefined
              }
            />
            <FieldError id="contact-message-error" message={errors.message} />
          </div>

          {/* Honeypot: hidden from people, bots fill it in. */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "-9999px",
              width: 1,
              height: 1,
              overflow: "hidden",
            }}
          >
            <label htmlFor="contact-company">Company</label>
            <input
              id="contact-company"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>

          <SubmitButton />
        </>
      )}
    </form>
  );
}
