'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createVendingMachine } from '@/app/actions/admin';

interface Organization {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
}

interface MachineFormProps {
  organizations: Organization[];
  products: Product[];
}

export function MachineForm({ organizations, products }: MachineFormProps) {
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  const handleOrgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const orgId = e.target.value;
    const org = organizations.find(o => o.id === orgId);
    setSelectedOrg(org || null);

    // Auto-populate organization details
    if (org) {
      const nameInput = document.getElementById('customer_name') as HTMLInputElement;
      const contactInput = document.getElementById('customer_contact') as HTMLInputElement;
      const addressInput = document.getElementById('customer_address') as HTMLTextAreaElement;
      
      if (nameInput) nameInput.value = org.name || '';
      if (contactInput && org.contact_phone) contactInput.value = org.contact_phone;
      if (addressInput && org.address) addressInput.value = org.address;
    }
  };

  return (
    <form action={createVendingMachine} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Basic Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Machine Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., L&T-22"
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
              Location <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="location"
              name="location"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Building A, Floor 2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="machine_id" className="block text-sm font-medium text-gray-700 mb-2">
              Machine ID
            </label>
            <input
              type="text"
              id="machine_id"
              name="machine_id"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., CN00005_SNVM_00022"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              id="status"
              name="status"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="offline">Offline</option>
              <option value="online">Online</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>
      </div>

      {/* Hardware Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Hardware Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="machine_type" className="block text-sm font-medium text-gray-700 mb-2">
              Machine Type
            </label>
            <input
              type="text"
              id="machine_type"
              name="machine_type"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., SNVM_WF_SL30"
            />
          </div>

          <div>
            <label htmlFor="product_type" className="block text-sm font-medium text-gray-700 mb-2">
              Product Type
            </label>
            <input
              type="text"
              id="product_type"
              name="product_type"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., SANITARY PAD"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="mac_id" className="block text-sm font-medium text-gray-700 mb-2">
              MAC Address
            </label>
            <input
              type="text"
              id="mac_id"
              name="mac_id"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 00:4B:12:2F:C7:C4"
            />
          </div>

          <div>
            <label htmlFor="ip_address" className="block text-sm font-medium text-gray-700 mb-2">
              IP Address
            </label>
            <input
              type="text"
              id="ip_address"
              name="ip_address"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 192.168.1.100"
            />
          </div>
        </div>

        <div>
          <label htmlFor="firmware_version" className="block text-sm font-medium text-gray-700 mb-2">
            Firmware Version
          </label>
          <input
            type="text"
            id="firmware_version"
            name="firmware_version"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., v1.2.3"
          />
        </div>
      </div>

      {/* Organization Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Organization Information</h3>
        
        <div>
          <label htmlFor="organization_id" className="block text-sm font-medium text-gray-700 mb-2">
            Select Organization <span className="text-red-500">*</span>
          </label>
          <select
            id="organization_id"
            name="organization_id"
            required
            onChange={handleOrgChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Select an organization --</option>
            {organizations?.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} {org.contact_email && `(${org.contact_email})`}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Organization details will auto-populate below</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-2">
              Organization Name
            </label>
            <input
              type="text"
              id="customer_name"
              name="customer_name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              placeholder="Auto-filled from selection"
              readOnly
            />
          </div>

          <div>
            <label htmlFor="customer_code" className="block text-sm font-medium text-gray-700 mb-2">
              Organization Code
            </label>
            <input
              type="text"
              id="customer_code"
              name="customer_code"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., ORG001"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="customer_contact" className="block text-sm font-medium text-gray-700 mb-2">
              Contact Number
            </label>
            <input
              type="text"
              id="customer_contact"
              name="customer_contact"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., +91 9876543210"
            />
          </div>

          <div>
            <label htmlFor="customer_alternate_contact" className="block text-sm font-medium text-gray-700 mb-2">
              Alternate Contact
            </label>
            <input
              type="text"
              id="customer_alternate_contact"
              name="customer_alternate_contact"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., +91 9876543211"
            />
          </div>
        </div>

        <div>
          <label htmlFor="customer_address" className="block text-sm font-medium text-gray-700 mb-2">
            Organization Address
          </label>
          <textarea
            id="customer_address"
            name="customer_address"
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
            placeholder="Auto-filled from selection"
            readOnly
          />
        </div>

        <div>
          <label htmlFor="customer_location" className="block text-sm font-medium text-gray-700 mb-2">
            Location/City
          </label>
          <input
            type="text"
            id="customer_location"
            name="customer_location"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Mumbai, Maharashtra"
          />
        </div>
      </div>

      {/* Product Mapping */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Product Mapping</h3>
        <p className="text-sm text-gray-600">Select products to be available in this machine</p>
        
        <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
          {products && products.length > 0 ? (
            products.map((product) => (
              <label
                key={product.id}
                className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  name="product_ids"
                  value={product.id}
                  className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{product.name}</div>
                  {product.description && (
                    <div className="text-sm text-gray-500">{product.description}</div>
                  )}
                  <div className="text-sm text-gray-600 mt-1">Price: ₹{product.price}</div>
                </div>
              </label>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No products available</p>
              <p className="text-sm mt-2">Create products first from the Products page</p>
            </div>
          )}
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Selected products will be mapped with default stock (0) and price (₹0). 
            Update stock and pricing after machine creation.
          </p>
        </div>
      </div>

      {/* Maintenance */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Maintenance & Warranty</h3>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="purchase_date" className="block text-sm font-medium text-gray-700 mb-2">
              Purchase Date
            </label>
            <input
              type="date"
              id="purchase_date"
              name="purchase_date"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="warranty_till" className="block text-sm font-medium text-gray-700 mb-2">
              Warranty Till
            </label>
            <input
              type="date"
              id="warranty_till"
              name="warranty_till"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="amc_till" className="block text-sm font-medium text-gray-700 mb-2">
              AMC Till
            </label>
            <input
              type="date"
              id="amc_till"
              name="amc_till"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <Link
          href="/admin/machines"
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-center font-medium"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Create Machine
        </button>
      </div>
    </form>
  );
}
