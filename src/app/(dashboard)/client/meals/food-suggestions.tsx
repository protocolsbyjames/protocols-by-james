import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeftRight,
  Beef,
  Cherry,
  Droplets,
  Flame,
  Leaf,
  Nut,
  Salad,
  Wheat,
  Zap,
} from "lucide-react";

interface FoodSuggestionsProps {
  isShred: boolean;
  weightLbs: number | null;
}

/* ─── Approved foods data ─── */

interface FoodItem {
  name: string;
  detail: string;
}

const PROTEINS: FoodItem[] = [
  { name: "Chicken breast", detail: "6oz — 38g protein, 3g fat" },
  { name: "98/2 lean ground turkey", detail: "6oz — 34g protein, 4g fat" },
  { name: "93/7 lean ground beef", detail: "6oz — 34g protein, 14g fat" },
  { name: "Cage-free eggs", detail: "3 large — 18g protein, 15g fat" },
  { name: "Egg whites", detail: "1 cup — 26g protein, 0g fat" },
  { name: "Tilapia", detail: "6oz — 34g protein, 2g fat" },
  { name: "Whey isolate protein", detail: "1 scoop — 24g protein, 1g fat" },
  { name: "Ground chicken (lean)", detail: "6oz — 32g protein, 6g fat" },
  { name: "Top sirloin steak", detail: "6oz — 36g protein, 10g fat" },
  { name: "Shrimp", detail: "6oz — 36g protein, 2g fat" },
  { name: "Nonfat Greek yogurt", detail: "1 cup — 20g protein, 0g fat" },
  { name: "Low-fat cottage cheese", detail: "1 cup — 28g protein, 2g fat" },
];

const CARBS: FoodItem[] = [
  { name: "Cream of rice", detail: "1/3 cup dry — 38g carbs" },
  { name: "Rice cakes (caramel or plain)", detail: "2 cakes — 14g carbs" },
  { name: "White jasmine rice", detail: "1 cup cooked — 45g carbs" },
  { name: "Brown rice", detail: "1 cup cooked — 45g carbs" },
  { name: "Basmati rice", detail: "1 cup cooked — 45g carbs" },
  { name: "Sweet potatoes", detail: "1 medium — 26g carbs" },
  { name: "Oats", detail: "1/2 cup dry — 27g carbs" },
  { name: "Quinoa", detail: "1 cup cooked — 39g carbs" },
  { name: "Whole grain bread", detail: "2 slices — 24g carbs" },
  { name: "Low-carb tortillas", detail: "1 tortilla — 15g carbs" },
  { name: "Rice noodles", detail: "1 cup cooked — 44g carbs" },
  { name: "Bagels", detail: "Higher carb days / size phase" },
];

const VEGGIES: FoodItem[] = [
  { name: "Broccoli", detail: "1 cup — 55 cal, high fiber + vitamin C" },
  { name: "Kale", detail: "2 cups — 14 cal, micronutrient-dense" },
  { name: "Spinach", detail: "2 cups — 14 cal, iron + magnesium" },
  { name: "Asparagus", detail: "1 cup — 27 cal, anti-inflammatory" },
  { name: "Zucchini", detail: "1 cup — 20 cal, great volume food" },
  { name: "Bell peppers", detail: "1 cup — 30 cal, vitamin C" },
  { name: "Green beans", detail: "1 cup — 31 cal, fiber-rich" },
  { name: "Mixed salad greens", detail: "2 cups — 10 cal, easy base" },
];

const FATS: FoodItem[] = [
  { name: "Avocado", detail: "1/2 medium — 12g fat" },
  { name: "Avocado oil", detail: "1 tbsp — 14g fat" },
  { name: "Almond butter", detail: "2 tbsp — 18g fat, 7g protein" },
  { name: "Cashews", detail: "1oz — 13g fat, 5g protein" },
  { name: "Almonds", detail: "1oz — 14g fat, 6g protein" },
  { name: "Olive oil", detail: "1 tbsp — 14g fat" },
  { name: "Natural peanut butter", detail: "2 tbsp — 16g fat, 8g protein" },
  { name: "Walnuts", detail: "1oz — 18g fat, 4g protein" },
];

const FRUITS: FoodItem[] = [
  { name: "Blueberries", detail: "1 cup — 21g carbs, antioxidants" },
  { name: "Raspberries", detail: "1 cup — 15g carbs, high fiber" },
  { name: "Bananas", detail: "1 medium — 27g carbs, great pre-workout" },
];

