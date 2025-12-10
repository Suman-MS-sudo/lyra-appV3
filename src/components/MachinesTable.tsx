'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Filter, Download, RefreshCw, MapPin, Activity, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface Machine {
  id: string;
  name: string;
  machine_id: string;
  mac_id: string;
  location: string;
  status: string;
  customer_name: string;
  product_type: string;
  machine_type: string;
  last_sync: string | null;
  asset_online: boolean;
  stock_level: number | null;
  created_at: string;
}

interface MachinesTableProps {
  machines: Machine[];
}

export default function MachinesTable({ machines }: MachinesTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [onlineFilter, setOnlineFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showFilters, setShowFilters] = useState(false);

  // Get unique customers
  const customers = useMemo(() => {
    const uniqueCustomers = new Set(machines.map(m => m.customer_name).filter(Boolean));
    return Array.from(uniqueCustomers).sort();
  }, [machines]);

  // Filter and search machines
  const filteredMachines = useMemo(() => {
    return machines.filter(machine => {
      const matchesSearch = 
        machine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        machine.machine_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        machine.mac_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        machine.location.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || machine.status === statusFilter;
      const matchesCustomer = customerFilter === 'all' || machine.customer_name === customerFilter;
      const matchesOnline = 
        onlineFilter === 'all' ||
        (onlineFilter === 'online' && machine.asset_online) ||
        (onlineFilter === 'offline' && !machine.asset_online);

      return matchesSearch && matchesStatus && matchesCustomer && matchesOnline;
    });
  }, [machines, searchQuery, statusFilter, customerFilter, onlineFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredMachines.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMachines = filteredMachines.slice(startIndex, startIndex + itemsPerPage);

  // Stats
  const stats = useMemo(() => ({
    total: machines.length,
    online: machines.filter(m => m.asset_online).length,
    offline: machines.filter(m => !m.asset_online).length,
    lowStock: machines.filter(m => m.stock_level !== null && m.stock_level < 5).length,
  }), [machines]);

  const getStatusBadge = (status: string) => {
    const styles = {
      online: 'bg-green-100 text-green-800',
      offline: 'bg-gray-100 text-gray-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
    }[status] || 'bg-gray-100 text-gray-800';
    
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles}`}>{status}</span>;
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Machine ID', 'MAC ID', 'Location', 'Status', 'Customer', 'Type', 'Last Sync'];
    const rows = filteredMachines.map(m => [
      m.name,
      m.machine_id,
      m.mac_id,
      m.location,
      m.status,
      m.customer_name,
      m.machine_type,
      m.last_sync ? new Date(m.last_sync).toLocaleString() : 'Never'
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `machines-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Machines</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Online</p>
              <p className="text-2xl font-bold text-green-600">{stats.online}</p>
            </div>
            <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Offline</p>
              <p className="text-2xl font-bold text-gray-600">{stats.offline}</p>
            </div>
            <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-gray-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Low Stock</p>
              <p className="text-2xl font-bold text-orange-600">{stats.lowStock}</p>
            </div>
            <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, machine ID, MAC address, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="h-4 w-4" />
            Filters {(statusFilter !== 'all' || customerFilter !== 'all' || onlineFilter !== 'all') && '(Active)'}
          </button>
          
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="grid md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Customers</option>
                {customers.map(customer => (
                  <option key={customer} value={customer}>{customer}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Connection</label>
              <select
                value={onlineFilter}
                onChange={(e) => setOnlineFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="online">Connected</option>
                <option value="offline">Disconnected</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Info */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <p>
          Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredMachines.length)} of {filteredMachines.length} machines
        </p>
        <select
          value={itemsPerPage}
          onChange={(e) => {
            setItemsPerPage(Number(e.target.value));
            setCurrentPage(1);
          }}
          className="px-3 py-1 border border-gray-300 rounded-lg"
        >
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
          <option value={250}>250 per page</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Machine ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Connection</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Sync</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedMachines.map((machine) => (
                <tr key={machine.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{machine.name}</div>
                    <div className="text-xs text-gray-500">{machine.machine_type}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{machine.machine_id}</div>
                    <div className="text-xs text-gray-500">{machine.mac_id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center text-sm text-gray-900">
                      <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                      {machine.location}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{machine.customer_name || '-'}</td>
                  <td className="px-4 py-3">{getStatusBadge(machine.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center">
                      <div className={`h-2 w-2 rounded-full mr-2 ${machine.asset_online ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-sm text-gray-900">{machine.asset_online ? 'Online' : 'Offline'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {machine.last_sync ? new Date(machine.last_sync).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/machines/${machine.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = i + 1;
            return (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-4 py-2 border rounded-lg ${
                  currentPage === page
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            );
          })}
          
          {totalPages > 5 && <span className="px-2">...</span>}
          
          {totalPages > 5 && (
            <button
              onClick={() => setCurrentPage(totalPages)}
              className={`px-4 py-2 border rounded-lg ${
                currentPage === totalPages
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {totalPages}
            </button>
          )}
          
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
