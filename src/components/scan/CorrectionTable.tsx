// Correction table for reviewed receipt data / Korrektur-Tabelle fuer ueberprueften Kassenzettel
import { useState, useCallback, useEffect, useMemo, memo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  Plus,
  Save,
  Trash2,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Pencil,
  PlusCircle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
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
import { useCategories } from "@/hooks/useCategories";
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

interface EditableItem extends AnalyzedItem {
  _id: number;
}

function normalizeCategoryName(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function categoryLookupKey(value: string | null | undefined) {
  return normalizeCategoryName(value).toLocaleLowerCase("de-DE");
}

// Inline editable cell — defined outside to prevent re-creation on each render
// Inline-bearbeitbare Zelle — ausserhalb definiert um Neuerstellung bei jedem Render zu verhindern
const EditableCell = memo(function EditableCell({
  rowId,
  col,
  value,
  type = "text",
  className: cellClassName,
  align = "left",
  editingCell,
  setEditingCell,
  updateItem,
}: {
  rowId: number;
  col: string;
  value: string | number;
  type?: string;
  className?: string;
  align?: "left" | "right";
  editingCell: { row: number; col: string } | null;
  setEditingCell: (cell: { row: number; col: string } | null) => void;
  updateItem: (id: number, field: keyof AnalyzedItem, value: string | number) => void;
}) {
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
        "group flex items-center gap-1 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/50",
        align === "right" && "justify-end text-right",
        cellClassName
      )}
      onClick={() => setEditingCell({ row: rowId, col })}
    >
      {type === "number"
        ? (value as number).toFixed(2)
        : value || "\u00A0"}
      <Pencil className="size-3 opacity-0 group-hover:opacity-50 shrink-0" />
    </span>
  );
});

