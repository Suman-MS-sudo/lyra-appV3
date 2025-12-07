import { createClient } from '@/lib/supabase/server';

export interface DashboardMetrics {
  totalMachines: number;
  activeMachines: number;
  totalProducts: number;
  lowStockProducts: number;
  totalTransactions: number;
  totalRevenue: number;
  revenueThisMonth: number;
  transactionsToday: number;
}

export async function getAdminDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = await createClient();

  // Get total and active machines
  const { count: totalMachines } = await supabase
    .from('vending_machines')
    .select('*', { count: 'exact', head: true });

  const { count: activeMachines } = await supabase
    .from('vending_machines')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'online');

  // Get total products and low stock count
  const { count: totalProducts } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  const { count: lowStockProducts } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .lt('stock', 5);

  // Get transaction metrics
  const { count: totalTransactions } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true });

  const { data: revenueData } = await supabase
    .from('transactions')
    .select('amount')
    .eq('status', 'completed');

  const totalRevenue = revenueData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  // Revenue this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: monthlyRevenue } = await supabase
    .from('transactions')
    .select('amount')
    .eq('status', 'completed')
    .gte('created_at', startOfMonth.toISOString());

  const revenueThisMonth = monthlyRevenue?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  // Transactions today
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count: transactionsToday } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfDay.toISOString());

  return {
    totalMachines: totalMachines || 0,
    activeMachines: activeMachines || 0,
    totalProducts: totalProducts || 0,
    lowStockProducts: lowStockProducts || 0,
    totalTransactions: totalTransactions || 0,
    totalRevenue,
    revenueThisMonth,
    transactionsToday: transactionsToday || 0,
  };
}

export interface CustomerMetrics {
  totalPurchases: number;
  totalSpent: number;
  favoriteProduct: string | null;
  recentTransactions: Array<{
    id: string;
    product_name: string;
    amount: number;
    created_at: string;
  }>;
}

export async function getCustomerMetrics(userId: string): Promise<CustomerMetrics> {
  const supabase = await createClient();

  const { count: totalPurchases } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');

  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('status', 'completed');

  const totalSpent = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  // Get favorite product
  const { data: productCounts } = await supabase
    .from('transactions')
    .select('product_id, products(name)')
    .eq('user_id', userId)
    .eq('status', 'completed');

  const productFrequency: Record<string, { name: string; count: number }> = {};
  productCounts?.forEach((t: any) => {
    const productId = t.product_id;
    const productName = t.products?.name || 'Unknown';
    if (!productFrequency[productId]) {
      productFrequency[productId] = { name: productName, count: 0 };
    }
    productFrequency[productId].count++;
  });

  const favoriteProduct = Object.values(productFrequency).sort((a, b) => b.count - a.count)[0]?.name || null;

  // Recent transactions
  const { data: recentTransactions } = await supabase
    .from('transactions')
    .select('id, amount, created_at, products(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  return {
    totalPurchases: totalPurchases || 0,
    totalSpent,
    favoriteProduct,
    recentTransactions: recentTransactions?.map((t: any) => ({
      id: t.id,
      product_name: t.products?.name || 'Unknown',
      amount: t.amount,
      created_at: t.created_at,
    })) || [],
  };
}
