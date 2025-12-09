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
  last_ping?: string;
  firmware_version?: string;
  wifi_rssi?: number;
  free_heap?: number;
  uptime?: number;
  network_speed?: number;
  temperature?: number;
  connection_type?: string;
  last_error?: string;
  last_error_time?: string;
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
  const [error, setError] = useState<{ type: string; message: string } | null>(null);

  useEffect(() => {
    if (machineId) {
      // Validate machine ID format (should not be empty or just whitespace)
      if (machineId.trim().length === 0) {
        setError({
          type: 'invalid',
          message: 'Invalid Machine ID'
        });
        return;
      }
      fetchMachineAndProducts();
    }

    // Load Razorpay script from official CDN
    const loadScript = () => {
      // Check if already loaded
      if (window.Razorpay) {
        console.log('✅ Razorpay already available');
        setRazorpayLoaded(true);
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        // Remove any existing scripts
        const oldScripts = document.querySelectorAll('script[src*="razorpay"]');
        oldScripts.forEach(s => s.remove());

        const script = document.createElement('script');
        // Load directly from official Razorpay CDN
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.crossOrigin = 'anonymous';
        
        script.onload = () => {
          console.log('✅ Razorpay loaded from official CDN');
          if (window.Razorpay) {
            setRazorpayLoaded(true);
            resolve(true);
          } else {
            const error = new Error('Razorpay object not found after script load');
            console.error('❌', error);
            reject(error);
          }
        };
        
        script.onerror = (error) => {
          console.error('❌ Failed to load Razorpay from official CDN');
          console.error('Please check your internet connection or disable ad blockers');
          setRazorpayLoaded(false);
          reject(error);
        };
        
        document.head.appendChild(script);
      });
    };

    loadScript().catch(err => {
      console.error('❌ Failed to load Razorpay:', err);
      setRazorpayLoaded(false);
    });
  }, [machineId]);

  const fetchMachineAndProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/machines/${machineId}/products`);
      const data = await response.json();
      
      if (!response.ok) {
        // Handle HTTP errors
        if (response.status === 400) {
          setError({
            type: 'invalid',
            message: 'Invalid Machine ID'
          });
        } else if (response.status === 404) {
          setError({
            type: 'not_found',
            message: 'No Such Machine Available'
          });
        } else if (response.status >= 500) {
          setError({
            type: 'server_error',
            message: 'Server Error. Please try again later.'
          });
        } else {
          setError({
            type: 'error',
            message: data.error || 'Failed to load machine data'
          });
        }
        return;
      }
      
      if (!data.success) {
        setError({
          type: 'error',
          message: data.error || 'Failed to load machine data'
        });
        return;
      }

      // Check if machine exists
      if (!data.machine) {
        setError({
          type: 'not_found',
          message: 'No Such Machine Available'
        });
        return;
      }
      
      // Check if machine is truly online (last ping within 2 minutes)
      const machine = data.machine;
      if (machine.last_ping) {
        const lastPingTime = new Date(machine.last_ping).getTime();
        const now = new Date().getTime();
        const twoMinutes = 2 * 60 * 1000;
        machine.asset_online = (now - lastPingTime) < twoMinutes;
      }
      
      setMachine(machine);
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching machine data:', error);
      setError({
        type: 'network_error',
        message: 'Network Error. Please check your connection and try again.'
      });
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
    // Check stock first
    if (item.stock === 0) {
      alert('❌ Out of Stock\n\nThis product is currently unavailable. Please try another product or check back later.');
      return;
    }

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

    // Validate all cart items have stock
    const outOfStockItems: string[] = [];
    for (const [productId, cartItem] of cart.entries()) {
      const product = products.find(p => p.product_id === productId);
      if (!product || product.stock === 0) {
        outOfStockItems.push(cartItem.name);
      } else if (product.stock < cartItem.quantity) {
        outOfStockItems.push(`${cartItem.name} (only ${product.stock} available)`);
      }
    }

    if (outOfStockItems.length > 0) {
      const itemsList = outOfStockItems.map(item => `• ${item}`).join('\n');
      alert(`❌ Cannot Complete Purchase\n\nThe following items are out of stock or have insufficient quantity:\n\n${itemsList}\n\nPlease remove these items from your cart or reduce the quantity.`);
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
        body: JSON.stringify({ amount, machineId: machine?.machine_id }),
      });

      if (!orderRes.ok) {
        const errorData = await orderRes.json();
        console.error('Order creation failed:', errorData);
        
        // Handle offline machine error
        if (errorData.offline) {
          alert(`❌ Machine Offline\n\n${errorData.error}\n\nThe vending machine is currently not responding. Please try again in a few minutes or contact support if the issue persists.`);
          setIsProcessing(false);
          return;
        }
        
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

    // Show error page if there's an error
    if (error) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-gray-50 flex items-center justify-center px-4">
          <div className="max-w-2xl w-full">
            <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-12 text-center border border-gray-100">
              {/* Error Icon */}
              <div className="mb-6">
                {error.type === 'not_found' ? (
                  <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                ) : error.type === 'network_error' ? (
                  <div className="w-24 h-24 mx-auto bg-orange-100 rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Error Message */}
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                {error.message}
              </h1>
              
              <p className="text-gray-600 mb-2">
                {error.type === 'not_found' && (
                  <>Machine ID: <span className="font-mono font-semibold text-gray-900">{machineId}</span> does not exist in our system.</>
                )}
                {error.type === 'network_error' && (
                  <>Unable to connect to the server. Please check your internet connection.</>
                )}
                {error.type === 'server_error' && (
                  <>Our servers are experiencing issues. We're working to fix it.</>
                )}
                {error.type === 'invalid' && (
                  <>The machine ID provided is not valid. Please check and try again.</>
                )}
                {error.type === 'error' && (
                  <>Something went wrong while loading the machine data.</>
                )}
              </p>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                {(error.type === 'network_error' || error.type === 'server_error' || error.type === 'error') && (
                  <button
                    onClick={() => fetchMachineAndProducts()}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl"
                  >
                    Try Again
                  </button>
                )}
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-8 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors border border-gray-300"
                >
                  Go to Home
                </button>
              </div>

              {/* Additional Help */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <p className="text-sm text-gray-500 mb-2">Need help?</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center text-sm">
                  <a href="#contact" className="text-blue-600 hover:text-blue-700 font-medium">
                    Contact Support
                  </a>
                  <span className="hidden sm:inline text-gray-300">|</span>
                  <a href="#about" className="text-blue-600 hover:text-blue-700 font-medium">
                    About Lyra
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              <button 
                onClick={() => window.history.back()}
                className="flex items-center gap-1 sm:gap-2 text-gray-700 hover:text-gray-900 transition-colors min-w-0"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Back</span>
              </button>

              <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-center min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <div className="text-base sm:text-lg font-bold text-gray-900">Lyra</div>
                  <div className="text-[10px] sm:text-xs text-gray-500">Enterprises</div>
                </div>
              </div>

              <button 
                onClick={() => setShowCart(true)}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-w-0 flex-shrink-0"
              >
                <ShoppingCart className="w-5 h-5 flex-shrink-0" />
                <span className="hidden sm:inline">Cart</span>
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
        <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-8 max-w-6xl pb-32">
          {/* Machine Info */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6 border">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 break-words">{machine?.name || machineId}</h1>
            
            <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 lg:gap-6">
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  {machine?.asset_online ? (
                    <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
                      <Wifi className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                    </div>
                  ) : (
                    <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg flex-shrink-0">
                      <WifiOff className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                    </div>
                  )}
                  <span className="text-xs sm:text-sm text-gray-600">Machine State</span>
                </div>
                <div className={`text-base sm:text-lg font-semibold ${machine?.asset_online ? 'text-green-600' : 'text-red-600'}`}>
                  {machine?.asset_online ? 'Online' : 'Offline'}
                </div>
                {machine?.last_ping && (
                  <div className="text-xs text-gray-500 mt-1 break-words">
                    Last: {new Date(machine.last_ping).toLocaleString('en-IN', { 
                      timeZone: 'Asia/Kolkata',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg flex-shrink-0">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-600">Firmware</span>
                </div>
                <div className="text-base sm:text-lg font-semibold text-blue-600">
                  {machine?.firmware_version || 'Unknown'}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg flex-shrink-0">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span className="text-xs sm:text-sm text-gray-600">Customer</span>
                </div>
                <div className="text-base sm:text-lg font-semibold text-gray-900 break-words">
                  {machine?.customer_name || 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Products Section */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border">
            <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Products</h2>
              <div className="flex items-center gap-1.5 sm:gap-2 text-blue-600 flex-shrink-0">
                <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                <span className="text-sm sm:text-base font-semibold">{products.length}</span>
              </div>
            </div>

            {products.length > 0 ? (
              <div className="space-y-4">
                {products.map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-50 rounded-lg p-4 sm:p-6 border hover:shadow-md transition-all"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1 break-words">
                            {item.products.name}
                          </h3>
                          <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-3 line-clamp-2">
                            {item.products.description || 'Premium quality sanitary product'}
                          </p>
                          
                          {/* Low Stock Warning */}
                          {item.stock > 0 && item.stock < 5 && (
                            <div className="flex items-center gap-2 mb-2 sm:mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                              <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span className="text-xs sm:text-sm text-amber-800 font-medium">
                                Only {item.stock} left! Grab yours before it's gone 🔥
                              </span>
                            </div>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                            <div className="text-xl sm:text-2xl font-bold text-gray-900">
                              ₹{parseFloat(item.price).toFixed(0)}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${item.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              <span className={`text-xs sm:text-sm font-medium ${item.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {item.stock > 0 ? `${item.stock} in stock` : 'Out of Stock'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <button
                            onClick={() => toggleFavorite(item.product_id)}
                            className="p-2 sm:p-3 bg-white hover:bg-gray-100 rounded-lg border transition-colors flex-shrink-0"
                          >
                            <Heart
                              className={`w-5 h-5 sm:w-6 sm:h-6 ${
                                favorites.has(item.product_id)
                                  ? 'fill-pink-500 text-pink-500'
                                  : 'text-gray-400'
                              }`}
                            />
                          </button>
                          
                          <button
                            onClick={() => addToCart(item)}
                            disabled={item.stock === 0 || item.is_active === 0 || getTotalItems() >= 3}
                            className={`flex-1 px-4 sm:px-8 py-2.5 sm:py-3 rounded-lg text-sm sm:text-base font-semibold transition-all ${
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

          {/* Machine Health Metrics */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border mt-4 sm:mt-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Health</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* WiFi Signal */}
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="flex items-center gap-2 mb-1">
                  <Wifi className={`w-4 h-4 ${
                    machine?.wifi_rssi == null ? 'text-gray-400' :
                    machine.wifi_rssi > -50 ? 'text-green-600' :
                    machine.wifi_rssi > -70 ? 'text-yellow-600' : 'text-red-600'
                  }`} />
                  <span className="text-xs text-gray-600">WiFi Signal</span>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {machine?.wifi_rssi != null ? `${machine.wifi_rssi} dBm` : 'N/A'}
                </div>
                {machine?.wifi_rssi != null && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {machine.wifi_rssi > -50 ? 'Excellent' :
                     machine.wifi_rssi > -70 ? 'Good' : 'Weak'}
                  </div>
                )}
              </div>

              {/* Stock Level */}
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="flex items-center gap-2 mb-1">
                  <svg className={`w-4 h-4 ${
                    (() => {
                      const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
                      return totalStock === 0 ? 'text-gray-400' :
                             totalStock > 20 ? 'text-green-600' :
                             totalStock > 10 ? 'text-yellow-600' : 'text-red-600';
                    })()
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span className="text-xs text-gray-600">Stock Level</span>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {(() => {
                    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
                    return `${totalStock} units`;
                  })()}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {(() => {
                    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
                    return totalStock > 20 ? 'Full' :
                           totalStock > 10 ? 'Medium' :
                           totalStock > 0 ? 'Low' : 'Empty';
                  })()}
                </div>
              </div>

              {/* Uptime */}
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-gray-600">Uptime</span>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {machine?.uptime != null ? (
                    (() => {
                      const hours = Math.floor(machine.uptime / 3600000);
                      const days = Math.floor(hours / 24);
                      if (days > 0) return `${days}d ${hours % 24}h`;
                      if (hours > 0) return `${hours}h ${Math.floor((machine.uptime % 3600000) / 60000)}m`;
                      return `${Math.floor(machine.uptime / 60000)}m`;
                    })()
                  ) : 'N/A'}
                </div>
              </div>

              {/* Memory */}
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  <span className="text-xs text-gray-600">Free Memory</span>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {machine?.free_heap != null ? `${(machine.free_heap / 1024).toFixed(1)} KB` : 'N/A'}
                </div>
                {machine?.free_heap != null && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {machine.free_heap > 100000 ? 'Healthy' :
                     machine.free_heap > 50000 ? 'Normal' : 'Low'}
                  </div>
                )}
              </div>

              {/* Network Speed */}
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="flex items-center gap-2 mb-1">
                  <svg className={`w-4 h-4 ${
                    machine?.network_speed == null ? 'text-gray-400' :
                    machine.network_speed > 50 ? 'text-green-600' :
                    machine.network_speed > 20 ? 'text-yellow-600' : 'text-red-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-xs text-gray-600">Network Speed</span>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {machine?.network_speed != null ? `${machine.network_speed.toFixed(1)} KB/s` : 'N/A'}
                </div>
                {machine?.network_speed != null && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {machine.network_speed > 50 ? 'Fast' :
                     machine.network_speed > 20 ? 'Good' : 'Slow'}
                  </div>
                )}
              </div>

              {/* Temperature */}
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="flex items-center gap-2 mb-1">
                  <svg className={`w-4 h-4 ${
                    machine?.temperature == null ? 'text-gray-400' :
                    machine.temperature > 60 ? 'text-red-600' :
                    machine.temperature > 45 ? 'text-orange-600' :
                    machine.temperature > 30 ? 'text-yellow-600' : 'text-blue-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-xs text-gray-600">Temperature</span>
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {machine?.temperature != null ? `${machine.temperature.toFixed(1)}°C` : 'N/A'}
                </div>
                {machine?.temperature != null && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {machine.temperature > 60 ? 'Critical' :
                     machine.temperature > 45 ? 'Hot' :
                     machine.temperature > 30 ? 'Warm' : 'Normal'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sticky Pay Now Button */}
          {cart.size > 0 && (
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-20">
              <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-4 max-w-6xl">
                <div className="flex items-center justify-between gap-2 sm:gap-4">
                  <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    <div className="bg-blue-50 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-blue-200">
                      <div className="text-xs text-gray-600 font-medium">Items</div>
                      <div className="text-base sm:text-xl font-bold text-blue-600">
                        {getTotalItems()}/3
                      </div>
                    </div>
                    <div className="bg-blue-50 px-3 sm:px-6 py-1.5 sm:py-2 rounded-lg border border-blue-200">
                      <div className="text-xs text-gray-600 font-medium">Total</div>
                      <div className="text-lg sm:text-2xl font-bold text-blue-600">
                        ₹{getTotalAmount().toFixed(0)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <button
                      onClick={() => setShowCart(true)}
                      className="hidden sm:block px-4 sm:px-6 py-2 sm:py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg font-semibold transition-all text-sm sm:text-base"
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
        <Footer />
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

