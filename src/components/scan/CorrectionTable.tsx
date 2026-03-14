// Correction table for reviewed receipt data / Korrektur-Tabelle fuer ueberprueften Kassenzettel
import { useState, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  X,
  Plus,
  Save,
  Trash2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useReceipts } from "@/hooks/useReceipts";
import { useStores } from "@/hooks/useStores";
import type { AnalysisResult, AnalyzedItem, NewReceipt, NewReceiptItem } from "@/types/receipt";
import { cn } from "@/lib/utils";

interface CorrectionTableProps {
  imagePath: string;
  result: AnalysisResult;
  onSave: () => void;
  onDiscard: () => void;
}

// Default categories / Standard-Kategorien
const CATEGORIES = [
  "Lebensmittel",
  "Getraenke",
  "Haushalt",
  "Hygiene",
  "Tierbedarf",
  "Sonstiges",
];

interface EditableItem extends AnalyzedItem {
  _id: number;
}

export function CorrectionTable({
  imagePath,
  result,
  onSave,
  onDiscard,
}: CorrectionTableProps) {
  const { addReceipt } = useReceipts();
  const { stores, addStore } = useStores();

  // Editable state initialized from AnalysisResult / Bearbeitbarer Zustand aus AnalysisResult
  const [storeName, setStoreName] = useState(result.markt ?? "");
  const [date, setDate] = useState(result.datum ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(result.uhrzeit ?? "");
  const [paymentMethod, setPaymentMethod] = useState(result.zahlungsart ?? "");
  const [items, setItems] = useState<EditableItem[]>(
    result.artikel.map((item, i) => ({ ...item, _id: i }))
  );
  const [nextId, setNextId] = useState(result.artikel.length);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    col: string;
  } | null>(null);

  const imageSrc = convertFileSrc(imagePath);

  // Calculate totals / Summen berechnen
  const subtotal = items.reduce((sum, item) => sum + item.gesamtpreis, 0);
  const discountTotal = items.reduce((sum, item) => sum + item.rabatt, 0);
  const depositTotal = items.reduce((sum, item) => sum + item.pfand, 0);
  const grandTotal = result.gesamtbetrag ?? subtotal - discountTotal + depositTotal;

  // Update item field / Artikelfeld aktualisieren
  const updateItem = useCallback(
    (id: number, field: keyof AnalyzedItem, value: string | number) => {
      setItems((prev) =>
        prev.map((item) =>
          item._id === id ? { ...item, [field]: value } : item
        )
      );
    },
    []
  );

  // Delete item / Artikel loeschen
  const deleteItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item._id !== id));
  }, []);

  // Add new item / Neuen Artikel hinzufuegen
  const addItem = useCallback(() => {
    const newItem: EditableItem = {
      _id: nextId,
      name: "",
      menge: 1,
      einzelpreis: 0,
      gesamtpreis: 0,
      rabatt: 0,
      pfand: 0,
      kategorie: null,
      confidence: 1,
    };
    setItems((prev) => [...prev, newItem]);
    setNextId((prev) => prev + 1);
  }, [nextId]);

  // Handle save / Speichern
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      // Find or create store / Markt finden oder erstellen
      let storeId: number;
      const existingStore = stores.find(
        (s) => s.name.toLowerCase() === storeName.toLowerCase()
      );

      if (existingStore) {
        storeId = existingStore.id;
      } else {
        const newStore = await addStore(storeName || "Unbekannt");
        storeId = newStore.id;
      }

      // Build receipt items / Kassenzettel-Positionen erstellen
      const receiptItems: NewReceiptItem[] = items.map((item) => ({
        raw_name: item.name,
        quantity: item.menge,
        unit_price: item.einzelpreis,
        total_price: item.gesamtpreis,
        discount: item.rabatt,
        deposit: item.pfand,
        category_id: null, // Category lookup handled by backend / Kategorie-Zuordnung im Backend
      }));

      const newReceipt: NewReceipt = {
        store_id: storeId,
        date,
        time: time || null,
        total_amount: grandTotal,
        discount_total: discountTotal,
        deposit_total: depositTotal,
        payment_method: paymentMethod || null,
        image_path: imagePath,
        raw_json: JSON.stringify(result),
        items: receiptItems,
      };

      await addReceipt(newReceipt);
      onSave();
    } catch (err) {
      setSaveError(`Fehler beim Speichern: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // Inline editable cell / Inline-bearbeitbare Zelle
  const EditableCell = ({
    rowId,
    col,
    value,
    type = "text",
    className: cellClassName,
    align = "left",
  }: {
    rowId: number;
    col: string;
    value: string | number;
    type?: string;
    className?: string;
    align?: "left" | "right";
  }) => {
    const isEditing =
      editingCell?.row === rowId && editingCell?.col === col;

    if (isEditing) {
      return (
        <Input
          autoFocus
          type={type}
          defaultValue={value}
          className={cn("h-7 text-sm", type === "number" && "text-right", cellClassName)}
          step={type === "number" ? "0.01" : undefined}
          onBlur={(e) => {
            const newVal =
              type === "number"
                ? parseFloat(e.target.value) || 0
                : e.target.value;
            updateItem(rowId, col as keyof AnalyzedItem, newVal);
            setEditingCell(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              setEditingCell(null);
            }
          }}
        />
      );
    }

    return (
      <span
        className={cn(
          "block cursor-pointer rounded px-1 py-0.5 hover:bg-muted/50",
          align === "right" && "text-right",
          cellClassName
        )}
        onClick={() => setEditingCell({ row: rowId, col })}
      >
        {type === "number"
          ? (value as number).toFixed(2)
          : value || "\u00A0"}
      </span>
    );
  };

  return (
    <div className="flex h-full gap-0 overflow-hidden">
      {/* Left: Image with zoom / Links: Bild mit Zoom */}
      <div className="flex w-[40%] flex-col border-r border-border bg-muted/20">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-medium text-muted-foreground">Vorschau</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
              disabled={zoom <= 0.25}
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              disabled={zoom >= 3}
            >
              <ZoomIn className="size-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <img
            src={imageSrc}
            alt="Kassenzettel"
            className="rounded-lg shadow-md transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          />
        </div>
      </div>

      {/* Right: Correction form + table / Rechts: Korrektur-Formular + Tabelle */}
      <div className="flex w-[60%] flex-col">
        <ScrollArea className="flex-1">
          <div className="p-6">
            {/* Header fields / Kopfzeilen-Felder */}
            <div className="mb-6 grid grid-cols-2 gap-4">
              {/* Store name / Marktname */}
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Markt
                </label>
                <Input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Marktname eingeben..."
                  list="store-suggestions"
                />
                <datalist id="store-suggestions">
                  {stores.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>

              {/* Date / Datum */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Datum
                </label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {/* Time / Uhrzeit */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Uhrzeit
                </label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>

              {/* Payment method / Zahlungsart */}
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Zahlungsart
                </label>
                <Input
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  placeholder="z.B. Karte, Bar, EC..."
                />
              </div>
            </div>

            {/* Items table / Artikel-Tabelle */}
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Artikel</TableHead>
                    <TableHead className="w-[8%] text-right">Menge</TableHead>
                    <TableHead className="w-[12%] text-right">Einzelpreis</TableHead>
                    <TableHead className="w-[12%] text-right">Gesamt</TableHead>
                    <TableHead className="w-[18%]">Kategorie</TableHead>
                    <TableHead className="w-[10%] text-center">Status</TableHead>
                    <TableHead className="w-[5%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item._id}
                      className={cn(
                        item.confidence < 0.7 &&
                          "bg-yellow-50 dark:bg-yellow-900/20"
                      )}
                    >
                      <TableCell>
                        <EditableCell
                          rowId={item._id}
                          col="name"
                          value={item.name}
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          rowId={item._id}
                          col="menge"
                          value={item.menge}
                          type="number"
                          align="right"
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          rowId={item._id}
                          col="einzelpreis"
                          value={item.einzelpreis}
                          type="number"
                          align="right"
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          rowId={item._id}
                          col="gesamtpreis"
                          value={item.gesamtpreis}
                          type="number"
                          align="right"
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          value={item.kategorie ?? ""}
                          onChange={(e) =>
                            updateItem(
                              item._id,
                              "kategorie",
                              e.target.value || ""
                            )
                          }
                          className="h-7 w-full rounded border border-border bg-background px-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">-- Keine --</option>
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.confidence < 0.7 && (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">
                            <AlertTriangle className="mr-1 size-3" />
                            Unsicher
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => deleteItem(item._id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full rounded-none text-muted-foreground"
                        onClick={addItem}
                      >
                        <Plus className="mr-1 size-3.5" />
                        Artikel hinzufuegen
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Summary / Zusammenfassung */}
            <div className="mt-6 space-y-2 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Zwischensumme</span>
                <span className="font-medium">{subtotal.toFixed(2)} EUR</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rabatte</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    -{discountTotal.toFixed(2)} EUR
                  </span>
                </div>
              )}
              {depositTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pfand</span>
                  <span className="font-medium">{depositTotal.toFixed(2)} EUR</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Gesamtbetrag</span>
                <span>{grandTotal.toFixed(2)} EUR</span>
              </div>
            </div>

            {/* Save error / Speicherfehler */}
            {saveError && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {saveError}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer buttons / Fusszeilen-Buttons */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Dialog>
            <DialogTrigger>
              <Button variant="outline" disabled={saving}>
                <Trash2 className="mr-2 size-4" />
                Verwerfen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ergebnisse verwerfen?</DialogTitle>
                <DialogDescription>
                  Die erkannten Daten werden geloescht und koennen nicht wiederhergestellt werden.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose>
                  <Button variant="outline">Abbrechen</Button>
                </DialogClose>
                <Button variant="destructive" onClick={onDiscard}>
                  Verwerfen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="default" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>Speichern...</>
            ) : (
              <>
                <Save className="mr-2 size-4" />
                Speichern
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
