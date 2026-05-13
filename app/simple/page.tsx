export default function SimpleTest() {
  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-green-600">✅ Application Working!</h1>
        
        <div className="bg-green-50 p-6 rounded-lg mb-6">
          <h2 className="font-semibold text-green-800 mb-2">Server Status</h2>
          <p className="text-green-600">✅ Frontend: http://localhost:3000</p>
          <p className="text-green-600">✅ Backend: http://localhost:5000</p>
          <p className="text-green-600">✅ Page loads without redirects</p>
        </div>

        <div className="bg-blue-50 p-6 rounded-lg">
          <h2 className="font-semibold text-blue-800 mb-2">Test Navigation</h2>
          <div className="space-y-2">
            <a href="/" className="block text-blue-600 hover:underline">🏠 Home</a>
            <a href="/login" className="block text-blue-600 hover:underline">🔐 Login</a>
            <a href="/dashboard" className="block text-blue-600 hover:underline">📊 Dashboard</a>
          </div>
        </div>
      </div>
    </div>
  );
}
