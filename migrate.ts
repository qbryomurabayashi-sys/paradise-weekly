import { db } from './src/lib/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

const NAME_MAP: Record<string, string> = {
    '京急横浜駅北口': '北口',
    'イトーヨーカドー横浜別所': '別所',
    'アピタ金沢文庫': '文庫',
    'オーケーみなとみらい': 'MM',
    'ヨークフーズ上大岡': 'ｶﾐｵ',
    'ウィング久里浜': '久里',
    'コースカベイサイドストアーズ': '汐入',
    '横浜市役所': '市役',
    'サミット横浜岡野': '岡野',
    'ビーンズ保土ヶ谷': '保土'
  };

async function migrate() {
    console.log("Starting migration...");
    
    // 1. stores
    const storesSnap = await getDocs(collection(db, 'stores'));
    for (const d of storesSnap.docs) {
        const docData = d.data();
        if (docData.name && NAME_MAP[docData.name]) {
            await updateDoc(doc(db, 'stores', d.id), { name: NAME_MAP[docData.name] });
            console.log(`Updated store: ${docData.name} -> ${NAME_MAP[docData.name]}`);
        }
    }

    // 2. users
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const d of usersSnap.docs) {
        const docData = d.data();
        if (docData.storeName && NAME_MAP[docData.storeName]) {
            await updateDoc(doc(db, 'users', d.id), { storeName: NAME_MAP[docData.storeName] });
            console.log(`Updated user: ${docData.storeName} -> ${NAME_MAP[docData.storeName]}`);
        }
    }

    // 3. reports
    const reportsSnap = await getDocs(collection(db, 'reports'));
    for (const d of reportsSnap.docs) {
        const docData = d.data();
        if (docData.storeName && NAME_MAP[docData.storeName]) {
            await updateDoc(doc(db, 'reports', d.id), { storeName: NAME_MAP[docData.storeName] });
            console.log(`Updated report: ${docData.storeName} -> ${NAME_MAP[docData.storeName]}`);
        }
    }

    // 4. store_key_passes
    const keysSnap = await getDocs(collection(db, 'store_key_passes'));
    for (const d of keysSnap.docs) {
        const docData = d.data();
        let targetName = docData.storeName;
        // The ID of store_key_passes might be storeName? 
        // Wait, documents in store_key_passes use storeId as the document ID usually, or an auto ID.
        // Let's just check the field.
        if (targetName && NAME_MAP[targetName]) {
            await updateDoc(doc(db, 'store_key_passes', d.id), { storeName: NAME_MAP[targetName] });
            console.log(`Updated store_key_passes: ${targetName} -> ${NAME_MAP[targetName]}`);
        }
    }

    console.log("Migration finished.");
    process.exit(0);
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
