import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyA5gQ9G9W9oTW6nqI_HoSYny1lBle2Vcus",
    authDomain: "budget-manager-a4482.firebaseapp.com",
    projectId: "budget-manager-a4482",
    storageBucket: "budget-manager-a4482.firebasestorage.app",
    messagingSenderId: "686541101400",
    appId: "1:686541101400:web:a892ab15ebf56a6415ad2d",
    measurementId: "G-ZY8L9KLDXZ"
};

const app = initializeApp(firebaseConfig);

// Enable offline persistence
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});
