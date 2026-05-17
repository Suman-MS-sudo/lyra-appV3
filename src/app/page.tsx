'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShoppingCart, Heart, Package, X, Minus, Plus } from 'lucide-react';
import { OfflineMachineGame } from '@/components/OfflineMachineGame';
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
        <div
          className="min-h-screen flex flex-col items-center justify-center"
          style={{ background: 'linear-gradient(160deg, #1C0930 0%, #110720 50%, #0D0518 100%)' }}
        >
          {/* Ambient glow */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 -left-32 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(192,38,211,0.10) 0%, transparent 70%)' }} />
          </div>

          {/* Logo + branding */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="relative mb-8">
              <div
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.35) 0%, transparent 70%)', animationDuration: '2s' }}
              />
              <div
                className="relative w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 0 48px rgba(244,63,94,0.45)' }}
              >
                {/* Pad/drop icon */}
                <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
                  <ellipse cx="20" cy="22" rx="13" ry="9" fill="rgba(255,255,255,0.30)" />
                  <ellipse cx="20" cy="22" rx="8" ry="5" fill="rgba(255,255,255,0.25)" />
                  <path d="M20 10 C20 10 26 16 26 21 A6 6 0 0 1 14 21 C14 16 20 10 20 10Z" fill="rgba(255,255,255,0.55)" />
                </svg>
              </div>
            </div>

            <p className="text-2xl font-black text-white mb-1">Lyra <span style={{ color: '#F472B6' }}>Care</span></p>
            <p className="text-sm mb-10" style={{ color: 'rgba(255,255,255,0.38)' }}>Smart hygiene access, anytime.</p>

            {/* Bouncing dots */}
            <div className="flex items-center gap-2">
              {[0, 150, 300].map((delay) => (
                <div
                  key={delay}
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ background: '#F472B6', animationDelay: `${delay}ms` }}
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
        <div
          className="min-h-screen flex items-center justify-center px-5"
          style={{ background: 'linear-gradient(160deg, #1C0930 0%, #110720 50%, #0D0518 100%)' }}
        >
          {/* Ambient glow */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 -left-32 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(192,38,211,0.08) 0%, transparent 70%)' }} />
          </div>

          <div className="max-w-md w-full relative z-10">
            {/* Glass card */}
            <div
              className="rounded-3xl p-8 sm:p-10 text-center"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
              }}
            >
              {/* Icon */}
              <div className="mb-7">
                {error.type === 'not_found' ? (
                  <div
                    className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.25)' }}
                  >
                    <svg className="w-10 h-10" style={{ color: '#FCD34D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                ) : error.type === 'network_error' ? (
                  <div
                    className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.25)' }}
                  >
                    <svg className="w-10 h-10" style={{ color: '#FB923C' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
                    </svg>
                  </div>
                ) : (
                  <div
                    className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)' }}
                  >
                    <svg className="w-10 h-10" style={{ color: '#F472B6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
              </div>

              <h1 className="text-2xl font-black text-white mb-3">{error.message}</h1>
              <p className="text-sm mb-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.40)' }}>
                {error.type === 'not_found' && (
                  <>Machine <span className="font-mono font-semibold" style={{ color: 'rgba(255,255,255,0.65)' }}>{machineId}</span> is not registered in our network.</>
                )}
                {error.type === 'network_error' && <>Unable to reach our servers. Please check your connection and try again.</>}
                {error.type === 'server_error' && <>Our servers are temporarily unavailable. We&apos;re working on it.</>}
                {error.type === 'invalid' && <>The machine ID format is not recognized. Please scan the QR code again.</>}
                {error.type === 'error' && <>Something went wrong loading this machine&apos;s data.</>}
              </p>

              {/* Buttons */}
              <div className="flex flex-col gap-3">
                {(error.type === 'network_error' || error.type === 'server_error' || error.type === 'error') && (
                  <button
                    onClick={() => fetchMachineAndProducts()}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm text-white transition-all active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 8px 24px rgba(244,63,94,0.35)' }}
                  >
                    Try Again
                  </button>
                )}
                <button
                  onClick={() => { window.location.href = '/'; }}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)' }}
                >
                  Go to Home
                </button>
              </div>

              {/* Footer links */}
              <div className="flex items-center justify-center gap-4 mt-8 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <a href="#contact" className="text-xs font-medium transition-colors" style={{ color: 'rgba(244,63,94,0.70)' }}>Contact Support</a>
                <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.12)' }} />
                <a href="#about" className="text-xs font-medium transition-colors" style={{ color: 'rgba(244,63,94,0.70)' }}>About Lyra</a>
              </div>
            </div>

            <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.18)' }}>
              Secure · Contactless · Instant
            </p>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* ═══════════════════════════════════════════
            DARK LUXURY WOMEN-CENTRIC DESIGN
        ═══════════════════════════════════════════ */}
        <div className="min-h-screen relative" style={{ background: 'linear-gradient(160deg, #2D1257 0%, #1E0A3C 50%, #150828 100%)' }}>

          {/* Ambient glow blobs — drifting */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
            <div className="absolute -top-40 -right-40 w-[560px] h-[560px] rounded-full animate-glow-drift-1" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.28) 0%, transparent 65%)' }} />
            <div className="absolute top-1/3 -left-32 w-96 h-96 rounded-full animate-glow-drift-2" style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.22) 0%, transparent 65%)', animationDelay: '2s' }} />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full animate-glow-drift-3" style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.18) 0%, transparent 65%)', animationDelay: '4s' }} />
          </div>

          {/* ── HEADER ── */}
          <header className="fixed top-0 left-0 right-0 z-30" style={{ background: 'rgba(26,8,52,0.88)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="max-w-md mx-auto px-5 h-14 flex items-center justify-between">
              {/* Back button — dark glass pill */}
              <button
                onClick={() => window.history.back()}
                className="lyra-icon-btn w-9 h-9 flex items-center justify-center rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* Brand */}
              <div className="flex flex-col items-center leading-none">
                <span className="text-sm font-black tracking-wide" style={{ color: 'rgba(255,255,255,0.92)' }}>
                  Lyra <span style={{ color: '#F472B6' }}>Care</span>
                </span>
                <span className="text-[9px] font-medium tracking-widest" style={{ color: 'rgba(255,255,255,0.28)' }}>BY LYRA ENTERPRISES</span>
              </div>

              {/* Cart button — rose glow */}
              <button onClick={() => setShowCart(true)} className="relative">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 4px 16px rgba(244,63,94,0.45)' }}
                >
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                {getTotalItems() > 0 && (
                  <span
                    className="absolute -top-1 -right-1 w-5 h-5 text-white text-[9px] font-black rounded-full flex items-center justify-center"
                    style={{ background: '#1C0930', border: '2px solid #F43F5E' }}
                  >
                    {getTotalItems()}
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* ── Hero ── */}
          <div className="relative pt-14 pb-0">
            {/* Bottom separator */}
            <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right, transparent 0%, rgba(244,63,94,0.30) 35%, rgba(167,139,250,0.30) 65%, transparent 100%)' }} />
            <div className="max-w-md mx-auto px-5 pt-10 pb-10" style={{ position: 'relative', zIndex: 1 }}>
              <p
                className="text-xs font-semibold tracking-widest uppercase mb-2 animate-float-up"
                style={{ color: '#F472B6', animationDelay: '0.05s' }}
              >
                {machine?.customer_name}
              </p>
              <h1
                className="text-3xl sm:text-4xl font-bold leading-snug mb-2 text-white wrap-break-word animate-float-up"
                style={{ animationDelay: '0.15s' }}
              >
                {machine?.name || machineId}
              </h1>
              <p
                className="text-sm mb-5 animate-float-up"
                style={{ color: 'rgba(255,255,255,0.42)', animationDelay: '0.25s' }}
              >
                Smart hygiene access, anytime.
              </p>
              <div className="flex flex-wrap items-center gap-2 animate-float-up" style={{ animationDelay: '0.35s' }}>
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold"
                  style={
                    machine?.asset_online
                      ? { background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.35)', color: '#6EE7B7' }
                      : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.50)' }
                  }
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${machine?.asset_online ? 'animate-pulse' : ''}`}
                    style={{ background: machine?.asset_online ? '#34D399' : 'rgba(255,255,255,0.30)' }}
                  />
                  {machine?.asset_online ? 'Live & Online' : 'Offline'}
                </div>
                {machine?.firmware_version && (
                  <span
                    className="text-xs font-medium px-3 py-1 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.45)' }}
                  >
                    {machine.firmware_version}
                  </span>
                )}
                {machine?.last_ping && (
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.30)' }}>
                    Last seen {new Date(machine.last_ping).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Main scrollable content ── */}
          <main className="max-w-md mx-auto px-5 pb-40" style={{ position: 'relative', zIndex: 1 }}>

            {/* Offline: show game instead of products */}
            {!machine?.asset_online && (
              <div className="animate-fade-in space-y-4" style={{ animationDelay: '0.38s' }}>
                <div className="text-center py-2">
                  <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#F472B6' }}>Machine Status</p>
                  <h2 className="text-xl font-bold text-white mb-1">Your machine is offline</h2>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.40)' }}>Play while you wait for it to come back online</p>
                </div>
                <OfflineMachineGame machineName={machine?.name || machineId!} inline />
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
                  const tileGrad = isNight
                    ? 'linear-gradient(145deg, #1E1B4B 0%, #3730A3 50%, #6D28D9 100%)'
                    : isXL
                    ? 'linear-gradient(145deg, #7F1D1D 0%, #9D174D 50%, #BE185D 100%)'
                    : 'linear-gradient(145deg, #9D174D 0%, #DB2777 50%, #7C3AED 100%)';
                  return (
                    <div
                      key={item.id}
                      className="lyra-card lyra-border-breathe rounded-3xl overflow-hidden animate-card-enter"
                      style={{
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.13)',
                        boxShadow: '0 4px 40px rgba(0,0,0,0.30)',
                        animationDelay: `${0.48 + index * 0.12}s`,
                      }}
                    >
                      {/* ── Image tile ── */}
                      <div
                        className="relative h-52 flex items-center justify-center overflow-hidden tile-shimmer"
                        style={{ background: tileGrad }}
                      >
                        {/* Decorative orbs */}
                        <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                        <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.40) 0%, transparent 55%)' }} />

                        {item.products.image_url ? (
                          <img src={item.products.image_url} alt={item.products.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="relative z-10 select-none pointer-events-none">
                            <svg viewBox="0 0 120 68" className="w-36 h-auto" fill="none">
                              <path d="M22 34 C14 28 6 22 8 15 C10 9 18 9 24 18" fill="rgba(255,255,255,0.16)" />
                              <path d="M98 34 C106 28 114 22 112 15 C110 9 102 9 96 18" fill="rgba(255,255,255,0.16)" />
                              <rect x="22" y="10" width="76" height="48" rx="24" fill="rgba(255,255,255,0.28)" />
                              <rect x="34" y="20" width="52" height="28" rx="14" fill="rgba(255,255,255,0.22)" />
                              <line x1="47" y1="27" x2="47" y2="41" stroke="rgba(255,255,255,0.24)" strokeWidth="1.5" strokeLinecap="round" />
                              <line x1="60" y1="25" x2="60" y2="43" stroke="rgba(255,255,255,0.24)" strokeWidth="1.5" strokeLinecap="round" />
                              <line x1="73" y1="27" x2="73" y2="41" stroke="rgba(255,255,255,0.24)" strokeWidth="1.5" strokeLinecap="round" />
                              {isNight && <path d="M91 13 C88 10 88 6 91 4 A8 8 0 1 0 99 17 A8 8 0 0 1 91 13Z" fill="rgba(255,255,255,0.45)" />}
                            </svg>
                          </div>
                        )}

                        {/* Product type badge */}
                        <div
                          className="absolute bottom-3 left-4 px-3 py-1 rounded-full"
                          style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.18)' }}
                        >
                          <span className="text-[10px] font-semibold text-white tracking-widest uppercase">{typeLabel}</span>
                        </div>

                        {/* Low stock */}
                        {item.stock > 0 && item.stock < 5 && (
                          <div
                            className="absolute top-3 left-4 px-3 py-1 rounded-full text-white text-xs font-semibold"
                            style={{ background: 'rgba(251,191,36,0.90)', backdropFilter: 'blur(8px)' }}
                          >
                            Only {item.stock} left!
                          </div>
                        )}

                        {/* Out of stock */}
                        {item.stock === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(4px)' }}>
                            <span
                              className="text-white font-semibold text-sm px-5 py-2 rounded-full uppercase tracking-wider"
                              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}
                            >
                              Out of Stock
                            </span>
                          </div>
                        )}

                        {/* Favourite */}
                        <button
                          onClick={() => toggleFavorite(item.product_id)}
                          className="absolute top-3 right-4 w-9 h-9 rounded-full flex items-center justify-center transition-all"
                          style={
                            favorites.has(item.product_id)
                              ? { background: '#F43F5E', boxShadow: '0 4px 16px rgba(244,63,94,0.55)' }
                              : { background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.22)' }
                          }
                        >
                          <Heart className="w-4 h-4" style={{ color: 'white', fill: favorites.has(item.product_id) ? 'white' : 'transparent' }} />
                        </button>
                      </div>

                      {/* ── Details ── */}
                      <div className="px-5 pt-4 pb-5">
                        {/* Name row + stock pill */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold text-white leading-snug">{item.products.name}</h3>
                            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'rgba(255,255,255,0.40)' }}>
                              {item.products.description || 'Premium sanitary care product'}
                            </p>
                          </div>
                          <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0 mt-0.5"
                            style={
                              item.stock > 0
                                ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.30)' }
                                : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }
                            }
                          >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.stock > 0 ? '#34D399' : 'rgba(255,255,255,0.25)' }} />
                            <span className="text-[10px] font-medium" style={{ color: item.stock > 0 ? '#6EE7B7' : 'rgba(255,255,255,0.35)' }}>
                              {item.stock > 0 ? `${item.stock} left` : 'Sold out'}
                            </span>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="mb-4">
                          <span
                            className="text-2xl font-bold"
                            style={{
                              background: 'linear-gradient(135deg, #FDA4AF, #F43F5E)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text',
                            }}
                          >
                            ₹{parseFloat(item.price).toFixed(0)}
                          </span>
                        </div>

                        {/* Qty controls or Add button */}
                        {cart.has(item.product_id) ? (
                          <div
                            className="rounded-2xl p-1 flex items-center justify-between"
                            style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.24)' }}
                          >
                            <button
                              onClick={() => updateQuantity(item.product_id, -1)}
                              className="w-11 h-11 rounded-xl flex items-center justify-center transition-all"
                              style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.13)' }}
                            >
                              <Minus className="w-4 h-4" style={{ color: '#F472B6' }} />
                            </button>
                            <div className="text-center">
                              <span className="text-lg font-bold text-white">{cart.get(item.product_id)?.quantity}</span>
                              <span className="text-xs ml-1.5" style={{ color: 'rgba(255,255,255,0.40)' }}>in cart</span>
                            </div>
                            <button
                              onClick={() => updateQuantity(item.product_id, 1)}
                              disabled={getTotalItems() >= 3 || (cart.get(item.product_id)?.quantity || 0) >= item.stock}
                              className="w-11 h-11 rounded-xl flex items-center justify-center transition-all"
                              style={
                                getTotalItems() >= 3 || (cart.get(item.product_id)?.quantity || 0) >= item.stock
                                  ? { background: 'rgba(255,255,255,0.04)', cursor: 'not-allowed' }
                                  : { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.13)' }
                              }
                            >
                              <Plus
                                className="w-4 h-4"
                                style={{ color: getTotalItems() >= 3 || (cart.get(item.product_id)?.quantity || 0) >= item.stock ? 'rgba(255,255,255,0.20)' : '#F472B6' }}
                              />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                            disabled={item.stock === 0 || item.is_active === 0 || getTotalItems() >= 3}
                            className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97] ${item.stock > 0 && item.is_active !== 0 && getTotalItems() < 3 ? 'btn-glow' : ''}`}
                            style={
                              item.stock === 0 || item.is_active === 0 || getTotalItems() >= 3
                                ? { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.30)', cursor: 'not-allowed' }
                                : { background: 'linear-gradient(135deg, #F43F5E, #EC4899)', color: 'white' }
                            }
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
                <div
                  className="w-24 h-24 mx-auto mb-5 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.22)' }}
                >
                  <Package className="w-12 h-12" style={{ color: 'rgba(244,63,94,0.45)' }} />
                </div>
                <p className="text-lg font-semibold text-white mb-2">No products yet</p>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>This machine has no products assigned</p>
              </div>
            )}

            {/* ── Machine Status card ── */}
            <div
              className="mt-5 rounded-3xl overflow-hidden lyra-border-breathe animate-fade-in"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', animationDelay: '0.6s' }}
            >
              <p className="text-xs font-semibold tracking-widest uppercase px-4 pt-4 mb-3" style={{ color: 'rgba(255,255,255,0.40)' }}>
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
                  <div key={stat.label} className="rounded-2xl px-3 py-3 text-center"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <p className="text-sm font-semibold text-white leading-tight truncate">{stat.value}</p>
                    {stat.sub && <p className="text-[10px] font-medium mt-0.5" style={{ color: '#F472B6' }}>{stat.sub}</p>}
                    <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: 'rgba(255,255,255,0.40)' }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Trust bar ── */}
            <div className="flex items-center justify-center gap-6 mt-5 mb-1 py-3 rounded-2xl animate-fade-in"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', animationDelay: '0.7s' }}>
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.50)' }}>Secure</span>
              <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.15)' }} />
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.50)' }}>Contactless</span>
              <div className="w-px h-3" style={{ background: 'rgba(255,255,255,0.15)' }} />
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.50)' }}>Instant</span>
            </div>
            <p className="text-center text-[10px] mt-2 mb-4" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Care without compromise
            </p>
            </>)}

            {/* ── Sticky Pay Now bar ── */}
            {cart.size > 0 && (
              <div
                className="fixed bottom-0 left-0 right-0 z-20"
                style={{
                  background: 'rgba(17,7,32,0.92)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  borderTop: '1px solid rgba(255,255,255,0.07)',
                  boxShadow: '0 -8px 40px rgba(244,63,94,0.14)',
                }}
              >
                <div className="max-w-md mx-auto px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className="rounded-2xl px-4 py-2 text-center"
                        style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.20)' }}
                      >
                        <p className="text-[10px] font-semibold leading-none mb-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>Items</p>
                        <p className="text-lg font-black leading-none" style={{ color: '#F472B6' }}>
                          {getTotalItems()}<span className="text-xs font-normal" style={{ color: 'rgba(255,255,255,0.30)' }}>/3</span>
                        </p>
                      </div>
                      <div
                        className="rounded-2xl px-4 py-2 text-center"
                        style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.20)' }}
                      >
                        <p className="text-[10px] font-semibold leading-none mb-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>Total</p>
                        <p className="text-lg font-black leading-none" style={{ color: '#F472B6' }}>₹{getTotalAmount().toFixed(0)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-1">
                      <button
                        onClick={() => setShowCart(true)}
                        className="hidden sm:flex px-4 py-3 rounded-2xl text-sm font-bold transition-all"
                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.70)' }}
                      >
                        View Cart
                      </button>
                      <button
                        onClick={handleCheckout}
                        disabled={isProcessing || !razorpayLoaded}
                        className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97] ${!isProcessing && razorpayLoaded ? 'btn-glow' : ''}`}
                        style={
                          isProcessing || !razorpayLoaded
                            ? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.30)', cursor: 'not-allowed' }
                            : { background: 'linear-gradient(135deg, #F43F5E, #EC4899)', color: 'white' }
                        }
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
              <div
                className="fixed inset-0 flex items-end sm:items-center justify-center z-50"
                style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
              >
                <div
                  className="w-full sm:max-w-lg sm:mx-4 rounded-t-4xl sm:rounded-4xl max-h-[90vh] overflow-hidden"
                  style={{
                    background: 'linear-gradient(160deg, #200D35 0%, #170922 100%)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 -16px 60px rgba(0,0,0,0.50)',
                  }}
                >
                  {/* Handle bar (mobile) */}
                  <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
                  </div>

                  {/* Header */}
                  <div
                    className="flex items-center justify-between px-6 pt-4 pb-4"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.25)' }}
                      >
                        <ShoppingCart className="w-5 h-5" style={{ color: '#F472B6' }} />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-white">Your Cart</h2>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.40)' }}>{getTotalItems()} of 3 items</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCart(false)}
                      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  {/* Items */}
                  <div className="px-6 py-4 overflow-y-auto max-h-[45vh]">
                    {cart.size === 0 ? (
                      <div className="text-center py-10">
                        <div
                          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.18)' }}
                        >
                          <ShoppingCart className="w-8 h-8" style={{ color: 'rgba(244,63,94,0.45)' }} />
                        </div>
                        <p className="font-bold text-white mb-1">Your cart is empty</p>
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Add up to 3 items to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {Array.from(cart.values()).map((item) => (
                          <div
                            key={item.product_id}
                            className="flex items-center gap-3 rounded-2xl p-3"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                          >
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: 'linear-gradient(135deg, #BE185D, #9333EA)' }}
                            >
                              <Package className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.60)' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate">{item.name}</p>
                              <p className="text-xs font-semibold" style={{ color: '#F472B6' }}>
                                ₹{parseFloat(item.price).toFixed(0)} × {item.quantity} = ₹{(parseFloat(item.price) * item.quantity).toFixed(0)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div
                                className="flex items-center gap-1 rounded-xl px-1 py-1"
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}
                              >
                                <button
                                  onClick={() => updateQuantity(item.product_id, -1)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                                >
                                  <Minus className="w-3.5 h-3.5" style={{ color: '#F472B6' }} />
                                </button>
                                <span className="text-sm font-semibold text-white min-w-6 text-center">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.product_id, 1)}
                                  disabled={getTotalItems() >= 3 || item.quantity >= item.stock}
                                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${getTotalItems() >= 3 || item.quantity >= item.stock ? 'opacity-30 cursor-not-allowed' : ''}`}
                                >
                                  <Plus className="w-3.5 h-3.5" style={{ color: '#F472B6' }} />
                                </button>
                              </div>
                              <button
                                onClick={() => removeFromCart(item.product_id)}
                                className="w-7 h-7 flex items-center justify-center rounded-xl transition-colors"
                                style={{ background: 'rgba(239,68,68,0.12)' }}
                              >
                                <X className="w-3.5 h-3.5" style={{ color: '#FCA5A5' }} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {cart.size > 0 && (
                    <div className="px-6 py-5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>Total Amount</span>
                        <span
                          className="text-xl font-bold"
                          style={{
                            background: 'linear-gradient(135deg, #FDA4AF, #F43F5E)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                          }}
                        >
                          ₹{getTotalAmount().toFixed(0)}
                        </span>
                      </div>
                      <button
                        onClick={handleCheckout}
                        disabled={isProcessing}
                        className={`w-full py-4 rounded-2xl font-semibold text-sm transition-all active:scale-[0.97] ${!isProcessing ? 'btn-glow' : ''}`}
                        style={
                          isProcessing
                            ? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.30)', cursor: 'not-allowed' }
                            : { background: 'linear-gradient(135deg, #F43F5E, #EC4899)', color: 'white' }
                        }
                      >
                        {isProcessing ? 'Processing...' : `Pay ₹${getTotalAmount().toFixed(0)}`}
                      </button>
                      <p className="text-center text-xs mt-3" style={{ color: 'rgba(255,255,255,0.25)' }}>Secure payment via Razorpay</p>
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
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #2D1257 0%, #1E0A3C 55%, #150828 100%)' }}>
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #2D1257 0%, #1E0A3C 55%, #150828 100%)' }}>
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-5 relative">
            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.35) 0%, transparent 70%)', animationDuration: '1.5s' }} />
            <div className="relative w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #F43F5E, #EC4899)', boxShadow: '0 0 32px rgba(244,63,94,0.45)' }}>
              <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium" style={{ color: '#F472B6' }}>Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

