// Receipt detail page / Kassenzettel-Detailansicht
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useReceipts } from "@/hooks/useReceipts";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeftIcon,
  Trash2Icon,
  ImageIcon,

  CalendarIcon,
  ClockIcon,
  CreditCardIcon,
} from "lucide-react";
import { toast } from "sonner";

export function ReceiptDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentDetail, detailLoading, fetchDetail, removeReceipt, clearDetail } = useReceipts();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchDetail(Number(id));
    }
    return () => clearDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDelete = async () => {
    if (currentDetail) {
      try {
        await removeReceipt(currentDetail.id);
        toast.success("Kassenzettel gelöscht");
        navigate("/receipts");
      } catch (err) {
        toast.error(`Fehler: ${err}`);
      }
    }
  };

  if (detailLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/receipts")}>
          <ArrowLeftIcon className="size-4 mr-2" />
          Zurück zur Liste
        </Button>
        <div className="text-center py-12 text-muted-foreground">
          Lade Kassenzettel...
        </div>
      </div>
    );
  }

  if (!currentDetail) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/receipts")}>
          <ArrowLeftIcon className="size-4 mr-2" />
          Zurück zur Liste
        </Button>
        <div className="text-center py-12 text-muted-foreground">
          Kassenzettel nicht gefunden.
        </div>
      </div>
    );
  }

  const receipt = currentDetail;
  const subtotal = receipt.items.reduce((sum, item) => sum + item.total_price, 0);

  // Convert Windows path to asset:// URL / Windows-Pfad in asset://-URL umwandeln
  const imageUrl = receipt.image_path
    ? `asset://localhost/${receipt.image_path.replace(/\\/g, "/")}`
    : null;

  return (
    <div className="space-y-6">
      {/* Back button / Zurück-Button */}
      <Button variant="ghost" onClick={() => navigate("/receipts")}>
        <ArrowLeftIcon className="size-4 mr-2" />
        Zurück zur Liste
      </Button>

      {/* Two-column layout: Details left, Image right */}
      {/* Zweispalten-Layout: Details links, Bild rechts */}
      <div className="flex gap-6">
        {/* Left column: Details / Linke Spalte: Details */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Header card / Kopfzeilen-Karte */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-xl">
                  {receipt.store_name ?? "Unbekannter Markt"}
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon className="size-4 text-destructive" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarIcon className="size-4" />
                  {formatDate(receipt.date)}
                </div>
                {receipt.time && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <ClockIcon className="size-4" />
                    {receipt.time}
                  </div>
                )}
                {receipt.payment_method && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CreditCardIcon className="size-4" />
                    {receipt.payment_method}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Items table / Artikel-Tabelle */}
          <Card>
            <CardHeader>
              <CardTitle>Artikel</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artikel</TableHead>
                      <TableHead className="text-center">Menge</TableHead>
                      <TableHead className="text-right">Einzelpreis</TableHead>
                      <TableHead className="text-right">Gesamtpreis</TableHead>
                      <TableHead>Kategorie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipt.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.raw_name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.total_price)}
                        </TableCell>
                        <TableCell>
                          {item.category_name ? (
                            <Badge variant="secondary">{item.category_name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {receipt.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Keine Artikel vorhanden
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Summary section / Zusammenfassung */}
          <Card>
            <CardHeader>
              <CardTitle>Zusammenfassung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Zwischensumme</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {receipt.discount_total > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Rabatte</span>
                  <span className="text-green-600">
                    -{formatCurrency(receipt.discount_total)}
                  </span>
                </div>
              )}
              {receipt.deposit_total !== 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pfand</span>
                  <span>{formatCurrency(receipt.deposit_total)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Gesamtbetrag</span>
                <span>{formatCurrency(receipt.total_amount)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Receipt image / Rechte Spalte: Kassenzettel-Bild */}
        {imageUrl && (
          <div className="w-72 shrink-0">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className="size-4" />
                  Originalbild
                </CardTitle>
              </CardHeader>
              <CardContent>
                <button
                  onClick={() => setImageOpen(true)}
                  className="w-full rounded-lg overflow-hidden border hover:opacity-90 transition-opacity cursor-zoom-in"
                >
                  <img
                    src={imageUrl}
                    alt="Kassenzettel"
                    className="w-full object-contain"
                  />
                </button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Image fullscreen dialog / Bild-Vollansicht-Dialog */}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Kassenzettel-Bild</DialogTitle>
          </DialogHeader>
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Kassenzettel"
              className="w-full max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog / Lösch-Bestätigungsdialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kassenzettel löschen?</DialogTitle>
            <DialogDescription>
              Dieser Kassenzettel und alle zugehörigen Artikel werden
              unwiderruflich gelöscht.
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
