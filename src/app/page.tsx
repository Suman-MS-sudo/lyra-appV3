'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShoppingCart, Wifi, WifiOff, Heart, Package, X, Minus, Plus } from 'lucide-react';
import { Header } from '@/components/landing/header';
import { HeroSection } from '@/components/landing/hero-section';
import { AboutSection } from '@/components/landing/about-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { ContactSection } from '@/components/landing/contact-section';
import { Footer } from '@/components/landing/footer';

// Load Razorpay script
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image_url?: string;
}

interface Machine {
  id: string;
  name: string;
  machine_id: string;
  customer_name: string;
  status: string;
  asset_online: boolean;
  firmware_version?: string;
}

interface MachineProduct {
  id: string;
  product_id: string;
  stock: number;
  price: string;
  is_active: number;
  products: Product;
}

interface CartItem {
  product_id: string;
  name: string;
  price: string;
  quantity: number;
  stock: number;
}

export default function Home() {
  const searchParams = useSearchParams();
  const machineId = searchParams.get('value');
  
  const [machine, setMachine] = useState<Machine | null>(null);
  const [products, setProducts] = useState<MachineProduct[]>([]);
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  useEffect(() => {
    if (machineId) {
      fetchMachineAndProducts();
    }

    // Load Razorpay script from local copy (CDN often blocked by ad blockers)
    const loadScript = () => {
      // Check if already loaded
      if (window.Razorpay) {
        console.log('Razorpay already available');
        setRazorpayLoaded(true);
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        // Remove any existing scripts
        const oldScripts = document.querySelectorAll('script[src*="razorpay"]');
        oldScripts.forEach(s => s.remove());

        const script = document.createElement('script');
        // Try local script first (works even with ad blockers)
        script.src = '/razorpay-checkout.js';
        script.async = true;
        
        script.onload = () => {
          console.log('Razorpay script loaded from local source');
          if (window.Razorpay) {
            setRazorpayLoaded(true);
            resolve(true);
          } else {
            console.warn('Script loaded but Razorpay object not found, trying CDN...');
            // Fallback to CDN
            loadFromCDN().then(resolve).catch(reject);
          }
        };
        
        script.onerror = (error) => {
          console.warn('Local script failed, trying CDN:', error);
          // Fallback to CDN
          loadFromCDN().then(resolve).catch(reject);
        };
        
        document.head.appendChild(script);
      });
    };

    const loadFromCDN = () => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.crossOrigin = 'anonymous';
        
        script.onload = () => {
          console.log('Razorpay loaded from CDN');
          if (window.Razorpay) {
            setRazorpayLoaded(true);
            resolve(true);
          } else {
            reject(new Error('CDN loaded but Razorpay not available'));
          }
        };
        
        script.onerror = (error) => {
          console.error('CDN load failed. Razorpay is blocked.');
          console.error('Please disable ad blocker or check network settings.');
          setRazorpayLoaded(false);
          reject(error);
        };
        
        document.head.appendChild(script);
      });
    };

    loadScript().catch(err => {
      console.error('Failed to load Razorpay from all sources:', err);
      setRazorpayLoaded(false);
    });
  }, [machineId]);

  const fetchMachineAndProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/machines/${machineId}/products`);
      const data = await response.json();
      
      if (data.success) {
        setMachine(data.machine);
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Error fetching machine data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId);
      } else {
        newFavorites.add(productId);
      }
      return newFavorites;
    });
  };

  const getTotalItems = () => {
    return Array.from(cart.values()).reduce((sum, item) => sum + item.quantity, 0);
  };

  const getTotalAmount = () => {
    return Array.from(cart.values()).reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity,
      0
    );
  };

  const addToCart = (item: MachineProduct) => {
    const totalItems = getTotalItems();
    
    if (totalItems >= 3) {
      alert('Maximum 3 items allowed per purchase');
      return;
    }

    setCart(prev => {
      const newCart = new Map(prev);
      const existing = newCart.get(item.product_id);
      
      if (existing) {
        if (existing.quantity >= item.stock) {
          alert('Cannot add more than available stock');
          return prev;
        }
        // Create new object to trigger React update
        newCart.set(item.product_id, {
          ...existing,
          quantity: existing.quantity + 1,
        });
      } else {
        newCart.set(item.product_id, {
          product_id: item.product_id,
          name: item.products.name,
          price: item.price,
          quantity: 1,
          stock: item.stock,
        });
      }
      
      return newCart;
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    const totalItems = getTotalItems();
    
    if (delta > 0 && totalItems >= 3) {
      alert('Maximum 3 items allowed per purchase');
      return;
    }

    setCart(prev => {
      const newCart = new Map(prev);
      const item = newCart.get(productId);
      
      if (item) {
        const newQty = item.quantity + delta;
        
        if (newQty <= 0) {
          newCart.delete(productId);
        } else if (newQty <= item.stock) {
          // Create new object to trigger React update
          newCart.set(productId, {
            ...item,
            quantity: newQty,
          });
        } else {
          alert('Cannot exceed available stock');
        }
      }
      
      return newCart;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const newCart = new Map(prev);
      newCart.delete(productId);
      return newCart;
    });
  };

  const handleCheckout = async () => {
    if (cart.size === 0) {
      alert('Cart is empty');
      return;
    }

    // Get API key from env or fallback
    const apiKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_live_lmKnnhDWFEBx4e';
    
    // Debug: Log environment variable
    console.log('NEXT_PUBLIC_RAZORPAY_KEY_ID from env:', process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID);
    console.log('Using API key:', apiKey);

    // Check if Razorpay is loaded
    if (!window.Razorpay) {
      console.error('Razorpay not loaded. razorpayLoaded:', razorpayLoaded);
      
      const message = `Payment gateway could not be loaded.\n\nPossible causes:\n• Ad blocker blocking payment scripts\n• Firewall blocking Razorpay CDN\n• Network connectivity issues\n\nPlease try:\n1. Disable ad blocker for this site\n2. Check your internet connection\n3. Refresh the page\n4. Try a different browser`;
      
      alert(message);
      return;
    }

    console.log('Initiating checkout with Razorpay key:', apiKey);

    setIsProcessing(true);

    try {
      const amount = getTotalAmount();
      
      console.log('Cart contents:', Array.from(cart.values()));
      console.log('Total amount:', amount);

      if (!amount || amount <= 0) {
        alert('Cannot process payment: Total amount is ₹0.\n\nThis product needs to have a price set. Please contact the administrator to set product prices.');
        setIsProcessing(false);
        return;
      }

      // Create Razorpay order
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      if (!orderRes.ok) {
        const errorData = await orderRes.json();
        console.error('Order creation failed:', errorData);
        throw new Error(errorData.error || `Server error: ${orderRes.status}`);
      }

      const orderData = await orderRes.json();

      if (!orderData.success) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      // Initialize Razorpay checkout
      const options = {
        key: apiKey,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        name: 'Lyra Enterprises',
        description: `Purchase from ${machine?.name || machineId}`,
        image: '/logo.png',
        handler: async function (response: any) {
          // Verify payment
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              machineId: machine?.machine_id,
              products: Array.from(cart.values()),
            }),
          });

          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            alert('Payment successful! Your order has been placed.');
            setCart(new Map());
            setShowCart(false);
            fetchMachineAndProducts(); // Refresh stock
          } else {
            alert('Payment verification failed');
          }
        },
        prefill: {
          name: '',
          email: '',
          contact: '',
        },
        theme: {
          color: '#2563eb',
        },
        modal: {
          ondismiss: function() {
            setIsProcessing(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      
      rzp.on('payment.failed', function (response: any) {
        alert('Payment failed: ' + response.error.description);
        setIsProcessing(false);
      });

      rzp.open();
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert('Failed to initiate payment: ' + (error.message || 'Unknown error'));
      setIsProcessing(false);
    }
  };

  // Show purchase page if machine ID is provided
  if (machineId) {
    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-xl">Loading...</p>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => window.history.back()}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">Lyra</div>
                  <div className="text-xs text-gray-500">Enterprises</div>
                </div>
              </div>

              <button 
                onClick={() => setShowCart(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <ShoppingCart className="w-5 h-5" />
                Cart
                {getTotalItems() > 0 && (
                  <span className="bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {getTotalItems()}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-6 py-8 max-w-6xl pb-32">
          {/* Machine Info */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">{machine?.name || machineId}</h1>
            
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center gap-3 mb-2">
                  {machine?.asset_online ? (
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Wifi className="w-5 h-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="p-2 bg-red-100 rounded-lg">
                      <WifiOff className="w-5 h-5 text-red-600" />
                    </div>
                  )}
                  <span className="text-sm text-gray-600">Machine State</span>
                </div>
                <div className={`text-lg font-semibold ${machine?.asset_online ? 'text-green-600' : 'text-red-600'}`}>
                  {machine?.asset_online ? 'Online' : 'Offline'}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-600">Firmware Version</span>
                </div>
                <div className="text-lg font-semibold text-blue-600">
                  {machine?.firmware_version || 'Unknown'}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-600">Customer Name</span>
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  {machine?.customer_name || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Available Products</h2>
              <div className="flex items-center gap-2 text-blue-600">
                <Heart className="w-5 h-5 fill-current" />
                <span className="font-semibold">{products.length} items</span>
              </div>
            </div>

            {products.length > 0 ? (
              <div className="space-y-4">
                {products.map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-50 rounded-lg p-6 border hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Package className="w-8 h-8 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold text-gray-900 mb-1">
                              {item.products.name}
                            </h3>
                            <p className="text-gray-600 text-sm mb-3">
                              {item.products.description || 'Premium quality sanitary product'}
                            </p>
                            <div className="flex items-center gap-4">
                              <div className="text-2xl font-bold text-gray-900">
                                ₹{parseFloat(item.price).toFixed(0)}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${item.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className={`text-sm font-medium ${item.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {item.stock > 0 ? `${item.stock} in stock` : 'Out of Stock'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleFavorite(item.product_id)}
                            className="p-3 bg-white hover:bg-gray-100 rounded-lg border transition-colors"
                          >
                            <Heart
                              className={`w-6 h-6 ${
                                favorites.has(item.product_id)
                                  ? 'fill-pink-500 text-pink-500'
                                  : 'text-gray-400'
                              }`}
                            />
                          </button>
                          
                          <button
                            onClick={() => addToCart(item)}
                            disabled={item.stock === 0 || item.is_active === 0 || getTotalItems() >= 3}
                            className={`flex-1 px-8 py-3 rounded-lg font-semibold transition-all ${
                              item.stock === 0 || item.is_active === 0 || getTotalItems() >= 3
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {item.stock === 0 ? 'Out of Stock' : getTotalItems() >= 3 ? 'Cart Full' : 'Add to Cart'}
                          </button>
                        </div>

                        {/* Quantity Counter */}
                        {cart.has(item.product_id) && (
                          <div className="flex items-center justify-center gap-3 bg-white rounded-lg p-2 border">
                            <button
                              onClick={() => updateQuantity(item.product_id, -1)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Minus className="w-5 h-5 text-gray-700" />
                            </button>
                            <div className="flex items-center gap-2 min-w-[80px] justify-center">
                              <span className="text-gray-900 font-bold text-lg">
                                {cart.get(item.product_id)?.quantity || 0}
                              </span>
                              <span className="text-gray-500 text-sm">in cart</span>
                            </div>
                            <button
                              onClick={() => updateQuantity(item.product_id, 1)}
                              disabled={getTotalItems() >= 3 || (cart.get(item.product_id)?.quantity || 0) >= item.stock}
                              className={`p-2 rounded-lg transition-colors ${
                                getTotalItems() >= 3 || (cart.get(item.product_id)?.quantity || 0) >= item.stock
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:bg-gray-100'
                              }`}
                            >
                              <Plus className="w-5 h-5 text-gray-700" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Package className="w-20 h-20 mx-auto mb-4 text-gray-300" />
                <p className="text-xl font-medium text-gray-900 mb-2">No products available</p>
                <p className="text-gray-500">This machine has no products assigned yet</p>
              </div>
            )}
          </div>

          {/* Sticky Pay Now Button */}
          {cart.size > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-20">
              <div className="container mx-auto px-6 py-4 max-w-6xl">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                      <div className="text-xs text-gray-600 font-medium">Items in Cart</div>
                      <div className="text-xl font-bold text-blue-600">
                        {getTotalItems()} / 3
                      </div>
                    </div>
                    <div className="bg-blue-50 px-6 py-2 rounded-lg border border-blue-200">
                      <div className="text-xs text-gray-600 font-medium">Total Amount</div>
                      <div className="text-2xl font-bold text-blue-600">
                        ₹{getTotalAmount().toFixed(0)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowCart(true)}
                      className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg font-semibold transition-all"
                    >
                      View Cart
                    </button>
                    <button
                      onClick={handleCheckout}
                      disabled={isProcessing || !razorpayLoaded}
                      className={`px-8 py-3 rounded-lg font-bold text-lg transition-all ${
                        isProcessing || !razorpayLoaded
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                      }`}
                    >
                      {isProcessing ? 'Processing...' : !razorpayLoaded ? 'Loading Payment Gateway...' : `Pay Now ₹${getTotalAmount().toFixed(0)}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cart Modal */}
          {showCart && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="w-6 h-6 text-blue-600" />
                    <h2 className="text-2xl font-bold text-gray-900">Your Cart</h2>
                    <span className="bg-blue-100 text-blue-600 text-sm font-bold px-3 py-1 rounded-full">
                      {getTotalItems()} / 3
                    </span>
                  </div>
                  <button
                    onClick={() => setShowCart(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-600" />
                  </button>
                </div>

                {/* Cart Items */}
                <div className="p-6 overflow-y-auto max-h-[50vh]">
                  {cart.size === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingCart className="w-20 h-20 mx-auto mb-4 text-gray-300" />
                      <p className="text-xl font-medium text-gray-900 mb-2">Your cart is empty</p>
                      <p className="text-gray-500">Add up to 3 items to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Array.from(cart.values()).map((item) => (
                        <div
                          key={item.product_id}
                          className="bg-gray-50 rounded-lg p-4 border"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                {item.name}
                              </h3>
                              <p className="text-gray-600 text-sm">
                                ₹{parseFloat(item.price).toFixed(0)} × {item.quantity} = ₹
                                {(parseFloat(item.price) * item.quantity).toFixed(0)}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Quantity Controls */}
                              <div className="flex items-center gap-2 bg-white rounded-lg p-1 border">
                                <button
                                  onClick={() => updateQuantity(item.product_id, -1)}
                                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                                >
                                  <Minus className="w-4 h-4 text-gray-700" />
                                </button>
                                <span className="text-gray-900 font-semibold min-w-[2rem] text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateQuantity(item.product_id, 1)}
                                  disabled={getTotalItems() >= 3 || item.quantity >= item.stock}
                                  className={`p-1 rounded transition-colors ${
                                    getTotalItems() >= 3 || item.quantity >= item.stock
                                      ? 'opacity-50 cursor-not-allowed'
                                      : 'hover:bg-gray-100'
                                  }`}
                                >
                                  <Plus className="w-4 h-4 text-gray-700" />
                                </button>
                              </div>

                              {/* Remove Button */}
                              <button
                                onClick={() => removeFromCart(item.product_id)}
                                className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <X className="w-5 h-5 text-red-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {cart.size > 0 && (
                  <div className="p-6 border-t bg-gray-50">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-lg text-gray-700">Total Amount</span>
                      <span className="text-3xl font-bold text-gray-900">
                        ₹{getTotalAmount().toFixed(0)}
                      </span>
                    </div>
                    <button
                      onClick={handleCheckout}
                      disabled={isProcessing}
                      className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                        isProcessing
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                      } text-white shadow-lg`}
                    >
                      {isProcessing ? 'Processing...' : `Pay ₹${getTotalAmount().toFixed(0)}`}
                    </button>
                    <p className="text-center text-gray-500 text-sm mt-3">
                      Secure payment powered by Razorpay
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
      </>
    );
  }

  // Show landing page if no machine ID
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        <HeroSection />
        <AboutSection />
        <FeaturesSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}

