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
  console.log("=== EQUIPOS (Printers / 1790170929291 / 111nw / 135w / M401n) ===");
  const eqSnap = await getDocs(collection(db, "equipos"));
  eqSnap.forEach(doc => {
    const d = doc.data();
    const str = JSON.stringify(d);
    if (str.includes("1790170929291") || str.includes("111nw") || str.includes("135w") || str.includes("M401n") || d.equipmentType === 'Impresora') {
      console.log(`[EQUIPO] ID: ${doc.id} | Tipo: ${d.equipmentType} | Modelo: ${d.brandModel} | Serial: ${d.serialNumber} | Asignado: ${d.assignedTo} | Area: ${d.area || d.ubicacion}`);
    }
  });

  console.log("\n=== PERSONAS (Printers / 1790170929291 / 111nw / 135w / M401n) ===");
  const perSnap = await getDocs(collection(db, "personas"));
  perSnap.forEach(doc => {
    const d = doc.data();
    const str = JSON.stringify(d);
    if (str.includes("1790170929291") || str.includes("111nw") || str.includes("135w") || str.includes("M401n") || d.printerBrandModel) {
      console.log(`[PERSONA] ID: ${doc.id} | Nombre: ${d.name} | Area: ${d.area} | Printer: ${d.printerBrandModel} | Serial: ${d.printerSerial} | AssignedPrinters: ${JSON.stringify(d.assignedPrinters || [])}`);
    }
  });
}

main().catch(console.error);
