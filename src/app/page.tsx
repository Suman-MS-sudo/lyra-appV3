'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ShoppingCart, Heart, Package, X, Minus, Plus, Lock, Zap, Sparkles, Globe, MapPin, Instagram, Linkedin, Activity, Wifi } from 'lucide-react';
import { Header } from '@/components/landing/header';
import { HeroSection } from '@/components/landing/hero-section';
import { HowItWorksSection } from '@/components/landing/how-it-works-section';
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

const SOCIAL_LINKS = [
  { label: 'Website', href: 'https://lyraenterprise.co.in', Icon: Globe },
  { label: 'Location', href: 'https://www.google.com/maps/search/?api=1&query=10%2F21%2C+Vasuki+Street%2C+Cholapuram%2C+Ambattur%2C+Chennai+-+600053', Icon: MapPin },
  { label: 'Instagram', href: 'https://www.instagram.com/lyraenterprises_/', Icon: Instagram },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/lyra-enterprises/', Icon: Linkedin },
] as const;

// A short, human phrase for "how long ago" instead of a raw timestamp.
function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 20) return 'just now';
  if (sec < 60) return '1m ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'yesterday';
  return `${day}d ago`;
}

// Turns a raw machine/device id like "lyra_SNVM_003" into "Lyra SNVM 003" —
// underscores and dashes read as clutter in a large display headline.
function formatDisplayName(raw: string): string {
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => (w === w.toUpperCase() && w.length <= 5 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

// Small heartbeat indicator — a live pulse instead of a plain "Last seen <timestamp>" line.
function HeartbeatPill({ lastPing, online }: { lastPing: string; online?: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[#86868b]">
      <span className="relative flex h-2 w-2">
        {online && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#1d7a3c] opacity-60 animate-ping motion-reduce:animate-none" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${online ? 'bg-[#1d7a3c]' : 'bg-[#a1a1a6]'}`} />
      </span>
      {timeAgo(lastPing)}
    </span>
  );
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
  const [activeProductIndex, setActiveProductIndex] = useState(0);
  const [error, setError] = useState<{ type: string; message: string } | null>(null);

  // Live refs for the background poll below -- a setInterval callback set up
  // once in a mount-only effect otherwise closes over whatever isProcessing/
  // cart were AT MOUNT TIME forever, never seeing later updates.
  const isProcessingRef = useRef(isProcessing);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  const cartRef = useRef(cart);
  useEffect(() => { cartRef.current = cart; }, [cart]);

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

    // The heartbeat pill re-renders its "Xm ago" text every 30s, but that's
    // just recomputing elapsed time from a timestamp fetched once on page
    // load -- stock_level/last_ping/asset_online themselves never actually
    // refresh, so a stock reset or the machine going offline never shows up
    // on an already-open page without a manual reload. Poll quietly in the
    // background instead so this page reflects reality, same cadence as the
    // heartbeat so both tick together. Skipped mid-purchase (isProcessing or
    // a non-empty cart) so a fresh stock number can't silently invalidate an
    // in-flight order or the customer's own selections.
    const refreshId = setInterval(() => {
      if (machineId) refreshMachineStatusSilently();
    }, 30000);
    return () => clearInterval(refreshId);
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

  // Background counterpart to fetchMachineAndProducts() above -- same
  // endpoint and parsing, but never touches loading/error state, so a
  // routine 30s poll can't flash the full-page loading screen over an
  // already-open purchase flow, and a transient network hiccup on one poll
  // just leaves the last-known-good data on screen instead of replacing it
  // with an error page. Skipped entirely mid-purchase (isProcessing, or the
  // customer already has items in their cart) so a fresh stock number can't
  // invalidate an in-flight order or silently change what they're buying.
  const refreshMachineStatusSilently = async () => {
    if (isProcessingRef.current || cartRef.current.size > 0) return;
    try {
      const response = await fetch(`/api/machines/${machineId}/products`);
      if (!response.ok) return;
      const data = await response.json();
      if (!data.success || !data.machine) return;

      const machine = data.machine;
      if (machine.last_ping) {
        const lastPingTime = new Date(machine.last_ping).getTime();
        machine.asset_online = (Date.now() - lastPingTime) < 10 * 60 * 1000;
      }

      setMachine(machine);
      setProducts(data.products || []);
    } catch {
      // Transient network hiccup on a background poll -- next tick retries.
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-white relative overflow-hidden">
          <div
            className="absolute w-96 h-96 rounded-full pointer-events-none animate-glow-breathe"
            style={{ background: 'radial-gradient(closest-side, rgba(0,113,227,0.08), transparent)' }}
          />
          <div className="relative flex flex-col items-center text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-8"
              style={{ background: 'linear-gradient(135deg, #2d2d2f, #1d1d1f)', boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
            >
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
        <div className="min-h-screen flex items-center justify-center px-5 bg-white relative overflow-hidden">
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none animate-glow-breathe"
            style={{ background: 'radial-gradient(closest-side, rgba(0,113,227,0.08), transparent)' }}
          />
          <div className="relative max-w-md w-full">
            <div className="rounded-[28px] p-8 sm:p-10 text-center bg-white" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 16px 40px rgba(0,17,40,0.10)' }}>
              <div className="mb-7">
                <div
                  className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
                  style={{
                    background: error.type === 'error'
                      ? 'linear-gradient(135deg, rgba(200,16,46,0.14), rgba(200,16,46,0.06))'
                      : 'linear-gradient(135deg, rgba(154,100,0,0.14), rgba(154,100,0,0.06))',
                  }}
                >
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
                    className="w-full py-3.5 min-h-11 rounded-full font-semibold text-[15px] text-white transition-all active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #0071e3, #0058b0)', boxShadow: '0 8px 20px rgba(0,113,227,0.30)' }}
                  >
                    Try Again
                  </button>
                )}
                <button
                  onClick={() => { window.location.href = '/'; }}
                  className="w-full py-3.5 min-h-11 rounded-full font-semibold text-[15px] bg-[#f5f5f7] text-[#1d1d1f] transition-all active:scale-[0.98]"
                >
                  Go to Home
                </button>
              </div>

              <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-[#f0f0f2]">
                <a href="#contact" className="text-xs font-medium text-[#0071e3] hover:underline">Contact Support</a>
                <div className="w-px h-3 bg-[#e5e5e7]" />
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
        <div className="min-h-screen flex items-center justify-center px-5 bg-white relative overflow-hidden">
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none animate-glow-breathe"
            style={{ background: 'radial-gradient(closest-side, rgba(0,113,227,0.08), transparent)' }}
          />
          <div className="relative w-full max-w-md text-center">
            <div
              className="relative w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0071e3, #0058b0)', boxShadow: '0 8px 24px rgba(0,113,227,0.30)' }}
            >
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v2M9 16v2a2 2 0 002 2h6a2 2 0 002-2v-6a2 2 0 00-2-2h-1M9 16h6" />
              </svg>
            </div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-2 text-[#6e6e73]">
              {machine?.customer_name}
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-[-0.01em] text-[#1d1d1f] mb-3 text-balance">{formatDisplayName(machine?.name || machineId || '')}</h1>

            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold ${
                  machine?.asset_online ? 'bg-[#e8f5ea] text-[#1d7a3c]' : 'bg-[#f5f5f7] text-[#6e6e73]'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${machine?.asset_online ? 'bg-[#1d7a3c]' : 'bg-[#a1a1a6]'}`} />
                {machine?.asset_online ? 'Live & Online' : 'Offline'}
              </div>
            </div>
            {machine?.last_ping && (
              <p className="mb-6">
                <HeartbeatPill lastPing={machine.last_ping} online={machine?.asset_online} />
              </p>
            )}

            {machine?.asset_online && machine?.stock_level != null && (
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-6"
                style={machine.stock_level < 5 ? { background: 'rgba(154,100,0,0.10)', color: '#9a6400' } : { background: 'rgba(29,122,60,0.10)', color: '#1d7a3c' }}
              >
                <Package className="w-3.5 h-3.5" />
                {machine.stock_level}{machine.max_capacity ? `/${machine.max_capacity}` : ''} unit{machine.stock_level !== 1 ? 's' : ''} in stock
              </div>
            )}

            <p className="text-base font-semibold text-[#1d1d1f] mb-2">This machine doesn&apos;t accept online payment</p>
            <p className="text-[15px] mb-8 leading-relaxed text-[#6e6e73]">
              Tap your RFID card on the reader to dispense your product. No app or payment needed here.
            </p>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full py-3.5 min-h-11 rounded-full font-semibold text-[15px] bg-[#f5f5f7] text-[#1d1d1f] transition-all active:scale-[0.98]"
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
        <div
          className="min-h-screen relative"
          style={{ background: 'linear-gradient(180deg, #f2f7fe 0%, #ffffff 22%, #ffffff 100%)' }}
        >

          {/* ── Ambient background texture (fixed, decorative) ── */}
          <div className="fixed inset-0 pointer-events-none bg-dot-grid" style={{ maskImage: 'linear-gradient(to bottom, black, transparent 85%)' }} />
          <div
            className="fixed -top-32 -right-32 w-120 h-120 rounded-full pointer-events-none animate-glow-breathe"
            style={{ background: 'radial-gradient(closest-side, rgba(0,113,227,0.14), transparent)' }}
          />
          <div
            className="fixed top-[55vh] -left-40 w-96 h-96 rounded-full pointer-events-none animate-glow-breathe"
            style={{ background: 'radial-gradient(closest-side, rgba(0,113,227,0.08), transparent)', animationDelay: '2s' }}
          />
          <div
            className="fixed -bottom-32 -right-24 w-104 h-104 rounded-full pointer-events-none animate-glow-breathe"
            style={{ background: 'radial-gradient(closest-side, rgba(0,113,227,0.10), transparent)', animationDelay: '1s' }}
          />

          {/* ── HEADER — floating detached pill, not an edge-to-edge bar ── */}
          <header className="fixed top-3 left-3 right-3 z-30">
            <div
              className="max-w-md mx-auto px-3 h-14 flex items-center justify-between rounded-full bg-white/85 backdrop-blur-xl"
              style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.6)' }}
            >
              {/* Back button */}
              <button
                onClick={() => window.history.back()}
                className="lyra-icon-btn w-9 h-9 flex items-center justify-center rounded-full bg-white transition-all active:scale-90"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
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
              <button onClick={() => setShowCart(true)} className="relative transition-all active:scale-90">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #0071e3, #0058b0)', boxShadow: '0 3px 10px rgba(0,113,227,0.35)' }}
                >
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                {getTotalItems() > 0 && (
                  <span
                    key={getTotalItems()}
                    className="absolute -top-1 -right-1 w-5 h-5 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-badge-bump"
                    style={{ background: '#0071e3', boxShadow: '0 2px 6px rgba(0,113,227,0.5)' }}
                  >
                    {getTotalItems()}
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* ── Hero — full-bleed dark gradient banner, matching the product panels ── */}
          <div
            className="relative pt-18 pb-0 overflow-hidden rounded-b-[32px] grain-overlay"
            style={{ background: 'linear-gradient(155deg, #0c1a33 0%, #10305e 55%, #0071e3 140%)' }}
          >
            {/* Glowing spotlight */}
            <div
              className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-80 rounded-full pointer-events-none animate-glow-breathe"
              style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.18), transparent)' }}
            />

            {/* Abstract decorative composition */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 400 280"
              preserveAspectRatio="xMidYMid slice"
              fill="none"
            >
              <defs>
                <radialGradient id="heroBlob" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.16)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
                <linearGradient id="heroRingFade" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                </linearGradient>
                <radialGradient id="dotFade" cx="0%" cy="100%" r="75%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
              </defs>

              {/* Soft organic blob, top-right, bleeding off-canvas */}
              <path
                d="M330 -40 C400 -10 420 70 385 120 C350 170 280 165 250 120 C220 75 240 5 280 -20 C300 -33 315 -46 330 -40 Z"
                fill="url(#heroBlob)"
              />

              {/* Concentric rings, off-center, gradient stroke for depth */}
              <circle cx="352" cy="46" r="70" stroke="url(#heroRingFade)" strokeWidth="1.5" />
              <circle cx="352" cy="46" r="104" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <circle cx="352" cy="46" r="138" stroke="rgba(255,255,255,0.045)" strokeWidth="1" />

              {/* Fine accent ring, bottom-left */}
              <circle cx="8" cy="248" r="46" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

              {/* Fading dot grid, bottom-left corner */}
              {Array.from({ length: 4 }).flatMap((_, row) =>
                Array.from({ length: 5 }).map((_, col) => (
                  <circle
                    key={`${row}-${col}`}
                    cx={14 + col * 13}
                    cy={196 + row * 13}
                    r={1.4}
                    fill="url(#dotFade)"
                  />
                ))
              )}

              {/* Thin sweeping accent line */}
              <path
                d="M -20 76 Q 70 40 150 78 T 300 58"
                stroke="rgba(255,255,255,0.10)"
                strokeWidth="1.25"
                strokeDasharray="1 7"
                strokeLinecap="round"
              />

              {/* A single small solid accent — the "signature" dot */}
              <circle cx="300" cy="58" r="3" fill="rgba(255,255,255,0.55)" />
            </svg>

            <div className="relative max-w-md mx-auto px-5 pt-6 pb-7">
              {/* Quick links to Lyra's own pages — same set as the footer, up top for easy access */}
              <div className="flex items-center gap-2 mb-4 animate-float-up" style={{ animationDelay: '0s' }}>
                {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-white/12 backdrop-blur-md transition-all active:scale-90 hover:bg-white/20"
                    style={{ border: '1px solid rgba(255,255,255,0.18)' }}
                  >
                    <Icon className="w-3.5 h-3.5 text-white" strokeWidth={1.75} />
                  </a>
                ))}
              </div>
              <p
                className="text-xs font-semibold tracking-widest uppercase mb-2 animate-float-up text-white/55"
                style={{ animationDelay: '0.05s' }}
              >
                {machine?.customer_name}
              </p>
              <h1
                className="text-2xl sm:text-3xl font-semibold leading-snug tracking-[-0.01em] mb-3 text-white text-balance animate-float-up"
                style={{ animationDelay: '0.15s', textShadow: '0 4px 24px rgba(0,0,0,0.25)' }}
              >
                {formatDisplayName(machine?.name || machineId || '')}
              </h1>
              <p
                className="text-[15px] mb-5 animate-float-up text-white/65"
                style={{ animationDelay: '0.25s' }}
              >
                Smart hygiene access, anytime.
              </p>
              <div className="animate-float-up" style={{ animationDelay: '0.35s' }}>
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-white backdrop-blur-md`}
                  style={{
                    background: machine?.asset_online ? 'rgba(29,122,60,0.35)' : 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${machine?.asset_online ? 'bg-[#4ade80] animate-pulse' : 'bg-white/50'}`} />
                  {machine?.asset_online ? 'Live & Online' : 'Offline'}
                  {machine?.last_ping && (
                    <>
                      <span className="opacity-40">·</span>
                      {timeAgo(machine.last_ping)}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Main scrollable content ── */}
          <main className={`max-w-md mx-auto px-5 pt-6 ${cart.size > 0 ? 'pb-40' : 'pb-6'}`}>

            {/* Offline state */}
            {!machine?.asset_online && (
              <div className="animate-fade-in text-center py-16" style={{ animationDelay: '0.38s' }}>
                <div
                  className="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center"
                  style={{ background: '#f5f5f7' }}
                >
                  <Wifi className="w-7 h-7 text-[#a1a1a6]" strokeWidth={1.75} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-[#6e6e73]">Machine Status</p>
                <h2 className="text-xl font-semibold text-[#1d1d1f] mb-1">Your machine is offline</h2>
                <p className="text-[15px] text-[#6e6e73]">Please try again once it comes back online.</p>
              </div>
            )}

            {machine?.asset_online && (<>
            {/* Product cards — horizontal snap-scroll carousel */}
            {products.length > 0 ? (
              <div
                className="flex overflow-x-auto -mx-5 px-14 pb-2 gap-4 snap-x snap-mandatory scroll-smooth no-scrollbar justify-center"
                style={{ scrollbarWidth: 'none' }}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const cardWidth = el.scrollWidth / products.length;
                  const idx = Math.round(el.scrollLeft / cardWidth);
                  setActiveProductIndex(Math.max(0, Math.min(products.length - 1, idx)));
                }}
              >
                {products.map((item, index) => {
                  const n = item.products.name.toLowerCase();
                  const isNight = n.includes('overnight') || n.includes('night');
                  const isXL = n.includes('xl') || n.includes('extra') || n.includes('large');
                  const typeLabel = isNight ? 'Maximum Coverage' : isXL ? 'Extra Protection' : 'Daily Comfort';
                  // Deep, saturated gradient per product type — same blue family, different depth —
                  // instead of a pastel wash, for a bolder full-bleed hero panel.
                  const panel = isNight
                    ? 'linear-gradient(155deg, #0b1220 0%, #131c2e 55%, #0071e3 140%)'
                    : isXL
                    ? 'linear-gradient(155deg, #0a1830 0%, #0e2a52 55%, #0071e3 140%)'
                    : 'linear-gradient(155deg, #0c1a33 0%, #10305e 55%, #0071e3 140%)';
                  const inCart = cart.has(item.product_id);
                  const qty = cart.get(item.product_id)?.quantity ?? 0;
                  const hasRealPhoto = !!item.products.image_url;

                  return (
                    <div
                      key={item.id}
                      className="lyra-card rounded-[32px] overflow-hidden animate-card-enter bg-white shrink-0 snap-center"
                      style={{
                        width: '78%',
                        maxWidth: '320px',
                        animationDelay: `${0.48 + index * 0.12}s`,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05), 0 16px 36px rgba(0,17,40,0.14)',
                      }}
                    >
                      {/* ── Hero panel — full-bleed dark gradient with glowing spotlight ── */}
                      <div className="relative h-52 flex items-center justify-center overflow-hidden grain-overlay" style={{ background: panel }}>
                        <div
                          className="absolute w-56 h-56 rounded-full pointer-events-none animate-glow-breathe"
                          style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.22), transparent)' }}
                        />

                        {/* Price only — name moved to the info strip below */}
                        <div className="absolute top-0 right-0 p-5 z-10">
                          <div
                            className="shrink-0 px-3.5 py-2 rounded-2xl text-right bg-white/12 backdrop-blur-md"
                            style={{ border: '1px solid rgba(255,255,255,0.18)' }}
                          >
                            <span className="text-lg font-extrabold tracking-tight text-white">₹{parseFloat(item.price).toFixed(0)}</span>
                          </div>
                        </div>

                        {hasRealPhoto ? (
                          <img src={item.products.image_url} alt={item.products.name} className="relative z-0 w-full h-full object-cover" />
                        ) : (
                          <Image
                            src="/icons/Gemini_Generated_Image_mypgjumypgjumypg-removebg-preview.png"
                            alt={item.products.name}
                            width={677}
                            height={369}
                            className="relative z-0 w-64 h-auto select-none pointer-events-none"
                            style={{ filter: 'drop-shadow(0 14px 20px rgba(0,0,0,0.35))' }}
                          />
                        )}

                        {item.stock === 0 && (
                          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-[1px]">
                            <span className="text-xs font-bold text-[#1d1d1f] uppercase tracking-widest px-4 py-1.5 rounded-full bg-white" style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }}>Sold out</span>
                          </div>
                        )}

                        {/* Low stock */}
                        {item.stock > 0 && item.stock < 5 && (
                          <div
                            className="absolute z-20 bottom-3.5 left-4 px-3 py-1.5 rounded-full text-white text-xs font-semibold"
                            style={{ background: 'linear-gradient(135deg, #d99a1f, #b8790a)', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }}
                          >
                            Only {item.stock} left!
                          </div>
                        )}

                        {/* Favourite */}
                        <button
                          onClick={() => toggleFavorite(item.product_id)}
                          className={`absolute z-20 bottom-3.5 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                            favorites.has(item.product_id) ? 'bg-[#1d1d1f]' : 'bg-white'
                          }`}
                          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
                        >
                          <Heart
                            className="w-4 h-4"
                            style={{ color: favorites.has(item.product_id) ? '#fff' : '#1d1d1f' }}
                            fill={favorites.has(item.product_id) ? 'currentColor' : 'transparent'}
                          />
                        </button>
                      </div>

                      {/* ── Info strip ── */}
                      <div className="px-5 pt-4 pb-5">
                        <div className="mb-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#86868b] mb-1">{typeLabel}</p>
                          <h3 className="text-[17px] font-medium tracking-[-0.01em] text-[#1d1d1f] leading-snug mb-2">{formatDisplayName(item.products.name)}</h3>
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
                            style={item.stock > 0 ? { background: 'rgba(29,122,60,0.10)', color: '#1d7a3c' } : { background: '#f5f5f7', color: '#86868b' }}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${item.stock > 0 ? 'bg-[#1d7a3c]' : 'bg-[#a1a1a6]'}`} />
                            {item.stock > 0 ? `${item.stock} in stock` : 'Sold out'}
                          </span>
                        </div>

                        <div className="mt-1">
                          {inCart ? (
                            <div className="rounded-2xl p-1.5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0071e3, #0058b0)' }}>
                              <button
                                onClick={() => updateQuantity(item.product_id, -1)}
                                className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 bg-white/15 backdrop-blur-sm"
                              >
                                <Minus className="w-4 h-4 text-white" />
                              </button>
                              <span className="text-[15px] font-bold text-white">
                                {qty} {qty === 1 ? 'item' : 'items'} added
                              </span>
                              <button
                                onClick={() => updateQuantity(item.product_id, 1)}
                                disabled={getTotalItems() >= 3 || qty >= item.stock}
                                className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 bg-white/15 backdrop-blur-sm disabled:opacity-30"
                              >
                                <Plus className="w-4 h-4 text-white" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addToCart(item)}
                              disabled={item.stock === 0 || item.is_active === 0 || getTotalItems() >= 3}
                              className="w-full py-3.5 min-h-11 rounded-2xl text-[15px] font-bold tracking-tight transition-all active:scale-[0.97] disabled:cursor-not-allowed text-white disabled:bg-[#e5e5e7] disabled:text-[#a1a1a6] disabled:shadow-none flex items-center justify-center gap-2"
                              style={
                                item.stock === 0 || item.is_active === 0 || getTotalItems() >= 3
                                  ? undefined
                                  : { background: 'linear-gradient(135deg, #0071e3, #0058b0)', boxShadow: '0 8px 20px rgba(0,113,227,0.32)' }
                              }
                            >
                              {item.stock === 0 ? (
                                'Out of Stock'
                              ) : getTotalItems() >= 3 ? (
                                'Cart Full (Max 3)'
                              ) : (
                                <>
                                  <Plus className="w-4 h-4" />
                                  Add to Cart
                                </>
                              )}
                            </button>
                          )}
                        </div>
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

            {/* Dot pagination for the carousel */}
            {products.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-4">
                {products.map((_, i) => (
                  <span
                    key={i}
                    className="rounded-full transition-all duration-300"
                    style={{
                      width: i === activeProductIndex ? 18 : 6,
                      height: 6,
                      background: i === activeProductIndex ? '#0071e3' : '#d2d2d7',
                    }}
                  />
                ))}
              </div>
            )}

            {/* ── Machine health card ── */}
            {(() => {
              const totalStock = products.reduce((s, p) => s + p.stock, 0);
              const stockState =
                totalStock === 0 ? { label: 'Empty', color: '#c8102e' } :
                totalStock < 5 ? { label: `${totalStock} left`, color: '#9a6400' } :
                { label: `${totalStock} units`, color: '#1d7a3c' };

              const signalState = (() => {
                if (machine?.wifi_rssi == null) return { label: 'Connected', color: '#1d7a3c' };
                if (machine.wifi_rssi >= -60) return { label: 'Excellent', color: '#1d7a3c' };
                if (machine.wifi_rssi >= -75) return { label: 'Good', color: '#1d7a3c' };
                return { label: 'Weak', color: '#9a6400' };
              })();

              const wellnessState = (() => {
                if (machine?.temperature != null && machine.temperature > 45) return { label: 'Warm', color: '#9a6400' };
                if (machine?.last_error) return { label: 'Attention', color: '#9a6400' };
                return { label: 'Optimal', color: '#1d7a3c' };
              })();

              return (
                <div
                  className="flex items-center justify-center gap-6 mt-5 py-4 rounded-2xl animate-fade-in bg-white"
                  style={{ animationDelay: '0.55s', boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 6px 20px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}
                >
                  {[
                    { icon: Activity, label: 'Health', value: wellnessState },
                    { icon: Wifi, label: 'Signal', value: signalState },
                    { icon: Package, label: 'Stock', value: stockState },
                  ].map(({ icon: Icon, label, value }, i) => (
                    <div key={label} className="flex items-center gap-6">
                      {i > 0 && <div className="w-px h-8 bg-[#f0f0f2]" />}
                      <div className="flex flex-col items-center gap-1.5">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center"
                          style={{ background: `${value.color}18` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: value.color }} strokeWidth={2} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: value.color }}>{value.label}</span>
                        <span className="text-[9px] font-medium uppercase tracking-wide text-[#a1a1a6]">{label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── Trust bar ── */}
            <div
              className="flex items-center justify-center gap-6 mt-6 mb-1 py-4 rounded-2xl animate-fade-in bg-white"
              style={{ animationDelay: '0.6s', boxShadow: '0 1px 2px rgba(0,0,0,0.03), 0 6px 20px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.04)' }}
            >
              {[
                { icon: Lock, label: 'Secure' },
                { icon: Zap, label: 'Contactless' },
                { icon: Sparkles, label: 'Instant' },
              ].map(({ icon: Icon, label }, i) => (
                <div key={label} className="flex items-center gap-6">
                  {i > 0 && <div className="w-px h-8 bg-[#f0f0f2]" />}
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #0071e3, #0058b0)' }}
                    >
                      <Icon className="w-4 h-4 text-white" strokeWidth={2} />
                    </div>
                    <span className="text-[10px] font-semibold text-[#6e6e73]">{label}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-[10px] mt-3 mb-4 text-[#a1a1a6] tracking-wide">
              Care without compromise
            </p>
            </>)}

            {/* ── Sticky Pay Now bar — floating pill, detached from the edges ── */}
            {cart.size > 0 && (
              <div className="fixed bottom-4 left-4 right-4 z-20">
                <div
                  className="max-w-md mx-auto rounded-[28px] px-4 py-3.5 bg-white/95 backdrop-blur-xl"
                  style={{ boxShadow: '0 20px 48px rgba(0,0,0,0.16), 0 1px 2px rgba(0,0,0,0.04)', border: '1px solid rgba(255,255,255,0.6)' }}
                >
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
                        <p key={getTotalAmount()} className="text-lg font-semibold leading-none text-[#1d1d1f] animate-badge-bump inline-block">₹{getTotalAmount().toFixed(0)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-1">
                      <button
                        onClick={() => setShowCart(true)}
                        className="hidden sm:flex px-4 py-3 min-h-11 rounded-full text-sm font-semibold transition-colors border border-[#d2d2d7] text-[#1d1d1f]"
                      >
                        View Cart
                      </button>
                      <button
                        onClick={handleCheckout}
                        disabled={isProcessing || !razorpayLoaded}
                        className="flex-1 py-3 min-h-11 rounded-full text-[15px] font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed text-white disabled:bg-[#f5f5f7] disabled:text-[#a1a1a6] disabled:shadow-none"
                        style={
                          isProcessing || !razorpayLoaded
                            ? undefined
                            : { background: 'linear-gradient(135deg, #0071e3, #0058b0)', boxShadow: '0 6px 16px rgba(0,113,227,0.35)' }
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
              <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 bg-black/40 backdrop-blur-sm">
                <div
                  className="w-full sm:max-w-lg sm:mx-4 rounded-t-[28px] sm:rounded-[28px] max-h-[90vh] overflow-hidden bg-white"
                  style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.18), 0 24px 64px rgba(0,0,0,0.18)' }}
                >
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
                          <div key={item.product_id} className="flex items-center gap-3.5 py-2">
                            <div
                              className="relative w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
                              style={{ background: 'linear-gradient(155deg, #0c1a33, #10305e 60%, #0071e3 140%)' }}
                            >
                              <div
                                className="absolute w-16 h-16 rounded-full pointer-events-none"
                                style={{ background: 'radial-gradient(closest-side, rgba(255,255,255,0.22), transparent)' }}
                              />
                              <Image
                                src="/icons/Gemini_Generated_Image_mypgjumypgjumypg-removebg-preview.png"
                                alt=""
                                width={677}
                                height={369}
                                className="relative z-10 w-11 h-auto"
                                style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[15px] font-bold text-[#1d1d1f] truncate">{item.name}</p>
                              <p className="text-xs text-[#86868b] mb-1">Sanitary napkin</p>
                              <p className="text-base font-bold text-[#1d1d1f]">₹{parseFloat(item.price).toFixed(0)}</p>
                            </div>
                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                onClick={() => updateQuantity(item.product_id, -1)}
                                className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 bg-white"
                                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}
                              >
                                <Minus className="w-3.5 h-3.5 text-[#1d1d1f]" />
                              </button>
                              <span className="text-sm font-semibold text-[#1d1d1f] min-w-4 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.product_id, 1)}
                                disabled={getTotalItems() >= 3 || item.quantity >= item.stock}
                                className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 bg-white disabled:opacity-30"
                                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}
                              >
                                <Plus className="w-3.5 h-3.5 text-[#1d1d1f]" />
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
                        className="w-full py-4 min-h-11 rounded-2xl font-semibold text-[15px] transition-all active:scale-[0.97] disabled:cursor-not-allowed text-white disabled:bg-[#f5f5f7] disabled:text-[#a1a1a6] disabled:shadow-none"
                        style={isProcessing ? undefined : { background: 'linear-gradient(135deg, #0071e3, #0058b0)', boxShadow: '0 8px 20px rgba(0,113,227,0.35)' }}
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

          {/* ── Minimal checkout footer (not the marketing footer) ── */}
          <footer className={`max-w-md mx-auto px-5 pt-2 text-center ${cart.size > 0 ? 'pb-32' : 'pb-10'}`}>
            <p className="text-xs font-medium text-[#86868b] mb-3">Lyra Enterprises</p>

            {/* Social / contact icon row */}
            <div className="flex items-center justify-center gap-2.5 mb-4">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-white transition-all active:scale-90 hover:-translate-y-0.5"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
                >
                  <Icon className="w-4 h-4 text-[#1d1d1f]" strokeWidth={1.75} />
                </a>
              ))}
            </div>

            <p className="text-[10px] text-[#a1a1a6]">
              Need help? <a href="mailto:support@lyraenterprise.co.in" className="text-[#0071e3] hover:underline">support@lyraenterprise.co.in</a>
            </p>
          </footer>
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
        <HowItWorksSection />
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

