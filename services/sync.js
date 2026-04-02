import * as Network from 'expo-network';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  getMediaForReport,
  getPendingMedia,
  getUnsyncedReports,
  markMediaUploaded,
  markReportSynced,
} from './db';
import { db, storage } from './firebase';

const ENABLE_STORAGE_UPLOAD = false;

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  mp4: 'video/mp4',
};

function guessContentType(uri) {
  try {
    const clean = (uri || '').split('?')[0];
    const m = clean.match(/\.([a-z0-9]+)$/i);
    const ext = (m && m[1])?.toLowerCase();
    return MIME_BY_EXT[ext] || 'application/octet-stream';
  } catch {
    return 'application/octet-stream';
  }
}

async function uriToBlob(uri) {
  const res = await fetch(uri);
  if (!res.ok) throw new Error(`fetch blob failed: ${res.status} ${res.statusText}`);
  return await res.blob();
}

function makeFirestorePayload(row, mediaUrls = []) {
  const payload = {
    id: row.id,
    type: row.type || 'Report',
    status: row.status || 'Open',
    reporterName: row.reporterName || '',
    rank: row.rank || '',
    dateStr: row.dateStr || '',
    timeStr: row.timeStr || '',
    station: row.station || '',
    locationMore: row.locationMore || '',
    incidentType: row.incidentType || '',
    injuryType: row.injuryType || '',
    details: row.details || '',
    offenderDesc: row.offenderDesc || '',
    lastSeen: row.lastSeen || '',
    policeCalled: !!row.policeCalled,
    policeNumber: row.policeNumber || '',
    createdAt: row.createdAt || Date.now(),
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    address: row.address || '',
    serverTime: serverTimestamp(),
  };

  if (Array.isArray(mediaUrls) && mediaUrls.length > 0) {
    payload.mediaUrls = mediaUrls;
  }

  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined) delete payload[k];
  });

  return payload;
}

/* one-off sync */

export async function runSyncOnce() {
  // Only on Wi-Fi
  try {
    const st = await Network.getNetworkStateAsync();
    const onWifi =
      st.isConnected &&
      (st.type === Network.NetworkStateType.WIFI || st.isWifiEnabled);
    if (!onWifi) {
      console.log('sync: skipped (not on Wi-Fi)');
      return { uploaded: 0, pushed: 0 };
    }
  } catch {
    // If network check fails, proceed anyway
  }

  let uploaded = 0;
  let pushed = 0;

  if (ENABLE_STORAGE_UPLOAD) {
    const pending = await getPendingMedia();
    for (const m of pending) {
      try {
        const blob = await uriToBlob(m.localUri);
        const contentType = guessContentType(m.localUri);
        const storageRef = ref(storage, `reports/${m.reportId}/${m.id}`);
        await uploadBytes(storageRef, blob, { contentType });
        const url = await getDownloadURL(storageRef);
        await markMediaUploaded(m.id, url);
        uploaded++;
      } catch (e) {
        console.warn('media upload error:', e?.code || e?.message || e);
      }
    }
  }

  const unsynced = await getUnsyncedReports();
  for (const r of unsynced) {
    try {
      const mediaRows = await getMediaForReport(r.id);
      const urls = mediaRows.filter((x) => !!x.cloudUrl).map((x) => x.cloudUrl);

      const payload = makeFirestorePayload(r, urls);

      await setDoc(doc(db, 'reports', r.id), payload, { merge: true });
      await markReportSynced(r.id);
      pushed++;
    } catch (e) {
      console.warn('firestore push error:', e?.code || e?.message || e);
      // keep going on next items
    }
  }

  console.log('sync:', { uploaded, pushed });
  return { uploaded, pushed };
}

/* background loop */

let _timer = null;
let _running = false;

export function startSyncLoop(intervalMs = 45000) {
  if (_timer) return; // already running
  _timer = setInterval(async () => {
    if (_running) return;
    _running = true;
    try {
      await runSyncOnce();
    } catch (e) {
      console.warn('sync loop error:', e?.message || e);
    } finally {
      _running = false;
    }
  }, intervalMs);
}

export function stopSyncLoop() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}
