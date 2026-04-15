"use client";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Dumbbell, UtensilsCrossed, ClipboardCheck, MessageCircle } from "lucide-react";

const features = [
  {
    title: "Custom Workout Plans",
    description:
      "Tailored training programs built around your goals, experience level, and schedule. Updated regularly as you progress.",
    icon: Dumbbell,
  },
  {
    title: "Personalized Meal Plans",
    description:
      "Nutrition guidance designed for your body and lifestyle. Macro targets, meal ideas, and adjustments based on your feedback.",
    icon: UtensilsCrossed,
  },
  {
    title: "Weekly Check-ins & Progress Tracking",
    description:
      "Consistent accountability with weekly check-ins. Track your measurements, photos, and performance over time.",
    icon: ClipboardCheck,
  },
  {
    title: "Direct Coach Feedback",
    description:
      "Get real answers from a real coach. Form checks, plan adjustments, and motivation when you need it most.",
    icon: MessageCircle,
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center bg-[#0d1628] px-6 py-32 text-center sm:py-40">
        {/* Subtle gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04)_0%,transparent_70%)]" />

        <div className="relative z-10 mx-auto max-w-3xl">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-zinc-400">
            Online Fitness Coaching
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Protocols By James
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
            Personalized workout programming, nutrition coaching, and
            accountability — all in one place. Stop guessing and start making
            real progress.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full sm:w-auto px-8 text-base"
              )}
            >
              Get Started
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-auto border-zinc-700 bg-transparent px-8 text-base text-zinc-300 hover:bg-zinc-800 hover:text-white"
              )}
            >
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-background px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything you need to reach your goals
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
              A complete coaching experience — not just a PDF plan. Real
              guidance, real results.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="border-0 bg-zinc-50 shadow-none ring-0"
              >
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription className="text-zinc-600 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-[#0d1628] px-6 py-20 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to start?
          </h2>
          <p className="mt-4 text-zinc-400">
            Join now and get your custom plan within 24 hours.
          </p>
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-8 px-8 text-base"
            )}
          >
            Get Started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background px-6 py-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Protocols By James. All rights
        reserved.
      </footer>
    </div>
  );
}