const EXTRAS: FoodItem[] = [
  { name: "0-calorie hot sauces", detail: "Unlimited use" },
  { name: "Diet sodas", detail: "Help control cravings" },
  { name: "Pickles", detail: "Low-calorie snack option" },
  { name: "Cinnamon", detail: "Add to oats, shakes, yogurt" },
  { name: "Truvia", detail: "Zero-calorie sweetener" },
  { name: "Pink Himalayan salt", detail: "Mineral-rich seasoning" },
];

/* ─── Smart swaps data ─── */

interface SwapGroup {
  category: string;
  items: string[];
}

const SWAPS: SwapGroup[] = [
  { category: "Carbs", items: ["Rice", "Sweet potatoes", "Oats", "Cream of rice", "Quinoa"] },
  { category: "Proteins", items: ["Chicken", "Turkey", "Lean beef", "Shrimp", "Tilapia"] },
  { category: "Fats", items: ["Almond butter", "Avocado", "Nuts", "Peanut butter"] },
];

/* ─── Meal timing suggestions ─── */

interface TimingBlock {
  timing: string;
  label: string;
  description: string;
  sizeExample: string;
  shredExample: string;
}

const TIMING: TimingBlock[] = [
  {
    timing: "breakfast",
    label: "Breakfast",
    description: "Break the overnight fast with protein + carbs to fuel your day.",
    sizeExample: "4 whole eggs, 2 slices toast, banana",
    shredExample: "Egg whites + 1 whole egg, spinach, 1 slice toast, berries",
  },
  {
    timing: "pre-workout",
    label: "Pre-Workout (1\u20132 hrs before)",
    description: "Protein + fast-digesting carbs. Keep fat low so it digests quickly.",
    sizeExample: "Protein shake, 1 cup oats, banana, almond butter",
    shredExample: "Protein shake, 1/2 cup cream of rice, banana",
  },
  {
    timing: "post-workout",
    label: "Post-Workout (within 1 hr)",
    description: "Your biggest meal window. Protein + carbs to refuel and recover.",
    sizeExample: "8oz chicken, 1.5 cups jasmine rice, veggies, avocado",
    shredExample: "6oz chicken breast, 1 cup rice, big salad",
  },
  {
    timing: "dinner",
    label: "Dinner",
    description: "Lean protein + vegetables. Moderate carbs depending on your goals.",
    sizeExample: "8oz sirloin, sweet potato, roasted veggies, olive oil drizzle",
    shredExample: "6oz tilapia, roasted zucchini + broccoli, small sweet potato",
  },
  {
    timing: "snacks",
    label: "Snacks (as needed)",
    description: "Keep these protein-forward. Use for hitting daily targets.",
    sizeExample: "Greek yogurt + granola, or rice cakes + almond butter",
    shredExample: "Greek yogurt + berries, or rice cakes + turkey slices",
  },
];

/* ─── Helpers ─── */

