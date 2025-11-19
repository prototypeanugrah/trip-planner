import { useUser } from "@clerk/clerk-react";
import { LandingPage } from "./LandingPage";
import { Dashboard } from "./Dashboard";

export function Home() {
  const { isSignedIn, user, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="flex items-center justify-center h-64 text-text-secondary">Loading...</div>;
  }

  if (isSignedIn && user) {
    return <Dashboard userEmail={user.primaryEmailAddress?.emailAddress || ""} />;
  }

  return <LandingPage />;
}
