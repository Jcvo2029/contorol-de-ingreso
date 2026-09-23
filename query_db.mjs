import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, limit } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAI1k22CsW3wt59HfwejTiGBvBMf2-yjg0",
  authDomain: "control-de-ingreso-641b9.firebaseapp.com",
  projectId: "control-de-ingreso-641b9",
  storageBucket: "control-de-ingreso-641b9.firebasestorage.app",
  messagingSenderId: "976708497064",
  appId: "1:976708497064:web:9423ab1467e27d9b801c9d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const equiposSnapshot = await getDocs(query(collection(db, "equipos"), limit(2)));
  console.log("=== Equipos ===");
  equiposSnapshot.forEach(doc => console.log(doc.id, doc.data()));

  const personasSnapshot = await getDocs(query(collection(db, "personas"), limit(5)));
  console.log("=== Personas ===");
  personasSnapshot.forEach(doc => console.log(doc.id, doc.data()));

  const asignacionesSnapshot = await getDocs(query(collection(db, "asignaciones"), limit(2)));
  console.log("=== Asignaciones ===");
  asignacionesSnapshot.forEach(doc => console.log(doc.id, doc.data()));
}

main().catch(console.error);
