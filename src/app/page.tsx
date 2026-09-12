'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShoppingCart, Heart, Package, X, Minus, Plus } from 'lucide-react';
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
  rfid_enabled?: boolean;
  stock_level?: number;
  max_capacity?: number;
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

function HomeContent() {
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
      
      // Check if machine is truly online (last ping within 10 minutes)
      // ESP32 sends pings every 5 minutes, so 10 min tolerance is reasonable
      const machine = data.machine;
      if (machine.last_ping) {
        const lastPingTime = new Date(machine.last_ping).getTime();
        const now = new Date().getTime();
        const tenMinutes = 10 * 60 * 1000;
        machine.asset_online = (now - lastPingTime) < tenMinutes;
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
          color: '#0071e3',
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-white">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-[#1d1d1f] mb-8">
              <svg className="w-8 h-8" viewBox="0 0 40 40" fill="none">
                <ellipse cx="20" cy="22" rx="13" ry="9" fill="rgba(255,255,255,0.30)" />
                <ellipse cx="20" cy="22" rx="8" ry="5" fill="rgba(255,255,255,0.25)" />
                <path d="M20 10 C20 10 26 16 26 21 A6 6 0 0 1 14 21 C14 16 20 10 20 10Z" fill="rgba(255,255,255,0.65)" />
              </svg>
            </div>

            <p className="text-2xl font-semibold tracking-tight text-[#1d1d1f] mb-1">Lyra Care</p>
            <p className="text-sm mb-10 text-[#6e6e73]">Smart hygiene access, anytime.</p>

            <div className="flex items-center gap-2">
              {[0, 150, 300].map((delay) => (
                <div
                  key={delay}
                  className="w-1.5 h-1.5 rounded-full animate-bounce motion-reduce:animate-none bg-[#1d1d1f]"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Show error page if there's an error
    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center px-5 bg-white">
          <div className="max-w-md w-full">
            <div className="rounded-2xl p-8 sm:p-10 text-center border border-[#d2d2d7]">
              <div className="mb-7">
                <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-[#f5f5f7]">
                  {error.type === 'not_found' ? (
                    <svg className="w-8 h-8 text-[#9a6400]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  ) : error.type === 'network_error' ? (
                    <svg className="w-8 h-8 text-[#9a6400]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-[#c8102e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
              </div>

              <h1 className="text-2xl font-semibold tracking-tight text-[#1d1d1f] mb-3">{error.message}</h1>
              <p className="text-[15px] mb-8 leading-relaxed text-[#6e6e73]">
                {error.type === 'not_found' && (
                  <>Machine <span className="font-mono font-semibold text-[#1d1d1f]">{machineId}</span> is not registered in our network.</>
                )}
                {error.type === 'network_error' && <>Unable to reach our servers. Please check your connection and try again.</>}
                {error.type === 'server_error' && <>Our servers are temporarily unavailable. We&apos;re working on it.</>}
                {error.type === 'invalid' && <>The machine ID format is not recognized. Please scan the QR code again.</>}
                {error.type === 'error' && <>Something went wrong loading this machine&apos;s data.</>}
              </p>

              <div className="flex flex-col gap-3">
                {(error.type === 'network_error' || error.type === 'server_error' || error.type === 'error') && (
                  <button
                    onClick={() => fetchMachineAndProducts()}
                    className="w-full py-3.5 min-h-11 rounded-xl font-semibold text-[15px] text-white bg-[#1d1d1f] transition-transform active:scale-[0.98]"
                  >
                    Try Again
                  </button>
                )}
                <button
                  onClick={() => { window.location.href = '/'; }}
                  className="w-full py-3.5 min-h-11 rounded-xl font-semibold text-[15px] border border-[#d2d2d7] text-[#1d1d1f] transition-transform active:scale-[0.98]"
                >
                  Go to Home
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-[#d2d2d7]">
                <a href="#contact" className="text-xs font-medium text-[#0071e3] hover:underline">Contact Support</a>
                <div className="w-px h-3 bg-[#d2d2d7]" />
                <a href="#about" className="text-xs font-medium text-[#0071e3] hover:underline">About Lyra</a>
              </div>
            </div>

            <p className="text-center text-xs mt-6 text-[#6e6e73]">
              Secure · Contactless · Instant
            </p>
          </div>
        </div>
      );
    }

    if (machine?.rfid_enabled) {
      return (
        <div className="min-h-screen flex items-center justify-center px-5 bg-white">
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-[#f5f5f7]">
              <svg className="w-8 h-8 text-[#1d1d1f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v2M9 16v2a2 2 0 002 2h6a2 2 0 002-2v-6a2 2 0 00-2-2h-1M9 16h6" />
              </svg>
            </div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-2 text-[#6e6e73]">
              {machine?.customer_name}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f] mb-3">{machine?.name || machineId}</h1>

            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold ${
                  machine?.asset_online ? 'bg-[#e8f5ea] text-[#1d7a3c]' : 'bg-[#f5f5f7] text-[#6e6e73]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${machine?.asset_online ? 'bg-[#1d7a3c]' : 'bg-[#a1a1a6]'}`} />
                {machine?.asset_online ? 'Live & Online' : 'Offline'}
              </div>
              {machine?.firmware_version && (
                <span className="text-xs font-medium px-3 py-1 rounded-full border border-[#d2d2d7] text-[#6e6e73]">
                  {machine.firmware_version}
                </span>
              )}
            </div>
            {machine?.last_ping && (
              <p className="text-xs mb-6 text-[#86868b]">
                Last seen {new Date(machine.last_ping).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}

            {machine?.asset_online && (
              <div className="grid grid-cols-2 gap-2 mb-6">
                {machine?.stock_level != null && (
                  <div className="rounded-2xl p-3 text-left border border-[#e5e5e7]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-[#86868b]">Stock</p>
                    <p className={`text-sm font-semibold ${machine.stock_level < 5 ? 'text-[#9a6400]' : 'text-[#1d1d1f]'}`}>
                      {machine.stock_level}{machine.max_capacity ? `/${machine.max_capacity}` : ''} unit{machine.stock_level !== 1 ? 's' : ''}
                    </p>
                  </div>
                )}
                {machine?.wifi_rssi != null && (() => {
                  const rssi = machine.wifi_rssi!;
                  const quality = rssi >= -60 ? 'Excellent' : rssi >= -70 ? 'Good' : rssi >= -80 ? 'Fair' : 'Weak';
                  const bars = rssi >= -60 ? 4 : rssi >= -70 ? 3 : rssi >= -80 ? 2 : 1;
                  return (
                    <div className="rounded-2xl p-3 text-left border border-[#e5e5e7]">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="flex items-end gap-0.5 h-3">
                          {[1, 2, 3, 4].map(i => (
                            <span
                              key={i}
                              className={`w-[3px] rounded-sm ${i <= bars ? 'bg-[#1d1d1f]' : 'bg-[#d2d2d7]'}`}
                              style={{ height: `${i * 25}%` }}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">WiFi</span>
                      </div>
                      <p className="text-sm font-semibold text-[#1d1d1f]">{quality}</p>
                      <p className="text-[10px] text-[#86868b]">{rssi} dBm</p>
                    </div>
                  );
                })()}
                {machine?.temperature != null && (
                  <div className="rounded-2xl p-3 text-left border border-[#e5e5e7]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-[#86868b]">Temperature</p>
                    <p className="text-sm font-semibold text-[#1d1d1f]">{machine.temperature.toFixed(1)}°C</p>
                  </div>
                )}
                {machine?.network_speed != null && (
                  <div className="rounded-2xl p-3 text-left border border-[#e5e5e7]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-[#86868b]">Network Speed</p>
                    <p className="text-sm font-semibold text-[#1d1d1f]">{machine.network_speed.toFixed(1)} KB/s</p>
                  </div>
                )}
                {machine?.uptime != null && (
                  <div className="rounded-2xl p-3 text-left border border-[#e5e5e7]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-[#86868b]">Uptime</p>
                    <p className="text-sm font-semibold text-[#1d1d1f]">
                      {(() => {
                        const totalSec = Math.floor(machine.uptime! / 1000);
                        const h = Math.floor(totalSec / 3600);
                        const m = Math.floor((totalSec % 3600) / 60);
                        return h > 0 ? `${h}h ${m}m` : `${m}m`;
                      })()}
                    </p>
                  </div>
                )}
              </div>
            )}

            <p className="text-base font-semibold text-[#1d1d1f] mb-2">This machine doesn&apos;t accept online payment</p>
            <p className="text-[15px] mb-8 leading-relaxed text-[#6e6e73]">
              Tap your RFID card on the reader to dispense your product. No app or payment needed here.
            </p>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full py-3.5 min-h-11 rounded-xl font-semibold text-[15px] border border-[#d2d2d7] text-[#1d1d1f] transition-transform active:scale-[0.98]"
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* ═══════════════════════════════════════════
            Purchase flow — Apple-style monochrome
        ═══════════════════════════════════════════ */}
        <div className="min-h-screen bg-white">

          {/* ── HEADER ── */}
          <header className="fixed top-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-xl border-b border-[#e5e5e7]">
            <div className="max-w-md mx-auto px-5 h-14 flex items-center justify-between">
              {/* Back button */}
              <button
                onClick={() => window.history.back()}
                className="lyra-icon-btn w-9 h-9 flex items-center justify-center rounded-full border border-[#e5e5e7]"
              >
                <svg className="w-4 h-4 text-[#1d1d1f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Brand */}
              <div className="flex flex-col items-center leading-none">
                <span className="text-sm font-semibold tracking-tight text-[#1d1d1f]">Lyra Care</span>
                <span className="text-[9px] font-medium tracking-widest text-[#86868b]">BY LYRA ENTERPRISES</span>
              </div>

              {/* Cart button */}
              <button onClick={() => setShowCart(true)} className="relative">
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[#1d1d1f]">
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                {getTotalItems() > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 text-white text-[9px] font-bold rounded-full flex items-center justify-center bg-[#0071e3] border-2 border-white">
                    {getTotalItems()}
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* ── Hero ── */}
          <div className="relative pt-14 pb-0 border-b border-[#e5e5e7]">
            <div className="max-w-md mx-auto px-5 pt-10 pb-10">
              <p
                className="text-xs font-semibold tracking-widest uppercase mb-2 animate-float-up text-[#6e6e73]"
                style={{ animationDelay: '0.05s' }}
              >
                {machine?.customer_name}
              </p>
              <h1
                className="text-4xl sm:text-5xl font-semibold leading-[1.05] tracking-tight mb-3 text-[#1d1d1f] wrap-break-word animate-float-up"
                style={{ animationDelay: '0.15s' }}
              >
                {machine?.name || machineId}
              </h1>
              <p
                className="text-[15px] mb-5 animate-float-up text-[#6e6e73]"
                style={{ animationDelay: '0.25s' }}
              >
                Smart hygiene access, anytime.
              </p>
              <div className="flex flex-wrap items-center gap-2 animate-float-up" style={{ animationDelay: '0.35s' }}>
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold ${
                    machine?.asset_online ? 'bg-[#e8f5ea] text-[#1d7a3c]' : 'bg-[#f5f5f7] text-[#6e6e73]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${machine?.asset_online ? 'bg-[#1d7a3c]' : 'bg-[#a1a1a6]'}`} />
                  {machine?.asset_online ? 'Live & Online' : 'Offline'}
                </div>
                {machine?.firmware_version && (
                  <span className="text-xs font-medium px-3 py-1 rounded-full border border-[#d2d2d7] text-[#6e6e73]">
                    {machine.firmware_version}
                  </span>
                )}
                {machine?.last_ping && (
                  <span className="text-xs text-[#86868b]">
                    Last seen {new Date(machine.last_ping).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Main scrollable content ── */}
          <main className="max-w-md mx-auto px-5 pb-40">

            {/* Offline: show game instead of products */}
            {!machine?.asset_online && (
              <div className="animate-fade-in space-y-4 text-center py-16" style={{ animationDelay: '0.38s' }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-[#6e6e73]">Machine Status</p>
                <h2 className="text-xl font-semibold text-[#1d1d1f] mb-1">Your machine is offline</h2>
                <p className="text-[15px] text-[#6e6e73]">Please try again once it comes back online.</p>
              </div>
            )}

            {machine?.asset_online && (<>
            {/* Product cards */}
            {products.length > 0 ? (
              <div className="space-y-4">
                {products.map((item, index) => {
                  const n = item.products.name.toLowerCase();
                  const isNight = n.includes('overnight') || n.includes('night');
                  const isXL = n.includes('xl') || n.includes('extra') || n.includes('large');
                  const typeLabel = isNight ? 'Maximum Coverage' : isXL ? 'Extra Protection' : 'Daily Comfort';
                  return (
                    <div
                      key={item.id}
                      className="lyra-card rounded-2xl overflow-hidden animate-card-enter border border-[#e5e5e7]"
                      style={{ animationDelay: `${0.48 + index * 0.12}s` }}
                    >
                      {/* ── Image tile ── */}
                      <div className="relative h-48 flex items-center justify-center overflow-hidden bg-[#f5f5f7]">
                        {item.products.image_url ? (
                          <img src={item.products.image_url} alt={item.products.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="relative z-10 select-none pointer-events-none">
                            <svg viewBox="0 0 120 68" className="w-36 h-auto" fill="none">
                              <path d="M22 34 C14 28 6 22 8 15 C10 9 18 9 24 18" fill="rgba(0,0,0,0.10)" />
                              <path d="M98 34 C106 28 114 22 112 15 C110 9 102 9 96 18" fill="rgba(0,0,0,0.10)" />
                              <rect x="22" y="10" width="76" height="48" rx="24" fill="rgba(0,0,0,0.16)" />
                              <rect x="34" y="20" width="52" height="28" rx="14" fill="rgba(0,0,0,0.12)" />
                              <line x1="47" y1="27" x2="47" y2="41" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" strokeLinecap="round" />
                              <line x1="60" y1="25" x2="60" y2="43" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" strokeLinecap="round" />
                              <line x1="73" y1="27" x2="73" y2="41" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" strokeLinecap="round" />
                              {isNight && <path d="M91 13 C88 10 88 6 91 4 A8 8 0 1 0 99 17 A8 8 0 0 1 91 13Z" fill="rgba(0,0,0,0.28)" />}
                            </svg>
                          </div>
                        )}

                        {/* Product type badge */}
                        <div className="absolute bottom-3 left-4 px-3 py-1 rounded-full bg-white/85 backdrop-blur">
                          <span className="text-[10px] font-semibold text-[#1d1d1f] tracking-widest uppercase">{typeLabel}</span>
                        </div>

                        {/* Low stock */}
                        {item.stock > 0 && item.stock < 5 && (
                          <div className="absolute top-3 left-4 px-3 py-1 rounded-full text-white text-xs font-semibold bg-[#9a6400]">
                            Only {item.stock} left!
                          </div>
                        )}

                        {/* Out of stock */}
                        {item.stock === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                            <span className="text-[#1d1d1f] font-semibold text-sm px-5 py-2 rounded-full uppercase tracking-wider border border-[#d2d2d7] bg-white">
                              Out of Stock
                            </span>
                          </div>
                        )}

                        {/* Favourite */}
                        <button
                          onClick={() => toggleFavorite(item.product_id)}
                          className={`absolute top-3 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                            favorites.has(item.product_id) ? 'bg-[#1d1d1f]' : 'bg-white/85 backdrop-blur border border-[#e5e5e7]'
                          }`}
                        >
                          <Heart
                            className="w-4 h-4"
                            style={{ color: favorites.has(item.product_id) ? '#fff' : '#1d1d1f' }}
                            fill={favorites.has(item.product_id) ? 'currentColor' : 'transparent'}
                          />
                        </button>
                      </div>

                      {/* ── Details ── */}
                      <div className="px-5 pt-4 pb-5">
                        {/* Name row + stock pill */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold text-[#1d1d1f] leading-snug">{item.products.name}</h3>
                            <p className="text-xs mt-0.5 line-clamp-1 text-[#86868b]">
                              {item.products.description || 'Premium sanitary care product'}
                            </p>
                          </div>
                          <div
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0 mt-0.5 ${
                              item.stock > 0 ? 'bg-[#e8f5ea]' : 'bg-[#f5f5f7]'
                            }`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full ${item.stock > 0 ? 'bg-[#1d7a3c]' : 'bg-[#a1a1a6]'}`} />
                            <span className={`text-[10px] font-medium ${item.stock > 0 ? 'text-[#1d7a3c]' : 'text-[#86868b]'}`}>
                              {item.stock > 0 ? `${item.stock} left` : 'Sold out'}
                            </span>
                          </div>
                        </div>

                        {/* Price — signature oversized display */}
                        <div className="mb-4">
                          <span className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
                            ₹{parseFloat(item.price).toFixed(0)}
                          </span>
                        </div>

                        {/* Qty controls or Add button */}
                        {cart.has(item.product_id) ? (
                          <div className="rounded-xl p-1 flex items-center justify-between border border-[#d2d2d7] bg-[#f5f5f7]">
                            <button
                              onClick={() => updateQuantity(item.product_id, -1)}
                              className="w-11 h-11 rounded-lg flex items-center justify-center transition-colors bg-white border border-[#e5e5e7]"
                            >
                              <Minus className="w-4 h-4 text-[#1d1d1f]" />
                            </button>
                            <div className="text-center">
                              <span className="text-lg font-semibold text-[#1d1d1f]">{cart.get(item.product_id)?.quantity}</span>
                              <span className="text-xs ml-1.5 text-[#6e6e73]">in cart</span>
                            </div>
                            <button
                              onClick={() => updateQuantity(item.product_id, 1)}
                              disabled={getTotalItems() >= 3 || (cart.get(item.product_id)?.quantity || 0) >= item.stock}
                              className="w-11 h-11 rounded-lg flex items-center justify-center transition-colors bg-white border border-[#e5e5e7] disabled:opacity-30"
                            >
                              <Plus className="w-4 h-4 text-[#1d1d1f]" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                            disabled={item.stock === 0 || item.is_active === 0 || getTotalItems() >= 3}
                            className="w-full py-3.5 min-h-11 rounded-xl text-[15px] font-semibold transition-transform active:scale-[0.97] disabled:cursor-not-allowed bg-[#1d1d1f] text-white disabled:bg-[#f5f5f7] disabled:text-[#a1a1a6]"
                          >
                            {item.stock === 0 ? 'Out of Stock' : getTotalItems() >= 3 ? 'Cart Full (Max 3)' : '+ Add to Cart'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-24">
                <div className="w-20 h-20 mx-auto mb-5 rounded-full flex items-center justify-center bg-[#f5f5f7]">
                  <Package className="w-9 h-9 text-[#86868b]" />
                </div>
                <p className="text-lg font-semibold text-[#1d1d1f] mb-2">No products yet</p>
                <p className="text-[15px] text-[#6e6e73]">This machine has no products assigned</p>
              </div>
            )}

            {/* ── Machine Status card ── */}
            <div
              className="mt-5 rounded-2xl overflow-hidden animate-fade-in border border-[#e5e5e7]"
              style={{ animationDelay: '0.6s' }}
            >
              <p className="text-xs font-semibold tracking-widest uppercase px-4 pt-4 mb-3 text-[#86868b]">
                Machine Status
              </p>
              <div className="grid grid-cols-3 gap-2 px-4 pb-4">
                {[
                  {
                    label: machine?.wifi_rssi == null ? 'Network' : 'Signal',
                    value: machine?.wifi_rssi != null ? `${machine.wifi_rssi} dBm` : 'Ethernet',
                    sub: machine?.wifi_rssi != null ? (machine.wifi_rssi > -50 ? 'Excellent' : machine.wifi_rssi > -70 ? 'Good' : 'Weak') : 'Connected',
                  },
                  { label: 'Stock', value: `${products.reduce((s, p) => s + p.stock, 0)}`, sub: 'units' },
                  {
                    label: 'Uptime',
                    value: machine?.uptime != null ? (() => { const h = Math.floor(machine.uptime / 3600000); const d = Math.floor(h / 24); if (d > 0) return `${d}d ${h % 24}h`; if (h > 0) return `${h}h`; return `${Math.floor(machine.uptime / 60000)}m`; })() : '—',
                    sub: '',
                  },
                  { label: 'Memory', value: machine?.free_heap != null ? `${(machine.free_heap / 1024).toFixed(0)} KB` : '—', sub: machine?.free_heap != null ? (machine.free_heap > 100000 ? 'Healthy' : 'Normal') : '' },
                  { label: 'Speed', value: machine?.network_speed != null ? `${machine.network_speed.toFixed(0)} KB/s` : '—', sub: machine?.network_speed != null ? (machine.network_speed > 50 ? 'Fast' : 'Slow') : '' },
                  { label: 'Temp', value: machine?.temperature != null ? `${machine.temperature.toFixed(0)}°C` : '—', sub: machine?.temperature != null ? (machine.temperature > 45 ? 'Hot' : 'Normal') : '' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl px-3 py-3 text-center border border-[#e5e5e7]">
                    <p className="text-sm font-semibold text-[#1d1d1f] leading-tight truncate">{stat.value}</p>
                    {stat.sub && <p className="text-[10px] font-medium mt-0.5 text-[#0071e3]">{stat.sub}</p>}
                    <p className="text-[10px] uppercase tracking-wider mt-1 text-[#86868b]">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Trust bar ── */}
            <div className="flex items-center justify-center gap-6 mt-5 mb-1 py-3 rounded-xl animate-fade-in bg-[#f5f5f7]"
              style={{ animationDelay: '0.7s' }}>
              <span className="text-xs font-medium text-[#6e6e73]">Secure</span>
              <div className="w-px h-3 bg-[#d2d2d7]" />
              <span className="text-xs font-medium text-[#6e6e73]">Contactless</span>
              <div className="w-px h-3 bg-[#d2d2d7]" />
              <span className="text-xs font-medium text-[#6e6e73]">Instant</span>
            </div>
            <p className="text-center text-[10px] mt-2 mb-4 text-[#a1a1a6]">
              Care without compromise
            </p>
            </>)}

            {/* ── Sticky Pay Now bar ── */}
            {cart.size > 0 && (
              <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-t border-[#e5e5e7]">
                <div className="max-w-md mx-auto px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="rounded-xl px-4 py-2 text-center bg-[#f5f5f7]">
                        <p className="text-[10px] font-semibold leading-none mb-0.5 text-[#6e6e73]">Items</p>
                        <p className="text-lg font-semibold leading-none text-[#1d1d1f]">
                          {getTotalItems()}<span className="text-xs font-normal text-[#a1a1a6]">/3</span>
                        </p>
                      </div>
                      <div className="rounded-xl px-4 py-2 text-center bg-[#f5f5f7]">
                        <p className="text-[10px] font-semibold leading-none mb-0.5 text-[#6e6e73]">Total</p>
                        <p className="text-lg font-semibold leading-none text-[#1d1d1f]">₹{getTotalAmount().toFixed(0)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-1">
                      <button
                        onClick={() => setShowCart(true)}
                        className="hidden sm:flex px-4 py-3 min-h-11 rounded-xl text-sm font-semibold transition-colors border border-[#d2d2d7] text-[#1d1d1f]"
                      >
                        View Cart
                      </button>
                      <button
                        onClick={handleCheckout}
                        disabled={isProcessing || !razorpayLoaded}
                        className="flex-1 py-3 min-h-11 rounded-xl text-[15px] font-semibold transition-transform active:scale-[0.97] disabled:cursor-not-allowed bg-[#1d1d1f] text-white disabled:bg-[#f5f5f7] disabled:text-[#a1a1a6]"
                      >
                        {isProcessing ? 'Processing...' : !razorpayLoaded ? 'Loading...' : `Pay Now  ₹${getTotalAmount().toFixed(0)}`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Cart Modal (dark bottom sheet) ── */}
            {showCart && (
              <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 bg-black/40 backdrop-blur-sm">
                <div className="w-full sm:max-w-lg sm:mx-4 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden bg-white border border-[#e5e5e7] shadow-2xl">
                  {/* Handle bar (mobile) */}
                  <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-[#d2d2d7]" />
                  </div>

                  {/* Header */}
                  <div className="flex items-center justify-between px-6 pt-4 pb-4 border-b border-[#e5e5e7]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#f5f5f7]">
                        <ShoppingCart className="w-5 h-5 text-[#1d1d1f]" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-[#1d1d1f]">Your Cart</h2>
                        <p className="text-xs text-[#6e6e73]">{getTotalItems()} of 3 items</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCart(false)}
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors border border-[#e5e5e7]"
                    >
                      <X className="w-4 h-4 text-[#1d1d1f]" />
                    </button>
                  </div>

                  {/* Items */}
                  <div className="px-6 py-4 overflow-y-auto max-h-[45vh]">
                    {cart.size === 0 ? (
                      <div className="text-center py-10">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-[#f5f5f7]">
                          <ShoppingCart className="w-7 h-7 text-[#86868b]" />
                        </div>
                        <p className="font-semibold text-[#1d1d1f] mb-1">Your cart is empty</p>
                        <p className="text-sm text-[#6e6e73]">Add up to 3 items to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {Array.from(cart.values()).map((item) => (
                          <div key={item.product_id} className="flex items-center gap-3 rounded-xl p-3 border border-[#e5e5e7]">
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 bg-[#f5f5f7]">
                              <Package className="w-6 h-6 text-[#86868b]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#1d1d1f] truncate">{item.name}</p>
                              <p className="text-xs font-medium text-[#6e6e73]">
                                ₹{parseFloat(item.price).toFixed(0)} × {item.quantity} = ₹{(parseFloat(item.price) * item.quantity).toFixed(0)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1 rounded-lg px-1 py-1 border border-[#d2d2d7]">
                                <button
                                  onClick={() => updateQuantity(item.product_id, -1)}
                                  className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
                                >
                                  <Minus className="w-3.5 h-3.5 text-[#1d1d1f]" />
                                </button>
                                <span className="text-sm font-semibold text-[#1d1d1f] min-w-6 text-center">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.product_id, 1)}
                                  disabled={getTotalItems() >= 3 || item.quantity >= item.stock}
                                  className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${getTotalItems() >= 3 || item.quantity >= item.stock ? 'opacity-30 cursor-not-allowed' : ''}`}
                                >
                                  <Plus className="w-3.5 h-3.5 text-[#1d1d1f]" />
                                </button>
                              </div>
                              <button
                                onClick={() => removeFromCart(item.product_id)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors bg-[#fbe9e9]"
                              >
                                <X className="w-3.5 h-3.5 text-[#c8102e]" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {cart.size > 0 && (
                    <div className="px-6 py-5 border-t border-[#e5e5e7]">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-[#6e6e73]">Total Amount</span>
                        <span className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
                          ₹{getTotalAmount().toFixed(0)}
                        </span>
                      </div>
                      <button
                        onClick={handleCheckout}
                        disabled={isProcessing}
                        className="w-full py-4 min-h-11 rounded-xl font-semibold text-[15px] transition-transform active:scale-[0.97] disabled:cursor-not-allowed bg-[#1d1d1f] text-white disabled:bg-[#f5f5f7] disabled:text-[#a1a1a6]"
                      >
                        {isProcessing ? 'Processing...' : `Pay ₹${getTotalAmount().toFixed(0)}`}
                      </button>
                      <p className="text-center text-xs mt-3 text-[#a1a1a6]">Secure payment via Razorpay</p>
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
      <main>
        <HeroSection />
        <AboutSection />
        <FeaturesSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-5 rounded-full flex items-center justify-center bg-[#1d1d1f]">
            <svg className="w-6 h-6 text-white animate-spin motion-reduce:animate-none" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#6e6e73]">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

