// Receipt list page / Kassenzettel-Listenansicht
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useReceipts } from "@/hooks/useReceipts";
import { useStores } from "@/hooks/useStores";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { ReceiptTextIcon, Trash2Icon, SearchIcon, XIcon, DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { save } from "@tauri-apps/plugin-dialog";
import { exportReceiptsCsv } from "@/lib/tauri-commands";

export function ReceiptList() {
  const navigate = useNavigate();
  const { receipts, loading, setFilter, filter, search, fetchReceipts, removeReceipt } = useReceipts();
  const { stores } = useStores();

  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(filter.date_from ?? "");
  const [dateTo, setDateTo] = useState(filter.date_to ?? "");
  const [storeFilter, setStoreFilter] = useState<number | undefined>(filter.store_id);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Sort receipts by date DESC / Nach Datum absteigend sortieren
  const sortedReceipts = useMemo(() => {
    return [...receipts].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [receipts]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      search(searchQuery.trim());
    } else {
      applyFilters();
    }
  };

  const applyFilters = () => {
    setFilter({
      store_id: storeFilter,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setStoreFilter(undefined);
    setFilter({});
  };

  const handleStoreChange = (value: string) => {
    const id = value === "__all__" ? undefined : Number(value);
    setStoreFilter(id);
    setFilter({
      ...filter,
      store_id: id,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
  };

  const handleDateChange = (type: "from" | "to", value: string) => {
    if (type === "from") setDateFrom(value);
    else setDateTo(value);
    setFilter({
      ...filter,
      store_id: storeFilter,
      date_from: type === "from" ? value || undefined : dateFrom || undefined,
      date_to: type === "to" ? value || undefined : dateTo || undefined,
    });
  };

  const confirmDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteId(id);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId !== null) {
      try {
        await removeReceipt(deleteId);
        toast.success("Kassenzettel gelöscht");
      } catch (err) {
        toast.error(`Fehler: ${err}`);
      }
      setDeleteOpen(false);
      setDeleteId(null);
    }
  };

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      const filePath = await save({
        defaultPath: "kassenzettel.csv",
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!filePath) return; // User cancelled / Benutzer hat abgebrochen
      await exportReceiptsCsv(filePath, {
        store_id: storeFilter,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      toast.success("CSV exportiert");
    } catch (err) {
      toast.error(`Fehler: ${err}`);
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = searchQuery || dateFrom || dateTo || storeFilter;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Kassenzettel</h1>

      {/* Filter bar / Filterleiste */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground mb-1 block">Suche</label>
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Artikel suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-8"
            />
          </div>
        </div>

        <div className="min-w-[150px]">
          <label className="text-xs text-muted-foreground mb-1 block">Markt</label>
          <Select value={storeFilter?.toString() ?? "__all__"} onValueChange={handleStoreChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Alle Märkte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Märkte</SelectItem>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Von</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateChange("from", e.target.value)}
            className="w-[150px]"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Bis</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => handleDateChange("to", e.target.value)}
            className="w-[150px]"
          />
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <XIcon className="size-4 mr-1" />
            Filter zurücksetzen
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting || (sortedReceipts.length === 0 && !loading)}
        >
          <DownloadIcon className="size-4 mr-1" />
          {exporting ? "Exportiert..." : "Als CSV exportieren"}
        </Button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12 text-muted-foreground">
          Lade Kassenzettel...
        </div>
      )}

      {/* Empty state / Leerer Zustand */}
      {!loading && sortedReceipts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <ReceiptTextIcon className="size-16 text-muted-foreground/50" />
          <div>
            <h2 className="text-lg font-medium">Noch keine Kassenzettel</h2>
            <p className="text-muted-foreground mt-1">
              Scanne deinen ersten Bon!
            </p>
          </div>
          <Button onClick={() => navigate("/scan")}>Zum Scanner</Button>
        </div>
      )}

      {/* Receipt table / Kassenzettel-Tabelle */}
      {!loading && sortedReceipts.length > 0 && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Markt</TableHead>
                <TableHead className="text-right">Gesamtbetrag</TableHead>
                <TableHead className="text-center">Artikel</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedReceipts.map((receipt) => (
                <TableRow
                  key={receipt.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/receipts/${receipt.id}`)}
                >
                  <TableCell>{formatDate(receipt.date)}</TableCell>
                  <TableCell>{receipt.store_name ?? "Unbekannt"}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(receipt.total_amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    {/* Item count not available in list view */}
                    —
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => confirmDelete(receipt.id, e)}
                    >
                      <Trash2Icon className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete confirmation dialog / Lösch-Bestätigungsdialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kassenzettel löschen?</DialogTitle>
            <DialogDescription>
              Dieser Kassenzettel wird unwiderruflich gelöscht. Diese Aktion kann
              nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Abbrechen
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
