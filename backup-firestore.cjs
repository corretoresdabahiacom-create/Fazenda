const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
  apiKey: "AIzaSyA1G7Pxzk8e_eUHSIhyKnQxzrk9DYGLZfU",
  authDomain: "fazenda-online-4a6a6.firebaseapp.com",
  projectId: "fazenda-online-4a6a6",
  storageBucket: "fazenda-online-4a6a6.firebasestorage.app",
  messagingSenderId: "459270761665",
  appId: "1:459270761665:web:bcfe341adbc4086a4c7840"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function backup() {
  console.log('🔄 Iniciando backup do Firestore...\n');
  
  // Lista de coleções para fazer backup
  const collections = [
    'users',
    'animals', 
    'pastures',
    'expenses',
    'payments',
    'tasks',
    'inventory',
    'employees',
    'fixedExpenses',
    'weighingSheets'
  ];
  
  const backupData = {};
  let totalDocs = 0;
  
  for (const collName of collections) {
    try {
      console.log(`📁 Lendo coleção: ${collName}...`);
      const snapshot = await getDocs(collection(db, collName));
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      backupData[collName] = docs;
      totalDocs += docs.length;
      console.log(`   ✅ ${docs.length} documentos encontrados`);
    } catch (error) {
      console.log(`   ⚠️ Erro ao ler ${collName}: ${error.message}`);
      backupData[collName] = [];
    }
  }
  
  // Salvar arquivo com timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup-firestore-${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify(backupData, null, 2));
  console.log(`\n✅ Backup concluído com sucesso!`);
  console.log(`📦 Total de documentos: ${totalDocs}`);
  console.log(`💾 Arquivo salvo: ${filename}`);
  console.log(`📂 Tamanho: ${(fs.statSync(filename).size / 1024 / 1024).toFixed(2)} MB`);
}

backup().catch(console.error);