export function CorrectionTable({
  imagePath,
  result,
  onSave,
  onDiscard,
}: CorrectionTableProps) {
  const { addReceipt } = useReceipts();
  const { stores, addStore } = useStores();
  const { categories, addCategory, loading: categoriesLoading } = useCategories();

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
  // Price ranges for known products / Preisbereiche fuer bekannte Produkte
  const [priceRanges, setPriceRanges] = useState<Record<string, [number, number]>>({});

  // Stable key derived from unique item names only — prevents infinite loop
  // Stabiler Schluessel aus eindeutigen Artikelnamen — verhindert Endlosschleife
  const itemNamesKey = useMemo(
    () => JSON.stringify([...new Set(items.map((item) => item.name.trim()).filter(Boolean))].sort()),
    [items]
  );

  // Load price ranges for all items / Preisbereiche fuer alle Artikel laden
  useEffect(() => {
    let ignore = false;

    const loadRanges = async () => {
      const uniqueNames: string[] = JSON.parse(itemNamesKey);

      if (uniqueNames.length === 0) {
        setPriceRanges({});
        return;
      }

      const ranges: Record<string, [number, number]> = {};
      for (const name of uniqueNames) {
        try {
          const range = await invoke<[number, number] | null>("get_price_range", {
            productName: name,
          });
          if (!ignore && range) {
            ranges[name] = range;
          }
        } catch {
          // Ignore missing history / Fehlende Historie ignorieren
        }
      }

      if (!ignore) {
        setPriceRanges(ranges);
      }
    };

    loadRanges();

    return () => {
      ignore = true;
    };
  }, [itemNamesKey]);

  const imageSrc = convertFileSrc(imagePath);

  // Calculate totals / Summen berechnen
  const subtotal = items.reduce((sum, item) => sum + item.gesamtpreis, 0);
  const discountTotal = items.reduce((sum, item) => sum + item.rabatt, 0);
  const depositTotal = items.reduce((sum, item) => sum + item.pfand, 0);
  const computedGrandTotal = subtotal - discountTotal + depositTotal;
  const grandTotal = items.length > 0 ? computedGrandTotal : (result.gesamtbetrag ?? 0);

  // Update item field / Artikelfeld aktualisieren
  const updateItem = useCallback(
    (id: number, field: keyof AnalyzedItem, value: string | number) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item._id !== id) {
            return item;
          }

          const nextItem = { ...item, [field]: value };

          if (field === "menge" || field === "einzelpreis") {
            nextItem.gesamtpreis = Number(
              (nextItem.menge * nextItem.einzelpreis).toFixed(2)
            );
          }

          return nextItem;
        })
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
      artikelnummer: null,
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

  const categoryExists = useCallback(
    (name: string) => {
      const lookupKey = categoryLookupKey(name);
      return (
        lookupKey !== "" &&
        categories.some((category) => categoryLookupKey(category.name) === lookupKey)
      );
    },
    [categories]
  );

  const handleQuickAddCategory = useCallback(
    async (rawName: string) => {
      const categoryName = normalizeCategoryName(rawName);

      if (!categoryName || categoryExists(categoryName)) {
        return;
      }

      try {
        await addCategory(categoryName);
        toast.success(`Kategorie "${categoryName}" hinzugefügt`);
      } catch (error) {
        toast.error(`Kategorie konnte nicht angelegt werden: ${String(error)}`);
      }
    },
    [addCategory, categoryExists]
  );

  // Handle save / Speichern
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    try {
      // Find or create store / Markt finden oder erstellen
      let storeId: number;
      const normalizedStoreName = storeName.trim() || "Unbekannt";
      const existingStore = stores.find(
        (s) => s.name.toLowerCase() === normalizedStoreName.toLowerCase()
      );

      if (existingStore) {
        storeId = existingStore.id;
      } else {
        const newStore = await addStore(normalizedStoreName);
        storeId = newStore.id;
      }

      // Build receipt items / Kassenzettel-Positionen erstellen
      const receiptItems: NewReceiptItem[] = items.map((item) => {
        const categoryName = normalizeCategoryName(item.kategorie);

        return {
          raw_name: item.name,
          quantity: item.menge,
          unit_price: item.einzelpreis,
          total_price: item.gesamtpreis,
          discount: item.rabatt,
          deposit: item.pfand,
          category_id: null, // Category lookup handled by backend / Kategorie-Zuordnung im Backend
          category_name: categoryName || null,
        };
      });

      const newReceipt: NewReceipt = {
        store_id: storeId,
        date,
        time: time || null,
        total_amount: grandTotal,
        discount_total: discountTotal,
        deposit_total: depositTotal,
        payment_method: paymentMethod || null,
        image_path: result.image_path ?? imagePath,
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
              {/* Store name with add button / Marktname mit Hinzufuegen-Button */}
              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Markt
                </label>
                <div className="flex gap-2">
                  <Input
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Marktname eingeben..."
                    list="store-suggestions"
                    className="flex-1"
                  />
                  <datalist id="store-suggestions">
                    {stores.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                  {storeName.trim() &&
                    !stores.find((s) => s.name.toLowerCase() === storeName.trim().toLowerCase()) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-green-600 border-green-600 hover:bg-green-600/10"
                      onClick={async () => {
                        try {
                          await addStore(storeName.trim());
                          toast.success(`Markt "${storeName.trim()}" hinzugefügt`);
                        } catch (error) {
                          toast.error(`Markt konnte nicht angelegt werden: ${String(error)}`);
                        }
                      }}
                      title="Markt zur Liste hinzufügen"
                    >
                      <PlusCircle className="mr-1 size-4" />
                      Hinzufügen
                    </Button>
                    )}
                </div>
                <datalist id="category-suggestions">
                  {categories.map((category) => (
                    <option key={category.id} value={category.name} />
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
                    <TableHead className="w-[22%]">Artikel</TableHead>
                    <TableHead className="w-[10%]">Art.-Nr.</TableHead>
                    <TableHead className="w-[6%] text-right">Menge</TableHead>
                    <TableHead className="w-[9%] text-right">Einzelpreis</TableHead>
                    <TableHead className="w-[9%] text-right">Gesamt</TableHead>
                    <TableHead className="w-[14%] text-center">Preis-Historie</TableHead>
                    <TableHead className="w-[13%]">Kategorie</TableHead>
                    <TableHead className="w-[6%] text-center">Status</TableHead>
                    <TableHead className="w-[3%]" />
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
                          editingCell={editingCell}
                          setEditingCell={setEditingCell}
                          updateItem={updateItem}
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          rowId={item._id}
                          col="artikelnummer"
                          value={item.artikelnummer || ""}
                          editingCell={editingCell}
                          setEditingCell={setEditingCell}
                          updateItem={updateItem}
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          rowId={item._id}
                          col="menge"
                          value={item.menge}
                          type="number"
                          align="right"
                          editingCell={editingCell}
                          setEditingCell={setEditingCell}
                          updateItem={updateItem}
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          rowId={item._id}
                          col="einzelpreis"
                          value={item.einzelpreis}
                          type="number"
                          align="right"
                          editingCell={editingCell}
                          setEditingCell={setEditingCell}
                          updateItem={updateItem}
                        />
                      </TableCell>
                      <TableCell>
                        <EditableCell
                          rowId={item._id}
                          col="gesamtpreis"
                          value={item.gesamtpreis}
                          type="number"
                          align="right"
                          editingCell={editingCell}
                          setEditingCell={setEditingCell}
                          updateItem={updateItem}
                        />
                      </TableCell>
                      {/* Price range / Preisbereich */}
                      <TableCell className="text-center">
                        {priceRanges[item.name] ? (
                          <div className="flex flex-col items-center text-xs gap-0.5">
                            <span className="flex items-center gap-0.5 text-green-500">
                              <TrendingDown className="size-3" />
                              {priceRanges[item.name][0].toFixed(2)}€
                            </span>
                            <span className="flex items-center gap-0.5 text-red-500">
                              <TrendingUp className="size-3" />
                              {priceRanges[item.name][1].toFixed(2)}€
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input
                            value={item.kategorie ?? ""}
                            onChange={(e) =>
                              updateItem(item._id, "kategorie", e.target.value)
                            }
                            list="category-suggestions"
                            placeholder="Kategorie"
                            className="h-7"
                          />
                          {normalizeCategoryName(item.kategorie) &&
                            !categoryExists(item.kategorie ?? "") && (
                              <Button
                                variant="outline"
                                size="icon-xs"
                                className="shrink-0 text-green-600 border-green-600 hover:bg-green-600/10"
                                disabled={categoriesLoading}
                                onClick={() => void handleQuickAddCategory(item.kategorie ?? "")}
                                title="Kategorie zur Liste hinzufügen"
                              >
                                <PlusCircle className="size-3.5" />
                              </Button>
                            )}
                        </div>
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
                    <TableCell colSpan={9} className="p-0">
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
