/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Search, 
  User, 
  X, 
  Plus, 
  Minus, 
  Trash2, 
  ChevronRight,
  ArrowRight,
  Menu,
  Github
} from 'lucide-react';
import { auth, db } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, onSnapshot, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { productServices } from './lib/services';
import { cn } from './lib/utils';
import type { Product, CartItem, UserProfile } from './types';

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const [authError, setAuthError] = useState<string | null>(null);

  // Auth State
  useEffect(() => {
    // Shorter safety timer to prevent UI lock
    const safetyTimer = setTimeout(() => {
      setAuthLoading(false);
    }, 4000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Rapid race for user profile
          const userDoc = await Promise.race([
            getDoc(doc(db, 'users', firebaseUser.uid)),
            new Promise<null>((_, reject) => setTimeout(() => reject('timeout'), 2500))
          ]).catch(() => null) as any;
          
          if (!userDoc || !userDoc.exists()) {
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || '',
              isAdmin: true 
            };
            setDoc(doc(db, 'users', firebaseUser.uid), newUser).catch(() => null);
            setUser(newUser);
          } else {
            setUser({ uid: firebaseUser.uid, ...userDoc.data(), isAdmin: true } as UserProfile);
          }
        } catch (error) {
          console.error("Auth sync error", error);
        } finally {
          clearTimeout(safetyTimer);
          setAuthLoading(false);
        }
      } else {
        clearTimeout(safetyTimer);
        setUser(null);
        setAuthLoading(false);
      }
    });
    return () => {
      unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  // Products Data
  useEffect(() => {
    // Safety fallback for slow connections
    const backupTimer = setTimeout(() => {
      setProductsLoading(false);
    }, 6000);

    const unsubscribe = productServices.subscribeProducts((data) => {
      clearTimeout(backupTimer);
      if (data.length === 0) {
        productServices.seedProducts();
      }
      setProducts(data);
      setProductsLoading(false);
    });
    return () => {
      unsubscribe();
      clearTimeout(backupTimer);
    };
  }, []);

  // Cart Data
  useEffect(() => {
    if (!user) {
      setCartItems([]);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'cart'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CartItem));
      setCartItems(items);
    });
    return () => unsubscribe();
  }, [user]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Google Login failed", error);
      setAuthLoading(false);
      if (error.code === 'auth/popup-blocked') {
        setAuthError("Popup blocked! Please allow popups.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        setAuthError(null);
      } else {
        setAuthError("Google Sign-In failed. Please check your Firebase settings.");
      }
    }
  };

  const handleLogout = () => signOut(auth);

  const addToCart = async (product: Product) => {
    if (!user) {
      handleGoogleLogin();
      return;
    }
    const existing = cartItems.find(item => item.productId === product.id);
    if (existing) {
      const itemRef = doc(db, 'users', user.uid, 'cart', existing.id);
      await updateDoc(itemRef, { quantity: existing.quantity + 1 });
    } else {
      await addDoc(collection(db, 'users', user.uid, 'cart'), {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.images[0]
      });
    }
    setCartOpen(true);
  };

  const updateQuantity = async (itemId: string, delta: number) => {
    if (!user) return;
    const item = cartItems.find(i => i.id === itemId);
    if (!item) return;
    const newQty = item.quantity + delta;
    const itemRef = doc(db, 'users', user.uid, 'cart', itemId);
    if (newQty <= 0) {
      await deleteDoc(itemRef);
    } else {
      await updateDoc(itemRef, { quantity: newQty });
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'cart', itemId));
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.brand.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const cartTotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const categories = ["All", "Basketball", "Lifestyle", "Running", "Classic", "Outdoor"];

  return (
    <div className="h-screen bg-gray-50 text-slate-900 flex flex-col font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between z-50 shadow-sm shrink-0">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => {setActiveCategory("All"); setSearchTerm("");}}>
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-xl italic tracking-tighter">JP</span>
            </div>
            <h1 id="logo" className="text-2xl font-black text-slate-800 tracking-tight">SNEAKERS</h1>
          </div>
          <div className="relative w-96 hidden lg:block">
            <input 
              type="text" 
              placeholder="Search for shoes, brands, or styles..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-full text-sm focus:ring-2 focus:ring-red-600 focus:bg-white transition-all outline-none"
            />
            <Search className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden xl:flex gap-4 text-xs font-semibold text-gray-600">
            <a href="#" className="hover:text-red-600 transition-colors">SELL ON JP</a>
            <a href="#" className="hover:text-red-600 transition-colors">DOWNLOAD APP</a>
            <a href="#" className="hover:text-red-600 transition-colors">HELP CENTER</a>
          </div>
          <div className="hidden xl:block h-6 w-[1px] bg-gray-200"></div>
          
          <div className="flex items-center gap-4">
            {/* Action Role Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner border border-gray-200">
              <button 
                onClick={() => setActiveCategory("All")}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  activeCategory !== "Admin" 
                    ? "bg-white shadow-sm text-slate-800" 
                    : "text-gray-400 hover:text-slate-600"
                )}
              >
                Buyer
              </button>
              <button 
                onClick={() => {
                  if (!user) handleGoogleLogin();
                  else setActiveCategory("Admin");
                }}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                  activeCategory === "Admin" 
                    ? "bg-red-600 shadow-sm text-white" 
                    : "text-gray-400 hover:text-slate-600"
                )}
              >
                {activeCategory === "Admin" && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
                Seller
              </button>
            </div>

            <button 
              onClick={() => setCartOpen(true)}
              className="relative group p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ShoppingBag className="w-6 h-6 text-slate-700 group-hover:text-red-600" />
              {cartItems.length > 0 && (
                <span className="absolute top-1 right-1 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {cartItems.reduce((a, b) => a + b.quantity, 0)}
                </span>
              )}
            </button>

            {/* Auth Buttons */}
            {!user && (
              <button 
                onClick={handleGoogleLogin}
                className={cn(
                  "bg-red-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-2",
                  authLoading ? "opacity-90" : "hover:bg-red-700 hover:scale-105 active:scale-95"
                )}
              >
                {authLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  "Sign In with Google"
                )}
              </button>
            )}

            {user && (
              <div className="flex items-center gap-3 pl-2 border-l border-gray-200">
                <div className="text-right hidden sm:block">
                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter leading-none">User</p>
                  <p className="text-[10px] font-bold text-slate-800 leading-tight">
                    {user.displayName || user.email || 'Member'}
                  </p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-2 p-1 hover:bg-red-50 rounded-full transition-all group"
                  title="Sign Out"
                >
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-gray-200 group-hover:border-red-200" />
                  ) : (
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-500" />
                    </div>
                  )}
                </button>
              </div>
            )}
            
            {authLoading && !user && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg animate-pulse">
                <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Verifying session...</span>
              </div>
            )}
          </div>
          {authError && <span className="absolute top-full right-6 text-[9px] text-red-500 font-bold uppercase py-1 bg-white/80 backdrop-blur px-2 rounded-b border-x border-b border-red-100">{authError}</span>}
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Side Filter Bar */}
        <aside className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col gap-8 shrink-0 hidden md:flex">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Categories</h3>
            <ul className="space-y-1">
              {categories.map(cat => (
                <li key={cat}>
                  <button 
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "w-full flex items-center justify-between text-sm py-2 px-3 rounded-lg transition-all",
                      activeCategory === cat 
                        ? "bg-red-50 text-red-600 font-bold" 
                        : "text-gray-600 hover:bg-gray-50 hover:text-red-600"
                    )}
                  >
                    <span>{cat}</span>
                    {activeCategory === cat && <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Price Range</h3>
            <div className="flex items-center gap-2">
              <input type="text" placeholder="฿ MIN" className="w-full p-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-600/20 focus:border-red-600 transition-all outline-none" />
              <div className="w-4 h-[1px] bg-gray-300"></div>
              <input type="text" placeholder="฿ MAX" className="w-full p-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-600/20 focus:border-red-600 transition-all outline-none" />
            </div>
            <button className="w-full mt-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg uppercase tracking-tighter hover:bg-red-600 transition-colors">Apply Filter</button>
          </div>

          <div className="mt-auto">
            <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
              <p className="text-[10px] text-orange-600 font-bold uppercase mb-1 flex items-center gap-1">
                <Plus size={10} /> Special Offer
              </p>
              <p className="text-sm font-bold text-slate-800 leading-tight mb-3">Join JP Elite for 20% Discount</p>
              <button className="text-[10px] font-bold text-white bg-orange-500 px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors shadow-sm uppercase tracking-wider">UPGRADE NOW</button>
            </div>
          </div>
        </aside>

        {/* Product Feed */}
        <main className="flex-1 flex flex-col overflow-y-auto p-6 md:p-8 bg-gray-50">
          {/* Promotions/Banner Section */}
          <div className="min-h-[160px] w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-800 mb-8 flex items-center justify-between px-10 relative overflow-hidden group">
            <div className="z-10 py-6">
              <h2 className="text-3xl font-black text-white italic tracking-tight mb-1">SUMMER KICK-OFF</h2>
              <p className="text-red-100 text-sm mb-5 font-medium">UP TO 50% OFF ON SELECTED BASKETBALL MODELS</p>
              <button className="bg-white text-red-700 px-8 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest shadow-lg hover:scale-105 transition-transform">Shop Now</button>
            </div>
            <div className="absolute -right-12 -bottom-16 opacity-10 transform -rotate-12 group-hover:scale-110 transition-transform duration-1000">
              <ShoppingBag size={300} color="white" strokeWidth={1} />
            </div>
          </div>

          {/* Section Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tight">
                {activeCategory === "Admin" ? "Seller Dashboard" : (activeCategory === "All" ? "Recommended For You" : activeCategory)}
              </h2>
              <div className="h-2 w-2 rounded-full bg-red-600"></div>
              <span className="text-xs text-gray-400 font-medium">
                {activeCategory === "Admin" ? "Inventory Management" : `${filteredProducts.length} Results`}
              </span>
            </div>
          </div>

          {/* Product Grid or Admin View */}
          <div className="flex-1">
            {activeCategory === "Admin" ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Inventory Overview</h3>
                    <p className="text-sm text-gray-500">Manage your premium sneaker stock</p>
                  </div>
                  <button 
                    onClick={() => productServices.seedProducts()}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <Plus size={16} /> Fast-Sync Stock
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] uppercase tracking-widest text-gray-400">
                        <th className="pb-4 font-black">Product</th>
                        <th className="pb-4 font-black">Category</th>
                        <th className="pb-4 font-black">Price</th>
                        <th className="pb-4 font-black">Stock</th>
                        <th className="pb-4 font-black text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {products.map(product => (
                        <tr key={product.id} className="group hover:bg-gray-50/50 transition-colors">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <img src={product.images[0]} className="w-10 h-10 rounded bg-gray-100 object-cover" />
                              <span className="font-bold text-sm text-slate-800">{product.name}</span>
                            </div>
                          </td>
                          <td className="py-4 text-xs font-medium text-gray-500 uppercase">{product.category}</td>
                          <td className="py-4 font-bold text-red-600">฿{product.price.toLocaleString()}</td>
                          <td className="py-4">
                            <span className={cn(
                              "px-2 py-1 rounded text-[10px] font-black uppercase",
                              product.stock < 20 ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-600"
                            )}>
                              {product.stock} Units
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <button className="text-gray-400 hover:text-red-600 transition-colors p-2">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {productsLoading ? (
                  Array(8).fill(0).map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex flex-col gap-4 animate-pulse">
                      <div className="w-full aspect-square bg-gray-200 rounded-lg" />
                      <div className="h-4 bg-gray-200 rounded w-2/3" />
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                    </div>
                  ))
                ) : (
                  filteredProducts.map((product, idx) => (
                    <motion.div 
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-xl transition-all group flex flex-col relative"
                    >
                      <div className="w-full aspect-square bg-gray-100 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                        <span className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded z-10 shadow-sm">MALL</span>
                        {product.stock < 25 && (
                          <span className="absolute top-2 right-2 bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded z-10 shadow-sm uppercase tracking-tighter">LOW STOCK</span>
                        )}
                        <img 
                          src={product.images[0]} 
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                        
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                          }}
                          className="absolute bottom-2 left-2 right-2 bg-slate-900 text-white py-3 rounded-lg opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all flex items-center justify-center gap-2 uppercase font-bold text-[10px] tracking-widest z-10 hover:bg-red-600"
                        >
                          <Plus size={14} /> Add To Cart
                        </button>
                      </div>

                      <div className="flex flex-col flex-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{product.brand}</p>
                        <h4 className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug group-hover:text-red-600 transition-colors">{product.name}</h4>
                        
                        <div className="mt-auto pt-4 flex flex-col gap-2">
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold text-red-600">฿</span>
                            <span className="text-2xl font-black text-red-600 tracking-tight leading-none">{product.price.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="flex text-yellow-400 text-xs">★★★★★</div>
                              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">1.2k+ Sold</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Footer Status Bar */}
      <footer className="bg-slate-900 text-white h-10 px-6 flex items-center justify-between text-[10px] font-medium shrink-0">
        <div className="flex gap-6 items-center">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> 
            Server Status: <span className="text-green-400">Stable</span>
          </span>
          <span className="opacity-60 hidden sm:block">Currency: THB (฿)</span>
          <span className="opacity-60 hidden sm:block">Region: Thailand (JP Warehouse)</span>
        </div>
        <div className="flex gap-6 items-center">
          <a href="#" className="hover:text-red-400 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-red-400 transition-colors">Terms of Service</a>
          <span className="opacity-40 uppercase tracking-widest hidden md:block">© 2026 JP SNEAKERS GLOBAL</span>
        </div>
      </footer>

      {/* Cart Sidebar */}
      <AnimatePresence>
        {cartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCartOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-screen w-full max-w-sm bg-white border-l border-gray-200 z-[110] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-600 rounded-md flex items-center justify-center">
                    <ShoppingBag size={16} color="white" />
                  </div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Your Cart</h2>
                </div>
                <button onClick={() => setCartOpen(false)} className="w-8 h-8 flex items-center justify-center hover:bg-red-50 hover:text-red-600 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-10">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <ShoppingBag size={32} className="text-gray-200" />
                    </div>
                    <p className="text-slate-800 font-bold uppercase tracking-tight">Your cart is empty</p>
                    <p className="text-xs text-gray-400 mt-2 leading-relaxed">Add some of our premium sneakers to your collection!</p>
                    <button 
                      onClick={() => setCartOpen(false)}
                      className="mt-6 text-xs font-black text-red-600 hover:underline underline-offset-4 tracking-widest uppercase"
                    >
                      Continue Shopping
                    </button>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="flex gap-4 group p-2 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden border border-gray-100 shrink-0">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="text-xs font-bold text-slate-800 leading-snug italic uppercase tracking-tight line-clamp-1">{item.name}</h3>
                            <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-600 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <p className="text-xs font-bold text-red-600 mt-1">฿{item.price.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center bg-white border border-gray-200 rounded-md shadow-sm">
                            <button onClick={() => updateQuantity(item.id, -1)} className="p-1 px-2 hover:text-red-600 transition-colors">
                              <Minus size={10} />
                            </button>
                            <span className="w-8 text-center text-[10px] font-bold text-slate-800">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)} className="p-1 px-2 hover:text-red-600 transition-colors">
                              <Plus size={10} />
                            </button>
                          </div>
                          <p className="font-black text-slate-800 text-sm tracking-tight">฿{(item.price * item.quantity).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 bg-slate-900 border-t border-gray-800">
                <div className="flex justify-between items-end mb-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subtotal</span>
                    <span className="text-xs text-red-400 font-bold uppercase tracking-tighter">Free Shipping Included</span>
                  </div>
                  <p className="text-3xl font-black text-white italic tracking-tighter">฿{cartTotal.toLocaleString()}</p>
                </div>
                <button 
                  disabled={cartItems.length === 0}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest shadow-lg disabled:opacity-50 disabled:grayscale transition-all"
                >
                  CHECKOUT NOW <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
