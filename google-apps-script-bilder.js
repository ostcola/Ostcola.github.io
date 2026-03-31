// ═══════════════════════════════════════════════════════════════
// OST COLA BILDER-UPLOAD – Google Apps Script
// ═══════════════════════════════════════════════════════════════
//
// EINRICHTUNG:
// 1. Gehe zu https://script.google.com → Neues Projekt
// 2. Lösche den Inhalt und füge diesen ganzen Code ein
// 3. WICHTIG: Trage unten deine Google Drive Ordner-IDs ein!
// 4. Klicke auf 💾 Speichern
// 5. Klicke auf: Bereitstellen → Neue Bereitstellung
//    - Typ: Web-App
//    - Ausführen als: Ich
//    - Zugriff: Jeder
// 6. Klicke auf "Bereitstellen" und bestätige die Berechtigungen
// 7. Kopiere die URL und trage sie in den Upload-Seiten ein
//
// GOOGLE DRIVE ORDNER:
// Erstelle 3 Ordner in Google Drive:
//   1. "OstCola Party 2026"    → für Bilder vom 04.07.2026
//   2. "OstCola DDR Bilder"    → für Bilder vor 1989
//   3. "OstCola Galerie"       → für Galerie-Bilder auf der Hauptseite
// Rechtsklick auf jeden Ordner → "Freigeben" → "Jeder mit dem Link kann ansehen"
// (für Party- und Galerie-Ordner nötig, da diese als Galerie angezeigt werden)
//
// NACH ÄNDERUNGEN:
// → Neue Bereitstellung erstellen (Bereitstellen → Neue Bereitstellung)
// → Neue URL in index.html, bilder-party.html und bilder-ddr.html eintragen
//
// Die Ordner-ID findest du in der URL:
// https://drive.google.com/drive/folders/XXXXX  ← das ist die ID
//
// ═══════════════════════════════════════════════════════════════

// ─── HIER DEINE ORDNER-IDS EINTRAGEN ───
const FOLDER_PARTY   = 'HIER_PARTY_ORDNER_ID';     // OstCola Party 2026
const FOLDER_DDR     = 'HIER_DDR_ORDNER_ID';       // OstCola DDR Bilder
const FOLDER_GALERIE = 'HIER_GALERIE_ORDNER_ID';   // OstCola Galerie (Hauptseite)

// ─── Maximale Dateigröße in MB ───
const MAX_FILE_SIZE_MB = 15;

function doGet(e) {
  const action = e.parameter.action || 'list';
  const album  = e.parameter.album  || 'party';

  if (action === 'list') {
    if (album === 'party')   return listImages(FOLDER_PARTY);
    if (album === 'galerie') return listImages(FOLDER_GALERIE);
  }

  return jsonResp({ error: 'Unbekannte Aktion' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (body.action === 'upload') {
      return uploadImage(body);
    }

    return jsonResp({ error: 'Unbekannte Aktion' });
  } catch (err) {
    return jsonResp({ error: err.message });
  }
}

// ── Bild hochladen ──
function uploadImage(body) {
  const album    = body.album;     // 'party' oder 'ddr'
  const fileName = body.fileName;  // z.B. 'foto_001.jpg'
  const mimeType = body.mimeType;  // z.B. 'image/jpeg'
  const data     = body.data;      // Base64-kodiert
  const uploaderName = body.uploaderName || 'Anonym';

  if (!album || !fileName || !data) {
    return jsonResp({ error: 'Fehlende Parameter (album, fileName, data)' });
  }

  // Ordner bestimmen
  const folderId = album === 'party' ? FOLDER_PARTY : FOLDER_DDR;
  if (folderId.indexOf('HIER_') === 0) {
    return jsonResp({ error: 'Ordner-ID noch nicht konfiguriert! Bitte google-apps-script-bilder.js bearbeiten.' });
  }

  const folder = DriveApp.getFolderById(folderId);

  // Base64 → Blob
  const decoded = Utilities.base64Decode(data);

  // Größencheck
  if (decoded.length > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return jsonResp({ error: 'Datei zu groß (max. ' + MAX_FILE_SIZE_MB + ' MB)' });
  }

  const blob = Utilities.newBlob(decoded, mimeType, fileName);

  // Dateiname: Zeitstempel + Uploader + Originalname
  const now = new Date();
  const ts = Utilities.formatDate(now, 'Europe/Berlin', 'yyyyMMdd_HHmmss');
  const safeName = ts + '_' + uploaderName.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_') + '_' + fileName;
  blob.setName(safeName);

  // In Drive speichern
  const file = folder.createFile(blob);

  // Für Party-Bilder: öffentlich freigeben (zum Anzeigen in Galerie)
  if (album === 'party') {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }

  return jsonResp({
    success: true,
    fileId: file.getId(),
    fileName: safeName,
    album: album
  });
}

// ── Bilder aus einem Ordner auflisten (für Galerie) ──
function listImages(folderId) {
  if (folderId.indexOf('HIER_') === 0) {
    return jsonResp({ error: 'Ordner-ID noch nicht konfiguriert!' });
  }

  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const images = [];

  while (files.hasNext()) {
    const f = files.next();
    const mime = f.getMimeType();

    // Nur Bilder
    if (mime.indexOf('image/') !== 0) continue;

    images.push({
      id: f.getId(),
      name: f.getName(),
      url: 'https://lh3.googleusercontent.com/d/' + f.getId(),
      thumb: 'https://lh3.googleusercontent.com/d/' + f.getId() + '=s400',
      date: Utilities.formatDate(f.getDateCreated(), 'Europe/Berlin', 'dd.MM.yyyy HH:mm'),
      size: f.getSize()
    });
  }

  // Neueste zuerst
  images.sort(function(a, b) {
    return b.date.localeCompare(a.date);
  });

  return jsonResp({ images: images, count: images.length });
}

// ── Hilfsfunktion ──
function jsonResp(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