function ApprovedFoodList({
  items,
  title,
  icon,
}: {
  items: FoodItem[];
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.name}
              className="flex items-baseline justify-between text-sm"
            >
              <span className="font-medium text-foreground">{item.name}</span>
              <span className="text-xs text-muted-foreground ml-2 text-right">
                {item.detail}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main component ─── */

export function FoodSuggestions({
  isShred,
  weightLbs,
}: FoodSuggestionsProps) {
  const proteinTarget = weightLbs ?? null;
  const calorieTarget = weightLbs
    ? isShred
      ? Math.round(weightLbs * 12)
      : Math.round(weightLbs * 16)
    : null;
  const fatTarget = weightLbs
    ? isShred
      ? Math.round(weightLbs * 0.3)
      : Math.round(weightLbs * 0.35)
    : null;
  const carbTarget =
    calorieTarget && proteinTarget && fatTarget
      ? Math.round((calorieTarget - proteinTarget * 4 - fatTarget * 9) / 4)
      : null;

  return (
    <div className="space-y-6">
      {/* Personalized macro targets */}
      {weightLbs && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Flame className="h-3 w-3" /> Calories
              </CardDescription>
              <CardTitle className="text-xl">
                {calorieTarget?.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-muted-foreground">
                {isShred ? "Deficit \u2014 adjust weekly" : "Surplus \u2014 adjust weekly"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Beef className="h-3 w-3" /> Protein
              </CardDescription>
              <CardTitle className="text-xl">{proteinTarget}g</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-muted-foreground">1g per lb bodyweight</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Fats</CardDescription>
              <CardTitle className="text-xl">{fatTarget}g</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-muted-foreground">
                {isShred ? "0.3g per lb" : "0.35g per lb"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Carbs</CardDescription>
              <CardTitle className="text-xl">{carbTarget}g</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-muted-foreground">Fills remaining cals</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <Droplets className="h-3 w-3" /> Water
              </CardDescription>
              <CardTitle className="text-xl">1 gallon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-[10px] text-muted-foreground">Every day. Carry a jug.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* How meal plans are built */}
      <Card className="border-emerald-200 bg-emerald-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How Your Nutrition Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
          <p>
            Your calories are set based on your goal ({isShred ? "Shred" : "Size"}),
            your protein target is locked at 1g per lb of bodyweight, fats are set
            at {isShred ? "0.3g" : "0.35g"} per lb, and carbs fill the remaining
            calories. All meals are built using the approved foods below.
          </p>
        </CardContent>
      </Card>

      {/* Approved food lists */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Approved Foods
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Build every meal from this list. Stick to these and you won&apos;t go wrong.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ApprovedFoodList
          items={PROTEINS}
          title="Proteins"
          icon={<Beef className="h-4 w-4 text-blue-600" />}
        />
        <ApprovedFoodList
          items={CARBS}
          title="Carbs"
          icon={<Wheat className="h-4 w-4 text-amber-600" />}
        />
        <ApprovedFoodList
          items={VEGGIES}
          title="Vegetables"
          icon={<Salad className="h-4 w-4 text-emerald-600" />}
        />
        <ApprovedFoodList
          items={FATS}
          title="Fats"
          icon={<Nut className="h-4 w-4 text-yellow-700" />}
        />
        <ApprovedFoodList
          items={FRUITS}
          title="Fruits"
          icon={<Cherry className="h-4 w-4 text-rose-500" />}
        />
        <ApprovedFoodList
          items={EXTRAS}
          title="Extras (Low / Zero Calorie)"
          icon={<Zap className="h-4 w-4 text-purple-500" />}
        />
      </div>

      <Separator />

      {/* Smart Swaps */}
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-1">
          <ArrowLeftRight className="h-5 w-5" />
          Smart Swaps
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Swap foods within the same category. Same macros = same results.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {SWAPS.map((group) => (
          <Card key={group.category}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{group.category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item, i) => (
                  <span key={item} className="text-xs">
                    <span className="font-medium text-foreground">{item}</span>
                    {i < group.items.length - 1 && (
                      <span className="text-muted-foreground mx-1">&harr;</span>
                    )}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Meal Builder Method */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Meal Builder Method
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Build each meal using these ranges for flexibility while staying on plan.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <CardContent className="pt-5 pb-4">
            <p className="text-2xl font-bold text-blue-600">25\u201350g</p>
            <p className="text-xs text-muted-foreground mt-1">Protein per meal</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-5 pb-4">
            <p className="text-2xl font-bold text-amber-600">30\u201380g</p>
            <p className="text-xs text-muted-foreground mt-1">Carbs per meal</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-5 pb-4">
            <p className="text-2xl font-bold text-rose-600">10\u201320g</p>
            <p className="text-xs text-muted-foreground mt-1">Fats per meal</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Meal timing */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Meal Timing Guide
        </h2>
        <p className="mt-1 text-sm text-muted-foreground mb-4">
          When to eat what for best results.
        </p>
      </div>

      <div className="space-y-4">
        {TIMING.map((block) => (
          <Card key={block.timing}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{block.label}</CardTitle>
              <CardDescription>{block.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  {isShred ? "Shred example" : "Size example"}
                </p>
                <p className="text-sm text-foreground">
                  {isShred ? block.shredExample : block.sizeExample}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Adherence Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adherence Rules</CardTitle>
          <CardDescription>This is what actually gets results.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-2">
          <p>
            <span className="font-medium text-foreground">Diet sodas are fine.</span>{" "}
            They help control cravings without impacting results.
          </p>
          <p>
            <span className="font-medium text-foreground">Pickles = free snack.</span>{" "}
            Low-calorie, satisfying, unlimited.
          </p>
          <p>
            <span className="font-medium text-foreground">Hot sauce = unlimited.</span>{" "}
            Zero-calorie sauces make everything better.
          </p>
          <p>
            <span className="font-medium text-foreground">Keep meals consistent.</span>{" "}
            Eat similar foods during the week. Rotate when you need variety to avoid burnout.
          </p>
          <p>
            <span className="font-medium text-foreground">Rest days:</span>{" "}
            Slightly reduce carbs (eat less overall). Keep protein the same.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
