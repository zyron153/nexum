import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

const config = JSON.parse(readFileSync(join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function seed() {
  const projectsRef = collection(db, 'projects');
  const snap = await getDocs(projectsRef);
  
  if (snap.empty) {
    console.log('Seeding demo projects...');
    const demoProjects = [
      { name: 'Skyline Plaza', location: 'London, UK', status: 'active', ownerId: 'system', createdAt: serverTimestamp() },
      { name: 'Riverfront Residences', location: 'Manchester, UK', status: 'active', ownerId: 'system', createdAt: serverTimestamp() },
      { name: 'Terminal 5 Expansion', location: 'Heathrow, UK', status: 'on-hold', ownerId: 'system', createdAt: serverTimestamp() },
    ];

    for (const p of demoProjects) {
      await addDoc(projectsRef, p);
    }
    console.log('Successfully seeded 3 projects.');
  } else {
    console.log('Projects already exist, skipping seed.');
  }
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
