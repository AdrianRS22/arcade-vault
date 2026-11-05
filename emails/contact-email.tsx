import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type ContactEmailProps = {
  name: string;
  email: string;
  message: string;
};

const colors = {
  bg: "#0a0a0f",
  panel: "#15151f",
  ink: "#e6e9ff",
  dim: "#8a8fb5",
  cyan: "#00f5ff",
  magenta: "#ff006e",
  line: "#1f3a45",
};

const mono = "'Courier New', Courier, monospace";

const styles = {
  body: {
    margin: 0,
    padding: "24px 12px",
    backgroundColor: colors.bg,
    fontFamily: mono,
    color: colors.ink,
  },
  container: {
    maxWidth: "560px",
    margin: "0 auto",
    backgroundColor: colors.panel,
    border: `2px solid ${colors.cyan}`,
    padding: "24px",
  },
  kicker: {
    margin: "0 0 4px",
    fontSize: "12px",
    letterSpacing: "2px",
    color: colors.magenta,
  },
  title: {
    margin: "0 0 20px",
    fontSize: "20px",
    letterSpacing: "1px",
    color: colors.cyan,
  },
  label: {
    margin: "16px 0 4px",
    fontSize: "11px",
    letterSpacing: "2px",
    color: colors.dim,
  },
  value: {
    margin: 0,
    fontSize: "15px",
    lineHeight: "22px",
    color: colors.ink,
    wordBreak: "break-word" as const,
  },
  message: {
    margin: 0,
    padding: "12px",
    fontSize: "15px",
    lineHeight: "22px",
    color: colors.ink,
    backgroundColor: colors.bg,
    border: `1px solid ${colors.line}`,
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  },
  footer: {
    margin: "24px 0 0",
    fontSize: "11px",
    color: colors.dim,
  },
};

export default function ContactEmail({ name, email, message }: ContactEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`New message from ${name}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.kicker}>▸ ARCADE VAULT // CONTACT</Text>
          <Text style={styles.title}>NEW MESSAGE</Text>

          <Section>
            <Text style={styles.label}>NAME</Text>
            <Text style={styles.value}>{name}</Text>

            <Text style={styles.label}>EMAIL</Text>
            <Text style={styles.value}>{email}</Text>

            <Text style={styles.label}>MESSAGE</Text>
            <Text style={styles.message}>{message}</Text>
          </Section>

          <Text style={styles.footer}>
            Reply to this email to answer {name} directly.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
