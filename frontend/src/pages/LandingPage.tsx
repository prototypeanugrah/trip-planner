import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SignInButton } from "@clerk/clerk-react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Layers,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";

const featureHighlights = [
  {
    title: "Live trip polls",
    description:
      "Collect ideas, vote on destinations, lodgings, or activities, and let data pick the winner.",
    icon: Layers,
  },
  {
    title: "Smart packing lists",
    description:
      "Crowd-source what to bring, assign owners, and prevent the classic 'we forgot the charger' moment.",
    icon: CheckCircle2,
  },
  {
    title: "Real-time collaboration",
    description:
      "Invite the whole crew with one link and see every update sync across devices instantly.",
    icon: Users,
  },
];

const stats = [
  { label: "Trips planned", value: "1.2K", helper: "+128 this month" },
  { label: "Poll votes cast", value: "42K", helper: "95% participation" },
  { label: "Packing items tracked", value: "310K", helper: "Zero last-minute runs" },
];

const workflowSteps = [
  {
    title: "Create the trip hub",
    description: "Name the adventure, drop your target dates, and lay out a few inspiration ideas.",
    detail:
      "PackVote gives you templates for beaches, city breaks, and remote getaways so you never start from an empty page.",
  },
  {
    title: "Collect votes & ideas",
    description:
      "Share polls for destinations, stays, or experiences. Everyone taps their favorites in seconds.",
    detail:
      "Watch responses roll in with live progress bars. The crew can suggest new options without derailing the plan.",
  },
  {
    title: "Lock the plan & pack",
    description:
      "Finalize the winning path, auto-generate a packing list, and assign must-bring items to teammates.",
    detail:
      "PackVote keeps everyone accountable with gentle reminders so nothing gets left at home.",
  },
];

