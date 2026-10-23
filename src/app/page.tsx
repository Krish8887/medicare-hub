import AppShell from "@/components/medicare/app-shell";
import AuthGate from "@/components/medicare/auth-gate";

export default function Home() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}
