import InteractiveAvatar from '../components/avatar/InteractiveAvatar';

export default function SupportPage() {
    return (
          <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
                <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
                        <img src="/haulflow-logo.png" alt="HaulFlow TMS" className="h-8 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="text-xl font-bold text-gray-900">HaulFlow TMS</span>span>
                </header>header>
          
            {/* Hero */}
                <div className="bg-blue-700 text-white px-6 py-12 text-center">
                        <h1 className="text-3xl font-bold mb-2">Support Center</h1>h1>
                        <p className="text-blue-100 text-lg">We're here to help you get the most out of HaulFlow TMS</p>p>
                </div>div>
          
            {/* Main content */}
                <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10 space-y-8">
                
                  {/* Kristy intro */}
                        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                  <div className="flex items-start gap-4">
                                              <div className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border-2 border-blue-600">
                                                            <img
                                                                              src="https://haulflow.turtlelogisticsllc.com/kristy-avatar.png"
                                                                              alt="Kristy"
                                                                              className="w-full h-full object-cover"
                                                                              onError={(e) => {
                                                                                                  const el = e.target as HTMLImageElement;
                                                                                                  el.style.display = 'none';
                                                                              }}
                                                                            />
                                              </div>div>
                                              <div>
                                                            <h2 className="text-lg font-semibold text-gray-900">Chat with Kristy — AI Support</h2>h2>
                                                            <p className="text-gray-600 mt-1">
                                                                            Kristy is HaulFlow's built-in AI support assistant. She can answer questions about loads, drivers,
                                                                            invoices, IFTA reporting, fleet management, and anything else in the app — instantly, 24/7.
                                                            </p>p>
                                                            <p className="text-gray-500 text-sm mt-2">
                                                                            Click the <strong>Kristy</strong>strong> button in the bottom-right corner to start a conversation.
                                                            </p>p>
                                              </div>div>
                                  </div>div>
                        </section>section>
                
                  {/* Contact info */}
                        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Us</h2>h2>
                                  <div className="space-y-3 text-gray-600">
                                              <div className="flex items-center gap-3">
                                                            <span className="text-blue-600 font-medium w-20">Email</span>span>
                                                            <a href="mailto:support@haulflow.app" className="text-blue-600 hover:underline">support@haulflow.app</a>a>
                                              </div>div>
                                              <div className="flex items-center gap-3">
                                                            <span className="text-blue-600 font-medium w-20">Website</span>span>
                                                            <a href="https://haulflow.turtlelogisticsllc.com" className="text-blue-600 hover:underline">haulflow.turtlelogisticsllc.com</a>a>
                                              </div>div>
                                  </div>div>
                        </section>section>
                
                  {/* FAQ */}
                        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>h2>
                                  <div className="space-y-4 text-gray-600">
                                              <div>
                                                            <p className="font-medium text-gray-800">How do I add a new load?</p>p>
                                                            <p className="text-sm mt-1">Go to the Loads tab and tap the + button to create a new load. You can assign a driver, set pickup and delivery locations, and track status in real time.</p>p>
                                              </div>div>
                                              <div>
                                                            <p className="font-medium text-gray-800">How do I invite a driver?</p>p>
                                                            <p className="text-sm mt-1">Navigate to the Drivers tab, tap Add Driver, and enter their information. They will receive an invitation to download the HaulFlow Driver app.</p>p>
                                              </div>div>
                                              <div>
                                                            <p className="font-medium text-gray-800">How do I generate an invoice?</p>p>
                                                            <p className="text-sm mt-1">Open any completed load and tap Generate Invoice. You can customize and send it directly to the customer from within the app.</p>p>
                                              </div>div>
                                              <div>
                                                            <p className="font-medium text-gray-800">How do I run an IFTA report?</p>p>
                                                            <p className="text-sm mt-1">Go to the IFTA tab, select your reporting quarter, and HaulFlow will automatically calculate mileage by state from your load data.</p>p>
                                              </div>div>
                                              <div>
                                                            <p className="font-medium text-gray-800">I forgot my password. How do I reset it?</p>p>
                                                            <p className="text-sm mt-1">On the login screen, tap "Forgot Password" and enter your email address. You will receive a reset link within a few minutes.</p>p>
                                              </div>div>
                                  </div>div>
                        </section>section>
                
                </main>main>
          
            {/* Footer */}
                <footer className="text-center text-gray-400 text-sm py-6 border-t border-gray-200">
                        &copy; {new Date().getFullYear()} Turtle Logistics LLC &mdash; HaulFlow TMS
                </footer>footer>
          
            {/* Kristy AI chat widget */}
                <InteractiveAvatar context="demo" />
          </div>div>
        );
}</div>
