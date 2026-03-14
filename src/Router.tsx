// App router with placeholder pages / App-Router mit Platzhalter-Seiten
import { Routes, Route, Navigate } from "react-router-dom";
import { ScanPage } from "./components/scan/ScanPage";

function ReceiptsPage() {
  return <div className="text-2xl font-semibold">Bons</div>;
}

function ReceiptDetailPage() {
  return <div className="text-2xl font-semibold">Bon-Details</div>;
}

function SettingsPage() {
  return <div className="text-2xl font-semibold">Einstellungen</div>;
}

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/scan" replace />} />
      <Route path="/scan" element={<ScanPage />} />
      <Route path="/receipts" element={<ReceiptsPage />} />
      <Route path="/receipts/:id" element={<ReceiptDetailPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
