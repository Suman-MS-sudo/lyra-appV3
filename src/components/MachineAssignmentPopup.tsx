'use client';

import { useState } from 'react';
import { Building2, X } from 'lucide-react';

interface Machine {
  id: string;
  name: string;
  location: string;
  status: string;
}

interface MachineAssignmentPopupProps {
  machines: Machine[];
  userName: string;
}

export default function MachineAssignmentPopup({ machines, userName }: MachineAssignmentPopupProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
      >
        View {machines.length} {machines.length === 1 ? 'device' : 'devices'}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Assigned Machines</h3>
                <p className="text-sm text-gray-600 mt-0.5">{userName} - {machines.length} {machines.length === 1 ? 'machine' : 'machines'}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Machine List */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {machines.map((machine) => (
                  <div 
                    key={machine.id} 
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                  >
                    <div className="flex-shrink-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        machine.status === 'online' || machine.status === 'active'
                          ? 'bg-green-100'
                          : 'bg-red-100'
                      }`}>
                        <Building2 className={`w-5 h-5 ${
                          machine.status === 'online' || machine.status === 'active'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">{machine.name}</div>
                      <div className="text-xs text-gray-500 truncate">{machine.location}</div>
                    </div>
                    <div className={`flex-shrink-0 w-2 h-2 rounded-full ${
                      machine.status === 'online' || machine.status === 'active'
                        ? 'bg-green-500'
                        : 'bg-red-500'
                    }`} title={machine.status}></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
