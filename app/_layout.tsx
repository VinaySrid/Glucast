import { Slot, useRouter } from "expo-router";
import { UserProvider, useUser } from "./context/UserContext";
import { useEffect, useState } from "react";

export default function Layout() {
  return (
    <UserProvider>
      <AuthWrapper />
      <Slot />
    </UserProvider>
  );
}

function AuthWrapper() {
  const { user } = useUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!user) {
      router.replace("/(auth)/login");
    } else {
      router.replace("/(tabs)");
    }
  }, [user, mounted]);

  return null;
}