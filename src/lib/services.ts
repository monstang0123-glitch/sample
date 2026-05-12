import { 
  collection, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError } from './error-handler';
import { OperationType, type Product } from '../types';

const COLLECTION_NAME = 'products';

export const productServices = {
  async getProducts() {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
      return [];
    }
  },

  subscribeProducts(callback: (products: Product[]) => void) {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      callback(products);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    });
  },

  async seedProducts() {
    const products = [
      {
        name: "JP Phantom Max",
        brand: "JP Sneakers",
        price: 4500,
        description: "Experience the ultimate comfort with Phantom Max technology. Lightweight and stylish.",
        images: ["https://picsum.photos/seed/sneaker1/800/800"],
        category: "Lifestyle",
        stock: 50,
        createdAt: serverTimestamp()
      },
      {
        name: "Volt Runner V1",
        brand: "JP Sneakers",
        price: 3200,
        description: "Built for speed. Aerodynamic design with responsive foam cushioning.",
        images: ["https://picsum.photos/seed/sneaker2/800/800"],
        category: "Running",
        stock: 30,
        createdAt: serverTimestamp()
      },
      {
        name: "Retro High '88",
        brand: "JP Sneakers",
        price: 5900,
        description: "Classic silhouette with premium leather construction. A true icon.",
        images: ["https://picsum.photos/seed/sneaker3/800/800"],
        category: "Classic",
        stock: 20,
        createdAt: serverTimestamp()
      },
      {
        name: "JP Cloud Dunk",
        brand: "JP Sneakers",
        price: 4800,
        description: "Gravity-defying performance. Engineered for the hardwood.",
        images: ["https://picsum.photos/seed/sneaker5/800/800"],
        category: "Basketball",
        stock: 25,
        createdAt: serverTimestamp()
      },
      {
        name: "Impact Pro",
        brand: "JP Sneakers",
        price: 5200,
        description: "High-top support with superior ankle lockdown for aggressive play.",
        images: ["https://picsum.photos/seed/sneaker6/800/800"],
        category: "Basketball",
        stock: 15,
        createdAt: serverTimestamp()
      },
      {
        name: "Urban Explorer",
        brand: "JP Sneakers",
        price: 3800,
        description: "Durable design for city adventures. Weather-resistant materials.",
        images: ["https://picsum.photos/seed/sneaker4/800/800"],
        category: "Outdoor",
        stock: 45,
        createdAt: serverTimestamp()
      }
    ];

    for (const product of products) {
      try {
        await addDoc(collection(db, COLLECTION_NAME), product);
      } catch (error) {
        console.error("Failed to seed product", error);
      }
    }
  }
};
