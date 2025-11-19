import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TripService } from '@/services/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, ArrowRight, Calendar, MapPin } from 'lucide-react';
import { CreateTripWizard } from '@/components/CreateTripWizard';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface DashboardProps {
    userEmail: string;
}

export function Dashboard({ userEmail }: DashboardProps) {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const { data: trips, isLoading } = useQuery({
    queryKey: ['trips', userEmail],
    queryFn: () => TripService.getAll(userEmail),
  });

  if (isLoading) {
      return <div className="flex items-center justify-center h-64 text-text-secondary">Loading trips...</div>;
  }

  if (!trips || trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-fade-in">
        <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-text-primary">Welcome!</h1>
            <p className="text-text-secondary text-lg max-w-md mx-auto">
                You don't have any trips yet. Start planning your first adventure.
            </p>
        </div>
        <Button size="lg" onClick={() => setIsWizardOpen(true)} className="h-14 px-8 text-lg shadow-lg shadow-accent-blue/20">
            <Plus className="mr-2 h-5 w-5" />
            Create New Trip
        </Button>
        <CreateTripWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-text-primary">Your Trips</h1>
                <p className="text-text-secondary mt-1">Manage and view your upcoming adventures.</p>
            </div>
            <Button onClick={() => setIsWizardOpen(true)} className="shadow-md shadow-accent-blue/10">
                <Plus className="mr-2 h-4 w-4" />
                New Trip
            </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
                <Link key={trip.id} to={`/trip/${trip.id}`} className="group block h-full">
                    <Card className="h-full transition-all duration-300 hover:border-accent-blue/50 hover:shadow-xl hover:shadow-accent-blue/5 group overflow-hidden border-border/50 bg-bg-secondary/50 backdrop-blur-sm flex flex-col">
                        <div className="h-32 bg-gradient-to-br from-accent-blue/10 to-purple-500/10 p-6 flex flex-col justify-between relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <MapPin className="w-24 h-24 text-accent-blue" />
                            </div>
                            <div className="flex justify-between items-start relative z-10">
                                <span className={cn(
                                    "px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md border",
                                    trip.status === 'finalized' 
                                        ? "bg-green-500/10 text-green-400 border-green-500/20" 
                                        : "bg-white/5 text-text-secondary border-white/10"
                                )}>
                                    {trip.status}
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-text-primary tracking-tight relative z-10 group-hover:text-accent-blue transition-colors">{trip.name}</h3>
                        </div>
                        <CardContent className="p-6 flex-1 flex flex-col">
                            <div className="flex items-center text-sm text-text-secondary mb-4">
                                <Calendar className="w-4 h-4 mr-2 opacity-70" />
                                {trip.target_start_date ? new Date(trip.target_start_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'TBD'}
                            </div>
                            <p className="text-text-secondary line-clamp-2 mb-6 text-sm leading-relaxed flex-1">
                                {trip.description || "No description provided."}
                            </p>
                            <div className="flex items-center text-sm font-medium text-accent-blue group-hover:translate-x-1 transition-transform mt-auto">
                                Open Dashboard <ArrowRight className="ml-1 w-4 h-4" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </div>
        <CreateTripWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
    </div>
  );
}

