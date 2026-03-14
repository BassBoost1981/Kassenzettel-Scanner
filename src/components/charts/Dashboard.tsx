// Dashboard with monthly spending per store + category breakdown
// Dashboard mit Monatsausgaben pro Markt + Kategorie-Aufschlüsselung

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MonthlySpending {
  month: string;
  month_label: string;
  store_name: string;
  total: number;
  receipt_count: number;
}

interface CategorySpending {
  category: string;
  total: number;
}

interface BarDataPoint {
  month_label: string;
  [storeName: string]: string | number;
}

const STORE_COLORS = [
  "#00FFFF", "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#F97316", "#06B6D4", "#84CC16",
];

const CATEGORY_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#F97316", "#06B6D4",
];

const formatEur = (v: number) => `${v.toFixed(2)} €`;

export default function Dashboard() {
  const [monthlyData, setMonthlyData] = useState<MonthlySpending[]>([]);
  const [categoryData, setCategoryData] = useState<CategorySpending[]>([]);
  const [barData, setBarData] = useState<BarDataPoint[]>([]);
  const [storeNames, setStoreNames] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [monthly, categories] = await Promise.all([
        invoke<MonthlySpending[]>("get_monthly_spending"),
        invoke<CategorySpending[]>("get_category_spending", { months: 6 }),
      ]);
      setMonthlyData(monthly);
      setCategoryData(categories);

      // Transform for stacked bar chart / Fuer gestapeltes Balkendiagramm transformieren
      const stores = new Set<string>();
      monthly.forEach((m) => stores.add(m.store_name));
      const storeList = Array.from(stores);
      setStoreNames(storeList);

      const monthMap = new Map<string, BarDataPoint>();
      monthly.forEach((m) => {
        if (!monthMap.has(m.month)) {
          monthMap.set(m.month, { month_label: m.month_label });
        }
        const point = monthMap.get(m.month)!;
        point[m.store_name] = Math.round(m.total * 100) / 100;
      });

      setBarData(Array.from(monthMap.values()));
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
    }
  };

  // Calculate totals / Gesamtsummen berechnen
  const totalSpending = monthlyData.reduce((sum, m) => sum + m.total, 0);
  const totalReceipts = monthlyData.reduce((sum, m) => sum + m.receipt_count, 0);
  const avgPerMonth = barData.length > 0 ? totalSpending / barData.length : 0;

  // Find store with most spending / Markt mit den meisten Ausgaben finden
  const storeSpending = new Map<string, number>();
  monthlyData.forEach((m) => {
    storeSpending.set(m.store_name, (storeSpending.get(m.store_name) || 0) + m.total);
  });
  const topStore = Array.from(storeSpending.entries()).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Summary cards / Zusammenfassungs-Karten */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Gesamtausgaben</div>
            <div className="text-2xl font-bold text-primary">{formatEur(totalSpending)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Kassenzettel</div>
            <div className="text-2xl font-bold">{totalReceipts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Ø pro Monat</div>
            <div className="text-2xl font-bold">{formatEur(avgPerMonth)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Top Markt</div>
            <div className="text-2xl font-bold">{topStore ? topStore[0] : "–"}</div>
            {topStore && <div className="text-sm text-muted-foreground">{formatEur(topStore[1])}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Monthly spending bar chart / Monatsausgaben Balkendiagramm */}
      <Card>
        <CardHeader>
          <CardTitle>Monatliche Ausgaben pro Markt</CardTitle>
        </CardHeader>
        <CardContent>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month_label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis tickFormatter={(v) => `${v}€`} stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--foreground)",
                  }}
                  formatter={(value: number) => [formatEur(value), ""]}
                />
                <Legend />
                {storeNames.map((store, i) => (
                  <Bar
                    key={store}
                    dataKey={store}
                    stackId="a"
                    fill={STORE_COLORS[i % STORE_COLORS.length]}
                    radius={i === storeNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              Keine Daten vorhanden
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category pie chart / Kategorie-Kreisdiagramm */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ausgaben nach Kategorie (6 Monate)</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ category, percent }) =>
                      `${category} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine
                    fontSize={11}
                  >
                    {categoryData.map((_entry, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatEur(value), ""]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                Keine Daten vorhanden
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top spending by store table / Top-Ausgaben nach Markt */}
        <Card>
          <CardHeader>
            <CardTitle>Ausgaben pro Markt (Gesamt)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from(storeSpending.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([store, total], i) => (
                  <div key={store} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-3 rounded-full"
                        style={{ backgroundColor: STORE_COLORS[i % STORE_COLORS.length] }}
                      />
                      <span>{store}</span>
                    </div>
                    <span className="font-semibold">{formatEur(total)}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