export function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const highlightedStep = workflowSteps[activeStep];

  return (
    <div className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 blur-[120px] opacity-40 animate-pulse pointer-events-none">
        <div className="absolute top-[-10%] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent-blue/40" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-purple-500/30" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-20 px-4 py-12 sm:px-6 lg:px-8 lg:py-20 animate-fade-in">
        {/* Hero */}
        <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-sm text-text-secondary">
              <Sparkles className="h-4 w-4 text-accent-blue" />
              Collaborative planning, upgraded
            </p>
            <div className="space-y-6">
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Plan unforgettable trips with{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-blue to-indigo-400">
                  instant crew consensus
                </span>
                .
              </h1>
              <p className="text-lg text-text-secondary max-w-2xl">
                PackVote bundles polls, decisions, and collaborative packing lists into a single,
                beautifully organized command center for modern group travel.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <SignInButton mode="modal">
                <Button size="lg" className="shadow-lg shadow-accent-blue/20">
                  Start planning
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </SignInButton>
              <a href="#features">
                <Button
                  size="lg"
                  variant="ghost"
                  className="border border-border px-8 text-text-secondary hover:text-white"
                >
                  Explore features
                </Button>
              </a>
            </div>
          </div>

          <div className="relative rounded-3xl border border-white/5 bg-gradient-to-br from-bg-secondary/70 via-bg-secondary to-bg-tertiary/70 p-6 shadow-2xl">
            <div className="absolute -top-8 -left-6 flex items-center gap-3 rounded-2xl border border-white/5 bg-bg-secondary px-4 py-3 shadow-lg">
              <div className="rounded-full bg-accent-blue/20 p-2">
                <MapPin className="h-5 w-5 text-accent-blue" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-text-secondary">Live vote</p>
                <p className="text-sm font-medium">Mediterranean escape</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm text-text-secondary">
                  <span>Barcelona</span>
                  <span>62%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-accent-blue" style={{ width: "62%" }} />
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm text-text-secondary">
                  <span>Lisbon</span>
                  <span>24%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-indigo-400" style={{ width: "24%" }} />
                </div>
              </div>
              <div className="rounded-2xl bg-white/5 p-4">
                <div className="flex items-center justify-between text-sm text-text-secondary">
                  <span>Nice</span>
                  <span>14%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-pink-400" style={{ width: "14%" }} />
                </div>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-white/10 bg-bg-secondary/70 p-5">
              <div className="flex items-center justify-between text-sm text-text-secondary">
                <span>Shared packing list</span>
                <Calendar className="h-4 w-4 text-text-secondary" />
              </div>
              <div className="mt-4 space-y-3">
                {["Adapters", "Beach gear", "Camera kit"].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5">
                      <CheckCircle2 className="h-4 w-4 text-accent-blue" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item}</p>
                      <p className="text-xs text-text-secondary">Assigned • on track</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="space-y-10">
          <div className="space-y-4 text-center">
            <p className="text-sm uppercase tracking-[0.2em] text-text-secondary font-medium drop-shadow-sm">Why PackVote</p>
            <h2 className="text-3xl font-semibold sm:text-4xl drop-shadow-md">
              Everything you need to go from idea to wheels-up
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto drop-shadow-sm text-lg">
              Designed for remote workers, travel squads, and families who demand clarity without
              losing the fun of planning.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {featureHighlights.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md p-6 text-left transition hover:-translate-y-1 hover:border-accent-blue/40 hover:bg-black/50 shadow-lg"
                >
                  <div className="mb-4 inline-flex rounded-2xl bg-accent-blue/20 p-3 ring-1 ring-white/10">
                    <Icon className="h-5 w-5 text-accent-blue" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                  <p className="mt-3 text-sm text-gray-300 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Workflow */}
        <section className="max-w-4xl mx-auto w-full">
          <div className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.2em] text-text-secondary font-medium">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">A guided workflow your crew will follow</h2>
            <p className="mt-2 text-gray-300 text-lg">
              Hover through each step for deeper context, or click to lock it in.
            </p>

            <div className="mt-8 space-y-4">
              {workflowSteps.map((step, index) => {
                const isActive = activeStep === index;
                return (
                  <button
                    key={step.title}
                    type="button"
                    onMouseEnter={() => setActiveStep(index)}
                    onFocus={() => setActiveStep(index)}
                    onClick={() => setActiveStep(index)}
                    aria-pressed={isActive}
                    className={`w-full rounded-2xl border px-6 py-5 text-left transition-all duration-200 ${
                      isActive
                        ? "border-accent-blue bg-accent-blue/20 shadow-lg scale-[1.02]"
                        : "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${
                        isActive ? "bg-accent-blue text-white" : "bg-white/10 text-gray-400"
                      }`}>
                        Step 0{index + 1}
                      </span>
                      <span className={isActive ? "text-white font-medium" : ""}>{step.title}</span>
                    </div>
                    <p className={`mt-2 text-lg transition-colors ${isActive ? "text-white font-medium" : "text-gray-400"}`}>
                        {step.description}
                    </p>
                    {isActive && (
                        <p className="mt-3 text-sm text-gray-300 animate-fade-in leading-relaxed">
                            {step.detail}
                        </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl p-8 text-center md:p-12 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.2em] text-text-secondary font-medium">Ready to launch?</p>
          <h3 className="mt-4 text-3xl font-semibold text-white">
            Align your crew and get decisions locked in record time.
          </h3>
          <p className="mt-3 text-gray-300 max-w-2xl mx-auto text-lg">
            Create a workspace that keeps ideas, votes, and packing lists in one beautifully designed
            flow.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <SignInButton mode="modal">
              <Button size="lg" className="shadow-lg shadow-accent-blue/20 bg-accent-blue hover:bg-accent-blue-hover text-white border-none">
                Launch PackVote
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </SignInButton>
            <a href="#features">
              <Button
                variant="ghost"
                size="lg"
                className="border border-white/20 px-8 text-white hover:bg-white/10"
              >
                See product tour
              </Button>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
