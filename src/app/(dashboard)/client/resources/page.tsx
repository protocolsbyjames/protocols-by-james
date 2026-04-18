import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  FlaskConical,
  Headphones,
  Music,
  ShoppingBag,
  Sparkles,
  TestTube,
} from "lucide-react";

/* ─── Resource data ─── */

interface Resource {
  name: string;
  description: string;
  tag?: string;
  href: string;
}

const SUPPLEMENTS: Resource[] = [
  {
    name: "Reju Peptides",
    description: "Peptide therapy for recovery, anti-aging, and performance.",
    tag: "Recovery",
    href: "#reju",
  },
  {
    name: "Whey Isolate Protein",
    description: "Clean protein powder — low carb, fast-absorbing, great for post-workout shakes.",
    tag: "Protein",
    href: "#protein",
  },
  {
    name: "Pre-Workout",
    description: "Dialed-in energy and focus for your training sessions.",
    tag: "Energy",
    href: "#pre-workout",
  },
  {
    name: "AG1",
    description: "Daily greens and micronutrient support. Covers your nutritional bases.",
    tag: "Greens",
    href: "#ag1",
  },
  {
    name: "LMNT",
    description: "Electrolyte mix with sodium, potassium, and magnesium. No sugar, no junk.",
    tag: "Hydration",
    href: "#lmnt",
  },
];

const FOOD_ITEMS: Resource[] = [
  {
    name: "Cream of Rice",
    description: "Easy-digesting carb source. Perfect pre-workout or breakfast base.",
    href: "#cream-of-rice",
  },
  {
    name: "Flavored Creamy Rice",
    description: "Same benefits as cream of rice with built-in flavor. Makes meal prep easier.",
    href: "#flavored-creamy-rice",
  },
];

const PLAYLISTS: Resource[] = [
  {
    name: "Push Day Playlist",
    description: "High energy for chest, shoulders, and triceps sessions.",
    href: "#playlist-push",
  },
  {
    name: "Pull Day Playlist",
    description: "Back and biceps — heavy lifts, heavy bass.",
    href: "#playlist-pull",
  },
  {
    name: "Leg Day Playlist",
    description: "You need this. Trust me.",
    href: "#playlist-legs",
  },
];

const BOOKS: Resource[] = [
  {
    name: "Book Recommendation 1",
    description: "Mindset, discipline, and building the person who builds the body.",
    href: "#book-1",
  },
  {
    name: "Book Recommendation 2",
    description: "Nutrition science made practical. No bro-science.",
    href: "#book-2",
  },
];

const BLOOD_TESTS: Resource[] = [
  {
    name: "Rythms Blood Test",
    description:
      "At-home blood testing to track hormones, metabolic markers, and health biomarkers. Know your numbers so you can optimize your training and nutrition.",
    tag: "Health",
    href: "#rythms",
  },
];

/* ─── Components ─── */

function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <a
      href={resource.href}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
    >
      <div className="flex items-start gap-4 rounded-lg border border-border bg-background p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-foreground group-hover:underline">
              {resource.name}
            </p>
            {resource.tag && (
              <Badge variant="secondary" className="text-[10px]">
                {resource.tag}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {resource.description}
          </p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0 group-hover:text-foreground transition-colors" />
      </div>
    </a>
  );
}

function ResourceSection({
  title,
  description,
  icon,
  resources,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  resources: Resource[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <div className="space-y-3">
        {resources.map((r) => (
          <ResourceCard key={r.name} resource={r} />
        ))}
      </div>
    </div>
  );
}

/* ─── Page ─── */

export default async function ClientResourcesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Resources
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything I personally use and recommend. These are the exact products,
          playlists, and tools that support my clients and my own training.
        </p>
      </div>

      {/* Disclaimer */}
      <Card className="mb-8 border-amber-200 bg-amber-50/30">
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">
            Some links below are affiliate links. If you purchase through them, I
            may earn a small commission at no extra cost to you. I only recommend
            products I personally use and trust.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-10">
        {/* Supplements */}
        <ResourceSection
          title="Supplements"
          description="The supplements I use and recommend to every client."
          icon={<FlaskConical className="h-5 w-5 text-emerald-600" />}
          resources={SUPPLEMENTS}
        />

        <Separator />

        {/* Food Items */}
        <ResourceSection
          title="Food Products"
          description="Staples that make meal prep easier and macros easier to hit."
          icon={<ShoppingBag className="h-5 w-5 text-amber-600" />}
          resources={FOOD_ITEMS}
        />

        <Separator />

        {/* Blood Tests */}
        <ResourceSection
          title="Health Testing"
          description="Data-driven health optimization. Know your numbers."
          icon={<TestTube className="h-5 w-5 text-rose-500" />}
          resources={BLOOD_TESTS}
        />

        <Separator />

        {/* Playlists */}
        <ResourceSection
          title="Workout Playlists"
          description="What I train to. Curated on Spotify."
          icon={<Music className="h-5 w-5 text-green-500" />}
          resources={PLAYLISTS}
        />

        <Separator />

        {/* Books */}
        <ResourceSection
          title="Books & Audiobooks"
          description="Reads that shaped how I train and coach."
          icon={<Headphones className="h-5 w-5 text-purple-500" />}
          resources={BOOKS}
        />
      </div>

      {/* Bottom CTA */}
      <Card className="mt-10 mb-8">
        <CardContent className="py-6 text-center">
          <Sparkles className="h-6 w-6 mx-auto mb-2 text-foreground" />
          <p className="text-sm font-medium text-foreground">
            Have a product you want me to review?
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Send me a DM on Instagram — I try everything before recommending it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
