// App router / App-Router
import { Routes, Route, Navigate } from "react-router-dom";
import { ScanPage } from "./components/scan/ScanPage";
import { ReceiptList } from "./components/receipts/ReceiptList";
import { ReceiptDetail } from "./components/receipts/ReceiptDetail";
import { SettingsPage } from "./components/settings/SettingsPage";
import PriceChart from "./components/charts/PriceChart";
import Dashboard from "./components/charts/Dashboard";

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/scan" replace />} />
      <Route path="/scan" element={<ScanPage />} />
      <Route path="/receipts" element={<ReceiptList />} />
      <Route path="/receipts/:id" element={<ReceiptDetail />} />
      <Route path="/prices" element={<PriceChart />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
