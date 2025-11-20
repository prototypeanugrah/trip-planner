import { Outlet, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TripService } from '@/services/api';
import { cn } from '@/lib/utils';
import { Plus, Menu, Luggage } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { CreateTripWizard } from '@/components/CreateTripWizard';
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/clerk-react";

const BACKGROUND_IMAGES = [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2073&auto=format&fit=crop", // Beach
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop", // Mountain
    "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=1740&auto=format&fit=crop", // Nightlife
    "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?q=80&w=2076&auto=format&fit=crop", // Mountain 2
    "https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?q=80&w=2000&auto=format&fit=crop", // Beach 2
];

export function Layout() {
    const { user, isSignedIn } = useUser();
    const { data: trips, isLoading } = useQuery({
        queryKey: ['trips', user?.primaryEmailAddress?.emailAddress],
        queryFn: () => TripService.getAll(user?.primaryEmailAddress?.emailAddress),
        enabled: !!isSignedIn && !!user?.primaryEmailAddress?.emailAddress
    });

    const location = useLocation();
    const isLandingPage = location.pathname === '/' && !isSignedIn;
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [bgImage, setBgImage] = useState("");

    useEffect(() => {
        setBgImage(BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]);
    }, []);

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    return (
        <div className="h-screen w-screen overflow-hidden flex relative text-text-primary">
            {/* Dynamic Background */}
            <div className="fixed inset-0 -z-20 overflow-hidden">
                {bgImage && (
                    <>
                        <img
                            src={bgImage}
                            className="w-full h-full object-cover blur-sm scale-105"
                            alt="background"
                        />
                        <div className="absolute inset-0 bg-black/70" />
                    </>
                )}
            </div>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && !isLandingPage && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            {!isLandingPage && (
                <aside
                    className={cn(
                        "fixed md:sticky top-0 left-0 h-screen bg-bg-secondary border-r border-border z-50 transition-all duration-300 ease-in-out flex flex-col overflow-hidden",
                        isSidebarOpen ? "translate-x-0 w-[280px]" : "-translate-x-full md:translate-x-0",
                        isSidebarCollapsed ? "md:w-0 md:border-r-0" : "md:w-[280px]"
                    )}
                >
                    <div className="p-6 border-b border-border flex items-center gap-3 min-w-[280px]">
                        <div className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center shadow-lg shadow-accent-blue/20">
                            <Luggage className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-lg font-bold tracking-tight">PackVote</h1>
                        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-text-secondary ml-auto">
                            <Menu className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-4 min-w-[280px]">
                        <SignedIn>
                            <Button variant="secondary" className="w-full justify-start border border-border hover:bg-bg-tertiary" onClick={() => setIsCreateModalOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                New Trip
                            </Button>
                        </SignedIn>
                        <SignedOut>
                            <SignInButton mode="modal">
                                <Button variant="secondary" className="w-full justify-start border border-border hover:bg-bg-tertiary">
                                    <Plus className="w-4 h-4 mr-2" />
                                    New Trip
                                </Button>
                            </SignInButton>
                        </SignedOut>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-w-[280px]">
                        <div className="px-3 mb-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                            Your Trips
                        </div>
                        <SignedOut>
                            <div className="px-3 text-sm text-text-tertiary">Sign in to view trips</div>
                        </SignedOut>
                        <SignedIn>
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
                                                ? "bg-accent-blue text-white shadow-sm"
                                                : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                                        )}
                                    >
                                        <div className="flex-1 truncate">{trip.name}</div>
                                        {trip.status === 'finalized' && <div className="w-1.5 h-1.5 rounded-full bg-green-500 ml-2" />}
                                    </Link>
                                ))
                            )}
                        </SignedIn>
                    </div>
                </aside>
            )}

            {/* Main Content */}
            <main className="flex-1 min-w-0 flex flex-col transition-all duration-300 h-full overflow-hidden">
                {/* Header - Visible on all screens */}
                <header className="h-16 border-b border-border flex items-center px-4 md:px-8 sticky top-0 bg-bg-primary/80 backdrop-blur-md z-30 justify-between flex-none">
                    <div className="flex items-center gap-3">
                        {!isLandingPage && (
                            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-text-primary">
                                <Menu className="w-6 h-6" />
                            </button>
                        )}
                        <Link to="/" className={cn("font-bold text-2xl tracking-tight flex items-center gap-1", !isLandingPage && "md:hidden")}>
                            <span className="text-accent-blue">Pack</span>
                            <span className="text-text-primary">Vote</span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-4">
                        <SignedOut>
                            <SignInButton mode="modal">
                                <Button variant="primary" size="sm" className="shadow-lg shadow-accent-blue/20">
                                    Sign In
                                </Button>
                            </SignInButton>
                        </SignedOut>
                        <SignedIn>
                            <UserButton afterSignOutUrl="/" />
                        </SignedIn>
                    </div>
                </header>

                <div className={cn(
                    "flex-1 w-full mx-auto animate-fade-in transition-all duration-300",
                    isSidebarCollapsed ? "max-w-[1600px] overflow-hidden p-4 md:p-6" : "max-w-5xl overflow-y-auto p-4 md:p-8"
                )}>
                    <Outlet context={{ setIsSidebarCollapsed }} />
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

