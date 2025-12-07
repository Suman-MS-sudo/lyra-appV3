import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function CustomerDashboard() {
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
            <h1 className="text-xl font-bold text-gray-900">Lyra</h1>
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">My Dashboard</h2>
          <p className="text-gray-600">Welcome back! Here's your activity</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-sm text-gray-600 mb-1">Total Purchases</div>
            <div className="text-3xl font-bold text-gray-900">24</div>
            <div className="text-sm text-gray-600 mt-2">All time</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-sm text-gray-600 mb-1">Total Spent</div>
            <div className="text-3xl font-bold text-gray-900">$156.80</div>
            <div className="text-sm text-gray-600 mt-2">Last 30 days</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-sm text-gray-600 mb-1">Favorite Item</div>
            <div className="text-xl font-bold text-gray-900">Coffee</div>
            <div className="text-sm text-gray-600 mt-2">12 purchases</div>
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Purchases</h3>
          <div className="space-y-4">
            {[
              { name: 'Coffee', location: 'Building A', time: '2 hours ago', price: 3.50 },
              { name: 'Water', location: 'Building B', time: 'Yesterday', price: 2.00 },
              { name: 'Snack', location: 'Building A', time: '2 days ago', price: 4.50 },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b last:border-0">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.location} • {item.time}</div>
                </div>
                <div className="font-semibold text-gray-900">${item.price.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
