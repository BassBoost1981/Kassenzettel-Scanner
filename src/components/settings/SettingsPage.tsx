// Settings page with 4 tabs / Einstellungsseite mit 4 Tabs
import { useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useCategories } from "@/hooks/useCategories";
import { useStores } from "@/hooks/useStores";
import {
  checkModelExists,
  selectModelFile,
  downloadModel,
  insertMockData,
  deleteAllReceipts,
} from "@/lib/tauri-commands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
import {
  SunIcon,
  MoonIcon,
  MonitorIcon,
  Trash2Icon,
  PlusIcon,
  DownloadIcon,
  FolderOpenIcon,
  DatabaseIcon,
  SaveIcon,
  UploadIcon,
  CheckCircleIcon,
  StoreIcon,
  TagIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { Theme, KeepImages } from "@/types/settings";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Einstellungen</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Allgemein</TabsTrigger>
          <TabsTrigger value="model">KI-Modell</TabsTrigger>
          <TabsTrigger value="stores">Märkte & Kategorien</TabsTrigger>
          <TabsTrigger value="data">Daten</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="general">
            <GeneralTab />
          </TabsContent>
          <TabsContent value="model">
            <ModelTab />
          </TabsContent>
          <TabsContent value="stores">
            <StoresTab />
          </TabsContent>
          <TabsContent value="data">
            <DataTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// General settings tab / Allgemeine Einstellungen
function GeneralTab() {
  const { theme, setTheme } = useSettings();

  const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "system", label: "System", icon: <MonitorIcon className="size-4" /> },
    { value: "dark", label: "Dunkel", icon: <MoonIcon className="size-4" /> },
    { value: "light", label: "Hell", icon: <SunIcon className="size-4" /> },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Erscheinungsbild</CardTitle>
          <CardDescription>
            Wähle das Farbschema der Anwendung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {themes.map((t) => (
              <Button
                key={t.value}
                variant={theme === t.value ? "default" : "outline"}
                onClick={() => setTheme(t.value)}
                className="flex items-center gap-2"
              >
                {t.icon}
                {t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// AI model settings tab / KI-Modell Einstellungen
function ModelTab() {
  const { gpuLayers, setGpuLayers } = useSettings();
  const [modelExists, setModelExists] = useState<boolean | null>(null);
  const [modelPath, setModelPath] = useState<string>("");
  const [checking, setChecking] = useState(false);

  const checkModel = async () => {
    setChecking(true);
    try {
      const exists = await checkModelExists();
      setModelExists(exists);
    } catch {
      setModelExists(false);
    }
    setChecking(false);
  };

  const handleSelectModel = async () => {
    try {
      const path = await selectModelFile();
      setModelPath(path);
      setModelExists(true);
    } catch {
      // User cancelled / Benutzer hat abgebrochen
    }
  };

  const handleDownload = async () => {
    try {
      await downloadModel();
      setModelExists(true);
    } catch {
      // Error handled by backend
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Modell-Status</CardTitle>
          <CardDescription>
            Qwen2.5-VL-3B — das KI-Modell für die Texterkennung der Kassenzettel (~2,1 GB + mmproj).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Status:</span>
            {modelExists === null ? (
              <Badge variant="secondary">Nicht geprüft</Badge>
            ) : modelExists ? (
              <Badge className="bg-green-600 text-white">
                <CheckCircleIcon className="size-3 mr-1" />
                Geladen
              </Badge>
            ) : (
              <Badge variant="destructive">
                Fehlt
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={checkModel} disabled={checking}>
              {checking ? "Prüfe..." : "Status prüfen"}
            </Button>
          </div>

          {modelPath && (
            <div className="text-xs text-muted-foreground bg-muted p-2 rounded font-mono break-all">
              {modelPath}
            </div>
          )}

          <Separator />

          <div className="flex gap-2">
            {modelExists === false && (
              <Button onClick={handleDownload}>
                <DownloadIcon className="size-4 mr-2" />
                Modell herunterladen
              </Button>
            )}
            <Button variant="outline" onClick={handleSelectModel}>
              <FolderOpenIcon className="size-4 mr-2" />
              Modell manuell wählen
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GPU-Einstellungen</CardTitle>
          <CardDescription>
            Anzahl der GPU-Layers für die Inferenz. 0 = nur CPU, -1 = automatisch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium min-w-[100px]">GPU-Layers</label>
            <Input
              type="number"
              value={gpuLayers}
              onChange={(e) => setGpuLayers(e.target.value)}
              className="w-24"
              min={-1}
            />
            <span className="text-xs text-muted-foreground">
              (0 = CPU, -1 = auto)
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Stores and categories management tab / Märkte- und Kategorien-Verwaltung
function StoresTab() {
  const { stores, addStore, removeStore } = useStores();
  const { categories, addCategory, removeCategory } = useCategories();
  const { aldiMerge, setAldiMerge } = useSettings();
  const [newStoreName, setNewStoreName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [deleteStoreId, setDeleteStoreId] = useState<number | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<number | null>(null);
  const [deleteStoreOpen, setDeleteStoreOpen] = useState(false);
  const [deleteCategoryOpen, setDeleteCategoryOpen] = useState(false);

  const handleAddStore = async () => {
    const name = newStoreName.trim();
    if (!name) {
      return;
    }

    try {
      await addStore(name);
      setNewStoreName("");
      toast.success(`Markt "${name}" hinzugefügt`);
    } catch (error) {
      toast.error(`Markt konnte nicht hinzugefügt werden: ${getErrorMessage(error)}`);
    }
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      return;
    }

    try {
      await addCategory(name);
      setNewCategoryName("");
      toast.success(`Kategorie "${name}" hinzugefügt`);
    } catch (error) {
      toast.error(`Kategorie konnte nicht hinzugefügt werden: ${getErrorMessage(error)}`);
    }
  };

  const confirmDeleteStore = (id: number) => {
    setDeleteStoreId(id);
    setDeleteStoreOpen(true);
  };

  const confirmDeleteCategory = (id: number) => {
    setDeleteCategoryId(id);
    setDeleteCategoryOpen(true);
  };

  const handleDeleteStore = async () => {
    if (deleteStoreId === null) {
      return;
    }

    try {
      await removeStore(deleteStoreId);
      toast.success("Markt gelöscht");
      setDeleteStoreOpen(false);
      setDeleteStoreId(null);
    } catch (error) {
      toast.error(`Markt konnte nicht gelöscht werden: ${getErrorMessage(error)}`);
    }
  };

  const handleDeleteCategory = async () => {
    if (deleteCategoryId === null) {
      return;
    }

    try {
      await removeCategory(deleteCategoryId);
      toast.success("Kategorie gelöscht");
      setDeleteCategoryOpen(false);
      setDeleteCategoryId(null);
    } catch (error) {
      toast.error(`Kategorie konnte nicht gelöscht werden: ${getErrorMessage(error)}`);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bekannte Märkte</CardTitle>
          <CardDescription>
            Verwalte die Liste der bekannten Supermärkte und Geschäfte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new store / Neuen Markt hinzufügen */}
          <div className="flex gap-2">
            <Input
              placeholder="Neuer Markt..."
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleAddStore()}
              className="flex-1"
            />
            <Button onClick={() => void handleAddStore()} disabled={!newStoreName.trim()}>
              <PlusIcon className="size-4 mr-1" />
              Hinzufügen
            </Button>
          </div>

          <Separator />

          {/* Store list / Markt-Liste */}
          {stores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Märkte gespeichert.
            </p>
          ) : (
            <div className="space-y-1">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <StoreIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm">{store.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => confirmDeleteStore(store.id)}
                  >
                    <Trash2Icon className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eigene Kategorien</CardTitle>
          <CardDescription>
            Diese Kategorien stehen dir beim Korrigieren und in Auswertungen zur Verfügung.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Neue Kategorie..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleAddCategory()}
              className="flex-1"
            />
            <Button
              onClick={() => void handleAddCategory()}
              disabled={!newCategoryName.trim()}
            >
              <PlusIcon className="size-4 mr-1" />
              Hinzufügen
            </Button>
          </div>

          <Separator />

          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Kategorien gespeichert.
            </p>
          ) : (
            <div className="space-y-1">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <TagIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm">{category.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => confirmDeleteCategory(category.id)}
                  >
                    <Trash2Icon className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Aldi-Varianten</CardTitle>
          <CardDescription>
            Sollen Aldi Nord und Aldi Süd getrennt oder zusammen erfasst werden?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={aldiMerge === "separate" ? "default" : "outline"}
              onClick={() => setAldiMerge("separate")}
              size="sm"
            >
              Getrennt tracken
            </Button>
            <Button
              variant={aldiMerge === "merge" ? "default" : "outline"}
              onClick={() => setAldiMerge("merge")}
              size="sm"
            >
              Zusammenfassen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Store delete confirmation / Lösch-Bestätigung für Märkte */}
      <Dialog open={deleteStoreOpen} onOpenChange={setDeleteStoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Markt löschen?</DialogTitle>
            <DialogDescription>
              Dieser Markt wird aus der Liste entfernt. Bestehende Kassenzettel
              behalten ihre Zuordnung.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Abbrechen
            </DialogClose>
            <Button variant="destructive" onClick={() => void handleDeleteStore()}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category delete confirmation / Lösch-Bestätigung für Kategorien */}
      <Dialog open={deleteCategoryOpen} onOpenChange={setDeleteCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kategorie löschen?</DialogTitle>
            <DialogDescription>
              Kategorien können nur gelöscht werden, wenn sie noch keinem gespeicherten Artikel zugeordnet sind.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Abbrechen
            </DialogClose>
            <Button variant="destructive" onClick={() => void handleDeleteCategory()}>
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Data management tab / Daten-Verwaltung
function DataTab() {
  const { keepImages, setKeepImages } = useSettings();

  const imageOptions: { value: KeepImages; label: string; desc: string }[] = [
    { value: "keep", label: "Behalten", desc: "Bilder dauerhaft speichern" },
    { value: "delete", label: "Löschen", desc: "Bilder nach Verarbeitung entfernen" },
    { value: "ask", label: "Fragen", desc: "Bei jedem Scan nachfragen" },
  ];

  const showToast = (message: string) => {
    toast(message);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bilder-Einstellung</CardTitle>
          <CardDescription>
            Wie soll mit den gescannten Bildern umgegangen werden?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {imageOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setKeepImages(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  keepImages === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Speicherort</CardTitle>
          <CardDescription>
            Alle Daten werden lokal gespeichert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <DatabaseIcon className="size-4 text-muted-foreground" />
            <code className="text-sm bg-muted px-2 py-1 rounded">./data/</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup</CardTitle>
          <CardDescription>
            Erstelle oder lade ein Backup deiner Daten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => showToast("Backup-Funktion kommt in einer zukünftigen Version.")}
            >
              <SaveIcon className="size-4 mr-2" />
              Backup erstellen
            </Button>
            <Button
              variant="outline"
              onClick={() => showToast("Backup-Import kommt in einer zukünftigen Version.")}
            >
              <UploadIcon className="size-4 mr-2" />
              Backup laden
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Testdaten / Mock data */}
      <Card className="border-dashed border-yellow-500/50">
        <CardHeader>
          <CardTitle>Testdaten (Entwicklung)</CardTitle>
          <CardDescription>
            Mock-Daten zum Testen von Preisverlauf und Dashboard einfügen oder löschen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const result = await insertMockData();
                  showToast(result);
                } catch (e) {
                  showToast("Fehler: " + String(e));
                }
              }}
            >
              Testdaten einfügen
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!confirm("Alle Kassenzettel löschen? Das kann nicht rückgängig gemacht werden.")) return;
                try {
                  const result = await deleteAllReceipts();
                  showToast(result);
                } catch (e) {
                  showToast("Fehler: " + String(e));
                }
              }}
            >
              Alle Kassenzettel löschen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
