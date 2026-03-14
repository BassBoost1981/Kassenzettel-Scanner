// Price history chart for a selected product across stores
// Preisverlauf-Chart fuer ein ausgewaehltes Produkt ueber verschiedene Maerkte

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PricePoint {
  date: string;
  store_name: string;
  price: number;
  quantity: number;
}

interface ChartDataPoint {
  date: string;
  [storeName: string]: string | number | undefined;
}

// Colors for different stores / Farben fuer verschiedene Maerkte
const STORE_COLORS = [
  "#00FFFF", // Cyan
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#F97316", // Orange
];

export default function PriceChart() {
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [priceData, setPriceData] = useState<PricePoint[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [stores, setStores] = useState<string[]>([]);

  // Search for products by name / Produkte nach Name suchen
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setProducts([]);
      return;
    }
    try {
      const results = await invoke<string[]>("search_product_names", { query });
      setProducts(results);
    } catch {
      setProducts([]);
    }
  }, []);

  // Load price history for a product / Preisverlauf fuer ein Produkt laden
  const loadPriceHistory = useCallback(async (productName: string) => {
    try {
      const data = await invoke<PricePoint[]>("get_price_history", {
        productName,
      });
      setPriceData(data);

      // Transform data for Recharts / Daten fuer Recharts transformieren
      const storeSet = new Set<string>();
      data.forEach((p) => storeSet.add(p.store_name));
      const storeList = Array.from(storeSet);
      setStores(storeList);

      // Group by date / Nach Datum gruppieren
      const dateMap = new Map<string, ChartDataPoint>();
      data.forEach((p) => {
        if (!dateMap.has(p.date)) {
          dateMap.set(p.date, { date: p.date });
        }
        const point = dateMap.get(p.date)!;
        point[p.store_name] = p.price;
      });

      const sorted = Array.from(dateMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      setChartData(sorted);
    } catch {
      setPriceData([]);
      setChartData([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchProducts(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchProducts]);

  useEffect(() => {
    if (selectedProduct) {
      loadPriceHistory(selectedProduct);
    }
  }, [selectedProduct, loadPriceHistory]);

  // Calculate stats / Statistiken berechnen
  const avgPrice =
    priceData.length > 0
      ? priceData.reduce((sum, p) => sum + p.price, 0) / priceData.length
      : 0;
  const minPrice =
    priceData.length > 0 ? Math.min(...priceData.map((p) => p.price)) : 0;
  const maxPrice =
    priceData.length > 0 ? Math.max(...priceData.map((p) => p.price)) : 0;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()}.${d.getMonth() + 1}.`;
  };

  const formatPrice = (value: number) => `${value.toFixed(2)} €`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Preisverlauf</h1>

      {/* Search / Suche */}
      <div className="relative">
        <Input
          placeholder="Produkt suchen (z.B. Vollmilch, Butter, Bananen...)"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.length < 2) setSelectedProduct(null);
          }}
          className="text-lg"
        />
        {/* Autocomplete dropdown / Autocomplete-Dropdown */}
        {products.length > 0 && !selectedProduct && (
          <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
            {products.map((name) => (
              <button
                key={name}
                className="w-full text-left px-4 py-2 hover:bg-muted transition-colors"
                onClick={() => {
                  setSelectedProduct(name);
                  setSearchQuery(name);
                  setProducts([]);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      {selectedProduct && chartData.length > 0 && (
        <>
          {/* Stats cards / Statistik-Karten */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Durchschnitt</div>
                <div className="text-2xl font-bold text-primary">
                  {formatPrice(avgPrice)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Günstigster</div>
                <div className="text-2xl font-bold text-green-500">
                  {formatPrice(minPrice)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Teuerster</div>
                <div className="text-2xl font-bold text-red-500">
                  {formatPrice(maxPrice)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Line chart / Liniendiagramm */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {selectedProduct}
                <Badge variant="secondary">{priceData.length} Datenpunkte</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v.toFixed(2)}€`}
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      color: "var(--foreground)",
                    }}
                    formatter={(value: number) => [formatPrice(value), ""]}
                    labelFormatter={formatDate}
                  />
                  <Legend />
                  {stores.map((store, i) => (
                    <Line
                      key={store}
                      type="monotone"
                      dataKey={store}
                      stroke={STORE_COLORS[i % STORE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state */}
      {!selectedProduct && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <svg className="size-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <p className="text-lg">Suche ein Produkt um den Preisverlauf zu sehen</p>
            <p className="text-sm mt-1">z.B. "Vollmilch", "Butter" oder "Bananen"</p>
          </CardContent>
        </Card>
      )}

      {selectedProduct && chartData.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-lg">Keine Preisdaten für "{selectedProduct}" gefunden</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
