// Storage layer: Firebase (synced, offline-capable) when configured, otherwise localStorage.
import { firebaseConfig } from "./firebase-config.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
export const cloudEnabled = !!firebaseConfig.apiKey;
const LS_KEY = "dinner-data-v1";
const empty = () => ({ recipes: [], plan: null });

export async function initStore({ onData, onAuth }) {
  if (!cloudEnabled) {
    onAuth(true, null);
    const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || empty(); } catch { return empty(); } };
    onData(load());
    return {
      save: d => localStorage.setItem(LS_KEY, JSON.stringify(d)),
      signIn: async () => {}, signOut: async () => {}
    };
  }
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import(FB + "firebase-app.js"),
    import(FB + "firebase-auth.js"),
    import(FB + "firebase-firestore.js")
  ]);
  const app = initializeApp(firebaseConfig);
  const a = auth.getAuth(app);
  let db;
  try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() }); }
  catch { db = fs.getFirestore(app); }
  let unsub = null, ref = null;
  auth.onAuthStateChanged(a, user => {
    if (unsub) { unsub(); unsub = null; }
    onAuth(!!user, user);
    if (!user) return;
    ref = fs.doc(db, "households", user.uid);
    unsub = fs.onSnapshot(ref, snap => onData(snap.exists() ? { ...empty(), ...snap.data() } : empty()));
  });
  return {
    save: d => ref && fs.setDoc(ref, d).catch(e => console.error(e)),
    signIn: (e, p) => auth.signInWithEmailAndPassword(a, e, p),
    signOut: () => auth.signOut(a)
  };
}
