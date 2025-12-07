import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminDashboard() {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg"></div>
            <h1 className="text-xl font-bold text-gray-900">Lyra Admin</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <form action="/api/auth/logout" method="POST">
              <button className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Logout
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-gray-600">Welcome to your admin dashboard</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-sm text-gray-600 mb-1">Total Machines</div>
            <div className="text-3xl font-bold text-gray-900">12</div>
            <div className="text-sm text-green-600 mt-2">+2 this month</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-sm text-gray-600 mb-1">Active Users</div>
            <div className="text-3xl font-bold text-gray-900">248</div>
            <div className="text-sm text-green-600 mt-2">+12% from last week</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-sm text-gray-600 mb-1">Revenue</div>
            <div className="text-3xl font-bold text-gray-900">$8,450</div>
            <div className="text-sm text-green-600 mt-2">+18% this month</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-sm text-gray-600 mb-1">Transactions</div>
            <div className="text-3xl font-bold text-gray-900">1,284</div>
            <div className="text-sm text-gray-600 mt-2">Last 30 days</div>
          </div>
        </div>

        {/* Tables */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Machines</h3>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-gray-900">Machine #{i}</div>
                    <div className="text-sm text-gray-500">Location {i}</div>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    Online
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-gray-900">Product {i}</div>
                    <div className="text-sm text-gray-500">2 min ago</div>
                  </div>
                  <span className="font-semibold text-gray-900">${(5 * i).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
