import { Heart, Users, Building2, School } from 'lucide-react';

export function AboutSection() {
  return (
    <section id="about" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-purple-600">About Us</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Revolutionizing Women's Hygiene Access
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <div className="rounded-3xl bg-gradient-to-br from-blue-50 to-purple-50 px-8 py-12 sm:px-12 lg:px-16">
            <div className="flex items-start gap-4 mb-6">
              <Heart className="h-8 w-8 text-purple-600 flex-shrink-0 mt-1" />
              <div>
                <p className="text-lg leading-8 text-gray-700">
                  At <span className="font-semibold text-purple-600">Lyra Enterprises</span>, we empower women's hygiene 
                  through innovative sanitary napkin vending machines. We offer easy-to-use, cashless solutions for schools, 
                  workplaces, and public spaces, promoting menstrual health and accessibility.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Use cases */}
        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-purple-100 p-4 mb-4">
              <School className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Schools</h3>
            <p className="mt-2 text-sm text-gray-600">Ensuring student wellness and dignity</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-blue-100 p-4 mb-4">
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Workplaces</h3>
            <p className="mt-2 text-sm text-gray-600">Employee health and convenience</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-pink-100 p-4 mb-4">
              <Users className="h-8 w-8 text-pink-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Public Spaces</h3>
            <p className="mt-2 text-sm text-gray-600">Accessible hygiene for everyone</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-purple-100 p-4 mb-4">
              <Heart className="h-8 w-8 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Community</h3>
            <p className="mt-2 text-sm text-gray-600">Breaking menstrual health stigma</p>
          </div>
        </div>
      </div>
    </section>
  );
}
