"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/constants";
import { startCheckout } from "./billing-actions";

export function PlanSelector() {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant={cycle === "monthly" ? "default" : "outline"} size="sm" onClick={() => setCycle("monthly")}>
          Mensuel
        </Button>
        <Button variant={cycle === "annual" ? "default" : "outline"} size="sm" onClick={() => setCycle("annual")}>
          Annuel <span className="ml-1 text-xs opacity-70">-15%</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <Card key={plan.value}>
            <CardHeader>
              <CardTitle>{plan.label}</CardTitle>
              <p className="text-2xl font-bold">
                {cycle === "monthly" ? `${plan.monthly_price}€/mois` : `${plan.annual_price}€/an`}
              </p>
              {cycle === "annual" && (
                <p className="text-xs text-muted-foreground">≈ {Math.round(plan.annual_price / 12)} €/mois</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="text-sm space-y-1">
                {plan.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <Button
                className="w-full"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await startCheckout(plan.value, cycle);
                  })
                }
              >
                {pending ? "..." : plan.cta}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
