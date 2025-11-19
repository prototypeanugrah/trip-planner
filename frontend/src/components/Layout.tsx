import { Outlet, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TripService } from '@/services/api';
import { cn } from '@/lib/utils';
import { Plus, Map, Menu } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CreateTripWizard } from '@/components/CreateTripWizard';

export function Layout() {
  const { data: trips, isLoading } = useQuery({
    queryKey: ['trips'],
    queryFn: TripService.getAll,
  });
  
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-bg-primary text-text-primary">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
            "fixed md:sticky top-0 left-0 h-screen w-[280px] bg-bg-secondary border-r border-border z-50 transition-transform duration-300 ease-in-out flex flex-col",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-5 border-b border-border flex justify-between items-center">
            <h1 className="text-xl font-bold tracking-tight">Pack Vote</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-text-secondary">
                <Menu className="w-6 h-6" />
            </button>
        </div>

        <div className="p-4">
            <Button className="w-full" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New Trip
            </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
            <div className="px-3 mb-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Your Trips
            </div>
            {isLoading ? (
                <div className="px-3 text-sm text-text-tertiary">Loading...</div>
            ) : trips?.length === 0 ? (
                <div className="px-3 text-sm text-text-tertiary">No trips yet</div>
            ) : (
                trips?.map(trip => (
                    <Link
                        key={trip.id}
                        to={`/trip/${trip.id}`}
                        onClick={() => setIsSidebarOpen(false)}
                        className={cn(
                            "flex items-center px-3 py-2.5 rounded-lg text-[15px] font-medium transition-colors group",
                            location.pathname === `/trip/${trip.id}` 
                                ? "bg-accent-blue text-white" 
                                : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                        )}
                    >
                        <div className="flex-1 truncate">{trip.name}</div>
                        {trip.status === 'finalized' && <div className="w-1.5 h-1.5 rounded-full bg-green-500 ml-2" />}
                    </Link>
                ))
            )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-border flex items-center px-4 sticky top-0 bg-bg-primary/80 backdrop-blur-md z-30">
            <button onClick={() => setIsSidebarOpen(true)} className="text-text-primary">
                <Menu className="w-6 h-6" />
            </button>
            <span className="ml-4 font-semibold">Pack Vote</span>
        </header>

        <div className="p-4 md:p-8 max-w-5xl mx-auto animate-fade-in">
            <Outlet />
        </div>
      </main>

      <CreateTripWizard 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />
    </div>
  );
}

// Placeholder for Layout
export function SidebarItem({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>
}

