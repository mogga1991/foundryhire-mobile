import { Loader2, Briefcase } from 'lucide-react'

export default function PortalLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Header Skeleton */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-24 bg-gray-100 rounded animate-pulse mt-1" />
            </div>
          </div>
          <div className="text-right">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse ml-auto" />
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse mt-1 ml-auto" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Loading Animation */}
        <div className="flex flex-col items-center justify-center py-16">
          <div className="relative mb-8">
            {/* Animated pulse rings */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-orange-200 animate-ping opacity-25" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-20 w-20 rounded-full bg-orange-300 animate-pulse" />
            </div>

            {/* Center icon */}
            <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mx-4 my-4">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Loading Interview Portal
          </h2>
          <p className="text-gray-600 text-center max-w-md">
            Please wait while we prepare your interview details...
          </p>
        </div>

        {/* Content Skeleton */}
        <div className="space-y-8 mt-8">
          {/* Tab Navigation Skeleton */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex-1 h-12 bg-gray-200 rounded-lg animate-pulse"
              />
            ))}
          </div>

          {/* Cards Skeleton */}
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
              >
                <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4" />
                <div className="space-y-4">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex items-start gap-3">
                      <div className="h-5 w-5 bg-gray-200 rounded animate-pulse mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        <div className="h-3 w-3/4 bg-gray-100 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16 py-8 text-center">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mx-auto" />
      </footer>
    </div>
  )
}
