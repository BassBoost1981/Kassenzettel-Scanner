// App router / App-Router
import { Routes, Route, Navigate } from "react-router-dom";
import { ScanPage } from "./components/scan/ScanPage";
import { ReceiptList } from "./components/receipts/ReceiptList";
import { ReceiptDetail } from "./components/receipts/ReceiptDetail";
import { SettingsPage } from "./components/settings/SettingsPage";

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/scan" replace />} />
      <Route path="/scan" element={<ScanPage />} />
      <Route path="/receipts" element={<ReceiptList />} />
      <Route path="/receipts/:id" element={<ReceiptDetail />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
